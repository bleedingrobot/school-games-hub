-- Adding new pupils by school email (docs/plans/badge-review/ADD-PUPILS.md): only the server key asks which accounts may be
-- made, and only for a teacher's own school domain; teachers put pupils only in their own classes, never move another
-- class's pupil or touch a teacher; search finds only pupils the teacher may see.
-- Run with: scripts/scratch-test.sh <copy> supabase/tests/database/add_pupils.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select setval(pg_get_serial_sequence('public.schools', 'id'), 1);
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id) values ('otherschool.school.nz', 2);

create function pg_temp.uid(n integer) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;
-- 1, 2 pupils and 11, 12 teachers at Douglas Park; 201 a teacher at another school.
insert into auth.users (id, email) values
  (pg_temp.uid(1), 'ava.k@douglaspark.school.nz'), (pg_temp.uid(2), 'ben.s@douglaspark.school.nz'),
  (pg_temp.uid(11), 't11@douglaspark.school.nz'), (pg_temp.uid(12), 't12@douglaspark.school.nz'),
  (pg_temp.uid(201), 't201@otherschool.school.nz');
update public.profiles set role = 'teacher' where id in (pg_temp.uid(11), pg_temp.uid(12), pg_temp.uid(201));
update public.profiles set school_admin = false where id in (pg_temp.uid(11), pg_temp.uid(12));
delete from public.class_teachers where teacher_id in (pg_temp.uid(11), pg_temp.uid(12));

insert into public.classes (school_id, name, school_year, warp_code, archived) values
  (1, 'Room Five', 2026, 'CDFGH', false), (1, 'Room Six', 2026, 'JKMNP', false);
create temp table rooms as select id, name from public.classes where name in ('Room Five', 'Room Six');
grant select on rooms to public;
insert into public.class_teachers (class_id, teacher_id)
  select id, pg_temp.uid(11) from pg_temp.rooms where name = 'Room Five'
  union all select id, pg_temp.uid(12) from pg_temp.rooms where name = 'Room Six';
-- Ben is already in Room Six.
insert into public.class_members (student_id, class_id) select pg_temp.uid(2), id from pg_temp.rooms where name = 'Room Six'
  on conflict (student_id) do update set class_id = excluded.class_id;

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
create function pg_temp.room(name text) returns uuid language sql as $$ select id from pg_temp.rooms where rooms.name = room.name $$;
create temp table got (email text, outcome text, player uuid, code text, class_name text);
grant all on got to public;

-- Which accounts may be made: the server key only, the teacher's own school domain, no account yet.
set local role service_role;
select is(public.pupils_may_create(pg_temp.uid(11), array['New.Kid@douglaspark.school.nz', 'ava.k@douglaspark.school.nz',
    'kid@gmail.com', 'kid@otherschool.school.nz', 'not an email']),
  array['new.kid@douglaspark.school.nz'], 'a teacher may make an account only for a new email on their school''s domain');
select is(public.pupils_may_create(pg_temp.uid(1), array['new.kid@douglaspark.school.nz']), '{}'::text[], 'a pupil may make none');
select is(public.pupils_may_create(pg_temp.uid(201), array['new.kid@douglaspark.school.nz']), '{}'::text[],
  'nor may another school''s teacher make one on this school''s domain');
select pg_temp.reset();
select pg_temp.as(11);
select throws_ok($$ select public.pupils_may_create(auth.uid(), array['x@douglaspark.school.nz']) $$, '42501', null,
  'a signed-in teacher can''t ask the server-key question directly');
select pg_temp.reset();

-- The server made the new account (as the "pupils" function does).
insert into auth.users (id, email, email_confirmed_at) values (pg_temp.uid(3), 'new.kid@douglaspark.school.nz', now());

select pg_temp.as(11);
insert into pg_temp.got select email, outcome, player, code, class_name from public.teacher_add_pupils_by_email(pg_temp.room('Room Five'),
  array['new.kid@douglaspark.school.nz', 'AVA.K@douglaspark.school.nz', 'ben.s@douglaspark.school.nz', 't12@douglaspark.school.nz',
        'gone@douglaspark.school.nz', 'kid@gmail.com', 'new.kid@douglaspark.school.nz']);
select pg_temp.reset();
select is(array(select email || ' ' || outcome from pg_temp.got),
  array['new.kid@douglaspark.school.nz added', 'ava.k@douglaspark.school.nz added', 'ben.s@douglaspark.school.nz other-class',
        't12@douglaspark.school.nz teacher', 'gone@douglaspark.school.nz no-account', 'kid@gmail.com not-school'],
  'each email says what happened, once each, in the order given');
select is((select count(*)::int from public.class_members where class_id = pg_temp.room('Room Five') and student_id in (pg_temp.uid(1), pg_temp.uid(3))), 2,
  'the new and the class-less pupils are now in the class');
select is((select count(*)::int from pg_temp.got where outcome = 'added' and code ~ '^[0-9a-f]{32}$'), 2, 'with a badge each');
select is(public.current_class_of(pg_temp.uid(2)), pg_temp.room('Room Six'), 'another class''s pupil is left in their class');
select is((select class_name from pg_temp.got where outcome = 'other-class'), 'Room Six', 'and the teacher is told which class');
select is((select role from public.profiles where id = pg_temp.uid(12)), 'teacher', 'and a teacher is left alone');

select pg_temp.as(201);
select throws_ok(format('select * from public.teacher_add_pupils_by_email(%L, array[%L])', pg_temp.room('Room Five'), 'x@otherschool.school.nz'),
  '42501', null, 'another school''s teacher can''t add pupils to the class');
select pg_temp.reset();

-- Search: only pupils the teacher may see.
select pg_temp.as(11);
select is(array(select real_name from public.teacher_find_pupils('new kid')), array['new.kid'], 'a teacher finds their pupil by name, with spaces for dots');
select pg_temp.reset();
select pg_temp.as(12);
select is((select count(*)::int from public.teacher_find_pupils('new')), 0, 'and another class''s teacher doesn''t find them');
select pg_temp.reset();

select * from finish();
rollback;
