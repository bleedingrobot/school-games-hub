-- Play anyone, stage 8 (migration 20261120001300): Stars and Played recently. A star is private and one-sided (the
-- starred kid can never find out, through any read they can make), capped at 30, same school only; it changes the order
-- of a list, never who is listed: hidden, other school and "Play other classes" off still hide a starred kid. Played
-- recently is the last 14 days of finished games, with the same stage 1 rules.
-- Run on a throw-away copy: scripts/scratch-test.sh <name> supabase/tests/database/lobby_stars.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

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

-- Gus in Room 2 has no game open (for "stars away"); 30 more kids at school for the cap.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000009', 'gus@douglaspark.school.nz');
insert into public.class_members (student_id, class_id, how) values (pg_temp.id('9'), '22222222-2222-4222-8222-222222222222', 'teacher');
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid, 'kid' || n || '@douglaspark.school.nz' from generate_series(1, 31) n;
create function pg_temp.many(n integer) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid $$;
create function pg_temp.star(who text, other uuid, on_ boolean) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform pg_temp.kid(who);
  r := public.lobby_star(other, on_);
  perform pg_temp.reset();
  return r;
end $$;
create function pg_temp.ids(j jsonb) returns text[] language sql as $$
  select coalesce(array_agg(o ->> 'id' order by ord), '{}') from jsonb_array_elements(j) with ordinality as t(o, ord)
$$;
create function pg_temp.row_of(j jsonb, id uuid) returns jsonb language sql as $$
  select o from jsonb_array_elements(j) o where o ->> 'id' = id::text
$$;
-- Everything Cat can read in the Lobby and the three games' lists, as one value (to compare before and after a star).
create function pg_temp.cat_sees() returns text language plpgsql as $$
declare r text;
begin
  perform pg_temp.kid('c');
  r := (public.lobby_here() - 'going')::text || (public.archery_here() - 'duel')::text || public.lord_here()::text || public.clan_duel_here()::text;
  perform pg_temp.reset();
  return r;
end $$;
-- A finished Dragon Maths clash or chess game between two kids, some days ago.
create function pg_temp.clash(a uuid, b uuid, days_ago numeric) returns void language sql as $$
  insert into public.lord_clashes (seat_a, seat_b, name_a, name_b, heroes, status, ending, deadline, created_at, finished_at)
  values (a, b, 'A', 'B', '[{}, {}]', 'done', 'finished', now(), now() - make_interval(secs => days_ago * 86400 + 600), now() - make_interval(secs => days_ago * 86400))
$$;
create function pg_temp.chess(a uuid, b uuid, days_ago numeric) returns void language sql as $$
  insert into public.mp_games (game, first_player, second_player, status, reason, counts_for_points, started_at, finished_at)
  values ('chess', a, b, 'finished', 'checkmate', true, now() - make_interval(secs => days_ago * 86400 + 600), now() - make_interval(secs => days_ago * 86400))
$$;
update public.app_settings set archery_enabled = true, archery_duels = true;

-- Star and unstar.
select is(pg_temp.star('a', pg_temp.id('c'), true), '{"ok": true, "starred": true}'::jsonb, 'Ana stars Cat');
select is(pg_temp.row_of(pg_temp.lobby('a') -> 'online', pg_temp.id('c')) -> 'starred', 'true'::jsonb, 'Cat comes back starred in Ana''s Who''s here');
select is(pg_temp.row_of(pg_temp.lobby('a') -> 'online', pg_temp.id('b')) -> 'starred', 'false'::jsonb, '... and Ben doesn''t');
select is(pg_temp.star('a', pg_temp.id('c'), false), '{"ok": true, "starred": false}'::jsonb, 'Ana unstars Cat');
select is(pg_temp.row_of(pg_temp.lobby('a') -> 'online', pg_temp.id('c')) -> 'starred', 'false'::jsonb, '... and she isn''t starred any more');
select is(pg_temp.star('a', pg_temp.id('a'), true) ->> 'ok', 'false', 'Ana can''t star herself');
select is(pg_temp.star('a', pg_temp.id('d'), true), '{"ok": false, "message": "You can’t star that player."}'::jsonb, 'or Dan at another school');
select is(pg_temp.star('a', pg_temp.id('f'), true), '{"ok": false, "message": "You can’t star that player."}'::jsonb,
  'or a hidden pupil, with the same words (nothing says they''re hidden)');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select is(public.lobby_star(pg_temp.id('c'), true) ->> 'ok', 'false', 'a teacher can''t star anyone');
select pg_temp.reset();
select is(pg_temp.star('a', pg_temp.id('9'), true) ->> 'ok', 'true', 'Ana stars Gus (Room 2, not here)');

-- The cap of 30.
select pg_temp.star('a', pg_temp.many(n), true) from generate_series(1, 28) n;
select is(pg_temp.star('a', pg_temp.many(29), true) ->> 'ok', 'true', 'the 30th star is fine');
select is(pg_temp.star('a', pg_temp.many(30), true) ->> 'full', 'true', 'the 31st is refused');
select is(pg_temp.star('a', pg_temp.many(29), true) ->> 'ok', 'true', 'starring someone already starred is still fine at 30');
select is(pg_temp.star('a', pg_temp.many(29), false) ->> 'ok', 'true', 'unstarring always works');
select is(pg_temp.star('a', pg_temp.many(30), true) ->> 'ok', 'true', '... and then there''s room for one more');
delete from public.lobby_stars where star in (select pg_temp.many(n) from generate_series(1, 31) n);

-- Nobody can read the stars except through their own lists.
select pg_temp.kid('c');
select throws_ok('select count(*) from public.lobby_stars', '42501', null, 'a pupil can''t read the stars table');
select throws_ok('insert into public.lobby_stars (player, star) values (''00000000-0000-0000-0000-00000000000c'', ''00000000-0000-0000-0000-00000000000a'')',
  '42501', null, '... or write to it');
select throws_ok(format('select public.lobby_starred(%L, %L)', pg_temp.id('a'), pg_temp.id('c')), '42501', null, 'or ask whether someone starred them');
select throws_ok(format('select * from public.lobby_played_with(%L, now() - interval ''14 days'')', pg_temp.id('a')), '42501', null,
  'or read someone else''s Played recently');
select pg_temp.reset();
insert into public.lord_here (player) select pg_temp.id(w) from unnest(array['a', 'c']) w;
insert into public.clan_here (player) select pg_temp.id(w) from unnest(array['a', 'c']) w;
insert into public.archery_here (player) select pg_temp.id(w) from unnest(array['a', 'c']) w;
create temp table before_star as select pg_temp.cat_sees() as seen;
select pg_temp.star('a', pg_temp.id('c'), true);
select is(pg_temp.cat_sees(), (select seen from before_star), 'everything Cat can read is the same before and after Ana stars her');

-- The game lists say starred too. (Clan ids are read before acting as a pupil, who can't read clans.)
select set_config('t.pid_c', pg_temp.pid('c')::text, false), set_config('t.pid_d', pg_temp.pid('d')::text, false);
select pg_temp.kid('a');
select is(pg_temp.row_of(public.archery_here() -> 'online', pg_temp.id('c')) -> 'starred', 'true'::jsonb, 'Archery: Cat starred');
select is((select o -> 'starred' from jsonb_array_elements(public.lord_here() -> 'online') o where o ->> 'id' = pg_temp.id('c')::text), 'true'::jsonb,
  'Dragon Maths: Cat starred');
select is((select o -> 'starred' from jsonb_array_elements(public.clan_duel_here() -> 'online') o where o ->> 'id' = current_setting('t.pid_c')), 'true'::jsonb,
  'Clan duels: Cat''s clan starred');
select pg_temp.reset();
select pg_temp.act_as_server();
select is((select o -> 'starred' from jsonb_array_elements(public.clan_village_mates(pg_temp.id('a'))) o where o ->> 'id' = current_setting('t.pid_c')), 'true'::jsonb,
  'Village Raids: Cat''s village starred');
select pg_temp.reset();
select pg_temp.kid('a');
select is(public.lobby_star_clan(current_setting('t.pid_c')::uuid, false), '{"ok": true, "starred": false}'::jsonb, 'unstar from a clan row');
select is(public.lobby_star_clan(current_setting('t.pid_c')::uuid, true), '{"ok": true, "starred": true}'::jsonb, 'star from a clan row');
select is(public.lobby_star_clan(current_setting('t.pid_d')::uuid, true) ->> 'ok', 'false', 'not a clan at another school');
select pg_temp.reset();

-- Stars away, and the stage 1 rules still hide a starred kid (the star stays, in case they come back).
select is(pg_temp.lobby('a') -> 'stars_away', jsonb_build_array(jsonb_build_object('id', pg_temp.id('9'), 'name', (select display_name from public.profiles where id = pg_temp.id('9')),
  'avatar', (select avatar from public.profiles where id = pg_temp.id('9')), 'sameClass', false, 'className', 'Room 2')),
  'Gus is a star who isn''t here: id, name, avatar and class only');
update public.profiles set hidden = true where id = pg_temp.id('9');
select is(pg_temp.lobby('a') -> 'stars_away', '[]'::jsonb, 'hidden: Gus drops out');
update public.profiles set hidden = false where id = pg_temp.id('9');
select pg_temp.room(2, false);
select is(pg_temp.ids(pg_temp.lobby('a') -> 'stars_away') || pg_temp.ids(pg_temp.lobby('a') -> 'online'), array[pg_temp.id('b')::text],
  'Room 2''s "Play other classes" off: starred Cat and Gus both drop out');
select pg_temp.room(2, true);
-- A school can't be changed, so a star on a kid at another school is put in by hand (as if they had moved).
insert into public.lobby_stars (player, star) values (pg_temp.id('a'), pg_temp.id('d'));
select ok(not (pg_temp.id('d')::text = any(pg_temp.ids(pg_temp.lobby('a') -> 'stars_away') || pg_temp.ids(pg_temp.lobby('a') -> 'online'))),
  'a starred kid at another school never shows, here or away');
delete from public.lobby_stars where star = pg_temp.id('d');
select is(pg_temp.ids(pg_temp.lobby('a') -> 'stars_away'), array[pg_temp.id('9')::text], 'back again: the star was kept');

-- Played recently.
select pg_temp.clash(pg_temp.id('a'), pg_temp.id('9'), 2);
select pg_temp.chess(pg_temp.id('b'), pg_temp.id('a'), 1);
select pg_temp.chess(pg_temp.id('a'), pg_temp.id('c'), 15);
select pg_temp.clash(pg_temp.id('a'), pg_temp.id('f'), 1);
select pg_temp.clash(pg_temp.id('d'), pg_temp.id('a'), 1);
select is(pg_temp.ids(pg_temp.lobby('a') -> 'recent'), array[pg_temp.id('b')::text, pg_temp.id('9')::text],
  'Ben (chess yesterday) then Gus (clash 2 days ago); not Cat (15 days ago), Hid (hidden) or Dan (other school)');
select is((select array_agg(k order by k) from jsonb_object_keys(pg_temp.lobby('a') -> 'recent' -> 1) k),
  array['avatar', 'clan', 'className', 'games', 'here', 'id', 'name', 'sameClass', 'starred'], 'with the same fields as Who''s here');
select is((pg_temp.lobby('a') -> 'recent' -> 1) -> 'here', 'false'::jsonb, '... Gus isn''t here');
select pg_temp.room(2, false);
select is(pg_temp.ids(pg_temp.lobby('a') -> 'recent'), array[pg_temp.id('b')::text], 'Room 2 off: Gus drops out of Played recently');
select pg_temp.room(2, true);
select pg_temp.clash(pg_temp.many(n), pg_temp.id('a'), n / 10.0) from generate_series(1, 9) n;
select is(jsonb_array_length(pg_temp.lobby('a') -> 'recent'), 8, 'at most 8, newest first');

select * from finish();
rollback;
