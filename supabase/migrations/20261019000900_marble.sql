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
-- `maths` is true for a run played with maths questions: those runs get their own boards. A run with
-- answer gates also keeps `doors`, the shortcut doors that were open (bit 0 = door A), and `gems`, the
-- number gems that were right (bit 0 = gem 0), because a recorded run can only be played back (as a ghost)
-- with the same doors open and the same gems taking time off.
--
-- Stage M.6 (maths) adds, in this same file because none of it is live yet:
--   * app_settings.marble_maths ('off' | 'choose' | 'on') and .marble_rescue, with teacher_set_marble_maths()
--     and teacher_set_marble_rescue(); a new class copies its school's row, as for the other settings;
--   * marble_questions: the question list the server made for a run, which students can never read
--     (like space_game_questions), and the answers marked so far; marble_store_run(), marble_load_run()
--     and marble_claim_answer() for the server function only.

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
  doors integer not null default 0 check (doors between 0 and 255),
  gems integer not null default 0 check (gems between 0 and 65535),
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
  doors integer not null default 0 check (doors between 0 and 255),
  gems integer not null default 0 check (gems between 0 and 65535),
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
  daily_limit integer,
  doors integer,
  gems integer
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
  insert into public.marble_runs (player, course, mode, maths, seed, steps, falls, checkpoints, held, doors, gems)
  values (player, course, mode, maths, seed, steps, falls, checkpoints, held, doors, gems)
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
  insert into public.marble_bests as b (player, course, mode, maths, steps, falls, doors, gems, inputs)
  values (player, course, mode, maths, steps, falls, doors, gems, inputs)
  on conflict on constraint marble_bests_pkey do update set
    steps = excluded.steps, falls = excluded.falls, doors = excluded.doors, gems = excluded.gems, inputs = excluded.inputs, achieved_at = now();
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
-- (the fastest in the school). { name, steps, inputs, doors, gems } or null.
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
    select p.display_name as name, b.steps, b.inputs, b.doors, b.gems into found_row
    from public.marble_bests b join public.profiles p on p.id = b.player
    where b.player = auth.uid() and b.course = in_course and b.mode = in_mode and b.maths = in_maths;
  elsif which = 'next' and mine is not null then
    select p.display_name as name, b.steps, b.inputs, b.doors, b.gems into found_row
    from public.marble_bests b join public.profiles p on p.id = b.player
    where b.course = in_course and b.mode = in_mode and b.maths = in_maths
      and b.player <> auth.uid() and b.steps < mine
      and p.school_id = public.my_school() and p.role = 'student' and not p.hidden
    order by b.steps desc, b.achieved_at, b.player
    limit 1;
  else
    select p.display_name as name, b.steps, b.inputs, b.doors, b.gems into found_row
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
  return jsonb_build_object('name', found_row.name, 'steps', found_row.steps, 'inputs', found_row.inputs, 'doors', found_row.doors, 'gems', found_row.gems);
end;
$$;


-- ---------------------------------------------------------------------------
-- Maths: the teacher's switches
-- ---------------------------------------------------------------------------

alter table public.app_settings add column marble_maths text not null default 'choose'
  check (marble_maths in ('off', 'choose', 'on'));
alter table public.app_settings add column marble_rescue boolean not null default true;

create function public.teacher_set_marble_maths(mode text, target_class uuid default null)
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
  update public.app_settings set marble_maths = mode where id in (select public.settings_to_change(target_class));
end;
$$;

create function public.teacher_set_marble_rescue(enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null then
    raise exception 'Unknown rescue setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings set marble_rescue = enabled where id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- Maths: the questions of a run (the server function only)
-- ---------------------------------------------------------------------------

-- The question list made for one run, with its answers: students can never read this table (no policy, no grant).
-- `answered` holds the answers marked so far, { "<slot>": { "value": n, "right": true } }; a slot is marked once.
create table public.marble_questions (
  player uuid not null references public.profiles (id) on delete cascade,
  seed text not null check (length(seed) between 10 and 80),
  rescue boolean not null,
  questions jsonb not null,
  answered jsonb not null default '{}',
  created_at timestamptz not null default now(),
  primary key (player, seed)
);
create index marble_questions_by_day on public.marble_questions (created_at);
alter table public.marble_questions enable row level security;
revoke all on public.marble_questions from anon, authenticated;

-- Keeps a run's questions. Lists older than two days are thrown away as new ones come in.
create function public.marble_store_run(player uuid, seed text, rescue boolean, questions jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if jsonb_typeof(questions) <> 'array' or jsonb_array_length(questions) not between 1 and 30 then
    raise exception 'That question list is not right.' using errcode = '22023';
  end if;
  delete from public.marble_questions q where q.created_at < now() - interval '2 days';
  insert into public.marble_questions (player, seed, rescue, questions)
  values (player, seed, rescue, questions)
  on conflict do nothing;
end;
$$;

-- { rescue, questions, answered } for a run that had maths, else null (a run without maths has no row).
create function public.marble_load_run(player uuid, seed text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('rescue', q.rescue, 'questions', q.questions, 'answered', q.answered)
  from public.marble_questions q where q.player = marble_load_run.player and q.seed = marble_load_run.seed
$$;

-- Marks a slot as answered, once. False if it was answered already (so an answer sent twice counts once).
create function public.marble_claim_answer(player uuid, seed text, slot integer, value numeric, right_answer boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.marble_questions q
  set answered = q.answered || jsonb_build_object(slot::text, jsonb_build_object('value', value, 'right', right_answer))
  where q.player = marble_claim_answer.player and q.seed = marble_claim_answer.seed and not (q.answered ? slot::text);
  return found;
end;
$$;


-- ---------------------------------------------------------------------------
-- New season: Marble Rush's times go too
-- ---------------------------------------------------------------------------

-- The newest teacher_new_season (school_and_class_checks) with one more step: a school admin's NEW SEASON also clears
-- that school's Marble Rush best times, saved runs and question lists, so each year starts with fresh boards.
-- (If a later migration redefines teacher_new_season, it must keep the three marble lines.)
create or replace function public.teacher_new_season(confirm text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  bot_count integer;
  friend_count integer;
  space_count integer;
  card_count integer;
  power_count integer;
  gem_count integer;
  mine uuid[];
begin
  perform public.require_school_admin();
  if confirm is distinct from 'NEW SEASON' then
    raise exception 'Type NEW SEASON to start a new season.' using errcode = '22023';
  end if;
  select coalesce(array_agg(p.id), '{}') into mine from public.profiles p where p.school_id = public.my_school();
  delete from public.achievements
  where player = any (mine)
    and achievement not in (select t.id from public.achievement_types t where t.game in ('monsters', 'dragon-maths', 'clan-quest'));
  delete from public.scored_games where player = any (mine);
  delete from public.ratings where player = any (mine);
  delete from public.bot_games where player = any (mine);
  get diagnostics bot_count = row_count;
  delete from public.mp_games
  where status in ('finished', 'cancelled', 'expired')
    and (array[created_by, first_player, second_player] && mine
         or coalesce(created_by, first_player, second_player) is null);
  get diagnostics friend_count = row_count;
  -- A finished game a newer one points at (a rematch) goes too; the link just empties.
  delete from public.space_games
  where status in ('finished', 'cancelled', 'expired')
    and (array[host, seat1, seat2, seat3, seat4] && mine
         or coalesce(host, seat1, seat2, seat3, seat4) is null);
  get diagnostics space_count = row_count;
  delete from public.card_games
  where status in ('finished', 'cancelled', 'expired')
    and (array[host, seat1, seat2, seat3, seat4] && mine
         or coalesce(host, seat1, seat2, seat3, seat4) is null);
  get diagnostics card_count = row_count;
  delete from public.power_games
  where status in ('finished', 'cancelled', 'expired')
    and (array[host, seat1, seat2] && mine
         or coalesce(host, seat1, seat2) is null);
  get diagnostics power_count = row_count;
  delete from public.gem_keep_runs where player = any (mine);
  get diagnostics gem_count = row_count;
  delete from public.gem_keep_progress where player = any (mine);
  delete from public.gem_keep_facts where pack = 'times-tables' and player = any (mine);
  delete from public.fact_answer_batches where player = any (mine);
  -- Bond Match: its tables are live (its migration 20261019001000 is on the bond-match branch, not yet on main), and the
  -- live New Season clears them, so this keeps doing that. Only when the tables exist, so a fresh database without them works too.
  if to_regclass('public.bond_match_games') is not null then
    execute 'delete from public.bond_match_games where player = any ($1)' using mine;
    execute 'delete from public.bond_match_bests where player = any ($1)' using mine;
  end if;
  -- Maths Monsters: the points go, the adventure stays.
  delete from public.monster_events where player = any (mine);
  update public.monster_saves set wild_wins_pending = 0 where player = any (mine);
  -- Dragon Maths: the points go, the heroes, stars, Hall of Heroes and achievements stay.
  delete from public.lord_scores where player = any (mine);
  update public.lord_heroes set wins_pending = 0 where player = any (mine);
  -- Clan Quest: the points go; clans, fame and achievements stay (fame has its own season button).
  delete from public.clan_scores where player = any (mine);
  update public.clans set wins_pending = 0 where player = any (mine);
  -- Marble Rush: best times, saved runs and any question lists left over go (a fresh board for the new year).
  delete from public.marble_bests where player = any (mine);
  delete from public.marble_runs where player = any (mine);
  delete from public.marble_questions where player = any (mine);
  return jsonb_build_object('botGames', bot_count, 'friendGames', friend_count + space_count + card_count + power_count,
    'gemKeepLevels', gem_count);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.record_marble_run(uuid, text, text, text, boolean, integer, integer, integer, integer, text, integer, integer, integer),
  public.my_marble(), public.marble_board(text, text, boolean), public.marble_ghost(text, text, boolean, text),
  public.teacher_set_marble_maths(text, uuid), public.teacher_set_marble_rescue(boolean, uuid),
  public.marble_store_run(uuid, text, boolean, jsonb), public.marble_load_run(uuid, text),
  public.marble_claim_answer(uuid, text, integer, numeric, boolean)
from public, anon, authenticated;
grant execute on function public.my_marble(), public.marble_board(text, text, boolean),
  public.marble_ghost(text, text, boolean, text),
  public.teacher_set_marble_maths(text, uuid), public.teacher_set_marble_rescue(boolean, uuid) to authenticated;
grant execute on function
  public.record_marble_run(uuid, text, text, text, boolean, integer, integer, integer, integer, text, integer, integer, integer),
  public.marble_store_run(uuid, text, boolean, jsonb), public.marble_load_run(uuid, text),
  public.marble_claim_answer(uuid, text, integer, numeric, boolean)
to service_role;
