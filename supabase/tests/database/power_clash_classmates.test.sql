-- Stage P.5: Power Clash with a classmate. Who can read and write Power Clash games, taking-part
-- points (4 a game, first 6 a day, never ratings, nothing for a game left part-way), the badges,
-- rebuild_progress(), the tidy-up, the lobby and codes, the "who's here" channel, and the
-- teacher views and new season.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
-- Written in Stage P.5 and run against a scratch copy of the local database (17 Oct 2026).
begin;
create extension if not exists pgtap with schema extensions;
select plan(61);

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
create function pg_temp.stats(used integer default 1, swap_wins integer default 0, no_power boolean default false)
returns jsonb language sql as $$
  select jsonb_build_object('powersUsed', used, 'bodySwapWins', swap_wins, 'noPowerWin', no_power,
    'roundsWon', 3, 'roundsLost', 1, 'roundsDrawn', 0)
$$;
-- A playing game between two students (seat 1 plays X).
create function pg_temp.game(a text, b text) returns uuid language sql as $$
  insert into public.power_games (host, seat1, seat2, status, loadouts, game, started_at, last_action_at, deadline)
  values (pg_temp.id(a), pg_temp.id(a), pg_temp.id(b), 'playing',
    '[["double-trouble","body-swap","freeze-ray"],["board-wipe","body-swap","freeze-ray"]]', '{"match":{}}', now(), now(),
    now() + interval '60 seconds')
  returning id
$$;
-- Ends a game the way the server does: who won, which seats count, and the stats.
create function pg_temp.finish(gid uuid, p_won boolean[], p_counts boolean[], p_ending text default 'finished',
  p_stats jsonb default null) returns void language sql as $$
  update public.power_games set status = 'finished', ending = p_ending, won = p_won, counts = p_counts,
    stats = coalesce(p_stats, jsonb_build_array(pg_temp.stats(), pg_temp.stats())), finished_at = now(),
    deadline = null, version = version + 1, events = '[]'
  where id = gid
$$;
create function pg_temp.points(who text) returns integer language sql as $$
  select coalesce(sum(points), 0)::integer from public.scored_games where player = pg_temp.id(who) and game = 'power-clash'
$$;
create function pg_temp.has(who text, which text) returns boolean language sql as $$
  select exists (select 1 from public.achievements where player = pg_temp.id(who) and achievements.achievement = which)
$$;

-- ---- Nobody but the server writes; students read only their own games ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ insert into public.power_games (host, seat1) values (pg_temp.id('a'), pg_temp.id('a')) $$,
  '42501', null, 'a student cannot make a Power Clash game directly');
select pg_temp.reset();
create temporary table g (name text primary key, id uuid) on commit drop;
grant all on g to authenticated, service_role;
insert into g values ('ab', pg_temp.game('a', 'b'));
insert into g values ('cd', pg_temp.game('c', 'd'));

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ update public.power_games set version = 99 $$, '42501', null, 'a student cannot change a game');
select throws_ok($$ delete from public.power_games $$, '42501', null, 'or delete one');
select is((select count(*)::int from public.power_games), 1, 'a student sees only the Power Clash games they are in');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz');
select is((select id from public.power_games), (select id from g where name = 'cd'), 'the other pair see their own game');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select is((select count(*)::int from public.power_games), 2, 'a teacher can read them all');
select pg_temp.reset();

select throws_ok($$ update public.power_games set seat2 = seat1 where id = (select id from g where name = 'ab') $$,
  '23514', null, 'a student can''t sit in both seats');
select throws_ok($$ update public.power_games set loadouts = '[null]' where id = (select id from g where name = 'ab') $$,
  '23514', null, 'a game has exactly two sets of powers');
select throws_ok($$ insert into public.power_games (host, seat1, status) values (pg_temp.id('a'), pg_temp.id('a'), 'playing') $$,
  '23514', null, 'a game that has started has a match');
select throws_ok($$ insert into public.power_games (host, seat1, code) values (pg_temp.id('a'), pg_temp.id('a'), 'AEIOU') $$,
  '23514', null, 'and a code uses only the usual letters');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'power_games'),
  'changes are sent live to the players (the row rule above decides who hears them)');

-- ---- The "who's here" channel: presence for the two players only ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select ok(public.is_player_in('power-game:' || (select id from g where name = 'ab')), 'a player can use their game''s channel');
select ok(not public.is_player_in('power-game:' || (select id from g where name = 'cd')), 'but not someone else''s');
select ok(not public.is_player_in('power-game:00000000-0000-0000-0000-000000000000'), 'or one that doesn''t exist');
select pg_temp.reset();

-- ---- Scoring ----
select pg_temp.finish((select id from g where name = 'ab'), '{true,false}', '{true,true}', 'finished',
  jsonb_build_array(pg_temp.stats(3, 1, false), pg_temp.stats(0, 0, false)));
select is(pg_temp.points('a'), 4, 'the winner earns the taking-part points...');
select is(pg_temp.points('b'), 4, '...and so does the loser');
select is((select result from public.scored_games where player = pg_temp.id('a') and game = 'power-clash'), 'won', 'a win is a win');
select is((select result from public.scored_games where player = pg_temp.id('b') and game = 'power-clash'), 'lost', 'a loss is a loss');
select is((select kind from public.scored_games where player = pg_temp.id('a') and game = 'power-clash'), 'friend',
  'a classmates game is a friend game');
select is((select count(*)::int from public.ratings), 0, 'Power Clash never touches ratings');
select ok(pg_temp.has('a', 'pc-first-game') and pg_temp.has('b', 'pc-first-game'),
  '"Play a game of Power Clash" counts a game with a classmate');
select ok(pg_temp.has('a', 'pc-win-classmate') and not pg_temp.has('b', 'pc-win-classmate'),
  '"Win against a classmate" goes to the winner only');
select ok(pg_temp.has('a', 'pc-all-three') and pg_temp.has('a', 'pc-body-swap-win') and not pg_temp.has('b', 'pc-all-three'),
  'the stats are kept for each seat, so the P.4 badges work for classmates games too');
select is((select power_clash ->> 'powersUsed' from public.scored_games where player = pg_temp.id('a') and game = 'power-clash'),
  '3', 'each player''s own stats are on their score line');

-- Games left part-way earn nothing, for either player.
select pg_temp.finish((select id from g where name = 'cd'), '{false,false}', '{false,false}', 'abandoned');
select is(pg_temp.points('c') + pg_temp.points('d'), 0, 'a game left part-way earns nobody anything');
select is((select count(*)::int from public.scored_games where power_game = (select id from g where name = 'cd')), 0,
  'and leaves no score line');

-- Finishing again (e.g. a rematch link added afterwards) doesn't score twice.
update public.power_games set status = 'finished', version = version + 1 where id = (select id from g where name = 'ab');
select is(pg_temp.points('a'), 4, 'a game is only scored once');

-- First 6 a day earn points.
do $$
begin
  for i in 1..6 loop
    perform pg_temp.finish(pg_temp.game('a', 'c'), '{true,false}', '{true,true}');
  end loop;
end;
$$;
select is(pg_temp.points('a'), 24, 'the first 6 classmates games a day earn points (6 × 4)...');
select is((select count(*)::int from public.scored_games where player = pg_temp.id('a') and game = 'power-clash' and points = 0), 1,
  '...the 7th is in the history with 0');
select is((select count(*)::int from public.scored_games where player = pg_temp.id('a') and kind = 'bot'), 0,
  'and none of it touches the bot points cap');
select is(pg_temp.points('c'), 24, '(the daily limit is per student: Cat''s 6 games earned 6 × 4 too)');

create temporary table before_rebuild on commit drop as
  select player, power_game, points from public.scored_games where game = 'power-clash';
select is((public.rebuild_progress() ->> 'scored_games')::int, (select count(*)::int from before_rebuild),
  'rebuild_progress() scores Power Clash games again');
-- (All these games finished in one transaction, at the same moment, so which 7th game gets 0 can differ.)
select bag_eq('select player, points from public.scored_games where game = ''power-clash''',
  'select player, points from before_rebuild', 'with the same points for everyone');
select is(pg_temp.points('a'), 24, 'a re-run gives Ana the same total');
select ok(pg_temp.has('a', 'pc-win-classmate'), 'and the same badges');

-- ---- The tidy-up ----
insert into g values ('idle', pg_temp.game('b', 'd'));
update public.power_games set last_action_at = now() - interval '11 minutes' where id = (select id from g where name = 'idle');
insert into g values ('fresh', pg_temp.game('b', 'c'));
insert into public.power_games (host, seat1, status, expires_at, code)
values (pg_temp.id('d'), pg_temp.id('d'), 'waiting', now() - interval '1 second', 'KMTPX');
select pg_temp.act_as_server();
select public.power_tidy();
select pg_temp.reset();
select is((select status || ' ' || ending from public.power_games where id = (select id from g where name = 'idle')),
  'finished abandoned', 'a game with no real move for 10 minutes ends as abandoned');
select is((select counts from public.power_games where id = (select id from g where name = 'idle')), '{f,f}'::boolean[],
  'and earns nobody anything');
select is((select count(*)::int from public.scored_games where power_game = (select id from g where name = 'idle')), 0,
  '(no score line)');
select is((select status from public.power_games where id = (select id from g where name = 'fresh')), 'playing',
  'a game still being played is left alone');
select is((select status from public.power_games where code = 'KMTPX'), 'expired', 'a waiting game past its time expires');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.power_tidy() $$, '42501', null, 'only the server runs the tidy-up');
select pg_temp.reset();

-- ---- The lobby and codes ----
insert into public.power_games (id, host, seat1, status, code, in_lobby)
values ('20000000-0000-0000-0000-000000000001', pg_temp.id('a'), pg_temp.id('a'), 'waiting', 'QQQQQ', true);
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz');
select results_eq($$ select creator_name is not null, id from public.power_lobby_games() $$,
  $$ values (true, '20000000-0000-0000-0000-000000000001'::uuid) $$, 'the lobby lists open games');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is((select count(*)::int from public.power_lobby_games()), 0, 'but not your own');
select pg_temp.reset();
update public.profiles set hidden = true where id = pg_temp.id('a');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz');
select is((select count(*)::int from public.power_lobby_games()), 0, 'nor games started by a hidden student');
select pg_temp.reset();
update public.profiles set hidden = false where id = pg_temp.id('a');
select pg_temp.act_as_server();
select ok(public.waiting_code_taken('QQQQQ'), 'a waiting Power Clash code is taken for every other game too');
select ok(not public.waiting_code_taken('CCCCC'), 'and a free one isn''t');
select pg_temp.reset();
select throws_ok($$ insert into public.power_games (host, seat1, status, code) values (pg_temp.id('b'), pg_temp.id('b'), 'waiting', 'QQQQQ') $$,
  '23505', null, 'two waiting games can''t have the same code');
select throws_ok($$ insert into public.power_games (host, seat1, status, code) values (pg_temp.id('a'), pg_temp.id('a'), 'waiting', 'RRRRR') $$,
  '23505', null, 'and a student has only one waiting game at a time');

-- ---- What the server looks up ----
update public.profiles set hidden = true where id = pg_temp.id('d');
select pg_temp.act_as_server();
select results_eq($$ select school, hidden, gone from public.power_player_status(pg_temp.id('a'),
    array[pg_temp.id('b'), pg_temp.id('d'), '00000000-0000-0000-0000-000000000099'::uuid]) $$,
  $$ values (true, false, array['00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000099']::uuid[]) $$,
  'the server learns which of the other players are hidden or gone');
select pg_temp.reset();
update public.profiles set hidden = false where id = pg_temp.id('d');

-- ---- My stats ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select results_eq('select played, won from public.my_power_game_stats()', $$ values (7, 7) $$,
  'a student sees how many matches they finished with a classmate and how many they won');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select results_eq('select played, won from public.my_power_game_stats()', $$ values (1, 0) $$,
  '(and a game that was left part-way isn''t counted)');
select pg_temp.reset();

-- ---- Teachers ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select is((select (d -> 'games' -> 4 ->> 'game') from public.teacher_student_detail(pg_temp.id('a')) d), 'power-clash',
  'the teacher sees a Power Clash line in the student''s details...');
select is((select (d -> 'games' -> 4 -> 'friend' ->> 'played')::int from public.teacher_student_detail(pg_temp.id('a')) d), 7,
  '...with the matches played with classmates');
select is((select r ->> 'kind' from public.teacher_student_detail(pg_temp.id('a')) d, jsonb_array_elements(d -> 'recent') r
  where r ->> 'game' = 'power-clash' limit 1), 'friend', 'and in their recent games');
select is((select friend_games from public.teacher_students() where id = pg_temp.id('a')), 7, 'and counted with their friend games');
select pg_temp.reset();

-- ---- What the website reads ----
insert into g select 'scored', power_game from public.scored_games where player = pg_temp.id('a') and game = 'power-clash' limit 1;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(public.progress_rules() -> 'powerClash', '{"bot":2,"friend":4,"friendDailyGames":6}'::jsonb,
  'How points work reads the Power Clash rules from here');
select ok(exists (select 1 from jsonb_array_elements(public.my_progress() -> 'recent') r
  where r ->> 'id' = (select id::text from g where name = 'scored')),
  'Recent games can point at a Power Clash game');
select pg_temp.reset();

-- Deleting a student empties their seat; the game stays for the other.
delete from auth.users where id = pg_temp.id('b');
select is((select seat1::text || ' ' || coalesce(seat2::text, 'empty') from public.power_games
  where id = (select id from g where name = 'ab')), pg_temp.id('a')::text || ' empty', 'a deleted student''s seat empties');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select lives_ok($$ select public.teacher_new_season('NEW SEASON') $$, 'a new season...');
select pg_temp.reset();
select is((select count(*)::int from public.power_games where status not in ('playing', 'waiting')), 0,
  '...clears finished Power Clash games');
select is((select count(*)::int from public.power_games where status = 'playing'), 1, 'but leaves games still being played');

select * from finish();
rollback;
