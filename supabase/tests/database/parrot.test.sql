-- Parrot’s See-saw (migration 20261107000500, short id parrot): progress, challenges, the switch and the help setting, and
-- the hub hooks with achievements for days, steps and Golden Bells.
-- Pupils can't read or change any of it directly; the server function does everything.
-- Run on a throw-away copy: scripts/scratch-db.sh parrot, then scripts/scratch-test.sh parrot supabase/tests/database/parrot.test.sql
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
select is((select bool_and(parrot_enabled) from public.app_settings), true, 'the game starts switched on everywhere');
select is((select bool_and(parrot_help = 'fade') from public.app_settings), true, '... with the help fading');

-- ---- Pupils can't reach anything directly ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.parrot_progress $$, '42501', null, 'a pupil cannot read anyone''s rope');
select throws_ok($$ select * from public.parrot_rounds $$, '42501', null, '... or the challenges');
select throws_ok($$ select public.parrot_load(auth.uid()) $$, '42501', null, '... or load through the server functions');
select throws_ok($$ select public.parrot_start(auth.uid(), 5, pg_temp.round(5, 1, 5)) $$, '42501', null, '... or start their own challenge');
select throws_ok($$ select public.parrot_finish(auth.uid(), 5, 1, 29, '2026-11-04', 1::smallint, 5::smallint, 0, 0, '[]', 0, 10, '[]') $$, '42501', null, '... or finish one with any day count');
select throws_ok($$ select public.teacher_set_parrot(true) $$, null, null, 'a pupil cannot switch the game on');

-- ---- The teacher's switch and help setting ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select lives_ok($$ select public.teacher_set_parrot(enabled => true) $$, 'a teacher can switch it on');
select lives_ok($$ select public.teacher_set_parrot(help => 'always') $$, '... and keep the help on');
select throws_ok($$ select public.teacher_set_parrot() $$, '22023', null, 'a setting must be given');
select throws_ok($$ select public.teacher_set_parrot(help => 'lots') $$, '22023', null, '... and a help setting must be one of three');
select pg_temp.reset();
select is((select parrot_enabled from public.app_settings where id = public.settings_id_of(pg_temp.id('0e'))), true, '... and the switch stays on');
select is((select parrot_help from public.app_settings where id = public.settings_id_of(pg_temp.id('0e'))), 'always', '... with the help always on');

-- ---- A rope and a challenge ----
select pg_temp.act_as_server();
select is(public.parrot_load(pg_temp.id('0a')), null, 'a new pupil has no rope yet');
select throws_ok($$ select public.parrot_load('00000000-0000-0000-0000-000000000099') $$, '22023', null, 'nobody who is not a pupil');
select ok(public.parrot_start(pg_temp.id('0a'), 777, pg_temp.round(777, 3, 2)), 'a challenge starts');
select is(public.parrot_load(pg_temp.id('0a')),
  '{"daysDone": 0, "lastDay": null, "step": 3, "level": 2, "goodInRow": 0, "goodAtStep": 0, "version": 1}'::jsonb,
  '... making the pupil''s rope at the round''s step and help level');
select ok(not public.parrot_start(pg_temp.id('0a'), 777, pg_temp.round(777, 1, 5)), 'a seed is used once per pupil');
select throws_ok($$ select public.parrot_start(pg_temp.id('0a'), 778, pg_temp.round(999, 3, 2)) $$, '22023', null, 'a challenge must carry its own seed');
select is(public.parrot_round(pg_temp.id('0b'), 777), null, 'another pupil''s challenge is not theirs');
select is(public.parrot_round(pg_temp.id('0a'), 777) -> 'round', pg_temp.round(777, 3, 2), 'the round is kept as the server made it');

-- Finishing: once, together with the progress, never more than one day at a time.
select ok(not public.parrot_finish(pg_temp.id('0a'), 777, 1, 2, '2026-11-04', 3::smallint, 2::smallint, 0, 0, '[{"pick":10,"ms":900}]', 0, 10, '[null]'), 'two days at once is refused');
select ok(not public.parrot_finish(pg_temp.id('0a'), 777, 5, 1, '2026-11-04', 3::smallint, 2::smallint, 0, 0, '[{"pick":10,"ms":900}]', 0, 10, '[null]'), '... and so is an old version');
select ok(public.parrot_finish(pg_temp.id('0a'), 777, 1, 1, '2026-11-04', 3::smallint, 1::smallint, 1, 1, '[{"pick":10,"ms":900}]', 1, 9, '["copy"]'), 'the challenge finishes, moving the help on');
select ok(not public.parrot_finish(pg_temp.id('0a'), 777, 2, 2, '2026-11-05', 3::smallint, 1::smallint, 2, 2, '[{"pick":10,"ms":900}]', 1, 9, '[]'), '... once');
select is(public.parrot_load(pg_temp.id('0a')),
  '{"daysDone": 1, "lastDay": "2026-11-04", "step": 3, "level": 1, "goodInRow": 1, "goodAtStep": 1, "version": 2}'::jsonb,
  'the rope is saved');
select is((select first_right from public.parrot_rounds where player = pg_temp.id('0a') and seed = 777), 9, '... with how many goes were right first time');
select ok(public.parrot_start(pg_temp.id('0a'), 779, pg_temp.round(779, 1, 5)), 'another challenge starts, leaving the saved rope as it is');
select is((select step from public.parrot_progress where player = pg_temp.id('0a')), 3::smallint, '... (the step is not reset)');
select pg_temp.reset();

-- ---- In the hub: registered, achievements for days, steps and Golden Bells, no points ----
select ok(exists (select 1 from public.hub_games where id = 'parrot' and switch_column = 'parrot_enabled' and counts_fn is not null
  and rules_fn is not null and players_fn is not null and season_fn is null and last_played_fn is not null and keep_achievements),
  'Parrot’s See-saw is registered with its hooks, with nothing for New Season to clear');
select is((select count(*)::integer from public.achievement_types where game = 'parrot'), 5, 'with five achievements');
select is(public.parrot_counts(pg_temp.id('0a')), '{"parrot_days": 1, "parrot_step": 3, "parrot_prizes": 0}'::jsonb, 'one finished day, step 3, no Golden Bell yet');
update public.parrot_progress set days_done = 30 where player = pg_temp.id('0a');
select is(public.parrot_counts(pg_temp.id('0a')), '{"parrot_days": 30, "parrot_step": 3, "parrot_prizes": 1}'::jsonb, 'the first Golden Bell after thirty days');
select public.game_progress_changed(pg_temp.id('0a'), 'parrot');
select ok(exists (select 1 from public.achievements where player = pg_temp.id('0a') and achievement = 'parrot-first'), '... and the First level achievement with it');
select ok(exists (select 1 from public.achievements where player = pg_temp.id('0a') and achievement = 'parrot-bell'), '... and the Golden Bell achievement at thirty days');
select ok(public.parrot_last_played(pg_temp.id('0a')) is not null and public.parrot_last_played(pg_temp.id('0b')) is null, 'when a pupil last played comes from their rope');
select pg_temp.reset();
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.teacher_parrot_student(pg_temp.id('0b')) $$, null, null, 'a pupil cannot read a classmate''s rope');
select pg_temp.reset();

select * from finish();
rollback;
