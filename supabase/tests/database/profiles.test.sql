-- Checks the school lock, profile privacy and teacher powers.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

-- Test people. Inserting into auth.users runs the same sign-up trigger as real sign-in.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000c';

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.act_as_anon() returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

-- ---- The school lock ----
select ok(public.is_school_email('ana@douglaspark.school.nz'), 'school email accepted');
select ok(public.is_school_email('Ana@DouglasPark.School.NZ'), 'capital letters accepted');
select ok(not public.is_school_email('ana@gmail.com'), 'gmail rejected');
select ok(not public.is_school_email('ana@evil-douglaspark.school.nz'), 'look-alike domain rejected');
select ok(not public.is_school_email('ana@douglaspark.school.nz.evil.com'), 'domain with extra ending rejected');
select ok(not public.is_school_email('ana@sub.douglaspark.school.nz'), 'subdomain rejected');
select ok(not public.is_school_email(null), 'missing email rejected');
select is(public.hook_before_user_created('{"user":{"email":"x@gmail.com"}}')->'error'->>'http_code', '403', 'sign-up hook refuses outsiders');
select is(public.hook_before_user_created('{"user":{"email":"x@douglaspark.school.nz"}}'), '{}'::jsonb, 'sign-up hook lets school accounts in');
select throws_ok(
  $$ insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000ff', 'intruder@gmail.com') $$,
  '42501', null, 'database refuses a non-school account even without the hook');

-- ---- New accounts ----
select is((select count(*)::int from public.profiles), 3, 'each account got a profile');
select ok((select bool_and(display_name ~ '^[A-Z][a-z]+ [A-Z][a-z]+ [0-9]+$') from public.profiles), 'profiles got safe random names');
select is((select role from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'student', 'new accounts are students');

-- ---- Outsiders see nothing ----
select pg_temp.act_as_anon();
select throws_ok('select * from public.profiles', '42501', null, 'signed-out visitors cannot read profiles');
select throws_ok($$ select public.choose_my_name('Brave', 'Otter') $$, '42501', null, 'signed-out visitors cannot call functions');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000ee', 'someone@gmail.com');
select is((select count(*)::int from public.profiles), 0, 'a non-school token sees no profiles');
select is((select count(*)::int from public.name_words), 0, 'a non-school token sees no name words');
select throws_ok($$ select public.choose_my_name('Brave', 'Otter') $$, '42501', null, 'a non-school token cannot change anything');

-- ---- Students ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is((select count(*)::int from public.profiles), 3, 'a student sees the other visible profiles');
select ok((select count(*) from public.name_words) > 50, 'a student can read the name words');
select matches(public.choose_my_name('Brave', 'Otter'), '^Brave Otter [0-9]+$', 'a student can pick a name from the lists');
select is(public.choose_my_name('Brave', 'Otter'), (select display_name from public.profiles where id = auth.uid()), 'picking the same words keeps the same number');
select throws_ok($$ select public.choose_my_name('Poopy', 'Otter') $$, '22023', null, 'words not on the list are refused');
select lives_ok($$ select public.save_my_avatar('{"face":"round","skin":"#f1c7a5"}') $$, 'a student can save an avatar');
select throws_ok($$ select public.save_my_avatar('{"face":"I am Ana from Room 5"}') $$, '22023', null, 'free text in an avatar is refused');
select throws_ok($$ select public.save_my_avatar('"not an object"') $$, '22023', null, 'a broken avatar is refused');

-- Direct table changes are blocked, so students can't edit other people or make themselves teachers.
select throws_ok($$ update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000a' $$, '42501', null, 'a student cannot make themself a teacher');
select throws_ok($$ update public.profiles set display_name = 'Brave Otter 1' where id = '00000000-0000-0000-0000-00000000000b' $$, '42501', null, 'a student cannot edit another profile');
select throws_ok($$ delete from public.profiles where id = '00000000-0000-0000-0000-00000000000b' $$, '42501', null, 'a student cannot delete profiles');
select throws_ok($$ select public.teacher_set_hidden('00000000-0000-0000-0000-00000000000b', true) $$, '42501', null, 'a student cannot use teacher tools');
select throws_ok($$ select public.teacher_delete_student('00000000-0000-0000-0000-00000000000b') $$, '42501', null, 'a student cannot delete a student');
select throws_ok($$ select public.make_first_teacher('ana@douglaspark.school.nz') $$, '42501', null, 'the website cannot call make_first_teacher');

-- ---- Teachers ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'mr.teacher@douglaspark.school.nz');
select lives_ok($$ select public.teacher_set_hidden('00000000-0000-0000-0000-00000000000b', true) $$, 'a teacher can hide a student');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), 0, 'hidden students disappear for other students');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'mr.teacher@douglaspark.school.nz');
select is((select count(*)::int from public.profiles), 3, 'teachers still see hidden students');
select throws_ok($$ select public.teacher_set_role('00000000-0000-0000-0000-00000000000c', 'student') $$, '42501', null, 'a teacher cannot change their own role');
select lives_ok($$ select public.teacher_delete_student('00000000-0000-0000-0000-00000000000b') $$, 'a teacher can delete a student');

select pg_temp.reset();
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-00000000000b'), 0, 'deleting removes the sign-in account and profile');

select * from finish();
rollback;
