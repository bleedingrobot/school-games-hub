-- Clan Quest stage C.6 part A: the class village (groups, chest, weekly vote). Raids on classmates are in clans_my_village.test.sql
-- (since "My Village" they work inside a class, not a group, and move the purse instead of the vault). The old village tables, the
-- vote, the chest and clan_village_close stay in the database unused, so they are still checked here, but the midnight job no
-- longer closes village weeks and load_clan no longer sends a clan its village (only the group's levels, for the one-off conversion).
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
-- Sequences aren't rolled back, so say where the group numbers start (the default village is 1, the first new one 2).
select setval(pg_get_serial_sequence('public.clan_villages', 'id'), 1);
select plan(90);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cai@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'dee@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'fay@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000e';

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
select throws_ok($$ select public.save_raid(pg_temp.id('a'), 1, pg_temp.id('b'), 1, pg_temp.req(1), '{}', '{}', 0, '{}', '', '') $$, '42501', null, 'students cannot call save_raid');
select throws_ok($$ select public.clan_village_mates(pg_temp.id('b')) $$, '42501', null, 'students cannot list the classmates');
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
select throws_ok($$ select public.teacher_move_pupil(pg_temp.id('e'), 2) $$, '42501', null, 'a teacher is not moved into a village');
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
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(5)) -> 'village', null::jsonb, 'a clan is no longer sent a village (chest, votes) to show');

-- ---- The old group's levels: sent for the one-off conversion, never laid over the clan ----
update public.clan_villages set levels = '{"trainingHall": 2, "smithy": 0, "church": 1}' where id = 2;
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(5)) -> 'groupVillage' ->> 'trainingHall', '2', 'the clan is sent its old group''s Training Hall level, for converting an old save');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(5)) -> 'groupVillage' ->> 'church', '1', '... and Church level');
select is(public.load_clan(pg_temp.id('c'), pg_temp.req(5)) -> 'groupVillage' ->> 'trainingHall', '0', '... and another group''s are its own');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(5)) -> 'state' -> 'clan' -> 'village' ->> 'trainingHall', '0', 'but the clan''s own village is what it saved, not the group''s');
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
select is((select count(*)::integer from public.clan_votes where player in (pg_temp.id('a'), pg_temp.id('b')) and kind = 'smithy'), 2, 'the votes are kept (nothing shows them any more)');
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
select is((public.clan_nightly(pg_temp.monday() + 7) ->> 'villagesClosed')::integer, 0, 'on the Monday the midnight job no longer closes village weeks');
select is(pg_temp.chest(2), 1000, '... so nothing is built by it');
-- clan_village_close itself stays (unused): closing last week by hand still works as it did.
select public.clan_village_close(v.id, public.clan_nz_week(), current_date) from public.clan_villages v order by v.id;
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
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(5)) -> 'groupVillage' ->> 'smithy', '1', '... and the old group''s levels sent for conversion have the new Smithy');
select is(public.load_clan(pg_temp.id('c'), pg_temp.req(5)) -> 'news', '[]'::jsonb, 'another village does not');
select public.clan_village_close(3, public.clan_nz_week() + 1, current_date);
select is(pg_temp.chest(3), 10, 'a chest that is too small builds nothing and keeps its gold');
select is((select text from public.clan_news where village_id = 3), 'The class voted for the Smithy (level 1) but the chest was 240 gold short.',
  'a tie goes to the cheaper building, and the news says how short the chest was');
select is((select levels from public.clan_villages where id = 3), '{"trainingHall": 0, "smithy": 0, "church": 0}'::jsonb, '... and no level went up');
select is((select count(*)::integer from information_schema.columns where table_schema = 'public' and table_name in ('clan_news', 'clan_votes', 'clan_villages')
  and column_name in ('student', 'name_of_student', 'user_id', 'email')), 0, 'the news has no place for a student''s name');

-- ---- The raids switch ----
select pg_temp.teacher();
select is(public.teacher_set_clan_raids(true), true, 'a teacher switches raids on');
select pg_temp.reset();

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
