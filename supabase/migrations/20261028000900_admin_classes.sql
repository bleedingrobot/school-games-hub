-- The Admin page's Classes tab for school admins (docs/TEACHER-VIEW-PLAN.md, section 4.7, stage 6, part 2).
--
-- 1. admin_classes(): every class in the school (archived ones too) with its teachers, student count, warp code and mode,
--    and when a current member last answered a question. Nothing is written.
-- 2. admin_create_class(): an admin makes a class for any teacher at the school. It uses the existing teacher_create_class(),
--    so the name rules, settings and warp code stay the same, then hands the class to that teacher.
--
-- Both call require_school_admin() first (42501) and read only my_school(). Archiving and adding or removing a teacher are
-- the existing teacher_archive_class(), teacher_add_co_teacher() and teacher_remove_co_teacher().

create function public.admin_classes()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_school_admin();
  return (
    select jsonb_build_object('classes', coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'schoolYear', c.school_year, 'yearLevel', c.year_level,
        'archived', c.archived, 'archivedAt', c.archived_at, 'warpCode', c.warp_code, 'warpMode', c.warp_mode,
        'students', (select count(*)::integer from public.class_members m where m.class_id = c.id),
        'teachers', (select coalesce(jsonb_agg(jsonb_build_object(
                         'id', p.id, 'name', p.display_name, 'realName', split_part(u.email, '@', 1))
                       order by split_part(u.email, '@', 1), p.display_name), '[]')
                     from public.class_teachers t
                     join public.profiles p on p.id = t.teacher_id
                     left join auth.users u on u.id = p.id
                     where t.class_id = c.id),
        'lastActive', (select max(q.at) from public.class_members m
                       join public.question_log q on q.player = m.student_id
                       where m.class_id = c.id))
      order by c.archived, c.school_year desc, c.name), '[]'))
    from public.classes c
    where c.school_id = public.my_school()
  );
end;
$$;

create function public.admin_create_class(class_name text, in_year integer, level integer, teacher uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  made uuid;
begin
  perform public.require_school_admin();
  if not exists (select 1 from public.profiles p
                 where p.id = teacher and p.role = 'teacher' and p.school_id = public.my_school()) then
    raise exception 'That person isn''t a teacher at your school.' using errcode = '22023';
  end if;
  -- A blank name is named after the chosen teacher, not the admin making the class.
  made := public.teacher_create_class(
    coalesce(nullif(btrim(coalesce(class_name, '')), ''), public.default_class_name(teacher, in_year)), in_year, level);
  if teacher <> auth.uid() then
    insert into public.class_teachers (class_id, teacher_id) values (made, teacher);
    delete from public.class_teachers where class_id = made and teacher_id = auth.uid();
  end if;
  return made;
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function public.admin_classes(), public.admin_create_class(text, integer, integer, uuid)
from public, anon, authenticated;
grant execute on function public.admin_classes(), public.admin_create_class(text, integer, integer, uuid) to authenticated;
