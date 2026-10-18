-- Stage 10.4: 101 with classmates. The whole game is locked away from students; each player
-- can read only their own seat row; only the server saves; points (8 a win, 4 for finishing,
-- first 6 a day, never ratings); the classmates achievement; the tidy-up; the lobby; the
-- "who's here" channel; and the teacher view.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(48);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'dan@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000e';

create function pg_temp.act_as(who text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000' || who,
           'email', case who when 'a' then 'ana' when 'b' then 'ben' when 'c' then 'cat' when 'd' then 'dan'
             else 'mr.teacher' end || '@douglaspark.school.nz', 'role', 'authenticated')::text, true);
$$;
create function pg_temp.act_as_server() returns void language sql as $$
  select set_config('role', 'service_role', true), set_config('request.jwt.claims', '{"role":"service_role"}', true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true),
         set_config('realtime.topic', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000000' || who)::uuid $$;

-- A seat row the way the server writes it: public info plus that player's own view.
create function pg_temp.seat(who text, n integer, players text[], status text, secret text, extra jsonb) returns jsonb
language sql as $$
  select jsonb_build_object('player', pg_temp.id(who), 'seat', n,
    'info', jsonb_build_object('status', status, 'players', (select jsonb_agg(pg_temp.id(p)) from unnest(players) p),
      'places', extra -> 'places', 'ending', extra -> 'ending'),
    'view', jsonb_build_object('mine', secret), 'events', jsonb_build_array(jsonb_build_object('kind', 'turn', 'seat', n)))
$$;
-- Writes a game through card_game_write, as the server does. Returns the game's id.
create function pg_temp.write(id uuid, expected integer, version integer, players text[], status text,
  extra jsonb default '{}') returns uuid language sql as $$
  select (public.card_game_write(expected,
    jsonb_build_object('id', id, 'code', case when status = 'waiting' then 'KMTPQ' end, 'in_lobby', true,
      'host', pg_temp.id(players[1]),
      'seat1', pg_temp.id(players[1]), 'seat2', case when players[2] is null then null else pg_temp.id(players[2]) end,
      'seat3', case when players[3] is null then null else pg_temp.id(players[3]) end,
      'seat4', case when players[4] is null then null else pg_temp.id(players[4]) end,
      'wanted', 3, 'settings', '{"target":101}'::jsonb, 'status', status, 'version', version,
      'expires_at', now() + interval '10 minutes', 'last_action_at', now(),
      'game', case when status = 'waiting' then null else '{"stack":["AS","2S"],"hands":[["KH"]]}'::jsonb end) || extra,
    (select jsonb_agg(pg_temp.seat(p, (i - 1)::integer, players, status, 'secret-of-' || p, extra))
     from unnest(players) with ordinality t(p, i)))).id
$$;
-- Finishes a game as the server does: places, wins, who was out, who earns points, stats.
create function pg_temp.finish(id uuid, expected integer, players text[], won boolean[], counts boolean[],
  stats jsonb default '[{"zeroHands":1,"triples":0,"knockWins":0,"savedByThree":0},{},{}]') returns uuid language sql as $$
  select pg_temp.write(id, expected, expected + 1, players, 'finished', jsonb_build_object('ending', 'finished',
    'finished_at', now(), 'places', (select jsonb_agg(case when w then 1 else 2 end) from unnest(won) w),
    'won', to_jsonb(won), 'out_of_game', to_jsonb(array_fill(false, array[cardinality(players)])), 'counts', to_jsonb(counts),
    'stats', stats))
$$;
create function pg_temp.points(who text) returns integer language sql as $$
  select coalesce(sum(points), 0)::integer from public.scored_games where player = pg_temp.id(who) and game = '101'
$$;

-- ---- Only the server writes ----
select pg_temp.act_as('a');
select throws_ok($$ select pg_temp.write('20000000-0000-0000-0000-000000000001', null, 0, array['a'], 'waiting') $$,
  '42501', null, 'a student cannot save a 101 game');
select throws_ok($$ insert into public.card_game_seats (game, player, seat, version, status, info)
  values ('20000000-0000-0000-0000-000000000001', pg_temp.id('a'), 0, 0, 'waiting', '{}') $$,
  '42501', null, 'a student cannot write a seat row');

select pg_temp.act_as_server();
select is(pg_temp.write('20000000-0000-0000-0000-000000000001', null, 0, array['a', 'b'], 'waiting'),
  '20000000-0000-0000-0000-000000000001'::uuid, 'the server makes a waiting game');
select is((select count(*)::int from public.card_game_seats where game = '20000000-0000-0000-0000-000000000001'), 2,
  'with a seat row for each player');
select is((select count(*)::int from public.card_game_write(5, jsonb_build_object('id', '20000000-0000-0000-0000-000000000001',
  'wanted', 3, 'settings', '{}'::jsonb, 'status', 'waiting', 'version', 6), '[]')), 0,
  'a save made from an old version changes nothing');
select is((select version from public.card_games where id = '20000000-0000-0000-0000-000000000001'), 0, '(still version 0)');
-- Ben leaves the waiting room and Cat joins: Ben's row goes, Cat takes seat 1.
select pg_temp.write('20000000-0000-0000-0000-000000000001', 0, 1, array['a', 'c'], 'waiting');
select set_eq($$ select player, seat::int from public.card_game_seats where game = '20000000-0000-0000-0000-000000000001' $$,
  $$ values (pg_temp.id('a'), 0), (pg_temp.id('c'), 1) $$, 'leaving removes your seat row, and the others are renumbered');
-- It starts, with three players.
select pg_temp.write('20000000-0000-0000-0000-000000000001', 1, 2, array['a', 'c', 'b'], 'playing');
select pg_temp.write('20000000-0000-0000-0000-000000000001', 2, 3, array['a', 'c', 'b'], 'playing');
select is((select jsonb_array_length(log) from public.card_game_seats
  where game = '20000000-0000-0000-0000-000000000001' and player = pg_temp.id('a')), 4,
  'each seat row keeps a log of what that player saw');
select pg_temp.reset();

-- ---- Students can't read the whole game; each reads only their own seat ----
select pg_temp.act_as('a');
select throws_ok('select * from public.card_games', '42501', null, 'a student cannot read the whole game at all');
select is((select count(*)::int from public.card_game_seats), 1, 'a student can read only their own seat row...');
select is((select view ->> 'mine' from public.card_game_seats), 'secret-of-a', '...with only their own view in it');
select throws_ok($$ update public.card_game_seats set view = '{}' $$, '42501', null, 'and cannot change it');
select pg_temp.act_as('d');
select is((select count(*)::int from public.card_game_seats), 0, 'someone not in the game sees nothing');
select pg_temp.reset();
select ok(not has_table_privilege('authenticated', 'public.card_games', 'select'), 'the whole-game table has no student rights');
select is_empty($$ select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'card_games' $$,
  'and is never sent live');

-- ---- The "who's here" channel: presence only, players only ----
select pg_temp.act_as('c');
select set_config('realtime.topic', 'card-game:20000000-0000-0000-0000-000000000001', true);
select lives_ok($$ insert into realtime.messages (topic, extension, payload, private)
  values ('card-game:20000000-0000-0000-0000-000000000001', 'presence', '{"here":true}', true) $$,
  'a 101 player can say they''re here');
select throws_ok($$ insert into realtime.messages (topic, extension, payload, event, private)
  values ('card-game:20000000-0000-0000-0000-000000000001', 'broadcast', '{"text":"hi"}', 'chat', true) $$,
  '42501', null, 'a 101 player cannot send messages on the channel (no hidden chat)');
select pg_temp.act_as('d');
select set_config('realtime.topic', 'card-game:20000000-0000-0000-0000-000000000001', true);
select throws_ok($$ insert into realtime.messages (topic, extension, payload, private)
  values ('card-game:20000000-0000-0000-0000-000000000001', 'presence', '{"here":true}', true) $$,
  '42501', null, 'someone else cannot join a 101 game''s channel');
select pg_temp.reset();

-- ---- Points ----
select pg_temp.act_as_server();
select pg_temp.finish('20000000-0000-0000-0000-000000000001', 3, array['a', 'c', 'b'], array[true, false, false],
  array[true, true, false]);
select pg_temp.reset();
select is(pg_temp.points('a'), 8, 'a win against classmates earns 8');
select is(pg_temp.points('c'), 4, 'finishing earns 4');
select is((select count(*)::int from public.scored_games where player = pg_temp.id('b')), 0,
  'a player the game doesn''t count for (out, or a very short game) earns nothing');
select is((select card101 from public.scored_games where player = pg_temp.id('a')),
  '{"zeroHands":1,"triples":0,"knockWins":0,"savedByThree":0}'::jsonb, 'the stats are kept for achievements');
select ok(exists (select 1 from public.achievements where player = pg_temp.id('a') and achievement = '101-classmates-win'),
  'winning earns Win against classmates');
select ok(exists (select 1 from public.achievements where player = pg_temp.id('a') and achievement = '101-perfect-zero'),
  'and the stats earn their achievements');
select is((select count(*)::int from public.ratings where game = '101'), 0, '101 never makes a rating');
select is((select status from public.card_game_seats where game = '20000000-0000-0000-0000-000000000001'
  and player = pg_temp.id('a')), 'finished', 'the seat rows say it''s finished');

-- Saving the finished game again (e.g. a rematch link) doesn't score it twice.
select pg_temp.act_as_server();
select pg_temp.write('20000000-0000-0000-0000-000000000001', 4, 5, array['a', 'c', 'b'], 'finished',
  '{"ending":"finished","finished_at":"2026-10-16T00:00:00Z","counts":[true,true,false],"won":[true,false,false],"places":[1,2,2]}');
select pg_temp.reset();
select is(pg_temp.points('a'), 8, 'saving a finished game again doesn''t score it twice');

-- Only the first 6 games a day earn points.
select pg_temp.act_as_server();
select pg_temp.finish(pg_temp.write(('20000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid, null, 0,
  array['d', 'b'], 'playing'), 0, array['d', 'b'], array[false, true], array[true, true])
from generate_series(1, 7) n;
select pg_temp.reset();
select is(pg_temp.points('d'), 24, '6 games a day earn points (6 x 4)...');
select is((select count(*)::int from public.scored_games where player = pg_temp.id('d')), 7, '...the 7th is kept with 0');

-- ---- Reading ----
select pg_temp.act_as('d');
select is((select played from public.my_card_game_stats()), 7, 'my stats count the games I finished...');
select is((select won from public.my_card_game_stats()), 0, '...and the ones I won');
select pg_temp.act_as('b');
select is((select won from public.my_card_game_stats()), 7, '(Ben won all 7)');

select pg_temp.act_as_server();
select pg_temp.write('20000000-0000-0000-0000-000000000003', null, 0, array['c'], 'waiting');
select pg_temp.reset();
select pg_temp.act_as('a');
select is((select count(*)::int from public.card_lobby_games()), 1, 'the lobby lists open games');
select is((select to_jsonb(l) - 'created_at' - 'id' - 'creator_avatar' from public.card_lobby_games() l),
  '{"creator_name": null, "players": 1, "wanted": 3, "target": 101}'::jsonb - 'creator_name'
    || jsonb_build_object('creator_name', (select display_name from public.profiles where id = pg_temp.id('c'))),
  'with no codes, player IDs or cards');
select pg_temp.act_as('c');
select is((select count(*)::int from public.card_lobby_games()), 0, 'but not your own');
select throws_ok($$ select public.card_tidy() $$, '42501', null, 'a student cannot run the tidy-up');
select throws_ok($$ select * from public.card_player_status(pg_temp.id('a')) $$, '42501', null,
  'a student cannot look up a player''s status');
select throws_ok($$ select public.waiting_code_taken('KMTPQ') $$, '42501', null, 'a student cannot check codes');
select pg_temp.reset();

-- ---- The tidy-up ----
update public.card_games set expires_at = now() - interval '1 second' where id = '20000000-0000-0000-0000-000000000003';
select pg_temp.act_as_server();
select pg_temp.write('20000000-0000-0000-0000-000000000004', null, 0, array['a', 'b'], 'playing',
  jsonb_build_object('last_action_at', now() - interval '11 minutes', 'code', null));
select public.card_tidy();
select pg_temp.reset();
select is((select status from public.card_games where id = '20000000-0000-0000-0000-000000000003'), 'expired',
  'a waiting game nobody started expires');
select is((select ending from public.card_games where id = '20000000-0000-0000-0000-000000000004'), 'abandoned',
  'a game with nothing happening for 10 minutes ends...');
select is((select count(*)::int from public.scored_games s where s.card_game = '20000000-0000-0000-0000-000000000004'), 0,
  '...with no points for anyone');
select is((select info ->> 'ending' from public.card_game_seats where game = '20000000-0000-0000-0000-000000000004'
  and player = pg_temp.id('a')), 'abandoned', 'and the seat rows say so');

-- ---- Teachers ----
select pg_temp.act_as('e');
select is((select g -> 'friend' from jsonb_array_elements(public.teacher_student_detail(pg_temp.id('a')) -> 'games') g
  where g ->> 'game' = '101'), '{"played": 2, "won": 1, "lost": 0, "drawn": 0, "left": 1}'::jsonb,
  'the teacher sees a student''s 101 games with classmates (a win, and one everyone left)');
select is((select r ->> 'against' from jsonb_array_elements(public.teacher_student_detail(pg_temp.id('a')) -> 'recent') r
  where r ->> 'game' = '101' and r ->> 'kind' = 'friend' limit 1), 'classmates', 'and in their recent games');
select is((select friend_games from public.teacher_students() where id = pg_temp.id('a')), 2, 'and counts them as friend games');

-- ---- Starting again ----
select pg_temp.reset();
-- (Per player: Dan's 7 games all finished in the same instant, so the 0 could fall on a different one.)
create temp table before_rebuild as select player, sum(points) as points, count(*) as games from public.scored_games
  where card_game is not null group by player;
select public.rebuild_progress();
select set_eq($$ select player, sum(points), count(*) from public.scored_games where card_game is not null group by player $$,
  $$ select * from before_rebuild $$, 'working everything out again gives the same 101 points');
select pg_temp.act_as('e');
select public.teacher_new_season('NEW SEASON');
select pg_temp.reset();
select is((select count(*)::int from public.card_games where status <> 'playing'), 0, 'a new season clears finished 101 games...');
select is((select count(*)::int from public.card_game_seats s join public.card_games g on g.id = s.game
  where g.status <> 'playing'), 0, '...and their seat rows');

select * from finish();
rollback;
