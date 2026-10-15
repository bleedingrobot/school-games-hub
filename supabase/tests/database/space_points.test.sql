-- Stage 9.3: Wormholes & Black Holes games against bots. Saving (once per seed), taking-part
-- points that share the daily bot cap, the space achievements, and that space games never
-- touch ratings or leaderboards.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
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

-- Saves a space game the way the server does.
create function pg_temp.space(who text, seed text, place integer default 2, counts boolean default true,
  wormholes integer default 1, blocks integer default 0, stars text[] default '{}', reason text default 'docked')
returns uuid language sql as $$
  select public.record_space_bot_game(('00000000-0000-0000-0000-00000000000' || who)::uuid, 'easy', 'second',
    array['roll', 'roll', 'use:booster', 'roll', 'roll'], case when place = 1 then 'won' else 'lost' end, reason, 12, counts,
    jsonb_build_object('seed', seed, 'board', '{"id":"nebula"}'::jsonb, 'settings', '{}'::jsonb, 'bots', 3,
      'place', place, 'rockets', 4,
      'stats', jsonb_build_object('wormholes', wormholes, 'blocks', blocks, 'stars', to_jsonb(stars), 'docked', place = 1)))
$$;
create function pg_temp.points(who text, which text default 'space') returns integer language sql as $$
  select coalesce(sum(points), 0)::integer from public.scored_games
  where player = ('00000000-0000-0000-0000-00000000000' || who)::uuid and game = which
$$;
create function pg_temp.has(who text, achievement text) returns boolean language sql as $$
  select exists (select 1 from public.achievements
    where player = ('00000000-0000-0000-0000-00000000000' || who)::uuid and achievements.achievement = $2)
$$;

-- ---- Only the server can save one ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select pg_temp.space('a', 's1-sneaky') $$, '42501', null, 'a student cannot save a space game directly');
select pg_temp.reset();

select throws_ok($$ insert into public.bot_games (player, game, bot_level, player_side, moves, result, reason, player_moves, counts_for_points)
  values ('00000000-0000-0000-0000-00000000000a', 'space', 'easy', 'first', '{}', 'won', 'docked', 10, true) $$,
  '23514', null, 'a space game must keep its seed and setup');
select throws_ok($$ insert into public.ratings values ('00000000-0000-0000-0000-00000000000a', 'space', 1000, 0, 0) $$,
  '23514', null, 'there is no such thing as a space rating');

-- ---- Points: the same win or lose ----
select pg_temp.act_as_server();
create temporary table saves (n integer, id uuid) on commit drop;
grant all on saves to service_role;
insert into saves select 1, pg_temp.space('a', 's1-0000000001-aaa', 1);
insert into saves select 2, pg_temp.space('a', 's1-0000000001-aaa', 1);
insert into saves select 3, pg_temp.space('a', 's1-0000000002-bbb', 4);
select pg_temp.reset();

select is((select count(distinct id)::int from saves where n <= 2), 1, 'the same seed sent twice hands back the saved game');
select is((select count(*)::int from public.bot_games where game = 'space'), 2, 'and saves it only once');
select is((select points from public.scored_games where bot_game = (select id from saves where n = 1)), 2, '1st place earns 2');
select is((select points from public.scored_games where bot_game = (select id from saves where n = 3)), 2, '4th place earns 2 too');
select is((select bot_level from public.scored_games where bot_game = (select id from saves where n = 3)), 'easy',
  'the bot level is kept');

select pg_temp.act_as_server();
select pg_temp.space('a', 's1-0000000003-ccc', 2, false);
select pg_temp.reset();
select is((select count(*)::int from public.scored_games where game = 'space'), 2, 'a game that doesn''t count earns nothing');

-- The daily bot cap is shared with chess and checkers.
insert into public.bot_games (player, game, bot_level, player_side, moves, result, reason, player_moves, counts_for_points)
select '00000000-0000-0000-0000-00000000000b', 'chess', case when n = 5 then 'easy' else 'medium' end, 'white',
  array['e2e4', n::text], 'won', 'checkmate', 12, true
from generate_series(1, 5) as n;
select is(pg_temp.points('b', 'chess'), 37, 'Ben earns 37 from chess today (4 Medium wins and an Easy one)');
select pg_temp.act_as_server();
select pg_temp.space('b', 's1-0000000004-ddd');
select pg_temp.space('b', 's1-0000000005-eee');
select pg_temp.reset();
select is(pg_temp.points('b'), 3, 'space games get only what''s left of the 40-a-day cap (2, then 1)');
select is(pg_temp.points('b', 'chess') + pg_temp.points('b'), 40, 'bot games all together stop at 40');
select pg_temp.act_as_server();
select pg_temp.space('b', 's1-0000000006-fff');
select pg_temp.reset();
select is((select points from public.scored_games where player = '00000000-0000-0000-0000-00000000000b' and game = 'space'
  order by id desc limit 1), 0, 'after the cap a space game earns 0...');
select ok(pg_temp.has('b', 'space-first-launch'), '...but achievements still count');

select is((select count(*)::int from public.ratings where game = 'space'), 0, 'space games never make a rating');

-- ---- Achievements ----
select ok(pg_temp.has('a', 'space-first-launch'), 'one finished game: First launch');
select ok(not pg_temp.has('a', 'space-wormholes-25'), 'not 25 wormholes yet');
select pg_temp.act_as_server();
select pg_temp.space('a', 's1-0000000010-g1', 3, true, 20, 1, array['red-dwarf', 'yellow-star', 'blue-giant', 'white-dwarf']);
select pg_temp.space('a', 's1-0000000011-g2', 3, true, 3, 0, array['red-dwarf', 'binary-star', 'neutron-star', 'pulsar']);
select pg_temp.reset();
select ok(pg_temp.has('a', 'space-wormholes-25'), 'wormholes add up across games: 25 earns Ride 25 wormholes');
select ok(pg_temp.has('a', 'space-force-field'), 'blocking a black hole earns the Force Field achievement');
select ok(not pg_temp.has('a', 'space-every-star'), '8 kinds of star isn''t every kind');
select pg_temp.act_as_server();
select pg_temp.space('a', 's1-0000000012-g3', 2, true, 0, 0, array['supernova', 'matariki']);
select pg_temp.reset();
select ok(pg_temp.has('a', 'space-every-star'), 'all 9 kinds, over several games, earns Land on every kind of star');
select ok(not pg_temp.has('a', 'space-dock-10'), 'docking once isn''t 10 times');
select pg_temp.act_as_server();
select pg_temp.space('a', 's1-00000001' || n || '-dock', 1) from generate_series(10, 18) as n;
select pg_temp.reset();
select ok(pg_temp.has('a', 'space-dock-10'), 'docking 10 times earns Dock at the station 10 times');
select ok(not pg_temp.has('a', 'space-classmates'), 'no classmates game yet');

-- ---- What the website reads ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is((public.progress_rules() -> 'space' ->> 'bot')::int, 2, 'How points work reads the space points from here');
select is((select count(*)::int from jsonb_array_elements(public.my_progress() -> 'achievements') a where a ->> 'game' = 'space'), 6,
  'the student''s progress lists the 6 space achievements');
select is((select (a ->> 'progress')::int from jsonb_array_elements(public.my_progress() -> 'achievements') a
  where a ->> 'id' = 'space-every-star'), 9, 'with progress towards each');
select throws_ok($$ select * from public.leaderboard('space', 'week') $$, '22023', null, 'there is no space leaderboard');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select is((select g -> 'bot' ->> 'played' from jsonb_array_elements(public.teacher_student_detail('00000000-0000-0000-0000-00000000000a') -> 'games') g
  where g ->> 'game' = 'space'), '15', 'the teacher sees the space games a student played');
select ok((select g -> 'rank' = 'null'::jsonb from jsonb_array_elements(public.teacher_student_detail('00000000-0000-0000-0000-00000000000a') -> 'games') g
  where g ->> 'game' = 'space'), 'with no badge for space');

-- ---- Starting again ----
select pg_temp.reset();
-- (Ana's games only: Ben's were all saved in the same instant, so the cap could fall on a different one.)
create temp table before_rebuild as select bot_game, points, space from public.scored_games
  where player = '00000000-0000-0000-0000-00000000000a';
select public.rebuild_progress();
select set_eq($$ select bot_game, points, space from public.scored_games where player = '00000000-0000-0000-0000-00000000000a' $$,
  $$ select * from before_rebuild $$, 'working everything out again gives the same space points and stats');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select public.teacher_new_season('NEW SEASON');
select pg_temp.reset();
select is((select count(*)::int from public.bot_games where game = 'space'), 0, 'a new season clears space games...');
select is((select count(*)::int from public.achievements a join public.achievement_types t on t.id = a.achievement
  where t.game = 'space'), 0, '...and space achievements');

select * from finish();
rollback;
