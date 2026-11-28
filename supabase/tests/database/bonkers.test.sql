-- Bonkers Quest (migration 20261127191027, id bonkers): progress, adventures, the switch and the hub hooks.
-- Pupils can't read or change any of it directly; the server function does everything.
-- Run on a throw-away copy: scripts/scratch-db.sh bonkers, then scripts/scratch-test.sh bonkers supabase/tests/database/bonkers.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

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
create function pg_temp.progress(level integer, won integer) returns jsonb language sql as $$
  select jsonb_build_object('hero', jsonb_build_object('cls', 'knight', 'look', 'girl'), 'level', level, 'stars', 0,
    'stats', jsonb_build_object('fightsWon', won))
$$;

-- ---- On for every class ----
select is((select bool_and(bonkers_enabled) from public.app_settings), true, 'the game is on everywhere (a new game starts on; the code switch keeps it from pupils)');

-- ---- Pupils can't reach anything directly ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.bonkers_progress $$, '42501', null, 'a pupil cannot read anyone''s progress');
select throws_ok($$ select * from public.bonkers_adventures $$, '42501', null, '... or the adventures (with their answers)');
select throws_ok($$ select public.bonkers_current(auth.uid()) $$, '42501', null, '... or read one through the server functions');
select throws_ok($$ select public.bonkers_mark(auth.uid(), '123456', 0, '{"right": true, "special": false}') $$, '42501', null, '... or mark their own answer');
select throws_ok($$ select public.bonkers_put(auth.uid(), 0, '{"level": 10}') $$, '42501', null, '... or save any level they like');
select throws_ok($$ select public.teacher_set_bonkers(false) $$, null, null, 'a pupil cannot switch the game off');

-- ---- The teacher's switches ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select lives_ok($$ select public.teacher_set_bonkers(false, current_setting('test.cls')::uuid) $$, 'a teacher can switch it off');
select lives_ok($$ select public.teacher_set_unlimited_today('bonkers', true, current_setting('test.cls')::uuid) $$, '... and lift the day''s adventures');
select pg_temp.reset();
select is((select not bonkers_enabled and unlimited_days ? 'bonkers' from public.app_settings where id = public.settings_id_of(pg_temp.id('0e'))), true, '... and the settings stay');

-- ---- An adventure: one open at a time, marks in order and once, finished once with the progress ----
select pg_temp.act_as_server();
select is(public.bonkers_load(pg_temp.id('0a')), null, 'a new pupil has no progress yet');
select throws_ok($$ select public.bonkers_load('00000000-0000-0000-0000-000000000099') $$, '22023', null, 'nobody who is not a pupil');
select ok(public.bonkers_save(pg_temp.id('0a'), 0, pg_temp.progress(1, 0)), 'a hero is picked (the first save)');
select ok(public.bonkers_start(pg_temp.id('0a'), 1, pg_temp.progress(1, 0), '123456', 'laundry:wins:4:0', '{"foes": []}', '[{"answer": 42}]'), 'an adventure starts');
select ok(not public.bonkers_start(pg_temp.id('0a'), 2, pg_temp.progress(1, 0), '654321', 'laundry:wins:4:0', '{"foes": []}', '[]'), '... only one at a time');
select is(public.bonkers_current(pg_temp.id('0b')), null, 'another pupil has nothing open');
select is(public.bonkers_current(pg_temp.id('0a')) -> 'questions', '[{"answer": 42}]'::jsonb, 'the questions are kept as the server made them');
select ok(public.bonkers_mark(pg_temp.id('0a'), '123456', 0, '{"right": true, "special": true}'), 'an answer is marked');
select ok(not public.bonkers_mark(pg_temp.id('0a'), '123456', 0, '{"right": false, "special": false}') and not public.bonkers_mark(pg_temp.id('0a'), '123456', 5, '{"right": true, "special": false}'),
  '... once, and only the next one');
select ok(not public.bonkers_finish(pg_temp.id('0a'), '123456', 7, pg_temp.progress(2, 4), '{}'), 'an old version is refused');
select ok(public.bonkers_finish(pg_temp.id('0a'), '123456', 2, pg_temp.progress(2, 4), '{"fightsWon": 4}'), 'the adventure finishes with the new progress');
select ok(not public.bonkers_finish(pg_temp.id('0a'), '123456', 3, pg_temp.progress(3, 8), '{}'), '... once');
select pg_temp.reset();

-- ---- In the hub ----
select ok(exists (select 1 from public.hub_games where id = 'bonkers' and switch_column = 'bonkers_enabled' and counts_fn is not null
  and rules_fn is not null and players_fn is not null and season_fn is null and last_played_fn is not null and keep_achievements),
  'Bonkers Quest is registered with its hooks');
select is(public.bonkers_counts(pg_temp.id('0a')), '{"bonkers_fights": 4, "bonkers_level": 2, "bonkers_quests": 0, "bonkers_book": 0, "bonkers_shop": 0}'::jsonb, 'the counts come from the progress');

-- ---- Achievements and the Smash Quest Trophy (migration 20261128135655) ----
select is((select count(*)::int from public.achievement_types where game = 'bonkers'), 10, 'Smash Quest has 10 achievements');
select is((select count(*)::int from public.trophies where player = pg_temp.id('0a') and trophy = 'bonkers-hero'), 0, 'no trophy at level 2');
update public.bonkers_progress set progress = pg_temp.progress(7, 30) where player = pg_temp.id('0a');
select is((select array_agg(season order by season) from public.trophies where player = pg_temp.id('0a') and trophy = 'bonkers-hero'), array[1, 2],
  'level 7 wins the bronze and silver steps of the Smash Quest Trophy');
update public.bonkers_progress set progress = pg_temp.progress(7, 30) || '{"book": {"sock-goblin": 3, "lint-monster": 1, "angry-pegs": 0}, "owned": ["hat-party"]}'::jsonb
  where player = pg_temp.id('0a');
select is(public.bonkers_counts(pg_temp.id('0a')) - 'bonkers_fights' - 'bonkers_level' - 'bonkers_quests', '{"bonkers_book": 2, "bonkers_shop": 1}'::jsonb,
  'the Monster Book counts the monsters smashed, and the shop what''s bought');
update public.bonkers_progress set progress = pg_temp.progress(7, 31) where player = pg_temp.id('0a');
select is((select count(*)::int from public.trophies where player = pg_temp.id('0a') and trophy = 'bonkers-hero'), 2, '... and saving again wins nothing twice');

select * from finish();
rollback;
