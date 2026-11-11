-- Teacher controls C2 (migration 20261112000200): a settings save must name a class.
-- Run on a throw-away copy: scripts/scratch-db.sh need_class, then
--   scripts/scratch-test.sh need_class supabase/tests/database/settings_need_a_class.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'fin@douglaspark.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000e';
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000f';

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.eve() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz') $$;
create function pg_temp.fin() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fin@douglaspark.school.nz') $$;

-- Fin teaches Room Two; nobody but the school admin teaches Room Three.
insert into public.classes (school_id, name, school_year, warp_code) values
  (1, 'Room Two', 2026, 'CDFGH'),
  (1, 'Room Three', 2026, 'JKMNP');
insert into public.class_teachers (class_id, teacher_id)
select id, '00000000-0000-0000-0000-00000000000f' from public.classes where name = 'Room Two';
select set_config('test.two', (select id::text from public.classes where name = 'Room Two'), true);
select set_config('test.three', (select id::text from public.classes where name = 'Room Three'), true);

-- Start with Pipi on everywhere so a change shows.
update public.app_settings set pipi_enabled = true;

-- A teacher with no class named: refused, and nothing changes.
select pg_temp.fin();
select throws_ok($$ select public.teacher_set_pipi(false, null, null) $$, '22023', 'Pick a class first.', 'a teacher save with no class is refused');
select pg_temp.reset();
select is((select count(*) from public.app_settings where pipi_enabled), (select count(*) from public.app_settings), '... and no row changed');

-- A school admin with no class named: refused too (the school defaults row is not reachable this way).
select pg_temp.eve();
select throws_ok($$ select public.teacher_set_pipi(false, null, null) $$, '22023', 'Pick a class first.', 'a school admin save with no class is refused');
select pg_temp.reset();
select is((select count(*) from public.app_settings where pipi_enabled), (select count(*) from public.app_settings), '... and no row changed');

-- With their own class it works, for that class only.
select pg_temp.fin();
select lives_ok(format($$ select public.teacher_set_pipi(false, null, %L::uuid) $$, current_setting('test.two')), 'a teacher can save for their own class');
select pg_temp.reset();
select is((select array_agg(class_id) from public.app_settings where not pipi_enabled), array[current_setting('test.two')::uuid], '... and only that class changed');

-- With a class they don't teach: refused.
select pg_temp.fin();
select throws_ok(format($$ select public.teacher_set_pipi(false, null, %L::uuid) $$, current_setting('test.three')), '42501', null, 'a teacher cannot save for a class they don''t teach');

select * from finish();
rollback;
