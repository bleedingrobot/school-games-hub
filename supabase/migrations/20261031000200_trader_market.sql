-- Star Trader, stage T.4: the school's shared market and news (docs/TRADER-PLAN.md, sections 8 and 20).
--
-- Builds on 20261022001000_trader.sql (stage T.3). Nothing here re-creates a shared function. Like every trader_ table,
-- the new ones are closed to pupils (row security on, no policy, no grant); only the `trader` server function reads or
-- changes them.
--
-- 1. trader_markets: one row per school, planet and good once anyone has traded it: how far the price is pushed from
--    normal (in hundredths of a hundredth of a percent), how far it moved on `day`, and `day` (the last day it changed).
--    Drifting back to normal is worked out when a row is read or changed (from `day`), so nothing runs at midnight.
-- 2. trader_news: the day's big moves (a price that moved a lot in one day), so the news can say "Lots of traders sold
--    Water on Mars". It never says who: the market only knows how far a price moved.
-- 3. trader_push_market(): a request's pushes, applied in one step per row (many pupils can trade the same planet at
--    once; each row is locked while it changes, in the same order every time, so nothing is lost or counted twice).
--    Each pupil push is divided by the school's depth (pupils who played this week, at least a few), then kept within
--    the cap. It's called from trader_save, so it happens in the same step as the game is saved: a request sent twice
--    is answered from trader_requests and never pushes twice.
-- 4. trader_market(): the school's market today, for landing prices and the news.
-- 5. trader_save gains a `market` argument (it's dropped and made again: T.3's version is not live anywhere).
-- 6. trader_season: a New Season also clears the school's market and news (create or replace; the hub_games row stays).
--
-- The numbers (cap, drift, news, depth) are handed in by the server from shared/trader/config.ts, so they live in one
-- place; the checks below only stop nonsense.

create table public.trader_markets (
  school_id integer not null references public.schools (id) on delete cascade,
  planet smallint not null check (planet between 0 and 99),
  good smallint not null check (good between 0 and 9),
  -- How far the price is pushed from normal, in 1/100 of a hundredth of a percent (500000 = 50%), as on `day`.
  push integer not null default 0 check (push between -1000000 and 1000000),
  -- How far it moved on `day` (same units, + up, - down).
  moved integer not null default 0 check (moved between -2000000 and 2000000),
  day integer not null,
  primary key (school_id, planet, good)
);

create table public.trader_news (
  school_id integer not null references public.schools (id) on delete cascade,
  day integer not null,
  planet smallint not null,
  good smallint not null,
  -- -1: lots of selling (cheap), 1: lots of buying (dear).
  direction smallint not null check (direction in (-1, 1)),
  primary key (school_id, day, planet, good)
);

alter table public.trader_markets enable row level security;
alter table public.trader_news enable row level security;
revoke all on public.trader_markets, public.trader_news from anon, authenticated;

-- Counting the pupils who played this week (the market's depth).
create index trader_games_by_school_played on public.trader_games (school_id, updated_at);

-- A push after the nights from from_day to to_day: it keeps keep_pct percent each night, rounded towards zero
-- (shared/trader/schoolMarket.ts `drift` does the same).
create function public.trader_drift(push integer, from_day integer, to_day integer, keep_pct integer)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  p integer := push;
  d integer := from_day;
begin
  if to_day - from_day > 40 then
    return 0;
  end if;
  while d < to_day and p <> 0 loop
    p := (p * keep_pct) / 100;
    d := d + 1;
  end loop;
  return p;
end;
$$;

-- Applies one request's pushes to a school's market. `market` = { pushes: [[planet, good, bp], ...], cap, keep, news,
-- depth, days }: bp is the pupil's push (hundredths of a percent, after their own daily limit); cap / news are
-- hundredths of a percent; depth is the smallest depth; days is how far back "played this week" looks.
create function public.trader_push_market(sid integer, today integer, market jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cap integer := least(greatest(coalesce((market ->> 'cap')::integer, 5000), 0), 9000) * 100;
  keep integer := least(greatest(coalesce((market ->> 'keep')::integer, 25), 0), 100);
  news integer := greatest(coalesce((market ->> 'news')::integer, 1500), 1) * 100;
  min_depth integer := least(greatest(coalesce((market ->> 'depth')::integer, 5), 1), 1000);
  look_back integer := least(greatest(coalesce((market ->> 'days')::integer, 7), 1), 60);
  depth integer;
  item record;
  delta integer;
  moved_ integer;
begin
  if sid is null or market is null or jsonb_typeof(market -> 'pushes') <> 'array' or jsonb_array_length(market -> 'pushes') = 0 then
    return;
  end if;
  if jsonb_array_length(market -> 'pushes') > 100 then
    raise exception 'Too many market changes.' using errcode = '22023';
  end if;
  select greatest(min_depth, count(*)::integer) into depth
  from public.trader_games g
  where g.school_id = sid and g.updated_at > now() - make_interval(days => look_back);

  -- The same order every time (planet, then good), so two requests never wait on each other's rows the wrong way round.
  for item in
    select (e ->> 0)::integer as planet, (e ->> 1)::integer as good, sum((e ->> 2)::integer) as bp
    from jsonb_array_elements(market -> 'pushes') e
    group by 1, 2
    order by 1, 2
  loop
    if item.planet is null or item.good is null or item.planet not between 0 and 99 or item.good not between 0 and 9
       or item.bp is null or abs(item.bp) > 100000 then
      raise exception 'That market change is not right.' using errcode = '22023';
    end if;
    delta := (item.bp * 100) / depth;
    continue when delta = 0;
    insert into public.trader_markets as m (school_id, planet, good, push, moved, day)
    values (sid, item.planet, item.good, greatest(-cap, least(cap, delta)), greatest(-cap, least(cap, delta)), today)
    on conflict (school_id, planet, good) do update
    set push = greatest(-cap, least(cap, public.trader_drift(m.push, m.day, today, keep) + delta)),
        moved = (case when m.day >= today then m.moved else 0 end)
              + greatest(-cap, least(cap, public.trader_drift(m.push, m.day, today, keep) + delta))
              - public.trader_drift(m.push, m.day, today, keep),
        day = greatest(m.day, today)
    returning m.moved into moved_;
    if abs(moved_) >= news then
      insert into public.trader_news as n (school_id, day, planet, good, direction)
      values (sid, today, item.planet, item.good, case when moved_ < 0 then -1 else 1 end)
      on conflict (school_id, day, planet, good) do update set direction = excluded.direction;
    end if;
  end loop;
  delete from public.trader_news n where n.school_id = sid and n.day < today - 3;
end;
$$;

-- The school's market today for a pupil's school: { pushes: [[planet, good, push, moved today], ...], news: [[day,
-- planet, good, direction], ...] }. Pushes are in hundredths of a percent, drifted to `today`, zeros left out. News is
-- today's and yesterday's.
create function public.trader_market(player uuid, today integer, keep_pct integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  sid integer;
  keep integer := least(greatest(coalesce(keep_pct, 25), 0), 100);
  pushes jsonb;
  news jsonb;
begin
  select p.school_id into sid from public.profiles p where p.id = player;
  if sid is null then
    return jsonb_build_object('pushes', '[]'::jsonb, 'news', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(jsonb_build_array(x.planet, x.good, x.push, x.moved) order by x.planet, x.good), '[]'::jsonb)
  into pushes
  from (
    select m.planet, m.good, public.trader_drift(m.push, m.day, today, keep) / 100 as push,
           case when m.day = today then m.moved / 100 else 0 end as moved
    from public.trader_markets m
    where m.school_id = sid
  ) x
  where x.push <> 0;
  select coalesce(jsonb_agg(jsonb_build_array(n.day, n.planet, n.good, n.direction) order by n.day desc, n.planet, n.good), '[]'::jsonb)
  into news
  from public.trader_news n
  where n.school_id = sid and n.day between today - 1 and today;
  return jsonb_build_object('pushes', pushes, 'news', news);
end;
$$;

-- Saving, as in T.3, plus the request's market pushes in the same step (only once the version check has passed, so a
-- refused or repeated request never moves a price).
drop function public.trader_save(uuid, integer, jsonb, integer, integer, boolean, integer, text, jsonb, jsonb);

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
  claims jsonb,
  market jsonb default null
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
  if market is not null then
    perform public.trader_push_market(sid, new_day, market);
  end if;
  insert into public.trader_requests (player, request_id, reply) values (player, request_id, reply) on conflict do nothing;
  return new_version;
end;
$$;

-- A New Season: as in T.3 (clear the games, a new galaxy for each school), and now the school's market and news too.
create or replace function public.trader_season(players uuid[])
returns void
language sql
set search_path = ''
as $$
  with schools as (
    select distinct p.school_id from public.profiles p where p.id = any (players) and p.school_id is not null
  ),
  a as (delete from public.trader_games where player = any (players)),
  b as (delete from public.trader_days where player = any (players)),
  c as (delete from public.trader_requests where player = any (players)),
  d as (delete from public.trader_markets where school_id in (select school_id from schools)),
  e as (delete from public.trader_news where school_id in (select school_id from schools))
  update public.trader_schools s
  set season = s.season + 1,
      seed = 'galaxy-' || substr(md5(random()::text || clock_timestamp()::text || s.school_id::text), 1, 10),
      started_at = now()
  where s.school_id in (select school_id from schools)
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.trader_drift(integer, integer, integer, integer),
  public.trader_push_market(integer, integer, jsonb),
  public.trader_market(uuid, integer, integer),
  public.trader_save(uuid, integer, jsonb, integer, integer, boolean, integer, text, jsonb, jsonb, jsonb),
  public.trader_season(uuid[])
from public, anon, authenticated;
grant execute on function
  public.trader_market(uuid, integer, integer),
  public.trader_save(uuid, integer, jsonb, integer, integer, boolean, integer, text, jsonb, jsonb, jsonb)
to service_role;
