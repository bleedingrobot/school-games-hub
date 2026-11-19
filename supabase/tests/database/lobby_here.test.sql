-- Play anyone, stage 3 (migration 20261120000700): lobby_here(), the new Lobby's one read. Who's here keeps every stage 1
-- rule (pupils only, hidden never, same school, "Play other classes"); my own state per game; what we can play together;
-- my waiting challenges. Nothing private about the others.
-- Run on a throw-away copy: scripts/scratch-test.sh <name> supabase/tests/database/lobby_here.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

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

-- Ben has no hero and no clan. Everyone but Ana is here through the hub; Ana opens the Lobby.
delete from public.lord_heroes where player = pg_temp.id('b');
insert into public.hub_here (player) select pg_temp.id(w) from unnest(array['b', 'c', 'd', 'e', 'f']) w;
create function pg_temp.lobby(who text) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform pg_temp.kid(who);
  r := public.lobby_here();
  perform pg_temp.reset();
  return r;
end $$;
create function pg_temp.games(j jsonb, who text) returns jsonb language sql as $$
  select o -> 'games' from jsonb_array_elements(j -> 'online') o where o ->> 'id' = pg_temp.id(who)::text
$$;
create function pg_temp.set_room(n integer, col text, on_ boolean) returns void language plpgsql as $$
begin
  execute format('update public.app_settings set %I = $1 where class_id = %L', col,
    case n when 1 then '11111111-1111-4111-8111-111111111111' else '22222222-2222-4222-8222-222222222222' end) using on_;
end $$;
update public.app_settings set isles_enabled = true, isles_races = true, clan_raids_enabled = true, archery_duels = true, clan_live_duels = true;

-- Who's here.
select is(pg_temp.names(pg_temp.lobby('a')), array[pg_temp.id('b')::text, pg_temp.id('c')::text],
  'Ana sees Ben (her class) first, then Cat; never Dan (other school), Eve (teacher), Hid (hidden) or herself');
select is((select o ->> 'className' from jsonb_array_elements(pg_temp.lobby('a') -> 'online') o where o ->> 'id' = pg_temp.id('c')::text), 'Room 2',
  'Cat shows her class name');
select is((select array_agg(k order by k) from jsonb_array_elements(pg_temp.lobby('a') -> 'online') o, jsonb_object_keys(o) k where o ->> 'id' = pg_temp.id('c')::text),
  array['avatar', 'clan', 'className', 'games', 'id', 'name', 'sameClass'], 'nothing else about Cat: no scores, no year, no maths');
select pg_temp.room(2, false);
select is(pg_temp.names(pg_temp.lobby('a')), array[pg_temp.id('b')::text], 'with Room 2''s "Play other classes" off Ana sees only Ben');
select is(pg_temp.names(pg_temp.lobby('c')), '{}'::text[], 'and Cat sees nobody from Room 1');
select pg_temp.room(2, true);
update public.hub_here set seen_at = now() - interval '76 seconds' where player = pg_temp.id('c');
select is(pg_temp.names(pg_temp.lobby('a')), array[pg_temp.id('b')::text], 'a check-in 76 seconds old drops off');
update public.hub_here set seen_at = now() where player = pg_temp.id('c');
select is(public.lobby_here() -> 'me', 'null'::jsonb, 'not signed in as a pupil: nothing');
select is(pg_temp.lobby('f') -> 'online', '[]'::jsonb, 'a hidden pupil gets nobody');

-- My state in each game.
select is(pg_temp.lobby('a') -> 'me', '{"archery": "none", "dragon-maths": "ready", "clan-quest": "ready", "isles": "none", "raid": "ready"}'::jsonb,
  'Ana: no archer or island yet; hero and clan ready');
insert into public.archery_players (player) values (pg_temp.id('a'));
insert into public.isles_islands (player, seed, day, keeper) values (pg_temp.id('a'), '0123456789abcdef', 1, 'b01');
select is(pg_temp.lobby('a') -> 'me' ->> 'archery', 'ready', 'an archer: Archery ready');
select is(pg_temp.lobby('a') -> 'me' ->> 'isles', 'ready', 'an island with a keeper: the Sky race is ready');
select is(pg_temp.lobby('b') -> 'me', '{"archery": "none", "dragon-maths": "none", "clan-quest": "none", "isles": "none", "raid": "none"}'::jsonb,
  'Ben has made nothing yet');
select pg_temp.set_room(1, 'lord_live_arena', false);
select pg_temp.set_room(1, 'clan_raids_enabled', false);
select is(pg_temp.lobby('a') -> 'me' ->> 'dragon-maths', 'off', 'Room 1''s live arena off: Dragon Maths paused');
select is(pg_temp.lobby('a') -> 'me' ->> 'raid', 'off', 'Room 1''s raids off: Village Raid paused');
select pg_temp.set_room(1, 'lord_live_arena', true);
select pg_temp.set_room(1, 'clan_raids_enabled', true);

-- What Ana can play with each kid.
select is(pg_temp.games(pg_temp.lobby('a'), 'b'), '{"archery": "ok", "dragon-maths": "none", "clan-quest": "none"}'::jsonb,
  'Ben: archery yes; no hero, no clan');
select is(pg_temp.games(pg_temp.lobby('a'), 'c'), '{"archery": "ok", "dragon-maths": "ok", "clan-quest": "ok"}'::jsonb, 'Cat: all three');
select is((select o ->> 'clan' from jsonb_array_elements(pg_temp.lobby('a') -> 'online') o where o ->> 'id' = pg_temp.id('c')::text),
  pg_temp.pid('c')::text, 'Cat''s clan id, for a duel');
select pg_temp.set_room(2, 'lord_live_arena', false);
select is(pg_temp.games(pg_temp.lobby('a'), 'c') ->> 'dragon-maths', 'off', 'Room 2''s arena off: Cat''s Dragon Maths is off');
select pg_temp.set_room(2, 'lord_live_arena', true);
insert into public.archery_players (player) values (pg_temp.id('b'));
select is(pg_temp.games(pg_temp.lobby('b'), 'c'), '{"archery": "ok"}'::jsonb, 'Ben sees only the game he can play himself');

-- My own waiting challenge shows as going.
insert into public.lord_clashes (seat_a, seat_b, name_a, name_b, heroes, status, deadline)
values (pg_temp.id('a'), pg_temp.id('c'), 'Ana', 'Cat', '[{}, {}]', 'asked', now() + interval '1 minute');
select is((pg_temp.lobby('a') -> 'going' -> 0) - 'id' - 'at', '{"game": "dragon-maths", "status": "asked", "with": "Cat"}'::jsonb,
  'Ana''s clash with Cat is waiting for a yes');

select * from finish();
rollback;
