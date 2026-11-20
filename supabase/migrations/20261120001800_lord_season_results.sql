-- Dragon Maths: the end of a season (docs/plans/dragon-season-end/PLAN.md, stage 2; James, 20 Nov 2026).
--
-- When a new dragon season starts, the lord server starts every hero again on their first request (shared/lord/server.ts,
-- "A new season starts the hero again") and the old hero is overwritten. This keeps what each hero did that season, so
-- the new-season ceremony can show it, and gives everyone who played the Season Veteran trophy.
--
--   1. lord_season_results: one row per player per finished dragon season. Nobody signed in reads it directly.
--   2. dm-veteran: "Season Veteran" trophy, won each season played (bronze, silver, gold, like the sword).
--   3. A trigger on lord_heroes: when lord_commit saves a hero with a higher season number than before, the old hero's
--      results are saved for the old season and the trophy given, in the same save. No lord function change or
--      redeploy, so no reset can be missed. A failure never loses the save.
--   4. lord_season_summary(): the signed-in player's last finished season, its trophies, and the school's slayers.
--   5. lord_season_seen(season): the ceremony has been watched (so it opens once, on any Chromebook).

-- ---------------------------------------------------------------------------
-- 1. The results
-- ---------------------------------------------------------------------------

create table public.lord_season_results (
  player uuid not null references public.profiles (id) on delete cascade,
  season integer not null check (season >= 1),
  hero_class text not null default '',
  level integer not null default 1 check (level >= 1),
  exp bigint not null default 0,
  gold bigint not null default 0,
  masters integer not null default 0,
  forest_wins integer not null default 0,
  arena_wins integer not null default 0,
  weapon integer not null default 0,
  armour integer not null default 0,
  -- Dragon wins that season (from lord_hall; the hero only keeps the all-season count).
  dragons integer not null default 0,
  -- When the pupil watched the new-season ceremony for this season. Null until then.
  seen_at timestamptz,
  saved_at timestamptz not null default now(),
  primary key (player, season)
);

alter table public.lord_season_results enable row level security;
revoke all on public.lord_season_results from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The trophy
-- ---------------------------------------------------------------------------

insert into public.trophy_types (id, game, name, how, kind, repeat, art, sort) values
  ('dm-veteran', 'dragon-maths', 'Season Veteran', 'Play a whole Dragon Maths season: win in the forest or reach level 2.',
   'trophy', 'season', null, 30);

-- ---------------------------------------------------------------------------
-- 3. Saving them when the season turns
-- ---------------------------------------------------------------------------

-- Saves one old hero's results for its season and gives the Season Veteran trophy if they played. Safe to call again.
create function public.lord_save_season(player uuid, season integer, hero jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
  lvl integer := greatest(1, coalesce((hero ->> 'level')::integer, 1));
  forest integer := coalesce((hero ->> 'forestWins')::integer, 0);
begin
  select coalesce(hl.kills, 0) into n from public.lord_hall hl
  where hl.player = lord_save_season.player and hl.season = lord_save_season.season;
  insert into public.lord_season_results
    (player, season, hero_class, level, exp, gold, masters, forest_wins, arena_wins, weapon, armour, dragons)
  values (
    lord_save_season.player, lord_save_season.season, coalesce(hero ->> 'heroClass', ''), lvl,
    coalesce((hero ->> 'exp')::bigint, 0),
    coalesce((hero ->> 'gold')::bigint, 0) + coalesce((hero ->> 'bank')::bigint, 0),
    coalesce((hero ->> 'masterWins')::integer, 0), forest, coalesce((hero ->> 'arenaWins')::integer, 0),
    coalesce((hero ->> 'weapon')::integer, 0), coalesce((hero ->> 'armour')::integer, 0), coalesce(n, 0))
  on conflict do nothing;
  if forest >= 1 or lvl >= 2 then
    perform public.award_trophy(lord_save_season.player, 'dm-veteran',
      jsonb_build_object('dragonSeason', lord_save_season.season, 'level', lvl), lord_save_season.season);
  end if;
end;
$$;

create function public.lord_heroes_season_turn()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.season > old.season then
    begin
      perform public.lord_save_season(old.player, old.season, old.hero);
    exception when others then
      raise warning 'saving a Dragon Maths season failed (%)', sqlstate;
    end;
  end if;
  return new;
end;
$$;

create trigger lord_heroes_season_turn
before update of season on public.lord_heroes
for each row execute function public.lord_heroes_season_turn();

-- ---------------------------------------------------------------------------
-- 4. What the ceremony shows
-- ---------------------------------------------------------------------------

-- The signed-in player's last finished dragon season, or null if they have none:
-- { season, seen, mine: { heroClass, level, masters, forestWins, arenaWins, gold, weapon, armour, dragons },
--   trophies: [trophy ids won that season], slayers: [{ name, avatar, kills, isMe }], kills }
-- Slayers are the school's pupils (no teachers, no hidden pupils), most kills first, then the earliest.
-- `kills` is every dragon win that season by those slayers.
create function public.lord_season_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.lord_season_results;
  school integer;
begin
  perform public.require_school_user();
  school := public.my_school();
  select * into r from public.lord_season_results x where x.player = auth.uid() order by x.season desc limit 1;
  if r.player is null then
    return null;
  end if;
  return jsonb_build_object(
    'season', r.season,
    'seen', r.seen_at is not null,
    'mine', jsonb_build_object('heroClass', r.hero_class, 'level', r.level, 'masters', r.masters,
      'forestWins', r.forest_wins, 'arenaWins', r.arena_wins, 'gold', r.gold, 'weapon', r.weapon, 'armour', r.armour,
      'dragons', r.dragons),
    'trophies', coalesce((
      select jsonb_agg(w.trophy order by t.sort)
      from public.trophies w join public.trophy_types t on t.id = w.trophy
      where w.player = auth.uid() and t.game = 'dragon-maths' and w.season = r.season), '[]'::jsonb),
    'slayers', coalesce((
      select jsonb_agg(jsonb_build_object('name', p.display_name, 'avatar', p.avatar, 'kills', hl.kills,
        'isMe', hl.player = auth.uid()) order by hl.kills desc, hl.first_at)
      from public.lord_hall hl join public.profiles p on p.id = hl.player
      where hl.season = r.season and p.school_id = school and p.role = 'student' and not p.hidden), '[]'::jsonb),
    'kills', (
      select coalesce(sum(hl.kills), 0)::integer
      from public.lord_hall hl join public.profiles p on p.id = hl.player
      where hl.season = r.season and p.school_id = school and p.role = 'student' and not p.hidden)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Watched
-- ---------------------------------------------------------------------------

create function public.lord_season_seen(season integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_school_user();
  update public.lord_season_results x set seen_at = now()
  where x.player = auth.uid() and x.season = lord_season_seen.season and x.seen_at is null;
end;
$$;

revoke execute on function
  public.lord_save_season(uuid, integer, jsonb),
  public.lord_heroes_season_turn(),
  public.lord_season_summary(),
  public.lord_season_seen(integer)
from public, anon, authenticated;
grant execute on function public.lord_season_summary(), public.lord_season_seen(integer) to authenticated;
