-- Template from supabase/migrations/20261107001000_lizard.sql (a junior game). For a whole worked file, copy that one
-- (junior) or 20261111000100_toonflap.sql (older), replace the id, and keep only what your game needs.
-- Name: supabase/migrations/<number>_<id>.sql, number from `node scripts/migration-numbers.mjs`.
-- Then add your blocks to teacher_foundational_class / teacher_progress_other_games in a later migration
-- (docs/game-guide/2-steps-and-progress.md).

-- 1. Tables: prefixed with the id, RLS on, no policy, nothing granted. Pupils never read them directly.
create table public.<id>_progress (
  player uuid primary key references public.profiles (id) on delete cascade,
  days_done integer not null default 0 check (days_done >= 0),
  last_day date,
  step smallint not null default 1 check (step between 1 and <top>),
  good_in_row integer not null default 0 check (good_in_row >= 0),
  good_at_step integer not null default 0 check (good_at_step >= 0),
  version integer not null default 1 check (version >= 1),       -- a save only lands if the version still matches
  updated_at timestamptz not null default now()
);

create table public.<id>_rounds (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  seed bigint not null check (seed between 0 and 2147483647),
  round jsonb not null check (jsonb_typeof(round) = 'object'),    -- the round as the server made it
  step smallint,                                                  -- the step it was played at
  open boolean not null default true,
  taps jsonb check (taps is null or jsonb_typeof(taps) = 'array'),-- [{pick, ms}], the server's replay
  mistakes integer check (mistakes >= 0),
  first_right integer check (first_right >= 0),
  slips jsonb,                                                    -- one kind per wrong first try (slipsOf)
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create unique index <id>_rounds_seed on public.<id>_rounds (player, seed);   -- a seed is used once: sent twice counts once
create index <id>_rounds_by_player on public.<id>_rounds (player, started_at);

alter table public.<id>_progress enable row level security;
alter table public.<id>_rounds enable row level security;
revoke all on public.<id>_progress, public.<id>_rounds from anon, authenticated;

-- 2. The server function's jobs (service role only): <id>_load(player), <id>_start(player, seed, round),
--    <id>_round(player, seed), <id>_finish(...). Copy lizard_load / lizard_start / lizard_round / lizard_finish.

-- 3. The switch and settings: add columns only, and one teacher_set_<id>() with the shared guard.
alter table public.app_settings add column <id>_enabled boolean not null default false;   -- off until the switch-on PR
-- create function public.teacher_set_<id>(enabled boolean default null, target_class uuid default null) ...
--   copy teacher_set_lizard: it uses require_settings_target().

-- 4. Hub hooks: points, achievements, last played. Never re-create a shared function.
-- create function public.<id>_counts(who uuid) returns jsonb ...         { "<id>_days": n, "<id>_step": n }
-- create function public.<id>_point_rules() returns jsonb ...            { "lines": ["…"] }
-- create function public.<id>_players_list() returns setof uuid ...
-- create function public.<id>_last_played(player uuid) returns timestamptz ...
insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn, keep_achievements)
values ('<id>', '<id>_enabled', 'public.<id>_counts(uuid)', 'public.<id>_point_rules()',
  'public.<id>_players_list()', null, 'public.<id>_last_played(uuid)', true);

insert into public.achievement_measures (measure) values ('<id>_days'), ('<id>_step');
insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('<id>-first', '<id>', '<First go name>', '<emoji>', '<id>_days', 1, 1),
  ('<id>-steady', '<id>', '<Steady play name>', '<emoji>', '<id>_days', 10, 2),
  ('<id>-top', '<id>', '<Big goal name>', '<emoji>', '<id>_step', <top>, 3);

-- 5. Teacher reads: teacher_<id>_class(target_class) and teacher_<id>_student(student), security definer, starting with
--    require_teacher() + teaches_class(...) or require_teacher_of(student). Copy teacher_lizard_class / _student; the
--    student read returns `slip` with the kit's topSlip rule (20261111000300 is the pattern).

-- 6. Who can call what: revoke every new function from public, anon, authenticated; grant teacher reads and
--    teacher_set_<id> to authenticated; grant the server jobs to service_role only.
-- revoke execute on function public.<id>_counts(uuid), ... from public, anon, authenticated;
-- grant execute on function public.teacher_set_<id>(boolean, uuid), public.teacher_<id>_class(uuid), public.teacher_<id>_student(uuid) to authenticated;
-- grant execute on function public.<id>_load(uuid), public.<id>_start(uuid, bigint, jsonb), ... to service_role;
