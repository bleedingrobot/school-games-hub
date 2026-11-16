-- Dragon Maths: live arena clashes between classmates (James, 17 Nov 2026; rules in shared/lord/clash.ts).
--
-- A pupil sees which classmates have Dragon Maths open, challenges one (same school and class only), the classmate says
-- yes or no, and then each round both secretly pick Hammer, Sword or Net and answer a maths question through the `lord`
-- server function, which marks the answer, keeps each pick hidden until both are in, and plays the round with the
-- game's own rules. Both screens hear each change through Realtime on the clash row.
--
-- 1. app_settings.lord_live_arena: the teacher's "Classmate clashes" switch, OFF to start (James: off until the teacher
--    turns it on). Only matters while Dragon Maths itself is on.
-- 2. lord_here: who has the game open. lord_clashes: one row per clash (its two players can read it, for Realtime).
--    lord_clash_picks: the picks of the round being played, which nobody can read but the server function, so a pupil
--    can never see the other's pick before they've picked.
-- 3. lord_here(): the one clash function a pupil calls directly ("I'm here", who else is, challenges for me, my clash),
--    and lord_clash_cheer() for the cheers at the end. Display names only, never gold or maths results.
-- 4. Server-only steps for the server function, gold for the end of a clash (the winner, and half that to the other
--    side, for each player's first PAID_CLASHES_PER_DAY a day), and the tidy-up.
-- 5. teacher_set_lord_live_arena().

-- ---------------------------------------------------------------------------
-- 1. The switch
-- ---------------------------------------------------------------------------

alter table public.app_settings add column lord_live_arena boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

create table public.lord_here (
  player uuid primary key references public.profiles (id) on delete cascade,
  seen_at timestamptz not null default now()
);
alter table public.lord_here enable row level security;
revoke all on public.lord_here from anon, authenticated;

create table public.lord_clashes (
  id bigint generated always as identity primary key,
  -- seat_a challenged (side 0 of every round); seat_b was challenged (side 1).
  seat_a uuid not null references public.profiles (id) on delete cascade,
  seat_b uuid not null references public.profiles (id) on delete cascade,
  -- Display names when the challenge was sent (never real names).
  name_a text not null,
  name_b text not null,
  -- How each hero looks and their level, when the challenge was sent: [{ heroClass, look, level }, { ... }].
  heroes jsonb not null check (jsonb_typeof(heroes) = 'array' and jsonb_array_length(heroes) = 2),
  -- asked: waiting for seat_b. playing. done: ended after it started. declined / expired / cancelled: it never started.
  status text not null default 'asked' check (status in ('asked', 'playing', 'done', 'declined', 'expired', 'cancelled')),
  -- The rounds played so far: [[{ move, right }, { move, right }], ...]; a null move is a pick the clock took.
  rounds jsonb not null default '[]' check (jsonb_typeof(rounds) = 'array' and jsonb_array_length(rounds) <= 8),
  -- Rounds in a row each side let the clock take.
  missed integer[] not null default '{0, 0}' check (array_length(missed, 1) = 2),
  -- When the challenge runs out, or this round's time ends.
  deadline timestamptz not null,
  -- 0 or 1; null for a draw or a clash that ended without a winner.
  winner smallint check (winner in (0, 1)),
  -- finished (played out), left (someone gave up), timeouts (the clock took two picks in a row), switched-off, idle.
  ending text check (ending in ('finished', 'left', 'timeouts', 'switched-off', 'idle')),
  leaver smallint check (leaver in (0, 1)),
  -- The gold each side was actually paid.
  gold integer[] not null default '{0, 0}' check (array_length(gold, 1) = 2),
  -- One cheer each at the end ('good-fight', 'well-played', 'again'), or null.
  cheers jsonb not null default '[null, null]' check (jsonb_typeof(cheers) = 'array' and jsonb_array_length(cheers) = 2),
  version integer not null default 0,
  created_at timestamptz not null default now(),
  last_action_at timestamptz not null default now(),
  finished_at timestamptz,
  check (seat_a <> seat_b)
);
create index lord_clashes_a on public.lord_clashes (seat_a, created_at desc);
create index lord_clashes_b on public.lord_clashes (seat_b, created_at desc);
create index lord_clashes_open on public.lord_clashes (deadline) where status in ('asked', 'playing');

alter table public.lord_clashes enable row level security;
revoke all on public.lord_clashes from anon, authenticated;
grant select on public.lord_clashes to authenticated;

create policy "Players see their own Dragon Maths clashes"
on public.lord_clashes for select to authenticated
using ((select public.is_school_user()) and (select auth.uid()) in (seat_a, seat_b));

alter publication supabase_realtime add table public.lord_clashes;

create table public.lord_clash_picks (
  clash bigint not null references public.lord_clashes (id) on delete cascade,
  seat smallint not null check (seat in (0, 1)),
  round smallint not null check (round between 0 and 7),
  move text not null check (move in ('hammer', 'sword', 'net')),
  "right" boolean not null,
  primary key (clash, seat, round)
);
alter table public.lord_clash_picks enable row level security;
revoke all on public.lord_clash_picks from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Are classmate clashes on for this pupil's class: Dragon Maths on, and the clash switch on.
create function public.lord_live_on(player uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.lord_enabled and s.lord_live_arena from public.settings_of(player) s), false)
$$;

create function public.lord_clash_busy(player uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.lord_clashes c where c.status = 'playing' and lord_clash_busy.player in (c.seat_a, c.seat_b))
$$;

create function public.lord_clash_lock_pair(a uuid, b uuid)
returns void
language sql
volatile
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended('lord-clash:' || least(a, b)::text, 0)),
         pg_advisory_xact_lock(hashtextextended('lord-clash:' || greatest(a, b)::text, 0))
$$;

-- How a hero looks, for the clash screens: { heroClass, look, level }, or null if they have no hero.
create function public.lord_clash_hero(player uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('heroClass', h.hero ->> 'heroClass', 'look', h.hero -> 'look', 'level', coalesce((h.hero ->> 'level')::integer, 1))
  from public.lord_heroes h where h.player = lord_clash_hero.player and jsonb_typeof(h.hero -> 'heroClass') = 'string'
$$;

-- Ends a clash still at `version` and not over, paying `want` gold (each side's share) to each side that hasn't already had
-- `paid_per_day` paid clashes today (New Zealand day). Returns the row, or null if it had changed.
create function public.lord_clash_close(
  clash bigint, version integer, status text, ending text, winner smallint, leaver smallint, rounds jsonb, want integer[], paid_per_day integer
)
returns public.lord_clashes
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.lord_clashes;
  i integer;
  who uuid;
  paid integer[] := '{0, 0}';
  today date := public.nz_day(now());
begin
  if status not in ('done', 'declined', 'expired', 'cancelled') then
    raise exception 'That ending is not right.' using errcode = '22023';
  end if;
  select * into c from public.lord_clashes x
  where x.id = lord_clash_close.clash and x.version = lord_clash_close.version and x.status in ('asked', 'playing')
  for update;
  if not found then
    return null;
  end if;
  for i in 1..2 loop
    continue when want is null or coalesce(want[i], 0) <= 0;
    who := case when i = 1 then c.seat_a else c.seat_b end;
    continue when (
      select count(*) from public.lord_clashes x
      where x.status = 'done' and public.nz_day(x.finished_at) = today
        and ((x.seat_a = who and x.gold[1] > 0) or (x.seat_b = who and x.gold[2] > 0))
    ) >= paid_per_day;
    update public.lord_heroes h
    set hero = jsonb_set(h.hero, '{gold}', to_jsonb(coalesce((h.hero ->> 'gold')::integer, 0) + least(want[i], 100000))),
        version = h.version + 1, saved_at = now()
    where h.player = who;
    if found then
      paid[i] := least(want[i], 100000);
    end if;
  end loop;
  update public.lord_clashes x set
    status = lord_clash_close.status,
    ending = lord_clash_close.ending,
    winner = lord_clash_close.winner,
    leaver = lord_clash_close.leaver,
    rounds = coalesce(lord_clash_close.rounds, x.rounds),
    gold = paid,
    finished_at = now(),
    version = x.version + 1
  where x.id = c.id
  returning * into c;
  delete from public.lord_clash_picks p where p.clash = c.id;
  return c;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. What a pupil calls directly
-- ---------------------------------------------------------------------------

-- "I'm here" (the arena calls it every 30 seconds while the game is open), and:
--   online: classmates in the same school and class with the game open (seen in the last 75 seconds) and a hero, as
--           { id, name, avatar, busy };
--   asks:   challenges waiting for this pupil's answer, as { clash, from, deadline };
--   clash:  this pupil's open clash (one they sent, or one being played), or null: a backup to Realtime;
--   off:    true when classmate clashes are off for their class (then nothing else).
create function public.lord_here()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  my_class uuid;
  my_school integer;
  c public.lord_clashes;
begin
  if not public.is_school_user() or not exists (select 1 from public.profiles p where p.id = me and p.role = 'student' and not p.hidden) then
    return jsonb_build_object('off', true);
  end if;
  if not public.lord_live_on(me) then
    return jsonb_build_object('off', true);
  end if;
  insert into public.lord_here as h (player, seen_at) values (me, now())
  on conflict (player) do update set seen_at = now();
  -- This pupil's own challenges that ran out end here (a closed page can't end them).
  for c in select * from public.lord_clashes x where x.status = 'asked' and x.deadline < now() and me in (x.seat_a, x.seat_b) loop
    perform public.lord_clash_close(c.id, c.version, 'expired', null, null, null, null, null, 0);
  end loop;
  my_class := public.current_class_of(me);
  select p.school_id into my_school from public.profiles p where p.id = me;
  return jsonb_build_object(
    'online', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'avatar', p.avatar, 'busy', public.lord_clash_busy(p.id)) order by p.display_name)
      from public.lord_here h
      join public.profiles p on p.id = h.player
      where my_class is not null
        and h.seen_at > now() - interval '75 seconds'
        and p.id <> me and p.role = 'student' and not p.hidden and p.school_id = my_school
        and public.current_class_of(p.id) = my_class
        and exists (select 1 from public.lord_heroes lh where lh.player = p.id)), '[]'::jsonb),
    'asks', coalesce((
      select jsonb_agg(jsonb_build_object('clash', x.id, 'from', x.name_a, 'deadline', x.deadline) order by x.created_at)
      from public.lord_clashes x
      where x.seat_b = me and x.status = 'asked' and x.deadline > now()), '[]'::jsonb),
    'clash', (
      select to_jsonb(x) from public.lord_clashes x
      where (x.status = 'playing' and me in (x.seat_a, x.seat_b)) or (x.status = 'asked' and x.seat_a = me)
      order by x.created_at desc limit 1));
end;
$$;

-- A cheer at the end of a clash this pupil played: 'good-fight', 'well-played' or 'again'. One each; returns the row.
create function public.lord_clash_cheer(clash bigint, cheer text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  c public.lord_clashes;
  seat integer;
begin
  if cheer not in ('good-fight', 'well-played', 'again') then
    raise exception 'That cheer is not one of ours.' using errcode = '22023';
  end if;
  select * into c from public.lord_clashes x where x.id = lord_clash_cheer.clash for update;
  seat := case when c.seat_a = me then 0 when c.seat_b = me then 1 end;
  if c.id is null or seat is null or c.status <> 'done' or c.finished_at < now() - interval '10 minutes' then
    return null;
  end if;
  update public.lord_clashes x set cheers = jsonb_set(x.cheers, array[seat::text], to_jsonb(cheer)), version = x.version + 1
  where x.id = c.id and x.cheers -> seat = 'null'::jsonb
  returning * into c;
  return to_jsonb(c);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. The server function's steps
-- ---------------------------------------------------------------------------

-- One clash and whether classmate clashes are on for each player's class: { clash, on: [a, b] }, or null.
create function public.lord_clash_load(clash bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('clash', to_jsonb(c), 'on', jsonb_build_array(public.lord_live_on(c.seat_a), public.lord_live_on(c.seat_b)))
  from public.lord_clashes c where c.id = lord_clash_load.clash
$$;

-- `player` challenges `other`. Returns { result, clash }: ok (any older challenge this pupil sent is cancelled), away
-- (they don't have the game open), class (another class or school), busy (one of them is in a clash), off (clashes are
-- off for their class), no-hero (one of them hasn't picked a hero yet).
create function public.lord_clash_challenge(player uuid, other uuid, wait_ms integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.profiles;
  them public.profiles;
  result text := 'ok';
  c public.lord_clashes;
  old public.lord_clashes;
  hero_a jsonb := public.lord_clash_hero(player);
  hero_b jsonb := public.lord_clash_hero(other);
begin
  if wait_ms not between 10000 and 600000 then
    raise exception 'That wait is not right.' using errcode = '22023';
  end if;
  perform public.lord_clash_lock_pair(player, other);
  select * into me from public.profiles p where p.id = player;
  select * into them from public.profiles p where p.id = other;
  if me.id is null then
    raise exception 'No such player.' using errcode = '22023';
  end if;
  if them.id is null or them.id = me.id or them.role <> 'student' or them.hidden
     or not exists (select 1 from public.lord_here h where h.player = other and h.seen_at > now() - interval '75 seconds') then
    result := 'away';
  elsif them.school_id is distinct from me.school_id or public.current_class_of(player) is null
     or public.current_class_of(player) is distinct from public.current_class_of(other) then
    result := 'class';
  elsif not public.lord_live_on(player) or not public.lord_live_on(other) then
    result := 'off';
  elsif hero_a is null or hero_b is null then
    result := 'no-hero';
  elsif public.lord_clash_busy(player) or public.lord_clash_busy(other) then
    result := 'busy';
  else
    for old in select * from public.lord_clashes x where x.seat_a = lord_clash_challenge.player and x.status = 'asked' loop
      perform public.lord_clash_close(old.id, old.version, 'cancelled', null, null, null, null, null, 0);
    end loop;
    insert into public.lord_clashes (seat_a, seat_b, name_a, name_b, heroes, deadline)
    values (player, other, me.display_name, them.display_name, jsonb_build_array(hero_a, hero_b), now() + make_interval(secs => wait_ms / 1000.0))
    returning * into c;
  end if;
  return jsonb_build_object('result', result, 'clash', c.id);
end;
$$;

-- The challenged pupil says yes (round 1 starts, with round_ms on the clock) or no. Returns { result, clash (the row) }:
-- ok, late (it ran out or was called off), busy, not-yours.
create function public.lord_clash_answer(player uuid, clash bigint, accept boolean, round_ms integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.lord_clashes;
begin
  if round_ms not between 10000 and 600000 or accept is null then
    raise exception 'That answer is not right.' using errcode = '22023';
  end if;
  select * into c from public.lord_clashes x where x.id = lord_clash_answer.clash;
  if c.id is null or c.seat_b <> player then
    return jsonb_build_object('result', 'not-yours');
  end if;
  perform public.lord_clash_lock_pair(c.seat_a, c.seat_b);
  select * into c from public.lord_clashes x where x.id = lord_clash_answer.clash for update;
  if c.status <> 'asked' or c.deadline <= now() then
    return jsonb_build_object('result', 'late', 'clash', to_jsonb(c));
  end if;
  if not accept then
    c := public.lord_clash_close(c.id, c.version, 'declined', null, null, null, null, null, 0);
    return jsonb_build_object('result', 'ok', 'clash', to_jsonb(c));
  end if;
  if public.lord_clash_busy(c.seat_a) or public.lord_clash_busy(c.seat_b) then
    return jsonb_build_object('result', 'busy', 'clash', to_jsonb(c));
  end if;
  update public.lord_clashes x set status = 'playing', deadline = now() + make_interval(secs => round_ms / 1000.0),
    last_action_at = now(), version = x.version + 1
  where x.id = c.id returning * into c;
  return jsonb_build_object('result', 'ok', 'clash', to_jsonb(c));
end;
$$;

-- A player's pick for the round being played (`right`: the server function marked their answer). Kept hidden. Returns
-- { result, clash, picks }: ok, already (they had picked this round: counts once), late (the round's time is up), over,
-- round (that isn't the round being played), not-yours. `picks` is this round's [side 0, side 1] (null where not in yet),
-- for the server function only, so whichever pick comes second plays the round.
create function public.lord_clash_pick(player uuid, clash bigint, round integer, move text, is_right boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.lord_clashes;
  seat integer;
begin
  select * into c from public.lord_clashes x where x.id = lord_clash_pick.clash for update;
  seat := case when c.seat_a = player then 0 when c.seat_b = player then 1 end;
  if c.id is null or seat is null then
    return jsonb_build_object('result', 'not-yours');
  end if;
  if c.status <> 'playing' then
    return jsonb_build_object('result', 'over', 'clash', to_jsonb(c));
  end if;
  if round <> jsonb_array_length(c.rounds) then
    return jsonb_build_object('result', 'round', 'clash', to_jsonb(c));
  end if;
  -- Two seconds' grace for a pick that was on its way when the clock ran out.
  if c.deadline < now() - interval '2 seconds' then
    return jsonb_build_object('result', 'late', 'clash', to_jsonb(c));
  end if;
  insert into public.lord_clash_picks (clash, seat, round, move, "right") values (c.id, seat, round, move, is_right)
  on conflict do nothing;
  return jsonb_build_object(
    'result', case when found then 'ok' else 'already' end,
    'clash', to_jsonb(c),
    'picks', jsonb_build_array(
      (select jsonb_build_object('move', p.move, 'right', p."right") from public.lord_clash_picks p where p.clash = c.id and p.seat = 0 and p.round = lord_clash_pick.round),
      (select jsonb_build_object('move', p.move, 'right', p."right") from public.lord_clash_picks p where p.clash = c.id and p.seat = 1 and p.round = lord_clash_pick.round)));
end;
$$;

-- This round's picks so far, for when its time is up: [side 0, side 1] (null where not in).
create function public.lord_clash_round_picks(clash bigint, round integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_array(
    (select jsonb_build_object('move', p.move, 'right', p."right") from public.lord_clash_picks p where p.clash = lord_clash_round_picks.clash and p.seat = 0 and p.round = lord_clash_round_picks.round),
    (select jsonb_build_object('move', p.move, 'right', p."right") from public.lord_clash_picks p where p.clash = lord_clash_round_picks.clash and p.seat = 1 and p.round = lord_clash_round_picks.round))
$$;

-- Saves a round the server function has played, with the next round's deadline. Only if the clash is still at `version`
-- and playing; returns the row, or null if it had changed. The picks of the round go (they're in `rounds` now).
create function public.lord_clash_round(clash bigint, version integer, rounds jsonb, missed integer[], deadline_ms bigint)
returns public.lord_clashes
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.lord_clashes;
begin
  update public.lord_clashes x set
    rounds = lord_clash_round.rounds,
    missed = lord_clash_round.missed,
    deadline = to_timestamp(deadline_ms / 1000.0),
    last_action_at = now(),
    version = x.version + 1
  where x.id = lord_clash_round.clash and x.version = lord_clash_round.version and x.status = 'playing'
  returning * into c;
  if not found then
    return null;
  end if;
  delete from public.lord_clash_picks p where p.clash = c.id;
  return c;
end;
$$;

-- Ends a clash: see lord_clash_close.
create function public.lord_clash_end(
  clash bigint, version integer, status text, ending text, winner smallint, leaver smallint, rounds jsonb, want integer[], paid_per_day integer
)
returns public.lord_clashes
language sql
security definer
set search_path = ''
as $$
  select public.lord_clash_close(clash, version, status, ending, winner, leaver, rounds, want, paid_per_day)
$$;

-- Every 5 minutes: challenges that ran out end, clashes nobody has played in for 5 minutes end with no gold, "who's here"
-- rows older than a day go, and ended clashes are kept 30 days.
create function public.lord_clash_tidy()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.lord_clashes;
begin
  for c in select * from public.lord_clashes x where x.status = 'asked' and x.deadline < now() loop
    perform public.lord_clash_close(c.id, c.version, 'expired', null, null, null, null, null, 0);
  end loop;
  for c in select * from public.lord_clashes x where x.status = 'playing' and x.last_action_at < now() - interval '5 minutes' loop
    perform public.lord_clash_close(c.id, c.version, 'done', 'idle', null, null, null, null, 0);
  end loop;
  delete from public.lord_here h where h.seen_at < now() - interval '1 day';
  delete from public.lord_clashes x where x.status not in ('asked', 'playing') and coalesce(x.finished_at, x.created_at) < now() - interval '30 days';
end;
$$;

select cron.schedule('tidy-lord-clashes', '*/5 * * * *', 'select public.lord_clash_tidy()');

-- ---------------------------------------------------------------------------
-- 5. The teacher's switch
-- ---------------------------------------------------------------------------

create function public.teacher_set_lord_live_arena(enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  perform public.require_settings_target(target_class);
  update public.app_settings set lord_live_arena = coalesce(enabled, false)
  where id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.lord_live_on(uuid), public.lord_clash_busy(uuid), public.lord_clash_lock_pair(uuid, uuid), public.lord_clash_hero(uuid),
  public.lord_clash_close(bigint, integer, text, text, smallint, smallint, jsonb, integer[], integer),
  public.lord_here(), public.lord_clash_cheer(bigint, text), public.lord_clash_load(bigint),
  public.lord_clash_challenge(uuid, uuid, integer), public.lord_clash_answer(uuid, bigint, boolean, integer),
  public.lord_clash_pick(uuid, bigint, integer, text, boolean), public.lord_clash_round_picks(bigint, integer),
  public.lord_clash_round(bigint, integer, jsonb, integer[], bigint),
  public.lord_clash_end(bigint, integer, text, text, smallint, smallint, jsonb, integer[], integer),
  public.lord_clash_tidy(), public.teacher_set_lord_live_arena(boolean, uuid)
from public, anon, authenticated;
grant execute on function public.lord_here(), public.lord_clash_cheer(bigint, text), public.teacher_set_lord_live_arena(boolean, uuid) to authenticated;
grant execute on function
  public.lord_clash_load(bigint), public.lord_clash_challenge(uuid, uuid, integer), public.lord_clash_answer(uuid, bigint, boolean, integer),
  public.lord_clash_pick(uuid, bigint, integer, text, boolean), public.lord_clash_round_picks(bigint, integer),
  public.lord_clash_round(bigint, integer, jsonb, integer[], bigint),
  public.lord_clash_end(bigint, integer, text, text, smallint, smallint, jsonb, integer[], integer),
  public.lord_clash_tidy()
to service_role;
