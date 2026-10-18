-- Clan Quest stage C.5 part A: saving a clan, who can reach it, a request sent twice, and the teacher reset.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(47);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000e';

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

-- A member, a clan state and the calls, the way the clans server function makes and sends them.
create function pg_temp.member(n integer, level integer default 1) returns jsonb language sql as $$
  select jsonb_build_object('name', 'Member' || n, 'race', 'Human', 'cls', 'Warrior', 'level', level, 'xp', 0, 'hp', 20, 'maxHp', 20,
    'sp', 0, 'maxSp', 0, 'stats', jsonb_build_object('agility', 8), 'spells', '[]'::jsonb, 'gear', '{}'::jsonb, 'points', 0, 'knockedOut', false)
$$;
create function pg_temp.state(who text, gold integer default 200, day integer default 1, members integer default 4) returns jsonb language sql as $$
  select jsonb_build_object(
    'clan', jsonb_build_object('name', 'Red Banner', 'gold', gold, 'followers', 0,
      'village', jsonb_build_object('trainingHall', 0, 'smithy', 0, 'church', 0), 'wakesToday', 0,
      'members', (select jsonb_agg(pg_temp.member(n)) from generate_series(1, members) n),
      'empire', jsonb_build_object('vault', 0, 'wild', 10, 'plots', '[]'::jsonb)),
    'seed', public.clan_offer_seed(pg_temp.id(who)), 'day', day, 'createdNzDay', 20000, 'fightsLeft', 8, 'fightNo', 0, 'raidNo', 0,
    'examined', '[]'::jsonb)
$$;
create function pg_temp.save(who text, version integer, request uuid, state jsonb) returns jsonb language sql as $$
  select public.save_clan(pg_temp.id(who), version, request, 'test', state, '{"type":"test"}')
$$;
create function pg_temp.req(n integer) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;

-- ---- Students can't reach any of it ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.clans $$, '42501', null, 'students cannot read clans');
select throws_ok($$ select * from public.clan_members $$, '42501', null, 'students cannot read members');
select throws_ok($$ select * from public.clan_empires $$, '42501', null, 'students cannot read empires');
select throws_ok($$ select * from public.clan_requests $$, '42501', null, 'students cannot read saved requests');
select throws_ok($$ select * from public.clan_seeds $$, '42501', null, 'students cannot read seeds');
select throws_ok($$ insert into public.clans (player, name, seed, day, created_nz_day, gold, followers, village, fights_left)
  values (pg_temp.id('a'), 'Red Banner', 1, 1, 20000, 999999, 0, '{}', 8) $$, '42501', null, 'students cannot write a clan');
select throws_ok($$ update public.clans set gold = 999999 $$, '42501', null, 'students cannot change their gold');
select throws_ok($$ select public.clan_offer_seed(pg_temp.id('a')) $$, '42501', null, 'students cannot ask for a seed directly');
select throws_ok($$ select public.load_clan(pg_temp.id('a'), pg_temp.req(1)) $$, '42501', null, 'students cannot load directly');
select throws_ok($$ select public.save_clan(pg_temp.id('a'), 0, pg_temp.req(1), 'x', '{}', '{}') $$, '42501', null, 'students cannot save directly');
select throws_ok($$ select public.teacher_reset_clan(pg_temp.id('b')) $$, '42501', null, 'students cannot reset a clan');
select pg_temp.reset();

-- ---- A new student has a seed and no clan ----
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(1)) ->> 'version', '0', 'a new student has no clan (version 0)');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(1)) -> 'state', 'null'::jsonb, '... and no state');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(1)) ->> 'seed', public.clan_offer_seed(pg_temp.id('a'))::text,
  'the seed loaded is the seed given');
select is(public.clan_offer_seed(pg_temp.id('a')), public.clan_offer_seed(pg_temp.id('a')), 'a student always gets the same seed');
select throws_ok($$ select public.clan_offer_seed(pg_temp.id('f')) $$, '22023', null, 'only school accounts (with a profile) have a clan');

-- ---- Making and loading a clan ----
select is(pg_temp.save('a', 0, pg_temp.req(1), pg_temp.state('a')) ->> 'status', 'saved', 'a first save works');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(2)) ->> 'version', '1', 'the clan is at version 1');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(2)) -> 'state' -> 'clan' ->> 'gold', '200', 'the gold comes back');
select is(jsonb_array_length(public.load_clan(pg_temp.id('a'), pg_temp.req(2)) -> 'state' -> 'clan' -> 'members'), 4, 'four members come back');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(2)) -> 'state' -> 'clan' -> 'members' -> 2 ->> 'name', 'Member3',
  '... in the order they were saved');
select is((public.load_clan(pg_temp.id('a'), pg_temp.req(2)) -> 'state' -> 'clan' -> 'empire' ->> 'wild'), '10', 'the empire comes back');
select ok(not (public.load_clan(pg_temp.id('a'), pg_temp.req(2)) -> 'state' -> 'clan' ? 'questDay'), 'no quest day yet (the key is missing, not null)');
select is(pg_temp.save('a', 0, pg_temp.req(3), pg_temp.state('a')) ->> 'status', 'stale', 'a second first-save is refused');
select throws_ok($$ select pg_temp.save('b', 0, pg_temp.req(4), pg_temp.state('a')) $$, '22023', null,
  'a first save must use the seed this student was given');

-- ---- A request sent twice counts once ----
select is(pg_temp.save('a', 1, pg_temp.req(10), jsonb_set(pg_temp.state('a', 150), '{day}', '1')) ->> 'status', 'saved', 'a change saves');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(99)) ->> 'version', '2', '... and the version goes up');
select is(pg_temp.save('a', 1, pg_temp.req(10), pg_temp.state('a', 1)) ->> 'status', 'duplicate', 'the same request again is spotted');
select is(pg_temp.save('a', 1, pg_temp.req(10), pg_temp.state('a', 1)) -> 'result' ->> 'type', 'test', '... and the first answer is given back');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(10)) -> 'replay' ->> 'type', 'test', 'load finds the earlier answer for a request');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(99)) -> 'state' -> 'clan' ->> 'gold', '150', '... and the clan was not changed again');
select is(pg_temp.save('a', 1, pg_temp.req(11), pg_temp.state('a', 100)) ->> 'status', 'stale', 'a save made from an old copy is refused');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(99)) -> 'state' -> 'clan' ->> 'gold', '150', '... and changes nothing');

-- ---- The database refuses numbers that make no sense ----
select throws_ok($$ select pg_temp.save('a', 2, pg_temp.req(20), pg_temp.state('a', -5)) $$, '23514', null, 'gold cannot go below zero');
select throws_ok($$ select pg_temp.save('a', 2, pg_temp.req(21), pg_temp.state('a', 100, 1, 3)) $$, '22023', null, 'a clan has at least four members');
select throws_ok($$ select pg_temp.save('a', 2, pg_temp.req(22), jsonb_set(pg_temp.state('a'), '{clan,name}', '"Doom Lords of Evil"')) $$, '23514', null,
  'a clan name is one adjective and one noun');
select throws_ok($$ select pg_temp.save('a', 2, pg_temp.req(23), pg_temp.state('a', 100, 0)) $$, '22023', null, 'the day only goes forwards');
select throws_ok($$ select pg_temp.save('a', 2, pg_temp.req(24), jsonb_set(pg_temp.state('a'), '{seed}', '5')) $$, '22023', null, 'the seed never changes');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(99)) ->> 'version', '2', 'a refused save leaves the version alone');

-- ---- Clans stay separate ----
select pg_temp.save('b', 0, pg_temp.req(30), pg_temp.state('b', 77));
select is(public.load_clan(pg_temp.id('b'), pg_temp.req(99)) -> 'state' -> 'clan' ->> 'gold', '77', 'another student has their own clan');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(99)) -> 'state' -> 'clan' ->> 'gold', '150', '... and the first is untouched');

-- ---- Old requests are forgotten ----
update public.clan_requests set created_at = now() - interval '3 days' where request_id = pg_temp.req(10);
select pg_temp.save('a', 2, pg_temp.req(40), jsonb_set(pg_temp.state('a', 140), '{day}', '2'));
select is((select count(*)::integer from public.clan_requests where player = pg_temp.id('a') and request_id = pg_temp.req(10)), 0,
  'requests older than two days are forgotten');

-- ---- The teacher can reset a clan ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select is(public.teacher_reset_clan(pg_temp.id('a')), true, 'a teacher can reset a clan');
select is(public.teacher_reset_clan(pg_temp.id('a')), false, '... and resetting again finds nothing');
select pg_temp.reset();
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(99)) ->> 'version', '0', 'the student has no clan again');
select is((select count(*)::integer from public.clan_members where player = pg_temp.id('a')), 0, '... no members left behind');
select is((select count(*)::integer from public.clan_requests where player = pg_temp.id('a')), 0, '... or remembered requests');

select * from finish();
rollback;
