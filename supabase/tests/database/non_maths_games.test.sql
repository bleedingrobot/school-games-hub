-- Non-maths games (migration 20261103000200): the per-class switch. It starts on everywhere; a student can't change it; a
-- teacher changes only a class they teach, and only that class.
-- Run on a throw-away copy: scripts/scratch-db.sh nonmaths, then
--   scripts/scratch-test.sh nonmaths supabase/tests/database/non_maths_games.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'fin@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000f';

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || who)::uuid $$;
create function pg_temp.cat() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz') $$;
create function pg_temp.fin() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fin@douglaspark.school.nz') $$;

-- Cat is in Room Two, which Fin teaches (Fin teaches nothing else). Ana stays in the school's Everyone class.
insert into public.classes (school_id, name, school_year, warp_code)
values ((select school_id from public.profiles where id = pg_temp.id('0a')), 'Room Two', 2026, 'CDFGH');
update public.class_members set class_id = (select id from public.classes where name = 'Room Two') where student_id = pg_temp.id('0c');
delete from public.class_teachers where teacher_id = pg_temp.id('0f');
insert into public.class_teachers (class_id, teacher_id) values ((select id from public.classes where name = 'Room Two'), pg_temp.id('0f'));
select public.give_class_settings((select id from public.classes where name = 'Room Two'));
select set_config('test.room_two', (select id::text from public.classes where name = 'Room Two'), true);
select set_config('test.ana_class', (select class_id::text from public.class_members where student_id = pg_temp.id('0a')), true);

select is((select bool_and(non_maths_games) from public.app_settings), true, 'the switch starts on everywhere');

select pg_temp.cat();
select throws_ok(format('select public.teacher_set_non_maths_games(false, %L)', current_setting('test.room_two')),
  null, null, 'a student cannot switch it off');
select is((select non_maths_games from public.app_settings), true, 'a student reads their own class''s switch');
select pg_temp.reset();

select pg_temp.fin();
select throws_ok(format('select public.teacher_set_non_maths_games(null, %L)', current_setting('test.room_two')), '22023', null, 'a missing setting is refused');
select throws_ok(format('select public.teacher_set_non_maths_games(false, %L)', current_setting('test.ana_class')),
  '42501', null, 'a teacher cannot switch it off for a class they don''t teach');
select lives_ok(format('select public.teacher_set_non_maths_games(false, %L)', current_setting('test.room_two')), 'a teacher switches it off for their class');
select pg_temp.reset();
select is((select count(*)::integer from public.app_settings where not non_maths_games), 1, '... and only that class has it off');
select is((select non_maths_games from public.app_settings where class_id = current_setting('test.room_two')::uuid), false, '... Room Two');

select pg_temp.cat();
select is((select non_maths_games from public.app_settings), false, 'a student in that class sees it off');
select pg_temp.reset();

select * from finish();
rollback;
