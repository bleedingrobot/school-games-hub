-- The basic facts check (docs/FACTS-CHECK-PLAN.md, James 15 Nov 2026): the same 24 times-table and division facts every
-- 4 weeks, in Training, so teachers can see whether facts really improve. The set, marking and scores are in
-- shared/training/check.ts; the training server function marks each check and saves it here.
--
-- 1. facts_checks: one row per finished check. RLS on, no direct access.
-- 2. record_facts_check(): the training server function only. Saves the check once (by its id) and counts it as a finished
--    Training session (training_sessions, kind 'facts', seed = minus the check's id), so it opens the games like one.
-- 3. my_facts_check(): for the pupil: is a check due, and their last one.
-- 4. teacher_facts_checks(): every check of every pupil in a class, for the Progress tab.
--
-- Nothing else changes. A New Season does not touch these rows (it's learning, not a competition), and no classmate ever
-- sees them.

create table public.facts_checks (
  id bigint generated always as identity primary key,
  check_id uuid not null unique,
  player uuid not null references public.profiles (id) on delete cascade,
  version smallint not null check (version between 1 and 100),
  done_at timestamptz not null,
  right_count smallint not null check (right_count between 0 and 100),
  quick_count smallint not null check (quick_count between 0 and 100),
  middle_ms integer check (middle_ms between 0 and 100000),
  -- Per fact, in the set's order: 0 not right, 1 right, 2 right and quick.
  marks smallint[] not null,
  -- Per fact: { q, given, ms, think }, for looking into a fact later.
  answers jsonb not null,
  -- The pupil's school year when they did it (year_level_of), so year groups can be compared later.
  year_level smallint,
  created_at timestamptz not null default now()
);
create index facts_checks_by_player on public.facts_checks (player, done_at desc);

alter table public.facts_checks enable row level security;
revoke all on public.facts_checks from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Saving (the server function only)
-- ---------------------------------------------------------------------------

-- `at` is when the device says it finished (ms since 1970): not in the future, at most a week back. A check sent twice is
-- saved once. A check also counts as a Training session (Training before games, sessions trophies) when it is recent.
create function public.record_facts_check(
  player uuid,
  check_id uuid,
  version integer,
  at bigint,
  right_count integer,
  quick_count integer,
  middle_ms integer,
  marks integer[],
  answers jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  finished timestamptz;
  new_id bigint;
begin
  perform public.gem_keep_check_player(player);
  if check_id is null or version is null or at is null or marks is null or answers is null
     or jsonb_typeof(answers) <> 'array' or jsonb_array_length(answers) <> coalesce(array_length(marks, 1), 0)
     or right_count < quick_count then
    raise exception 'That check could not be read.' using errcode = '22023';
  end if;
  finished := least(to_timestamp(at / 1000.0), now());
  if to_timestamp(at / 1000.0) > now() + interval '10 minutes' or finished < now() - interval '7 days' then
    raise exception 'That check could not be saved.' using errcode = '22023';
  end if;
  insert into public.facts_checks (check_id, player, version, done_at, right_count, quick_count, middle_ms, marks, answers, year_level)
  values (check_id, player, version, finished, right_count, quick_count, middle_ms, marks, answers, public.year_level_of(player))
  on conflict on constraint facts_checks_check_id_key do nothing
  returning id into new_id;
  if new_id is null then
    return false;
  end if;
  if finished > now() - interval '12 hours' then
    insert into public.training_sessions (player, kind, seed, answers, finished_at)
    values (player, 'facts', -new_id::integer, jsonb_array_length(answers), finished)
    on conflict on constraint training_sessions_pkey do nothing;
  end if;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------

-- For the pupil asking: { due, last: { at, right, quick } | null, count }. Due: a pupil (not a teacher) in Year 3 or above
-- (or with no year yet) whose last check is at least `every_days` days old, or who has never done one. `every_days` and
-- `from_year` come from shared/training/check.ts.
create function public.my_facts_check(version integer, every_days integer default 28, from_year integer default 3)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select c.done_at, c.right_count, c.quick_count
    from public.facts_checks c
    where c.player = auth.uid() and c.version = my_facts_check.version
    order by c.done_at desc
  )
  select jsonb_build_object(
    'due', not public.is_teacher()
           and coalesce(public.year_level_of(auth.uid()) >= from_year, true)
           and coalesce((select max(m.done_at) from mine m) < now() - make_interval(days => greatest(every_days, 1)), true),
    'count', (select count(*) from mine),
    'last', (select jsonb_build_object('at', m.done_at, 'right', m.right_count, 'quick', m.quick_count) from mine m limit 1))
  where public.is_school_user()
$$;

-- For a class the teacher teaches: [{ id, name, realName, year, checks: [{ at, right, quick, middleMs, marks }] }], every
-- pupil in the class (checks oldest first, empty if none yet), by name.
create function public.teacher_facts_checks(target_class uuid, version integer)
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
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.display_name, 'realName', split_part(u.email, '@', 1),
        'year', public.year_level_of(p.id),
        'checks', coalesce((
          select jsonb_agg(jsonb_build_object('at', c.done_at, 'right', c.right_count, 'quick', c.quick_count,
                                              'middleMs', c.middle_ms, 'marks', to_jsonb(c.marks)) order by c.done_at)
          from public.facts_checks c
          where c.player = p.id and c.version = teacher_facts_checks.version), '[]'::jsonb))
        order by p.display_name), '[]'::jsonb)
    from public.my_students() s(id)
    join public.class_members m on m.student_id = s.id and m.class_id = target_class
    join public.profiles p on p.id = s.id
    join auth.users u on u.id = s.id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.record_facts_check(uuid, uuid, integer, bigint, integer, integer, integer, integer[], jsonb),
  public.my_facts_check(integer, integer, integer),
  public.teacher_facts_checks(uuid, integer)
from public, anon, authenticated;
grant execute on function public.my_facts_check(integer, integer, integer), public.teacher_facts_checks(uuid, integer) to authenticated;
grant execute on function public.record_facts_check(uuid, uuid, integer, bigint, integer, integer, integer, integer[], jsonb) to service_role;
