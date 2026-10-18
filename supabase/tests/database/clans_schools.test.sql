-- Maths focus F.2 (part 4): Clan Quest and Training with schools and classes. Each school has its own village, news,
-- scoreboard and switches; a class has its own Clan Quest settings; teachers read only their own pupils.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(51);

-- School 1 is Douglas Park (made by the migration). School 2 is made here.
select setval(pg_get_serial_sequence('public.schools', 'id'), 1);
select setval(pg_get_serial_sequence('public.clan_villages', 'id'), 1);
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id) values ('otherschool.school.nz', 2);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cai@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'head@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000001a', 'zed@otherschool.school.nz'),
  ('00000000-0000-0000-0000-00000000001e', 'ms.other@otherschool.school.nz'),
  ('00000000-0000-0000-0000-00000000001f', 'boss@otherschool.school.nz');
update public.profiles set role = 'teacher' where id in ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000001e');
update public.profiles set role = 'teacher', school_admin = true
where id in ('00000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-00000000001f');
-- Start with nobody in a class (Douglas Park's automatic class is off), so the tests set classes up themselves.
update public.schools set default_class = null;
delete from public.class_members;
delete from public.class_teachers;

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000000' || who)::uuid $$;
create function pg_temp.req(n integer) returns uuid language sql as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create function pg_temp.as_s1a() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz') $$;
create function pg_temp.as_t1() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz') $$;
create function pg_temp.as_adm1() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'head@douglaspark.school.nz') $$;
create function pg_temp.as_s2a() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000001a', 'zed@otherschool.school.nz') $$;
create function pg_temp.as_adm2() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000001f', 'boss@otherschool.school.nz') $$;
-- ids for school 2's people use 1 + letter
create function pg_temp.id2(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000001' || who)::uuid $$;

create function pg_temp.member(n integer) returns jsonb language sql as $$
  select jsonb_build_object('name', 'Member' || n, 'race', 'Human', 'cls', 'Warrior', 'level', 2, 'xp', 40, 'hp', 20, 'maxHp', 20, 'sp', 5, 'maxSp', 5,
    'stats', jsonb_build_object('agility', 8), 'spells', '[]'::jsonb, 'gear', '{}'::jsonb, 'points', 3, 'knockedOut', false)
$$;
create function pg_temp.empire() returns jsonb language sql as $$
  select jsonb_build_object('vault', 500, 'wild', 40, 'claimed', 0, 'plots', '[]'::jsonb,
    'troops', jsonb_build_object('footman', 40, 'axeman', 0, 'knight', 0), 'draftPercent', 0, 'day', 15, 'createdDay', 1, 'energyUsed', 0,
    'raidsToday', 0, 'kingdomRaidsToday', 0, 'shieldUntil', 0, 'raidedToday', '[]'::jsonb)
$$;
create function pg_temp.state(who uuid, clan_name text) returns jsonb language sql as $$
  select jsonb_build_object(
    'clan', jsonb_build_object('name', clan_name, 'gold', 200, 'followers', 5,
      'village', jsonb_build_object('trainingHall', 0, 'smithy', 0, 'church', 0), 'wakesToday', 0,
      'members', (select jsonb_agg(pg_temp.member(n)) from generate_series(1, 4) n), 'empire', pg_temp.empire()),
    'seed', public.clan_offer_seed(who), 'day', 15, 'createdNzDay', 19000, 'fightsLeft', 8, 'fightNo', 0, 'raidNo', 0,
    'examined', '[]'::jsonb, 'fight', null)
$$;
create function pg_temp.make_clan(who uuid, clan_name text, n integer) returns jsonb language sql as $$
  select public.save_clan(who, 0, pg_temp.req(n), 'test', pg_temp.state(who, clan_name), '{"type":"test"}')
$$;
create function pg_temp.loaded(who uuid) returns jsonb language sql as $$ select public.load_clan(who, pg_temp.req(900)) $$;

-- Two clans at school 1 (ana, ben), one at school 2 (zed).
select is(pg_temp.make_clan(pg_temp.id('a'), 'Red Banner', 1) ->> 'status', 'saved', 'ana makes a clan');
select is(pg_temp.make_clan(pg_temp.id('b'), 'Blue Banner', 2) ->> 'status', 'saved', 'ben makes a clan');
select is(pg_temp.make_clan(pg_temp.id2('a'), 'Green Banner', 3) ->> 'status', 'saved', 'zed makes a clan at the other school');

-- ---- Villages belong to a school ----
select is((select count(*)::int from public.clan_villages where is_default), 2, 'each school has one "Everyone else" village');
select is(public.clan_village_of(pg_temp.id('a')), 1::bigint, 'Douglas Park pupils are in village 1 as before');
select isnt(public.clan_village_of(pg_temp.id2('a')), 1::bigint, 'the other school''s pupils are in their own village');
select is((select school_id from public.clan_villages where id = public.clan_village_of(pg_temp.id2('a'))), 2, '...which belongs to the other school');
insert into public.schools (name) values ('Third School');
select is((select count(*)::int from public.clan_villages where school_id = 3 and is_default), 1, 'a school made later gets its own village straight away');

-- ---- Raids and mates never cross a school ----
select is(jsonb_array_length(public.clan_village_mates(pg_temp.id('a'))), 1, 'ana''s village mates are ben only');
select is(jsonb_array_length(public.clan_village_mates(pg_temp.id2('a'))), 0, 'zed has no village mates at the other school');
select is(public.clan_raid_target(pg_temp.id('a'), (pg_temp.loaded(pg_temp.id2('a')) ->> 'self')::uuid), null::jsonb, 'ana cannot pick zed''s clan to raid');
select isnt(public.clan_raid_target(pg_temp.id('a'), (pg_temp.loaded(pg_temp.id('b')) ->> 'self')::uuid), null::jsonb, '...but can pick ben''s');

-- ---- The scoreboard shows this school only ----
update public.clans set fame = 90 where player = pg_temp.id('a');
update public.clans set fame = 50 where player = pg_temp.id('b');
update public.clans set fame = 70 where player = pg_temp.id2('a');
select pg_temp.as_s1a();
select is((select count(*)::int from public.clan_scoreboard()), 2, 'ana sees two clans on the board');
select ok(not exists (select 1 from public.clan_scoreboard() where clan_name = 'Green Banner'), '...and not the other school''s');
select pg_temp.as_s2a();
select is((select count(*)::int from public.clan_scoreboard()), 1, 'zed sees only the other school''s clan');
select pg_temp.reset();

-- ---- Settings: the switches belong to the school and the class ----
select is(pg_temp.loaded(pg_temp.id('a')) ->> 'enabled', 'false', 'Clan Quest starts off for a pupil');
select pg_temp.as_adm1();
select is(public.teacher_set_clans(true), true, 'the school admin switches Clan Quest on');
select pg_temp.reset();
select is(pg_temp.loaded(pg_temp.id('a')) ->> 'enabled', 'true', 'ana''s school now has it on');
select is(pg_temp.loaded(pg_temp.id2('a')) ->> 'enabled', 'false', 'the other school still has it off');
select pg_temp.as_adm1();
select is(public.teacher_set_clan_maths('{"yearBand": 6, "fightsPerDay": 5}') ->> 'yearBand', '6', 'the admin changes the maths settings');
select pg_temp.reset();
select is(public.clans_settings(pg_temp.id('a')) ->> 'yearBand', '6', 'ana gets the new year band');
select is(public.clans_settings(pg_temp.id2('a')) ->> 'yearBand', '5', 'the other school''s pupil keeps year 5');
select is(public.clan_fights_per_day(pg_temp.id('a')), 5, 'ana''s night''s rest gives 5 fights');
select is(public.clan_fights_per_day(pg_temp.id2('a')), 8, 'the other school''s gives 8');
select is((public.clan_extras(pg_temp.id('a')) -> 'settings' ->> 'fightsPerDay')::int, 5, 'the server is told ana''s settings');

-- A class has its own row: a teacher's class, with ben in it.
select pg_temp.as_t1();
create temp table made as select public.teacher_create_class('Room 12', 2026, 5) as id;
grant all on made to authenticated;
select lives_ok($$ select public.teacher_add_to_class((select id from made), array['00000000-0000-0000-0000-00000000000b'::uuid]) $$, 'a teacher puts ben in their class');
select is(public.teacher_set_clans(false), false, 'the teacher switches Clan Quest off for their class');
select pg_temp.reset();
select is(pg_temp.loaded(pg_temp.id('b')) ->> 'enabled', 'false', 'ben (in the class) has it off');
select is(pg_temp.loaded(pg_temp.id('a')) ->> 'enabled', 'true', 'ana (no class) still has the school''s setting');
select pg_temp.as_t1();
select is(public.teacher_set_clan_raids(true), true, 'the teacher switches raids on for their class');
select pg_temp.reset();
select is(pg_temp.loaded(pg_temp.id('b')) ->> 'raidsOn', 'true', 'ben''s class has raids on');
select is(pg_temp.loaded(pg_temp.id('a')) ->> 'raidsOn', 'false', 'ana''s settings are untouched');

-- ---- Villages and teacher reads stay in the school and the teacher's classes ----
select pg_temp.as_adm1();
select ok(public.teacher_create_village('Room 12 group') > 1, 'a school admin makes a village group');
select pg_temp.reset();
select is((select school_id from public.clan_villages where name = 'Room 12 group'), 1, '...in their own school');
select pg_temp.as_adm1();
select is((select count(*)::int from jsonb_array_elements(public.teacher_villages() -> 'villages')), 2, 'they see their school''s two villages, not the other school''s');
select pg_temp.reset();
create temp table other_village as select public.clan_village_of(pg_temp.id2('a')) as id;
grant select on other_village to authenticated;
select pg_temp.as_adm1();
select throws_ok($$ select public.teacher_move_pupil(pg_temp.id('a'), (select id from other_village)) $$, '22023', null,
  'a school admin cannot move a pupil into another school''s village');
select throws_ok($$ select public.teacher_move_pupil(pg_temp.id2('a'), 1) $$, '42501', null, 'or move another school''s pupil');
select pg_temp.as_t1();
select is(public.teacher_clan_info(pg_temp.id('b')) ->> 'name', 'Blue Banner', 'a teacher reads the clan of a pupil in their class');
select throws_ok($$ select public.teacher_clan_info(pg_temp.id('a')) $$, '42501', null, 'but not of a pupil in no class of theirs');
select throws_ok($$ select public.teacher_reset_clan(pg_temp.id('a')) $$, '42501', null, '...nor reset it');
select throws_ok($$ select public.teacher_clan_maths_student(pg_temp.id('a')) $$, '42501', null, '...nor read their Clan Quest maths');
select throws_ok($$ select public.teacher_training_student(pg_temp.id('a')) $$, '42501', null, '...nor their Training');
select lives_ok($$ select public.teacher_training_student(pg_temp.id('b')) $$, 'a teacher reads the Training of a pupil in their class');
select pg_temp.as_adm2();
select throws_ok($$ select public.teacher_clan_info(pg_temp.id('a')) $$, '42501', null, 'the other school''s admin cannot read this school''s clans');

-- ---- The midnight job: news school by school ----
select pg_temp.reset();
insert into public.clan_fight_log (nz_date, depth, boss, result, school_id) values
  (date '1970-01-01' + 20002, 3, false, 'won', 1), (date '1970-01-01' + 20002, 4, false, 'won', 1), (date '1970-01-01' + 20002, 3, false, 'won', 2);
select is(public.clan_nightly(20003) ->> 'ran', 'true', 'the midnight job runs');
select is((select text from public.clan_news where school_id = 1 and village_id is null and text like '%won in the Mines%'), '2 fights were won in the Mines yesterday.',
  'school 1 hears about its own two wins');
select is((select text from public.clan_news where school_id = 2 and village_id is null and text like '%won in the Mines%'), 'One fight was won in the Mines yesterday.',
  'school 2 hears about its one win');
select is(jsonb_array_length(pg_temp.loaded(pg_temp.id2('a')) -> 'news'), 1, 'a pupil is told only their school''s news');

-- ---- A new fame season: only the classes that are changed ----
select pg_temp.as_adm1();
select is(public.teacher_clans_new_season('NEW SEASON') ->> 'clans', '2', 'the admin''s new season resets the two clans at their school');
select pg_temp.reset();
select is((select fame from public.clans where player = pg_temp.id('a')), 0, 'ana''s fame is reset');
select is((select fame from public.clans where player = pg_temp.id2('a')), 70, 'the other school''s fame is not');

select * from finish();
rollback;
