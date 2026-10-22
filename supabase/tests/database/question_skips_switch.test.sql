-- Question skips S.3 (migration 20261022001100): the per-class "Skip button" switch, app_settings.question_skips, and
-- teacher_set_question_skips(). It starts 'on' everywhere; only teachers change it, only for classes they teach; a student
-- can read their own class's setting.
-- Run on a throw-away copy: scripts/scratch-db.sh skips, then
--   scripts/scratch-test.sh skips supabase/tests/database/question_skips_switch.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

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
create function pg_temp.ana() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz') $$;
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

-- ---- It starts on everywhere ----
select is((select count(*)::integer from public.app_settings where question_skips <> 'on'), 0, 'the switch starts on everywhere');
select throws_ok($$ update public.app_settings set question_skips = 'sometimes' $$, '23514', null, 'only on, limited and off can be stored');

-- ---- Who may change it ----
select pg_temp.cat();
select throws_ok($$ select public.teacher_set_question_skips('off') $$, null, null, 'a student cannot change it');
select throws_ok($$ update public.app_settings set question_skips = 'on' $$, '42501', null, '... nor write the settings row');
select pg_temp.reset();
set local role anon;
select throws_ok($$ select public.teacher_set_question_skips('off') $$, '42501', null, 'signed-out visitors cannot call it');
select pg_temp.reset();

select pg_temp.fin();
select throws_ok($$ select public.teacher_set_question_skips(null) $$, '22023', null, 'a missing setting is refused');
select throws_ok($$ select public.teacher_set_question_skips('sometimes') $$, '22023', null, 'an unknown setting is refused');
select throws_ok(format('select public.teacher_set_question_skips(''off'', %L)', current_setting('test.ana_class')),
  '42501', null, 'a teacher cannot change a class they don''t teach');
select lives_ok(format('select public.teacher_set_question_skips(''limited'', %L)', current_setting('test.room_two')), 'a teacher sets 3 per game for their class');
select is(public.teacher_class_settings(current_setting('test.room_two')::uuid) ->> 'question_skips', 'limited', '... and the class picker reads it back');
select pg_temp.reset();
select is((select question_skips from public.app_settings where class_id = current_setting('test.room_two')::uuid), 'limited', '... Room Two is limited');
select is((select count(*)::integer from public.app_settings where question_skips <> 'on'), 1, '... and no other class changed');

-- ---- Students read their own class's setting ----
select pg_temp.cat();
select is((select question_skips from public.app_settings), 'limited', 'a student in Room Two reads limited');
select pg_temp.ana();
select is((select question_skips from public.app_settings), 'on', 'a student in another class reads on');
select pg_temp.reset();

select * from finish();
rollback;
