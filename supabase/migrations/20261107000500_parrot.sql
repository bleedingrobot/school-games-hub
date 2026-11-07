-- Parrot's See-saw (the equals sign: missing numbers that keep a see-saw level, for younger students; short id parrot): the server side and the hub
-- (docs/PARROT-PLAN.md). Built the same way as Weka's Stepping Stones (20261105000600_weka.sql and 20261106000100_tui.sql).
--
-- Parrot's See-saw is its own thing: two tables and its own functions, so no other game reads or changes them.
-- Nothing shared is re-created.
--
-- 1. parrot_progress: one row a pupil. The count of finished days (the shiny things, the Golden Bells and the friend are worked
--    out from it by shared/parrot/progress.ts), the NZ day a shiny thing last changed, the step (1 to 6) and the help level
--    (0 to 5), and the run of good goes that moves them (good_in_row, good_at_step). Saved only by the `parrot` server
--    function, and only if its version still matches.
-- 2. parrot_rounds: one row a challenge started. Its seed and the round as the server made it (shared/parrot/round.ts), kept
--    so the taps are checked against exactly what the pupil was shown. Once it has finished: the taps, how many picks
--    were wrong and how many goes were right at the first tap. A seed is used once per pupil and a challenge finishes
--    once. Finished challenges over 30 days old go.
-- 3. The switch (app_settings.parrot_enabled, per class, ON to start for every class), the help setting
--    (app_settings.parrot_help: 'fade', 'always' or 'off', 'fade' to start) and teacher_set_parrot().
-- 4. The hub: hub_games hooks, achievements for finished days, steps and Golden Bells, the teacher's class and student
--    lines. No points. Not a season game: days are counted, not dates, so New Season leaves the rope as it is.
--
-- Pupils can't read or change any of it directly; the server function does everything. The maths records it reads come
-- from space_maths_context and its answers are saved with record_fact_answers.
-- Depends on 20261017001100_gem_keep.sql, 20261020000100_game_hooks.sql (gem_keep_check_player),
-- 20261018002400_classes_and_warp.sql (settings) and 20261105000500_next_part_chips.sql (day_fn).

create table public.parrot_progress (
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

create table public.parrot_rounds (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  seed bigint not null check (seed between 0 and 2147483647),
  round jsonb not null check (jsonb_typeof(round) = 'object'),
  open boolean not null default true,
  taps jsonb check (taps is null or jsonb_typeof(taps) = 'array'),
  mistakes integer check (mistakes >= 0),
  first_right integer check (first_right >= 0),
  slips jsonb check (slips is null or jsonb_typeof(slips) = 'array'),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create unique index parrot_rounds_seed on public.parrot_rounds (player, seed);
create index parrot_rounds_by_player on public.parrot_rounds (player, started_at);

alter table public.parrot_progress enable row level security;
alter table public.parrot_rounds enable row level security;
revoke all on public.parrot_progress, public.parrot_rounds from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The server function's jobs (service role only)
-- ---------------------------------------------------------------------------

-- The pupil's rope and its version, or null if they've never played.
create function public.parrot_load(player uuid)
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
          from public.parrot_progress h where h.player = parrot_load.player);
end;
$$;

-- Keeps a new challenge (making the pupil's rope on their first go, at the round's step and help level) and closes any
-- other open one. False if the pupil has used this seed before.
create function public.parrot_start(player uuid, seed bigint, round jsonb)
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
  if exists (select 1 from public.parrot_rounds r where r.player = parrot_start.player and r.seed = parrot_start.seed) then
    return false;
  end if;
  insert into public.parrot_progress (player, step, level)
  values (player, (round ->> 'step')::smallint, (round ->> 'level')::smallint)
  on conflict on constraint parrot_progress_pkey do nothing;
  update public.parrot_rounds r set open = false where r.player = parrot_start.player and r.open;
  delete from public.parrot_rounds r
  where r.player = parrot_start.player and not r.open and r.started_at < now() - interval '30 days';
  insert into public.parrot_rounds (player, seed, round) values (player, seed, round);
  return true;
end;
$$;

-- One of the pupil's challenges by its seed: { open, round }, or null if it isn't theirs.
create function public.parrot_round(player uuid, seed bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('open', r.open, 'round', r.round)
  from public.parrot_rounds r where r.player = parrot_round.player and r.seed = parrot_round.seed
$$;

-- Finishes an open challenge with the server's replay of its taps and saves the progress, together. The count of
-- finished days only ever stays or goes up by one. False if the challenge had already finished or the version moved on.
create function public.parrot_finish(
  player uuid, seed bigint, version integer, days_done integer, last_day date, step smallint, level smallint,
  good_in_row integer, good_at_step integer, taps jsonb, mistakes integer, first_right integer, slips jsonb default null
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
  perform 1 from public.parrot_rounds r where r.player = parrot_finish.player and r.seed = parrot_finish.seed and r.open for update;
  if not found then
    return false;
  end if;
  update public.parrot_progress h
  set days_done = parrot_finish.days_done, last_day = parrot_finish.last_day, step = parrot_finish.step,
      level = parrot_finish.level, good_in_row = parrot_finish.good_in_row, good_at_step = parrot_finish.good_at_step,
      version = h.version + 1, updated_at = now()
  where h.player = parrot_finish.player and h.version = parrot_finish.version
    and parrot_finish.days_done between h.days_done and h.days_done + 1;
  if not found then
    return false;
  end if;
  update public.parrot_rounds r
  set open = false, taps = parrot_finish.taps, mistakes = parrot_finish.mistakes, first_right = parrot_finish.first_right, slips = parrot_finish.slips,
      finished_at = now()
  where r.player = parrot_finish.player and r.seed = parrot_finish.seed;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- The switch and the help setting
-- ---------------------------------------------------------------------------

alter table public.app_settings add column parrot_enabled boolean not null default true;
alter table public.app_settings add column parrot_help text not null default 'fade' check (parrot_help in ('fade', 'always', 'off'));

-- Either setting, or both (a null one is left as it is).
create function public.teacher_set_parrot(enabled boolean default null, help text default null, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if (enabled is null and help is null) or (help is not null and help not in ('fade', 'always', 'off')) then
    raise exception 'Unknown Parrot''s See-saw setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings s
  set parrot_enabled = coalesce(teacher_set_parrot.enabled, s.parrot_enabled),
      parrot_help = coalesce(teacher_set_parrot.help, s.parrot_help)
  where s.id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.parrot_load(uuid), public.parrot_start(uuid, bigint, jsonb), public.parrot_round(uuid, bigint),
  public.parrot_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer, jsonb),
  public.teacher_set_parrot(boolean, text, uuid)
from public, anon, authenticated;
grant execute on function public.teacher_set_parrot(boolean, text, uuid) to authenticated;
grant execute on function
  public.parrot_load(uuid), public.parrot_start(uuid, bigint, jsonb), public.parrot_round(uuid, bigint),
  public.parrot_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer, jsonb)
to service_role;

-- ---------------------------------------------------------------------------
-- The hooks
-- ---------------------------------------------------------------------------

-- Finished days, the furthest step reached and Golden Bells won (one for every 30 finished days).
create function public.parrot_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'parrot_days', coalesce((select h.days_done from public.parrot_progress h where h.player = who), 0),
    'parrot_step', coalesce((select h.step from public.parrot_progress h where h.player = who), 0),
    'parrot_prizes', coalesce((select h.days_done / 30 from public.parrot_progress h where h.player = who), 0))
$$;

-- The lines on How points work.
create function public.parrot_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'No points: each Golden Bell is the prize, and an achievement.'))
$$;

-- Pupils with a rope (a rebuild gives their achievements back).
create function public.parrot_players_list()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select h.player from public.parrot_progress h
$$;

create function public.parrot_last_played(player uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select h.updated_at from public.parrot_progress h where h.player = parrot_last_played.player
$$;

insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn, keep_achievements)
values ('parrot', 'parrot_enabled', 'public.parrot_counts(uuid)', 'public.parrot_point_rules()',
  'public.parrot_players_list()', null, 'public.parrot_last_played(uuid)', true);

-- The NZ day the pupil last changed a shiny thing, for the home page's "next part" chip (20261105000500_next_part_chips.sql).
create function public.parrot_last_day(who uuid)
returns date
language sql
stable
set search_path = ''
as $$
  select t.last_day from public.parrot_progress t where t.player = who
$$;
revoke execute on function public.parrot_last_day(uuid) from public, anon, authenticated;
update public.hub_games set day_fn = 'public.parrot_last_day(uuid)' where id = 'parrot';

insert into public.achievement_measures (measure) values ('parrot_days'), ('parrot_step'), ('parrot_prizes');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('parrot-first', 'parrot', 'First level', '⚖️', 'parrot_days', 1, 1),
  ('parrot-same', 'parrot', 'Always the same', '🟰', 'parrot_days', 10, 2),
  ('parrot-both', 'parrot', 'Both sides', '🦜', 'parrot_step', 4, 3),
  ('parrot-sorter', 'parrot', 'Level Sorter', '🏅', 'parrot_step', 6, 4),
  ('parrot-bell', 'parrot', 'Golden Bell', '🔔', 'parrot_prizes', 1, 5);

-- ---------------------------------------------------------------------------
-- The teacher's lines
-- ---------------------------------------------------------------------------

-- The teacher's Games table line for a class: how many of its pupils play, and the Golden Bells won between them.
create function public.teacher_parrot_class(target_class uuid)
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
    select jsonb_build_object('players', count(*), 'bells', coalesce(sum(h.days_done / 30), 0))
    from public.parrot_progress h
    join public.my_students() s(id) on s.id = h.player
    where exists (select 1 from public.class_members m where m.student_id = h.player and m.class_id = target_class));
end;
$$;

-- One line's worth for a student's page: finished days in all (the screens work out the shiny things and Golden Bells), the
-- NZ day one last changed, the step and help level, when they last played, the commonest first slip in their last ten
-- finished challenges (copy, total or all: they said a number from the question) and the equals facts they find hardest
-- (tried at least twice, not yet secure, fewest right first; empty until the shared maths keys for them are live); or null.
create function public.teacher_parrot_student(student uuid)
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
                                    'slip', (
                                      select x.kind from (
                                        select s.kind, count(*) n
                                        from (select r.slips from public.parrot_rounds r
                                              where r.player = student and not r.open and r.slips is not null
                                              order by r.finished_at desc limit 10) l,
                                             lateral jsonb_array_elements_text(l.slips) s(kind)
                                        where s.kind in ('copy', 'total', 'all')
                                        group by s.kind) x
                                      order by x.n desc, x.kind limit 1),
                                    'hardest', coalesce((
                                      select jsonb_agg(f.fact_key order by f.correct::numeric / f.attempts, f.fact_key)
                                      from (select g.fact_key, g.correct, g.attempts from public.gem_keep_facts g
                                            where g.player = student and g.attempts >= 2 and g.box < 2
                                              and g.fact_key like 'eq%'
                                            order by g.correct::numeric / g.attempts, g.fact_key limit 3) f), '[]'::jsonb))
          from public.parrot_progress h where h.player = student);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.parrot_counts(uuid), public.parrot_point_rules(), public.parrot_players_list(), public.parrot_last_played(uuid),
  public.teacher_parrot_class(uuid), public.teacher_parrot_student(uuid)
from public, anon, authenticated;
grant execute on function public.teacher_parrot_class(uuid), public.teacher_parrot_student(uuid) to authenticated;
