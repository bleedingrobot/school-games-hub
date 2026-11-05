-- Tūī's Ten Tree (making ten and "ten and" facts, for younger students; short id tui): the server side and the hub
-- (docs/TUI-PLAN.md). Built the same way as Weka's Stepping Stones (20261105000600_weka.sql).
--
-- Tūī's Ten Tree is its own thing: two tables and its own functions, so no other game reads or changes them.
-- Nothing shared is re-created.
--
-- 1. tui_progress: one row a pupil. The count of finished days (the flowers, the Golden Nests and the friend are worked
--    out from it by shared/tui/progress.ts), the NZ day a flower last changed, the step (1 to 5) and the help level
--    (0 to 5), and the run of good goes that moves them (good_in_row, good_at_step). Saved only by the `tui` server
--    function, and only if its version still matches.
-- 2. tui_rounds: one row a challenge started. Its seed and the round as the server made it (shared/tui/round.ts), kept
--    so the taps are checked against exactly what the pupil was shown. Once it has finished: the taps, how many picks
--    were wrong and how many goes were right at the first tap. A seed is used once per pupil and a challenge finishes
--    once. Finished challenges over 30 days old go.
-- 3. The switch (app_settings.tui_enabled, per class, ON to start for every class), the help setting
--    (app_settings.tui_help: 'fade', 'always' or 'off', 'fade' to start) and teacher_set_tui().
-- 4. The hub: hub_games hooks, one achievement per Golden Nest (one for each friend), the teacher's class and student
--    lines. No points. Not a season game: days are counted, not dates, so New Season leaves the tree as it is.
--
-- Pupils can't read or change any of it directly; the server function does everything. The maths records it reads come
-- from space_maths_context and its answers are saved with record_fact_answers.
-- Depends on 20261017001100_gem_keep.sql, 20261020000100_game_hooks.sql (gem_keep_check_player),
-- 20261018002400_classes_and_warp.sql (settings) and 20261105000500_next_part_chips.sql (day_fn).

create table public.tui_progress (
  player uuid primary key references public.profiles (id) on delete cascade,
  days_done integer not null default 0 check (days_done >= 0),
  last_flower_day date,
  step smallint not null default 1 check (step between 1 and 5),
  level smallint not null default 5 check (level between 0 and 5),
  good_in_row integer not null default 0 check (good_in_row >= 0),
  good_at_step integer not null default 0 check (good_at_step >= 0),
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now()
);

create table public.tui_rounds (
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
create unique index tui_rounds_seed on public.tui_rounds (player, seed);
create index tui_rounds_by_player on public.tui_rounds (player, started_at);

alter table public.tui_progress enable row level security;
alter table public.tui_rounds enable row level security;
revoke all on public.tui_progress, public.tui_rounds from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The server function's jobs (service role only)
-- ---------------------------------------------------------------------------

-- The pupil's tree and its version, or null if they've never played.
create function public.tui_load(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  return (select jsonb_build_object('daysDone', h.days_done, 'lastFlowerDay', to_char(h.last_flower_day, 'YYYY-MM-DD'),
                                    'step', h.step, 'level', h.level, 'goodInRow', h.good_in_row,
                                    'goodAtStep', h.good_at_step, 'version', h.version)
          from public.tui_progress h where h.player = tui_load.player);
end;
$$;

-- Keeps a new challenge (making the pupil's tree on their first go, at the round's step and help level) and closes any
-- other open one. False if the pupil has used this seed before.
create function public.tui_start(player uuid, seed bigint, round jsonb)
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
  if exists (select 1 from public.tui_rounds r where r.player = tui_start.player and r.seed = tui_start.seed) then
    return false;
  end if;
  insert into public.tui_progress (player, step, level)
  values (player, (round ->> 'step')::smallint, (round ->> 'level')::smallint)
  on conflict on constraint tui_progress_pkey do nothing;
  update public.tui_rounds r set open = false where r.player = tui_start.player and r.open;
  delete from public.tui_rounds r
  where r.player = tui_start.player and not r.open and r.started_at < now() - interval '30 days';
  insert into public.tui_rounds (player, seed, round) values (player, seed, round);
  return true;
end;
$$;

-- One of the pupil's challenges by its seed: { open, round }, or null if it isn't theirs.
create function public.tui_round(player uuid, seed bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('open', r.open, 'round', r.round)
  from public.tui_rounds r where r.player = tui_round.player and r.seed = tui_round.seed
$$;

-- Finishes an open challenge with the server's replay of its taps and saves the progress, together. The count of
-- finished days only ever stays or goes up by one. False if the challenge had already finished or the version moved on.
create function public.tui_finish(
  player uuid, seed bigint, version integer, days_done integer, last_flower_day date, step smallint, level smallint,
  good_in_row integer, good_at_step integer, taps jsonb, mistakes integer, first_right integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(taps) is distinct from 'array' or mistakes is null or mistakes < 0 or first_right is null or first_right < 0
     or days_done is null or step is null or step not between 1 and 5 or level is null or level not between 0 and 5
     or good_in_row is null or good_in_row < 0 or good_at_step is null or good_at_step < 0 then
    raise exception 'That challenge is not right.' using errcode = '22023';
  end if;
  perform 1 from public.tui_rounds r where r.player = tui_finish.player and r.seed = tui_finish.seed and r.open for update;
  if not found then
    return false;
  end if;
  update public.tui_progress h
  set days_done = tui_finish.days_done, last_flower_day = tui_finish.last_flower_day, step = tui_finish.step,
      level = tui_finish.level, good_in_row = tui_finish.good_in_row, good_at_step = tui_finish.good_at_step,
      version = h.version + 1, updated_at = now()
  where h.player = tui_finish.player and h.version = tui_finish.version
    and tui_finish.days_done between h.days_done and h.days_done + 1;
  if not found then
    return false;
  end if;
  update public.tui_rounds r
  set open = false, taps = tui_finish.taps, mistakes = tui_finish.mistakes, first_right = tui_finish.first_right,
      finished_at = now()
  where r.player = tui_finish.player and r.seed = tui_finish.seed;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- The switch and the help setting
-- ---------------------------------------------------------------------------

alter table public.app_settings add column tui_enabled boolean not null default true;
alter table public.app_settings add column tui_help text not null default 'fade' check (tui_help in ('fade', 'always', 'off'));

-- Either setting, or both (a null one is left as it is).
create function public.teacher_set_tui(enabled boolean default null, help text default null, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if (enabled is null and help is null) or (help is not null and help not in ('fade', 'always', 'off')) then
    raise exception 'Unknown Tūī''s Ten Tree setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings s
  set tui_enabled = coalesce(teacher_set_tui.enabled, s.tui_enabled),
      tui_help = coalesce(teacher_set_tui.help, s.tui_help)
  where s.id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.tui_load(uuid), public.tui_start(uuid, bigint, jsonb), public.tui_round(uuid, bigint),
  public.tui_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer),
  public.teacher_set_tui(boolean, text, uuid)
from public, anon, authenticated;
grant execute on function public.teacher_set_tui(boolean, text, uuid) to authenticated;
grant execute on function
  public.tui_load(uuid), public.tui_start(uuid, bigint, jsonb), public.tui_round(uuid, bigint),
  public.tui_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer)
to service_role;

-- ---------------------------------------------------------------------------
-- The hooks
-- ---------------------------------------------------------------------------

-- Golden Nests won: one for every 30 finished days.
create function public.tui_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('tui_nests', coalesce((select h.days_done / 30 from public.tui_progress h where h.player = who), 0))
$$;

-- The lines on How points work.
create function public.tui_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'No points: each Golden Nest is the prize, and an achievement.'))
$$;

-- Pupils with a tree (a rebuild gives their achievements back).
create function public.tui_players_list()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select h.player from public.tui_progress h
$$;

create function public.tui_last_played(player uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select h.updated_at from public.tui_progress h where h.player = tui_last_played.player
$$;

insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn, keep_achievements)
values ('tui', 'tui_enabled', 'public.tui_counts(uuid)', 'public.tui_point_rules()',
  'public.tui_players_list()', null, 'public.tui_last_played(uuid)', true);

-- The NZ day the pupil last changed a flower, for the home page's "next part" chip (20261105000500_next_part_chips.sql).
create function public.tui_last_day(who uuid)
returns date
language sql
stable
set search_path = ''
as $$
  select t.last_flower_day from public.tui_progress t where t.player = who
$$;
revoke execute on function public.tui_last_day(uuid) from public, anon, authenticated;
update public.hub_games set day_fn = 'public.tui_last_day(uuid)' where id = 'tui';

insert into public.achievement_measures (measure) values ('tui_nests');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('tui-tui', 'tui', 'Tūī’s Golden Nest', '🪺', 'tui_nests', 1, 1),
  ('tui-kereru', 'tui', 'Kererū’s Golden Nest', '🕊️', 'tui_nests', 2, 2),
  ('tui-piwakawaka', 'tui', 'Pīwakawaka’s Golden Nest', '🐦', 'tui_nests', 3, 3),
  ('tui-korimako', 'tui', 'Korimako’s Golden Nest', '🎶', 'tui_nests', 4, 4),
  ('tui-kaka', 'tui', 'Kākā’s Golden Nest', '🦜', 'tui_nests', 5, 5);

-- ---------------------------------------------------------------------------
-- The teacher's lines
-- ---------------------------------------------------------------------------

-- The teacher's Games table line for a class: how many of its pupils play, and the Golden Nests won between them.
create function public.teacher_tui_class(target_class uuid)
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
    select jsonb_build_object('players', count(*), 'nests', coalesce(sum(h.days_done / 30), 0))
    from public.tui_progress h
    join public.my_students() s(id) on s.id = h.player
    where exists (select 1 from public.class_members m where m.student_id = h.player and m.class_id = target_class));
end;
$$;

-- One line's worth for a student's page: finished days in all (the screens work out the flowers and Golden Nests), the NZ
-- day a flower last changed, the step and help level, when they last played, and the "ten and"
-- facts they find hardest (tried at least twice, not yet secure, fewest right first); or null.
create function public.teacher_tui_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return (select jsonb_build_object('daysDone', h.days_done, 'lastFlowerDay', to_char(h.last_flower_day, 'YYYY-MM-DD'),
                                    'step', h.step, 'level', h.level, 'lastPlayed', h.updated_at,
                                    'hardest', coalesce((
                                      select jsonb_agg(f.fact_key order by f.correct::numeric / f.attempts, f.fact_key)
                                      from (select g.fact_key, g.correct, g.attempts from public.gem_keep_facts g
                                            where g.player = student and g.pack = 'early-facts' and g.attempts >= 2 and g.box < 2
                                              and g.fact_key like 'tenand:%'
                                            order by g.correct::numeric / g.attempts, g.fact_key limit 3) f), '[]'::jsonb))
          from public.tui_progress h where h.player = student);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.tui_counts(uuid), public.tui_point_rules(), public.tui_players_list(), public.tui_last_played(uuid),
  public.teacher_tui_class(uuid), public.teacher_tui_student(uuid)
from public, anon, authenticated;
grant execute on function public.teacher_tui_class(uuid), public.teacher_tui_student(uuid) to authenticated;
