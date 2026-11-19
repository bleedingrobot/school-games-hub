-- Play anyone, stage 3 (docs/plans/play-anyone/PLAN.md, section D): the new Lobby.
--
-- lobby_here() is the Lobby's one read for the live games (Archery fights, Dragon Maths clashes, Clan duels) and the
-- game tiles. It records nothing (the hub's own hub_here() already says "I'm here" every 30 seconds) and gives back:
--
--   me      my state in each game the Lobby can start: 'ready', 'none' (no archer, hero, clan or island yet) or 'off'
--           (the teacher has paused it, or its live part). Only about me.
--   going   my own live fight, clash or duel that is waiting or being played, so the Lobby can say "Carry on".
--   online  kids who are here now (the hub or any of the three games open in the last 75 seconds), my class first, then
--           the rest of the school, with my class's flag and their class name (as the games' own lists). For each live
--           game: 'ok', 'none' (they haven't made a hero, clan or archer), 'off' (their class has it paused), 'busy' (in
--           a game, or they snoozed my challenges). Nothing else about them: no scores, no maths, no year. (Archery needs
--           no archer from the one challenged, so 'none' is only Dragon Maths and Clan duels.)
--
-- Every stage 1 and 2 rule stays: school pupils only, hidden pupils never listed, same school, plays_other_classes()
-- (either class with "Play other classes" off keeps them apart; the same class is never affected). A game I can't play
-- myself is left out of each kid's games (the tile already says why). The challenges themselves still go through each
-- game's own server step, which checks everything again.

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
                                    when public.clan_duel_busy(p.id) then 'busy' else 'ok' end)))
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

revoke execute on function public.lobby_here() from public, anon, authenticated;
grant execute on function public.lobby_here() to authenticated;
