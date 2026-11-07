-- Kererū's Number Line (reading, placing and jumping on lines to 100 and 1000, for ages 7 to 9; short id kereru): the
-- server side and the hub (docs/KERERU-PLAN.md). Built the same way as Tūī's Ten Tree (20261106000100_tui.sql).
--
-- Kererū's Number Line is its own thing: two tables and its own functions, so no other game reads or changes them.
-- Nothing shared is re-created.
--
-- 1. kereru_progress: one row a pupil. The count of finished days (the berry clusters, the Golden Berry Branches and the
--    friend are worked out from it by shared/kereru/progress.ts), the NZ day a cluster last changed, the step (1 to 7)
--    and the help level (0 to 5), and the run of good goes that moves them (good_in_row, good_at_step). Saved only by the
--    `kereru` server function, and only if its version still matches.
-- 2. kereru_rounds: one row a challenge started. Its seed and the round as the server made it (shared/kereru/round.ts,
--    with every go's wrong cards), kept so the taps are checked against exactly what the pupil was shown. Once it has
--    finished: the taps (a tap on the branch is saved as where along the line it landed), how many wrong taps there
--    were and how many goes were right at the first tap. A seed is used once per pupil and a challenge finishes once.
--    Finished challenges over 30 days old go.
-- 3. The switch (app_settings.kereru_enabled, per class, ON to start for every class), the help setting
--    (app_settings.kereru_help: 'fade', 'always' or 'off', 'fade' to start) and teacher_set_kereru().
-- 4. The hub: hub_games hooks, five achievements, the teacher's class and student lines. No points. Not a season game:
--    days are counted, not dates, so New Season leaves the branch as it is.
--
-- Pupils can't read or change any of it directly; the server function does everything. The maths records it reads come
-- from space_maths_context and its answers are saved with record_fact_answers. The keys it records (place100:n63 and the
-- rest) are the ladder-only families of the maths-kereru-keys branch (shared/maths/skillPacks/earlyFacts.ts); the
-- records are kept by key, so this migration doesn't depend on that branch being live.
-- Depends on 20261017001100_gem_keep.sql, 20261020000100_game_hooks.sql (gem_keep_check_player),
-- 20261018002400_classes_and_warp.sql (settings) and 20261105000500_next_part_chips.sql (day_fn).

create table public.kereru_progress (
  player uuid primary key references public.profiles (id) on delete cascade,
  days_done integer not null default 0 check (days_done >= 0),
  last_day date,
  step smallint not null default 1 check (step between 1 and 7),
  level smallint not null default 5 check (level between 0 and 5),
  good_in_row integer not null default 0 check (good_in_row >= 0),
  good_at_step integer not null default 0 check (good_at_step >= 0),
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now()
);

create table public.kereru_rounds (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  seed bigint not null check (seed between 0 and 2147483647),
  round jsonb not null check (jsonb_typeof(round) = 'object'),
  open boolean not null default true,
  taps jsonb check (taps is null or jsonb_typeof(taps) = 'array'),
  mistakes integer check (mistakes >= 0),
  first_right integer check (first_right >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create unique index kereru_rounds_seed on public.kereru_rounds (player, seed);
create index kereru_rounds_by_player on public.kereru_rounds (player, started_at);

alter table public.kereru_progress enable row level security;
alter table public.kereru_rounds enable row level security;
revoke all on public.kereru_progress, public.kereru_rounds from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The server function's jobs (service role only)
-- ---------------------------------------------------------------------------

-- The pupil's branch and its version, or null if they've never played.
create function public.kereru_load(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  return (select jsonb_build_object('daysDone', h.days_done, 'lastDay', to_char(h.last_day, 'YYYY-MM-DD'),
                                    'step', h.step, 'level', h.level, 'goodInRow', h.good_in_row,
                                    'goodAtStep', h.good_at_step, 'version', h.version)
          from public.kereru_progress h where h.player = kereru_load.player);
end;
$$;

-- Keeps a new challenge (making the pupil's branch on their first go, at the round's step and help level) and closes any
-- other open one. False if the pupil has used this seed before.
create function public.kereru_start(player uuid, seed bigint, round jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if jsonb_typeof(round) is distinct from 'object' or (round ->> 'seed')::bigint is distinct from seed then
    raise exception 'That challenge is not right.' using errcode = '22023';
  end if;
  if exists (select 1 from public.kereru_rounds r where r.player = kereru_start.player and r.seed = kereru_start.seed) then
    return false;
  end if;
  insert into public.kereru_progress (player, step, level)
  values (player, (round ->> 'step')::smallint, (round ->> 'level')::smallint)
  on conflict on constraint kereru_progress_pkey do nothing;
  update public.kereru_rounds r set open = false where r.player = kereru_start.player and r.open;
  delete from public.kereru_rounds r
  where r.player = kereru_start.player and not r.open and r.started_at < now() - interval '30 days';
  insert into public.kereru_rounds (player, seed, round) values (player, seed, round);
  return true;
end;
$$;

-- One of the pupil's challenges by its seed: { open, round }, or null if it isn't theirs.
create function public.kereru_round(player uuid, seed bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('open', r.open, 'round', r.round)
  from public.kereru_rounds r where r.player = kereru_round.player and r.seed = kereru_round.seed
$$;

-- Finishes an open challenge with the server's replay of its taps and saves the progress, together. The count of
-- finished days only ever stays or goes up by one. False if the challenge had already finished or the version moved on.
create function public.kereru_finish(
  player uuid, seed bigint, version integer, days_done integer, last_day date, step smallint, level smallint,
  good_in_row integer, good_at_step integer, taps jsonb, mistakes integer, first_right integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(taps) is distinct from 'array' or mistakes is null or mistakes < 0 or first_right is null or first_right < 0
     or days_done is null or step is null or step not between 1 and 7 or level is null or level not between 0 and 5
     or good_in_row is null or good_in_row < 0 or good_at_step is null or good_at_step < 0 then
    raise exception 'That challenge is not right.' using errcode = '22023';
  end if;
  perform 1 from public.kereru_rounds r where r.player = kereru_finish.player and r.seed = kereru_finish.seed and r.open for update;
  if not found then
    return false;
  end if;
  update public.kereru_progress h
  set days_done = kereru_finish.days_done, last_day = kereru_finish.last_day, step = kereru_finish.step,
      level = kereru_finish.level, good_in_row = kereru_finish.good_in_row, good_at_step = kereru_finish.good_at_step,
      version = h.version + 1, updated_at = now()
  where h.player = kereru_finish.player and h.version = kereru_finish.version
    and kereru_finish.days_done between h.days_done and h.days_done + 1;
  if not found then
    return false;
  end if;
  update public.kereru_rounds r
  set open = false, taps = kereru_finish.taps, mistakes = kereru_finish.mistakes, first_right = kereru_finish.first_right,
      finished_at = now()
  where r.player = kereru_finish.player and r.seed = kereru_finish.seed;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- The switch and the help setting
-- ---------------------------------------------------------------------------

alter table public.app_settings add column kereru_enabled boolean not null default true;
alter table public.app_settings add column kereru_help text not null default 'fade' check (kereru_help in ('fade', 'always', 'off'));

-- Either setting, or both (a null one is left as it is).
create function public.teacher_set_kereru(enabled boolean default null, help text default null, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if (enabled is null and help is null) or (help is not null and help not in ('fade', 'always', 'off')) then
    raise exception 'Unknown Kererū''s Number Line setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings s
  set kereru_enabled = coalesce(teacher_set_kereru.enabled, s.kereru_enabled),
      kereru_help = coalesce(teacher_set_kereru.help, s.kereru_help)
  where s.id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.kereru_load(uuid), public.kereru_start(uuid, bigint, jsonb), public.kereru_round(uuid, bigint),
  public.kereru_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer),
  public.teacher_set_kereru(boolean, text, uuid)
from public, anon, authenticated;
grant execute on function public.teacher_set_kereru(boolean, text, uuid) to authenticated;
grant execute on function
  public.kereru_load(uuid), public.kereru_start(uuid, bigint, jsonb), public.kereru_round(uuid, bigint),
  public.kereru_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer)
to service_role;

-- ---------------------------------------------------------------------------
-- The hooks
-- ---------------------------------------------------------------------------

-- Finished days, the furthest step reached and Golden Berry Branches won (one for every 30 finished days).
create function public.kereru_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'kereru_days', coalesce((select h.days_done from public.kereru_progress h where h.player = who), 0),
    'kereru_step', coalesce((select h.step from public.kereru_progress h where h.player = who), 0),
    'kereru_prizes', coalesce((select h.days_done / 30 from public.kereru_progress h where h.player = who), 0))
$$;

-- The lines on How points work.
create function public.kereru_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'No points: each Golden Berry Branch is the prize, and an achievement.'))
$$;

-- Pupils with a branch (a rebuild gives their achievements back).
create function public.kereru_players_list()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select h.player from public.kereru_progress h
$$;

create function public.kereru_last_played(player uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select h.updated_at from public.kereru_progress h where h.player = kereru_last_played.player
$$;

insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn, keep_achievements)
values ('kereru', 'kereru_enabled', 'public.kereru_counts(uuid)', 'public.kereru_point_rules()',
  'public.kereru_players_list()', null, 'public.kereru_last_played(uuid)', true);

-- The NZ day the pupil last changed a berry cluster, for the home page's "next part" chip (20261105000500_next_part_chips.sql).
create function public.kereru_last_day(who uuid)
returns date
language sql
stable
set search_path = ''
as $$
  select t.last_day from public.kereru_progress t where t.player = who
$$;
revoke execute on function public.kereru_last_day(uuid) from public, anon, authenticated;
update public.hub_games set day_fn = 'public.kereru_last_day(uuid)' where id = 'kereru';

insert into public.achievement_measures (measure) values ('kereru_days'), ('kereru_step'), ('kereru_prizes');

-- The step goal counts steps passed: step 5 means steps 1 to 4 are done, and step 7 (the long branch, the last step) is
-- reached, not passed.
insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('kereru-first-flight', 'kereru', 'First flight', '🕊️', 'kereru_days', 1, 1),
  ('kereru-steady-wings', 'kereru', 'Steady wings', '🪽', 'kereru_days', 10, 2),
  ('kereru-past-the-middle', 'kereru', 'Past the middle', '📏', 'kereru_step', 5, 3),
  ('kereru-whole-branch', 'kereru', 'The whole branch', '🌳', 'kereru_step', 7, 4),
  ('kereru-golden-berry-branch', 'kereru', 'Golden Berry Branch', '🍇', 'kereru_prizes', 1, 5);

-- ---------------------------------------------------------------------------
-- The teacher's lines
-- ---------------------------------------------------------------------------

-- The teacher's Games table line for a class: how many of its pupils play, and the Golden Berry Branches won between them.
create function public.teacher_kereru_class(target_class uuid)
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
    select jsonb_build_object('players', count(*), 'prizes', coalesce(sum(h.days_done / 30), 0))
    from public.kereru_progress h
    join public.my_students() s(id) on s.id = h.player
    where exists (select 1 from public.class_members m where m.student_id = h.player and m.class_id = target_class));
end;
$$;

-- One line's worth for a student's page: finished days in all, the NZ day a cluster last changed, the step and help level,
-- when they last played, the five number-line keys they find hardest (tried at least twice, not yet secure, fewest right
-- first), and their last three finished challenges (the round and the taps) so the page can work out how close their taps
-- on the branch are and whether big numbers are squashed; or null.
create function public.teacher_kereru_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return (select jsonb_build_object('daysDone', h.days_done, 'lastDay', to_char(h.last_day, 'YYYY-MM-DD'),
                                    'step', h.step, 'level', h.level, 'lastPlayed', h.updated_at,
                                    'hardest', coalesce((
                                      select jsonb_agg(f.fact_key order by f.correct::numeric / f.attempts, f.fact_key)
                                      from (select g.fact_key, g.correct, g.attempts from public.gem_keep_facts g
                                            where g.player = student and g.pack = 'early-facts' and g.attempts >= 2 and g.box < 2
                                              and g.fact_key ~ '^(place100|read100|tens100|near10|zoom|place1000|read1000|near100):'
                                            order by g.correct::numeric / g.attempts, g.fact_key limit 5) f), '[]'::jsonb),
                                    'recent', coalesce((
                                      select jsonb_agg(jsonb_build_object('round', r.round, 'taps', r.taps) order by r.finished_at desc)
                                      from (select x.round, x.taps, x.finished_at from public.kereru_rounds x
                                            where x.player = student and not x.open order by x.finished_at desc limit 3) r), '[]'::jsonb))
          from public.kereru_progress h where h.player = student);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.kereru_counts(uuid), public.kereru_point_rules(), public.kereru_players_list(), public.kereru_last_played(uuid),
  public.teacher_kereru_class(uuid), public.teacher_kereru_student(uuid)
from public, anon, authenticated;
grant execute on function public.teacher_kereru_class(uuid), public.teacher_kereru_student(uuid) to authenticated;
