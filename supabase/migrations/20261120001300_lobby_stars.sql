-- Play anyone, stage 8: Stars and Played recently (docs/plans/play-anyone/PLAN.md, section F).
--
-- A star is private and one-sided: only the kid who starred can ever read it, the starred kid is never told, and there
-- are no counts anywhere (teachers don't see stars either). Stars change the ORDER of a list only, never who can play
-- whom: every stage 1 rule still decides who is listed (same school, never hidden, "Play other classes" on both sides
-- unless the same class). A starred kid who drops out of those rules simply isn't listed; the star stays quietly.
--
--   lobby_stars              (player, star). No pupil access at all: pupils go through lobby_star().
--   lobby_starred(a, b)      server only: has a starred b.
--   lobby_star(other, starred)        pupils: star (same school, not myself, at most 30) or unstar.
--   lobby_star_clan(clan, starred)    pupils: the same, for a clan row (the clan lists show clans, not names).
--   lobby_played_with(me, since)      server only: kids I finished a game with since then, from the games' own
--                                     finished-game records (nothing new is stored; timed on big made-up data).
--   lobby_here()             adds `starred` and `here` on each kid, `stars_away` and `recent`.
--   archery_here, lord_here, clan_duel_here, clan_village_mates: each row adds `starred`. Otherwise as before
--                            (20261120000500_hub_here.sql, 20261120000900_raids_school_wide.sql).

create table public.lobby_stars (
  player uuid not null references public.profiles (id) on delete cascade,
  star uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (player, star),
  check (player <> star)
);
alter table public.lobby_stars enable row level security;
-- No policies: pupils and teachers never read or write it directly.
revoke all on public.lobby_stars from public, anon, authenticated;
grant all on public.lobby_stars to service_role;

-- Has `a` starred `b`? Only ever asked about the kid who is looking (a = me).
create function public.lobby_starred(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.lobby_stars s where s.player = a and s.star = b)
$$;

-- Star (starred = true) or unstar another pupil. Same school and not myself; at most 30 stars. Unstarring always works.
-- It never says whether the other kid is hidden or why they can't be starred, and nothing is sent to them.
create function public.lobby_star(other uuid, starred boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  my_school integer;
begin
  select p.school_id into my_school from public.profiles p where p.id = me and p.role = 'student' and not p.hidden;
  if not public.is_school_user() or my_school is null then
    return jsonb_build_object('ok', false, 'message', 'Only pupils can star friends.');
  end if;
  if not coalesce(lobby_star.starred, false) then
    delete from public.lobby_stars s where s.player = me and s.star = other;
    return jsonb_build_object('ok', true, 'starred', false);
  end if;
  if other is null or other = me or not exists (
    select 1 from public.profiles p where p.id = other and p.role = 'student' and not p.hidden and p.school_id = my_school
  ) then
    return jsonb_build_object('ok', false, 'message', 'You can’t star that player.');
  end if;
  -- One star at a time per kid, so two quick taps can't go past 30.
  perform pg_advisory_xact_lock(hashtextextended('lobby_stars:' || me::text, 0));
  if exists (select 1 from public.lobby_stars s where s.player = me and s.star = other) then
    return jsonb_build_object('ok', true, 'starred', true);
  end if;
  if (select count(*) from public.lobby_stars s where s.player = me) >= 30 then
    return jsonb_build_object('ok', false, 'full', true, 'message', 'You have 30 stars already. Take a star off someone first.');
  end if;
  insert into public.lobby_stars (player, star) values (me, other) on conflict do nothing;
  return jsonb_build_object('ok', true, 'starred', true);
end;
$$;

-- The same for a clan row: Clan duels and Village Raids list clans by their public id, never the pupil's id.
create function public.lobby_star_clan(clan uuid, starred boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  kid uuid;
begin
  select c.player into kid from public.clans c where c.public_id = clan;
  if kid is null and coalesce(lobby_star_clan.starred, false) then
    return jsonb_build_object('ok', false, 'message', 'You can’t star that player.');
  end if;
  return public.lobby_star(kid, lobby_star_clan.starred);
end;
$$;

-- Kids `me` finished a game with since `since`, any game, with when they last did. Read from each game's own records:
-- Chess and Checkers, 101, Wormholes, Power Clash, Archery fights, Dragon Maths clashes and Clan duels. Each part uses
-- that table's own per-seat index. Who may be listed is decided by the caller (lobby_here), not here.
create function public.lobby_played_with(me uuid, since timestamptz)
returns table (other uuid, last_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select x.other, max(x.at)
  from (
    select g.second_player as other, g.finished_at as at from public.mp_games g
      where g.first_player = me and g.status = 'finished' and g.finished_at > since
    union all
    select g.first_player, g.finished_at from public.mp_games g
      where g.second_player = me and g.status = 'finished' and g.finished_at > since
    union all
    select s.seat, g.finished_at from public.card_games g
      cross join lateral unnest(array[g.seat1, g.seat2, g.seat3, g.seat4]) s(seat)
      where me in (g.seat1, g.seat2, g.seat3, g.seat4) and g.status = 'finished' and g.finished_at > since
    union all
    select s.seat, g.finished_at from public.space_games g
      cross join lateral unnest(array[g.seat1, g.seat2, g.seat3, g.seat4]) s(seat)
      where me in (g.seat1, g.seat2, g.seat3, g.seat4) and g.status = 'finished' and g.finished_at > since
    union all
    select case when g.seat1 = me then g.seat2 else g.seat1 end, g.finished_at from public.power_games g
      where me in (g.seat1, g.seat2) and g.status = 'finished' and g.finished_at > since
    union all
    select case when d.seat_a = me then d.seat_b else d.seat_a end, d.finished_at from public.archery_duels d
      where me in (d.seat_a, d.seat_b) and d.status = 'done' and d.created_at > since - interval '1 day' and d.finished_at > since
    union all
    select case when d.seat_a = me then d.seat_b else d.seat_a end, d.finished_at from public.lord_clashes d
      where me in (d.seat_a, d.seat_b) and d.status = 'done' and d.created_at > since - interval '1 day' and d.finished_at > since
    union all
    select case when d.seat_a = me then d.seat_b else d.seat_a end, d.finished_at from public.clan_duels d
      where me in (d.seat_a, d.seat_b) and d.status = 'done' and d.created_at > since - interval '1 day' and d.finished_at > since
  ) x
  where x.other is not null and x.other <> me
  group by x.other
$$;

-- lobby_here(): as stage 4 (20261120000800_name_invites.sql), plus:
--   online[].starred, online[].here (always true)
--   stars_away  my starred kids who may be listed but aren't here now: id, name, avatar, sameClass, className
--   recent      up to 8 kids I finished a game with in the last 14 days (newest first), with the same fields and states
--               as `online`, plus `here` and `starred`
-- Every kid in all three lists passes the same stage 1 rules as before.
create or replace function public.lobby_here()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  my_class uuid;
  my_school integer;
  my_open boolean;
  my_archery text;
  my_lord text;
  my_clan text;
  my_isles text;
  my_raids text;
  my_boards boolean;
  my_non_maths boolean;
  kids_part jsonb;
begin
  if not public.is_school_user() or not exists (select 1 from public.profiles p where p.id = me and p.role = 'student' and not p.hidden) then
    return jsonb_build_object('me', null, 'going', '[]'::jsonb, 'online', '[]'::jsonb, 'stars_away', '[]'::jsonb, 'recent', '[]'::jsonb);
  end if;
  my_class := public.current_class_of(me);
  my_open := public.play_other_classes_on(me);
  select p.school_id into my_school from public.profiles p where p.id = me;

  my_archery := case when not public.archery_duels_on_for(me) then 'off'
                     when not exists (select 1 from public.archery_players a where a.player = me) then 'none' else 'ready' end;
  my_lord := case when not public.lord_live_on(me) then 'off'
                  when not exists (select 1 from public.lord_heroes h where h.player = me) then 'none' else 'ready' end;
  my_clan := case when not public.clan_duels_on(me) then 'off'
                  when not exists (select 1 from public.clans c where c.player = me) then 'none' else 'ready' end;
  my_isles := case when not coalesce((select s.isles_enabled and s.isles_races from public.settings_of(me) s), false) then 'off'
                   when not exists (select 1 from public.isles_islands i where i.player = me and i.keeper is not null) then 'none' else 'ready' end;
  select coalesce(s.multiplayer_enabled, false), coalesce(s.non_maths_games, true) into my_boards, my_non_maths from public.settings_of(me) s;
  my_boards := coalesce(my_boards, false);
  my_non_maths := coalesce(my_non_maths, true);

  my_raids := case when not coalesce((select s.clans_enabled and s.clan_raids_enabled from public.settings_of(me) s), false) then 'off'
                   when not exists (select 1 from public.clans c where c.player = me) then 'none' else 'ready' end;

  with here as (
    select h.player from public.hub_here h where h.seen_at > now() - interval '75 seconds'
    union select h.player from public.archery_here h where h.seen_at > now() - interval '75 seconds'
    union select h.player from public.lord_here h where h.seen_at > now() - interval '75 seconds'
    union select h.player from public.clan_here h where h.seen_at > now() - interval '75 seconds'
  ),
  pool as (
    select x.id, bool_or(x.here) as here, max(x.last_at) as last_at, bool_or(x.starred) as starred
    from (select h.player as id, true as here, null::timestamptz as last_at, false as starred from here h
          union all
          select r.other, false, r.last_at, false from public.lobby_played_with(me, now() - interval '14 days') r
          union all
          select s.star, false, null, true from public.lobby_stars s where s.player = me) x
    group by x.id
  ),
  -- Everyone I may be shown: the stage 1 rules, exactly as before.
  kids as (
    select p.id, p.display_name, p.avatar, pool.here, pool.last_at, pool.starred,
           coalesce(k.class_id = my_class, false) as same_class, k.class_name
    from pool
    join public.profiles p on p.id = pool.id
    left join lateral public.class_card_of(p.id) k on true
    where p.id <> me and p.role = 'student' and not p.hidden and p.school_id = my_school
      and ((my_class is not null and k.class_id = my_class) or (my_open and public.play_other_classes_on(p.id)))
  ),
  recent as (
    select k.id from kids k where k.last_at is not null order by k.last_at desc, k.display_name limit 8
  ),
  -- What we could play together, only for the kids who are here or in Played recently.
  cards as (
    select k.*, k.id in (select r.id from recent r) as is_recent,
           jsonb_build_object(
             'id', k.id, 'name', k.display_name, 'avatar', k.avatar,
             'sameClass', k.same_class, 'className', k.class_name, 'starred', k.starred, 'here', k.here,
             'clan', (select c.public_id from public.clans c where c.player = k.id and my_clan = 'ready'),
             'games', jsonb_strip_nulls(jsonb_build_object(
               'archery', case when my_archery <> 'ready' then null
                               when not public.archery_duels_on_for(k.id) then 'off'
                               when public.archery_duel_busy(k.id) or public.archery_snoozed(k.id, me) then 'busy' else 'ok' end,
               'dragon-maths', case when my_lord <> 'ready' then null
                                    when not public.lord_live_on(k.id) then 'off'
                                    when not exists (select 1 from public.lord_heroes h where h.player = k.id) then 'none'
                                    when public.lord_clash_busy(k.id) then 'busy' else 'ok' end,
               'clan-quest', case when my_clan <> 'ready' then null
                                  when not public.clan_duels_on(k.id) then 'off'
                                  when not exists (select 1 from public.clans c where c.player = k.id) then 'none'
                                  when public.clan_duel_busy(k.id) then 'busy' else 'ok' end)) || coalesce((
               -- The board games by invite (stage 4): only the ones I can play myself.
               select jsonb_object_agg(b.game, case
                        when not coalesce(t.multiplayer_enabled, false) or (b.game <> 'space' and not coalesce(t.non_maths_games, true)) then 'off'
                        when exists (select 1 from public.board_invites i where i.seat_b = k.id and i.status in ('asked', 'taking') and i.deadline > now()) then 'busy'
                        else 'ok' end)
               from unnest(array['chess', 'checkers', '101', 'space', 'power-clash']) b(game)
               left join lateral public.settings_of(k.id) t on true
               where my_boards and (b.game = 'space' or my_non_maths)), '{}'::jsonb)) as card
    from kids k
    where k.here or k.id in (select r.id from recent r)
  )
  select jsonb_build_object(
    'online', coalesce((select jsonb_agg(c.card order by c.same_class desc, c.display_name) from cards c where c.here), '[]'::jsonb),
    'stars_away', coalesce((
      select jsonb_agg(jsonb_build_object('id', k.id, 'name', k.display_name, 'avatar', k.avatar,
                                          'sameClass', k.same_class, 'className', k.class_name)
                       order by k.display_name)
      from kids k where k.starred and not k.here), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(c.card order by c.last_at desc, c.display_name) from cards c where c.is_recent), '[]'::jsonb))
  into kids_part;

  return jsonb_build_object(
    'me', jsonb_build_object('archery', my_archery, 'dragon-maths', my_lord, 'clan-quest', my_clan, 'isles', my_isles, 'raid', my_raids),
    'going', coalesce((
      select jsonb_agg(g order by g->>'at' desc) from (
        select jsonb_build_object('game', 'archery', 'id', d.id, 'status', d.status, 'at', d.created_at,
                                  'with', case when d.seat_a = me then d.name_b else d.name_a end) as g
        from public.archery_duels d
        where (d.status in ('packing', 'playing') and me in (d.seat_a, d.seat_b)) or (d.status = 'asked' and d.seat_a = me and d.deadline > now())
        union all
        select jsonb_build_object('game', 'dragon-maths', 'id', x.id, 'status', x.status, 'at', x.created_at,
                                  'with', case when x.seat_a = me then x.name_b else x.name_a end)
        from public.lord_clashes x
        where (x.status = 'playing' and me in (x.seat_a, x.seat_b)) or (x.status = 'asked' and x.seat_a = me and x.deadline > now())
        union all
        select jsonb_build_object('game', 'clan-quest', 'id', x.id, 'status', x.status, 'at', x.created_at,
                                  'with', case when x.seat_a = me then x.name_b else x.name_a end)
        from public.clan_duels x
        where (x.status = 'playing' and me in (x.seat_a, x.seat_b)) or (x.status = 'asked' and x.seat_a = me and x.deadline > now())
        union all
        select jsonb_build_object('game', i.game, 'id', i.id, 'status', 'asked', 'at', i.created_at, 'with', i.name_b)
        from public.board_invites i
        where i.seat_a = me and i.status = 'asked' and i.deadline > now()
      ) mine), '[]'::jsonb)) || kids_part;
end;
$$;

-- ---------------------------------------------------------------------------
-- The games' own "who's here" lists: each row adds `starred` (as 20261120000500_hub_here.sql otherwise)
-- ---------------------------------------------------------------------------

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
                                          'sameClass', coalesce(k.class_id = my_class, false), 'className', k.class_name, 'starred', public.lobby_starred(me, p.id))
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
                                          'sameClass', coalesce(k.class_id = my_class, false), 'className', k.class_name, 'starred', public.lobby_starred(me, p.id))
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
                                          'sameClass', coalesce(k.class_id = my_class, false), 'className', k.class_name, 'starred', public.lobby_starred(me, p.id))
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

-- Village Raids: as 20261120000900_raids_school_wide.sql, plus `starred` (the clan's pupil, for the kid asking).
create or replace function public.clan_village_mates(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cls uuid := public.current_class_of(player);
  my_school bigint;
begin
  perform public.clan_check_player(player);
  select p.school_id into my_school from public.profiles p where p.id = clan_village_mates.player;
  if cls is null or my_school is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', t.public_id, 'name', t.name,
      'heroLevels', (select coalesce(sum((m.member ->> 'level')::integer), 0) from public.clan_members m where m.player = t.player),
      'levels', t.empire -> 'levels', 'troops', t.empire -> 'troops', 'banners', t.empire -> 'banners',
      'sameClass', t.same_class, 'className', case when t.same_class then null else t.class_name end,
      'canRaid', public.clan_can_raid(clan_village_mates.player, t.player), 'starred', public.lobby_starred(clan_village_mates.player, t.player))
      order by t.same_class desc, t.name, t.public_id)
    from (select c.player, c.public_id, c.name, e.empire, public.current_class_of(c.player) = cls as same_class,
                 (select k.class_name from public.class_card_of(c.player) k) as class_name
          from public.clans c
          join public.clan_empires e on e.player = c.player
          join public.profiles p on p.id = c.player
          where c.player <> clan_village_mates.player and p.school_id = my_school and p.role = 'student' and not p.hidden
            and public.current_class_of(c.player) is not null
            and public.plays_other_classes(clan_village_mates.player, c.player)
          order by (public.current_class_of(c.player) = cls) desc, c.name, c.public_id
          limit 2000) t), '[]');
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what (create or replace keeps old grants; said again so this file reads on its own)
-- ---------------------------------------------------------------------------

revoke execute on function
  public.lobby_starred(uuid, uuid), public.lobby_star(uuid, boolean), public.lobby_star_clan(uuid, boolean),
  public.lobby_played_with(uuid, timestamptz), public.lobby_here(),
  public.archery_here(), public.lord_here(), public.clan_duel_here(), public.clan_village_mates(uuid)
from public, anon, authenticated;
grant execute on function
  public.lobby_star(uuid, boolean), public.lobby_star_clan(uuid, boolean), public.lobby_here(),
  public.archery_here(), public.lord_here(), public.clan_duel_here()
to authenticated;
grant execute on function
  public.lobby_starred(uuid, uuid), public.lobby_played_with(uuid, timestamptz), public.clan_village_mates(uuid)
to service_role;
