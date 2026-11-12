-- Each pupil's year (migration 20261113000200_pupil_years.sql): the pupil says it once, a teacher changes it, it goes up
-- by itself each new year, classmates and other teachers can't see or change it.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'ms.other@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id in ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000000f');
update public.schools set default_class = null;
delete from public.class_members;
delete from public.class_teachers;

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000000' || who)::uuid $$;
create function pg_temp.ana() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz') $$;
create function pg_temp.ben() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz') $$;
create function pg_temp.teacher() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz') $$;
create function pg_temp.other() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'ms.other@douglaspark.school.nz') $$;

-- Ana and Ben are in Mr Teacher's class. Ms Other teaches a different class.
select pg_temp.teacher();
create temp table made as select public.teacher_create_class('Room 12', 2026, null) as id;
grant all on made to authenticated;
select public.teacher_add_to_class((select id from made), array[pg_temp.id('a'), pg_temp.id('b')]);
select pg_temp.other();
select public.teacher_create_class('Room 9', 2026, null);

-- ---- The pupil says it once ----
select pg_temp.ana();
select is(public.my_year(), '{"student": true, "year": null}'::jsonb, 'a new pupil has no year yet');
select throws_ok($$ select public.set_my_year(9) $$, '22023', 'Pick a year from 1 to 8.', 'a pupil picks 1 to 8 only');
select throws_ok($$ select public.set_my_year(null) $$, '22023', 'Pick a year from 1 to 8.', 'and not nothing');
select is(public.set_my_year(4), 4, 'the pupil picks Year 4');
select is(public.my_year(), '{"student": true, "year": 4}'::jsonb, 'and it is saved');
select throws_ok($$ select public.set_my_year(5) $$, '22023', 'Your year is saved. Your teacher can change it.', 'the pupil can''t change it again');
select throws_ok($$ select * from public.pupil_years $$, '42501', null, 'pupils can''t read the table');
select throws_ok($$ select public.year_level_of(pg_temp.id('b')) $$, '42501', null, 'or call the inside function for a classmate');
select throws_ok($$ select public.teacher_student_years((select id from made)) $$, '42501', null, 'or the teacher list');
select throws_ok($$ select public.teacher_set_student_year(pg_temp.id('b'), 3) $$, '42501', null, 'or set a classmate''s year');
select throws_ok($$ select public.class_years() $$, '42501', null, 'or see class years');

select pg_temp.teacher();
select throws_ok($$ select public.set_my_year(4) $$, '42501', 'Only students pick a year.', 'teachers aren''t asked');
select is(public.my_year() ->> 'student', 'false', 'and my_year says so');

-- ---- The teacher sees and changes it ----
select is(public.teacher_student_years((select id from made)), '{"00000000-0000-0000-0000-00000000000a": {"year": 4, "by": "pupil"}}'::jsonb,
  'the teacher sees Ana''s year, and Ben is left out');
select public.teacher_set_student_year(pg_temp.id('a'), 5);
select public.teacher_set_student_year(pg_temp.id('b'), 6);
select is(public.teacher_student_years((select id from made)) -> '00000000-0000-0000-0000-00000000000a', '{"year": 5, "by": "teacher"}'::jsonb, 'the teacher changes Ana to Year 5');
select is(public.class_years() -> ((select id from made)::text), '{"low": 5, "high": 6, "unknown": 0}'::jsonb, 'the class list shows Years 5 to 6');
select throws_ok($$ select public.teacher_set_student_year(pg_temp.id('a'), 14) $$, '22023', 'Pick a year from 0 to 13.', 'only real years');
select public.teacher_set_student_year(pg_temp.id('b'), null);
select is(public.class_years() -> ((select id from made)::text) ->> 'unknown', '1', 'clearing Ben''s year means he is asked again');

select pg_temp.other();
select throws_ok($$ select public.teacher_set_student_year(pg_temp.id('a'), 2) $$, '42501', null, 'another teacher can''t change Ana');
select throws_ok($$ select public.teacher_student_years((select id from made)) $$, '42501', null, 'or see the class''s years');
select is(public.class_years() ? ((select id from made)::text), false, 'and the class isn''t in their list');

-- ---- A new year moves everyone up ----
select pg_temp.reset();
update public.pupil_years set school_year = school_year - 1 where student_id = pg_temp.id('a');
select is(public.year_level_of(pg_temp.id('a')), 6, 'a year later Ana is in Year 6');

select * from finish();
rollback;
