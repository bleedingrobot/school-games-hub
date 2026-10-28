-- The Admin page for school admins: Overview, Students and Teachers (docs/TEACHER-VIEW-PLAN.md, section 4.7, stage 6).
--
-- 1. admin_overview(): school-wide numbers (classes, students, teachers, admins, this week's questions) and what needs an admin:
--    students in no class (or only in an archived one), classes with no teacher, and join requests waiting over a day.
-- 2. admin_students(): every student in the school with their class and when they last played. It reads the shared
--    teacher_students() so the games' "last played" hooks keep working; teacher_students() is not changed.
-- 3. admin_teachers(): every teacher in the school, whether they are a school admin, and the classes they teach.
--
-- All three call require_school_admin() first (42501) and read only my_school(). Nothing is written; the actions on the page
-- are the existing school_set_admin(), teacher_set_role(), and so on.

create function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  school integer;
begin
  perform public.require_school_admin();
  school := public.my_school();
  return (
    with week as (
      select count(distinct q.player)::integer as active, count(*)::integer as shown,
             (count(*) filter (where q.skipped))::integer as skipped
      from public.question_log q
      join public.profiles p on p.id = q.player
      where p.school_id = school and p.role = 'student' and q.at > now() - interval '7 days'
    )
    select jsonb_build_object(
      'counts', jsonb_build_object(
        'classes', (select count(*)::integer from public.classes c where c.school_id = school and not c.archived),
        'students', (select count(*)::integer from public.profiles p where p.school_id = school and p.role = 'student'),
        'teachers', (select count(*)::integer from public.profiles p where p.school_id = school and p.role = 'teacher'),
        'admins', (select count(*)::integer from public.profiles p
                   where p.school_id = school and p.role = 'teacher' and p.school_admin),
        'activeWeek', w.active,
        'shownWeek', w.shown,
        'skippedWeek', w.skipped),
      'noClass', (select count(*)::integer from public.profiles p
                  where p.school_id = school and p.role = 'student'
                    and not exists (select 1 from public.class_members m join public.classes c on c.id = m.class_id
                                    where m.student_id = p.id and not c.archived)),
      'classesNoTeacher', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name), '[]')
                           from public.classes c
                           where c.school_id = school and not c.archived
                             and not exists (select 1 from public.class_teachers t where t.class_id = c.id)),
      'oldWarp', (select count(*)::integer from public.warp_requests r join public.classes c on c.id = r.class_id
                  where c.school_id = school and r.status = 'pending' and r.created_at < now() - interval '1 day'))
    from week w
  );
end;
$$;

create function public.admin_students()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_school_admin();
  return (
    select jsonb_build_object('students', coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.display_name, 'realName', t.real_name, 'avatar', t.avatar, 'hidden', t.hidden,
        'classId', c.id, 'className', c.name, 'classArchived', c.archived, 'lastPlayed', t.last_played)
      order by t.real_name, t.display_name), '[]'))
    from public.teacher_students() t
    join public.profiles p on p.id = t.id and p.school_id = public.my_school()
    left join public.class_members m on m.student_id = t.id
    left join public.classes c on c.id = m.class_id
    where t.role = 'student'
  );
end;
$$;

create function public.admin_teachers()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_school_admin();
  return (
    select jsonb_build_object('teachers', coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.display_name, 'realName', split_part(u.email, '@', 1), 'avatar', p.avatar,
        'admin', p.school_admin, 'me', p.id = auth.uid(),
        'classes', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name), '[]')
                    from public.class_teachers t join public.classes c on c.id = t.class_id
                    where t.teacher_id = p.id and not c.archived))
      order by split_part(u.email, '@', 1), p.display_name), '[]'))
    from public.profiles p
    left join auth.users u on u.id = p.id
    where p.role = 'teacher' and p.school_id = public.my_school()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function public.admin_overview(), public.admin_students(), public.admin_teachers()
from public, anon, authenticated;
grant execute on function public.admin_overview(), public.admin_students(), public.admin_teachers() to authenticated;
