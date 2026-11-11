-- Game sets (migration 20261112000600): a teacher saves, lists, uses and deletes sets for a class they teach, and no one else can.
-- Run on a throw-away copy: scripts/scratch-db.sh games, then
--   scripts/scratch-test.sh games supabase/tests/database/game_sets.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'fin@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-000000000010', 'gus@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id in ('00000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-000000000010');

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.fin() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fin@douglaspark.school.nz') $$;
create function pg_temp.gus() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-000000000010', 'gus@douglaspark.school.nz') $$;
create function pg_temp.cat() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz') $$;

-- Fin teaches Room Two. Gus teaches Room Three (and nothing else). Cat is a student.
insert into public.classes (school_id, name, school_year, warp_code)
values ((select school_id from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'Room Two', 2026, 'CDFGH'),
       ((select school_id from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'Room Three', 2026, 'CDFGJ');
delete from public.class_teachers where teacher_id in ('00000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-000000000010');
insert into public.class_teachers (class_id, teacher_id) values
  ((select id from public.classes where name = 'Room Two'), '00000000-0000-0000-0000-00000000000f'),
  ((select id from public.classes where name = 'Room Three'), '00000000-0000-0000-0000-000000000010');
select public.give_class_settings((select id from public.classes where name = 'Room Two'));
select public.give_class_settings((select id from public.classes where name = 'Room Three'));
select set_config('test.two', (select id::text from public.classes where name = 'Room Two'), true);
select set_config('test.three', (select id::text from public.classes where name = 'Room Three'), true);

select pg_temp.fin();
select set_config('test.set', public.teacher_save_game_set(current_setting('test.two')::uuid, '  Maths only ',
  '{"monsters_enabled": true, "clans_enabled": true, "non_maths_games": false}'::jsonb)::text, true);
select is((select public.teacher_game_sets(current_setting('test.two')::uuid) -> 0 ->> 'name'), 'Maths only', 'a teacher saves a set (name trimmed) and reads it back');
select throws_ok(format('select public.teacher_save_game_set(%L, %L, %L)', current_setting('test.two'), '', '{}'), '22023', null, 'an empty name is refused');
select throws_ok(format('select public.teacher_save_game_set(%L, %L, %L)', current_setting('test.two'), 'Bad', '{"monsters_enabled": "yes"}'), '22023', null, 'a non true/false value is refused');
select throws_ok(format('select public.teacher_save_game_set(%L, %L, %L)', current_setting('test.three'), 'Mine now', '{}'), '42501', null, 'a teacher cannot save a set for a class they don''t teach');
select throws_ok(format('select public.teacher_game_sets(%L)', current_setting('test.three')), '42501', null, '... or list that class''s sets');
select lives_ok(format('select public.teacher_use_game_set(%L)', current_setting('test.set')), 'the teacher uses the set');
select pg_temp.reset();
select is((select row(monsters_enabled, clans_enabled, non_maths_games)::text from public.app_settings where class_id = current_setting('test.two')::uuid),
  '(t,t,f)', '... and the class''s switches change');

select pg_temp.gus();
select throws_ok(format('select public.teacher_use_game_set(%L)', current_setting('test.set')), '42501', null, 'another teacher cannot use the set');
select throws_ok(format('select public.teacher_delete_game_set(%L)', current_setting('test.set')), '42501', null, '... or delete it');
select pg_temp.cat();
select throws_ok(format('select public.teacher_use_game_set(%L)', current_setting('test.set')), null, null, 'a student cannot use it');
select pg_temp.reset();

select pg_temp.fin();
select public.teacher_delete_game_set(current_setting('test.set')::uuid);
select pg_temp.reset();
select is((select count(*)::integer from public.class_game_sets), 0, 'the owning teacher deletes the set');

select * from finish();
rollback;
