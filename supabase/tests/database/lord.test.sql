-- Dragon Maths L.4: the hero and its fights are saved by the server only, read by the student only for
-- themselves, every change follows the version it was made from, a request id counts once, one fight is open
-- at a time, a fight is finished once, and the teacher's switch is OFF until a teacher turns it on.
-- The lord server function checks and replays everything first (tested in TypeScript); these tests are about
-- the database rules around it.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(88);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000e';

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-00000000000' || who)::uuid
$$;

-- A change as the server function hands it over (already checked).
create function pg_temp.hero(gold integer default 50, level integer default 1) returns jsonb language sql as $$
  select jsonb_build_object('level', level, 'exp', 0, 'hp', 20, 'maxHp', 20, 'strength', 8, 'defence', 1, 'gold', gold, 'bank', 0,
    'gems', 0, 'kindness', 0, 'weapon', 0, 'armour', 0, 'heroClass', 'knight', 'dragonKills', 0, 'day', '2026-10-19',
    'forestLeft', 10, 'arenaLeft', 3, 'skillLeft', 3, 'masterTried', false, 'forestWins', 0, 'arenaWins', 0, 'masterWins', 0)
$$;
create function pg_temp.fight(fight_id uuid, monster text default 'slime-1', seed bigint default 12345) returns jsonb language sql as $$
  select jsonb_build_object('id', fight_id, 'kind', 'forest', 'seed', seed,
    'start', jsonb_build_object('monster', jsonb_build_object('id', monster, 'name', 'A monster'), 'monsterHp', 12, 'heroHp', 20),
    'info', jsonb_build_object('day', '2026-10-19', 'sizeUp', false))
$$;
create function pg_temp.commit(who text, expect integer, req uuid, action text default 'forest', gold integer default 50,
  open_fight jsonb default null, close_fight jsonb default null, season integer default 1) returns jsonb language sql as $$
  select public.lord_commit(pg_temp.id(who), jsonb_build_object(
    'expect', expect, 'hero', pg_temp.hero(gold), 'season', season, 'extra', '{"guess":{"secret":42}}'::jsonb,
    'openFight', open_fight, 'closeFight', close_fight,
    'event', jsonb_build_object('requestId', req, 'action', action, 'summary', '{}'::jsonb)))
$$;

-- ---- Students can't save, look up or change anything directly ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select pg_temp.commit('a', 0, gen_random_uuid(), 'start-hero') $$, '42501', null, 'a student cannot save a hero directly');
select throws_ok($$ select public.load_lord(pg_temp.id('a')) $$, '42501', null, 'a student cannot ask for a hero to check against');
select throws_ok($$ select public.record_lord_refusal(pg_temp.id('a'), 'tools', 'tools') $$, '42501', null, 'a student cannot write a refusal');
select throws_ok($$ select public.lord_server_settings('00000000-0000-0000-0000-00000000000a') $$, '42501', null, 'a student cannot call the server''s settings');
select throws_ok($$ select * from public.lord_heroes $$, '42501', null, 'students cannot read heroes');
select throws_ok($$ select * from public.lord_fights $$, '42501', null, 'students cannot read fights');
select throws_ok($$ select * from public.lord_events $$, '42501', null, 'students cannot read the history');
select throws_ok($$ select * from public.lord_refusals $$, '42501', null, 'students cannot read refusals');
select throws_ok($$ insert into public.lord_heroes (player, hero, version, season, day)
  values (pg_temp.id('a'), '{}', 1, 1, '2026-10-19') $$, '42501', null, 'students cannot write a hero');
select throws_ok($$ update public.lord_heroes set hero = '{"gold": 999999}' $$, '42501', null, 'students cannot change a hero');
select throws_ok($$ delete from public.lord_fights $$, '42501', null, 'students cannot delete a fight');
select throws_ok($$ select public.teacher_set_lord('{"enabled":true}') $$, '42501', null, 'students cannot change the settings');
select is(public.my_lord() -> 'hero', 'null'::jsonb, 'a new student has no hero');
select is(public.my_lord() -> 'settings' ->> 'enabled', 'false', 'the game is off by default');
select is(public.my_lord() -> 'settings' ->> 'forestPerDay', '10', 'ten forest fights a day by default');
select is(public.my_lord() ->> 'teacher', 'false', 'a student is not a teacher');
select is(public.my_lord() -> 'facts', '[]'::jsonb, 'a new student has no maths records');
select pg_temp.reset();

-- ---- Saving in order, once each ----
select is(pg_temp.commit('a', 0, '00000000-0000-0000-0000-0000000000f1', 'start-hero') ->> 'status', 'saved', 'the first save is kept');
select is(pg_temp.commit('a', 0, '00000000-0000-0000-0000-0000000000f1', 'start-hero') ->> 'status', 'duplicate',
  'the same request sent again is spotted, even from an old version');
select is(pg_temp.commit('a', 0, gen_random_uuid(), 'start-hero') ->> 'status', 'stale', 'a different request made from version 0 is out of date');
select is(pg_temp.commit('a', 5, gen_random_uuid()) ->> 'status', 'stale', 'a save from a version that does not exist yet is out of date too');
select is(pg_temp.commit('a', 1, gen_random_uuid(), 'bank', 20) ->> 'status', 'saved', 'the next save in line is kept');
select is((select version from public.lord_heroes where player = pg_temp.id('a')), 2, 'the version counts up');
select is((select hero ->> 'gold' from public.lord_heroes where player = pg_temp.id('a')), '20', 'the hero is the latest one');
select is((select day from public.lord_heroes where player = pg_temp.id('a')), '2026-10-19', 'the day is kept as its own column');
select is((select count(*)::integer from public.lord_events where player = pg_temp.id('a')), 2, 'each kept request is in the history once');
select is((select count(*)::integer from public.lord_heroes where player = pg_temp.id('a')), 1, 'one row per student');
select is((select action from public.lord_events where player = pg_temp.id('a') order by version desc limit 1), 'bank', 'the history says what was done');

-- ---- A hero that makes no sense is refused ----
select throws_ok($$ select public.lord_commit(pg_temp.id('b'), jsonb_build_object('expect', 0, 'hero', '"nope"'::jsonb, 'season', 1,
  'event', jsonb_build_object('requestId', gen_random_uuid(), 'action', 'start-hero', 'summary', '{}'::jsonb))) $$, '23502', null, 'a hero that is not an object is refused');
select throws_ok($$ select public.lord_commit(pg_temp.id('b'), jsonb_build_object('expect', 0, 'hero', pg_temp.hero(), 'season', 0,
  'event', jsonb_build_object('requestId', gen_random_uuid(), 'action', 'start-hero', 'summary', '{}'::jsonb))) $$, '23514', null, 'season 0 is refused');
select throws_ok($$ select public.lord_commit(pg_temp.id('b'), jsonb_build_object('expect', 0, 'hero', pg_temp.hero(), 'season', 1,
  'event', jsonb_build_object('requestId', gen_random_uuid(), 'action', 'Start Hero!', 'summary', '{}'::jsonb))) $$, '23514', null, 'an action name that is not a short code is refused');
select is((select count(*)::integer from public.lord_heroes where player = pg_temp.id('b')), 0, 'refused saves leave nothing behind');
select throws_ok($$ select public.lord_commit('00000000-0000-0000-0000-0000000000ff', jsonb_build_object('expect', 0, 'hero', pg_temp.hero(), 'season', 1,
  'event', jsonb_build_object('requestId', gen_random_uuid(), 'action', 'start-hero', 'summary', '{}'::jsonb))) $$, '22023', null, 'nobody who is not in the school can save');

-- ---- One open fight at a time, and a fight is finished once ----
select is(pg_temp.commit('a', 2, gen_random_uuid(), 'forest', 20, pg_temp.fight('00000000-0000-0000-0000-0000000000a1')) ->> 'status', 'saved', 'a fight is handed out');
select is((select status from public.lord_fights where id = '00000000-0000-0000-0000-0000000000a1'), 'open', 'it is open');
select is((select monster from public.lord_fights where id = '00000000-0000-0000-0000-0000000000a1'), 'slime-1', 'the monster is noted');
select is((select seed from public.lord_fights where id = '00000000-0000-0000-0000-0000000000a1'), 12345::bigint, 'the seed is kept');
select is((select start #>> '{monsterHp}' from public.lord_fights where id = '00000000-0000-0000-0000-0000000000a1'), '12', 'the fight as it started is kept');
select is(pg_temp.commit('a', 3, gen_random_uuid(), 'forest', 20, pg_temp.fight('00000000-0000-0000-0000-0000000000a2')) ->> 'status', 'open-fight',
  'a second fight cannot be opened');
select is((select version from public.lord_heroes where player = pg_temp.id('a')), 3, 'a refused second fight changes nothing');
select is((select count(*)::integer from public.lord_fights where player = pg_temp.id('a')), 1, 'and leaves no second fight behind');
select is((select count(*)::integer from public.lord_events where player = pg_temp.id('a')), 3, 'or a history row');
select is(public.load_lord(pg_temp.id('a')) #>> '{openFight,id}', '00000000-0000-0000-0000-0000000000a1', 'the open fight is offered again');
select is(public.load_lord(pg_temp.id('a')) #>> '{openFight,seed}', '12345', 'with its seed');
select is(public.load_lord(pg_temp.id('a')) #>> '{row,version}', '3', 'and the hero''s version');
select is(public.load_lord(pg_temp.id('a'), '00000000-0000-0000-0000-0000000000f1') ->> 'seen', 'true', 'a used request id is seen');
select is(public.load_lord(pg_temp.id('a'), gen_random_uuid()) ->> 'seen', 'false', 'a new one is not');
select is(pg_temp.commit('a', 3, gen_random_uuid(), 'fight-finish', 70, null,
  '{"id":"00000000-0000-0000-0000-0000000000a1","status":"finished","actions":[{"type":"attack"}],"result":{"outcome":"won"}}'::jsonb) ->> 'status', 'saved',
  'the fight is finished');
select is((select status from public.lord_fights where id = '00000000-0000-0000-0000-0000000000a1'), 'finished', 'and marked finished');
select is((select actions #>> '{0,type}' from public.lord_fights where id = '00000000-0000-0000-0000-0000000000a1'), 'attack', 'with what was played');
select is((select result ->> 'outcome' from public.lord_fights where id = '00000000-0000-0000-0000-0000000000a1'), 'won', 'and the result');
select is((select hero ->> 'gold' from public.lord_heroes where player = pg_temp.id('a')), '70', 'the pay went in with it');
select is(pg_temp.commit('a', 4, gen_random_uuid(), 'fight-finish', 140, null,
  '{"id":"00000000-0000-0000-0000-0000000000a1","status":"finished","actions":[],"result":{}}'::jsonb) ->> 'status', 'no-fight',
  'finishing the same fight again counts once');
select is((select hero ->> 'gold' from public.lord_heroes where player = pg_temp.id('a')), '70', 'and pays nothing more');
select is(public.load_lord(pg_temp.id('a')) -> 'openFight', 'null'::jsonb, 'no fight is offered once it is finished');
select is(pg_temp.commit('a', 4, gen_random_uuid(), 'forest', 70, pg_temp.fight('00000000-0000-0000-0000-0000000000a2')) ->> 'status', 'saved',
  'a new fight can be handed out after the last one is finished');
select is(pg_temp.commit('a', 5, gen_random_uuid(), 'tools', 70, null,
  '{"id":"00000000-0000-0000-0000-0000000000a2","status":"abandoned","actions":[],"result":{}}'::jsonb) ->> 'status', 'saved', 'a teacher can give a fight up');
select is((select status from public.lord_fights where id = '00000000-0000-0000-0000-0000000000a2'), 'abandoned', 'it is marked abandoned');
select throws_ok($$ insert into public.lord_fights (id, player, kind, monster, seed, start, status)
  values (gen_random_uuid(), pg_temp.id('a'), 'forest', 'x', 1, '{}', 'finished') $$, '23514', null, 'a finished fight must say when');
select throws_ok($$ insert into public.lord_fights (id, player, kind, monster, seed, start)
  values (gen_random_uuid(), pg_temp.id('a'), 'duel', 'x', 1, '{}') $$, '23514', null, 'a fight must be forest, master, dragon or arena');

-- ---- Each student sees only their own ----
select pg_temp.commit('b', 0, gen_random_uuid(), 'start-hero', 77);
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(public.my_lord() #>> '{hero,hero,gold}', '70', 'Ana reads her own hero');
select is(public.my_lord() #>> '{hero,version}', '6', 'with its version');
select is(public.my_lord() #>> '{hero,hero,heroClass}', 'knight', 'and class');
select is(public.my_lord() #> '{hero,extra}', null, 'the number-guess secret and the rest of the server''s notes never reach her');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is(public.my_lord() #>> '{hero,hero,gold}', '77', 'Ben reads his own hero, not Ana''s');
select is(public.my_lord() #>> '{hero,version}', '1', 'at his own version');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz');
select is(public.my_lord() -> 'hero', 'null'::jsonb, 'Cat has no hero and cannot see anyone else''s');
select pg_temp.reset();

-- ---- Refusals: a short code, not more than 30 a day each ----
select lives_ok($$ select public.record_lord_refusal(pg_temp.id('a'), 'tampered', 'fight-finish') $$, 'a refusal is noted');
select is((select reason from public.lord_refusals where player = pg_temp.id('a')), 'tampered', 'as a short code');
select pg_temp.reset();
do $$ begin for i in 1..40 loop perform public.record_lord_refusal('00000000-0000-0000-0000-00000000000b', 'proof-params', 'event'); end loop; end $$;
select is((select count(*)::integer from public.lord_refusals where player = pg_temp.id('b')), 30, 'only 30 a day are kept for one student');
select lives_ok($$ select public.record_lord_refusal(pg_temp.id('b'), 'Not A Code!!', 'Tools Now') $$, 'a sloppy code is tidied rather than breaking the save');

-- ---- Maths records: the two new packs are accepted ----
select is(public.record_fact_answers(pg_temp.id('a'), 'money', gen_random_uuid(),
  '[{"key":"money:change","correct":true,"ms":4000,"at":1792000000000},{"key":"money:change","correct":false,"ms":9000,"at":1792000001000}]', 3000, 2, 4), 2,
  'answers to a money question are recorded');
select is(public.record_fact_answers(pg_temp.id('a'), 'patterns', gen_random_uuid(),
  '[{"key":"pat:add","correct":true,"ms":2000,"at":1792000002000}]', 3000, 2, 4), 1, 'and to a pattern question');
select is((select attempts from public.gem_keep_facts where player = pg_temp.id('a') and pack = 'money' and fact_key = 'money:change'), 2,
  'in the same records every other maths game uses');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(jsonb_array_length(public.my_lord() -> 'facts'), 2, 'my_lord hands the records back so questions pick weak facts first');
select pg_temp.reset();

-- ---- The teacher's switch ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select is(public.my_lord() ->> 'teacher', 'true', 'a teacher is told they are a teacher');
select throws_ok($$ select public.teacher_set_lord('{"enabled":"yes"}') $$, '22023', 'Those settings couldn''t be read.', 'the switch must be true or false');
select throws_ok($$ select public.teacher_set_lord('{"enabled":true,"forestPerDay":0}') $$, '22023', null, 'zero forest fights is refused');
select throws_ok($$ select public.teacher_set_lord('{"enabled":true,"forestPerDay":31}') $$, '22023', null, 'so is more than 30');
select throws_ok($$ select public.teacher_set_lord('{"enabled":true,"forestPerDay":2.5}') $$, '22023', null, 'so is half a fight');
select throws_ok($$ select public.teacher_set_lord('{"enabled":true,"seasonStart":"next monday"}') $$, '22023', null, 'and a start date that is not a date');
select is((public.my_lord() -> 'settings') ->> 'enabled', 'false', 'refused settings change nothing');
select is(public.teacher_set_lord('{"enabled":true}') ->> 'enabled', 'true', 'a teacher can switch the game on');
select isnt((public.my_lord() -> 'settings') ->> 'seasonStart', null, 'switching it on with no date starts season 1 today');
select is(public.teacher_set_lord('{"enabled":true,"forestPerDay":6,"seasonStart":"2026-10-19"}') ->> 'forestPerDay', '6', 'and set the fights a day');
select is((public.my_lord() -> 'settings') ->> 'seasonStart', '2026-10-19', 'and the first day of the season');
select is(public.teacher_set_lord('{"enabled":false}') ->> 'forestPerDay', '6', 'switching off keeps the other settings');
select pg_temp.reset();
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(public.my_lord() -> 'settings' ->> 'enabled', 'false', 'students see that it is off');

select * from finish();
rollback;
