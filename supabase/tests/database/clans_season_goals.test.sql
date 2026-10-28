-- Clan Quest season goals (28 Oct 2026, migration 20261029000400): the school's 35-day season, the "whole village" reward (once a season),
-- the Hall of Legends, and fame starting again when a season ends (only while the clock is on).
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select setval(pg_get_serial_sequence('public.schools', 'id'), 1);
select setval(pg_get_serial_sequence('public.clan_villages', 'id'), 1);
select plan(69);

-- School 1 is Douglas Park (made by the migration). School 2 is made here.
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id) values ('otherschool.school.nz', 2);
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cai@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'dee@otherschool.school.nz');
update public.app_settings set clans_enabled = true;

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000000' || who)::uuid $$;
create function pg_temp.req(n integer) returns uuid language sql as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create function pg_temp.as_a() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz') $$;
create function pg_temp.as_d() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000d', 'dee@otherschool.school.nz') $$;

-- Douglas Park's season clock, in days from today: the season start, the day it was paused (or null) and the day Clan Quest's clock switches on (or null).
create function pg_temp.clock(start_off integer, paused_off integer default null, from_off integer default null) returns void language sql as $$
  update public.app_settings set lord_season_start = public.nz_day(now()) + $1, lord_paused_since = public.nz_day(now()) + $2,
    clans_clock_from = public.nz_day(now()) + $3
  where school_id = 1 and class_id is null
$$;
create function pg_temp.season(who text) returns jsonb language sql as $$ select public.clan_season(pg_temp.id(who)) $$;

create function pg_temp.member(n integer) returns jsonb language sql as $$
  select jsonb_build_object('name', 'Member' || n, 'race', 'Human', 'cls', 'Warrior', 'level', 2, 'xp', 40, 'hp', 20, 'maxHp', 20, 'sp', 5, 'maxSp', 5,
    'stats', jsonb_build_object('agility', 8), 'spells', '[]'::jsonb, 'gear', '{}'::jsonb, 'points', 3, 'knockedOut', false)
$$;
create function pg_temp.empire(lv jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('version', 2,
    'levels', jsonb_build_object('trainingHall', 0, 'smithy', 0, 'church', 0, 'barracks', 0, 'walls', 0, 'tower', 0, 'forge', 0, 'strongroom', 0) || lv,
    'buildsToday', 0, 'troops', jsonb_build_object('footman', 40, 'axeman', 0, 'knight', 0), 'day', 15, 'createdDay', 1,
    'raidsToday', 0, 'kingdomRaidsToday', 0, 'shieldUntil', 0, 'raidedToday', '[]'::jsonb)
$$;
create function pg_temp.state(who text, clan_name text) returns jsonb language sql as $$
  select jsonb_build_object(
    'clan', jsonb_build_object('name', clan_name, 'gold', 200, 'followers', 5,
      'village', jsonb_build_object('trainingHall', 0, 'smithy', 0, 'church', 0), 'wakesToday', 0,
      'members', (select jsonb_agg(pg_temp.member(n)) from generate_series(1, 4) n), 'empire', pg_temp.empire()),
    'seed', public.clan_offer_seed(pg_temp.id(who)), 'day', 15, 'createdNzDay', 19000, 'fightsLeft', 8, 'fightNo', 0, 'raidNo', 0,
    'examined', '[]'::jsonb, 'fight', null)
$$;
create function pg_temp.save(who text, request integer, clan_name text) returns jsonb language sql as $$
  select public.save_clan(pg_temp.id(who), 0, pg_temp.req(request), 'test', pg_temp.state(who, clan_name), '{"type":"test"}')
$$;
-- Puts a clan's empire straight into the table (as the owner, the way a save would), with these building levels. A full village is `full`.
create function pg_temp.build(who text, lv jsonb) returns void language sql as $$
  update public.clan_empires set empire = pg_temp.empire($2) where player = pg_temp.id($1)
$$;
create function pg_temp.full() returns jsonb language sql as $$
  select '{"trainingHall":5,"smithy":6,"church":3,"barracks":5,"walls":5,"tower":5,"forge":5,"strongroom":5}'::jsonb
$$;
create function pg_temp.fame(who text) returns integer language sql as $$ select fame from public.clans where player = pg_temp.id(who) $$;
create function pg_temp.hall_rows(who text) returns integer language sql as $$ select count(*)::integer from public.clan_hall where player = pg_temp.id(who) $$;
create function pg_temp.village_scores(who text) returns integer language sql as $$
  select count(*)::integer from public.clan_scores where player = pg_temp.id(who) and points_raw = 10 $$;
create function pg_temp.news(clan_name text) returns integer language sql as $$
  select count(*)::integer from public.clan_news where text = clan_name || ' finished their whole village!' $$;

-- ---- The rules ----
select is(public.clan_season_rules() -> 'maxLevels', '{"trainingHall":5,"smithy":6,"church":3,"barracks":5,"walls":5,"tower":5,"forge":5,"strongroom":5}'::jsonb,
  'the top level of each building');
select is((select sum(v::integer) from jsonb_each_text(public.clan_season_rules() -> 'maxLevels') x(k, v)), 39::bigint, '... 39 levels in all');

-- ---- The season ----
select pg_temp.clock(null);
select is(pg_temp.season('a'), '{"number":0,"day":0,"daysLeft":0,"clockOn":false}'::jsonb, 'no start date: season 0');
select pg_temp.clock(3);
select is(pg_temp.season('a'), '{"number":0,"day":0,"daysLeft":0,"clockOn":false}'::jsonb, 'before the start date: season 0');
select pg_temp.clock(0);
select is(pg_temp.season('a'), '{"number":1,"day":1,"daysLeft":34,"clockOn":false}'::jsonb, 'the start date is day 1 of season 1 (the clock is off)');
select pg_temp.clock(-34);
select is(pg_temp.season('a'), '{"number":1,"day":35,"daysLeft":0,"clockOn":false}'::jsonb, 'day 35 is the last day of season 1');
select pg_temp.clock(-35);
select is(pg_temp.season('a'), '{"number":2,"day":1,"daysLeft":34,"clockOn":false}'::jsonb, 'day 36 is day 1 of season 2');
select pg_temp.clock(-10, -3);
select is(pg_temp.season('a'), '{"number":1,"day":8,"daysLeft":27,"clockOn":false}'::jsonb, 'paused: the day stays where it was on the pause day');
select pg_temp.clock(2, -1);
select is((pg_temp.season('a') ->> 'number')::integer, 0, 'paused before the season ever started: season 0');
select pg_temp.clock(0, null, 0);
select is((pg_temp.season('a') ->> 'clockOn')::boolean, true, 'the clock is on from its start day');
select pg_temp.clock(0, null, 1);
select is((pg_temp.season('a') ->> 'clockOn')::boolean, false, '... and off before it');
select pg_temp.clock(null, null, 0);
select is((pg_temp.season('a') ->> 'clockOn')::boolean, false, '... and off with no season date, whatever the clock says');
select pg_temp.clock(0, null, null);
select is(pg_temp.season('d'), '{"number":0,"day":0,"daysLeft":0,"clockOn":false}'::jsonb, 'another school has its own date (none): season 0');
select is(public.clan_extras(pg_temp.id('a')) -> 'clock', pg_temp.season('a'), 'clan_extras carries the clock');
select ok(public.clan_extras(pg_temp.id('a')) ? 'fame' and public.clan_extras(pg_temp.id('a')) ? 'achievements', '... beside what it always had');

-- ---- The clans (season 1 of Douglas Park, clock off) ----
select is(pg_temp.save('a', 1, 'Red Banner') ->> 'status', 'saved', 'ana''s clan is saved');
select pg_temp.save('b', 2, 'Blue Fox');
select pg_temp.save('c', 3, 'Green Owl');
select pg_temp.save('d', 4, 'Gold Hawk');
select is(pg_temp.hall_rows('a'), 0, 'nothing is in the Hall yet');

-- ---- A whole village earns once a season ----
select pg_temp.build('a', '{"trainingHall":5,"smithy":6,"church":3,"barracks":5,"walls":5,"tower":5,"forge":5,"strongroom":4}');
select is(pg_temp.hall_rows('a'), 0, 'one level short earns nothing');
select pg_temp.build('a', pg_temp.full());
select is((select village_done_on from public.clan_hall where player = pg_temp.id('a') and season = 1), public.nz_day(now()), 'the Hall notes the day the village was finished');
select is((select clan_name || '/' || school_id from public.clan_hall where player = pg_temp.id('a') and season = 1), 'Red Banner/1', '... with the clan''s name and school');
select is(pg_temp.fame('a'), 50, 'the clan gets 50 fame');
select is(pg_temp.village_scores('a'), 1, '... and one 10 point score');
select is((select sum(points)::integer from public.scored_games where player = pg_temp.id('a') and game = 'clan-quest'), 10, '... which becomes 10 hub points');
select is((select (stats ->> 'villageBuilt')::integer from public.clans where player = pg_temp.id('a')), 2, 'villageBuilt is 2');
select ok(exists (select 1 from public.achievements where player = pg_temp.id('a') and achievement = 'cq-master-builder'), 'Master Builder is earned in the same save');
select ok(exists (select 1 from public.achievements where player = pg_temp.id('a') and achievement = 'cq-village'), '... and Village builders with it');
select is(pg_temp.news('Red Banner'), 1, 'the school is told in the news');
select is((select school_id from public.clan_news where text = 'Red Banner finished their whole village!'), 1, '... in the clan''s school');

select pg_temp.build('a', pg_temp.full());
select is(pg_temp.fame('a'), 50, 'saving the full village again gives nothing more (fame)');
select is(pg_temp.village_scores('a'), 1, '... nor points');
select is(pg_temp.news('Red Banner'), 1, '... nor another news line');
select pg_temp.build('a', '{"trainingHall":5,"smithy":6,"church":3,"barracks":5,"walls":4,"tower":5,"forge":5,"strongroom":5}');
select pg_temp.build('a', pg_temp.full());
select is(pg_temp.fame('a'), 50, 'a level knocked off and built again gives nothing more');
select is(pg_temp.hall_rows('a'), 1, '... and the Hall still has one row');
select is(pg_temp.village_scores('a'), 1, '... and one score');

-- ---- ... but again in the next season ----
select pg_temp.clock(-35);
select pg_temp.build('a', pg_temp.full());
select is(pg_temp.fame('a'), 50, 'a village that was already whole earns nothing just because the season moved on');
select pg_temp.build('a', '{"trainingHall":5,"smithy":6,"church":3,"barracks":5,"walls":5,"tower":5,"forge":4,"strongroom":5}');
select pg_temp.build('a', pg_temp.full());
select is(pg_temp.fame('a'), 100, 'finishing it again in the next season pays again');
select is((select count(*)::integer from public.clan_hall where player = pg_temp.id('a') and season = 2), 1, '... with a Hall row for season 2');
select is(pg_temp.village_scores('a'), 2, '... and a second score');

-- ---- The Hall of Legends ----
update public.profiles set hidden = true where id = pg_temp.id('c');
select pg_temp.build('b', pg_temp.full());
select pg_temp.build('c', pg_temp.full());
select pg_temp.build('d', pg_temp.full());
select pg_temp.as_a();
select is((select array_agg(season || ':' || clan_name order by season desc, clan_name) from public.clan_hall_of_legends()), array['2:Blue Fox', '2:Red Banner', '1:Red Banner'],
  'ana sees her school''s finished villages, newest season first');
select ok(not exists (select 1 from public.clan_hall_of_legends() where clan_name in ('Green Owl', 'Gold Hawk')), '... not a hidden profile''s clan, nor another school''s');
select is((select array_agg(is_me order by season desc, clan_name) from public.clan_hall_of_legends()), array[false, true, true], '... and which rows are hers');
select is((select village_done_on from public.clan_hall_of_legends() where clan_name = 'Blue Fox'), (now() at time zone 'Pacific/Auckland')::date, '... with the day');
select ok((select monster_done_on is null from public.clan_hall_of_legends() where clan_name = 'Blue Fox'), '... and no monster day yet');
select pg_temp.as_d();
select is((select array_agg(clan_name) from public.clan_hall_of_legends()), array['Gold Hawk'], 'dee, at the other school, sees only her own school''s');
select pg_temp.reset();

-- ---- Who can call what ----
select pg_temp.as_a();
select throws_ok('select * from public.clan_hall', '42501', null, 'a pupil cannot read the Hall table');
select throws_ok('select * from public.clan_school_seasons', '42501', null, 'a pupil cannot read the recorded seasons');
select throws_ok($$ select public.clan_season(pg_temp.id('a')) $$, '42501', null, 'a pupil cannot call clan_season');
select throws_ok('select public.clan_school_season(1)', '42501', null, 'a pupil cannot call clan_school_season');
select throws_ok('select public.clan_season_rules()', '42501', null, 'a pupil cannot call clan_season_rules');
select throws_ok('select public.clan_village_complete()', '42501', null, 'a pupil cannot call the village trigger function');
select throws_ok($$ update public.app_settings set clans_clock_from = current_date $$, '42501', null, 'a pupil cannot switch the clock on');
select pg_temp.reset();
select ok(has_function_privilege('authenticated', 'public.clan_hall_of_legends()', 'execute'), 'signed-in users can read the Hall of Legends');
select ok(not has_function_privilege('anon', 'public.clan_hall_of_legends()', 'execute'), '... signed-out visitors cannot');
select ok(has_function_privilege('service_role', 'public.clan_season(uuid)', 'execute') and has_function_privilege('service_role', 'public.clan_season_rules()', 'execute'),
  'the server can read the season and the rules');
select ok(not has_function_privilege('service_role', 'public.clan_school_season(integer)', 'execute')
  and not has_function_privilege('service_role', 'public.clan_village_complete()', 'execute'), '... and nothing else of it');

-- ---- Fame starts again when the season moves on, only while the clock is on ----
-- Douglas Park is in season 2 now (a 100 fame, b 50); dee's school has no date (50 fame).
select pg_temp.clock(-35, null, null);
select is((public.clan_nightly(19201) ->> 'ran')::boolean, true, 'the midnight job runs with the clock off');
select is(pg_temp.fame('a'), 100, '... and fame stays');
select is((select count(*)::integer from public.clan_school_seasons), 0, '... and no season is recorded');
select pg_temp.clock(-35, null, -1);
select public.clan_nightly(19202);
select is((select season from public.clan_school_seasons where school_id = 1), 2, 'with the clock on, a school seen for the first time is only recorded');
select is(pg_temp.fame('a'), 100, '... and its fame is not reset');
select public.clan_nightly(19203);
select is(pg_temp.fame('a'), 100, 'the same season again resets nothing');
select pg_temp.clock(-70, null, -1);
select is(pg_temp.season('a') ->> 'number', '3', 'the season moves on to 3');
create temp table before_season as select clans_season as s from public.app_settings where school_id = 1 and class_id is null;
select public.clan_nightly(19204);
select is(pg_temp.fame('a') + pg_temp.fame('b'), 0, 'at the next midnight the school''s clans start the new season with no fame');
select is(pg_temp.fame('d'), 50, '... but another school''s do not (its clock is off)');
select is((select season from public.clan_school_seasons where school_id = 1), 3, '... and the season is recorded');
select is((select clans_season from public.app_settings where school_id = 1 and class_id is null), (select s from pg_temp.before_season) + 1,
  'the school''s season number for the teachers goes up too');
update public.clans set fame = 7 where player = pg_temp.id('a');
select public.clan_nightly(19205);
select is(pg_temp.fame('a'), 7, 'the next night, in the same season, resets nothing more');
select pg_temp.clock(-105, null, null);
select public.clan_nightly(19206);
select is(pg_temp.fame('a'), 7, 'a season that moves on while the clock is off resets nothing');
select is((select season from public.clan_school_seasons where school_id = 1), 3, '... and is not recorded');

select * from finish();
rollback;
