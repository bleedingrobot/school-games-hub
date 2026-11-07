-- Swamp Hen's Reed Rows (equal groups and arrays, then the times tables, for ages 7 to 10; short id swamphen): the
-- server side and the hub (docs/SWAMPHEN-PLAN.md). Built the same way as Pigeon's Number Line (20261107000200_pigeon.sql).
--
-- Swamp Hen's Reed Rows is its own thing: two tables and its own functions, so no other game reads or changes them.
-- Nothing shared is re-created.
--
-- 1. swamphen_progress: one row a pupil. The count of finished days (the reed rows, the Golden Reed Gardens and the
--    friend are worked out from it by shared/swamphen/progress.ts), the NZ day a row last changed, the step (1 to 6)
--    and the help level (0 to 5), and the run of good goes that moves them (good_in_row, good_at_step). Saved only by the
--    `swamphen` server function, and only if its version still matches.
-- 2. swamphen_rounds: one row a challenge started. Its seed and the round as the server made it (shared/swamphen/round.ts,
--    with every go's wrong cards), kept so the taps are checked against exactly what the pupil was shown. Once it has
--    finished: the taps (each tap is a card: a total, a count in a row or a picture's code), how many wrong taps there
--    were and how many goes were right at the first tap. A seed is used once per pupil and a challenge finishes once.
--    Finished challenges over 30 days old go.
-- 3. The switch (app_settings.swamphen_enabled, per class, ON to start for every class), the help setting
--    (app_settings.swamphen_help: 'fade', 'always' or 'off', 'fade' to start) and teacher_set_swamphen().
-- 4. The hub: hub_games hooks, five achievements, the teacher's class and student lines. No points. Not a season game:
--    days are counted, not dates, so New Season leaves the garden as it is.
--
-- Pupils can't read or change any of it directly; the server function does everything. The maths records it reads come
-- from space_maths_context and its answers are saved with record_fact_answers. The keys it records (rows:4x6, turn:3x5,
-- share:24/4, cut:6x7, which:3x5 and the plain mul:4x6) are ladder-only families in shared/maths/skillPacks/earlyFacts.ts; the
-- records are kept by key, so this migration doesn't depend on that code being live.
-- Depends on 20261017001100_gem_keep.sql, 20261020000100_game_hooks.sql (gem_keep_check_player),
-- 20261018002400_classes_and_warp.sql (settings) and 20261105000500_next_part_chips.sql (day_fn).

create table public.swamphen_progress (
  player uuid primary key references public.profiles (id) on delete cascade,
  days_done integer not null default 0 check (days_done >= 0),
  last_day date,
  step smallint not null default 1 check (step between 1 and 6),
  level smallint not null default 5 check (level between 0 and 5),
  good_in_row integer not null default 0 check (good_in_row >= 0),
  good_at_step integer not null default 0 check (good_at_step >= 0),
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now()
);

create table public.swamphen_rounds (
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
create unique index swamphen_rounds_seed on public.swamphen_rounds (player, seed);
create index swamphen_rounds_by_player on public.swamphen_rounds (player, started_at);

alter table public.swamphen_progress enable row level security;
alter table public.swamphen_rounds enable row level security;
revoke all on public.swamphen_progress, public.swamphen_rounds from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The server function's jobs (service role only)
-- ---------------------------------------------------------------------------

-- The pupil's garden and its version, or null if they've never played.
create function public.swamphen_load(player uuid)
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
          from public.swamphen_progress h where h.player = swamphen_load.player);
end;
$$;

-- Keeps a new challenge (making the pupil's garden on their first go, at the round's step and help level) and closes any
-- other open one. False if the pupil has used this seed before.
create function public.swamphen_start(player uuid, seed bigint, round jsonb)
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
  if exists (select 1 from public.swamphen_rounds r where r.player = swamphen_start.player and r.seed = swamphen_start.seed) then
    return false;
  end if;
  insert into public.swamphen_progress (player, step, level)
  values (player, (round ->> 'step')::smallint, (round ->> 'level')::smallint)
  on conflict on constraint swamphen_progress_pkey do nothing;
  update public.swamphen_rounds r set open = false where r.player = swamphen_start.player and r.open;
  delete from public.swamphen_rounds r
  where r.player = swamphen_start.player and not r.open and r.started_at < now() - interval '30 days';
  insert into public.swamphen_rounds (player, seed, round) values (player, seed, round);
  return true;
end;
$$;

-- One of the pupil's challenges by its seed: { open, round }, or null if it isn't theirs.
create function public.swamphen_round(player uuid, seed bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('open', r.open, 'round', r.round)
  from public.swamphen_rounds r where r.player = swamphen_round.player and r.seed = swamphen_round.seed
$$;

-- Finishes an open challenge with the server's replay of its taps and saves the progress, together. The count of
-- finished days only ever stays or goes up by one. False if the challenge had already finished or the version moved on.
create function public.swamphen_finish(
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
     or days_done is null or step is null or step not between 1 and 6 or level is null or level not between 0 and 5
     or good_in_row is null or good_in_row < 0 or good_at_step is null or good_at_step < 0 then
    raise exception 'That challenge is not right.' using errcode = '22023';
  end if;
  perform 1 from public.swamphen_rounds r where r.player = swamphen_finish.player and r.seed = swamphen_finish.seed and r.open for update;
  if not found then
    return false;
  end if;
  update public.swamphen_progress h
  set days_done = swamphen_finish.days_done, last_day = swamphen_finish.last_day, step = swamphen_finish.step,
      level = swamphen_finish.level, good_in_row = swamphen_finish.good_in_row, good_at_step = swamphen_finish.good_at_step,
      version = h.version + 1, updated_at = now()
  where h.player = swamphen_finish.player and h.version = swamphen_finish.version
    and swamphen_finish.days_done between h.days_done and h.days_done + 1;
  if not found then
    return false;
  end if;
  update public.swamphen_rounds r
  set open = false, taps = swamphen_finish.taps, mistakes = swamphen_finish.mistakes, first_right = swamphen_finish.first_right,
      finished_at = now()
  where r.player = swamphen_finish.player and r.seed = swamphen_finish.seed;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- The switch and the help setting
-- ---------------------------------------------------------------------------

alter table public.app_settings add column swamphen_enabled boolean not null default true;
alter table public.app_settings add column swamphen_help text not null default 'fade' check (swamphen_help in ('fade', 'always', 'off'));

-- Either setting, or both (a null one is left as it is).
create function public.teacher_set_swamphen(enabled boolean default null, help text default null, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if (enabled is null and help is null) or (help is not null and help not in ('fade', 'always', 'off')) then
    raise exception 'Unknown Swamp Hen''s Reed Rows setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings s
  set swamphen_enabled = coalesce(teacher_set_swamphen.enabled, s.swamphen_enabled),
      swamphen_help = coalesce(teacher_set_swamphen.help, s.swamphen_help)
  where s.id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.swamphen_load(uuid), public.swamphen_start(uuid, bigint, jsonb), public.swamphen_round(uuid, bigint),
  public.swamphen_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer),
  public.teacher_set_swamphen(boolean, text, uuid)
from public, anon, authenticated;
grant execute on function public.teacher_set_swamphen(boolean, text, uuid) to authenticated;
grant execute on function
  public.swamphen_load(uuid), public.swamphen_start(uuid, bigint, jsonb), public.swamphen_round(uuid, bigint),
  public.swamphen_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer)
to service_role;

-- ---------------------------------------------------------------------------
-- The hooks
-- ---------------------------------------------------------------------------

-- Finished days, the furthest step reached and Golden Reed Gardens won (one for every 30 finished days).
create function public.swamphen_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'swamphen_days', coalesce((select h.days_done from public.swamphen_progress h where h.player = who), 0),
    'swamphen_step', coalesce((select h.step from public.swamphen_progress h where h.player = who), 0),
    'swamphen_prizes', coalesce((select h.days_done / 30 from public.swamphen_progress h where h.player = who), 0))
$$;

-- The lines on How points work.
create function public.swamphen_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'No points: each Golden Reed Garden is the prize, and an achievement.'))
$$;

-- Pupils with a garden (a rebuild gives their achievements back).
create function public.swamphen_players_list()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select h.player from public.swamphen_progress h
$$;

create function public.swamphen_last_played(player uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select h.updated_at from public.swamphen_progress h where h.player = swamphen_last_played.player
$$;

insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn, keep_achievements)
values ('swamphen', 'swamphen_enabled', 'public.swamphen_counts(uuid)', 'public.swamphen_point_rules()',
  'public.swamphen_players_list()', null, 'public.swamphen_last_played(uuid)', true);

-- The NZ day the pupil last changed a reed row, for the home page's "next part" chip (20261105000500_next_part_chips.sql).
create function public.swamphen_last_day(who uuid)
returns date
language sql
stable
set search_path = ''
as $$
  select t.last_day from public.swamphen_progress t where t.player = who
$$;
revoke execute on function public.swamphen_last_day(uuid) from public, anon, authenticated;
update public.hub_games set day_fn = 'public.swamphen_last_day(uuid)' where id = 'swamphen';

insert into public.achievement_measures (measure) values ('swamphen_days'), ('swamphen_step'), ('swamphen_prizes');

-- The step goal counts steps passed: step 3 means steps 1 and 2 are done, and step 6 (one row short, the last step) is
-- reached, not passed.
insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('swamphen-first-row', 'swamphen', 'First row', '🌱', 'swamphen_days', 1, 1),
  ('swamphen-rows-and-rows', 'swamphen', 'Rows and rows', '🌾', 'swamphen_days', 10, 2),
  ('swamphen-turn-it-round', 'swamphen', 'Turn it round', '🔄', 'swamphen_step', 3, 3),
  ('swamphen-cut-it-up', 'swamphen', 'Cut it up', '✂️', 'swamphen_step', 6, 4),
  ('swamphen-golden-reed-garden', 'swamphen', 'Golden Reed Garden', '🏆', 'swamphen_prizes', 1, 5);

-- ---------------------------------------------------------------------------
-- The teacher's lines
-- ---------------------------------------------------------------------------

-- The teacher's Games table line for a class: how many of its pupils play, and the Golden Reed Gardens won between them.
create function public.teacher_swamphen_class(target_class uuid)
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
    from public.swamphen_progress h
    join public.my_students() s(id) on s.id = h.player
    where exists (select 1 from public.class_members m where m.student_id = h.player and m.class_id = target_class));
end;
$$;

-- One line's worth for a student's page: finished days in all, the NZ day a row last changed, the step and help level,
-- when they last played, the five equal-rows keys they find hardest (tried at least twice, not yet secure, fewest right
-- first), and their last three finished challenges (the round and the taps) so the page can work out which slip they make most; or null.
create function public.teacher_swamphen_student(student uuid)
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
                                              and g.fact_key ~ '^(rows|turn|share|cut|which):'
                                            order by g.correct::numeric / g.attempts, g.fact_key limit 5) f), '[]'::jsonb),
                                    'recent', coalesce((
                                      select jsonb_agg(jsonb_build_object('round', r.round, 'taps', r.taps) order by r.finished_at desc)
                                      from (select x.round, x.taps, x.finished_at from public.swamphen_rounds x
                                            where x.player = student and not x.open order by x.finished_at desc limit 3) r), '[]'::jsonb))
          from public.swamphen_progress h where h.player = student);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.swamphen_counts(uuid), public.swamphen_point_rules(), public.swamphen_players_list(), public.swamphen_last_played(uuid),
  public.teacher_swamphen_class(uuid), public.teacher_swamphen_student(uuid)
from public, anon, authenticated;
grant execute on function public.teacher_swamphen_class(uuid), public.teacher_swamphen_student(uuid) to authenticated;
