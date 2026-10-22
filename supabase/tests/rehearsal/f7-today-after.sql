-- Rehearsal for the teacher views migration (F.7): the checks after the migration ran on the live site's data.
select plan(41);

-- What the map should carry, worked out straight from the table (as the database owner) before anyone signs in.
create temp table expected as select count(*)::int as r12_facts from public.gem_keep_facts g
  where g.player in (select student_id from public.class_members where class_id = (select id from made where name = 'R12'))
    and g.pack in ('times-tables', 'early-facts', 'add-sub', 'division', 'generated');
grant select on expected to public;

-- Nothing lost, nothing changed: F.7 adds functions and touches no table.
select is((select count(*)::int from public.gem_keep_facts), (select count(*)::int from before_facts), 'every maths record is still there');
select is((select count(*)::int from public.gem_keep_facts g join before_facts b using (player, pack, fact_key) where g.attempts = b.attempts and g.correct = b.correct and g.box = b.box),
  (select count(*)::int from before_facts), 'with the same numbers');
select is((select count(*)::int from public.maths_focuses m join before_focuses b using (id) where m.skills = b.skills and m.only_these = b.only_these and m.ends_at = b.ends_at and m.ended_at is not distinct from b.ended_at and m.class_id = b.class_id),
  (select count(*)::int from before_focuses), 'every teacher focus (running or ended) is exactly as it was');
select is((select count(*)::int from public.student_maths_focus s join before_own b using (student_id) where s.skills = b.skills), (select count(*)::int from before_own), 'and so is the student''s own pick');
select is((select count(*)::int from public.ladder_places p join before_places b using (student_id) where p.skill = b.skill and p.rank = b.rank), (select count(*)::int from before_places), 'every furthest place is as it was');
select is((select count(*)::int from public.ladder_placements p join before_placements b using (student_id) where p.skill is not distinct from b.skill and p.skipped = b.skipped), (select count(*)::int from before_placements), 'and every placement');
select is((select count(*)::int from public.app_settings a join before_settings b using (id) where to_jsonb(a) = to_jsonb(b)), (select count(*)::int from before_settings), 'every setting is exactly what it was');
select is((select jsonb_object_agg(t, n) from (select 'maths_focuses' as t, count(*) as n from public.maths_focuses union all select 'gem_keep_facts', count(*) from public.gem_keep_facts union all select 'profiles', count(*) from public.profiles union all select 'class_members', count(*) from public.class_members union all select 'ladder_places', count(*) from public.ladder_places union all select 'ladder_placements', count(*) from public.ladder_placements union all select 'classes', count(*) from public.classes) x),
  (select jsonb_object_agg(t, n) from before_counts), 'the number of rows in every table the maths uses is the same');
select is((select count(*)::int from generate_series(1, 6) n where public.maths_focus_of(('00000000-0000-0000-0000-0000000000a' || n)::uuid) = (select value from before_json where what = 'focus-' || n)), 6, 'every student''s focus is exactly what it was');

-- Teachers: the same lists as before.
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","email":"ms.teacher@douglaspark.school.nz","role":"authenticated"}', true);
select is((select jsonb_agg(to_jsonb(c) order by c.name) from public.teacher_classes() c), (select value from before_json where what = 'classes'), 'a teacher''s class list is the same');
select is((select jsonb_agg(to_jsonb(s) order by s.display_name) from public.teacher_students() s), (select value from before_json where what = 'students'), 'and their students');
select is(public.teacher_class_detail((select id from made where name = 'R12')), (select value from before_json where what = 'detail'), 'and a class page');
select is(public.teacher_maths_focuses(), (select value from before_json where what = 'running'), 'and the running focuses');

-- The skill map on today's data.
select is(jsonb_array_length(public.teacher_class_skill_map((select id from made where name = 'R12')) -> 'students'), 3, 'Room 12''s map has its three students');
select is(jsonb_array_length(public.teacher_class_skill_map((select id from made where name = 'R14')) -> 'students'), 2, 'Room 14''s has its two');
select is((select count(*)::int from jsonb_array_elements(public.teacher_class_skill_map((select id from made where name = 'R12')) -> 'students') s where s ->> 'id' in ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a6')), 0, 'and nobody from another class or with no class');
select is((select count(*)::int from jsonb_array_elements(public.teacher_class_skill_map((select id from made where name = 'R12')) -> 'students') s, jsonb_array_elements(s -> 'facts') f),
  (select r12_facts from expected),
  'it carries exactly the ladder records of those students');
select is((select count(*)::int from jsonb_array_elements(public.teacher_class_skill_map((select id from made where name = 'R12')) -> 'students') s, jsonb_array_elements(s -> 'facts') f where f ->> 'key' like 'pv:%'), 0, 'and never Maths Monsters'' own');
select is(public.teacher_class_skill_map((select id from made where name = 'R12')) #>> '{class,auto}', 'false', 'Room 12 has auto off');
select is(public.teacher_class_skill_map((select id from made where name = 'R14')) #>> '{class,auto}', 'true', 'Room 14 has it on');
select is((select s #>> '{ladder,furthest}' from jsonb_array_elements(public.teacher_class_skill_map((select id from made where name = 'R14')) -> 'students') s where s ->> 'id' = '00000000-0000-0000-0000-0000000000a4'), 'tables-3-4-8', 'a student''s furthest place shows on the map');
select is((select s #>> '{ladder,placed}' from jsonb_array_elements(public.teacher_class_skill_map((select id from made where name = 'R14')) -> 'students') s where s ->> 'id' = '00000000-0000-0000-0000-0000000000a5'), 'skipped', 'and a skipped warm-up');
select is((select s #>> '{settings,enabledTables}' from jsonb_array_elements(public.teacher_class_skill_map((select id from made where name = 'R12')) -> 'students') s limit 1), '[2, 5, 10]', 'the class''s tables setting comes with each student');

-- The student card.
select is(public.teacher_student_ladder('00000000-0000-0000-0000-0000000000a4') ->> 'placement', 'tables-2-5-10', 'a teacher reads a student''s placement');

-- History: the focus that ended is there with who set it, and the running ones are not.
select is(jsonb_array_length(public.teacher_maths_focus_history((select id from made where name = 'R12'))), 1, 'Room 12 has one ended focus');
select is(public.teacher_maths_focus_history((select id from made where name = 'R12')) #>> '{0,skills,0}', 'dbl-half-10', 'the one that ended');
select isnt(public.teacher_maths_focus_history((select id from made where name = 'R12')) #>> '{0,setBy}', '', 'with who set it');
select is(jsonb_array_length(public.teacher_maths_focus_history((select id from made where name = 'R14'))), 0, 'Room 14 has none');

-- Clearing a placement on this data.
select is(public.teacher_reset_placement('00000000-0000-0000-0000-0000000000a4'), true, 'a teacher clears a placement');
select is(public.teacher_reset_placement('00000000-0000-0000-0000-0000000000a5'), true, 'and a skip');
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
select is((select count(*)::int from public.ladder_placements where student_id in ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a5')), 0, 'both are gone');
select is((select skill from public.ladder_places where student_id = '00000000-0000-0000-0000-0000000000a4'), 'tables-3-4-8', 'but the furthest place is kept');
select is(public.maths_focus_of('00000000-0000-0000-0000-0000000000a4') #>> '{ladder,furthest}', 'tables-3-4-8', 'and the games are still told it');
select is(public.maths_focus_of('00000000-0000-0000-0000-0000000000a4') -> 'ladder' -> 'placed', 'null'::jsonb, 'while the warm-up is offered again');

-- James, the school admin, can read any class in the school; a student, a signed-out visitor and the wrong teacher cannot.
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","email":"james@douglaspark.school.nz","role":"authenticated"}', true);
select is(jsonb_array_length(public.teacher_class_skill_map((select id from made where name = 'R12')) -> 'students'), 3, 'the school admin reads a class they don''t teach');
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","email":"ben@douglaspark.school.nz","role":"authenticated"}', true);
select throws_ok(format('select public.teacher_class_skill_map(%L)', (select id from made where name = 'R12')), '42501', null, 'a student cannot');
select throws_ok(format('select public.teacher_reset_placement(%L)', '00000000-0000-0000-0000-0000000000a1'), '42501', null, 'or clear a placement');
grant select on made to anon;
select set_config('role', 'anon', true);
select throws_ok(format('select public.teacher_maths_focus_history(%L)', (select id from made where name = 'R12')), '42501', null, 'a signed-out visitor cannot read history');
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);

-- Who can call what: exactly four new functions, all for signed-in people who then pass the teacher checks.
select is((select count(*)::int from before_functions b where not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = b.name and has_function_privilege('authenticated', p.oid, 'execute'))), 0, 'every function a signed-in person could call before still works for them');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')), 0, 'a signed-out visitor can call none');
select set_eq($$ select distinct p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute') and p.proname not in (select name from before_functions) $$,
  array['teacher_class_skill_map', 'teacher_maths_focus_history', 'teacher_reset_placement', 'teacher_student_ladder'], 'and the new ones are exactly the four');

select * from finish();
rollback;
