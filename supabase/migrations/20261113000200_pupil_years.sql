-- Each pupil's school year (James, 12 Nov 2026). A pupil picks it on their first visit after signing in; a teacher can change
-- it later on the Students tab. It replaces the class's year level, which teachers no longer set (the column stays on
-- public.classes, unused by the screens, so nothing is lost).
--
-- A year is saved with the NZ calendar year it was true for, so it goes up by one each January by itself:
-- year_level_of() works it out. Never shown to classmates (game guide: "Never").

create table public.pupil_years (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  year_level smallint not null check (year_level between 0 and 13),
  -- The NZ calendar (school) year when year_level was right.
  school_year integer not null check (school_year between 2020 and 2100),
  set_by text not null check (set_by in ('pupil', 'teacher')),
  set_by_id uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.pupil_years enable row level security;
-- No policy and no grant: everything goes through the functions below.
revoke all on public.pupil_years from anon, authenticated;

-- The school year now, in New Zealand.
create function public.nz_school_year()
returns integer
language sql
stable
set search_path = ''
as $$ select extract(year from (now() at time zone 'Pacific/Auckland'))::integer $$;

-- A pupil's year now (moved up one for each new year since it was saved, at most Year 13), or null if nobody has said.
-- Internal: call it from other security definer functions.
create function public.year_level_of(player uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select least(13, greatest(0, y.year_level + (public.nz_school_year() - y.school_year)))
  from public.pupil_years y where y.student_id = player
$$;

-- For the pupil's own home page: has my year been saved, and what is it? Teachers always get asked = false.
create function public.my_year()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'student', coalesce((select p.role = 'student' from public.profiles p where p.id = auth.uid()), false),
    'year', public.year_level_of(auth.uid()))
$$;

-- The pupil says their year, once. After that only a teacher can change it.
create function public.set_my_year(level integer)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null or not exists (select 1 from public.profiles p where p.id = me and p.role = 'student') then
    raise exception 'Only students pick a year.' using errcode = '42501';
  end if;
  if level is null or level < 1 or level > 8 then
    raise exception 'Pick a year from 1 to 8.' using errcode = '22023';
  end if;
  insert into public.pupil_years (student_id, year_level, school_year, set_by, set_by_id)
  values (me, level, public.nz_school_year(), 'pupil', me)
  on conflict (student_id) do nothing;
  if not found then
    raise exception 'Your year is saved. Your teacher can change it.' using errcode = '22023';
  end if;
  return level;
end;
$$;

-- The years of the pupils in one of my classes: { "<student id>": { "year": 4, "by": "pupil" | "teacher" } }.
-- Pupils with no year saved are left out.
create function public.teacher_student_years(target_class uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_teacher() or target_class is null or not public.teaches_class(target_class, true) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_object_agg(m.student_id, jsonb_build_object('year', public.year_level_of(m.student_id), 'by', y.set_by))
    from public.class_members m join public.pupil_years y on y.student_id = m.student_id
    where m.class_id = target_class), '{}'::jsonb);
end;
$$;

-- A teacher sets (or with null, clears, so the pupil is asked again) the year of one of their students.
create function public.teacher_set_student_year(student uuid, level integer)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_teacher() or student is null or not public.can_manage_student(student)
     or not exists (select 1 from public.profiles p where p.id = student and p.role = 'student') then
    raise exception 'That isn''t one of your students.' using errcode = '42501';
  end if;
  if level is null then
    delete from public.pupil_years where student_id = student;
    return;
  end if;
  if level < 0 or level > 13 then
    raise exception 'Pick a year from 0 to 13.' using errcode = '22023';
  end if;
  insert into public.pupil_years (student_id, year_level, school_year, set_by, set_by_id, updated_at)
  values (student, level, public.nz_school_year(), 'teacher', auth.uid(), now())
  on conflict (student_id) do update
    set year_level = excluded.year_level, school_year = excluded.school_year, set_by = 'teacher',
        set_by_id = excluded.set_by_id, updated_at = now();
end;
$$;

-- For the class lists: the lowest and highest year among each class's pupils, and how many have none yet.
-- { "<class id>": { "low": 4, "high": 6, "unknown": 2 } }. A teacher gets their own classes; a school admin every class in the school.
create function public.class_years()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_teacher() then
    raise exception 'Only teachers can see this.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_object_agg(t.class_id, jsonb_build_object('low', t.low, 'high', t.high, 'unknown', t.unknown))
    from (
      select c.id as class_id,
             min(public.year_level_of(m.student_id)) as low,
             max(public.year_level_of(m.student_id)) as high,
             count(m.student_id) filter (where public.year_level_of(m.student_id) is null) as unknown
      from public.classes c join public.class_members m on m.class_id = c.id
      where c.school_id = public.my_school() and (public.is_school_admin() or public.teaches_class(c.id, true))
      group by c.id) t), '{}'::jsonb);
end;
$$;

revoke execute on function
  public.nz_school_year(), public.year_level_of(uuid), public.my_year(), public.set_my_year(integer),
  public.teacher_student_years(uuid), public.teacher_set_student_year(uuid, integer), public.class_years()
from public, anon, authenticated;

grant execute on function
  public.my_year(), public.set_my_year(integer),
  public.teacher_student_years(uuid), public.teacher_set_student_year(uuid, integer), public.class_years()
to authenticated;
