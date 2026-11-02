-- Diamond Drop: the server side (docs/DIAMOND-PLAN.md, sections 5 and 6).
--
-- Diamond Drop is its own thing: three tables and its own functions, so no other game reads or changes them. Points,
-- the teacher's switch, How points work, achievements, the teacher's "last played" and New Season all go through the
-- hub_games hooks; nothing shared is re-created.
--
-- 1. diamond_players: one row a pupil. Their progress as the shared rules keep it (shared/diamond/progress.ts, `Player`),
--    saved only by the `diamond` server function and only if its version still matches (so two tabs can't both spend
--    the same coins), and which season they're in (counted by New Season, for the Hall).
-- 2. diamond_levels: one row a level started. Its seed, boosts and Hold on! questions (which pupils can never read: no
--    policy, no grant), the marks so far, and once it has ended the Drop ticks and what the server's replay said.
--    A seed is used once per pupil, a slot is marked once and a level ends once. Ended levels over 30 days old go.
-- 3. diamond_finds: who caught the Heart Diamond, once a season each: the Hall of Diamond Finders, kept for good.
-- 4. The switch (app_settings.diamond_enabled, per class, OFF to start) and teacher_set_diamond().
-- 5. The hooks, measures and six achievements (kept through New Season).
-- 6. For pupils: diamond_hall(). For teachers: the class line, the student line, and starting one pupil again.
--
-- Depends on 20261020000100_game_hooks.sql.

create table public.diamond_players (
  player uuid primary key references public.profiles (id) on delete cascade,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  version integer not null default 1 check (version >= 1),
  -- 1, then one more at each New Season (and when a teacher starts the pupil again).
  season integer not null default 1 check (season >= 1),
  updated_at timestamptz not null default now()
);

create table public.diamond_levels (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  seed bigint not null check (seed between 0 and 4294967295),
  level integer not null check (level between 1 and 10),
  boosts text[] not null default '{}' check (boosts <@ array['strongWinch', 'luckyCharm', 'extraTime', 'rockBlaster']),
  starter boolean not null default false,
  questions jsonb not null check (jsonb_typeof(questions) = 'array'),
  -- One entry a question: null until answered, then true or false.
  marks jsonb not null check (jsonb_typeof(marks) = 'array'),
  open boolean not null default true,
  drops jsonb check (drops is null or jsonb_typeof(drops) = 'array'),
  finish integer check (finish >= 0),
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index diamond_levels_seed on public.diamond_levels (player, seed);
create index diamond_levels_by_player on public.diamond_levels (player, started_at);

create table public.diamond_finds (
  player uuid not null references public.profiles (id) on delete cascade,
  season integer not null,
  found_on date not null,
  primary key (player, season)
);

alter table public.diamond_players enable row level security;
alter table public.diamond_levels enable row level security;
alter table public.diamond_finds enable row level security;
revoke all on public.diamond_players, public.diamond_levels, public.diamond_finds from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The server function's jobs (service role only)
-- ---------------------------------------------------------------------------

-- The pupil's progress and its version, or null if they've never played.
create function public.diamond_load(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  return (select jsonb_build_object('player', d.state, 'version', d.version)
          from public.diamond_players d where d.player = diamond_load.player);
end;
$$;

-- Saves the progress if its version is still `version` (0: no row yet). True if it was saved.
create function public.diamond_keep(player uuid, version integer, state jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(state) is distinct from 'object' then
    raise exception 'That progress is not right.' using errcode = '22023';
  end if;
  if version = 0 then
    insert into public.diamond_players (player, state) values (player, state) on conflict do nothing;
  else
    update public.diamond_players d set state = diamond_keep.state, version = d.version + 1, updated_at = now()
    where d.player = diamond_keep.player and d.version = diamond_keep.version;
  end if;
  return found;
end;
$$;

-- Starts a level: saves the progress after paying for boosts (only if its version still matches), closes any other
-- open level and keeps this one. False if the version moved on or the pupil has used this seed before.
create function public.diamond_start(
  player uuid, version integer, state jsonb, seed bigint, level integer, boosts text[], starter boolean, questions jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if jsonb_typeof(questions) is distinct from 'array' or jsonb_array_length(questions) not between 1 and 8 then
    raise exception 'Those questions are not right.' using errcode = '22023';
  end if;
  if exists (select 1 from public.diamond_levels l where l.player = diamond_start.player and l.seed = diamond_start.seed) then
    return false;
  end if;
  if not public.diamond_keep(player, version, state) then
    return false;
  end if;
  update public.diamond_levels l set open = false where l.player = diamond_start.player and l.open;
  delete from public.diamond_levels l where l.player = diamond_start.player and not l.open and l.started_at < now() - interval '30 days';
  insert into public.diamond_levels (player, seed, level, boosts, starter, questions, marks)
  values (player, seed, level, boosts, starter, questions,
          (select jsonb_agg(null::boolean) from generate_series(1, jsonb_array_length(questions))));
  return true;
end;
$$;

-- One of the pupil's levels by its seed, with its questions and marks (the function sends only what to show), or null.
create function public.diamond_level(player uuid, seed bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('seed', l.seed, 'level', l.level, 'boosts', to_jsonb(l.boosts), 'starter', l.starter,
                            'questions', l.questions, 'marks', l.marks, 'open', l.open)
  from public.diamond_levels l where l.player = diamond_level.player and l.seed = diamond_level.seed
$$;

-- Marks one Hold on! answer, once: the level must be the pupil's and open, and the slot one of its questions not
-- answered yet. True if it was marked now.
create function public.diamond_answer(player uuid, seed bigint, slot integer, right_answer boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if right_answer is null then
    raise exception 'That mark is not right.' using errcode = '22023';
  end if;
  update public.diamond_levels l set marks = jsonb_set(l.marks, array[slot::text], to_jsonb(right_answer))
  where l.player = diamond_answer.player and l.seed = diamond_answer.seed and l.open
    and slot >= 0 and slot < jsonb_array_length(l.questions)
    and jsonb_typeof(l.marks -> slot) = 'null';
  return found;
end;
$$;

-- Ends an open level with what the server's replay said and saves the progress, together. A Heart Diamond caught
-- goes in the Hall (once a season). False if the level had already ended or the version moved on.
create function public.diamond_end(player uuid, seed bigint, version integer, state jsonb, drops jsonb, finish integer, result jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(drops) is distinct from 'array' or jsonb_typeof(result) is distinct from 'object' then
    raise exception 'That level is not right.' using errcode = '22023';
  end if;
  perform 1 from public.diamond_levels l where l.player = diamond_end.player and l.seed = diamond_end.seed and l.open for update;
  if not found or version < 1 or not public.diamond_keep(player, version, state) then
    return false;
  end if;
  update public.diamond_levels l set open = false, drops = diamond_end.drops, finish = diamond_end.finish,
    result = diamond_end.result, ended_at = now()
  where l.player = diamond_end.player and l.seed = diamond_end.seed;
  if (result ->> 'diamond')::boolean then
    insert into public.diamond_finds (player, season, found_on)
    select d.player, d.season, public.nz_day(now()) from public.diamond_players d where d.player = diamond_end.player
    on conflict do nothing;
  end if;
  return true;
end;
$$;

-- Saves the progress (the Workshop). False if the version moved on.
create function public.diamond_save(player uuid, version integer, state jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  return public.diamond_keep(player, version, state);
end;
$$;

-- ---------------------------------------------------------------------------
-- New Season (and a teacher starting one pupil again)
-- ---------------------------------------------------------------------------

-- Back to level 1 with no coins, stars or Gem Book; Workshop upgrades, what's worn, the totals for achievements and
-- the Hall stay (shared/diamond/progress.ts, `newSeason`). Their levels go.
create function public.diamond_season(players uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.diamond_players d set
    state = d.state || jsonb_build_object('deepest', 0, 'newLevelDate', null, 'coins', 0,
      'stars', '[0, 0, 0, 0, 0, 0, 0, 0, 0, 0]'::jsonb, 'gemBook', '{}'::jsonb, 'freeBoost', null),
    version = d.version + 1, season = d.season + 1, updated_at = now()
  where d.player = any (players);
  delete from public.diamond_levels l where l.player = any (players);
end;
$$;

-- A teacher starts one of their pupils again from level 1 (the same as New Season, for that pupil only).
create function public.teacher_diamond_restart(student uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  perform public.diamond_season(array[student]);
end;
$$;

-- ---------------------------------------------------------------------------
-- The switch
-- ---------------------------------------------------------------------------

alter table public.app_settings add column diamond_enabled boolean not null default false;

create function public.teacher_set_diamond(enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null then
    raise exception 'Unknown Diamond Drop setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings set diamond_enabled = enabled where id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- The hooks
-- ---------------------------------------------------------------------------

-- A pupil's counts for the achievements, from the totals kept for good (shared/diamond/progress.ts, `measures`).
create function public.diamond_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'diamond_gems', coalesce((d.state #>> '{lifetime,gems}')::integer, 0),
    'diamond_grips', coalesce((d.state #>> '{lifetime,grips}')::integer, 0),
    'diamond_level', coalesce((d.state #>> '{lifetime,bestLevel}')::integer, 0),
    'diamond_kinds', (select count(*) from jsonb_array_elements_text(coalesce(d.state #> '{lifetime,kinds}', '[]')) k where k <> 'heartDiamond'),
    'diamond_found', coalesce((d.state #>> '{lifetime,found}')::integer, 0),
    'diamond_stars', coalesce((d.state #>> '{lifetime,bestStars}')::integer, 0))
  from public.diamond_players d where d.player = who
$$;

-- The lines on How points work (the numbers are shared/diamond/config.ts: POINTS).
create function public.diamond_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'Pass a level for the first time: 2 points.',
    'Each new star on a level: 1 point.',
    'Catch the Heart Diamond for the first time: 5 points.',
    'Hold on! answers keep your gems, not points.'))
$$;

-- Pupils with Diamond Drop progress (a rebuild gives their achievements back).
create function public.diamond_players_list()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select d.player from public.diamond_players d
$$;

create function public.diamond_last_played(player uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select d.updated_at from public.diamond_players d where d.player = diamond_last_played.player
$$;

insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn, keep_achievements)
values ('diamond', 'diamond_enabled', 'public.diamond_counts(uuid)', 'public.diamond_point_rules()', 'public.diamond_players_list()',
  'public.diamond_season(uuid[])', 'public.diamond_last_played(uuid)', true);

insert into public.achievement_measures (measure) values
  ('diamond_gems'), ('diamond_grips'), ('diamond_level'), ('diamond_kinds'), ('diamond_found'), ('diamond_stars');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('diamond-first-catch', 'diamond', 'First Catch', '💎', 'diamond_gems', 1, 1),
  ('diamond-firm-grip', 'diamond', 'Firm Grip', '✊', 'diamond_grips', 10, 2),
  ('diamond-halfway', 'diamond', 'Halfway Down', '⛏️', 'diamond_level', 5, 3),
  ('diamond-collector', 'diamond', 'Gem Collector', '📖', 'diamond_kinds', 9, 4),
  ('diamond-finder', 'diamond', 'Diamond Finder', '💖', 'diamond_found', 1, 5),
  ('diamond-star-miner', 'diamond', 'Star Miner', '⭐', 'diamond_stars', 30, 6);

-- ---------------------------------------------------------------------------
-- The Hall, and the teacher's lines
-- ---------------------------------------------------------------------------

-- The Hall of Diamond Finders: pupils at the viewer's own school who caught the Heart Diamond, newest first, with the
-- claw they wear now. Display names only, never maths; hidden pupils only see themselves.
create function public.diamond_hall()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_school_user() then
    return '[]'::jsonb;
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
        'name', h.display_name, 'found', to_char(h.found_on, 'YYYY-MM-DD'), 'worn', h.worn, 'me', h.player = auth.uid())
        order by h.found_on desc, h.display_name), '[]')
    from (
      select f.player, p.display_name, f.found_on, coalesce(d.state -> 'worn', '{}') as worn
      from public.diamond_finds f
      join public.profiles p on p.id = f.player
      left join public.diamond_players d on d.player = f.player
      where p.school_id = public.my_school() and p.role = 'student' and (not p.hidden or f.player = auth.uid())
      order by f.found_on desc
      limit 60) h);
end;
$$;

-- The teacher's Games table line for a class: how many of its pupils play, are past level 5, and found the diamond.
create function public.teacher_diamond_class(target_class uuid)
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
    with players as (
      select d.state from public.diamond_players d
      join public.my_students() s(id) on s.id = d.player
      where exists (select 1 from public.class_members m where m.student_id = d.player and m.class_id = target_class))
    select jsonb_build_object(
      'players', count(*),
      'pastFive', count(*) filter (where coalesce((x.state ->> 'deepest')::integer, 0) >= 5),
      'found', count(*) filter (where coalesce((x.state #>> '{lifetime,found}')::integer, 0) > 0))
    from players x);
end;
$$;

-- One line's worth for a student's page: their deepest level this season and gem kinds found.
create function public.teacher_diamond_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return (
    select jsonb_build_object(
      'deepest', coalesce((d.state ->> 'deepest')::integer, 0),
      'kinds', (select count(*) from jsonb_object_keys(coalesce(d.state -> 'gemBook', '{}'))),
      'found', coalesce((d.state #>> '{lifetime,found}')::integer, 0))
    from public.diamond_players d where d.player = student);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.diamond_load(uuid), public.diamond_keep(uuid, integer, jsonb),
  public.diamond_start(uuid, integer, jsonb, bigint, integer, text[], boolean, jsonb),
  public.diamond_level(uuid, bigint), public.diamond_answer(uuid, bigint, integer, boolean),
  public.diamond_end(uuid, bigint, integer, jsonb, jsonb, integer, jsonb), public.diamond_save(uuid, integer, jsonb),
  public.diamond_season(uuid[]), public.teacher_diamond_restart(uuid), public.teacher_set_diamond(boolean, uuid),
  public.diamond_counts(uuid), public.diamond_point_rules(), public.diamond_players_list(), public.diamond_last_played(uuid),
  public.diamond_hall(), public.teacher_diamond_class(uuid), public.teacher_diamond_student(uuid)
from public, anon, authenticated;
grant execute on function
  public.teacher_set_diamond(boolean, uuid), public.teacher_diamond_restart(uuid), public.diamond_hall(),
  public.teacher_diamond_class(uuid), public.teacher_diamond_student(uuid)
to authenticated;
grant execute on function
  public.diamond_load(uuid), public.diamond_start(uuid, integer, jsonb, bigint, integer, text[], boolean, jsonb),
  public.diamond_level(uuid, bigint), public.diamond_answer(uuid, bigint, integer, boolean),
  public.diamond_end(uuid, bigint, integer, jsonb, jsonb, integer, jsonb), public.diamond_save(uuid, integer, jsonb)
to service_role;
