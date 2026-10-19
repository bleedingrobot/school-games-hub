-- Server load S.4 (docs/SERVER-LOAD-PLAN.md): everything the lobby needs on each refresh, in one request instead of about 9.
-- Nothing is written.
--
-- It runs as the person asking (security invoker), so the tables' own row rules still decide what they can see, exactly as when the
-- lobby read them one by one. The four lists of open games come from the jobs that already exist (lobby_games, space_lobby_games,
-- card_lobby_games, power_lobby_games), called rather than copied, each in its own order. My own open games are the lobby's own
-- table reads: the same columns, filters, order and limits (src/data/multiplayer.ts, spaceGames.ts, cardGames.ts, powerGames.ts),
-- the same as my_home_page's. The lobby still drops expired waiting games itself, as before. The playing-friends switch is not in
-- here: it comes from the remembered settings read (S.1).
--
-- Each part has the same shape the lobby got from its own request: a list, in the same order. It is built as plain json, the way
-- the server builds each answer, and written in plpgsql so the database keeps its plan between calls instead of working it out
-- every 20 seconds for every pupil (timed against the separate requests on the local copy: the same, about 14 ms each way).

create function public.lobby()
returns json
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  return (
    with
      friend_open as (
        select g.id, g.game, g.code, g.in_lobby, g.created_by, g.first_player, g.second_player, g.status, g.moves, g.version, g.created_at,
               g.expires_at, g.started_at, g.turn_started_at, g.draw_offer, g.first_draw_offers, g.second_draw_offers, g.first_offer_ply,
               g.second_offer_ply, g.winner, g.reason, g.counts_for_points, g.finished_at, g.first_wants_rematch, g.second_wants_rematch,
               g.rematch_game
        from public.mp_games g
        where g.status in ('waiting', 'playing')
        order by g.created_at desc
        limit 10),
      space_open as (
        select g.id, g.code, g.in_lobby, g.host, g.seat1, g.seat2, g.seat3, g.seat4, g.status, g.setup, g.rockets, g.seat_info,
               g.version, g.created_at, g.expires_at, g.started_at, g.finished_at, g.ending, g.places, g.counts, g.rematch_game
        from public.space_games g
        where g.status in ('waiting', 'playing')
        order by g.created_at desc
        limit 10),
      card_open as (
        select s.game, s.player, s.seat, s.version, s.status, s.info, s.updated_at
        from public.card_game_seats s
        where s.status in ('waiting', 'playing')
        order by s.updated_at desc
        limit 10),
      power_open as (
        select g.id, g.code, g.in_lobby, g.host, g.seat1, g.seat2, g.loadouts, g.status, g.version, g.created_at, g.expires_at,
               g.started_at, g.finished_at, g.ending, g.leaver, g.won, g.counts, g.rematch_game
        from public.power_games g
        where g.status in ('waiting', 'playing')
        order by g.created_at desc
        limit 10),
      -- The lobby looks up names and avatars for the other players in my open games of every kind. (It leaves out my expired waiting
      -- games first, so this can also name someone it then doesn't show; nothing on the page changes.) 101 keeps its players as text.
      other_players as (
        select x.id from friend_open g, unnest(array[g.first_player, g.second_player]) as x(id)
        union
        select x.id from space_open g, unnest(array[g.seat1, g.seat2, g.seat3, g.seat4]) as x(id)
        union
        select case when x.id ~* '^[0-9a-f-]{36}$' then x.id::uuid end
        from card_open s, jsonb_array_elements_text(case when jsonb_typeof(s.info -> 'players') = 'array' then s.info -> 'players' end) as x(id)
        union
        select x.id from power_open g, unnest(array[g.seat1, g.seat2]) as x(id))
    select json_build_object(
      -- The open games anyone can join: each job's own list, in its own order (newest first, at most 30).
      'friendLobby', (select coalesce(json_agg(r), '[]') from public.lobby_games() r),
      'spaceLobby', (select coalesce(json_agg(r), '[]') from public.space_lobby_games() r),
      'cardLobby', (select coalesce(json_agg(r), '[]') from public.card_lobby_games() r),
      'powerLobby', (select coalesce(json_agg(r), '[]') from public.power_lobby_games() r),
      'friendOpen', (select coalesce(json_agg(r order by r.created_at desc), '[]') from friend_open r),
      'spaceOpen', (select coalesce(json_agg(r order by r.created_at desc), '[]') from space_open r),
      'cardOpen', (select coalesce(json_agg(r order by r.updated_at desc), '[]') from card_open r),
      'powerOpen', (select coalesce(json_agg(r order by r.created_at desc), '[]') from power_open r),
      -- Looked up by id, as the lobby did, so the profiles' row rule is only checked for these few.
      'players', (select coalesce(json_agg(json_build_object('id', p.id, 'display_name', p.display_name, 'avatar', p.avatar) order by p.id), '[]')
                  from public.profiles p
                  where p.id = any(array(select o.id from other_players o where o.id is not null and o.id <> auth.uid())))
    )
  );
end
$$;

revoke execute on function public.lobby() from public, anon, authenticated;
grant execute on function public.lobby() to authenticated;
