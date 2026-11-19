-- Play anyone, stage 5 (migration 20261120000900): Village Raids across the whole school. A clan in another class at the
-- same school can be listed, loaded and raided when both classes have "Play other classes" on and the raided clan's class
-- has raids on. Other schools never; hidden kids never; the Banners board (the list's banners) is the whole school.
-- Run on a throw-away copy: scripts/scratch-test.sh <name> supabase/tests/database/play_anyone_raids.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

-- Ana and Ben in Room 1, Cat in Room 2, Hid in Room 2 but hidden, Dan at another school, Eve a teacher of both rooms.
select setval(pg_get_serial_sequence('public.schools', 'id'), 1);
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id) values ('otherschool.school.nz', 2);
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'dan@otherschool.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'hid@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000e';
update public.profiles set hidden = true where id = '00000000-0000-0000-0000-00000000000f';
update public.schools set default_class = null;
delete from public.class_members;
insert into public.classes (id, school_id, name, school_year, warp_code) values
  ('11111111-1111-4111-8111-111111111111', 1, 'Room 1', 2026, 'CDFGH'), ('22222222-2222-4222-8222-222222222222', 1, 'Room 2', 2026, 'CDFGJ'),
  ('33333333-3333-4333-8333-333333333333', 2, 'Room 9', 2026, 'CDFGK');
insert into public.class_members (student_id, class_id, how) values
  ('00000000-0000-0000-0000-00000000000a', '11111111-1111-4111-8111-111111111111', 'teacher'),
  ('00000000-0000-0000-0000-00000000000b', '11111111-1111-4111-8111-111111111111', 'teacher'),
  ('00000000-0000-0000-0000-00000000000c', '22222222-2222-4222-8222-222222222222', 'teacher'),
  ('00000000-0000-0000-0000-00000000000f', '22222222-2222-4222-8222-222222222222', 'teacher'),
  ('00000000-0000-0000-0000-00000000000d', '33333333-3333-4333-8333-333333333333', 'teacher');
insert into public.class_teachers (class_id, teacher_id) values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-00000000000e'), ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-00000000000e');
-- Each class has its own settings row (a class made on the My classes page gets one).
insert into public.app_settings (school_id, class_id) select school_id, id from public.classes
  where id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333')
  and not exists (select 1 from public.app_settings s where s.class_id = classes.id);
update public.app_settings set clans_enabled = true, clan_raids_enabled = true, play_other_classes = true;

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000000' || who)::uuid $$;
create function pg_temp.req(n integer) returns uuid language sql as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create function pg_temp.room(n integer, on_ boolean) returns void language sql as $$
  select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
  select public.teacher_set_play_other_classes(on_, (repeat(n::text, 8) || '-' || repeat(n::text, 4) || '-4' || repeat(n::text, 3) || '-8' || repeat(n::text, 3) || '-' || repeat(n::text, 12))::uuid);
  select pg_temp.reset();
$$;
create function pg_temp.member(n integer) returns jsonb language sql as $$
  select jsonb_build_object('name', 'Member' || n, 'race', 'Human', 'cls', 'Warrior', 'level', 2, 'xp', 40, 'hp', 20, 'maxHp', 20, 'sp', 5, 'maxSp', 5,
    'stats', jsonb_build_object('agility', 8), 'spells', '[]'::jsonb, 'gear', '{}'::jsonb, 'points', 3, 'knockedOut', false)
$$;
create function pg_temp.state(who text, clan_name text) returns jsonb language sql as $$
  select jsonb_build_object(
    'clan', jsonb_build_object('name', clan_name, 'gold', 200, 'followers', 5,
      'village', jsonb_build_object('trainingHall', 0, 'smithy', 0, 'church', 0), 'wakesToday', 0,
      'members', (select jsonb_agg(pg_temp.member(n)) from generate_series(1, 4) n),
      'empire', jsonb_build_object('version', 2,
        'levels', jsonb_build_object('trainingHall', 0, 'smithy', 0, 'church', 0, 'barracks', 1, 'walls', 2, 'tower', 0, 'forge', 0, 'strongroom', 0),
        'buildsToday', 0, 'troops', jsonb_build_object('footman', 20, 'axeman', 0, 'knight', 0), 'day', 1, 'createdDay', 1,
        'raidsToday', 0, 'kingdomRaidsToday', 0, 'shieldUntil', 0, 'raidedToday', '[]'::jsonb)),
    'seed', public.clan_offer_seed(pg_temp.id(who)), 'day', 1, 'createdNzDay', 20400, 'fightsLeft', 8, 'fightNo', 0, 'raidNo', 0,
    'examined', '[]'::jsonb, 'fight', null)
$$;
create function pg_temp.version(who text) returns integer language sql as $$ select (public.load_clan(pg_temp.id(who), pg_temp.req(900)) ->> 'version')::integer $$;
create function pg_temp.self(who text) returns uuid language sql as $$ select (public.load_clan(pg_temp.id(who), pg_temp.req(900)) ->> 'self')::uuid $$;
create function pg_temp.mates(who text) returns jsonb language sql as $$ select public.clan_village_mates(pg_temp.id(who)) $$;
create function pg_temp.mate(who text, clan_name text) returns jsonb language sql as $$
  select x from jsonb_array_elements(pg_temp.mates(who)) x where x ->> 'name' = clan_name
$$;
-- A finished raid by ana (Red Banner) on `defender`, which held: 20 gold and 2 Banners for the raided clan.
create function pg_temp.go(defender text, clan_name text, request integer) returns jsonb language sql as $$
  select public.save_village_raid(pg_temp.id('a'), pg_temp.version('a'), pg_temp.self(defender), pg_temp.version(defender), pg_temp.req(request),
    public.load_clan(pg_temp.id('a'), pg_temp.req(901)) -> 'state',
    jsonb_build_object('type', 'fightRound', 'round', 3, 'over', true, 'raid', jsonb_build_object('name', clan_name, 'light', 'close', 'won', false, 'gold', 10, 'banners', 1)),
    20, jsonb_build_object('week', 2915, 'count', 2), jsonb_build_object('nzDay', 20406, 'paid', 1),
    'The ' || clan_name || ' clan held off a raid by the Red Banner clan!', 'Your village held off raiders from the Red Banner clan! You earned 20 gold.')
$$;

select public.save_clan(pg_temp.id('a'), 0, pg_temp.req(1), 'test', pg_temp.state('a', 'Red Banner'), '{"type":"test"}');
select public.save_clan(pg_temp.id('b'), 0, pg_temp.req(2), 'test', pg_temp.state('b', 'Blue Fox'), '{"type":"test"}');
select public.save_clan(pg_temp.id('c'), 0, pg_temp.req(3), 'test', pg_temp.state('c', 'Gold Hawk'), '{"type":"test"}');
select public.save_clan(pg_temp.id('d'), 0, pg_temp.req(4), 'test', pg_temp.state('d', 'Far Owl'), '{"type":"test"}');
select public.save_clan(pg_temp.id('f'), 0, pg_temp.req(5), 'test', pg_temp.state('f', 'Shy Wolf'), '{"type":"test"}');

-- ---- The list: my class first, then the rest of the school ----
select is((select array_agg(x ->> 'name' order by o) from jsonb_array_elements(pg_temp.mates('a')) with ordinality t(x, o)), array['Blue Fox', 'Gold Hawk'],
  'ana sees Blue Fox (her class) then Gold Hawk (Room 2); never the other school or a hidden kid');
select is(pg_temp.mate('a', 'Blue Fox') ->> 'sameClass', 'true', 'Blue Fox is in her class');
select is(pg_temp.mate('a', 'Gold Hawk') -> 'sameClass' || jsonb_build_object('c', pg_temp.mate('a', 'Gold Hawk') -> 'className'),
  'false'::jsonb || '{"c": "Room 2"}'::jsonb, 'Gold Hawk is from Room 2, with its class name');
select is(pg_temp.mate('a', 'Gold Hawk') ->> 'canRaid', 'true', '... and can be raided');
select ok(not (pg_temp.mate('a', 'Gold Hawk') ? 'gold'), '... and never shows its gold');
select is(pg_temp.mate('c', 'Red Banner') ->> 'className', 'Room 1', 'cat sees ana''s clan, from Room 1');
select is(jsonb_array_length(pg_temp.mates('d')), 0, 'dan at the other school sees none of them');

-- ---- Loading and raiding a clan in another class ----
select is(public.clan_raid_target(pg_temp.id('a'), pg_temp.self('c')) ->> 'name', 'Gold Hawk', 'ana can load Gold Hawk to raid');
select is(public.clan_raid_target(pg_temp.id('a'), pg_temp.self('d')), null::jsonb, 'never a clan at another school');
select is(public.clan_raid_target(pg_temp.id('a'), pg_temp.self('f')), null::jsonb, 'never a hidden kid''s clan');
select is(pg_temp.go('c', 'Gold Hawk', 10) ->> 'status', 'saved', 'ana''s raid on Gold Hawk is saved');
select is((select gold from public.clans where player = pg_temp.id('c')), 220, '... and Gold Hawk earns the held gold');
select is(pg_temp.mate('a', 'Gold Hawk') -> 'banners' ->> 'count', '2', 'the Banners board (whole school) shows Gold Hawk''s Banners');
select throws_ok($$ select pg_temp.go('d', 'Far Owl', 11) $$, '22023', 'That clan can''t be raided right now.', 'the save refuses another school');
select throws_ok($$ select pg_temp.go('f', 'Shy Wolf', 12) $$, '22023', 'That clan can''t be raided right now.', '... and a hidden kid');

-- ---- Either class with "Play other classes" off keeps both in their own class ----
select pg_temp.room(2, false);
select is((select array_agg(x ->> 'name') from jsonb_array_elements(pg_temp.mates('a')) x), array['Blue Fox'], 'Room 2 off: ana sees only her class');
select is(public.clan_raid_target(pg_temp.id('a'), pg_temp.self('c')), null::jsonb, '... cannot load Gold Hawk');
select throws_ok($$ select pg_temp.go('c', 'Gold Hawk', 13) $$, '22023', 'That clan can''t be raided right now.', '... nor save a raid on it');
select ok(public.clan_raid_target(pg_temp.id('a'), pg_temp.self('b')) is not null, '... and her own class is unaffected');
select pg_temp.room(2, true);
select pg_temp.room(1, false);
select is(public.clan_raid_target(pg_temp.id('a'), pg_temp.self('c')), null::jsonb, 'Room 1 off: ana cannot load Gold Hawk either');
select pg_temp.room(1, true);

-- ---- The raided clan's class has raids off: still on the board, but not a target ----
update public.app_settings set clan_raids_enabled = false where class_id = '22222222-2222-4222-8222-222222222222';
select is(pg_temp.mate('a', 'Gold Hawk') ->> 'canRaid', 'false', 'Room 2''s raids off: Gold Hawk is on the board but cannot be raided');
select is(public.clan_raid_target(pg_temp.id('a'), pg_temp.self('c')), null::jsonb, '... cannot be loaded');
select throws_ok($$ select pg_temp.go('c', 'Gold Hawk', 14) $$, '22023', 'That clan can''t be raided right now.', '... and a raid on it is refused');

select * from finish();
rollback;
