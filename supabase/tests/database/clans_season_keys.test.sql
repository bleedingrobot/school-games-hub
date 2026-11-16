-- Clan Quest season keys (migration 20261116000100): clan.season, monster, bossWins, gearVersion, repick and the open fight's monster
-- are kept by save_clan and come back from load_clan.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');

create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000000' || who)::uuid $$;
create function pg_temp.req(n integer) returns uuid language sql as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create function pg_temp.member(n integer) returns jsonb language sql as $$
  select jsonb_build_object('name', 'Member' || n, 'race', 'Human', 'cls', 'Warrior', 'level', 2, 'xp', 40, 'hp', 20, 'maxHp', 20, 'sp', 5, 'maxSp', 5,
    'stats', jsonb_build_object('agility', 8), 'spells', '[]'::jsonb, 'gear', '{}'::jsonb, 'points', 3, 'knockedOut', false)
$$;
-- A clan state; `extra` is merged into state.clan (the season keys), `fight` is state.fight.
create function pg_temp.state(who text, extra jsonb default '{}', fight jsonb default null, fight_no integer default 0) returns jsonb language sql as $$
  select jsonb_build_object(
    'clan', jsonb_build_object('name', 'Red Banner', 'gold', 200, 'followers', 5,
      'village', jsonb_build_object('trainingHall', 0, 'smithy', 0, 'church', 0), 'wakesToday', 0,
      'members', (select jsonb_agg(pg_temp.member(n)) from generate_series(1, 4) n),
      'empire', jsonb_build_object('vault', 9, 'wild', 10, 'plots', '[]'::jsonb, 'day', 1, 'energyUsed', 0, 'raidsToday', 0,
        'kingdomRaidsToday', 0, 'raidedToday', '[]'::jsonb, 'shieldUntil', 0)) || $2,
    'seed', public.clan_offer_seed(pg_temp.id(who)), 'day', 1, 'createdNzDay', 20000, 'fightsLeft', 8,
    'fightNo', $4, 'raidNo', 0, 'examined', '[]'::jsonb, 'fight', $3)
$$;
create function pg_temp.save(who text, version integer, request integer, state jsonb) returns jsonb language sql as $$
  select public.save_clan(pg_temp.id(who), version, pg_temp.req(request), 'test', state, '{"type":"test"}')
$$;
create function pg_temp.load(who text, request integer) returns jsonb language sql as $$ select public.load_clan(pg_temp.id(who), pg_temp.req(request)) -> 'state' $$;
create function pg_temp.fight(no integer, monster jsonb default null) returns jsonb language sql as $$
  select jsonb_build_object('depth', 2, 'boss', false, 'seed', -123456, 'no', no,
    'settings', jsonb_build_object('enabledTopics', '["times"]'::jsonb, 'yearBand', 5), 'rounds', '[]'::jsonb)
    || case when $2 is null then '{}'::jsonb else jsonb_build_object('monster', $2) end
$$;

-- ---- The season keys on the clan ----
select set_config('test.extra', '{"season":1,"monster":{"season":1,"tries":1,"losses":0,"lastDay":123,"supplies":{"arrows":0,"potions":1,"net":1}},"bossWins":{"2":1,"5":2},"gearVersion":2,"repick":true}', true);
select is(pg_temp.save('a', 0, 1, pg_temp.state('a', current_setting('test.extra')::jsonb)) ->> 'status', 'saved', 'a clan with the season keys is saved');
select is((pg_temp.load('a', 2) -> 'clan') - array['name', 'members', 'gold', 'followers', 'village', 'wakesToday', 'empire'], current_setting('test.extra')::jsonb,
  'the season keys come back from load_clan as they were saved');
select is(pg_temp.load('a', 2) -> 'clan' -> 'monster' -> 'supplies', '{"arrows":0,"potions":1,"net":1}'::jsonb, '... including the monster supplies');
select is(pg_temp.load('a', 2) -> 'clan' ->> 'name', 'Red Banner', '... and the ordinary clan keys are still there');

-- ---- A fight with a monster ----
select set_config('test.mon', '{"setup":{"kind":"giant","season":1,"hp":300},"siege":{"wall":4,"turn":0}}', true);
select is(pg_temp.save('a', 1, 3, pg_temp.state('a', current_setting('test.extra')::jsonb, pg_temp.fight(1, current_setting('test.mon')::jsonb), 1)) ->> 'status', 'saved',
  'an open monster fight is saved');
select is(pg_temp.load('a', 4) -> 'fight' -> 'monster', current_setting('test.mon')::jsonb, 'its monster (setup and siege) comes back in state.fight.monster');
select is(pg_temp.load('a', 4) -> 'fight' ->> 'seed', '-123456', '... with the rest of the fight');

-- ---- A later save of a fight with no monster clears it ----
select is(pg_temp.save('a', 2, 5, pg_temp.state('a', current_setting('test.extra')::jsonb, pg_temp.fight(1), 1)) ->> 'status', 'saved', 'a later save of the fight without a monster');
select ok(not (pg_temp.load('a', 6) -> 'fight' ? 'monster'), '... clears it (no monster key)');

-- ---- A fight that never had a monster ----
select is(pg_temp.save('b', 0, 10, pg_temp.state('b')) ->> 'status', 'saved', 'a clan with no season keys is saved');
select is(pg_temp.save('b', 1, 11, pg_temp.state('b', '{}', pg_temp.fight(1), 1)) ->> 'status', 'saved', '... and an ordinary fight');
select ok(not (pg_temp.load('b', 12) -> 'fight' ? 'monster'), 'an ordinary fight has no monster key');
select ok(not (pg_temp.load('b', 12) -> 'clan' ?| array['season', 'monster', 'bossWins', 'gearVersion', 'repick']), 'a clan with no extras loads without the season keys (and no nulls)');

-- ---- A monster that is not an object is refused ----
select throws_ok($$ select pg_temp.save('b', 2, 13, pg_temp.state('b', '{}', pg_temp.fight(1) || '{"monster":"giant"}', 1)) $$, '22023', 'That clan could not be read.',
  'a fight.monster that is not an object is refused');

select * from finish();
rollback;
