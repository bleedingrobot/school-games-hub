-- Order Up! (the first Activity: order of operations on a take-away bag; short id orderup): the server side and the hub
-- (docs/ORDERUP-PLAN.md, stage 3). Built like Lizard's Bundles (20261107001000_lizard.sql) and Toon Flap.
--
-- 1. orderup_progress: one row a pupil: the highest level passed (0 to 7) and, per level, the help ({"1": {"help":
--    "full"|"plain", "goodDays": [...], "hardInRow": n}}). Saved only by the `orderup` server function, only if its
--    version still matches.
-- 2. orderup_sets: one row a set of eight bags started: its seed, level, help and the bags as the server made them, kept
--    so every bag is replayed against exactly what the pupil was shown. Bags are saved in order, each once.
-- 3. orderup_bags: one row a finished bag: the picks and answers (the server's replay), wrong picks and answers, the
--    mistake kinds, the most wrong picks on one step (the help reached) and the time. Old ones go after 120 days.
-- 4. The switch (app_settings.orderup_enabled, ON to start for every class; the code switch holds it back) and the help
--    setting (orderup_help: 'fade', 'always' or 'hints'), set through teacher_set_orderup().
-- 5. The hub: hub_games hooks and the level achievements (measure orderup_level_step, which ends in _step so the
--    Leaderboard leaves it out: an Activity has no leaderboard, James 13 Nov 2026). No points. Not a season game.
-- 6. The teacher: the class read for the settings drawer (level, stuck, last played, most common mistake) and an
--    "orderup" block in teacher_progress_other_games (the newest body, from 20261111000800, with one block added).
--
-- Maths answers are saved with record_fact_answers (keys bedmas:*), through the server function. Nothing shared is
-- re-created apart from teacher_progress_other_games, as the game guide says.

create table public.orderup_progress (
  player uuid primary key references public.profiles (id) on delete cascade,
  passed smallint not null default 0 check (passed between 0 and 7),
  levels jsonb not null default '{}'::jsonb check (jsonb_typeof(levels) = 'object'),
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now()
);

create table public.orderup_sets (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  seed bigint not null check (seed between 0 and 2147483647),
  level smallint not null check (level between 1 and 7),
  set jsonb not null check (jsonb_typeof(set) = 'object' and jsonb_typeof(set -> 'bags') = 'array'),
  open boolean not null default true,
  done smallint not null default 0 check (done between 0 and 8),
  good smallint not null default 0 check (good between 0 and 8),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create unique index orderup_sets_seed on public.orderup_sets (player, seed);
create index orderup_sets_by_player on public.orderup_sets (player, started_at);

create table public.orderup_bags (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  seed bigint not null,
  slot smallint not null check (slot between 0 and 7),
  level smallint not null check (level between 1 and 7),
  bag text not null check (length(bag) <= 120),
  events jsonb not null check (jsonb_typeof(events) = 'array'),
  good boolean not null,
  clean boolean not null,
  wrong_picks integer not null check (wrong_picks >= 0),
  wrong_answers integer not null check (wrong_answers >= 0),
  most_wrong integer not null check (most_wrong >= 0),
  mistakes text[] not null default '{}',
  ms integer not null check (ms >= 0),
  at timestamptz not null default now()
);
create unique index orderup_bags_slot on public.orderup_bags (player, seed, slot);
create index orderup_bags_by_player on public.orderup_bags (player, at);

alter table public.orderup_progress enable row level security;
alter table public.orderup_sets enable row level security;
alter table public.orderup_bags enable row level security;
revoke all on public.orderup_progress, public.orderup_sets, public.orderup_bags from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The server function's jobs (service role only)
-- ---------------------------------------------------------------------------

-- The pupil's place and its version, or null if they've never played.
create function public.orderup_load(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  return (select jsonb_build_object('passed', o.passed, 'levels', o.levels, 'version', o.version)
          from public.orderup_progress o where o.player = orderup_load.player);
end;
$$;

-- Keeps a new set and closes any other open one. False if the pupil has used this seed before.
create function public.orderup_start(player uuid, seed bigint, level smallint, set jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if jsonb_typeof(set) is distinct from 'object' or (set ->> 'seed')::bigint is distinct from seed
     or (set ->> 'level')::smallint is distinct from level or jsonb_typeof(set -> 'bags') is distinct from 'array'
     or jsonb_array_length(set -> 'bags') <> 8 then
    raise exception 'That set is not right.' using errcode = '22023';
  end if;
  if exists (select 1 from public.orderup_sets r where r.player = orderup_start.player and r.seed = orderup_start.seed) then
    return false;
  end if;
  update public.orderup_sets r set open = false where r.player = orderup_start.player and r.open;
  delete from public.orderup_sets r
  where r.player = orderup_start.player and not r.open and r.started_at < now() - interval '30 days';
  insert into public.orderup_sets (player, seed, level, set) values (player, seed, level, set);
  return true;
end;
$$;

-- One of the pupil's sets: { open, done, good, set }, or null if it isn't theirs.
create function public.orderup_set(player uuid, seed bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('open', r.open, 'done', r.done, 'good', r.good, 'set', r.set)
  from public.orderup_sets r where r.player = orderup_set.player and r.seed = orderup_set.seed
$$;

-- Saves bag `slot` of an open set, only if it is the next one; closes the set after the eighth. Null if not saved.
create function public.orderup_bag(
  player uuid, seed bigint, slot smallint, events jsonb, good boolean, clean boolean, wrong_picks integer,
  wrong_answers integer, most_wrong integer, mistakes text[], ms integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.orderup_sets;
  counts jsonb;
begin
  if jsonb_typeof(events) is distinct from 'array' or good is null or clean is null or wrong_picks is null
     or wrong_answers is null or most_wrong is null or ms is null or ms < 0 or cardinality(mistakes) > 100 then
    raise exception 'That bag is not right.' using errcode = '22023';
  end if;
  select * into s from public.orderup_sets r
  where r.player = orderup_bag.player and r.seed = orderup_bag.seed and r.open for update;
  if not found or s.done <> slot then
    return null;
  end if;
  insert into public.orderup_bags (player, seed, slot, level, bag, events, good, clean, wrong_picks, wrong_answers, most_wrong, mistakes, ms)
  values (player, seed, slot, s.level, s.set -> 'bags' -> slot ->> 'text', events, good, clean, wrong_picks, wrong_answers,
          most_wrong, coalesce(mistakes, '{}'), ms)
  on conflict do nothing;
  if not found then
    return null;
  end if;
  update public.orderup_sets r
  set done = r.done + 1, good = r.good + (case when orderup_bag.good then 1 else 0 end),
      open = r.done + 1 < 8, finished_at = case when r.done + 1 >= 8 then now() end
  where r.id = s.id
  returning jsonb_build_object('done', r.done, 'good', r.good) into strict counts;
  delete from public.orderup_bags b where b.player = orderup_bag.player and b.at < now() - interval '120 days';
  insert into public.orderup_progress (player) values (player) on conflict on constraint orderup_progress_pkey do nothing;
  update public.orderup_progress o set updated_at = now() where o.player = orderup_bag.player;
  return counts;
end;
$$;

-- Saves the pupil's place, only if the version still matches. `passed` never goes down.
create function public.orderup_save(player uuid, version integer, passed smallint, levels jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if passed is null or passed not between 0 and 7 or jsonb_typeof(levels) is distinct from 'object' then
    raise exception 'That place is not right.' using errcode = '22023';
  end if;
  perform public.gem_keep_check_player(player);
  if version = 0 then
    insert into public.orderup_progress (player, passed, levels) values (player, passed, levels)
    on conflict on constraint orderup_progress_pkey do nothing;
    if found then
      return true;
    end if;
    -- A bag made the row first: it is at version 1 with nothing saved yet.
    version := 1;
  end if;
  update public.orderup_progress o
  set passed = greatest(o.passed, orderup_save.passed), levels = orderup_save.levels, version = o.version + 1, updated_at = now()
  where o.player = orderup_save.player and o.version = orderup_save.version;
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- The switch and the help setting
-- ---------------------------------------------------------------------------

alter table public.app_settings add column orderup_enabled boolean not null default true;   -- a new game's switch starts on (James, 11 Nov 2026); ACTIVITIES_ON and the code switch hold it back.
alter table public.app_settings add column orderup_help text not null default 'fade' check (orderup_help in ('fade', 'always', 'hints'));

-- Either setting, or both (a null one is left as it is).
create function public.teacher_set_orderup(enabled boolean default null, help text default null, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if (enabled is null and help is null) or (help is not null and help not in ('fade', 'always', 'hints')) then
    raise exception 'Unknown Order Up! setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings s
  set orderup_enabled = coalesce(teacher_set_orderup.enabled, s.orderup_enabled),
      orderup_help = coalesce(teacher_set_orderup.help, s.orderup_help)
  where s.id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- The hooks: achievements for each level passed, no points
-- ---------------------------------------------------------------------------

create function public.orderup_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'orderup_level_step', coalesce((select o.passed from public.orderup_progress o where o.player = who), 0),
    'orderup_bags', coalesce((select count(*) from public.orderup_bags b where b.player = who), 0))
$$;

create function public.orderup_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'No points: Order Up! is an Activity. Each level you pass gives an achievement.'))
$$;

create function public.orderup_players_list()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select o.player from public.orderup_progress o
$$;

create function public.orderup_last_played(player uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select o.updated_at from public.orderup_progress o where o.player = orderup_last_played.player
$$;

insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn, keep_achievements)
values ('orderup', 'orderup_enabled', 'public.orderup_counts(uuid)', 'public.orderup_point_rules()',
  'public.orderup_players_list()', null, 'public.orderup_last_played(uuid)', true);

insert into public.achievement_measures (measure) values ('orderup_level_step'), ('orderup_bags');
insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('orderup-first', 'orderup', 'First order', '🛍️', 'orderup_bags', 1, 1),
  ('orderup-1', 'orderup', 'Left to right', '➡️', 'orderup_level_step', 1, 2),
  ('orderup-2', 'orderup', 'Times first', '✖️', 'orderup_level_step', 2, 3),
  ('orderup-3', 'orderup', 'Bracket boss', '🧺', 'orderup_level_step', 3, 4),
  ('orderup-4', 'orderup', 'Power up', '⚡', 'orderup_level_step', 4, 5),
  ('orderup-5', 'orderup', 'Head chef', '👨‍🍳', 'orderup_level_step', 5, 6),
  ('orderup-6', 'orderup', 'Bracket builder', '🧱', 'orderup_level_step', 6, 7),
  ('orderup-7', 'orderup', 'Diner master', '🏆', 'orderup_level_step', 7, 8);

-- ---------------------------------------------------------------------------
-- The teacher
-- ---------------------------------------------------------------------------

-- One line a pupil in the class: level passed, stuck (3 hard sets in a row on a level), bags this week, last played and
-- their most common mistake in the last 30 days. Plus the class's most common mistakes.
create function public.teacher_orderup_class(target_class uuid)
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
    slips as (
      select b.player, k.kind, count(*) as n
      from public.orderup_bags b join students s on s.id = b.player, unnest(b.mistakes) k(kind)
      where b.at > now() - interval '30 days'
      group by b.player, k.kind
    )
    select jsonb_build_object(
      'pupils', coalesce((
        select jsonb_agg(jsonb_build_object(
          'student', o.player, 'passed', o.passed, 'at', o.updated_at,
          'stuck', exists (select 1 from jsonb_each(o.levels) l(k, v) where coalesce((l.v ->> 'hardInRow')::int, 0) >= 3),
          'week', (select count(*) from public.orderup_bags b where b.player = o.player and b.at > now() - interval '7 days'),
          'slip', (select sl.kind from slips sl where sl.player = o.player order by sl.n desc, sl.kind limit 1)))
        from public.orderup_progress o join students s on s.id = o.player), '[]'::jsonb),
      'slips', coalesce((
        select jsonb_agg(jsonb_build_object('kind', t.kind, 'pupils', t.pupils) order by t.pupils desc, t.kind)
        from (select sl.kind, count(distinct sl.player) as pupils from slips sl group by sl.kind) t), '[]'::jsonb))
  );
end;
$$;

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
  public.orderup_load(uuid), public.orderup_start(uuid, bigint, smallint, jsonb), public.orderup_set(uuid, bigint),
  public.orderup_bag(uuid, bigint, smallint, jsonb, boolean, boolean, integer, integer, integer, text[], integer),
  public.orderup_save(uuid, integer, smallint, jsonb),
  public.orderup_counts(uuid), public.orderup_point_rules(), public.orderup_players_list(), public.orderup_last_played(uuid),
  public.teacher_set_orderup(boolean, text, uuid), public.teacher_orderup_class(uuid)
from public, anon, authenticated;
grant execute on function public.teacher_set_orderup(boolean, text, uuid), public.teacher_orderup_class(uuid) to authenticated;
grant execute on function
  public.orderup_load(uuid), public.orderup_start(uuid, bigint, smallint, jsonb), public.orderup_set(uuid, bigint),
  public.orderup_bag(uuid, bigint, smallint, jsonb, boolean, boolean, integer, integer, integer, text[], integer),
  public.orderup_save(uuid, integer, smallint, jsonb)
to service_role;
