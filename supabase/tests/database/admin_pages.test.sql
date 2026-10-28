-- The Admin page (migration 20261028000800): admin_overview(), admin_students() and admin_teachers().
-- Only a school admin of the school can call them; they show that school and nothing from another; they write nothing.
-- Run on a throw-away copy: scripts/scratch-db.sh admin, then
--   scripts/scratch-test.sh admin supabase/tests/database/admin_pages.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

-- School 1 is Douglas Park (made by the migration). School 2 is made here.
select setval(pg_get_serial_sequence('public.schools', 'id'), 1);
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id) values ('otherschool.school.nz', 2);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'bea@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'dan@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'fin@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000001a', 'zed@otherschool.school.nz'),
  ('00000000-0000-0000-0000-00000000001e', 'boss@otherschool.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id in (
  '00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000001e');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000f';

-- Start with no classes, so the tests set them up themselves.
update public.schools set default_class = null;
delete from public.classes;

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || who)::uuid $$;
create function pg_temp.ana() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz') $$;
create function pg_temp.eve() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz') $$;
create function pg_temp.fin() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fin@douglaspark.school.nz') $$;
create function pg_temp.boss() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000001e', 'boss@otherschool.school.nz') $$;
create function pg_temp.got() returns jsonb language sql as $$ select current_setting('test.got')::jsonb $$;
create function pg_temp.row_of(arr text, who uuid) returns jsonb language sql as $$
  select e from jsonb_array_elements(pg_temp.got() -> arr) e where (e ->> 'id')::uuid = who
$$;

update public.profiles set display_name = 'Ana Moa 4' where id = pg_temp.id('0a');
update public.profiles set display_name = 'Bea Ruru 5' where id = pg_temp.id('0b');
update public.profiles set display_name = 'Cat Kiwi 1' where id = pg_temp.id('0c');
update public.profiles set display_name = 'Dan Tui 2', hidden = true where id = pg_temp.id('0d');
update public.profiles set display_name = 'Zed Weka 3' where id = pg_temp.id('1a');

-- School 1: Room Two (Fin teaches it; Bea and Dan are in it), Room Three (no teacher, empty), Old Room (archived; Cat is in it;
-- Fin used to teach it). Ana is in no class. School 2: Room X with no teacher, Zed in it.
insert into public.classes (school_id, name, school_year, warp_code, archived) values
  (1, 'Room Two', 2026, 'CDFGH', false),
  (1, 'Room Three', 2026, 'JKMNP', false),
  (1, 'Old Room', 2025, 'QRTVW', true),
  (2, 'Room X', 2026, 'XY346', false);
insert into public.class_members (student_id, class_id)
select pg_temp.id(s), c.id from (values ('0b', 'Room Two'), ('0d', 'Room Two'), ('0c', 'Old Room'), ('1a', 'Room X')) v(s, n)
join public.classes c on c.name = v.n;
insert into public.class_teachers (class_id, teacher_id)
select c.id, pg_temp.id('0f') from public.classes c where c.name in ('Room Two', 'Old Room');

select set_config('test.room_two', (select id::text from public.classes where name = 'Room Two'), true);
select set_config('test.room_three', (select id::text from public.classes where name = 'Room Three'), true);

-- A request from Ana for Room Three has waited 2 days; Cat's is 1 hour old; Zed's (other school) has waited 5 days.
insert into public.warp_requests (student_id, class_id, status, created_at)
select pg_temp.id('0a'), id, 'pending', now() - interval '2 days' from public.classes where name = 'Room Three';
insert into public.warp_requests (student_id, class_id, status, created_at)
select pg_temp.id('0c'), id, 'pending', now() - interval '1 hour' from public.classes where name = 'Room Two';
insert into public.warp_requests (student_id, class_id, status, created_at)
select pg_temp.id('1a'), id, 'pending', now() - interval '5 days' from public.classes where name = 'Room X';

-- This week: Bea was shown 3 and skipped 1, Dan 1; Bea has one from 9 days ago. Zed (other school) was shown 5, all skipped.
insert into public.question_log (player, game, spot, skipped, shown_ms, at) values
  (pg_temp.id('0b'), 'marble', 'gate', false, 4000, now() - interval '1 hour'),
  (pg_temp.id('0b'), 'marble', 'gate', false, 4000, now() - interval '1 hour'),
  (pg_temp.id('0b'), 'marble', 'gate', true, 4000, now() - interval '30 minutes'),
  (pg_temp.id('0d'), 'mine', 'door', false, 4000, now() - interval '2 days'),
  (pg_temp.id('0b'), 'mine', 'door', true, 4000, now() - interval '9 days'),
  (pg_temp.id('1a'), 'mine', 'door', true, 4000, now() - interval '1 hour'),
  (pg_temp.id('1a'), 'mine', 'door', true, 4000, now() - interval '1 hour'),
  (pg_temp.id('1a'), 'mine', 'door', true, 4000, now() - interval '1 hour'),
  (pg_temp.id('1a'), 'mine', 'door', true, 4000, now() - interval '1 hour'),
  (pg_temp.id('1a'), 'mine', 'door', true, 4000, now() - interval '1 hour');

-- ---- Who can call them ----
select pg_temp.ana();
select throws_ok('select public.admin_overview()', '42501', null, 'a pupil cannot read the admin overview');
select throws_ok('select public.admin_students()', '42501', null, 'a pupil cannot list the school''s students');
select throws_ok('select public.admin_teachers()', '42501', null, 'a pupil cannot list the school''s teachers');
select pg_temp.reset();
select pg_temp.fin();
select throws_ok('select public.admin_overview()', '42501', null, 'an ordinary teacher cannot read the admin overview');
select throws_ok('select public.admin_students()', '42501', null, 'an ordinary teacher cannot list the school''s students');
select throws_ok('select public.admin_teachers()', '42501', null, 'an ordinary teacher cannot list the school''s teachers');
select pg_temp.reset();
set local role anon;
select throws_ok('select public.admin_overview()', '42501', null, 'signed-out visitors cannot read the admin overview');
select throws_ok('select public.admin_students()', '42501', null, 'signed-out visitors cannot list students');
select throws_ok('select public.admin_teachers()', '42501', null, 'signed-out visitors cannot list teachers');
select pg_temp.reset();

-- ---- admin_overview() ----
select pg_temp.eve();
select set_config('test.got', public.admin_overview()::text, true);
select is(pg_temp.got() -> 'counts' ->> 'classes', '2', 'Eve sees 2 classes (Room Three and Room Two; not the archived one, not the other school''s)');
select is(pg_temp.got() -> 'counts' ->> 'students', '4', '... 4 students');
select is(pg_temp.got() -> 'counts' ->> 'teachers', '2', '... 2 teachers');
select is(pg_temp.got() -> 'counts' ->> 'admins', '1', '... 1 admin');
select is(pg_temp.got() -> 'counts' ->> 'activeWeek', '2', '... 2 students active this week (Bea and Dan)');
select is(pg_temp.got() -> 'counts' ->> 'shownWeek', '4', '... 4 questions shown this week (not the old one, not the other school''s)');
select is(pg_temp.got() -> 'counts' ->> 'skippedWeek', '1', '... 1 of them skipped');
select is(pg_temp.got() ->> 'noClass', '2', '... 2 students with no current class (Ana, and Cat whose class is archived)');
select is(pg_temp.got() -> 'classesNoTeacher', jsonb_build_array(jsonb_build_object(
  'id', current_setting('test.room_three')::uuid, 'name', 'Room Three')), '... Room Three has no teacher (and no other class is listed)');
select is(pg_temp.got() ->> 'oldWarp', '1', '... 1 join request has waited over a day (Cat''s recent one and the other school''s don''t count)');
select pg_temp.reset();
select pg_temp.boss();
select is(public.admin_overview() -> 'counts' ->> 'students', '1', 'the other school''s admin sees only their own school''s numbers');
select pg_temp.reset();

-- ---- admin_students() ----
select pg_temp.eve();
select set_config('test.got', public.admin_students()::text, true);
select is(jsonb_array_length(pg_temp.got() -> 'students'), 4, 'Eve lists the school''s 4 students (no teachers, no Zed)');
select is(pg_temp.got() -> 'students' -> 0 ->> 'realName', 'ana', '... in real-name order');
select is(pg_temp.row_of('students', pg_temp.id('0a')) -> 'classId', 'null'::jsonb, 'Ana is in no class');
select is(pg_temp.row_of('students', pg_temp.id('0b')) ->> 'className', 'Room Two', 'Bea is in Room Two');
select is(pg_temp.row_of('students', pg_temp.id('0c')) ->> 'classArchived', 'true', 'Cat''s class is archived');
select is(pg_temp.row_of('students', pg_temp.id('0d')) ->> 'hidden', 'true', 'Dan is hidden');
select is(pg_temp.got()::text ~* '(zed|weka)', false, '... and nothing from the other school appears');
select pg_temp.reset();

-- ---- admin_teachers() ----
select pg_temp.eve();
select set_config('test.got', public.admin_teachers()::text, true);
select is(jsonb_array_length(pg_temp.got() -> 'teachers'), 2, 'Eve lists the school''s 2 teachers (not the other school''s)');
select is(pg_temp.row_of('teachers', pg_temp.id('0e')) ->> 'me', 'true', 'Eve''s own row says me');
select is(pg_temp.row_of('teachers', pg_temp.id('0f')) ->> 'me', 'false', '... and Fin''s does not');
select is(pg_temp.row_of('teachers', pg_temp.id('0f')) -> 'classes',
  jsonb_build_array(jsonb_build_object('id', current_setting('test.room_two')::uuid, 'name', 'Room Two')),
  'Fin teaches Room Two (the archived class is left out)');
select is(pg_temp.row_of('teachers', pg_temp.id('0e')) ->> 'admin', 'true', 'Eve is a school admin');
select is(pg_temp.row_of('teachers', pg_temp.id('0f')) ->> 'admin', 'false', '... and Fin is not');
select pg_temp.reset();

select * from finish();
rollback;
