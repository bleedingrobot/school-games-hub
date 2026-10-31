-- Bond Match M.4: saving, bests, stars, points, the daily limits, what students and teachers can see, the shared lists.
-- Run with: scripts/scratch-test.sh <scratch-db> supabase/tests/database/bond_match.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000e';

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-00000000000' || who)::uuid
$$;

-- Saves a game the way the server does (it has already replayed it).
create function pg_temp.game(who text, bond text default 'whole-10', size text default 'small', stars integer default 3,
  flip_count integer default 6, seconds integer default 60, run_id uuid default gen_random_uuid())
returns jsonb language sql as $$
  select public.record_bond_match_game(pg_temp.id(who), jsonb_build_object(
    'runId', run_id, 'bondId', bond, 'size', size, 'seed', 7, 'flips', jsonb_build_array(0, 1, 2, 3),
    'flipCount', flip_count, 'seconds', seconds, 'stars', stars))
$$;
create function pg_temp.points(who text) returns integer language sql as $$
  select coalesce(sum(points), 0)::integer from public.scored_games where player = pg_temp.id(who) and game = 'bond-match'
$$;

-- ---- Students can't save or read the tables themselves ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select pg_temp.game('a') $$, '42501', null, 'a student cannot save a game directly');
select throws_ok($$ select * from public.bond_match_games $$, '42501', null, 'students cannot read the games table');
select throws_ok($$ select * from public.bond_match_bests $$, '42501', null, 'students cannot read the bests table');
select throws_ok($$ insert into public.bond_match_bests values (pg_temp.id('a'), 'whole-10', 'small', 6, 10, 3, 1, now()) $$,
  '42501', null, 'students cannot write bests');
select throws_ok($$ select public.teacher_bond_match_student(pg_temp.id('b')) $$, '42501', null,
  'students cannot see another student''s stars');
select is(public.my_bond_match() -> 'bests', '[]'::jsonb, 'a new student has no bests');
select pg_temp.reset();

-- ---- Saving a game, once ----
select is(pg_temp.game('a', run_id => '00000000-0000-0000-0000-0000000000f1') ->> 'status', 'saved', 'a finished game saves');
select is(pg_temp.points('a'), 2, 'a finished game earns 2 points');
select is(pg_temp.game('a', run_id => '00000000-0000-0000-0000-0000000000f1') ->> 'status', 'duplicate',
  'the same run sent again is spotted');
select is(pg_temp.points('a'), 2, '... and not scored twice');
select is((select count(*)::integer from public.bond_match_games where player = pg_temp.id('a')), 1, '... or saved twice');
select is(pg_temp.game('a', run_id => '00000000-0000-0000-0000-0000000000f1') -> 'best' ->> 'flips', '6',
  'a duplicate still says the best');

-- ---- Bests ----
select pg_temp.game('a', stars => 1, flip_count => 14, seconds => 30);
select is((select best_flips || '/' || best_seconds || '/' || best_stars || '/' || plays from public.bond_match_bests
  where player = pg_temp.id('a') and bond_id = 'whole-10' and size = 'small'), '6/30/3/2',
  'fewest flips, fastest time and best stars are kept separately, and plays are counted');
select is(pg_temp.game('a', size => 'large', stars => 2, flip_count => 20, seconds => 90) -> 'best' ->> 'stars', '2',
  'a different size has its own bests');
select is((select count(*)::integer from public.bond_match_bests where player = pg_temp.id('a')), 2, '... as a different row');
select is(pg_temp.game('a', 'fraction-halves') ->> 'status', 'saved', 'a different bond has its own row');

-- ---- Checks on what is sent ----
select throws_ok($$ select pg_temp.game('a', stars => 4) $$, '23514', null, 'stars are 1 to 3');
select throws_ok($$ select pg_temp.game('a', size => 'huge') $$, '23514', null, 'the size must be real');
select throws_ok($$ select pg_temp.game('a', bond => 'Bad Bond!') $$, '23514', null, 'the bond id must look like one');
select throws_ok($$ select pg_temp.game('a', seconds => -1) $$, '23514', null, 'time is never negative');
select throws_ok($$ select public.record_bond_match_game('00000000-0000-0000-0000-0000000000aa', '{}') $$, '22023', null,
  'a player who does not exist is refused');

-- ---- Points: only some games a day, and inside the shared daily cap ----
select pg_temp.game('b') from generate_series(1, 12);
select is(pg_temp.points('b'), 20, 'only the first 10 games a day earn points (2 each)');
select is((select count(*)::integer from public.bond_match_games where player = pg_temp.id('b') and not counts_for_points), 2,
  '... the other two are saved, just without points');
select is((select count(*)::integer from public.bond_match_games where player = pg_temp.id('b')), 12, '... and every game is kept');
select public.record_bot_game(pg_temp.id('a'), 'chess', 'medium', 'white', array['e2e4', 'm' || g], 'won', 'checkmate', 20, true)
from generate_series(1, 5) as g;
select is((select coalesce(sum(points), 0)::integer from public.scored_games where player = pg_temp.id('a')
  and kind in ('bot', 'solo') and nz_day = public.nz_day(now())), 40, 'bot games, Bond Match and the cap share 40 a day');
select is(pg_temp.game('a') ->> 'points', '0', 'a game over the cap earns nothing');

-- ---- Too many games in a day ----
insert into public.bond_match_games (player, run_id, bond_id, size, seed, flips, flip_count, seconds, stars, counts_for_points)
select pg_temp.id('b'), gen_random_uuid(), 'whole-10', 'small', 7, array[0, 1], 6, 60, 3, false from generate_series(1, 88);
select throws_ok($$ select pg_temp.game('b') $$, '54000', null, 'a hundred games in a day is the limit');

-- ---- Reading ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(jsonb_array_length(public.my_bond_match() -> 'bests'), 3, 'a student reads their own bests');
select is(public.my_bond_match() -> 'bests' -> 0 ->> 'bondId', 'fraction-halves', '... in a steady order');
select pg_temp.reset();
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select is(jsonb_array_length(public.teacher_bond_match_student(pg_temp.id('a')) -> 'bests'), 3, 'a teacher sees the stars per bond');
select is(public.teacher_bond_match_student(pg_temp.id('a')) ->> 'games', '5', '... and how many games');
select pg_temp.reset();

-- ---- The shared lists ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select ok((select bot_games from public.teacher_students() where id = pg_temp.id('b')) >= 12, 'the teacher list counts Bond Match games');
select pg_temp.reset();
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select ok((select count(*) from jsonb_array_elements(public.my_progress() -> 'recent') e where e ->> 'id' is not null) >= 1,
  'recent games include a Bond Match score');
select pg_temp.reset();

select is((public.rebuild_progress() ->> 'scored_games')::integer >= 1, true, 'rebuilding points still works');
select is(pg_temp.points('b'), 20, '... and keeps Bond Match points the same');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select public.teacher_new_season('NEW SEASON');
select pg_temp.reset();
select is((select count(*)::integer from public.bond_match_games) + (select count(*)::integer from public.bond_match_bests), 0,
  'a new season clears Bond Match games and bests');

select * from finish();
rollback;
