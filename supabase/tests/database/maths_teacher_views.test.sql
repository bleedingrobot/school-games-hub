-- Maths focus F.7: the teacher skill map (one class's records, nobody else's), the student's placement, the button that clears it
-- (never the furthest place), and the focus history (ended focuses, who set them).
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(57);

select setval(pg_get_serial_sequence('public.schools', 'id'), 1);
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id) values ('otherschool.school.nz', 2);

create function pg_temp.uid(n integer) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
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
create function pg_temp.ids(m jsonb) returns text[] language sql as $$
  select coalesce(array_agg(s ->> 'name' order by s ->> 'name'), '{}') from jsonb_array_elements(m -> 'students') s
$$;

-- Class A (teacher 201, Year 5): students 101 102. Class B (teacher 202): 103. Student 104 has no class.
select pg_temp.as(201);
insert into pg_temp.made values ('A', public.teacher_create_class('Room 12', 2026, 5));
select pg_temp.as(202);
insert into pg_temp.made values ('B', public.teacher_create_class('Room 14', 2026, null));
select pg_temp.as(201);
select public.teacher_add_to_class(pg_temp.klass('A'), array[pg_temp.uid(101), pg_temp.uid(102)]);
select pg_temp.as(202);
select public.teacher_add_to_class(pg_temp.klass('B'), array[pg_temp.uid(103)]);
select pg_temp.reset();
update public.profiles set display_name = 'Kea Fern 1' where id = pg_temp.uid(101);
update public.profiles set display_name = 'Kea Fern 2' where id = pg_temp.uid(102);
update public.profiles set display_name = 'Tui Fern 3' where id = pg_temp.uid(103);
update public.profiles set display_name = 'Tui Fern 4' where id = pg_temp.uid(104);
update public.profiles set display_name = 'Teacher Tee 5' where id = pg_temp.uid(201);

-- Records: 101 has times tables, early facts and generated types; 102 has one fact; 103 and 104 have one each (they must never show up for 201).
insert into public.gem_keep_facts (player, pack, fact_key, attempts, correct, avg_ms, box, last_seen, quick_days) values
  (pg_temp.uid(101), 'times-tables', 'mul:6x7', 5, 4, 2200, 3, now(), '{2026-10-17,2026-10-18}'),
  (pg_temp.uid(101), 'times-tables', 'mul:6x8', 2, 1, 4100, 1, now(), '{}'),
  (pg_temp.uid(101), 'early-facts', 'tenand:4', 3, 3, 1800, 2, now(), '{}'),
  (pg_temp.uid(101), 'generated', 'round:100:3digit', 6, 5, 5200, 4, now(), '{2026-10-17,2026-10-18}'),
  (pg_temp.uid(101), 'monsters', 'mul:3x4', 9, 9, 900, 4, now(), '{}'),
  (pg_temp.uid(102), 'times-tables', 'mul:2x3', 1, 1, 1500, 1, now(), '{}'),
  (pg_temp.uid(103), 'times-tables', 'mul:9x9', 4, 4, 1600, 3, now(), '{}'),
  (pg_temp.uid(104), 'generated', 'bedmas:brackets-first', 7, 7, 3000, 3, now(), '{}');

-- ---- The skill map: a teacher gets their own class and no one else ----
select pg_temp.as(201);
select is(public.teacher_class_skill_map(pg_temp.klass('A')) #>> '{class,name}', 'Room 12', 'a teacher gets the class they teach');
select is(public.teacher_class_skill_map(pg_temp.klass('A')) #>> '{class,yearLevel}', '5', 'with its year level');
select is(public.teacher_class_skill_map(pg_temp.klass('A')) #>> '{class,auto}', 'false', 'and whether auto is on (off to begin with)');
select is(pg_temp.ids(public.teacher_class_skill_map(pg_temp.klass('A'))), array['Kea Fern 1', 'Kea Fern 2'], 'the students are the ones in that class, not another class or nobody''s');
select is(public.teacher_class_skill_map(pg_temp.klass('A')) #>> '{students,0,realName}', 's101', 'a teacher sees the part of the school email before the @, as elsewhere');
select is(jsonb_array_length(public.teacher_class_skill_map(pg_temp.klass('A')) #> '{students,0,facts}'), 4, 'a student''s records are the four ladder ones (times tables, early facts, generated), not Maths Monsters'' own');
select is((select count(*)::integer from jsonb_array_elements(public.teacher_class_skill_map(pg_temp.klass('A')) -> 'students') s, jsonb_array_elements(s -> 'facts') f where f ->> 'key' in ('mul:9x9', 'bedmas:brackets-first')), 0, 'and no other class''s records');
select is((public.teacher_class_skill_map(pg_temp.klass('A')) #> '{students,0,facts}') @> '[{"key":"mul:6x7","attempts":5,"correct":4,"box":3}]', true, 'with the numbers the games keep');
select is((public.teacher_class_skill_map(pg_temp.klass('A')) #>> '{students,0,settings,division}')::boolean, (select gem_keep_division from public.app_settings where class_id = pg_temp.klass('A')), 'the class settings come with each student');
select is(jsonb_typeof(public.teacher_class_skill_map(pg_temp.klass('A')) #> '{students,0,ladder}'), 'object', 'and where they are on the ladder');
select is(public.teacher_class_skill_map(pg_temp.klass('A')) #>> '{students,0,ladder,on}', 'false', 'which says auto is off');
select lives_ok(format('select public.teacher_set_maths_auto(true, %L)', pg_temp.klass('A')), 'a teacher turns auto on');
select is(public.teacher_class_skill_map(pg_temp.klass('A')) #>> '{class,auto}', 'true', 'the map then says so');
select is(public.teacher_class_skill_map(pg_temp.klass('A')) #>> '{students,1,ladder,on}', 'true', 'for each student');
select is(jsonb_array_length(public.teacher_class_skill_map(pg_temp.klass('A')) #> '{students,1,facts}'), 1, 'a student with one record gets one');

-- ---- Who is refused ----
select pg_temp.as(202);
select throws_ok(format('select public.teacher_class_skill_map(%L)', pg_temp.klass('A')), '42501', null, 'another teacher in the same school cannot read the class');
select is(pg_temp.ids(public.teacher_class_skill_map(pg_temp.klass('B'))), array['Tui Fern 3'], 'they get their own');
select pg_temp.as(11);
select throws_ok(format('select public.teacher_class_skill_map(%L)', pg_temp.klass('A')), '42501', null, 'a teacher at another school cannot read it');
select pg_temp.as(101);
select throws_ok(format('select public.teacher_class_skill_map(%L)', pg_temp.klass('A')), '42501', null, 'a student cannot read it, even their own class''s');
select pg_temp.reset();
set local role anon;
select throws_ok(format('select public.teacher_class_skill_map(%L)', pg_temp.klass('A')), '42501', null, 'a signed-out visitor cannot call it');
select throws_ok(format('select public.teacher_student_ladder(%L)', pg_temp.uid(101)), '42501', null, 'nor read a placement');
select throws_ok(format('select public.teacher_reset_placement(%L)', pg_temp.uid(101)), '42501', null, 'nor clear one');
select throws_ok(format('select public.teacher_maths_focus_history(%L)', pg_temp.klass('A')), '42501', null, 'nor read the history');
select pg_temp.reset();
select pg_temp.as(201);
select throws_ok($$ select public.teacher_class_skill_map('00000000-0000-0000-0000-0000000000ff') $$, '42501', null, 'a class that does not exist is refused the same way');

-- ---- A student's placement and furthest place ----
select pg_temp.reset();
select public.record_placement(pg_temp.uid(101), 'tables-6-9', false);
select public.record_placement(pg_temp.uid(102), null, true);
select public.record_ladder_place(pg_temp.uid(101), 'tables-6-9', 17);
select pg_temp.as(201);
select is(public.teacher_student_ladder(pg_temp.uid(101)) ->> 'placed', 'done', 'a teacher reads their student''s placement');
select is(public.teacher_student_ladder(pg_temp.uid(101)) ->> 'placement', 'tables-6-9', 'and where it started them');
select is(public.teacher_student_ladder(pg_temp.uid(101)) ->> 'furthest', 'tables-6-9', 'and their furthest place');
select is(public.teacher_student_ladder(pg_temp.uid(102)) ->> 'placed', 'skipped', 'a skip shows as a skip');
select pg_temp.as(202);
select throws_ok(format('select public.teacher_student_ladder(%L)', pg_temp.uid(101)), '42501', null, 'another teacher cannot read it');
select throws_ok(format('select public.teacher_student_ladder(%L)', pg_temp.uid(104)), '42501', null, 'nor a student with no class');
select pg_temp.as(102);
select throws_ok(format('select public.teacher_student_ladder(%L)', pg_temp.uid(101)), '42501', null, 'a student cannot read a classmate''s');

-- ---- Clearing the placement ----
select pg_temp.as(202);
select throws_ok(format('select public.teacher_reset_placement(%L)', pg_temp.uid(101)), '42501', null, 'another teacher cannot clear it');
select pg_temp.as(11);
select throws_ok(format('select public.teacher_reset_placement(%L)', pg_temp.uid(101)), '42501', null, 'nor a teacher at another school');
select pg_temp.as(101);
select throws_ok(format('select public.teacher_reset_placement(%L)', pg_temp.uid(101)), '42501', null, 'a student cannot clear their own');
select pg_temp.reset();
select is((select count(*)::integer from public.ladder_placements where student_id = pg_temp.uid(101)), 1, 'so far it is still there');
select pg_temp.as(201);
select is(public.teacher_reset_placement(pg_temp.uid(101)), true, 'their teacher clears it');
select pg_temp.reset();
select is((select count(*)::integer from public.ladder_placements where student_id = pg_temp.uid(101)), 0, 'the placement is gone');
select is((select skill from public.ladder_places where student_id = pg_temp.uid(101)), 'tables-6-9', 'but the furthest place is kept');
select is((select rank from public.ladder_places where student_id = pg_temp.uid(101)), 17, 'exactly as it was');
select is(public.ladder_info(pg_temp.uid(101)) -> 'placed', 'null'::jsonb, 'the games are told there is no placement, so the warm-up is offered again');
select is(public.ladder_info(pg_temp.uid(101)) ->> 'furthest', 'tables-6-9', 'and the furthest place');
select is(public.record_placement(pg_temp.uid(101), 'facts-20', false), true, 'a new warm-up can be stored');
select pg_temp.as(201);
select is(public.teacher_reset_placement(pg_temp.uid(101)), true, 'and cleared again');
select is(public.teacher_reset_placement(pg_temp.uid(101)), false, 'clearing nothing says so');
select is(public.teacher_reset_placement(pg_temp.uid(102)), true, 'a skip can be cleared too');

-- ---- The focus history ----
select public.teacher_set_maths_focus(pg_temp.klass('A'), 'class', null, array['tables-6-9'], false, 'friday');
select public.teacher_set_maths_focus(pg_temp.klass('A'), 'student', array[pg_temp.uid(101), pg_temp.uid(102)], array['facts-10'], true, 'week');
select public.teacher_set_maths_focus(pg_temp.klass('A'), 'class', null, array['round-10-100'], false, 'lesson');
select pg_temp.reset();
create temp table batches as select batch_id, min(skills::text) as skills from public.maths_focuses group by batch_id;
grant select on batches to public;
select pg_temp.as(201);
select is(jsonb_array_length(public.teacher_maths_focus_history(pg_temp.klass('A'))), 0, 'focuses that are running are not history');
select public.teacher_end_maths_focus((select batch_id from pg_temp.batches where skills = '{tables-6-9}'));
select public.teacher_end_maths_focus((select batch_id from pg_temp.batches where skills = '{facts-10}'));
select is(jsonb_array_length(public.teacher_maths_focus_history(pg_temp.klass('A'))), 2, 'once ended they are');
select is(public.teacher_maths_focus_history(pg_temp.klass('A')) #>> '{0,status}', 'ended', 'marked ended');
select is(public.teacher_maths_focus_history(pg_temp.klass('A')) #>> '{0,setBy}', 'Teacher Tee 5', 'with who set them');
select is((select count(*)::integer from jsonb_array_elements(public.teacher_maths_focus_history(pg_temp.klass('A'))) h where h -> 'skills' ? 'round-10-100'), 0, 'a focus still running is not in it');
select is((select count(*)::integer from jsonb_array_elements(public.teacher_maths_focus_history(pg_temp.klass('A'))) h where h ->> 'scope' = 'student' and jsonb_array_length(h -> 'targets') = 2), 1, 'a focus for two students lists both');
select is(jsonb_array_length(public.teacher_maths_focus_history(pg_temp.klass('A'), now() + interval '1 day')), 0, 'asking for "since" tomorrow gives none');
select is(jsonb_array_length(public.teacher_maths_focus_history(pg_temp.klass('A'), now() - interval '1 day')), 2, 'since yesterday gives both');
select pg_temp.as(202);
select throws_ok(format('select public.teacher_maths_focus_history(%L)', pg_temp.klass('A')), '42501', null, 'another teacher cannot read it');
select throws_ok($$ select public.teacher_maths_focus_history(null) $$, '42501', null, 'nor ask for every class at once');
select pg_temp.as(101);
select throws_ok(format('select public.teacher_maths_focus_history(%L)', pg_temp.klass('A')), '42501', null, 'a student cannot read it');
select pg_temp.reset();
select is((select count(*)::integer from public.maths_focuses), 4, 'and nothing was deleted: every focus is still in the table');

select * from finish();
rollback;
