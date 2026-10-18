-- Maths focus F.2: Class Warp. A class code (or a group code) puts a student in that class (and group) once
-- typed correctly; changing class asks first; off, reset and archived codes stop working; "ask first" holds the
-- student until a teacher says yes; a wrong code only ever says it didn't work; and codes can't be guessed in bulk.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(85);

select setval(pg_get_serial_sequence('public.schools', 'id'), 1);
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id) values ('otherschool.school.nz', 2);

create function pg_temp.uid(n integer) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;
-- 101-108 students and 201, 202 teachers and 203 admin at school 2; 1 is a Douglas Park student.
insert into auth.users (id, email) select pg_temp.uid(n), 's' || n || '@otherschool.school.nz' from generate_series(101, 108) n;
insert into auth.users (id, email) values
  (pg_temp.uid(201), 't201@otherschool.school.nz'), (pg_temp.uid(202), 't202@otherschool.school.nz'),
  (pg_temp.uid(203), 'admin203@otherschool.school.nz'), (pg_temp.uid(1), 's1@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id in (pg_temp.uid(201), pg_temp.uid(202), pg_temp.uid(203));
update public.profiles set school_admin = true where id = pg_temp.uid(203);

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
create function pg_temp.members(n integer) returns integer language sql security definer as $$
  select count(*)::integer from public.class_members where student_id = pg_temp.uid(n)
$$;
create function pg_temp.request_of(n integer) returns uuid language sql security definer as $$
  select id from public.warp_requests where student_id = pg_temp.uid(n) and status = 'pending'
$$;
-- The code of a class or group, read as the database owner.
create function pg_temp.code(n text) returns text language sql security definer as $$
  select coalesce((select warp_code from public.classes where id = pg_temp.klass(n)), (select warp_code from public.class_groups where id = pg_temp.klass(n)))
$$;

select pg_temp.as(201);
insert into pg_temp.made values ('A', public.teacher_create_class('Room 12', 2026, 5));
select pg_temp.as(202);
insert into pg_temp.made values ('B', public.teacher_create_class('Room 14', 2026, 6));
select pg_temp.as(201);
insert into pg_temp.made values ('Kea', public.teacher_create_group(pg_temp.klass('A'), 'Kea'));
insert into pg_temp.made values ('Tui', public.teacher_create_group(pg_temp.klass('A'), 'Tui'));
select pg_temp.reset();

-- ---- The codes ----
select matches(pg_temp.code('Kea'), '^[CDFGHJKMNPQRTVWXY34679]{5}$', 'a group code is made like a game code');
select isnt(pg_temp.code('Kea'), pg_temp.code('A'), 'and is not its class''s code');
select is((select count(distinct c)::int from (select pg_temp.code(n) as c from (values ('A'), ('B'), ('Kea'), ('Tui')) v(n)) x), 4, 'every class and group has a different code');
select is((select count(*)::int from (select public.new_warp_code() as c from generate_series(1, 300)) x where c !~ '^[CDFGHJKMNPQRTVWXY34679]{5}$'), 0,
  'made codes never use vowels or lookalike characters');
select throws_ok($$ update public.classes set warp_code = 'AEIOU' $$, '23514', null, 'the table refuses a code with vowels');

-- ---- Typing a class code ----
select pg_temp.as(104);
select is(public.warp_preview(pg_temp.code('A')) ->> 'status', 'found', 'a student types a class code and is shown what it is');
select is(public.warp_preview(pg_temp.code('A')) ->> 'name', 'Room 12', '...by name');
select is(public.warp_preview(pg_temp.code('A')) ->> 'kind', 'class', '...as a class');
select is(pg_temp.members(104), 0, 'nothing has changed yet');
select is(public.warp_preview(lower(substr(pg_temp.code('A'), 1, 3)) || '-' || lower(substr(pg_temp.code('A'), 4))) ->> 'status', 'found', 'lower case and a dash are fine, as with game codes');
select is(public.warp_join(pg_temp.code('A')) ->> 'status', 'joined', 'confirming warps them in');
select is(public.warp_join(pg_temp.code('A')) ->> 'name', 'Room 12', '...to Room 12');
select pg_temp.reset();
select is((select class_id from public.class_members where student_id = pg_temp.uid(104)), pg_temp.klass('A'), 'they are in the class');
select is((select how from public.class_members where student_id = pg_temp.uid(104)), 'warp', '(through a code)');
select is((select kind from public.class_events where student_id = pg_temp.uid(104) order by id limit 1), 'joined', 'the class has a note that they joined');
select pg_temp.as(104);
select is(public.my_class() ->> 'className', 'Room 12', 'and the student can see their own class name');
select is(public.warp_preview(pg_temp.code('A')) ->> 'alreadyIn', 'true', 'typing the same code again says they are already in');

-- ---- Wrong codes say only that ----
select is(public.warp_preview('ZZZZZ'), '{"status":"nope"}'::jsonb, 'a wrong code only says it did not work');
select is(public.warp_preview('hello'), '{"status":"nope"}'::jsonb, 'so does something that cannot be a code');
select is(public.warp_preview(null), '{"status":"nope"}'::jsonb, 'and nothing at all');
select is(public.warp_join('ZZZZZ'), '{"status":"nope"}'::jsonb, 'the same when confirming');
select pg_temp.as(1);
select is(public.warp_preview(pg_temp.code('A')), '{"status":"nope"}'::jsonb, 'a student from another school cannot use the code');
select pg_temp.as(201);
select is(public.warp_preview(pg_temp.code('A')), '{"status":"nope"}'::jsonb, 'a teacher cannot warp');

-- ---- Changing class asks first ----
select pg_temp.as(104);
select is(public.warp_preview(pg_temp.code('B')) ->> 'leaving', 'Room 12', 'moving to another class says which one they would leave');
select is(public.warp_join(pg_temp.code('B')) ->> 'status', 'joined', 'and then moves them');
select pg_temp.reset();
select is((select class_id from public.class_members where student_id = pg_temp.uid(104)), pg_temp.klass('B'), 'they are in the new class');
select is((select count(*)::int from public.class_members where student_id = pg_temp.uid(104)), 1, '(still one class)');
select is((select count(*)::int from public.class_events where class_id = pg_temp.klass('A') and kind = 'moved-out'), 1, 'the old class has a note that they left');

-- ---- A group code also joins the class ----
select pg_temp.as(104);
select is(public.warp_preview(pg_temp.code('Kea')) ->> 'kind', 'group', 'a group code says it is a group');
select is(public.warp_preview(pg_temp.code('Kea')) ->> 'name', 'Kea', '...by the group''s name');
select is(public.warp_preview(pg_temp.code('Kea')) ->> 'className', 'Room 12', '...and the class it brings them to');
select is(public.warp_preview(pg_temp.code('Kea')) ->> 'leaving', 'Room 14', 'asking first, as they would leave Room 14');
select is(public.warp_join(pg_temp.code('Kea')) ->> 'status', 'joined', 'confirming');
select pg_temp.reset();
select is((select class_id from public.class_members where student_id = pg_temp.uid(104)), pg_temp.klass('A'), 'one code was enough to join the class...');
select is((select group_id from public.class_group_members where student_id = pg_temp.uid(104)), pg_temp.klass('Kea'), '...and the group');
select pg_temp.as(104);
select is(public.warp_join(pg_temp.code('Tui')) ->> 'status', 'joined', 'typing another group''s code in the same class');
select pg_temp.reset();
select is((select group_id from public.class_group_members where student_id = pg_temp.uid(104)), pg_temp.klass('Tui'), 'swaps the group');
select is((select count(*)::int from public.class_group_members where student_id = pg_temp.uid(104)), 1, '(one group a class)');
select pg_temp.as(104);
select is(public.warp_preview(pg_temp.code('Tui')) ->> 'leaving', null, 'and does not ask about leaving, as they stay in the same class');
select pg_temp.as(201);
select is((select count(*)::int from public.teacher_class_events(pg_temp.klass('A')) where group_name = 'Kea'), 1, 'the teacher''s live list shows who joined a group');
select is((select student_name from public.teacher_class_events(pg_temp.klass('A')) order by id desc limit 1) is not null, true, '...by their safe name');
select pg_temp.as(202);
select throws_ok(format('select * from public.teacher_class_events(%L)', pg_temp.klass('A')), '42501', null, 'another class''s teacher cannot watch it');

-- ---- Off, reset and archived ----
select lives_ok(format('select public.teacher_set_warp_mode(%L, %L)', pg_temp.klass('B'), 'off'), 'a teacher turns a class code off');
select pg_temp.as(105);
select is(public.warp_preview(pg_temp.code('B')) ->> 'status', 'nope', 'an off code does not work');
select pg_temp.as(202);
select lives_ok(format('select public.teacher_set_warp_mode(%L, %L)', pg_temp.klass('B'), 'on'), '...and back on');
select pg_temp.as(105);
select is(public.warp_preview(pg_temp.code('B')) ->> 'status', 'found', 'then it works');
select pg_temp.reset();
create temp table oldcode as select pg_temp.code('B') as c;
grant select on oldcode to public;
select pg_temp.as(202);
select isnt(public.teacher_reset_warp_code(pg_temp.klass('B')), (select c from pg_temp.oldcode), 'resetting makes a new code');
select pg_temp.as(105);
select is(public.warp_preview((select c from pg_temp.oldcode)) ->> 'status', 'nope', 'the old code stops working');
select is(public.warp_preview(pg_temp.code('B')) ->> 'status', 'found', 'the new one works');
select pg_temp.as(201);
select lives_ok(format('select public.teacher_set_warp_mode(%L, %L)', pg_temp.klass('A'), 'off'), 'with a class code off...');
select pg_temp.as(105);
select is(public.warp_preview(pg_temp.code('Kea')) ->> 'status', 'nope', '...its group codes cannot bring in a stranger');
select pg_temp.as(104);
select is(public.warp_preview(pg_temp.code('Kea')) ->> 'status', 'found', '...but still work for a student already in the class');
select pg_temp.as(201);
select lives_ok(format('select public.teacher_set_warp_mode(%L, %L)', pg_temp.klass('A'), 'on'), 'turn it back on');
select throws_ok(format('select public.teacher_set_warp_mode(%L, %L)', pg_temp.klass('B'), 'off'), '42501', null, 'a teacher cannot change another class''s code');
select throws_ok(format('select public.teacher_reset_warp_code(%L)', pg_temp.klass('B')), '42501', null, 'or reset it');
select throws_ok(format('select public.teacher_set_warp_mode(%L, %L)', pg_temp.klass('A'), 'maybe'), '22023', null, 'and a code can only be on, ask or off');
select pg_temp.as(203);
select lives_ok(format('select public.teacher_archive_class(%L)', pg_temp.klass('B')), 'the admin archives Room 14');
select pg_temp.as(105);
select is(public.warp_preview(pg_temp.code('B')) ->> 'status', 'nope', 'an archived class''s code stops working');
select pg_temp.as(203);
select lives_ok(format('select public.teacher_archive_class(%L, false)', pg_temp.klass('B')), 'and comes back with the class');

-- ---- Ask the teacher first ----
select pg_temp.as(201);
select lives_ok(format('select public.teacher_set_warp_mode(%L, %L)', pg_temp.klass('A'), 'ask'), 'a teacher sets a code to ask first');
select pg_temp.as(106);
select is(public.warp_preview(pg_temp.code('A')) ->> 'ask', 'true', 'the student is told the teacher decides');
select is(public.warp_join(pg_temp.code('A')) ->> 'status', 'waiting', 'they are held');
select is(public.my_class() ->> 'waitingFor', 'Room 12', '...and see what they are waiting for');
select pg_temp.reset();
select is((select count(*)::int from public.class_members where student_id = pg_temp.uid(106)), 0, 'they are not in the class yet');
select pg_temp.as(201);
select is((select count(*)::int from public.teacher_warp_requests()), 1, 'the teacher sees the request');
select pg_temp.as(202);
select is((select count(*)::int from public.teacher_warp_requests()), 0, 'another class''s teacher does not');
select throws_ok(format('select public.teacher_answer_warp(%L, true)', pg_temp.request_of(106)), '22023', null,
  'and cannot answer it');
select pg_temp.as(201);
select lives_ok(format('select public.teacher_answer_warp(%L, true)', pg_temp.request_of(106)), 'the teacher says yes');
select pg_temp.reset();
select is((select class_id from public.class_members where student_id = pg_temp.uid(106)), pg_temp.klass('A'), 'and the student is in');
select is((select how from public.class_members where student_id = pg_temp.uid(106)), 'approved', '(by approval)');
select pg_temp.as(107);
select is(public.warp_join(pg_temp.code('A')) ->> 'status', 'waiting', 'another student asks');
select pg_temp.as(201);
select lives_ok(format('select public.teacher_answer_warp(%L, false)', pg_temp.request_of(107)), 'and is turned down');
select pg_temp.reset();
select is((select count(*)::int from public.class_members where student_id = pg_temp.uid(107)), 0, 'they stay out');
select is((select kind from public.class_events where student_id = pg_temp.uid(107) order by id desc limit 1), 'declined', '(with a note)');
select pg_temp.as(107);
select is(public.my_class() ->> 'waitingFor', null, 'and are not waiting any more');
select pg_temp.as(201);
select lives_ok(format('select public.teacher_set_warp_mode(%L, %L)', pg_temp.klass('A'), 'on'), 'turn the class code back on');
select lives_ok(format('select public.teacher_set_warp_mode(%L, %L, %L)', pg_temp.klass('A'), 'ask', pg_temp.klass('Kea')), 'a group code can ask first by itself');
select pg_temp.as(108);
select is(public.warp_join(pg_temp.code('Kea')) ->> 'status', 'waiting', 'a group code set to ask holds the student');
select is(public.warp_join(pg_temp.code('Tui')) ->> 'status', 'joined', 'and joining somewhere else ends the wait');
select pg_temp.reset();
select is((select count(*)::int from public.warp_requests where student_id = pg_temp.uid(108) and status = 'pending'), 0, '(nothing is left waiting)');

-- ---- Codes cannot be guessed in bulk ----
select pg_temp.as(105);
select public.warp_preview('CCCCC'), public.warp_preview('DDDDD'), public.warp_preview('FFFFF'), public.warp_preview('GGGGG'), public.warp_preview('HHHHH');
select is(public.warp_preview(pg_temp.code('B')) ->> 'status', 'slow-down', 'after five wrong tries even the right code has to wait');
select is(public.warp_join(pg_temp.code('B')) ->> 'status', 'slow-down', 'including when confirming');
select pg_temp.as(106);
select is(public.warp_preview(pg_temp.code('B')) ->> 'status', 'found', 'but only for the student who was guessing');
select pg_temp.reset();
update public.warp_tries set at = now() - interval '11 minutes' where student_id = pg_temp.uid(105);
select pg_temp.as(105);
select is(public.warp_preview(pg_temp.code('B')) ->> 'status', 'found', 'they can try again after a few minutes');
select pg_temp.reset();
select is((select count(*)::int from public.warp_tries where student_id = pg_temp.uid(106)), 0, 'right codes are never counted');

select * from finish();
rollback;
