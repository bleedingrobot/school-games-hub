-- Star Trader T.4: the school's shared market and news (docs/TRADER-PLAN.md, sections 8 and 20).
-- Pupils can't reach the market tables or functions; a trade's push is applied once, with the save, and never for a
-- refused or repeated save; pushes are divided by the school's depth, kept within the cap and drift back overnight
-- (the same numbers as shared/trader/schoolMarket.ts); big moves make the news; each school has its own market; a New
-- Season clears it.
-- Run on a throw-away copy: scripts/scratch-db.sh trader && scripts/scratch-test.sh trader supabase/tests/database/trader_market.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

select setval(pg_get_serial_sequence('public.schools', 'id'), 1);
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id) values ('otherschool.school.nz', 2);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000001a', 'zed@otherschool.school.nz');
-- Eight more pupils at Douglas Park, for the depth check.
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-0000000000c' || n)::uuid, 'c' || n || '@douglaspark.school.nz' from generate_series(1, 8) n;

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
-- The server's rules (config.ts): cap 50%, keep 25%, news at 15%, depth at least 5, "this week" = 7 days.
create function pg_temp.mk(pushes text) returns jsonb language sql as $$
  select jsonb_build_object('pushes', pushes::jsonb, 'cap', 5000, 'keep', 25, 'news', 1500, 'depth', 5, 'days', 7)
$$;
create function pg_temp.save(who text, expected integer, day integer, req text, pushes text)
returns integer language sql as $$
  select public.trader_save(pg_temp.id(who), expected, '{"a":1}'::jsonb, day, 0, false, 1, req, '{"ok":true}', '{}'::jsonb, pg_temp.mk(pushes))
$$;
create function pg_temp.push(day integer, planet integer, good integer) returns integer language sql as $$
  select m.push from public.trader_markets m where m.school_id = 1 and m.planet = push.planet and m.good = push.good
$$;

-- ---- Pupils reach nothing ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.trader_markets $$, '42501', null, 'pupils cannot read the market');
select throws_ok($$ select * from public.trader_news $$, '42501', null, 'pupils cannot read the news table');
select throws_ok($$ insert into public.trader_markets (school_id, planet, good, push, day) values (1, 0, 0, 500000, 1) $$, '42501', null, 'pupils cannot move a price');
select throws_ok($$ select public.trader_market(auth.uid(), 1, 25) $$, '42501', null, 'pupils cannot call the market reader');
select throws_ok($$ select public.trader_push_market(1, 1, '{}'::jsonb) $$, '42501', null, 'pupils cannot call the market pusher');
select throws_ok($$ select public.trader_drift(1, 1, 2, 25) $$, '42501', null, 'pupils cannot call the drift helper');
select pg_temp.reset();

-- ---- Drift: the same numbers as shared/trader/schoolMarket.ts ----
select is(public.trader_drift(1000, 5, 6, 25), 250, 'a push keeps a quarter overnight');
select is(public.trader_drift(-1000, 5, 7, 25), -62, '... rounded towards zero, like the browser');
select is(public.trader_drift(500000, 1, 100, 99), 0, 'very old pushes are gone');

-- ---- A trade's push goes in with the save, once ----
select pg_temp.act_as_server();
select is(pg_temp.save('0a', 0, 10, 'request-mkt-0001', '[[3, 0, -1000]]'), 1, 'a save with a market push works');
select is(pg_temp.push(10, 3, 0), -20000, 'the push is divided by the depth (at least 5): -1000 / 5, stored in hundredths');
select is(pg_temp.save('0a', 0, 10, 'request-mkt-0002', '[[3, 0, -1000]]'), null, 'a repeated or refused save ...');
select is(pg_temp.push(10, 3, 0), -20000, '... moves nothing');
select is(pg_temp.save('0a', 1, 10, 'request-mkt-0003', '[[3, 0, -400], [3, 0, -600], [3, 2, 0]]'), 2, 'pushes on the same good are added up');
select is(pg_temp.push(10, 3, 0), -40000, '... -2000 more');
select is((select count(*)::integer from public.trader_markets where school_id = 1 and planet = 3 and good = 2), 0, 'a zero push makes no row');

-- ---- The cap and the news ----
select is((select count(*)::integer from public.trader_news), 0, 'no news yet: it moved 4% today');
select pg_temp.save('0a', 2, 10, 'request-mkt-0004', '[[3, 0, -100000]]');
select is(pg_temp.push(10, 3, 0), -500000, 'a price stays within 50% of normal, however much is sold');
select is((select direction from public.trader_news where school_id = 1 and day = 10 and planet = 3 and good = 0), -1::smallint, 'a big move makes the news (lots of selling)');
select is(public.trader_market(pg_temp.id('0b'), 10, 25),
  '{"news": [[10, 3, 0, -1]], "pushes": [[3, 0, -5000, -5000]]}'::jsonb,
  'the whole school reads the same market and news (in hundredths of a percent)');
select is(public.trader_market(pg_temp.id('0b'), 11, 25),
  '{"news": [[10, 3, 0, -1]], "pushes": [[3, 0, -1250, 0]]}'::jsonb,
  'the next day it has drifted three quarters back, and moved-today starts again');
select is(public.trader_market(pg_temp.id('1a'), 10, 25), '{"news": [], "pushes": []}'::jsonb, 'another school has its own market');

-- ---- Depth: a bigger school moves a price less per pupil ----
insert into public.trader_games (player, school_id, game, day)
select ('00000000-0000-0000-0000-0000000000c' || n)::uuid, 1, '{}'::jsonb, 10 from generate_series(1, 8) n;
select pg_temp.save('0a', 3, 10, 'request-mkt-0005', '[[4, 1, 1000]]');
select is(pg_temp.push(10, 4, 1), 11111, '9 pupils played this week: +1000 / 9');

-- ---- Bad input is refused ----
select throws_ok($$ select pg_temp.save('0a', 4, 10, 'request-mkt-0006', '[[500, 0, 10]]') $$, '22023', null, 'a planet that does not exist is refused');
select is((select version from public.trader_games where player = pg_temp.id('0a')), 4, '... and the save with it');

-- ---- A New Season clears the school's market and news ----
select pg_temp.reset();
select public.trader_season(array[pg_temp.id('0a')]);
select is((select count(*)::integer from public.trader_markets where school_id = 1) + (select count(*)::integer from public.trader_news where school_id = 1), 0, 'a New Season clears the school market and news');
select * from finish();
rollback;
