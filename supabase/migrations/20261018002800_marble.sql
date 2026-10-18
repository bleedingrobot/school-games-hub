-- Marble Rush, stage M.4: finished runs and best times are saved to the database.
--
-- Marble Rush is its own thing (docs/MARBLE-PLAN.md): its own tables and functions, so no other
-- game reads or changes a Marble record and Marble does not touch scoring, points, progress or
-- achievements. (There are no points or achievements in the first live version.)
--
-- 1. marble_runs: one row per finished run that was saved (stats only, no inputs). A seed (handed
--    out by the server before the run) can only be saved once.
-- 2. marble_bests: one best per student, course, mode and maths flag, WITH the recorded inputs
--    so the run can be played back as a ghost. The server function replays the inputs itself and
--    works out the time before anything is saved, so the time in here is never one the browser
--    claimed.
-- 3. Saving, for the server only: record_marble_run().
-- 4. Reading: my_marble() (own bests), marble_board() (top 10 and you, own school only, hidden
--    profiles left out) and marble_ghost() (the inputs to play back: yours, the classmate just
--    ahead of you, or the fastest in your school).
--
-- Times are clock steps (1/60 of a second). Mode: 'up' (count up) or 'down' (hard mode).
-- `maths` is false until the maths questions come (stages M.6 and M.7): runs with questions get
-- their own boards.

create table public.marble_runs (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  course text not null check (course ~ '^[a-z0-9-]{1,40}$'),
  mode text not null check (mode in ('up', 'down')),
  maths boolean not null default false,
  -- The seed the server handed out for this run.
  seed text not null check (length(seed) between 10 and 80),
  steps integer not null check (steps between 1 and 1000000),
  falls integer not null check (falls between 0 and 100000),
  checkpoints integer not null check (checkpoints between 0 and 1000),
  held integer not null default 0 check (held between 0 and 1000000),
  created_at timestamptz not null default now(),
  unique (player, seed)
);
create index marble_runs_by_day on public.marble_runs (player, created_at);

create table public.marble_bests (
  player uuid not null references public.profiles (id) on delete cascade,
  course text not null check (course ~ '^[a-z0-9-]{1,40}$'),
  mode text not null check (mode in ('up', 'down')),
  maths boolean not null default false,
  steps integer not null check (steps between 1 and 1000000),
  falls integer not null check (falls between 0 and 100000),
  -- The recorded run: "codeXcount,..." (shared/marble/inputs.ts). Small: a long run is a few KB.
  inputs text not null check (length(inputs) between 1 and 60000),
  achieved_at timestamptz not null default now(),
  primary key (player, course, mode, maths)
);
-- Boards: fastest first within a course, mode and maths flag.
create index marble_bests_board on public.marble_bests (course, mode, maths, steps, achieved_at);

alter table public.marble_runs enable row level security;
alter table public.marble_bests enable row level security;
revoke all on public.marble_runs, public.marble_bests from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Saving (the server function only)
-- ---------------------------------------------------------------------------

-- Saves one finished run (the server has already replayed it). Returns:
--   'duplicate'  this seed was saved before (nothing changed)
--   'best'       saved, and it is the student's new best for the course and mode
--   'saved'      saved, but not a new best
-- Past `daily_limit` runs in a day the student is asked to take a break (54000).
create function public.record_marble_run(
  player uuid,
  seed text,
  course text,
  mode text,
  maths boolean,
  steps integer,
  falls integer,
  checkpoints integer,
  held integer,
  inputs text,
  daily_limit integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_steps integer;
begin
  perform public.gem_keep_check_player(player);
  if (select count(*) from public.marble_runs r
      where r.player = record_marble_run.player and r.created_at > now() - interval '1 day') >= daily_limit then
    raise exception 'That''s a lot of rolling today! Have a break and come back tomorrow.' using errcode = '54000';
  end if;
  insert into public.marble_runs (player, course, mode, maths, seed, steps, falls, checkpoints, held)
  values (player, course, mode, maths, seed, steps, falls, checkpoints, held)
  on conflict on constraint marble_runs_player_seed_key do nothing;
  if not found then
    return 'duplicate';
  end if;
  select b.steps into old_steps from public.marble_bests b
  where b.player = record_marble_run.player and b.course = record_marble_run.course
    and b.mode = record_marble_run.mode and b.maths = record_marble_run.maths;
  if old_steps is not null and old_steps <= steps then
    return 'saved';
  end if;
  insert into public.marble_bests as b (player, course, mode, maths, steps, falls, inputs)
  values (player, course, mode, maths, steps, falls, inputs)
  on conflict on constraint marble_bests_pkey do update set
    steps = excluded.steps, falls = excluded.falls, inputs = excluded.inputs, achieved_at = now();
  return 'best';
end;
$$;

-- ---------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------

-- A student's own bests (no inputs): [{ course, mode, maths, steps, falls }].
create function public.my_marble()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'course', b.course, 'mode', b.mode, 'maths', b.maths, 'steps', b.steps, 'falls', b.falls)
      order by b.course, b.mode, b.maths), '[]')
  from public.marble_bests b
  where b.player = auth.uid() and public.is_school_user()
$$;

-- The board for one course, mode and maths flag: the ten fastest in the student's own school
-- (teachers and hidden profiles left out) and where the student stands, even beyond ten.
-- { top: [{ rank, name, avatar, steps, me }], me: { rank, steps } | null, total }
create function public.marble_board(in_course text, in_mode text, in_maths boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_school_user() then
    return null;
  end if;
  with ranked as (
    select b.player, p.display_name, p.avatar, b.steps,
           row_number() over (order by b.steps, b.achieved_at, b.player) as place
    from public.marble_bests b
    join public.profiles p on p.id = b.player
    where b.course = in_course and b.mode = in_mode and b.maths = in_maths
      and p.school_id = public.my_school()
      and p.role = 'student'
      and (not p.hidden or b.player = auth.uid())
  )
  select jsonb_build_object(
    'top', (select coalesce(jsonb_agg(jsonb_build_object(
        'rank', r.place, 'name', r.display_name, 'avatar', r.avatar, 'steps', r.steps, 'me', r.player = auth.uid())
        order by r.place), '[]') from ranked r where r.place <= 10),
    'me', (select jsonb_build_object('rank', r.place, 'steps', r.steps) from ranked r where r.player = auth.uid()),
    'total', (select count(*) from ranked)
  ) into result;
  return result;
end;
$$;

-- A recorded run to play back as a ghost. `which`: 'mine' (the student's own best), 'next' (the
-- classmate just faster than the student's best, or the fastest if the student has none) or 'top'
-- (the fastest in the school). { name, steps, inputs } or null.
create function public.marble_ghost(in_course text, in_mode text, in_maths boolean, which text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  mine integer;
  found_row record;
begin
  if not public.is_school_user() then
    return null;
  end if;
  if which not in ('mine', 'next', 'top') then
    raise exception 'Which ghost?' using errcode = '22023';
  end if;
  select b.steps into mine from public.marble_bests b
  where b.player = auth.uid() and b.course = in_course and b.mode = in_mode and b.maths = in_maths;
  if which = 'mine' then
    select p.display_name as name, b.steps, b.inputs into found_row
    from public.marble_bests b join public.profiles p on p.id = b.player
    where b.player = auth.uid() and b.course = in_course and b.mode = in_mode and b.maths = in_maths;
  elsif which = 'next' and mine is not null then
    select p.display_name as name, b.steps, b.inputs into found_row
    from public.marble_bests b join public.profiles p on p.id = b.player
    where b.course = in_course and b.mode = in_mode and b.maths = in_maths
      and b.player <> auth.uid() and b.steps < mine
      and p.school_id = public.my_school() and p.role = 'student' and not p.hidden
    order by b.steps desc, b.achieved_at, b.player
    limit 1;
  else
    select p.display_name as name, b.steps, b.inputs into found_row
    from public.marble_bests b join public.profiles p on p.id = b.player
    where b.course = in_course and b.mode = in_mode and b.maths = in_maths
      and b.player <> auth.uid()
      and p.school_id = public.my_school() and p.role = 'student' and not p.hidden
    order by b.steps, b.achieved_at, b.player
    limit 1;
  end if;
  if found_row.inputs is null then
    return null;
  end if;
  return jsonb_build_object('name', found_row.name, 'steps', found_row.steps, 'inputs', found_row.inputs);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.record_marble_run(uuid, text, text, text, boolean, integer, integer, integer, integer, text, integer),
  public.my_marble(), public.marble_board(text, text, boolean), public.marble_ghost(text, text, boolean, text)
from public, anon, authenticated;
grant execute on function public.my_marble(), public.marble_board(text, text, boolean),
  public.marble_ghost(text, text, boolean, text) to authenticated;
grant execute on function
  public.record_marble_run(uuid, text, text, text, boolean, integer, integer, integer, integer, text, integer)
to service_role;
