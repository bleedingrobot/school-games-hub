-- teacher_set_games (migration 20261112000300): a teacher sets many game switches for a class they teach in one request.
-- Refuses an unknown column, a value that isn't true/false, a student, and a class the teacher doesn't teach.
-- Run on a throw-away copy: scripts/scratch-db.sh games, then
--   scripts/scratch-test.sh games supabase/tests/database/teacher_set_games.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

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

-- Cat is in Room Two, which Fin teaches (Fin teaches nothing else). Ana stays in the school's Everyone class, which Fin does not teach.
insert into public.classes (school_id, name, school_year, warp_code)
values ((select school_id from public.profiles where id = pg_temp.id('0a')), 'Room Two', 2026, 'CDFGH');
update public.class_members set class_id = (select id from public.classes where name = 'Room Two') where student_id = pg_temp.id('0c');
delete from public.class_teachers where teacher_id = pg_temp.id('0f');
insert into public.class_teachers (class_id, teacher_id) values ((select id from public.classes where name = 'Room Two'), pg_temp.id('0f'));
select public.give_class_settings((select id from public.classes where name = 'Room Two'));
select set_config('test.room_two', (select id::text from public.classes where name = 'Room Two'), true);
select set_config('test.ana_class', (select class_id::text from public.class_members where student_id = pg_temp.id('0a')), true);

select pg_temp.cat();
select throws_ok(format('select public.teacher_set_games(%L, %L)', '{"monsters_enabled": true}', current_setting('test.room_two')),
  null, null, 'a student cannot use it');
select pg_temp.reset();

select pg_temp.fin();
select throws_ok(format('select public.teacher_set_games(%L, %L)', '{"monsters_enabled": true, "id": true}', current_setting('test.room_two')),
  '22023', null, 'an unknown column is refused');
select throws_ok(format('select public.teacher_set_games(%L, %L)', '{"trader_jumps": true}', current_setting('test.room_two')),
  '22023', null, '... even when it is a real setting that is not a game switch');
select throws_ok(format('select public.teacher_set_games(%L, %L)', '{"monsters_enabled": "yes"}', current_setting('test.room_two')),
  '22023', null, 'a value that is not true or false is refused');
select throws_ok(format('select public.teacher_set_games(%L, %L)', '{"monsters_enabled": true}', current_setting('test.ana_class')),
  '42501', null, 'a teacher cannot change a class they don''t teach');
select pg_temp.reset();
select is((select monsters_enabled from public.app_settings where class_id = current_setting('test.room_two')::uuid), false,
  '... and nothing was changed by the refusals');

select pg_temp.fin();
select lives_ok(format('select public.teacher_set_games(%L, %L)',
  '{"monsters_enabled": true, "clans_enabled": true, "non_maths_games": false, "trader_enabled": true}', current_setting('test.room_two')),
  'a teacher sets several switches for their class in one request');
select pg_temp.reset();
select is((select row(monsters_enabled, clans_enabled, non_maths_games, trader_enabled)::text from public.app_settings
           where class_id = current_setting('test.room_two')::uuid), '(t,t,f,t)', '... all of them changed');
select is((select count(*)::integer from public.app_settings where class_id = current_setting('test.ana_class')::uuid and monsters_enabled), 0,
  '... and only in that class');

select pg_temp.fin();
select lives_ok(format('select public.teacher_set_games(%L, %L)', '{"monsters_enabled": false, "clans_enabled": false}', current_setting('test.room_two')),
  'and off again');
select pg_temp.reset();

select * from finish();
rollback;
