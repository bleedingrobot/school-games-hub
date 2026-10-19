-- Points and achievements for new games without rewriting the shared functions (docs/GAME_DEVELOPMENT_GUIDE.md,
-- section 5 and section 10, fix 6). Until now every game with points added a column to scored_games, changed two
-- lists of allowed values, and re-created six shared functions whole; two games doing that at once wiped each other's
-- lines. After this, a new game only ADDS rows and its own functions:
--
--   insert into public.hub_games (id, ...hooks...) values ('<game>', ...);
--   insert into public.achievement_measures (measure) values ('<game>_wins'), ...;
--   insert into public.achievement_types (...) values (...);
--   its server calls public.add_game_points(player, '<game>', points, once) to give points.
--
-- 1. hub_games: every game (the old games are listed too, with no hooks), and for new games the functions the shared
--    code calls. Replaces the two "game in (...)" checks with a foreign key.
-- 2. achievement_measures: the allowed measures, as rows. Replaces the "measure in (...)" check with a foreign key.
-- 3. game_points: one shared table of points for every new game, scored like Clan Quest's (kind 'solo', inside the
--    same points-a-day cap as games against the computer), re-scored by rebuild_progress and cleared by New Season.
--    scored_games gets one column for it, game_points, once and for all.
-- 4. Small helper functions that call the hooks.
-- 5. Small, exact edits to progress_counts, progress_rules, rebuild_progress, my_progress, teacher_students and
--    teacher_new_season so they call the helpers. Like 20261019000600, each edit is made to the function AS IT IS NOW
--    (so whatever else the live version has is kept), each piece of text must be found exactly once, and if any is
--    not, this stops and changes nothing.
--
-- Nothing an existing game does changes: their parts of the shared functions stay exactly as they are.

-- ---------------------------------------------------------------------------
-- 1. The games
-- ---------------------------------------------------------------------------

create table public.hub_games (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  -- The rest is for games that use the hooks. Every one may be left out.
  -- A boolean column of app_settings: while it is false for the viewer's class, the game's achievements and points rules are hidden.
  switch_column text check (switch_column ~ '^[a-z][a-z0-9_]{0,62}$'),
  -- fn(who uuid) returns jsonb: the game's counts for its achievements ({ "<measure>": n, ... }).
  counts_fn regprocedure,
  -- fn() returns jsonb: { "lines": ["...", ...] }, the game's part of How points work, in plain sentences.
  rules_fn regprocedure,
  -- fn() returns setof uuid: players whose achievements come from progress outside their points (re-awarded by rebuild_progress).
  players_fn regprocedure,
  -- fn(players uuid[]) returns void: what else a New Season clears for these players (the game's points always go).
  season_fn regprocedure,
  -- fn(player uuid) returns timestamptz: when the player last played, for the teacher's list.
  last_played_fn regprocedure,
  -- Achievements that stay through a New Season (as Maths Monsters', Dragon Maths' and Clan Quest's do).
  keep_achievements boolean not null default false
);
alter table public.hub_games enable row level security;
-- Read only through the functions below; no policy, no grant.

-- Each hook must have the shape the shared code calls it with.
create function public.hub_games_check()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  hook record;
begin
  for hook in
    select * from (values
      ('counts_fn', new.counts_fn, 'uuid', 'jsonb', false),
      ('rules_fn', new.rules_fn, '', 'jsonb', false),
      ('players_fn', new.players_fn, '', 'uuid', true),
      ('season_fn', new.season_fn, 'uuid[]', 'void', false),
      ('last_played_fn', new.last_played_fn, 'uuid', 'timestamp with time zone', false)
    ) as h(name, fn, args, returns, many)
    where h.fn is not null
  loop
    if not exists (
      select 1 from pg_catalog.pg_proc p
      where p.oid = hook.fn
        and pg_catalog.oidvectortypes(p.proargtypes) = hook.args
        and pg_catalog.format_type(p.prorettype, null) = hook.returns
        and p.proretset = hook.many
    ) then
      raise exception 'hub_games.%: % must take (%) and return %', hook.name, hook.fn, hook.args,
        case when hook.many then 'setof ' else '' end || hook.returns using errcode = '22023';
    end if;
  end loop;
  if new.switch_column is not null and not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'app_settings' and c.column_name = new.switch_column and c.data_type = 'boolean'
  ) then
    raise exception 'hub_games.switch_column: app_settings has no boolean column %', new.switch_column using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger hub_games_check
before insert or update on public.hub_games
for each row execute function public.hub_games_check();

-- Every game named by the two old checks (live or not, whatever they hold now) and every game already in the tables.
insert into public.hub_games (id)
select distinct v
from (
  select (regexp_matches(pg_get_constraintdef(c.oid), '''([^'']+)''', 'g'))[1] as v
  from pg_constraint c
  where (c.conrelid, c.conname) in (('public.scored_games'::regclass, 'scored_games_game_check'),
                                    ('public.achievement_types'::regclass, 'achievement_types_game_check'))
  union select game from public.scored_games
  union select game from public.achievement_types
) g
on conflict do nothing;

alter table public.scored_games drop constraint if exists scored_games_game_check;
alter table public.achievement_types drop constraint if exists achievement_types_game_check;
alter table public.scored_games add constraint scored_games_game_fkey foreign key (game) references public.hub_games (id);
alter table public.achievement_types add constraint achievement_types_game_fkey foreign key (game) references public.hub_games (id);

-- ---------------------------------------------------------------------------
-- 2. The measures
-- ---------------------------------------------------------------------------

create table public.achievement_measures (
  measure text primary key check (measure ~ '^[a-z][a-z0-9_]{0,39}$')
);
alter table public.achievement_measures enable row level security;

insert into public.achievement_measures (measure)
select distinct v
from (
  select (regexp_matches(pg_get_constraintdef(c.oid), '''([^'']+)''', 'g'))[1] as v
  from pg_constraint c
  where c.conrelid = 'public.achievement_types'::regclass and c.conname = 'achievement_types_measure_check'
  union select measure from public.achievement_types
) m
on conflict do nothing;

alter table public.achievement_types drop constraint if exists achievement_types_measure_check;
alter table public.achievement_types add constraint achievement_types_measure_fkey
  foreign key (measure) references public.achievement_measures (measure);

-- ---------------------------------------------------------------------------
-- 3. Points for new games
-- ---------------------------------------------------------------------------

-- One row per thing that earned points. `once` is unique per game, so a save sent twice earns once.
create table public.game_points (
  id uuid primary key default gen_random_uuid(),
  player uuid not null references public.profiles (id) on delete cascade,
  game text not null references public.hub_games (id),
  once text not null check (length(once) between 1 and 200),
  points_raw integer not null check (points_raw between 0 and 100),
  counts_for_points boolean not null default true,
  finished_at timestamptz not null default now(),
  unique (game, once)
);
create index game_points_player on public.game_points (player, finished_at);
alter table public.game_points enable row level security;
-- The server only: no policy, no grant.

alter table public.scored_games add column game_points uuid references public.game_points (id) on delete cascade;
create unique index scored_games_points on public.scored_games (player, game_points) where game_points is not null;
create index scored_games_game_points on public.scored_games (game_points);

-- "Exactly one thing was scored", with game_points added, edited in place so any column the live table has is kept.
do $migration$
declare
  def text;
  edits text[][] := array[
    array['num_nonnulls(', 'num_nonnulls(game_points, '],
    array['((kind = ''solo''::text) = (', '((kind = ''solo''::text) = ((game_points IS NOT NULL) OR ']
  ];
  i integer;
begin
  select pg_get_constraintdef(c.oid) into def
  from pg_constraint c where c.conrelid = 'public.scored_games'::regclass and c.conname = 'scored_games_check';
  for i in 1 .. array_length(edits, 1) loop
    if (length(def) - length(replace(def, edits[i][1], ''))) / length(edits[i][1]) <> 1 then
      raise exception 'scored_games_check edit % did not match exactly once; nothing was changed', i;
    end if;
    def := replace(def, edits[i][1], edits[i][2]);
  end loop;
  alter table public.scored_games drop constraint scored_games_check;
  execute 'alter table public.scored_games add constraint scored_games_check ' || def;
end
$migration$;

-- Scores one game_points row, like Clan Quest's: inside the points-a-day cap shared with games against the computer.
create function public.score_game_points(e public.game_points)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  day date := public.nz_day(e.finished_at);
  earned_today integer;
begin
  if not e.counts_for_points then
    return;
  end if;
  select coalesce(sum(s.points), 0) into earned_today
  from public.scored_games s
  where s.player = e.player and s.kind in ('bot', 'solo') and s.nz_day = day;
  insert into public.scored_games (player, game, kind, game_points, result, reason, points, finished_at, nz_day)
  values (e.player, e.game, 'solo', e.id, 'won', 'points',
    least(e.points_raw, greatest(public.bot_daily_cap() - earned_today, 0)), e.finished_at, day)
  on conflict do nothing;
  perform public.award_achievements(e.player, e.game, e.finished_at);
end;
$$;

create function public.score_game_points_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.score_game_points(new);
  return null;
exception when others then
  -- Never lose a save because scoring went wrong. rebuild_progress() can fix scores later.
  raise warning 'scoring game points failed (%)', sqlstate;
  return null;
end;
$$;

create trigger score_when_saved
after insert on public.game_points
for each row execute function public.score_game_points_trigger();

-- For a game's server function: give a player points. True if they are new, false if this `once` was given before.
create function public.add_game_points(player uuid, game text, points integer, once text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  added uuid;
begin
  if not exists (select 1 from public.hub_games h where h.id = add_game_points.game) then
    raise exception 'Unknown game' using errcode = '22023';
  end if;
  insert into public.game_points (player, game, once, points_raw)
  values (add_game_points.player, add_game_points.game, add_game_points.once, add_game_points.points)
  on conflict do nothing
  returning id into added;
  return added is not null;
end;
$$;

-- For a game's server function: its counts changed without points (a level reached, a course finished), so check its achievements.
create function public.game_progress_changed(player uuid, game text)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.award_achievements(player, game, now())
$$;

-- ---------------------------------------------------------------------------
-- 4. Calling the hooks
-- ---------------------------------------------------------------------------

-- A game's counts for its achievements ('{}' for the older games, whose counts are written into progress_counts).
create function public.hub_games_counts(who uuid, which_game text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  fn regprocedure;
  out jsonb;
begin
  select h.counts_fn into fn from public.hub_games h where h.id = which_game;
  if fn is null then
    return '{}';
  end if;
  execute format('select %s($1)', fn::regproc) into out using who;
  return coalesce(out, '{}');
end;
$$;

-- The new games switched off for the viewer's class (looked up once).
create function public.hub_games_off()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  -- No settings row (not a school user) counts as switched off, as for the older games.
  with sw as materialized (select (select to_jsonb(s) from public.settings_of(auth.uid()) s) as row)
  select coalesce(array_agg(h.id), '{}')
  from public.hub_games h, sw
  where h.switch_column is not null and coalesce((sw.row ->> h.switch_column)::boolean, false) = false
$$;

-- { "hubGames": { "<game>": { "lines": [...] } } } for the games with points rules that are switched on.
create function public.hub_games_rules()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  game record;
  off text[] := public.hub_games_off();
  part jsonb;
  out jsonb := '{}';
begin
  for game in select h.id, h.rules_fn from public.hub_games h where h.rules_fn is not null order by h.id loop
    if not game.id = any (off) then
      execute format('select %s()', game.rules_fn::regproc) into part;
      if part is not null then
        out := out || jsonb_build_object(game.id, part);
      end if;
    end if;
  end loop;
  return case when out = '{}' then '{}' else jsonb_build_object('hubGames', out) end;
end;
$$;

-- After a rebuild: achievements that come from progress outside the points.
create function public.hub_games_award_all()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  game record;
begin
  for game in select h.id, h.players_fn from public.hub_games h where h.players_fn is not null loop
    execute format('select public.award_achievements(p, $1, now()) from %s() as p', game.players_fn::regproc) using game.id;
  end loop;
end;
$$;

-- New Season: each new game's own clearing.
create function public.hub_games_new_season(players uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  game record;
begin
  for game in select h.season_fn from public.hub_games h where h.season_fn is not null loop
    execute format('select %s($1)', game.season_fn::regproc) using players;
  end loop;
end;
$$;

-- The latest time a player played any new game (null if none).
create function public.hub_games_last_played(player uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  game record;
  at timestamptz;
  latest timestamptz;
begin
  for game in select h.last_played_fn from public.hub_games h where h.last_played_fn is not null loop
    execute format('select %s($1)', game.last_played_fn::regproc) into at using player;
    latest := greatest(latest, at);
  end loop;
  return latest;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. The shared functions call the hooks
-- ---------------------------------------------------------------------------

create function pg_temp.edit_function(sig text, edits text[][])
returns void
language plpgsql
as $$
declare
  def text := pg_get_functiondef(sig::regprocedure);
  i integer;
begin
  for i in 1 .. array_length(edits, 1) loop
    if (length(def) - length(replace(def, edits[i][1], ''))) / length(edits[i][1]) <> 1 then
      raise exception '% edit % did not match exactly once; nothing was changed', sig, i;
    end if;
    def := replace(def, edits[i][1], edits[i][2]);
  end loop;
  execute def;
end;
$$;

-- The game's own counts come first, so the older games' figures (worked out below them) are never changed.
select pg_temp.edit_function('public.progress_counts(uuid, text)', array[array[
  E'  select jsonb_build_object(\n    ''games'', count(*),',
  E'  select public.hub_games_counts(who, which_game) || jsonb_build_object(\n    ''games'', count(*),'
]]);

select pg_temp.edit_function('public.progress_rules()', array[array[
  E'  select jsonb_build_object(\n    ''bot'', (select',
  E'  select public.hub_games_rules() || jsonb_build_object(\n    ''bot'', (select'
]]);

select pg_temp.edit_function('public.rebuild_progress()', array[
  array[
    E'\n    order by finished_at, id\n',
    E'\n    union all\n    select ''points'', gp.id, gp.finished_at from public.game_points gp where gp.counts_for_points'
    || E'\n    order by finished_at, id\n'
  ],
  array[
    E'\n    else\n      perform public.score_gem_keep_run(r)',
    E'\n    elsif item.kind = ''points'' then\n      perform public.score_game_points(gp) from public.game_points gp where gp.id = item.id;'
    || E'\n    else\n      perform public.score_gem_keep_run(r)'
  ],
  array[
    E'\n  return jsonb_build_object(\n    ''scored_games''',
    E'\n  -- New games'' achievements that come from progress outside their points (hub_games.players_fn).'
    || E'\n  perform public.hub_games_award_all();'
    || E'\n  return jsonb_build_object(\n    ''scored_games'''
  ]
]);

select pg_temp.edit_function('public.my_progress()', array[
  array[
    E'\n  select jsonb_build_object(\n    ''points'', t.points,',
    E',\n  -- New games switched off for this class (hub_games.switch_column), looked up once.'
    || E'\n  off as materialized (select public.hub_games_off() as games)'
    || E'\n  select jsonb_build_object(\n    ''points'', t.points,'
  ],
  array[
    E'))),\n    ''recent'', (select',
    E'))\n                and at.game <> all ((select off.games from off)::text[])),\n    ''recent'', (select'
  ],
  -- At the start of the lists, so it fits whatever other games have added at the end (Bond Match on the live database).
  array['coalesce(x.bot_game, ', 'coalesce(x.game_points, x.bot_game, '],
  array['(select s.bot_game, ', '(select s.game_points, s.bot_game, ']
]);

select pg_temp.edit_function('public.teacher_students()', array[array[
  E'),\n         p.created_at\n  from public.profiles p',
  E',\n           public.hub_games_last_played(p.id)),\n         p.created_at\n  from public.profiles p'
]]);

select pg_temp.edit_function('public.teacher_new_season(text)', array[
  array[
    'and achievement not in (select t.id from public.achievement_types t where t.game in (',
    'and achievement not in (select t.id from public.achievement_types t'
    || ' where t.game in (select h.id from public.hub_games h where h.keep_achievements) or t.game in ('
  ],
  array[
    E'\n  return jsonb_build_object(''botGames''',
    E'\n  -- New games: their points go, and whatever else each one clears (hub_games.season_fn).'
    || E'\n  delete from public.game_points where player = any (mine);'
    || E'\n  perform public.hub_games_new_season(mine);'
    || E'\n  return jsonb_build_object(''botGames'''
  ]
]);

-- ---------------------------------------------------------------------------
-- Who may run what
-- ---------------------------------------------------------------------------

-- Helpers and scoring run only inside the shared functions (and by the server).
revoke execute on function public.hub_games_check(), public.score_game_points(public.game_points),
  public.score_game_points_trigger(), public.hub_games_counts(uuid, text), public.hub_games_off(), public.hub_games_rules(),
  public.hub_games_award_all(), public.hub_games_new_season(uuid[]), public.hub_games_last_played(uuid)
  from public, anon, authenticated;
-- A game's server function gives points and checks achievements with the server key.
revoke execute on function public.add_game_points(uuid, text, integer, text), public.game_progress_changed(uuid, text)
  from public, anon, authenticated;
grant execute on function public.add_game_points(uuid, text, integer, text), public.game_progress_changed(uuid, text)
  to service_role;
