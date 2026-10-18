-- Rehearsal for the maths focus migration (F.3): the live site as it is after F.2, before the F.3 migration.
-- Run by scripts/f3-rehearsal.sh inside one transaction (nothing is kept), in a scratch database that has every migration
-- up to F.2's last (20261018002600) and none of F.3's.
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

-- Teachers made real classes with groups.
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","email":"ms.teacher@douglaspark.school.nz","role":"authenticated"}', true);
create temp table made (name text primary key, id uuid);
grant all on made to authenticated;
insert into made values ('R12', public.teacher_create_class('Room 12', 2026, 5));
insert into made values ('R14', public.teacher_create_class('Room 14', 2026, 6));
select public.teacher_add_to_class((select id from made where name = 'R12'), array['00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3']);
select public.teacher_add_to_class((select id from made where name = 'R14'), array['00000000-0000-0000-0000-0000000000a4'::uuid, '00000000-0000-0000-0000-0000000000a5']);
insert into made values ('Kea', public.teacher_create_group((select id from made where name = 'R12'), 'Kea'));
select public.teacher_set_group_member((select id from made where name = 'Kea'), '00000000-0000-0000-0000-0000000000a1', true);
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);

-- Settings changed from the defaults, per class.
update public.app_settings set multiplayer_enabled = false, space_reactions_enabled = true, gem_keep_mode = 'challenge',
  gem_keep_tables = '{2,5,10}', gem_keep_division = true, gem_keep_multiple_choice = true, gem_keep_key_pass = 9,
  space_maths = 'on', monsters_enabled = true, monsters_topics = '{add-sub,fractions}', lord_enabled = true, lord_forest_per_day = 7,
  clans_enabled = true, clan_raids_enabled = true, clans_year_band = 6, clans_fights_per_day = 5
where class_id = (select id from made where name = 'R12');
update public.app_settings set space_maths = 'off', gem_keep_key_pass = 6 where class_id = (select id from made where name = 'R14');

-- Maths records as the live site has them (times tables, and the other packs Maths Monsters and Dragon Maths keep).
insert into public.gem_keep_facts (player, pack, fact_key, attempts, correct, avg_ms, box, last_seen) values
  ('00000000-0000-0000-0000-0000000000a1', 'times-tables', 'mul:6x7', 4, 4, 2100, 2, now()),
  ('00000000-0000-0000-0000-0000000000a1', 'times-tables', 'mul:2x5', 9, 9, 1400, 4, now()),
  ('00000000-0000-0000-0000-0000000000a1', 'add-sub', 'add:3+4', 5, 4, 2500, 2, now()),
  ('00000000-0000-0000-0000-0000000000a1', 'division', 'div:56/8', 2, 2, 3000, 1, now()),
  ('00000000-0000-0000-0000-0000000000a1', 'fractions', 'frac:half-of', 3, 3, 4000, 2, now()),
  ('00000000-0000-0000-0000-0000000000a1', 'money', 'money:change', 3, 2, 5000, 1, now()),
  ('00000000-0000-0000-0000-0000000000a2', 'times-tables', 'mul:3x4', 2, 1, 4000, 1, now());
insert into public.gem_keep_progress (player, level_id, best_stars, plays, wins) values ('00000000-0000-0000-0000-0000000000a1', 'meadow-1', 3, 2, 2);

-- What things look like before.
create temp table before_facts as select player, pack, fact_key, attempts, correct, box from public.gem_keep_facts;
create temp table before_settings as select * from public.app_settings;
create temp table before_functions as
select distinct p.proname::text as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute');
create temp table before_json (what text primary key, value jsonb);
grant all on before_json to public;
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","email":"ms.teacher@douglaspark.school.nz","role":"authenticated"}', true);
insert into before_json values
  ('classes', (select jsonb_agg(to_jsonb(c) order by c.name) from public.teacher_classes() c)),
  ('detail', public.teacher_class_detail((select id from made where name = 'R12'))),
  ('students', (select jsonb_agg(to_jsonb(s) order by s.display_name) from public.teacher_students() s));
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"ana@douglaspark.school.nz","role":"authenticated"}', true);
insert into before_json values ('gem', public.my_gem_keep());
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
