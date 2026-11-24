-- "Taught" switches for the Year 7 and 8 maths (James, 25 Nov 2026: "a new teacher page that toggles if they appear for kids or
-- not so they only start getting content they have been taught"). docs/plans/ladder-7-8/PLAN.md, answer 12.
-- One row per class and Year 7-8 ladder skill the teacher has switched on. All off to start: a pupil's auto practice only
-- goes past the Year 6 top into the skills their class has been taught. Read by every game through ladder_info() ('taught').

create table public.ladder_taught (
  class_id uuid not null references public.classes (id) on delete cascade,
  skill text not null check (skill ~ '^[a-z0-9-]{1,40}$'),
  set_by_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (class_id, skill)
);

alter table public.ladder_taught enable row level security;
revoke all on public.ladder_taught from anon, authenticated;

-- The ladder facts every game and teacher view reads: as before, plus 'taught' (the pupil's class's switched-on skills).
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
    'capped', exists (select 1 from public.ladder_caps k where k.student_id = player),
    'taught', coalesce((select jsonb_agg(t.skill order by t.skill) from public.ladder_taught t where t.class_id = public.current_class_of(player)), '[]'::jsonb))
$$;

-- The Year 7-8 skills a class has been taught, for the teacher page: a list of skill ids.
create function public.teacher_ladder_taught(target_class uuid)
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
  return coalesce((select jsonb_agg(t.skill order by t.skill) from public.ladder_taught t where t.class_id = target_class), '[]'::jsonb);
end;
$$;

-- Switch one or more skills on (taught) or off for a class.
create function public.teacher_set_ladder_taught(target_class uuid, skills text[], taught boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_teacher() or target_class is null or not public.teaches_class(target_class, true) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  if skills is null or cardinality(skills) = 0 or cardinality(skills) > 60
     or exists (select 1 from unnest(skills) s where s is null or s !~ '^[a-z0-9-]{1,40}$') then
    raise exception 'Those aren''t ladder skills.' using errcode = '22023';
  end if;
  if taught then
    insert into public.ladder_taught (class_id, skill, set_by_id)
    select target_class, s, auth.uid() from unnest(skills) s
    on conflict (class_id, skill) do nothing;
  else
    delete from public.ladder_taught where class_id = target_class and skill = any (skills);
  end if;
end;
$$;

revoke execute on function public.teacher_ladder_taught(uuid), public.teacher_set_ladder_taught(uuid, text[], boolean) from public, anon, authenticated;
grant execute on function public.teacher_ladder_taught(uuid), public.teacher_set_ladder_taught(uuid, text[], boolean) to authenticated;
-- ladder_info keeps the grants it had (service_role only): create or replace doesn't change them.
