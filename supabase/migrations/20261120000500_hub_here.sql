-- Play anyone, stage 2 (docs/plans/play-anyone/PLAN.md, sections C and D1): who has the hub open, and challenges from anywhere.
--
-- 1. hub_here (player, seen_at): the hub page says "I'm here" every 30 seconds while it is open and showing
--    (src/multiplayer/useHubHere.ts). A pupil counts as here for 75 seconds after, the rule the duel games use.
--    hub_here() records it for a school pupil who isn't hidden, and gives back only which games have a challenge
--    waiting for this pupil (`waiting`, game ids), so the hub banner can ask that game's own "here" function for it.
--    hub_seen(player) is the 75-second rule for one pupil. Old rows are tidied by a cron job, as the games do.
-- 2. Archery fights, Dragon Maths live clashes and Clan live duels: a kid counts as here if they have that game open
--    *or* the hub open. The lists now check each listed kid's own game switches too (a kid only in the hub never ran
--    the game's own "here", which used to do that check), and the challenges accept a hub-only kid. Every stage 1 rule
--    stays: same school, not hidden, plays_other_classes(), each game's switches, a hero for Dragon Maths, a clan for
--    Clan duels.
--
-- Every game function here is `create or replace` of the stage 1 version, changed only where it says so.

-- ---------------------------------------------------------------------------
-- 1. Who has the hub open
-- ---------------------------------------------------------------------------

create table public.hub_here (
  player uuid primary key references public.profiles (id) on delete cascade,
  seen_at timestamptz not null default now()
);
alter table public.hub_here enable row level security;
revoke all on public.hub_here from anon, authenticated;
create index hub_here_seen on public.hub_here (seen_at);

-- Has this pupil had the hub open in the last 75 seconds?
create or replace function public.hub_seen(player uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.hub_here h where h.player = hub_seen.player and h.seen_at > now() - interval '75 seconds')
$$;

-- "I'm here" from the hub. Only a school pupil who isn't hidden is recorded. Gives back nothing about anyone else:
-- just which games have a challenge waiting for me.
create or replace function public.hub_here()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if not public.is_school_user() or not exists (select 1 from public.profiles p where p.id = me and p.role = 'student' and not p.hidden) then
    return jsonb_build_object('waiting', '[]'::jsonb);
  end if;
  insert into public.hub_here as h (player, seen_at) values (me, now())
  on conflict (player) do update set seen_at = now();
  return jsonb_build_object('waiting', to_jsonb(array_remove(array[
    case when exists (select 1 from public.archery_duels d where d.seat_b = me and d.status = 'asked' and d.deadline > now()) then 'archery' end,
    case when exists (select 1 from public.lord_clashes x where x.seat_b = me and x.status = 'asked' and x.deadline > now()) then 'dragon-maths' end,
    case when exists (select 1 from public.clan_duels x where x.seat_b = me and x.status = 'asked' and x.deadline > now()) then 'clan-quest' end
  ], null)));
end;
$$;

-- Rows nobody has refreshed for a day go (one row per pupil at most, so this only keeps it tidy).
create or replace function public.hub_here_tidy()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.hub_here h where h.seen_at < now() - interval '1 day'
$$;

select cron.schedule('tidy-hub-here', '29 3 * * *', 'select public.hub_here_tidy()');

-- ---------------------------------------------------------------------------
-- 2. Archery Challenge fights
-- ---------------------------------------------------------------------------

-- As in 20261120000300_play_other_classes.sql, except a kid with the hub open (hub_seen) counts as here too.
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
     or not (exists (select 1 from public.archery_here h where h.player = other and h.seen_at > now() - interval '75 seconds') or public.hub_seen(other)) then
    result := 'away';
  elsif them.school_id is distinct from me.school_id or not public.plays_other_classes(player, other) then
    result := 'class';
  elsif not public.archery_on_for(other) or not public.archery_duels_on_for(other) then
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

-- As in 20261120000300_play_other_classes.sql, except `online` also lists kids with the hub open (hub_here), and checks
-- each listed kid's own Archery and Classmate fights switches (a kid only in the hub hasn't been checked by archery_here()).
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
  my_open boolean;
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
  my_open := public.play_other_classes_on(me);
  select p.school_id into my_school from public.profiles p where p.id = me;
  return jsonb_build_object(
    'duels', true,
    'online', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'avatar', p.avatar, 'busy', public.archery_duel_busy(p.id),
                                          'snoozed', public.archery_snoozed(p.id, me),
                                          'sameClass', coalesce(k.class_id = my_class, false), 'className', k.class_name)
                       order by coalesce(k.class_id = my_class, false) desc, p.display_name)
      from public.profiles p
      left join lateral public.class_card_of(p.id) k on true
      where p.id in (select h.player from public.archery_here h where h.seen_at > now() - interval '75 seconds'
                     union select h.player from public.hub_here h where h.seen_at > now() - interval '75 seconds')
        and p.id <> me and p.role = 'student' and not p.hidden and p.school_id = my_school
        and ((my_class is not null and k.class_id = my_class) or (my_open and public.play_other_classes_on(p.id)))
        and public.archery_on_for(p.id) and public.archery_duels_on_for(p.id)), '[]'::jsonb),
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
-- 3. Dragon Maths live clashes
-- ---------------------------------------------------------------------------

-- As in 20261120000300_play_other_classes.sql, except `online` also lists kids with the hub open (hub_here), and checks
-- each listed kid's own live-clash switch.
create or replace function public.lord_here()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  my_class uuid;
  my_school integer;
  my_open boolean;
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
  my_open := public.play_other_classes_on(me);
  select p.school_id into my_school from public.profiles p where p.id = me;
  return jsonb_build_object(
    'online', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'avatar', p.avatar, 'busy', public.lord_clash_busy(p.id),
                                          'sameClass', coalesce(k.class_id = my_class, false), 'className', k.class_name)
                       order by coalesce(k.class_id = my_class, false) desc, p.display_name)
      from public.profiles p
      left join lateral public.class_card_of(p.id) k on true
      where p.id in (select h.player from public.lord_here h where h.seen_at > now() - interval '75 seconds'
                     union select h.player from public.hub_here h where h.seen_at > now() - interval '75 seconds')
        and p.id <> me and p.role = 'student' and not p.hidden and p.school_id = my_school
        and ((my_class is not null and k.class_id = my_class) or (my_open and public.play_other_classes_on(p.id)))
        and exists (select 1 from public.lord_heroes lh where lh.player = p.id)
        and public.lord_live_on(p.id)), '[]'::jsonb),
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

-- As in 20261120000300_play_other_classes.sql, except a kid with the hub open (hub_seen) counts as here too.
create or replace function public.lord_clash_challenge(player uuid, other uuid, wait_ms integer)
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
     or not (exists (select 1 from public.lord_here h where h.player = other and h.seen_at > now() - interval '75 seconds') or public.hub_seen(other)) then
    result := 'away';
  elsif them.school_id is distinct from me.school_id or not public.plays_other_classes(player, other) then
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

-- ---------------------------------------------------------------------------
-- 4. Clan Quest live duels
-- ---------------------------------------------------------------------------

-- As in 20261120000300_play_other_classes.sql, except `online` also lists clans whose owner has the hub open (hub_here),
-- and checks each listed kid's own live-duel switch.
create or replace function public.clan_duel_here()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  my_class uuid;
  my_school integer;
  my_open boolean;
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
  my_open := public.play_other_classes_on(me);
  select p.school_id into my_school from public.profiles p where p.id = me;
  return jsonb_build_object(
    'online', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.public_id, 'name', c.name, 'busy', public.clan_duel_busy(p.id),
                                          'sameClass', coalesce(k.class_id = my_class, false), 'className', k.class_name)
                       order by coalesce(k.class_id = my_class, false) desc, c.name)
      from public.profiles p
      join public.clans c on c.player = p.id
      left join lateral public.class_card_of(p.id) k on true
      where p.id in (select h.player from public.clan_here h where h.seen_at > now() - interval '75 seconds'
                     union select h.player from public.hub_here h where h.seen_at > now() - interval '75 seconds')
        and p.id <> me and p.role = 'student' and not p.hidden and p.school_id = my_school
        and ((my_class is not null and k.class_id = my_class) or (my_open and public.play_other_classes_on(p.id)))
        and public.clan_duels_on(p.id)), '[]'::jsonb),
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

-- As in 20261120000300_play_other_classes.sql, except a kid with the hub open (hub_seen) counts as here too.
create or replace function public.clan_duel_challenge(player uuid, other uuid, wait_ms integer)
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
     or not (exists (select 1 from public.clan_here h where h.player = them.id and h.seen_at > now() - interval '75 seconds') or public.hub_seen(them.id)) then
    result := 'away';
  elsif them.school_id is distinct from me.school_id or not public.plays_other_classes(me.id, them.id) then
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

-- ---------------------------------------------------------------------------
-- Who can call what (create or replace keeps old grants; said again so this file reads on its own)
-- ---------------------------------------------------------------------------

revoke execute on function
  public.hub_seen(uuid), public.hub_here(), public.hub_here_tidy(),
  public.archery_duel_challenge(uuid, text, uuid, text, bigint, integer), public.archery_here(),
  public.lord_here(), public.lord_clash_challenge(uuid, uuid, integer),
  public.clan_duel_here(), public.clan_duel_challenge(uuid, uuid, integer)
from public, anon, authenticated;
grant execute on function
  public.hub_here(), public.archery_here(), public.lord_here(), public.clan_duel_here()
to authenticated;
grant execute on function
  public.archery_duel_challenge(uuid, text, uuid, text, bigint, integer), public.lord_clash_challenge(uuid, uuid, integer),
  public.clan_duel_challenge(uuid, uuid, integer)
to service_role;
