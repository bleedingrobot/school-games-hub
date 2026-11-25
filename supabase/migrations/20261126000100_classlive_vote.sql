-- Class Live times: "Kids vote" (James, 25 Nov 2026 NZ: "kids in the waiting room vote on the game that gets started").
-- A time whose game is 'vote' opens a room whose pupils vote for one of three games (picked on the first step,
-- shared/classlive/server.ts); at the start the winner is made and started.
--
--   1. classlive_times may say 'vote'; rooms keep a `vote` flag while voting.
--   2. classlive_auto_open() writes a vote room (Serpent Chain stands in until the first step).
--   3. classlive_save keeps the room's activity in step with the session (the winner), and clears `vote`.
--   4. The pop-up says "Games Hub is starting a Class Live game. Come and vote" while voting.

alter table public.classlive_times drop constraint classlive_times_activity_check;
alter table public.classlive_times add constraint classlive_times_activity_check
  check (activity in ('serpent', 'mural', 'corners', 'shark', 'ghost', 'clash', 'thrones', 'lava', 'vote'));
alter table public.classlive_rooms add column vote boolean not null default false;

-- As 20261125001700_classlive_auto.sql, with Kids vote.
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
    -- Kids vote: Serpent Chain stands in until the first step picks the three games (shared/classlive/server.ts).
    new_session := jsonb_build_object('seed', floor(random() * 2147483647)::bigint,
      'activity', case when t.activity = 'vote' then 'serpent' else t.activity end, 'state', 'lobby',
      'lengthMin', t.length_min, 'players', '{}'::jsonb, 'order', '[]'::jsonb, 'game', null,
      'lobby', jsonb_build_object('code', new_code, 'host', t.host), 'padMusic', true,
      'auto', jsonb_build_object('startsAt', floor(extract(epoch from starts) * 1000)::bigint, 'min', t.min_players, 'level', t.level)
        || case when t.activity = 'vote' then jsonb_build_object('vote', jsonb_build_object('picks', '{}'::jsonb)) else '{}'::jsonb end);
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


-- As 20261124000700_classlive_mural.sql, keeping the room's activity and vote flag in step.
create or replace function public.classlive_save(target bigint, seen_version integer, session jsonb, view jsonb, screen jsonb,
  started_ms bigint, players jsonb, claim jsonb default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_version integer;
begin
  select r.version into now_version from public.classlive_rooms r where r.id = target for update;
  if now_version is null then
    raise exception 'No such room' using errcode = '22023';
  end if;
  if now_version <> seen_version then
    return 'stale';
  end if;
  if claim is not null then
    update public.classlive_questions q
    set answered = true, value = (claim ->> 'value')::numeric, right_answer = (claim ->> 'right')::boolean
    where q.room = target and q.player = (claim ->> 'player')::uuid and q.slot = (claim ->> 'slot')::integer and not q.answered;
    if not found then
      return 'answered';
    end if;
  end if;
  update public.classlive_rooms r
  set version = r.version + 1, state = session ->> 'state', view = classlive_save.view,
      activity = coalesce(session ->> 'activity', r.activity),
      vote = coalesce(r.vote and session ->> 'state' = 'lobby' and not (session -> 'auto' -> 'vote' ? 'winner'), false),
      started_ms = classlive_save.started_ms, updated_at = now()
  where r.id = target;
  update public.classlive_state s set session = classlive_save.session where s.room = target;
  update public.classlive_screens sc set screen = classlive_save.screen, seq = coalesce((classlive_save.screen ->> 'seq')::integer, sc.seq),
    updated_at = now()
  where sc.room = target;
  insert into public.classlive_players as p (room, player, view, updated_at)
  select target, (v ->> 'player')::uuid, v, now() from jsonb_array_elements(coalesce(players, '[]'::jsonb)) v
  on conflict (room, player) do update set view = excluded.view, updated_at = now();
  return 'ok';
end;
$$;

-- As 20261125001700_classlive_auto.sql, with the vote words.
create or replace function public.classlive_here()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('room', r.id,
      'class', case when r.vote and r.state = 'lobby' then coalesce(r.host, 'Games Hub') || ' is starting a Class Live game. Come and vote'
        when r.code is not null and r.host is not null
        then r.host || ' is starting ' || coalesce((select a.name from public.classlive_activities a where a.id = r.activity), 'a Class Live game')
        else coalesce(c.name, 'your class') end,
      'lobby', r.code is not null, 'state', r.state, 'activity', r.activity,
      'until', to_char((r.opened_at + interval '3 hours') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
      order by r.opened_at desc), '[]'::jsonb)
  from public.classlive_open_for(auth.uid()) r
  left join public.classes c on c.id = r.class_id
  where coalesce((select s.classlive_enabled from public.settings_of(auth.uid()) s), false)
$$;

revoke execute on function public.classlive_auto_open(), public.classlive_save(bigint, integer, jsonb, jsonb, jsonb, bigint, jsonb, jsonb)
from public, anon, authenticated;
grant execute on function public.classlive_save(bigint, integer, jsonb, jsonb, jsonb, bigint, jsonb, jsonb) to service_role;
grant execute on function public.classlive_here() to authenticated;
