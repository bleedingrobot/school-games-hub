-- The Admin End of year tab (migration 20261028001000): admin_log and admin_year(), admin_mark_step(), admin_archive_classes(),
-- admin_delete_leavers(), admin_new_points_season() and admin_clans_new_season().
-- Only a school admin can call them; they show and change only their own school.
-- Run on a throw-away copy: scripts/scratch-db.sh admin, then
--   scripts/scratch-test.sh admin supabase/tests/database/admin_end_of_year.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(74);

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
  ('00000000-0000-0000-0000-000000000010', 'gus@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000001a', 'zed@otherschool.school.nz'),
  ('00000000-0000-0000-0000-00000000001e', 'boss@otherschool.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id in (
  '00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000001e');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000f';
update public.profiles set display_name = 'Eve Fox 7' where id = '00000000-0000-0000-0000-00000000000e';
update public.profiles set display_name = 'Boss Fox 8' where id = '00000000-0000-0000-0000-00000000001e';

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
create function pg_temp.cls(n text) returns uuid language sql security definer as $$ select id from public.classes where name = n $$;

-- School 1: Room Two (Bea and Dan), Room Three (Gus), Old Room (archived; Cat). Ana is in no class. School 2: Room X (Zed).
insert into public.classes (school_id, name, school_year, warp_code, archived, archived_at) values
  (1, 'Room Two', 2026, 'CDFGH', false, null),
  (1, 'Room Three', 2026, 'JKMNP', false, null),
  (1, 'Old Room', 2025, 'QRTVW', true, now() - interval '3 days'),
  (2, 'Room X', 2026, 'XY346', false, null);
insert into public.class_members (student_id, class_id)
select pg_temp.id(s), pg_temp.cls(n) from (values ('0b', 'Room Two'), ('0d', 'Room Two'), ('10', 'Room Three'),
  ('0c', 'Old Room'), ('1a', 'Room X')) v(s, n);

-- ---- Who can call them ----
select pg_temp.ana();
select throws_ok('select public.admin_year()', '42501', null, 'a pupil cannot read the year log');
select throws_ok($$select public.admin_mark_step('classes')$$, '42501', null, 'a pupil cannot mark a step');
select throws_ok($$select public.admin_archive_classes(array[pg_temp.cls('Room Two')])$$, '42501', null, 'a pupil cannot archive classes');
select throws_ok($$select public.admin_delete_leavers(array[pg_temp.id('0a')], '1')$$, '42501', null, 'a pupil cannot delete leavers');
select throws_ok($$select public.admin_new_points_season('NEW SEASON')$$, '42501', null, 'a pupil cannot start a points season');
select throws_ok($$select public.admin_clans_new_season('NEW SEASON')$$, '42501', null, 'a pupil cannot start a fame season');
select pg_temp.reset();
select pg_temp.fin();
select throws_ok('select public.admin_year()', '42501', null, 'an ordinary teacher cannot read the year log');
select throws_ok($$select public.admin_mark_step('classes')$$, '42501', null, 'an ordinary teacher cannot mark a step');
select throws_ok($$select public.admin_archive_classes(array[pg_temp.cls('Room Two')])$$, '42501', null, 'an ordinary teacher cannot archive classes');
select throws_ok($$select public.admin_delete_leavers(array[pg_temp.id('0a')], '1')$$, '42501', null, 'an ordinary teacher cannot delete leavers');
select throws_ok($$select public.admin_new_points_season('NEW SEASON')$$, '42501', null, 'an ordinary teacher cannot start a points season');
select throws_ok($$select public.admin_clans_new_season('NEW SEASON')$$, '42501', null, 'an ordinary teacher cannot start a fame season');
select pg_temp.reset();
set local role anon;
select throws_ok('select public.admin_year()', '42501', null, 'signed-out visitors cannot read the year log');
select throws_ok($$select public.admin_mark_step('classes')$$, '42501', null, 'signed-out visitors cannot mark a step');
select throws_ok($$select public.admin_archive_classes(array[pg_temp.cls('Room Two')])$$, '42501', null, 'signed-out visitors cannot archive classes');
select throws_ok($$select public.admin_delete_leavers(array[pg_temp.id('0a')], '1')$$, '42501', null, 'signed-out visitors cannot delete leavers');
select throws_ok($$select public.admin_new_points_season('NEW SEASON')$$, '42501', null, 'signed-out visitors cannot start a points season');
select throws_ok($$select public.admin_clans_new_season('NEW SEASON')$$, '42501', null, 'signed-out visitors cannot start a fame season');
select pg_temp.reset();

-- Even a school admin cannot touch the log table or the helper directly.
select pg_temp.eve();
select throws_ok('select * from public.admin_log', '42501', null, 'an admin cannot read admin_log directly');
select throws_ok($$insert into public.admin_log (school_id, action) values (1, 'classes')$$, '42501', null,
  'an admin cannot write to admin_log directly');
select throws_ok($$select public.admin_log_add('classes', '{}')$$, '42501', null, 'an admin cannot call admin_log_add');
select pg_temp.reset();
select ok(not has_function_privilege('anon', 'public.admin_log_add(text, jsonb)', 'execute')
      and not has_function_privilege('authenticated', 'public.admin_log_add(text, jsonb)', 'execute'),
  'admin_log_add is not executable by anon or signed-in users');

-- ---- admin_year(): nothing yet ----
select pg_temp.eve();
select set_config('test.got', public.admin_year()::text, true);
select pg_temp.reset();
select is(pg_temp.got() -> 'steps', '{"classes": null, "archive": null, "leavers": null, "points": null, "fame": null, "dragon": null}'::jsonb,
  'at first all six steps are null');
select is(pg_temp.got() -> 'log', '[]'::jsonb, '... and the log is empty');

-- ---- admin_mark_step() ----
select pg_temp.eve();
select public.admin_mark_step('classes');
select set_config('test.got', public.admin_year()::text, true);
select throws_ok($$select public.admin_mark_step('points')$$, '22023', 'That step can''t be marked done.', 'only classes and dragon can be marked');
select throws_ok($$select public.admin_mark_step(null)$$, '22023', 'That step can''t be marked done.', 'a missing step is refused');
select pg_temp.reset();
select is(pg_temp.got() #>> '{steps,classes,by}', 'Eve Fox 7', 'marking classes logs it with the admin''s made-up name');
select is(pg_temp.got() #>> '{steps,classes,byRealName}', 'eve', '... and real name');
select is(pg_temp.got() #> '{steps,classes,detail}', '{}'::jsonb, '... with empty detail');
select is(pg_temp.got() #>> '{steps,archive}', null, '... and no other step is touched');
select is((select count(*)::integer from public.admin_log where action = 'points'), 0, 'the refused mark wrote nothing');

-- The other school's admin marks two steps; Eve never sees them.
select pg_temp.boss();
select public.admin_mark_step('classes');
select public.admin_mark_step('dragon');
select pg_temp.reset();

-- ---- admin_archive_classes() ----
select pg_temp.eve();
select throws_ok('select public.admin_archive_classes(array[]::uuid[])', '22023', 'Tick at least one class.', 'an empty list is refused');
select throws_ok('select public.admin_archive_classes(null)', '22023', 'Tick at least one class.', 'a null list is refused');
select throws_ok($$select public.admin_archive_classes(array[pg_temp.cls('Old Room')])$$, '22023',
  'One of those classes isn''t a current class at your school.', 'an archived class is refused');
select throws_ok($$select public.admin_archive_classes(array[pg_temp.cls('Room X')])$$, '22023',
  'One of those classes isn''t a current class at your school.', 'another school''s class is refused');
select throws_ok($$select public.admin_archive_classes(array[pg_temp.cls('Room Two'), pg_temp.cls('Room X')])$$, '22023',
  'One of those classes isn''t a current class at your school.', 'a good class with another school''s class is refused');
select pg_temp.reset();
select is((select array_agg(name order by name) from public.classes where archived), array['Old Room'],
  'the refusals archived nothing');
select is((select count(*)::integer from public.admin_log where action = 'archive'), 0, '... and logged nothing');
select pg_temp.eve();
select set_config('test.got', public.admin_archive_classes(array[pg_temp.cls('Room Three')])::text, true);
select pg_temp.reset();
select is(current_setting('test.got'), '1', 'archiving one class returns 1');
select is((select archived from public.classes where name = 'Room Three'), true, '... and Room Three is archived');
select is((select archived from public.classes where name = 'Room Two'), false, '... Room Two is not');
select is((select detail from public.admin_log where action = 'archive'), '{"count": 1, "names": ["Room Three"]}'::jsonb,
  '... and the log has the count and the class names');
select is((select archived from public.classes where name = 'Room X'), false, 'the other school''s class is untouched');

-- ---- admin_delete_leavers() ----
-- Leavers now: Ana (no class), Cat (Old Room, archived), Gus (Room Three, now archived).
select pg_temp.eve();
select throws_ok('select public.admin_delete_leavers(array[]::uuid[], ''0'')', '22023', 'Tick at least one student.', 'an empty list is refused');
select throws_ok('select public.admin_delete_leavers(null, ''1'')', '22023', 'Tick at least one student.', 'a null list is refused');
select throws_ok($$select public.admin_delete_leavers(array[pg_temp.id('0a')], '2')$$, '22023',
  'Type the number of students to confirm.', 'a wrong confirm number is refused');
select throws_ok($$select public.admin_delete_leavers(array[pg_temp.id('0a')], 'one')$$, '22023',
  'Type the number of students to confirm.', 'words instead of a number are refused');
select throws_ok($$select public.admin_delete_leavers(array[pg_temp.id('0a'), pg_temp.id('0b')], '2')$$, '22023',
  'One of those students is still in a current class, or isn''t a student at your school.', 'a student in a current class is refused');
select throws_ok($$select public.admin_delete_leavers(array[pg_temp.id('0f')], '1')$$, '22023',
  'One of those students is still in a current class, or isn''t a student at your school.', 'a teacher is refused');
select throws_ok($$select public.admin_delete_leavers(array[pg_temp.id('1a')], '1')$$, '22023',
  'One of those students is still in a current class, or isn''t a student at your school.', 'another school''s student is refused');
select pg_temp.reset();
select is((select count(*)::integer from auth.users where id in (select pg_temp.id(x) from unnest(array['0a','0b','0c','0d','0f','10','1a']) x)), 7,
  'the refusals deleted nobody');
select is((select count(*)::integer from public.admin_log where action = 'leavers'), 0, '... and logged nothing');
select pg_temp.eve();
select set_config('test.got', public.admin_delete_leavers(array[pg_temp.id('0a'), pg_temp.id('0c'), pg_temp.id('10')], '3')::text, true);
select pg_temp.reset();
select is(current_setting('test.got'), '3', 'deleting the three leavers returns 3');
select is((select count(*)::integer from auth.users where id in (select pg_temp.id(x) from unnest(array['0a','0c','10']) x)), 0,
  '... and they are gone (no class, archived class)');
select is((select count(*)::integer from auth.users where id in (select pg_temp.id(x) from unnest(array['0b','0d','0f','1a']) x)), 4,
  '... but pupils in a current class, the teacher and the other school''s pupil stay');
select is((select detail from public.admin_log where action = 'leavers'), '{"count": 3}'::jsonb, '... and the log has only the count');

-- ---- admin_new_points_season() ----
select pg_temp.eve();
select throws_ok($$select public.admin_new_points_season('new season')$$, '22023', 'Type NEW SEASON to start a new season.',
  'the wrong words give 22023 for a points season');
select pg_temp.reset();
select is((select count(*)::integer from public.admin_log where action = 'points'), 0, '... and log nothing');
select pg_temp.eve();
select set_config('test.got', public.admin_new_points_season('NEW SEASON')::text, true);
select pg_temp.reset();
select is((select count(*)::integer from public.admin_log where action = 'points'), 1, 'the right words log one points row');
select is((select detail from public.admin_log where action = 'points'), pg_temp.got(), '... with the result as its detail');
select ok(pg_temp.got() ? 'botGames', '... which is the usual season result');

-- ---- admin_clans_new_season() ----
select pg_temp.eve();
select throws_ok($$select public.admin_clans_new_season('nope')$$, '22023', 'Type NEW SEASON to start a new season.',
  'the wrong words give 22023 for a fame season');
select pg_temp.reset();
select is((select count(*)::integer from public.admin_log where action = 'fame'), 0, '... and log nothing');
select pg_temp.eve();
select set_config('test.got', public.admin_clans_new_season('NEW SEASON')::text, true);
select pg_temp.reset();
select is((select count(*)::integer from public.admin_log where action = 'fame'), 1, 'the right words log one fame row');
select is((select detail from public.admin_log where action = 'fame'), pg_temp.got(), '... with the result as its detail');
select ok(pg_temp.got() ? 'season' and pg_temp.got() ? 'clans', '... which has the season and clan count');

-- ---- admin_year() after the steps ----
select pg_temp.eve();
select set_config('test.got', public.admin_year()::text, true);
select pg_temp.reset();
select is(pg_temp.got() #> '{steps,archive,detail}', '{"count": 1, "names": ["Room Three"]}'::jsonb, 'the archive step shows its latest detail');
select is(pg_temp.got() #>> '{steps,leavers,byRealName}', 'eve', 'the leavers step shows who did it');
select is(pg_temp.got() #>> '{steps,dragon}', null, 'the other school''s dragon step never shows');
select is((select jsonb_agg(e ->> 'action') from jsonb_array_elements(pg_temp.got() -> 'log') e),
  '["fame", "points", "leavers", "archive", "classes"]'::jsonb, 'the log is newest first and has only this school''s rows');
select is(pg_temp.got() #>> '{log,0,by}', 'Eve Fox 7', '... with who did each one');

-- A later mark of the same step replaces the earlier one in steps.
select pg_temp.eve();
select public.admin_mark_step('classes');
select pg_temp.reset();
update public.admin_log set at = now() - interval '5 days', actor = null where action = 'classes' and school_id = 1
  and id = (select min(id) from public.admin_log where action = 'classes' and school_id = 1);
select pg_temp.eve();
select is(public.admin_year() #>> '{steps,classes,by}', 'Eve Fox 7', 'the latest row for a step is the one shown');
select pg_temp.reset();

-- The log holds the latest 20 rows only.
insert into public.admin_log (school_id, action) select 1, 'dragon' from generate_series(1, 25);
select pg_temp.eve();
select is(jsonb_array_length(public.admin_year() -> 'log'), 20, 'the log shows only the latest 20 rows');
select pg_temp.reset();
select pg_temp.boss();
select is(jsonb_array_length(public.admin_year() -> 'log'), 2, 'the other school''s admin sees only their own two rows');
select pg_temp.reset();

select * from finish();
rollback;
