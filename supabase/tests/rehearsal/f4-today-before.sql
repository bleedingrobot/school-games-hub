-- Rehearsal for the maths auto migration (F.4): the live site as it is after F.3 (and the moves-left change), before F.4.
-- Run by scripts/f4-rehearsal.sh inside one transaction (nothing is kept), in a scratch database that has every migration
-- up to 20261019000100 and none of F.4's.
begin;
create extension if not exists pgtap with schema extensions;

-- The live site turned the automatic "Everyone" class off (so new students start with no class).
update public.schools set default_class = null where id = 1;

-- Fake accounts as the live school has them: James (school admin), one more teacher, six students.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-0000000000a2', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-0000000000a3', 'cat@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-0000000000a4', 'dan@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-0000000000a5', 'eve@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-0000000000a6', 'fay@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-0000000000b1', 'james@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-0000000000b2', 'ms.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2');
update public.profiles set school_admin = true where id = '00000000-0000-0000-0000-0000000000b1';

-- Teachers made real classes (Room 12 is Year 5, Room 14 has no year level) with a group.
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","email":"ms.teacher@douglaspark.school.nz","role":"authenticated"}', true);
create temp table made (name text primary key, id uuid);
grant all on made to authenticated;
insert into made values ('R12', public.teacher_create_class('Room 12', 2026, 5));
insert into made values ('R14', public.teacher_create_class('Room 14', 2026, null));
select public.teacher_add_to_class((select id from made where name = 'R12'), array['00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3']);
select public.teacher_add_to_class((select id from made where name = 'R14'), array['00000000-0000-0000-0000-0000000000a4'::uuid, '00000000-0000-0000-0000-0000000000a5']);
insert into made values ('Kea', public.teacher_create_group((select id from made where name = 'R12'), 'Kea'));
select public.teacher_set_group_member((select id from made where name = 'Kea'), '00000000-0000-0000-0000-0000000000a1', true);
-- F.3 in use: a class focus on Room 12 (×6 and ×9 until Friday), a group focus on Kea, a student's own pick, and choosing turned off in Room 14.
select public.teacher_set_maths_focus((select id from made where name = 'R12'), 'class', null, array['tables-6-9'], false, 'friday');
select public.teacher_set_maths_focus((select id from made where name = 'R12'), 'group', array[(select id from made where name = 'Kea')], array['facts-10'], true, 'week');
select public.teacher_set_students_choose_focus(false, (select id from made where name = 'R14'));
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
insert into public.student_maths_focus (student_id, skills, only_these) values ('00000000-0000-0000-0000-0000000000a6', array['dbl-half-10'], false);

-- Settings changed from the defaults, per class.
update public.app_settings set multiplayer_enabled = false, space_reactions_enabled = true, gem_keep_mode = 'challenge',
  gem_keep_tables = '{2,5,10}', gem_keep_division = true, gem_keep_multiple_choice = true, gem_keep_key_pass = 9,
  space_maths = 'on', monsters_enabled = true, lord_enabled = true, clans_enabled = true
where class_id = (select id from made where name = 'R12');
update public.app_settings set space_maths = 'off', gem_keep_key_pass = 6 where class_id = (select id from made where name = 'R14');

-- Maths records as the live site has them (times tables, and the other packs a focus uses).
insert into public.gem_keep_facts (player, pack, fact_key, attempts, correct, avg_ms, box, last_seen) values
  ('00000000-0000-0000-0000-0000000000a1', 'times-tables', 'mul:6x7', 4, 4, 2100, 2, now()),
  ('00000000-0000-0000-0000-0000000000a1', 'times-tables', 'mul:2x5', 9, 9, 1400, 4, now()),
  ('00000000-0000-0000-0000-0000000000a1', 'add-sub', 'add:3+4', 5, 4, 2500, 2, now()),
  ('00000000-0000-0000-0000-0000000000a1', 'early-facts', 'bond10:3+7', 5, 5, 1500, 3, now()),
  ('00000000-0000-0000-0000-0000000000a1', 'division', 'div:56/8', 2, 2, 3000, 1, now()),
  ('00000000-0000-0000-0000-0000000000a2', 'times-tables', 'mul:3x4', 2, 1, 4000, 1, now());

-- What things look like before.
create temp table before_facts as select player, pack, fact_key, attempts, correct, box from public.gem_keep_facts;
create temp table before_settings as select * from public.app_settings;
create temp table before_focuses as select id, class_id, scope, student_id, group_id, skills, only_these, starts_at, ends_at, ended_at from public.maths_focuses;
create temp table before_own as select * from public.student_maths_focus;
create temp table before_functions as
select distinct p.proname::text as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute');
create temp table before_json (what text primary key, value jsonb);
grant all on before_json to public;
-- Every student's focus, as the server works it out.
insert into before_json select 'focus-' || n, public.maths_focus_of(('00000000-0000-0000-0000-0000000000a' || n)::uuid) from generate_series(1, 6) n;
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","email":"ms.teacher@douglaspark.school.nz","role":"authenticated"}', true);
insert into before_json values
  ('classes', (select jsonb_agg(to_jsonb(c) order by c.name) from public.teacher_classes() c)),
  ('detail', public.teacher_class_detail((select id from made where name = 'R12'))),
  ('students', (select jsonb_agg(to_jsonb(s) order by s.display_name) from public.teacher_students() s)),
  ('running', public.teacher_maths_focuses());
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"ana@douglaspark.school.nz","role":"authenticated"}', true);
insert into before_json values ('gem', public.my_gem_keep());
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
