-- QR sign-in badges (docs/BADGE-SIGN-IN-PLAN.md): only a pupil's own teachers can read or renew their badge, nobody reads the
-- table, only the server key can turn a code into a sign-in, a renewed card stops working, and badges never sign in teachers.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select setval(pg_get_serial_sequence('public.schools', 'id'), 1);
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id) values ('otherschool.school.nz', 2);

create function pg_temp.uid(n integer) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;
-- 1, 2 students and 11 a teacher at Douglas Park (all in its "Everyone" class); 201 a teacher at another school.
insert into auth.users (id, email) values
  (pg_temp.uid(1), 'ava.k@douglaspark.school.nz'), (pg_temp.uid(2), 's2@douglaspark.school.nz'),
  (pg_temp.uid(11), 't11@douglaspark.school.nz'), (pg_temp.uid(201), 't201@otherschool.school.nz');
update public.profiles set role = 'teacher' where id in (pg_temp.uid(11), pg_temp.uid(201));

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
create temp table everyone as select id from public.classes where school_id = 1 and name = 'Everyone';
grant select on everyone to public;
create temp table seen (n integer, player uuid, code text);
grant all on seen to public;

select pg_temp.as(11);
insert into pg_temp.seen select 1, player, code from public.teacher_class_badges((select id from pg_temp.everyone));
select is((select count(*)::int from pg_temp.seen where n = 1 and code ~ '^[0-9a-f]{32}$'), 2, 'the teacher gets a badge for each pupil in the class, not themselves');
insert into pg_temp.seen select 2, player, code from public.teacher_class_badges((select id from pg_temp.everyone));
select is((select count(*)::int from pg_temp.seen a join pg_temp.seen b on a.player = b.player and a.code = b.code and b.n = 2 where a.n = 1), 2,
  'printing again gives the same cards');
select throws_ok(format('select public.teacher_renew_badge(%L)', pg_temp.uid(11)), '42501', null, 'a teacher can''t get a badge for a teacher');

select pg_temp.as(201);
select throws_ok(format('select * from public.teacher_class_badges(%L)', (select id from pg_temp.everyone)), '42501', null,
  'another school''s teacher can''t read the class''s badges');
select throws_ok(format('select public.teacher_renew_badge(%L)', pg_temp.uid(1)), '42501', null, 'nor renew one');

select pg_temp.as(1);
select throws_ok($$ select * from public.pupil_badges $$, '42501', null, 'a pupil can''t read the badges table');
select throws_ok(format('select * from public.teacher_class_badges(%L)', (select id from pg_temp.everyone)), '42501', null,
  'nor the class''s badges');
select throws_ok($$ select public.badge_sign_in('0123456789abcdef0123456789abcdef') $$, '42501', null, 'nor turn a code into a sign-in');
select pg_temp.reset();
set local role anon;
select throws_ok($$ select public.badge_sign_in('0123456789abcdef0123456789abcdef') $$, '42501', null, 'nor can anyone signed out');
select pg_temp.reset();

set local role service_role;
select is(public.badge_sign_in((select code from pg_temp.seen where n = 1 and player = pg_temp.uid(1))), 'ava.k@douglaspark.school.nz',
  'the server key turns a pupil''s code into their email');
select is(public.badge_sign_in('ffffffffffffffffffffffffffffffff'), null, 'and a wrong code into nothing');
select pg_temp.reset();

select pg_temp.as(11);
select isnt(public.teacher_renew_badge(pg_temp.uid(1)), (select code from pg_temp.seen where n = 1 and player = pg_temp.uid(1)),
  'a lost card gets a new code');
select pg_temp.reset();
set local role service_role;
select is(public.badge_sign_in((select code from pg_temp.seen where n = 1 and player = pg_temp.uid(1))), null, 'and the old card stops working');
select pg_temp.reset();

select * from finish();
rollback;
