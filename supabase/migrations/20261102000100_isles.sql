-- Sky Isles, stage S.2: the server side (docs/ISLES-PLAN.md, section 8).
--
-- Sky Isles is its own thing: its own tables and functions, prefixed isles_, so no other game reads or changes an
-- island. Points, the teacher's switch, How points work, achievements, the teacher's "last played" and New Season all go
-- through the hub_games hooks; nothing shared is re-created. Every table is closed to pupils (row security on, no
-- policy, no grant): only the `isles` server function (the server key) writes them, so a pupil can never change their
-- own island, questions or races. Pupils read through my_isles() (their own island) and isles_sky() (their class's).
--
-- 1. The teacher's switches on app_settings, per class: isles_enabled (OFF to start) and isles_races (on);
--    teacher_set_isles().
-- 2. isles_islands: one island a pupil (the rules are shared/isles/engine.ts), the seed its turns are rolled from, and
--    a version so two tabs can't overwrite each other. A New Season empties the island and keeps the row (the guide
--    stays done).
-- 3. isles_turns: one row a turn played (a turn sent twice is kept once), with what was chosen and what happened.
-- 4. isles_questions: the stored maths questions (one for each turn, three for each race) and the answers marked so
--    far (a question is marked once). The browser only ever gets the questions without their answers.
-- 5. isles_races: Sky Races, one open at a time per pupil, each finished once.
-- 6. The server's functions (record_isles_...), the pupils' two reading functions, the hooks, measures and achievements,
--    and who can call what.
--
-- Not here yet: friendship ropes, the class market's moving prices, the news board (stage S.4), the Sky Keeper
-- portrait, island names and the Hall of the Skies (stages S.3 and S.6). They can be added to this file while it is
-- still on hold (supabase/migrations-on-hold.txt), or in a migration of their own.
--
-- Depends on 20261020000100_game_hooks.sql.

-- ---------------------------------------------------------------------------
-- The teacher's switches
-- ---------------------------------------------------------------------------

alter table public.app_settings add column isles_enabled boolean not null default false;
alter table public.app_settings add column isles_races boolean not null default true;

create function public.teacher_set_isles(enabled boolean, races boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null or races is null then
    raise exception 'Unknown Sky Isles setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings set isles_enabled = enabled, isles_races = races
  where id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables (closed to pupils)
-- ---------------------------------------------------------------------------

create table public.isles_islands (
  player uuid primary key references public.profiles (id) on delete cascade,
  school_id integer references public.schools (id) on delete set null,
  season integer not null default 1,
  -- The seed this season's turns are rolled from (never sent to the browser).
  seed text not null check (seed ~ '^[a-f0-9]{16,64}$'),
  -- Goes up by one with every save; a save made from an older version is refused.
  version integer not null default 1,
  -- The New Zealand day (days since 1970) the island was last saved on.
  day integer not null,
  -- The island (shared/isles/engine.ts, `Island`): a few KB. Null after a New Season, until the next load makes one.
  island jsonb check (island is null or (jsonb_typeof(island) = 'object' and pg_column_size(island) < 20000)),
  guide_done boolean not null default false,
  -- The pupil's Sky Keeper portrait (KEEPERS in shared/isles/config.ts: b01 to b20, g01 to g20), kept through New Season.
  keeper text check (keeper is null or keeper ~ '^[bg](0[1-9]|1[0-9]|20)$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index isles_islands_by_school on public.isles_islands (school_id);

create table public.isles_turns (
  player uuid not null references public.profiles (id) on delete cascade,
  season integer not null,
  turn integer not null check (turn >= 0),
  day integer not null,
  -- The sky pilot's question was answered right this turn.
  windy boolean not null,
  actions jsonb not null check (jsonb_typeof(actions) = 'array'),
  report jsonb not null check (jsonb_typeof(report) = 'object'),
  -- Happiness at the end of the turn (for the Happy Isle achievement).
  happiness integer not null check (happiness between 0 and 100),
  created_at timestamptz not null default now(),
  primary key (player, season, turn)
);

create table public.isles_questions (
  -- Random: what the browser sends back. Always looked up with the pupil's own id as well.
  id text primary key check (id ~ '^[a-f0-9]{16,64}$'),
  player uuid not null references public.profiles (id) on delete cascade,
  -- 'turn:<island seed>:<turn>' or 'race:<race id>': one set each.
  ref text not null check (ref ~ '^(turn:[a-f0-9]{16,64}:[0-9]{1,6}|race:[0-9]{1,18})$'),
  questions jsonb not null check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) between 1 and 10),
  -- The answers marked so far: { "<slot>": { "value": n, "right": true } }.
  answered jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (player, ref)
);
create index isles_questions_by_age on public.isles_questions (created_at);

create table public.isles_races (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  season integer not null,
  seed text not null check (seed ~ '^[a-f0-9]{16,64}$'),
  -- 'gull-riders', or a classmate's id (stage S.4).
  opponent text not null check (opponent = 'gull-riders' or opponent ~ '^[0-9a-f-]{36}$'),
  starter boolean not null default false,
  -- What each boat brought, taken from the islands when the race started (shared/isles/race.ts, `Racer`).
  you jsonb not null check (jsonb_typeof(you) = 'object'),
  them jsonb not null check (jsonb_typeof(them) = 'object'),
  status text not null default 'open' check (status in ('open', 'done')),
  day integer not null,
  turn integer not null,
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  prize jsonb check (prize is null or jsonb_typeof(prize) = 'object'),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index isles_races_by_player on public.isles_races (player, season);
create unique index isles_races_one_open on public.isles_races (player) where status = 'open';

alter table public.isles_islands enable row level security;
alter table public.isles_turns enable row level security;
alter table public.isles_questions enable row level security;
alter table public.isles_races enable row level security;
revoke all on public.isles_islands, public.isles_turns, public.isles_questions, public.isles_races from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The server function's jobs (service role only)
-- ---------------------------------------------------------------------------

-- A race as the server function reads it.
create function public.isles_race_json(r public.isles_races)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('id', r.id, 'seed', r.seed, 'opponent', r.opponent, 'starter', r.starter, 'you', r.you, 'them', r.them,
    'status', r.status, 'result', r.result, 'prize', r.prize)
$$;

-- The pupil's island (null for a new pupil), the middle island size in their class (for the small-island extra chunk;
-- 0 with no class), their open race, and how many races they've finished this season.
create function public.isles_load(player uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'saved', (select jsonb_build_object('seed', i.seed, 'season', i.season, 'version', i.version, 'day', i.day, 'island', i.island,
                'guideDone', i.guide_done, 'keeper', i.keeper)
              from public.isles_islands i where i.player = isles_load.player),
    'classMiddle', coalesce((
      select percentile_disc(0.5) within group (order by jsonb_array_length(o.island -> 'spots'))
      from public.isles_islands o join public.class_members m on m.student_id = o.player
      where m.class_id = public.current_class_of(isles_load.player) and o.island is not null), 0),
    'openRace', (select public.isles_race_json(r) from public.isles_races r where r.player = isles_load.player and r.status = 'open'),
    'racesThisSeason', (select count(*) from public.isles_races r join public.isles_islands i on i.player = r.player
                        where r.player = isles_load.player and r.status = 'done' and r.season = i.season))
$$;

-- A new island, only if the pupil has none (or New Season emptied theirs). True if it was kept now.
create function public.record_isles_start(player uuid, seed text, island jsonb, day integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if jsonb_typeof(island) <> 'object' or (island ->> 'turn')::integer <> 0 then
    raise exception 'That island is not right.' using errcode = '22023';
  end if;
  insert into public.isles_islands (player, school_id, seed, island, day)
  values (player, (select p.school_id from public.profiles p where p.id = record_isles_start.player), seed, island, day)
  on conflict on constraint isles_islands_pkey do update
  set seed = excluded.seed, island = excluded.island, day = excluded.day, version = public.isles_islands.version + 1, updated_at = now()
  where public.isles_islands.island is null;
  return found;
end;
$$;

-- Keeps a turn the server function has played, only if the island is still at `expected_version` on turn `turn` (so a
-- turn sent twice is kept once). True if it was kept now.
create function public.record_isles_turn(
  player uuid, expected_version integer, island jsonb, day integer, turn integer, windy boolean, actions jsonb, report jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(island) <> 'object' or (island ->> 'turn')::integer <> turn + 1 or jsonb_typeof(actions) <> 'array'
     or jsonb_typeof(report) <> 'object' then
    raise exception 'That turn is not right.' using errcode = '22023';
  end if;
  update public.isles_islands i set
    island = record_isles_turn.island, day = record_isles_turn.day, version = i.version + 1, updated_at = now()
  where i.player = record_isles_turn.player and i.version = expected_version and i.island is not null
    and (i.island ->> 'turn')::integer = record_isles_turn.turn;
  if not found then
    return false;
  end if;
  insert into public.isles_turns (player, season, turn, day, windy, actions, report, happiness)
  select i.player, i.season, record_isles_turn.turn, record_isles_turn.day, windy, actions, report,
    least(100, greatest(0, (record_isles_turn.island ->> 'happiness')::integer))
  from public.isles_islands i where i.player = record_isles_turn.player
  on conflict do nothing;
  if not found then
    raise exception 'That turn was played already.' using errcode = '23505';
  end if;
  return true;
end;
$$;

-- Keeps a question set unless the pupil has one for this ref already (the first one wins, so two tabs can't swap
-- questions). Gives back the one kept. Sets more than two weeks old are thrown away.
create function public.record_isles_questions(player uuid, id text, ref text, questions jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  delete from public.isles_questions q where q.created_at < now() - interval '14 days';
  insert into public.isles_questions (id, player, ref, questions)
  values (record_isles_questions.id, player, record_isles_questions.ref, record_isles_questions.questions)
  on conflict do nothing;
  return (select jsonb_build_object('id', q.id, 'ref', q.ref, 'questions', q.questions, 'answered', q.answered)
          from public.isles_questions q where q.player = record_isles_questions.player and q.ref = record_isles_questions.ref);
end;
$$;

-- The pupil's own question set, by its id or its ref (null if there's none: another pupil's is never found).
create function public.isles_question_set(player uuid, id text, ref text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('id', q.id, 'ref', q.ref, 'questions', q.questions, 'answered', q.answered)
  from public.isles_questions q
  where q.player = isles_question_set.player and (q.id = isles_question_set.id or q.ref = isles_question_set.ref)
  limit 1
$$;

-- Marks one answer, once: the set must be the pupil's and the slot one of its questions not answered yet. True if it
-- was marked now.
create function public.record_isles_answer(player uuid, id text, slot integer, value numeric, right_answer boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.isles_questions q
  set answered = q.answered || jsonb_build_object(slot::text, jsonb_build_object('value', value, 'right', right_answer))
  where q.id = record_isles_answer.id and q.player = record_isles_answer.player
    and slot >= 0 and slot < jsonb_array_length(q.questions) and not q.answered ? slot::text;
  return found;
end;
$$;

-- A new open race. Its id, or null if the pupil already has a race open (one at a time).
create function public.record_isles_race_start(
  player uuid, seed text, opponent text, starter boolean, you jsonb, them jsonb, day integer, turn integer
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  perform public.gem_keep_check_player(player);
  insert into public.isles_races (player, season, seed, opponent, starter, you, them, day, turn)
  select i.player, i.season, record_isles_race_start.seed, record_isles_race_start.opponent, record_isles_race_start.starter,
    record_isles_race_start.you, record_isles_race_start.them, record_isles_race_start.day, record_isles_race_start.turn
  from public.isles_islands i where i.player = record_isles_race_start.player and i.island is not null
  -- One open race a pupil (isles_races_one_open): a second is not kept.
  on conflict do nothing
  returning id into new_id;
  return new_id;
end;
$$;

-- The pupil's own race (null if it isn't theirs).
create function public.isles_race(player uuid, race bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.isles_race_json(r) from public.isles_races r where r.id = isles_race.race and r.player = isles_race.player
$$;

-- Finishes an open race and keeps the island after it, only if the island is still at `expected_version`. True if it
-- was kept now (false: the island moved on, or the race was already finished).
create function public.record_isles_race_finish(
  player uuid, race bigint, expected_version integer, island jsonb, day integer, result jsonb, prize jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(island) <> 'object' or jsonb_typeof(result) <> 'object' or jsonb_typeof(prize) <> 'object' then
    raise exception 'That race is not right.' using errcode = '22023';
  end if;
  perform 1 from public.isles_races r
  where r.id = record_isles_race_finish.race and r.player = record_isles_race_finish.player and r.status = 'open'
  for update;
  if not found then
    return false;
  end if;
  update public.isles_islands i set
    island = record_isles_race_finish.island, day = record_isles_race_finish.day, version = i.version + 1, updated_at = now()
  where i.player = record_isles_race_finish.player and i.version = expected_version and i.island is not null;
  if not found then
    return false;
  end if;
  update public.isles_races r set status = 'done', result = record_isles_race_finish.result, prize = record_isles_race_finish.prize,
    finished_at = now()
  where r.id = record_isles_race_finish.race and r.player = record_isles_race_finish.player;
  return true;
end;
$$;

-- The guided first go is finished (or skipped). It stays finished through a New Season.
create function public.record_isles_guide_done(player uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  update public.isles_islands i set guide_done = true where i.player = record_isles_guide_done.player returning true
$$;

-- The pupil's Sky Keeper portrait (only an id from the list: the column's check refuses anything else). It stays
-- through a New Season. False if the pupil has no island row yet.
create function public.record_isles_keeper(player uuid, keeper text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with saved as (
    update public.isles_islands i set keeper = record_isles_keeper.keeper, updated_at = now()
    where i.player = record_isles_keeper.player returning 1
  )
  select exists (select 1 from saved)
$$;

-- ---------------------------------------------------------------------------
-- What pupils can read
-- ---------------------------------------------------------------------------

-- The signed-in pupil's own island as last saved (the server function's load rolls it to today). Never the seed.
create function public.my_isles()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('island', i.island, 'day', i.day, 'season', i.season, 'guideDone', i.guide_done, 'keeper', i.keeper)
  from public.isles_islands i where i.player = auth.uid() and public.is_school_user()
$$;

-- The islands in the signed-in pupil's class (own school, pupils only, hidden profiles left out apart from their own):
-- name, building spots, Lighthouse stages, and whether it's in its calm start (fewer than CALM_TURNS = 12 turns played,
-- shared/isles/config.ts). Never anything about maths.
create function public.isles_sky()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.display_name, 'keeper', i.keeper, 'spots', jsonb_array_length(i.island -> 'spots'),
      'lighthouse', (i.island ->> 'lighthouse')::integer, 'calm', (i.island ->> 'turn')::integer < 12, 'me', p.id = auth.uid())
    order by p.display_name), '[]'::jsonb)
  from public.isles_islands i
  join public.profiles p on p.id = i.player
  join public.class_members m on m.student_id = i.player
  where public.is_school_user()
    and m.class_id = public.current_class_of(auth.uid())
    and p.school_id = public.my_school()
    and p.role = 'student'
    and (not p.hidden or p.id = auth.uid())
    and i.island is not null
$$;

-- ---------------------------------------------------------------------------
-- The hooks (docs/GAME_DEVELOPMENT_GUIDE.md, section 5)
-- ---------------------------------------------------------------------------

-- A pupil's counts for the achievements, from this season's island (achievements already earned stay through a New
-- Season). Chunks anchored are the spots past the 6 a new island starts with (START.spots in shared/isles/config.ts);
-- Grand Isle is 16 spots (GRAND_ISLE) and a lit Lighthouse is all 4 stages. A happy day is a day with at least 3 turns
-- played, every one ending at happiness 90 or more.
create function public.isles_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'isles_chunks', coalesce(greatest(0, jsonb_array_length(i.island -> 'spots') - 6), 0),
    'isles_farms', coalesce((select count(*) from jsonb_array_elements(i.island -> 'spots') s where s ->> 'kind' = 'farm'), 0),
    'isles_happy_days', coalesce((select count(*) from (
        select t.day from public.isles_turns t where t.player = who and t.season = i.season
        group by t.day having count(*) >= 3 and min(t.happiness) >= 90) d), 0),
    'isles_upgrades', coalesce(jsonb_array_length(i.island -> 'upgrades'), 0),
    'isles_races_won', coalesce((i.island ->> 'racesWon')::integer, 0),
    'isles_grand', case when jsonb_array_length(i.island -> 'spots') >= 16 then 1 else 0 end,
    'isles_lighthouses', case when (i.island ->> 'lighthouse')::integer >= 4 then 1 else 0 end)
  from (select who) w left join public.isles_islands i on i.player = w.who
$$;

-- The lines on How points work (the numbers are POINTS in shared/isles/server.ts).
create function public.isles_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'Each turn you play: 1 point.',
    'Win a Sky Race: 2 points.',
    'Grow your island to a Grand Isle (16 building spots): 10 points.',
    'Each stage of the Sky Lighthouse: 5 points.'))
$$;

-- Pupils with Sky Isles progress outside points (a rebuild gives their achievements back).
create function public.isles_players()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select i.player from public.isles_islands i where i.island is not null
$$;

-- What a New Season clears (the game's points always go): the island, its turns, questions and races. The row stays,
-- so the guide stays done; the next load makes a fresh island with a new seed.
create function public.isles_season(players uuid[])
returns void
language sql
set search_path = ''
as $$
  with a as (delete from public.isles_turns where player = any (players)),
  b as (delete from public.isles_questions where player = any (players)),
  c as (delete from public.isles_races where player = any (players))
  update public.isles_islands i set island = null, season = i.season + 1, version = i.version + 1, updated_at = now()
  where i.player = any (players)
$$;

create function public.isles_last_played(player uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select max(t.created_at) from public.isles_turns t where t.player = isles_last_played.player
$$;

insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn, keep_achievements)
values ('isles', 'isles_enabled', 'public.isles_counts(uuid)', 'public.isles_point_rules()', 'public.isles_players()',
  'public.isles_season(uuid[])', 'public.isles_last_played(uuid)', true);

insert into public.achievement_measures (measure) values
  ('isles_chunks'), ('isles_farms'), ('isles_happy_days'), ('isles_upgrades'), ('isles_races_won'), ('isles_grand'), ('isles_lighthouses');

-- docs/ISLES-PLAN.md, section 6.5. True Friend (a friendship rope kept for 7 days) comes with the ropes in stage S.4.
insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('isles-first-anchor', 'isles', 'First Anchor', '⚓', 'isles_chunks', 1, 1),
  ('isles-green-thumbs', 'isles', 'Green Thumbs', '🌾', 'isles_farms', 5, 2),
  ('isles-happy-isle', 'isles', 'Happy Isle', '😊', 'isles_happy_days', 1, 3),
  ('isles-bookworm', 'isles', 'Bookworm', '📚', 'isles_upgrades', 4, 4),
  ('isles-race-winner', 'isles', 'Race Winner', '⛵', 'isles_races_won', 1, 5),
  ('isles-grand-isle', 'isles', 'Grand Isle', '🏝️', 'isles_grand', 1, 6),
  ('isles-lighthouse-keeper', 'isles', 'Lighthouse Keeper', '🗼', 'isles_lighthouses', 1, 7);

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.teacher_set_isles(boolean, boolean, uuid),
  public.isles_race_json(public.isles_races), public.isles_load(uuid), public.record_isles_start(uuid, text, jsonb, integer),
  public.record_isles_turn(uuid, integer, jsonb, integer, integer, boolean, jsonb, jsonb),
  public.record_isles_questions(uuid, text, text, jsonb), public.isles_question_set(uuid, text, text),
  public.record_isles_answer(uuid, text, integer, numeric, boolean),
  public.record_isles_race_start(uuid, text, text, boolean, jsonb, jsonb, integer, integer), public.isles_race(uuid, bigint),
  public.record_isles_race_finish(uuid, bigint, integer, jsonb, integer, jsonb, jsonb), public.record_isles_guide_done(uuid),
  public.record_isles_keeper(uuid, text), public.my_isles(), public.isles_sky(),
  public.isles_counts(uuid), public.isles_point_rules(), public.isles_players(), public.isles_season(uuid[]), public.isles_last_played(uuid)
from public, anon, authenticated;
grant execute on function public.teacher_set_isles(boolean, boolean, uuid), public.my_isles(), public.isles_sky() to authenticated;
grant execute on function
  public.isles_load(uuid), public.record_isles_start(uuid, text, jsonb, integer),
  public.record_isles_turn(uuid, integer, jsonb, integer, integer, boolean, jsonb, jsonb),
  public.record_isles_questions(uuid, text, text, jsonb), public.isles_question_set(uuid, text, text),
  public.record_isles_answer(uuid, text, integer, numeric, boolean),
  public.record_isles_race_start(uuid, text, text, boolean, jsonb, jsonb, integer, integer), public.isles_race(uuid, bigint),
  public.record_isles_race_finish(uuid, bigint, integer, jsonb, integer, jsonb, jsonb), public.record_isles_guide_done(uuid),
  public.record_isles_keeper(uuid, text)
to service_role;
