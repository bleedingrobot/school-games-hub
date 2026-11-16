-- Clan Quest Village Raids (17 Nov 2026, migration 20261117000300): classmates' sketches and heroes, and save_village_raid,
-- which saves a finished raid without ever taking anything from the raided clan.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

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
update public.app_settings set clans_enabled = true, clan_raids_enabled = true;

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
    'stats', jsonb_build_object('agility', 8), 'spells', '[]'::jsonb, 'gear', '{}'::jsonb, 'points', 3, 'knockedOut', false)
$$;
create function pg_temp.empire() returns jsonb language sql as $$
  select jsonb_build_object('version', 2,
    'levels', jsonb_build_object('trainingHall', 0, 'smithy', 0, 'church', 0, 'barracks', 1, 'walls', 2, 'tower', 0, 'forge', 0, 'strongroom', 0),
    'buildsToday', 0, 'troops', jsonb_build_object('footman', 20, 'axeman', 0, 'knight', 0), 'day', 1, 'createdDay', 1,
    'raidsToday', 0, 'kingdomRaidsToday', 0, 'shieldUntil', 0, 'raidedToday', '[]'::jsonb)
$$;
create function pg_temp.state(who text, clan_name text) returns jsonb language sql as $$
  select jsonb_build_object(
    'clan', jsonb_build_object('name', clan_name, 'gold', 200, 'followers', 5,
      'village', jsonb_build_object('trainingHall', 0, 'smithy', 0, 'church', 0), 'wakesToday', 0,
      'members', (select jsonb_agg(pg_temp.member(n)) from generate_series(1, 4) n), 'empire', pg_temp.empire()),
    'seed', public.clan_offer_seed(pg_temp.id(who)), 'day', 1, 'createdNzDay', 20400, 'fightsLeft', 8, 'fightNo', 0, 'raidNo', 0,
    'examined', '[]'::jsonb, 'fight', null)
$$;
create function pg_temp.version(who text) returns integer language sql as $$ select (public.load_clan(pg_temp.id(who), pg_temp.req(900)) ->> 'version')::integer $$;
create function pg_temp.self(who text) returns uuid language sql as $$ select (public.load_clan(pg_temp.id(who), pg_temp.req(900)) ->> 'self')::uuid $$;
create function pg_temp.gold(who text) returns integer language sql as $$ select gold from public.clans where player = pg_temp.id(who) $$;
create function pg_temp.emp(who text) returns jsonb language sql as $$ select empire from public.clan_empires where player = pg_temp.id(who) $$;
-- A finished raid by ana on `defender`: the raiders' saved state with 10 more gold, and what the raided clan gets.
create function pg_temp.go(defender text, request integer, won boolean, d_gold integer, d_count integer, news text default null,
  note text default null, d_version integer default null) returns jsonb language sql as $$
  select public.save_village_raid(pg_temp.id('a'), pg_temp.version('a'), pg_temp.self(defender), coalesce(d_version, pg_temp.version(defender)), pg_temp.req(request),
    jsonb_set(public.load_clan(pg_temp.id('a'), pg_temp.req(901)) -> 'state', '{clan,gold}', to_jsonb(pg_temp.gold('a') + 10)),
    jsonb_build_object('type', 'fightRound', 'round', 3, 'over', true, 'raid', jsonb_build_object('name', 'Blue Fox', 'light', 'close', 'won', won, 'gold', 10, 'banners', 1)),
    d_gold, jsonb_build_object('week', 2915, 'count', d_count), jsonb_build_object('nzDay', 20406, 'paid', 1),
    coalesce(news, case when won then 'The Red Banner clan raided the Blue Fox clan and won!' else 'The Blue Fox clan held off a raid by the Red Banner clan!' end),
    coalesce(note, case when won then 'Raiders from the Red Banner clan got past your walls. Nothing was taken.'
      else 'Your village held off raiders from the Red Banner clan!' || case when d_gold > 0 then ' You earned ' || d_gold || ' gold.' else '' end end))
$$;

select public.save_clan(pg_temp.id('a'), 0, pg_temp.req(1), 'test', pg_temp.state('a', 'Red Banner'), '{"type":"test"}');
select public.save_clan(pg_temp.id('b'), 0, pg_temp.req(2), 'test', pg_temp.state('b', 'Blue Fox'), '{"type":"test"}');
select public.save_clan(pg_temp.id('d'), 0, pg_temp.req(3), 'test', pg_temp.state('d', 'Gold Hawk'), '{"type":"test"}');

-- ---- Who can call what ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.save_village_raid(pg_temp.id('a'), 1, pg_temp.id('b'), 1, pg_temp.req(1), '{}', '{}', 0, '{}', '{}', '', '') $$,
  '42501', null, 'students cannot call save_village_raid');
select pg_temp.reset();
select ok(has_function_privilege('service_role', 'public.save_village_raid(uuid, integer, uuid, integer, uuid, jsonb, jsonb, integer, jsonb, jsonb, text, text)', 'execute'),
  'the server can call save_village_raid');

-- ---- What a raider may know about classmates ----
select is(jsonb_array_length(public.clan_village_mates(pg_temp.id('a'))), 1, 'ana sees the one other clan in her class');
select is(public.clan_village_mates(pg_temp.id('a')) -> 0 ->> 'name', 'Blue Fox', '... Blue Fox');
select is((public.clan_village_mates(pg_temp.id('a')) -> 0 ->> 'heroLevels')::integer, 8, '... with its heroes'' levels added up');
select ok(not (public.clan_village_mates(pg_temp.id('a')) -> 0 ? 'gold'), '... and never its gold');
select is(jsonb_array_length(public.clan_raid_target(pg_temp.id('a'), pg_temp.self('b')) -> 'members'), 4, 'a raid target comes with its four heroes');
select is(public.clan_raid_target(pg_temp.id('a'), pg_temp.self('d')), null, 'a clan in another class cannot be a target');

-- ---- A raid the village held: the raided clan is paid, and nothing is taken ----
select is(pg_temp.go('b', 10, false, 20, 2) ->> 'status', 'saved', 'a held raid is saved');
select is(pg_temp.gold('b'), 220, 'the raided clan earns the held gold');
select is(pg_temp.gold('a'), 210, 'the raiders keep what the game paid them');
select is(pg_temp.emp('b') -> 'banners', '{"week": 2915, "count": 2}'::jsonb, 'the raided clan has its Banners');
select is(pg_temp.emp('b') -> 'levels', pg_temp.empire() -> 'levels', 'its buildings are untouched');
select is(pg_temp.emp('b') -> 'troops', pg_temp.empire() -> 'troops', '... and its troops');
select is((select count(*)::integer from public.clan_raid_notes where defender = pg_temp.id('b')), 1, 'the raided clan gets a note');
select is(pg_temp.go('b', 10, false, 20, 2) ->> 'status', 'duplicate', 'the same request again pays nothing more');
select is(pg_temp.gold('b'), 220, '... the raided clan''s gold is unchanged');

-- ---- What the save refuses ----
select throws_ok($$ select pg_temp.go('b', 11, true, 20, 2) $$, '22023', 'That raid paid too much.', 'a won raid pays the raided clan nothing');
select throws_ok($$ select pg_temp.go('b', 12, false, 0, 9) $$, '22023', 'That raid gave too many Banners.', 'Banners go up by 2 at most');
select throws_ok($$ select pg_temp.go('b', 13, false, 0, 2, 'The Red Banner clan took everything!') $$, '22023', 'That news could not be read.', 'only the game''s own news lines');
select throws_ok($$ select pg_temp.go('d', 14, false, 0, 0, 'The Gold Hawk clan held off a raid by the Red Banner clan!') $$, '22023', 'That clan is in another class.', 'never a clan in another class');
update public.app_settings set clan_raids_enabled = false;
select throws_ok($$ select pg_temp.go('b', 15, false, 0, 2) $$, '22023', 'Raids on classmates are switched off.', 'the teacher''s switch is checked');

select * from finish();
rollback;
