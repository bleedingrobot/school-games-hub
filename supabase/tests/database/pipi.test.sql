-- Pipi's Hidden Shells (migration 20261104001400): progress, challenges, the switch and the help setting, and the hub
-- hooks with one achievement per Golden Pearl.
-- Pupils can't read or change any of it directly; the server function does everything.
-- Run on a throw-away copy: scripts/scratch-db.sh pipi, then scripts/scratch-test.sh pipi supabase/tests/database/pipi.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

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
-- Ten goes, as the server keeps them (the database only checks there are ten).
create function pg_temp.goes() returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('key', 'part' || (n % 3 + 3) || ':' || (n % 3), 'kind', 'hiding')) from generate_series(1, 10) n
$$;

-- ---- On to start for every class, with the help on ----
select is((select bool_and(pipi_enabled) from public.app_settings), true, 'the game starts switched on everywhere');
select is((select bool_and(pipi_help) from public.app_settings), true, '... with the help in the sand on');

-- ---- Pupils can't reach anything directly ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.pipi_progress $$, '42501', null, 'a pupil cannot read anyone''s beach');
select throws_ok($$ select * from public.pipi_rounds $$, '42501', null, '... or the challenges');
select throws_ok($$ select public.pipi_load(auth.uid()) $$, '42501', null, '... or load through the server functions');
select throws_ok($$ select public.pipi_start(auth.uid(), 5, 1::smallint, 'bronze', pg_temp.goes()) $$, '42501', null, '... or start their own challenge');
select throws_ok($$ select public.pipi_finish(auth.uid(), 5, 1, 29, '2026-11-04', 3::smallint, 1, '[]', 0) $$, '42501', null, '... or finish one with any day count');
select throws_ok($$ select public.teacher_set_pipi(true) $$, null, null, 'a pupil cannot switch the game on');

-- ---- The teacher's switch and the help ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select lives_ok($$ select public.teacher_set_pipi(enabled => true, target_class => current_setting('test.cls')::uuid) $$, 'a teacher can switch it on');
select lives_ok($$ select public.teacher_set_pipi(help => false, target_class => current_setting('test.cls')::uuid) $$, '... and turn the help off');
select throws_ok($$ select public.teacher_set_pipi(target_class => current_setting('test.cls')::uuid) $$, '22023', null, 'a setting must be given');
select pg_temp.reset();
select is((select pipi_enabled from public.app_settings where id = public.settings_id_of(pg_temp.id('0e'))), true, '... and the switch stays on');
select is((select pipi_help from public.app_settings where id = public.settings_id_of(pg_temp.id('0e'))), false, '... with the help off');

-- ---- A beach and a challenge ----
select pg_temp.act_as_server();
select is(public.pipi_load(pg_temp.id('0a')), null, 'a new pupil has no beach yet');
select throws_ok($$ select public.pipi_load('00000000-0000-0000-0000-000000000099') $$, '22023', null, 'nobody who is not a pupil');
select ok(public.pipi_start(pg_temp.id('0a'), 777, 1::smallint, 'bronze', pg_temp.goes()), 'a challenge starts');
select is(public.pipi_load(pg_temp.id('0a')), '{"daysDone": 0, "lastShellDay": null, "reached": 1, "played": 0, "version": 1}'::jsonb, '... making the pupil''s beach');
select ok(not public.pipi_start(pg_temp.id('0a'), 777, 1::smallint, 'bronze', pg_temp.goes()), 'a seed is used once per pupil');
select throws_ok($$ select public.pipi_start(pg_temp.id('0a'), 778, 1::smallint, 'bronze', '[]') $$, '23514', null, 'a challenge has ten goes');
select is(public.pipi_round(pg_temp.id('0b'), 777), null, 'another pupil''s challenge is not theirs');
select is(public.pipi_round(pg_temp.id('0a'), 777) -> 'round' -> 'goes', pg_temp.goes(), 'the goes are kept as the server made them');

-- Finishing: once, together with the progress, never more than one day at a time, and never back a level.
select ok(not public.pipi_finish(pg_temp.id('0a'), 777, 1, 2, '2026-11-04', 1::smallint, 1, '[{"pick":1,"ms":900}]', 0), 'two days at once is refused');
select ok(not public.pipi_finish(pg_temp.id('0a'), 777, 5, 1, '2026-11-04', 1::smallint, 1, '[{"pick":1,"ms":900}]', 0), '... and so is an old version');
select ok(public.pipi_finish(pg_temp.id('0a'), 777, 1, 1, '2026-11-04', 2::smallint, 1, '[{"pick":1,"ms":900}]', 1), 'the challenge finishes, moving up a level');
select ok(not public.pipi_finish(pg_temp.id('0a'), 777, 2, 2, '2026-11-05', 2::smallint, 2, '[{"pick":1,"ms":900}]', 1), '... once');
select is(public.pipi_load(pg_temp.id('0a')), '{"daysDone": 1, "lastShellDay": "2026-11-04", "reached": 2, "played": 1, "version": 2}'::jsonb,
  'the beach is saved');
select pg_temp.reset();

-- ---- In the hub: registered, one achievement per Golden Pearl, no points ----
select ok(exists (select 1 from public.hub_games where id = 'pipi' and switch_column = 'pipi_enabled' and counts_fn is not null
  and rules_fn is not null and players_fn is not null and season_fn is null and last_played_fn is not null and keep_achievements),
  'Pipi''s Hidden Shells is registered with its hooks, with nothing for New Season to clear');
select is((select count(*)::integer from public.achievement_types where game = 'pipi'), 6, 'with six achievements, one for each friend''s pearl');
select is(public.pipi_counts(pg_temp.id('0a')), '{"pipi_pearls": 0}'::jsonb, 'no pearl after one day');
update public.pipi_progress set days_done = 30 where player = pg_temp.id('0a');
select is(public.pipi_counts(pg_temp.id('0a')), '{"pipi_pearls": 1}'::jsonb, 'the first Golden Pearl after thirty days');
select public.game_progress_changed(pg_temp.id('0a'), 'pipi');
select ok(exists (select 1 from public.achievements where player = pg_temp.id('0a') and achievement = 'pipi-pipi'), '... and Pipi''s achievement with it');
select ok(not exists (select 1 from public.achievements where player = pg_temp.id('0a') and achievement = 'pipi-korora'), '... not Kororā''s yet');
select ok(public.pipi_last_played(pg_temp.id('0a')) is not null and public.pipi_last_played(pg_temp.id('0b')) is null, 'when a pupil last played comes from their beach');
select pg_temp.reset();
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.teacher_pipi_student(pg_temp.id('0b')) $$, null, null, 'a pupil cannot read a classmate''s beach');
select pg_temp.reset();

select * from finish();
rollback;
