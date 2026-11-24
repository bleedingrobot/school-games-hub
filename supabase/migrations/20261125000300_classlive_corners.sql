-- Class Live: Four Corners (docs/CORNERS-PLAN.md). Nothing is deleted.
--
--   1. The 'corners' activity on classlive_rooms.
--   2. classlive_spots: each pupil's last saved spot in a Four Corners room. Pupils' devices save through
--      classlive_move() about every 0.4 s (a plain database call, not the server function: a class of devices calling the
--      function that often would hit its limits). Each move is clamped to the fastest possible speed since the last one
--      (teleports allowed), as clampMove() in shared/classlive/corners.ts. The server function reads the spots when a
--      round's run ends (classlive_room_positions) and moves pupils back from jail or on a jump (classlive_place). The
--      projector reads them, with avatars, through classlive_positions() (the room's teachers only).
--   3. Rewards: safe rounds, wins, escapes and power-ups in classlive_stats; classlive_finish pays them; 4 trophies.
--   4. The lobby button's words name Four Corners.

-- ---------------------------------------------------------------------------
-- 1. The activity
-- ---------------------------------------------------------------------------

alter table public.classlive_rooms drop constraint classlive_rooms_activity_check;
alter table public.classlive_rooms add constraint classlive_rooms_activity_check check (activity in ('stars', 'serpent', 'mural', 'corners'));

-- ---------------------------------------------------------------------------
-- 2. Spots
-- ---------------------------------------------------------------------------

create table public.classlive_spots (
  room bigint not null references public.classlive_rooms (id) on delete cascade,
  player uuid not null references public.profiles (id) on delete cascade,
  x real not null check (x >= 0 and x <= 1.3),
  y real not null check (y >= 0 and y <= 1.3),
  at_ms bigint not null,
  primary key (room, player)
);
alter table public.classlive_spots enable row level security;
revoke all on public.classlive_spots from public, anon, authenticated;

-- A pupil's device saves its spot. Answers every spot in the room as [[x, y], ...] (no names, no ids), or null when the
-- caller isn't playing a live Four Corners room. Moves under 150 ms apart are not saved (the spots still come back).
create function public.classlive_move(target bigint, x double precision, y double precision)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  prev public.classlive_spots%rowtype;
  tps jsonb;
  tp jsonb;
  nx double precision;
  ny double precision;
  most double precision;
  gap double precision;
  ok boolean;
  -- MAX_SPEED in corners.ts: 0.3 × 1.6 × 1.25 board units a second.
  max_speed constant double precision := 0.6;
begin
  if me is null or x is null or y is null or x <> x or y <> y then
    return null;
  end if;
  if not exists (
    select 1 from public.classlive_rooms r join public.classlive_players p on p.room = r.id and p.player = me
    where r.id = target and r.activity = 'corners' and r.state = 'live'
  ) then
    return null;
  end if;
  nx := least(1, greatest(0, x));
  ny := least(1, greatest(0, y));
  select * into prev from public.classlive_spots s where s.room = target and s.player = me;
  if found and now_ms - prev.at_ms < 150 then
    nx := null;
  elsif found then
    most := max_speed * least(5, greatest(0, now_ms - prev.at_ms) / 1000.0) + 0.05;
    gap := sqrt((nx - prev.x) ^ 2 + (ny - prev.y) ^ 2);
    if gap > most then
      ok := false;
      select st.session #> '{game,round,teleports}' into tps from public.classlive_state st where st.room = target;
      if jsonb_typeof(tps) = 'array' then
        for tp in select * from jsonb_array_elements(tps) loop
          if (sqrt((nx - (tp #>> '{a,x}')::float8) ^ 2 + (ny - (tp #>> '{a,y}')::float8) ^ 2) < 0.12
              and sqrt((prev.x - (tp #>> '{b,x}')::float8) ^ 2 + (prev.y - (tp #>> '{b,y}')::float8) ^ 2) < 0.15)
            or (sqrt((nx - (tp #>> '{b,x}')::float8) ^ 2 + (ny - (tp #>> '{b,y}')::float8) ^ 2) < 0.12
              and sqrt((prev.x - (tp #>> '{a,x}')::float8) ^ 2 + (prev.y - (tp #>> '{a,y}')::float8) ^ 2) < 0.15) then
            ok := true;
          end if;
        end loop;
      end if;
      if not ok then
        nx := prev.x + (nx - prev.x) * most / gap;
        ny := prev.y + (ny - prev.y) * most / gap;
      end if;
    end if;
  end if;
  if nx is not null then
    insert into public.classlive_spots (room, player, x, y, at_ms) values (target, me, nx, ny, now_ms)
    on conflict (room, player) do update set x = excluded.x, y = excluded.y, at_ms = excluded.at_ms;
  end if;
  return coalesce((select jsonb_agg(jsonb_build_array(round(s.x::numeric, 4), round(s.y::numeric, 4))) from public.classlive_spots s where s.room = target), '[]'::jsonb);
end;
$$;

-- The projector: every spot with the player's avatar, for the room's teachers only. { player: { x, y, avatar } }.
create function public.classlive_positions(target bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.classlive_teaches_room(target) then
    coalesce((select jsonb_object_agg(s.player, jsonb_build_object('x', round(s.x::numeric, 4), 'y', round(s.y::numeric, 4), 'avatar', p.avatar))
      from public.classlive_spots s join public.profiles p on p.id = s.player where s.room = target), '{}'::jsonb)
  else null end
$$;

-- The projector's avatars for everyone in the room (also those who haven't moved yet). { player: avatar }.
create function public.classlive_avatars(target bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.classlive_teaches_room(target) then
    coalesce((select jsonb_object_agg(cp.player, p.avatar) from public.classlive_players cp join public.profiles p on p.id = cp.player where cp.room = target), '{}'::jsonb)
  else null end
$$;

-- The server function: every saved spot in a room. { player: { x, y } }.
create function public.classlive_room_positions(target bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(s.player, jsonb_build_object('x', s.x, 'y', s.y)), '{}'::jsonb)
  from public.classlive_spots s where s.room = target
$$;

-- The server function moves pupils: spots = [{ player, x, y }].
create function public.classlive_place(target bigint, spots jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  p jsonb;
  now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000);
begin
  for p in select * from jsonb_array_elements(coalesce(spots, '[]')) loop
    if exists (select 1 from public.classlive_players cp where cp.room = target and cp.player = (p ->> 'player')::uuid) then
      insert into public.classlive_spots (room, player, x, y, at_ms)
      values (target, (p ->> 'player')::uuid, least(1, greatest(0, (p ->> 'x')::real)), least(1, greatest(0, (p ->> 'y')::real)), now_ms)
      on conflict (room, player) do update set x = excluded.x, y = excluded.y, at_ms = excluded.at_ms;
    end if;
  end loop;
  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Rewards
-- ---------------------------------------------------------------------------

alter table public.classlive_stats add column safe_rounds integer not null default 0 check (safe_rounds >= 0);
alter table public.classlive_stats add column corner_wins integer not null default 0 check (corner_wins >= 0);
alter table public.classlive_stats add column escapes integer not null default 0 check (escapes >= 0);
alter table public.classlive_stats add column powers integer not null default 0 check (powers >= 0);

-- done: { seed, activity, goal, players: [{ player, points, stars, boxes, head, tiles, guessed, safe, champion, escapes, powers }] }.
create or replace function public.classlive_finish(target bigint, done jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  room_class uuid;
  room_school integer;
  room_lobby boolean;
  p jsonb;
  who uuid;
  reached boolean := coalesce((done ->> 'goal')::boolean, false);
  small integer;
begin
  select r.class_id, r.school_id, r.code is not null into room_class, room_school, room_lobby
  from public.classlive_rooms r where r.id = target;
  if room_class is null then
    return 'gone';
  end if;
  insert into public.classlive_finished (room, seed) values (target, (done ->> 'seed')::bigint) on conflict do nothing;
  if not found then
    return 'paid';
  end if;
  for p in select * from jsonb_array_elements(coalesce(done -> 'players', '[]')) loop
    who := (p ->> 'player')::uuid;
    if public.current_class_of(who) is distinct from room_class
      and not (room_lobby and exists (select 1 from public.profiles x where x.id = who and x.school_id = room_school and x.role = 'student')) then
      continue;
    end if;
    perform public.add_game_points(who, 'classlive', least(greatest(coalesce((p ->> 'points')::integer, 0), 0), 10),
      'classlive:' || target || ':' || (done ->> 'seed'));
    small := 500;
    insert into public.classlive_stats as s (player, sessions, stars, boxes, heads, tiles, guessed, goals, safe_rounds, corner_wins, escapes, powers)
    values (who, 1,
      least(greatest(coalesce((p ->> 'stars')::integer, 0), 0), small),
      least(greatest(coalesce((p ->> 'boxes')::integer, 0), 0), small),
      case when coalesce((p ->> 'head')::boolean, false) then 1 else 0 end,
      least(greatest(coalesce((p ->> 'tiles')::integer, 0), 0), small),
      case when coalesce((p ->> 'guessed')::boolean, false) then 1 else 0 end,
      case when reached then 1 else 0 end,
      least(greatest(coalesce((p ->> 'safe')::integer, 0), 0), small),
      case when coalesce((p ->> 'champion')::boolean, false) then 1 else 0 end,
      least(greatest(coalesce((p ->> 'escapes')::integer, 0), 0), small),
      least(greatest(coalesce((p ->> 'powers')::integer, 0), 0), small))
    on conflict (player) do update set
      sessions = s.sessions + 1,
      stars = s.stars + excluded.stars,
      boxes = s.boxes + excluded.boxes,
      heads = s.heads + excluded.heads,
      tiles = s.tiles + excluded.tiles,
      guessed = s.guessed + excluded.guessed,
      goals = s.goals + excluded.goals,
      safe_rounds = s.safe_rounds + excluded.safe_rounds,
      corner_wins = s.corner_wins + excluded.corner_wins,
      escapes = s.escapes + excluded.escapes,
      powers = s.powers + excluded.powers,
      updated_at = now();
    perform public.game_progress_changed(who, 'classlive');
  end loop;
  return 'ok';
end;
$$;

create or replace function public.classlive_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'classlive_sessions', coalesce(s.sessions, 0),
    'classlive_stars', coalesce(s.stars, 0),
    'classlive_boxes', coalesce(s.boxes, 0),
    'classlive_heads', coalesce(s.heads, 0),
    'classlive_tiles', coalesce(s.tiles, 0),
    'classlive_guessed', coalesce(s.guessed, 0),
    'classlive_goals', coalesce(s.goals, 0),
    'classlive_safe_rounds', coalesce(s.safe_rounds, 0),
    'classlive_corner_wins', coalesce(s.corner_wins, 0),
    'classlive_escapes', coalesce(s.escapes, 0),
    'classlive_powers', coalesce(s.powers, 0))
  from (select 1) one left join public.classlive_stats s on s.player = who
$$;

create or replace function public.classlive_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'Join a Class Live game: 1 point, or 3 points if you find a star, get a box right, answer a question right or are safe in a Four Corners round.',
    'Your class reaches the goal (the sky creature, the serpent awake or the picture guessed): 2 more points.',
    'Guess the Mystery Mural picture, or finish on the Four Corners podium: 2 more points.'))
$$;

insert into public.achievement_measures (measure)
values ('classlive_safe_rounds'), ('classlive_corner_wins'), ('classlive_escapes'), ('classlive_powers');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort, how, tier) values
  ('classlive-corner-dash', 'classlive', 'Corner Dash', '🏃', 'classlive_safe_rounds', 20, 9, 'Be safe in 20 Four Corners rounds.', 1),
  ('classlive-last-standing', 'classlive', 'Corner Champion', '🏆', 'classlive_corner_wins', 1, 10, 'Finish top of the Four Corners podium.', 2),
  ('classlive-great-escape', 'classlive', 'Great Escape', '🔓', 'classlive_escapes', 5, 11, 'Answer your way out of Four Corners jail 5 times.', 1),
  ('classlive-power-player', 'classlive', 'Power Player', '⚡', 'classlive_powers', 10, 12, 'Switch on 10 Four Corners power-ups.', 2);

-- ---------------------------------------------------------------------------
-- 4. The lobby button's words
-- ---------------------------------------------------------------------------

create or replace function public.classlive_here()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('room', r.id,
      'class', case when r.code is not null and r.host is not null
        then r.host || ' is starting ' || case r.activity when 'stars' then 'Star Web' when 'serpent' then 'Serpent Chain'
          when 'corners' then 'Four Corners' else 'Mystery Mural' end
        else c.name end,
      'lobby', r.code is not null, 'state', r.state, 'activity', r.activity,
      'until', to_char((r.opened_at + interval '3 hours') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
      order by r.opened_at desc), '[]'::jsonb)
  from public.classlive_open_for(auth.uid()) r
  join public.classes c on c.id = r.class_id
  where coalesce((select s.classlive_enabled from public.settings_of(auth.uid()) s), false)
$$;

-- ---------------------------------------------------------------------------
-- 5. Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function public.classlive_move(bigint, double precision, double precision), public.classlive_positions(bigint),
  public.classlive_avatars(bigint), public.classlive_room_positions(bigint), public.classlive_place(bigint, jsonb)
from public, anon, authenticated;
grant execute on function public.classlive_move(bigint, double precision, double precision), public.classlive_positions(bigint),
  public.classlive_avatars(bigint) to authenticated;
grant execute on function public.classlive_room_positions(bigint), public.classlive_place(bigint, jsonb) to service_role;
-- create or replace keeps each function's grants; these say them again so this file reads whole.
revoke execute on function public.classlive_finish(bigint, jsonb), public.classlive_counts(uuid), public.classlive_rules()
from public, anon, authenticated;
grant execute on function public.classlive_finish(bigint, jsonb) to service_role;
grant execute on function public.classlive_here() to authenticated;
