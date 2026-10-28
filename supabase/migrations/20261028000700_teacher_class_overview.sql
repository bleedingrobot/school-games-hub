-- The Students tab for one class, and the student page (docs/TEACHER-VIEW-PLAN.md, section 4.3, stage 4).
--
-- 1. teacher_students(target_class): the teacher's player list (teacher_students()) for the students in one class only. It reads
--    the shared function rather than copying it, so the games' "last played" hooks (hub_games) keep working in both. The
--    argument has no default on purpose: with a default, a call with no arguments could mean either function and PostgREST
--    would refuse it. teacher_students() is not changed.
-- 2. teacher_class_overview(target_class): one call for the class roster and Today's counts. For each student in the class:
--    the list row above, how many questions they were shown and skipped in the last 7 days, when they were last active (a
--    finished game or a question shown, whichever is later), and their maths focus with their ladder place (maths_focus_of).
-- 3. teacher_student_card(student): the top of the student page, so a link to it works on its own: name, real name, avatar,
--    hidden, their class, their maths focus and ladder place, and the last 7 days' questions and skips. A teacher may open a
--    student in one of their classes (a school admin: any student in the school), or a teacher of their school, as the
--    player list shows them.
--
-- All three check the teacher on the server (42501 for a class or student they don't teach; 22023 for no class), as
-- teacher_question_skips() and the class reports do. Nothing is written.

create function public.teacher_students(target_class uuid)
returns table(id uuid, display_name text, real_name text, avatar jsonb, role text, hidden boolean, bot_games integer, friend_games integer, points integer, last_played timestamp with time zone, joined timestamp with time zone)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if target_class is null then
    raise exception 'Choose a class first.' using errcode = '22023';
  end if;
  if not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  return query
  select t.* from public.teacher_students() t
  where t.role = 'student'
    and exists (select 1 from public.class_members m where m.student_id = t.id and m.class_id = target_class);
end;
$$;

create function public.teacher_class_overview(target_class uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if target_class is null then
    raise exception 'Choose a class first.' using errcode = '22023';
  end if;
  if not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  return (
    with roster as (
      select * from public.teacher_students(target_class)
    ),
    asked as (
      select q.player, count(*)::integer as shown, count(*) filter (where q.skipped)::integer as skipped, max(q.at) as last_at
      from public.question_log q
      where q.player in (select r.id from roster r) and q.at > now() - interval '7 days'
      group by q.player
    )
    select jsonb_build_object(
      'students', coalesce(jsonb_agg(jsonb_build_object(
          'id', r.id, 'name', r.display_name, 'realName', r.real_name, 'avatar', r.avatar, 'hidden', r.hidden,
          'games', r.bot_games + r.friend_games, 'points', r.points, 'lastPlayed', r.last_played,
          'lastActive', greatest(r.last_played, a.last_at),
          'shown', coalesce(a.shown, 0), 'skipped', coalesce(a.skipped, 0),
          'focus', public.maths_focus_of(r.id))
        order by r.display_name), '[]'))
    from roster r
    left join asked a on a.player = r.id
  );
end;
$$;

create function public.teacher_student_card(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if not (public.can_manage_student(student)
          or exists (select 1 from public.profiles p
                     where p.id = student and p.role = 'teacher' and p.school_id = public.my_school())) then
    raise exception 'That player isn''t in one of your classes.' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'id', p.id, 'name', p.display_name, 'realName', split_part(u.email, '@', 1), 'avatar', p.avatar,
      'role', p.role, 'hidden', p.hidden,
      'classes', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name), '[]')
                  from public.class_members m join public.classes c on c.id = m.class_id
                  where m.student_id = p.id),
      'focus', case when p.role = 'student' then public.maths_focus_of(p.id) end,
      'week', (select jsonb_build_object('shown', count(*), 'skipped', count(*) filter (where q.skipped))
               from public.question_log q
               where q.player = p.id and q.at > now() - interval '7 days'))
    from public.profiles p
    left join auth.users u on u.id = p.id
    where p.id = student
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.teacher_students(uuid), public.teacher_class_overview(uuid), public.teacher_student_card(uuid)
from public, anon, authenticated;
grant execute on function
  public.teacher_students(uuid), public.teacher_class_overview(uuid), public.teacher_student_card(uuid)
to authenticated;
