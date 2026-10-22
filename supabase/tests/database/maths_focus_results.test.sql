-- Maths focus F.8, part A: how students did while a focus ran. Counts only inside the focus window, for the right student, for the
-- skills the focus names, once per focus press; closed to the website; a teacher reads only their own classes' focuses.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(47);

select setval(pg_get_serial_sequence('public.schools', 'id'), 1);
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id) values ('otherschool.school.nz', 2);

create function pg_temp.uid(n integer) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;
create function pg_temp.bid(n integer) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0001-' || lpad(n::text, 12, '0'))::uuid
$$;
-- School 2: 101-104 students, 201 and 202 teachers. School 1 (Douglas Park): 1 student, 11 teacher.
insert into auth.users (id, email)
select pg_temp.uid(n), 's' || n || '@otherschool.school.nz' from generate_series(101, 104) n;
insert into auth.users (id, email) values
  (pg_temp.uid(201), 't201@otherschool.school.nz'), (pg_temp.uid(202), 't202@otherschool.school.nz'),
  (pg_temp.uid(1), 's1@douglaspark.school.nz'), (pg_temp.uid(11), 't11@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id in (pg_temp.uid(201), pg_temp.uid(202), pg_temp.uid(11));

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
grant all on made to authenticated, anon;
create function pg_temp.klass(n text) returns uuid language sql as $$ select id from pg_temp.made where name = n $$;
-- An answer `ago` before now.
create function pg_temp.ans(skills text[], ago interval, right_ boolean, quick_ boolean) returns jsonb language sql as $$
  select jsonb_build_object('skills', to_jsonb(skills), 'at', (extract(epoch from now() - ago) * 1000)::bigint, 'correct', right_, 'quick', quick_)
$$;

-- Class A (teacher 201): students 101 102, group G has 101. Class B (teacher 202): 103. Student 104 has no class.
select pg_temp.as(201);
insert into pg_temp.made values ('A', public.teacher_create_class('Room 12', 2026, 5));
select pg_temp.as(202);
insert into pg_temp.made values ('B', public.teacher_create_class('Room 14', 2026, null));
select pg_temp.as(201);
select public.teacher_add_to_class(pg_temp.klass('A'), array[pg_temp.uid(101), pg_temp.uid(102)]);
insert into pg_temp.made values ('G', public.teacher_create_group(pg_temp.klass('A'), 'Kiwis'));
select public.teacher_set_group_member(pg_temp.klass('G'), pg_temp.uid(101), true);
select pg_temp.as(202);
select public.teacher_add_to_class(pg_temp.klass('B'), array[pg_temp.uid(103)]);
select pg_temp.reset();
update public.profiles set display_name = 'Kea Fern 1' where id = pg_temp.uid(101);
update public.profiles set display_name = 'Kea Fern 2' where id = pg_temp.uid(102);
update public.profiles set display_name = 'Tui Fern 3' where id = pg_temp.uid(103);

-- Focuses (put in directly so the times can be set).
--   1: class A, whole class, tables-6-9, running            2: student 101, tables-6-9 + facts-10, running (overlaps 1)
--   3: group G, facts-10, running                            4: class A, tables-6-9, ended 5 days ago
--   5: class A, round-10-100, ended early (ends later, ended 1 day ago)
--   6: class B, tables-6-9, running                          7: class A, tables-6-9, starts tomorrow
insert into public.maths_focuses (id, batch_id, school_id, class_id, scope, group_id, student_id, skills, starts_at, ends_at, ended_at) values
  (pg_temp.bid(1), pg_temp.bid(1), 2, pg_temp.klass('A'), 'class', null, null, '{tables-6-9}', now() - interval '2 days', now() + interval '5 days', null),
  (pg_temp.bid(2), pg_temp.bid(2), 2, pg_temp.klass('A'), 'student', null, pg_temp.uid(101), '{tables-6-9,facts-10}', now() - interval '2 days', now() + interval '5 days', null),
  (pg_temp.bid(3), pg_temp.bid(3), 2, pg_temp.klass('A'), 'group', pg_temp.klass('G'), null, '{facts-10}', now() - interval '2 days', now() + interval '5 days', null),
  (pg_temp.bid(4), pg_temp.bid(4), 2, pg_temp.klass('A'), 'class', null, null, '{tables-6-9}', now() - interval '10 days', now() - interval '5 days', null),
  (pg_temp.bid(5), pg_temp.bid(5), 2, pg_temp.klass('A'), 'class', null, null, '{round-10-100}', now() - interval '3 days', now() + interval '3 days', now() - interval '1 day'),
  (pg_temp.bid(6), pg_temp.bid(6), 2, pg_temp.klass('B'), 'class', null, null, '{tables-6-9}', now() - interval '2 days', now() + interval '5 days', null),
  (pg_temp.bid(7), pg_temp.bid(7), 2, pg_temp.klass('A'), 'class', null, null, '{tables-6-9}', now() + interval '1 day', now() + interval '3 days', null);

-- ---- The table and the adding function are closed to the website ----
select is((select relrowsecurity from pg_class where oid = 'public.maths_focus_results'::regclass), true, 'the results table has row security on');
select pg_temp.as(101);
select throws_ok($$ select * from public.maths_focus_results $$, '42501', null, 'a student cannot read the results table');
select throws_ok($$ insert into public.maths_focus_results (batch_id, student_id, class_id, answers) values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 1) $$, '42501', null, 'nor write to it');
select throws_ok(format('select public.add_maths_focus_results(%L, %L)', pg_temp.uid(101), '[]'), '42501', null, 'a student cannot add results, not even their own');
select pg_temp.as(201);
select throws_ok(format('select public.add_maths_focus_results(%L, %L)', pg_temp.uid(101), '[]'), '42501', null, 'nor can a teacher');
select throws_ok($$ select * from public.maths_focus_results_since $$, '42501', null, 'the start day is closed too');
select pg_temp.reset();
select set_config('role', 'anon', true);
select throws_ok(format('select public.add_maths_focus_results(%L, %L)', pg_temp.uid(101), '[]'), '42501', null, 'a signed-out visitor cannot add results');
select throws_ok(format('select public.teacher_maths_focus_results(%L)', pg_temp.bid(1)), '42501', null, 'nor read them');
select pg_temp.reset();
select is((select has_function_privilege('service_role', 'public.add_maths_focus_results(uuid, jsonb)', 'execute')), true, 'the server can add results');

-- ---- Counting: only inside the window, only the right student, only the skills named ----
-- Student 102 (class A, no group, no own focus): one right+quick answer on a tables skill an hour ago, one wrong, one on a skill nothing names.
select is(public.add_maths_focus_results(pg_temp.uid(102), jsonb_build_array(
    pg_temp.ans('{tables-6-9}', interval '1 hour', true, true),
    pg_temp.ans('{tables-6-9}', interval '50 minutes', false, false),
    pg_temp.ans('{place-value-1}', interval '40 minutes', true, true))), 1, 'a student in the class: only the running class focus is updated');
select is((select answers || '/' || correct || '/' || quick from public.maths_focus_results where batch_id = pg_temp.bid(1) and student_id = pg_temp.uid(102)), '2/1/1', 'it counts the two answers on its skill: 2 answers, 1 right, 1 quick');
select is((select count(*)::integer from public.maths_focus_results where student_id = pg_temp.uid(102)), 1, 'and nothing for the focus whose skills the answers did not touch (ended, later or another class''s)');
select is((select count(*)::integer from public.maths_focus_results where batch_id in (pg_temp.bid(2), pg_temp.bid(3)) and student_id = pg_temp.uid(102)), 0, 'a student focus and a group focus do not count for a classmate who is not in them');
select is((select count(*)::integer from public.maths_focus_results where batch_id = pg_temp.bid(6)), 0, 'another class''s focus is untouched');

-- Student 101 is under three running focuses (class, own, group). Overlap: an answer counts for every focus whose skills name it.
select is(public.add_maths_focus_results(pg_temp.uid(101), jsonb_build_array(
    pg_temp.ans('{tables-6-9}', interval '1 hour', true, true),
    pg_temp.ans('{facts-10}', interval '30 minutes', true, false))), 3, 'a student under three focuses: all three that name a skill of the answers are updated');
select is((select answers || '/' || correct || '/' || quick from public.maths_focus_results where batch_id = pg_temp.bid(1) and student_id = pg_temp.uid(101)), '1/1/1', 'the class focus counts only the tables answer');
select is((select answers || '/' || correct || '/' || quick from public.maths_focus_results where batch_id = pg_temp.bid(2) and student_id = pg_temp.uid(101)), '2/2/1', 'their own focus counts both (it names both skills)');
select is((select answers || '/' || correct || '/' || quick from public.maths_focus_results where batch_id = pg_temp.bid(3) and student_id = pg_temp.uid(101)), '1/1/0', 'the group focus counts only the facts answer');

-- An answer with two skills that both belong to one focus is still one answer.
select public.add_maths_focus_results(pg_temp.uid(101), jsonb_build_array(pg_temp.ans('{tables-6-9,facts-10}', interval '20 minutes', true, true)));
select is((select answers from public.maths_focus_results where batch_id = pg_temp.bid(2) and student_id = pg_temp.uid(101)), 3, 'an answer owned by two skills of the same focus counts once, not twice');

-- Windows: before it started, after it ended (by date or by "end now"), and a focus that has not started.
select public.add_maths_focus_results(pg_temp.uid(102), jsonb_build_array(
    pg_temp.ans('{tables-6-9}', interval '4 days', true, true),
    pg_temp.ans('{round-10-100}', interval '2 days', true, true),
    pg_temp.ans('{round-10-100}', interval '12 hours', true, true)));
select is((select answers from public.maths_focus_results where batch_id = pg_temp.bid(1) and student_id = pg_temp.uid(102)), 2, 'an answer from before the focus began is not counted (4 days ago)');
select is((select answers from public.maths_focus_results where batch_id = pg_temp.bid(5) and student_id = pg_temp.uid(102)), 1, 'a focus ended early counts what was answered before "end now" (2 days ago), and not after (12 hours ago)');
select public.add_maths_focus_results(pg_temp.uid(102), jsonb_build_array(pg_temp.ans('{tables-6-9}', interval '12 days', true, true), pg_temp.ans('{tables-6-9}', interval '3 days', true, true)));
select is((select count(*)::integer from public.maths_focus_results where batch_id = pg_temp.bid(4)), 0, 'a focus that ran from 10 to 5 days ago ignores answers from before it (12 days) and after it (3 days)');
select public.add_maths_focus_results(pg_temp.uid(102), jsonb_build_array(pg_temp.ans('{tables-6-9}', interval '12 days', true, true), pg_temp.ans('{tables-6-9}', interval '7 days', true, true)));
select is((select answers from public.maths_focus_results where batch_id = pg_temp.bid(4) and student_id = pg_temp.uid(102)), 1, 'a late batch counts by each answer''s own time: the answer from inside an ended focus is counted, the older one is not');
select is((select count(*)::integer from public.maths_focus_results where batch_id = pg_temp.bid(7)), 0, 'a focus that starts tomorrow counts nothing');

-- Students with no class, an unknown skill, an empty batch and nonsense.
select is(public.add_maths_focus_results(pg_temp.uid(104), jsonb_build_array(pg_temp.ans('{tables-6-9}', interval '1 hour', true, true))), 0, 'a student with no class costs nothing and counts nothing');
select is(public.add_maths_focus_results(pg_temp.uid(102), '[]'), 0, 'an empty batch adds nothing');
select is(public.add_maths_focus_results(pg_temp.uid(102), '{"not":"a list"}'), 0, 'a batch that is not a list adds nothing');
select is(public.add_maths_focus_results(pg_temp.uid(102), jsonb_build_array(pg_temp.ans('{no-such-skill}', interval '1 hour', true, true))), 0, 'an unknown skill adds nothing');
select is((select count(*)::integer from public.maths_focus_results where student_id = pg_temp.uid(104)), 0, 'and nothing is stored for the student with no class');
select is((select class_id from public.maths_focus_results where batch_id = pg_temp.bid(1) and student_id = pg_temp.uid(101)), pg_temp.klass('A'), 'each row remembers the class');

-- ---- A teacher reads one focus ----
select pg_temp.as(201);
select is(jsonb_array_length(public.teacher_maths_focus_results(pg_temp.bid(1)) -> 'students'), 2, 'the class focus lists every student in the class');
select is(public.teacher_maths_focus_results(pg_temp.bid(1)) #>> '{students,0,name}', 'Kea Fern 1', 'by name, in order');
select is(public.teacher_maths_focus_results(pg_temp.bid(1)) #>> '{students,0,realName}', 's101', 'with the school email before the @, as elsewhere');
select is(public.teacher_maths_focus_results(pg_temp.bid(1)) #>> '{students,1,answers}', '2', 'and their answers');
select is(public.teacher_maths_focus_results(pg_temp.bid(1)) #>> '{total,answers}', '4', 'the class total adds them up');
select is(public.teacher_maths_focus_results(pg_temp.bid(1)) #>> '{total,quick}', '3', 'including the quick ones');
select is(public.teacher_maths_focus_results(pg_temp.bid(7)) #>> '{students,0,answers}', '0', 'a student who did none is listed, with 0 (not hidden)');
select is(jsonb_array_length(public.teacher_maths_focus_results(pg_temp.bid(7)) -> 'students'), 2, 'for the whole class');
select is(jsonb_array_length(public.teacher_maths_focus_results(pg_temp.bid(2)) -> 'students'), 1, 'a one-student focus lists that student');
select is(public.teacher_maths_focus_results(pg_temp.bid(3)) #>> '{students,0,name}', 'Kea Fern 1', 'a group focus lists the group');
select is(jsonb_array_length(public.teacher_maths_focus_results(pg_temp.bid(3)) -> 'students'), 1, 'and only the group');
select ok((public.teacher_maths_focus_results(pg_temp.bid(1)) ->> 'since')::timestamptz <= now(), 'it says the day counting began');

-- ---- Everyone else is refused ----
select pg_temp.as(202);
select throws_ok(format('select public.teacher_maths_focus_results(%L)', pg_temp.bid(1)), '42501', null, 'another teacher cannot read a class they do not teach');
select is(jsonb_array_length(public.teacher_maths_focus_results(pg_temp.bid(6)) -> 'students'), 1, 'but can read their own class''s');
select pg_temp.as(11);
select throws_ok(format('select public.teacher_maths_focus_results(%L)', pg_temp.bid(6)), '42501', null, 'a teacher at another school cannot read this school''s focus');
select pg_temp.as(101);
select throws_ok(format('select public.teacher_maths_focus_results(%L)', pg_temp.bid(1)), '42501', null, 'a student cannot read results, not even their own class''s');
select pg_temp.as(201);
select throws_ok(format('select public.teacher_maths_focus_results(%L)', gen_random_uuid()), '42501', null, 'a focus that does not exist is refused the same way');

select * from finish();
rollback;
