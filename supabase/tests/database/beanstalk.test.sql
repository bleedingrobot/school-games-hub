-- Kiwi's Beanstalk (migrations 20261104000700 and 20261104000800): progress, challenges, the switch and the dots setting,
-- and the hub hooks with one achievement per Golden Egg.
-- Pupils can't read or change any of it directly; the server function does everything.
-- Run on a throw-away copy: scripts/scratch-db.sh beanstalk, then scripts/scratch-test.sh beanstalk supabase/tests/database/beanstalk.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
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
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || who)::uuid $$;

-- ---- Off to start, with the dots on ----
select is((select bool_or(beanstalk_enabled) from public.app_settings), false, 'the game starts switched off everywhere');
select is((select bool_and(beanstalk_dots) from public.app_settings), true, '... with the leaves'' dots on');

-- ---- Pupils can't reach anything directly ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.beanstalk_progress $$, '42501', null, 'a pupil cannot read anyone''s beanstalk');
select throws_ok($$ select * from public.beanstalk_rounds $$, '42501', null, '... or the challenges');
select throws_ok($$ select public.beanstalk_load(auth.uid()) $$, '42501', null, '... or load through the server functions');
select throws_ok($$ select public.beanstalk_start(auth.uid(), 5) $$, '42501', null, '... or start their own challenge');
select throws_ok($$ select public.beanstalk_finish(auth.uid(), 5, 1, 29, '2026-11-04', '[]', 0) $$, '42501', null, '... or finish one with any day count');
select throws_ok($$ select public.beanstalk_finish(auth.uid(), 5, 1, 29, '2026-11-04', '[]', 0, 0::smallint, 0::smallint) $$, '42501', null, '... or finish one with their own dots help');
select throws_ok($$ select public.teacher_set_beanstalk(true) $$, null, null, 'a pupil cannot switch the game on');

-- ---- The teacher's switch and dots ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select lives_ok($$ select public.teacher_set_beanstalk(enabled => true) $$, 'a teacher can switch it on');
select lives_ok($$ select public.teacher_set_beanstalk(dots => false) $$, '... and turn the dots off');
select throws_ok($$ select public.teacher_set_beanstalk() $$, '22023', null, 'a setting must be given');
select pg_temp.reset();
select is((select beanstalk_enabled from public.app_settings where id = public.settings_id_of(pg_temp.id('0e'))), true, '... and the switch stays on');
select is((select beanstalk_dots from public.app_settings where id = public.settings_id_of(pg_temp.id('0e'))), false, '... with the dots off');

-- ---- A beanstalk and a challenge ----
select pg_temp.act_as_server();
select is(public.beanstalk_load(pg_temp.id('0a')), null, 'a new pupil has no beanstalk yet');
select throws_ok($$ select public.beanstalk_load('00000000-0000-0000-0000-000000000099') $$, '22023', null, 'nobody who is not a pupil');
select ok(public.beanstalk_choose(pg_temp.id('0a'), 'jill'), 'a pupil chooses Jill');
select throws_ok($$ select public.beanstalk_choose(pg_temp.id('0a'), 'giant') $$, '22023', null, '... and only Jack or Jill');
select ok(public.beanstalk_start(pg_temp.id('0a'), 777), 'a challenge starts');
select ok(not public.beanstalk_start(pg_temp.id('0a'), 777), 'a seed is used once per pupil');
select is(public.beanstalk_round(pg_temp.id('0b'), 777), null, 'another pupil''s challenge is not theirs');

-- Finishing: once, together with the progress, and never more than one day at a time.
select ok(not public.beanstalk_finish(pg_temp.id('0a'), 777, 1, 2, '2026-11-04', '[{"a":0,"b":1,"ms":900}]', 0), 'two days at once is refused');
select ok(not public.beanstalk_finish(pg_temp.id('0a'), 777, 5, 1, '2026-11-04', '[{"a":0,"b":1,"ms":900}]', 0), '... and so is an old version');
select ok(public.beanstalk_finish(pg_temp.id('0a'), 777, 1, 1, '2026-11-04', '[{"a":0,"b":1,"ms":900}]', 1), 'the challenge finishes');
select ok(not public.beanstalk_finish(pg_temp.id('0a'), 777, 2, 2, '2026-11-05', '[{"a":0,"b":1,"ms":900}]', 1), '... once');
select is(public.beanstalk_load(pg_temp.id('0a')), '{"child": "jill", "daysDone": 1, "lastLeafDay": "2026-11-04", "version": 2, "help": 0, "goodInRow": 0}'::jsonb,
  'the beanstalk is saved, a new one with full dots (help 0) and no good days in a row');

-- ---- The dots follow the child (maths review R6): help and good_in_row are saved with the finish ----
select ok(public.beanstalk_start(pg_temp.id('0a'), 778), 'a second day''s challenge starts');
select ok(public.beanstalk_finish(pg_temp.id('0a'), 778, 2, 2, '2026-11-05', '[{"a":0,"b":1,"ms":900}]', 0, 1::smallint, 1::smallint),
  'it finishes with the child''s dots (small) and one good day in a row');
select is(public.beanstalk_load(pg_temp.id('0a')), '{"child": "jill", "daysDone": 2, "lastLeafDay": "2026-11-05", "version": 3, "help": 1, "goodInRow": 1}'::jsonb,
  '... and load gives them back');
select public.beanstalk_start(pg_temp.id('0a'), 779);
select ok(public.beanstalk_finish(pg_temp.id('0a'), 779, 3, 2, '2026-11-05', '[{"a":0,"b":1,"ms":900}]', 0),
  'a finish sent without them (the function deployed before this migration) still saves');
select is((select help::text || ',' || good_in_row::text from public.beanstalk_progress where player = pg_temp.id('0a')), '1,1',
  '... and leaves the dots as they were');
select public.beanstalk_start(pg_temp.id('0a'), 780);
select throws_ok($$ select public.beanstalk_finish(pg_temp.id('0a'), 780, 4, 3, '2026-11-06', '[]', 0, 3::smallint, 0::smallint) $$, '22023', null,
  'dots help can only be 0, 1 or 2');
select is((select array_agg(least(2, (d % 30) / 10) order by d) from unnest(array[0, 9, 10, 19, 20, 29, 30, 45, 59]) d), array[0, 0, 1, 1, 2, 2, 0, 1, 2],
  'the backfill puts an existing pupil where the calendar had them: full for days 0-9 of a beanstalk, small for 10-19, none for 20-29');

-- ---- In the hub: registered, one achievement per Golden Egg, no points ----
select ok(exists (select 1 from public.hub_games where id = 'beanstalk' and switch_column = 'beanstalk_enabled' and counts_fn is not null
  and rules_fn is not null and players_fn is not null and season_fn is null and last_played_fn is not null and keep_achievements),
  'Kiwi''s Beanstalk is registered with its hooks, with nothing for New Season to clear');
select is((select count(*)::integer from public.achievement_types where game = 'beanstalk'), 6, 'with six achievements, one for each friend''s egg');
select is(public.beanstalk_counts(pg_temp.id('0a')), '{"beanstalk_eggs": 0}'::jsonb, 'no egg after one day');
update public.beanstalk_progress set days_done = 30 where player = pg_temp.id('0a');
select is(public.beanstalk_counts(pg_temp.id('0a')), '{"beanstalk_eggs": 1}'::jsonb, 'the first Golden Egg after thirty days');
select public.game_progress_changed(pg_temp.id('0a'), 'beanstalk');
select ok(exists (select 1 from public.achievements where player = pg_temp.id('0a') and achievement = 'beanstalk-kiwi'), '... and Kiwi''s achievement with it');
select ok(not exists (select 1 from public.achievements where player = pg_temp.id('0a') and achievement = 'beanstalk-tui'), '... not Tūī''s yet');
select pg_temp.reset();
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.teacher_beanstalk_student(pg_temp.id('0b')) $$, null, null, 'a pupil cannot read a classmate''s beanstalk');
select pg_temp.reset();

select * from finish();
rollback;
