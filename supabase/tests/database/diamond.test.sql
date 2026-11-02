-- Diamond Drop (migration 20261102000200): progress, levels, Hold on! marks, the Hall, the switch and the hub hooks.
-- Pupils can't read or change any of it directly; the server function does everything.
-- Run on a throw-away copy: scripts/scratch-db.sh diamond, then scripts/scratch-test.sh diamond supabase/tests/database/diamond.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

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
-- A pupil's progress as the shared rules keep it (only the parts these checks read).
create function pg_temp.state(deepest integer, coins integer, found integer) returns jsonb language sql as $$
  select jsonb_build_object('deepest', deepest, 'newLevelDate', null, 'coins', coins, 'stars', '[3,2,0,0,0,0,0,0,0,0]'::jsonb,
    'gemBook', '{"quartz": {"count": 4, "first": "2026-11-02"}}'::jsonb, 'freeBoost', null, 'owned', '["dino-jaw"]'::jsonb,
    'worn', '{"head": "dino-jaw"}'::jsonb,
    'lifetime', jsonb_build_object('plays', 3, 'gems', 12, 'grips', 2, 'found', found, 'kinds', '["quartz","jade","heartDiamond"]'::jsonb,
      'bestLevel', deepest, 'bestStars', 5))
$$;
create function pg_temp.questions() returns jsonb language sql as $$ select '[{"answer":56},{"answer":12}]'::jsonb $$;

-- ---- Registered, and off to start ----
select ok(exists (select 1 from public.hub_games where id = 'diamond' and switch_column = 'diamond_enabled' and counts_fn is not null
  and rules_fn is not null and players_fn is not null and season_fn is not null and last_played_fn is not null and keep_achievements),
  'Diamond Drop is registered with its hooks, keeping achievements through New Season');
select is((select count(*)::integer from public.achievement_types where game = 'diamond'), 6, 'with six achievements');
select is((select diamond_enabled from public.app_settings limit 1), false, 'the game starts switched off');

-- ---- Pupils can't reach anything directly ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.diamond_levels $$, '42501', null, 'a pupil cannot read the levels (or their questions)');
select throws_ok($$ select * from public.diamond_players $$, '42501', null, '... or anyone''s progress');
select throws_ok($$ select public.diamond_level(auth.uid(), 1) $$, '42501', null, '... or load a level through the server functions');
select throws_ok($$ select public.diamond_answer(auth.uid(), 1, 0, true) $$, '42501', null, '... or mark their own answers');
select throws_ok($$ select public.diamond_save(auth.uid(), 0, '{"coins": 99999}') $$, '42501', null, '... or save their own coins');
select throws_ok($$ select public.diamond_season(array[auth.uid()]) $$, '42501', null, '... or clear a season');
select throws_ok($$ select public.teacher_set_diamond(true) $$, null, null, 'a pupil cannot switch the game on');
select throws_ok($$ select public.teacher_diamond_restart(pg_temp.id('0b')) $$, null, null, '... or start a classmate again');

-- ---- The teacher's switch ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select lives_ok($$ select public.teacher_set_diamond(true) $$, 'a teacher can switch it on');
select is((select diamond_enabled from public.app_settings limit 1), true, '... and it is saved');
select pg_temp.reset();

-- ---- Progress and a level ----
select pg_temp.act_as_server();
select is(public.diamond_load(pg_temp.id('0a')), null, 'a new pupil has no progress yet');
select throws_ok($$ select public.diamond_load('00000000-0000-0000-0000-000000000099') $$, '22023', null, 'nobody who is not a pupil');
select ok(public.diamond_start(pg_temp.id('0a'), 0, pg_temp.state(0, 0, 0), 777, 1, '{}', true, pg_temp.questions()), 'a first level starts');
select ok(not public.diamond_start(pg_temp.id('0a'), 1, pg_temp.state(0, 0, 0), 777, 1, '{}', false, pg_temp.questions()),
  'a seed is used once per pupil');
select ok(not public.diamond_save(pg_temp.id('0a'), 0, pg_temp.state(0, 500, 0)), 'an old version is never saved over a newer one');

-- Hold on! answers: once each, only real slots, only the pupil's own level.
select ok(public.diamond_answer(pg_temp.id('0a'), 777, 0, true), 'an answer is marked');
select ok(not public.diamond_answer(pg_temp.id('0a'), 777, 0, false), '... once (sent twice, counted once)');
select ok(not public.diamond_answer(pg_temp.id('0a'), 777, 2, true), 'a question that does not exist cannot be answered');
select ok(not public.diamond_answer(pg_temp.id('0b'), 777, 1, true), 'another pupil cannot answer it');
select is(public.diamond_level(pg_temp.id('0a'), 777) -> 'marks', '[true, null]'::jsonb, 'the marks so far');

-- Ending: once, together with the progress, and the diamond goes in the Hall.
select ok(public.diamond_end(pg_temp.id('0a'), 777, 1, pg_temp.state(10, 300, 1), '[5, 90]', null, '{"diamond": true}'), 'the level ends');
select ok(not public.diamond_end(pg_temp.id('0a'), 777, 2, pg_temp.state(10, 900, 1), '[5, 90]', null, '{"diamond": true}'), '... once');
select is(public.diamond_counts(pg_temp.id('0a')),
  '{"diamond_gems": 12, "diamond_grips": 2, "diamond_level": 10, "diamond_kinds": 2, "diamond_found": 1, "diamond_stars": 5}'::jsonb,
  'the achievement counts');

-- ---- The Hall, own school only ----
select pg_temp.reset();
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is(public.diamond_hall() -> 0 ->> 'name', (select display_name from public.profiles where id = pg_temp.id('0a')), 'a classmate sees the finder in the Hall');
select is(public.diamond_hall() -> 0 -> 'worn', '{"head": "dino-jaw"}'::jsonb, '... with their claw, and nothing else about them');

-- ---- New Season: back to level 1, upgrades and the Hall kept ----
select pg_temp.reset();
select pg_temp.act_as_server();
select public.diamond_season(array[pg_temp.id('0a')]);
select is((public.diamond_load(pg_temp.id('0a')) -> 'player') - 'lifetime',
  '{"deepest": 0, "newLevelDate": null, "coins": 0, "stars": [0,0,0,0,0,0,0,0,0,0], "gemBook": {}, "freeBoost": null,
    "owned": ["dino-jaw"], "worn": {"head": "dino-jaw"}}'::jsonb, 'New Season clears the climb and keeps the upgrades');
select is((select count(*)::integer from public.diamond_finds), 1, '... and the Hall');

select * from finish();
rollback;
