-- Class Live: Colour Clash (docs/CLASH-PLAN.md). Nothing is deleted; no shared function is re-created.
--
--   1. The 'clash' activity row (moves, max speed 0.6 as Four Corners).
--   2. classlive_clash_tiles: each round's painted tiles (24 x 24 board, idx = row * 24 + col, team 1 to 4), and
--      classlive_clash_painted: tiles each pupil has painted in a room. Painting is decided here, never on the device:
--      classlive_clash_paint() moves the pupil with classlive_move() and paints the tiles on the line from their last
--      saved spot (lineTiles in shared/classlive/clash.ts), only while the round's painting is on, in their own team's
--      colour, 3 wide with a Big Brush. The server function paints bombs (classlive_clash_bomb) and reads the board when
--      a round ends (classlive_clash_count). The projector reads changes through classlive_clash_board() (teachers only).
--   3. Trophies, counted from classlive_stats.extra (PupilReward.extra in shared/classlive/rewards.ts).

-- ---------------------------------------------------------------------------
-- 1. The activity
-- ---------------------------------------------------------------------------

insert into public.classlive_activities (id, name, moves, max_speed, reward_line, sort) values
  ('clash', 'Colour Clash', true, 0.6, 'Be on the winning Colour Clash team: 2 more points.', 5);

-- ---------------------------------------------------------------------------
-- 2. Tiles
-- ---------------------------------------------------------------------------

create table public.classlive_clash_tiles (
  room bigint not null references public.classlive_rooms (id) on delete cascade,
  round smallint not null check (round between 1 and 500),
  idx smallint not null check (idx between 0 and 575),
  team smallint not null check (team between 1 and 4),
  painter uuid references public.profiles (id) on delete set null,
  at_ms bigint not null,
  primary key (room, round, idx)
);
create index classlive_clash_tiles_by_time on public.classlive_clash_tiles (room, round, at_ms);
alter table public.classlive_clash_tiles enable row level security;
revoke all on public.classlive_clash_tiles from public, anon, authenticated;

create table public.classlive_clash_painted (
  room bigint not null references public.classlive_rooms (id) on delete cascade,
  player uuid not null references public.profiles (id) on delete cascade,
  painted integer not null default 0 check (painted >= 0),
  primary key (room, player)
);
alter table public.classlive_clash_painted enable row level security;
revoke all on public.classlive_clash_painted from public, anon, authenticated;

-- Tiles of a round changed after `since` (epoch ms; null: all) as [[idx, team], ...].
create function public.classlive_clash_changes(target bigint, rnd integer, since bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_array(t.idx, t.team)), '[]'::jsonb)
  from public.classlive_clash_tiles t
  where t.room = target and t.round = rnd and (since is null or t.at_ms >= since)
$$;

-- Paints tiles (any team's tile not already this team's) and adds them to the painter's count. Answers how many changed.
create function public.classlive_clash_put(target bigint, rnd integer, tm integer, who uuid, idxs integer[], now_ms bigint)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  insert into public.classlive_clash_tiles as t (room, round, idx, team, painter, at_ms)
  select target, rnd, i, tm, who, now_ms from (select distinct unnest(idxs) as i) d where i between 0 and 575
  on conflict (room, round, idx) do update set team = excluded.team, painter = excluded.painter, at_ms = excluded.at_ms
  where t.team <> excluded.team;
  get diagnostics changed = row_count;
  if changed > 0 then
    insert into public.classlive_clash_painted as p (room, player, painted) values (target, who, changed)
    on conflict (room, player) do update set painted = p.painted + excluded.painted;
  end if;
  return changed;
end;
$$;

-- A pupil's device saves its spot (as classlive_move) and paints on the way. `since`: the `now` of its last answer.
-- Answers { spots: [[x, y], ...], round, now, tiles: [[idx, team], ...] changed since `since` }, or null when the
-- caller isn't playing a live moving room.
create function public.classlive_clash_paint(target bigint, x double precision, y double precision, since bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  prev public.classlive_spots%rowtype;
  had boolean;
  cur public.classlive_spots%rowtype;
  spots jsonb;
  g jsonb;
  r jsonb;
  n integer := 0;
  zero bigint;
  t bigint;
  tm integer;
  brush_to bigint;
  wide boolean;
  gap double precision;
  steps integer;
  s integer;
  px double precision;
  py double precision;
  cx integer;
  cy integer;
  dx integer;
  dy integer;
  hole boolean;
  idxs integer[] := '{}';
begin
  if me is null then
    return null;
  end if;
  select * into prev from public.classlive_spots sp where sp.room = target and sp.player = me;
  had := found;
  spots := public.classlive_move(target, x, y);
  if spots is null then
    return null;
  end if;
  select st.session -> 'game' into g from public.classlive_state st where st.room = target;
  if g is null or g ->> 'kind' is distinct from 'clash' then
    return jsonb_build_object('spots', spots, 'round', 0, 'now', now_ms, 'tiles', '[]'::jsonb);
  end if;
  r := g -> 'round';
  if r is not null and jsonb_typeof(r) = 'object' then
    n := coalesce((r ->> 'n')::integer, 0);
  end if;
  zero := (g ->> 'zeroMs')::bigint;
  select * into cur from public.classlive_spots sp where sp.room = target and sp.player = me;
  -- Paint only a move saved just now, while this round's painting is on.
  if n > 0 and zero is not null and had and cur.at_ms = now_ms and coalesce(jsonb_typeof(r -> 'result'), 'null') = 'null' then
    t := now_ms - zero;
    tm := (g -> 'mine' -> me::text ->> 'team')::integer;
    if tm between 1 and 4 and t >= (r ->> 'paintFrom')::bigint and t < (r ->> 'paintTo')::bigint then
      brush_to := (g -> 'mine' -> me::text ->> 'brushTo')::bigint;
      wide := brush_to is not null and t < brush_to;
      hole := coalesce((r ->> 'hole')::boolean, false);
      gap := sqrt((cur.x - prev.x) ^ 2 + (cur.y - prev.y) ^ 2);
      -- A long jump (a teleport, a new round's start) paints only where they land.
      if gap > 0.6 * least(5, greatest(0, now_ms - prev.at_ms) / 1000.0) + 0.06 then
        prev.x := cur.x;
        prev.y := cur.y;
        gap := 0;
      end if;
      steps := greatest(1, ceil(gap / (1.0 / 48))::integer);
      for s in 0..steps loop
        px := prev.x + (cur.x - prev.x) * s / steps;
        py := prev.y + (cur.y - prev.y) * s / steps;
        cx := least(23, greatest(0, floor(px * 24)::integer));
        cy := least(23, greatest(0, floor(py * 24)::integer));
        for dy in (case when wide then -1 else 0 end)..(case when wide then 1 else 0 end) loop
          for dx in (case when wide then -1 else 0 end)..(case when wide then 1 else 0 end) loop
            if cx + dx between 0 and 23 and cy + dy between 0 and 23
              and not (hole and sqrt(((cx + dx + 0.5) / 24 - 0.5) ^ 2 + ((cy + dy + 0.5) / 24 - 0.5) ^ 2) < 0.15) then
              idxs := idxs || ((cy + dy) * 24 + cx + dx);
            end if;
          end loop;
        end loop;
      end loop;
      perform public.classlive_clash_put(target, n, tm, me, idxs, now_ms);
    end if;
  end if;
  return jsonb_build_object('spots', spots, 'round', n, 'now', now_ms,
    'tiles', case when n > 0 then public.classlive_clash_changes(target, n, since) else '[]'::jsonb end);
end;
$$;

-- The projector: { round, now, tiles: [[idx, team], ...] changed since `since` }, for the room's teachers only.
create function public.classlive_clash_board(target bigint, since bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if not public.classlive_teaches_room(target) then
    return null;
  end if;
  select coalesce((st.session #>> '{game,round,n}')::integer, 0) into n from public.classlive_state st where st.room = target;
  return jsonb_build_object('round', coalesce(n, 0), 'now', floor(extract(epoch from clock_timestamp()) * 1000),
    'tiles', case when coalesce(n, 0) > 0 then public.classlive_clash_changes(target, n, since) else '[]'::jsonb end);
end;
$$;

-- The server function: a paint bomb.
create function public.classlive_clash_bomb(target bigint, rnd integer, tm integer, player uuid, idxs integer[])
returns integer
language sql
security definer
set search_path = ''
as $$
  select public.classlive_clash_put(target, rnd, tm, player, idxs, floor(extract(epoch from clock_timestamp()) * 1000)::bigint)
$$;

-- The server function: a round's board as one character a tile ('0' blank, '1' to '4' a team), and tiles painted by
-- each pupil in the room. { tiles, painted: { player: n } }.
create function public.classlive_clash_count(target bigint, rnd integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'tiles', (select string_agg(coalesce(t.team, 0)::text, '' order by i)
      from generate_series(0, 575) i left join public.classlive_clash_tiles t on t.room = target and t.round = rnd and t.idx = i),
    'painted', coalesce((select jsonb_object_agg(p.player, p.painted) from public.classlive_clash_painted p where p.room = target), '{}'::jsonb))
$$;

-- ---------------------------------------------------------------------------
-- 3. Trophies (classlive_stats.extra: clash_tiles, clash_bombs, clash_wins, clash_games)
-- ---------------------------------------------------------------------------

insert into public.achievement_measures (measure)
values ('classlive_clash_tiles'), ('classlive_clash_bombs'), ('classlive_clash_wins'), ('classlive_clash_games');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort, how, tier) values
  ('classlive-clash-splasher', 'classlive', 'Paint Splasher', '🎨', 'classlive_clash_tiles', 1000, 40, 'Paint 1000 tiles in Colour Clash.', 1),
  ('classlive-clash-bomber', 'classlive', 'Bomb Squad', '💣', 'classlive_clash_bombs', 25, 41, 'Drop 25 paint bombs in Colour Clash.', 2),
  ('classlive-clash-champion', 'classlive', 'Colour Champion', '🏳️‍🌈', 'classlive_clash_wins', 1, 42, 'Be on the winning team in Colour Clash.', 1),
  ('classlive-clash-legend', 'classlive', 'Rainbow Legend', '🌈', 'classlive_clash_wins', 5, 43, 'Be on the winning team in 5 Colour Clash games.', 3);

-- ---------------------------------------------------------------------------
-- 4. Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function public.classlive_clash_changes(bigint, integer, bigint), public.classlive_clash_put(bigint, integer, integer, uuid, integer[], bigint),
  public.classlive_clash_paint(bigint, double precision, double precision, bigint), public.classlive_clash_board(bigint, bigint),
  public.classlive_clash_bomb(bigint, integer, integer, uuid, integer[]), public.classlive_clash_count(bigint, integer)
from public, anon, authenticated;
grant execute on function public.classlive_clash_paint(bigint, double precision, double precision, bigint), public.classlive_clash_board(bigint, bigint)
to authenticated;
grant execute on function public.classlive_clash_bomb(bigint, integer, integer, uuid, integer[]), public.classlive_clash_count(bigint, integer)
to service_role;
