-- Archery Challenge: "Snooze for 30 min" on a classmate's challenge (James, 6 Nov 2026).
--
-- NOT APPLIED to the live database. Apply after 20261022000200_archery_hub.sql.
--
-- When a classmate challenges you, the pop-up has a third button beside Accept and Say no: "Snooze Mia for 30 min".
-- It says no to this challenge, and Mia can't challenge you again for 30 minutes (SNOOZE_MS in shared/archery/config.ts).
-- Mia's Challenge a classmate list shows "Not now" beside you until it runs out. Snoozing is per pair and one way:
-- you can still challenge Mia.
--
-- 1. archery_snoozes: who snoozed whom, until when. No pupil access.
-- 2. archery_duel_snooze(): the server function's step (says no to the challenge and snoozes its sender).
-- 3. archery_duel_challenge(): the same as 20261022000100's, plus "snoozed" when the classmate has snoozed you.
-- 4. archery_here(): the same as 20261022000200's, plus "snoozed" on each classmate listed.
-- 5. New Season clears snoozes too.

-- ---------------------------------------------------------------------------
-- 1. Snoozes
-- ---------------------------------------------------------------------------

create table public.archery_snoozes (
  -- The pupil who pressed Snooze.
  player uuid not null references public.profiles (id) on delete cascade,
  -- The classmate who can't challenge them until `until`.
  other uuid not null references public.profiles (id) on delete cascade,
  until timestamptz not null,
  primary key (player, other)
);
create index archery_snoozes_other on public.archery_snoozes (other, player);
alter table public.archery_snoozes enable row level security;
revoke all on public.archery_snoozes from anon, authenticated;

-- Has `player` snoozed `other` (so `other` can't challenge them)?
create function public.archery_snoozed(player uuid, other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.archery_snoozes s where s.player = archery_snoozed.player and s.other = archery_snoozed.other and s.until > now())
$$;

-- ---------------------------------------------------------------------------
-- 2. Snooze a challenge
-- ---------------------------------------------------------------------------

-- The challenged pupil says no and snoozes whoever sent it for snooze_ms. Returns { result, duel (the row) }:
-- ok (the snooze is kept even if the challenge had just run out), not-yours.
create function public.archery_duel_snooze(player uuid, duel bigint, snooze_ms integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.archery_duels;
begin
  perform public.gem_keep_check_player(player);
  if snooze_ms not between 60000 and 7200000 then
    raise exception 'That snooze is not right.' using errcode = '22023';
  end if;
  select * into d from public.archery_duels x where x.id = archery_duel_snooze.duel;
  if d.id is null or d.seat_b <> player then
    return jsonb_build_object('result', 'not-yours');
  end if;
  perform public.archery_lock_pair(d.seat_a, d.seat_b);
  delete from public.archery_snoozes s where s.until < now();
  insert into public.archery_snoozes as s (player, other, until)
  values (d.seat_b, d.seat_a, now() + make_interval(secs => snooze_ms / 1000.0))
  on conflict on constraint archery_snoozes_pkey do update set until = excluded.until;
  select * into d from public.archery_duels x where x.id = archery_duel_snooze.duel for update;
  if d.status = 'asked' then
    d := public.archery_duel_close(d.id, d.version, 'declined', null, null, null, null, null, null);
  end if;
  return jsonb_build_object('result', 'ok', 'duel', to_jsonb(d));
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Challenges: refused while you're snoozed
-- ---------------------------------------------------------------------------

-- As in 20261022000100_archery_classmates.sql, with one more result: snoozed (they snoozed you; try later).
create or replace function public.archery_duel_challenge(player uuid, request_id text, other uuid, world text, seed bigint, wait_ms integer)
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
  elsif public.archery_snoozed(other, player) then
    result := 'snoozed';
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

-- ---------------------------------------------------------------------------
-- 4. "I'm here": each classmate says whether they've snoozed you
-- ---------------------------------------------------------------------------

-- As in 20261022000200_archery_hub.sql, with `snoozed` on each classmate listed.
create or replace function public.archery_here()
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
  if not public.archery_duels_on_for(me) then
    delete from public.archery_here h where h.player = me;
    perform public.archery_duels_end_for(me);
    return jsonb_build_object('duels', false, 'online', '[]'::jsonb, 'asks', '[]'::jsonb, 'duel', null);
  end if;
  insert into public.archery_here as h (player, seen_at) values (me, now())
  on conflict (player) do update set seen_at = now();
  perform public.archery_duel_tidy_for(me);
  my_class := public.current_class_of(me);
  select p.school_id into my_school from public.profiles p where p.id = me;
  return jsonb_build_object(
    'duels', true,
    'online', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'avatar', p.avatar, 'busy', public.archery_duel_busy(p.id),
                                          'snoozed', public.archery_snoozed(p.id, me)) order by p.display_name)
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
-- 5. New Season
-- ---------------------------------------------------------------------------

-- As in 20261022000100_archery_classmates.sql, plus snoozes.
create or replace function public.archery_season(players uuid[])
returns void
language sql
set search_path = ''
as $$
  with a as (delete from public.archery_players where player = any (players)),
       b as (delete from public.archery_rounds where player = any (players)),
       c as (delete from public.archery_requests where player = any (players)),
       d as (delete from public.archery_duels where seat_a = any (players) or seat_b = any (players)),
       e as (delete from public.archery_here where player = any (players)),
       f as (delete from public.archery_snoozes where player = any (players) or other = any (players))
  delete from public.archery_fights where player = any (players)
$$;

revoke execute on function public.archery_snoozed(uuid, uuid), public.archery_duel_snooze(uuid, bigint, integer) from public, anon, authenticated;
grant execute on function public.archery_duel_snooze(uuid, bigint, integer) to service_role;
-- create or replace keeps the old grants; said again so this file reads on its own.
revoke execute on function public.archery_duel_challenge(uuid, text, uuid, text, bigint, integer) from public, anon, authenticated;
grant execute on function public.archery_duel_challenge(uuid, text, uuid, text, bigint, integer) to service_role;
revoke execute on function public.archery_here() from public, anon;
grant execute on function public.archery_here() to authenticated;
