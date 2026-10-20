-- Mine Runner, stage 4: finished runs, best times, the class boards and the maths questions are saved to the database.
--
-- Mine Runner is its own thing (docs/MINE-PLAN.md): its own tables and functions, so no other game reads or changes a
-- Mine Runner record. Stage 4 adds NO points, achievements, `hub_games` row or New Season step; those are stage 5.
-- (Until stage 5, a school admin's NEW SEASON does not clear Mine Runner's boards. Nothing is live, so nothing is lost.)
--
-- 1. mine_runs: one row per finished run that was saved. A seed (handed out by the server before the run) can only be
--    saved once. The recorded inputs are kept for 7 days, then thrown away (the best run's copy lives in mine_bests).
-- 2. mine_bests: one best per pupil, level and maths flag, WITH the recorded inputs. The server function replays the
--    inputs itself and works out the time before anything is saved, so the time in here is never one the browser claimed.
-- 3. mine_questions: the question list the server made for a run, which pupils can never read (no policy, no grant),
--    and the answers marked so far.
-- 4. Saving and the questions, for the server only: record_mine_run(), mine_runs_today(), mine_store_run(),
--    mine_load_run(), mine_claim_answer().
-- 5. Reading: my_mine() (own bests) and mine_board() (top 10 and you, own school only, teachers and hidden profiles
--    left out, display names and avatars only).
-- 6. The teacher's maths switch: app_settings.mine_maths ('off' | 'choose' | 'on') and teacher_set_mine_maths().
--
-- Times are clock steps (1/30 of a second). `level` is a board id: 'l1'..'l6', or 'l1:hard'..'l6:hard' (hard mode has its
-- own board). `maths` is true for a run played with maths questions: those runs get their own boards. `mode` is the
-- flight mode ('steady' or 'free'); both share a board.

create table public.mine_runs (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  level text not null check (level ~ '^l[1-6](:hard)?$'),
  mode text not null check (mode in ('steady', 'free')),
  maths boolean not null default false,
  -- The seed the server handed out for this run.
  seed text not null check (length(seed) between 10 and 80),
  steps integer not null check (steps between 1 and 1000000),
  -- Doors and pads opened by a right answer, and wrong answers at question doors.
  grants integer not null default 0 check (grants between 0 and 64),
  wrong integer not null default 0 check (wrong between 0 and 1000),
  -- The medal this time earns (shared/mine/medals.ts), worked out by the server function.
  medal text check (medal in ('gold', 'silver', 'bronze')),
  -- The recorded run: "codeXcount,..." (shared/mine/inputs.ts). Thrown away after 7 days.
  inputs text check (length(inputs) between 1 and 200000),
  created_at timestamptz not null default now(),
  -- A seed is handed out once and saved once (a unique index).
  constraint mine_runs_seed_key unique (seed)
);
create index mine_runs_by_day on public.mine_runs (player, created_at);
create index mine_runs_old_inputs on public.mine_runs (created_at) where inputs is not null;

create table public.mine_bests (
  player uuid not null references public.profiles (id) on delete cascade,
  level text not null check (level ~ '^l[1-6](:hard)?$'),
  maths boolean not null default false,
  mode text not null check (mode in ('steady', 'free')),
  steps integer not null check (steps between 1 and 1000000),
  medal text check (medal in ('gold', 'silver', 'bronze')),
  inputs text not null check (length(inputs) between 1 and 200000),
  achieved_at timestamptz not null default now(),
  primary key (player, level, maths)
);
-- Boards: fastest first within a level and maths flag.
create index mine_bests_board on public.mine_bests (level, maths, steps, achieved_at);

alter table public.mine_runs enable row level security;
alter table public.mine_bests enable row level security;
revoke all on public.mine_runs, public.mine_bests from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Saving (the server function only)
-- ---------------------------------------------------------------------------

-- How many runs a pupil has saved in the last day (the server asks before it hands out a new seed).
create function public.mine_runs_today(player uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.mine_runs r
  where r.player = mine_runs_today.player and r.created_at > now() - interval '1 day'
$$;

-- Saves one finished run (the server has already replayed it). Returns:
--   'duplicate'  this seed was saved before (nothing changed)
--   'first'      saved, and it is the pupil's first ever finish of this mine (either way of playing)
--   'best'       saved, and it is the pupil's new best for the level and maths flag
--   'saved'      saved, but not a new best
-- Past `daily_limit` runs in a day the pupil is asked to take a break (54000).
create function public.record_mine_run(
  player uuid,
  seed text,
  level text,
  mode text,
  maths boolean,
  steps integer,
  grants integer,
  wrong integer,
  inputs text,
  daily_limit integer,
  medal text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_steps integer;
  is_first boolean;
begin
  perform public.gem_keep_check_player(player);
  if (select count(*) from public.mine_runs r
      where r.player = record_mine_run.player and r.created_at > now() - interval '1 day') >= daily_limit then
    raise exception 'That''s a lot of mining today! Have a break and come back tomorrow.' using errcode = '54000';
  end if;
  -- Recorded inputs older than a week are not needed any more (the best run's copy is in mine_bests).
  update public.mine_runs r set inputs = null where r.inputs is not null and r.created_at < now() - interval '7 days';
  insert into public.mine_runs (player, level, mode, maths, seed, steps, grants, wrong, medal, inputs)
  values (player, level, mode, maths, seed, steps, grants, wrong, medal, inputs)
  on conflict on constraint mine_runs_seed_key do nothing;
  if not found then
    return 'duplicate';
  end if;
  select b.steps into old_steps from public.mine_bests b
  where b.player = record_mine_run.player and b.level = record_mine_run.level and b.maths = record_mine_run.maths;
  if old_steps is not null and old_steps <= steps then
    return 'saved';
  end if;
  is_first := not exists (select 1 from public.mine_bests b where b.player = record_mine_run.player and b.level = record_mine_run.level);
  insert into public.mine_bests as b (player, level, maths, mode, steps, medal, inputs)
  values (player, level, maths, mode, steps, medal, inputs)
  on conflict on constraint mine_bests_pkey do update set
    mode = excluded.mode, steps = excluded.steps, medal = excluded.medal, inputs = excluded.inputs, achieved_at = now();
  return case when is_first then 'first' else 'best' end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------

-- A pupil's own bests (no inputs): [{ level, maths, steps }].
create function public.my_mine()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('level', b.level, 'maths', b.maths, 'steps', b.steps)
      order by b.level, b.maths), '[]')
  from public.mine_bests b
  where b.player = auth.uid() and public.is_school_user()
$$;

-- The board for one level and maths flag: the ten fastest in the pupil's own school (teachers and hidden profiles left
-- out) and where the pupil stands, even beyond ten. Display names and avatars only, never maths results.
-- { top: [{ rank, name, avatar, steps, me }], me: { rank, steps } | null, total }
create function public.mine_board(in_level text, in_maths boolean)
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
    from public.mine_bests b
    join public.profiles p on p.id = b.player
    where b.level = in_level and b.maths = in_maths
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

-- ---------------------------------------------------------------------------
-- Maths: the teacher's switch
-- ---------------------------------------------------------------------------

alter table public.app_settings add column mine_maths text not null default 'choose'
  check (mine_maths in ('off', 'choose', 'on'));

create function public.teacher_set_mine_maths(mode text, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if mode is null or mode not in ('off', 'choose', 'on') then
    raise exception 'Unknown maths setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings set mine_maths = mode where id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- Maths: the questions of a run (the server function only)
-- ---------------------------------------------------------------------------

-- The question list made for one run, with its answers: pupils can never read this table (no policy, no grant).
-- `answered` holds the answers marked so far, { "<slot>": { "value": n, "right": true } }; a slot is marked once.
create table public.mine_questions (
  player uuid not null references public.profiles (id) on delete cascade,
  seed text not null check (length(seed) between 10 and 80),
  level text not null check (level ~ '^l[1-6](:hard)?$'),
  questions jsonb not null,
  answered jsonb not null default '{}',
  created_at timestamptz not null default now(),
  primary key (player, seed)
);
create index mine_questions_by_day on public.mine_questions (created_at);
alter table public.mine_questions enable row level security;
revoke all on public.mine_questions from anon, authenticated;

-- Keeps a run's questions. Lists older than two days are thrown away as new ones come in.
create function public.mine_store_run(player uuid, seed text, level text, questions jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if jsonb_typeof(questions) <> 'array' or jsonb_array_length(questions) not between 1 and 64 then
    raise exception 'That question list is not right.' using errcode = '22023';
  end if;
  delete from public.mine_questions q where q.created_at < now() - interval '2 days';
  insert into public.mine_questions (player, seed, level, questions)
  values (player, seed, level, questions)
  on conflict do nothing;
end;
$$;

-- { level, questions, answered } for a run that had maths, else null (a run without maths has no row).
create function public.mine_load_run(player uuid, seed text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('level', q.level, 'questions', q.questions, 'answered', q.answered)
  from public.mine_questions q where q.player = mine_load_run.player and q.seed = mine_load_run.seed
$$;

-- Marks a slot as answered, once. False if it was answered already (so an answer sent twice counts once).
create function public.mine_claim_answer(player uuid, seed text, slot integer, value numeric, right_answer boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.mine_questions q
  set answered = q.answered || jsonb_build_object(slot::text, jsonb_build_object('value', value, 'right', right_answer))
  where q.player = mine_claim_answer.player and q.seed = mine_claim_answer.seed and not (q.answered ? slot::text);
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.mine_runs_today(uuid),
  public.record_mine_run(uuid, text, text, text, boolean, integer, integer, integer, text, integer, text),
  public.my_mine(), public.mine_board(text, boolean),
  public.teacher_set_mine_maths(text, uuid),
  public.mine_store_run(uuid, text, text, jsonb), public.mine_load_run(uuid, text),
  public.mine_claim_answer(uuid, text, integer, numeric, boolean)
from public, anon, authenticated;
grant execute on function public.my_mine(), public.mine_board(text, boolean), public.teacher_set_mine_maths(text, uuid)
to authenticated;
grant execute on function
  public.mine_runs_today(uuid),
  public.record_mine_run(uuid, text, text, text, boolean, integer, integer, integer, text, integer, text),
  public.mine_store_run(uuid, text, text, jsonb), public.mine_load_run(uuid, text),
  public.mine_claim_answer(uuid, text, integer, numeric, boolean)
to service_role;
