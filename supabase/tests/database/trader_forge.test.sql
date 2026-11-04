-- Star Trader: the Star Forge (docs/TRADER-SYSTEM-PLAN.md). Pupils can't read the saved systems or the picture album, or
-- call the server's functions; the teacher switch starts off; a New Season keeps a built system waiting for the pupil's
-- choice (and only a built one), and the choice counts once.
-- Run on a throw-away copy: scripts/scratch-db.sh forge && scripts/scratch-test.sh forge supabase/tests/database/trader_forge.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

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

select is((select trader_forge from public.app_settings where class_id is null and school_id = 1), true, 'the Star Forge starts switched on');

-- ---- Pupils reach nothing directly ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.trader_systems $$, '42501', null, 'pupils cannot read the saved systems');
select throws_ok($$ select * from public.trader_system_pictures $$, '42501', null, 'pupils cannot read the picture album table');
select throws_ok($$ insert into public.trader_systems (player, season, design, carry) values (auth.uid(), 1, '{}', '{}') $$, '42501', null, 'pupils cannot give themselves a system');
select throws_ok($$ select public.trader_season_system(auth.uid()) $$, '42501', null, 'pupils cannot call the server''s system lookup');
select throws_ok($$ select public.trader_choose_season(auth.uid(), 'keep') $$, '42501', null, 'pupils cannot choose through the database directly');
select throws_ok($$ select public.teacher_set_trader_forge(true) $$, null, null, 'pupils cannot change the Star Forge switch');
select pg_temp.reset();

-- ---- A New Season keeps a built system, waiting for the choice ----
select pg_temp.act_as_server();
select public.trader_school_seed(pg_temp.id('0a'));
select public.trader_save(pg_temp.id('0a'), 0,
  '{"t":{"ship":3,"credits":8400,"weapons":[1],"shields":[],"pods":1},"system":{"v":1,"sun":{"kind":"red","built":true}}}'::jsonb,
  1, 100, true, 1, 'request-aaaa-1', '{}'::jsonb, '{}'::jsonb);
select public.trader_save(pg_temp.id('0b'), 0,
  '{"t":{"ship":1,"credits":50,"weapons":[],"shields":[],"pods":0},"system":{"v":1,"sun":{"kind":"red","built":false}}}'::jsonb,
  1, 100, false, 1, 'request-bbbb-1', '{}'::jsonb, '{}'::jsonb);
select pg_temp.reset();
select public.trader_season(array[pg_temp.id('0a'), pg_temp.id('0b')]);
select is((select count(*)::int from public.trader_games), 0, 'a New Season still clears the games');
select is((select carry ->> 'credits' from public.trader_systems where player = pg_temp.id('0a')), '8400', 'a built system is kept with the credits the pupil ended on');
select is((select count(*)::int from public.trader_systems where player = pg_temp.id('0b')), 0, 'a planned sun that was never built is not kept');

select pg_temp.act_as_server();
select is((select public.trader_choose_season(pg_temp.id('0a'), 'fresh', pg_temp.id('0a')::text || '/season1.webp', 'The Red System'))
  and not public.trader_choose_season(pg_temp.id('0a'), 'keep'), true, 'a choice counts once, and the second is refused');
select is((select count(*)::int from public.trader_system_pictures where player = pg_temp.id('0a')), 1, 'starting fresh with a picture adds it to the album');
select pg_temp.reset();

-- ---- Typed names: a pupil can't clear them, a teacher can ----
select pg_temp.act_as_server();
select public.trader_save(pg_temp.id('0b'), 0,
  '{"t":{"ship":1,"credits":50,"weapons":[],"shields":[],"pods":0},"system":{"v":1,"label":"Nova","sun":{"kind":"red","label":"Sol","built":true},"planets":[{"id":1,"kind":"rock","label":"Terra"}]}}'::jsonb,
  1, 100, false, 1, 'request-bbbb-2', '{}'::jsonb, '{}'::jsonb);
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.teacher_clear_trader_names(pg_temp.id('0b')) $$, null, null, 'a pupil cannot clear anyone''s typed names');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select public.teacher_clear_trader_names(pg_temp.id('0b'));
select pg_temp.reset();
select is((select game::text from public.trader_games where player = pg_temp.id('0b')) like '%label%', false, 'a teacher clears every typed name, and the rest of the system stays');

select * from finish();
rollback;
