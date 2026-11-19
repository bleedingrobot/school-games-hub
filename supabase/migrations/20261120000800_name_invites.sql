-- Play anyone, stage 4 (docs/plans/play-anyone/PLAN.md, section D, "Inviting someone by name"): invite a kid who's
-- here to Chess, Checkers, 101, Wormholes & Black Holes or Power Clash, with no code to type.
--
-- - board_invite_send(game, other, setup) makes the invite. It waits 60 seconds. One waiting invite out per kid, and a
--   kid with one waiting for them is busy. Every stage 1 rule is checked: school pupils only, nobody hidden, the same
--   school, "Play other classes" on in both classes (the same class is never affected), friends' games on for both, and
--   for every game but Wormholes & Black Holes, non-maths games not paused for either.
-- - Yes goes through the game's own server function ("invite" action). It calls board_invite_take(), which checks every
--   rule again and claims the invite in one step, then makes a private game for just the two of them (the inviter in
--   seat 1, not in the open-games list) and says where it is with board_invite_made().
-- - No (board_invite_decline) and Call off (board_invite_cancel) are the pupils' own steps.
-- - The invite rows reach both kids live (Realtime): each kid can read only invites they sent or were sent.
--
-- hub_here() also says which board games have an invite waiting, and lobby_here() gives each kid's state for the five
-- games ('ok', 'off' when their class has friends' games or non-maths games paused, 'busy' when they already have an
-- invite waiting) and my own waiting invite in 'going'. Nothing private.

create table public.board_invites (
  id bigint generated always as identity primary key,
  game text not null check (game in ('chess', 'checkers', '101', 'space', 'power-clash')),
  seat_a uuid not null references public.profiles(id) on delete cascade,
  seat_b uuid not null references public.profiles(id) on delete cascade,
  name_a text not null,
  name_b text not null,
  -- The inviter's choices for Wormholes & Black Holes (board and settings) or 101 (target); checked by the game's own
  -- server function when the game is made.
  setup jsonb check (setup is null or octet_length(setup::text) <= 4000),
  -- asked → taking (Yes, the game is being made) → accepted (with path); or declined, cancelled, expired.
  status text not null default 'asked' check (status in ('asked', 'taking', 'accepted', 'declined', 'cancelled', 'expired')),
  deadline timestamptz not null,
  path text check (path is null or path ~ '^/[a-z0-9-]+/[0-9a-f-]{36}$'),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  check (seat_a <> seat_b)
);

-- One waiting invite out each, and one waiting for each kid (older ones are marked expired before a new one goes in).
create unique index board_invites_one_out on public.board_invites (seat_a) where status in ('asked', 'taking');
create unique index board_invites_one_in on public.board_invites (seat_b) where status in ('asked', 'taking');
create index board_invites_created on public.board_invites (created_at);

alter table public.board_invites enable row level security;
-- Read only: invites I sent or was sent. Every change goes through the functions below.
create policy "board invites: my own" on public.board_invites for select to authenticated
  using (seat_a = (select auth.uid()) or seat_b = (select auth.uid()));
revoke all on public.board_invites from anon, authenticated;
grant select on public.board_invites to authenticated;
grant all on public.board_invites to service_role;

alter publication supabase_realtime add table public.board_invites;

-- Why these two can't play this game together by invite, in the inviter's words; null when they can.
create or replace function public.board_invite_why(a uuid, b uuid, game text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  sa public.app_settings;
  sb public.app_settings;
begin
  if a = b then
    return 'That’s you!';
  end if;
  if not exists (select 1 from public.profiles p where p.id = a and p.role = 'student' and not p.hidden) then
    return 'Playing friends isn’t available for you right now. Ask your teacher.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = b and p.role = 'student' and not p.hidden) then
    return 'They can’t play right now.';
  end if;
  if not public.plays_other_classes(a, b) then
    return 'That player’s class isn’t playing other classes right now.';
  end if;
  select * into sa from public.settings_of(a);
  select * into sb from public.settings_of(b);
  if not coalesce(sa.multiplayer_enabled, false) or (game <> 'space' and not coalesce(sa.non_maths_games, true)) then
    return 'Your teacher has paused this.';
  end if;
  if not coalesce(sb.multiplayer_enabled, false) or (game <> 'space' and not coalesce(sb.non_maths_games, true)) then
    return 'Their class has paused this game right now.';
  end if;
  return null;
end;
$$;

-- Invites that ran out are marked expired (so the one-each rules let a new one in).
create or replace function public.board_invites_expire(player uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.board_invites i set status = 'expired'
  where (i.seat_a = player or i.seat_b = player) and i.status = 'asked' and i.deadline <= now()
$$;

create or replace function public.board_invite_send(game text, other uuid, setup jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  why text;
  invite public.board_invites;
begin
  if not public.is_school_user() or game is null or game not in ('chess', 'checkers', '101', 'space', 'power-clash') or other is null then
    return jsonb_build_object('ok', false, 'message', 'That invite couldn’t be sent.');
  end if;
  why := public.board_invite_why(me, other, game);
  if why is not null then
    return jsonb_build_object('ok', false, 'message', why);
  end if;
  perform public.board_invites_expire(me);
  perform public.board_invites_expire(other);
  if exists (select 1 from public.board_invites i where i.seat_a = me and i.status in ('asked', 'taking')) then
    return jsonb_build_object('ok', false, 'message', 'You already have an invite waiting. Call it off first.');
  end if;
  if exists (select 1 from public.board_invites i where i.seat_b = other and i.status in ('asked', 'taking')) then
    return jsonb_build_object('ok', false, 'message', 'They have another invite waiting. Try again in a minute.');
  end if;
  insert into public.board_invites (game, seat_a, seat_b, name_a, name_b, setup, deadline)
  values (game, me, other,
          (select p.display_name from public.profiles p where p.id = me),
          (select p.display_name from public.profiles p where p.id = other),
          case when game in ('space', '101') then setup end,
          now() + interval '60 seconds')
  returning * into invite;
  return jsonb_build_object('ok', true, 'id', invite.id, 'deadline', invite.deadline);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'message', 'That invite couldn’t be sent just then. Try again.');
end;
$$;

-- No: only the kid it was sent to, while it's waiting.
create or replace function public.board_invite_decline(invite bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.board_invites i set status = 'declined', answered_at = now()
  where i.id = invite and i.seat_b = auth.uid() and i.status = 'asked'
$$;

-- Call off: my own waiting invite.
create or replace function public.board_invite_cancel()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.board_invites i set status = 'cancelled', answered_at = now()
  where i.seat_a = auth.uid() and i.status = 'asked'
$$;

-- Yes, from the game's own server function (server only): every rule checked again, and the invite claimed in one step.
-- Gives back the inviter and their choices, or nothing if it isn't there to take.
create or replace function public.board_invite_take(invite bigint, player uuid, kind text)
returns table (seat_a uuid, setup jsonb)
language sql
security definer
set search_path = ''
as $$
  update public.board_invites i set status = 'taking', answered_at = now()
  where i.id = invite and i.seat_b = player and i.game = kind and i.status = 'asked' and i.deadline > now()
    and public.board_invite_why(i.seat_a, i.seat_b, i.game) is null
  returning i.seat_a, i.setup
$$;

-- The game is made (path), or couldn't be (null).
create or replace function public.board_invite_made(invite bigint, made_path text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.board_invites i
  set status = case when made_path is null then 'cancelled' else 'accepted' end, path = made_path
  where i.id = invite and i.status = 'taking'
$$;

-- Old rows go after a day.
create or replace function public.board_invites_tidy()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.board_invites i where i.created_at < now() - interval '1 day'
$$;

select cron.schedule('tidy-board-invites', '31 3 * * *', 'select public.board_invites_tidy()');

revoke execute on function public.board_invite_why(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.board_invites_expire(uuid) from public, anon, authenticated;
revoke execute on function public.board_invite_take(bigint, uuid, text) from public, anon, authenticated;
revoke execute on function public.board_invite_made(bigint, text) from public, anon, authenticated;
revoke execute on function public.board_invites_tidy() from public, anon, authenticated;
grant execute on function public.board_invite_take(bigint, uuid, text) to service_role;
grant execute on function public.board_invite_made(bigint, text) to service_role;
revoke execute on function public.board_invite_send(text, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.board_invite_decline(bigint) from public, anon, authenticated;
revoke execute on function public.board_invite_cancel() from public, anon, authenticated;
grant execute on function public.board_invite_send(text, uuid, jsonb) to authenticated;
grant execute on function public.board_invite_decline(bigint) to authenticated;
grant execute on function public.board_invite_cancel() to authenticated;

-- ---------------------------------------------------------------------------
-- hub_here(): also the board games with an invite waiting for me.
-- ---------------------------------------------------------------------------

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
    case when exists (select 1 from public.clan_duels x where x.seat_b = me and x.status = 'asked' and x.deadline > now()) then 'clan-quest' end,
    (select i.game from public.board_invites i where i.seat_b = me and i.status = 'asked' and i.deadline > now() limit 1)
  ], null)));
end;
$$;

-- ---------------------------------------------------------------------------
-- lobby_here(): as stage 3 (20261120000700_lobby_here.sql), plus each kid's state for the five board games and my own
-- waiting invite in 'going'. Board games I can't play myself (friends' games paused, or non-maths games paused for
-- every game but Wormholes & Black Holes) are left out of each kid's games; the Lobby's tiles already say why.
-- ---------------------------------------------------------------------------

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
begin
  if not public.is_school_user() or not exists (select 1 from public.profiles p where p.id = me and p.role = 'student' and not p.hidden) then
    return jsonb_build_object('me', null, 'going', '[]'::jsonb, 'online', '[]'::jsonb);
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
      ) mine), '[]'::jsonb),
    'online', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'name', p.display_name, 'avatar', p.avatar,
               'sameClass', coalesce(k.class_id = my_class, false), 'className', k.class_name,
               'clan', (select c.public_id from public.clans c where c.player = p.id and my_clan = 'ready'),
               'games', jsonb_strip_nulls(jsonb_build_object(
                 'archery', case when my_archery <> 'ready' then null
                                 when not public.archery_duels_on_for(p.id) then 'off'
                                 when public.archery_duel_busy(p.id) or public.archery_snoozed(p.id, me) then 'busy' else 'ok' end,
                 'dragon-maths', case when my_lord <> 'ready' then null
                                      when not public.lord_live_on(p.id) then 'off'
                                      when not exists (select 1 from public.lord_heroes h where h.player = p.id) then 'none'
                                      when public.lord_clash_busy(p.id) then 'busy' else 'ok' end,
                 'clan-quest', case when my_clan <> 'ready' then null
                                    when not public.clan_duels_on(p.id) then 'off'
                                    when not exists (select 1 from public.clans c where c.player = p.id) then 'none'
                                    when public.clan_duel_busy(p.id) then 'busy' else 'ok' end)) || coalesce((
                 -- The board games by invite (stage 4): only the ones I can play myself.
                 select jsonb_object_agg(b.game, case
                          when not coalesce(t.multiplayer_enabled, false) or (b.game <> 'space' and not coalesce(t.non_maths_games, true)) then 'off'
                          when exists (select 1 from public.board_invites i where i.seat_b = p.id and i.status in ('asked', 'taking') and i.deadline > now()) then 'busy'
                          else 'ok' end)
                 from unnest(array['chess', 'checkers', '101', 'space', 'power-clash']) b(game)
                 left join lateral public.settings_of(p.id) t on true
                 where my_boards and (b.game = 'space' or my_non_maths)), '{}'::jsonb))
             order by coalesce(k.class_id = my_class, false) desc, p.display_name)
      from public.profiles p
      left join lateral public.class_card_of(p.id) k on true
      where p.id in (select h.player from public.hub_here h where h.seen_at > now() - interval '75 seconds'
                     union select h.player from public.archery_here h where h.seen_at > now() - interval '75 seconds'
                     union select h.player from public.lord_here h where h.seen_at > now() - interval '75 seconds'
                     union select h.player from public.clan_here h where h.seen_at > now() - interval '75 seconds')
        and p.id <> me and p.role = 'student' and not p.hidden and p.school_id = my_school
        and ((my_class is not null and k.class_id = my_class) or (my_open and public.play_other_classes_on(p.id)))), '[]'::jsonb));
end;
$$;

