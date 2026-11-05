-- Royal Decree (migration 20261105000900): reigns, riddle answers, saving, the switch and the hub hooks.
-- Pupils can't read or change any of it directly; the server function does everything.
-- Run on a throw-away copy: scripts/scratch-db.sh decree, then scripts/scratch-test.sh decree supabase/tests/database/decree.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

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
create function pg_temp.reign(turn integer, status text, ending text, met text[]) returns jsonb language sql as $$
  select jsonb_build_object('seed', 'aaaaaaaaaaaaaaaa', 'turn', turn, 'status', status, 'met', to_jsonb(met), 'flags', '[]'::jsonb, 'used', '[]'::jsonb,
    'stars', 0, 'meters', '{"food":5,"gold":5,"happy":5,"safe":5}'::jsonb) || case when ending is null then '{}'::jsonb else jsonb_build_object('ending', ending) end
$$;
create function pg_temp.questions() returns jsonb language sql as $$ select '[{"answer":56},{"answer":12},{"answer":9}]'::jsonb $$;

-- ---- Registered, and on to start ----
select ok(exists (select 1 from public.hub_games where id = 'decree' and switch_column = 'decree_enabled' and counts_fn is not null
  and rules_fn is not null and players_fn is not null and last_played_fn is not null and season_fn is null and keep_achievements),
  'Royal Decree is registered with its hooks');
select is((select count(*)::integer from public.achievement_types where game = 'decree'), 6, 'with six achievements');
select is((select decree_enabled from public.app_settings limit 1), true, 'the game starts switched on');

-- ---- Pupils can't reach anything directly ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.decree_reigns $$, '42501', null, 'a pupil cannot read the reigns (or their riddles)');
select throws_ok($$ select public.decree_load(auth.uid()) $$, '42501', null, '... or load one through the server functions');
select throws_ok($$ select public.decree_answer(auth.uid(), 1, 0, 56, true) $$, '42501', null, '... or mark their own answers');
select throws_ok($$ select public.decree_save(auth.uid(), 1, 0, '{"status":"full","turn":24,"ending":"full"}', '[]', 5) $$, '42501', null,
  '... or end a reign as a full one');
select throws_ok($$ select public.teacher_set_decree(false) $$, null, null, 'a pupil cannot switch the game off');

-- ---- The teacher's switch ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select lives_ok($$ select public.teacher_set_decree(false) $$, 'a teacher can switch it off');
select is((select decree_enabled from public.app_settings limit 1), false, '... and it is saved');
select pg_temp.reset();

-- ---- A reign ----
select pg_temp.act_as_server();
select is(public.decree_load(pg_temp.id('0a')) -> 'reign', 'null'::jsonb, 'a new pupil has no reign');
select throws_ok($$ select public.decree_load('00000000-0000-0000-0000-000000000099') $$, '22023', null, 'nobody who is not a pupil');
create temp table r1 as select public.decree_start(pg_temp.id('0a'), 'ruler-girl-1', pg_temp.reign(0, 'playing', null, '{}'), pg_temp.questions()) as id;
select is((public.decree_load(pg_temp.id('0a')) -> 'reign' ->> 'id')::bigint, (select id from r1), 'a reign starts and is open');

-- Riddle answers: once each, only the reign's own riddles, only the pupil's own reign.
select ok(public.decree_answer(pg_temp.id('0a'), (select id from r1), 0, 56, true), 'an answer is marked');
select ok(not public.decree_answer(pg_temp.id('0a'), (select id from r1), 0, 56, true), '... once (sent twice, counted once)');
select ok(not public.decree_answer(pg_temp.id('0a'), (select id from r1), 3, 1, true), 'a riddle that does not exist cannot be answered');
select ok(not public.decree_answer(pg_temp.id('0b'), (select id from r1), 1, 12, true), 'another pupil cannot answer it');

-- Saving: once, from the right turn.
select ok(public.decree_save(pg_temp.id('0a'), (select id from r1), 0, pg_temp.reign(4, 'playing', null, array['baker', 'knight']), '["yes","no","riddle","yes"]', 0),
  'the first cards are saved');
select ok(not public.decree_save(pg_temp.id('0a'), (select id from r1), 0, pg_temp.reign(4, 'playing', null, array['baker', 'knight']), '["yes","no","riddle","yes"]', 0),
  '... once (sent twice, kept once)');
select ok(not public.decree_save(pg_temp.id('0b'), (select id from r1), 4, pg_temp.reign(5, 'playing', null, array['baker']), '[]', 0), 'another pupil cannot save it');
select throws_ok($$ select public.decree_save(pg_temp.id('0a'), (select id from r1), 4, pg_temp.reign(24, 'full', 'full', '{}'), '[]', null) $$, '22023', null,
  'a reign cannot end without its points');
select ok(public.decree_save(pg_temp.id('0a'), (select id from r1), 4, pg_temp.reign(24, 'full', 'full', array['baker', 'knight', 'goat']), '[]', 5), 'the reign ends');
select is(public.decree_load(pg_temp.id('0a')) - 'reign',
  '{"album": {"reigns": 1, "full": 1, "best": 24, "endings": ["full"], "met": ["baker", "goat", "knight"]}, "finishedToday": 1}'::jsonb,
  'the album counts it');
select is(public.decree_counts(pg_temp.id('0a')),
  '{"decree_reigns": 1, "decree_full": 1, "decree_met": 3, "decree_endings": 1}'::jsonb, 'and so do the achievement counts');

select * from finish();
rollback;
