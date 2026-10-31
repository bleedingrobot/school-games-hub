-- The Admin Classes tab (migration 20261028000900): admin_classes() and admin_create_class().
-- Only a school admin can call them; they show and change only their own school.
-- Run on a throw-away copy: scripts/scratch-db.sh admin, then
--   scripts/scratch-test.sh admin supabase/tests/database/admin_classes.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

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
update public.profiles set display_name = 'Fin Kea 6' where id = pg_temp.id('0f');
update public.profiles set display_name = 'Zed Weka 3' where id = pg_temp.id('1a');

-- School 1: Room Two (Fin teaches it; Bea and Dan are in it), Room Three (no teacher, empty), Old Room (archived; Cat is in it;
-- Fin and Eve teach it). School 2: Room X with no teacher, Zed in it.
insert into public.classes (school_id, name, school_year, year_level, warp_code, warp_mode, archived, archived_at) values
  (1, 'Room Two', 2026, 5, 'CDFGH', 'ask', false, null),
  (1, 'Room Three', 2026, null, 'JKMNP', 'on', false, null),
  (1, 'Old Room', 2025, null, 'QRTVW', 'off', true, now() - interval '3 days'),
  (2, 'Room X', 2026, null, 'XY346', 'on', false, null);
insert into public.class_members (student_id, class_id)
select pg_temp.id(s), c.id from (values ('0b', 'Room Two'), ('0d', 'Room Two'), ('0c', 'Old Room'), ('1a', 'Room X')) v(s, n)
join public.classes c on c.name = v.n;
insert into public.class_teachers (class_id, teacher_id)
select c.id, pg_temp.id('0f') from public.classes c where c.name in ('Room Two', 'Old Room');
insert into public.class_teachers (class_id, teacher_id)
select c.id, pg_temp.id('0e') from public.classes c where c.name = 'Old Room';

select set_config('test.room_two', (select id::text from public.classes where name = 'Room Two'), true);
select set_config('test.room_three', (select id::text from public.classes where name = 'Room Three'), true);
select set_config('test.old_room', (select id::text from public.classes where name = 'Old Room'), true);

-- Bea answered at 1 hour and 30 minutes ago (the latest) and 9 days ago; Dan 2 days ago; Cat (archived class) 10 minutes ago;
-- Zed (other school) 1 minute ago. Ana is in no class.
insert into public.question_log (player, game, spot, skipped, shown_ms, at) values
  (pg_temp.id('0b'), 'marble', 'gate', false, 4000, now() - interval '1 hour'),
  (pg_temp.id('0b'), 'marble', 'gate', true, 4000, now() - interval '30 minutes'),
  (pg_temp.id('0b'), 'mine', 'door', true, 4000, now() - interval '9 days'),
  (pg_temp.id('0d'), 'mine', 'door', false, 4000, now() - interval '2 days'),
  (pg_temp.id('0c'), 'mine', 'door', false, 4000, now() - interval '10 minutes'),
  (pg_temp.id('1a'), 'mine', 'door', true, 4000, now() - interval '1 minute');
select set_config('test.bea_latest', (select max(at)::text from public.question_log where player = pg_temp.id('0b')), true);
select set_config('test.cat_latest', (select max(at)::text from public.question_log where player = pg_temp.id('0c')), true);

create function pg_temp.class_row(who uuid) returns jsonb language sql as $$
  select e from jsonb_array_elements(pg_temp.got() -> 'classes') e where (e ->> 'id')::uuid = who
$$;

-- ---- Who can call them ----
select pg_temp.ana();
select throws_ok('select public.admin_classes()', '42501', null, 'a pupil cannot list the admin classes');
select throws_ok($$select public.admin_create_class('Room 9', 2026, null, '00000000-0000-0000-0000-00000000000f')$$, '42501', null,
  'a pupil cannot make a class for someone');
select pg_temp.reset();
select pg_temp.fin();
select throws_ok('select public.admin_classes()', '42501', null, 'an ordinary teacher cannot list the admin classes');
select throws_ok($$select public.admin_create_class('Room 9', 2026, null, '00000000-0000-0000-0000-00000000000f')$$, '42501', null,
  'an ordinary teacher cannot make a class for someone');
select pg_temp.reset();
set local role anon;
select throws_ok('select public.admin_classes()', '42501', null, 'signed-out visitors cannot list the admin classes');
select throws_ok($$select public.admin_create_class('Room 9', 2026, null, '00000000-0000-0000-0000-00000000000f')$$, '42501', null,
  'signed-out visitors cannot make a class for someone');
select pg_temp.reset();

-- ---- admin_classes() ----
select pg_temp.eve();
select set_config('test.got', public.admin_classes()::text, true);
select is(jsonb_array_length(pg_temp.got() -> 'classes'), 3, 'Eve lists the school''s 3 classes, the archived one included');
select is((select jsonb_agg(e ->> 'name') from jsonb_array_elements(pg_temp.got() -> 'classes') e),
  '["Room Three", "Room Two", "Old Room"]'::jsonb, '... current ones first, then by name; the archived one last');
select is(pg_temp.class_row(current_setting('test.room_two')::uuid) ->> 'students', '2', 'Room Two has 2 students');
select is(pg_temp.class_row(current_setting('test.room_two')::uuid) -> 'teachers',
  jsonb_build_array(jsonb_build_object('id', pg_temp.id('0f'), 'name', 'Fin Kea 6', 'realName', 'fin')),
  '... and Fin as its teacher');
select is((pg_temp.class_row(current_setting('test.room_two')::uuid) ->> 'lastActive')::timestamptz,
  current_setting('test.bea_latest')::timestamptz, '... last active when Bea last answered');
select is(pg_temp.class_row(current_setting('test.room_two')::uuid) ->> 'warpMode', 'ask', '... with its warp mode');
select is(pg_temp.class_row(current_setting('test.room_two')::uuid) ->> 'yearLevel', '5', '... and year level');
select is(pg_temp.class_row(current_setting('test.room_three')::uuid) -> 'teachers', '[]'::jsonb, 'Room Three has no teachers');
select is(pg_temp.class_row(current_setting('test.room_three')::uuid) ->> 'students', '0', '... and no students');
select is(pg_temp.class_row(current_setting('test.room_three')::uuid) -> 'lastActive', 'null'::jsonb, '... and was never active');
select is(pg_temp.class_row(current_setting('test.room_three')::uuid) -> 'yearLevel', 'null'::jsonb, '... and has no year level');
select is(pg_temp.class_row(current_setting('test.old_room')::uuid) ->> 'archived', 'true', 'Old Room is archived');
select isnt(pg_temp.class_row(current_setting('test.old_room')::uuid) -> 'archivedAt', 'null'::jsonb, '... with the day it was archived');
select is(jsonb_array_length(pg_temp.class_row(current_setting('test.old_room')::uuid) -> 'teachers'), 2, '... and both its teachers');
select is((pg_temp.class_row(current_setting('test.old_room')::uuid) ->> 'lastActive')::timestamptz,
  current_setting('test.cat_latest')::timestamptz, '... last active from its current member Cat');
select is(pg_temp.got()::text ~* '(room x|XY346|zed)', false, 'nothing from the other school appears');
select pg_temp.reset();
select pg_temp.boss();
select is(jsonb_array_length(public.admin_classes() -> 'classes'), 1, 'the other school''s admin sees only their one class');
select pg_temp.reset();

-- ---- admin_create_class() ----
select pg_temp.eve();
select set_config('test.for_fin', public.admin_create_class('Room Fin', 2026, 4, pg_temp.id('0f'))::text, true);
select set_config('test.for_eve', public.admin_create_class('Room Eve', 2026, null, pg_temp.id('0e'))::text, true);
select pg_temp.reset();
select is((select array_agg(teacher_id) from public.class_teachers where class_id = current_setting('test.for_fin')::uuid),
  array[pg_temp.id('0f')], 'a class made for Fin belongs to Fin only');
select is((select array_agg(teacher_id) from public.class_teachers where class_id = current_setting('test.for_eve')::uuid),
  array[pg_temp.id('0e')], 'a class made for Eve herself belongs to Eve');
select is((select year_level from public.classes where id = current_setting('test.for_fin')::uuid), 4, 'the year level is kept');
select pg_temp.eve();
select set_config('test.blank', public.admin_create_class('  ', 2026, null, pg_temp.id('0f'))::text, true);
select pg_temp.reset();
select is((select name from public.classes where id = current_setting('test.blank')::uuid), 'fin',
  'a blank name made for Fin gets Fin''s default name, not the admin''s');
select pg_temp.eve();
select throws_ok($$select public.admin_create_class('Room Z', 2026, null, '00000000-0000-0000-0000-00000000001e')$$, '22023',
  'That person isn''t a teacher at your school.', 'a teacher from the other school is refused');
select throws_ok($$select public.admin_create_class('Room Z', 2026, null, '00000000-0000-0000-0000-00000000000a')$$, '22023',
  'That person isn''t a teacher at your school.', 'a student is refused');
select throws_ok($$select public.admin_create_class('Room Z', 2026, null, '00000000-0000-0000-0000-0000000000ff')$$, '22023',
  'That person isn''t a teacher at your school.', 'someone who does not exist is refused');
select throws_ok($$select public.admin_create_class('<b>', 2026, null, '00000000-0000-0000-0000-00000000000f')$$, '22023',
  'Class names can use letters, numbers and spaces, up to 30 characters.', 'a bad name gives the usual class-name error');
select pg_temp.reset();
select is((select count(*)::integer from public.classes where name = 'Room Z'), 0, 'no class was left behind by the refusals');

select * from finish();
rollback;
