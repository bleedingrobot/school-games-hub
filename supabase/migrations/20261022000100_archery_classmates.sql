-- Archery Challenge, stage 6: fights against classmates (docs/ARCHERY-PLAN.md, section 7, "Classmate fights").
--
-- NOT APPLIED to the live database. Apply after 20261021000300_archery.sql.
--
-- A pupil sees which classmates have the game open, challenges one (same school and class only), the classmate says
-- yes or no, both pack their quivers (the packed gear comes out of their bags, as for a bot fight), and they take turns
-- through the `archery` server function, which plays every shot with the game's own engine (shared/archery). A
-- classmate fight is one round (James, 22 Oct 2026). Both screens hear each change through Realtime on the fight row.
--
-- 1. archery_here: when each pupil last said "I'm here" (the game is open), for the Challenge a classmate list.
-- 2. archery_duels: one row per classmate fight: the two players, the world and seed, both packs, the turns played,
--    what each has used, whose turn and its deadline, time-outs in a row, and how it ended. Its two players can read
--    it (so Realtime can send it to them, the Power Clash way); nobody can write it except the server functions.
-- 3. archery_here(): the one function a pupil calls directly: "I'm here", and who else is, and any challenges.
--    Display names only, never coins or maths results.
-- 4. Server-only functions for the server function: challenge, answer, pack, move, end, load; and the tidy-up.
-- 5. Points: How points work gets the classmate line. New Season and "last played" include classmate fights.
--
-- Coins never change in a classmate fight. Gear does: packed gear is taken out when a pupil packs, and when the fight
-- ends each player gets back what they packed less what they used (all of it if the fight never started).

-- ---------------------------------------------------------------------------
-- 1. Who has the game open
-- ---------------------------------------------------------------------------

create table public.archery_here (
  player uuid primary key references public.profiles (id) on delete cascade,
  seen_at timestamptz not null default now()
);
alter table public.archery_here enable row level security;
revoke all on public.archery_here from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The fights
-- ---------------------------------------------------------------------------

create table public.archery_duels (
  id bigint generated always as identity primary key,
  -- seat_a challenged and is the left archer (seat 0, who shoots first); seat_b is the right archer (seat 1).
  seat_a uuid not null references public.profiles (id) on delete cascade,
  seat_b uuid not null references public.profiles (id) on delete cascade,
  -- Display names when the challenge was sent (what the two screens show; never real names).
  name_a text not null,
  name_b text not null,
  world text not null check (world in ('forest', 'desert', 'snow', 'city')),
  seed bigint not null check (seed between 0 and 4294967295),
  -- asked: waiting for seat_b's answer. packing: both packing their quivers. playing. done: ended after it started.
  -- declined / expired / cancelled: it never started.
  status text not null default 'asked' check (status in ('asked', 'packing', 'playing', 'done', 'declined', 'expired', 'cancelled')),
  -- [pack of seat 0 | null, pack of seat 1 | null]: { quiver: { id: n }, shield, bow }
  packs jsonb not null default '[null, null]' check (jsonb_typeof(packs) = 'array' and jsonb_array_length(packs) = 2),
  -- The turns played so far: shots { angle, power, arrow, apple? } and used-up turns { pass: true }.
  turns jsonb not null default '[]' check (jsonb_typeof(turns) = 'array' and jsonb_array_length(turns) <= 60),
  -- What each seat has used so far: [{ id: n }, { id: n }]. The tidy-up gives back packs less this.
  used jsonb not null default '[{}, {}]' check (jsonb_typeof(used) = 'array' and jsonb_array_length(used) = 2),
  -- Turns used up by the timer in a row, per seat.
  timeouts integer[] not null default '{0, 0}' check (array_length(timeouts, 1) = 2),
  -- When the challenge or the packing runs out, or the turn's 45 seconds end.
  deadline timestamptz not null,
  -- 0 or 1; null for a draw, or one that ended without a winner.
  winner smallint check (winner in (0, 1)),
  -- finished (played to the end), left (someone gave up: the other wins, nobody gets points), timeouts (three turns used
  -- up in a row: nobody wins), switched-off (a teacher switched the game off), idle (the tidy-up: nobody played for a while).
  ending text check (ending in ('finished', 'left', 'timeouts', 'switched-off', 'idle')),
  -- Who left, or let the timer run out three times (0 or 1).
  leaver smallint check (leaver in (0, 1)),
  -- Goes up by one with every change. The server saves only if it hasn't moved since it looked.
  version integer not null default 0,
  created_at timestamptz not null default now(),
  -- The last real shot (a used-up turn doesn't count): how the tidy-up spots a fight both have walked away from.
  last_action_at timestamptz not null default now(),
  finished_at timestamptz,
  check (seat_a <> seat_b)
);
create index archery_duels_a on public.archery_duels (seat_a, created_at desc);
create index archery_duels_b on public.archery_duels (seat_b, created_at desc);
create index archery_duels_open on public.archery_duels (deadline) where status in ('asked', 'packing', 'playing');

alter table public.archery_duels enable row level security;
revoke all on public.archery_duels from anon, authenticated;
grant select on public.archery_duels to authenticated;

-- A pupil reads only the fights they're in (both players see both packs: nothing in a fight is hidden). Realtime checks
-- this rule for every change, so only the two players hear about it. Teachers see them in Stage 7's panel, not here.
create policy "Players see their own Archery classmate fights"
on public.archery_duels for select to authenticated
using ((select public.is_school_user()) and (select auth.uid()) in (seat_a, seat_b));

alter publication supabase_realtime add table public.archery_duels;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Is the game switched on for this pupil's class (or their school's default)?
create function public.archery_on_for(player uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.archery_enabled from public.settings_of(player) s), false)
$$;

-- Is this pupil in a classmate fight that has been accepted (packing or playing)?
create function public.archery_duel_busy(player uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.archery_duels d
    where d.status in ('packing', 'playing') and archery_duel_busy.player in (d.seat_a, d.seat_b))
$$;

-- Holds both players (in the same order every time) until the transaction ends, so two challenges or answers at the
-- same moment can't put a pupil in two fights.
create function public.archery_lock_pair(a uuid, b uuid)
returns void
language sql
volatile
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended('archery-duel:' || least(a, b)::text, 0)),
         pg_advisory_xact_lock(hashtextextended('archery-duel:' || greatest(a, b)::text, 0))
$$;

-- Gives back what each seat packed less what it used (`used` [{}, {}]; all of it if they never started), and marks the
-- fight ended. Only if it's still at `version` and not already over; returns the row, or null if it had changed.
create function public.archery_duel_close(
  duel bigint, version integer, status text, ending text, winner smallint, leaver smallint, turns jsonb, used jsonb, timeouts integer[]
)
returns public.archery_duels
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.archery_duels;
  i integer;
  who uuid;
begin
  if status not in ('done', 'declined', 'expired', 'cancelled') then
    raise exception 'That ending is not right.' using errcode = '22023';
  end if;
  update public.archery_duels x set
    status = archery_duel_close.status,
    ending = archery_duel_close.ending,
    winner = archery_duel_close.winner,
    leaver = archery_duel_close.leaver,
    turns = coalesce(archery_duel_close.turns, x.turns),
    used = coalesce(archery_duel_close.used, x.used),
    timeouts = coalesce(archery_duel_close.timeouts, x.timeouts),
    finished_at = now(),
    version = x.version + 1
  where x.id = archery_duel_close.duel and x.version = archery_duel_close.version and x.status in ('asked', 'packing', 'playing')
  returning * into d;
  if not found then
    return null;
  end if;
  for i in 0..1 loop
    continue when d.packs -> i is null or jsonb_typeof(d.packs -> i) <> 'object';
    who := case when i = 0 then d.seat_a else d.seat_b end;
    update public.archery_players p
    set gear = public.archery_gear_plus(p.gear, public.archery_gear_plus(d.packs -> i -> 'quiver', d.used -> i, -1), 1), updated_at = now()
    where p.player = who;
  end loop;
  return d;
end;
$$;

-- Ends this pupil's own challenges and packing that have run out (a closed page can't), so their gear is never stuck.
create function public.archery_duel_tidy_for(player uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.archery_duels;
begin
  for d in
    select * from public.archery_duels x
    where x.status in ('asked', 'packing') and x.deadline < now() and archery_duel_tidy_for.player in (x.seat_a, x.seat_b)
  loop
    perform public.archery_duel_close(d.id, d.version, case when d.status = 'asked' then 'expired' else 'cancelled' end, null, null, null, null, null, null);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. "I'm here" (the one function a pupil calls directly)
-- ---------------------------------------------------------------------------

-- Notes that this pupil has the game open (the screen calls this every 30 seconds while it is), and returns:
--   online:  classmates in the same school and class who have it open (seen in the last 75 seconds), as
--            { id, name, avatar, busy } (busy: in a fight already). Display names only.
--   asks:    challenges waiting for this pupil's answer, as { duel, from, world, deadline }.
--   duel:    this pupil's open classmate fight (asked by them, packing or playing), or null: a backup to Realtime.
--   off:     true if the game is switched off for their class (then nothing else).
create function public.archery_here()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  my_class uuid;
  my_school integer;
begin
  if not public.is_school_user() or not exists (select 1 from public.profiles p where p.id = me and p.role = 'student' and not p.hidden) then
    return jsonb_build_object('online', '[]'::jsonb, 'asks', '[]'::jsonb, 'duel', null);
  end if;
  if not public.archery_on_for(me) then
    return jsonb_build_object('off', true);
  end if;
  insert into public.archery_here as h (player, seen_at) values (me, now())
  on conflict (player) do update set seen_at = now();
  perform public.archery_duel_tidy_for(me);
  my_class := public.current_class_of(me);
  select p.school_id into my_school from public.profiles p where p.id = me;
  return jsonb_build_object(
    'online', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'avatar', p.avatar, 'busy', public.archery_duel_busy(p.id)) order by p.display_name)
      from public.archery_here h
      join public.profiles p on p.id = h.player
      where my_class is not null
        and h.seen_at > now() - interval '75 seconds'
        and p.id <> me and p.role = 'student' and not p.hidden and p.school_id = my_school
        and public.current_class_of(p.id) = my_class), '[]'::jsonb),
    'asks', coalesce((
      select jsonb_agg(jsonb_build_object('duel', d.id, 'from', d.name_a, 'world', d.world, 'deadline', d.deadline) order by d.created_at)
      from public.archery_duels d
      where d.seat_b = me and d.status = 'asked' and d.deadline > now()), '[]'::jsonb),
    'duel', (
      select to_jsonb(d) from public.archery_duels d
      where (d.status in ('packing', 'playing') and me in (d.seat_a, d.seat_b)) or (d.status = 'asked' and d.seat_a = me)
      order by d.created_at desc limit 1));
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. The server function's steps
-- ---------------------------------------------------------------------------

-- One fight and whether the game is on for each player's class: { duel, on: [a, b] }, or null.
create function public.archery_duel_load(duel bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('duel', to_jsonb(d), 'on', jsonb_build_array(public.archery_on_for(d.seat_a), public.archery_on_for(d.seat_b)))
  from public.archery_duels d where d.id = archery_duel_load.duel
$$;

-- `player` challenges `other` to a fight in `world` (the seed is the server function's). Returns { result, duel }:
--   ok         the challenge is sent (any older challenge this pupil sent is cancelled);
--   away       they don't have the game open, or aren't a pupil here;
--   class      they're in another class or school (or have no class);
--   busy       one of them is in a fight already;
--   off        the game is switched off for their class.
-- The same request_id again gets the first reply.
create function public.archery_duel_challenge(player uuid, request_id text, other uuid, world text, seed bigint, wait_ms integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  reply jsonb;
  me public.profiles;
  them public.profiles;
  result text := 'ok';
  d public.archery_duels;
  old public.archery_duels;
begin
  perform public.gem_keep_check_player(player);
  if wait_ms not between 10000 and 600000 then
    raise exception 'That wait is not right.' using errcode = '22023';
  end if;
  select r.reply into reply from public.archery_requests r where r.player = archery_duel_challenge.player and r.request_id = archery_duel_challenge.request_id;
  if reply is not null then
    return reply;
  end if;
  perform public.archery_lock_pair(player, other);
  select * into me from public.profiles p where p.id = player;
  select * into them from public.profiles p where p.id = other;
  if them.id is null or them.id = me.id or them.role <> 'student' or them.hidden
     or not exists (select 1 from public.archery_here h where h.player = other and h.seen_at > now() - interval '75 seconds') then
    result := 'away';
  elsif them.school_id is distinct from me.school_id or public.current_class_of(player) is null
     or public.current_class_of(player) is distinct from public.current_class_of(other) then
    result := 'class';
  elsif not public.archery_on_for(other) then
    result := 'off';
  elsif public.archery_duel_busy(player) or public.archery_duel_busy(other) then
    result := 'busy';
  else
    for old in select * from public.archery_duels x where x.seat_a = archery_duel_challenge.player and x.status = 'asked' loop
      perform public.archery_duel_close(old.id, old.version, 'cancelled', null, null, null, null, null, null);
    end loop;
    insert into public.archery_duels (seat_a, seat_b, name_a, name_b, world, seed, deadline)
    values (player, other, me.display_name, them.display_name, world, seed, now() + make_interval(secs => wait_ms / 1000.0))
    returning * into d;
  end if;
  reply := jsonb_build_object('result', result, 'duel', d.id);
  delete from public.archery_requests r where r.created_at < now() - interval '2 days';
  insert into public.archery_requests (player, request_id, reply) values (player, request_id, reply);
  return reply;
end;
$$;

-- The challenged pupil says yes (then both pack, for up to pack_ms) or no. Returns { result, duel (the row) }:
-- ok, late (it ran out or was cancelled), busy (they're in another fight), not-yours.
create function public.archery_duel_answer(player uuid, duel bigint, accept boolean, pack_ms integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.archery_duels;
begin
  perform public.gem_keep_check_player(player);
  if pack_ms not between 10000 and 600000 or accept is null then
    raise exception 'That answer is not right.' using errcode = '22023';
  end if;
  select * into d from public.archery_duels x where x.id = archery_duel_answer.duel;
  if d.id is null or d.seat_b <> player then
    return jsonb_build_object('result', 'not-yours');
  end if;
  perform public.archery_lock_pair(d.seat_a, d.seat_b);
  select * into d from public.archery_duels x where x.id = archery_duel_answer.duel for update;
  if d.status <> 'asked' or d.deadline <= now() then
    return jsonb_build_object('result', 'late', 'duel', to_jsonb(d));
  end if;
  if not accept then
    d := public.archery_duel_close(d.id, d.version, 'declined', null, null, null, null, null, null);
    return jsonb_build_object('result', 'ok', 'duel', to_jsonb(d));
  end if;
  if public.archery_duel_busy(d.seat_a) or public.archery_duel_busy(d.seat_b) then
    return jsonb_build_object('result', 'busy', 'duel', to_jsonb(d));
  end if;
  update public.archery_duels x set status = 'packing', deadline = now() + make_interval(secs => pack_ms / 1000.0), version = x.version + 1
  where x.id = d.id returning * into d;
  return jsonb_build_object('result', 'ok', 'duel', to_jsonb(d));
end;
$$;

-- A player packs their quiver: any bot fight they still have open is given up first (its gear comes back, as when a new
-- bot fight starts), then the pack must be theirs, and it comes out of their bag. When both have packed, the fight
-- starts: seat 0 shoots first, with turn_ms on the clock. Returns { result, duel, state (their Armory) }:
-- ok, already (they had packed: a request sent twice counts once), gear (not all theirs), late, not-yours.
create function public.archery_duel_pack(player uuid, duel bigint, pack jsonb, turn_ms integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.archery_duels;
  p public.archery_players;
  f record;
  seat integer;
begin
  perform public.gem_keep_check_player(player);
  if jsonb_typeof(pack) <> 'object' or jsonb_typeof(coalesce(pack -> 'quiver', '{}')) <> 'object' or turn_ms not between 10000 and 600000 then
    raise exception 'That quiver is not right.' using errcode = '22023';
  end if;
  select * into d from public.archery_duels x where x.id = archery_duel_pack.duel for update;
  seat := case when d.seat_a = player then 0 when d.seat_b = player then 1 end;
  if d.id is null or seat is null then
    return jsonb_build_object('result', 'not-yours');
  end if;
  insert into public.archery_players (player) values (player) on conflict do nothing;
  select * into p from public.archery_players x where x.player = archery_duel_pack.player for update;
  if jsonb_typeof(d.packs -> seat) = 'object' then
    return jsonb_build_object('result', 'already', 'duel', to_jsonb(d), 'state', public.archery_view(p));
  end if;
  if d.status <> 'packing' or d.deadline <= now() then
    return jsonb_build_object('result', 'late', 'duel', to_jsonb(d), 'state', public.archery_view(p));
  end if;
  for f in
    update public.archery_fights x set status = 'abandoned', finished_at = now()
    where x.player = archery_duel_pack.player and x.status = 'playing'
    returning x.pack
  loop
    p.gear := public.archery_gear_plus(p.gear, f.pack -> 'quiver', 1);
  end loop;
  if not public.archery_has_gear(p.gear, pack -> 'quiver')
     or (pack ->> 'shield' is not null and not p.shields ? (pack ->> 'shield'))
     or (coalesce(pack ->> 'bow', 'starter') <> 'starter' and not p.bows ? (pack ->> 'bow')) then
    update public.archery_players x set gear = p.gear, updated_at = now() where x.player = archery_duel_pack.player returning * into p;
    return jsonb_build_object('result', 'gear', 'duel', to_jsonb(d), 'state', public.archery_view(p));
  end if;
  update public.archery_players x set gear = public.archery_gear_plus(p.gear, pack -> 'quiver', -1), updated_at = now()
  where x.player = archery_duel_pack.player returning * into p;
  d.packs := jsonb_set(d.packs, array[seat::text], pack);
  update public.archery_duels x set
    packs = d.packs,
    status = case when jsonb_typeof(d.packs -> (1 - seat)) = 'object' then 'playing' else 'packing' end,
    deadline = case when jsonb_typeof(d.packs -> (1 - seat)) = 'object' then now() + make_interval(secs => turn_ms / 1000.0) else x.deadline end,
    last_action_at = now(),
    version = x.version + 1
  where x.id = d.id
  returning * into d;
  return jsonb_build_object('result', 'ok', 'duel', to_jsonb(d), 'state', public.archery_view(p));
end;
$$;

-- Saves a turn the server function has played: the new turn list, what each has used, the time-outs and the next
-- deadline. Only if the fight is still at `version` and playing; returns the row, or null if it had changed.
-- `played` is a real shot (a used-up turn doesn't count as anyone playing).
create function public.archery_duel_move(duel bigint, version integer, turns jsonb, used jsonb, timeouts integer[], deadline_ms bigint, played boolean)
returns public.archery_duels
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.archery_duels;
begin
  update public.archery_duels x set
    turns = archery_duel_move.turns,
    used = archery_duel_move.used,
    timeouts = archery_duel_move.timeouts,
    deadline = to_timestamp(deadline_ms / 1000.0),
    last_action_at = case when played then now() else x.last_action_at end,
    version = x.version + 1
  where x.id = archery_duel_move.duel and x.version = archery_duel_move.version and x.status = 'playing'
  returning * into d;
  if not found then
    return null;
  end if;
  return d;
end;
$$;

-- Ends a fight the server function has played (or one that never started), giving the gear back: see archery_duel_close.
create function public.archery_duel_end(
  duel bigint, version integer, status text, ending text, winner smallint, leaver smallint, turns jsonb, used jsonb, timeouts integer[]
)
returns public.archery_duels
language sql
security definer
set search_path = ''
as $$
  select public.archery_duel_close(duel, version, status, ending, winner, leaver, turns, used, timeouts)
$$;

-- Every 5 minutes: challenges and packing that ran out end (packed gear comes back), and fights nobody has played a
-- real shot in for 10 minutes end with everything unused given back and no points (DUEL_IDLE_MS in shared/archery/config.ts).
-- "Who's here" rows older than a day, and fights that ended over 30 days ago, are deleted.
create function public.archery_duel_tidy()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.archery_duels;
begin
  for d in select * from public.archery_duels x where x.status in ('asked', 'packing') and x.deadline < now() loop
    perform public.archery_duel_close(d.id, d.version, case when d.status = 'asked' then 'expired' else 'cancelled' end, null, null, null, null, null, null);
  end loop;
  for d in select * from public.archery_duels x where x.status = 'playing' and x.last_action_at < now() - interval '10 minutes' loop
    perform public.archery_duel_close(d.id, d.version, 'done', 'idle', null, null, null, null, null);
  end loop;
  delete from public.archery_here h where h.seen_at < now() - interval '1 day';
  -- Ended fights are kept 30 days (for "last played" and Stage 7's teacher panel), then deleted.
  delete from public.archery_duels x where x.status not in ('asked', 'packing', 'playing') and coalesce(x.finished_at, x.created_at) < now() - interval '30 days';
end;
$$;

select cron.schedule('tidy-archery-duels', '*/5 * * * *', 'select public.archery_duel_tidy()');

-- ---------------------------------------------------------------------------
-- 5. Points, New Season and "last played"
-- ---------------------------------------------------------------------------

-- The lines on How points work (the numbers are in shared/archery/points.ts).
create or replace function public.archery_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'Finish a fight against a bot: 2 points, or 3 if you win.',
    'Finish a fight against a classmate: 3 points, or 4 if you win.',
    'Get 5 or more right in a speed round: 1 point.',
    'Coins come only from speed rounds and are spent in the Armory. A New Season starts everyone with no coins and no gear.'))
$$;

-- What a New Season clears (the game's points always go): coins, gear, bests, rounds, fights and classmate fights.
create or replace function public.archery_season(players uuid[])
returns void
language sql
set search_path = ''
as $$
  with a as (delete from public.archery_players where player = any (players)),
       b as (delete from public.archery_rounds where player = any (players)),
       c as (delete from public.archery_requests where player = any (players)),
       d as (delete from public.archery_duels where seat_a = any (players) or seat_b = any (players)),
       e as (delete from public.archery_here where player = any (players))
  delete from public.archery_fights where player = any (players)
$$;

create or replace function public.archery_last_played(player uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select greatest(
    (select max(f.created_at) from public.archery_fights f where f.player = archery_last_played.player),
    (select max(r.created_at) from public.archery_rounds r where r.player = archery_last_played.player),
    (select max(d.created_at) from public.archery_duels d where d.status = 'done' and archery_last_played.player in (d.seat_a, d.seat_b)))
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.archery_on_for(uuid), public.archery_duel_busy(uuid), public.archery_lock_pair(uuid, uuid),
  public.archery_duel_close(bigint, integer, text, text, smallint, smallint, jsonb, jsonb, integer[]),
  public.archery_duel_tidy_for(uuid), public.archery_here(), public.archery_duel_load(bigint),
  public.archery_duel_challenge(uuid, text, uuid, text, bigint, integer), public.archery_duel_answer(uuid, bigint, boolean, integer),
  public.archery_duel_pack(uuid, bigint, jsonb, integer),
  public.archery_duel_move(bigint, integer, jsonb, jsonb, integer[], bigint, boolean),
  public.archery_duel_end(bigint, integer, text, text, smallint, smallint, jsonb, jsonb, integer[]),
  public.archery_duel_tidy(), public.archery_point_rules(), public.archery_season(uuid[]), public.archery_last_played(uuid)
from public, anon, authenticated;
grant execute on function public.archery_here() to authenticated;
grant execute on function
  public.archery_duel_load(bigint),
  public.archery_duel_challenge(uuid, text, uuid, text, bigint, integer), public.archery_duel_answer(uuid, bigint, boolean, integer),
  public.archery_duel_pack(uuid, bigint, jsonb, integer),
  public.archery_duel_move(bigint, integer, jsonb, jsonb, integer[], bigint, boolean),
  public.archery_duel_end(bigint, integer, text, text, smallint, smallint, jsonb, jsonb, integer[]),
  public.archery_duel_tidy()
to service_role;
