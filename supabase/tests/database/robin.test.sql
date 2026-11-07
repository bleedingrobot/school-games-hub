-- Robin’s Berry Basket (migration 20261108000100, short id robin): progress, challenges, the switch and the help setting, and
-- the hub hooks with achievements for days, steps and Golden Berry Feasts.
-- Pupils can't read or change any of it directly; the server function does everything.
-- Run on a throw-away copy: scripts/scratch-db.sh robin, then scripts/scratch-test.sh robin supabase/tests/database/robin.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

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
-- A round, as the server keeps it (the database only checks it is an object with the seed, step and level).
create function pg_temp.round(seed integer, step integer, level integer) returns jsonb language sql as $$
  select jsonb_build_object('seed', seed, 'step', step, 'level', level, 'goes', '[]'::jsonb)
$$;

-- ---- On to start for every class, with the help fading ----
select is((select bool_and(robin_enabled) from public.app_settings), true, 'the game starts switched on everywhere');
select is((select bool_and(robin_help = 'fade') from public.app_settings), true, '... with the help fading');

-- ---- Pupils can't reach anything directly ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.robin_progress $$, '42501', null, 'a pupil cannot read anyone''s baskets');
select throws_ok($$ select * from public.robin_rounds $$, '42501', null, '... or the challenges');
select throws_ok($$ select public.robin_load(auth.uid()) $$, '42501', null, '... or load through the server functions');
select throws_ok($$ select public.robin_start(auth.uid(), 5, pg_temp.round(5, 1, 5)) $$, '42501', null, '... or start their own challenge');
select throws_ok($$ select public.robin_finish(auth.uid(), 5, 1, 29, '2026-11-04', 1::smallint, 5::smallint, 0, 0, '[]', 0, 10, '[]') $$, '42501', null, '... or finish one with any day count');
select throws_ok($$ select public.teacher_set_robin(true) $$, null, null, 'a pupil cannot switch the game on');

-- ---- The teacher's switch and help setting ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select lives_ok($$ select public.teacher_set_robin(enabled => true) $$, 'a teacher can switch it on');
select lives_ok($$ select public.teacher_set_robin(help => 'always') $$, '... and keep the help on');
select throws_ok($$ select public.teacher_set_robin() $$, '22023', null, 'a setting must be given');
select throws_ok($$ select public.teacher_set_robin(help => 'lots') $$, '22023', null, '... and a help setting must be one of three');
select pg_temp.reset();
select is((select robin_enabled from public.app_settings where id = public.settings_id_of(pg_temp.id('0e'))), true, '... and the switch stays on');
select is((select robin_help from public.app_settings where id = public.settings_id_of(pg_temp.id('0e'))), 'always', '... with the help always on');

-- ---- A baskets and a challenge ----
select pg_temp.act_as_server();
select is(public.robin_load(pg_temp.id('0a')), null, 'a new pupil has no baskets yet');
select throws_ok($$ select public.robin_load('00000000-0000-0000-0000-000000000099') $$, '22023', null, 'nobody who is not a pupil');
select ok(public.robin_start(pg_temp.id('0a'), 777, pg_temp.round(777, 3, 2)), 'a challenge starts');
select is(public.robin_load(pg_temp.id('0a')),
  '{"daysDone": 0, "lastDay": null, "step": 3, "level": 2, "goodInRow": 0, "goodAtStep": 0, "version": 1}'::jsonb,
  '... making the pupil''s baskets at the round''s step and help level');
select ok(not public.robin_start(pg_temp.id('0a'), 777, pg_temp.round(777, 1, 5)), 'a seed is used once per pupil');
select throws_ok($$ select public.robin_start(pg_temp.id('0a'), 778, pg_temp.round(999, 3, 2)) $$, '22023', null, 'a challenge must carry its own seed');
select is(public.robin_round(pg_temp.id('0b'), 777), null, 'another pupil''s challenge is not theirs');
select is(public.robin_round(pg_temp.id('0a'), 777) -> 'round', pg_temp.round(777, 3, 2), 'the round is kept as the server made it');

-- Finishing: once, together with the progress, never more than one day at a time.
select ok(not public.robin_finish(pg_temp.id('0a'), 777, 1, 2, '2026-11-04', 3::smallint, 2::smallint, 0, 0, '[{"pick":10,"ms":900}]', 0, 10, '[null]'), 'two days at once is refused');
select ok(not public.robin_finish(pg_temp.id('0a'), 777, 5, 1, '2026-11-04', 3::smallint, 2::smallint, 0, 0, '[{"pick":10,"ms":900}]', 0, 10, '[null]'), '... and so is an old version');
select ok(public.robin_finish(pg_temp.id('0a'), 777, 1, 1, '2026-11-04', 3::smallint, 1::smallint, 1, 1, '[{"pick":10,"ms":900}]', 1, 9, '["over"]'), 'the challenge finishes, moving the help on');
select ok(not public.robin_finish(pg_temp.id('0a'), 777, 2, 2, '2026-11-05', 3::smallint, 1::smallint, 2, 2, '[{"pick":10,"ms":900}]', 1, 9, '[]'), '... once');
select is(public.robin_load(pg_temp.id('0a')),
  '{"daysDone": 1, "lastDay": "2026-11-04", "step": 3, "level": 1, "goodInRow": 1, "goodAtStep": 1, "version": 2}'::jsonb,
  'the baskets is saved');
select is((select first_right from public.robin_rounds where player = pg_temp.id('0a') and seed = 777), 9, '... with how many goes were right first time');
select ok(public.robin_start(pg_temp.id('0a'), 779, pg_temp.round(779, 1, 5)), 'another challenge starts, leaving the saved baskets as it is');
select is((select step from public.robin_progress where player = pg_temp.id('0a')), 3::smallint, '... (the step is not reset)');
select pg_temp.reset();

-- ---- In the hub: registered, achievements for days, steps and Golden Berry Feasts, no points ----
select ok(exists (select 1 from public.hub_games where id = 'robin' and switch_column = 'robin_enabled' and counts_fn is not null
  and rules_fn is not null and players_fn is not null and season_fn is null and last_played_fn is not null and keep_achievements),
  'Robin’s Berry Basket is registered with its hooks, with nothing for New Season to clear');
select is((select count(*)::integer from public.achievement_types where game = 'robin'), 5, 'with five achievements');
select is(public.robin_counts(pg_temp.id('0a')), '{"robin_days": 1, "robin_step": 3, "robin_prizes": 0}'::jsonb, 'one finished day, step 3, no Golden Berry Feast yet');
update public.robin_progress set days_done = 30 where player = pg_temp.id('0a');
select is(public.robin_counts(pg_temp.id('0a')), '{"robin_days": 30, "robin_step": 3, "robin_prizes": 1}'::jsonb, 'the first Golden Berry Feast after thirty days');
select public.game_progress_changed(pg_temp.id('0a'), 'robin');
select ok(exists (select 1 from public.achievements where player = pg_temp.id('0a') and achievement = 'robin-first'), '... and the First berries achievement with it');
select ok(exists (select 1 from public.achievements where player = pg_temp.id('0a') and achievement = 'robin-feast'), '... and the Golden Berry Feast achievement at thirty days');
select ok(public.robin_last_played(pg_temp.id('0a')) is not null and public.robin_last_played(pg_temp.id('0b')) is null, 'when a pupil last played comes from their baskets');
select pg_temp.reset();
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.teacher_robin_student(pg_temp.id('0b')) $$, null, null, 'a pupil cannot read a classmate''s baskets');
select pg_temp.reset();

select * from finish();
rollback;
