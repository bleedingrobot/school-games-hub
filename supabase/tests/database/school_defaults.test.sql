-- Teacher controls C7 (migration 20261112000500): the school's defaults row and the new-game rule.
-- Run on a throw-away copy: scripts/scratch-db.sh defaults, then
--   scripts/scratch-test.sh defaults supabase/tests/database/school_defaults.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

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

insert into public.classes (school_id, name, school_year, warp_code) values
  (1, 'Room Two', 2026, 'CDFGH'),
  (1, 'Room Three', 2026, 'JKMNP');
select public.give_class_settings(id) from public.classes;
update public.classes set archived = true where name = 'Room Three';

-- The new-game rule: every game's switch column starts on.
select is_empty($$
  select g.id from public.hub_games g
  join information_schema.columns c on c.table_schema = 'public' and c.table_name = 'app_settings' and c.column_name = g.switch_column
  where g.switch_column is not null and coalesce(c.column_default, 'false') is distinct from 'true'
$$, 'every hub_games switch column defaults to true');

-- A teacher who is not an admin cannot read or change the defaults.
select pg_temp.fin();
select throws_ok($$ select public.admin_set_school_default('{"pipi_enabled": false}') $$, '42501', null, 'a non-admin cannot set a school default');
select throws_ok($$ select public.admin_copy_defaults_to_classes(array['pipi_enabled']) $$, '42501', null, 'a non-admin cannot copy the defaults');
select pg_temp.reset();

-- An admin changes only the defaults row.
select pg_temp.eve();
select public.admin_set_school_default('{"pipi_enabled": false, "question_skips": "off"}');
select throws_ok($$ select public.admin_set_school_default('{"pipi_enabled": 1}') $$, '22023', null, 'a wrong kind of value is refused');
select throws_ok($$ select public.admin_set_school_default('{"school_id": 2}') $$, '22023', null, 'a column that is not a setting is refused');
select is((select public.admin_school_defaults() ->> 'pipi_enabled'), 'false', 'the admin reads the changed default');
select pg_temp.reset();
select is((select count(*)::int from public.app_settings where class_id is not null and pipi_enabled = false), 0, 'no class changed');

-- A class made afterwards copies it.
insert into public.classes (school_id, name, school_year, warp_code) values (1, 'Room Four', 2026, 'QRSTV');
select public.give_class_settings(id) from public.classes where name = 'Room Four';
select is((select s.pipi_enabled::text || s.question_skips from public.app_settings s join public.classes c on c.id = s.class_id where c.name = 'Room Four'),
  'falseoff', 'a new class starts like the defaults');

-- Copy to every class: not archived ones; one log row.
select set_config('test.live', (select count(*) from public.app_settings s join public.classes c on c.id = s.class_id where not c.archived)::text, true);
select pg_temp.eve();
select is(public.admin_copy_defaults_to_classes(array['pipi_enabled'])::text, current_setting('test.live'), 'the copy reports every class that is not archived');
select pg_temp.reset();
select is((select count(*) from public.app_settings s join public.classes c on c.id = s.class_id where not s.pipi_enabled and not c.archived)::text
  || ':' || (select count(*) from public.app_settings s join public.classes c on c.id = s.class_id where s.pipi_enabled and c.archived)::text
  || ':' || (select count(*) from public.admin_log where action = 'school_defaults')::text,
  current_setting('test.live') || ':1:1', 'those classes changed, the archived one did not, and one log row');

select * from finish();
rollback;
