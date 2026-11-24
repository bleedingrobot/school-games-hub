-- "Stop at Year 6" (James, 24 Nov 2026: "an option added to cap a kid at year 6 - and they dont progress the ladder").
-- docs/plans/ladder-7-8/PLAN.md, answer 11. A teacher ticks it for one pupil on the Students tab. For that pupil, Year 7 and 8
-- skills are off auto: the games never ask them unless a teacher picks one as a focus, and the pupil's progress counts only to
-- the Year 6 top. Read by every game through ladder_info() ('capped'), so no game changes.

create table public.ladder_caps (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  set_by_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.ladder_caps enable row level security;
revoke all on public.ladder_caps from anon, authenticated;

-- The ladder facts every game and teacher view reads: as before, plus 'capped'.
create or replace function public.ladder_info(player uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'on', coalesce((select s.maths_auto from public.settings_of(player) s), false),
    'yearLevel', (select c.year_level from public.classes c where c.id = public.current_class_of(player)),
    'placed', (select case when p.skipped then 'skipped' else 'done' end from public.ladder_placements p where p.student_id = player),
    'placement', (select p.skill from public.ladder_placements p where p.student_id = player),
    'furthest', (select f.skill from public.ladder_places f where f.student_id = player),
    'capped', exists (select 1 from public.ladder_caps k where k.student_id = player))
$$;

-- The pupils of a class who are stopped at Year 6, for the Students tab: a list of ids.
create function public.teacher_ladder_caps(target_class uuid)
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
    select jsonb_agg(m.student_id)
    from public.class_members m join public.ladder_caps k on k.student_id = m.student_id
    where m.class_id = target_class), '[]'::jsonb);
end;
$$;

create function public.teacher_set_ladder_cap(student uuid, capped boolean)
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
  if capped then
    insert into public.ladder_caps (student_id, set_by_id) values (student, auth.uid())
    on conflict (student_id) do nothing;
  else
    delete from public.ladder_caps where student_id = student;
  end if;
end;
$$;

revoke execute on function public.teacher_ladder_caps(uuid), public.teacher_set_ladder_cap(uuid, boolean) from public, anon, authenticated;
grant execute on function public.teacher_ladder_caps(uuid), public.teacher_set_ladder_cap(uuid, boolean) to authenticated;
-- ladder_info keeps the grants it had (service_role only): create or replace doesn't change them.
