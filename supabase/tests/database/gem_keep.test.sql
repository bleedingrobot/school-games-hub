-- Stage 11 Phase 5: Gem Keep saving, points, achievements, the stars leaderboard, teacher
-- settings and views, the trial import and the new season.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(66);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000e';

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

-- Saves a level the way the server does.
create function pg_temp.run(who text, n integer, result text default 'won', stars integer default 3,
  waves integer default 8, run_id uuid default gen_random_uuid())
returns jsonb language sql as $$
  select public.record_gem_keep_run(pg_temp.id(who), jsonb_build_object(
    'runId', run_id, 'levelId', 'level-' || lpad(n::text, 2, '0'), 'levelNumber', n,
    'afterLevel', case when n > 1 then 'level-' || lpad((n - 1)::text, 2, '0') end,
    'result', result, 'stars', case when result = 'won' then stars else 0 end, 'waves', waves, 'wavesTotal', 8,
    'gameSeconds', 400, 'asked', 30, 'right', 25))
$$;
create function pg_temp.key(who text, n integer, right_answers integer default 9) returns text language sql as $$
  select public.record_gem_keep_key(pg_temp.id(who), 'level-' || lpad(n::text, 2, '0'), right_answers)
$$;
create function pg_temp.points(who text) returns integer language sql as $$
  select coalesce(sum(points), 0)::integer from public.scored_games where player = pg_temp.id(who) and game = 'gem-keep'
$$;
create function pg_temp.has(who text, achievement text) returns boolean language sql as $$
  select exists (select 1 from public.achievements where player = pg_temp.id(who) and achievements.achievement = $2)
$$;

-- ---- Students can't save or read the tables themselves ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select pg_temp.run('a', 1) $$, '42501', null, 'a student cannot save a level directly');
select throws_ok($$ select public.record_gem_keep_key(pg_temp.id('a'), 'level-01', 10) $$, '42501', null,
  'a student cannot pass a Level Key directly');
select throws_ok($$ select public.record_gem_keep_facts(pg_temp.id('a'), 'times-tables', '[]') $$, '42501', null,
  'a student cannot write fact records directly');
select throws_ok($$ select public.import_gem_keep_progress(pg_temp.id('a'), '[]') $$, '42501', null,
  'a student cannot import progress directly');
select throws_ok($$ select * from public.gem_keep_progress $$, '42501', null, 'students cannot read campaign progress tables');
select throws_ok($$ select * from public.gem_keep_facts $$, '42501', null, 'students cannot read fact records tables');
select throws_ok($$ select public.teacher_gem_keep_class() $$, '42501', null, 'students cannot see the class view');
select throws_ok($$ select public.teacher_gem_keep_student(pg_temp.id('b')) $$, '42501', null,
  'students cannot see another student''s grid');
select throws_ok($$ select public.teacher_set_gem_keep('{}') $$, '42501', null, 'students cannot change the settings');
select is((public.my_gem_keep() ->> 'canImport')::boolean, true, 'a new student may bring in trial progress');
select is(public.my_gem_keep() -> 'settings' ->> 'keyPassMark', '8', 'the default Level Key pass mark is 8');
select pg_temp.reset();

-- ---- Saving a level, once ----
select is(pg_temp.run('a', 1, 'won', 3, 8, '00000000-0000-0000-0000-0000000000f1') ->> 'status', 'saved', 'a won level saves');
select is(pg_temp.points('a'), 5, 'a 3-star win earns 5 points');
select is(pg_temp.run('a', 1, 'won', 3, 8, '00000000-0000-0000-0000-0000000000f1') ->> 'status', 'duplicate',
  'the same run sent again is spotted');
select is(pg_temp.points('a'), 5, '... and not scored twice');
select is((select count(*)::integer from public.gem_keep_runs where player = pg_temp.id('a')), 1, '... or saved twice');
select is(pg_temp.run('a', 1, 'won', 1) ->> 'points', '3', 'a 1-star win earns 3 points');
select is((select best_stars from public.gem_keep_progress where player = pg_temp.id('a') and level_id = 'level-01'), 3,
  'a worse replay keeps the best stars');
select is(pg_temp.run('a', 1, 'lost', 0, 4) ->> 'points', '1', 'a loss that reached wave 3 earns 1 point');
select is(pg_temp.run('a', 1, 'lost', 0, 2) ->> 'points', null, 'a loss before wave 3 earns nothing');
select is((select plays || '/' || wins from public.gem_keep_progress where player = pg_temp.id('a') and level_id = 'level-01'),
  '4/2', 'plays and wins are counted');
select throws_ok($$ insert into public.gem_keep_runs (player, run_id, level_id, level_number, result, stars, waves, waves_total,
    game_seconds, asked, right_answers, counts_for_points)
  values (pg_temp.id('a'), gen_random_uuid(), 'level-01', 1, 'won', 0, 8, 8, 1, 0, 0, true) $$,
  '23514', null, 'a won level has at least one star');

-- ---- Levels open in order ----
select is(pg_temp.run('a', 2) ->> 'status', 'locked', 'level 2 is locked until level 1''s Key is passed');
select is((select count(*)::integer from public.gem_keep_runs where player = pg_temp.id('a') and level_number = 2), 0,
  '... and the locked run is not saved');

-- ---- Level Keys ----
select is(pg_temp.key('b', 1), 'no-win', 'a Level Key needs a win on that level first');
select is(pg_temp.key('a', 1, 7), 'not-passed', '7 out of 10 does not pass with the default mark of 8');
select ok(not pg_temp.has('a', 'gk-first-key'), '... and earns no Key achievement');
select is(pg_temp.key('a', 1, 8), 'passed', '8 out of 10 passes');
select is(pg_temp.key('a', 1, 10), 'already', 'passing again changes nothing');
select ok(pg_temp.has('a', 'gk-first-win') and pg_temp.has('a', 'gk-first-key') and pg_temp.has('a', 'gk-three-stars'),
  'first win, first Key and 3 stars are achievements');
select is(pg_temp.run('a', 2, 'won', 2) ->> 'status', 'saved', 'level 2 opens after the Key');

update public.app_settings set gem_keep_key_pass = 10 where id;
select pg_temp.run('c', 1);
select is(pg_temp.key('c', 1, 9), 'not-passed', 'the teacher''s pass mark is the one used');
update public.app_settings set gem_keep_key_pass = 8 where id;

-- ---- The daily cap is shared with bot games ----
select public.record_bot_game(pg_temp.id('b'), 'chess', 'medium', 'white', array['e2e4', 'm' || g], 'won', 'checkmate', 20, true)
from generate_series(1, 4) as g;
select is((select coalesce(sum(points), 0)::integer from public.scored_games where player = pg_temp.id('b')), 32,
  'four medium wins earn 32');
select is(pg_temp.run('b', 1) ->> 'points', '5', 'a level can still earn 5 under the cap');
select is(pg_temp.run('b', 1) ->> 'points', '3', 'then only what is left of the 40');
select is(pg_temp.run('b', 1) ->> 'points', '0', 'then nothing');
select public.record_bot_game(pg_temp.id('b'), 'chess', 'medium', 'white', array['e2e4', 'm5'], 'won', 'checkmate', 20, true);
select is((select points from public.scored_games where player = pg_temp.id('b') and game = 'chess'
  order by finished_at desc, id desc limit 1), 0, 'Gem Keep points count towards the cap for bot games too');

-- ---- Fact records ----
select is(public.record_gem_keep_facts(pg_temp.id('a'), 'times-tables',
  '[{"key":"mul:7x8","attempts":4,"correct":2,"avgMs":4100,"box":1,"lastSeen":1760000000000,"quickDays":["2026-10-16"]},
    {"key":"mul:2x5","attempts":3,"correct":3,"avgMs":1500,"box":3,"lastSeen":0,"quickDays":[]}]'), 2,
  'fact records save');
select is(public.record_gem_keep_facts(pg_temp.id('a'), 'times-tables',
  '[{"key":"mul:7x8","attempts":3,"correct":3,"avgMs":900,"box":4,"lastSeen":1760000000000,"quickDays":[]}]'), 0,
  'an older record (fewer answers) cannot wind one back');
select is((select box from public.gem_keep_facts where player = pg_temp.id('a') and fact_key = 'mul:7x8'), 1,
  '... so the saved one stays');
select is(public.record_gem_keep_facts(pg_temp.id('a'), 'times-tables',
  '[{"key":"mul:7x8","attempts":5,"correct":3,"avgMs":4000,"box":2,"lastSeen":1760000100000,"quickDays":["2026-10-16","2026-10-17"]}]'), 1,
  'a newer record replaces it');
select throws_ok($$ select public.record_gem_keep_facts(pg_temp.id('a'), 'times-tables',
  '[{"key":"mul:3x3","attempts":1,"correct":2,"avgMs":1,"box":0,"lastSeen":0,"quickDays":[]}]') $$,
  '23514', null, 'more right than asked is refused');
select public.record_gem_keep_facts(pg_temp.id('b'), 'times-tables',
  '[{"key":"mul:7x8","attempts":4,"correct":1,"avgMs":5000,"box":1,"lastSeen":0,"quickDays":[]},
    {"key":"mul:2x5","attempts":4,"correct":4,"avgMs":2000,"box":2,"lastSeen":0,"quickDays":[]}]');

-- ---- What the student reads ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(jsonb_array_length(public.my_gem_keep() -> 'progress'), 2, 'a student reads their own progress');
select is((select f -> 'quickDays' from jsonb_array_elements(public.my_gem_keep() -> 'facts') as f where f ->> 'key' = 'mul:7x8'), '["2026-10-16", "2026-10-17"]',
  '... and fact records, with their quick days');
select is((public.my_gem_keep() ->> 'canImport')::boolean, false, 'no trial import once there is saved progress');
select is((select stars from public.gem_keep_leaderboard() where is_me), 5, 'the leaderboard counts best stars');
select is((select display_name from public.gem_keep_leaderboard() where place = 1),
  (select display_name from public.profiles where id = pg_temp.id('a')), 'most stars is first');
select is((select sum((r ->> 'points')::integer)::integer from jsonb_array_elements(public.my_progress() -> 'recent') as r), 13,
  'recent points include Gem Keep levels');
select pg_temp.reset();
update public.profiles set hidden = true where id = pg_temp.id('b');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is((select count(*)::integer from public.gem_keep_leaderboard()), 2, 'hidden students are not on the stars board');
select pg_temp.reset();
update public.profiles set hidden = false where id = pg_temp.id('b');

-- ---- Bringing in trial progress ----
select is(public.import_gem_keep_progress(pg_temp.id('a'), '[{"levelId":"level-03","stars":3,"keyPassed":true}]'),
  'skipped', 'no import over saved progress');
select is(public.import_gem_keep_progress(pg_temp.id('e'),
  '[{"levelId":"level-01","stars":2,"keyPassed":true},{"levelId":"level-02","stars":1,"keyPassed":false}]'),
  'imported', 'trial progress comes in once');
select is(public.import_gem_keep_progress(pg_temp.id('e'), '[]'), 'skipped', '... and only once');
select is((select coalesce(sum(points), 0)::integer from public.scored_games where player = pg_temp.id('e')), 0,
  'imported progress earns no points by itself');
select is(pg_temp.run('e', 2) ->> 'status', 'saved', 'an imported Key opens the next level');

-- ---- Teachers ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select is(jsonb_array_length(public.teacher_gem_keep_student(pg_temp.id('a')) -> 'facts'), 2,
  'a teacher sees a student''s fact records');
select is(public.teacher_gem_keep_class() -> 'hardest' -> 0 ->> 'key', 'mul:7x8', '7 x 8 is the class''s hardest fact');
select is(jsonb_array_length(public.teacher_gem_keep_class() -> 'hardest'), 1, 'facts nobody gets wrong are not listed');
select is(public.teacher_set_gem_keep('{"mode":"challenge","enabledTables":[2,5,10],"division":true,"missingFactor":null,"multipleChoice":false,"keyPassMark":7}')
  -> 'enabledTables', '[2, 5, 10]', 'a teacher changes the settings');
select throws_ok($$ select public.teacher_set_gem_keep('{"mode":"calm","enabledTables":[],"division":false,"missingFactor":null,"multipleChoice":false,"keyPassMark":8}') $$,
  '22023', 'Leave at least one times table on.', 'at least one table stays on');
select throws_ok($$ select public.teacher_set_gem_keep('{"mode":"calm","enabledTables":[13],"division":false,"missingFactor":null,"multipleChoice":false,"keyPassMark":8}') $$,
  '22023', null, 'only tables 1 to 12');
select throws_ok($$ select public.teacher_set_gem_keep('{"mode":"calm","enabledTables":[2],"division":false,"missingFactor":null,"multipleChoice":false,"keyPassMark":3}') $$,
  '22023', null, 'the pass mark stays between 5 and 10');
select is((select bot_games from public.teacher_students() where id = pg_temp.id('a')), 5,
  'the teacher list counts Gem Keep levels as games');

-- ---- Rebuilding scores keeps Gem Keep ----
select pg_temp.reset();
create temp table points_before as select pg_temp.points('a') as p;
select public.rebuild_progress();
select is(pg_temp.points('a'), (select p from points_before), 'rebuilding scores keeps Gem Keep points');
select ok(pg_temp.has('a', 'gk-first-key'), '... and its achievements');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');

-- ---- A new season clears it ----
select is((public.teacher_new_season('NEW SEASON') ->> 'gemKeepLevels')::integer > 0, true, 'a new season deletes the levels');
select pg_temp.reset();
select is((select count(*)::integer from public.gem_keep_progress) + (select count(*)::integer from public.gem_keep_facts), 0,
  '... and campaign progress and fact records');

select * from finish();
rollback;
