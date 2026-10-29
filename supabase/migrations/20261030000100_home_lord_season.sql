-- The home page's Dragon Maths season strip: my_moves_left() now also says where the school's Dragon Maths season is, and the
-- hero's level and experience (James, 29 Oct 2026; docs/DRAGON-SEASON-TIMELINE-PLAN.md).
--
-- my_moves_left() as in 20261029000700_home_season.sql, plus:
--   'lord' gains 'level' and 'exp' (from the hero), so the strip can say "You are level 7: 5 more masters to the dragon."
--   'lordSeason': { start, on } from lord_settings() (20261028000400_lord_school_season.sql): the school's first day of season 1
--   (YYYY-MM-DD, or null) and whether Dragon Maths is open for this pupil (the class switch, and the school not on holiday pause).
--   The browser works out the season number and day from `start` with the game's own rule (seasonOf in shared/lord/engine.ts).
-- Nothing is written. my_home_page() calls my_moves_left(), so the home page gets this with no other change.

create or replace function public.my_moves_left()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id where public.is_school_user()),
  ls as (select public.lord_settings() as s)
  select jsonb_build_object(
    'lord', (select jsonb_build_object(
               'day', h.hero ->> 'day', 'forestLeft', h.hero -> 'forestLeft', 'arenaLeft', h.hero -> 'arenaLeft',
               'masterTried', h.hero -> 'masterTried', 'masterExtra', coalesce(h.hero -> 'masterExtra', to_jsonb(0)),
               'forestPerDay', (ls.s ->> 'forestPerDay')::integer,
               'level', h.hero -> 'level', 'exp', h.hero -> 'exp')
             from public.lord_heroes h where h.player = me.id),
    'clans', (select jsonb_build_object('fightsLeft', c.fights_left, 'perDay', public.clan_fights_per_day(c.player))
              from public.clans c where c.player = me.id),
    'monsters', (select jsonb_build_object('today', public.monster_battles_today(s.player),
                                           'perDay', (public.monster_battle_rules() ->> 'battlesPerDay')::integer)
                 from public.monster_saves s where s.player = me.id),
    'season', public.clan_season(me.id),
    'lordSeason', jsonb_build_object('start', ls.s -> 'seasonStart', 'on', coalesce((ls.s ->> 'enabled')::boolean, false))
  )
  from me, ls
$$;

revoke execute on function public.my_moves_left() from public, anon, authenticated;
grant execute on function public.my_moves_left() to authenticated;
