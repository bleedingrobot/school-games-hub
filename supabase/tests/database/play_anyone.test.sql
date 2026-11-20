-- Play anyone, stage 1 (migration 20261120000300): kids in different classes at one school can find and challenge each
-- other in Archery, Dragon Maths and Clan duels when both classes have "Play other classes" on (it starts on). Other
-- schools never; hidden kids are never listed; either class switching it off keeps both inside their own class.
-- Run on a throw-away copy: scripts/scratch-test.sh <name> supabase/tests/database/play_anyone.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

-- Ana and Ben in Room 1, Cat in Room 2, Hid in Room 2 but hidden, Dan at another school, Eve a teacher of Room 2.
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
update public.schools set default_class = null where id = 1;
delete from public.class_members where student_id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b',
  '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000f');
insert into public.classes (id, school_id, name, school_year, warp_code) values
  ('11111111-1111-4111-8111-111111111111', 1, 'Room 1', 2026, 'CDFGH'), ('22222222-2222-4222-8222-222222222222', 1, 'Room 2', 2026, 'CDFGJ');
insert into public.class_members (student_id, class_id, how) values
  ('00000000-0000-0000-0000-00000000000a', '11111111-1111-4111-8111-111111111111', 'teacher'),
  ('00000000-0000-0000-0000-00000000000b', '11111111-1111-4111-8111-111111111111', 'teacher'),
  ('00000000-0000-0000-0000-00000000000c', '22222222-2222-4222-8222-222222222222', 'teacher'),
  ('00000000-0000-0000-0000-00000000000f', '22222222-2222-4222-8222-222222222222', 'teacher');
insert into public.class_teachers (class_id, teacher_id) values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-00000000000e'), ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-00000000000e');
-- Each class has its own settings row (a class made on the My classes page gets one).
insert into public.app_settings (school_id, class_id) select school_id, id from public.classes
  where id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222')
  and not exists (select 1 from public.app_settings s where s.class_id = classes.id);
update public.app_settings set archery_enabled = true, lord_enabled = true, lord_live_arena = true, clans_enabled = true;

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.act_as_server() returns void language sql as $$
  select set_config('role', 'service_role', true), set_config('request.jwt.claims', '{"role":"service_role"}', true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000000' || who)::uuid $$;
create function pg_temp.kid(who text) returns void language sql as $$
  select pg_temp.act_as(pg_temp.id(who)::text, (case who when 'a' then 'ana' when 'b' then 'ben' when 'c' then 'cat' when 'f' then 'hid' else 'dan' end)
    || (case who when 'd' then '@otherschool.school.nz' else '@douglaspark.school.nz' end))
$$;
create function pg_temp.names(j jsonb) returns text[] language sql as $$
  select coalesce(array_agg(o ->> 'id' order by ord), '{}') from jsonb_array_elements(j -> 'online') with ordinality as t(o, ord)
$$;
create function pg_temp.room(n integer, on_ boolean) returns void language sql as $$
  select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
  select public.teacher_set_play_other_classes(on_, (repeat(n::text, 8) || '-' || repeat(n::text, 4) || '-4' || repeat(n::text, 3) || '-8' || repeat(n::text, 3) || '-' || repeat(n::text, 12))::uuid);
  select pg_temp.reset();
$$;

-- Clans for Clan duels (the same shape as clans_live_duels.test.sql).
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
create function pg_temp.req(n integer) returns uuid language sql as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create function pg_temp.pid(who text) returns uuid language sql as $$ select public_id from public.clans where player = pg_temp.id(who) $$;
select public.save_clan(pg_temp.id('a'), 0, pg_temp.req(1), 'test', pg_temp.state('a', 'Red Banner'), '{"type":"test"}');
select public.save_clan(pg_temp.id('c'), 0, pg_temp.req(2), 'test', pg_temp.state('c', 'Gold Hawk'), '{"type":"test"}');
select public.save_clan(pg_temp.id('d'), 0, pg_temp.req(3), 'test', pg_temp.state('d', 'Far Wolf'), '{"type":"test"}');

-- Dan is "here" in Dragon Maths and Clan duels too (his school has neither switched on, so he is put there by hand).
insert into public.lord_here (player) values (pg_temp.id('d'));
insert into public.clan_here (player) values (pg_temp.id('d'));
-- Heroes for Dragon Maths.
insert into public.lord_heroes (player, hero, version, season, day)
select pg_temp.id(w), '{"heroClass": "knight", "level": 3, "gold": 0}', 1, 1, '2026-11-20' from unnest(array['a', 'b', 'c', 'd', 'f']) w;

-- ---- The switch and the helper ----
select ok((select bool_and(play_other_classes) from public.app_settings), '"Play other classes" starts on everywhere');
select ok(public.plays_other_classes(pg_temp.id('a'), pg_temp.id('b')), 'Ana and Ben (same class) can play');
select ok(public.plays_other_classes(pg_temp.id('a'), pg_temp.id('c')), 'Ana and Cat (other classes, both on) can play');
select ok(not public.plays_other_classes(pg_temp.id('a'), pg_temp.id('d')), 'Ana and Dan (another school) cannot');
select pg_temp.kid('a');
select throws_ok($$ select public.teacher_set_play_other_classes(false, '22222222-2222-4222-8222-222222222222') $$, null, null, 'a pupil cannot change the switch');
select pg_temp.reset();

-- ---- Archery: everyone's here; Ana sees her class first, then Cat with her class name ----
select pg_temp.kid('c'); select public.archery_here();
select pg_temp.kid('f'); select public.archery_here();
select pg_temp.kid('d'); select public.archery_here();
select pg_temp.kid('b'); select public.archery_here();
select pg_temp.kid('a');
select is(pg_temp.names(public.archery_here()), array[pg_temp.id('b')::text, pg_temp.id('c')::text],
  'Ana sees Ben (her class) first, then Cat; not hidden Hid, not Dan from another school');
select is(public.archery_here() -> 'online' -> 0 -> 'sameClass', 'true'::jsonb, '... Ben is in her class');
select is(public.archery_here() -> 'online' -> 1 -> 'sameClass', 'false'::jsonb, '... Cat is not');
select is(public.archery_here() -> 'online' -> 1 ->> 'className', 'Room 2', '... and shows her class name');
select pg_temp.kid('d');
select is(pg_temp.names(public.archery_here()), '{}'::text[], 'Dan (another school) sees nobody');
select pg_temp.reset();

select pg_temp.act_as_server();
select is(public.archery_duel_challenge(pg_temp.id('a'), 'pa-req-001', pg_temp.id('c'), 'forest', 201, 60000) ->> 'result', 'ok',
  'Ana can challenge Cat in another class');
select is(public.archery_duel_challenge(pg_temp.id('b'), 'pa-req-002', pg_temp.id('d'), 'forest', 202, 60000) ->> 'result', 'class',
  'Ben cannot challenge Dan at another school');
select is(public.archery_duel_challenge(pg_temp.id('b'), 'pa-req-003', pg_temp.id('f'), 'forest', 203, 60000) ->> 'result', 'away',
  '... or hidden Hid');
select pg_temp.reset();

-- ---- Dragon Maths and Clan duels, with the switch on ----
select pg_temp.kid('c'); select public.lord_here(); select public.clan_duel_here();
select pg_temp.kid('a');
select ok(pg_temp.id('c')::text = any(pg_temp.names(public.lord_here())), 'Ana sees Cat in the Dragon Maths arena');
select is(jsonb_array_length(public.clan_duel_here() -> 'online'), 1, 'Ana sees Cat''s clan for Clan duels');
select is(public.clan_duel_here() -> 'online' -> 0 ->> 'className', 'Room 2', '... with her class name');
select pg_temp.act_as_server();
select is(public.lord_clash_challenge(pg_temp.id('a'), pg_temp.id('c'), 30000) ->> 'result', 'ok', 'Ana can clash with Cat');
select is(public.lord_clash_challenge(pg_temp.id('b'), pg_temp.id('d'), 30000) ->> 'result', 'class', 'Ben cannot clash with Dan at another school');
select is(public.clan_duel_challenge(pg_temp.id('a'), pg_temp.pid('c'), 30000) ->> 'result', 'ok', 'Ana''s clan can duel Cat''s');
select is(public.clan_duel_challenge(pg_temp.id('a'), pg_temp.pid('d'), 30000) ->> 'result', 'class', '... but not Dan''s at another school');
select pg_temp.reset();
-- Clear the open challenges so the next checks start fresh.
delete from public.archery_duels; delete from public.lord_clashes; delete from public.clan_duels;

-- ---- Room 2 switches it off: both sides back inside their own class ----
select pg_temp.room(2, false);
select is((select play_other_classes from public.app_settings where class_id = '22222222-2222-4222-8222-222222222222'), false, 'Eve switches Room 2 off');
select ok(exists (select 1 from public.settings_changes where class_id = '22222222-2222-4222-8222-222222222222'), '... and it is in the changes log');
select ok(not public.plays_other_classes(pg_temp.id('a'), pg_temp.id('c')), 'Ana and Cat can no longer play');
select ok(public.plays_other_classes(pg_temp.id('a'), pg_temp.id('b')), 'Ana and Ben (same class) still can');
select pg_temp.kid('a');
select is(pg_temp.names(public.archery_here()), array[pg_temp.id('b')::text], 'Ana sees only Ben now');
select pg_temp.kid('c');
select is(pg_temp.names(public.archery_here()), '{}'::text[], 'Cat (switched off) sees nobody from Room 1');
select pg_temp.act_as_server();
select is(public.archery_duel_challenge(pg_temp.id('a'), 'pa-req-004', pg_temp.id('c'), 'forest', 204, 60000) ->> 'result', 'class',
  'Ana cannot challenge Cat');
select is(public.lord_clash_challenge(pg_temp.id('a'), pg_temp.id('c'), 30000) ->> 'result', 'class', '... or clash with her');
select is(public.clan_duel_challenge(pg_temp.id('a'), pg_temp.pid('c'), 30000) ->> 'result', 'class', '... or duel her clan');
select is(public.archery_duel_challenge(pg_temp.id('a'), 'pa-req-005', pg_temp.id('b'), 'forest', 205, 60000) ->> 'result', 'ok',
  'Ana can still challenge Ben in her own class');
select pg_temp.reset();

-- ---- Only the other side off: still stopped (both classes need it on) ----
select pg_temp.room(2, true);
select pg_temp.room(1, false);
select ok(not public.plays_other_classes(pg_temp.id('c'), pg_temp.id('a')), 'Room 1 off and Room 2 on: Cat and Ana still cannot play');

select * from finish();
rollback;
