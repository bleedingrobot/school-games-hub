-- Clan Quest stage C.6 part A: the class village (groups, chest, weekly vote) and raids on classmates.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(130);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cai@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'dee@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'fay@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000e';

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
-- An empire the way the server keeps it: gold in the vault, land, plots (the third argument is how many plots have a barracks), troops.
create function pg_temp.empire(vault integer, wild integer, buildings integer default 0, footmen integer default 40, shield integer default 0) returns jsonb language sql as $$
  select jsonb_build_object('vault', vault, 'wild', wild, 'claimed', 0,
    'plots', coalesce((select jsonb_agg(jsonb_build_object('width', 3, 'length', 3, 'building', 'barracks')) from generate_series(1, buildings)), '[]'::jsonb),
    'troops', jsonb_build_object('footman', footmen, 'axeman', 0, 'knight', 0), 'draftPercent', 0, 'day', 15, 'createdDay', 1, 'energyUsed', 0,
    'raidsToday', 0, 'kingdomRaidsToday', 0, 'shieldUntil', shield, 'raidedToday', '[]'::jsonb)
$$;
create function pg_temp.state(who text, clan_name text, emp jsonb, gold integer default 200, raid_no integer default 0) returns jsonb language sql as $$
  select jsonb_build_object(
    'clan', jsonb_build_object('name', clan_name, 'gold', gold, 'followers', 5,
      'village', jsonb_build_object('trainingHall', 0, 'smithy', 0, 'church', 0), 'wakesToday', 0,
      'members', (select jsonb_agg(pg_temp.member(n)) from generate_series(1, 4) n), 'empire', emp),
    'seed', public.clan_offer_seed(pg_temp.id(who)), 'day', 15, 'createdNzDay', 19000, 'fightsLeft', 8, 'fightNo', 0, 'raidNo', raid_no,
    'examined', '[]'::jsonb, 'fight', null)
$$;
create function pg_temp.save(who text, version integer, request integer, state jsonb, result jsonb default '{"type":"test"}') returns jsonb language sql as $$
  select public.save_clan(pg_temp.id(who), version, pg_temp.req(request), 'test', state, result)
$$;
create function pg_temp.version(who text) returns integer language sql as $$ select (public.load_clan(pg_temp.id(who), pg_temp.req(900)) ->> 'version')::integer $$;
create function pg_temp.self(who text) returns uuid language sql as $$ select (public.load_clan(pg_temp.id(who), pg_temp.req(900)) ->> 'self')::uuid $$;
create function pg_temp.vault(who text) returns integer language sql as $$ select (empire ->> 'vault')::integer from public.clan_empires where player = pg_temp.id(who) $$;
create function pg_temp.chest(vid bigint) returns integer language sql as $$ select chest from public.clan_villages where id = vid $$;
-- A raid on `defender` by `who`, with the empires after it. gold: how much the raiders took.
create function pg_temp.raid(who text, defender text, request integer, a_version integer, d_version integer, state jsonb, d_empire jsonb,
  news text default 'A raider from the Red Banner clan took 40 gold.', note text default 'A raider from the Red Banner clan beat your defenders and took 40 gold from your vault.')
returns jsonb language sql as $$
  select public.save_raid(pg_temp.id(who), a_version, pg_temp.self(defender), d_version, pg_temp.req(request), state, d_empire,
    '{"type":"raidClass","take":"gold","gold":40,"land":0,"destroyed":[]}'::jsonb, news, note)
$$;

-- ---- Students can't reach any of it ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.clan_villages $$, '42501', null, 'students cannot read villages');
select throws_ok($$ select * from public.clan_village_members $$, '42501', null, 'students cannot read who is in which village');
select throws_ok($$ select * from public.clan_votes $$, '42501', null, 'students cannot read votes');
select throws_ok($$ select * from public.clan_raid_notes $$, '42501', null, 'students cannot read raid notes');
select throws_ok($$ update public.clan_villages set chest = 99999 $$, '42501', null, 'students cannot fill the chest');
select throws_ok($$ select public.clan_vote(pg_temp.id('a'), 'church') $$, '42501', null, 'students cannot call the vote function directly');
select throws_ok($$ select public.save_raid(pg_temp.id('a'), 1, pg_temp.id('b'), 1, pg_temp.req(1), '{}', '{}', '{}', '', '') $$, '42501', null, 'students cannot call save_raid');
select throws_ok($$ select public.clan_village_mates(pg_temp.id('b')) $$, '42501', null, 'students cannot list a village');
select throws_ok($$ select public.teacher_villages() $$, '42501', null, 'students cannot see the groups');
select throws_ok($$ select public.teacher_create_village('Mine') $$, '42501', null, 'students cannot make a group');
select throws_ok($$ select public.teacher_move_pupil(pg_temp.id('a'), 1) $$, '42501', null, 'students cannot move a pupil');
select throws_ok($$ select public.teacher_set_clan_raids(true) $$, '42501', null, 'students cannot switch raids on');
select ok((select clan_raids_enabled from public.app_settings) is false, 'raids on classmates are off until a teacher turns them on');
select pg_temp.reset();

-- ---- Groups ----
select is((select name from public.clan_villages where id = 1), 'Everyone else', 'the default village always exists');
select is(public.clan_village_of(pg_temp.id('a')), 1::bigint, 'a pupil nobody moved is in the default village');
select pg_temp.teacher();
select ok(public.teacher_create_village('Room 12') > 1, 'a teacher can make a group');
select throws_ok($$ select public.teacher_create_village('<script>') $$, '22023', null, 'a group name is plain letters and numbers');
select throws_ok($$ select public.teacher_create_village('') $$, '22023', null, '... and not empty');
select pg_temp.reset();
select is((select id from public.clan_villages where name = 'Room 12'), 2::bigint, 'the new group is number 2 (the default kept number 1)');
select pg_temp.teacher();
select public.teacher_move_pupil(pg_temp.id('a'), 2);
select public.teacher_move_pupil(pg_temp.id('b'), 2);
select public.teacher_move_pupil(pg_temp.id('d'), 2);
select throws_ok($$ select public.teacher_move_pupil(pg_temp.id('a'), 99) $$, '22023', null, 'a pupil cannot be moved to a group that is not there');
select throws_ok($$ select public.teacher_move_pupil(pg_temp.id('e'), 2) $$, '22023', null, 'a teacher is not moved into a village');
select is((public.teacher_villages() -> 'villages' -> 1 ->> 'pupils')::integer, 3, 'the group has three pupils');
select is((public.teacher_villages() -> 'villages' -> 0 ->> 'pupils')::integer, 2, '... and the others stay in the default one (c and f)');
select pg_temp.reset();
select is(public.clan_village_of(pg_temp.id('b')), 2::bigint, 'a moved pupil is in their group');
select is(public.clan_village_of(pg_temp.id('c')), 1::bigint, '... and the rest are not');

-- ---- Clans and the village on them ----
select is(pg_temp.save('a', 0, 1, pg_temp.state('a', 'Red Banner', pg_temp.empire(500, 10))) ->> 'status', 'saved', 'a clan is saved');
select pg_temp.save('b', 0, 2, pg_temp.state('b', 'Blue Fox', pg_temp.empire(800, 10, 2)));
select pg_temp.save('c', 0, 3, pg_temp.state('c', 'Green Owl', pg_temp.empire(300, 10)));
select pg_temp.save('d', 0, 4, pg_temp.state('d', 'Gold Hawk', pg_temp.empire(100, 10, 0, 40)));
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(5)) -> 'village' ->> 'name', 'Room 12', 'a clan is told its village');
select is(public.load_clan(pg_temp.id('c'), pg_temp.req(5)) -> 'village' ->> 'name', 'Everyone else', '... the default one if it was not moved');
select is((public.load_clan(pg_temp.id('a'), pg_temp.req(5)) -> 'village' ->> 'clans')::integer, 3, 'the village counts its clans (three in Room 12)');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(5)) -> 'village' ->> 'chest', '0', 'the chest starts empty');

-- ---- The village's levels are put on the clan ----
update public.clan_villages set levels = '{"trainingHall": 2, "smithy": 0, "church": 1}' where id = 2;
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(5)) -> 'state' -> 'clan' -> 'village' ->> 'trainingHall', '2', 'the clan loads with its village''s Training Hall level');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(5)) -> 'state' -> 'clan' -> 'village' ->> 'church', '1', '... and Church level');
select is(public.load_clan(pg_temp.id('c'), pg_temp.req(5)) -> 'state' -> 'clan' -> 'village' ->> 'trainingHall', '0', '... and another village''s are its own');
update public.clan_villages set levels = '{"trainingHall": 0, "smithy": 0, "church": 0}' where id = 2;
select throws_ok($$ update public.clan_villages set levels = '{"trainingHall": 6, "smithy": 0, "church": 0}' where id = 2 $$, '23514', null, 'a building cannot go past its top level');

-- ---- The chest ----
select is(pg_temp.save('a', 1, 10, pg_temp.state('a', 'Red Banner', pg_temp.empire(500, 10), 150), '{"type":"chestGive","gold":50}') ->> 'status', 'saved', 'a pupil gives 50 gold');
select is(pg_temp.chest(2), 50, '... and the chest has it');
select is(pg_temp.save('a', 2, 10, pg_temp.state('a', 'Red Banner', pg_temp.empire(500, 10), 100), '{"type":"chestGive","gold":50}') ->> 'status', 'duplicate', 'the same gift sent twice');
select is(pg_temp.chest(2), 50, '... is only counted once');
select throws_ok($$ select pg_temp.save('a', 2, 11, pg_temp.state('a', 'Red Banner', pg_temp.empire(500, 10), 150), '{"type":"chestGive","gold":50}') $$, '22023', null,
  'a gift the purse did not pay for is refused');
select throws_ok($$ select pg_temp.save('a', 2, 12, pg_temp.state('a', 'Red Banner', pg_temp.empire(500, 10), 150), '{"type":"chestGive","gold":-50}') $$, '22023', null, 'a negative gift is refused');
select throws_ok($$ select pg_temp.save('a', 2, 13, pg_temp.state('a', 'Red Banner', pg_temp.empire(500, 10), 150), '{"type":"chestGive","gold":0}') $$, '22023', null, '... and so is nothing');
select is(pg_temp.save('a', 1, 14, pg_temp.state('a', 'Red Banner', pg_temp.empire(500, 10), 100), '{"type":"chestGive","gold":50}') ->> 'status', 'stale',
  'a gift made from an old copy of the clan is turned away');
select is(pg_temp.chest(2), 50, '... and the chest did not move');
select is(pg_temp.chest(1), 0, 'the default village''s chest is separate');
select pg_temp.save('c', 1, 15, pg_temp.state('c', 'Green Owl', pg_temp.empire(300, 10), 170), '{"type":"chestGive","gold":30}');
select is(pg_temp.chest(1), 30, 'a pupil in the default village fills that chest');
select throws_ok($$ update public.clan_villages set chest = -1 where id = 2 $$, '23514', null, 'the chest can never be negative');

-- ---- The vote ----
select is(public.clan_vote(pg_temp.id('a'), 'church') ->> 'ok', 'true', 'a pupil votes');
select is(public.clan_vote(pg_temp.id('a'), 'smithy') ->> 'ok', 'true', '... and changes their mind');
select is((select count(*)::integer from public.clan_votes where player = pg_temp.id('a')), 1, '... but only has one vote');
select is(public.clan_vote(pg_temp.id('b'), 'smithy') ->> 'ok', 'true', 'another pupil votes the same');
select is(public.clan_vote(pg_temp.id('f'), 'smithy') ->> 'why', 'no-clan', 'a pupil with no clan cannot vote');
select throws_ok($$ select public.clan_vote(pg_temp.id('a'), 'castle') $$, '22023', null, 'there is no such building');
select is(public.load_clan(pg_temp.id('b'), pg_temp.req(5)) -> 'village' -> 'votes' ->> 'smithy', '2', 'the village shows the votes so far');
select is(public.load_clan(pg_temp.id('b'), pg_temp.req(5)) -> 'village' ->> 'myVote', 'smithy', '... and your own');
select is(public.load_clan(pg_temp.id('c'), pg_temp.req(5)) -> 'village' -> 'votes', '{}'::jsonb, 'another village does not see them');
update public.clan_villages set levels = '{"trainingHall": 0, "smithy": 6, "church": 0}' where id = 1;
select is(public.clan_vote(pg_temp.id('c'), 'smithy') ->> 'why', 'built', 'a finished building cannot be voted for');
update public.clan_villages set levels = '{"trainingHall": 0, "smithy": 0, "church": 0}' where id = 1;

-- ---- A pupil who is moved takes their vote back ----
select pg_temp.teacher();
select public.teacher_move_pupil(pg_temp.id('d'), 2);
select pg_temp.reset();
select public.clan_vote(pg_temp.id('d'), 'church');
select is((select count(*)::integer from public.clan_votes where village_id = 2), 3, 'three pupils have voted in Room 12');
select pg_temp.teacher();
select public.teacher_move_pupil(pg_temp.id('d'), null);
select pg_temp.reset();
select is((select count(*)::integer from public.clan_votes where village_id = 2), 2, 'moving a pupil takes their vote back');
select is(public.clan_village_of(pg_temp.id('d')), 1::bigint, '... and puts them in the default village');
select pg_temp.teacher();
select public.teacher_move_pupil(pg_temp.id('d'), 2);
select pg_temp.reset();

-- ---- The midnight job closes the week once ----
select is(public.clan_village_cost('church', 2), 800, 'a church level costs its level times 400');
select is(public.clan_village_cost('smithy', 3), 750, '... a smithy 250 a level');
select is(public.clan_village_cost('trainingHall', 1), 300, '... a training hall 300 a level');
select is(public.clan_village_max('trainingHall') * 100 + public.clan_village_max('smithy') * 10 + public.clan_village_max('church'), 563, 'the top levels are 5, 6 and 3');
select is(public.clan_nz_week(4), public.clan_nz_week(3) + 1, 'a week starts on Monday (day 4 was Monday 5 January 1970)');
select is(public.clan_nz_week(10), public.clan_nz_week(4), '... and ends on Sunday');
create function pg_temp.monday() returns integer language sql as $$ select public.clan_nz_week() * 7 - 3 $$;
update public.clan_villages set chest = 1000 where id = 2;
select pg_temp.teacher();
select public.teacher_create_village('Room 14');
select pg_temp.reset();
update public.clan_villages set chest = 10 where id = 3;
insert into public.clan_votes (village_id, week, player, kind) values
  (3, public.clan_nz_week() + 1, pg_temp.id('f'), 'smithy'), (3, public.clan_nz_week() + 1, pg_temp.id('c'), 'trainingHall');
select is((public.clan_nightly(pg_temp.monday() + 6) ->> 'ran')::boolean, true, 'the job runs on the Sunday of the vote''s week');
select is(pg_temp.chest(2), 1000, '... and builds nothing yet (the week is not over)');
select is(public.clan_nightly(pg_temp.monday() + 6) ->> 'ran', 'false', 'the same night again does nothing');
select is((public.clan_nightly(pg_temp.monday() + 7) ->> 'villagesClosed')::integer, 3, 'on the Monday every village closes last week''s vote');
select is(pg_temp.chest(2), 750, 'Room 12 built the Smithy for 250 gold, taken from the chest');
select is((select levels ->> 'smithy' from public.clan_villages where id = 2), '1', '... and it is level 1');
select is((select levels ->> 'church' from public.clan_villages where id = 2), '0', '... and nothing else changed');
select is((select count(*)::integer from public.clan_news where village_id = 2 and text = 'The class built the Smithy (level 1)!'), 1, 'one news line says so');
select is((select count(*)::integer from public.clan_news where village_id = 1), 0, 'a village where nobody voted gets no news');
select is(pg_temp.chest(1), 30, '... and keeps its gold');
select is((public.clan_nightly(pg_temp.monday() + 8) ->> 'villagesClosed')::integer, 0, 'the next night closes nothing again');
select is(pg_temp.chest(2), 750, '... the vote is not counted twice');
select is((select levels ->> 'smithy' from public.clan_villages where id = 2), '1', '... or built twice');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(5)) -> 'news' ->> 0, 'The class built the Smithy (level 1)!', 'the village sees its news');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(5)) -> 'state' -> 'clan' -> 'village' ->> 'smithy', '1', '... and the clan has the new Smithy');
select is(public.load_clan(pg_temp.id('c'), pg_temp.req(5)) -> 'news', '[]'::jsonb, 'another village does not');
select is((public.clan_nightly(pg_temp.monday() + 14) ->> 'villagesClosed')::integer, 3, 'the next Monday closes the next week''s vote');
select is(pg_temp.chest(3), 10, 'a chest that is too small builds nothing and keeps its gold');
select is((select text from public.clan_news where village_id = 3), 'The class voted for the Smithy (level 1) but the chest was 240 gold short.',
  'a tie goes to the cheaper building, and the news says how short the chest was');
select is((select levels from public.clan_villages where id = 3), '{"trainingHall": 0, "smithy": 0, "church": 0}'::jsonb, '... and no level went up');
select is((select count(*)::integer from information_schema.columns where table_schema = 'public' and table_name in ('clan_news', 'clan_votes', 'clan_villages')
  and column_name in ('student', 'name_of_student', 'user_id', 'email')), 0, 'the news has no place for a student''s name');

-- ---- Raids on classmates ----
-- The midnight job has moved the clans on, so these start from the clan as it is saved now. st(): the raiders' clan after a raid.
create function pg_temp.cur(who text) returns jsonb language sql as $$ select public.load_clan(pg_temp.id(who), pg_temp.req(901)) -> 'state' $$;
create function pg_temp.st(who text, vault integer, gold integer, clan_name text default null, wild integer default null, plots jsonb default null) returns jsonb language sql as $$
  select jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(pg_temp.cur(who), '{clan,empire,vault}', to_jsonb(vault)), '{clan,gold}', to_jsonb(gold)),
    '{clan,name}', to_jsonb(coalesce(clan_name, pg_temp.cur(who) -> 'clan' ->> 'name'))),
    '{clan,empire,wild}', to_jsonb(coalesce(wild, (pg_temp.cur(who) -> 'clan' -> 'empire' ->> 'wild')::integer))),
    '{clan,empire,plots}', coalesce(plots, pg_temp.cur(who) -> 'clan' -> 'empire' -> 'plots')),
    '{raidNo}', to_jsonb((pg_temp.cur(who) ->> 'raidNo')::integer + 1))
$$;
-- The raided clan's empire after a raid: as saved, with the vault (and optionally the footmen, wild land or plots) changed.
create function pg_temp.de(who text, vault integer, footmen integer default null, wild integer default null, plots jsonb default null) returns jsonb language sql as $$
  select (pg_temp.cur(who) -> 'clan' -> 'empire') || jsonb_build_object('vault', vault)
    || case when footmen is null then '{}'::jsonb else jsonb_build_object('troops', jsonb_build_object('footman', footmen, 'axeman', 0, 'knight', 0)) end
    || case when wild is null then '{}'::jsonb else jsonb_build_object('wild', wild) end
    || case when plots is null then '{}'::jsonb else jsonb_build_object('plots', plots) end
$$;
create function pg_temp.go(who text, defender text, request integer, state jsonb, d_empire jsonb, news text default null, note text default null) returns jsonb language sql as $$
  select public.save_raid(pg_temp.id(who), pg_temp.version(who), pg_temp.self(defender), pg_temp.version(defender), pg_temp.req(request), state, d_empire,
    '{"type":"raidClass"}'::jsonb,
    coalesce(news, 'A raider from the ' || (state -> 'clan' ->> 'name') || ' clan took 40 gold.'),
    coalesce(note, 'A raider from the ' || (state -> 'clan' ->> 'name') || ' clan beat your defenders and took 40 gold from your vault.'))
$$;

select throws_ok($$ select pg_temp.go('a', 'b', 20, pg_temp.st('a', 540, 100), pg_temp.de('b', 760)) $$,
  '22023', 'Raids on classmates are switched off.', 'the database refuses a raid while the teacher has raids off');
select pg_temp.teacher();
select is(public.teacher_set_clan_raids(true), true, 'a teacher switches raids on');
select pg_temp.reset();
select is(pg_temp.vault('a') + pg_temp.vault('b'), 1300, 'before the raid the two vaults hold 1,300 gold');
select is(pg_temp.go('a', 'b', 20, pg_temp.st('a', pg_temp.vault('a') + 40, 100), pg_temp.de('b', pg_temp.vault('b') - 40)) ->> 'status', 'saved',
  'a raid is saved: gold moved from one empire to the other');
select is(pg_temp.vault('a') + pg_temp.vault('b'), 1300, '... nothing made or lost between them');
select is(pg_temp.vault('b'), 760, '... the raided clan lost the 40');
select is((select gold from public.clans where player = pg_temp.id('a')), 100, 'the raiders'' purse is whatever the state said (a raid never touches it)');
select is((select count(*)::integer from public.clan_news where text = 'A raider from the Red Banner clan took 40 gold.' and village_id = 2), 1, 'the village news has the line');
select is((select count(*)::integer from public.clan_raid_notes where defender = pg_temp.id('b')), 1, 'the raided clan has a private note');
select is(public.load_clan(pg_temp.id('b'), pg_temp.req(5)) -> 'notes' ->> 0, 'A raider from the Red Banner clan beat your defenders and took 40 gold from your vault.', '... which it is shown next time');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(5)) -> 'notes', '[]'::jsonb, '... and the raiders have none');
select is(public.load_clan(pg_temp.id('c'), pg_temp.req(5)) -> 'news', '[]'::jsonb, 'another village does not see the line');

-- The same raid sent again (a double tap, a dropped connection): same request id.
select is(public.save_raid(pg_temp.id('a'), 1, pg_temp.self('b'), 1, pg_temp.req(20), pg_temp.st('a', 580, 100), pg_temp.de('b', 720), '{"type":"raidClass"}',
  'A raider from the Red Banner clan took 40 gold.', 'A raider from the Red Banner clan beat your defenders and took 40 gold from your vault.') ->> 'status', 'duplicate',
  'the same raid sent again is spotted');
select is(pg_temp.vault('b'), 760, '... and paid once');
select is((select count(*)::integer from public.clan_raid_notes where defender = pg_temp.id('b')), 1, '... with one note');

-- Two raiders at once on the same clan: the second one's copy of the raided clan is old.
select is(public.save_raid(pg_temp.id('d'), pg_temp.version('d'), pg_temp.self('b'), pg_temp.version('b') - 1, pg_temp.req(31), pg_temp.st('d', pg_temp.vault('d') + 40, 100),
  pg_temp.de('b', 720), '{"type":"raidClass"}', 'A raider from the Gold Hawk clan took 40 gold.',
  'A raider from the Gold Hawk clan beat your defenders and took 40 gold from your vault.') ->> 'status', 'stale',
  'a second raider holding an old copy of the raided clan is turned away');
select is(pg_temp.vault('b'), 760, '... and nothing moved');
select is(pg_temp.vault('d'), 100, '... for either of them');
select is(pg_temp.go('d', 'b', 31, pg_temp.st('d', 140, 100), pg_temp.de('b', 720)) ->> 'status', 'saved', 'with a fresh copy the same raid goes through');
select is(pg_temp.vault('d') + pg_temp.vault('b'), 860, '... and still nothing made or lost');

-- Refused: another village, yourself, things made out of nothing, and news that says anything but the raiders' clan.
select throws_ok($$ select pg_temp.go('c', 'b', 40, pg_temp.st('c', 340, 100), pg_temp.de('b', 680)) $$, '22023', 'That clan is in another village.', 'a clan in another village cannot be raided');
select throws_ok($$ select public.save_raid(pg_temp.id('a'), pg_temp.version('a'), pg_temp.self('a'), pg_temp.version('a'), pg_temp.req(41), pg_temp.st('a', pg_temp.vault('a') + 40, 100),
  pg_temp.de('a', 720), '{"type":"raidClass"}', 'x', 'y') $$, '22023', 'That clan could not be found.', 'a clan cannot raid itself');
select throws_ok($$ select pg_temp.go('a', 'b', 42, pg_temp.st('a', 900, 100), pg_temp.de('b', 500)) $$, '22023', 'That raid made or lost something.', 'a raid that makes gold out of nothing is refused');
select throws_ok($$ select pg_temp.go('a', 'b', 43, pg_temp.st('a', pg_temp.vault('a') + 40, 100, null, 25), pg_temp.de('b', pg_temp.vault('b') - 40)) $$, '22023', 'That raid made or lost something.', 'a raid that makes land is refused');
select throws_ok($$ select pg_temp.go('a', 'b', 44, pg_temp.st('a', pg_temp.vault('a') + 40, 100, null, null, '[{"width":3,"length":3,"building":"barracks"}]'), pg_temp.de('b', pg_temp.vault('b') - 40)) $$,
  '22023', 'That raid made or lost something.', 'a raid that builds buildings is refused');
select throws_ok($$ select pg_temp.go('a', 'b', 45, pg_temp.st('a', pg_temp.vault('a') + 40, 100), pg_temp.de('b', pg_temp.vault('b') - 40, 99)) $$, '22023', 'That raid made troops.', 'a raid that gives the raided clan more troops is refused');
select throws_ok($$ select pg_temp.go('a', 'b', 46, pg_temp.st('a', pg_temp.vault('a') + 40, 100), pg_temp.de('b', pg_temp.vault('b') - 40), 'A raider from the Red Banner clan took 40 gold from Ana Smith.') $$,
  '22023', 'That news could not be read.', 'a news line that says anything else is refused (it could name a pupil)');
select throws_ok($$ select pg_temp.go('a', 'b', 47, pg_temp.st('a', pg_temp.vault('a') + 40, 100), pg_temp.de('b', pg_temp.vault('b') - 40), null, 'Ben Jones: the Red Banner clan took your gold') $$,
  '22023', 'That news could not be read.', 'and so is a note that does');
select throws_ok($$ select pg_temp.go('a', 'b', 48, pg_temp.st('a', pg_temp.vault('a') + 40, 100, 'Blue Fox'), pg_temp.de('b', pg_temp.vault('b') - 40), 'A raider from the Red Banner clan took 40 gold.') $$,
  '22023', 'That news could not be read.', 'the line must name the raiders'' own clan');
select is((select count(*)::integer from public.clan_news where village_id = 2 and text like 'A raider%'), 2, 'the refused raids left no news behind');
select is(pg_temp.vault('b'), 720, '... and no gold moved');

-- ---- Who is in the village ----
select is(jsonb_array_length(public.clan_village_mates(pg_temp.id('a'))), 2, 'a clan''s village mates are the other two clans in Room 12');
select is((select string_agg(k, ',' order by k) from jsonb_object_keys(public.clan_village_mates(pg_temp.id('a')) -> 0) k), 'createdNzDay,id,name,shieldUntil,troops',
  'and all it is told about them is a hidden id, the name, the day it began, its shield and its troops');
select is(public.clan_village_mates(pg_temp.id('a')) -> 0 ->> 'id' = pg_temp.id('b')::text, false, 'the id is not the pupil''s account id');
select is(public.clan_raid_target(pg_temp.id('a'), pg_temp.self('b')) ->> 'name', 'Blue Fox', 'a classmate in the village can be loaded to raid');
select is(public.clan_raid_target(pg_temp.id('a'), pg_temp.self('c')), null, '... one in another village cannot');
select is(public.clan_raid_target(pg_temp.id('a'), pg_temp.self('a')), null, '... and neither can yourself');

-- ---- Tidying and the teacher's reset ----
insert into public.clan_raid_notes (defender, text, created_at) values (pg_temp.id('b'), 'A raider from the Red Banner clan attacked, and your defenders drove them off!', now() - interval '3 days');
select public.clan_nightly(pg_temp.monday() + 20);
select is((select count(*)::integer from public.clan_raid_notes where created_at < now() - interval '2 days'), 0, 'raid notes are forgotten after two days');
select pg_temp.teacher();
select public.teacher_reset_clan(pg_temp.id('b'));
select pg_temp.reset();
select is((select count(*)::integer from public.clan_raid_notes where defender = pg_temp.id('b')), 0, 'resetting a clan takes its notes with it');
select is(public.clan_village_of(pg_temp.id('b')), 2::bigint, '... but the pupil stays in their group');
select pg_temp.teacher();
select is(public.teacher_delete_village(1), false, 'the default village cannot be deleted');
select is(public.teacher_delete_village(3), true, 'a group can be deleted');
select public.teacher_delete_village(2);
select pg_temp.reset();
select is(public.clan_village_of(pg_temp.id('a')), 1::bigint, 'its pupils go back to the default village');
select is((select count(*)::integer from public.clan_votes where village_id = 2), 0, '... and its votes go');

select * from finish();
rollback;
