-- Class Live limits (James, 26 Nov 2026 NZ, after the database stalled twice in one morning with two classes playing):
-- a joystick game (classlive_activities.moves) runs in one class at a time, and at most two Class Live or Showdown games
-- run at once. Rules in shared/classlive/limits.ts. Nothing is deleted; this adds two functions and replaces
-- classlive_auto_open (set-time games follow the same rules).
--
--   1. classlive_open_games(): the games running now, for the server functions' open step.
--   2. classlive_games_running(): the same list for teachers, so the picker shows which games are locked.
--   3. classlive_auto_open(): a set-time game doesn't open when the limits are reached; a Kids vote opened while a
--      joystick game is on offers only games that don't move (session.auto.noMoving).

-- ---------------------------------------------------------------------------
-- 1. Games running now
-- ---------------------------------------------------------------------------

-- A game counts while it isn't over and something happened in it in the last 15 minutes (a room a teacher walked away
-- from stops counting). A Kids vote counts as a joystick game until its winner is known, unless it can't pick one.
create function public.classlive_open_games()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(g order by g.room), '[]'::jsonb) from (
    select r.id as room, 'classlive' as kind, coalesce(st.session ->> 'activity', r.activity) as activity,
      coalesce(a.name, 'Class Live') as name,
      case
        when st.session #> '{auto,vote}' is not null and st.session #>> '{auto,vote,winner}' is null then
          case when st.session #> '{auto,vote,choices}' is null then not coalesce((st.session #>> '{auto,noMoving}')::boolean, false)
               else exists (select 1 from jsonb_array_elements_text(st.session #> '{auto,vote,choices}') c(id)
                            join public.classlive_activities m on m.id = c.id where m.moves) end
        else coalesce(a.moves, false) end as moving,
      r.class_id, coalesce(c.name, r.host, 'A set-time game') as who
    from public.classlive_rooms r
    left join public.classlive_state st on st.room = r.id
    left join public.classlive_activities a on a.id = coalesce(st.session ->> 'activity', r.activity)
    left join public.classes c on c.id = r.class_id
    where r.state <> 'over' and r.updated_at > now() - interval '15 minutes' and r.opened_at > now() - interval '3 hours'
    union all
    select s.id, 'showdown', 'showdown', 'Class Showdown', false, s.class_id, coalesce(c.name, 'Another class')
    from public.showdown_rooms s
    left join public.classes c on c.id = s.class_id
    where s.state <> 'over' and s.updated_at > now() - interval '15 minutes' and s.opened_at > now() - interval '3 hours'
  ) g
$$;

revoke execute on function public.classlive_open_games() from public, anon, authenticated;
grant execute on function public.classlive_open_games() to service_role;

-- ---------------------------------------------------------------------------
-- 2. The same list for teachers (no room numbers)
-- ---------------------------------------------------------------------------

create function public.classlive_games_running()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_teacher() then
    return '[]'::jsonb;
  end if;
  return (select coalesce(jsonb_agg(g - 'room'), '[]'::jsonb) from jsonb_array_elements(public.classlive_open_games()) g);
end;
$$;

revoke execute on function public.classlive_games_running() from public, anon, authenticated;
grant execute on function public.classlive_games_running() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Set-time games follow the limits
-- ---------------------------------------------------------------------------

create or replace function public.classlive_auto_open()
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
  running jsonb;
  movers integer;
begin
  for t in
    select x.* from public.classlive_times x
    where x.is_on and extract(isodow from nz)::smallint = any(x.days)
      and nz::time >= x.at - make_interval(mins => x.open_min) and nz::time < x.at
      and not exists (select 1 from public.classlive_rooms r where r.schedule_id = x.id and r.slot = nz::date)
  loop
    -- The limits (shared/classlive/limits.ts): two games at once, one joystick game. Tried again next minute while
    -- the slot is still opening.
    running := public.classlive_open_games();
    continue when jsonb_array_length(running) >= 2;
    select count(*) into movers from jsonb_array_elements(running) g where (g ->> 'moving')::boolean;
    continue when movers >= 1 and exists (select 1 from public.classlive_activities a where a.id = t.activity and a.moves);
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
    -- Kids vote: Serpent Chain stands in until the first step picks the three games (shared/classlive/server.ts).
    new_session := jsonb_build_object('seed', floor(random() * 2147483647)::bigint,
      'activity', case when t.activity = 'vote' then 'serpent' else t.activity end, 'state', 'lobby',
      'lengthMin', t.length_min, 'players', '{}'::jsonb, 'order', '[]'::jsonb, 'game', null,
      'lobby', jsonb_build_object('code', new_code, 'host', t.host), 'padMusic', true,
      'auto', jsonb_build_object('startsAt', floor(extract(epoch from starts) * 1000)::bigint, 'min', t.min_players, 'level', t.level)
        || case when t.activity = 'vote' then jsonb_build_object('vote', jsonb_build_object('picks', '{}'::jsonb)) else '{}'::jsonb end
        || case when t.activity = 'vote' and movers >= 1 then jsonb_build_object('noMoving', true) else '{}'::jsonb end);
    new_view := jsonb_build_object('activity', new_session ->> 'activity', 'state', 'lobby', 'lengthMin', t.length_min, 'startedAt', null, 'players', 0,
      'game', null, 'lobby', new_session -> 'lobby', 'padMusic', true,
      'auto', jsonb_build_object('startsAt', new_session -> 'auto' -> 'startsAt', 'min', t.min_players, 'calledOff', false));
    insert into public.classlive_rooms (class_id, school_id, teacher, activity, state, show_names, view, code, host, schedule_id, slot, starts_at, auto, vote)
    values (null, t.school_id, null, new_session ->> 'activity', 'lobby', true, new_view, new_code, t.host, t.id, nz::date, starts, true, t.activity = 'vote')
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
