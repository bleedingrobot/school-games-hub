-- Clan Quest: the end of a season (migration 20261120001900_clan_season_results.sql;
-- docs/plans/clans-season-end/PLAN.md stage 2). When clan_nightly sets fame back to 0 for a new season, each clan's season is
-- kept and the Clan Veteran trophy given; the ceremony's summary shows them with the school's top clans by fame.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- Pupils 01 to 04 at Douglas Park, a hidden pupil (0d) and a teacher (0e).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'p1@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-000000000002', 'p2@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-000000000003', 'p3@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-000000000004', 'p4@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'hid@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000e';
update public.profiles set hidden = true where id = '00000000-0000-0000-0000-00000000000d';

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || who)::uuid $$;
create function pg_temp.pupil(who text) returns void language sql as $$
  select pg_temp.act_as('00000000-0000-0000-0000-0000000000' || who, 'p' || ltrim(who, '0') || '@douglaspark.school.nz') $$;
-- A clan with this fame, one member at this level, and `season` stamped in extras (null: none, as for clans not saved since 16 Nov).
create function pg_temp.clan(who text, cname text, fame integer, lvl integer, season integer) returns void language sql as $$
  insert into public.clans (player, name, seed, day, created_nz_day, gold, followers, village, fights_left, fame, extras)
  values (pg_temp.id(who), cname, 1, 5, 20000, 300, 40, '{"trainingHall": 2, "smithy": 1, "church": 0}', 3, fame,
          case when season is null then null else jsonb_build_object('season', season) end);
  insert into public.clan_members (player, slot, member)
  values (pg_temp.id(who), 0, jsonb_build_object('name', 'Ana', 'race', 'Elf', 'cls', 'Ranger', 'level', lvl, 'look', 'female-1'));
$$;
create function pg_temp.veteran(who text) returns integer language sql as $$
  select count(*)::integer from public.trophies w where w.player = pg_temp.id(who) and w.trophy = 'clan-veteran' $$;
create function pg_temp.saved() returns integer language sql as $$ select count(*)::integer from public.clan_season_results $$;

-- Season 1 is running (day 30) and the school's season is recorded as 1.
update public.app_settings set lord_season_start = public.nz_day(now()) - 29, lord_paused_since = null,
  clans_clock_from = public.nz_day(now()) - 29;
insert into public.clan_school_seasons (school_id, season)
  values ((select school_id from public.profiles where id = pg_temp.id('01')), 1)
  on conflict (school_id) do update set season = 1;

select is((select kind || '/' || repeat || '/' || game from public.trophy_types where id = 'clan-veteran'), 'trophy/season/clan-quest',
  'the Clan Veteran is a trophy, won each season, in Clan Quest');

select pg_temp.clan('01', 'Swift Falcons', 320, 9, 1);
select pg_temp.clan('02', 'Sleepy Owls', 0, 1, 1);
select pg_temp.clan('03', 'Bold Foxes', 130, 4, null);
select pg_temp.clan('04', 'Old Badgers', 0, 6, 0);
select pg_temp.clan('0d', 'Quiet Moles', 500, 7, 1);
select pg_temp.clan('0e', 'Iron Shields', 410, 10, 1);
insert into public.clan_hall (player, season, school_id, clan_name, village_done_on, monster_done_on, monster_tries)
values (pg_temp.id('01'), 1, (select school_id from public.profiles where id = pg_temp.id('01')), 'Swift Falcons', null, current_date, 2);

-- ---- While the season goes on, fame changes save nothing ----
update public.clans set fame = 0 where player = pg_temp.id('02');
update public.clans set fame = fame + 5 where player = pg_temp.id('01');
select is(pg_temp.saved(), 0, 'nothing is saved while the season goes on, even when fame is set to 0');

-- ---- Season 2 starts: the midnight job ----
update public.app_settings set lord_season_start = public.nz_day(now()) - 35, clans_clock_from = public.nz_day(now()) - 35;
select is((public.clan_school_season((select school_id from public.profiles where id = pg_temp.id('01'))) ->> 'number'), '2',
  'the clock now says season 2');
select lives_ok($$ select public.clan_nightly(30000) $$, 'the midnight job runs');
select is((select count(*)::integer from public.clans where fame <> 0), 0, '... and every clan''s fame is back to 0, as before');
select is((select season from public.clan_school_seasons where school_id = (select school_id from public.profiles where id = pg_temp.id('01'))), 2,
  '... and the school is now in season 2');

select is((select format('%s/%s/%s/%s/%s/%s/%s', season, fame, best_level, gold, buildings ->> 'trainingHall', monster_beaten, monster_tries)
  from public.clan_season_results where player = pg_temp.id('01')), '1/325/9/300/2/t/2',
  'Swift Falcons'' season 1 is kept: fame before the reset, best level 9, gold, buildings, Grimmor beaten in 2 tries');
select is((select members -> 0 ->> 'name' from public.clan_season_results where player = pg_temp.id('01')), 'Ana', '... with the members');
select is(pg_temp.veteran('01'), 1, 'Swift Falcons win the Clan Veteran trophy');
select is((select (detail ->> 'fame')::integer from public.trophies where player = pg_temp.id('01') and trophy = 'clan-veteran'), 325,
  '... which notes the fame');

select is((select fame from public.clan_season_results where player = pg_temp.id('02')), 0, 'a clan that never played is kept too');
select is(pg_temp.veteran('02'), 0, '... but gets no Clan Veteran trophy');

select is((select fame from public.clan_season_results where player = pg_temp.id('03')), 130,
  'a clan with no season stamped (not saved since 16 Nov) is kept for season 1');
select is((select (extras ->> 'season')::integer from public.clans where player = pg_temp.id('03')), 1,
  '... and is stamped season 1, so the server starts it again');
select is((select count(*)::integer from public.clan_season_results where player = pg_temp.id('04')), 0,
  'a clan stamped with an earlier season didn''t play this one: nothing is kept');

select is(pg_temp.veteran('0e'), 1, 'teachers get the trophy too (it''s not a race)');

select lives_ok($$ select public.clan_save_season(pg_temp.id('01'), 1, 999, 'X', 0, 0, '{}') $$, 'saving the same season again');
select is((select fame from public.clan_season_results where player = pg_temp.id('01')), 325, '... changes nothing');

-- ---- The ceremony's summary ----
select pg_temp.pupil('03');
select is((select jsonb_agg(x ->> 'clanName') from jsonb_array_elements(public.clan_season_summary() -> 'top') x),
  '["Swift Falcons", "Bold Foxes"]'::jsonb,
  'top clans: this school''s pupils with fame, the most first (no teacher, hidden pupil or fameless clan)');
select is(public.clan_season_summary() ->> 'place', '2', 'my place on the list');
select public.clan_season_seen(1);
select is(public.clan_season_summary() ->> 'seen', 'true', 'watching the ceremony is remembered');
select pg_temp.reset();

select * from finish();
rollback;
