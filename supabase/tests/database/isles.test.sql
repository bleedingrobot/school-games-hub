-- Sky Isles (migration 20261102000100): islands, turns, questions, races, the switches, what pupils can read, and the hub
-- hooks. Pupils can't read or change any of it directly; the server function does everything.
-- Run on a throw-away copy: scripts/scratch-db.sh isles, then scripts/scratch-test.sh isles supabase/tests/database/isles.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(47);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cal@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000e';
insert into public.classes (school_id, name, school_year, warp_code, archived) values
  (1, 'Isle Room', 2026, 'CDFGH', false), (1, 'Other Room', 2026, 'JKMNP', false);
insert into public.class_members (student_id, class_id)
select ('00000000-0000-0000-0000-0000000000' || v.s)::uuid, c.id from (values ('0a', 'Isle Room'), ('0b', 'Isle Room'), ('0c', 'Other Room')) v(s, n)
join public.classes c on c.name = v.n
on conflict (student_id) do update set class_id = excluded.class_id;

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
-- A pretend island with this many spots on this turn (the server function keeps the whole engine island).
create function pg_temp.island(turn integer, spots integer, happiness integer default 70) returns jsonb language sql as $$
  select jsonb_build_object('turn', turn, 'happiness', happiness, 'lighthouse', 0, 'racesWon', 0, 'upgrades', '[]'::jsonb,
    'spots', (select jsonb_agg(jsonb_build_object('kind', case when n <= 2 then 'farm' else 'empty' end, 'level', 1)) from generate_series(1, spots) n))
$$;
create function pg_temp.seed(who text) returns text language sql as $$ select repeat(who, 8) $$;

-- ---- Registered, and off to start ----
select ok(exists (select 1 from public.hub_games where id = 'isles' and switch_column = 'isles_enabled' and counts_fn is not null
  and rules_fn is not null and players_fn is not null and season_fn is not null and last_played_fn is not null and keep_achievements),
  'Sky Isles is registered with its hooks, and achievements stay through a New Season');
select is((select count(*)::integer from public.achievement_types where game = 'isles'), 7, 'with seven achievements');
select is((select isles_enabled from public.app_settings limit 1), false, 'the game starts switched off');
select is((select isles_races from public.app_settings limit 1), true, '... with Sky Races on');

-- ---- Pupils can't reach anything directly ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.isles_islands $$, '42501', null, 'a pupil cannot read the islands (or their seeds)');
select throws_ok($$ select * from public.isles_questions $$, '42501', null, '... or the questions and their answers');
select throws_ok($$ select * from public.isles_turns $$, '42501', null, '... or the turns');
select throws_ok($$ select * from public.isles_races $$, '42501', null, '... or the races');
select throws_ok($$ select public.isles_load(auth.uid()) $$, '42501', null, '... or load through the server functions');
select throws_ok($$ select public.record_isles_start(auth.uid(), repeat('ab', 8), '{"turn":0}', 1) $$, '42501', null, '... or make an island');
select throws_ok($$ select public.record_isles_turn(auth.uid(), 1, '{"turn":1}', 1, 0, true, '[]', '{}') $$, '42501', null, '... or play a turn');
select throws_ok($$ select public.record_isles_answer(auth.uid(), repeat('ab', 8), 0, 56, true) $$, '42501', null, '... or mark their own answers');
select throws_ok($$ select public.record_isles_race_finish(auth.uid(), 1, 1, '{}', 1, '{"won":true}', '{}') $$, '42501', null, '... or finish a race');
select throws_ok($$ select public.record_isles_keeper(auth.uid(), 'g07') $$, '42501', null, '... or choose a keeper directly');
select throws_ok($$ select public.isles_season(array[auth.uid()]) $$, '42501', null, '... or clear a season');
select throws_ok($$ select public.teacher_set_isles(true, true) $$, null, null, 'a pupil cannot switch the game on');

-- ---- The teacher's switches ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select lives_ok($$ select public.teacher_set_isles(true, false) $$, 'a teacher can switch it on and races off');
select is((select (isles_enabled, isles_races)::text from public.app_settings limit 1), '(t,f)', '... and it is saved');
select pg_temp.reset();

-- ---- Islands ----
select pg_temp.act_as_server();
select is(public.isles_load(pg_temp.id('0a')) -> 'saved', 'null'::jsonb, 'a new pupil has no island');
select throws_ok($$ select public.record_isles_start('00000000-0000-0000-0000-000000000099', repeat('ab', 8), '{"turn":0}', 1) $$,
  '22023', null, 'nobody who is not a pupil');
select ok(public.record_isles_start(pg_temp.id('0a'), pg_temp.seed('a1'), pg_temp.island(0, 6), 20000), 'an island is made');
select ok(not public.record_isles_start(pg_temp.id('0a'), pg_temp.seed('a2'), pg_temp.island(0, 6), 20000), '... once (it is not replaced)');
select ok(public.record_isles_start(pg_temp.id('0b'), pg_temp.seed('b1'), pg_temp.island(0, 10), 20000), 'a classmate''s island');
select ok(public.record_isles_start(pg_temp.id('0c'), pg_temp.seed('c1'), pg_temp.island(0, 14), 20000), 'another class''s island');
select is((public.isles_load(pg_temp.id('0a')) ->> 'classMiddle')::integer, 6, 'the class''s middle size counts only the pupil''s own class');

-- Sky Keepers: only a portrait from the list.
select ok(public.record_isles_keeper(pg_temp.id('0a'), 'g07'), 'a keeper is saved');
select is(public.isles_load(pg_temp.id('0a')) -> 'saved' ->> 'keeper', 'g07', '... and comes back with the island');
select throws_ok($$ select public.record_isles_keeper(pg_temp.id('0a'), 'x99') $$, '23514', null, '... only from the list');
select ok(not public.record_isles_keeper('00000000-0000-0000-0000-000000000099', 'b01'), '... and only for a pupil with an island');

-- Turns: once each.
select ok(public.record_isles_turn(pg_temp.id('0a'), 1, pg_temp.island(1, 7, 95), 20000, 0, true, '[{"kind":"anchor"}]', '{}'), 'turn 0 is kept');
select ok(not public.record_isles_turn(pg_temp.id('0a'), 1, pg_temp.island(1, 7, 95), 20000, 0, true, '[{"kind":"anchor"}]', '{}'),
  '... once (sent twice, kept once)');
select ok(not public.record_isles_turn(pg_temp.id('0b'), 2, pg_temp.island(1, 7), 20000, 0, true, '[]', '{}'), 'a save from an old version is refused');
select throws_ok($$ select public.record_isles_turn(pg_temp.id('0a'), 2, pg_temp.island(5, 7), 20000, 1, true, '[]', '{}') $$, '22023', null,
  'a turn cannot jump ahead');
select ok(public.record_isles_turn(pg_temp.id('0a'), 2, pg_temp.island(2, 7, 92), 20000, 1, false, '[]', '{}')
  and public.record_isles_turn(pg_temp.id('0a'), 3, pg_temp.island(3, 7, 91), 20000, 2, false, '[]', '{}'), 'two more turns');
select is((select count(*)::integer from public.isles_turns where player = pg_temp.id('0a')), 3, 'three turns kept');

-- Questions: the pupil's own, each marked once.
select is(public.record_isles_questions(pg_temp.id('0a'), repeat('a', 24), 'turn:' || pg_temp.seed('a1') || ':3', '[{"answer":56}]') ->> 'id',
  repeat('a', 24), 'a question is stored');
select is(public.record_isles_questions(pg_temp.id('0a'), repeat('b', 24), 'turn:' || pg_temp.seed('a1') || ':3', '[{"answer":99}]') ->> 'id',
  repeat('a', 24), '... and the first one for a turn stays');
select ok(public.isles_question_set(pg_temp.id('0b'), repeat('a', 24), null) is null, 'another pupil cannot find it');
select ok(public.record_isles_answer(pg_temp.id('0a'), repeat('a', 24), 0, 56, true), 'an answer is marked');
select ok(not public.record_isles_answer(pg_temp.id('0a'), repeat('a', 24), 0, 56, true), '... once (sent twice, counted once)');
select ok(not public.record_isles_answer(pg_temp.id('0b'), repeat('a', 24), 0, 56, true)
  and not public.record_isles_answer(pg_temp.id('0a'), repeat('a', 24), 1, 56, true), 'not by another pupil, nor a question that is not there');

-- Races: one open at a time, finished once.
create temp table r1 as select public.record_isles_race_start(pg_temp.id('0a'), repeat('cd', 8), 'gull-riders', true, '{"boats":2}', '{"boats":2}', 20000, 3) as id;
select ok(public.record_isles_race_start(pg_temp.id('0a'), repeat('ef', 8), 'gull-riders', false, '{}', '{}', 20000, 3) is null,
  'a second race cannot start while one is open');
select ok(public.record_isles_race_finish(pg_temp.id('0a'), (select id from r1), 4, pg_temp.island(3, 7, 91) || '{"racesWon":1}', 20000, '{"won":true}', '{"coins":30,"goods":5}')
  and not public.record_isles_race_finish(pg_temp.id('0a'), (select id from r1), 5, pg_temp.island(3, 7), 20000, '{"won":true}', '{}'),
  'a race finishes once');

-- ---- What pupils read: their own island, and their own class's sky ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is((public.my_isles() -> 'island' ->> 'turn')::integer, 3, 'a pupil reads their own island');
select is((select array_agg(e ->> 'name' order by e ->> 'name') from jsonb_array_elements(public.isles_sky()) e)::text,
  (select array_agg(display_name order by display_name) from public.profiles where id in (pg_temp.id('0a'), pg_temp.id('0b')))::text,
  'the sky shows only their own class');
select pg_temp.reset();

-- ---- Counts, and New Season ----
select is(public.isles_counts(pg_temp.id('0a')) - 'isles_farms',
  '{"isles_chunks": 1, "isles_happy_days": 1, "isles_upgrades": 0, "isles_races_won": 1, "isles_grand": 0, "isles_lighthouses": 0}'::jsonb,
  'the achievement counts come from the island and its turns');
select public.isles_season(array[pg_temp.id('0a')]);
select ok((select island is null and season = 2 from public.isles_islands where player = pg_temp.id('0a'))
  and not exists (select 1 from public.isles_turns where player = pg_temp.id('0a'))
  and not exists (select 1 from public.isles_races where player = pg_temp.id('0a')), 'a New Season empties the island and clears its turns and races');

select * from finish();
rollback;
