-- The home page's "This season" strip: my_moves_left() now also says where the school's Clan Quest season is (James, 29 Oct 2026).
--
-- my_moves_left() as in 20261027000300_monsters_moves_left.sql (no later migration changed it), plus 'season': the school's
-- Clan Quest season for this pupil from clan_season(player) (20261029000400_clans_season_goals.sql), which is
-- { number, day, daysLeft, clockOn }. It works with or without a clan, and number 0 / clockOn false means no season is running.
-- Nothing is written. my_home_page() calls my_moves_left(), so the home page gets this with no other change.

create or replace function public.my_moves_left()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id where public.is_school_user())
  select jsonb_build_object(
    'lord', (select jsonb_build_object(
               'day', h.hero ->> 'day', 'forestLeft', h.hero -> 'forestLeft', 'arenaLeft', h.hero -> 'arenaLeft',
               'masterTried', h.hero -> 'masterTried', 'masterExtra', coalesce(h.hero -> 'masterExtra', to_jsonb(0)),
               'forestPerDay', (public.lord_settings() ->> 'forestPerDay')::integer)
             from public.lord_heroes h where h.player = me.id),
    'clans', (select jsonb_build_object('fightsLeft', c.fights_left, 'perDay', public.clan_fights_per_day(c.player))
              from public.clans c where c.player = me.id),
    'monsters', (select jsonb_build_object('today', public.monster_battles_today(s.player),
                                           'perDay', (public.monster_battle_rules() ->> 'battlesPerDay')::integer)
                 from public.monster_saves s where s.player = me.id),
    'season', public.clan_season(me.id)
  )
  from me
$$;

revoke execute on function public.my_moves_left() from public, anon, authenticated;
grant execute on function public.my_moves_left() to authenticated;
