-- Help me on the teacher's Progress tab (docs/plans/help-me/PLAN.md H9, James 26 Nov 2026): which pupils opened Help me in
-- the last `days` days, how often, how many of those helped answers were right, and the questions they asked help on most.
-- Helped answers never count towards the ladder (maths_help_uses, 20261126200655_maths_help_me.sql); this only shows them.
create function public.teacher_help_uses(target_class uuid, days integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  kids uuid[];
  since timestamptz;
begin
  perform public.require_teacher();
  if days is null or days < 1 or days > 60 then
    raise exception 'Choose between 1 and 60 days.' using errcode = '22023';
  end if;
  if target_class is null or not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  since := now() - make_interval(days => days);
  select coalesce(array_agg(s.id), '{}') into kids
  from public.my_students() s(id)
  where exists (select 1 from public.class_members m where m.student_id = s.id and m.class_id = target_class);
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.player, 'name', p.display_name, 'realName', split_part(u.email, '@', 1),
        'helped', t.helped, 'right', t.right_after, 'days', t.days, 'lastAt', t.last_at,
        'topKeys', (
          select coalesce(jsonb_agg(k.fact_key order by k.n desc, k.fact_key), '[]')
          from (
            select h.fact_key, count(*) as n from public.maths_help_uses h
            where h.player = t.player and h.answered_at > since
            group by h.fact_key order by count(*) desc, h.fact_key limit 3) k))
        order by t.helped desc, p.display_name), '[]')
    from (
      select h.player,
             count(*)::integer as helped,
             count(*) filter (where h.correct)::integer as right_after,
             count(distinct (h.answered_at at time zone 'Pacific/Auckland')::date)::integer as days,
             max(h.answered_at) as last_at
      from public.maths_help_uses h
      where h.player = any (kids) and h.answered_at > since
      group by h.player) t
    join public.profiles p on p.id = t.player
    join auth.users u on u.id = t.player
  );
end;
$$;

revoke all on function public.teacher_help_uses(uuid, integer) from public, anon;
grant execute on function public.teacher_help_uses(uuid, integer) to authenticated;
