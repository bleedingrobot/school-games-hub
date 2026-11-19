-- Play anyone, stage 2 (migration 20261120000400): a pupil with only the hub open (hub_here) counts as here for Archery,
-- Dragon Maths and Clan duels, for 75 seconds. Every stage 1 rule still holds for them: not hidden, same school, "Play other
-- classes", each game's switch. hub_here() says which games have a challenge waiting. Inside one transaction now() does not
-- move, so old check-ins are made by setting seen_at back.
-- Run on a throw-away copy: scripts/scratch-test.sh <name> supabase/tests/database/play_anyone_hub.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

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

-- Dan has no game open in Dragon Maths or Clan duels (hub only, below). Heroes for Dragon Maths.
insert into public.lord_heroes (player, hero, version, season, day)
select pg_temp.id(w), '{"heroClass": "knight", "level": 3, "gold": 0}', 1, 1, '2026-11-20' from unnest(array['a', 'b', 'c', 'd', 'f']) w;
create function pg_temp.hub_rows(who text) returns bigint language sql as $$ select count(*) from public.hub_here where player = pg_temp.id(who) $$;
create function pg_temp.set_room2(col text, on_ boolean) returns void language plpgsql as $$
begin
  execute format('update public.app_settings set %I = $1 where class_id = %L', col, '22222222-2222-4222-8222-222222222222') using on_;
end $$;
create function pg_temp.clear() returns void language plpgsql as $$
begin
  delete from public.archery_duels; delete from public.lord_clashes; delete from public.clan_duels;
end $$;

-- ---- Check-ins: only a pupil who is not hidden is recorded ----
select pg_temp.kid('f');
select is(public.hub_here() -> 'waiting', '[]'::jsonb, 'a hidden pupil gets nothing back');
select pg_temp.act_as(pg_temp.id('e')::text, 'eve@douglaspark.school.nz');
select is(public.hub_here() -> 'waiting', '[]'::jsonb, 'a teacher gets nothing back');
select pg_temp.reset();
select is(pg_temp.hub_rows('f') + pg_temp.hub_rows('e'), 0::bigint, '... and neither is recorded');
select pg_temp.kid('b'); select public.hub_here();
select pg_temp.kid('c'); select public.hub_here();
select pg_temp.kid('d'); select public.hub_here();
select pg_temp.reset();
-- A hidden pupil with a stray row (hidden after checking in) is still left out of lists.
insert into public.hub_here (player) values (pg_temp.id('f'));
select is(pg_temp.hub_rows('b') + pg_temp.hub_rows('c') + pg_temp.hub_rows('d'), 3::bigint, 'Ben, Cat and Dan are recorded');

-- ---- Pupils with only the hub open are listed ----
select pg_temp.kid('a');
select is(pg_temp.names(public.archery_here()), array[pg_temp.id('b')::text, pg_temp.id('c')::text],
  'Archery: Ana sees Ben and Cat, who only have the hub open (not hidden Hid, not Dan at another school)');
select is(pg_temp.names(public.lord_here()), array[pg_temp.id('b')::text, pg_temp.id('c')::text], 'Dragon Maths: the same');
select is(jsonb_array_length(public.clan_duel_here() -> 'online'), 1, 'Clan duels: Cat''s clan is listed (Ben has no clan)');
select pg_temp.reset();

-- ---- ... and can be challenged ----
select pg_temp.act_as_server();
select is(public.archery_duel_challenge(pg_temp.id('a'), 'hub-req-001', pg_temp.id('c'), 'forest', 301, 60000) ->> 'result', 'ok', 'Archery: Ana can challenge hub-only Cat');
select pg_temp.clear();
select is(public.lord_clash_challenge(pg_temp.id('a'), pg_temp.id('c'), 30000) ->> 'result', 'ok', 'Dragon Maths: Ana can clash with hub-only Cat');
select pg_temp.clear();
select is(public.clan_duel_challenge(pg_temp.id('a'), pg_temp.pid('c'), 30000) ->> 'result', 'ok', 'Clan duels: Ana''s clan can duel hub-only Cat''s');
select pg_temp.clear();
-- Still refused: another school (class), hidden (away).
select is(public.archery_duel_challenge(pg_temp.id('a'), 'hub-req-002', pg_temp.id('d'), 'forest', 302, 60000) ->> 'result', 'class', 'Archery: not hub-only Dan at another school');
select is(public.archery_duel_challenge(pg_temp.id('a'), 'hub-req-003', pg_temp.id('f'), 'forest', 303, 60000) ->> 'result', 'away', 'Archery: not hidden Hid');
select is(public.lord_clash_challenge(pg_temp.id('a'), pg_temp.id('d'), 30000) ->> 'result', 'class', 'Dragon Maths: not Dan at another school');
select is(public.clan_duel_challenge(pg_temp.id('a'), pg_temp.pid('d'), 30000) ->> 'result', 'class', 'Clan duels: not Dan''s clan at another school');
select pg_temp.reset();

-- ---- Room 2 switches "Play other classes" off ----
select pg_temp.room(2, false);
select pg_temp.kid('a');
select is(pg_temp.names(public.archery_here()), array[pg_temp.id('b')::text], 'Archery: with Room 2 off Ana sees only Ben');
select is(pg_temp.names(public.lord_here()) || pg_temp.names(public.clan_duel_here()), array[pg_temp.id('b')::text],
  'Dragon Maths: only Ben; Clan duels: nobody');
select pg_temp.act_as_server();
select is(array[public.archery_duel_challenge(pg_temp.id('a'), 'hub-req-004', pg_temp.id('c'), 'forest', 304, 60000) ->> 'result',
  public.lord_clash_challenge(pg_temp.id('a'), pg_temp.id('c'), 30000) ->> 'result',
  public.clan_duel_challenge(pg_temp.id('a'), pg_temp.pid('c'), 30000) ->> 'result'], array['class', 'class', 'class'], 'all three refuse hub-only Cat with ''class''');
select pg_temp.reset();
select pg_temp.room(2, true);

-- ---- Cat's class has a game's own switch off: she is not listed there, and is refused ----
select pg_temp.set_room2('archery_duels', false);
select pg_temp.kid('a');
select is(pg_temp.names(public.archery_here()), array[pg_temp.id('b')::text], 'Archery: Cat''s class has classmate fights off, so she is not listed');
select pg_temp.act_as_server();
select is(public.archery_duel_challenge(pg_temp.id('a'), 'hub-req-005', pg_temp.id('c'), 'forest', 305, 60000) ->> 'result', 'off', '... and is refused with ''off''');
select pg_temp.reset();
select pg_temp.set_room2('archery_duels', true);
select pg_temp.set_room2('lord_live_arena', false);
select pg_temp.kid('a');
select is(pg_temp.names(public.lord_here()), array[pg_temp.id('b')::text], 'Dragon Maths: Cat''s class has the live arena off, so she is not listed');
select pg_temp.reset();
select pg_temp.set_room2('lord_live_arena', true);
select pg_temp.set_room2('clan_live_duels', false);
select pg_temp.kid('a');
select is(jsonb_array_length(public.clan_duel_here() -> 'online'), 0, 'Clan duels: Cat''s class has live duels off, so her clan is not listed');
select pg_temp.reset();
select pg_temp.set_room2('clan_live_duels', true);

-- ---- 75 seconds ----
update public.hub_here set seen_at = now() - interval '76 seconds' where player = pg_temp.id('c');
select pg_temp.kid('a');
select is(pg_temp.names(public.archery_here()), array[pg_temp.id('b')::text], 'Archery: Cat''s check-in is 76 seconds old, so she drops off');
select is(pg_temp.names(public.lord_here()) || pg_temp.names(public.clan_duel_here()), array[pg_temp.id('b')::text], 'Dragon Maths and Clan duels too');
select pg_temp.act_as_server();
select is(array[public.archery_duel_challenge(pg_temp.id('a'), 'hub-req-006', pg_temp.id('c'), 'forest', 306, 60000) ->> 'result',
  public.lord_clash_challenge(pg_temp.id('a'), pg_temp.id('c'), 30000) ->> 'result',
  public.clan_duel_challenge(pg_temp.id('a'), pg_temp.pid('c'), 30000) ->> 'result'], array['away', 'away', 'away'], 'all three answer ''away''');
select pg_temp.reset();
update public.hub_here set seen_at = now() - interval '74 seconds' where player = pg_temp.id('c');
select ok(public.hub_seen(pg_temp.id('c')), 'at 74 seconds she counts again');

-- ---- Challenges waiting ----
select pg_temp.kid('c');
select is(public.hub_here() -> 'waiting', '[]'::jsonb, 'nothing waiting for Cat');
select pg_temp.act_as_server();
select public.archery_duel_challenge(pg_temp.id('a'), 'hub-req-007', pg_temp.id('c'), 'forest', 307, 60000);
select pg_temp.kid('c');
select is(public.hub_here() -> 'waiting', '["archery"]'::jsonb, 'an Archery challenge is waiting');
select pg_temp.reset(); select pg_temp.clear(); select pg_temp.act_as_server();
select public.lord_clash_challenge(pg_temp.id('a'), pg_temp.id('c'), 30000);
select pg_temp.kid('c');
select is(public.hub_here() -> 'waiting', '["dragon-maths"]'::jsonb, 'a Dragon Maths challenge is waiting');
select pg_temp.reset(); select pg_temp.clear(); select pg_temp.act_as_server();
select public.clan_duel_challenge(pg_temp.id('a'), pg_temp.pid('c'), 30000);
select pg_temp.kid('c');
select is(public.hub_here() -> 'waiting', '["clan-quest"]'::jsonb, 'a Clan duel challenge is waiting');
select pg_temp.kid('a');
select is(public.hub_here() -> 'waiting', '[]'::jsonb, 'the one who asked has nothing waiting');
select pg_temp.reset();

-- ---- Tidy ----
update public.hub_here set seen_at = now() - interval '2 days' where player = pg_temp.id('d');
select public.hub_here_tidy();
select is(pg_temp.hub_rows('d'), 0::bigint, 'hub_here_tidy() removes a row older than a day');
select is(pg_temp.hub_rows('b'), 1::bigint, '... and keeps a recent one');

select * from finish();
rollback;
