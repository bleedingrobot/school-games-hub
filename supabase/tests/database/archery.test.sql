-- Archery Challenge stage 4 (migration 20261021000300): coins, the Armory, speed rounds, fights against bots, the switch
-- and the hub hooks. Pupils can't read or change any of it directly; the server function does everything.
-- Run on a throw-away copy: scripts/scratch-db.sh archery, then scripts/scratch-test.sh archery supabase/tests/database/archery.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(71);

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
create function pg_temp.coins(who text) returns integer language sql as $$ select coins from public.archery_players where player = pg_temp.id(who) $$;
create function pg_temp.gear(who text) returns jsonb language sql as $$ select gear from public.archery_players where player = pg_temp.id(who) $$;

-- ---- Registered, and off to start ----
select ok(exists (select 1 from public.hub_games where id = 'archery' and switch_column = 'archery_enabled' and rules_fn is not null
  and season_fn is not null and last_played_fn is not null), 'Archery is registered with its hooks');
select is((select archery_enabled from public.app_settings limit 1), false, 'the game starts switched off');

-- ---- Pupils can't reach anything directly ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.archery_players $$, '42501', null, 'a pupil cannot read the players table');
select throws_ok($$ select * from public.archery_rounds $$, '42501', null, '... or the speed rounds (their answers)');
select throws_ok($$ select * from public.archery_fights $$, '42501', null, '... or the fights');
select throws_ok($$ select * from public.archery_requests $$, '42501', null, '... or the requests');
select throws_ok($$ select public.archery_state(auth.uid()) $$, '42501', null, 'a pupil cannot read an Armory through the server functions');
select throws_ok($$ select public.archery_shop(auth.uid(), 'req-00000001', 'buy', 'gear', 'steel', 0, 99, 0, 99) $$, '42501', null, '... or buy for free');
select throws_ok($$ select public.archery_round_answer(auth.uid(), 'seed-000000001', 0, 1, true, 100, null) $$, '42501', null, '... or give themselves coins');
select throws_ok($$ select public.archery_fight_end(auth.uid(), 1, 'done', '{"giant":5}', 999, true) $$, '42501', null, '... or end a fight with gear back');
select throws_ok($$ select public.archery_season(array[auth.uid()]) $$, '42501', null, '... or clear a season');
select throws_ok($$ select public.teacher_set_archery(true) $$, null, null, 'a pupil cannot switch the game on');
select throws_ok($$ select public.archery_bonus_for(auth.uid(), 'chest', 1, null) $$, '42501', null, 'a pupil cannot ask whether a chest is open (more maths)');
select throws_ok($$ select public.archery_round_start(auth.uid(), 'chest-seed-9999', '[{"q":1}]', true, 1000, 'chest', 'chest:fight:1', 50) $$, '42501', null,
  '... or start a chest with their own coins per answer (the 8-argument round start)');

-- ---- The teacher's switch ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select lives_ok($$ select public.teacher_set_archery(true) $$, 'a teacher can switch it on');
select is((select archery_enabled from public.app_settings limit 1), true, '... and it is saved');
select throws_ok($$ select public.teacher_set_archery(null) $$, '22023', null, 'a missing setting is refused');
select pg_temp.reset();

-- ---- A new Armory ----
select pg_temp.act_as_server();
select is(public.archery_state(pg_temp.id('0a')) - 'roundsToday' - 'coinsToday',
  '{"coins": 100, "gear": {}, "shields": [], "bows": [], "spent": 0, "best": {}}'::jsonb, 'a new pupil starts with 100 coins and nothing else');
select is((public.archery_state(pg_temp.id('0a')) ->> 'coinsToday')::integer, 0, '... and no coins earned from maths today yet');
select is((select column_default from information_schema.columns where table_schema = 'public' and table_name = 'archery_players' and column_name = 'coins'),
  '100', 'the coins column starts everyone at 100');
select throws_ok($$ select public.archery_state('00000000-0000-0000-0000-000000000099') $$, '22023', null, 'no Armory for someone who is not a pupil');

-- ---- A speed round ----
select lives_ok($$ select public.archery_round_start(pg_temp.id('0a'), 'round-seed-0001', '[{"q":1},{"q":2},{"q":3}]', true, 1000) $$, 'a round starts');
select is((public.archery_state(pg_temp.id('0a')) ->> 'roundsToday')::integer, 1, '... and counts as a coin-earning round today');
select is(public.archery_round_answer(pg_temp.id('0a'), 'round-seed-0001', 0, 7, true, 10, 2000), '{"claimed": true, "coins": 110}'::jsonb,
  'a right answer in time adds its coins');
select is(public.archery_round_answer(pg_temp.id('0a'), 'round-seed-0001', 0, 7, true, 10, 2000), '{"claimed": false}'::jsonb,
  '... once (sent twice, counted once)');
select is(public.archery_round_answer(pg_temp.id('0a'), 'round-seed-0001', 2, 7, true, 10, null), '{"claimed": false}'::jsonb,
  'a question that was never sent cannot be answered');
select is(public.archery_round_answer(pg_temp.id('0a'), 'round-seed-0001', 1, null, false, 0, 3000) ->> 'claimed', 'true',
  'a timed-out question is marked with no coins');
select is((public.archery_round_load(pg_temp.id('0a'), 'round-seed-0001') -> 'served') ->> '2', '3000', 'and the next one is noted as sent');
select is(pg_temp.coins('0a'), 110, 'the pupil has 110 coins (100 to start and 10 from maths)');
select is((public.archery_state(pg_temp.id('0a')) ->> 'coinsToday')::integer, 10, '... and the state says 10 of them came from maths today');
select is(public.archery_round_load(pg_temp.id('0b'), 'round-seed-0001'), null, 'another pupil cannot load that round');
select throws_ok($$ select public.archery_round_answer(pg_temp.id('0a'), 'round-seed-0001', 2, 1, true, 500, null) $$, '22023', null,
  'too many coins for one answer are refused');

-- ---- A loot chest (the 8-argument round start: kind, what it belongs to, coins for each right answer) ----
select is(public.archery_round_start(pg_temp.id('0a'), 'chest-seed-0001', '[{"q":1},{"q":2},{"q":3}]', true, 1000, 'chest', 'chest:fight:1', 20), true,
  'a chest starts');
select is(public.archery_round_start(pg_temp.id('0a'), 'chest-seed-0002', '[{"q":1},{"q":2},{"q":3}]', true, 1000, 'chest', 'chest:fight:1', 20), false,
  '... but the second chest for the same fight (the same after) does not');
select is(public.archery_round_load(pg_temp.id('0a'), 'chest-seed-0001') ->> 'kind', 'chest', 'a stored set remembers it is a chest');
select is((public.archery_round_load(pg_temp.id('0a'), 'chest-seed-0001') ->> 'perRight')::integer, 20, '... and its coins for each right answer');

-- ---- The Armory ----
select is(public.archery_shop(pg_temp.id('0a'), 'buy-req-0001', 'buy', 'gear', 'steel', 200, 2, 0, 5) ->> 'result', 'coins', 'not enough coins: nothing bought');
select pg_temp.reset();
update public.archery_players set coins = 1000 where player = pg_temp.id('0a');
select pg_temp.act_as_server();
select is(public.archery_shop(pg_temp.id('0a'), 'buy-req-0002', 'buy', 'gear', 'steel', 50, 2, 0, 5) ->> 'result', 'ok', 'Steel Arrows bought');
select is(pg_temp.coins('0a'), 950, '... for 50 coins');
select is(pg_temp.gear('0a'), '{"steel": 2}'::jsonb, '... giving 2');
select is(public.archery_shop(pg_temp.id('0a'), 'buy-req-0002', 'buy', 'gear', 'steel', 50, 2, 0, 5) ->> 'result', 'ok', 'the same purchase sent again gets the same reply');
select is(pg_temp.coins('0a'), 950, '... and costs nothing more');
select is(public.archery_shop(pg_temp.id('0a'), 'buy-req-0003', 'buy', 'gear', 'giant', 400, 1, 2000, 5) ->> 'result', 'level', 'the Giant Arrow needs a higher Armory level');
select is(public.archery_shop(pg_temp.id('0a'), 'buy-req-0004', 'buy', 'gear', 'steel', 50, 2, 0, 5) ->> 'result', 'ok', 'two more Steel');
select is(public.archery_shop(pg_temp.id('0a'), 'buy-req-0005', 'buy', 'gear', 'steel', 50, 2, 0, 5) ->> 'result', 'full', 'but not past 5');
select is(public.archery_shop(pg_temp.id('0a'), 'buy-req-0006', 'buy', 'shield', 'wood', 100, 1, 0, 5) ->> 'result', 'ok', 'a Wooden Shield');
select is(public.archery_shop(pg_temp.id('0a'), 'buy-req-0007', 'buy', 'shield', 'wood', 100, 1, 0, 5) ->> 'result', 'owned', '... only once');
select is(public.archery_shop(pg_temp.id('0a'), 'sell-req-001', 'sell', 'gear', 'steel', 12, 1, 0, 5) -> 'state' -> 'gear', '{"steel": 3}'::jsonb, 'selling one Steel');
select is(pg_temp.coins('0a'), 812, '... gives back 12 (950 − 50 − 100 + 12)');
select is((select spent from public.archery_players where player = pg_temp.id('0a')), 200, 'coins spent in all (the Armory level) never go down');

-- ---- Fights ----
select is(public.archery_fight_start(pg_temp.id('0a'), 'fight-req-001', 42, 'forest', 'easy', '{"quiver":{"steel":9},"shield":null,"bow":"starter"}') ->> 'result',
  'gear', 'you cannot pack more than you have');
select is(public.archery_fight_start(pg_temp.id('0a'), 'fight-req-002', 42, 'forest', 'easy', '{"quiver":{"steel":1},"shield":"bubble","bow":"starter"}') ->> 'result',
  'gear', '... or a shield that is not yours');
select is(public.archery_fight_start(pg_temp.id('0a'), 'fight-req-003', 42, 'forest', 'easy', '{"quiver":{"steel":2},"shield":"wood","bow":"starter"}') ->> 'result',
  'ok', 'a fight starts');
select is(pg_temp.gear('0a'), '{"steel": 1}'::jsonb, '... taking the packed arrows out of the bag');
select is(public.archery_fight_start(pg_temp.id('0a'), 'fight-req-004', 43, 'snow', 'hard', '{"quiver":{"steel":3},"shield":null,"bow":"starter"}') ->> 'result',
  'ok', 'a new fight gives up the old one first (its arrows come back)');
select is(pg_temp.gear('0a'), '{}'::jsonb, '... and packs all 3');
select is((select status from public.archery_fights where seed = 42), 'abandoned', 'the old fight is marked given up');
select is(public.archery_fight_end(pg_temp.id('0a'), (select id from public.archery_fights where seed = 43), 'done', '{"steel": 2}', 87, true) -> 'best', 'true'::jsonb,
  'a finished fight gives back what was not used, and is a best');
select is(pg_temp.gear('0a'), '{"steel": 2}'::jsonb, '... 2 Steel back');
select is(public.archery_fight_end(pg_temp.id('0a'), (select id from public.archery_fights where seed = 43), 'done', '{"steel": 2}', 87, true) ->> 'result',
  'duplicate', 'ending it again changes nothing');
select is((select best from public.archery_players where player = pg_temp.id('0a')), '{"snow": 87}'::jsonb, 'the best score is kept per world');

-- ---- Chests and restocks (archery_bonus_for) ----
select is(public.archery_bonus_for(pg_temp.id('0a'), 'chest', (select id from public.archery_fights where seed = 43), null), '{"won": true}'::jsonb,
  'a chest is open after a fight that was finished, and says it was won');
select is(public.archery_bonus_for(pg_temp.id('0a'), 'restock', (select id from public.archery_fights where seed = 43), null), null,
  'a restock is not open once the fight is over');
select is(public.archery_bonus_for(pg_temp.id('0b'), 'chest', (select id from public.archery_fights where seed = 43), null), null,
  'nobody else can open the chest of a fight');
select is(public.archery_fight_start(pg_temp.id('0a'), 'fight-req-005', 44, 'city', 'easy', '{"quiver":{},"shield":null,"bow":"starter"}') ->> 'result', 'ok',
  'another fight starts');
select is(public.archery_bonus_for(pg_temp.id('0a'), 'restock', (select id from public.archery_fights where seed = 44), null), '{"won": false}'::jsonb,
  'a restock is open while the fight is being played');
select is(public.archery_bonus_for(pg_temp.id('0a'), 'chest', (select id from public.archery_fights where seed = 44), null), null,
  '... but its chest is not');
select is(public.archery_fight_end(pg_temp.id('0a'), (select id from public.archery_fights where seed = 44), 'left', '{}', 0, false) ->> 'result', 'ok',
  'the fight is given up');
select is(public.archery_bonus_for(pg_temp.id('0a'), 'chest', (select id from public.archery_fights where seed = 44), null), null,
  'a fight that was given up has no chest');
select pg_temp.reset();

-- ---- New Season: coins and gear are wiped ----
select pg_temp.act_as_server();
select public.archery_season(array[pg_temp.id('0a')]);
select pg_temp.reset();
select is((select count(*)::integer from public.archery_players where player = pg_temp.id('0a')), 0, 'New Season wipes coins and gear');
select pg_temp.act_as_server();
select is(public.archery_state(pg_temp.id('0a')) ->> 'coins', '100', '... and everyone starts the new season with 100 coins');
select pg_temp.reset();

select * from finish();
rollback;
