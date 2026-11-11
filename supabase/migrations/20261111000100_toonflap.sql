-- Toon Flap (the flappy-style maths game; id toonflap): the server side and the hub (docs/TOON-FLAP-PLAN.md, stage F.3).
-- Built the same way as Robin's Berry Basket (20261108000100_robin.sql).
--
-- Toon Flap is its own thing: two tables and its own functions, so no other game reads or changes them. Nothing shared is
-- re-created.
--
-- 1. toonflap_progress: one row a pupil. Their progress as shared/toonflap/collection.ts keeps it (levels finished, medals,
--    best times, checks right, the run of right checks, clean flights, revive potions) and their flyer and trail. Saved only
--    by the `toonflap` server function, and only if its version still matches.
-- 2. toonflap_runs: one row a run started. Its seed, level, Gentle wings and maths, and the questions as the server made them
--    (way A: pupils never see the answers), with the gap labels; the checks marked so far (each once); once finished, the
--    flaps, the time the server worked out by replaying them, the medal and what it earned. A seed is used once per pupil and
--    a run finishes once. Runs over 60 days old go.
-- 3. The switches (per class): app_settings.toonflap_enabled (OFF to start), toonflap_maths ('off', 'choose' or 'on'; 'on' to
--    start; anything but 'off' means maths), toonflap_read_time (pause at answer signs on levels 3 to 5; on to start), and
--    teacher_set_toonflap().
-- 4. The hub: hub_games hooks, achievements (levels, clean flights, tailwinds, golds, flyers) and points from the function
--    (add_game_points). Not a season game: New Season keeps levels, medals, flyers, trails and potions.
--
-- Pupils can't read or change any of it directly; the server function does everything. Their maths records come from
-- space_maths_context and their answers are saved with record_fact_answers (recordMathsAnswers).
-- Depends on 20261017001100_gem_keep.sql (gem_keep_check_player), 20261020000100_game_hooks.sql and
-- 20261018002400_classes_and_warp.sql (settings).

create table public.toonflap_progress (
  player uuid primary key references public.profiles (id) on delete cascade,
  progress jsonb not null check (jsonb_typeof(progress) = 'object'),
  picks jsonb not null default '{"flyer": "fantail", "trail": null}'::jsonb check (jsonb_typeof(picks) = 'object'),
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now()
);

create table public.toonflap_runs (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  seed text not null check (seed ~ '^[0-9]{6,18}$'),
  level text not null check (level ~ '^[a-z]{2,20}$'),
  gentle boolean not null default false,
  maths boolean not null default true,
  questions jsonb not null default '[]'::jsonb check (jsonb_typeof(questions) = 'array'),
  labels jsonb not null default '[]'::jsonb check (jsonb_typeof(labels) = 'array'),
  marks jsonb not null default '{}'::jsonb check (jsonb_typeof(marks) = 'object'),
  open boolean not null default true,
  started_at timestamptz not null default now(),
  started_day date not null default (now() at time zone 'Pacific/Auckland')::date,
  finished_at timestamptz,
  finished_day date,
  flaps text check (flaps is null or length(flaps) <= 40000),
  seconds numeric check (seconds is null or seconds >= 0),
  medal text check (medal is null or medal in ('gold', 'silver', 'bronze')),
  bumps integer check (bumps is null or bumps >= 0),
  checks_right integer check (checks_right is null or checks_right >= 0),
  gaps_right integer check (gaps_right is null or gaps_right >= 0),
  potion boolean
);
create unique index toonflap_runs_seed on public.toonflap_runs (player, seed);
create index toonflap_runs_by_player on public.toonflap_runs (player, started_at);

alter table public.toonflap_progress enable row level security;
alter table public.toonflap_runs enable row level security;
revoke all on public.toonflap_progress, public.toonflap_runs from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The server function's jobs (service role only)
-- ---------------------------------------------------------------------------

-- The pupil's progress, picks and version, or null if they've never played.
create function public.toonflap_load(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  return (select jsonb_build_object('progress', t.progress, 'picks', t.picks, 'version', t.version)
          from public.toonflap_progress t where t.player = toonflap_load.player);
end;
$$;

-- Runs the pupil started, and finished, on an NZ day.
create function public.toonflap_runs_today(player uuid, day date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'started', (select count(*) from public.toonflap_runs r where r.player = toonflap_runs_today.player and r.started_day = day),
    'finished', (select count(*) from public.toonflap_runs r where r.player = toonflap_runs_today.player and r.finished_day = day))
$$;

-- Keeps a new run and closes any other open one. False if the pupil has used this seed before.
create function public.toonflap_start(player uuid, seed text, level text, gentle boolean, maths boolean, questions jsonb, labels jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if jsonb_typeof(questions) is distinct from 'array' or jsonb_typeof(labels) is distinct from 'array'
     or gentle is null or maths is null then
    raise exception 'That run is not right.' using errcode = '22023';
  end if;
  if exists (select 1 from public.toonflap_runs r where r.player = toonflap_start.player and r.seed = toonflap_start.seed) then
    return false;
  end if;
  update public.toonflap_runs r set open = false where r.player = toonflap_start.player and r.open;
  delete from public.toonflap_runs r
  where r.player = toonflap_start.player and not r.open and r.started_at < now() - interval '60 days';
  insert into public.toonflap_runs (player, seed, level, gentle, maths, questions, labels)
  values (player, seed, level, gentle, maths, questions, labels);
  return true;
end;
$$;

-- One of the pupil's runs by its seed (with the questions and answers: the server function only), or null if it isn't theirs.
create function public.toonflap_run(player uuid, seed text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('level', r.level, 'gentle', r.gentle, 'maths', r.maths, 'questions', r.questions,
                            'labels', r.labels, 'marks', r.marks, 'open', r.open,
                            'startedAt', floor(extract(epoch from r.started_at) * 1000))
  from public.toonflap_runs r where r.player = toonflap_run.player and r.seed = toonflap_run.seed
$$;

-- Marks one check of an open run, once. False if that check was already marked or the run has finished.
create function public.toonflap_claim(player uuid, seed text, slot integer, right_answer boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if slot is null or slot < 0 or slot > 20 or right_answer is null then
    raise exception 'That answer is not right.' using errcode = '22023';
  end if;
  update public.toonflap_runs r
  set marks = r.marks || jsonb_build_object(slot::text, right_answer)
  where r.player = toonflap_claim.player and r.seed = toonflap_claim.seed and r.open and not (r.marks ? slot::text);
  return found;
end;
$$;

-- Finishes an open run with the server's replay of it and saves the pupil's new progress, together. False if the run had
-- already finished or the version moved on (a save sent twice counts once).
create function public.toonflap_finish(
  player uuid, seed text, version integer, progress jsonb, flaps text, seconds numeric, medal text, bumps integer,
  checks_right integer, gaps_right integer, potion boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(progress) is distinct from 'object' or flaps is null or seconds is null or seconds < 0
     or medal not in ('gold', 'silver', 'bronze') or bumps is null or bumps < 0 or checks_right is null or checks_right < 0
     or gaps_right is null or gaps_right < 0 or potion is null or version is null or version < 0 then
    raise exception 'That run is not right.' using errcode = '22023';
  end if;
  perform 1 from public.toonflap_runs r where r.player = toonflap_finish.player and r.seed = toonflap_finish.seed and r.open for update;
  if not found then
    return false;
  end if;
  if version = 0 then
    insert into public.toonflap_progress (player, progress) values (player, progress)
    on conflict on constraint toonflap_progress_pkey do nothing;
  else
    update public.toonflap_progress t
    set progress = toonflap_finish.progress, version = t.version + 1, updated_at = now()
    where t.player = toonflap_finish.player and t.version = toonflap_finish.version;
  end if;
  if not found then
    return false;
  end if;
  update public.toonflap_runs r
  set open = false, finished_at = now(), finished_day = (now() at time zone 'Pacific/Auckland')::date,
      flaps = toonflap_finish.flaps, seconds = toonflap_finish.seconds, medal = toonflap_finish.medal,
      bumps = toonflap_finish.bumps, checks_right = toonflap_finish.checks_right, gaps_right = toonflap_finish.gaps_right,
      potion = toonflap_finish.potion
  where r.player = toonflap_finish.player and r.seed = toonflap_finish.seed;
  return true;
end;
$$;

-- The flyer and trail the pupil flies with (the server function checks they're unlocked).
create function public.toonflap_save_picks(player uuid, picks jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if jsonb_typeof(picks) is distinct from 'object' or jsonb_typeof(picks -> 'flyer') is distinct from 'string' then
    raise exception 'That pick is not right.' using errcode = '22023';
  end if;
  insert into public.toonflap_progress (player, progress, picks)
  values (player, '{"levels": {}, "checksRight": 0, "streak": 0, "cleanFlights": 0, "rightGaps": 0, "potions": 0, "potionsEarned": 0}'::jsonb, picks)
  on conflict on constraint toonflap_progress_pkey do update set picks = excluded.picks;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- The switches
-- ---------------------------------------------------------------------------

alter table public.app_settings add column toonflap_enabled boolean not null default false;
alter table public.app_settings add column toonflap_maths text not null default 'on' check (toonflap_maths in ('off', 'choose', 'on'));
alter table public.app_settings add column toonflap_read_time boolean not null default true;

-- Any of the settings (a null one is left as it is).
create function public.teacher_set_toonflap(enabled boolean default null, maths text default null, read_time boolean default null, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if (enabled is null and maths is null and read_time is null) or (maths is not null and maths not in ('off', 'choose', 'on')) then
    raise exception 'Unknown Toon Flap setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings s
  set toonflap_enabled = coalesce(teacher_set_toonflap.enabled, s.toonflap_enabled),
      toonflap_maths = coalesce(teacher_set_toonflap.maths, s.toonflap_maths),
      toonflap_read_time = coalesce(teacher_set_toonflap.read_time, s.toonflap_read_time)
  where s.id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- The hooks
-- ---------------------------------------------------------------------------

-- Levels finished, clean flights, right answer gaps, golds and flyers unlocked (a level finished 3 times; the fantail
-- everyone has doesn't count).
create function public.toonflap_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'toonflap_levels', coalesce((select count(*) from public.toonflap_progress t, jsonb_each(t.progress -> 'levels') l(id, v)
                                 where t.player = who and coalesce((l.v ->> 'finishes')::int, 0) > 0), 0),
    'toonflap_clean', coalesce((select (t.progress ->> 'cleanFlights')::int from public.toonflap_progress t where t.player = who), 0),
    'toonflap_gaps', coalesce((select (t.progress ->> 'rightGaps')::int from public.toonflap_progress t where t.player = who), 0),
    'toonflap_golds', coalesce((select count(*) from public.toonflap_progress t, jsonb_each(t.progress -> 'levels') l(id, v)
                                where t.player = who and l.v ->> 'medal' = 'gold'), 0),
    'toonflap_flyers', coalesce((select count(*) from public.toonflap_progress t, jsonb_each(t.progress -> 'levels') l(id, v)
                                 where t.player = who and coalesce((l.v ->> 'finishes')::int, 0) >= 3), 0))
$$;

-- The lines on How points work.
create function public.toonflap_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'Finish a level: 2 points.',
    'Finish a level for the first time: 5 more.',
    'A new gold medal: 3 more.',
    'Only your first 10 finished flights each day earn points. Right answers earn no points: they take time off.'))
$$;

create function public.toonflap_players_list()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select t.player from public.toonflap_progress t
$$;

create function public.toonflap_last_played(player uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select max(r.started_at) from public.toonflap_runs r where r.player = toonflap_last_played.player
$$;

insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn, keep_achievements)
values ('toonflap', 'toonflap_enabled', 'public.toonflap_counts(uuid)', 'public.toonflap_point_rules()',
  'public.toonflap_players_list()', null, 'public.toonflap_last_played(uuid)', true);

insert into public.achievement_measures (measure)
values ('toonflap_levels'), ('toonflap_clean'), ('toonflap_gaps'), ('toonflap_golds'), ('toonflap_flyers');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('toonflap-first', 'toonflap', 'First Flight', '🐦', 'toonflap_levels', 1, 1),
  ('toonflap-fence', 'toonflap', 'Off the Fence', '🌻', 'toonflap_levels', 3, 2),
  ('toonflap-half', 'toonflap', 'Halfway Home', '🍩', 'toonflap_levels', 5, 3),
  ('toonflap-storm', 'toonflap', 'Storm Rider', '🌠', 'toonflap_levels', 10, 4),
  ('toonflap-clean', 'toonflap', 'Clean Flight', '✨', 'toonflap_clean', 1, 5),
  ('toonflap-tailwind', 'toonflap', 'Tailwind', '💨', 'toonflap_gaps', 20, 6),
  ('toonflap-gold5', 'toonflap', 'Gold Feathers', '🥇', 'toonflap_golds', 5, 7),
  ('toonflap-gold10', 'toonflap', 'All Gold', '🌈', 'toonflap_golds', 10, 8),
  ('toonflap-flyers5', 'toonflap', 'Flyer Collector', '🛩️', 'toonflap_flyers', 5, 9),
  ('toonflap-flyers10', 'toonflap', 'Full Hangar', '🚀', 'toonflap_flyers', 10, 10);

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.toonflap_load(uuid), public.toonflap_runs_today(uuid, date),
  public.toonflap_start(uuid, text, text, boolean, boolean, jsonb, jsonb), public.toonflap_run(uuid, text),
  public.toonflap_claim(uuid, text, integer, boolean),
  public.toonflap_finish(uuid, text, integer, jsonb, text, numeric, text, integer, integer, integer, boolean),
  public.toonflap_save_picks(uuid, jsonb), public.teacher_set_toonflap(boolean, text, boolean, uuid),
  public.toonflap_counts(uuid), public.toonflap_point_rules(), public.toonflap_players_list(), public.toonflap_last_played(uuid)
from public, anon, authenticated;
grant execute on function public.teacher_set_toonflap(boolean, text, boolean, uuid) to authenticated;
grant execute on function
  public.toonflap_load(uuid), public.toonflap_runs_today(uuid, date),
  public.toonflap_start(uuid, text, text, boolean, boolean, jsonb, jsonb), public.toonflap_run(uuid, text),
  public.toonflap_claim(uuid, text, integer, boolean),
  public.toonflap_finish(uuid, text, integer, jsonb, text, numeric, text, integer, integer, integer, boolean),
  public.toonflap_save_picks(uuid, jsonb)
to service_role;
