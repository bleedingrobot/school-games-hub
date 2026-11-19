-- Goblin Storm (migration 20261119000900, id goblinstorm): saves, runs, questions, the switch and the hub row; stage 5's
-- shop, codex, points, achievements, trophy, board and teacher column.
-- Pupils can't read or change any of it directly; the server function does everything.
-- Run on a throw-away copy: scripts/scratch-db.sh goblinstorm, then scripts/scratch-test.sh goblinstorm supabase/tests/database/goblinstorm.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(73);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000e';
select set_config('test.cls', (select default_class::text from public.schools where id = 1), true);
insert into public.class_teachers (class_id, teacher_id) values (current_setting('test.cls')::uuid, '00000000-0000-0000-0000-00000000000e') on conflict do nothing;
-- A week's Storm Chaser class quest is running, so finished runs are counted (migration 20261120000400).
insert into public.class_quests (class_id, kind, starts_on, ends_on)
values (current_setting('test.cls')::uuid, 'goblinstorm-total', public.nz_day(now()), public.nz_day(now()) + 6);

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
create function pg_temp.summary(gold integer, boss boolean, evolved text[], level integer default 12, kills integer default 240, no_hit integer default 20) returns jsonb language sql as $$
  select jsonb_build_object('outcome', case when boss then 'won' else 'lost' end, 'seconds', 95, 'level', level, 'kills', kills,
    'miniBeaten', true, 'bossBeaten', boss, 'evolved', to_jsonb(evolved), 'weapons', to_jsonb(evolved || array['axes', 'sword']),
    'longestNoHitSeconds', no_hit, 'gold', gold)
$$;

-- ---- On for every class, and in the hub's list ----
select is((select bool_and(goblinstorm_enabled) from public.app_settings), true, 'the game is on everywhere (the code switch holds it back)');
select ok(exists (select 1 from public.hub_games where id = 'goblinstorm' and switch_column = 'goblinstorm_enabled' and last_played_fn is not null),
  'it is in hub_games with its switch and last played');

-- ---- Pupils can't reach anything directly ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.goblinstorm_saves $$, '42501', null, 'a pupil cannot read anyone''s save');
select throws_ok($$ select * from public.goblinstorm_runs $$, '42501', null, '... or the runs');
select throws_ok($$ select * from public.goblinstorm_questions $$, '42501', null, '... or the questions with their answers');
select throws_ok($$ select public.goblinstorm_load_questions(auth.uid(), 1) $$, '42501', null, '... or read them through the server functions');
select throws_ok($$ select public.goblinstorm_store_questions(auth.uid(), 1, 'knight', 0, current_date, false, '[]', '{}') $$, '42501', null, '... or start a run');
select throws_ok($$ select public.goblinstorm_claim_answer(auth.uid(), 1, 0, 42, 500, 'quick') $$, '42501', null, '... or mark their own answer');
select throws_ok($$ select public.record_goblinstorm_run(auth.uid(), 1, '', '[]', '{}') $$, '42501', null, '... or save a run with any gold');
select throws_ok($$ select public.goblinstorm_load(auth.uid()) $$, '42501', null, '... or load a save through the server function');
select throws_ok($$ select public.teacher_set_goblinstorm(false) $$, null, null, 'a pupil cannot switch the game off');

-- ---- The teacher's switch ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select lives_ok($$ select public.teacher_set_goblinstorm(false, current_setting('test.cls')::uuid) $$, 'a teacher can switch it off for the class');
select throws_ok($$ select public.teacher_set_goblinstorm(null, current_setting('test.cls')::uuid) $$, '22023', null, 'a setting must be given');
select pg_temp.reset();
select is((select goblinstorm_enabled from public.app_settings where id = public.settings_id_of(pg_temp.id('0e'))), false, '... and it stays off');

-- ---- A run: started once, each slot marked once, finished once with the save ----
select pg_temp.act_as_server();
select is(public.goblinstorm_load(pg_temp.id('0a')), null, 'a new pupil has no save yet');
select throws_ok($$ select public.goblinstorm_load('00000000-0000-0000-0000-000000000099') $$, '22023', null, 'nobody who is not a pupil');
select ok(public.goblinstorm_store_questions(pg_temp.id('0a'), 123456, 'knight', 0, '2026-11-19', false, '[{"answer": 42}]', '{}'), 'a run starts');
select ok(not public.goblinstorm_store_questions(pg_temp.id('0a'), 123456, 'knight', 0, '2026-11-19', false, '[]', '{}'), 'a seed is used once per pupil');
select ok(public.goblinstorm_store_questions(pg_temp.id('0b'), 123456, 'ranger', 0, '2026-11-19', false, '[]', '{}'), '... but another pupil may have the same seed');
select is(public.goblinstorm_runs_on(pg_temp.id('0a'), '2026-11-19'), 1, 'it counts towards today');
select is(public.goblinstorm_load_questions(pg_temp.id('0a'), 123456) -> 'questions', '[{"answer": 42}]'::jsonb, 'the server reads its own questions back');
select is(public.goblinstorm_load_questions(pg_temp.id('0a'), 999), null, '... and nothing for a seed that isn''t theirs');
select ok(public.goblinstorm_claim_answer(pg_temp.id('0a'), 123456, 0, 41, 2500, 'wrong'), 'a slot is marked');
select ok(not public.goblinstorm_claim_answer(pg_temp.id('0a'), 123456, 0, 42, 900, 'quick'), '... once: the first answer counts');
select is(public.goblinstorm_load_questions(pg_temp.id('0a'), 123456) #>> '{answers,0,mark}', 'wrong', '... and it keeps the first mark');
select ok(public.record_goblinstorm_run(pg_temp.id('0a'), 123456, '4x600', '[0,1]', pg_temp.summary(30, true, array['blades'])), 'a run is saved');
select ok(not public.record_goblinstorm_run(pg_temp.id('0a'), 123456, '4x600', '[0,1]', pg_temp.summary(30, true, array['blades'])), '... once');
select is(public.goblinstorm_load(pg_temp.id('0a')), '{"gold": 30, "shop": {}, "heroes": ["cleric"], "bosses": [0], "kills": 240}'::jsonb,
  'the save has the gold, the boss, and the Goblin King opened the Cleric');
select ok(not public.goblinstorm_claim_answer(pg_temp.id('0a'), 123456, 1, 42, 900, 'right'), 'an ended run takes no more answers');
select pg_temp.reset();
select is((select outcome || ':' || gold || ':' || array_to_string(evolutions, ',') from public.goblinstorm_runs where player = pg_temp.id('0a')),
  'won:30:blades', 'the run row keeps what the replay said');


-- ---- Heroes unlock from what the replay said, once each ----
select pg_temp.act_as_server();
select ok(public.goblinstorm_store_questions(pg_temp.id('0a'), 2, 'knight', 1, '2026-11-19', false, '[]', '{}'), 'a second run starts');
select ok(public.record_goblinstorm_run(pg_temp.id('0a'), 2, '4x600', '[]', pg_temp.summary(10, true, array['blades', 'fireball', 'arrows'], 35, 19800, 125)),
  'a big run on the Dark Forest is saved');
select pg_temp.reset();
select is((select heroes from public.goblinstorm_saves where player = pg_temp.id('0a')), array['cleric', 'wizard', 'barbarian', 'rogue', 'dragonkid'],
  'level 35, 20,000 monsters in all, 120 s unhit and 3 evolutions each open a hero; another map''s boss doesn''t open the Witch');
select pg_temp.act_as_server();
select ok(public.goblinstorm_store_questions(pg_temp.id('0a'), 3, 'cleric', 0, '2026-11-19', false, '[]', '{}'), 'a third run starts');
select ok(public.record_goblinstorm_run(pg_temp.id('0a'), 3, '4x600', '[]', pg_temp.summary(5, true, array['blades'], 22)), '... and is saved');
select pg_temp.reset();
select is((select heroes from public.goblinstorm_saves where player = pg_temp.id('0a')), array['cleric', 'wizard', 'barbarian', 'rogue', 'dragonkid'],
  'a hero is never added twice');
select is((select bosses from public.goblinstorm_saves where player = pg_temp.id('0a')), array[0, 1]::smallint[], '... and nor is a boss');

-- A pupil who has started but never finished a run.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is(public.my_goblinstorm() - 'today', '{"gold": 0, "shop": {}, "heroes": [], "bosses": [], "codex": [], "weapons": [], "runs": 0, "kills": 0, "guideSeen": false, "bestGold": 0}'::jsonb,
  'a pupil with no finished run gets an empty save, never anyone else''s');
select pg_temp.reset();

-- ---- Stage 5: the codex, points, achievements and the trophy (from the runs above) ----
select is((select weapons from public.goblinstorm_saves where player = pg_temp.id('0a')), array['arrows', 'axes', 'blades', 'fireball'],
  'the codex keeps every weapon picked up, once each, and leaves out anything that isn''t a weapon');
select is((select sum(g.points_raw)::integer from public.game_points g where g.player = pg_temp.id('0a') and g.game = 'goblinstorm'), 30,
  'three boss wins on normal turns: 10 points each');
select is((select count(*)::integer from public.scored_games s where s.player = pg_temp.id('0a') and s.game = 'goblinstorm'), 3,
  '... each a scored_games row, so the effort boards count it');
select is((select array_agg(a.achievement order by a.achievement) from public.achievements a where a.player = pg_temp.id('0a')
           and a.achievement like 'goblinstorm-%'), array['goblinstorm-evolve', 'goblinstorm-first', 'goblinstorm-king'],
  'First Storm, It Evolves! and King Slayer are earned; Hero Collector (7 of 8) and Storm Master (2 of 5) are not yet');
select is((select count(*)::integer from public.trophies t where t.player = pg_temp.id('0a') and t.trophy = 'goblinstorm-crown'), 1,
  'beating the Goblin King wins the Crown, once');
select is((select how from public.trophy_types where id = 'goblinstorm-crown'), 'Beat the Goblin King in Goblin Storm.', '... with its words for pupils');
update public.goblinstorm_saves set bosses = bosses || 4::smallint where player = pg_temp.id('0a');
select is((select array_agg(t.trophy order by t.trophy) from public.trophies t where t.player = pg_temp.id('0a') and t.trophy like 'goblinstorm-%'),
  array['goblinstorm-crown', 'goblinstorm-scale'], 'beating the Fire Dragon wins the Fire Dragon''s Scale');
-- Back to 2 bosses for the board and save checks below (the trophy stays).
update public.goblinstorm_saves set bosses = array_remove(bosses, 4::smallint) where player = pg_temp.id('0a');
select is((select coalesce(sum(n), 0)::integer from public.quest_tallies q where q.player = pg_temp.id('0a') and q.measure = 'goblinstorm_runs'), 3,
  'each run played to the end counts for the class quest');

-- An extra turn (Unlimited today) and a run left early give gold but no points; achievements still count.
select pg_temp.act_as_server();
select ok(public.goblinstorm_store_questions(pg_temp.id('0b'), 50, 'knight', 0, '2026-11-19', true, '[]', '{"might": 2}'), 'an extra turn starts with its shop');
select is(public.goblinstorm_load_questions(pg_temp.id('0b'), 50) -> 'shop', '{"might": 2}'::jsonb, '... and the run keeps the shop it started with');
select ok(public.record_goblinstorm_run(pg_temp.id('0b'), 50, '4x600', '[]', pg_temp.summary(20, false, array[]::text[])), '... and is saved');
select ok(public.goblinstorm_store_questions(pg_temp.id('0b'), 51, 'knight', 0, '2026-11-19', false, '[]', '{}'), 'a normal run starts');
select ok(public.record_goblinstorm_run(pg_temp.id('0b'), 51, '4x60', '[]', pg_temp.summary(3, false, array[]::text[]) || '{"outcome": "quit"}'), '... and is left early');
select pg_temp.reset();
select is((select count(*)::integer from public.game_points g where g.player = pg_temp.id('0b') and g.game = 'goblinstorm'), 0,
  'no points for an extra turn or a run left early');
select is((select gold from public.goblinstorm_saves where player = pg_temp.id('0b')), 23, '... but the gold still counts');
select ok(exists (select 1 from public.achievements a where a.player = pg_temp.id('0b') and a.achievement = 'goblinstorm-first'),
  '... and First Storm is still earned by the run played to the end');
select is((select coalesce(sum(n), 0)::integer from public.quest_tallies q where q.player = pg_temp.id('0b') and q.measure = 'goblinstorm_runs'), 1,
  'an extra turn played to the end counts for the quest; a run left early doesn''t');
select is((select count(*)::integer from public.quest_kinds where id like 'goblinstorm-%'), 2, 'Goblin Storm has its two class quests');

-- ---- The gold shop: own save only, gold and top level checked ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is(public.buy_goblinstorm('might') - 'shop', '{"bought": false, "reason": "gold", "gold": 23}'::jsonb, 'a pupil can''t buy what they can''t afford (23 gold)');
select pg_temp.reset();
update public.goblinstorm_saves set gold = 2000, shop = '{"armour": 2}' where player = pg_temp.id('0b');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is(public.buy_goblinstorm('armour'), '{"bought": true, "reason": null, "gold": 1500, "shop": {"armour": 3}}'::jsonb, 'Armour level 3 costs 500');
select is(public.buy_goblinstorm('armour') ->> 'reason', 'top', '... and Armour stops at 3');
select is(public.buy_goblinstorm('gold') -> 'gold', '1350'::jsonb, 'Gold level 1 costs 150');
select throws_ok($$ select public.buy_goblinstorm('rocket') $$, '22023', null, 'only the six upgrades');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select is(public.buy_goblinstorm('might') ->> 'reason', 'none', 'a teacher has no save to buy with');
select pg_temp.reset();
select is((select gold from public.goblinstorm_saves where player = pg_temp.id('0a')), 45, 'buying never touches anyone else''s gold');

-- ---- The board and the teacher's column ----
-- A teacher with a save (made by hand: the server never makes one) must still stay off the board.
insert into public.goblinstorm_saves (player, bosses) values (pg_temp.id('0e'), '{0,1,2}');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is((select jsonb_agg(jsonb_build_object('name', e ->> 'name', 'bosses', e -> 'bosses', 'me', e -> 'is_me'))
           from jsonb_array_elements(public.goblinstorm_board('school')) e) -> 0 -> 'bosses', '2'::jsonb,
  'the board puts most bosses beaten first');
select is(jsonb_array_length(public.goblinstorm_board('school')), 2, '... pupils only (the teacher is not on it)');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select is((select (e ->> 'value')::integer from jsonb_array_elements(public.teacher_progress_other_games(current_setting('test.cls')::uuid)) e
           where e ->> 'game' = 'goblinstorm' and e ->> 'student' = '00000000-0000-0000-0000-00000000000a'), 2,
  'the teacher''s Other games column shows bosses beaten');
select pg_temp.reset();

-- ---- my_goblinstorm: the caller's own save only ----
select pg_temp.reset();
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(public.my_goblinstorm() - 'today', '{"gold": 45, "shop": {}, "heroes": ["cleric", "wizard", "barbarian", "rogue", "dragonkid"], "bosses": [0, 1], "codex": ["arrows", "blades", "fireball"], "weapons": ["arrows", "axes", "blades", "fireball"], "runs": 3, "kills": 20280, "guideSeen": false, "bestGold": 30}'::jsonb,
  'a pupil reads their own save');
select pg_temp.reset();
select set_config('role', 'anon', true);
select throws_ok($$ select public.my_goblinstorm() $$, '42501', null, 'signed out: no save');
select pg_temp.reset();

-- ---- Stage 6: who has had the guided first go ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select lives_ok($$ select public.goblinstorm_guide_seen() $$, 'a pupil notes they have had the guide');
select is(public.my_goblinstorm() -> 'guideSeen', 'true'::jsonb, '... it is kept in their save, for any device');
select is(public.my_goblinstorm() -> 'gold', '45'::jsonb, '... and nothing else in the save changes');
select pg_temp.reset();
select is((select guide_seen from public.goblinstorm_saves where player = pg_temp.id('0b')), false, '... nor anyone else''s');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz');
select public.goblinstorm_guide_seen();
select is(public.my_goblinstorm() - 'today', '{"gold": 0, "shop": {}, "heroes": [], "bosses": [], "codex": [], "weapons": [], "runs": 0, "kills": 0, "guideSeen": true, "bestGold": 0}'::jsonb,
  'a brand-new pupil can note the guide before any run: an empty save that remembers it');
select pg_temp.reset();

select * from finish();
rollback;
