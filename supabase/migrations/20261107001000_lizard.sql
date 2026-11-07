-- Lizard's Bundles (tens and ones to 100, then hundreds, tied into bundles, for ages 5 to 8; short id lizard): the
-- server side and the hub (docs/LIZARD-PLAN.md). Built the same way as Tūī's Ten Tree (20261106000100_tui.sql).
--
-- Lizard's Bundles is its own thing: two tables and its own functions, so no other game reads or changes them.
-- Nothing shared is re-created.
--
-- 1. lizard_progress: one row a pupil. The count of finished days (the den's bundles, the Golden Rafts and the
--    friend are worked out from it by shared/lizard/progress.ts), the NZ day a bundle last changed, the step (1 to 7)
--    and the help level (0 to 5), and the run of good goes that moves them (good_in_row, good_at_step). Saved only by the
--    `lizard` server function, and only if its version still matches.
-- 2. lizard_rounds: one row a challenge started. Its seed and the round as the server made it (shared/lizard/round.ts,
--    with every go's wrong cards), kept so the taps are checked against exactly what the pupil was shown. Once it has
--    finished: the taps (what the child built or tapped, as one whole number), how many wrong tries there
--    were and how many goes were right at the first try. A seed is used once per pupil and a challenge finishes once.
--    Finished challenges over 30 days old go.
-- 3. The switch (app_settings.lizard_enabled, per class, ON to start for every class), the help setting
--    (app_settings.lizard_help: 'fade', 'always' or 'off', 'fade' to start) and teacher_set_lizard().
-- 4. The hub: hub_games hooks, five achievements, the teacher's class and student lines. No points. Not a season game:
--    days are counted, not dates, so New Season leaves the den as it is.
--
-- Pupils can't read or change any of it directly; the server function does everything. The maths records it reads come
-- from space_maths_context and its answers are saved with record_fact_answers. The keys it records (pvbuild:n47 and the
-- rest) are ladder-only families in shared/maths/skillPacks/earlyFacts.ts; the
-- records are kept by key, so this migration doesn't depend on the code being live.
-- Depends on 20261017001100_gem_keep.sql, 20261020000100_game_hooks.sql (gem_keep_check_player),
-- 20261018002400_classes_and_warp.sql (settings) and 20261105000500_next_part_chips.sql (day_fn).

create table public.lizard_progress (
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

create table public.lizard_rounds (
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
create unique index lizard_rounds_seed on public.lizard_rounds (player, seed);
create index lizard_rounds_by_player on public.lizard_rounds (player, started_at);

alter table public.lizard_progress enable row level security;
alter table public.lizard_rounds enable row level security;
revoke all on public.lizard_progress, public.lizard_rounds from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The server function's jobs (service role only)
-- ---------------------------------------------------------------------------

-- The pupil's den and its version, or null if they've never played.
create function public.lizard_load(player uuid)
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
          from public.lizard_progress h where h.player = lizard_load.player);
end;
$$;

-- Keeps a new challenge (making the pupil's den on their first go, at the round's step and help level) and closes any
-- other open one. False if the pupil has used this seed before.
create function public.lizard_start(player uuid, seed bigint, round jsonb)
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
  if exists (select 1 from public.lizard_rounds r where r.player = lizard_start.player and r.seed = lizard_start.seed) then
    return false;
  end if;
  insert into public.lizard_progress (player, step, level)
  values (player, (round ->> 'step')::smallint, (round ->> 'level')::smallint)
  on conflict on constraint lizard_progress_pkey do nothing;
  update public.lizard_rounds r set open = false where r.player = lizard_start.player and r.open;
  delete from public.lizard_rounds r
  where r.player = lizard_start.player and not r.open and r.started_at < now() - interval '30 days';
  insert into public.lizard_rounds (player, seed, round) values (player, seed, round);
  return true;
end;
$$;

-- One of the pupil's challenges by its seed: { open, round }, or null if it isn't theirs.
create function public.lizard_round(player uuid, seed bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('open', r.open, 'round', r.round)
  from public.lizard_rounds r where r.player = lizard_round.player and r.seed = lizard_round.seed
$$;

-- Finishes an open challenge with the server's replay of its taps and saves the progress, together. The count of
-- finished days only ever stays or goes up by one. False if the challenge had already finished or the version moved on.
create function public.lizard_finish(
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
  perform 1 from public.lizard_rounds r where r.player = lizard_finish.player and r.seed = lizard_finish.seed and r.open for update;
  if not found then
    return false;
  end if;
  update public.lizard_progress h
  set days_done = lizard_finish.days_done, last_day = lizard_finish.last_day, step = lizard_finish.step,
      level = lizard_finish.level, good_in_row = lizard_finish.good_in_row, good_at_step = lizard_finish.good_at_step,
      version = h.version + 1, updated_at = now()
  where h.player = lizard_finish.player and h.version = lizard_finish.version
    and lizard_finish.days_done between h.days_done and h.days_done + 1;
  if not found then
    return false;
  end if;
  update public.lizard_rounds r
  set open = false, taps = lizard_finish.taps, mistakes = lizard_finish.mistakes, first_right = lizard_finish.first_right,
      finished_at = now()
  where r.player = lizard_finish.player and r.seed = lizard_finish.seed;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- The switch and the help setting
-- ---------------------------------------------------------------------------

alter table public.app_settings add column lizard_enabled boolean not null default true;
alter table public.app_settings add column lizard_help text not null default 'fade' check (lizard_help in ('fade', 'always', 'off'));

-- Either setting, or both (a null one is left as it is).
create function public.teacher_set_lizard(enabled boolean default null, help text default null, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if (enabled is null and help is null) or (help is not null and help not in ('fade', 'always', 'off')) then
    raise exception 'Unknown Lizard''s Bundles setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings s
  set lizard_enabled = coalesce(teacher_set_lizard.enabled, s.lizard_enabled),
      lizard_help = coalesce(teacher_set_lizard.help, s.lizard_help)
  where s.id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.lizard_load(uuid), public.lizard_start(uuid, bigint, jsonb), public.lizard_round(uuid, bigint),
  public.lizard_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer),
  public.teacher_set_lizard(boolean, text, uuid)
from public, anon, authenticated;
grant execute on function public.teacher_set_lizard(boolean, text, uuid) to authenticated;
grant execute on function
  public.lizard_load(uuid), public.lizard_start(uuid, bigint, jsonb), public.lizard_round(uuid, bigint),
  public.lizard_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer)
to service_role;

-- ---------------------------------------------------------------------------
-- The hooks
-- ---------------------------------------------------------------------------

-- Finished days, the furthest step reached and Golden Rafts won (one for every 30 finished days).
create function public.lizard_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'lizard_days', coalesce((select h.days_done from public.lizard_progress h where h.player = who), 0),
    'lizard_step', coalesce((select h.step from public.lizard_progress h where h.player = who), 0),
    'lizard_prizes', coalesce((select h.days_done / 30 from public.lizard_progress h where h.player = who), 0))
$$;

-- The lines on How points work.
create function public.lizard_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'No points: each Golden Raft is the prize, and an achievement.'))
$$;

-- Pupils with a den (a rebuild gives their achievements back).
create function public.lizard_players_list()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select h.player from public.lizard_progress h
$$;

create function public.lizard_last_played(player uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select h.updated_at from public.lizard_progress h where h.player = lizard_last_played.player
$$;

insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn, keep_achievements)
values ('lizard', 'lizard_enabled', 'public.lizard_counts(uuid)', 'public.lizard_point_rules()',
  'public.lizard_players_list()', null, 'public.lizard_last_played(uuid)', true);

-- The NZ day the pupil last changed a bundle, for the home page's "next part" chip (20261105000500_next_part_chips.sql).
create function public.lizard_last_day(who uuid)
returns date
language sql
stable
set search_path = ''
as $$
  select t.last_day from public.lizard_progress t where t.player = who
$$;
revoke execute on function public.lizard_last_day(uuid) from public, anon, authenticated;
update public.hub_games set day_fn = 'public.lizard_last_day(uuid)' where id = 'lizard';

insert into public.achievement_measures (measure) values ('lizard_days'), ('lizard_step'), ('lizard_prizes');

-- The step goal counts steps passed: step 4 means steps 1 to 3 are done, and step 7 (all mixed, the last step) is
-- reached, not passed.
insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('lizard-first-bundle', 'lizard', 'First bundle', '🪢', 'lizard_days', 1, 1),
  ('lizard-tidy-den', 'lizard', 'Tidy den', '🦎', 'lizard_days', 10, 2),
  ('lizard-tens-and-ones', 'lizard', 'Tens and ones', '🔟', 'lizard_step', 4, 3),
  ('lizard-hundred-raft', 'lizard', 'Hundred Raft', '🛶', 'lizard_step', 7, 4),
  ('lizard-golden-raft', 'lizard', 'Golden Raft', '🏆', 'lizard_prizes', 1, 5);

-- ---------------------------------------------------------------------------
-- The teacher's lines
-- ---------------------------------------------------------------------------

-- The teacher's Games table line for a class: how many of its pupils play, and the Golden Rafts won between them.
create function public.teacher_lizard_class(target_class uuid)
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
    from public.lizard_progress h
    join public.my_students() s(id) on s.id = h.player
    where exists (select 1 from public.class_members m where m.student_id = h.player and m.class_id = target_class));
end;
$$;

-- One line's worth for a student's page: finished days in all, the NZ day a bundle last changed, the step and help level,
-- when they last played, the five tens-and-ones keys they find hardest (tried at least twice, not yet secure, fewest right
-- first), and their last three finished challenges (the round and the taps) so the page can work out which slip they make most; or null.
create function public.teacher_lizard_student(student uuid)
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
                                              and g.fact_key ~ '^(pvbuild3?|pvread3?|pvzero|pvregroup|pvten|pvhun):'
                                            order by g.correct::numeric / g.attempts, g.fact_key limit 5) f), '[]'::jsonb),
                                    'recent', coalesce((
                                      select jsonb_agg(jsonb_build_object('round', r.round, 'taps', r.taps) order by r.finished_at desc)
                                      from (select x.round, x.taps, x.finished_at from public.lizard_rounds x
                                            where x.player = student and not x.open order by x.finished_at desc limit 3) r), '[]'::jsonb))
          from public.lizard_progress h where h.player = student);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.lizard_counts(uuid), public.lizard_point_rules(), public.lizard_players_list(), public.lizard_last_played(uuid),
  public.teacher_lizard_class(uuid), public.teacher_lizard_student(uuid)
from public, anon, authenticated;
grant execute on function public.teacher_lizard_class(uuid), public.teacher_lizard_student(uuid) to authenticated;
