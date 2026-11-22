-- Unlimited today for teachers too (James, 22 Nov 2026): a class's "Unlimited today" switch also lifts the limit for the
-- teachers of that class. A teacher's settings row is their first class's, so a switch turned on in another class they
-- teach never reached them. settings_of now adds every game switched on today in any (not archived) class the player
-- teaches, as well as their own Bonus Turns Day. Pupils are unchanged: they teach no class.

-- As 20261119000600, plus today's switches from the classes the player teaches.
create or replace function public.settings_of(player uuid)
returns setof public.app_settings
language sql
stable
security definer
set search_path = ''
as $$
  select merged.*
  from public.app_settings s
  cross join lateral jsonb_populate_record(s, jsonb_build_object('unlimited_days', s.unlimited_days
    || coalesce(
      (select jsonb_object_agg(e.key, e.value)
       from public.class_teachers t
       join public.classes c on c.id = t.class_id and not c.archived
       join public.app_settings cs on cs.class_id = t.class_id
       cross join lateral jsonb_each_text(cs.unlimited_days) e
       where t.teacher_id = settings_of.player
         and e.value = to_char((now() at time zone 'Pacific/Auckland')::date, 'YYYY-MM-DD')),
      '{}'::jsonb)
    || coalesce(
      (select jsonb_object_agg(b.game, to_char(b.day, 'YYYY-MM-DD'))
       from public.bonus_turns b
       where b.player = settings_of.player and b.day = (now() at time zone 'Pacific/Auckland')::date),
      '{}'::jsonb))) merged
  where s.id = public.settings_id_of(player)
$$;
