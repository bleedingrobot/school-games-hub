-- Maths focus F.3: teacher focuses for a class, a group or a student that end by themselves, the student's own choice and the
-- class switch, who can set or see what (other classes, other schools), groups, class names, and the settings the Teacher
-- page's class picker reads.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(180);

-- School 2 and School 3 have no default class. Douglas Park (school 1) has "Everyone".
select setval(pg_get_serial_sequence('public.schools', 'id'), 1);
insert into public.schools (name) values ('Other School'), ('Third School');
insert into public.school_domains (domain, school_id) values ('otherschool.school.nz', 2), ('thirdschool.school.nz', 3);

create function pg_temp.uid(n integer) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;
-- School 2: 101-107 students (106 in no class), 201 and 202 teachers, 203 school admin, 204 teacher with an awkward email.
-- School 3: 301 teacher, 311 student. School 1 (Douglas Park): 1 student, 11 teacher.
insert into auth.users (id, email)
select pg_temp.uid(n), 's' || n || '@otherschool.school.nz' from generate_series(101, 107) n;
insert into auth.users (id, email) values
  (pg_temp.uid(201), 't201@otherschool.school.nz'), (pg_temp.uid(202), 't202@otherschool.school.nz'),
  (pg_temp.uid(203), 'admin203@otherschool.school.nz'), (pg_temp.uid(204), 'mr_smith+x@otherschool.school.nz'),
  (pg_temp.uid(301), 't301@thirdschool.school.nz'), (pg_temp.uid(311), 's311@thirdschool.school.nz'),
  (pg_temp.uid(1), 's1@douglaspark.school.nz'), (pg_temp.uid(11), 't11@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id in
  (pg_temp.uid(201), pg_temp.uid(202), pg_temp.uid(203), pg_temp.uid(204), pg_temp.uid(301), pg_temp.uid(11));
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
-- The focus the server works out for a student, as the postgres owner (what a game server sees).
create function pg_temp.focus(n integer) returns jsonb language sql as $$ select public.maths_focus_of(pg_temp.uid(n)) $$;
create function pg_temp.src(n integer) returns text language sql as $$ select public.maths_focus_of(pg_temp.uid(n)) ->> 'source' $$;

-- Classes: A (teacher 201) with students 101 102 103 107; B (teacher 202) with 104 105; C at school 3 with 311.
select pg_temp.as(201);
insert into pg_temp.made values ('A', public.teacher_create_class('Room 12', 2026, 5));
select pg_temp.as(202);
insert into pg_temp.made values ('B', public.teacher_create_class('Room 14', 2026, 6));
select pg_temp.as(301);
insert into pg_temp.made values ('C', public.teacher_create_class('Room 3', 2026, 5));
select pg_temp.as(201);
select public.teacher_add_to_class(pg_temp.klass('A'), array[pg_temp.uid(101), pg_temp.uid(102), pg_temp.uid(103), pg_temp.uid(107)]);
insert into pg_temp.made values ('Kea', public.teacher_create_group(pg_temp.klass('A'), 'Kea'));
insert into pg_temp.made values ('Tui', public.teacher_create_group(pg_temp.klass('A'), 'Tūī'));
select public.teacher_set_group_member(pg_temp.klass('Kea'), pg_temp.uid(103), true);
select public.teacher_set_group_member(pg_temp.klass('Tui'), pg_temp.uid(102), true);
select pg_temp.as(202);
select public.teacher_add_to_class(pg_temp.klass('B'), array[pg_temp.uid(104), pg_temp.uid(105)]);
select pg_temp.as(301);
select public.teacher_add_to_class(pg_temp.klass('C'), array[pg_temp.uid(311)]);
select pg_temp.reset();

-- ---- Everyone starts on auto, and students may choose ----
select is(pg_temp.src(101), 'auto', 'a student with nothing set is on auto');
select is((pg_temp.focus(101) ->> 'canChoose')::boolean, true, 'and may choose their own focus (the class switch is on by default)');
select is((pg_temp.focus(101) -> 'skills'), '[]'::jsonb, 'with no skills named');
select is(pg_temp.focus(101) -> 'endsAt', 'null'::jsonb, 'and no end time');
select is(pg_temp.focus(101) -> 'own', 'null'::jsonb, 'and no choice of their own');
select is((select students_choose_focus from public.app_settings where class_id = pg_temp.klass('A')), true, 'a new class has the switch on');
select is(pg_temp.src(106), 'auto', 'a student with no class is on auto too');
select is((pg_temp.focus(106) ->> 'canChoose')::boolean, true, '...and may choose (the school default)');
select is(pg_temp.src(201), 'auto', 'a teacher asking for a focus gets auto');

-- ---- The student's own choice ----
select pg_temp.as(101);
select is((select public.my_maths_focus() ->> 'source'), 'auto', 'a student asks for their own focus: auto');
select is((select public.set_my_maths_focus(array['tables-6-9']) ->> 'source'), 'student', 'they pick ×6 and ×9: their focus is theirs');
select is((select public.my_maths_focus() -> 'skills'), '["tables-6-9"]'::jsonb, 'the skills are saved');
select is((select public.set_my_maths_focus(array['facts-10', 'facts-10', 'tables-3-4-8'], true) -> 'skills'), '["facts-10", "tables-3-4-8"]'::jsonb, 'picking again replaces it; repeats are dropped');
select is((select (public.my_maths_focus() ->> 'onlyThese')::boolean), true, 'and "only these" is kept');
select throws_ok($$ select public.set_my_maths_focus(array[]::text[]) $$, '22023', null, 'picking nothing is refused (use "back to auto")');
select throws_ok($$ select public.set_my_maths_focus(array['<script>']) $$, '22023', null, 'a skill name with odd characters is refused');
select throws_ok($$ select public.set_my_maths_focus(array['a','b','c','d','e','f','g','h','i','j','k','l','m']) $$, '22023', null, 'thirteen skills is too many');
select throws_ok($$ select public.set_my_maths_focus(array[repeat('x', 41)]) $$, '22023', null, 'a very long name is refused');
select is((select public.clear_my_maths_focus() ->> 'source'), 'auto', 'back to auto clears it');
select is(public.my_maths_focus() -> 'own', 'null'::jsonb, 'and nothing is left');
select public.set_my_maths_focus(array['dbl-half-10']);
select throws_ok($$ select * from public.student_maths_focus $$, '42501', null, 'the table is closed to the website');
select throws_ok($$ select * from public.maths_focuses $$, '42501', null, 'so is the table of teacher focuses');
select throws_ok(format('select public.maths_focus_of(%L)', pg_temp.uid(102)), '42501', null, 'a student cannot ask for someone else''s focus');
select throws_ok($$ select public.teacher_set_maths_focus(null, 'class', null, array['facts-10'], false, 'friday') $$, '42501', null, 'a student cannot set a focus');
select throws_ok($$ select public.teacher_maths_focuses() $$, '42501', null, 'or list focuses');
select throws_ok($$ select public.teacher_class_settings() $$, '42501', null, 'or read a class''s settings');

-- ---- The class switch ----
select pg_temp.as(202);
select throws_ok(format('select public.teacher_set_students_choose_focus(false, %L)', pg_temp.klass('A')), '42501', null, 'a teacher cannot change another teacher''s class');
select pg_temp.as(201);
select lives_ok(format('select public.teacher_set_students_choose_focus(false, %L)', pg_temp.klass('A')), 'a teacher turns off choosing for their class');
select pg_temp.reset();
select is((select students_choose_focus from public.app_settings where class_id = pg_temp.klass('B')), true, 'another class is untouched');
select is((select students_choose_focus from public.app_settings where school_id = 2 and class_id is null), true, 'so is the school default');
select is(pg_temp.src(101), 'auto', 'their own choice is ignored while the switch is off...');
select is(pg_temp.focus(101) -> 'own', '{"skills": ["dbl-half-10"], "onlyThese": false}'::jsonb, '...but kept');
select is((pg_temp.focus(101) ->> 'canChoose')::boolean, false, 'and the student is told they cannot choose');
select pg_temp.as(101);
select throws_ok($$ select public.set_my_maths_focus(array['facts-10']) $$, '42501', null, 'saving a new choice is refused with a plain message');
select pg_temp.as(201);
select lives_ok(format('select public.teacher_set_students_choose_focus(true, %L)', pg_temp.klass('A')), 'turned back on');
select pg_temp.reset();
select is(pg_temp.src(101), 'student', 'the choice they had is back (it was never overwritten)');

-- ---- A teacher focus for the whole class ----
select pg_temp.as(201);
select is(public.teacher_set_maths_focus(pg_temp.klass('A'), 'class', null, array['tables-6-9'], false, 'friday'), 1, 'a teacher sets ×6 and ×9 for the class until Friday');
select pg_temp.reset();
select is(pg_temp.src(101), 'teacher-class', 'a student with their own choice follows the teacher');
select is(pg_temp.src(102), 'teacher-class', 'so does another');
select is(pg_temp.src(103), 'teacher-class', 'and a student in a group');
select is(pg_temp.focus(102) -> 'skills', '["tables-6-9"]'::jsonb, 'the skills are the teacher''s');
select is((pg_temp.focus(102) ->> 'onlyThese')::boolean, false, 'with earlier skills as review');
select is(pg_temp.src(104), 'auto', 'a student in another class is not touched');
select is(pg_temp.src(106), 'auto', 'nor one with no class');
select is(pg_temp.src(311), 'auto', 'nor one at another school');
select is((pg_temp.focus(102) ->> 'endsAt')::timestamptz, public.focus_end('friday'), 'it ends when "Until Friday" ends');
select is(pg_temp.focus(101) -> 'own', '{"skills": ["dbl-half-10"], "onlyThese": false}'::jsonb, 'and the student''s own choice is kept underneath');

-- ---- The ends: midnight New Zealand time ----
select is(((public.focus_end('friday') at time zone 'Pacific/Auckland')::time), '00:00'::time, 'Until Friday ends at midnight');
select is(extract(isodow from (public.focus_end('friday') - interval '1 minute') at time zone 'Pacific/Auckland')::int, 5, 'at the end of a Friday');
select ok(public.focus_end('friday') > now() and public.focus_end('friday') <= now() + interval '7 days 1 hour', 'which is no more than a week away');
select is(((public.focus_end('today') at time zone 'Pacific/Auckland')::time), '00:00'::time, 'Rest of today ends at midnight');
select is((public.focus_end('today') at time zone 'Pacific/Auckland')::date, (now() at time zone 'Pacific/Auckland')::date + 1, 'tonight');
select is(public.focus_end('lesson'), now() + interval '1 hour', 'This lesson is an hour');
select is(public.focus_end('week'), now() + interval '7 days', '1 week is seven days');
select is(public.focus_end('custom', now() + interval '3 days'), now() + interval '3 days', 'a custom time is used as given');
select throws_ok($$ select public.focus_end('custom', now() - interval '1 day') $$, '22023', null, 'a custom time in the past is refused');
select throws_ok($$ select public.focus_end('custom', null) $$, '22023', null, 'so is no time');
select throws_ok($$ select public.focus_end('custom', now() + interval '2 years') $$, '22023', null, 'and one too far away');
select throws_ok($$ select public.focus_end('forever') $$, '22023', null, 'there is no "forever"');

-- ---- A group, then a student, on top of the class: student beats group beats class ----
select pg_temp.as(201);
select is(public.teacher_set_maths_focus(pg_temp.klass('A'), 'group', array[pg_temp.klass('Kea')], array['facts-20'], true, 'week'), 1, 'a teacher sets a focus for the Kea group');
select is(public.teacher_set_maths_focus(pg_temp.klass('A'), 'student', array[pg_temp.uid(101), pg_temp.uid(102)], array['dbl-half-20'], false, 'lesson'), 2, 'and one for two students, for an hour');
select pg_temp.reset();
select is(pg_temp.src(103), 'teacher-group', 'the group focus beats the class focus');
select is(pg_temp.focus(103) -> 'skills', '["facts-20"]'::jsonb, 'with its own skills');
select is((pg_temp.focus(103) ->> 'onlyThese')::boolean, true, 'and "only these"');
select is(pg_temp.src(101), 'teacher-student', 'a focus for one student beats the class and their own choice');
select is(pg_temp.src(102), 'teacher-student', 'even a student in another group');
select is((pg_temp.focus(102) ->> 'endsAt')::timestamptz, now() + interval '1 hour', 'for an hour');
select is(pg_temp.src(104), 'auto', 'class B still has nothing');

-- ---- The newest focus of the same kind wins ----
select is(pg_temp.focus(107) -> 'skills', '["tables-6-9"]'::jsonb, 'a student with nothing more specific follows the class focus');
update public.maths_focuses set starts_at = now() - interval '2 hours' where scope = 'class';
select pg_temp.as(201);
select public.teacher_set_maths_focus(pg_temp.klass('A'), 'class', null, array['facts-10'], false, 'week');
select pg_temp.reset();
select is(pg_temp.focus(107) -> 'skills', '["facts-10"]'::jsonb, 'a newer class focus replaces the older one');
select is(pg_temp.focus(104) -> 'skills', '[]'::jsonb, 'and does not reach another class');
select is(pg_temp.focus(102) -> 'skills', '["dbl-half-20"]'::jsonb, 'a student with their own focus keeps it');

-- ---- A focus that has ended or not started yet does not count ----
update public.maths_focuses set starts_at = now() - interval '3 days', ends_at = now() - interval '1 day';
select is(pg_temp.src(107), 'auto', 'once every focus has ended, nobody follows one');
select is(pg_temp.src(103), 'auto', 'including the group');
select is(pg_temp.src(101), 'student', 'and a student goes back to their own choice, not to the teacher');
update public.maths_focuses set starts_at = now() + interval '1 day', ends_at = now() + interval '2 days';
select is(pg_temp.src(107), 'auto', 'one that starts tomorrow does not count yet');
delete from public.maths_focuses;

-- ---- Layering: an hour for one student on top of a week for the class ----
select pg_temp.as(201);
select public.teacher_set_maths_focus(pg_temp.klass('A'), 'class', null, array['tables-3-4-8'], false, 'week');
select public.teacher_set_maths_focus(pg_temp.klass('A'), 'student', array[pg_temp.uid(101)], array['facts-10'], true, 'lesson');
select pg_temp.reset();
select is(pg_temp.focus(101) -> 'skills', '["facts-10"]'::jsonb, 'the hour wins for that student');
select is(pg_temp.focus(102) -> 'skills', '["tables-3-4-8"]'::jsonb, 'the class keeps the week');
update public.maths_focuses set starts_at = now() - interval '2 hours', ends_at = now() - interval '1 hour' where scope = 'student';
select is(pg_temp.focus(101) -> 'skills', '["tables-3-4-8"]'::jsonb, 'when the hour is up they go back to the class focus, not to auto');
delete from public.maths_focuses;

-- ---- Who can set a focus where ----
select pg_temp.as(202);
select throws_ok(format('select public.teacher_set_maths_focus(%L, %L, null, array[%L], false, %L)', pg_temp.klass('A'), 'class', 'facts-10', 'week'), '42501', null, 'a teacher cannot set a focus for another teacher''s class');
select throws_ok(format('select public.teacher_set_maths_focus(%L, %L, array[%L]::uuid[], array[%L], false, %L)', pg_temp.klass('B'), 'student', pg_temp.uid(101), 'facts-10', 'week'), '42501', null, 'nor for a student who is in a different class from the one they name');
select throws_ok(format('select public.teacher_set_maths_focus(%L, %L, array[%L]::uuid[], array[%L], false, %L)', pg_temp.klass('B'), 'group', pg_temp.klass('Kea'), 'facts-10', 'week'), '42501', null, 'nor for another class''s group');
select throws_ok(format('select public.teacher_set_maths_focus(%L, %L, array[%L]::uuid[], array[%L], false, %L)', pg_temp.klass('B'), 'student', pg_temp.uid(106), 'facts-10', 'week'), '42501', null, 'nor for a student with no class');
select throws_ok(format('select public.teacher_set_maths_focus(%L, %L, array[%L]::uuid[], array[%L], false, %L)', pg_temp.klass('B'), 'student', pg_temp.uid(311), 'facts-10', 'week'), '42501', null, 'nor for a student at another school');
select pg_temp.as(301);
select throws_ok(format('select public.teacher_set_maths_focus(%L, %L, null, array[%L], false, %L)', pg_temp.klass('A'), 'class', 'facts-10', 'week'), '42501', null, 'a teacher at another school cannot set one on a class here');
select throws_ok(format('select public.teacher_set_maths_focus(%L, %L, array[%L]::uuid[], array[%L], false, %L)', pg_temp.klass('C'), 'student', pg_temp.uid(101), 'facts-10', 'week'), '42501', null, 'nor on a student here from their own class');
select pg_temp.as(201);
select throws_ok(format('select public.teacher_set_maths_focus(%L, %L, array[%L]::uuid[], array[%L], false, %L)', pg_temp.klass('A'), 'student', pg_temp.uid(104), 'facts-10', 'week'), '42501', null, 'a teacher cannot name a student from another class');
select pg_temp.reset();
select is((select count(*)::int from public.maths_focuses), 0, 'none of those made a row');
select pg_temp.as(203);
select is(public.teacher_set_maths_focus(pg_temp.klass('B'), 'class', null, array['facts-10'], false, 'week'), 1, 'the school admin can set one for any class in the school');
select throws_ok(format('select public.teacher_set_maths_focus(%L, %L, null, array[%L], false, %L)', pg_temp.klass('C'), 'class', 'facts-10', 'week'), '42501', null, 'but not for another school''s class');
select pg_temp.reset();
select is(pg_temp.src(104), 'teacher-class', 'class B follows the admin''s focus');
select is(pg_temp.src(101), 'student', 'class A does not (a student there falls back to their own choice)');
delete from public.maths_focuses;

-- ---- Checks on what is set ----
select pg_temp.as(201);
select throws_ok(format('select public.teacher_set_maths_focus(%L, %L, null, array[]::text[], false, %L)', pg_temp.klass('A'), 'class', 'week'), '22023', null, 'a focus needs a skill');
select throws_ok(format('select public.teacher_set_maths_focus(%L, %L, null, array[%L], false, %L)', pg_temp.klass('A'), 'class', 'Bad Skill!', 'week'), '22023', null, 'skill names are checked');
select throws_ok(format('select public.teacher_set_maths_focus(%L, %L, null, array[%L], false, %L)', pg_temp.klass('A'), 'everyone', 'facts-10', 'week'), '22023', null, 'the scope is checked');
select throws_ok(format('select public.teacher_set_maths_focus(%L, %L, null, array[%L], false, %L)', pg_temp.klass('A'), 'class', 'facts-10', 'soon'), '22023', null, 'so is the length');
select throws_ok(format('select public.teacher_set_maths_focus(%L, %L, null, array[%L], false, %L)', pg_temp.klass('A'), 'group', 'facts-10', 'week'), '22023', null, 'a group focus needs a group');
select throws_ok(format('select public.teacher_set_maths_focus(%L, %L, array[]::uuid[], array[%L], false, %L)', pg_temp.klass('A'), 'student', 'facts-10', 'week'), '22023', null, 'a student focus needs students');
select throws_ok(format('select public.teacher_set_maths_focus(null, %L, null, array[%L], false, %L)', 'class', 'facts-10', 'week'), '42501', null, 'and a class');
select throws_ok(format('select public.teacher_set_maths_focus(%L, %L, null, array[%L], false, %L, now() - interval %L)', pg_temp.klass('A'), 'class', 'facts-10', 'custom', '1 day'), '22023', null, 'a custom end in the past is refused');
select pg_temp.reset();
select is((select count(*)::int from public.maths_focuses), 0, 'nothing was made');

-- ---- Running focuses: list, extend, end now ----
select pg_temp.as(201);
select public.teacher_set_maths_focus(pg_temp.klass('A'), 'student', array[pg_temp.uid(101), pg_temp.uid(102)], array['tables-6-9', 'facts-20'], false, 'lesson');
select public.teacher_set_maths_focus(pg_temp.klass('A'), 'group', array[pg_temp.klass('Kea')], array['dbl-half-10'], true, 'today');
select public.teacher_set_maths_focus(pg_temp.klass('A'), 'class', null, array['tables-2-5-10'], false, 'friday');
select is(jsonb_array_length(public.teacher_maths_focuses(pg_temp.klass('A'))), 3, 'the running list has one entry for each press, not each student');
select is((select count(*)::int from public.teacher_maths_focuses(pg_temp.klass('A')) e, jsonb_array_elements(e) x where x ->> 'scope' = 'student' and jsonb_array_length(x -> 'targets') = 2), 1, 'the two-student press lists both');
select is((select string_agg(t ->> 'name', ',' order by t ->> 'name') from jsonb_array_elements(public.teacher_maths_focuses(pg_temp.klass('A'))) x, jsonb_array_elements(x -> 'targets') t where x ->> 'scope' = 'group'), 'Kea', 'a group is listed by its name');
select is((select bool_and(x ->> 'status' = 'running') from jsonb_array_elements(public.teacher_maths_focuses(pg_temp.klass('A'))) x), true, 'all three are running');
select is((select x ->> 'className' from jsonb_array_elements(public.teacher_maths_focuses(pg_temp.klass('A'))) x limit 1), 'Room 12', 'with the class name (for the teacher)');
select ok(public.teacher_maths_focuses(pg_temp.klass('A'))::text !~ '@', 'and no email addresses anywhere');
select is(jsonb_array_length(public.teacher_maths_focuses()), 3, 'asking with no class lists every class I teach');
select pg_temp.as(202);
select is(jsonb_array_length(public.teacher_maths_focuses()), 0, 'another teacher sees none of them');
select throws_ok(format('select public.teacher_maths_focuses(%L)', pg_temp.klass('A')), '42501', null, 'nor can they ask for that class');
select pg_temp.as(301);
select is(jsonb_array_length(public.teacher_maths_focuses()), 0, 'a teacher at another school sees none');
select pg_temp.as(203);
select is(jsonb_array_length(public.teacher_maths_focuses(pg_temp.klass('A'))), 3, 'the school admin sees the class''s');
select pg_temp.as(201);
create temp table batches as select x ->> 'batch' as id, x ->> 'scope' as scope, (x ->> 'endsAt')::timestamptz as ends
  from jsonb_array_elements(public.teacher_maths_focuses(pg_temp.klass('A'))) x;
grant all on batches to public;
select throws_ok(format('select public.teacher_extend_maths_focus(%L, %L)', (select id from batches where scope = 'student'), 'lesson'), '22023', null, 'extending to the same time is refused');
select lives_ok(format('select public.teacher_extend_maths_focus(%L, %L)', (select id from batches where scope = 'student'), 'week'), 'extending the hour to a week works');
select pg_temp.reset();
select is((select count(*)::int from public.maths_focuses where scope = 'student' and ends_at > now() + interval '6 days'), 2, 'for both students');
-- Compared with each press's own end, not a fixed time from now: 'friday' is six and a half days away on a Saturday.
select is((select count(*)::int from public.maths_focuses f join batches b on b.scope = f.scope
  where f.scope in ('group', 'class') and abs(extract(epoch from f.ends_at - b.ends)) > 1), 0, 'and no one else');
select pg_temp.as(202);
select throws_ok(format('select public.teacher_extend_maths_focus(%L, %L)', (select id from batches where scope = 'class'), 'week'), '42501', null, 'another teacher cannot extend it');
select throws_ok(format('select public.teacher_end_maths_focus(%L)', (select id from batches where scope = 'class')), '42501', null, 'or end it');
select pg_temp.as(301);
select throws_ok(format('select public.teacher_end_maths_focus(%L)', (select id from batches where scope = 'class')), '42501', null, 'nor a teacher at another school');
select pg_temp.as(201);
select is(public.teacher_end_maths_focus((select id::uuid from batches where scope = 'student')), 2, 'End now stops both students');
select pg_temp.reset();
select is(pg_temp.src(101), 'teacher-class', 'they drop to the class focus');
select is((select count(*)::int from public.maths_focuses where scope = 'student'), 2, 'and the ended rows are kept');
select pg_temp.as(201);
select is(jsonb_array_length(public.teacher_maths_focuses(pg_temp.klass('A'))), 2, 'the running list no longer shows it');
select is(jsonb_array_length(public.teacher_maths_focuses(pg_temp.klass('A'), true)), 3, 'the history does');
select is((select x ->> 'status' from jsonb_array_elements(public.teacher_maths_focuses(pg_temp.klass('A'), true)) x where x ->> 'scope' = 'student'), 'ended', 'marked ended');
select throws_ok(format('select public.teacher_extend_maths_focus(%L, %L)', (select id from batches where scope = 'student'), 'week'), '22023', null, 'an ended focus cannot be extended');
select is(public.teacher_end_maths_focus((select id::uuid from batches where scope = 'student')), 0, 'ending it again does nothing');
select is(public.teacher_end_maths_focus(gen_random_uuid()), 0, 'ending a focus that does not exist does nothing');

-- ---- Moving a student takes them out of the old class's focuses ----
select pg_temp.as(201);
select public.teacher_set_maths_focus(pg_temp.klass('A'), 'student', array[pg_temp.uid(101)], array['facts-10'], true, 'week');
select pg_temp.reset();
select is(pg_temp.src(101), 'teacher-student', 'before moving');
select pg_temp.as(203);
select public.teacher_move_student(pg_temp.uid(101), pg_temp.klass('B'));
select pg_temp.reset();
select is(pg_temp.src(101), 'student', 'after moving to class B, class A''s focuses (even the one just for them) stop, and they fall back to their own choice');
select pg_temp.as(203);
select public.teacher_move_student(pg_temp.uid(101), pg_temp.klass('A'));
select pg_temp.reset();
select is(pg_temp.src(101), 'teacher-student', 'coming back, they apply again (they have not ended)');

-- ---- Deleting a group removes its focuses ----
select pg_temp.as(201);
select lives_ok(format('select public.teacher_delete_group(%L)', pg_temp.klass('Kea')), 'a group can be deleted');
select pg_temp.reset();
select is((select count(*)::int from public.maths_focuses where scope = 'group'), 0, 'and its focuses go with it');
select is(pg_temp.src(103), 'teacher-class', 'its students follow the class again');

-- ---- Groups: rename ----
select pg_temp.as(201);
select lives_ok(format('select public.teacher_rename_group(%L, %L)', pg_temp.klass('Tui'), 'Piwakawaka'), 'a teacher renames a group');
select is((select x ->> 'name' from jsonb_array_elements(public.teacher_class_detail(pg_temp.klass('A')) -> 'groups') x), 'Piwakawaka', 'and the class page shows it');
select throws_ok(format('select public.teacher_rename_group(%L, %L)', pg_temp.klass('Tui'), 'bad@name'), '22023', null, 'group names have no @ signs');
insert into pg_temp.made values ('Kea2', public.teacher_create_group(pg_temp.klass('A'), 'Kea'));
select throws_ok(format('select public.teacher_rename_group(%L, %L)', pg_temp.klass('Tui'), 'Kea'), '22023', null, 'two groups in a class cannot share a name');
select lives_ok(format('select public.teacher_rename_group(%L, %L)', pg_temp.klass('Tui'), 'Piwakawaka'), 'keeping its own name is fine');
select pg_temp.as(202);
select throws_ok(format('select public.teacher_rename_group(%L, %L)', pg_temp.klass('Tui'), 'Mine'), '42501', null, 'another teacher cannot rename it');
select pg_temp.as(102);
select throws_ok(format('select public.teacher_rename_group(%L, %L)', pg_temp.klass('Tui'), 'Mine'), '42501', null, 'nor a student');
select pg_temp.as(201);
select is((select x ->> 'groupId' from jsonb_array_elements(public.teacher_class_detail(pg_temp.klass('A')) -> 'members') x where x ->> 'id' = pg_temp.uid(102)::text), pg_temp.klass('Tui')::text, 'the class detail says which group each student is in');

-- ---- New classes are named from the teacher's email ----
select pg_temp.as(201);
insert into pg_temp.made values ('N1', public.teacher_create_class('', 2026));
insert into pg_temp.made values ('N2', public.teacher_create_class(null, 2026, 4));
insert into pg_temp.made values ('N3', public.teacher_create_class('   ', 2027));
select pg_temp.as(204);
insert into pg_temp.made values ('N4', public.teacher_create_class('', 2026));
select pg_temp.reset();
select is((select name from public.classes where id = pg_temp.klass('N1')), 't201', 'a blank class name is the part of the email before the @');
select is((select name from public.classes where id = pg_temp.klass('N2')), 't201 2', 'a second one this year gets a number');
select is((select name from public.classes where id = pg_temp.klass('N3')), 't201', 'in another year the plain name is free again');
select is((select count(*)::int from public.class_teachers where class_id = pg_temp.klass('N1') and teacher_id = pg_temp.uid(201)), 1, 'and the maker teaches it');
select is((select count(*)::int from public.app_settings where class_id = pg_temp.klass('N1')), 1, 'with its own settings');
select is((select name from public.classes where id = pg_temp.klass('N4')), 'mr-smith-x', 'marks a class name cannot hold are swapped for a dash');
select pg_temp.as(201);
select lives_ok(format('select public.teacher_update_class(%L, %L, 2026, 5)', pg_temp.klass('N1'), 'Room 9'), 'and a teacher can rename it');
select throws_ok($$ select public.teacher_create_class('x@y.com', 2026) $$, '22023', null, 'typed names are still checked');
select pg_temp.as(101);
select throws_ok($$ select public.teacher_create_class('', 2026) $$, '42501', null, 'a student cannot make a class');
select pg_temp.reset();
select is((select count(*)::int from public.classes where school_id = 3 and name <> 'Room 3'), 0, 'other schools'' classes were not touched');

-- ---- The settings the Teacher page's class picker reads ----
select pg_temp.as(201);
select is((public.teacher_class_settings(pg_temp.klass('A')) ->> 'students_choose_focus')::boolean, true, 'a teacher reads the settings of a class they teach');
select ok(public.teacher_class_settings(pg_temp.klass('A')) ? 'multiplayer_enabled', 'which has all the switches');
select ok((public.teacher_class_settings() ->> 'class_id')::uuid in (pg_temp.klass('A'), pg_temp.klass('N1'), pg_temp.klass('N2'), pg_temp.klass('N3')), 'with no class named it is a class they teach (the first, as the page always showed)');
select throws_ok(format('select public.teacher_class_settings(%L)', pg_temp.klass('B')), '42501', null, 'not another teacher''s class');
select throws_ok(format('select public.teacher_class_settings(%L)', pg_temp.klass('C')), '42501', null, 'not another school''s');
select pg_temp.as(203);
select lives_ok(format('select public.teacher_class_settings(%L)', pg_temp.klass('B')), 'the school admin can read any class in the school');
select pg_temp.as(201);
select lives_ok(format('select public.teacher_set_space_maths(%L, %L)', 'on', pg_temp.klass('A')), 'a switch on a named class changes that class');
select pg_temp.reset();
select is((select space_maths from public.app_settings where class_id = pg_temp.klass('A')), 'on', 'there');
select is((select space_maths from public.app_settings where class_id = pg_temp.klass('N1')), 'choose', 'and not in the teacher''s other class');

-- ---- What Gem Keep and Mission Control are given ----
select throws_ok($$ insert into public.gem_keep_facts (player, pack, fact_key, attempts, correct, avg_ms, box) values ('00000000-0000-0000-0000-000000000101', 'x', 'Bond10:3+7', 1, 1, 1000, 1) $$, '23514', null, 'a record key must still look like a key');
select lives_ok($$ insert into public.gem_keep_facts (player, pack, fact_key, attempts, correct, avg_ms, box) values ('00000000-0000-0000-0000-000000000102', 'early-facts', 'bond20:8+12', 1, 1, 1000, 1) $$, 'a key with digits before the colon (bond20:8+12) can be stored');
insert into public.gem_keep_facts (player, pack, fact_key, attempts, correct, avg_ms, box, last_seen) values
  (pg_temp.uid(101), 'times-tables', 'mul:6x7', 3, 3, 2000, 2, now()),
  (pg_temp.uid(101), 'early-facts', 'bond10:3+7', 3, 3, 2000, 2, now()),
  (pg_temp.uid(101), 'add-sub', 'add:3+4', 3, 3, 2000, 2, now()),
  (pg_temp.uid(101), 'division', 'div:56/8', 3, 3, 2000, 2, now()),
  (pg_temp.uid(101), 'money', 'money:change', 3, 3, 2000, 2, now());
select pg_temp.as(101);
select is(jsonb_array_length(public.my_gem_keep() -> 'facts'), 4, 'Gem Keep gets the records of the four packs a focus uses (not Dragon Maths'' money)');
select is(public.my_gem_keep() -> 'focus' ->> 'source', 'teacher-student', 'and the focus');
select is(public.my_gem_keep() -> 'settings' ->> 'mode', 'calm', 'and the settings as before');
select pg_temp.reset();
select is(jsonb_array_length(public.space_maths_context(pg_temp.uid(101)) -> 'facts'), 4, 'Mission Control gets the same records');
select is(public.space_maths_context(pg_temp.uid(101)) -> 'focus' ->> 'source', 'teacher-student', 'and the focus');
select is(public.space_maths_context(pg_temp.uid(102)) -> 'focus' ->> 'source', 'teacher-class', 'each player''s own');
select pg_temp.as(102);
select throws_ok(format('select public.space_maths_context(%L)', pg_temp.uid(101)), '42501', null, 'a student cannot call it for someone else');
select pg_temp.reset();
select ok(not has_function_privilege('anon', 'public.my_maths_focus()', 'execute'), 'a signed-out visitor cannot ask for a focus');
select ok(not has_function_privilege('anon', 'public.teacher_set_maths_focus(uuid, text, uuid[], text[], boolean, text, timestamptz)', 'execute'), 'or set one');
select ok(not has_function_privilege('authenticated', 'public.maths_focus_of(uuid)', 'execute'), 'only the game servers can ask for anyone''s focus');
select ok(has_function_privilege('service_role', 'public.maths_focus_of(uuid)', 'execute'), '(they can)');
select ok(not has_function_privilege('authenticated', 'public.focus_end(text, timestamptz)', 'execute'), 'helpers are closed');
select ok(not has_function_privilege('authenticated', 'public.default_class_name(uuid, integer)', 'execute'), 'including the class-name one');

-- ---- Douglas Park: Everyone still works ----
select pg_temp.as(11);
select is((select count(*)::int from public.teacher_classes() where name = 'Everyone'), 1, 'a Douglas Park teacher teaches Everyone');
select is(public.teacher_set_maths_focus((select id from public.teacher_classes() where name = 'Everyone'), 'class', null, array['facts-10'], false, 'friday'), 1, 'and can set a focus for it');
select pg_temp.reset();
select is(pg_temp.src(1), 'teacher-class', 'a Douglas Park student follows it');
select is(pg_temp.src(101), 'teacher-student', 'and School 2 is not touched');

select * from finish();
rollback;
