-- "Moves left today" on the dashboard cards: Maths Monsters battles too (James, 27 Oct 2026), like Clan Quest's mine fights.
--
-- my_moves_left() as in 20261019000100_my_moves_left.sql (no later migration changed it), plus 'monsters': battles counted
-- today and the limit, from monster_battles_today() and monster_battle_rules() (20261027000200_monster_battle_cap.sql).
-- A pupil with no Maths Monsters save gets null for it, like a pupil with no hero or clan. Nothing is written.
-- my_home_page() calls my_moves_left(), so the dashboard gets this with no other change.

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
                 from public.monster_saves s where s.player = me.id)
  )
  from me
$$;

revoke execute on function public.my_moves_left() from public, anon, authenticated;
grant execute on function public.my_moves_left() to authenticated;
