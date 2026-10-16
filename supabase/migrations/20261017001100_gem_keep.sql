-- Stage 11 Phase 5: Gem Keep joins the hub properly. Progress follows the student between
-- devices, levels earn points, there's a "most stars" leaderboard, and teachers get settings,
-- a times-table grid for each student and the class's hardest facts.
--
-- 1. Tables: gem_keep_runs (one row per finished level, won or lost), gem_keep_progress (best
--    stars and Level Keys per level), gem_keep_facts (times-table mastery: learning data) and
--    gem_keep_imports (whose class-trial progress has been brought in). Students can't read or
--    write any of them directly: they read their own through my_gem_keep(), and only the
--    gem-keep server function writes (through the record_gem_keep_* functions below).
-- 2. Teacher settings: new columns on app_settings, changed through teacher_set_gem_keep().
-- 3. Saving, for the server only: a run, a Level Key, fact records, and a one-off import of
--    the progress kept on a device during the class trial.
-- 4. Scoring: a won level earns 2 + its stars (3, 4 or 5), a lost one that got to wave 3 earns
--    1, inside the same 40-a-day cap as bot games. Seven achievements, mostly for Level Keys
--    and stars. Never ratings or badges.
-- 5. Reading: my_gem_keep(), gem_keep_leaderboard() (most stars, never maths accuracy).
-- 6. Teachers: teacher_gem_keep_student() (levels + 12 x 12 grid), teacher_gem_keep_class()
--    (hardest facts). A new season clears Gem Keep too (James, 16 Oct 2026).
--
-- The numbers are in docs/gem-keep/PROGRESS.md, Phase 5.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table public.gem_keep_runs (
  id uuid primary key default gen_random_uuid(),
  player uuid not null references public.profiles (id) on delete cascade,
  -- Made by the browser when the level starts, so a save sent twice is only kept once.
  run_id uuid not null,
  level_id text not null check (level_id ~ '^[a-z0-9-]{1,40}$'),
  level_number integer not null check (level_number between 1 and 50),
  result text not null check (result in ('won', 'lost')),
  stars integer not null check (stars between 0 and 3),
  -- Waves started, and how many the level has.
  waves integer not null check (waves >= 0),
  waves_total integer not null check (waves_total between 1 and 50),
  -- Seconds of play (game time, not counting pauses).
  game_seconds integer not null check (game_seconds >= 0),
  -- Every maths question in the level, and how many were right.
  asked integer not null check (asked >= 0),
  right_answers integer not null check (right_answers between 0 and asked),
  counts_for_points boolean not null,
  finished_at timestamptz not null default now(),
  check ((result = 'won') = (stars > 0)),
  unique (player, run_id)
);
create index gem_keep_runs_player on public.gem_keep_runs (player, finished_at desc);

create table public.gem_keep_progress (
  player uuid not null references public.profiles (id) on delete cascade,
  level_id text not null check (level_id ~ '^[a-z0-9-]{1,40}$'),
  best_stars integer not null default 0 check (best_stars between 0 and 3),
  -- A passed Level Key opens the next level.
  key_passed boolean not null default false,
  key_passed_at timestamptz,
  plays integer not null default 0,
  wins integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (player, level_id)
);

-- Times-table mastery (shared/maths/leitner.ts). Only what the grid and the question picker
-- need: no answers, no free text.
create table public.gem_keep_facts (
  player uuid not null references public.profiles (id) on delete cascade,
  pack text not null check (pack ~ '^[a-z0-9-]{1,30}$'),
  fact_key text not null check (fact_key ~ '^[a-z]{1,10}:[0-9x]{1,10}$'),
  attempts integer not null check (attempts >= 0),
  correct integer not null check (correct between 0 and attempts),
  avg_ms integer not null check (avg_ms >= 0),
  box integer not null check (box between 0 and 4),
  last_seen timestamptz,
  -- The last New Zealand days it was answered quickly and correctly.
  quick_days date[] not null default '{}' check (cardinality(quick_days) <= 5),
  updated_at timestamptz not null default now(),
  primary key (player, pack, fact_key)
);

-- Students whose class-trial progress (kept on their device, 16-17 Oct 2026) was brought in.
-- It only ever happens once each, and not after a new season.
create table public.gem_keep_imports (
  player uuid primary key references public.profiles (id) on delete cascade,
  imported_at timestamptz not null default now()
);

alter table public.gem_keep_runs enable row level security;
alter table public.gem_keep_progress enable row level security;
alter table public.gem_keep_facts enable row level security;
alter table public.gem_keep_imports enable row level security;
revoke all on public.gem_keep_runs, public.gem_keep_progress, public.gem_keep_facts, public.gem_keep_imports
from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Teacher settings (school-wide: the hub has no classes)
-- ---------------------------------------------------------------------------

alter table public.app_settings
  add column gem_keep_mode text not null default 'calm' check (gem_keep_mode in ('calm', 'challenge')),
  -- Tables left on. The campaign picks the tables; this can only switch some off.
  add column gem_keep_tables integer[] not null default '{1,2,3,4,5,6,7,8,9,10,11,12}'
    check (gem_keep_tables <@ '{1,2,3,4,5,6,7,8,9,10,11,12}'),
  add column gem_keep_division boolean not null default false,
  -- Null: missing-number questions (? x 8 = 56) start at level 4.
  add column gem_keep_missing_factor boolean,
  add column gem_keep_multiple_choice boolean not null default false,
  add column gem_keep_key_pass integer not null default 8 check (gem_keep_key_pass between 5 and 10);

create function public.gem_keep_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'mode', s.gem_keep_mode,
    'enabledTables', to_jsonb(s.gem_keep_tables),
    'division', s.gem_keep_division,
    'missingFactor', s.gem_keep_missing_factor,
    'multipleChoice', s.gem_keep_multiple_choice,
    'keyPassMark', s.gem_keep_key_pass)
  from public.app_settings s
$$;

create function public.teacher_set_gem_keep(settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tables integer[];
begin
  perform public.require_teacher();
  if jsonb_typeof(settings) is distinct from 'object'
     or settings ->> 'mode' not in ('calm', 'challenge')
     or jsonb_typeof(settings -> 'enabledTables') is distinct from 'array'
     or jsonb_typeof(settings -> 'division') is distinct from 'boolean'
     or coalesce(jsonb_typeof(settings -> 'missingFactor'), 'null') not in ('boolean', 'null')
     or jsonb_typeof(settings -> 'multipleChoice') is distinct from 'boolean'
     or jsonb_typeof(settings -> 'keyPassMark') is distinct from 'number' then
    raise exception 'Those settings couldn''t be read.' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct t::integer order by t::integer), '{}') into tables
  from jsonb_array_elements_text(settings -> 'enabledTables') as t
  where t ~ '^[0-9]{1,2}$';
  if cardinality(tables) <> jsonb_array_length(settings -> 'enabledTables')
     or not tables <@ '{1,2,3,4,5,6,7,8,9,10,11,12}' then
    raise exception 'Those times tables couldn''t be read.' using errcode = '22023';
  end if;
  if cardinality(tables) = 0 then
    raise exception 'Leave at least one times table on.' using errcode = '22023';
  end if;
  if (settings ->> 'keyPassMark') !~ '^[0-9]{1,2}$' or (settings ->> 'keyPassMark')::integer not between 5 and 10 then
    raise exception 'The Level Key pass mark must be between 5 and 10.' using errcode = '22023';
  end if;
  update public.app_settings set
    gem_keep_mode = settings ->> 'mode',
    gem_keep_tables = tables,
    gem_keep_division = (settings ->> 'division')::boolean,
    gem_keep_missing_factor = (settings ->> 'missingFactor')::boolean,
    gem_keep_multiple_choice = (settings ->> 'multipleChoice')::boolean,
    gem_keep_key_pass = (settings ->> 'keyPassMark')::integer
  where id;
  return public.gem_keep_settings();
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. The rules (here so the saving functions below can use them)
-- ---------------------------------------------------------------------------

-- A won level: 2 + its stars. A lost level that reached this wave: 1. Shares the bot cap.
create function public.gem_keep_points(result text, stars integer) returns integer language sql immutable
set search_path = '' as $$ select case when result = 'won' then 2 + greatest(least(stars, 3), 1) else 1 end $$;
create function public.gem_keep_min_waves_for_loss() returns integer language sql immutable set search_path = ''
as $$ select 3 $$;

-- ---------------------------------------------------------------------------
-- 3. Saving (server only: the gem-keep function checks the run first)
-- ---------------------------------------------------------------------------

create function public.gem_keep_check_player(who uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p join auth.users u on u.id = p.id
    where p.id = who and public.is_school_email(u.email)
  ) then
    raise exception 'No such player.' using errcode = '22023';
  end if;
end;
$$;

-- One finished level. `run` = { runId, levelId, levelNumber, afterLevel (the level before's
-- id, or null for level 1), result, stars, waves, wavesTotal, gameSeconds, asked, right }.
-- Returns { status: 'saved' | 'duplicate' | 'locked', points }.
create function public.record_gem_keep_run(player uuid, run jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  is_won boolean := run ->> 'result' = 'won';
begin
  perform public.gem_keep_check_player(player);
  select r.id into new_id from public.gem_keep_runs r
  where r.player = record_gem_keep_run.player and r.run_id = (run ->> 'runId')::uuid;
  if new_id is not null then
    return jsonb_build_object('status', 'duplicate',
      'points', (select s.points from public.scored_games s where s.gem_keep_run = new_id));
  end if;
  if (select count(*) from public.gem_keep_runs r
      where r.player = record_gem_keep_run.player and r.finished_at > now() - interval '1 day') >= 100 then
    raise exception 'That''s a lot of levels today! Have a break and come back tomorrow.' using errcode = '54000';
  end if;
  -- A level opens when the Level Key of the one before is passed.
  if run ->> 'afterLevel' is not null and not exists (
    select 1 from public.gem_keep_progress g
    where g.player = record_gem_keep_run.player and g.level_id = run ->> 'afterLevel' and g.key_passed
  ) then
    return jsonb_build_object('status', 'locked', 'points', null);
  end if;
  begin
    insert into public.gem_keep_runs (player, run_id, level_id, level_number, result, stars, waves, waves_total,
      game_seconds, asked, right_answers, counts_for_points)
    values (player, (run ->> 'runId')::uuid, run ->> 'levelId', (run ->> 'levelNumber')::integer, run ->> 'result',
      (run ->> 'stars')::integer, (run ->> 'waves')::integer, (run ->> 'wavesTotal')::integer,
      (run ->> 'gameSeconds')::integer, (run ->> 'asked')::integer, (run ->> 'right')::integer,
      is_won or (run ->> 'waves')::integer >= public.gem_keep_min_waves_for_loss())
    returning id into new_id;
  exception when unique_violation then
    -- Two copies arrived at the same moment and the other one got there first.
    return jsonb_build_object('status', 'duplicate', 'points', null);
  end;
  insert into public.gem_keep_progress as g (player, level_id, best_stars, plays, wins)
  values (player, run ->> 'levelId', (run ->> 'stars')::integer, 1, case when is_won then 1 else 0 end)
  on conflict on constraint gem_keep_progress_pkey do update set
    best_stars = greatest(g.best_stars, excluded.best_stars),
    plays = g.plays + 1,
    wins = g.wins + excluded.wins,
    updated_at = now();
  -- Scored by the trigger on gem_keep_runs; now award what the new best stars earned.
  perform public.award_achievements(player, 'gem-keep', now());
  return jsonb_build_object('status', 'saved',
    'points', (select s.points from public.scored_games s where s.gem_keep_run = new_id));
end;
$$;

-- A Level Key round: `right` out of 10. Only counts after a win on that level. The pass mark
-- is the teacher's setting, read here, not the browser's word.
-- Returns 'passed', 'already', 'not-passed' or 'no-win'.
create function public.record_gem_keep_key(player uuid, level_id text, right_answers integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  was public.gem_keep_progress;
begin
  perform public.gem_keep_check_player(player);
  select * into was from public.gem_keep_progress g
  where g.player = record_gem_keep_key.player and g.level_id = record_gem_keep_key.level_id
  for update;
  if not found or was.wins = 0 then
    return 'no-win';
  end if;
  if was.key_passed then
    return 'already';
  end if;
  if right_answers < (select s.gem_keep_key_pass from public.app_settings s) then
    return 'not-passed';
  end if;
  update public.gem_keep_progress g set key_passed = true, key_passed_at = now(), updated_at = now()
  where g.player = record_gem_keep_key.player and g.level_id = record_gem_keep_key.level_id;
  perform public.award_achievements(player, 'gem-keep', now());
  return 'passed';
end;
$$;

-- The student's fact records, as the browser has them now. A record only replaces the saved
-- one if it has more answers in it, so an old tab or a second device can't wind it back.
-- `facts` = [{ key, attempts, correct, avgMs, box, lastSeen (ms), quickDays }]. Returns how many changed.
create function public.record_gem_keep_facts(player uuid, pack text, facts jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  perform public.gem_keep_check_player(player);
  insert into public.gem_keep_facts as f (player, pack, fact_key, attempts, correct, avg_ms, box, last_seen, quick_days)
  select record_gem_keep_facts.player, record_gem_keep_facts.pack, x.key, x.attempts, x.correct, x."avgMs", x.box,
         case when x."lastSeen" > 0 then to_timestamp(x."lastSeen" / 1000.0) end,
         coalesce(x."quickDays", '{}')
  from jsonb_to_recordset(facts) as x(key text, attempts integer, correct integer, "avgMs" integer, box integer,
    "lastSeen" bigint, "quickDays" date[])
  on conflict on constraint gem_keep_facts_pkey do update set
    attempts = excluded.attempts, correct = excluded.correct, avg_ms = excluded.avg_ms, box = excluded.box,
    last_seen = excluded.last_seen, quick_days = excluded.quick_days, updated_at = now()
  where excluded.attempts > f.attempts;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

-- The class trial kept progress on each device. The first time a student opens the saving
-- version, what their device had is brought in: once, only if they have no saved progress
-- yet, and it earns no points by itself. `levels` = [{ levelId, stars, keyPassed }], already
-- checked by the gem-keep function (keys only in order). Returns 'imported' or 'skipped'.
create function public.import_gem_keep_progress(player uuid, levels jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if exists (select 1 from public.gem_keep_imports i where i.player = import_gem_keep_progress.player)
     or exists (select 1 from public.gem_keep_progress g where g.player = import_gem_keep_progress.player) then
    return 'skipped';
  end if;
  insert into public.gem_keep_imports (player) values (player) on conflict do nothing;
  insert into public.gem_keep_progress (player, level_id, best_stars, key_passed, key_passed_at, plays, wins)
  select player, x."levelId", x.stars, x."keyPassed", case when x."keyPassed" then now() end,
         case when x.stars > 0 then 1 else 0 end, case when x.stars > 0 then 1 else 0 end
  from jsonb_to_recordset(levels) as x("levelId" text, stars integer, "keyPassed" boolean)
  where x.stars > 0;
  return 'imported';
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Scoring
-- ---------------------------------------------------------------------------

alter table public.scored_games drop constraint scored_games_game_check;
alter table public.scored_games add constraint scored_games_game_check
  check (game in ('chess', 'checkers', 'space', '101', 'gem-keep'));
alter table public.scored_games drop constraint scored_games_kind_check;
alter table public.scored_games add constraint scored_games_kind_check check (kind in ('bot', 'friend', 'solo'));
alter table public.scored_games add column gem_keep_run uuid references public.gem_keep_runs (id) on delete cascade;
alter table public.scored_games drop constraint scored_games_check;
alter table public.scored_games add constraint scored_games_check check (
  num_nonnulls(bot_game, mp_game, space_game, card_game, gem_keep_run) = 1
  and (kind = 'bot') = (bot_game is not null)
  and (kind = 'friend') = (mp_game is not null or space_game is not null or card_game is not null)
  and (kind = 'solo') = (gem_keep_run is not null));
create unique index scored_games_gem_keep on public.scored_games (player, gem_keep_run) where gem_keep_run is not null;
create index scored_games_gem_keep_run on public.scored_games (gem_keep_run);

alter table public.achievement_types drop constraint achievement_types_game_check;
alter table public.achievement_types add constraint achievement_types_game_check
  check (game in ('chess', 'checkers', 'space', '101', 'gem-keep'));
alter table public.achievement_types drop constraint achievement_types_measure_check;
alter table public.achievement_types add constraint achievement_types_measure_check
  check (measure in ('games', 'wins', 'beat_very_easy', 'beat_easy', 'beat_medium', 'friend_wins', 'rank',
    'checkmates', 'crowns', 'friend_games', 'wormholes', 'blocks', 'star_kinds', 'docks',
    'zero_hands', 'triples', 'knock_wins', 'saved_by_three',
    'levels_won', 'level_keys', 'three_star_levels', 'stars'));

-- Same as Stage 10.3, except Gem Keep levels share the daily cap.
create or replace function public.score_bot_game(g public.bot_games)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  day date := public.nz_day(g.finished_at);
  earned_today integer;
begin
  if not g.counts_for_points then
    return;
  end if;
  -- Every bot game shares one daily cap, space, 101 and Gem Keep included.
  select coalesce(sum(s.points), 0) into earned_today
  from public.scored_games s
  where s.player = g.player and s.kind in ('bot', 'solo') and s.nz_day = day;

  insert into public.scored_games (player, game, kind, bot_game, bot_level, result, reason, crowns, points, finished_at,
    nz_day, space, card101)
  values (
    g.player, g.game, 'bot', g.id, g.bot_level, g.result, g.reason,
    case when g.game = 'checkers' then public.checkers_crowns(g.moves, g.player_side) else 0 end,
    least(
      case when g.game = 'space' then public.space_bot_points() else public.bot_points(g.bot_level, g.result) end,
      greatest(public.bot_daily_cap() - earned_today, 0)),
    g.finished_at, day,
    case when g.game = 'space' then g.space -> 'stats' end,
    case when g.game = '101' then g.card101 -> 'stats' end
  )
  on conflict do nothing;

  perform public.award_achievements(g.player, g.game, g.finished_at);
end;
$$;

create function public.score_gem_keep_run(r public.gem_keep_runs)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  day date := public.nz_day(r.finished_at);
  earned_today integer;
begin
  if not r.counts_for_points then
    return;
  end if;
  select coalesce(sum(s.points), 0) into earned_today
  from public.scored_games s
  where s.player = r.player and s.kind in ('bot', 'solo') and s.nz_day = day;
  insert into public.scored_games (player, game, kind, gem_keep_run, result, reason, points, finished_at, nz_day)
  values (r.player, 'gem-keep', 'solo', r.id, r.result, r.level_id,
    least(public.gem_keep_points(r.result, r.stars), greatest(public.bot_daily_cap() - earned_today, 0)),
    r.finished_at, day)
  on conflict do nothing;
end;
$$;

create function public.score_gem_keep_run_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.score_gem_keep_run(new);
  return null;
exception when others then
  -- Never lose a level because scoring went wrong. rebuild_progress() can fix scores later.
  raise warning 'scoring a Gem Keep level failed (%)', sqlstate;
  return null;
end;
$$;

create trigger score_when_saved
after insert on public.gem_keep_runs
for each row
execute function public.score_gem_keep_run_trigger();

-- Same as Stage 10.3, with Gem Keep's counts (read from the student's campaign progress).
create or replace function public.progress_counts(who uuid, which_game text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'games', count(*),
    'wins', count(*) filter (where s.result = 'won'),
    'beat_very_easy', count(*) filter (where s.result = 'won' and s.bot_level = 'very-easy'),
    'beat_easy', count(*) filter (where s.result = 'won' and s.bot_level = 'easy'),
    'beat_medium', count(*) filter (where s.result = 'won' and s.bot_level = 'medium'),
    'friend_wins', count(*) filter (where s.result = 'won' and s.kind = 'friend'),
    'checkmates', count(*) filter (where s.result = 'won' and s.reason = 'checkmate'),
    'crowns', coalesce(sum(s.crowns), 0),
    'rank', coalesce((select r.best_rank from public.ratings r where r.player = who and r.game = which_game), 0),
    'friend_games', count(*) filter (where s.kind = 'friend'),
    'wormholes', coalesce(sum((s.space ->> 'wormholes')::integer), 0),
    'blocks', coalesce(sum((s.space ->> 'blocks')::integer), 0),
    'docks', count(*) filter (where (s.space ->> 'docked')::boolean),
    'star_kinds', (select count(distinct star) from public.scored_games s2,
                     jsonb_array_elements_text(coalesce(s2.space -> 'stars', '[]')) as star
                   where s2.player = who and s2.game = which_game),
    'zero_hands', coalesce(sum((s.card101 ->> 'zeroHands')::integer), 0),
    'triples', coalesce(sum((s.card101 ->> 'triples')::integer), 0),
    'knock_wins', coalesce(sum((s.card101 ->> 'knockWins')::integer), 0),
    'saved_by_three', coalesce(sum((s.card101 ->> 'savedByThree')::integer), 0),
    'levels_won', (select count(*) from public.gem_keep_progress g where g.player = who and g.wins > 0),
    'level_keys', (select count(*) from public.gem_keep_progress g where g.player = who and g.key_passed),
    'three_star_levels', (select count(*) from public.gem_keep_progress g where g.player = who and g.best_stars = 3),
    'stars', (select coalesce(sum(g.best_stars), 0) from public.gem_keep_progress g where g.player = who)
  )
  from public.scored_games s
  where s.player = who and s.game = which_game
$$;

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('gk-first-win', 'gem-keep', 'Win your first level', '🏰', 'levels_won', 1, 1),
  ('gk-first-key', 'gem-keep', 'Pass a Level Key', '🗝️', 'level_keys', 1, 2),
  ('gk-three-stars', 'gem-keep', '3 stars on a level', '⭐', 'three_star_levels', 1, 3),
  ('gk-five-keys', 'gem-keep', 'Pass 5 Level Keys', '🔑', 'level_keys', 5, 4),
  ('gk-fifteen-stars', 'gem-keep', 'Collect 15 stars', '🌟', 'stars', 15, 5),
  ('gk-all-keys', 'gem-keep', 'Pass all 10 Level Keys', '👑', 'level_keys', 10, 6),
  ('gk-all-stars', 'gem-keep', 'All 30 stars', '💎', 'stars', 30, 7);

-- Same as Stage 10.3, with Gem Keep's numbers.
create or replace function public.progress_rules()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'bot', (select jsonb_object_agg(level, jsonb_build_object(
              'lost', public.bot_points(level, 'lost'),
              'drawn', public.bot_points(level, 'drawn'),
              'won', public.bot_points(level, 'won')))
            from unnest(array['very-easy', 'easy', 'medium']) as level),
    'friend', jsonb_build_object('lost', public.friend_points('lost'), 'drawn', public.friend_points('drawn'),
              'won', public.friend_points('won')),
    'space', jsonb_build_object('bot', public.space_bot_points(), 'friend', public.space_friend_points(),
              'friendDailyGames', public.space_friend_daily_games(), 'minTurns', 5),
    'card101', jsonb_build_object('friendLost', public.card101_friend_points('lost'),
              'friendWon', public.card101_friend_points('won'),
              'friendDailyGames', public.card101_friend_daily_games(), 'minRounds', public.card101_min_rounds()),
    'gemKeep', jsonb_build_object(
              'won', jsonb_build_array(public.gem_keep_points('won', 1), public.gem_keep_points('won', 2),
                public.gem_keep_points('won', 3)),
              'lost', public.gem_keep_points('lost', 0), 'minWavesForLoss', public.gem_keep_min_waves_for_loss()),
    'botDailyCap', public.bot_daily_cap(),
    'pairDailyLimit', public.pair_daily_limit(),
    'achievementPoints', public.achievement_points(),
    'levels', (select jsonb_agg(public.level_start(l) order by l) from generate_series(1, 10) as l),
    'ratingK', public.rating_k(),
    'weeklyMinGames', 3,
    'allTimeMinGames', 5,
    'improvedMinGames', 3,
    'championMinGames', 15
  )
  where public.is_school_user()
$$;

-- Same as Stage 10.4, with Gem Keep levels too.
create or replace function public.rebuild_progress()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item record;
begin
  delete from public.achievements;
  delete from public.scored_games;
  delete from public.ratings;
  for item in
    select 'bot' as kind, b.id, b.finished_at from public.bot_games b where b.counts_for_points
    union all
    select 'friend', m.id, m.finished_at from public.mp_games m where m.status = 'finished' and m.counts_for_points
    union all
    select 'space', s.id, s.finished_at from public.space_games s where s.status = 'finished' and true = any (s.counts)
    union all
    select 'card', c.id, c.finished_at from public.card_games c where c.status = 'finished' and true = any (c.counts)
    union all
    select 'gem', r.id, r.finished_at from public.gem_keep_runs r where r.counts_for_points
    order by finished_at, id
  loop
    if item.kind = 'bot' then
      perform public.score_bot_game(b) from public.bot_games b where b.id = item.id;
    elsif item.kind = 'friend' then
      perform public.score_friend_game(m) from public.mp_games m where m.id = item.id;
    elsif item.kind = 'space' then
      perform public.score_space_game(s) from public.space_games s where s.id = item.id;
    elsif item.kind = 'card' then
      perform public.score_card_game(c) from public.card_games c where c.id = item.id;
    else
      perform public.score_gem_keep_run(r) from public.gem_keep_runs r where r.id = item.id;
    end if;
  end loop;
  -- Gem Keep achievements come from campaign progress, which a rebuild doesn't touch.
  perform public.award_achievements(g.player, 'gem-keep', now())
  from (select distinct player from public.gem_keep_progress) g;
  return jsonb_build_object(
    'scored_games', (select count(*) from public.scored_games),
    'achievements', (select count(*) from public.achievements),
    'ratings', (select count(*) from public.ratings)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Reading
-- ---------------------------------------------------------------------------

-- Everything Gem Keep needs when it opens: the student's progress and fact records, the
-- teacher's settings, and whether trial progress may still be brought in.
create function public.my_gem_keep()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id where public.is_school_user())
  select jsonb_build_object(
    'progress', (select coalesce(jsonb_agg(jsonb_build_object(
        'levelId', g.level_id, 'stars', g.best_stars, 'keyPassed', g.key_passed) order by g.level_id), '[]')
      from public.gem_keep_progress g where g.player = me.id),
    'facts', (select coalesce(jsonb_agg(jsonb_build_object(
        'key', f.fact_key, 'attempts', f.attempts, 'correct', f.correct, 'avgMs', f.avg_ms, 'box', f.box,
        'lastSeen', coalesce((extract(epoch from f.last_seen) * 1000)::bigint, 0),
        'quickDays', to_jsonb(f.quick_days::text[]))), '[]')
      from public.gem_keep_facts f where f.player = me.id and f.pack = 'times-tables'),
    'settings', public.gem_keep_settings(),
    'canImport', not exists (select 1 from public.gem_keep_imports i where i.player = me.id)
      and not exists (select 1 from public.gem_keep_progress g where g.player = me.id)
  )
  from me
$$;

-- Most stars across the campaign (best stars per level, so replaying doesn't pad it).
-- Names, avatars, stars and Level Keys only: never maths accuracy. Top 10, plus your own line.
create function public.gem_keep_leaderboard()
returns table (
  place integer,
  display_name text,
  avatar jsonb,
  stars integer,
  level_keys integer,
  is_me boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_school_user() then
    return;
  end if;
  return query
  with totals as (
    select p.id, p.display_name, p.avatar,
           coalesce(sum(g.best_stars), 0)::integer as stars,
           (count(*) filter (where g.key_passed))::integer as level_keys
    from public.profiles p
    join public.gem_keep_progress g on g.player = p.id
    where not p.hidden
    group by p.id
  ),
  placed as (
    select t.*, rank() over (order by t.stars desc)::integer as place,
           row_number() over (order by t.stars desc, t.level_keys desc, t.display_name) as row_order
    from totals t where t.stars > 0
  )
  select pl.place, pl.display_name, pl.avatar, pl.stars, pl.level_keys, pl.id = auth.uid()
  from placed pl
  where pl.row_order <= 10 or pl.id = auth.uid()
  order by pl.row_order;
end;
$$;

-- Same as Stage 10.4, except Recent games' "+5" can point at a Gem Keep level too.
create or replace function public.my_progress()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id where public.is_school_user()),
  totals as (select public.points_total(me.id) as points from me),
  week as (select public.nz_week_start(now()) as start)
  select jsonb_build_object(
    'points', t.points,
    'level', public.level_for(t.points),
    'levelStart', public.level_start(public.level_for(t.points)),
    'nextLevelAt', public.level_start(public.level_for(t.points) + 1),
    'weekPoints', (select coalesce(sum(s.points), 0) from public.scored_games s, week
                   where s.player = me.id and s.finished_at >= week.start)
                + public.achievement_points() * (select count(*) from public.achievements a, week
                   where a.player = me.id and a.earned_at >= week.start),
    'games', (select jsonb_agg(jsonb_build_object(
                'game', g,
                'rank', public.rank_progress(coalesce(r.rating, public.start_rating()), coalesce(r.rated_games, 0)),
                'weekRatingChange', (select sum(s.rating_change) from public.scored_games s, week
                   where s.player = me.id and s.game = g and s.rated and s.finished_at >= week.start)
              ) order by g)
              from unnest(array['chess', 'checkers']) as g
              left join public.ratings r on r.player = me.id and r.game = g),
    'achievements', (select jsonb_agg(jsonb_build_object(
                'id', at.id, 'game', at.game, 'name', at.name, 'emoji', at.emoji, 'measure', at.measure,
                'goal', at.goal,
                'progress', least((public.progress_counts(me.id, at.game) ->> at.measure)::integer, at.goal),
                'earnedAt', a.earned_at
              ) order by at.game, at.sort)
              from public.achievement_types at
              left join public.achievements a on a.player = me.id and a.achievement = at.id),
    'recent', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', coalesce(x.bot_game, x.mp_game, x.space_game, x.card_game, x.gem_keep_run), 'points', x.points)), '[]')
               from (select s.bot_game, s.mp_game, s.space_game, s.card_game, s.gem_keep_run, s.points
                     from public.scored_games s
                     where s.player = me.id order by s.finished_at desc limit 20) x)
  )
  from me, totals t
$$;

-- ---------------------------------------------------------------------------
-- 6. Teachers
-- ---------------------------------------------------------------------------

-- One student's Gem Keep: each level's best stars and Level Key, and every fact record (the
-- page draws the 12 x 12 grid from these).
create function public.teacher_gem_keep_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  return jsonb_build_object(
    'levels', (select coalesce(jsonb_agg(jsonb_build_object(
        'levelId', g.level_id, 'stars', g.best_stars, 'keyPassed', g.key_passed, 'plays', g.plays, 'wins', g.wins)
        order by g.level_id), '[]')
      from public.gem_keep_progress g where g.player = student),
    'facts', (select coalesce(jsonb_agg(jsonb_build_object(
        'key', f.fact_key, 'attempts', f.attempts, 'correct', f.correct, 'avgMs', f.avg_ms, 'box', f.box,
        'lastSeen', coalesce((extract(epoch from f.last_seen) * 1000)::bigint, 0),
        'quickDays', to_jsonb(f.quick_days::text[]))), '[]')
      from public.gem_keep_facts f where f.player = student and f.pack = 'times-tables'),
    'lastPlayed', (select max(r.finished_at) from public.gem_keep_runs r where r.player = student)
  );
end;
$$;

-- The whole school's students (not teachers): how many play, how far they've got, and the
-- 10 facts most often answered wrongly (asked at least 6 times, to at least 2 students).
create function public.teacher_gem_keep_class()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  return (
    with students as (select p.id from public.profiles p where p.role = 'student')
    select jsonb_build_object(
      'players', (select count(distinct g.player) from public.gem_keep_progress g join students s on s.id = g.player),
      'levels', (select coalesce(jsonb_agg(jsonb_build_object('levelId', x.level_id, 'won', x.won, 'keys', x.keys)
          order by x.level_id), '[]')
        from (select g.level_id, count(*) filter (where g.wins > 0) as won, count(*) filter (where g.key_passed) as keys
              from public.gem_keep_progress g join students s on s.id = g.player group by g.level_id) x),
      'hardest', (select coalesce(jsonb_agg(jsonb_build_object(
          'key', x.fact_key, 'students', x.students, 'attempts', x.attempts, 'correct', x.correct)
          order by x.wrong_share desc, x.attempts desc), '[]')
        from (select f.fact_key, count(*) as students, sum(f.attempts) as attempts, sum(f.correct) as correct,
                     1 - sum(f.correct)::numeric / sum(f.attempts) as wrong_share
              from public.gem_keep_facts f join students s on s.id = f.player
              where f.pack = 'times-tables' and f.attempts > 0
              group by f.fact_key
              having sum(f.attempts) >= 6 and count(*) >= 2 and sum(f.correct) < sum(f.attempts)
              order by wrong_share desc, attempts desc
              limit 10) x)
    )
  );
end;
$$;

-- Same as Stage 10.4 (with real names), counting Gem Keep levels as games against the computer.
drop function public.teacher_students();

create function public.teacher_students()
returns table (
  id uuid,
  display_name text,
  real_name text,
  avatar jsonb,
  role text,
  hidden boolean,
  bot_games integer,
  friend_games integer,
  points integer,
  last_played timestamptz,
  joined timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  return query
  select p.id, p.display_name, split_part(u.email, '@', 1)::text, p.avatar, p.role, p.hidden,
         (select count(*)::integer from public.bot_games b where b.player = p.id)
         + (select count(*)::integer from public.gem_keep_runs r where r.player = p.id),
         (select count(*)::integer from public.mp_games m
          where m.status = 'finished' and p.id in (m.first_player, m.second_player))
         + (select count(*)::integer from public.space_games s
          where s.status = 'finished' and p.id in (s.seat1, s.seat2, s.seat3, s.seat4))
         + (select count(*)::integer from public.card_games c
          where c.status = 'finished' and p.id in (c.seat1, c.seat2, c.seat3, c.seat4)),
         public.points_total(p.id),
         greatest(
           (select max(b.finished_at) from public.bot_games b where b.player = p.id),
           (select max(m.finished_at) from public.mp_games m
            where m.status = 'finished' and p.id in (m.first_player, m.second_player)),
           (select max(s.finished_at) from public.space_games s
            where s.status = 'finished' and p.id in (s.seat1, s.seat2, s.seat3, s.seat4)),
           (select max(c.finished_at) from public.card_games c
            where c.status = 'finished' and p.id in (c.seat1, c.seat2, c.seat3, c.seat4)),
           (select max(r.finished_at) from public.gem_keep_runs r where r.player = p.id)),
         p.created_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  order by p.role desc, split_part(u.email, '@', 1), p.display_name;
end;
$$;

-- Same as Stage 10.4, clearing Gem Keep too: levels, campaign progress and times-table
-- records (James, 16 Oct 2026). The import list stays, so old trial progress can't come back.
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
  gem_count integer;
begin
  perform public.require_teacher();
  if confirm is distinct from 'NEW SEASON' then
    raise exception 'Type NEW SEASON to start a new season.' using errcode = '22023';
  end if;
  delete from public.achievements where true;
  delete from public.scored_games where true;
  delete from public.ratings where true;
  delete from public.bot_games where true;
  get diagnostics bot_count = row_count;
  delete from public.mp_games where status in ('finished', 'cancelled', 'expired');
  get diagnostics friend_count = row_count;
  -- A finished game a newer one points at (a rematch) goes too; the link just empties.
  delete from public.space_games where status in ('finished', 'cancelled', 'expired');
  get diagnostics space_count = row_count;
  delete from public.card_games where status in ('finished', 'cancelled', 'expired');
  get diagnostics card_count = row_count;
  delete from public.gem_keep_runs where true;
  get diagnostics gem_count = row_count;
  delete from public.gem_keep_progress where true;
  delete from public.gem_keep_facts where true;
  return jsonb_build_object('botGames', bot_count, 'friendGames', friend_count + space_count + card_count,
    'gemKeepLevels', gem_count);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.gem_keep_settings(), public.teacher_set_gem_keep(jsonb), public.gem_keep_points(text, integer),
  public.gem_keep_min_waves_for_loss(), public.gem_keep_check_player(uuid), public.record_gem_keep_run(uuid, jsonb),
  public.record_gem_keep_key(uuid, text, integer), public.record_gem_keep_facts(uuid, text, jsonb),
  public.import_gem_keep_progress(uuid, jsonb), public.score_gem_keep_run(public.gem_keep_runs),
  public.score_gem_keep_run_trigger(), public.my_gem_keep(), public.gem_keep_leaderboard(),
  public.teacher_gem_keep_student(uuid), public.teacher_gem_keep_class(), public.teacher_students()
from public, anon, authenticated;
grant execute on function
  public.my_gem_keep(), public.gem_keep_leaderboard(), public.teacher_set_gem_keep(jsonb),
  public.teacher_gem_keep_student(uuid), public.teacher_gem_keep_class(), public.teacher_students()
to authenticated;
grant execute on function
  public.record_gem_keep_run(uuid, jsonb), public.record_gem_keep_key(uuid, text, integer),
  public.record_gem_keep_facts(uuid, text, jsonb), public.import_gem_keep_progress(uuid, jsonb)
to service_role;
