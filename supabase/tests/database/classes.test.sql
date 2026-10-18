-- Maths focus F.2: classes. Teachers see only the students in their own classes, a school admin sees every
-- class in the school, moving a student keeps their records, archiving keeps the data, a student with no class
-- still plays and gets the school's default settings, and settings can differ from class to class.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(96);

-- School 2 has no default class (so its students start with no class). Douglas Park (school 1) has "Everyone".
select setval(pg_get_serial_sequence('public.schools', 'id'), 1);
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id) values ('otherschool.school.nz', 2);

create function pg_temp.uid(n integer) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;
-- 101-106 students at school 2; 201, 202 teachers; 203 school admin. 1, 2 students at school 1; 11 teacher; 12 admin.
insert into auth.users (id, email)
select pg_temp.uid(n), 's' || n || '@otherschool.school.nz' from generate_series(101, 106) n;
insert into auth.users (id, email) values
  (pg_temp.uid(201), 't201@otherschool.school.nz'), (pg_temp.uid(202), 't202@otherschool.school.nz'),
  (pg_temp.uid(203), 'admin203@otherschool.school.nz'),
  (pg_temp.uid(1), 's1@douglaspark.school.nz'), (pg_temp.uid(2), 's2@douglaspark.school.nz'),
  (pg_temp.uid(11), 't11@douglaspark.school.nz'), (pg_temp.uid(12), 'admin12@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id in (pg_temp.uid(201), pg_temp.uid(202), pg_temp.uid(203), pg_temp.uid(11), pg_temp.uid(12));
update public.profiles set school_admin = true where id in (pg_temp.uid(203), pg_temp.uid(12));

create temp table emails as select id, email from auth.users;
grant select on emails to public;
create function pg_temp.as(n integer) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(n),
           'email', (select e.email from pg_temp.emails e where e.id = pg_temp.uid(n)), 'role', 'authenticated')::text, true)
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create temp table made (name text primary key, id uuid);
grant all on made to authenticated;
create function pg_temp.klass(n text) returns uuid language sql as $$ select id from pg_temp.made where name = n $$;

-- ---- Douglas Park: nothing disappears (the default class "Everyone") ----
select is((select count(*)::int from public.classes where school_id = 1), 1, 'Douglas Park starts with one class...');
select is((select name from public.classes where school_id = 1), 'Everyone', '...called Everyone');
select is((select warp_mode from public.classes where school_id = 1), 'off', 'whose Class Warp code is off, so nothing changes by itself');
select is((select count(*)::int from public.class_members where class_id = (select id from public.classes where school_id = 1)), 2,
  'new Douglas Park students join Everyone by themselves');
select is((select count(*)::int from public.class_teachers where class_id = (select id from public.classes where school_id = 1)), 2,
  'and new teachers teach it');
select pg_temp.as(11);
select is((select count(*)::int from public.teacher_students() where role = 'student'), 2, 'a Douglas Park teacher still sees every student');
select lives_ok(format('select public.teacher_student_detail(%L)', pg_temp.uid(1)), 'and can open any of them');
select pg_temp.as(1);
select is((select count(*)::int from public.app_settings), 1, 'a Douglas Park student reads one settings row (their class''s copy of the school''s)');
select pg_temp.reset();
select throws_ok($$ select public.school_set_default_class(null) $$, '42501', null, 'nobody can change the default class without being signed in as an admin');
select pg_temp.as(12);
select lives_ok($$ select public.school_set_default_class(null) $$, 'a school admin can turn the automatic class off');
select pg_temp.reset();
insert into auth.users (id, email) values (pg_temp.uid(3), 's3@douglaspark.school.nz');
insert into pg_temp.emails values (pg_temp.uid(3), 's3@douglaspark.school.nz');
select is((select count(*)::int from public.class_members where student_id = pg_temp.uid(3)), 0, 'then a new student has no class');
select pg_temp.as(3);
select is((select count(*)::int from public.app_settings where class_id is null), 1, 'and reads the school default');
select pg_temp.reset();

-- ---- Making classes ----
select pg_temp.as(101);
select throws_ok($$ select public.teacher_create_class('Room 99', 2026) $$, '42501', null, 'a student cannot make a class');
select throws_ok($$ select * from public.classes $$, '42501', null, 'nor read the class table');
select throws_ok($$ select * from public.class_members $$, '42501', null, 'nor the member table');
select pg_temp.as(201);
insert into pg_temp.made values ('A', public.teacher_create_class('Room 12', 2026, 5));
select throws_ok($$ select public.teacher_create_class('Room 12', 2026) $$, '22023', null, 'a class name can only be used once a year');
select throws_ok($$ select public.teacher_create_class('x@y.com', 2026) $$, '22023', null, 'class names have no @ signs...');
select throws_ok($$ select public.teacher_create_class('<script>', 2026) $$, '22023', null, '...or marks');
select throws_ok($$ select public.teacher_create_class('A name that is much too long to be a room name', 2026) $$, '22023', null, '...or sentences');
select is((select count(*)::int from public.teacher_classes() where teaching), 1, 'the maker teaches it');
select matches((select warp_code from public.teacher_classes()), '^[CDFGHJKMNPQRTVWXY34679]{5}$', 'it has a Class Warp code made like a game code');
select is((select warp_mode from public.teacher_classes()), 'on', 'which is on');
select pg_temp.reset();
select is((select count(*)::int from public.app_settings where class_id = pg_temp.klass('A')), 1, 'the class got its own settings row');
select is((select multiplayer_enabled from public.app_settings where class_id = pg_temp.klass('A')),
  (select multiplayer_enabled from public.app_settings where school_id = 2 and class_id is null), '...starting as a copy of the school''s default');

-- ---- Who sees which class ----
select pg_temp.as(202);
select is((select count(*)::int from public.teacher_classes()), 0, 'another teacher does not see it');
select throws_ok(format('select public.teacher_class_detail(%L)', pg_temp.klass('A')), '42501', null, 'nor open it');
select throws_ok(format('select public.teacher_add_to_class(%L, array[%L]::uuid[])', pg_temp.klass('A'), pg_temp.uid(101)), '42501', null, 'nor add students to it');
select pg_temp.as(203);
select is((select count(*)::int from public.teacher_classes()), 1, 'the school admin sees every class in the school');
select lives_ok(format('select public.teacher_class_detail(%L)', pg_temp.klass('A')), '...and opens any');
select pg_temp.as(11);
select is((select count(*)::int from public.teacher_classes() where name = 'Room 12'), 0, 'a teacher at another school sees nothing of it');
select pg_temp.as(201);

-- ---- Adding students from the list of students with no class ----
select is((select count(*)::int from public.teacher_unassigned_students()), 6, 'the list is the school''s six students with no class');
select is((select count(*)::int from public.teacher_unassigned_students() where id in (pg_temp.uid(1), pg_temp.uid(2))), 0, '(none of Douglas Park''s)');
select is(public.teacher_add_to_class(pg_temp.klass('A'), array[pg_temp.uid(101), pg_temp.uid(102), pg_temp.uid(103)]), 3, 'a teacher ticks three students');
select is(public.teacher_add_to_class(pg_temp.klass('A'), array[pg_temp.uid(1)]), 0, 'a student from another school is ignored');
select is(public.teacher_add_to_class(pg_temp.klass('A'), array[pg_temp.uid(201)]), 0, 'and so is a teacher');
select is((select count(*)::int from public.teacher_unassigned_students()), 3, 'the list shrinks');
select is((select count(*)::int from public.teacher_students() where role = 'student'), 3, 'a teacher sees only the students in their class');
select throws_ok(format('select public.teacher_student_detail(%L)', pg_temp.uid(104)), '42501', null, 'not one who is in nobody''s class');
select lives_ok(format('select public.teacher_student_detail(%L)', pg_temp.uid(101)), 'but one of theirs is fine');
select throws_ok(format('select public.teacher_set_hidden(%L, true)', pg_temp.uid(104)), '42501', null, 'hiding a student outside the class is refused');
select pg_temp.as(203);
select is((select count(*)::int from public.teacher_students() where role = 'student'), 6, 'the school admin sees all six students in the school');
select pg_temp.as(202);
select is((select count(*)::int from public.teacher_students() where role = 'student'), 0, 'a teacher with no class sees no students');

-- ---- Hidden students ----
select pg_temp.as(201);
select lives_ok(format('select public.teacher_set_hidden(%L, true)', pg_temp.uid(101)), 'a teacher hides one of their students');
select is((select count(*)::int from public.profiles where id = pg_temp.uid(101)), 1, 'and still sees the profile');
select pg_temp.as(202);
select is((select count(*)::int from public.profiles where id = pg_temp.uid(101)), 0, 'another teacher does not');
select pg_temp.as(102);
select is((select count(*)::int from public.profiles where id = pg_temp.uid(101)), 0, 'nor do other students');
select pg_temp.as(201);
select lives_ok(format('select public.teacher_set_hidden(%L, false)', pg_temp.uid(101)), 'and they can show them again');

-- ---- Co-teachers ----
select throws_ok(format('select public.teacher_add_co_teacher(%L, %L)', pg_temp.klass('A'), pg_temp.uid(101)), '22023', null, 'a student cannot be a co-teacher');
select throws_ok(format('select public.teacher_add_co_teacher(%L, %L)', pg_temp.klass('A'), pg_temp.uid(11)), '22023', null, 'nor a teacher from another school');
select lives_ok(format('select public.teacher_add_co_teacher(%L, %L)', pg_temp.klass('A'), pg_temp.uid(202)), 'a teacher adds a co-teacher');
select pg_temp.as(202);
select is((select count(*)::int from public.teacher_classes()), 1, 'who now sees the class');
select is((select count(*)::int from public.teacher_students() where role = 'student'), 3, 'and its students');
select lives_ok(format('select public.teacher_remove_co_teacher(%L, %L)', pg_temp.klass('A'), pg_temp.uid(201)), 'one of two teachers can leave');
select throws_ok(format('select public.teacher_remove_co_teacher(%L, %L)', pg_temp.klass('A'), pg_temp.uid(202)), '22023', null, 'but a class cannot lose its last teacher');
select pg_temp.as(203);
select lives_ok(format('select public.teacher_add_co_teacher(%L, %L)', pg_temp.klass('A'), pg_temp.uid(201)), 'the school admin can add anyone back');

-- ---- Moving a student keeps everything they have earned ----
select pg_temp.reset();
insert into public.gem_keep_progress (player, level_id, best_stars, plays, wins) values (pg_temp.uid(101), 'meadow-1', 3, 2, 2);
select pg_temp.as(202);
insert into pg_temp.made values ('B', public.teacher_create_class('Room 14', 2026, 6));
select pg_temp.as(201);
select throws_ok(format('select public.teacher_move_student(%L, %L)', pg_temp.uid(101), pg_temp.klass('B')), '42501', null,
  'moving a student into a class you do not teach is refused');
select pg_temp.as(203);
select lives_ok(format('select public.teacher_move_student(%L, %L)', pg_temp.uid(101), pg_temp.klass('B')), 'the school admin moves a student');
select pg_temp.reset();
select is((select class_id from public.class_members where student_id = pg_temp.uid(101)), pg_temp.klass('B'), 'the student is in the new class');
select is((select count(*)::int from public.class_members where student_id = pg_temp.uid(101)), 1, 'in one class only');
select is((select best_stars from public.gem_keep_progress where player = pg_temp.uid(101) and level_id = 'meadow-1'), 3, 'and their records came with them');
select is((select count(*)::int from public.class_events where student_id = pg_temp.uid(101) and kind = 'moved-out'), 1, 'the old class has a note that they left');
select throws_ok($$ insert into public.class_members (student_id, class_id) values (pg_temp.uid(101), pg_temp.klass('A')) $$, '23505', null, 'the table itself allows one class per student');
select pg_temp.as(101);
select throws_ok(format('select public.teacher_move_student(%L, %L)', pg_temp.uid(101), pg_temp.klass('A')), '42501', null, 'a student cannot move themselves');
select throws_ok($$ insert into public.class_members (student_id, class_id) values (auth.uid(), pg_temp.klass('A')) $$, '42501', null, 'nor write to the table');

-- ---- A student with no class still plays and gets the school's defaults ----
select pg_temp.as(201);
select lives_ok(format('select public.teacher_remove_from_class(%L)', pg_temp.uid(102)), 'a teacher takes a student out of the class');
select pg_temp.reset();
select is((select count(*)::int from public.class_members where student_id = pg_temp.uid(102)), 0, 'they are in no class');
select ok(public.is_school_email('s102@otherschool.school.nz'), '(and still a school user)');
select isnt(public.record_bot_game(pg_temp.uid(102), 'chess', 'easy', 'black', array['f2f3', 'e7e5', 'g2g4', 'd8h4'], 'won', 'checkmate', 2, false), null,
  'a student with no class can still play and save a game');
select pg_temp.as(203);
select lives_ok($$ select public.teacher_set_space_maths('off') $$, 'the admin sets every class and the school default to Off');
select pg_temp.reset();
select is((select space_maths from public.settings_of(pg_temp.uid(102))), 'off', 'the student with no class follows the school default');
update public.app_settings set space_maths = 'choose' where school_id = 2;
select pg_temp.as(201);
select lives_ok(format('select public.teacher_set_space_maths(%L, %L)', 'on', pg_temp.klass('A')), 'a teacher sets one of their classes to On');
select pg_temp.reset();
select is((select space_maths from public.settings_of(pg_temp.uid(103))), 'on', 'a student in that class gets On');
select is((select space_maths from public.settings_of(pg_temp.uid(102))), 'choose', 'a student with no class stays on the school default');
select is((select space_maths from public.settings_of(pg_temp.uid(101))), 'choose', 'and a student in another class keeps that class''s');
select pg_temp.as(103);
select is((select space_maths from public.app_settings), 'on', 'the website reads the settings of the student''s own class');
select pg_temp.as(201);
select throws_ok(format('select public.teacher_set_space_maths(%L, %L)', 'off', pg_temp.klass('B')), '42501', null, 'a teacher cannot change settings for a class they do not teach');
select lives_ok($$ select public.teacher_set_multiplayer(false) $$, 'with no class given, a teacher changes all their own classes');
select pg_temp.reset();
select is((select multiplayer_enabled from public.app_settings where class_id = pg_temp.klass('A')), false, 'the class they teach changed');
select is((select multiplayer_enabled from public.app_settings where class_id = pg_temp.klass('B')), true, 'a class they do not teach did not');
select is((select multiplayer_enabled from public.app_settings where school_id = 2 and class_id is null), true, 'nor did the school default');

-- ---- Archiving ----
select pg_temp.as(201);
select throws_ok(format('select public.teacher_archive_class(%L)', pg_temp.klass('A')), '42501', null, 'only the school admin archives a class');
select pg_temp.as(203);
select lives_ok(format('select public.teacher_archive_class(%L)', pg_temp.klass('B')), 'the school admin archives Room 14');
select pg_temp.as(202);
select is((select count(*)::int from public.teacher_classes()), 1, 'it drops off the teacher''s list (Room 12 is left)');
select is((select count(*)::int from public.teacher_classes(true) where archived), 0, 'and a teacher cannot ask for archived ones');
select pg_temp.as(203);
select is((select count(*)::int from public.teacher_classes(true) where archived), 1, 'the admin can still list it');
select pg_temp.reset();
select is((select count(*)::int from public.class_members where class_id = pg_temp.klass('B')), 1, 'its members and records are kept');
select is((select best_stars from public.gem_keep_progress where player = pg_temp.uid(101)), 3, '(including their records)');
select ok(public.current_class_of(pg_temp.uid(101)) is null, 'but nobody is "in" an archived class any more');
select is((select space_maths from public.settings_of(pg_temp.uid(101))), 'choose', 'its students follow the school default');
select pg_temp.as(203);
select lives_ok(format('select public.teacher_archive_class(%L, false)', pg_temp.klass('B')), 'a class can be brought back');
select pg_temp.as(202);
select is((select count(*)::int from public.teacher_classes()), 2, 'and it is on the list again');

-- ---- Groups hold only students of their class ----
select pg_temp.as(201);
insert into pg_temp.made values ('G', public.teacher_create_group(pg_temp.klass('A'), 'Kea'));
select lives_ok(format('select public.teacher_set_group_member(%L, %L, true)', pg_temp.klass('G'), pg_temp.uid(103)), 'a student of the class goes into a group');
select throws_ok(format('select public.teacher_set_group_member(%L, %L, true)', pg_temp.klass('G'), pg_temp.uid(104)), '42501', null, 'but a student with no class cannot');
select pg_temp.reset();
select is((select count(*)::int from public.class_group_members where student_id = pg_temp.uid(103)), 1, 'they are in the group');
select pg_temp.as(203);
select lives_ok(format('select public.teacher_move_student(%L, %L)', pg_temp.uid(103), pg_temp.klass('B')), 'moving them to another class...');
select pg_temp.reset();
select is((select count(*)::int from public.class_group_members where student_id = pg_temp.uid(103)), 0, '...lets go of the old class''s group');

select * from finish();
rollback;
