-- Bonkers Quest (a wacky, streamlined Dragon Maths for Years 2 to 4; id bonkers): the server side and the hub
-- (docs/BONKERS-PLAN.md, stage B.1). Built the same way as Toon Flap (20261111000100_toonflap.sql).
--
-- Bonkers Quest is its own thing: two tables and its own functions, so no other game reads or changes them. Of the shared
-- functions only teacher_set_unlimited_today (one more game in its list) and teacher_progress_other_games (one more block)
-- are re-created, each from its newest body.
--
-- 1. bonkers_progress: one row a pupil. Their hero (class kept all season, and look), level, stars on the bar, gear,
--    chests, stickers, adventures saved up and their counts, as shared/bonkers/engine.ts keeps them. Saved only by the
--    `bonkers` server function, and only if its version still matches.
-- 2. bonkers_adventures: one row an adventure started. Its seed, quest, fights, and the questions as the server made them
--    (way A: pupils never see the answers); the marks so far (each once, in order, with the special move if used); once
--    finished, what it came to. One open at a time; a seed is used once per pupil. Adventures over 60 days old go.
-- 3. The switch (per class): app_settings.bonkers_enabled, on for every class to start (a new game's switch starts on:
--    James, 11 Nov 2026; the code switch in src/games/bonkers/switch.ts keeps it from pupils until stage B.5), and
--    teacher_set_bonkers().
-- 4. The hub: hub_games hooks, the counts for stage B.2's achievements, and points from the function (add_game_points).
-- 5. "Unlimited today" for Bonkers Quest, and its column on the teacher's Progress tab (hero level).
--
-- Pupils can't read or change any of it directly; the server function does everything. Their maths records come from
-- space_maths_context and their answers are saved with record_fact_answers (recordMathsAnswers).

create table public.bonkers_progress (
  player uuid primary key references public.profiles (id) on delete cascade,
  progress jsonb not null check (jsonb_typeof(progress) = 'object'),
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now()
);

create table public.bonkers_adventures (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  seed text not null check (seed ~ '^[0-9]{6,18}$'),
  quest text not null check (quest ~ '^[a-z]{2,20}:[a-z]{2,10}:[0-9]:[0-9]$'),
  adventure jsonb not null check (jsonb_typeof(adventure) = 'object'),
  questions jsonb not null check (jsonb_typeof(questions) = 'array'),
  marks jsonb not null default '[]'::jsonb check (jsonb_typeof(marks) = 'array'),
  open boolean not null default true,
  started_at timestamptz not null default now(),
  started_day date not null default (now() at time zone 'Pacific/Auckland')::date,
  finished_at timestamptz,
  result jsonb check (result is null or jsonb_typeof(result) = 'object')
);
create unique index bonkers_adventures_seed on public.bonkers_adventures (player, seed);
create unique index bonkers_adventures_one_open on public.bonkers_adventures (player) where open;
create index bonkers_adventures_by_player on public.bonkers_adventures (player, started_at);

alter table public.bonkers_progress enable row level security;
alter table public.bonkers_adventures enable row level security;
revoke all on public.bonkers_progress, public.bonkers_adventures from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The server function's jobs (service role only)
-- ---------------------------------------------------------------------------

-- The pupil's progress and version, or null if they've never played.
create function public.bonkers_load(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  return (select jsonb_build_object('progress', b.progress, 'version', b.version)
          from public.bonkers_progress b where b.player = bonkers_load.player);
end;
$$;

-- The pupil's open adventure (with the questions and answers: the server function only), or null.
create function public.bonkers_current(player uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('seed', a.seed, 'adventure', a.adventure, 'questions', a.questions, 'marks', a.marks, 'open', a.open)
  from public.bonkers_adventures a where a.player = bonkers_current.player and a.open
$$;

-- Saves the progress if its version still matches (0: the first save). Not callable on its own: the jobs below use it.
create function public.bonkers_put(player uuid, version integer, progress jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(progress) is distinct from 'object' or version is null or version < 0 then
    raise exception 'That progress is not right.' using errcode = '22023';
  end if;
  if version = 0 then
    insert into public.bonkers_progress (player, progress) values (player, progress)
    on conflict on constraint bonkers_progress_pkey do nothing;
  else
    update public.bonkers_progress b
    set progress = bonkers_put.progress, version = b.version + 1, updated_at = now()
    where b.player = bonkers_put.player and b.version = bonkers_put.version;
  end if;
  return found;
end;
$$;

-- The hero picked (the server function checks the class stays the same).
create function public.bonkers_save(player uuid, version integer, progress jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  return public.bonkers_put(player, version, progress);
end;
$$;

-- Keeps a new adventure and saves the progress (an adventure used up), together. False if the pupil has one open, has
-- used this seed, or the version moved on.
create function public.bonkers_start(player uuid, version integer, progress jsonb, seed text, quest text, adventure jsonb, questions jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if jsonb_typeof(adventure) is distinct from 'object' or jsonb_typeof(questions) is distinct from 'array'
     or jsonb_array_length(questions) > 200 then
    raise exception 'That adventure is not right.' using errcode = '22023';
  end if;
  if exists (select 1 from public.bonkers_adventures a
             where a.player = bonkers_start.player and (a.open or a.seed = bonkers_start.seed)) then
    return false;
  end if;
  if not public.bonkers_put(player, version, progress) then
    return false;
  end if;
  delete from public.bonkers_adventures a
  where a.player = bonkers_start.player and not a.open and a.started_at < now() - interval '60 days';
  insert into public.bonkers_adventures (player, seed, quest, adventure, questions)
  values (player, seed, quest, adventure, questions);
  return true;
end;
$$;

-- Adds the next mark to the open adventure: `slot` must be the next one. False if it isn't, or nothing is open.
create function public.bonkers_mark(player uuid, seed text, slot integer, mark jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if slot is null or slot < 0 or slot > 200 or jsonb_typeof(mark) is distinct from 'object'
     or jsonb_typeof(mark -> 'right') is distinct from 'boolean' or jsonb_typeof(mark -> 'special') is distinct from 'boolean' then
    raise exception 'That answer is not right.' using errcode = '22023';
  end if;
  update public.bonkers_adventures a
  set marks = a.marks || jsonb_build_array(jsonb_build_object('right', mark -> 'right', 'special', mark -> 'special'))
  where a.player = bonkers_mark.player and a.seed = bonkers_mark.seed and a.open and jsonb_array_length(a.marks) = slot;
  return found;
end;
$$;

-- Closes the open adventure with what it came to and saves the pupil's new progress, together. False if it was closed or
-- the version moved on (a finish sent twice counts once).
create function public.bonkers_finish(player uuid, seed text, version integer, progress jsonb, result jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(result) is distinct from 'object' then
    raise exception 'That adventure is not right.' using errcode = '22023';
  end if;
  perform 1 from public.bonkers_adventures a
  where a.player = bonkers_finish.player and a.seed = bonkers_finish.seed and a.open for update;
  if not found then
    return false;
  end if;
  if not public.bonkers_put(player, version, progress) then
    return false;
  end if;
  update public.bonkers_adventures a
  set open = false, finished_at = now(), result = bonkers_finish.result
  where a.player = bonkers_finish.player and a.seed = bonkers_finish.seed;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- The switch
-- ---------------------------------------------------------------------------

alter table public.app_settings add column bonkers_enabled boolean not null default true;

create function public.teacher_set_bonkers(enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null then
    raise exception 'Unknown Bonkers Quest setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings s set bonkers_enabled = teacher_set_bonkers.enabled
  where s.id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- The hooks
-- ---------------------------------------------------------------------------

-- Fights won and the hero's level (for stage B.2's achievements).
create function public.bonkers_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'bonkers_fights', coalesce((select (b.progress -> 'stats' ->> 'fightsWon')::int from public.bonkers_progress b where b.player = who), 0),
    'bonkers_level', coalesce((select (b.progress ->> 'level')::int from public.bonkers_progress b where b.player = who), 0))
$$;

-- The lines on How points work.
create function public.bonkers_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'Win a fight: 2 points.',
    'Finish your quest: 3 more.',
    'Beat a trainer: 5 more.',
    'One adventure a school day (saved up to 3). Right answers earn no points: they bonk the monsters.'))
$$;

create function public.bonkers_players_list()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select b.player from public.bonkers_progress b
$$;

create function public.bonkers_last_played(player uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select max(a.started_at) from public.bonkers_adventures a where a.player = bonkers_last_played.player
$$;

insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn, keep_achievements)
values ('bonkers', 'bonkers_enabled', 'public.bonkers_counts(uuid)', 'public.bonkers_point_rules()',
  'public.bonkers_players_list()', null, 'public.bonkers_last_played(uuid)', true);

insert into public.achievement_measures (measure) values ('bonkers_fights'), ('bonkers_level');

-- ---------------------------------------------------------------------------
-- Unlimited today: Bonkers Quest joins the games the teacher can lift (newest body: 20261122001300_circuit.sql).
-- create or replace keeps its grants.
-- ---------------------------------------------------------------------------

create or replace function public.teacher_set_unlimited_today(game text, enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null or game is null
     or game not in ('dragon-maths', 'clan-quest', 'monsters', 'diamond', 'trader', 'isles', 'goblinstorm', 'toonflap', 'marble', 'circuit', 'bonkers') then
    raise exception 'Unknown Unlimited turns setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings
  set unlimited_days = case when enabled
    then unlimited_days || jsonb_build_object(game, to_char((now() at time zone 'Pacific/Auckland')::date, 'YYYY-MM-DD'))
    else unlimited_days - game end
  where id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- The teacher's Progress tab: the hero's level (newest body: 20261125001600_starweb_teacher.sql, plus a bonkers block).
-- create or replace keeps its grants.
-- ---------------------------------------------------------------------------

create or replace function public.teacher_progress_other_games(target_class uuid)
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
    with students as (
      select s.id from public.my_students() s(id)
      where exists (select 1 from public.class_members m where m.student_id = s.id and m.class_id = target_class)
    ),
    rows as (
      select g.player as student, 'gem-keep' as game,
             coalesce(max(g.level_number) filter (where g.result = 'won'), 0) as value, max(g.finished_at) as at
        from public.gem_keep_runs g join students s on s.id = g.player group by g.player
      union all
      select d.player, 'diamond', coalesce((d.state ->> 'deepest')::integer, 0), d.updated_at
        from public.diamond_players d join students s on s.id = d.player
      union all
      select h.player, 'dragon-maths', coalesce((h.hero ->> 'level')::integer, 0), h.saved_at
        from public.lord_heroes h join students s on s.id = h.player
      union all
      select b.player, 'bond-match', sum(b.best_stars)::integer, max(b.updated_at)
        from public.bond_match_bests b join students s on s.id = b.player group by b.player
      union all
      select t.player, 'toonflap',
             (select count(*) from jsonb_each(t.progress -> 'levels') l(id, rec) where (l.rec ->> 'finishes')::int > 0)::integer, t.updated_at
        from public.toonflap_progress t join students s on s.id = t.player
      union all
      select o.player, 'orderup', o.passed, o.updated_at
        from public.orderup_progress o join students s on s.id = o.player
      union all
      select p.player, 'glyph', coalesce((p.progress ->> 'passed')::integer, 0),
             (select max(g.started_at) from public.glyph_goes g where g.player = p.player)
        from public.glyph_progress p join students s on s.id = p.player
      union all
      select gs.player, 'goblinstorm', cardinality(gs.bosses),
             (select max(r.started_at) from public.goblinstorm_runs r where r.player = gs.player)
        from public.goblinstorm_saves gs join students s on s.id = gs.player
      union all
      select c.player, 'circuit', (count(*) filter (where c.finishes > 0))::integer, max(c.updated_at)
        from public.circuit_progress c join students s on s.id = c.player group by c.player
      union all
      select w.player, 'starweb',
             (select count(*) from jsonb_each_text(coalesce(w.progress -> 'tables', '{}'::jsonb)) t(k, m) where t.m::int >= 1)::integer,
             (select max(k.saved_at) from public.starweb_skies k where k.player = w.player)
        from public.starweb_progress w join students s on s.id = w.player
      union all
      select bq.player, 'bonkers', coalesce((bq.progress ->> 'level')::integer, 1), bq.updated_at
        from public.bonkers_progress bq join students s on s.id = bq.player
    )
    select coalesce(jsonb_agg(jsonb_build_object('student', r.student, 'game', r.game, 'value', r.value, 'at', r.at)
                              order by r.game, r.student), '[]'::jsonb)
    from rows r
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.bonkers_load(uuid), public.bonkers_current(uuid), public.bonkers_put(uuid, integer, jsonb),
  public.bonkers_save(uuid, integer, jsonb), public.bonkers_start(uuid, integer, jsonb, text, text, jsonb, jsonb),
  public.bonkers_mark(uuid, text, integer, jsonb), public.bonkers_finish(uuid, text, integer, jsonb, jsonb),
  public.teacher_set_bonkers(boolean, uuid),
  public.bonkers_counts(uuid), public.bonkers_point_rules(), public.bonkers_players_list(), public.bonkers_last_played(uuid)
from public, anon, authenticated;
grant execute on function public.teacher_set_bonkers(boolean, uuid) to authenticated;
grant execute on function
  public.bonkers_load(uuid), public.bonkers_current(uuid),
  public.bonkers_save(uuid, integer, jsonb), public.bonkers_start(uuid, integer, jsonb, text, text, jsonb, jsonb),
  public.bonkers_mark(uuid, text, integer, jsonb), public.bonkers_finish(uuid, text, integer, jsonb, jsonb)
to service_role;
