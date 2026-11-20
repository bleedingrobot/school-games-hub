-- Class quest rewards, stage 5: Game Coins (migration 20261119000700_game_coins.sql): a quest in a game with money can give a
-- pouch of that game's money; the game opens it (open_coin_pouches, or archery_state for Archery) and adds it to the save.
begin;
create extension if not exists pgtap with schema extensions;
select plan(80);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'bea@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'fox@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000f';
update public.schools set default_class = null;
delete from public.class_members;
delete from public.class_teachers;
insert into public.classes (id, school_id, name, school_year, warp_code) values
  ('11111111-1111-4111-8111-111111111111', 1, 'Room 1', 2026, 'CDFGH');
insert into public.class_members (student_id, class_id, how) values
  ('00000000-0000-0000-0000-00000000000a', '11111111-1111-4111-8111-111111111111', 'teacher'),
  ('00000000-0000-0000-0000-00000000000b', '11111111-1111-4111-8111-111111111111', 'teacher');
insert into public.class_teachers (class_id, teacher_id) values ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-00000000000f');

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000000' || who)::uuid $$;

-- The teacher starts a quest of this kind with Game Coins, Ana wins it, and the quest is stopped.
create function pg_temp.win(k text) returns void language plpgsql as $$
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fox@douglaspark.school.nz');
  perform public.teacher_start_class_quest('11111111-1111-4111-8111-111111111111', k, 'coins');
  perform pg_temp.reset();
  insert into public.quest_wins (quest, player, kind) select id, pg_temp.id('a'), kind from public.class_quests where kind = k and stopped_at is null;
  update public.class_quests set stopped_at = now() where stopped_at is null;
end $$;

-- An unopened pouch for Ana.
create function pg_temp.pouch(g text, amount integer, k text default 'trader') returns void language sql as $$
  insert into public.quest_rewards (player, quest, kind, reward, detail)
  values (pg_temp.id('a'), null, k, 'coins', jsonb_build_object('game', g, 'amount', amount))
$$;

-- ---- Which quests can give coins ----
select is(public.quest_reward_fits('trader', 'coins'), true, 'Star Trader quests can give coins');
select is(public.quest_reward_fits('lord', 'coins'), true, 'Dragon Maths quests can give coins');
select is(public.quest_reward_fits('clans', 'coins'), true, 'Clan Quest quests can give coins');
select is(public.quest_reward_fits('clans-raids', 'coins'), true, 'Clan raid quests can give coins');
select is(public.quest_reward_fits('archery-fights', 'coins'), true, 'Archery quests can give coins');
select is(public.quest_reward_fits('diamond-daily', 'coins'), true, 'Diamond Drop quests can give coins');
select is(public.quest_reward_fits('isles-turns', 'coins'), true, 'Sky Isles quests can give coins');
select is(public.quest_reward_fits('monsters-battles', 'coins'), false, 'Monsters has no coins');
select is(public.quest_reward_fits('toonflap-daily', 'coins'), false, 'Toon Flap has no coins');
select is(public.quest_reward_fits('marble-total', 'coins'), false, 'Marble has no coins');
select is(public.quest_reward_fits('marble-total', 'scroll'), true, 'a Name Scroll fits any quest');
select is(public.quest_reward_fits('marble-total', 'title'), true, 'a Hero Title fits any quest');
select is(public.quest_reward_fits('trader', 'turns'), true, 'Bonus Turns still fit a game with turns');
select is(public.quest_reward_fits('mine-total', 'turns'), false, 'Bonus Turns still don''t fit a game without turns');
select is(public.quest_reward_fits('trader', 'banner'), false, 'a reward that isn''t ready is refused');
select is(public.quest_reward_fits(null, 'coins'), false, 'no quest, no reward');

-- ---- The teacher can start a coins quest, but not in a game without money ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fox@douglaspark.school.nz');
select throws_ok($$ select public.teacher_start_class_quest('11111111-1111-4111-8111-111111111111', 'monsters-battles', 'coins') $$,
                 '22023', 'That reward can''t be given for this quest.', 'a Monsters quest can''t give coins');
select pg_temp.reset();

-- ---- Winning leaves an unopened pouch ----
select pg_temp.win('trader');
select pg_temp.win('lord');
select pg_temp.win('clans');
select pg_temp.win('archery-fights');
select pg_temp.win('diamond-daily');
select pg_temp.win('isles-turns');
select is((select detail from public.quest_rewards where player = pg_temp.id('a') and kind = 'trader' and reward = 'coins'),
          '{"game":"trader","amount":200}'::jsonb, 'Star Trader pouch: 200');
select is((select detail from public.quest_rewards where player = pg_temp.id('a') and kind = 'lord' and reward = 'coins'),
          '{"game":"dragon-maths","amount":5}'::jsonb, 'Dragon Maths pouch: 5 forest wins');
select is((select detail from public.quest_rewards where player = pg_temp.id('a') and kind = 'clans' and reward = 'coins'),
          '{"game":"clan-quest","amount":150}'::jsonb, 'Clan Quest pouch: 150');
select is((select detail from public.quest_rewards where player = pg_temp.id('a') and kind = 'archery-fights' and reward = 'coins'),
          '{"game":"archery","amount":150}'::jsonb, 'Archery pouch: 150');
select is((select detail from public.quest_rewards where player = pg_temp.id('a') and kind = 'diamond-daily' and reward = 'coins'),
          '{"game":"diamond","amount":75}'::jsonb, 'Diamond Drop pouch: 75');
select is((select detail from public.quest_rewards where player = pg_temp.id('a') and kind = 'isles-turns' and reward = 'coins'),
          '{"game":"isles","amount":75}'::jsonb, 'Sky Isles pouch: 75');
select is((select count(*)::integer from public.quest_rewards where player = pg_temp.id('a') and reward = 'coins' and used_at is null), 6,
          'all six pouches are unopened');

-- ---- My rewards ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is((select count(*)::integer from jsonb_array_elements(public.my_quest_rewards()) e where e ->> 'usedAt' is null and e ->> 'reward' = 'coins'), 6,
          'My rewards lists six unopened pouches (usedAt null)');
select is((select e ->> 'game' from jsonb_array_elements(public.my_quest_rewards()) e where e ->> 'kind' = 'trader'), 'trader',
          '... with their game');
select is((select e -> 'amount' from jsonb_array_elements(public.my_quest_rewards()) e where e ->> 'kind' = 'trader'), 'null'::jsonb,
          '... and no amount until they are opened');
select pg_temp.reset();

-- Start the open tests from a clean slate, with the pupil's saves.
delete from public.quest_rewards where player = pg_temp.id('a');
insert into public.trader_games (player, game, day, net_worth) values (pg_temp.id('a'), '{"t":{"credits":1000}}', 1, 1000);
insert into public.lord_heroes (player, hero, version, season, day) values (pg_temp.id('a'), '{"gold":100}', 1, 1, '2026-11-19');
insert into public.clans (player, name, seed, day, created_nz_day, gold, followers, village, fights_left)
  values (pg_temp.id('a'), 'Red Wolf', 1, 1, 1, 100, 0, '{}', 0);
insert into public.diamond_players (player, state) values (pg_temp.id('a'), '{"coins":10}');
insert into public.isles_islands (player, seed, day, island) values (pg_temp.id('a'), 'abcdef0123456789', 1, '{"coins":10}');

-- ---- Star Trader ----
select pg_temp.pouch('trader', 200);
select is(public.open_coin_pouches(pg_temp.id('a'), 'trader', 5), null, 'trader: a wrong version opens nothing');
select is((select used_at from public.quest_rewards where player = pg_temp.id('a') and reward = 'coins'), null, '... the pouch is still unopened');
select is((select (game #>> '{t,credits}')::integer from public.trader_games where player = pg_temp.id('a')), 1000, '... and the credits are unchanged');
select is(public.open_coin_pouches(pg_temp.id('a'), 'trader', 1), '{"amount":200,"version":2}'::jsonb, 'trader: the right version opens it');
select is((select (game #>> '{t,credits}')::integer from public.trader_games where player = pg_temp.id('a')), 1200, '... credits rise by 200');
select is((select net_worth from public.trader_games where player = pg_temp.id('a')), 1200, '... and so does net worth');
select is((select version from public.trader_games where player = pg_temp.id('a')), 2, '... the version goes up');
select is((select detail ->> 'got' from public.quest_rewards where player = pg_temp.id('a') and reward = 'coins'), '200', '... the pouch remembers what it held');
select isnt((select used_at from public.quest_rewards where player = pg_temp.id('a') and reward = 'coins'), null, '... and is marked used');
select is(public.open_coin_pouches(pg_temp.id('a'), 'trader', 2), null, 'trader: with no pouches left it returns null');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is((select e ->> 'game' || ' ' || (e ->> 'amount') from jsonb_array_elements(public.my_quest_rewards()) e where e ->> 'reward' = 'coins'),
          'trader 200', 'My rewards shows the game and what the opened pouch held');
select isnt((select e ->> 'usedAt' from jsonb_array_elements(public.my_quest_rewards()) e where e ->> 'reward' = 'coins'), null, '... and when it was opened');
select pg_temp.reset();

-- Two pouches together
delete from public.quest_rewards where player = pg_temp.id('a');
select pg_temp.pouch('trader', 200);
select pg_temp.pouch('trader', 200);
select is(public.open_coin_pouches(pg_temp.id('a'), 'trader', 2), '{"amount":400,"version":3}'::jsonb, 'trader: two pouches open together');
select is((select count(*)::integer from public.quest_rewards where player = pg_temp.id('a') and used_at is not null and detail ->> 'got' = '200'), 2,
          '... both are marked used');

-- ---- Dragon Maths ----
delete from public.quest_rewards where player = pg_temp.id('a');
select pg_temp.pouch('dragon-maths', 5, 'lord');
select is(public.open_coin_pouches(pg_temp.id('a'), 'dragon-maths', 9, 40), null, 'dragon-maths: a wrong version opens nothing');
select is((select used_at from public.quest_rewards where player = pg_temp.id('a') and reward = 'coins'), null, '... the pouch is still unopened');
select is(public.open_coin_pouches(pg_temp.id('a'), 'dragon-maths', 1, 40), '{"amount":200,"version":2}'::jsonb, 'dragon-maths: 5 wins at 40 gold each');
select is((select (hero ->> 'gold')::integer from public.lord_heroes where player = pg_temp.id('a')), 300, '... hero gold rises by 200');
select is((select detail ->> 'got' from public.quest_rewards where player = pg_temp.id('a') and reward = 'coins'), '200', '... the pouch remembers 200');
select is(public.open_coin_pouches(pg_temp.id('a'), 'dragon-maths', 2, 40), null, 'dragon-maths: nothing left to open');

-- ---- Clan Quest ----
delete from public.quest_rewards where player = pg_temp.id('a');
select pg_temp.pouch('clan-quest', 150, 'clans');
select is(public.open_coin_pouches(pg_temp.id('a'), 'clan-quest', 7), null, 'clan-quest: a wrong version opens nothing');
select is((select used_at from public.quest_rewards where player = pg_temp.id('a') and reward = 'coins'), null, '... the pouch is still unopened');
select is(public.open_coin_pouches(pg_temp.id('a'), 'clan-quest', 1), '{"amount":150,"version":2}'::jsonb, 'clan-quest: the right version opens it');
select is((select gold from public.clans where player = pg_temp.id('a')), 250, '... gold rises by 150');
select is((select detail ->> 'got' from public.quest_rewards where player = pg_temp.id('a') and reward = 'coins'), '150', '... the pouch remembers 150');
select is(public.open_coin_pouches(pg_temp.id('a'), 'clan-quest', 2), null, 'clan-quest: nothing left to open');

-- ---- Diamond Drop ----
delete from public.quest_rewards where player = pg_temp.id('a');
select pg_temp.pouch('diamond', 75, 'diamond-daily');
select is(public.open_coin_pouches(pg_temp.id('a'), 'diamond', 4), null, 'diamond: a wrong version opens nothing');
select is((select used_at from public.quest_rewards where player = pg_temp.id('a') and reward = 'coins'), null, '... the pouch is still unopened');
select is(public.open_coin_pouches(pg_temp.id('a'), 'diamond', 1), '{"amount":75,"version":2}'::jsonb, 'diamond: the right version opens it');
select is((select (state ->> 'coins')::integer from public.diamond_players where player = pg_temp.id('a')), 85, '... coins rise by 75');
select is((select detail ->> 'got' from public.quest_rewards where player = pg_temp.id('a') and reward = 'coins'), '75', '... the pouch remembers 75');
select is(public.open_coin_pouches(pg_temp.id('a'), 'diamond', 2), null, 'diamond: nothing left to open');

-- ---- Sky Isles ----
delete from public.quest_rewards where player = pg_temp.id('a');
select pg_temp.pouch('isles', 75, 'isles-turns');
select is(public.open_coin_pouches(pg_temp.id('a'), 'isles', 4), null, 'isles: a wrong version opens nothing');
select is((select used_at from public.quest_rewards where player = pg_temp.id('a') and reward = 'coins'), null, '... the pouch is still unopened');
select is(public.open_coin_pouches(pg_temp.id('a'), 'isles', 1), '{"amount":75,"version":2}'::jsonb, 'isles: the right version opens it');
select is((select (island ->> 'coins')::integer from public.isles_islands where player = pg_temp.id('a')), 85, '... coins rise by 75');
select is((select detail ->> 'got' from public.quest_rewards where player = pg_temp.id('a') and reward = 'coins'), '75', '... the pouch remembers 75');
-- no island yet (after a New Season)
delete from public.quest_rewards where player = pg_temp.id('a');
update public.isles_islands set island = null where player = pg_temp.id('a');
select pg_temp.pouch('isles', 75, 'isles-turns');
select is(public.open_coin_pouches(pg_temp.id('a'), 'isles', 2), null, 'isles: with no island it opens nothing');
select is((select used_at from public.quest_rewards where player = pg_temp.id('a') and reward = 'coins'), null, '... the pouch waits');
select is((select version from public.isles_islands where player = pg_temp.id('a')), 2, '... and the version is unchanged');

-- ---- Bad calls ----
select throws_ok($$ select public.open_coin_pouches('00000000-0000-0000-0000-00000000000a', 'archery', 1) $$, '22023', 'Unknown pouch game.',
                 'archery pouches are not opened this way');
select throws_ok($$ select public.open_coin_pouches('00000000-0000-0000-0000-00000000000a', 'trader', 1, 0) $$, '22023', 'Unknown pouch game.',
                 'per_unit must be at least 1');
select is(public.open_coin_pouches(pg_temp.id('b'), 'trader', 1), null, 'a pupil with no save and no pouch gets null');

-- ---- Archery opens its own pouches ----
delete from public.quest_rewards where player = pg_temp.id('a');
insert into public.archery_players (player) values (pg_temp.id('a')) on conflict do nothing;
create temp table t_arch as select coins from public.archery_players where player = pg_temp.id('a');
select pg_temp.pouch('archery', 150, 'archery-fights');
select is((public.archery_state(pg_temp.id('a')) ->> 'pouch')::integer, 150, 'archery_state opens the pouch and says it held 150');
select is((select p.coins - t.coins from public.archery_players p, t_arch t where p.player = pg_temp.id('a')), 150, '... coins rise by 150');
select is((select detail ->> 'got' from public.quest_rewards where player = pg_temp.id('a') and reward = 'coins'), '150', '... the pouch remembers 150');
select is((public.archery_state(pg_temp.id('a')) ->> 'pouch')::integer, 0, 'a second archery_state opens nothing');
select is((select p.coins - t.coins from public.archery_players p, t_arch t where p.player = pg_temp.id('a')), 150, '... and the coins stay the same');

-- ---- Locked down ----
select is(has_function_privilege('authenticated', 'public.open_coin_pouches(uuid, text, integer, integer)', 'execute'), false, 'pupils can''t call open_coin_pouches');
select is(has_function_privilege('anon', 'public.open_coin_pouches(uuid, text, integer, integer)', 'execute'), false, 'signed-out visitors can''t either');
select is(has_function_privilege('service_role', 'public.open_coin_pouches(uuid, text, integer, integer)', 'execute'), true, 'the game''s function can');
select is(has_function_privilege('authenticated', 'public.quest_coins_game(text)', 'execute'), false, 'pupils can''t call quest_coins_game');
select is(has_function_privilege('authenticated', 'public.quest_coins_amount(text)', 'execute'), false, 'pupils can''t call quest_coins_amount');

select * from finish();
rollback;
