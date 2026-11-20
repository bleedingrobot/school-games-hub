-- Clan Quest: the end of a season (docs/plans/clans-season-end/PLAN.md, stage 2; James, 20 Nov 2026).
--
-- When the school's Clan Quest season moves on, clan_nightly sets every clan's fame to 0 at midnight, and the clans server
-- starts each clan again on its next request (newSeasonSave in shared/clans/season.ts). Nothing kept the fame table or the
-- members' levels. This keeps what each clan did that season, so the new-season ceremony can show it, and gives everyone who
-- played the Clan Veteran trophy.
--
--   1. clan_season_results: one row per clan per finished season. Nobody signed in reads it directly.
--   2. clan-veteran: "Clan Veteran" trophy, won each season played (bronze, silver, gold).
--   3. A trigger on clans: when clan_nightly zeroes fame for a new season (the school's clan_school_seasons row still has the
--      old number), the clan's results are saved for the old season and the trophy given, in the same update. No change to
--      clan_nightly or the clans function, so the order inside the nightly job doesn't matter. A failure never stops the update.
--      The same trigger also stamps the old season on a clan that has none in `extras` (30 of 44 on 20 Nov: they hadn't been
--      saved since 20261116000100 began keeping it). Without that the server treats the clan as new, stamps it with the NEW
--      season and never starts it again.
--   4. clan_season_summary(): the signed-in player's last finished season, its trophies, and the school's top 10 by fame.
--   5. clan_season_seen(season): the ceremony has been watched (so it opens once, on any Chromebook).

-- ---------------------------------------------------------------------------
-- 1. The results
-- ---------------------------------------------------------------------------

create table public.clan_season_results (
  player uuid not null references public.profiles (id) on delete cascade,
  season integer not null check (season >= 1),
  school_id integer,
  clan_name text not null default '',
  fame integer not null default 0,
  gold integer not null default 0,
  followers integer not null default 0,
  -- [{ slot, name, race, cls, level, look }] from clan_members, slot order.
  members jsonb not null default '[]'::jsonb,
  -- The highest member level, for the trophy and quick reading.
  best_level integer not null default 1,
  -- { trainingHall, smithy, church } from clans.village, plus the village buildings from clan_empires (`levels`).
  buildings jsonb not null default '{}'::jsonb,
  monster_beaten boolean not null default false,
  village_done boolean not null default false,
  monster_tries integer not null default 0,
  -- When the pupil watched the new-season ceremony for this season. Null until then.
  seen_at timestamptz,
  saved_at timestamptz not null default now(),
  primary key (player, season)
);
create index clan_season_results_school on public.clan_season_results (school_id, season, fame desc);

alter table public.clan_season_results enable row level security;
revoke all on public.clan_season_results from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The trophy
-- ---------------------------------------------------------------------------

insert into public.trophy_types (id, game, name, how, kind, repeat, art, sort) values
  ('clan-veteran', 'clan-quest', 'Clan Veteran', 'Play a whole Clan Quest season: earn fame or level up a member.',
   'trophy', 'season', null, 35);

-- ---------------------------------------------------------------------------
-- 3. Saving them when the season turns
-- ---------------------------------------------------------------------------

-- Saves one clan's results for its season (fame, gold and followers as they were before the reset; members, buildings and
-- the Hall row as they are now, which is still the old season's until the clan's next request) and gives the Clan Veteran
-- trophy if they played. Safe to call again.
create function public.clan_save_season(player uuid, season integer, fame integer, clan_name text, gold integer,
                                        followers integer, village jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ms jsonb;
  best integer;
  empire_levels jsonb;
  h public.clan_hall;
  sid integer;
begin
  select coalesce(jsonb_agg(jsonb_build_object('slot', m.slot, 'name', m.member ->> 'name', 'race', m.member ->> 'race',
           'cls', m.member ->> 'cls', 'level', coalesce((m.member ->> 'level')::integer, 1), 'look', m.member ->> 'look')
           order by m.slot), '[]'::jsonb),
         coalesce(max(coalesce((m.member ->> 'level')::integer, 1)), 1)
    into ms, best
  from public.clan_members m where m.player = clan_save_season.player;
  select e.empire -> 'levels' into empire_levels from public.clan_empires e where e.player = clan_save_season.player;
  select * into h from public.clan_hall x where x.player = clan_save_season.player and x.season = clan_save_season.season;
  select p.school_id into sid from public.profiles p where p.id = clan_save_season.player;
  insert into public.clan_season_results
    (player, season, school_id, clan_name, fame, gold, followers, members, best_level, buildings,
     monster_beaten, village_done, monster_tries)
  values (
    clan_save_season.player, clan_save_season.season, sid, coalesce(clan_save_season.clan_name, ''),
    greatest(0, coalesce(clan_save_season.fame, 0)), coalesce(clan_save_season.gold, 0), coalesce(clan_save_season.followers, 0),
    ms, best, coalesce(clan_save_season.village, '{}'::jsonb) || coalesce(empire_levels, '{}'::jsonb),
    h.monster_done_on is not null, h.village_done_on is not null, coalesce(h.monster_tries, 0))
  on conflict do nothing;
  if coalesce(clan_save_season.fame, 0) > 0 or best >= 2 then
    perform public.award_trophy(clan_save_season.player, 'clan-veteran',
      jsonb_build_object('clanSeason', clan_save_season.season, 'fame', coalesce(clan_save_season.fame, 0), 'level', best),
      clan_save_season.season);
  end if;
end;
$$;

-- Before clan_nightly's "fame starts again" update. Every other fame change happens while the school's recorded season and its
-- clock agree, so it does nothing then.
create function public.clans_season_turn()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid integer;
  last integer;
  now_no integer;
  stamped integer;
begin
  if new.fame <> 0 then
    return new;
  end if;
  select p.school_id into sid from public.profiles p where p.id = old.player;
  select q.season into last from public.clan_school_seasons q where q.school_id = sid;
  if last is null or last < 1 then
    return new;
  end if;
  now_no := (public.clan_school_season(sid) ->> 'number')::integer;
  if now_no is null or now_no <= last then
    return new;
  end if;
  stamped := (old.extras ->> 'season')::integer;
  -- A clan already stamped with an earlier season didn't play this one: nothing to keep, and the server will start it again.
  if stamped is null or stamped = last then
    begin
      perform public.clan_save_season(old.player, last, old.fame, old.name, old.gold, old.followers, old.village);
    exception when others then
      raise warning 'saving a Clan Quest season failed (%)', sqlstate;
    end;
  end if;
  if stamped is null then
    new.extras := coalesce(new.extras, '{}'::jsonb) || jsonb_build_object('season', last);
  end if;
  return new;
end;
$$;

create trigger clans_season_turn
before update of fame on public.clans
for each row execute function public.clans_season_turn();

-- ---------------------------------------------------------------------------
-- 4. What the ceremony shows
-- ---------------------------------------------------------------------------

-- The signed-in player's last finished Clan Quest season, or null if they have none:
-- { season, seen, place, clans, monsterWins,
--   mine: { clanName, fame, gold, followers, members, bestLevel, buildings, monsterBeaten, villageDone, monsterTries },
--   trophies: [trophy ids won that season], top: [{ name, avatar, clanName, fame, monster, village, isMe }] }
-- `top` is the school's pupils only (no teachers, no hidden pupils) with fame above 0, the most fame first, at most 10.
-- `place` is my place in that list's order (null for a teacher, a hidden pupil or no fame). `clans` counts the school's
-- pupil clans saved for that season, and `monsterWins` how many of them beat the monster.
create function public.clan_season_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.clan_season_results;
  school integer;
begin
  perform public.require_school_user();
  school := public.my_school();
  select * into r from public.clan_season_results x where x.player = auth.uid() order by x.season desc limit 1;
  if r.player is null then
    return null;
  end if;
  return (
    with ranked as (
      select x.player, x.clan_name, x.fame, x.monster_beaten, x.village_done, p.display_name, p.avatar,
             row_number() over (order by x.fame desc, x.saved_at, x.player) as place
      from public.clan_season_results x join public.profiles p on p.id = x.player
      where x.season = r.season and x.school_id = school and p.role = 'student' and not p.hidden and x.fame > 0
    )
    select jsonb_build_object(
      'season', r.season,
      'seen', r.seen_at is not null,
      'place', (select k.place from ranked k where k.player = auth.uid()),
      'clans', (select count(*)::integer from public.clan_season_results x join public.profiles p on p.id = x.player
                where x.season = r.season and x.school_id = school and p.role = 'student' and not p.hidden),
      'monsterWins', (select count(*)::integer from public.clan_season_results x join public.profiles p on p.id = x.player
                      where x.season = r.season and x.school_id = school and p.role = 'student' and not p.hidden
                        and x.monster_beaten),
      'mine', jsonb_build_object('clanName', r.clan_name, 'fame', r.fame, 'gold', r.gold, 'followers', r.followers,
        'members', r.members, 'bestLevel', r.best_level, 'buildings', r.buildings, 'monsterBeaten', r.monster_beaten,
        'villageDone', r.village_done, 'monsterTries', r.monster_tries),
      'trophies', coalesce((
        select jsonb_agg(w.trophy order by t.sort)
        from public.trophies w join public.trophy_types t on t.id = w.trophy
        where w.player = auth.uid() and t.game = 'clan-quest' and w.season = r.season), '[]'::jsonb),
      'top', coalesce((
        select jsonb_agg(jsonb_build_object('name', k.display_name, 'avatar', k.avatar, 'clanName', k.clan_name, 'fame', k.fame,
          'monster', k.monster_beaten, 'village', k.village_done, 'isMe', k.player = auth.uid()) order by k.place)
        from ranked k where k.place <= 10), '[]'::jsonb)
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Watched
-- ---------------------------------------------------------------------------

create function public.clan_season_seen(season integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_school_user();
  update public.clan_season_results x set seen_at = now()
  where x.player = auth.uid() and x.season = clan_season_seen.season and x.seen_at is null;
end;
$$;

revoke execute on function
  public.clan_save_season(uuid, integer, integer, text, integer, integer, jsonb),
  public.clans_season_turn(),
  public.clan_season_summary(),
  public.clan_season_seen(integer)
from public, anon, authenticated;
grant execute on function public.clan_season_summary(), public.clan_season_seen(integer) to authenticated;
