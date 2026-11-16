-- Clan Quest waiting question (migration 20261116000200): state.ask and state.askNo are kept by save_clan and come back
-- from load_clan, so a shop, quest or siege answer can be checked against the question that was asked.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');

create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000000' || who)::uuid $$;
create function pg_temp.req(n integer) returns uuid language sql as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create function pg_temp.member(n integer) returns jsonb language sql as $$
  select jsonb_build_object('name', 'Member' || n, 'race', 'Human', 'cls', 'Warrior', 'level', 2, 'xp', 40, 'hp', 20, 'maxHp', 20, 'sp', 5, 'maxSp', 5,
    'stats', jsonb_build_object('agility', 8), 'spells', '[]'::jsonb, 'gear', '{}'::jsonb, 'points', 3, 'knockedOut', false)
$$;
-- A clan state; `extra` is merged into the state itself (ask, askNo).
create function pg_temp.state(who text, extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object(
    'clan', jsonb_build_object('name', 'Red Banner', 'gold', 500, 'followers', 5,
      'village', jsonb_build_object('trainingHall', 0, 'smithy', 0, 'church', 0), 'wakesToday', 0,
      'members', (select jsonb_agg(pg_temp.member(n)) from generate_series(1, 4) n),
      'empire', jsonb_build_object('vault', 9, 'wild', 10, 'plots', '[]'::jsonb, 'day', 1, 'energyUsed', 0, 'raidsToday', 0,
        'kingdomRaidsToday', 0, 'raidedToday', '[]'::jsonb, 'shieldUntil', 0)),
    'seed', public.clan_offer_seed(pg_temp.id(who)), 'day', 1, 'createdNzDay', 20000, 'fightsLeft', 8,
    'fightNo', 0, 'raidNo', 0, 'examined', '[]'::jsonb, 'fight', null) || $2
$$;
create function pg_temp.save(who text, version integer, request integer, state jsonb) returns jsonb language sql as $$
  select public.save_clan(pg_temp.id(who), version, pg_temp.req(request), 'test', state, '{"type":"test"}')
$$;
create function pg_temp.load(who text, request integer) returns jsonb language sql as $$ select public.load_clan(pg_temp.id(who), pg_temp.req(request)) -> 'state' $$;

-- A shop question as the rules keep it (answer included).
select set_config('test.ask', '{"for":"shop","no":1,"questions":[{"key":"add:50+50","parts":["?","+","50","=","100"],"answer":50}]}', true);

-- ---- No question waiting ----
select is(pg_temp.save('a', 0, 1, pg_temp.state('a')) ->> 'status', 'saved', 'a clan with no question waiting is saved');
select ok(not (pg_temp.load('a', 2) ?| array['ask', 'askNo']), 'it loads with no ask and no askNo (no nulls)');

-- ---- The bug: the question asked is still there when the answer comes ----
select is(pg_temp.save('a', 1, 3, pg_temp.state('a', jsonb_build_object('ask', current_setting('test.ask')::jsonb, 'askNo', 1))) ->> 'status', 'saved',
  'a clan with a shop question waiting is saved');
select is(pg_temp.load('a', 4) -> 'ask', current_setting('test.ask')::jsonb, 'the waiting question comes back from load_clan as it was saved');
select is(pg_temp.load('a', 4) ->> 'askNo', '1', '... with the ask counter');

-- ---- Marked by askCheck ----
select is(pg_temp.save('a', 2, 5, pg_temp.state('a', jsonb_build_object('ask', current_setting('test.ask')::jsonb || '{"marks":[{"answer":50,"correct":true}]}', 'askNo', 1))) ->> 'status', 'saved',
  'the question with its mark is saved');
select is(pg_temp.load('a', 6) -> 'ask' -> 'marks', '[{"answer":50,"correct":true}]'::jsonb, 'the mark comes back');

-- ---- Bought: the question is used up, the counter stays ----
select is(pg_temp.save('a', 3, 7, pg_temp.state('a', '{"ask":null,"askNo":1}')) ->> 'status', 'saved', 'the buy (question used up) is saved');
select ok(not (pg_temp.load('a', 8) ? 'ask'), 'no question waiting after it');
select is(pg_temp.load('a', 8) ->> 'askNo', '1', '... and the counter is kept, so the next question is a new one');

-- ---- Odd values are refused ----
select throws_ok($$ select pg_temp.save('a', 4, 9, pg_temp.state('a', '{"ask":"shop"}')) $$, '22023', 'That clan could not be read.',
  'an ask that is not an object is refused');
select throws_ok($$ select pg_temp.save('a', 4, 10, pg_temp.state('a', '{"askNo":"two"}')) $$, '22023', 'That clan could not be read.',
  'an askNo that is not a number is refused');

select * from finish();
rollback;
