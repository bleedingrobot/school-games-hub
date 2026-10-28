-- The Admin page's End of year tab for school admins (docs/TEACHER-VIEW-PLAN.md, section 4.7 and section 6, stage 6, part 3).
--
-- 1. admin_log: one row for every end-of-year step an admin runs, so a second admin can see what was already done. Nobody
--    reads or writes the table directly (row level security on, no policies, no grants); only the functions below do.
-- 2. admin_log_add(): the private helper that writes a log row. It is not callable by clients.
-- 3. admin_year(): the latest row for each step plus the last 20 rows. Nothing is written.
-- 4. admin_mark_step(): tick off the two steps that are done somewhere else ('classes' and 'dragon').
-- 5. admin_archive_classes(), admin_delete_leavers(), admin_new_points_season(), admin_clans_new_season(): do the work AND
--    write the log row in the same transaction, so the log can be trusted. They use the existing teacher_archive_class(),
--    teacher_new_season() and teacher_clans_new_season(); deleting a leaver is the same delete teacher_delete_student() does.
--
-- Every public function calls require_school_admin() first (42501) and touches only my_school().

create table public.admin_log (
  id bigint generated always as identity primary key,
  school_id integer not null references public.schools(id) on delete cascade,
  at timestamptz not null default now(),
  actor uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('classes', 'archive', 'leavers', 'points', 'fame', 'dragon')),
  detail jsonb not null default '{}'
);
create index admin_log_school_action_at on public.admin_log (school_id, action, at desc);
alter table public.admin_log enable row level security;
revoke all on table public.admin_log from public, anon, authenticated;

create function public.admin_log_add(action text, detail jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.admin_log (school_id, actor, action, detail)
  values (public.my_school(), auth.uid(), admin_log_add.action, coalesce(admin_log_add.detail, '{}'));
end;
$$;

create function public.admin_year()
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
  return jsonb_build_object(
    'steps', (
      select jsonb_object_agg(a.name, (
        select jsonb_build_object('at', l.at, 'by', p.display_name, 'byRealName', split_part(u.email, '@', 1), 'detail', l.detail)
        from public.admin_log l
        left join public.profiles p on p.id = l.actor
        left join auth.users u on u.id = l.actor
        where l.school_id = school and l.action = a.name
        order by l.at desc, l.id desc limit 1))
      from unnest(array['classes', 'archive', 'leavers', 'points', 'fame', 'dragon']) as a(name)),
    'log', (
      select coalesce(jsonb_agg(jsonb_build_object('at', t.at, 'action', t.action, 'by', t.by, 'byRealName', t.real, 'detail', t.detail)
                                order by t.at desc, t.id desc), '[]')
      from (select l.id, l.at, l.action, l.detail, p.display_name as by, split_part(u.email, '@', 1) as real
            from public.admin_log l
            left join public.profiles p on p.id = l.actor
            left join auth.users u on u.id = l.actor
            where l.school_id = school
            order by l.at desc, l.id desc limit 20) t)
  );
end;
$$;

create function public.admin_mark_step(step text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_school_admin();
  if step is distinct from 'classes' and step is distinct from 'dragon' then
    raise exception 'That step can''t be marked done.' using errcode = '22023';
  end if;
  perform public.admin_log_add(step, '{}');
end;
$$;

create function public.admin_archive_classes(classes uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  ids uuid[];
  n integer;
  names jsonb;
  one uuid;
begin
  perform public.require_school_admin();
  select coalesce(array_agg(distinct x), '{}') into ids from unnest(coalesce(classes, '{}')) as x where x is not null;
  if cardinality(ids) = 0 then
    raise exception 'Tick at least one class.' using errcode = '22023';
  end if;
  select count(*)::integer, coalesce(jsonb_agg(c.name order by c.name), '[]') into n, names
  from public.classes c
  where c.id = any (ids) and c.school_id = public.my_school() and not c.archived;
  if n <> cardinality(ids) then
    raise exception 'One of those classes isn''t a current class at your school.' using errcode = '22023';
  end if;
  foreach one in array ids loop
    perform public.teacher_archive_class(one, true);
  end loop;
  perform public.admin_log_add('archive', jsonb_build_object('count', n, 'names', names));
  return n;
end;
$$;

create function public.admin_delete_leavers(students uuid[], confirm text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  ids uuid[];
  n integer;
begin
  perform public.require_school_admin();
  select coalesce(array_agg(distinct x), '{}') into ids from unnest(coalesce(students, '{}')) as x where x is not null;
  if cardinality(ids) = 0 then
    raise exception 'Tick at least one student.' using errcode = '22023';
  end if;
  if confirm is distinct from cardinality(ids)::text then
    raise exception 'Type the number of students to confirm.' using errcode = '22023';
  end if;
  select count(*)::integer into n
  from public.profiles p
  where p.id = any (ids) and p.role = 'student' and p.school_id = public.my_school()
    and not exists (select 1 from public.class_members m join public.classes c on c.id = m.class_id
                    where m.student_id = p.id and not c.archived);
  if n <> cardinality(ids) then
    raise exception 'One of those students is still in a current class, or isn''t a student at your school.' using errcode = '22023';
  end if;
  delete from auth.users where id = any (ids);
  perform public.admin_log_add('leavers', jsonb_build_object('count', n));
  return n;
end;
$$;

create function public.admin_new_points_season(confirm text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform public.require_school_admin();
  result := public.teacher_new_season(confirm);
  perform public.admin_log_add('points', result);
  return result;
end;
$$;

create function public.admin_clans_new_season(confirm text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform public.require_school_admin();
  result := public.teacher_clans_new_season(confirm, null);
  perform public.admin_log_add('fame', result);
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function public.admin_log_add(text, jsonb) from public, anon, authenticated;

revoke execute on function public.admin_year(), public.admin_mark_step(text), public.admin_archive_classes(uuid[]),
  public.admin_delete_leavers(uuid[], text), public.admin_new_points_season(text), public.admin_clans_new_season(text)
from public, anon, authenticated;
grant execute on function public.admin_year(), public.admin_mark_step(text), public.admin_archive_classes(uuid[]),
  public.admin_delete_leavers(uuid[], text), public.admin_new_points_season(text), public.admin_clans_new_season(text)
to authenticated;
