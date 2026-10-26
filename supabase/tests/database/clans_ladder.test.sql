-- Clan Quest ladder fights (20261020000300): an open fight keeps its Battle Cry questions and marks, and an old-style fight is as before.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cai@douglaspark.school.nz'),
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
create function pg_temp.req(n integer) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;

-- A clan the way the server function saves one. `hurt`: members knocked out, with the day's chores half done.
create function pg_temp.member(n integer, hurt boolean default false) returns jsonb language sql as $$
  select jsonb_build_object('name', 'Member' || n, 'race', 'Human', 'cls', 'Warrior', 'level', 2, 'xp', 40,
    'hp', case when hurt then 0 else 20 end, 'maxHp', 20, 'sp', case when hurt then 1 else 5 end, 'maxSp', 5,
    'stats', jsonb_build_object('agility', 8), 'spells', '[]'::jsonb, 'gear', '{}'::jsonb, 'points', 3, 'knockedOut', hurt)
$$;
create function pg_temp.state(who text, day integer default 1, hurt boolean default false, fight jsonb default null, fight_no integer default 0, created integer default 20000)
returns jsonb language sql as $$
  select jsonb_build_object(
    'clan', jsonb_build_object('name', 'Red Banner', 'gold', 200, 'followers', 5,
      'village', jsonb_build_object('trainingHall', 0, 'smithy', 0, 'church', 0), 'wakesToday', case when hurt then 2 else 0 end,
      'members', (select jsonb_agg(pg_temp.member(n, hurt)) from generate_series(1, 4) n),
      'empire', jsonb_build_object('vault', 9, 'wild', 10, 'plots', '[]'::jsonb, 'day', day, 'energyUsed', case when hurt then 50 else 0 end,
        'raidsToday', case when hurt then 1 else 0 end, 'kingdomRaidsToday', case when hurt then 1 else 0 end,
        'raidedToday', case when hurt then '["x"]'::jsonb else '[]'::jsonb end, 'shieldUntil', 0)),
    'seed', public.clan_offer_seed(pg_temp.id(who)), 'day', day, 'createdNzDay', created, 'fightsLeft', case when hurt then 3 else 8 end,
    'fightNo', fight_no, 'raidNo', 0, 'examined', '[]'::jsonb, 'fight', fight)
$$;
create function pg_temp.save(who text, version integer, request integer, state jsonb, result jsonb default '{"type":"test"}') returns jsonb language sql as $$
  select public.save_clan(pg_temp.id(who), version, pg_temp.req(request), 'test', state, result)
$$;
create function pg_temp.fight(no integer, rounds jsonb default '[]', depth integer default 2) returns jsonb language sql as $$
  select jsonb_build_object('depth', depth, 'boss', false, 'seed', -123456, 'no', no,
    'settings', jsonb_build_object('enabledTopics', '["times"]'::jsonb, 'yearBand', 5), 'rounds', rounds)
$$;
create function pg_temp.round(guard boolean default true) returns jsonb language sql as $$
  select jsonb_build_object('orders', '[{"action":"guard"},null,{"action":"attack","target":1}]'::jsonb, 'cry', '{"answer":7,"reward":"damage"}'::jsonb)
$$;

create function pg_temp.ladder(no integer, marks jsonb default '[]') returns jsonb language sql as $$
  select pg_temp.fight(no) || jsonb_build_object(
    'questions', '[{"id":0,"parts":["3","+","4","=","?"],"spoken":"3 plus 4","answer":7,"factKey":"add:3+4"}]'::jsonb,
    'marks', marks)
$$;

-- ---- Pupils still can't read an open fight (now holding answers) ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select questions from public.clan_fights $$, '42501', null, 'students cannot read a ladder fight''s questions');
select pg_temp.reset();

-- Three clans with no fight yet (a new clan never starts with one).
select pg_temp.save(w, 0, n, pg_temp.state(w)) from (values ('a', 10), ('b', 11), ('c', 12)) v(w, n);

-- ---- A ladder fight is kept and given back whole ----
select is(pg_temp.save('a', 1, 1, pg_temp.state('a', fight => pg_temp.ladder(1), fight_no => 1)) ->> 'status', 'saved', 'a ladder fight saves');
select is((select jsonb_array_length(questions) from public.clan_fights where player = pg_temp.id('a')), 1, 'its questions are kept');
select is((select marks from public.clan_fights where player = pg_temp.id('a')), '[]'::jsonb, 'with no marks yet');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(50)) -> 'state' -> 'fight' -> 'questions' -> 0 ->> 'answer', '7', 'the server loads the questions back (answers included: only the function sees them)');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(50)) -> 'state' -> 'fight' -> 'marks', '[]'::jsonb, '... and the marks');

-- A check: the mark is kept, the questions stay.
select is(pg_temp.save('a', 2, 2, pg_temp.state('a', fight => pg_temp.ladder(1, '[{"answer":7,"correct":true}]'), fight_no => 1)) ->> 'status', 'saved', 'a mark saves');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(50)) -> 'state' -> 'fight' -> 'marks', '[{"answer":7,"correct":true}]'::jsonb, 'the mark is loaded back');

-- ---- An old-style fight has neither ----
select is(pg_temp.save('b', 1, 3, pg_temp.state('b', fight => pg_temp.fight(1), fight_no => 1)) ->> 'status', 'saved', 'an old-style fight saves');
select ok(not (public.load_clan(pg_temp.id('b'), pg_temp.req(50)) -> 'state' -> 'fight' ? 'questions'), 'and loads with no questions');

-- ---- Nonsense is refused ----
select throws_ok($$ select pg_temp.save('c', 1, 4, pg_temp.state('c', fight => pg_temp.fight(1) || '{"questions":[1,2,3,4,5,6,7,8,9]}'::jsonb, fight_no => 1)) $$, '23514', null, 'no more than 8 questions');

-- ---- Closing the fight removes it all ----
select is(pg_temp.save('a', 3, 5, pg_temp.state('a', fight_no => 1)) ->> 'status', 'saved', 'closing the fight saves');
select is((select count(*)::integer from public.clan_fights where player = pg_temp.id('a')), 0, '... and its questions and marks are gone with it');

select * from finish();
rollback;
