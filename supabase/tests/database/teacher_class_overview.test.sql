-- The Students tab and the student page (migration 20261028000700): teacher_students(target_class),
-- teacher_class_overview(target_class) and teacher_student_card(student).
-- A teacher sees only the class asked for, can't read a class or a student they don't teach, and a pupil and a signed-out
-- visitor can't call any of them. teacher_students() with no class is unchanged.
-- Run on a throw-away copy: scripts/scratch-db.sh overview, then
--   scripts/scratch-test.sh overview supabase/tests/database/teacher_class_overview.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'bea@douglaspark.school.nz'),
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
create function pg_temp.ana() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz') $$;
create function pg_temp.eve() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz') $$;
create function pg_temp.fin() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fin@douglaspark.school.nz') $$;
create function pg_temp.overview() returns jsonb language sql as $$ select current_setting('test.overview')::jsonb $$;
create function pg_temp.names(overview jsonb) returns jsonb language sql as $$
  select coalesce(jsonb_agg(e ->> 'name' order by e ->> 'name'), '[]') from jsonb_array_elements(overview -> 'students') e
$$;
create function pg_temp.row_of(overview jsonb, who uuid) returns jsonb language sql as $$
  select e from jsonb_array_elements(overview -> 'students') e where (e ->> 'id')::uuid = who
$$;

-- Cat and Dan are in Room Two and Gus in Room Three; Fin teaches both (and nothing else). Ana and Bea stay in the school's
-- Everyone class. Player names make the lists easy to read.
update public.profiles set display_name = 'Ana Moa 4' where id = pg_temp.id('0a');
update public.profiles set display_name = 'Bea Ruru 5' where id = pg_temp.id('0b');
update public.profiles set display_name = 'Cat Kiwi 1' where id = pg_temp.id('0c');
update public.profiles set display_name = 'Dan Tui 2' where id = pg_temp.id('0d');
update public.profiles set display_name = 'Gus Weka 3' where id = pg_temp.id('10');
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
select set_config('test.everyone', (select class_id::text from public.class_members where student_id = pg_temp.id('0a')), true);
select public.give_class_settings(id) from public.classes where name in ('Room Two', 'Room Three');

-- Cat was shown 4 questions this week and skipped 1, 10 minutes ago; one more from 9 days ago doesn't count. Dan has none.
-- Gus (Room Three) was shown 3, so a leak would show in Room Two's numbers.
insert into public.question_log (player, game, spot, skipped, shown_ms, at) values
  (pg_temp.id('0c'), 'marble', 'gate', false, 4000, now() - interval '1 hour'),
  (pg_temp.id('0c'), 'marble', 'gate', false, 4000, now() - interval '1 hour'),
  (pg_temp.id('0c'), 'marble', 'gate', true, 4000, now() - interval '30 minutes'),
  (pg_temp.id('0c'), 'mine', 'door', false, 4000, now() - interval '10 minutes'),
  (pg_temp.id('0c'), 'mine', 'door', true, 4000, now() - interval '9 days'),
  (pg_temp.id('10'), 'mine', 'door', true, 4000, now() - interval '1 hour'),
  (pg_temp.id('10'), 'mine', 'door', true, 4000, now() - interval '1 hour'),
  (pg_temp.id('10'), 'mine', 'door', true, 4000, now() - interval '1 hour');

-- ---- Who can call them ----
select pg_temp.ana();
select throws_ok(format('select public.teacher_class_overview(%L::uuid)', current_setting('test.everyone')), '42501', null,
  'a pupil cannot read the class overview, even for their own class');
select throws_ok(format('select * from public.teacher_students(%L::uuid)', current_setting('test.everyone')), '42501', null,
  'a pupil cannot list a class');
select throws_ok(format('select public.teacher_student_card(%L::uuid)', pg_temp.id('0b')), '42501', null,
  'a pupil cannot read a classmate''s card');
select pg_temp.reset();
set local role anon;
select throws_ok(format('select public.teacher_class_overview(%L::uuid)', current_setting('test.room_two')), '42501', null,
  'signed-out visitors cannot read the overview');
select throws_ok(format('select public.teacher_student_card(%L::uuid)', pg_temp.id('0c')), '42501', null,
  'signed-out visitors cannot read a card');
select pg_temp.reset();

-- ---- teacher_students(target_class): one class only ----
select pg_temp.fin();
select set_eq(format('select display_name from public.teacher_students(%L::uuid)', current_setting('test.room_two')),
  array['Cat Kiwi 1', 'Dan Tui 2'], 'Fin''s Room Two list has Cat and Dan only (no Gus, no teachers)');
select set_eq(format('select display_name from public.teacher_students(%L::uuid)', current_setting('test.room_three')),
  array['Gus Weka 3'], '... and Room Three''s has Gus only');
select set_eq('select display_name from public.teacher_students() where role = ''student''',
  array['Cat Kiwi 1', 'Dan Tui 2', 'Gus Weka 3'], 'the old list with no class still has every student Fin teaches');
select throws_ok(format('select * from public.teacher_students(%L::uuid)', current_setting('test.everyone')), '42501', null,
  'Fin cannot list a class he doesn''t teach');
select throws_ok('select * from public.teacher_students(null::uuid)', '22023', null, 'no class is refused');

-- ---- teacher_class_overview(target_class) ----
select set_config('test.overview', public.teacher_class_overview(current_setting('test.room_two')::uuid)::text, true);
select is(pg_temp.names(pg_temp.overview()), '["Cat Kiwi 1", "Dan Tui 2"]'::jsonb, 'the overview lists Room Two''s two pupils');
select is((pg_temp.row_of(pg_temp.overview(), pg_temp.id('0c')) ->> 'shown')::integer, 4,
  'Cat was shown 4 questions in the last 7 days (not the one from 9 days ago)');
select is((pg_temp.row_of(pg_temp.overview(), pg_temp.id('0c')) ->> 'skipped')::integer, 1, '... and skipped 1 of them');
select ok((pg_temp.row_of(pg_temp.overview(), pg_temp.id('0c')) ->> 'lastActive')::timestamptz > now() - interval '11 minutes',
  '... and was last active about 10 minutes ago');
select is(pg_temp.row_of(pg_temp.overview(), pg_temp.id('0c')) ->> 'realName', 'cat', '... with her real name');
select is(pg_temp.row_of(pg_temp.overview(), pg_temp.id('0c')) -> 'focus' ->> 'source', 'auto', '... and her maths focus');
select ok(pg_temp.row_of(pg_temp.overview(), pg_temp.id('0c')) -> 'focus' ? 'ladder', '... with her ladder place');
select is((pg_temp.row_of(pg_temp.overview(), pg_temp.id('0d')) ->> 'shown')::integer, 0, 'Dan was shown none');
select is(pg_temp.row_of(pg_temp.overview(), pg_temp.id('0d')) -> 'lastActive', 'null'::jsonb, '... and hasn''t been active');
select is(pg_temp.overview()::text ~* '(gus|weka)', false, '... and nothing from Room Three leaks in');
select throws_ok(format('select public.teacher_class_overview(%L::uuid)', current_setting('test.everyone')), '42501', null,
  'Fin cannot read the overview of a class he doesn''t teach');
select throws_ok('select public.teacher_class_overview(null::uuid)', '22023', null, 'no class is refused');

-- ---- teacher_student_card(student) ----
select set_config('test.overview', public.teacher_student_card(pg_temp.id('0c'))::text, true);
select is(pg_temp.overview() ->> 'name', 'Cat Kiwi 1', 'Fin can open Cat''s page');
select is(pg_temp.overview() -> 'classes' -> 0 ->> 'name', 'Room Two', '... it says which class she is in');
select is((pg_temp.overview() -> 'week' ->> 'shown')::integer, 4, '... and her week''s questions');
select is(public.teacher_student_card(pg_temp.id('0e')) ->> 'role', 'teacher', 'Fin can open a teacher of his school');
select is(public.teacher_student_card(pg_temp.id('0e')) -> 'focus', 'null'::jsonb, '... who has no maths focus');
select throws_ok(format('select public.teacher_student_card(%L::uuid)', pg_temp.id('0a')), '42501', null,
  'Fin cannot open a student who isn''t in one of his classes');
select pg_temp.reset();

-- ---- A school admin teaches every class, and each class is still kept apart ----
select pg_temp.eve();
select is(pg_temp.names(public.teacher_class_overview(current_setting('test.everyone')::uuid)), '["Ana Moa 4", "Bea Ruru 5"]'::jsonb,
  'Eve (school admin) sees the Everyone class''s two pupils');
select is(pg_temp.names(public.teacher_class_overview(current_setting('test.room_three')::uuid)), '["Gus Weka 3"]'::jsonb,
  '... and Room Three on its own');
select is(public.teacher_student_card(pg_temp.id('0a')) ->> 'realName', 'ana', '... and can open any student in the school');
select pg_temp.reset();

select * from finish();
rollback;
