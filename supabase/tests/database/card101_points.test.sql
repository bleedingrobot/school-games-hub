-- Stage 10.3: 101 games against bots. Saving (once per seed), the same points as chess and
-- checkers inside the shared daily bot cap, the 101 achievements, and that 101 games never
-- touch ratings or leaderboards.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000e';

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

-- Saves a 101 game the way the server does.
create function pg_temp.c101(who text, seed text, place integer default 2, level text default 'easy',
  counts boolean default true, zero integer default 0, triples integer default 0, knocks integer default 0,
  threes integer default 0)
returns uuid language sql as $$
  select public.record_101_bot_game(('00000000-0000-0000-0000-00000000000' || who)::uuid, level, 'first',
    array['peek', 'draw:stack', 'swap:2', 'next'], case when place = 1 then 'won' else 'lost' end,
    case when place is null then 'abandoned' else 'finished' end, 30, counts,
    jsonb_build_object('seed', seed, 'settings', '{"target":101}'::jsonb, 'bots', 2, 'place', place, 'players', 3,
      'rounds', 9, 'total', 104,
      'stats', jsonb_build_object('zeroHands', zero, 'triples', triples, 'knockWins', knocks, 'savedByThree', threes)))
$$;
create function pg_temp.points(who text, which text default '101') returns integer language sql as $$
  select coalesce(sum(points), 0)::integer from public.scored_games
  where player = ('00000000-0000-0000-0000-00000000000' || who)::uuid and game = which
$$;
create function pg_temp.has(who text, achievement text) returns boolean language sql as $$
  select exists (select 1 from public.achievements
    where player = ('00000000-0000-0000-0000-00000000000' || who)::uuid and achievements.achievement = $2)
$$;

-- ---- Only the server can save one ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select pg_temp.c101('a', 's1-sneaky') $$, '42501', null, 'a student cannot save a 101 game directly');
select pg_temp.reset();

select throws_ok($$ insert into public.bot_games (player, game, bot_level, player_side, moves, result, reason, player_moves, counts_for_points)
  values ('00000000-0000-0000-0000-00000000000a', '101', 'easy', 'first', '{}', 'won', 'finished', 10, true) $$,
  '23514', null, 'a 101 game must keep its seed and setup');
select throws_ok($$ insert into public.bot_games (player, game, bot_level, player_side, moves, result, reason, player_moves, counts_for_points, card101)
  values ('00000000-0000-0000-0000-00000000000a', 'chess', 'easy', 'white', '{}', 'won', 'checkmate', 10, true, '{"seed":"x"}') $$,
  '23514', null, 'only 101 games carry 101 details');
select throws_ok($$ insert into public.ratings values ('00000000-0000-0000-0000-00000000000a', '101', 1000, 0, 0) $$,
  '23514', null, 'there is no such thing as a 101 rating');

-- ---- Points: the same as chess and checkers ----
select pg_temp.act_as_server();
create temporary table saves (n integer, id uuid) on commit drop;
grant all on saves to service_role;
insert into saves select 1, pg_temp.c101('a', 's1-0000000001-aaa', 1);
insert into saves select 2, pg_temp.c101('a', 's1-0000000001-aaa', 1);
insert into saves select 3, pg_temp.c101('a', 's1-0000000002-bbb', 3);
insert into saves select 4, pg_temp.c101('a', 's1-0000000003-ccc', 1, 'medium');
insert into saves select 5, pg_temp.c101('a', 's1-0000000004-ddd', 1, 'very-easy');
select pg_temp.reset();

select is((select count(distinct id)::int from saves where n <= 2), 1, 'the same seed sent twice hands back the saved game');
select is((select count(*)::int from public.bot_games where game = '101'), 4, 'and saves it only once');
select is((select points from public.scored_games where bot_game = (select id from saves where n = 1)), 5, 'beating Easy bots earns 5');
select is((select points from public.scored_games where bot_game = (select id from saves where n = 3)), 2, 'losing to Easy bots earns 2');
select is((select points from public.scored_games where bot_game = (select id from saves where n = 4)), 8, 'beating Medium bots earns 8');
select is((select points from public.scored_games where bot_game = (select id from saves where n = 5)), 3, 'beating Very Easy bots earns 3');
select is((select card101 from public.scored_games where bot_game = (select id from saves where n = 1)),
  '{"zeroHands":0,"triples":0,"knockWins":0,"savedByThree":0}'::jsonb, 'the stats are kept for achievements');

select pg_temp.act_as_server();
select pg_temp.c101('a', 's1-0000000005-eee', 2, 'easy', false);
select pg_temp.c101('a', 's1-0000000006-fff', null, 'easy', false);
select pg_temp.reset();
select is((select count(*)::int from public.scored_games where game = '101'), 4, 'short games and left games earn nothing');

-- The daily bot cap is shared with chess.
insert into public.bot_games (player, game, bot_level, player_side, moves, result, reason, player_moves, counts_for_points)
select '00000000-0000-0000-0000-00000000000b', 'chess', case when n = 5 then 'easy' else 'medium' end, 'white',
  array['e2e4', n::text], 'won', 'checkmate', 12, true
from generate_series(1, 5) as n;
select is(pg_temp.points('b', 'chess'), 37, 'Ben earns 37 from chess today');
select pg_temp.act_as_server();
select pg_temp.c101('b', 's1-0000000007-ggg', 1, 'medium');
select pg_temp.c101('b', 's1-0000000008-hhh', 1, 'medium');
select pg_temp.reset();
select is(pg_temp.points('b'), 3, '101 games get only what''s left of the 40-a-day cap');
select is(pg_temp.points('b', 'chess') + pg_temp.points('b'), 40, 'bot games all together stop at 40');
select ok(pg_temp.has('b', '101-first-win'), 'achievements still count after the cap');

select is((select count(*)::int from public.ratings where game = '101'), 0, '101 games never make a rating');

-- ---- Achievements ----
select ok(pg_temp.has('a', '101-first-game'), 'one finished game: First game of 101');
select ok(pg_temp.has('a', '101-first-win'), 'a win: Win a game of 101');
select ok(not pg_temp.has('a', '101-perfect-zero'), 'no zero hand yet');
select ok(not pg_temp.has('a', '101-ten-games'), '4 games isn''t 10');
select pg_temp.act_as_server();
select pg_temp.c101('a', 's1-0000000010-g1', 2, 'easy', true, 2, 0, 1, 0);
select pg_temp.c101('a', 's1-0000000011-g2', 2, 'easy', true, 0, 1, 0, 2);
select pg_temp.reset();
select ok(pg_temp.has('a', '101-perfect-zero'), 'a zero hand earns Perfect zero');
select ok(pg_temp.has('a', '101-knock-win'), 'knocking and winning the round earns its achievement');
select ok(pg_temp.has('a', '101-triples'), 'three of a kind earns Triples!');
select ok(pg_temp.has('a', '101-saved-by-3'), 'a 3 cancelling a 10 earns Saved by a 3');
select pg_temp.act_as_server();
select pg_temp.c101('a', 's1-00000001' || n || '-ten', 3) from generate_series(20, 23) as n;
select pg_temp.reset();
select ok(pg_temp.has('a', '101-ten-games'), '10 finished games earns Finish 10 games');
select ok(not pg_temp.has('a', '101-classmates-win'), 'no classmates win yet');

-- ---- What the website reads ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(public.progress_rules() -> 'card101',
  '{"friendLost":4,"friendWon":8,"friendDailyGames":6,"minRounds":2}'::jsonb, 'How points work reads the 101 rules from here');
select is((select count(*)::int from jsonb_array_elements(public.my_progress() -> 'achievements') a where a ->> 'game' = '101'), 8,
  'the student''s progress lists the 8 101 achievements');
select throws_ok($$ select * from public.leaderboard('101', 'week') $$, '22023', null, 'there is no 101 leaderboard');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select is((select g -> 'bot' ->> 'played' from jsonb_array_elements(public.teacher_student_detail('00000000-0000-0000-0000-00000000000a') -> 'games') g
  where g ->> 'game' = '101'), '12', 'the teacher sees the 101 games a student played, with no badge');

-- ---- Starting again ----
select pg_temp.reset();
create temp table before_rebuild as select bot_game, points, card101 from public.scored_games
  where player = '00000000-0000-0000-0000-00000000000a';
select public.rebuild_progress();
select set_eq($$ select bot_game, points, card101 from public.scored_games where player = '00000000-0000-0000-0000-00000000000a' $$,
  $$ select * from before_rebuild $$, 'working everything out again gives the same 101 points and stats');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select public.teacher_new_season('NEW SEASON');
select pg_temp.reset();
select is((select count(*)::int from public.bot_games where game = '101'), 0, 'a new season clears 101 games and their achievements');

select * from finish();
rollback;
