-- Class Live games that start by themselves at set times (James, 25 Nov 2026 NZ; docs/plans/classlive-auto/PLAN.md).
-- A school admin sets times on the Admin page. A minute-by-minute job opens a school-wide lobby room before each time
-- (no class, no teacher: pupils' iPads only); the server function starts it at the time if enough pupils joined, or
-- calls it off (shared/classlive/server.ts, `auto`).
--
--   1. Times: classlive_times (admins only, through classlive_times_list/save/remove).
--   2. Rooms may have no class and no teacher when they belong to a time; one room per time per NZ day.
--   3. classlive_auto_open(): opens due rooms and closes stale ones; pg_cron every minute.
--   4. The join pop-up (classlive_here, classlive_open_for) and points (classlive_finish) for rooms with no class.
--   5. Who can call what.

-- ---------------------------------------------------------------------------
-- 1. Times
-- ---------------------------------------------------------------------------

create table public.classlive_times (
  id bigint generated always as identity primary key,
  school_id integer not null references public.schools (id) on delete cascade,
  -- ISO weekdays, 1 Monday to 7 Sunday.
  days smallint[] not null default '{1,2,3,4,5}' check (days <@ '{1,2,3,4,5,6,7}'::smallint[] and cardinality(days) between 1 and 7),
  -- NZ time.
  at time not null,
  activity text not null check (activity in ('serpent', 'mural', 'corners')),
  length_min smallint not null default 5 check (length_min in (2, 3, 5, 10, 15)),
  min_players smallint not null default 6 check (min_players between 2 and 40),
  open_min smallint not null default 3 check (open_min between 1 and 15),
  host text not null default 'Games Hub' check (length(host) between 1 and 30),
  -- Serpent Chain level or Four Corners map; null: a surprise (or the usual level).
  level text check (level is null or level ~ '^[a-z]{2,12}$'),
  is_on boolean not null default true,
  made_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index classlive_times_by_school on public.classlive_times (school_id);
alter table public.classlive_times enable row level security;

create function public.classlive_my_admin_school()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  school integer;
begin
  perform public.require_school_admin();
  select p.school_id into school from public.profiles p where p.id = auth.uid();
  if school is null then
    raise exception 'Only a school admin can do that.' using errcode = '42501';
  end if;
  return school;
end;
$$;

create function public.classlive_times_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  school integer := public.classlive_my_admin_school();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'days', to_jsonb(t.days), 'at', to_char(t.at, 'HH24:MI'),
      'activity', t.activity, 'length', t.length_min, 'min', t.min_players, 'open', t.open_min, 'host', t.host,
      'level', t.level, 'on', t.is_on) order by t.at, t.id)
    from public.classlive_times t where t.school_id = school), '[]'::jsonb);
end;
$$;

-- `one`: { id?, days, at ('HH:MM'), activity, length, min, open, host, level, on }. Returns the time's id.
create function public.classlive_times_save(one jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  school integer := public.classlive_my_admin_school();
  target bigint := nullif(one ->> 'id', '')::bigint;
  wanted_days smallint[];
  made bigint;
begin
  select coalesce(array_agg(distinct d::smallint order by d::smallint), '{}') into wanted_days
  from jsonb_array_elements_text(coalesce(one -> 'days', '[]')) d;
  if (one ->> 'at') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'Pick a time.' using errcode = '22023';
  end if;
  if cardinality(wanted_days) = 0 then
    raise exception 'Pick at least one day.' using errcode = '22023';
  end if;
  if target is null then
    insert into public.classlive_times (school_id, days, at, activity, length_min, min_players, open_min, host, level, is_on, made_by)
    values (school, wanted_days, (one ->> 'at')::time, one ->> 'activity', coalesce((one ->> 'length')::smallint, 5),
      coalesce((one ->> 'min')::smallint, 6), coalesce((one ->> 'open')::smallint, 3), coalesce(nullif(trim(one ->> 'host'), ''), 'Games Hub'),
      nullif(one ->> 'level', ''), coalesce((one ->> 'on')::boolean, true), auth.uid())
    returning id into made;
  else
    update public.classlive_times t set days = wanted_days, at = (one ->> 'at')::time, activity = one ->> 'activity',
      length_min = coalesce((one ->> 'length')::smallint, 5), min_players = coalesce((one ->> 'min')::smallint, 6),
      open_min = coalesce((one ->> 'open')::smallint, 3), host = coalesce(nullif(trim(one ->> 'host'), ''), 'Games Hub'),
      level = nullif(one ->> 'level', ''), is_on = coalesce((one ->> 'on')::boolean, true), made_by = auth.uid(), updated_at = now()
    where t.id = target and t.school_id = school
    returning id into made;
    if made is null then
      raise exception 'That time couldn''t be found.' using errcode = '22023';
    end if;
  end if;
  return made;
end;
$$;

-- Removes one time (a setting, not pupils' data). A room already open for it carries on.
create function public.classlive_times_remove(target bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  school integer := public.classlive_my_admin_school();
begin
  update public.classlive_rooms r set schedule_id = null where r.schedule_id = target and r.school_id = school;
  delete from public.classlive_times t where t.id = target and t.school_id = school;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Rooms with no class and no teacher
-- ---------------------------------------------------------------------------

alter table public.classlive_rooms add column schedule_id bigint references public.classlive_times (id) on delete set null;
-- The time's NZ day and start, kept even if the time is removed.
alter table public.classlive_rooms add column slot date;
alter table public.classlive_rooms add column starts_at timestamptz;
alter table public.classlive_rooms add column auto boolean not null default false;
alter table public.classlive_rooms alter column class_id drop not null;
alter table public.classlive_rooms alter column teacher drop not null;
alter table public.classlive_rooms add constraint classlive_rooms_owner check (auto or (class_id is not null and teacher is not null));
alter table public.classlive_rooms add constraint classlive_rooms_auto check (not auto or (starts_at is not null and code is not null));
create unique index classlive_rooms_one_a_day on public.classlive_rooms (schedule_id, slot) where schedule_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Opening at the time, tidying after
-- ---------------------------------------------------------------------------

create function public.classlive_auto_open()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  nz timestamp := now() at time zone 'Pacific/Auckland';
  t record;
  starts timestamptz;
  new_code text;
  new_session jsonb;
  new_view jsonb;
  made bigint;
  opened integer := 0;
begin
  for t in
    select x.* from public.classlive_times x
    where x.is_on and extract(isodow from nz)::smallint = any(x.days)
      and nz::time >= x.at - make_interval(mins => x.open_min) and nz::time < x.at
      and not exists (select 1 from public.classlive_rooms r where r.schedule_id = x.id and r.slot = nz::date)
  loop
    starts := (nz::date + t.at) at time zone 'Pacific/Auckland';
    new_code := null;
    for i in 1..20 loop
      new_code := lpad((1000 + floor(random() * 9000))::integer::text, 4, '0');
      exit when not exists (select 1 from public.classlive_rooms r where r.school_id = t.school_id and r.code = new_code
        and r.state <> 'over' and r.opened_at > now() - interval '3 hours');
      new_code := null;
    end loop;
    continue when new_code is null;
    -- Session in shared/classlive/server.ts; the game itself is made on the first step.
    new_session := jsonb_build_object('seed', floor(random() * 2147483647)::bigint, 'activity', t.activity, 'state', 'lobby',
      'lengthMin', t.length_min, 'players', '{}'::jsonb, 'order', '[]'::jsonb, 'game', null,
      'lobby', jsonb_build_object('code', new_code, 'host', t.host), 'padMusic', true,
      'auto', jsonb_build_object('startsAt', floor(extract(epoch from starts) * 1000)::bigint, 'min', t.min_players, 'level', t.level));
    new_view := jsonb_build_object('activity', t.activity, 'state', 'lobby', 'lengthMin', t.length_min, 'startedAt', null, 'players', 0,
      'game', null, 'lobby', new_session -> 'lobby', 'padMusic', true,
      'auto', jsonb_build_object('startsAt', new_session -> 'auto' -> 'startsAt', 'min', t.min_players, 'calledOff', false));
    insert into public.classlive_rooms (class_id, school_id, teacher, activity, state, show_names, view, code, host, schedule_id, slot, starts_at, auto)
    values (null, t.school_id, null, t.activity, 'lobby', true, new_view, new_code, t.host, t.id, nz::date, starts, true)
    on conflict (schedule_id, slot) where schedule_id is not null do nothing
    returning id into made;
    continue when made is null;
    insert into public.classlive_state (room, session) values (made, new_session);
    insert into public.classlive_screens (room, screen, seq) values (made, jsonb_build_object('events', '[]'::jsonb), 0);
    opened := opened + 1;
  end loop;

  -- Nobody's device moved it on: still waiting 2 minutes after the start, or still open 10 minutes after the end.
  update public.classlive_state s set session = s.session || jsonb_build_object('state', 'over')
  from public.classlive_rooms r
  where r.id = s.room and r.auto and r.state <> 'over'
    and ((r.state = 'lobby' and r.starts_at < now() - interval '2 minutes')
      or r.starts_at < now() - make_interval(mins => coalesce((r.view ->> 'lengthMin')::integer, 15) + 10));
  update public.classlive_rooms r set state = 'over', version = r.version + 1, updated_at = now(), view = r.view || jsonb_build_object('state', 'over')
  where r.auto and r.state <> 'over'
    and ((r.state = 'lobby' and r.starts_at < now() - interval '2 minutes')
      or r.starts_at < now() - make_interval(mins => coalesce((r.view ->> 'lengthMin')::integer, 15) + 10));
  return opened;
end;
$$;

select cron.schedule('classlive-auto-open', '* * * * *', 'select public.classlive_auto_open()');

-- ---------------------------------------------------------------------------
-- 4. The join pop-up and points for rooms with no class
-- ---------------------------------------------------------------------------

-- As 20261125000200_classlive_lobby.sql, and a set-time room stops asking once its start has passed in the lobby.
create or replace function public.classlive_open_for(me uuid)
returns setof public.classlive_rooms
language sql
stable
security definer
set search_path = ''
as $$
  select r.* from public.classlive_rooms r
  where r.state in ('lobby', 'live') and r.opened_at > now() - interval '3 hours'
    and not (r.auto and r.state = 'lobby' and r.starts_at < now() - interval '30 seconds')
    and (
      exists (select 1 from public.class_members m where m.class_id = r.class_id and m.student_id = me)
      or (r.code is not null and exists (select 1 from public.profiles p where p.id = me and p.school_id = r.school_id))
    )
    and not exists (select 1 from public.classlive_players p where p.room = r.id and p.player = me)
$$;

-- As 20261125000300_classlive_corners.sql, with rooms that have no class.
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
        else coalesce(c.name, 'your class') end,
      'lobby', r.code is not null, 'state', r.state, 'activity', r.activity,
      'until', to_char((r.opened_at + interval '3 hours') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
      order by r.opened_at desc), '[]'::jsonb)
  from public.classlive_open_for(auth.uid()) r
  left join public.classes c on c.id = r.class_id
  where coalesce((select s.classlive_enabled from public.settings_of(auth.uid()) s), false)
$$;

-- As 20261125000300_classlive_corners.sql, but a room with no class (a set-time game) pays pupils of its school.
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
  if room_school is null then
    return 'gone';
  end if;
  insert into public.classlive_finished (room, seed) values (target, (done ->> 'seed')::bigint) on conflict do nothing;
  if not found then
    return 'paid';
  end if;
  for p in select * from jsonb_array_elements(coalesce(done -> 'players', '[]')) loop
    who := (p ->> 'player')::uuid;
    if (room_class is null or public.current_class_of(who) is distinct from room_class)
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

-- ---------------------------------------------------------------------------
-- 5. Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function public.classlive_my_admin_school(), public.classlive_times_list(), public.classlive_times_save(jsonb),
  public.classlive_times_remove(bigint), public.classlive_auto_open()
from public, anon, authenticated;
grant execute on function public.classlive_times_list(), public.classlive_times_save(jsonb), public.classlive_times_remove(bigint) to authenticated;
-- create or replace keeps each function's grants; these say them again so this file reads whole.
revoke execute on function public.classlive_open_for(uuid), public.classlive_finish(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.classlive_finish(bigint, jsonb) to service_role;
grant execute on function public.classlive_here() to authenticated;
