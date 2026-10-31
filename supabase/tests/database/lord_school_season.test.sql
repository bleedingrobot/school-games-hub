-- Dragon Maths: one season date for the whole school (migration 20261028000400, docs/DRAGON-SCHOOL-SEASON.md section 3).
-- With a season in progress in two classes on different dates, the migration's data step gives the school the earliest
-- date: both classes are then on its season number, a pupil in the later class starts a new season on their next request
-- (jumping two seasons) and one in the earlier class doesn't, and the Warriors list shows both classes. Switching a class
-- off leaves the school's seasons alone; the holiday pause (school admins only) closes every class and resuming moves the
-- start forward by the days paused; a plain teacher can't set the date or the pause; an admin can't take the season number
-- down; the class reports show the school's season.
-- Run on a throw-away copy: scripts/scratch-db.sh season, then
--   scripts/scratch-test.sh season supabase/tests/database/lord_school_season.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'dan@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'fin@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-000000000010', 'gus@douglaspark.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000e';
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000f';

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || who)::uuid $$;
create function pg_temp.cat() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz') $$;
create function pg_temp.eve() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz') $$;
create function pg_temp.fin() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fin@douglaspark.school.nz') $$;
-- Days from today, worked out before acting as a teacher (teachers can't call nz_day).
select set_config('test.today', public.nz_day(now())::text, true);
create function pg_temp.day(offset_days integer) returns date language sql as $$ select current_setting('test.today')::date + offset_days $$;
create function pg_temp.txt(offset_days integer) returns text language sql as $$ select to_char(pg_temp.day(offset_days), 'YYYY-MM-DD') $$;
create function pg_temp.school_row() returns public.app_settings language sql as $$
  select s.* from public.app_settings s
  where s.class_id is null and s.school_id = (select school_id from public.profiles where id = pg_temp.id('0a'))
$$;
-- The season number the game works out from what lord_settings hands it (shared/lord/engine.ts seasonOf).
create function pg_temp.game_season(player uuid) returns integer language sql as $$
  select ((current_setting('test.today')::date - (public.lord_settings(player) ->> 'seasonStart')::date) / 35) + 1
$$;

-- Cat and Dan are in Room Two and Gus in Room Three; Fin teaches both. Ana stays in the school's Everyone class.
insert into public.classes (school_id, name, school_year, warp_code)
values ((select school_id from public.profiles where id = pg_temp.id('0a')), 'Room Two', 2026, 'CDFGH'),
       ((select school_id from public.profiles where id = pg_temp.id('0a')), 'Room Three', 2026, 'JKMNP');
update public.class_members set class_id = (select id from public.classes where name = 'Room Two')
where student_id in (pg_temp.id('0c'), pg_temp.id('0d'));
update public.class_members set class_id = (select id from public.classes where name = 'Room Three') where student_id = pg_temp.id('10');
delete from public.class_teachers where teacher_id = pg_temp.id('0f');
insert into public.class_teachers (class_id, teacher_id)
select id, pg_temp.id('0f') from public.classes where name in ('Room Two', 'Room Three');
select set_config('test.room_two', (select id::text from public.classes where name = 'Room Two'), true);
select set_config('test.room_three', (select id::text from public.classes where name = 'Room Three'), true);
select public.give_class_settings(id) from public.classes where name in ('Room Two', 'Room Three');

-- ---- Before: a season in progress, each class on its own date ----
-- Room Two started 100 days ago (season 3, day 31, 4 days left) and Room Three 10 days ago (season 1, day 11), and Room
-- Three had been switched off a few days (a per-class pause). The school's own row has no date but an old pause, and the
-- Everyone class has none. Both classes are on, with heroes in their own season.
update public.app_settings set lord_enabled = true, lord_season_start = null, lord_paused_since = null
where school_id = (pg_temp.school_row()).school_id;
update public.app_settings set lord_season_start = pg_temp.day(-100) where class_id = current_setting('test.room_two')::uuid;
update public.app_settings set lord_season_start = pg_temp.day(-10), lord_paused_since = pg_temp.day(-3)
where class_id = current_setting('test.room_three')::uuid;
update public.app_settings set lord_paused_since = pg_temp.day(-20) where id = (pg_temp.school_row()).id;
insert into public.lord_heroes (player, hero, version, season, day) values
  (pg_temp.id('0c'), '{"level": 6}', 1, 3, '2026-01-01'),
  (pg_temp.id('0d'), '{"level": 4}', 1, 3, '2026-01-01'),
  (pg_temp.id('10'), '{"level": 9}', 1, 1, '2026-01-01');

-- ---- The migration's data step ----
select public.lord_school_season_step();
select is((pg_temp.school_row()).lord_season_start, pg_temp.day(-100), 'the school starts from the earliest date any of its rows has');
select is((pg_temp.school_row()).lord_paused_since, null, '... and its pause is cleared');
select is((select lord_season_start from public.app_settings where class_id = current_setting('test.room_three')::uuid), pg_temp.day(-10),
  'the class rows'' old dates are left in place (so it can be undone)');
select is(public.lord_current_season(pg_temp.id('0c')), 3, 'Room Two is still in season 3');
select is(public.lord_current_season(pg_temp.id('10')), 3, 'Room Three is now in season 3 too (two seasons forward)');
select is(public.lord_current_season(pg_temp.id('0a')), 3, 'and so is a class with no date of its own');
select is(public.lord_settings(pg_temp.id('10')) ->> 'seasonStart', pg_temp.txt(-100), 'the game is handed the school''s date');
select is(public.lord_settings(pg_temp.id('10')) ->> 'pausedSince', null, '... with no pause');
select is((public.lord_settings(pg_temp.id('10')) ->> 'enabled')::boolean, true, '... and Room Three''s switch');
select ok((select season from public.lord_heroes where player = pg_temp.id('10')) < pg_temp.game_season(pg_temp.id('10')),
  'Gus (Room Three) starts a new season on his next request: his hero''s season is lower than the game''s');
select is((select season from public.lord_heroes where player = pg_temp.id('0c')), pg_temp.game_season(pg_temp.id('0c')),
  'Cat (Room Two) doesn''t: her hero is already in the game''s season');

-- ---- The Warriors list is whole school, on one season number ----
-- (The game moves Gus's hero to season 3 on his next request, as handler.test.ts checks.)
update public.lord_heroes set season = 3, hero = '{"level": 1}' where player = pg_temp.id('10');
select pg_temp.cat();
select is((select count(*)::integer from public.lord_warriors()), 3, 'Cat''s Warriors list shows both classes'' heroes');
select ok(exists (select 1 from public.lord_warriors() where level = 1), '... including Gus from Room Three');
select pg_temp.reset();

-- ---- Who can see and change the school's season ----
select pg_temp.cat();
select throws_ok('select public.lord_school_season()', '42501', null, 'a pupil can''t read the school''s season page');
select throws_ok('select public.admin_set_lord_season(current_date)', '42501', null, 'or set the date');
select throws_ok('select public.admin_set_lord_holiday(true)', '42501', null, 'or the pause');
select pg_temp.reset();
set local role anon;
select throws_ok('select public.lord_school_season()', '42501', null, 'signed-out visitors can''t read it');
select pg_temp.reset();

select pg_temp.fin();
select is(public.lord_school_season(), jsonb_build_object('start', pg_temp.txt(-100), 'pausedSince', null, 'number', 3,
  'dayOfSeason', 31, 'daysLeft', 4, 'startsIn', null, 'canChange', false), 'a plain teacher sees the school''s season, and can''t change it');
select throws_ok(format('select public.admin_set_lord_season(%L::date)', pg_temp.day(-200)), '42501',
  'Only a school admin can change the season date.', 'a plain teacher can''t set the date');
select throws_ok(format('select public.teacher_set_lord(%L::jsonb, %L::uuid)',
  jsonb_build_object('enabled', true, 'seasonStart', pg_temp.txt(-200)), current_setting('test.room_two')), '42501',
  'Only a school admin can change the season date.', '... even through the class settings');
select throws_ok('select public.admin_set_lord_holiday(true)', '42501', 'Only a school admin can pause the seasons.',
  'a plain teacher can''t pause the seasons');

-- ---- Switching one class off closes it for that class only ----
select is(public.teacher_set_lord('{"enabled":false}', current_setting('test.room_three')::uuid) ->> 'seasonStart', pg_temp.txt(-100),
  'Fin switches Room Three off');
select pg_temp.reset();
select is((pg_temp.school_row()).lord_season_start, pg_temp.day(-100), '... the school''s start is untouched');
select is((pg_temp.school_row()).lord_paused_since, null, '... and its seasons aren''t paused');
select is((public.lord_settings(pg_temp.id('10')) ->> 'enabled')::boolean, false, '... Room Three is closed');
select is((public.lord_settings(pg_temp.id('0c')) ->> 'enabled')::boolean, true, '... Room Two isn''t');
select pg_temp.fin();
select is(public.teacher_set_lord('{"enabled":true}', current_setting('test.room_three')::uuid) ->> 'seasonStart', pg_temp.txt(-100),
  'switching it on again carries on in the school''s season, with no date moved');
select pg_temp.reset();

-- ---- The holiday pause (whole school) ----
select pg_temp.eve();
select is(public.admin_set_lord_holiday(true) ->> 'pausedSince', pg_temp.txt(0), 'Eve (school admin) pauses the seasons for the holidays');
select pg_temp.reset();
select is((public.lord_settings(pg_temp.id('0c')) ->> 'enabled')::boolean, false, '... Room Two is closed');
select is((public.lord_settings(pg_temp.id('10')) ->> 'enabled')::boolean, false, '... and so is Room Three');
select is((select lord_enabled from public.app_settings where class_id = current_setting('test.room_two')::uuid), true,
  '... without touching the classes'' own switches');
-- A week later the clock has waited: the date handed out has moved with it, so the season and its day stand still.
update public.app_settings set lord_paused_since = pg_temp.day(-7) where id = (pg_temp.school_row()).id;
select is(public.lord_settings(pg_temp.id('0c')) ->> 'seasonStart', pg_temp.txt(-93), 'while paused the clock waits (the date moves a day a day)');
select is(public.lord_current_season(pg_temp.id('0c')), 3, '... so it is still season 3');
select pg_temp.eve();
select is(public.admin_set_lord_holiday(false) ->> 'start', pg_temp.txt(-93), 'ending the pause moves the start forward by the 7 days paused');
select pg_temp.reset();
select is((pg_temp.school_row()).lord_season_start, pg_temp.day(-93), '... and saves it');
select is((public.lord_settings(pg_temp.id('0c')) ->> 'enabled')::boolean, true, '... and every class that is on is open again');

-- ---- Changing the date: never so the season number goes down ----
select pg_temp.eve();
select throws_ok(format('select public.admin_set_lord_season(%L::date)', pg_temp.day(-20)), '22023',
  format('That would take the school back to season 1. Pick a day on or before %s.',
    to_char(pg_temp.day(-70), case when extract(year from pg_temp.day(-70)) = extract(year from pg_temp.day(0)) then 'FMDD Mon' else 'FMDD Mon YYYY' end)),
  'an admin can''t take the school back a season, and is told the latest day that works');
select throws_ok(format('select public.admin_set_lord_season(%L::date)', pg_temp.day(5)), '22023', null,
  'or put it before season 1');
select throws_ok('select public.admin_set_lord_season(null)', '22023', null, 'and the date can''t be cleared');
select is(public.admin_set_lord_season(pg_temp.day(-70)) ->> 'number', '3', 'the latest day that keeps season 3 is fine');
select is(public.teacher_set_lord(jsonb_build_object('enabled', true, 'seasonStart', pg_temp.txt(-180)),
  current_setting('test.room_two')::uuid) ->> 'seasonStart', pg_temp.txt(-180), 'an earlier date moves the school on a season (old page''s date box too)');
select pg_temp.reset();

-- ---- The class reports show the school's season ----
select pg_temp.fin();
select is(public.teacher_lord_class(current_setting('test.room_three')::uuid) -> 'season',
  jsonb_build_object('number', 6, 'start', pg_temp.txt(-180), 'daysLeft', 29), 'Room Three''s report shows the school''s season');
select is(public.teacher_lord_class(current_setting('test.room_two')::uuid) -> 'season' ->> 'number', '6', 'so does Room Two''s, on its own older date before');
select pg_temp.reset();

-- ---- Switching on with no school date starts season 1 today for the whole school ----
update public.app_settings set lord_season_start = null, lord_enabled = false where school_id = (pg_temp.school_row()).school_id;
select pg_temp.fin();
select is(public.teacher_set_lord('{"enabled":true}', current_setting('test.room_two')::uuid) ->> 'seasonStart', pg_temp.txt(0),
  'with no school date, switching a class on starts season 1 today');
select pg_temp.reset();

select * from finish();
rollback;
