-- Teacher controls C6 (migration 20261112000400): who changed a setting, and when.
-- Run on a throw-away copy: scripts/scratch-db.sh changes, then
--   scripts/scratch-test.sh changes supabase/tests/database/settings_changes.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'tane@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-0000000000b1', 'bree@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1');

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.tane() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1', 'tane@douglaspark.school.nz') $$;
create function pg_temp.bree() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1', 'bree@douglaspark.school.nz') $$;

insert into public.classes (school_id, name, school_year, warp_code) values
  (1, 'Room A', 2026, 'CDFGH'),
  (1, 'Room B', 2026, 'JKMNP');
select public.give_class_settings(id) from public.classes where name in ('Room A', 'Room B');
insert into public.class_teachers (class_id, teacher_id)
select id, case name when 'Room A' then '00000000-0000-0000-0000-0000000000a1'::uuid else '00000000-0000-0000-0000-0000000000b1'::uuid end
from public.classes where name in ('Room A', 'Room B');
select set_config('test.a', (select id::text from public.classes where name = 'Room A'), true);
select set_config('test.b', (select id::text from public.classes where name = 'Room B'), true);

update public.app_settings set pipi_enabled = true, pipi_help = false, non_maths_games = true;
delete from public.settings_changes;   -- this test's own set-up is not what is being checked

-- Tane turns Pipi off for Room A: one row, in his name.
select pg_temp.tane();
select public.teacher_set_pipi(false, null, current_setting('test.a')::uuid);
select pg_temp.reset();
select is((select count(*) from public.settings_changes where class_id = current_setting('test.a')::uuid), 1::bigint, 'one saved column logs one row');
select is((select setting || ':' || old_value || '>' || new_value from public.settings_changes where class_id = current_setting('test.a')::uuid),
  'pipi_enabled:true>false', '... saying which setting and from what to what');
select is((select changed_by from public.settings_changes where class_id = current_setting('test.a')::uuid),
  '00000000-0000-0000-0000-0000000000a1'::uuid, '... and who');

-- Two columns in one save: two rows. A save that changes nothing: none.
select pg_temp.tane();
select public.teacher_set_pipi(true, true, current_setting('test.a')::uuid);
select pg_temp.reset();
select ok((select count(*) from public.settings_changes where class_id = current_setting('test.a')::uuid) >= 3, 'a save that changes more than one column logs each');
select pg_temp.tane();
select public.teacher_set_non_maths_games(true, current_setting('test.a')::uuid);
select pg_temp.reset();
select is((select count(*) from public.settings_changes where setting = 'non_maths_games'), 0::bigint, 'a save that changes nothing logs nothing');

-- The other class was not touched.
select is((select count(*) from public.settings_changes where class_id = current_setting('test.b')::uuid), 0::bigint, 'the other class has no changes');

-- Tane reads his class through the function, with his name; Bree cannot read it either way.
select pg_temp.tane();
select ok(jsonb_array_length(public.teacher_settings_changes(current_setting('test.a')::uuid)) >= 2, 'the teacher sees the changes for their class');
select is((public.teacher_settings_changes(current_setting('test.a')::uuid, 20, true) -> 0 ->> 'realName'), 'tane', '... with the real name');
select is((select count(*) from public.settings_changes where class_id = current_setting('test.a')::uuid) > 0, true, '... and can read the table directly');
select pg_temp.bree();
select throws_ok(format($$ select public.teacher_settings_changes(%L::uuid) $$, current_setting('test.a')), '42501', null, 'a teacher of another class is refused the function');
select is((select count(*) from public.settings_changes where class_id = current_setting('test.a')::uuid), 0::bigint, '... and sees no rows in the table');

select * from finish();
rollback;
