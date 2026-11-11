-- Toon Flap (migration 20261111000100, id toonflap): progress, runs, the switches and the hub hooks.
-- Pupils can't read or change any of it directly; the server function does everything.
-- Run on a throw-away copy: scripts/scratch-db.sh toonflap, then scripts/scratch-test.sh toonflap supabase/tests/database/toonflap.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

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
create function pg_temp.progress(finishes integer, medal text) returns jsonb language sql as $$
  select jsonb_build_object('levels', jsonb_build_object('garden', jsonb_build_object('finishes', finishes, 'best', 30, 'bestPlain', null, 'medal', medal)),
    'checksRight', 1, 'streak', 1, 'cleanFlights', 1, 'rightGaps', 0, 'potions', 0, 'potionsEarned', 0)
$$;

-- ---- On for every class, with maths and read time on ----
select is((select bool_and(toonflap_enabled) from public.app_settings), true, 'the game is on everywhere (switched on for every class, 20261111000200)');
select is((select bool_and(toonflap_maths = 'on' and toonflap_read_time) from public.app_settings), true, '... with maths and read time on');

-- ---- Pupils can't reach anything directly ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.toonflap_progress $$, '42501', null, 'a pupil cannot read anyone''s progress');
select throws_ok($$ select * from public.toonflap_runs $$, '42501', null, '... or the runs (with their answers)');
select throws_ok($$ select public.toonflap_run(auth.uid(), '123456') $$, '42501', null, '... or read a run through the server functions');
select throws_ok($$ select public.toonflap_finish(auth.uid(), '123456', 0, '{}', '', 1, 'gold', 0, 0, 0, false) $$, '42501', null, '... or finish one with any time');
select throws_ok($$ select public.toonflap_claim(auth.uid(), '123456', 0, true) $$, '42501', null, '... or mark their own answer');
select throws_ok($$ select public.teacher_set_toonflap(true) $$, null, null, 'a pupil cannot switch the game on');

-- ---- The teacher's switches ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select lives_ok($$ select public.teacher_set_toonflap(enabled => true, read_time => false) $$, 'a teacher can switch it on and read time off');
select throws_ok($$ select public.teacher_set_toonflap() $$, '22023', null, 'a setting must be given');
select throws_ok($$ select public.teacher_set_toonflap(maths => 'lots') $$, '22023', null, '... and a maths setting must be one of three');
select pg_temp.reset();
select is((select toonflap_enabled and not toonflap_read_time from public.app_settings where id = public.settings_id_of(pg_temp.id('0e'))), true, '... and the settings stay');

-- ---- A run: started once, each check marked once, finished once with the progress ----
select pg_temp.act_as_server();
select is(public.toonflap_load(pg_temp.id('0a')), null, 'a new pupil has no progress yet');
select throws_ok($$ select public.toonflap_load('00000000-0000-0000-0000-000000000099') $$, '22023', null, 'nobody who is not a pupil');
select ok(public.toonflap_start(pg_temp.id('0a'), '123456', 'garden', false, true, '[{"answer": 42}]', '[]'), 'a run starts');
select ok(not public.toonflap_start(pg_temp.id('0a'), '123456', 'garden', false, true, '[]', '[]'), 'a seed is used once per pupil');
select is(public.toonflap_run(pg_temp.id('0b'), '123456'), null, 'another pupil''s run is not theirs');
select is(public.toonflap_run(pg_temp.id('0a'), '123456') -> 'questions', '[{"answer": 42}]'::jsonb, 'the questions are kept as the server made them');
select ok(public.toonflap_claim(pg_temp.id('0a'), '123456', 0, true), 'a check is marked');
select ok(not public.toonflap_claim(pg_temp.id('0a'), '123456', 0, false), '... once');
select is(public.toonflap_runs_today(pg_temp.id('0a'), (now() at time zone 'Pacific/Auckland')::date), '{"started": 1, "finished": 0}'::jsonb, 'runs today are counted');
select ok(public.toonflap_finish(pg_temp.id('0a'), '123456', 0, pg_temp.progress(1, 'gold'), '1,2,3', 27.5, 'gold', 0, 1, 0, false), 'the run finishes, making the pupil''s progress');
select ok(not public.toonflap_finish(pg_temp.id('0a'), '123456', 1, pg_temp.progress(2, 'gold'), '1,2,3', 27.5, 'gold', 0, 1, 0, false), '... once');
select ok(not public.toonflap_claim(pg_temp.id('0a'), '123456', 1, true), 'a finished run''s checks can''t be marked');
select ok(public.toonflap_start(pg_temp.id('0a'), '654321', 'garden', false, true, '[]', '[]'), 'another run starts');
select ok(not public.toonflap_finish(pg_temp.id('0a'), '654321', 7, pg_temp.progress(2, 'gold'), '1', 30, 'silver', 1, 0, 0, false), 'an old version is refused');
select ok(public.toonflap_save_picks(pg_temp.id('0a'), '{"flyer": "puppy-plane", "trail": null}'), 'a flyer is picked');
select is(public.toonflap_load(pg_temp.id('0a')) -> 'version', '1'::jsonb, '... without moving the version on');
select pg_temp.reset();

-- ---- In the hub ----
select ok(exists (select 1 from public.hub_games where id = 'toonflap' and switch_column = 'toonflap_enabled' and counts_fn is not null
  and rules_fn is not null and players_fn is not null and season_fn is null and last_played_fn is not null and keep_achievements),
  'Toon Flap is registered with its hooks, with nothing for New Season to clear');
select is(public.toonflap_counts(pg_temp.id('0a')),
  '{"toonflap_levels": 1, "toonflap_clean": 1, "toonflap_gaps": 0, "toonflap_golds": 1, "toonflap_flyers": 0}'::jsonb,
  'one level finished, one clean flight, one gold, no flyer yet');
select public.game_progress_changed(pg_temp.id('0a'), 'toonflap');
select ok(exists (select 1 from public.achievements where player = pg_temp.id('0a') and achievement = 'toonflap-first'), '... and the First Flight achievement with it');

select * from finish();
rollback;
