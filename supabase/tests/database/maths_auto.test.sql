-- Maths focus F.4: the class switch for auto, a student's furthest place (only ever forward), the placement result (stored once),
-- what the focus tells the games about the ladder, and who can read or write any of it (other students, classes, schools).
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(67);

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
grant all on made to authenticated;
create function pg_temp.klass(n text) returns uuid language sql as $$ select id from pg_temp.made where name = n $$;
create function pg_temp.ladder(n integer) returns jsonb language sql as $$ select public.maths_focus_of(pg_temp.uid(n)) -> 'ladder' $$;

-- Class A (teacher 201, Year 5): students 101 102. Class B (teacher 202, no year level): 103. Student 104 has no class.
select pg_temp.as(201);
insert into pg_temp.made values ('A', public.teacher_create_class('Room 12', 2026, 5));
select pg_temp.as(202);
insert into pg_temp.made values ('B', public.teacher_create_class('Room 14', 2026, null));
select pg_temp.as(201);
select public.teacher_add_to_class(pg_temp.klass('A'), array[pg_temp.uid(101), pg_temp.uid(102)]);
select pg_temp.as(202);
select public.teacher_add_to_class(pg_temp.klass('B'), array[pg_temp.uid(103)]);
select pg_temp.reset();

-- ---- The switch is off by default, and nothing changes while it is off ----
select is((select maths_auto from public.app_settings where class_id = pg_temp.klass('A')), false, 'a new class has auto off');
select is((select maths_auto from public.app_settings where school_id = 2 and class_id is null), false, 'so does the school default');
select is(pg_temp.ladder(101) ->> 'on', 'false', 'a student in it is told auto is off');
select is(public.maths_focus_of(pg_temp.uid(101)) ->> 'source', 'auto', 'their focus is still plain auto');
select is(public.maths_focus_of(pg_temp.uid(101)) -> 'skills', '[]'::jsonb, 'with no skills named');
select is(pg_temp.ladder(101) -> 'yearLevel', '5'::jsonb, 'the class''s year level is passed on');
select is(pg_temp.ladder(103) -> 'yearLevel', 'null'::jsonb, 'an empty year level is passed on as empty');
select is(pg_temp.ladder(104) -> 'yearLevel', 'null'::jsonb, 'a student with no class has none');
select is(pg_temp.ladder(101) -> 'placed', 'null'::jsonb, 'nobody has done the placement yet');
select is(pg_temp.ladder(101) -> 'furthest', 'null'::jsonb, 'or reached a place');

-- ---- Who may turn it on ----
select pg_temp.as(202);
select throws_ok(format('select public.teacher_set_maths_auto(true, %L)', pg_temp.klass('A')), '42501', null, 'a teacher cannot change another teacher''s class');
select pg_temp.as(101);
select throws_ok($$ select public.teacher_set_maths_auto(true) $$, '42501', null, 'a student cannot turn it on');
select pg_temp.as(201);
select lives_ok(format('select public.teacher_set_maths_auto(true, %L)', pg_temp.klass('A')), 'a teacher turns auto on for their class');
select pg_temp.reset();
select is(pg_temp.ladder(101) ->> 'on', 'true', 'students in it are told');
select is(pg_temp.ladder(102) ->> 'on', 'true', 'all of them');
select is(pg_temp.ladder(103) ->> 'on', 'false', 'another class is untouched');
select is(pg_temp.ladder(104) ->> 'on', 'false', 'so is a student with no class (the school default)');
select is((select maths_auto from public.app_settings where school_id = 2 and class_id is null), false, 'and the school default');
select pg_temp.as(11);
select throws_ok(format('select public.teacher_set_maths_auto(true, %L)', pg_temp.klass('A')), '42501', null, 'a teacher at another school cannot reach it');
select pg_temp.as(201);
select is((select public.teacher_class_settings(pg_temp.klass('A')) ->> 'maths_auto'), 'true', 'the teacher''s page reads the switch back');
select pg_temp.reset();

-- ---- The focus carries the ladder whatever the source ----
select is(public.maths_focus_of(pg_temp.uid(101)) ->> 'source', 'auto', 'with the switch on and no focus the source is auto');
select pg_temp.as(201);
select public.teacher_set_maths_focus(pg_temp.klass('A'), 'class', null, array['tables-6-9'], false, 'friday');
select pg_temp.reset();
select is(public.maths_focus_of(pg_temp.uid(101)) ->> 'source', 'teacher-class', 'a teacher''s focus still wins');
select is(pg_temp.ladder(101) ->> 'on', 'true', 'and the ladder is still there, so the student''s path can show');
select pg_temp.as(101);
select is(public.my_maths_focus() #>> '{ladder,on}', 'true', 'a student reads it through my_maths_focus');
select pg_temp.reset();

-- ---- Furthest place: only the server writes it, and only forward ----
select pg_temp.as(101);
select throws_ok($$ select * from public.ladder_places $$, '42501', null, 'the places table is closed to the website');
select throws_ok($$ insert into public.ladder_places (student_id, skill, rank) values (auth.uid(), 'facts-10', 0) $$, '42501', null, 'a student cannot write one');
select throws_ok($$ select * from public.ladder_placements $$, '42501', null, 'the placements table is closed too');
select throws_ok(format('select public.record_ladder_place(%L, %L, 3)', pg_temp.uid(101), 'dbl-half-10'), '42501', null, 'a student cannot call the place saver');
select throws_ok(format('select public.record_placement(%L, %L, false)', pg_temp.uid(101), 'dbl-half-10'), '42501', null, 'or the placement saver');
select throws_ok(format('select public.ladder_info(%L)', pg_temp.uid(102)), '42501', null, 'or read another student''s ladder');
select pg_temp.as(201);
select throws_ok(format('select public.record_ladder_place(%L, %L, 3)', pg_temp.uid(101), 'dbl-half-10'), '42501', null, 'a teacher cannot write a student''s place');
select throws_ok($$ select * from public.ladder_places $$, '42501', null, 'or read the table');
select pg_temp.reset();
set local role service_role;
select is(public.record_ladder_place(pg_temp.uid(101), 'dbl-half-10', 1), true, 'the server saves a first place');
select is(pg_temp.ladder(101) ->> 'furthest', 'dbl-half-10', 'it shows in the focus');
select is(public.record_ladder_place(pg_temp.uid(101), 'tables-2-5-10', 5), true, 'a further place moves it forward');
select is(public.record_ladder_place(pg_temp.uid(101), 'facts-10', 0), false, 'a place further back changes nothing');
select is(public.record_ladder_place(pg_temp.uid(101), 'tables-2-5-10', 5), false, 'the same place changes nothing');
select is(pg_temp.ladder(101) ->> 'furthest', 'tables-2-5-10', 'the furthest place is kept');
select is((select rank from public.ladder_places where student_id = pg_temp.uid(101)), 5, 'with its rank');
select throws_ok(format('update public.ladder_places set rank = 2, skill = %L where student_id = %L', 'facts-10', pg_temp.uid(101)), '22023', null, 'even a direct update with the server''s key cannot go back');
select lives_ok(format('update public.ladder_places set rank = 7, skill = %L where student_id = %L', 'tables-3-4-8', pg_temp.uid(101)), 'but one forward is fine');
select throws_ok(format('update public.ladder_places set student_id = %L where student_id = %L', pg_temp.uid(102), pg_temp.uid(101)), '22023', null, 'a place cannot be handed to another student');
select throws_ok(format('select public.record_ladder_place(%L, null, 3)', pg_temp.uid(101)), '22023', null, 'a place with no skill is refused');
select throws_ok(format('select public.record_ladder_place(%L, %L, 3)', pg_temp.uid(101), 'Bad Name!'), '23514', null, 'a skill name with odd characters is refused');
select throws_ok(format('select public.record_ladder_place(%L, %L, 999)', pg_temp.uid(101), 'facts-10'), '23514', null, 'a rank out of range is refused');
select is((select count(*)::int from public.ladder_places where student_id = pg_temp.uid(102)), 0, 'another student has no place');
select is(pg_temp.ladder(102) -> 'furthest', 'null'::jsonb, 'and sees none');
select is(pg_temp.ladder(103) -> 'furthest', 'null'::jsonb, 'nor does another class');
select pg_temp.reset();

-- ---- Placement: stored once ----
set local role service_role;
select is(public.record_placement(pg_temp.uid(102), 'tables-3-4-8', false), true, 'the server stores a placement');
select is(pg_temp.ladder(102) ->> 'placed', 'done', 'the focus says it was done');
select is(pg_temp.ladder(102) ->> 'placement', 'tables-3-4-8', 'and where to start');
select is(public.record_placement(pg_temp.uid(102), 'facts-10', false), false, 'a second placement is not stored');
select is(public.record_placement(pg_temp.uid(102), null, true), false, 'nor a skip after it');
select is(pg_temp.ladder(102) ->> 'placement', 'tables-3-4-8', 'the first one stays');
select throws_ok(format('update public.ladder_placements set skill = %L where student_id = %L', 'facts-10', pg_temp.uid(102)), '22023', null, 'even a direct update cannot change it');
select is(public.record_placement(pg_temp.uid(103), 'tables-6-9', true), true, 'a skipped placement is stored (so nobody is asked again)');
select is(pg_temp.ladder(103) ->> 'placed', 'skipped', 'it shows as skipped');
select is(pg_temp.ladder(103) -> 'placement', 'null'::jsonb, 'with no place to start');
select pg_temp.reset();

-- ---- Their own path: my_ladder ----
select pg_temp.as(101);
select is((select public.my_ladder() #>> '{focus,ladder,furthest}'), 'tables-3-4-8', 'a student reads their own place');
select is((select jsonb_typeof(public.my_ladder() -> 'facts')), 'array', 'with their records');
select is((select jsonb_typeof(public.my_ladder() -> 'settings')), 'object', 'and their class''s question settings');
select pg_temp.as(103);
select is((select public.my_ladder() #>> '{focus,ladder,furthest}'), null, 'another student sees only their own');
select pg_temp.reset();
select is((select public.my_ladder()), null, 'someone not signed in sees nothing');
select pg_temp.as(1);
select is((select public.my_ladder() #>> '{focus,ladder,on}'), 'false', 'a student at another school has their own class settings');
select pg_temp.reset();

-- ---- Moving class keeps the place; leaving the school's data deletes it ----
select pg_temp.as(201);
select public.teacher_remove_from_class(pg_temp.uid(101));
select pg_temp.reset();
select is(pg_temp.ladder(101) ->> 'furthest', 'tables-3-4-8', 'a student who leaves a class keeps their place');
select is(pg_temp.ladder(101) ->> 'on', 'false', 'and then follows the school default');
delete from public.profiles where id = pg_temp.uid(102);
select is((select count(*)::int from public.ladder_placements where student_id = pg_temp.uid(102)), 0, 'a deleted student''s placement goes with them');

select * from finish();
rollback;
