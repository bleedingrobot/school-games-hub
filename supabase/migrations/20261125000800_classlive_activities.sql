-- Class Live: one list of activities, so new games only INSERT rows (five map games are being built side by side:
-- Floor is Lava, Musical Thrones, Colour Clash, Ghost Tag, Shark Bay). Nothing is deleted.
--
--   1. public.classlive_activities: each activity's id, name, whether pupils move an avatar (classlive_move), the fastest
--      a saved move may go, and its line for the rewards page. classlive_rooms.activity must be one of them.
--   2. classlive_move() saves spots in a live room of any moving activity, clamped to that activity's max_speed
--      (teleports from session game.round.teleports still allowed, as before).
--   3. classlive_here() names the activity from the table; classlive_rules() adds each activity's reward line.
--   4. classlive_stats.extra: per-game totals { key: number }. classlive_finish adds each player's done.players[].extra
--      into it (each value 0 to 500 a session), classlive_counts returns them as 'classlive_<key>', so a game's
--      trophies only need achievement_measures and achievement_types rows.
--
-- A new activity's migration: insert into public.classlive_activities (id, name, moves, max_speed, reward_line, sort)
-- values (...); plus its achievement rows. Never create-or-replace the functions here from a game's migration.

-- ---------------------------------------------------------------------------
-- 1. The list
-- ---------------------------------------------------------------------------

create table public.classlive_activities (
  id text primary key check (id ~ '^[a-z]{3,16}$'),
  name text not null check (length(name) between 2 and 40),
  moves boolean not null default false,
  -- Board units a second (the board is a unit square).
  max_speed double precision not null default 0.6 check (max_speed > 0 and max_speed <= 3),
  reward_line text check (reward_line is null or length(reward_line) <= 300),
  sort integer not null default 100
);
alter table public.classlive_activities enable row level security;
revoke all on public.classlive_activities from public, anon, authenticated;

insert into public.classlive_activities (id, name, moves, max_speed, reward_line, sort) values
  ('stars', 'Star Web', false, 0.6, null, 1),
  ('serpent', 'Serpent Chain', false, 0.6, null, 2),
  ('mural', 'Mystery Mural', false, 0.6, 'Guess the Mystery Mural picture: 2 more points.', 3),
  -- MAX_SPEED in shared/classlive/corners.ts: 0.3 × 1.6 × 1.25.
  ('corners', 'Four Corners', true, 0.6, 'Finish on the Four Corners podium: 2 more points.', 4);

alter table public.classlive_rooms drop constraint classlive_rooms_activity_check;
alter table public.classlive_rooms add constraint classlive_rooms_activity_fkey foreign key (activity) references public.classlive_activities (id);

-- ---------------------------------------------------------------------------
-- 2. Moving
-- ---------------------------------------------------------------------------

create or replace function public.classlive_move(target bigint, x double precision, y double precision)
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
  max_speed double precision;
begin
  if me is null or x is null or y is null or x <> x or y <> y then
    return null;
  end if;
  select a.max_speed into max_speed
  from public.classlive_rooms r
  join public.classlive_players p on p.room = r.id and p.player = me
  join public.classlive_activities a on a.id = r.activity and a.moves
  where r.id = target and r.state = 'live';
  if max_speed is null then
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

-- ---------------------------------------------------------------------------
-- 3. Names and reward lines
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
        then r.host || ' is starting ' || coalesce((select a.name from public.classlive_activities a where a.id = r.activity), 'a Class Live game')
        else c.name end,
      'lobby', r.code is not null, 'state', r.state, 'activity', r.activity,
      'until', to_char((r.opened_at + interval '3 hours') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
      order by r.opened_at desc), '[]'::jsonb)
  from public.classlive_open_for(auth.uid()) r
  join public.classes c on c.id = r.class_id
  where coalesce((select s.classlive_enabled from public.settings_of(auth.uid()) s), false)
$$;

create or replace function public.classlive_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'Join a Class Live game: 1 point, or 3 points if you do some of the maths or play your part.',
    'Your class reaches the goal (the sky creature, the serpent awake or the picture guessed): 2 more points.')
    || coalesce((select jsonb_agg(a.reward_line order by a.sort, a.id) from public.classlive_activities a where a.reward_line is not null), '[]'::jsonb))
$$;

-- ---------------------------------------------------------------------------
-- 4. Per-game totals
-- ---------------------------------------------------------------------------

alter table public.classlive_stats add column extra jsonb not null default '{}'::jsonb check (jsonb_typeof(extra) = 'object');

-- done: { seed, activity, goal, players: [{ player, points, stars, boxes, head, tiles, guessed, safe, champion, escapes,
-- powers, extra: { key: number } }] }.
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
  small integer := 500;
  add jsonb;
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
    -- Extra totals: keys of 2 to 30 lowercase letters or _, whole numbers 0 to 500, at most 12 keys.
    select coalesce(jsonb_object_agg(e.key, least(greatest(floor(e.value::text::numeric), 0), small)), '{}'::jsonb) into add
    from (select key, value from jsonb_each(case when jsonb_typeof(p -> 'extra') = 'object' then p -> 'extra' else '{}'::jsonb end)
          where key ~ '^[a-z_]{2,30}$' and jsonb_typeof(value) = 'number' limit 12) e;
    insert into public.classlive_stats as s (player, sessions, stars, boxes, heads, tiles, guessed, goals, safe_rounds, corner_wins, escapes, powers, extra)
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
      least(greatest(coalesce((p ->> 'powers')::integer, 0), 0), small),
      add)
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
      extra = (select coalesce(jsonb_object_agg(k, coalesce((s.extra ->> k)::numeric, 0) + coalesce((excluded.extra ->> k)::numeric, 0)), '{}'::jsonb)
               from (select jsonb_object_keys(s.extra) k union select jsonb_object_keys(excluded.extra)) keys),
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
  select coalesce((select jsonb_object_agg('classlive_' || e.key, e.value) from jsonb_each(coalesce(s.extra, '{}'::jsonb)) e), '{}'::jsonb)
    || jsonb_build_object(
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

-- ---------------------------------------------------------------------------
-- 5. Who can call what (create or replace keeps grants; said again so this file reads whole)
-- ---------------------------------------------------------------------------

revoke execute on function public.classlive_move(bigint, double precision, double precision) from public, anon;
grant execute on function public.classlive_move(bigint, double precision, double precision) to authenticated;
revoke execute on function public.classlive_finish(bigint, jsonb), public.classlive_counts(uuid), public.classlive_rules()
from public, anon, authenticated;
grant execute on function public.classlive_finish(bigint, jsonb) to service_role;
grant execute on function public.classlive_here() to authenticated;
