-- The Famous (James, 22 Nov 2026): the five pupil clans with the most fame at the end of each Clan Quest season win three
-- things at once:
--
--   clan-famous   trophy "Hall of Fame Star", won each season (bronze, silver, gold, like the Clan Veteran)
--   cq-famous     achievement "The Famous": finish a season in the top 5 for fame
--   the-famous    the special Hero Title, owned for good and worn straight away the first time
--
-- The top 5 is the same list as the ceremony's honour roll (clan_season_summary in 20261120001900): the school's pupils only
-- (no teachers, no hidden pupils), fame above 0, the most fame first. Season 1 is given by hand below, to Swift Falcons only
-- (James's choice); from season 2 it is given when the season turns.
--
--   1. The trophy, achievement measure and achievement (counted through clan_quest_counts, Clan Quest's own game hook).
--   2. clan_famous_give(player, season): gives all three to one clan. Safe to call again.
--   3. clan_give_famous(school, season): gives them to that season's top 5. Safe to call again.
--   4. A trigger on clan_school_seasons: clan_nightly moves the school's season number on AFTER it has zeroed every clan's
--      fame (and clans_season_turn has saved each clan's results), so by then the whole season is in clan_season_results.
--      A failure never stops the nightly job.
--   5. Season 1: Swift Falcons.

-- ---------------------------------------------------------------------------
-- 1. The trophy and the achievement
-- ---------------------------------------------------------------------------

insert into public.trophy_types (id, game, name, how, kind, repeat, art, sort) values
  ('clan-famous', 'clan-quest', 'Hall of Fame Star', 'Finish a Clan Quest season in the top 5 for fame.', 'trophy', 'season', null, 36);

-- Clan Quest's game hook, now also counting the seasons finished in the top 5.
create or replace function public.clan_quest_counts(who uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'clan_monster',
    coalesce((select (c.stats ->> 'monsterSlain')::integer from public.clans c where c.player = clan_quest_counts.who), 0),
    'clan_famous',
    (select count(*)::integer from public.trophies w where w.player = clan_quest_counts.who and w.trophy = 'clan-famous'))
$$;

insert into public.achievement_measures (measure) values ('clan_famous');
insert into public.achievement_types (id, game, name, emoji, measure, goal, sort, how, tier) values
  ('cq-famous', 'clan-quest', 'The Famous', '🌟', 'clan_famous', 1, 11,
   'Finish a Clan Quest season in the top 5 for fame.', 3);

-- ---------------------------------------------------------------------------
-- 2. Giving them to one clan
-- ---------------------------------------------------------------------------

create function public.clan_famous_give(player uuid, season integer, fame integer, place integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.award_trophy(clan_famous_give.player, 'clan-famous',
    jsonb_build_object('clanSeason', clan_famous_give.season, 'fame', clan_famous_give.fame, 'place', clan_famous_give.place),
    clan_famous_give.season);
  perform public.award_achievements(clan_famous_give.player, 'clan-quest', now());
  insert into public.owned_titles (player, title) values (clan_famous_give.player, 'the-famous')
  on conflict do nothing;
  if found then
    update public.profiles p set avatar = coalesce(p.avatar, '{}'::jsonb) || jsonb_build_object('title', 'the-famous')
    where p.id = clan_famous_give.player;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Giving them to a season's top 5
-- ---------------------------------------------------------------------------

create function public.clan_give_famous(school integer, season integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select k.player, k.fame, k.place from (
      select x.player, x.fame, row_number() over (order by x.fame desc, x.saved_at, x.player) as place
      from public.clan_season_results x join public.profiles p on p.id = x.player
      where x.season = clan_give_famous.season and x.school_id = clan_give_famous.school
        and p.role = 'student' and not p.hidden and x.fame > 0
    ) k
    where k.place <= 5
    order by k.place
  loop
    perform public.clan_famous_give(r.player, clan_give_famous.season, r.fame, r.place::integer);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. When the season turns
-- ---------------------------------------------------------------------------

create function public.clan_school_season_famous()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Season 1 was given by hand (section 5).
  if new.season > old.season and old.season >= 2 then
    begin
      perform public.clan_give_famous(new.school_id, old.season);
    exception when others then
      raise warning 'giving The Famous failed (%)', sqlstate;
    end;
  end if;
  return null;
end;
$$;

create trigger clan_school_season_famous
after update of season on public.clan_school_seasons
for each row execute function public.clan_school_season_famous();

revoke execute on function
  public.clan_quest_counts(uuid),
  public.clan_famous_give(uuid, integer, integer, integer),
  public.clan_give_famous(integer, integer),
  public.clan_school_season_famous()
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Season 1: Swift Falcons only
-- ---------------------------------------------------------------------------

-- Mirrors SPECIAL_TITLES in shared/quests/titles.ts (shared/quests/titles.test.ts checks they match).
create or replace function public.special_title_ids()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'ultimate-dragon-slayer',
    'tess-the-best',
    'the-famous'
  ]::text[]
$$;

revoke execute on function public.special_title_ids() from public, anon, authenticated;

-- Swift Falcons, the top pupil clan of season 1 (321 fame). Skipped on any copy of the database without that clan's save.
do $$
declare
  r public.clan_season_results;
begin
  select * into r from public.clan_season_results x
  where x.player = '41d0a6c3-ba2e-45b9-b0b7-bda8e58ae966' and x.season = 1;
  if r.player is not null then
    perform public.clan_famous_give(r.player, 1, r.fame, 1);
  end if;
end;
$$;
