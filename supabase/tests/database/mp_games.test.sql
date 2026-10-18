-- Checks games between students: only the two players can read a game, nobody can write
-- to the table from the website, the lobby shows only what it should, and old games tidy up.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'dan@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000e';

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.act_as_server() returns void language sql as $$
  select set_config('role', 'service_role', true), set_config('request.jwt.claims', '{"role":"service_role"}', true);
$$;
create function pg_temp.act_as_anon() returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

select has_table('public', 'mp_games', 'the games-between-students table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.mp_games'::regclass), 'row level security is on');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'mp_games'),
  'live updates are switched on for the table');
select ok(exists (select 1 from cron.job where jobname = 'tidy-friend-games'), 'the tidy-up job is scheduled');

-- ---- The server (the multiplayer function) makes the games ----
select pg_temp.act_as_server();
-- Ana (first) v Ben (second), playing.
select lives_ok($$ insert into public.mp_games (id, game, code, created_by, first_player, second_player, status, moves, started_at, turn_started_at)
  values ('10000000-0000-0000-0000-000000000001', 'chess', 'KM4TP', '00000000-0000-0000-0000-00000000000a',
    '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'playing', array['e2e4'], now(), now()) $$,
  'the server can save a game');
-- Ana waiting in the lobby; Cat waiting with a code only; Dan waiting in the lobby but long expired.
insert into public.mp_games (id, game, code, in_lobby, created_by, second_player) values
  ('10000000-0000-0000-0000-000000000002', 'checkers', 'CDFGH', true, '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a');
insert into public.mp_games (id, game, code, in_lobby, created_by, first_player) values
  ('10000000-0000-0000-0000-000000000003', 'chess', 'JKMNP', false, '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000c');
insert into public.mp_games (id, game, code, in_lobby, created_by, first_player, expires_at) values
  ('10000000-0000-0000-0000-000000000004', 'chess', 'QRTVW', true, '00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000d', now() - interval '1 minute');
-- A finished game Ben won against Cat.
insert into public.mp_games (game, created_by, first_player, second_player, status, winner, reason, counts_for_points, finished_at) values
  ('checkers', '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000b',
   'finished', 'second', 'no-pieces', true, now());

select throws_ok($$ insert into public.mp_games (game, code, created_by, first_player) values
  ('chess', 'XY346', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a') $$,
  '23505', null, 'a student can only have one waiting game');
select throws_ok($$ insert into public.mp_games (game, code, created_by, first_player) values
  ('chess', 'CDFGH', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b') $$,
  '23505', null, 'two waiting games can''t share a code');
select throws_ok($$ insert into public.mp_games (game, code, created_by, first_player) values
  ('chess', 'OOOOO', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b') $$,
  '23514', null, 'codes can''t use lookalike characters');
select throws_ok($$ insert into public.mp_games (game, created_by, first_player, second_player, status) values
  ('chess', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'playing') $$,
  '23514', null, 'nobody can play themselves');
select throws_ok($$ insert into public.mp_games (game, created_by, first_player, status) values
  ('chess', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'finished') $$,
  '23514', null, 'a finished game must say how it ended');

-- ---- Outsiders see nothing ----
select pg_temp.act_as_anon();
select throws_ok('select * from public.mp_games', '42501', null, 'signed-out visitors cannot read games');
select throws_ok('select * from public.lobby_games()', '42501', null, 'signed-out visitors cannot see the lobby');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000ee', 'someone@gmail.com');
select is((select count(*)::int from public.mp_games), 0, 'a non-school token sees no games');
select is((select count(*)::int from public.lobby_games()), 0, 'a non-school token sees an empty lobby');

-- ---- Players see their own games, nobody else's ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is((select count(*)::int from public.mp_games), 2, 'Ana sees her game in progress and her waiting game');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is((select array_agg(game order by game) from public.mp_games), array['checkers', 'chess'],
  'Ben, the other player, sees the game with Ana and his finished game');
select is((select count(*)::int from public.mp_games where code = 'CDFGH'), 0, 'Ben can''t see Ana''s waiting game');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000d', 'dan@douglaspark.school.nz');
select is((select count(*)::int from public.mp_games where id = '10000000-0000-0000-0000-000000000001'), 0,
  'a third student can''t see a game they''re not in');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select is((select count(*)::int from public.mp_games), 0, 'teachers can''t read students'' games yet (Stage 7)');

-- ---- The website can't write to the table ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ insert into public.mp_games (game, created_by, first_player) values
  ('chess', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a') $$,
  '42501', null, 'students can''t create games directly');
select throws_ok($$ update public.mp_games set winner = 'first', status = 'finished' $$,
  '42501', null, 'students can''t change games directly');
select throws_ok($$ update public.mp_games set moves = array['e2e4', 'e7e5'] where id = '10000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'students can''t add moves directly');
select throws_ok($$ delete from public.mp_games $$, '42501', null, 'students can''t delete games');
select throws_ok($$ select public.mp_tidy() $$, '42501', null, 'students can''t run the tidy-up');
select throws_ok($$ select * from public.mp_player_status('00000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'students can''t look up other players');

-- ---- The lobby ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is((select array_agg(id::text) from public.lobby_games()), array['10000000-0000-0000-0000-000000000002'],
  'the lobby shows waiting lobby games only: not code-only games, not expired ones');
select is((select creator_name from public.lobby_games()), (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'the lobby shows the creator''s player name');
select is((select open_side from public.lobby_games()), 'first', 'the lobby says which side the joiner would play');
select is(
  (select proargnames from pg_proc where proname = 'lobby_games'),
  array['id', 'game', 'creator_name', 'creator_avatar', 'open_side', 'created_at'],
  'the lobby gives only the game, name, avatar and side: no codes, emails or player IDs');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is((select count(*)::int from public.lobby_games()), 0, 'you don''t see your own game in the lobby');

select pg_temp.reset();
update public.profiles set hidden = true where id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is((select count(*)::int from public.lobby_games()), 0, 'hidden students'' games aren''t in the lobby');
select pg_temp.reset();
update public.profiles set hidden = false where id = '00000000-0000-0000-0000-00000000000a';

update public.app_settings set multiplayer_enabled = false;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is((select count(*)::int from public.lobby_games()), 0, 'the lobby is empty while the teacher has multiplayer off');
select pg_temp.reset();
update public.app_settings set multiplayer_enabled = true;

-- ---- Stats and the live channel ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is((select (game, played, won, lost, drawn)::text from public.my_friend_game_stats()), '(checkers,1,1,0,0)',
  'Ben''s friend-game stats count his win');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz');
select is((select (game, played, won, lost, drawn)::text from public.my_friend_game_stats()), '(checkers,1,0,1,0)',
  'Cat''s friend-game stats count her loss');
select ok(public.server_time() is not null, 'students can read the server''s clock');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select ok(public.is_player_in('mp-game:10000000-0000-0000-0000-000000000001'), 'a player can use their game''s live channel');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d', 'dan@douglaspark.school.nz');
select ok(not public.is_player_in('mp-game:10000000-0000-0000-0000-000000000001'), 'a third student can''t use it');
select ok(not public.is_player_in('anything-else'), 'other channel names aren''t allowed');

-- ---- The server's checks and the tidy-up ----
select pg_temp.act_as_server();
select is((select (school, hidden, multiplayer_enabled)::text from public.mp_player_status('00000000-0000-0000-0000-00000000000a')),
  '(t,f,t)', 'the server can check a player is allowed to play');
select is((select school from public.mp_player_status('00000000-0000-0000-0000-0000000000ff')), false,
  'unknown players aren''t allowed');

update public.mp_games set turn_started_at = now() - interval '31 minutes' where id = '10000000-0000-0000-0000-000000000001';
select public.mp_tidy();
select is((select status from public.mp_games where id = '10000000-0000-0000-0000-000000000004'), 'expired',
  'the tidy-up expires waiting games nobody joined');
select is((select (status, winner, reason, counts_for_points)::text from public.mp_games where id = '10000000-0000-0000-0000-000000000001'),
  '(finished,first,abandoned,f)', 'the tidy-up ends a game nobody moved in for 30 minutes, as a loss for the player whose turn it was');

-- ---- Deleting a student keeps the other player's history ----
select pg_temp.reset();
delete from auth.users where id = '00000000-0000-0000-0000-00000000000c';
select is((select second_player::text from public.mp_games where game = 'checkers' and status = 'finished'),
  '00000000-0000-0000-0000-00000000000b', 'Ben''s finished game is still there after Cat is deleted');

select * from finish();
rollback;
