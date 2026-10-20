-- Server load S.4: lobby() gives the lobby everything in one answer. It must give exactly what the lobby got from its separate
-- requests (the four open-game jobs, and the same table reads with the same order and limits, and the names lookup), for a pupil
-- with open games of every kind, a pupil with none, a teacher, a hidden pupil, a pupil at another school, and with playing friends
-- switched off. Expired and finished games are left out as before. It runs as the pupil, so nobody sees another pupil's private
-- rows through it.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

create function pg_temp.uid(n integer) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;
-- A second school, so the first school's pupil is at another school.
select setval(pg_get_serial_sequence('public.schools', 'id'), 1);
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id) values ('otherschool.school.nz', 2);

-- 1 Ana: open games of every kind. 2 Ben: her classmate. 3 Cat: hidden, plays Ana and has a lobby game. 4 Dan: brand new.
-- 5 Eve: at another school, with a lobby game. 6 Fin: has a lobby game of every kind. 11: Ana's teacher.
insert into auth.users (id, email) values
  (pg_temp.uid(1), 'ana@otherschool.school.nz'), (pg_temp.uid(2), 'ben@otherschool.school.nz'),
  (pg_temp.uid(3), 'cat@otherschool.school.nz'), (pg_temp.uid(4), 'dan@otherschool.school.nz'),
  (pg_temp.uid(5), 'eve@douglaspark.school.nz'), (pg_temp.uid(6), 'fin@otherschool.school.nz'),
  (pg_temp.uid(11), 'mr.teacher@otherschool.school.nz');
update public.profiles set role = 'teacher' where id = pg_temp.uid(11);

create temp table emails as select id, email from auth.users;
grant select on emails to public;
create function pg_temp.as(n integer) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(n),
           'email', (select e.email from pg_temp.emails e where e.id = pg_temp.uid(n)), 'role', 'authenticated')::text, true)
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

-- Ana is in Mr Teacher's class, so he can see her Power Clash games.
select pg_temp.as(11);
select public.teacher_add_to_class(public.teacher_create_class('Room 12', 2026, 5), array[pg_temp.uid(1), pg_temp.uid(3)]);
select pg_temp.reset();

-- ---- Chess and checkers ----
-- Ana: 11 being played with Ben (more than the lobby shows), one with hidden Cat, her own waiting game, and finished ones.
insert into public.mp_games (game, created_by, first_player, second_player, status, created_at, started_at)
select case when n % 2 = 0 then 'chess' else 'checkers' end, pg_temp.uid(2), pg_temp.uid(2), pg_temp.uid(1), 'playing',
       now() - interval '1 hour' - n * interval '1 minute', now()
from generate_series(1, 11) n;
insert into public.mp_games (game, created_by, first_player, second_player, status, created_at, started_at)
values ('chess', pg_temp.uid(1), pg_temp.uid(1), pg_temp.uid(3), 'playing', now() - interval '30 minutes', now());
insert into public.mp_games (game, created_by, first_player, status, in_lobby, code, created_at, expires_at)
values ('chess', pg_temp.uid(1), pg_temp.uid(1), 'waiting', true, 'KM4TP', now() - interval '9 minutes', now() + interval '10 minutes');
insert into public.mp_games (game, created_by, first_player, second_player, status, winner, reason, counts_for_points, created_at, finished_at)
select 'chess', pg_temp.uid(1), pg_temp.uid(1), pg_temp.uid(2), 'finished', 'first', 'checkmate', true, now() - n * interval '1 minute', now()
from generate_series(1, 3) n;
-- Lobby games: Fin's (anyone can join), hidden Cat's (left out), Ben's code-only one (left out), Ben's own playing with Fin.
insert into public.mp_games (game, created_by, second_player, status, in_lobby, created_at, expires_at)
values ('checkers', pg_temp.uid(6), pg_temp.uid(6), 'waiting', true, now() - interval '2 minutes', now() + interval '10 minutes'),
       ('chess', pg_temp.uid(3), pg_temp.uid(3), 'waiting', true, now() - interval '1 minute', now() + interval '10 minutes');
insert into public.mp_games (game, created_by, first_player, status, in_lobby, code, created_at, expires_at)
values ('chess', pg_temp.uid(2), pg_temp.uid(2), 'waiting', false, 'CDFGH', now() - interval '3 minutes', now() + interval '10 minutes');

-- ---- Wormholes & Black Holes ----
-- Ana: one being played with Ben and hidden Cat, her own waiting game that Ben has joined, a finished one, and Ben's expired one
-- she joined (left out by the lobby, as now).
insert into public.space_games (code, host, seat1, seat2, seat3, status, setup, rockets, seat_info, state, created_at)
values (null, pg_temp.uid(1), pg_temp.uid(1), pg_temp.uid(2), pg_temp.uid(3), 'playing', '{}', 2, '[]', '{}', now() - interval '20 minutes');
insert into public.space_games (code, in_lobby, host, seat1, seat2, status, setup, rockets, seat_info, state, created_at, expires_at)
values ('JKMNP', true, pg_temp.uid(1), pg_temp.uid(1), pg_temp.uid(2), 'waiting', '{"board":"nebula","settings":{"mode":"cosmic"}}', 2, '[]', '{}',
        now() - interval '8 minutes', now() + interval '10 minutes'),
       ('QRTVW', true, pg_temp.uid(2), pg_temp.uid(2), pg_temp.uid(1), 'waiting', '{}', 2, '[]', '{}', now() - interval '40 minutes',
        now() - interval '20 minutes');
insert into public.space_games (code, host, seat1, seat2, status, setup, rockets, seat_info, state, created_at, finished_at, ending, places, counts)
values (null, pg_temp.uid(1), pg_temp.uid(1), pg_temp.uid(2), 'finished', '{}', 2, '[]', '{}', now() - interval '1 day', now(), 'docked',
        array[1, 2], array[true, true]);
-- Fin's lobby game, and Ana's own waiting one is in Ben's lobby.
insert into public.space_games (code, in_lobby, host, seat1, status, setup, rockets, seat_info, state, created_at, expires_at)
values ('XY346', true, pg_temp.uid(6), pg_temp.uid(6), 'waiting', '{"board":"comet","settings":{"mode":"classic"}}', 2, '[]', '{}',
        now() - interval '4 minutes', now() + interval '10 minutes');

-- ---- Power Clash ----
create function pg_temp.power(a integer, b integer, status text, at timestamptz, lobby boolean, expires timestamptz) returns uuid language sql as $$
  insert into public.power_games (host, seat1, seat2, status, in_lobby, loadouts, game, created_at, started_at, last_action_at, deadline, expires_at)
  values (pg_temp.uid(a), pg_temp.uid(a), case when b is null then null else pg_temp.uid(b) end, status, lobby,
    '[["force-field","body-swap","freeze-ray"],["board-wipe","body-swap","freeze-ray"]]', '{"match":{}}', at, at, at, at + interval '60 seconds', expires)
  returning id
$$;
-- Ana: one being played with Ben, and her own waiting game that has run out of time.
select pg_temp.power(2, 1, 'playing', now() - interval '25 minutes', false, now() + interval '10 minutes');
select pg_temp.power(1, null, 'waiting', now() - interval '15 minutes', true, now() - interval '5 minutes');
-- Lobby games: Fin's, and Eve's at the other school.
select pg_temp.power(6, null, 'waiting', now() - interval '5 minutes', true, now() + interval '10 minutes');
select pg_temp.power(5, null, 'waiting', now() - interval '6 minutes', true, now() + interval '10 minutes');

-- ---- 101, written the way the server does. Each seat row is its player's own. ----
create function pg_temp.card(players integer[], wanted integer, status text, lobby boolean) returns uuid language sql as $$
  select (public.card_game_write(null,
    jsonb_build_object('id', gen_random_uuid(), 'in_lobby', lobby, 'host', pg_temp.uid(players[1]),
      'seat1', pg_temp.uid(players[1]), 'seat2', case when cardinality(players) > 1 then pg_temp.uid(players[2]) end, 'wanted', wanted,
      'settings', '{"target":101}'::jsonb, 'status', status, 'version', 0, 'expires_at', now() + interval '10 minutes',
      'last_action_at', now(), 'game', '{"stack":["AS","2S"],"hands":[["KH"]]}'::jsonb),
    (select jsonb_agg(jsonb_build_object('player', pg_temp.uid(p), 'seat', i - 1,
       'info', jsonb_build_object('status', status, 'host', pg_temp.uid(players[1]), 'players', (select jsonb_agg(pg_temp.uid(q)) from unnest(players) q),
                                  'wanted', wanted, 'expiresAt', now() + interval '10 minutes'),
       'view', jsonb_build_object('mine', 'secret-of-' || p), 'events', '[]'::jsonb))
     from unnest(players) with ordinality t(p, i)))).id
$$;
create temp table cards (n integer, id uuid);
-- Ana: one being played with Ben, and her own waiting game. Ben and Fin play one Ana is not in. Fin's lobby game.
insert into cards values
  (1, pg_temp.card(array[2, 1], 2, 'playing', false)),
  (2, pg_temp.card(array[1], 3, 'waiting', true)),
  (3, pg_temp.card(array[2, 6], 2, 'playing', false)),
  (4, pg_temp.card(array[6], 2, 'waiting', true));
update public.card_game_seats s set updated_at = now() - c.n * interval '1 minute' from cards c where s.game = c.id;
update public.card_games g set created_at = now() - (array[10, 7, 12, 3])[c.n] * interval '1 minute' from cards c where g.id = c.id;

update public.profiles set hidden = true where id = pg_temp.uid(3);

-- ---- What the lobby asked for before, one request at a time, as the person asking ----
-- Each job is asked for as the server does (its rows, in its own order). Each table read is the lobby's own (src/data/*.ts): a list
-- in the order asked for. The names lookup is the lobby's too: the other players in my open games it shows (not the expired
-- waiting ones), not me.
create function pg_temp.separate() returns jsonb language sql as $$
  with
    fo as (select g.* from public.mp_games g where g.status in ('waiting', 'playing') order by g.created_at desc limit 10),
    so as (select g.* from public.space_games g where g.status in ('waiting', 'playing') order by g.created_at desc limit 10),
    co as (select s.* from public.card_game_seats s where s.status in ('waiting', 'playing') order by s.updated_at desc limit 10),
    po as (select g.* from public.power_games g where g.status in ('waiting', 'playing') order by g.created_at desc limit 10),
    shown as (
      select unnest(array[first_player, second_player])::text as id from fo where status = 'playing' or expires_at > now()
      union all select unnest(array[seat1, seat2, seat3, seat4])::text from so where status = 'playing' or expires_at > now()
      union all select jsonb_array_elements_text(info -> 'players') from co where status = 'playing' or (info ->> 'expiresAt')::timestamptz > now()
      union all select unnest(array[seat1, seat2])::text from po where status = 'playing' or expires_at > now())
  select jsonb_build_object(
    'friendLobby', (select coalesce(json_agg(t), '[]')::jsonb from public.lobby_games() t),
    'spaceLobby', (select coalesce(json_agg(t), '[]')::jsonb from public.space_lobby_games() t),
    'cardLobby', (select coalesce(json_agg(t), '[]')::jsonb from public.card_lobby_games() t),
    'powerLobby', (select coalesce(json_agg(t), '[]')::jsonb from public.power_lobby_games() t),
    'friendOpen', (select coalesce(json_agg(t), '[]')::jsonb from (select id, game, code, in_lobby, created_by, first_player, second_player, status,
                   moves, version, created_at, expires_at, started_at, turn_started_at, draw_offer, first_draw_offers, second_draw_offers,
                   first_offer_ply, second_offer_ply, winner, reason, counts_for_points, finished_at, first_wants_rematch, second_wants_rematch,
                   rematch_game from fo order by created_at desc) t),
    'spaceOpen', (select coalesce(json_agg(t), '[]')::jsonb from (select id, code, in_lobby, host, seat1, seat2, seat3, seat4, status, setup, rockets,
                  seat_info, version, created_at, expires_at, started_at, finished_at, ending, places, counts, rematch_game
                  from so order by created_at desc) t),
    'cardOpen', (select coalesce(json_agg(t), '[]')::jsonb from (select game, player, seat, version, status, info, updated_at
                 from co order by updated_at desc) t),
    'powerOpen', (select coalesce(json_agg(t), '[]')::jsonb from (select id, code, in_lobby, host, seat1, seat2, loadouts, status, version, created_at,
                  expires_at, started_at, finished_at, ending, leaver, won, counts, rematch_game from po order by created_at desc) t),
    'players', (select coalesce(json_agg(t), '[]')::jsonb from (select p.id, p.display_name, p.avatar from public.profiles p
                where p.id::text in (select id from shown where id <> auth.uid()::text) order by p.id) t))
$$;
create function pg_temp.lobby() returns jsonb language sql as $$ select public.lobby()::jsonb $$;
create function pg_temp.len(part text) returns integer language sql as $$ select jsonb_array_length(pg_temp.lobby() -> part) $$;
create function pg_temp.names(part text) returns text[] language sql as $$
  select coalesce(array_agg(g ->> 'creator_name' order by n), '{}') from jsonb_array_elements(pg_temp.lobby() -> part) with ordinality t(g, n)
$$;
create function pg_temp.name(n integer) returns text language sql as $$ select display_name from public.profiles where id = pg_temp.uid(n) $$;

-- ---- Ana: open games of every kind ----
select pg_temp.as(1);
select is(pg_temp.lobby(), pg_temp.separate(), 'Ana (open games of every kind): the same answer as the separate requests');
select is(pg_temp.len('friendOpen'), 10, 'her 10 newest chess and checkers games, as the lobby asks');
select is((select array_agg(g ->> 'created_at' order by n) from jsonb_array_elements(pg_temp.lobby() -> 'friendOpen') with ordinality t(g, n)),
  (select array_agg(to_jsonb(created_at) #>> '{}') from (select created_at from public.mp_games
   where status in ('waiting', 'playing') order by created_at desc limit 10) x),
  'newest first');
select is((select count(*)::int from jsonb_array_elements(pg_temp.lobby() -> 'friendOpen') g where g ->> 'status' = 'finished'), 0, 'no finished games');
select is(pg_temp.len('spaceOpen'), 3, 'her space games: being played, her waiting one, and Ben''s expired one (the lobby drops that, as now)');
select is(pg_temp.len('cardOpen'), 2, 'her 101 games: being played and waiting');
select is((select count(*)::int from jsonb_array_elements(pg_temp.lobby() -> 'cardOpen') s where s ->> 'player' <> pg_temp.uid(1)::text), 0,
  'only her own seat rows of 101, never Ben''s');
select is(pg_temp.len('powerOpen'), 2, 'her Power Clash games: being played, and her waiting one that ran out (the lobby drops that, as now)');
select is(pg_temp.names('friendLobby'), array[pg_temp.name(6)], 'chess and checkers to join: Fin''s, not hidden Cat''s, Ben''s code-only one or her own');
select is(pg_temp.names('spaceLobby'), array[pg_temp.name(6)], 'space games to join: Fin''s, not her own or the expired one');
select is(pg_temp.names('cardLobby'), array[pg_temp.name(6)], '101 games to join: Fin''s, not her own');
select is(pg_temp.names('powerLobby'), array[pg_temp.name(6)], 'Power Clash to join: Fin''s, not Eve''s at the other school or her own');
select is(pg_temp.lobby() -> 'friendLobby', (select jsonb_agg(to_jsonb(t)) from public.lobby_games() t), 'the chess and checkers list is lobby_games''s');
select is(pg_temp.lobby() -> 'spaceLobby' -> 0 -> 'board', '"comet"', 'with the board and mode, as space_lobby_games gives them');
select is((select array_agg(p ->> 'display_name' order by p ->> 'display_name') from jsonb_array_elements(pg_temp.lobby() -> 'players') p),
  (select array_agg(display_name order by display_name) from public.profiles where id = pg_temp.uid(2)),
  'names and avatars: only Ben, not hidden Cat and not herself');

-- ---- Ben: sees Ana's waiting games to join ----
select pg_temp.as(2);
select is(pg_temp.lobby(), pg_temp.separate(), 'Ben: the same answer as the separate requests');
select is(pg_temp.names('friendLobby'), array[pg_temp.name(6), pg_temp.name(1)], 'Fin''s and Ana''s chess and checkers games to join, newest first');
select is(pg_temp.names('cardLobby'), array[pg_temp.name(6), pg_temp.name(1)], 'Fin''s and Ana''s 101 games to join, newest first');
select is(pg_temp.names('powerLobby'), array[pg_temp.name(6)], 'not Ana''s Power Clash game that ran out');
select is(pg_temp.names('spaceLobby'), array[pg_temp.name(6)], 'not Ana''s space game, which he has already joined');
select is((select count(*)::int from jsonb_array_elements(pg_temp.lobby() -> 'cardOpen') s where s ->> 'player' <> pg_temp.uid(2)::text), 0,
  'only his own seat rows of 101, not Ana''s or Fin''s');
select is((select count(*)::int from jsonb_array_elements(pg_temp.lobby() -> 'players') p where p ->> 'id' = pg_temp.uid(3)::text), 0,
  'hidden Cat is left out of his names too');

-- ---- Cat: hidden ----
select pg_temp.as(3);
select is(pg_temp.lobby(), pg_temp.separate(), 'Cat (hidden): the same answer as the separate requests');
select is(pg_temp.len('friendOpen'), 2, 'a hidden pupil still sees her own games');

-- ---- Dan: brand new ----
select pg_temp.as(4);
select is(pg_temp.lobby(), pg_temp.separate(), 'Dan (no games): the same answer as the separate requests');
select is(pg_temp.len('friendOpen') + pg_temp.len('spaceOpen') + pg_temp.len('cardOpen') + pg_temp.len('powerOpen') + pg_temp.len('players'), 0,
  'none of his own, and no names');
select is(pg_temp.len('friendLobby') + pg_temp.len('spaceLobby') + pg_temp.len('cardLobby') + pg_temp.len('powerLobby'), 7,
  'but he sees the games he can join: Ana''s and Fin''s chess and checkers, space and 101, and Fin''s Power Clash');

-- ---- Eve: another school ----
select pg_temp.as(5);
select is(pg_temp.lobby(), pg_temp.separate(), 'Eve (another school): the same answer as the separate requests');
select is(pg_temp.len('friendLobby') + pg_temp.len('spaceLobby') + pg_temp.len('cardLobby') + pg_temp.len('powerLobby'), 0,
  'she sees none of the other school''s games to join');
select is(pg_temp.len('powerOpen'), 1, 'just her own waiting game');

-- ---- Ana's teacher ----
select pg_temp.as(11);
select is(pg_temp.lobby(), pg_temp.separate(), 'Ana''s teacher: the same answer as the separate requests');
select is(pg_temp.len('powerOpen'), 2, 'he sees his pupil''s Power Clash games, as he does now');

-- ---- Playing friends switched off ----
select pg_temp.reset();
update public.app_settings set multiplayer_enabled = false;
select pg_temp.as(1);
select is(pg_temp.lobby(), pg_temp.separate(), 'with playing friends switched off, Ana gets the same answer');
select is(pg_temp.len('friendLobby') + pg_temp.len('spaceLobby') + pg_temp.len('cardLobby') + pg_temp.len('powerLobby'), 0, 'with no games to join');
select pg_temp.as(4);
select is(pg_temp.lobby(), pg_temp.separate(), 'and so does Dan');

-- ---- Who can call it ----
select pg_temp.reset();
select ok(not has_function_privilege('anon', 'public.lobby()', 'execute'), 'signed-out visitors cannot call it');
select ok(not (select prosecdef from pg_proc where oid = 'public.lobby()'::regprocedure), 'it runs as the person asking');

select * from finish();
rollback;
