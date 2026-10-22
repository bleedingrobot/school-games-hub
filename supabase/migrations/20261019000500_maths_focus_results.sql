-- Maths focus F.8, part A: how students did while a focus ran.
--
-- The records keep only totals per fact, so what a student did *during* a focus can't be worked out afterwards. This adds three
-- counters for each student and each "Set focus" press: answers, right, and quick (right, and within the pack's quick time).
--
--   * maths_focus_results: one row per (focus batch, student). Closed to the website: students can't read or write it.
--   * add_maths_focus_results: the game servers call it after the answers are saved. Server-only.
--   * teacher_maths_focus_results: a teacher reads one focus of a class they teach.
--
-- It is keyed by the batch (one "Set focus" press) and not by each focus row, so a student who is in two groups of the same press
-- (or in the class and a group) is counted once, not twice. Results are counted only from the day this migration is applied:
-- maths_focus_results_since remembers that day, so the page can say so instead of showing zeros that look like "did nothing".
-- Chess, checkers and 101 are maths-free and never call this.

create table public.maths_focus_results (
  batch_id uuid not null,
  student_id uuid not null references public.profiles (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  answers integer not null default 0 check (answers >= 0),
  correct integer not null default 0 check (correct >= 0),
  quick integer not null default 0 check (quick >= 0),
  updated_at timestamptz not null default now(),
  primary key (batch_id, student_id),
  check (correct <= answers and quick <= correct)
);
create index maths_focus_results_class on public.maths_focus_results (class_id);
alter table public.maths_focus_results enable row level security;
revoke all on public.maths_focus_results from anon, authenticated;

-- The day counting began (one row).
create table public.maths_focus_results_since (
  only_row boolean primary key default true check (only_row),
  since timestamptz not null default now()
);
insert into public.maths_focus_results_since default values;
alter table public.maths_focus_results_since enable row level security;
revoke all on public.maths_focus_results_since from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The game servers add a batch of answers
-- ---------------------------------------------------------------------------

-- `answers` = [{ skills: ["tables-6-9", ...], at (ms since 1970), correct, quick }]. The server works out which skills own the
-- key and whether the answer was quick; the database only matches them to the focuses that were running for this student at the
-- answer's own time (inside its start and its end, the earlier of ends_at and ended_at), in the class the student is in now, for
-- the student, their group or the class. Every such focus batch whose skills include one of the answer's skills counts the answer
-- once. Returns how many focus batches were updated.
create function public.add_maths_focus_results(player uuid, answers jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  cls uuid := public.current_class_of(player);
  added integer;
begin
  if cls is null or jsonb_typeof(answers) is distinct from 'array' then
    return 0;
  end if;
  with a as (
    select x.n, to_timestamp((x.e ->> 'at')::bigint / 1000.0) as at,
           coalesce((x.e ->> 'correct')::boolean, false) as correct,
           coalesce((x.e ->> 'quick')::boolean, false) as quick,
           array(select jsonb_array_elements_text(x.e -> 'skills')) as skills
    from jsonb_array_elements(answers) with ordinality as x(e, n)
  ),
  hit as (
    select distinct f.batch_id, a.n, a.correct, a.quick
    from a
    join public.maths_focuses f on f.class_id = cls and f.skills && a.skills
      and f.starts_at <= a.at
      and a.at < least(f.ends_at, coalesce(f.ended_at, f.ends_at))
    where f.scope = 'class'
       or (f.scope = 'student' and f.student_id = player)
       or (f.scope = 'group' and exists (
             select 1 from public.class_group_members gm where gm.group_id = f.group_id and gm.student_id = player))
  ),
  total as (
    select h.batch_id, count(*)::integer as answers, count(*) filter (where h.correct)::integer as correct,
           count(*) filter (where h.correct and h.quick)::integer as quick
    from hit h group by h.batch_id
  )
  insert into public.maths_focus_results as r (batch_id, student_id, class_id, answers, correct, quick)
  select t.batch_id, player, cls, t.answers, t.correct, t.quick from total t
  on conflict (batch_id, student_id) do update set
    answers = r.answers + excluded.answers, correct = r.correct + excluded.correct, quick = r.quick + excluded.quick,
    updated_at = now();
  get diagnostics added = row_count;
  return added;
end;
$$;

-- ---------------------------------------------------------------------------
-- A teacher reads one focus
-- ---------------------------------------------------------------------------

-- One "Set focus" press (its batch) in a class the asker teaches. Every student the focus is for is listed, with none shown as zero
-- answers (and `counted` false), so nobody is hidden. A student who has left but did answer is still listed.
create function public.teacher_maths_focus_results(batch uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cls uuid;
  result jsonb;
begin
  perform public.require_teacher();
  select min(f.class_id::text)::uuid into cls from public.maths_focuses f
  where f.batch_id = batch and f.school_id = public.my_school();
  if cls is null or not public.teaches_class(cls, public.is_school_admin()) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  with roster as (
    select m.student_id from public.class_members m
    where m.class_id = cls and exists (select 1 from public.maths_focuses f where f.batch_id = batch and f.scope = 'class')
    union
    select gm.student_id from public.class_group_members gm
    join public.maths_focuses f on f.group_id = gm.group_id where f.batch_id = batch
    union
    select f.student_id from public.maths_focuses f where f.batch_id = batch and f.scope = 'student'
    union
    select r.student_id from public.maths_focus_results r where r.batch_id = batch
  ),
  rows as (
    select p.id, p.display_name, u.email, coalesce(r.answers, 0) as answers, coalesce(r.correct, 0) as correct,
           coalesce(r.quick, 0) as quick
    from roster
    join public.profiles p on p.id = roster.student_id
    left join auth.users u on u.id = p.id
    left join public.maths_focus_results r on r.batch_id = batch and r.student_id = p.id
  )
  select jsonb_build_object(
    'since', (select s.since from public.maths_focus_results_since s),
    'students', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', x.id, 'name', x.display_name, 'realName', split_part(x.email, '@', 1),
        'answers', x.answers, 'correct', x.correct, 'quick', x.quick) order by x.display_name, x.id), '[]') from rows x),
    'total', jsonb_build_object('answers', coalesce((select sum(answers) from rows), 0),
                                'correct', coalesce((select sum(correct) from rows), 0),
                                'quick', coalesce((select sum(quick) from rows), 0)))
  into result;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function public.add_maths_focus_results(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.add_maths_focus_results(uuid, jsonb) to service_role;

revoke execute on function public.teacher_maths_focus_results(uuid) from public, anon, authenticated;
grant execute on function public.teacher_maths_focus_results(uuid) to authenticated;
