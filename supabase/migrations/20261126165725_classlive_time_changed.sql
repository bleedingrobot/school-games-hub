-- A set time changed after today's game already opened opens again at the new time (James, 26 Nov 2026 NZ: the 4 pm
-- Four Corners was first saved as 4 am, opened at 3:59 am with nobody, then was moved to 4 pm and skipped because today
-- was "done"). Each minute, today's finished rooms whose start is not the set time's current start let go of the set
-- time (schedule_id null, as deleting a time does), so the one-a-day index and check let the new time open. Nothing is
-- deleted; this replaces classlive_auto_open (20261126143610_classlive_one_game).

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
  -- Today's finished room from before the time was changed lets go of it (a room still on keeps it).
  update public.classlive_rooms r set schedule_id = null
  from public.classlive_times x
  where r.schedule_id = x.id and r.slot = nz::date and r.state = 'over'
    and r.starts_at is distinct from ((nz::date + x.at) at time zone 'Pacific/Auckland');

  for t in
    select x.* from public.classlive_times x
    where x.is_on and extract(isodow from nz)::smallint = any(x.days)
      and nz::time >= x.at - make_interval(mins => x.open_min) and nz::time < x.at
      and not exists (select 1 from public.classlive_rooms r where r.schedule_id = x.id and r.slot = nz::date)
  loop
    -- The limit (shared/classlive/limits.ts): one live game at a time. Tried again next minute while the slot is
    -- still opening.
    continue when jsonb_array_length(public.classlive_open_games()) >= 1;
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
