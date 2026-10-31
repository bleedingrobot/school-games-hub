-- Star Trader, stage T.3: saving (docs/TRADER-PLAN.md, sections 10 and 14).
--
-- Star Trader is its own thing: its own tables and functions, prefixed trader_. It does not touch scoring, points,
-- progress or achievements yet (those come in stage T.5 through the hub_games hooks), and it re-creates no shared
-- function. Every table here is closed to pupils (row security on, no policy, no grant): only the `trader` server
-- function (the server key) reads or writes them, so a pupil can never change their own ship, money or questions.
--
-- 1. The teacher's switches on app_settings (OFF to start, per class): trader_enabled, trader_jumps, trader_loans,
--    trader_maths; teacher_set_trader() and teacher_reset_trader() (one pupil's ship, for a fresh start).
-- 2. trader_schools: each school's galaxy for a season (a seed). A New Season gives the school a new one.
-- 3. trader_games: one saved game per pupil (the ship, cargo, money, any event in progress), with a version number so
--    two tabs or devices can't overwrite each other, and the net worth for the board (T.5).
-- 4. trader_days: each pupil's list of maths questions for a day, kept where pupils can't read it, with the answers
--    marked so far (a question is marked once).
-- 5. trader_requests: the reply to each request, so a request sent twice counts once.
-- 6. trader_moons: who bought a moon, which season. Kept through a New Season (the Moon Owners list).
-- 7. The server's functions, the hooks (a New Season clears the games and gives the school a new galaxy), and who can
--    call what.

-- ---------------------------------------------------------------------------
-- The teacher's switches
-- ---------------------------------------------------------------------------

alter table public.app_settings add column trader_enabled boolean not null default false;
alter table public.app_settings add column trader_jumps integer not null default 10 check (trader_jumps between 1 and 30);
alter table public.app_settings add column trader_loans boolean not null default true;
alter table public.app_settings add column trader_maths text not null default 'choose' check (trader_maths in ('off', 'choose', 'on'));

create function public.teacher_set_trader(enabled boolean, jumps integer, loans boolean, maths text, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null or loans is null or jumps is null or jumps not between 1 and 30 or maths is null or maths not in ('off', 'choose', 'on') then
    raise exception 'Unknown Star Trader setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings
  set trader_enabled = enabled, trader_jumps = jumps, trader_loans = loans, trader_maths = maths
  where id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables (closed to pupils)
-- ---------------------------------------------------------------------------

create table public.trader_schools (
  school_id integer primary key references public.schools (id) on delete cascade,
  -- The seed the galaxy is made from (shared/trader/galaxy.ts): the same seed is the same galaxy for the whole school.
  seed text not null check (length(seed) between 4 and 60),
  season integer not null default 1,
  started_at timestamptz not null default now()
);

create table public.trader_games (
  player uuid primary key references public.profiles (id) on delete cascade,
  school_id integer references public.schools (id) on delete set null,
  season integer not null default 1,
  -- The whole saved game (shared/trader/server.ts, `Game`). Small: a few KB.
  game jsonb not null check (pg_column_size(game) < 40000),
  -- Goes up by one with every save; a save made from an older version is refused.
  version integer not null default 1,
  day integer not null,
  net_worth integer not null default 0,
  moon boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trader_games_by_school on public.trader_games (school_id, net_worth desc);

create table public.trader_days (
  player uuid not null references public.profiles (id) on delete cascade,
  day integer not null,
  questions jsonb not null,
  -- The answers marked so far: { "<slot>": { "value": n, "right": true } }.
  answered jsonb not null default '{}',
  created_at timestamptz not null default now(),
  primary key (player, day)
);

create table public.trader_requests (
  player uuid not null references public.profiles (id) on delete cascade,
  request_id text not null check (length(request_id) between 8 and 80),
  reply jsonb not null,
  created_at timestamptz not null default now(),
  primary key (player, request_id)
);
create index trader_requests_by_day on public.trader_requests (created_at);

create table public.trader_moons (
  player uuid not null references public.profiles (id) on delete cascade,
  season integer not null,
  school_id integer references public.schools (id) on delete set null,
  achieved_at timestamptz not null default now(),
  primary key (player, season)
);
create index trader_moons_by_school on public.trader_moons (school_id, season, achieved_at);

alter table public.trader_schools enable row level security;
alter table public.trader_games enable row level security;
alter table public.trader_days enable row level security;
alter table public.trader_requests enable row level security;
alter table public.trader_moons enable row level security;
revoke all on public.trader_schools, public.trader_games, public.trader_days, public.trader_requests, public.trader_moons from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The server function's own database functions
-- ---------------------------------------------------------------------------

-- The school's galaxy seed and season, made on first use. { seed, season, school_id }
create function public.trader_school_seed(player uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid integer;
  row_ public.trader_schools;
begin
  perform public.gem_keep_check_player(player);
  select p.school_id into sid from public.profiles p where p.id = player;
  if sid is null then
    raise exception 'No such player.' using errcode = '22023';
  end if;
  insert into public.trader_schools (school_id, seed)
  values (sid, 'galaxy-' || substr(md5(random()::text || clock_timestamp()::text || sid::text), 1, 10))
  on conflict (school_id) do nothing;
  select * into row_ from public.trader_schools where school_id = sid;
  return jsonb_build_object('seed', row_.seed, 'season', row_.season, 'school_id', sid);
end;
$$;

-- A pupil's saved game, if they have one: { game, version, season, day }, else null.
create function public.trader_load(player uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('game', g.game, 'version', g.version, 'season', g.season, 'day', g.day)
  from public.trader_games g where g.player = trader_load.player
$$;

-- The reply to a request already handled (so it counts once), or null.
create function public.trader_request(player uuid, request_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select r.reply from public.trader_requests r where r.player = trader_request.player and r.request_id = trader_request.request_id
$$;

-- A day's questions: { questions, answered }, or null.
create function public.trader_load_day(player uuid, day integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('questions', d.questions, 'answered', d.answered)
  from public.trader_days d where d.player = trader_load_day.player and d.day = trader_load_day.day
$$;

-- Keeps a day's questions (the first list for a day wins, so two tabs can't swap lists). Old days are thrown away.
create function public.trader_store_day(player uuid, day integer, questions jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if jsonb_typeof(questions) <> 'array' or jsonb_array_length(questions) not between 1 and 60 then
    raise exception 'That question list is not right.' using errcode = '22023';
  end if;
  delete from public.trader_days d where d.created_at < now() - interval '3 days';
  delete from public.trader_requests r where r.created_at < now() - interval '3 days';
  insert into public.trader_days (player, day, questions) values (player, day, questions) on conflict do nothing;
end;
$$;

-- Saves a game, once the server has worked out every move. `expected_version` is the version the moves were worked out
-- from (0 for a first game). Returns the new version, or null if the saved game has moved on (another tab or device):
-- nothing is changed then. The answers marked (`claims`, { "<slot>": { value, right } }) go in the same step, so a
-- refused request never uses up a question. `reply` is kept against `request_id` so a request sent twice counts once.
-- A moon bought for the first time is added to the Moon Owners list.
create function public.trader_save(
  player uuid,
  expected_version integer,
  new_game jsonb,
  new_day integer,
  new_net_worth integer,
  new_moon boolean,
  new_season integer,
  request_id text,
  reply jsonb,
  claims jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid integer;
  new_version integer;
  was_moon boolean;
begin
  perform public.gem_keep_check_player(player);
  select p.school_id into sid from public.profiles p where p.id = player;
  if expected_version = 0 then
    insert into public.trader_games (player, school_id, season, game, day, net_worth, moon)
    values (player, sid, new_season, new_game, new_day, new_net_worth, new_moon)
    on conflict on constraint trader_games_pkey do nothing
    returning version into new_version;
    was_moon := false;
  else
    select g.moon into was_moon from public.trader_games g where g.player = trader_save.player and g.version = expected_version;
    update public.trader_games g
    set game = new_game, day = new_day, net_worth = new_net_worth, moon = new_moon, version = g.version + 1,
        season = new_season, updated_at = now()
    where g.player = trader_save.player and g.version = expected_version
    returning g.version into new_version;
  end if;
  if new_version is null then
    return null;
  end if;
  if claims is not null and jsonb_typeof(claims) = 'object' and claims <> '{}'::jsonb then
    update public.trader_days d set answered = d.answered || claims where d.player = trader_save.player and d.day = new_day;
  end if;
  if new_moon and not coalesce(was_moon, false) then
    insert into public.trader_moons (player, season, school_id) values (player, new_season, sid) on conflict do nothing;
  end if;
  insert into public.trader_requests (player, request_id, reply) values (player, request_id, reply) on conflict do nothing;
  return new_version;
end;
$$;

-- ---------------------------------------------------------------------------
-- Teachers
-- ---------------------------------------------------------------------------

-- One pupil's ship goes back to the start (a fresh Flea and 100 credits), for a pupil who is stuck or wants to start again.
create function public.teacher_reset_trader(student uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  delete from public.trader_games where player = student;
  delete from public.trader_days where player = student;
  delete from public.trader_requests where player = student;
end;
$$;

-- ---------------------------------------------------------------------------
-- The hooks (docs/GAME_DEVELOPMENT_GUIDE.md, section 5): a New Season clears the games and gives each affected school a
-- new galaxy. The Moon Owners list stays. Points and achievements are added in stage T.5.
-- ---------------------------------------------------------------------------

create function public.trader_season(players uuid[])
returns void
language sql
set search_path = ''
as $$
  with schools as (
    select distinct p.school_id from public.profiles p where p.id = any (players) and p.school_id is not null
  ),
  a as (delete from public.trader_games where player = any (players)),
  b as (delete from public.trader_days where player = any (players)),
  c as (delete from public.trader_requests where player = any (players))
  update public.trader_schools s
  set season = s.season + 1,
      seed = 'galaxy-' || substr(md5(random()::text || clock_timestamp()::text || s.school_id::text), 1, 10),
      started_at = now()
  where s.school_id in (select school_id from schools)
$$;

create function public.trader_last_played(player uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select max(g.updated_at) from public.trader_games g where g.player = trader_last_played.player
$$;

insert into public.hub_games (id, switch_column, season_fn, last_played_fn)
values ('trader', 'trader_enabled', 'public.trader_season(uuid[])', 'public.trader_last_played(uuid)');

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.teacher_set_trader(boolean, integer, boolean, text, uuid), public.teacher_reset_trader(uuid),
  public.trader_school_seed(uuid), public.trader_load(uuid), public.trader_request(uuid, text), public.trader_load_day(uuid, integer),
  public.trader_store_day(uuid, integer, jsonb),
  public.trader_save(uuid, integer, jsonb, integer, integer, boolean, integer, text, jsonb, jsonb),
  public.trader_season(uuid[]), public.trader_last_played(uuid)
from public, anon, authenticated;
grant execute on function public.teacher_set_trader(boolean, integer, boolean, text, uuid), public.teacher_reset_trader(uuid) to authenticated;
grant execute on function
  public.trader_school_seed(uuid), public.trader_load(uuid), public.trader_request(uuid, text), public.trader_load_day(uuid, integer),
  public.trader_store_day(uuid, integer, jsonb),
  public.trader_save(uuid, integer, jsonb, integer, integer, boolean, integer, text, jsonb, jsonb)
to service_role;
