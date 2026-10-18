-- Dragon Maths, stage L.4: saving and fairness. (Plan: docs/LORD-PLAN.md, section 10, and "L.4 results".)
--
-- 1. Tables: lord_heroes (one row per student: the hero as JSON, a version number, the season and the day),
--    lord_fights (every fight the server handed out: the monster, the seed, the fight as it started, the
--    actions the student played and the result; ONE open fight per student at a time), lord_events (an audit
--    trail of the requests that were accepted, each with its request id so a repeat counts once) and
--    lord_refusals (requests the checks turned down, for the teacher page). Students can't read or write any
--    of them directly: they read their own hero through my_lord(), and only the `lord` server function writes
--    (through lord_commit() below).
-- 2. Teacher settings on app_settings: the game switch (OFF until a teacher turns it on), forest fights a day
--    and the day season 1 starts. Changed through teacher_set_lord().
-- 3. Saving, for the server only. lord_commit() keeps the hero, the fight and the audit note together or not
--    at all: a change must be made from the current version, a request id counts once, only one fight is open
--    at a time and a fight is finished once.
-- 4. Reading: my_lord() (the student's own hero and records of every topic).
--
-- NOT in this migration (stage L.5): points, achievements, the warriors list, the arena and the teacher page.
-- Nothing here touches points or any leaderboard.
--
-- The answers to maths questions go into gem_keep_facts through record_fact_answers(), the same records every
-- other maths game uses, so the teacher's "hardest facts" view keeps working. Those records already accept the
-- two packs Dragon Maths adds ('money' and 'patterns'): their keys look like "money:change" and "pat:add".

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table public.lord_heroes (
  player uuid primary key references public.profiles (id) on delete cascade,
  -- The hero (shared/lord/types.ts `Hero`), already checked by the lord function.
  hero jsonb not null check (jsonb_typeof(hero) = 'object'),
  -- 1 for the first save, one more each time. A change must be made from the current version.
  version integer not null check (version >= 1),
  season integer not null check (season >= 1),
  -- The New Zealand day of the last rollover, YYYY-MM-DD.
  day text not null check (day ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  -- Today's riddle and number guess, a dragon run in progress, an event waiting. Includes the number-guess
  -- secret, so it is never sent to the student.
  extra jsonb not null default '{}',
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.lord_fights (
  id uuid primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('forest', 'master', 'dragon')),
  -- The monster, for the audit trail ("goblin-3", "master-4", "dragon-2").
  monster text not null check (monster ~ '^[a-z0-9-]{1,40}$'),
  seed bigint not null check (seed between 0 and 4294967295),
  -- The fight before any action (shared/lord/types.ts `FightState`), so it can always be played again from the start.
  start jsonb not null,
  -- The options it started with: the day, whether it offers "size it up", the dragon stage, a master's trial results.
  options jsonb not null default '{}',
  status text not null default 'open' check (status in ('open', 'finished', 'abandoned')),
  -- What the student played, replayed by the server before anything was paid.
  actions jsonb,
  result jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  check ((status = 'open') = (finished_at is null))
);
-- One open fight per student at a time.
create unique index lord_fights_one_open on public.lord_fights (player) where status = 'open';
create index lord_fights_recent on public.lord_fights (player, created_at desc);

create table public.lord_events (
  id uuid primary key default gen_random_uuid(),
  player uuid not null references public.profiles (id) on delete cascade,
  -- Made by the browser, so a request sent twice is only kept once.
  request_id uuid not null,
  action text not null check (action ~ '^[a-z-]{1,30}$'),
  version integer not null check (version >= 1),
  summary jsonb not null default '{}',
  at timestamptz not null default now(),
  unique (player, request_id)
);
create index lord_events_recent on public.lord_events (player, at desc);

-- Requests the server check turned down. Only a short code (never the request itself).
create table public.lord_refusals (
  id uuid primary key default gen_random_uuid(),
  player uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason ~ '^[a-z0-9-]{1,40}$'),
  action text not null check (action ~ '^[a-z-]{1,30}$'),
  at timestamptz not null default now()
);
create index lord_refusals_recent on public.lord_refusals (at desc);

alter table public.lord_heroes enable row level security;
alter table public.lord_fights enable row level security;
alter table public.lord_events enable row level security;
alter table public.lord_refusals enable row level security;
revoke all on public.lord_heroes, public.lord_fights, public.lord_events, public.lord_refusals from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Teacher settings (school-wide: the hub has no classes)
-- ---------------------------------------------------------------------------

alter table public.app_settings
  -- OFF until a teacher says go: students are turned away (a teacher can still look around).
  add column lord_enabled boolean not null default false,
  add column lord_forest_per_day integer not null default 10 check (lord_forest_per_day between 1 and 30),
  -- The first day of season 1; seasons then run back to back, 35 days each. Null until the game is switched on.
  add column lord_season_start date;

-- { enabled, forestPerDay, seasonStart: 'YYYY-MM-DD' | null }
create function public.lord_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('enabled', s.lord_enabled, 'forestPerDay', s.lord_forest_per_day,
    'seasonStart', to_char(s.lord_season_start, 'YYYY-MM-DD'))
  from public.app_settings s
$$;

-- `settings` = { enabled: boolean, forestPerDay?: 1-30, seasonStart?: 'YYYY-MM-DD' | null }. Switching the game on
-- without a start date starts season 1 today.
create function public.teacher_set_lord(settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  per_day integer;
  start date;
begin
  perform public.require_teacher();
  if jsonb_typeof(settings) is distinct from 'object' or jsonb_typeof(settings -> 'enabled') is distinct from 'boolean' then
    raise exception 'Those settings couldn''t be read.' using errcode = '22023';
  end if;
  select s.lord_forest_per_day, s.lord_season_start into per_day, start from public.app_settings s;
  if settings ? 'forestPerDay' then
    if jsonb_typeof(settings -> 'forestPerDay') is distinct from 'number'
       or (settings ->> 'forestPerDay')::numeric <> trunc((settings ->> 'forestPerDay')::numeric)
       or (settings ->> 'forestPerDay')::numeric not between 1 and 30 then
      raise exception 'Forest fights a day must be a whole number from 1 to 30.' using errcode = '22023';
    end if;
    per_day := (settings ->> 'forestPerDay')::integer;
  end if;
  if settings ? 'seasonStart' then
    if jsonb_typeof(settings -> 'seasonStart') = 'null' then
      start := null;
    elsif jsonb_typeof(settings -> 'seasonStart') = 'string' and (settings ->> 'seasonStart') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      start := (settings ->> 'seasonStart')::date;
    else
      raise exception 'That start date couldn''t be read.' using errcode = '22023';
    end if;
  end if;
  if (settings ->> 'enabled')::boolean and start is null then
    start := public.nz_day(now());
  end if;
  update public.app_settings set
    lord_enabled = (settings ->> 'enabled')::boolean, lord_forest_per_day = per_day, lord_season_start = start
  where id;
  return public.lord_settings();
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Saving (server only: the lord function checks everything first)
-- ---------------------------------------------------------------------------

-- The settings, for the server function.
create function public.lord_server_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.lord_settings()
$$;

-- The hero and the fight in progress, for the server to check the next request against. `row` is null for a student
-- with no hero. `seen` says whether this request id was already used.
create function public.load_lord(player uuid, request_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  h public.lord_heroes;
  f public.lord_fights;
begin
  perform public.gem_keep_check_player(player);
  select * into h from public.lord_heroes x where x.player = load_lord.player;
  select * into f from public.lord_fights x where x.player = load_lord.player and x.status = 'open';
  return jsonb_build_object(
    'row', case when h.player is null then null else
      jsonb_build_object('hero', h.hero, 'version', h.version, 'season', h.season, 'extra', h.extra) end,
    'openFight', case when f.id is null then null else
      jsonb_build_object('id', f.id, 'kind', f.kind, 'seed', f.seed, 'start', f.start, 'info', f.options) end,
    'seen', request_id is not null and exists (
      select 1 from public.lord_events e where e.player = load_lord.player and e.request_id = load_lord.request_id));
end;
$$;

-- One checked change. `change` = { expect, hero, season, extra, openFight, closeFight, event } as the lord function
-- sends it (shared/lord/server.ts `Commit`). Everything happens or nothing does. Returns
-- { status: 'saved' | 'duplicate' | 'stale' | 'open-fight' | 'no-fight', version }.
create function public.lord_commit(player uuid, change jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cur public.lord_heroes;
  expect integer := (change ->> 'expect')::integer;
  req uuid := (change #>> '{event,requestId}')::uuid;
  fight jsonb := change -> 'openFight';
  closing jsonb := change -> 'closeFight';
  new_version integer;
begin
  perform public.gem_keep_check_player(player);
  select * into cur from public.lord_heroes h where h.player = lord_commit.player for update;
  if exists (select 1 from public.lord_events e where e.player = lord_commit.player and e.request_id = req) then
    return jsonb_build_object('status', 'duplicate', 'version', coalesce(cur.version, 0));
  end if;
  -- A change follows the version it was made from. Anything else was made from an out-of-date copy.
  if expect <> coalesce(cur.version, 0) then
    return jsonb_build_object('status', 'stale', 'version', coalesce(cur.version, 0));
  end if;
  if (select count(*) from public.lord_events e
      where e.player = lord_commit.player and e.at > now() - interval '1 day') >= 1000 then
    raise exception 'That''s a lot of playing today!' using errcode = '54000';
  end if;

  -- The hero comes first: if two devices race to make the very first save, one of them is told it is out of date
  -- before anything else is written.
  new_version := expect + 1;
  if cur.player is null then
    begin
      insert into public.lord_heroes (player, hero, version, season, day, extra)
      values (lord_commit.player, change -> 'hero', new_version, (change ->> 'season')::integer, change #>> '{hero,day}',
        coalesce(change -> 'extra', '{}'));
    exception when unique_violation then
      return jsonb_build_object('status', 'stale', 'version', 1);
    end;
  else
    update public.lord_heroes h set
      hero = change -> 'hero', version = new_version, season = (change ->> 'season')::integer,
      day = change #>> '{hero,day}', extra = coalesce(change -> 'extra', '{}'), saved_at = now()
    where h.player = lord_commit.player;
  end if;

  -- A fight is finished once. (A refusal below raises, which undoes everything above, hero included.)
  if jsonb_typeof(closing) = 'object' then
    update public.lord_fights f set
      status = closing ->> 'status', actions = closing -> 'actions', result = closing -> 'result', finished_at = now()
    where f.id = (closing ->> 'id')::uuid and f.player = lord_commit.player and f.status = 'open';
    if not found then
      raise exception 'no-fight' using errcode = 'P0001';
    end if;
  end if;
  -- Only one fight is open at a time.
  if jsonb_typeof(fight) = 'object' then
    begin
      insert into public.lord_fights (id, player, kind, monster, seed, start, options)
      values ((fight ->> 'id')::uuid, lord_commit.player, fight ->> 'kind', fight #>> '{start,monster,id}',
        (fight ->> 'seed')::bigint, fight -> 'start', fight -> 'info');
    exception when unique_violation then
      raise exception 'open-fight' using errcode = 'P0001';
    end;
  end if;

  insert into public.lord_events (player, request_id, action, version, summary)
  values (lord_commit.player, req, change #>> '{event,action}', new_version, coalesce(change #> '{event,summary}', '{}'));
  return jsonb_build_object('status', 'saved', 'version', new_version);
exception when raise_exception then
  if sqlerrm in ('open-fight', 'no-fight') then
    return jsonb_build_object('status', sqlerrm, 'version', coalesce(cur.version, 0));
  end if;
  raise;
end;
$$;

-- A request the server check turned down: only a short code, and not more than 30 a day each.
create function public.record_lord_refusal(player uuid, reason text, action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if (select count(*) from public.lord_refusals r
      where r.player = record_lord_refusal.player and r.at > now() - interval '1 day') < 30 then
    insert into public.lord_refusals (player, reason, action)
    values (player, left(regexp_replace(lower(reason), '[^a-z0-9-]', '-', 'g'), 40), left(regexp_replace(lower(action), '[^a-z-]', '-', 'g'), 30));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Reading
-- ---------------------------------------------------------------------------

-- Everything Dragon Maths needs when it opens: the student's own hero as last saved (null for a new player),
-- the teacher's settings, whether this is a teacher, and the student's records for every topic (the questions
-- pick weak facts first). The number-guess secret and the rest of `extra` stay on the server.
create function public.my_lord()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id where public.is_school_user())
  select jsonb_build_object(
    'hero', (select jsonb_build_object('hero', h.hero, 'version', h.version, 'season', h.season, 'savedAt', h.saved_at)
             from public.lord_heroes h where h.player = me.id),
    'settings', public.lord_settings(),
    'teacher', public.is_teacher(),
    'facts', (select coalesce(jsonb_agg(jsonb_build_object(
        'pack', f.pack, 'key', f.fact_key, 'attempts', f.attempts, 'correct', f.correct, 'avgMs', f.avg_ms,
        'box', f.box, 'lastSeen', coalesce((extract(epoch from f.last_seen) * 1000)::bigint, 0),
        'quickDays', to_jsonb(f.quick_days::text[]))), '[]')
      from public.gem_keep_facts f where f.player = me.id)
  )
  from me
$$;

-- ---------------------------------------------------------------------------
-- Tidying: audit rows are kept for 60 days (the hero itself is kept for good)
-- ---------------------------------------------------------------------------

select cron.schedule('trim-lord-history', '31 3 * * *',
  $$delete from public.lord_fights where status <> 'open' and finished_at < now() - interval '60 days';
    delete from public.lord_events where at < now() - interval '60 days';
    delete from public.lord_refusals where at < now() - interval '60 days'$$);

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.lord_settings(), public.teacher_set_lord(jsonb), public.lord_server_settings(),
  public.load_lord(uuid, uuid), public.lord_commit(uuid, jsonb), public.record_lord_refusal(uuid, text, text),
  public.my_lord()
from public, anon, authenticated;
grant execute on function public.my_lord(), public.teacher_set_lord(jsonb) to authenticated;
grant execute on function
  public.lord_server_settings(), public.load_lord(uuid, uuid), public.lord_commit(uuid, jsonb), public.record_lord_refusal(uuid, text, text)
to service_role;
