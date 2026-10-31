-- Clan Quest "My Village" (28 Oct 2026, migration 20261028001000): one purse, building levels, raids inside a class,
-- the midnight reset of buildsToday, the "Village builders" achievement and the one-time sharing of the old chests.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
-- Sequences aren't rolled back, so say where the group numbers start (the default village is 1, the first new one 2).
select setval(pg_get_serial_sequence('public.clan_villages', 'id'), 1);
select plan(104);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cai@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'dee@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'fay@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000e';
-- Nobody is in a class to start with; then ana, ben and cai share Room 1, dee is in Room 2 and fay is in none.
update public.schools set default_class = null;
delete from public.class_members;
delete from public.class_teachers;
insert into public.classes (id, school_id, name, school_year, warp_code) values
  ('11111111-1111-4111-8111-111111111111', 1, 'Room 1', 2026, 'CDFGH'), ('22222222-2222-4222-8222-222222222222', 1, 'Room 2', 2026, 'CDFGJ');
insert into public.class_members (student_id, class_id, how) values
  ('00000000-0000-0000-0000-00000000000a', '11111111-1111-4111-8111-111111111111', 'teacher'),
  ('00000000-0000-0000-0000-00000000000b', '11111111-1111-4111-8111-111111111111', 'teacher'),
  ('00000000-0000-0000-0000-00000000000c', '11111111-1111-4111-8111-111111111111', 'teacher'),
  ('00000000-0000-0000-0000-00000000000d', '22222222-2222-4222-8222-222222222222', 'teacher');
update public.app_settings set clans_enabled = true, clan_raids_enabled = false;

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000000' || who)::uuid $$;
create function pg_temp.req(n integer) returns uuid language sql as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create function pg_temp.teacher() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz') $$;

create function pg_temp.member(n integer) returns jsonb language sql as $$
  select jsonb_build_object('name', 'Member' || n, 'race', 'Human', 'cls', 'Warrior', 'level', 2, 'xp', 40, 'hp', 20, 'maxHp', 20, 'sp', 5, 'maxSp', 5,
    'stats', jsonb_build_object('agility', 8), 'spells', '[]'::jsonb, 'gear', '{}'::jsonb, 'points', 3, 'knockedOut', false)
$$;
-- A "My Village" (version 2) empire the way the server keeps it. `lv`: building levels to set, e.g. '{"walls":2}'.
create function pg_temp.empire(lv jsonb default '{}', footmen integer default 40, shield integer default 0) returns jsonb language sql as $$
  select jsonb_build_object('version', 2,
    'levels', jsonb_build_object('trainingHall', 0, 'smithy', 0, 'church', 0, 'barracks', 0, 'walls', 0, 'tower', 0, 'forge', 0, 'strongroom', 0) || lv,
    'buildsToday', 0, 'troops', jsonb_build_object('footman', footmen, 'axeman', 0, 'knight', 0), 'day', 15, 'createdDay', 1,
    'raidsToday', 0, 'kingdomRaidsToday', 0, 'shieldUntil', shield, 'raidedToday', '[]'::jsonb)
$$;
-- An empire from before My Village (gold in a vault, plots): converted when its owner next plays.
create function pg_temp.old_empire(vault integer) returns jsonb language sql as $$
  select jsonb_build_object('vault', vault, 'wild', 5, 'claimed', 0, 'plots', '[]'::jsonb, 'troops', jsonb_build_object('footman', 40, 'axeman', 0, 'knight', 0),
    'draftPercent', 0, 'day', 15, 'createdDay', 1, 'energyUsed', 3, 'raidsToday', 0, 'kingdomRaidsToday', 0, 'shieldUntil', 0, 'raidedToday', '[]'::jsonb)
$$;
create function pg_temp.state(who text, clan_name text, emp jsonb, gold integer default 200) returns jsonb language sql as $$
  select jsonb_build_object(
    'clan', jsonb_build_object('name', clan_name, 'gold', gold, 'followers', 5,
      'village', jsonb_build_object('trainingHall', 0, 'smithy', 0, 'church', 0), 'wakesToday', 0,
      'members', (select jsonb_agg(pg_temp.member(n)) from generate_series(1, 4) n), 'empire', emp),
    'seed', public.clan_offer_seed(pg_temp.id(who)), 'day', 15, 'createdNzDay', 19000, 'fightsLeft', 8, 'fightNo', 0, 'raidNo', 0,
    'examined', '[]'::jsonb, 'fight', null)
$$;
create function pg_temp.save(who text, version integer, request integer, state jsonb, result jsonb default '{"type":"test"}') returns jsonb language sql as $$
  select public.save_clan(pg_temp.id(who), version, pg_temp.req(request), 'test', state, result)
$$;
create function pg_temp.version(who text) returns integer language sql as $$ select (public.load_clan(pg_temp.id(who), pg_temp.req(900)) ->> 'version')::integer $$;
create function pg_temp.self(who text) returns uuid language sql as $$ select (public.load_clan(pg_temp.id(who), pg_temp.req(900)) ->> 'self')::uuid $$;
create function pg_temp.gold(who text) returns integer language sql as $$ select gold from public.clans where player = pg_temp.id(who) $$;
create function pg_temp.levels(who text) returns jsonb language sql as $$ select empire -> 'levels' from public.clan_empires where player = pg_temp.id(who) $$;
create function pg_temp.has(who text, ach text) returns boolean language sql as $$ select exists (select 1 from public.achievements where player = pg_temp.id(who) and achievement = ach) $$;
-- Puts a clan's saved purse and empire straight into the tables (as the owner), without a save, so a test can set a scene.
create function pg_temp.set_clan(who text, gold integer, emp jsonb) returns void language sql as $$
  update public.clans set gold = $2 where player = pg_temp.id($1);
  update public.clan_empires set empire = $3 where player = pg_temp.id($1)
$$;
-- A raid on `defender` by `who`. The raiders' state is the saved one with the purse changed to `a_gold`. `gain`: the gold the result says was taken.
create function pg_temp.go(who text, defender text, request integer, a_gold integer, d_empire jsonb, d_gold integer, gain integer default 0,
  destroyed jsonb default '[]', news text default null, note text default null, d_version integer default null) returns jsonb language sql as $$
  select public.save_raid(pg_temp.id(who), pg_temp.version(who), pg_temp.self(defender), coalesce(d_version, pg_temp.version(defender)), pg_temp.req(request),
    jsonb_set(jsonb_set(public.load_clan(pg_temp.id(who), pg_temp.req(901)) -> 'state', '{clan,gold}', to_jsonb(a_gold)), '{raidNo}', to_jsonb(1)),
    d_empire, d_gold, jsonb_build_object('type', 'raidClass', 'take', case when jsonb_array_length(destroyed) > 0 then 'buildings' else 'gold' end,
      'gold', gain, 'destroyed', destroyed),
    coalesce(news, 'A raider from the Red Banner clan ' || case when gain > 0 then 'took ' || gain || ' gold.' when jsonb_array_length(destroyed) > 0
      then 'knocked ' || jsonb_array_length(destroyed) || case when jsonb_array_length(destroyed) = 1 then ' level' else ' levels' end || ' off the buildings.' else 'was driven off.' end),
    coalesce(note, 'A raider from the Red Banner clan ' || case when gain > 0 then 'beat your defenders and took ' || gain || ' gold from your purse.'
      when jsonb_array_length(destroyed) > 0 then 'beat your defenders and knocked ' || jsonb_array_length(destroyed)
        || case when jsonb_array_length(destroyed) = 1 then ' level' else ' levels' end || ' off your buildings.' else 'attacked, and your defenders drove them off!' end))
$$;
-- The raided clan's empire with some changes laid over what is saved.
-- The clan's state on day 102, where the midnight job above left it (a clan's day only goes forwards).
create function pg_temp.late(st jsonb) returns jsonb language sql as $$ select jsonb_set(st, '{day}', '102') $$;
create function pg_temp.dmod(who text, changes jsonb) returns jsonb language sql as $$
  select (select empire from public.clan_empires where player = pg_temp.id(who)) || changes
$$;
create function pg_temp.dlv(who text, lv jsonb) returns jsonb language sql as $$
  select jsonb_set(pg_temp.dmod(who, '{}'), '{levels}', (select empire -> 'levels' from public.clan_empires where player = pg_temp.id(who)) || lv)
$$;

-- ---- The clans: ana, ben, cai (Room 1), dee (Room 2), fay (no class). Ana is the raider. ----
select is(pg_temp.save('a', 0, 1, pg_temp.state('a', 'Red Banner', pg_temp.empire('{}', 40), 100)) ->> 'status', 'saved', 'ana''s clan is saved');
select pg_temp.save('b', 0, 2, pg_temp.state('b', 'Blue Fox', pg_temp.empire('{"strongroom":2}', 40), 1000));
select pg_temp.save('c', 0, 3, pg_temp.state('c', 'Green Owl', pg_temp.empire('{}', 40), 105));
select pg_temp.save('d', 0, 4, pg_temp.state('d', 'Gold Hawk', pg_temp.empire('{}', 40), 1000));
select pg_temp.save('f', 0, 5, pg_temp.state('f', 'Grey Wolf', pg_temp.empire('{}', 40), 1000));

-- ---- Who can call what ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.save_raid(pg_temp.id('a'), 1, pg_temp.id('b'), 1, pg_temp.req(1), '{}', '{}', 0, '{}', '', '') $$, '42501', null, 'students cannot call save_raid');
select throws_ok($$ select public.clan_my_village_share_chests() $$, '42501', null, 'students cannot share out the chests');
select pg_temp.teacher();
select throws_ok($$ select public.clan_my_village_share_chests() $$, '42501', null, '... and nor can teachers (it is run once, from the SQL editor)');
select pg_temp.reset();
select ok(has_function_privilege('service_role', 'public.save_raid(uuid, integer, uuid, integer, uuid, jsonb, jsonb, integer, jsonb, text, text)', 'execute'), 'the server can call the new save_raid');
select ok(not has_function_privilege('service_role', 'public.save_raid(uuid, integer, uuid, integer, uuid, jsonb, jsonb, jsonb, text, text)', 'execute'), '... and no longer the old one');
select ok(not has_function_privilege('service_role', 'public.clan_my_village_share_chests()', 'execute'), 'nothing in the app can run the chest sharing');

-- ---- Raid targets: the same class only ----
select is((select string_agg(x ->> 'name', ',' order by x ->> 'name') from jsonb_array_elements(public.clan_village_mates(pg_temp.id('a'))) x), 'Blue Fox,Green Owl',
  'ana can pick ben''s and cai''s clans (same class), not dee''s (another class) or fay''s (no class)');
select is((select string_agg(k, ',' order by k) from jsonb_object_keys(public.clan_village_mates(pg_temp.id('a')) -> 0) k), 'createdNzDay,id,name,shieldUntil,troops',
  'all it is told about them is a hidden id, the name, the day it began, its shield and its troops');
select is(jsonb_array_length(public.clan_village_mates(pg_temp.id('d'))), 0, 'dee is alone in her class: no one to raid');
select is(jsonb_array_length(public.clan_village_mates(pg_temp.id('f'))), 0, 'a pupil with no class gets no targets');
select is(public.clan_raid_target(pg_temp.id('a'), pg_temp.self('b')) ->> 'name', 'Blue Fox', 'a classmate''s clan can be loaded to raid');
select is((public.clan_raid_target(pg_temp.id('a'), pg_temp.self('b')) ->> 'gold')::integer, 1000, '... with its purse');
select is(public.clan_raid_target(pg_temp.id('a'), pg_temp.self('d')), null::jsonb, 'a clan in another class cannot be loaded');
select is(public.clan_raid_target(pg_temp.id('a'), pg_temp.self('f')), null::jsonb, '... nor one with no class');
select is(public.clan_raid_target(pg_temp.id('f'), pg_temp.self('a')), null::jsonb, '... and a pupil with no class cannot load anyone');
select is(public.clan_raid_target(pg_temp.id('a'), pg_temp.self('a')), null::jsonb, '... or themselves');

-- ---- A raid on gold ----
select throws_ok($$ select pg_temp.go('a', 'b', 10, 160, pg_temp.dmod('b', '{}'), 940, 60) $$, '22023', 'Raids on classmates are switched off.', 'the database refuses a raid while the class has raids off');
update public.app_settings set clan_raids_enabled = true;
select is(pg_temp.gold('a') + pg_temp.gold('b'), 1100, 'before the raid ana and ben hold 1,100 gold between them');
-- Ben has 1000 gold and a level 2 Strongroom, so 400 is safe and at most 10% of 600 = 60 can go.
select throws_ok($$ select pg_temp.go('a', 'b', 11, 161, pg_temp.dmod('b', '{}'), 939, 61) $$, '22023', 'That raid took too much.', 'taking more than 10% of what is outside the Strongroom is refused');
select throws_ok($$ select pg_temp.go('a', 'b', 12, 170, pg_temp.dmod('b', '{}'), 940, 60) $$, '22023', 'That raid made or lost something.', 'raiders gaining more than the other clan lost is refused (gold from nothing)');
select throws_ok($$ select pg_temp.go('a', 'b', 13, 160, pg_temp.dmod('b', '{}'), 930, 60) $$, '22023', 'That raid made or lost something.', 'the raided clan losing more than the raiders gained is refused');
select throws_ok($$ select pg_temp.go('a', 'b', 14, 160, pg_temp.dmod('b', '{}'), 940, 0) $$, '22023', 'That raid made or lost something.', 'gold that moved but is not in the result is refused');
select throws_ok($$ select pg_temp.go('a', 'b', 15, 160, pg_temp.dmod('b', '{"troops":{"footman":99,"axeman":0,"knight":0}}'), 940, 60) $$, '22023', 'That raid made troops.', 'a raid that gives the raided clan more troops is refused');
select throws_ok($$ select pg_temp.go('a', 'b', 16, 160, pg_temp.dmod('b', '{"day":99}'), 940, 60) $$, '22023', 'That raid changed too much.', 'a raid that changes the raided clan''s day is refused');
select throws_ok($$ select pg_temp.go('a', 'b', 17, 160, pg_temp.dmod('b', '{}'), 940, 60, '[]', 'A raider from the Red Banner clan took 60 gold from Ben Jones.') $$, '22023', 'That news could not be read.', 'a news line that says anything else is refused (it could name a pupil)');
select throws_ok($$ select pg_temp.go('a', 'b', 18, 160, pg_temp.dmod('b', '{}'), 940, 60, '[]', null, 'A raider from the Red Banner clan beat your defenders and took 60 gold from your vault.') $$, '22023', 'That news could not be read.', '... and the old "vault" wording is no longer accepted');
select is(pg_temp.go('a', 'b', 19, 160, pg_temp.dmod('b', '{"shieldUntil":19500}'), 940, 60) ->> 'status', 'saved', 'a raid for exactly 10% of the gold outside the Strongroom is saved');
select is(pg_temp.gold('a'), 160, '... the raiders have the 60 gold');
select is(pg_temp.gold('b'), 940, '... the raided clan lost it');
select is(pg_temp.gold('a') + pg_temp.gold('b'), 1100, '... nothing made or lost between them');
select is((select empire ->> 'shieldUntil' from public.clan_empires where player = pg_temp.id('b')), '19500', '... and the raided clan''s empire was saved (its shield)');
select is((select count(*)::integer from public.clan_news where text = 'A raider from the Red Banner clan took 60 gold.'), 1, '... the news has the line');
select is(public.load_clan(pg_temp.id('b'), pg_temp.req(5)) -> 'notes' ->> 0, 'A raider from the Red Banner clan beat your defenders and took 60 gold from your purse.', '... and the raided clan reads its note');
select is(public.load_clan(pg_temp.id('b'), pg_temp.req(5)) ->> 'version', '2', '... its version moved on, so an old copy cannot save over it');
select is(public.load_clan(pg_temp.id('b'), pg_temp.req(5)) -> 'state' -> 'clan' ->> 'gold', '940', '... and a reload shows the new purse');
-- The same raid again (a double tap): same request id.
select is(pg_temp.go('a', 'b', 19, 160, pg_temp.dmod('b', '{"shieldUntil":19500}'), 880, 60) ->> 'status', 'duplicate', 'the same raid sent again is spotted');
select is(pg_temp.gold('b'), 940, '... and paid once');
-- An old copy of the raided clan.
select is(pg_temp.go('a', 'b', 20, 220, pg_temp.dmod('b', '{}'), 880, 60, '[]', null, null, 1) ->> 'status', 'stale', 'a raider holding an old copy of the raided clan is turned away');
select is(pg_temp.gold('b'), 940, '... and nothing moved');

-- Rounding up: 105 gold with nothing in a Strongroom allows 11 (10.5 rounded up), not 12.
select throws_ok($$ select pg_temp.go('a', 'c', 21, 172, pg_temp.dmod('c', '{}'), 93, 12) $$, '22023', 'That raid took too much.', '10% is rounded up: 12 of 105 is too many');
select is(pg_temp.go('a', 'c', 22, 171, pg_temp.dmod('c', '{}'), 94, 11) ->> 'status', 'saved', '... and 11 of 105 is allowed');
-- Gold in the Strongroom is safe.
select pg_temp.set_clan('c', 300, pg_temp.empire('{"strongroom":2}'));
update public.clans set version = version + 1 where player = pg_temp.id('c');
select throws_ok($$ select pg_temp.go('a', 'c', 23, 172, pg_temp.dmod('c', '{}'), 299, 1) $$, '22023', 'That raid took too much.', 'a clan with 300 gold and a level 2 Strongroom has nothing to take');

-- ---- A raid on buildings ----
-- (A level 3 building put straight into the table also counts: the trigger fires on any change to a clan's empire.)
select pg_temp.set_clan('c', 500, pg_temp.empire('{"tower":3,"trainingHall":2,"walls":2,"strongroom":1,"barracks":1}'));
update public.clans set version = version + 1 where player = pg_temp.id('c');
select throws_ok($$ select pg_temp.go('a', 'c', 24, 171, pg_temp.dlv('c', '{"walls":1}'), 500, 0, '["walls"]') $$, '22023', 'That raid changed the buildings too much.', 'a raid cannot knock down the Walls');
select throws_ok($$ select pg_temp.go('a', 'c', 25, 171, pg_temp.dlv('c', '{"strongroom":0}'), 500, 0, '["strongroom"]') $$, '22023', 'That raid changed the buildings too much.', '... or the Strongroom');
select throws_ok($$ select pg_temp.go('a', 'c', 26, 171, pg_temp.dlv('c', '{"barracks":0}'), 500, 0, '["barracks"]') $$, '22023', 'That raid changed the buildings too much.', '... or the Barracks');
select throws_ok($$ select pg_temp.go('a', 'c', 27, 171, pg_temp.dlv('c', '{"smithy":1}'), 500, 0, '[]') $$, '22023', 'That raid changed the buildings too much.', 'a raid cannot build anything for the raided clan');
select throws_ok($$ select pg_temp.go('a', 'c', 28, 171, pg_temp.dlv('c', '{"tower":1}'), 500, 0, '["tower"]') $$, '22023', 'That raid made or lost something.', 'the levels lost have to match the result''s list (2 lost, 1 listed)');
select is(pg_temp.go('a', 'c', 29, 171, pg_temp.dlv('c', '{"tower":2,"trainingHall":1}'), 500, 0, '["tower","trainingHall"]') ->> 'status', 'saved', 'two levels knocked off (Tower, Training Hall) are saved');
select is(pg_temp.levels('c'), '{"trainingHall":1,"smithy":0,"church":0,"barracks":1,"walls":2,"tower":2,"forge":0,"strongroom":1}'::jsonb, '... and only those levels went down');
select is(pg_temp.gold('c'), 500, '... with the raided clan''s purse untouched');
select is((select village from public.clans where player = pg_temp.id('c')), '{"trainingHall":1,"smithy":0,"church":0}'::jsonb, '... and its Training Hall, Smithy and Church copy is kept in step');
select is((select count(*)::integer from public.clan_news where text = 'A raider from the Red Banner clan knocked 2 levels off the buildings.'), 1, '... the news says so');

-- ---- Class, yourself and a clan that is still in the old shape ----
select throws_ok($$ select pg_temp.go('a', 'd', 30, 171, pg_temp.dmod('d', '{}'), 1000) $$, '22023', 'That clan is in another class.', 'a clan in another class cannot be raided');
select throws_ok($$ select pg_temp.go('a', 'f', 31, 171, pg_temp.dmod('f', '{}'), 1000) $$, '22023', 'That clan is in another class.', '... nor one with no class');
select throws_ok($$ select pg_temp.go('f', 'a', 32, 1000, pg_temp.dmod('a', '{}'), 171) $$, '22023', 'That clan is in another class.', '... and a pupil with no class cannot raid');
select throws_ok($$ select public.save_raid(pg_temp.id('a'), pg_temp.version('a'), pg_temp.self('a'), pg_temp.version('a'), pg_temp.req(33), pg_temp.state('a', 'Red Banner', pg_temp.empire()), pg_temp.empire(), 0, '{"type":"raidClass"}', 'x', 'y') $$,
  '22023', 'That clan could not be found.', 'a clan cannot raid itself');
-- Ben is still unconverted in this scene: 800 gold in the purse and 300 more in an old vault. The raid converts him (purse 1100), then takes 11.
select pg_temp.set_clan('b', 800, pg_temp.old_empire(300));
update public.clans set version = version + 1 where player = pg_temp.id('b');
select throws_ok($$ select pg_temp.go('a', 'b', 34, 291, pg_temp.empire(), 1000, 120) $$, '22023', 'That raid took too much.', 'an unconverted clan: 120 is more than 10% of the 1,120 it would have had');
select throws_ok($$ select pg_temp.go('a', 'b', 35, 271, pg_temp.empire(), 600, 100) $$, '22023', 'That raid made or lost something.', '... and a raid that leaves it with less than it had minus the gold taken is refused');
select is(pg_temp.go('a', 'b', 36, 281, pg_temp.empire(), 990, 110) ->> 'status', 'saved', 'an unconverted clan is converted by the raid: 10% of its 1,100 is 110');
select is(pg_temp.gold('b'), 990, '... and it is left with the rest');
select is((select empire ->> 'version' from public.clan_empires where player = pg_temp.id('b')), '2', '... in the new shape');

-- ---- The midnight job ----
-- Two clans a day behind: a version 2 empire that has built and raided today, and one still in the old shape.
select pg_temp.set_clan('a', 160, jsonb_set(jsonb_set(jsonb_set(pg_temp.empire('{"tower":2}', 33, 19050), '{buildsToday}', '2'), '{raidsToday}', '1'), '{raidedToday}', '["x"]'));
select pg_temp.set_clan('f', 1000, pg_temp.old_empire(300));
update public.clan_villages set chest = 500 where id = 1;
select is((public.clan_nightly(19100) ->> 'ran')::boolean, true, 'the midnight job runs');
select is((select (empire ->> 'buildsToday')::integer from public.clan_empires where player = pg_temp.id('a')), 0, 'a My Village empire gets its builds back');
select is((select (empire ->> 'raidsToday')::integer + (empire ->> 'kingdomRaidsToday')::integer from public.clan_empires where player = pg_temp.id('a')), 0, '... and its raids');
select is((select empire -> 'raidedToday' from public.clan_empires where player = pg_temp.id('a')), '[]'::jsonb, '... and the list of clans it raided today');
select is((select empire ->> 'day' from public.clan_empires where player = pg_temp.id('a')), (select day::text from public.clans where player = pg_temp.id('a')), '... and moves on to the new day');
select is((select empire ? 'energyUsed' from public.clan_empires where player = pg_temp.id('a')), false, '... without growing an old energyUsed field');
select is((select empire -> 'levels' ->> 'tower' from public.clan_empires where player = pg_temp.id('a')), '2', '... and keeps its buildings,');
select is((select empire ->> 'shieldUntil' from public.clan_empires where player = pg_temp.id('a')), '19050', '... its shield,');
select is((select empire -> 'troops' ->> 'footman' from public.clan_empires where player = pg_temp.id('a')), '33', '... and its troops');
select is((select (empire ->> 'energyUsed')::integer from public.clan_empires where player = pg_temp.id('f')), 0, 'an empire still in the old shape is reset as before (energy back)');
select is((select empire ->> 'vault' from public.clan_empires where player = pg_temp.id('f')), '300', '... and not converted by it');
select is((select empire ? 'buildsToday' from public.clan_empires where player = pg_temp.id('f')), false, '... nor given a field it does not have');
select is((select day from public.clans where player = pg_temp.id('f')), 101, 'both clans moved on a day (clan day 101)');
select is((public.clan_nightly(19100) ->> 'ran')::boolean, false, 'the same night again does nothing');
select is((select chest from public.clan_villages where id = 1), 500, 'the midnight job leaves the old chests alone (it closes no village weeks)');
select is((public.clan_nightly(19101) ->> 'villagesClosed')::integer, 0, '... and says it closed none');

-- ---- Sharing the old chests (a one-time go-live step) ----
insert into public.clan_villages (name, closed_week, school_id) values ('Room 12', 0, 1);
insert into public.clan_village_members (player, village_id) values (pg_temp.id('a'), 2), (pg_temp.id('b'), 2);
-- Room 12 (village 2) holds ana's and ben's clans; the default village holds cai's, dee's and fay's.
select is((select count(*)::integer from public.clans c where public.clan_village_of(c.player) = 2), 2, 'Room 12 has two clans');
create temp table before_gold as select player, gold, version from public.clans;
update public.clan_villages set chest = 1001 where id = 2;
update public.clan_villages set chest = 100 where id = 1;
insert into public.clan_villages (name, closed_week, school_id) values ('Empty Room', 0, 1);
update public.clan_villages set chest = 77 where name = 'Empty Room';
create temp table shared as select public.clan_my_village_share_chests() as r;
select is((select r from shared), '{"villages":2,"clans":5,"gold":1099}'::jsonb, 'the first run shares 2 chests among 5 clans (1001 / 2 = 500 each; 100 / 3 = 33 each: 1,099 in all)');
select is(pg_temp.gold('a') - (select gold from before_gold where player = pg_temp.id('a')), 500, 'ana''s clan got half of Room 12''s chest (rounded down)');
select is(pg_temp.gold('b') - (select gold from before_gold where player = pg_temp.id('b')), 500, '... and so did ben''s');
select is(pg_temp.gold('c') - (select gold from before_gold where player = pg_temp.id('c')), 33, 'cai''s clan got a third of the default village''s chest');
select is(pg_temp.gold('d') - (select gold from before_gold where player = pg_temp.id('d')), 33, '... and dee''s');
select is(pg_temp.gold('f') - (select gold from before_gold where player = pg_temp.id('f')), 33, '... and fay''s');
select is((select chest from public.clan_villages where id = 2), 0, 'Room 12''s chest is empty');
select is((select chest from public.clan_villages where id = 1), 0, '... and so is the default village''s');
select is((select chest from public.clan_villages where name = 'Empty Room'), 77, 'a village with no clan keeps its chest');
select is((select count(*)::integer from public.clans c join before_gold b using (player) where c.version = b.version + 1), 5, 'every clan that got gold has a newer version, so an old copy cannot overwrite it');
create temp table after_first as select player, gold, version from public.clans;
select is(public.clan_my_village_share_chests(), '{"villages":0,"clans":0,"gold":0}'::jsonb, 'running it a second time gives nothing');
select is((select count(*)::integer from public.clans c join after_first a using (player) where c.gold <> a.gold or c.version <> a.version), 0, '... and changes no clan');

-- ---- load_clan after the move ----
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(5)) -> 'village', null::jsonb, 'a clan is no longer sent a village to show');
update public.clan_villages set levels = '{"trainingHall": 2, "smithy": 1, "church": 0}' where id = 2;
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(5)) -> 'groupVillage' ->> 'trainingHall', '2', 'the old group''s levels are still sent, for converting an old save');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(5)) -> 'state' -> 'clan' -> 'village' ->> 'trainingHall', '0', '... but are not laid over a clan that is already converted');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(5)) -> 'state' -> 'clan' -> 'empire' ->> 'version', '2', '... whose empire comes back as version 2');

-- ---- Village builders: level 3 on any building ----
select is(public.clan_buildings_of(pg_temp.empire('{"tower":3,"walls":1,"forge":2}')), 3, 'the buildings count of a My Village empire is the buildings with a level');
select is(public.clan_buildings_of(pg_temp.old_empire(10) || '{"plots":[{"width":3,"length":3,"building":"barracks"},{"width":3,"length":3}]}'), 1, '... and an old empire still counts plots with a building');
select ok(not pg_temp.has('d', 'cq-village'), 'a clan with no level 3 building has no Village builders (dee''s)');
select pg_temp.save('d', pg_temp.version('d'), 40, pg_temp.late(pg_temp.state('d', 'Gold Hawk', pg_temp.empire('{"smithy":2,"church":2,"forge":2}'), 500)), '{"type":"upgrade"}');
select ok(not pg_temp.has('d', 'cq-village'), 'level 2 buildings are not enough');
select pg_temp.save('d', pg_temp.version('d'), 41, pg_temp.late(pg_temp.state('d', 'Gold Hawk', pg_temp.empire('{"smithy":3,"church":2,"forge":2}'), 500)), '{"type":"upgrade"}');
select ok(pg_temp.has('d', 'cq-village'), 'a level 3 building earns Village builders in the same save');
select is((select (stats ->> 'villageBuilt')::integer from public.clans where player = pg_temp.id('d')), 1, '... counted once');
select pg_temp.save('d', pg_temp.version('d'), 42, pg_temp.late(pg_temp.state('d', 'Gold Hawk', pg_temp.empire('{"smithy":2,"church":2,"forge":2}'), 500)), '{"type":"test"}');
select ok(pg_temp.has('d', 'cq-village'), '... and a raid knocking a level off later does not take it away');
select ok(pg_temp.has('d', 'cq-buildings-5') = false, 'three buildings are not five');
select pg_temp.save('d', pg_temp.version('d'), 43, pg_temp.late(pg_temp.state('d', 'Gold Hawk', pg_temp.empire('{"smithy":2,"church":2,"forge":2,"walls":1,"tower":1}'), 500)), '{"type":"upgrade"}');
select ok(pg_temp.has('d', 'cq-buildings-5'), 'five buildings with a level earn the Five buildings achievement');

select * from finish();
rollback;
