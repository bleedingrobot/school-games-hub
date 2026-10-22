-- Star Trader T.3: saving (docs/TRADER-PLAN.md, section 10).
-- Pupils can't reach any Star Trader table or server function; a save is refused if the game has moved on; a request sent
-- twice counts once; a refused request never uses up a question; the school gets one galaxy, a New Season gives a new one
-- and clears the games but keeps the Moon Owners; teachers switch the game on per class and reset a pupil's ship.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

select setval(pg_get_serial_sequence('public.schools', 'id'), 1);
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id) values ('otherschool.school.nz', 2);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000001a', 'zed@otherschool.school.nz');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f1', 'teach@douglaspark.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-0000000000f1';

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
-- Saves a game for a player (the server's way).
create function pg_temp.save(who text, expected integer, game text, day integer, req text, claims text default '{}', moon boolean default false, season integer default 1)
returns integer language sql as $$
  select public.trader_save(pg_temp.id(who), expected, game::jsonb, day, 123, moon, season, req, '{"ok":true}', claims::jsonb)
$$;

-- ---- The switches start off, and the settings work ----
select is((select trader_enabled from public.app_settings where class_id is null and school_id = 1), false, 'Star Trader starts switched off');
select is((select trader_jumps from public.app_settings where class_id is null and school_id = 1), 10, '... with ten jumps a day');

-- ---- Pupils reach nothing directly ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.trader_games $$, '42501', null, 'pupils cannot read the games');
select throws_ok($$ select * from public.trader_days $$, '42501', null, 'pupils cannot read the question lists');
select throws_ok($$ select * from public.trader_requests $$, '42501', null, 'pupils cannot read the requests');
select throws_ok($$ select * from public.trader_schools $$, '42501', null, 'pupils cannot read the galaxy seeds');
select throws_ok($$ select * from public.trader_moons $$, '42501', null, 'pupils cannot read the moon list directly');
select throws_ok($$ insert into public.trader_games (player, game, day) values (auth.uid(), '{}', 1) $$, '42501', null, 'pupils cannot make themselves a game');
select throws_ok($$ select public.trader_load(auth.uid()) $$, '42501', null, 'pupils cannot call the loading function');
select throws_ok($$ select pg_temp.save('0a', 0, '{"a":1}', 1, 'request-aaaa-1') $$, '42501', null, 'pupils cannot call the saving function');
select throws_ok($$ select public.teacher_set_trader(true, 10, true, 'on') $$, null, null, 'pupils cannot change the switches');
select pg_temp.reset();

-- ---- The school's galaxy ----
select pg_temp.act_as_server();
select is((select public.trader_school_seed(pg_temp.id('0a')) ->> 'season'), '1', 'a school gets season 1 and a galaxy on first use');
select is((select public.trader_school_seed(pg_temp.id('0a')) ->> 'seed'), (select public.trader_school_seed(pg_temp.id('0b')) ->> 'seed'), 'the whole school has the same galaxy');
select isnt((select public.trader_school_seed(pg_temp.id('0a')) ->> 'seed'), (select public.trader_school_seed(pg_temp.id('1a')) ->> 'seed'), 'another school has its own');
select throws_ok($$ select public.trader_school_seed(pg_temp.id('0f')) $$, '22023', null, 'someone with no profile gets nothing');

-- ---- Saving, with a version so two tabs cannot overwrite each other ----
select is(public.trader_load(pg_temp.id('0a')), null, 'a new pupil has no game');
select is(pg_temp.save('0a', 0, '{"a":1}', 5, 'request-aaaa-1'), 1, 'the first save is version 1');
select is(pg_temp.save('0a', 0, '{"a":2}', 5, 'request-aaaa-2'), null, 'a second first-save is refused');
select is(pg_temp.save('0a', 1, '{"a":3}', 5, 'request-aaaa-3'), 2, 'a save from the current version is version 2');
select is(pg_temp.save('0a', 1, '{"a":4}', 5, 'request-aaaa-4'), null, 'a save from an old version is refused');
select is((select public.trader_load(pg_temp.id('0a')) -> 'game' ->> 'a'), '3', '... and changes nothing');
select is((select public.trader_load(pg_temp.id('0a')) ->> 'version'), '2', 'the version is kept');

-- ---- A request sent twice counts once ----
select is((select public.trader_request(pg_temp.id('0a'), 'request-aaaa-3') ->> 'ok'), 'true', 'the reply to a request is kept');
select is(public.trader_request(pg_temp.id('0a'), 'request-aaaa-4'), null, '... but not for a refused one');

-- ---- Questions: kept per day, answers marked once, and only when the save works ----
select public.trader_store_day(pg_temp.id('0a'), 5, '[{"id":0},{"id":1},{"id":2}]');
select public.trader_store_day(pg_temp.id('0a'), 5, '[{"id":9}]');
select is((select jsonb_array_length(public.trader_load_day(pg_temp.id('0a'), 5) -> 'questions')), 3, 'the first question list for a day is kept');
select throws_ok($$ select public.trader_store_day(pg_temp.id('0a'), 6, '[]') $$, '22023', null, 'an empty question list is refused');
select pg_temp.save('0a', 2, '{"a":5}', 5, 'request-aaaa-5', '{"0":{"value":42,"right":true}}');
select is((select public.trader_load_day(pg_temp.id('0a'), 5) -> 'answered' -> '0' ->> 'right'), 'true', 'an answer marked in a save is kept with it');
select pg_temp.save('0a', 1, '{"a":6}', 5, 'request-aaaa-6', '{"1":{"value":1,"right":false}}');
select is((select public.trader_load_day(pg_temp.id('0a'), 5) -> 'answered' ? '1'), false, 'a refused save does not use up a question');

-- ---- Moons are remembered, and a New Season clears the games but not the moons ----
select pg_temp.save('0b', 0, '{"b":1}', 5, 'request-bbbb-1', '{}', true, 1);
select is((select count(*)::integer from public.trader_moons where player = pg_temp.id('0b')), 1, 'a moon goes on the Moon Owners list');
select pg_temp.save('0b', 1, '{"b":2}', 5, 'request-bbbb-2', '{}', true, 1);
select is((select count(*)::integer from public.trader_moons where player = pg_temp.id('0b')), 1, '... once');
select pg_temp.reset();
select public.trader_season(array[pg_temp.id('0a'), pg_temp.id('0b')]);
select is((select count(*)::integer from public.trader_games), 0, 'a New Season clears the games');
select is((select season from public.trader_schools where school_id = 1), 2, '... and starts season 2 for the school');
select is((select count(*)::integer from public.trader_moons where player = pg_temp.id('0b')), 1, '... but the Moon Owners list stays');

-- ---- Teachers ----
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1', 'teach@douglaspark.school.nz');
select lives_ok($$ select public.teacher_set_trader(true, 6, false, 'off') $$, 'a teacher can set the switches');
select pg_temp.reset();
select is((select trader_jumps from public.app_settings where class_id is null and school_id = 1), 6, '... and the jumps changed');
select * from finish();
rollback;
