-- Circuit Racer (migrations 20261122001300_circuit.sql, 20261123000100_circuit_maths.sql, 20261123000200_circuit_worlds.sql and
-- 20261123000400_circuit_racers.sql, id circuit): progress, runs, the switch, the hub row, the 5 finished roads a day, the maths
-- (the switch and the kept questions), worlds opening at 4 of 6, hard finishes and each pupil's racer. Pupils can't read or change any of it directly; the server
-- function does everything.
-- Run on a throw-away copy: scripts/scratch-db.sh circuit, then scripts/scratch-test.sh circuit supabase/tests/database/circuit.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(47);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000e';
select set_config('test.cls', (select default_class::text from public.schools where id = 1), true);
insert into public.class_teachers (class_id, teacher_id) values (current_setting('test.cls')::uuid, '00000000-0000-0000-0000-00000000000e') on conflict do nothing;

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
-- One finish: road, the road before it, seed, steps, medal, unlimited, hard.
create function pg_temp.finish(who text, road text, before_road text, seed text, steps integer, medal text, unlimited boolean default false,
  hard boolean default false)
returns text language sql as $$
  select public.record_circuit_finish(pg_temp.id(who), road, case when before_road is null then null else array[before_road] end,
    case when before_road is null then 0 else 1 end, seed, steps, medal, true, false, '0.0.4', unlimited, hard) ->> 'status'
$$;
-- A world's first road: needs 4 of the world before's 6 roads.
create function pg_temp.world_finish(who text, road text, seed text) returns text language sql as $$
  select public.record_circuit_finish(pg_temp.id(who), road,
    array['power-on', 'clock-speed', 'first-charge', 'data-bus', 'bridge-chips', 'kernel-run'], 4, seed, 900, 'bronze', true, false, '0.0.4', true, false)
    ->> 'status'
$$;

-- ---- On for every class, and in the hub's list ----
select is((select bool_and(circuit_enabled) from public.app_settings), true, 'the game is on everywhere (the code switch holds it back)');
select ok(exists (select 1 from public.hub_games where id = 'circuit' and switch_column = 'circuit_enabled' and last_played_fn is not null),
  'it is in hub_games with its switch and last played');

-- ---- Pupils can't reach anything directly ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.circuit_progress $$, '42501', null, 'a pupil cannot read anyone''s progress');
select throws_ok($$ select * from public.circuit_runs $$, '42501', null, '... or the runs');
select throws_ok($$ select public.circuit_load(auth.uid()) $$, '42501', null, '... or load through the server function');
select throws_ok($$ select public.record_circuit_finish(auth.uid(), 'power-on', null, 0, 'c1-x', 1, 'gold', true, true, '', true, false) $$, '42501', null,
  '... or save a finish with any time');
select throws_ok($$ select public.teacher_set_circuit(false) $$, null, null, 'a pupil cannot switch the game off');
select throws_ok($$ select * from public.circuit_questions $$, '42501', null, 'a pupil cannot read the kept questions');
select throws_ok($$ select public.circuit_load_questions(auth.uid(), 'c1-0000000000-x') $$, '42501', null, '... or load them');
select throws_ok($$ select public.circuit_claim_answer(auth.uid(), 'c1-0000000000-x', 0, 1, true) $$, '42501', null, '... or mark an answer');
select throws_ok($$ select public.teacher_set_circuit_maths('off') $$, null, null, '... or switch the maths off');
select throws_ok($$ select public.circuit_set_racer(auth.uid(), 'quark') $$, '42501', null, '... or save a racer');
select pg_temp.reset();
set local role anon;
select throws_ok($$ select * from public.circuit_progress $$, '42501', null, 'signed out: no progress');
select throws_ok($$ select public.circuit_load('00000000-0000-0000-0000-00000000000a') $$, '42501', null, '... and no server functions');
select throws_ok($$ select * from public.circuit_questions $$, '42501', null, '... and no questions');
reset role;

-- ---- The teacher's switch and Unlimited today ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select lives_ok($$ select public.teacher_set_circuit(false, current_setting('test.cls')::uuid) $$, 'a teacher can switch it off for the class');
select throws_ok($$ select public.teacher_set_circuit(null, current_setting('test.cls')::uuid) $$, '22023', null, 'a setting must be given');
select lives_ok($$ select public.teacher_set_unlimited_today('circuit', true, current_setting('test.cls')::uuid) $$, 'Unlimited today takes circuit');
select lives_ok($$ select public.teacher_set_circuit_maths('choose', current_setting('test.cls')::uuid) $$, 'a teacher can set the maths to pupils choose');
select throws_ok($$ select public.teacher_set_circuit_maths('sometimes', current_setting('test.cls')::uuid) $$, '22023', null, '... but not to anything else');
select pg_temp.reset();
select is((select circuit_enabled from public.app_settings where id = public.settings_id_of(pg_temp.id('0e'))), false, '... the switch stays off');
select ok((select unlimited_days ? 'circuit' from public.app_settings where id = public.settings_id_of(pg_temp.id('0e'))), '... and the class has Unlimited today');
select is((select circuit_maths from public.app_settings where id = public.settings_id_of(pg_temp.id('0e'))), 'choose', '... and pupils choose the maths');
select is((select count(*)::integer from public.app_settings where circuit_maths <> 'on' and id <> public.settings_id_of(pg_temp.id('0e'))), 0,
  'the maths is on everywhere else to start');

-- ---- Finishes: roads in order, a seed once, the best kept, 5 a day ----
select pg_temp.act_as_server();
select is(public.circuit_load(pg_temp.id('0a')), '{"roads": {}, "today": 0}'::jsonb, 'a new pupil has no roads');
select throws_ok($$ select public.circuit_load('00000000-0000-0000-0000-000000000099') $$, '22023', null, 'nobody who is not a pupil');
select is(pg_temp.finish('0a', 'clock-speed', 'power-on', 's0', 700, 'bronze'), 'locked', 'road 2 is locked until road 1 is finished');
select is(pg_temp.finish('0a', 'power-on', null, 's1', 700, 'bronze'), 'best', 'road 1 is finished');
select is(pg_temp.finish('0a', 'power-on', null, 's1', 500, 'gold'), 'duplicate', 'a seed counts once');
select is(pg_temp.finish('0a', 'power-on', null, 's2', 520, 'gold'), 'best', 'a faster time is the best');
select is(pg_temp.finish('0a', 'power-on', null, 's3', 600, 'silver'), 'saved', 'a slower one is saved, not best');
select is(public.circuit_load(pg_temp.id('0a')) -> 'roads' -> 'power-on',
  '{"best": 520, "medal": "gold", "clean": true, "charged": false, "finishes": 3, "hardFinishes": 0, "hardBest": null}'::jsonb,
  'the best time and medal are kept');
select is(pg_temp.finish('0a', 'clock-speed', 'power-on', 's4', 800, 'bronze') || pg_temp.finish('0a', 'clock-speed', 'power-on', 's5', 800, 'bronze'),
  'bestsaved', 'road 2 opens; that is 5 finishes today');
select is(pg_temp.finish('0a', 'clock-speed', 'power-on', 's6', 800, 'bronze'), 'done-today', 'the 6th finish today is refused');
select is(pg_temp.finish('0a', 'clock-speed', 'power-on', 's7', 800, 'bronze', true), 'saved', '... unless the class has Unlimited today');
-- ---- Worlds open at 4 of the 6 roads before; hard finishes are kept apart ----
select is(pg_temp.world_finish('0a', 'hot-wire', 's8'), 'locked', 'the Graphics Card is locked with 2 Motherboard roads finished');
select is(pg_temp.finish('0a', 'first-charge', 'clock-speed', 's9', 800, 'bronze', true) || pg_temp.finish('0a', 'data-bus', 'first-charge', 's10', 800, 'bronze', true)
  || pg_temp.world_finish('0a', 'hot-wire', 's11'), 'bestbestbest', '... and opens at 4');
select is(pg_temp.finish('0a', 'power-on', null, 's12', 610, 'silver', true, true), 'saved', 'a hard finish is a finish');
select is((public.circuit_load(pg_temp.id('0a')) -> 'roads' -> 'power-on') - 'best' - 'medal' - 'clean' - 'charged',
  '{"finishes": 4, "hardFinishes": 1, "hardBest": 610}'::jsonb, '... kept apart with its own best time');
-- ---- Each pupil's racer ----
select is(public.circuit_set_racer(pg_temp.id('0a'), 'pixel'), true, 'the server saves a racer');
select is(public.circuit_load(pg_temp.id('0a')) ->> 'racer', 'pixel', '... and load gives it back');
-- ---- The kept questions: a slot is marked once ----
select lives_ok($$ select public.circuit_store_questions(pg_temp.id('0a'), 'c1-0000000001-q', '[{"parts":["2","+","2","=","?"],"answer":4}]') $$,
  'the server keeps a go''s questions');
select is(public.circuit_claim_answer(pg_temp.id('0a'), 'c1-0000000001-q', 0, 4, true), true, 'an answer is marked');
select is(public.circuit_claim_answer(pg_temp.id('0a'), 'c1-0000000001-q', 0, 5, false), false, '... once');
select is(public.circuit_load_questions(pg_temp.id('0a'), 'c1-0000000001-q') -> 'answered', '{"0": {"right": true, "value": 4}}'::jsonb, '... and the first mark stays');
select pg_temp.reset();
select is((select count(*)::integer from public.circuit_runs where player = pg_temp.id('0a') and extra), 5, 'the extra finishes are marked extra');
select is((select sum(points_raw)::integer from public.game_points where player = pg_temp.id('0a') and game = 'circuit'), 3 * 5 + 2,
  'points for the 5 normal finishes (3 each) and the first gold (2 more), none for the extra one');

select * from finish();
rollback;
