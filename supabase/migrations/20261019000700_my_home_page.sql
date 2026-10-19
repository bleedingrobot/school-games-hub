-- Server load S.2 (docs/SERVER-LOAD-PLAN.md): everything the home page and its three cards (class, maths focus, maths path) need,
-- in one request instead of about 20. Nothing is written.
--
-- It runs as the person asking (security invoker), so the tables' own row rules still decide what they can see, exactly as when the
-- page read them one by one. The jobs that already exist are called rather than copied, so the numbers can't drift apart. The
-- direct table reads are the page's own: the same columns, filters, order and limits (src/data/botGames.ts, multiplayer.ts,
-- spaceGames.ts, cardGames.ts, powerGames.ts). The page still drops expired waiting games and keeps only the ones being played,
-- as before. The game switches are not in here: they come from the remembered settings read (S.1).
--
-- Each part has the same shape the page got from its own request: a list for a list, one row for a single row, the job's own
-- answer (which may be null) for a job.

create function public.my_home_page()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with
    friend_recent as (
      select g.id, g.game, g.code, g.in_lobby, g.created_by, g.first_player, g.second_player, g.status, g.moves, g.version, g.created_at,
             g.expires_at, g.started_at, g.turn_started_at, g.draw_offer, g.first_draw_offers, g.second_draw_offers, g.first_offer_ply,
             g.second_offer_ply, g.winner, g.reason, g.counts_for_points, g.finished_at, g.first_wants_rematch, g.second_wants_rematch,
             g.rematch_game
      from public.mp_games g
      where g.status = 'finished'
      order by g.finished_at desc
      limit 5),
    friend_open as (
      select g.id, g.game, g.code, g.in_lobby, g.created_by, g.first_player, g.second_player, g.status, g.moves, g.version, g.created_at,
             g.expires_at, g.started_at, g.turn_started_at, g.draw_offer, g.first_draw_offers, g.second_draw_offers, g.first_offer_ply,
             g.second_offer_ply, g.winner, g.reason, g.counts_for_points, g.finished_at, g.first_wants_rematch, g.second_wants_rematch,
             g.rematch_game
      from public.mp_games g
      where g.status in ('waiting', 'playing')
      order by g.created_at desc
      limit 10),
    -- The page looks up names and avatars for the other players in recent friend games and friend games being played.
    other_players as (
      select x.id from friend_recent g, unnest(array[g.first_player, g.second_player]) as x(id)
      union
      select x.id from friend_open g, unnest(array[g.first_player, g.second_player]) as x(id) where g.status = 'playing')
  select jsonb_build_object(
    'progress', public.my_progress(),
    'botRecent', (select coalesce(jsonb_agg(to_jsonb(r) order by r.finished_at desc), '[]')
                  from (select g.id, g.game, g.bot_level, g.result, g.reason, g.finished_at, g.space -> 'place' as place,
                               g.card101 -> 'place' as "card101Place"
                        from public.bot_games g order by g.finished_at desc limit 5) r),
    'botStats', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from public.my_bot_game_stats() s),
    'friendRecent', (select coalesce(jsonb_agg(to_jsonb(r) order by r.finished_at desc), '[]') from friend_recent r),
    'friendStats', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from public.my_friend_game_stats() s),
    'friendOpen', (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]') from friend_open r),
    'players', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'display_name', p.display_name, 'avatar', p.avatar) order by p.id), '[]')
                from public.profiles p
                where p.id in (select o.id from other_players o where o.id is not null and o.id <> auth.uid())),
    'spaceRecent', (select coalesce(jsonb_agg(to_jsonb(r) order by r.finished_at desc), '[]')
                    from (select g.id, g.code, g.in_lobby, g.host, g.seat1, g.seat2, g.seat3, g.seat4, g.status, g.setup, g.rockets, g.seat_info,
                                 g.version, g.created_at, g.expires_at, g.started_at, g.finished_at, g.ending, g.places, g.counts, g.rematch_game
                          from public.space_games g where g.status = 'finished' order by g.finished_at desc limit 5) r),
    'spaceOpen', (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]')
                  from (select g.id, g.code, g.in_lobby, g.host, g.seat1, g.seat2, g.seat3, g.seat4, g.status, g.setup, g.rockets, g.seat_info,
                               g.version, g.created_at, g.expires_at, g.started_at, g.finished_at, g.ending, g.places, g.counts, g.rematch_game
                        from public.space_games g where g.status in ('waiting', 'playing') order by g.created_at desc limit 10) r),
    'spaceStats', (select to_jsonb(s) from public.my_space_game_stats() s),
    'cardRecent', (select coalesce(jsonb_agg(to_jsonb(r) order by r.updated_at desc), '[]')
                   from (select s.game, s.player, s.seat, s.version, s.status, s.info, s.updated_at
                         from public.card_game_seats s where s.status = 'finished' order by s.updated_at desc limit 5) r),
    'cardOpen', (select coalesce(jsonb_agg(to_jsonb(r) order by r.updated_at desc), '[]')
                 from (select s.game, s.player, s.seat, s.version, s.status, s.info, s.updated_at
                       from public.card_game_seats s where s.status in ('waiting', 'playing') order by s.updated_at desc limit 10) r),
    'cardStats', (select to_jsonb(s) from public.my_card_game_stats() s),
    'powerRecent', (select coalesce(jsonb_agg(to_jsonb(r) order by r.finished_at desc), '[]')
                    from (select g.id, g.code, g.in_lobby, g.host, g.seat1, g.seat2, g.loadouts, g.status, g.version, g.created_at, g.expires_at,
                                 g.started_at, g.finished_at, g.ending, g.leaver, g.won, g.counts, g.rematch_game
                          from public.power_games g where g.status = 'finished' order by g.finished_at desc limit 5) r),
    'powerOpen', (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]')
                  from (select g.id, g.code, g.in_lobby, g.host, g.seat1, g.seat2, g.loadouts, g.status, g.version, g.created_at, g.expires_at,
                               g.started_at, g.finished_at, g.ending, g.leaver, g.won, g.counts, g.rematch_game
                        from public.power_games g where g.status in ('waiting', 'playing') order by g.created_at desc limit 10) r),
    'powerStats', (select to_jsonb(s) from public.my_power_game_stats() s),
    'movesLeft', public.my_moves_left(),
    'myClass', public.my_class(),
    'focus', public.my_maths_focus(),
    'ladder', public.my_ladder()
  )
$$;

revoke execute on function public.my_home_page() from public, anon, authenticated;
grant execute on function public.my_home_page() to authenticated;
