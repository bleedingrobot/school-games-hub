-- Kingdom Keeper (migration 20261026000100): reigns, council answers, turning a year, the switch and the hub hooks.
-- Pupils can't read or change any of it directly; the server function does everything.
-- Run on a throw-away copy: scripts/scratch-db.sh kingdom, then scripts/scratch-test.sh kingdom supabase/tests/database/kingdom.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

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
create function pg_temp.city(year integer, status text, people integer) returns jsonb language sql as $$
  select jsonb_build_object('year', year, 'status', status, 'people', people, 'grain', 2800, 'land', 1000, 'price', 20, 'hungryPct', '[]'::jsonb)
$$;
create function pg_temp.council(year integer) returns jsonb language sql as $$
  select jsonb_build_object('year', year, 'advisers', '["reeve","healer","trader"]'::jsonb,
    'questions', '[{"answer":56},{"answer":12},{"answer":9}]'::jsonb, 'answered', '{}'::jsonb)
$$;

-- ---- Registered, and off to start ----
select ok(exists (select 1 from public.hub_games where id = 'kingdom' and switch_column = 'kingdom_enabled' and counts_fn is not null
  and rules_fn is not null and players_fn is not null and season_fn is not null and last_played_fn is not null), 'Kingdom Keeper is registered with its hooks');
select is((select count(*)::integer from public.achievement_types where game = 'kingdom'), 6, 'with six achievements');
select is((select kingdom_enabled from public.app_settings limit 1), false, 'the game starts switched off');

-- ---- Pupils can't reach anything directly ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.kingdom_reigns $$, '42501', null, 'a pupil cannot read the reigns (or their questions)');
select throws_ok($$ select public.kingdom_load(auth.uid()) $$, '42501', null, '... or load one through the server functions');
select throws_ok($$ select public.kingdom_answer(auth.uid(), 1, 1, 0, 56, true) $$, '42501', null, '... or mark their own answers');
select throws_ok($$ select public.kingdom_turn(auth.uid(), 1, 1, 0, '{"status":"done","year":10,"people":999}', null, 'legendary', 5) $$, '42501', null,
  '... or end a reign as Legendary');
select throws_ok($$ select public.kingdom_season(array[auth.uid()]) $$, '42501', null, '... or clear a season');
select throws_ok($$ select public.teacher_set_kingdom(true) $$, null, null, 'a pupil cannot switch the game on');

-- ---- The teacher's switch ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select lives_ok($$ select public.teacher_set_kingdom(true) $$, 'a teacher can switch it on');
select is((select kingdom_enabled from public.app_settings limit 1), true, '... and it is saved');
select pg_temp.reset();

-- ---- A reign ----
select pg_temp.act_as_server();
select is(public.kingdom_load(pg_temp.id('0a')) -> 'reign', 'null'::jsonb, 'a new pupil has no reign');
select throws_ok($$ select public.kingdom_load('00000000-0000-0000-0000-000000000099') $$, '22023', null, 'nobody who is not a pupil');
create temp table r1 as select public.kingdom_start(pg_temp.id('0a'), 'aaaaaaaaaaaaaaaa', 'ruler-girl-1', pg_temp.city(1, 'playing', 100), pg_temp.council(1)) as id;
select is((public.kingdom_load(pg_temp.id('0a')) -> 'reign' ->> 'id')::bigint, (select id from r1), 'a reign starts and is open');

-- Council answers: once each, only this year's questions, only the pupil's own reign.
select ok(public.kingdom_answer(pg_temp.id('0a'), (select id from r1), 1, 0, 56, true), 'an answer is marked');
select ok(not public.kingdom_answer(pg_temp.id('0a'), (select id from r1), 1, 0, 56, true), '... once (sent twice, counted once)');
select ok(not public.kingdom_answer(pg_temp.id('0a'), (select id from r1), 1, 3, 1, true), 'a question that does not exist cannot be answered');
select ok(not public.kingdom_answer(pg_temp.id('0a'), (select id from r1), 2, 1, 12, true), '... nor next year''s');
select ok(not public.kingdom_answer(pg_temp.id('0b'), (select id from r1), 1, 1, 12, true), 'another pupil cannot answer it');

-- Turning a year: once.
select ok(public.kingdom_turn(pg_temp.id('0a'), (select id from r1), 1, 0, pg_temp.city(2, 'playing', 104), pg_temp.council(2), null, 0), 'year 1 turns');
select ok(not public.kingdom_turn(pg_temp.id('0a'), (select id from r1), 1, 0, pg_temp.city(2, 'playing', 104), pg_temp.council(2), null, 0), '... once');
select ok(not public.kingdom_turn(pg_temp.id('0b'), (select id from r1), 2, 1, pg_temp.city(3, 'playing', 104), null, null, 0), 'another pupil cannot turn it');
select throws_ok($$ select public.kingdom_turn(pg_temp.id('0a'), (select id from r1), 2, 1, pg_temp.city(10, 'done', 150), null, null, 0) $$, '22023', null,
  'a reign cannot end without a rating');
select ok(public.kingdom_turn(pg_temp.id('0a'), (select id from r1), 2, 1, pg_temp.city(10, 'done', 210), null, 'legendary', 5), 'the reign ends');
select is(public.kingdom_load(pg_temp.id('0a')) - 'reign', '{"record": {"reigns": 1, "legendary": 1, "best": 210}, "finishedToday": 1}'::jsonb,
  'the record counts it');
select is(public.kingdom_counts(pg_temp.id('0a')),
  '{"kingdom_reigns": 1, "kingdom_legendary": 1, "kingdom_people": 210, "kingdom_council": 1}'::jsonb, 'and so do the achievement counts');

-- New Season clears the reigns.
select pg_temp.reset();
select public.kingdom_season(array[pg_temp.id('0a')]);
select is((select count(*)::integer from public.kingdom_reigns), 0, 'a New Season clears every reign');

select * from finish();
rollback;
