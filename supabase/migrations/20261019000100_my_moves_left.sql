-- "Moves left today" on the dashboard cards: one read-only function that gives the signed-in pupil their own numbers for the
-- games with a daily allowance. Dragon Maths: the hero's day and what is left (the page works out a new day's allowance the same
-- way the server does, so a pupil who hasn't played yet today sees a full count). Clan Quest: mine fights left and the number a day.
-- Nothing is written. A pupil with no hero or no clan gets null for that game.

create function public.my_moves_left()
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
              from public.clans c where c.player = me.id)
  )
  from me
$$;

revoke execute on function public.my_moves_left() from public, anon, authenticated;
grant execute on function public.my_moves_left() to authenticated;
