-- Trophies for Clan Quest, Sky Isles, Royal Decree and Maths Monsters (migration 20261112001700_trophies_games_1.sql;
-- docs/plans/profile/PLAN.md card P7 part 1). Each game's own record gives its trophy once, when the feat comes true.
-- Run on a throw-away copy: scripts/scratch-db.sh t1, then scripts/scratch-test.sh t1 supabase/tests/database/trophies_games_1.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
insert into public.classes (school_id, name, school_year, warp_code, archived) values (1, 'Trophy Room', 2026, 'TRPHY', false);
insert into public.class_members (student_id, class_id)
select v.s::uuid, c.id from (values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b')) v(s)
join public.classes c on c.name = 'Trophy Room'
on conflict (student_id) do update set class_id = excluded.class_id;

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || who)::uuid $$;
-- How many times a player holds a trophy, and the seasons it was won in.
create function pg_temp.wins(who text, t text) returns integer language sql as $$
  select count(*)::integer from public.trophies where player = pg_temp.id(who) and trophy = t $$;
create function pg_temp.seasons(who text, t text) returns text language sql as $$
  select coalesce(string_agg(season::text, ',' order by season), '') from public.trophies where player = pg_temp.id(who) and trophy = t $$;
update public.schools set hub_season_start = public.nz_day(now()) - 40, hub_season_days = 35, hub_paused_since = null where id = 1;

select is((select count(*)::integer from public.trophy_types where id in
  ('clan-tooth', 'clan-banner', 'mm-league', 'mm-book', 'mm-shiny', 'decree-seal', 'isles-lighthouse', 'isles-keeper')), 8,
  'the eight trophies are there');
select is((select goal from public.achievement_types where id = 'mm-book-54'), 75, 'the full monster book achievement needs 75 monsters');

-- ---- Clan Quest ----
insert into public.clan_hall (player, season, school_id, clan_name, village_done_on) values (pg_temp.id('0a'), 3, 1, 'Ana''s Clan', public.nz_day(now()));
select is(pg_temp.wins('0a', 'clan-banner'), 0, 'a finished village alone gives no Clan Banner');
update public.clan_hall set monster_done_on = public.nz_day(now()) where player = pg_temp.id('0a') and season = 3;
select is(pg_temp.seasons('0a', 'clan-tooth'), '3', 'beating the season monster gives the Monster Tooth, in the clan''s own season');
select is(pg_temp.seasons('0a', 'clan-banner'), '3', '... and with the village finished too, the Clan Banner picture');
update public.clan_hall set monster_tries = 9, village_done_on = village_done_on where player = pg_temp.id('0a');
select is(pg_temp.wins('0a', 'clan-tooth') + pg_temp.wins('0a', 'clan-banner'), 2, 'saving the Hall row again gives nothing more');
insert into public.clan_hall (player, season, school_id, clan_name, monster_done_on) values (pg_temp.id('0a'), 4, 1, 'Ana''s Clan', public.nz_day(now()));
select is((select public.trophy_tier(level) from public.trophy_counts(pg_temp.id('0a')) where trophy = 'clan-tooth'), 'silver',
  'a second season''s monster makes the tooth silver');

-- ---- Sky Isles ----
insert into public.isles_islands (player, school_id, season, seed, day, island) values
  (pg_temp.id('0a'), 1, 1, 'aaaaaaaaaaaaaaaa', 1, '{"lighthouse": 3, "turn": 9, "spots": []}'),
  (pg_temp.id('0b'), 1, 1, 'bbbbbbbbbbbbbbbb', 1, '{"lighthouse": 0, "turn": 2, "spots": []}');
select is(pg_temp.wins('0a', 'isles-lighthouse'), 0, 'a Lighthouse on stage 3 is not lit yet');
update public.isles_islands set island = island || '{"lighthouse": 4}' where player = pg_temp.id('0a');
select is(pg_temp.seasons('0a', 'isles-lighthouse'), '1', 'lighting the Sky Lighthouse gives the Lighthouse picture for island 1');
update public.isles_islands set island = island || '{"turn": 10}' where player = pg_temp.id('0a');
select is(pg_temp.wins('0a', 'isles-lighthouse'), 1, '... once an island');
select public.isles_season(array[pg_temp.id('0a'), pg_temp.id('0b')]);
select is(pg_temp.seasons('0a', 'isles-keeper'), '1', 'a class top-three island at New Season gives the Keeper''s Medal for that island');
select is(pg_temp.seasons('0b', 'isles-keeper'), '1', '... to every island in the top three');
update public.isles_islands set island = '{"lighthouse": 4, "turn": 1, "spots": []}' where player = pg_temp.id('0a');
select is(pg_temp.seasons('0a', 'isles-lighthouse'), '1,2', 'the next island''s Lighthouse counts again');

-- ---- Royal Decree ----
insert into public.decree_reigns (player, look, reign) values (pg_temp.id('0b'), 'ruler-girl-1', '{}');
update public.decree_reigns set status = 'over', finished_at = now() where player = pg_temp.id('0b');
select is(pg_temp.wins('0b', 'decree-seal'), 0, 'a reign that ends early gives no Royal Seal');
insert into public.decree_reigns (player, look, reign) values (pg_temp.id('0b'), 'ruler-girl-1', '{}');
update public.decree_reigns set status = 'full', finished_at = now() where player = pg_temp.id('0b') and status = 'playing';
select is(pg_temp.seasons('0b', 'decree-seal'), public.hub_season(1)::text, 'a full reign gives the Royal Seal in the hub season');
insert into public.decree_reigns (player, look, reign) values (pg_temp.id('0b'), 'ruler-boy-2', '{}');
update public.decree_reigns set status = 'full', finished_at = now() where player = pg_temp.id('0b') and status = 'playing';
select is(pg_temp.wins('0b', 'decree-seal'), 1, '... once a season');

-- ---- Maths Monsters ----
insert into public.monster_saves (player, world, version, last_save_id, client_at, badges_count, owned_count)
  values (pg_temp.id('0a'), '{"team": [{"species": "a", "level": 3}], "box": []}', 1, gen_random_uuid(), 0, 5, 74);
select is(pg_temp.wins('0a', 'mm-league') + pg_temp.wins('0a', 'mm-book') + pg_temp.wins('0a', 'mm-shiny'), 0,
  'five badges, 74 monsters and no shiny give no Monsters trophy');
update public.monster_saves set badges_count = 6, version = 2 where player = pg_temp.id('0a');
select is(pg_temp.wins('0a', 'mm-league'), 1, 'the sixth badge gives League Champion');
update public.monster_saves set owned_count = 75, version = 3 where player = pg_temp.id('0a');
select is(pg_temp.wins('0a', 'mm-book'), 1, 'the 75th monster gives the Book Master picture');
update public.monster_saves set world = '{"team": [], "box": [{"species": "a", "level": 3, "shiny": true}]}', version = 4 where player = pg_temp.id('0a');
select is(pg_temp.wins('0a', 'mm-shiny'), 1, 'a shiny in the box gives the Shiny Star');
update public.monster_saves set version = 5 where player = pg_temp.id('0a');
select is(pg_temp.wins('0a', 'mm-league') + pg_temp.wins('0a', 'mm-book') + pg_temp.wins('0a', 'mm-shiny'), 3,
  'saving again with all of it still held gives nothing more');

-- ---- Pupils ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.monster_save_trophies() $$, '42501', null, 'a pupil cannot call a trophy watcher');
select pg_temp.reset();

select * from finish();
rollback;
