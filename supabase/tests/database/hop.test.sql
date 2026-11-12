-- Hop's Glow-worm Pond (migrations 20261104000600 and 20261104000900): progress, challenges, the switch and the step-label
-- setting, and the hub hooks with one achievement per Golden Glow Jar.
-- Pupils can't read or change any of it directly; the server function does everything.
-- Run on a throw-away copy: scripts/scratch-db.sh hop, then scripts/scratch-test.sh hop supabase/tests/database/hop.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

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
-- Ten hops, as the server keeps them (the database only checks there are ten).
create function pg_temp.hops() returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('key', 'skip10:up:' || (n * 10), 'answer', n * 10, 'at', 1)) from generate_series(1, 10) n
$$;

-- ---- On to start for every class, with the step labels on ----
select is((select bool_and(hop_enabled) from public.app_settings), true, 'the game starts switched on everywhere');
select is((select bool_and(hop_labels) from public.app_settings), true, '... with the step labels on');

-- ---- Pupils can't reach anything directly ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.hop_progress $$, '42501', null, 'a pupil cannot read anyone''s pond');
select throws_ok($$ select * from public.hop_rounds $$, '42501', null, '... or the challenges');
select throws_ok($$ select public.hop_load(auth.uid()) $$, '42501', null, '... or load through the server functions');
select throws_ok($$ select public.hop_start(auth.uid(), 5, 10::smallint, false, pg_temp.hops()) $$, '42501', null, '... or start their own challenge');
select throws_ok($$ select public.hop_finish(auth.uid(), 5, 1, 29, '2026-11-04', 2::smallint, '[]', 0) $$, '42501', null, '... or finish one with any day count');
select throws_ok($$ select public.teacher_set_hop(true) $$, null, null, 'a pupil cannot switch the game on');

-- ---- The teacher's switch and step labels ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select lives_ok($$ select public.teacher_set_hop(enabled => true, target_class => current_setting('test.cls')::uuid) $$, 'a teacher can switch it on');
select lives_ok($$ select public.teacher_set_hop(labels => false, target_class => current_setting('test.cls')::uuid) $$, '... and turn the step labels off');
select throws_ok($$ select public.teacher_set_hop(target_class => current_setting('test.cls')::uuid) $$, '22023', null, 'a setting must be given');
select pg_temp.reset();
select is((select hop_enabled from public.app_settings where id = public.settings_id_of(pg_temp.id('0e'))), true, '... and the switch stays on');
select is((select hop_labels from public.app_settings where id = public.settings_id_of(pg_temp.id('0e'))), false, '... with the labels off');

-- ---- A pond and a challenge ----
select pg_temp.act_as_server();
select is(public.hop_load(pg_temp.id('0a')), null, 'a new pupil has no pond yet');
select throws_ok($$ select public.hop_load('00000000-0000-0000-0000-000000000099') $$, '22023', null, 'nobody who is not a pupil');
select ok(public.hop_start(pg_temp.id('0a'), 777, 10::smallint, false, pg_temp.hops()), 'a challenge starts');
select is(public.hop_load(pg_temp.id('0a')), '{"daysDone": 0, "lastPadDay": null, "reached": 10, "version": 1}'::jsonb, '... making the pupil''s pond');
select ok(not public.hop_start(pg_temp.id('0a'), 777, 10::smallint, false, pg_temp.hops()), 'a seed is used once per pupil');
select throws_ok($$ select public.hop_start(pg_temp.id('0a'), 778, 10::smallint, false, '[]') $$, '23514', null, 'a challenge has ten hops');
select is(public.hop_round(pg_temp.id('0b'), 777), null, 'another pupil''s challenge is not theirs');
select is(public.hop_round(pg_temp.id('0a'), 777) -> 'round' -> 'hops', pg_temp.hops(), 'the hops are kept as the server made them');

-- Finishing: once, together with the progress, never more than one day at a time, and never back a step.
select ok(not public.hop_finish(pg_temp.id('0a'), 777, 1, 2, '2026-11-04', 10::smallint, '[{"pick":10,"ms":900}]', 0), 'two days at once is refused');
select ok(not public.hop_finish(pg_temp.id('0a'), 777, 5, 1, '2026-11-04', 10::smallint, '[{"pick":10,"ms":900}]', 0), '... and so is an old version');
select ok(public.hop_finish(pg_temp.id('0a'), 777, 1, 1, '2026-11-04', 5::smallint, '[{"pick":10,"ms":900}]', 1), 'the challenge finishes, moving on to 5s');
select ok(not public.hop_finish(pg_temp.id('0a'), 777, 2, 2, '2026-11-05', 5::smallint, '[{"pick":10,"ms":900}]', 1), '... once');
select is(public.hop_load(pg_temp.id('0a')), '{"daysDone": 1, "lastPadDay": "2026-11-04", "reached": 5, "version": 2}'::jsonb,
  'the pond is saved');
-- R8's longer ladder: threes, fours and tens past 100 follow twos (saved as 3, 4 and 200), and the order still only goes on.
select ok(public.hop_start(pg_temp.id('0a'), 779, 3::smallint, false, pg_temp.hops()), 'a challenge in threes starts');
select ok(public.hop_finish(pg_temp.id('0a'), 779, 2, 2, '2026-11-05', 200::smallint, '[{"pick":10,"ms":900}]', 0), '... and finishing it can reach tens past 100');
select ok(public.hop_start(pg_temp.id('0a'), 780, 200::smallint, false, pg_temp.hops())
  and not public.hop_finish(pg_temp.id('0a'), 780, 3, 3, '2026-11-06', 4::smallint, '[{"pick":10,"ms":900}]', 0), '... but never goes back to fours');
select pg_temp.reset();

-- ---- In the hub: registered, one achievement per Golden Glow Jar, no points ----
select ok(exists (select 1 from public.hub_games where id = 'hop' and switch_column = 'hop_enabled' and counts_fn is not null
  and rules_fn is not null and players_fn is not null and season_fn is null and last_played_fn is not null and keep_achievements),
  'Hop''s Glow-worm Pond is registered with its hooks, with nothing for New Season to clear');
select is((select count(*)::integer from public.achievement_types where game = 'hop'), 6, 'with six achievements, one for each friend''s jar');
select is(public.hop_counts(pg_temp.id('0a')), '{"hop_jars": 0}'::jsonb, 'no jar after one day');
update public.hop_progress set days_done = 30 where player = pg_temp.id('0a');
select is(public.hop_counts(pg_temp.id('0a')), '{"hop_jars": 1}'::jsonb, 'the first Golden Glow Jar after thirty days');
select public.game_progress_changed(pg_temp.id('0a'), 'hop');
select ok(exists (select 1 from public.achievements where player = pg_temp.id('0a') and achievement = 'hop-hop'), '... and Hop''s achievement with it');
select ok(not exists (select 1 from public.achievements where player = pg_temp.id('0a') and achievement = 'hop-gecko'), '... not Gecko''s yet');
select ok(public.hop_last_played(pg_temp.id('0a')) is not null and public.hop_last_played(pg_temp.id('0b')) is null, 'when a pupil last played comes from their pond');
select pg_temp.reset();
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.teacher_hop_student(pg_temp.id('0b')) $$, null, null, 'a pupil cannot read a classmate''s pond');
select pg_temp.reset();

select * from finish();
rollback;
