-- Glyph Gates (the equivalent fractions temple game; id glyph): the server side and the hub (docs/GLYPH-PLAN.md, stage 2).
-- Built the same way as Toon Flap (20261111000100_toonflap.sql).
--
-- 1. glyph_progress: one row a pupil. Their progress as shared/glyph/play.ts keeps it (temples passed, best first goes,
--    help level, walls opened, guide seen). Saved only by the `glyph` server function, and only if its version still matches.
--    my_glyph() gives a pupil their own.
-- 2. glyph_goes: one row a temple go started. Its seed (the server makes the nine walls from it again whenever it needs
--    them), temple and the help level at the start; once finished, the replayed result, the first goes and whether it passed.
--    A seed is used once per pupil and a go finishes once. Goes over 60 days old go.
-- 3. The switch (per class): app_settings.glyph_enabled (on to start; the code switch holds the game back).
-- 4. The hub: hub_games hooks, achievements (walls opened, temples passed) and points from the function (add_game_points).
--    Not a season game: New Season keeps temples passed.
-- Depends on 20261017001100_gem_keep.sql (gem_keep_check_player) and 20261020000100_game_hooks.sql.

create table public.glyph_progress (
  player uuid primary key references public.profiles (id) on delete cascade,
  progress jsonb not null check (jsonb_typeof(progress) = 'object'),
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now()
);

create table public.glyph_goes (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  temple smallint not null check (temple between 1 and 6),
  seed text not null check (seed ~ '^[0-9a-f]{16,32}$'),
  help integer not null default 0 check (help between 0 and 3),
  open boolean not null default true,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  finished_day date,
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  first_goes integer check (first_goes is null or first_goes between 0 and 9),
  passed boolean,
  walls integer check (walls is null or walls between 0 and 9)
);
create unique index glyph_goes_seed on public.glyph_goes (player, seed);
create index glyph_goes_by_player on public.glyph_goes (player, started_at);

alter table public.glyph_progress enable row level security;
alter table public.glyph_goes enable row level security;
revoke all on public.glyph_progress, public.glyph_goes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- A pupil's own progress
-- ---------------------------------------------------------------------------

-- The signed-in pupil's own progress (null if they've never played). Nobody else's.
create function public.my_glyph()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select g.progress from public.glyph_progress g where g.player = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- The server function's jobs (service role only)
-- ---------------------------------------------------------------------------

-- The pupil's progress and version, or null if they've never played.
create function public.glyph_load(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  return (select jsonb_build_object('progress', g.progress, 'version', g.version)
          from public.glyph_progress g where g.player = glyph_load.player);
end;
$$;

-- Keeps a new go and closes any other open one. False if the pupil has used this seed before.
create function public.glyph_start(player uuid, seed text, temple integer, help integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if temple is null or temple not between 1 and 6 or help is null or help not between 0 and 3
     or seed is null or seed !~ '^[0-9a-f]{16,32}$' then
    raise exception 'That go is not right.' using errcode = '22023';
  end if;
  if exists (select 1 from public.glyph_goes g where g.player = glyph_start.player and g.seed = glyph_start.seed) then
    return false;
  end if;
  update public.glyph_goes g set open = false where g.player = glyph_start.player and g.open;
  delete from public.glyph_goes g
  where g.player = glyph_start.player and not g.open and g.started_at < now() - interval '60 days';
  insert into public.glyph_goes (player, seed, temple, help) values (player, seed, temple, help);
  return true;
end;
$$;

-- One of the pupil's goes by its seed, or null if it isn't theirs.
create function public.glyph_go(player uuid, seed text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('temple', g.temple, 'open', g.open, 'help', g.help)
  from public.glyph_goes g where g.player = glyph_go.player and g.seed = glyph_go.seed
$$;

-- Whole temple goes (all nine walls) the pupil finished on an NZ day.
create function public.glyph_finished_today(player uuid, day date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.glyph_goes g
  where g.player = glyph_finished_today.player and g.finished_day = day and g.walls = 9
$$;

-- Finishes an open go with the server's replay of it and saves the pupil's new progress, together. False if the go had
-- already finished or the version moved on (a save sent twice counts once).
create function public.glyph_finish(
  player uuid, seed text, version integer, progress jsonb, result jsonb, first_goes integer, passed boolean, walls integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(progress) is distinct from 'object' or jsonb_typeof(result) is distinct from 'object'
     or first_goes is null or first_goes not between 0 and 9 or passed is null or walls is null or walls not between 0 and 9
     or version is null or version < 0 then
    raise exception 'That go is not right.' using errcode = '22023';
  end if;
  perform 1 from public.glyph_goes g where g.player = glyph_finish.player and g.seed = glyph_finish.seed and g.open for update;
  if not found then
    return false;
  end if;
  if version = 0 then
    insert into public.glyph_progress (player, progress) values (player, progress)
    on conflict on constraint glyph_progress_pkey do nothing;
  else
    update public.glyph_progress p
    set progress = glyph_finish.progress, version = p.version + 1, updated_at = now()
    where p.player = glyph_finish.player and p.version = glyph_finish.version;
  end if;
  if not found then
    return false;
  end if;
  update public.glyph_goes g
  set open = false, finished_at = now(), finished_day = (now() at time zone 'Pacific/Auckland')::date,
      result = glyph_finish.result, first_goes = glyph_finish.first_goes, passed = glyph_finish.passed, walls = glyph_finish.walls
  where g.player = glyph_finish.player and g.seed = glyph_finish.seed;
  return true;
end;
$$;

-- Saves the progress alone (the guide seen), if the version still matches.
create function public.glyph_save_progress(player uuid, version integer, progress jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if jsonb_typeof(progress) is distinct from 'object' or version is null or version < 0 then
    raise exception 'That progress is not right.' using errcode = '22023';
  end if;
  if version = 0 then
    insert into public.glyph_progress (player, progress) values (player, progress)
    on conflict on constraint glyph_progress_pkey do nothing;
  else
    update public.glyph_progress p
    set progress = glyph_save_progress.progress, version = p.version + 1, updated_at = now()
    where p.player = glyph_save_progress.player and p.version = glyph_save_progress.version;
  end if;
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- The switch
-- ---------------------------------------------------------------------------

alter table public.app_settings add column glyph_enabled boolean not null default true;

-- ---------------------------------------------------------------------------
-- The hooks
-- ---------------------------------------------------------------------------

-- Walls opened and the highest temple passed (the temple measure ends in _step, so the boards leave it out).
create function public.glyph_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'glyph_walls', coalesce((select (g.progress ->> 'walls')::int from public.glyph_progress g where g.player = who), 0),
    'glyph_temple_step', coalesce((select (g.progress ->> 'passed')::int from public.glyph_progress g where g.player = who), 0))
$$;

-- The lines on How points work.
create function public.glyph_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'Finish a temple: 2 points.',
    'Pass a temple (7 of 9 walls on the first go): 5 points.',
    'Only your first 4 finished temples each day earn points.'))
$$;

create function public.glyph_players_list()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select g.player from public.glyph_progress g
$$;

create function public.glyph_last_played(player uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select max(g.started_at) from public.glyph_goes g where g.player = glyph_last_played.player
$$;

-- The teacher's on/off switch for a class.
create function public.teacher_set_glyph(enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null then
    raise exception 'Unknown Glyph Gates setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings s
  set glyph_enabled = teacher_set_glyph.enabled
  where s.id in (select public.settings_to_change(target_class));
end;
$$;

insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn, keep_achievements)
values ('glyph', 'glyph_enabled', 'public.glyph_counts(uuid)', 'public.glyph_point_rules()',
  'public.glyph_players_list()', null, 'public.glyph_last_played(uuid)', true);

insert into public.achievement_measures (measure) values ('glyph_walls'), ('glyph_temple_step');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('glyph-first', 'glyph', 'First glyph', '🗝️', 'glyph_walls', 1, 1),
  ('glyph-breaker', 'glyph', 'Wall breaker', '🧱', 'glyph_walls', 50, 2),
  ('glyph-runner', 'glyph', 'Temple runner', '🏃', 'glyph_walls', 200, 3),
  ('glyph-temple1', 'glyph', 'Mossy Gate', '🌿', 'glyph_temple_step', 1, 4),
  ('glyph-temple2', 'glyph', 'Snake charmer', '🐍', 'glyph_temple_step', 2, 5),
  ('glyph-temple3', 'glyph', 'Shrine seeker', '💧', 'glyph_temple_step', 3, 6),
  ('glyph-temple4', 'glyph', 'Root climber', '🌳', 'glyph_temple_step', 4, 7),
  ('glyph-temple5', 'glyph', 'Bat dodger', '🦇', 'glyph_temple_step', 5, 8),
  ('glyph-temple6', 'glyph', 'Golden Sanctum', '🏆', 'glyph_temple_step', 6, 9);

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.my_glyph(), public.glyph_load(uuid), public.glyph_start(uuid, text, integer, integer), public.glyph_go(uuid, text),
  public.glyph_finished_today(uuid, date), public.glyph_finish(uuid, text, integer, jsonb, jsonb, integer, boolean, integer),
  public.glyph_save_progress(uuid, integer, jsonb),
  public.glyph_counts(uuid), public.glyph_point_rules(), public.glyph_players_list(), public.glyph_last_played(uuid),
  public.teacher_set_glyph(boolean, uuid)
from public, anon, authenticated;
grant execute on function public.my_glyph(), public.teacher_set_glyph(boolean, uuid) to authenticated;
grant execute on function
  public.glyph_load(uuid), public.glyph_start(uuid, text, integer, integer), public.glyph_go(uuid, text),
  public.glyph_finished_today(uuid, date), public.glyph_finish(uuid, text, integer, jsonb, jsonb, integer, boolean, integer),
  public.glyph_save_progress(uuid, integer, jsonb)
to service_role;
