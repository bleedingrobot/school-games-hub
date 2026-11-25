-- Online now (James, 25 Nov 2026): how many pupils have the hub open right now, for the teacher's class header and a small
-- chip on the pupils' home page. Counts only, never names.
--
-- "Online now" is the hub_here rule (20261120000500_hub_here.sql): the hub says "I'm here" every 30 seconds while it is
-- open and showing, on every page including games, and a pupil counts for 75 seconds after. hub_here() only records
-- school pupils who aren't hidden.
--
-- hub_online_now(): any signed-in school user: { school } pupils online in my school.
-- teacher_online_now(class): a teacher of that class (or a school admin): { class, school }.

create function public.hub_online_now()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('school', (
    select count(*)::integer
    from public.hub_here h
    join public.profiles p on p.id = h.player
    where public.is_school_user()
      and h.seen_at > now() - interval '75 seconds'
      and p.role = 'student' and not p.hidden
      and p.school_id = public.my_school()))
$$;

create function public.teacher_online_now(target_class uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if target_class is null or not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'class', (
      select count(*)::integer
      from public.class_members m
      join public.hub_here h on h.player = m.student_id
      join public.profiles p on p.id = m.student_id
      where m.class_id = target_class
        and h.seen_at > now() - interval '75 seconds'
        and p.role = 'student' and not p.hidden),
    'school', (public.hub_online_now() ->> 'school')::integer);
end;
$$;

revoke execute on function public.hub_online_now(), public.teacher_online_now(uuid) from public, anon, authenticated;
grant execute on function public.hub_online_now(), public.teacher_online_now(uuid) to authenticated;
