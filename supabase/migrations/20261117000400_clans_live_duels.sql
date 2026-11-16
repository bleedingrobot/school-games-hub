-- Clan Quest: Live Clan Duels between classmates (docs/CLANS-PVP-PLAN.md stage 2, James 17 Nov 2026; rules in
-- shared/clans/duel.ts, server steps in shared/clans/duelServer.ts). The same pattern as Dragon Maths' live arena
-- (20261117000200_lord_live_arena.sql): a pupil sees which classmates' clans have Clan Quest open, challenges one, the
-- classmate says yes or no, and each round both secretly pick Charge, Volley or Shield Wall through the `clans` server
-- function, which keeps each pick hidden until both are in and plays the round with the game's own rules.
--
-- Pupils only ever see clan names (never a pupil's name), like the rest of Clan Quest. Nobody loses anything: a duel played
-- to the end pays gold to the clan purse and Banners to the week's board, to both sides, for each pupil's first few a day.
--
-- 1. app_settings.clan_live_duels: the teacher's "Live duels" switch, ON to start (James: "turn it on").
-- 2. clan_here (who has the game open), clan_duels (one row per duel; its two players can read it, for Realtime),
--    clan_duel_picks (the round's picks, which only the server function can read).
-- 3. clan_duel_here() and clan_duel_cheer(): the two a pupil calls directly.
-- 4. Server-only steps, the prizes at the end, and the tidy-up.
-- 5. teacher_set_clan_live_duels().

alter table public.app_settings add column clan_live_duels boolean not null default true;

create table public.clan_here (
  player uuid primary key references public.profiles (id) on delete cascade,
  seen_at timestamptz not null default now()
);
alter table public.clan_here enable row level security;
revoke all on public.clan_here from anon, authenticated;

create table public.clan_duels (
  id bigint generated always as identity primary key,
  seat_a uuid not null references public.profiles (id) on delete cascade,
  seat_b uuid not null references public.profiles (id) on delete cascade,
  -- Clan names when the challenge was sent.
  name_a text not null,
  name_b text not null,
  -- Each clan's heroes' looks (race, class, look: no names) and village bonuses, when the challenge was sent.
  clans jsonb not null check (jsonb_typeof(clans) = 'array' and jsonb_array_length(clans) = 2),
  status text not null default 'asked' check (status in ('asked', 'playing', 'done', 'declined', 'expired', 'cancelled')),
  rounds jsonb not null default '[]' check (jsonb_typeof(rounds) = 'array' and jsonb_array_length(rounds) <= 8),
  missed integer[] not null default '{0, 0}' check (array_length(missed, 1) = 2),
  deadline timestamptz not null,
  winner smallint check (winner in (0, 1)),
  ending text check (ending in ('finished', 'left', 'timeouts', 'switched-off', 'idle')),
  leaver smallint check (leaver in (0, 1)),
  gold integer[] not null default '{0, 0}' check (array_length(gold, 1) = 2),
  banners integer[] not null default '{0, 0}' check (array_length(banners, 1) = 2),
  cheers jsonb not null default '[null, null]' check (jsonb_typeof(cheers) = 'array' and jsonb_array_length(cheers) = 2),
  -- The last maths question number each side has used, so one answer powers one round only.
  used_ask integer[] not null default '{0, 0}' check (array_length(used_ask, 1) = 2),
  version integer not null default 0,
  created_at timestamptz not null default now(),
  last_action_at timestamptz not null default now(),
  finished_at timestamptz,
  check (seat_a <> seat_b)
);
create index clan_duels_a on public.clan_duels (seat_a, created_at desc);
create index clan_duels_b on public.clan_duels (seat_b, created_at desc);
create index clan_duels_open on public.clan_duels (deadline) where status in ('asked', 'playing');

alter table public.clan_duels enable row level security;
revoke all on public.clan_duels from anon, authenticated;
grant select on public.clan_duels to authenticated;

create policy "Players see their own Clan Quest duels"
on public.clan_duels for select to authenticated
using ((select public.is_school_user()) and (select auth.uid()) in (seat_a, seat_b));

alter publication supabase_realtime add table public.clan_duels;

create table public.clan_duel_picks (
  duel bigint not null references public.clan_duels (id) on delete cascade,
  seat smallint not null check (seat in (0, 1)),
  round smallint not null check (round between 0 and 7),
  move text not null check (move in ('charge', 'volley', 'shield')),
  "right" boolean not null,
  primary key (duel, seat, round)
);
alter table public.clan_duel_picks enable row level security;
revoke all on public.clan_duel_picks from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Are live duels on for this pupil's class: Clan Quest on, and the duel switch on.
create function public.clan_duels_on(player uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.clans_enabled and s.clan_live_duels from public.settings_of(player) s), false)
$$;

create function public.clan_duel_busy(player uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.clan_duels d where d.status = 'playing' and clan_duel_busy.player in (d.seat_a, d.seat_b))
$$;

create function public.clan_duel_lock_pair(a uuid, b uuid)
returns void
language sql
volatile
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended('clan-duel:' || least(a, b)::text, 0)),
         pg_advisory_xact_lock(hashtextextended('clan-duel:' || greatest(a, b)::text, 0))
$$;

-- A clan as a duel shows it: { heroes: [{ race, cls, look }], village: { forge, walls, barracks, tower, church, strongroom } },
-- or null if the pupil has no clan. Never a hero's name.
create function public.clan_duel_clan(player uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'heroes', coalesce((select jsonb_agg(jsonb_build_object('race', m.member ->> 'race', 'cls', m.member ->> 'cls', 'look', m.member -> 'look') order by m.slot)
                        from public.clan_members m where m.player = c.player), '[]'::jsonb),
    'village', jsonb_build_object(
      'forge', coalesce((e.empire -> 'levels' ->> 'forge')::integer, 0), 'walls', coalesce((e.empire -> 'levels' ->> 'walls')::integer, 0),
      'barracks', coalesce((e.empire -> 'levels' ->> 'barracks')::integer, 0), 'tower', coalesce((e.empire -> 'levels' ->> 'tower')::integer, 0),
      'church', coalesce((e.empire -> 'levels' ->> 'church')::integer, 0), 'strongroom', coalesce((e.empire -> 'levels' ->> 'strongroom')::integer, 0)))
  from public.clans c left join public.clan_empires e on e.player = c.player
  where c.player = clan_duel_clan.player
$$;

-- Ends a duel still at `version` and not over. For a finished duel, pays each side its `gold` and `banners` (this week's
-- board) unless it has already had `paid_per_day` paid duels today (New Zealand day). Returns the row, or null if it had changed.
create function public.clan_duel_close(
  duel bigint, version integer, status text, ending text, winner smallint, leaver smallint, rounds jsonb, gold integer[], banners integer[], paid_per_day integer
)
returns public.clan_duels
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.clan_duels;
  i integer;
  who uuid;
  paid integer[] := '{0, 0}';
  given integer[] := '{0, 0}';
  today date := public.nz_day(now());
  week integer := floor(((public.nz_day(now()) - date '1970-01-01') + 3) / 7.0)::integer;
begin
  if status not in ('done', 'declined', 'expired', 'cancelled') then
    raise exception 'That ending is not right.' using errcode = '22023';
  end if;
  select * into d from public.clan_duels x
  where x.id = clan_duel_close.duel and x.version = clan_duel_close.version and x.status in ('asked', 'playing')
  for update;
  if not found then
    return null;
  end if;
  for i in 1..2 loop
    continue when clan_duel_close.gold is null or coalesce(clan_duel_close.gold[i], 0) <= 0;
    who := case when i = 1 then d.seat_a else d.seat_b end;
    continue when (
      select count(*) from public.clan_duels x
      where x.status = 'done' and public.nz_day(x.finished_at) = today
        and ((x.seat_a = who and x.gold[1] > 0) or (x.seat_b = who and x.gold[2] > 0))
    ) >= paid_per_day;
    update public.clans c set gold = c.gold + least(clan_duel_close.gold[i], 200), version = c.version + 1, updated_at = now() where c.player = who;
    if found then
      paid[i] := least(clan_duel_close.gold[i], 200);
      given[i] := least(greatest(coalesce(clan_duel_close.banners[i], 0), 0), 4);
      update public.clan_empires e set empire = e.empire || jsonb_build_object('banners', jsonb_build_object('week', week,
        'count', case when (e.empire -> 'banners' ->> 'week')::integer = week then coalesce((e.empire -> 'banners' ->> 'count')::integer, 0) else 0 end + given[i]))
      where e.player = who and jsonb_typeof(e.empire) = 'object';
    end if;
  end loop;
  update public.clan_duels x set
    status = clan_duel_close.status,
    ending = clan_duel_close.ending,
    winner = clan_duel_close.winner,
    leaver = clan_duel_close.leaver,
    rounds = coalesce(clan_duel_close.rounds, x.rounds),
    gold = paid,
    banners = given,
    finished_at = now(),
    version = x.version + 1
  where x.id = d.id
  returning * into d;
  delete from public.clan_duel_picks p where p.duel = d.id;
  return d;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. What a pupil calls directly
-- ---------------------------------------------------------------------------

-- "I'm here" (every 30 seconds while Clan Quest is open), and:
--   online: classmates' clans in the same school and class with the game open (last 75 seconds), as { id (the clan's hidden
--           public id), name (the clan name), busy };
--   asks:   challenges waiting for this pupil's answer, as { duel, from (a clan name), deadline };
--   duel:   this pupil's open duel, or null (a backup to Realtime);
--   off:    true when live duels are off for their class (then nothing else).
create function public.clan_duel_here()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  my_class uuid;
  my_school integer;
  d public.clan_duels;
begin
  if not public.is_school_user() or not exists (select 1 from public.profiles p where p.id = me and p.role = 'student' and not p.hidden) then
    return jsonb_build_object('off', true);
  end if;
  if not public.clan_duels_on(me) then
    return jsonb_build_object('off', true);
  end if;
  insert into public.clan_here as h (player, seen_at) values (me, now())
  on conflict (player) do update set seen_at = now();
  for d in select * from public.clan_duels x where x.status = 'asked' and x.deadline < now() and me in (x.seat_a, x.seat_b) loop
    perform public.clan_duel_close(d.id, d.version, 'expired', null, null, null, null, null, null, 0);
  end loop;
  my_class := public.current_class_of(me);
  select p.school_id into my_school from public.profiles p where p.id = me;
  return jsonb_build_object(
    'online', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.public_id, 'name', c.name, 'busy', public.clan_duel_busy(p.id)) order by c.name)
      from public.clan_here h
      join public.profiles p on p.id = h.player
      join public.clans c on c.player = p.id
      where my_class is not null
        and h.seen_at > now() - interval '75 seconds'
        and p.id <> me and p.role = 'student' and not p.hidden and p.school_id = my_school
        and public.current_class_of(p.id) = my_class), '[]'::jsonb),
    'asks', coalesce((
      select jsonb_agg(jsonb_build_object('duel', x.id, 'from', x.name_a, 'deadline', x.deadline) order by x.created_at)
      from public.clan_duels x
      where x.seat_b = me and x.status = 'asked' and x.deadline > now()), '[]'::jsonb),
    'duel', (
      select to_jsonb(x) from public.clan_duels x
      where (x.status = 'playing' and me in (x.seat_a, x.seat_b)) or (x.status = 'asked' and x.seat_a = me)
      order by x.created_at desc limit 1));
end;
$$;

-- A cheer at the end of a duel this pupil played: 'good-fight', 'well-played' or 'again'. One each; returns the row.
create function public.clan_duel_cheer(duel bigint, cheer text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  d public.clan_duels;
  seat integer;
begin
  if cheer not in ('good-fight', 'well-played', 'again') then
    raise exception 'That cheer is not one of ours.' using errcode = '22023';
  end if;
  select * into d from public.clan_duels x where x.id = clan_duel_cheer.duel for update;
  seat := case when d.seat_a = me then 0 when d.seat_b = me then 1 end;
  if d.id is null or seat is null or d.status <> 'done' or d.finished_at < now() - interval '10 minutes' then
    return null;
  end if;
  update public.clan_duels x set cheers = jsonb_set(x.cheers, array[seat::text], to_jsonb(cheer)), version = x.version + 1
  where x.id = d.id and x.cheers -> seat = 'null'::jsonb
  returning * into d;
  return to_jsonb(d);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. The server function's steps
-- ---------------------------------------------------------------------------

create function public.clan_duel_load(duel bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('duel', to_jsonb(d), 'on', jsonb_build_array(public.clan_duels_on(d.seat_a), public.clan_duels_on(d.seat_b)))
  from public.clan_duels d where d.id = clan_duel_load.duel
$$;

-- `player` challenges the clan whose public id is `other`. Returns { result, duel }: ok, away, class, busy, off, no-clan.
create function public.clan_duel_challenge(player uuid, other uuid, wait_ms integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.profiles;
  them public.profiles;
  my_clan public.clans;
  their_clan public.clans;
  result text := 'ok';
  d public.clan_duels;
  old public.clan_duels;
begin
  if wait_ms not between 10000 and 600000 then
    raise exception 'That wait is not right.' using errcode = '22023';
  end if;
  select * into their_clan from public.clans c where c.public_id = other;
  select * into my_clan from public.clans c where c.player = clan_duel_challenge.player;
  select * into me from public.profiles p where p.id = clan_duel_challenge.player;
  if me.id is null then
    raise exception 'No such player.' using errcode = '22023';
  end if;
  if their_clan.player is null then
    return jsonb_build_object('result', 'away', 'duel', null);
  end if;
  perform public.clan_duel_lock_pair(me.id, their_clan.player);
  select * into them from public.profiles p where p.id = their_clan.player;
  if them.id = me.id or them.role <> 'student' or them.hidden
     or not exists (select 1 from public.clan_here h where h.player = them.id and h.seen_at > now() - interval '75 seconds') then
    result := 'away';
  elsif them.school_id is distinct from me.school_id or public.current_class_of(me.id) is null
     or public.current_class_of(me.id) is distinct from public.current_class_of(them.id) then
    result := 'class';
  elsif not public.clan_duels_on(me.id) or not public.clan_duels_on(them.id) then
    result := 'off';
  elsif my_clan.player is null then
    result := 'no-clan';
  elsif public.clan_duel_busy(me.id) or public.clan_duel_busy(them.id) then
    result := 'busy';
  else
    for old in select * from public.clan_duels x where x.seat_a = me.id and x.status = 'asked' loop
      perform public.clan_duel_close(old.id, old.version, 'cancelled', null, null, null, null, null, null, 0);
    end loop;
    insert into public.clan_duels (seat_a, seat_b, name_a, name_b, clans, deadline)
    values (me.id, them.id, my_clan.name, their_clan.name, jsonb_build_array(public.clan_duel_clan(me.id), public.clan_duel_clan(them.id)),
      now() + make_interval(secs => wait_ms / 1000.0))
    returning * into d;
  end if;
  return jsonb_build_object('result', result, 'duel', d.id);
end;
$$;

create function public.clan_duel_answer(player uuid, duel bigint, accept boolean, round_ms integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.clan_duels;
begin
  if round_ms not between 10000 and 600000 or accept is null then
    raise exception 'That answer is not right.' using errcode = '22023';
  end if;
  select * into d from public.clan_duels x where x.id = clan_duel_answer.duel;
  if d.id is null or d.seat_b <> player then
    return jsonb_build_object('result', 'not-yours');
  end if;
  perform public.clan_duel_lock_pair(d.seat_a, d.seat_b);
  select * into d from public.clan_duels x where x.id = clan_duel_answer.duel for update;
  if d.status <> 'asked' or d.deadline <= now() then
    return jsonb_build_object('result', 'late', 'duel', to_jsonb(d));
  end if;
  if not accept then
    d := public.clan_duel_close(d.id, d.version, 'declined', null, null, null, null, null, null, 0);
    return jsonb_build_object('result', 'ok', 'duel', to_jsonb(d));
  end if;
  if public.clan_duel_busy(d.seat_a) or public.clan_duel_busy(d.seat_b) then
    return jsonb_build_object('result', 'busy', 'duel', to_jsonb(d));
  end if;
  update public.clan_duels x set status = 'playing', deadline = now() + make_interval(secs => round_ms / 1000.0),
    last_action_at = now(), version = x.version + 1
  where x.id = d.id returning * into d;
  return jsonb_build_object('result', 'ok', 'duel', to_jsonb(d));
end;
$$;

-- A player's order for the round being played. `is_right` is the mark of their waiting maths question (number `ask_no`);
-- a question already used for an earlier round counts as wrong. Kept hidden. Returns { result, duel, picks } like Dragon's.
create function public.clan_duel_pick(player uuid, duel bigint, round integer, move text, is_right boolean, ask_no integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.clan_duels;
  seat integer;
  fresh boolean;
begin
  select * into d from public.clan_duels x where x.id = clan_duel_pick.duel for update;
  seat := case when d.seat_a = player then 0 when d.seat_b = player then 1 end;
  if d.id is null or seat is null then
    return jsonb_build_object('result', 'not-yours');
  end if;
  if d.status <> 'playing' then
    return jsonb_build_object('result', 'over', 'duel', to_jsonb(d));
  end if;
  if round <> jsonb_array_length(d.rounds) then
    return jsonb_build_object('result', 'round', 'duel', to_jsonb(d));
  end if;
  if d.deadline < now() - interval '2 seconds' then
    return jsonb_build_object('result', 'late', 'duel', to_jsonb(d));
  end if;
  fresh := ask_no is not null and ask_no > d.used_ask[seat + 1];
  insert into public.clan_duel_picks (duel, seat, round, move, "right") values (d.id, seat, round, move, coalesce(is_right, false) and fresh)
  on conflict do nothing;
  if found and fresh then
    update public.clan_duels x set used_ask[seat + 1] = ask_no where x.id = d.id;
  end if;
  return jsonb_build_object(
    'result', case when found then 'ok' else 'already' end,
    'duel', to_jsonb(d),
    'picks', jsonb_build_array(
      (select jsonb_build_object('move', p.move, 'right', p."right") from public.clan_duel_picks p where p.duel = d.id and p.seat = 0 and p.round = clan_duel_pick.round),
      (select jsonb_build_object('move', p.move, 'right', p."right") from public.clan_duel_picks p where p.duel = d.id and p.seat = 1 and p.round = clan_duel_pick.round)));
end;
$$;

create function public.clan_duel_round_picks(duel bigint, round integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_array(
    (select jsonb_build_object('move', p.move, 'right', p."right") from public.clan_duel_picks p where p.duel = clan_duel_round_picks.duel and p.seat = 0 and p.round = clan_duel_round_picks.round),
    (select jsonb_build_object('move', p.move, 'right', p."right") from public.clan_duel_picks p where p.duel = clan_duel_round_picks.duel and p.seat = 1 and p.round = clan_duel_round_picks.round))
$$;

create function public.clan_duel_round(duel bigint, version integer, rounds jsonb, missed integer[], deadline_ms bigint)
returns public.clan_duels
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.clan_duels;
begin
  update public.clan_duels x set
    rounds = clan_duel_round.rounds,
    missed = clan_duel_round.missed,
    deadline = to_timestamp(deadline_ms / 1000.0),
    last_action_at = now(),
    version = x.version + 1
  where x.id = clan_duel_round.duel and x.version = clan_duel_round.version and x.status = 'playing'
  returning * into d;
  if not found then
    return null;
  end if;
  delete from public.clan_duel_picks p where p.duel = d.id;
  return d;
end;
$$;

create function public.clan_duel_end(
  duel bigint, version integer, status text, ending text, winner smallint, leaver smallint, rounds jsonb, gold integer[], banners integer[], paid_per_day integer
)
returns public.clan_duels
language sql
security definer
set search_path = ''
as $$
  select public.clan_duel_close(duel, version, status, ending, winner, leaver, rounds, gold, banners, paid_per_day)
$$;

-- Every 5 minutes: challenges that ran out end, duels nobody has played in for 5 minutes end with no prizes, "who's here"
-- rows older than a day go, and ended duels are kept 30 days.
create function public.clan_duel_tidy()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.clan_duels;
begin
  for d in select * from public.clan_duels x where x.status = 'asked' and x.deadline < now() loop
    perform public.clan_duel_close(d.id, d.version, 'expired', null, null, null, null, null, null, 0);
  end loop;
  for d in select * from public.clan_duels x where x.status = 'playing' and x.last_action_at < now() - interval '5 minutes' loop
    perform public.clan_duel_close(d.id, d.version, 'done', 'idle', null, null, null, null, null, 0);
  end loop;
  delete from public.clan_here h where h.seen_at < now() - interval '1 day';
  delete from public.clan_duels x where x.status not in ('asked', 'playing') and coalesce(x.finished_at, x.created_at) < now() - interval '30 days';
end;
$$;

select cron.schedule('tidy-clan-duels', '*/5 * * * *', 'select public.clan_duel_tidy()');

-- ---------------------------------------------------------------------------
-- 5. The teacher's switch
-- ---------------------------------------------------------------------------

create function public.teacher_set_clan_live_duels(enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  perform public.require_settings_target(target_class);
  update public.app_settings set clan_live_duels = coalesce(enabled, false)
  where id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.clan_duels_on(uuid), public.clan_duel_busy(uuid), public.clan_duel_lock_pair(uuid, uuid), public.clan_duel_clan(uuid),
  public.clan_duel_close(bigint, integer, text, text, smallint, smallint, jsonb, integer[], integer[], integer),
  public.clan_duel_here(), public.clan_duel_cheer(bigint, text), public.clan_duel_load(bigint),
  public.clan_duel_challenge(uuid, uuid, integer), public.clan_duel_answer(uuid, bigint, boolean, integer),
  public.clan_duel_pick(uuid, bigint, integer, text, boolean, integer), public.clan_duel_round_picks(bigint, integer),
  public.clan_duel_round(bigint, integer, jsonb, integer[], bigint),
  public.clan_duel_end(bigint, integer, text, text, smallint, smallint, jsonb, integer[], integer[], integer),
  public.clan_duel_tidy(), public.teacher_set_clan_live_duels(boolean, uuid)
from public, anon, authenticated;
grant execute on function public.clan_duel_here(), public.clan_duel_cheer(bigint, text), public.teacher_set_clan_live_duels(boolean, uuid) to authenticated;
grant execute on function
  public.clan_duel_load(bigint), public.clan_duel_challenge(uuid, uuid, integer), public.clan_duel_answer(uuid, bigint, boolean, integer),
  public.clan_duel_pick(uuid, bigint, integer, text, boolean, integer), public.clan_duel_round_picks(bigint, integer),
  public.clan_duel_round(bigint, integer, jsonb, integer[], bigint),
  public.clan_duel_end(bigint, integer, text, text, smallint, smallint, jsonb, integer[], integer[], integer),
  public.clan_duel_tidy()
to service_role;
