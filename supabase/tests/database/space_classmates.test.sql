-- Stage 9.4: Wormholes & Black Holes with classmates. Who can read and write space games,
-- the log, taking-part points (4 a game, first 6 a day, never ratings), the classmates
-- achievement, the tidy-up, reactions and their limits, the lobby, and the teacher view.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(51);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'dan@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000e';

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.act_as_server() returns void language sql as $$
  select set_config('role', 'service_role', true), set_config('request.jwt.claims', '{"role":"service_role"}', true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000000' || who)::uuid $$;
create function pg_temp.stats(turns integer, docked boolean default false) returns jsonb language sql as $$
  select jsonb_build_object('wormholes', 2, 'blocks', 0, 'stars', '["red-dwarf"]'::jsonb, 'docked', docked, 'turns', turns)
$$;
-- A playing game with these students (null = a bot) in turn order.
create function pg_temp.game(seats text[]) returns uuid language sql as $$
  insert into public.space_games (host, seat1, seat2, seat3, seat4, status, setup, rockets, seat_info, state, started_at,
    last_action_at, turn_deadline)
  select pg_temp.id(seats[1]), pg_temp.id(seats[1]), pg_temp.id(seats[2]),
         case when seats[3] is null then null else pg_temp.id(seats[3]) end,
         case when seats[4] is null then null else pg_temp.id(seats[4]) end,
         'playing', '{"board":{"id":"nebula"},"settings":{}}', cardinality(seats),
         (select jsonb_agg(jsonb_build_object('bot', s is null, 'autopilot', false, 'left', false, 'timeouts', 0,
            'stats', pg_temp.stats(8, i = 1)) order by i) from unnest(seats) with ordinality as t(s, i)),
         '{"turn":0}', now(), now(), now() + interval '30 seconds'
  returning id
$$;
-- Ends a game the way the server does: places, and which seats count.
create function pg_temp.finish(game uuid, places smallint[], counts boolean[], ending text default 'docked')
returns void language sql as $$
  update public.space_games set status = 'finished', places = finish.places, counts = finish.counts, ending = finish.ending,
    finished_at = now(), turn_deadline = null, version = version + 1, events = '[{"kind":"game-over"}]'
  where id = game
$$;
create function pg_temp.points(who text) returns integer language sql as $$
  select coalesce(sum(points), 0)::integer from public.scored_games where player = pg_temp.id(who) and game = 'space'
$$;

-- ---- Nobody but the server writes; students read only their own games ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ insert into public.space_games (host, seat1, setup) values (pg_temp.id('a'), pg_temp.id('a'), '{}') $$,
  '42501', null, 'a student cannot make a space game directly');
select pg_temp.reset();
create temporary table g (name text primary key, id uuid) on commit drop;
grant all on g to authenticated, service_role;
insert into g values ('ab', pg_temp.game(array['a', 'b']));
insert into g values ('cd', pg_temp.game(array['c', null, 'd']));

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ update public.space_games set version = 99 $$, '42501', null, 'a student cannot change a space game');
select is((select count(*)::int from public.space_games), 1, 'a student sees only the space games they are in');
select pg_temp.reset();

-- ---- Each move writes a log line; players (only) can read it ----
update public.space_games set version = 1, events = '[{"kind":"dice","seat":0,"dice":[4]}]',
  actions = '[{"seat":0,"action":"roll","by":"player"}]' where id = (select id from g where name = 'ab');
update public.space_games set reactions = jsonb_set(reactions, '{last}', '{"seat":0,"emoji":"🚀","id":1}')
  where id = (select id from g where name = 'ab');
select is((select count(*)::int from public.space_game_log where game = (select id from g where name = 'ab')), 1,
  'a move writes one log line; a change that doesn''t move the version writes none');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is((select actions -> 0 ->> 'action' from public.space_game_log), 'roll', 'a player can read their game''s log');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz');
select is((select count(*)::int from public.space_game_log), 0, 'someone else cannot read it');
select throws_ok($$ insert into public.space_game_log (game, version, actions, events)
  values ((select id from public.space_games limit 1), 5, '[]', '[]') $$, '42501', null, 'nor write to it');
select pg_temp.reset();

-- ---- Scoring ----
select throws_ok($$ update public.space_games set seat2 = seat1 where id = (select id from g where name = 'ab') $$,
  '23514', null, 'a student can''t sit in two seats');

select pg_temp.finish((select id from g where name = 'ab'), '{2,1}', '{true,true}');
select is(pg_temp.points('a'), 4, '2nd place earns the same taking-part points...');
select is(pg_temp.points('b'), 4, '...as 1st place');
select is((select result from public.scored_games where player = pg_temp.id('b') and game = 'space'), 'won', '1st place is a win');
select is((select kind from public.scored_games where player = pg_temp.id('b') and game = 'space'), 'friend',
  'a classmates game is a friend game');
select is((select count(*)::int from public.ratings), 0, 'space games never touch ratings');
select ok(exists (select 1 from public.achievements where player = pg_temp.id('a') and achievement = 'space-classmates'),
  '"Finish a game with classmates" is earned');
select ok(exists (select 1 from public.achievements where player = pg_temp.id('a') and achievement = 'space-dock-10') is false
  and exists (select 1 from public.achievements where player = pg_temp.id('a') and achievement = 'space-first-launch'),
  'and the other space achievements count classmates games too');

-- Bots earn nothing (they aren't anyone); a seat that doesn't count gets no row at all.
select pg_temp.finish((select id from g where name = 'cd'), '{1,2,3}', '{false,false,true}');
select is(pg_temp.points('c'), 0, 'a seat that doesn''t count earns nothing');
select is(pg_temp.points('d'), 4, 'the one that does earns 4');
select is((select count(*)::int from public.scored_games where space_game = (select id from g where name = 'cd')), 1,
  'and only seats that count get a score line');

-- Finishing again (e.g. a rematch link added afterwards) doesn't score twice.
update public.space_games set status = 'finished', version = version + 1 where id = (select id from g where name = 'ab');
select is(pg_temp.points('a'), 4, 'a game is only scored once');

-- First 6 a day earn points.
do $$
begin
  for i in 1..6 loop
    perform pg_temp.finish(pg_temp.game(array['a', 'c']), '{1,2}', '{true,true}');
  end loop;
end;
$$;
select is(pg_temp.points('a'), 24, 'the first 6 classmates games a day earn points (6 × 4)...');
select is((select count(*)::int from public.scored_games where player = pg_temp.id('a') and game = 'space' and points = 0), 1,
  '...the 7th is in the history with 0');
select is((select count(*)::int from public.scored_games where player = pg_temp.id('a') and kind = 'bot'), 0,
  'and none of it touches the bot points cap');

create temporary table before_rebuild on commit drop as
  select player, space_game, points from public.scored_games where game = 'space';
select is((public.rebuild_progress() ->> 'scored_games')::int, (select count(*)::int from before_rebuild),
  'rebuild_progress() scores space games again');
-- (All these games finished in one transaction, at the same moment, so which 7th game gets 0 can differ.)
select bag_eq('select player, points from public.scored_games where game = ''space''',
  'select player, points from before_rebuild', 'with the same points for everyone');
select is(pg_temp.points('a'), 24, 'with the same points');

-- ---- The tidy-up ----
insert into g values ('idle', pg_temp.game(array['b', 'd']));
update public.space_games set last_action_at = now() - interval '11 minutes' where id = (select id from g where name = 'idle');
insert into public.space_games (host, seat1, status, setup, expires_at, code)
values (pg_temp.id('d'), pg_temp.id('d'), 'waiting', '{}', now() - interval '1 second', 'KMTPX');
select pg_temp.act_as_server();
select public.space_tidy();
select pg_temp.reset();
select is((select status || ' ' || ending from public.space_games where id = (select id from g where name = 'idle')),
  'finished abandoned', 'a game nobody has touched for 10 minutes ends as abandoned');
select is((select count(*)::int from public.scored_games where space_game = (select id from g where name = 'idle')), 0,
  'and earns nobody anything');
select is((select status from public.space_games where code = 'KMTPX'), 'expired', 'a waiting game past its time expires');

-- ---- Reactions ----
insert into g values ('react', pg_temp.game(array['a', 'b', 'c']));
select pg_temp.act_as_server();
select is(public.space_add_reaction((select id from g where name = 'react'), 1, '🎉'), 'ok', 'the server can add a reaction');
select is(public.space_add_reaction((select id from g where name = 'react'), 1, '👍'), 'too-soon',
  'one every 5 seconds');
select is(public.space_add_reaction((select id from g where name = 'react'), 2, '👍'), 'ok', '(each player has their own limit)');
select is(public.space_add_reaction((select id from g where name = 'react'), 0, 'hi'), 'not-allowed', 'only the 6 emoji');
select is(public.space_add_reaction((select id from g where name = 'react'), 0, '💩'), 'not-allowed', 'really only the 6');
select is(public.space_add_reaction((select id from g where name = 'ab'), 0, '🚀'), 'not-playing',
  'no reactions once the game is over');
select pg_temp.reset();
select is((select reactions -> 'last' ->> 'emoji' from public.space_games where id = (select id from g where name = 'react')),
  '👍', 'the last reaction is on the game');
select is((select version from public.space_games where id = (select id from g where name = 'react')), 0,
  'and adding it doesn''t move the version, so it never gets in the way of a move');
update public.space_games set reactions = '{"last":null,"sent":[0,20,0,0],"at":[0,0,0,0]}' where id = (select id from g where name = 'react');
select pg_temp.act_as_server();
select is(public.space_add_reaction((select id from g where name = 'react'), 1, '🚀'), 'too-many', 'at most 20 a game');
select pg_temp.reset();

select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select lives_ok('select public.teacher_set_space_reactions(true)', 'a teacher can switch reactions on');
select pg_temp.reset();
select ok((select space_reactions_enabled from public.app_settings), 'and they''re on');

-- ---- The lobby ----
insert into public.space_games (id, host, seat1, seat2, status, setup, code, in_lobby)
values ('20000000-0000-0000-0000-000000000001', pg_temp.id('a'), pg_temp.id('a'), pg_temp.id('b'), 'waiting',
  '{"board":{"id":"deep-space"},"settings":{"mode":"classic"}}', 'QQQQQ', true);
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz');
select results_eq($$ select creator_name is not null, players, board ->> 'id', mode from public.space_lobby_games() $$,
  $$ values (true, 2, 'deep-space', 'classic') $$, 'the lobby lists open space games with how many have joined');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is((select count(*)::int from public.space_lobby_games()), 0, 'but not games you''re already in');
select pg_temp.reset();
update public.profiles set hidden = true where id = pg_temp.id('a');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz');
select is((select count(*)::int from public.space_lobby_games()), 0, 'nor games started by a hidden student');
select pg_temp.reset();
update public.profiles set hidden = false where id = pg_temp.id('a');

-- ---- What the server looks up ----
update public.profiles set hidden = true where id = pg_temp.id('d');
select pg_temp.act_as_server();
select results_eq($$ select school, hidden, gone from public.space_player_status(pg_temp.id('a'),
    array[pg_temp.id('b'), pg_temp.id('d'), '00000000-0000-0000-0000-000000000099'::uuid]) $$,
  $$ values (true, false, array['00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000099']::uuid[]) $$,
  'the server learns which of the other players are hidden or gone');
select pg_temp.reset();
update public.profiles set hidden = false where id = pg_temp.id('d');

-- ---- My stats ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select results_eq('select played, firsts from public.my_space_game_stats()', $$ values (7, 6) $$,
  'a student sees how many classmates games they finished and how many they came 1st in');
select pg_temp.reset();

-- ---- Teachers ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select is((select (d -> 'games' -> 2 -> 'friend' ->> 'played')::int from public.teacher_student_detail(pg_temp.id('a')) d), 7,
  'the teacher sees space games with classmates in the student''s details');
select is((select r ->> 'against' from public.teacher_student_detail(pg_temp.id('a')) d, jsonb_array_elements(d -> 'recent') r
  where r ->> 'game' = 'space' limit 1), 'classmates', 'and in their recent games');
select is((select friend_games from public.teacher_students() where id = pg_temp.id('a')), 7,
  'and counted with their friend games');
select pg_temp.reset();

-- Deleting a student empties their seat; the game stays for the others.
delete from auth.users where id = pg_temp.id('b');
select is((select seat1::text || ' ' || coalesce(seat2::text, 'empty') from public.space_games
  where id = (select id from g where name = 'ab')), pg_temp.id('a')::text || ' empty', 'a deleted student''s seat empties');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select lives_ok($$ select public.teacher_new_season('NEW SEASON') $$, 'a new season...');
select pg_temp.reset();
select is((select count(*)::int from public.space_games where status <> 'playing' and status <> 'waiting'), 0,
  '...clears finished space games');
select is((select count(*)::int from public.space_games where status = 'playing'), 1, 'but leaves games still being played');

select * from finish();
rollback;
