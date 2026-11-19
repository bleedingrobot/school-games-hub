-- Clan Quest Live Clan Duels (17 Nov 2026, migration 20261117000400): presence, challenges, hidden picks, one maths answer
-- per round, and prizes to both sides at the end (nothing is ever taken).
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'dee@douglaspark.school.nz');
update public.schools set default_class = null;
delete from public.class_members;
delete from public.class_teachers;
insert into public.classes (id, school_id, name, school_year, warp_code) values
  ('11111111-1111-4111-8111-111111111111', 1, 'Room 1', 2026, 'CDFGH'), ('22222222-2222-4222-8222-222222222222', 1, 'Room 2', 2026, 'CDFGJ');
insert into public.class_members (student_id, class_id, how) values
  ('00000000-0000-0000-0000-00000000000a', '11111111-1111-4111-8111-111111111111', 'teacher'),
  ('00000000-0000-0000-0000-00000000000b', '11111111-1111-4111-8111-111111111111', 'teacher'),
  ('00000000-0000-0000-0000-00000000000d', '22222222-2222-4222-8222-222222222222', 'teacher');
update public.app_settings set clans_enabled = true;
-- These checks are about one class on its own: "Play other classes" off (play_anyone.test.sql covers it on).
update public.app_settings set play_other_classes = false;

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000000' || who)::uuid $$;
create function pg_temp.req(n integer) returns uuid language sql as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create function pg_temp.member(n integer) returns jsonb language sql as $$
  select jsonb_build_object('name', 'Member' || n, 'race', 'Human', 'cls', 'Warrior', 'level', 2, 'xp', 40, 'hp', 20, 'maxHp', 20, 'sp', 5, 'maxSp', 5,
    'stats', jsonb_build_object('agility', 8), 'spells', '[]'::jsonb, 'gear', '{}'::jsonb, 'points', 3, 'knockedOut', false, 'look', 'male-1')
$$;
create function pg_temp.state(who text, clan_name text) returns jsonb language sql as $$
  select jsonb_build_object(
    'clan', jsonb_build_object('name', clan_name, 'gold', 200, 'followers', 5,
      'village', jsonb_build_object('trainingHall', 0, 'smithy', 0, 'church', 0), 'wakesToday', 0,
      'members', (select jsonb_agg(pg_temp.member(n)) from generate_series(1, 4) n),
      'empire', jsonb_build_object('version', 2,
        'levels', jsonb_build_object('trainingHall', 0, 'smithy', 0, 'church', 1, 'barracks', 2, 'walls', 3, 'tower', 1, 'forge', 4, 'strongroom', 0),
        'buildsToday', 0, 'troops', jsonb_build_object('footman', 20, 'axeman', 0, 'knight', 0), 'day', 1, 'createdDay', 1,
        'raidsToday', 0, 'kingdomRaidsToday', 0, 'shieldUntil', 0, 'raidedToday', '[]'::jsonb)),
    'seed', public.clan_offer_seed(pg_temp.id(who)), 'day', 1, 'createdNzDay', 20400, 'fightsLeft', 8, 'fightNo', 0, 'raidNo', 0,
    'examined', '[]'::jsonb, 'fight', null)
$$;
create function pg_temp.pid(who text) returns uuid language sql as $$ select public_id from public.clans where player = pg_temp.id(who) $$;
create function pg_temp.gold(who text) returns integer language sql as $$ select gold from public.clans where player = pg_temp.id(who) $$;
create function pg_temp.duel() returns public.clan_duels language sql as $$ select * from public.clan_duels order by id desc limit 1 $$;

select public.save_clan(pg_temp.id('a'), 0, pg_temp.req(1), 'test', pg_temp.state('a', 'Red Banner'), '{"type":"test"}');
select public.save_clan(pg_temp.id('b'), 0, pg_temp.req(2), 'test', pg_temp.state('b', 'Blue Fox'), '{"type":"test"}');
select public.save_clan(pg_temp.id('d'), 0, pg_temp.req(3), 'test', pg_temp.state('d', 'Gold Hawk'), '{"type":"test"}');

-- ---- Who can call what, and the switch starts on ----
select ok((select bool_and(clan_live_duels) from public.app_settings), 'live duels start switched on');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.clan_duel_challenge(pg_temp.id('a'), pg_temp.id('b'), 30000) $$, '42501', null, 'pupils cannot call the server''s steps');
select is((public.clan_duel_here() ->> 'off'), null, 'ana says she is here');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is(public.clan_duel_here() -> 'online' -> 0 ->> 'name', 'Red Banner', 'ben sees ana''s clan by its clan name');
select ok(not ((public.clan_duel_here() -> 'online' -> 0) ? 'gold'), '... and nothing else about it');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d', 'dee@douglaspark.school.nz');
select is(jsonb_array_length(public.clan_duel_here() -> 'online'), 0, 'dee (another class) sees nobody');
select pg_temp.reset();

-- ---- A challenge, a yes, hidden picks ----
select is(public.clan_duel_challenge(pg_temp.id('a'), pg_temp.pid('d'), 30000) ->> 'result', 'class', 'no duels with another class');
select is(public.clan_duel_challenge(pg_temp.id('a'), pg_temp.pid('b'), 30000) ->> 'result', 'ok', 'ana challenges ben''s clan');
select is((pg_temp.duel()).clans -> 0 -> 'village' ->> 'forge', '4', 'the duel keeps each clan''s village bonuses');
select ok(not ((pg_temp.duel()).clans::text like '%Member1%'), '... and never a hero''s name');
select is(public.clan_duel_answer(pg_temp.id('b'), (pg_temp.duel()).id, true, 60000) ->> 'result', 'ok', 'ben says yes');
select is(public.clan_duel_pick(pg_temp.id('a'), (pg_temp.duel()).id, 0, 'charge', true, 5) ->> 'result', 'ok', 'ana picks');
select is(public.clan_duel_pick(pg_temp.id('a'), (pg_temp.duel()).id, 0, 'volley', true, 6) ->> 'result', 'already', '... once a round');
select public.clan_duel_round((pg_temp.duel()).id, (pg_temp.duel()).version, '[[{"move":"charge","right":true},{"move":"volley","right":true}]]', '{0,0}', (extract(epoch from now()) * 1000 + 60000)::bigint);
select public.clan_duel_pick(pg_temp.id('a'), (pg_temp.duel()).id, 1, 'charge', true, 5);
select is(public.clan_duel_round_picks((pg_temp.duel()).id, 1) -> 0 ->> 'right', 'false', 'the same maths answer can''t power a second round');

-- ---- The end: both sides paid, nothing taken ----
select is((public.clan_duel_end((pg_temp.duel()).id, (pg_temp.duel()).version, 'done', 'finished', 0::smallint, null, null, '{40,15}', '{3,1}', 3)).gold, '{40,15}'::integer[], 'a finished duel pays both sides');
select is(array[pg_temp.gold('a'), pg_temp.gold('b')], array[240, 215], '... into their purses');
select is((select (empire -> 'banners' ->> 'count')::integer from public.clan_empires where player = pg_temp.id('b')), 1, '... and Banners on the week''s board');
select is((pg_temp.duel()).status, 'done', 'the duel is over');

select * from finish();
rollback;
