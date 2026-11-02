-- Two more chips on the home page cards (James, 2 Nov 2026): Diamond Drop's new level, and Star Trader's jumps left today.
--
-- my_moves_left() as in 20261030000100_home_lord_season.sql, plus:
--   'diamond': { deepest, newLevelDate } from the pupil's diamond_players row (null if they've never played): the deepest
--   level passed and the New Zealand date it was first passed. The browser says "Level 4 ready" or "New level tomorrow"
--   with the game's own rule (levelsOpen in shared/diamond/progress.ts: one new level a day, NZ date).
--   'trader': { day, jumpsLeft, perDay } from the pupil's trader_games row (null if they've never played): the game's day
--   number (whole New Zealand days since 1970, nzDay in supabase/functions/trader/handler.ts), the jumps left on that day,
--   and the class's jumps a day (app_settings.trader_jumps). On a later day the game gives back perDay jumps.
-- Nothing is written. my_home_page() calls my_moves_left(), so the home page gets this with no other change.
--
-- Depends on 20261102000200_diamond.sql and 20261031000100_trader.sql.

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
    'lordSeason', jsonb_build_object('start', ls.s -> 'seasonStart', 'on', coalesce((ls.s ->> 'enabled')::boolean, false)),
    'diamond', (select jsonb_build_object('deepest', coalesce((d.state ->> 'deepest')::integer, 0),
                                          'newLevelDate', d.state -> 'newLevelDate')
                from public.diamond_players d where d.player = me.id),
    'trader', (select jsonb_build_object('day', (g.game -> 't' ->> 'day')::integer, 'jumpsLeft', (g.game -> 't' ->> 'jumpsLeft')::integer,
                                         'perDay', coalesce((select s.trader_jumps from public.settings_of(me.id) s), 10))
               from public.trader_games g where g.player = me.id)
  )
  from me, ls
$$;

revoke execute on function public.my_moves_left() from public, anon, authenticated;
grant execute on function public.my_moves_left() to authenticated;
