-- Rehearsal for the maths auto migration (F.4): the checks after the migration ran on the live site's data.
select plan(39);

-- Nothing lost.
select is((select count(*)::int from public.gem_keep_facts), (select count(*)::int from before_facts), 'every maths record is still there');
select is((select count(*)::int from public.gem_keep_facts g join before_facts b using (player, pack, fact_key) where g.attempts = b.attempts and g.correct = b.correct and g.box = b.box),
  (select count(*)::int from before_facts), 'with the same numbers');
select is((select count(*)::int from public.maths_focuses m join before_focuses b using (id) where m.skills = b.skills and m.only_these = b.only_these and m.ends_at = b.ends_at and m.class_id = b.class_id), (select count(*)::int from before_focuses), 'every teacher focus is exactly as it was');
select is((select count(*)::int from public.student_maths_focus s join before_own b using (student_id) where s.skills = b.skills), (select count(*)::int from before_own), 'and so is the student''s own pick');

-- Settings: every row is exactly what it was, plus the new switch off.
select is((select count(*)::int from public.app_settings), (select count(*)::int from before_settings), 'the same number of settings rows');
select is((select count(*)::int from public.app_settings where not maths_auto), (select count(*)::int from before_settings), 'every row has the new switch off, so nothing changes yet');
select is((select count(*)::int from public.app_settings a join before_settings b using (id) where (to_jsonb(a) - 'maths_auto') = to_jsonb(b)), (select count(*)::int from before_settings), 'and every other setting is exactly what it was');
select is((select maths_auto from public.app_settings where class_id is null and school_id = 1), false, 'the school default has it off too, so a new class starts with it off');

-- Every student's focus: the same as before apart from the ladder facts.
select is((select count(*)::int from generate_series(1, 6) n where (public.maths_focus_of(('00000000-0000-0000-0000-0000000000a' || n)::uuid) - 'ladder') = (select value from before_json where what = 'focus-' || n)), 6, 'every student''s focus is exactly what it was');
select is((select count(*)::int from generate_series(1, 6) n where public.maths_focus_of(('00000000-0000-0000-0000-0000000000a' || n)::uuid) #>> '{ladder,on}' = 'false'), 6, 'and every one is told auto is off');
select is(public.maths_focus_of('00000000-0000-0000-0000-0000000000a1') ->> 'source', 'teacher-group', 'a group focus still comes first');
select is(public.maths_focus_of('00000000-0000-0000-0000-0000000000a6') ->> 'source', 'student', 'and a student''s own pick is still theirs');
select is(public.maths_focus_of('00000000-0000-0000-0000-0000000000a1') #>> '{ladder,yearLevel}', '5', 'a student in Room 12 is told it is Year 5');
select is(public.maths_focus_of('00000000-0000-0000-0000-0000000000a4') #> '{ladder,yearLevel}', 'null'::jsonb, 'one in Room 14 (no year level) is told none');

-- Teachers: the same lists as before.
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","email":"ms.teacher@douglaspark.school.nz","role":"authenticated"}', true);
select is((select jsonb_agg(to_jsonb(c) order by c.name) from public.teacher_classes() c), (select value from before_json where what = 'classes'), 'a teacher''s class list is the same');
select is((select jsonb_agg(to_jsonb(s) order by s.display_name) from public.teacher_students() s), (select value from before_json where what = 'students'), 'and their students');
select is(public.teacher_class_detail((select id from made where name = 'R12')), (select value from before_json where what = 'detail'), 'and a class page');
select is(public.teacher_maths_focuses(), (select value from before_json where what = 'running'), 'and the running focuses');
select is(public.teacher_class_settings((select id from made where name = 'R12')) ->> 'maths_auto', 'false', 'the class settings now say auto is off');

-- Students: Gem Keep and the home page read as before.
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"ana@douglaspark.school.nz","role":"authenticated"}', true);
select is(public.my_gem_keep() -> 'settings', (select value -> 'settings' from before_json where what = 'gem'), 'Gem Keep settings read as before');
select is(public.my_gem_keep() -> 'progress', (select value -> 'progress' from before_json where what = 'gem'), 'and progress');
select is(public.my_gem_keep() -> 'facts', (select value -> 'facts' from before_json where what = 'gem'), 'and records');
select is(public.my_gem_keep() #>> '{focus,ladder,on}', 'false', 'the focus Gem Keep reads says auto is off');
select is(public.my_ladder() #>> '{focus,ladder,on}', 'false', 'the home page''s path call works, and says the same');
select is(jsonb_array_length(public.my_ladder() -> 'facts'), 5, 'with all five of the student''s records');
select throws_ok($$ select * from public.ladder_places $$, '42501', null, 'the places table is closed to the website');
select throws_ok($$ select public.record_ladder_place('00000000-0000-0000-0000-0000000000a1', 'facts-10', 0) $$, '42501', null, 'and a student cannot move their own place');

-- A teacher turns auto on for one class; only that class is told.
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","email":"ms.teacher@douglaspark.school.nz","role":"authenticated"}', true);
select lives_ok($$ select public.teacher_set_maths_auto(true, (select id from made where name = 'R14')) $$, 'a teacher turns auto on for Room 14');
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
select is(public.maths_focus_of('00000000-0000-0000-0000-0000000000a4') #>> '{ladder,on}', 'true', 'a student there is told');
select is(public.maths_focus_of('00000000-0000-0000-0000-0000000000a2') #>> '{ladder,on}', 'false', 'Room 12 is not');
select is((select count(*)::int from public.app_settings where maths_auto), 1, 'only that class''s row changed');
select is((select (to_jsonb(a) - 'maths_auto') = (select to_jsonb(b) from before_settings b where b.id = a.id) from public.app_settings a where a.class_id = (select id from made where name = 'R14')), true, 'and nothing else in it');

-- The server saves a place and a placement on a real student.
set local role service_role;
select is(public.record_ladder_place('00000000-0000-0000-0000-0000000000a4', 'tables-3-4-8', 7), true, 'the server saves a place');
select is(public.record_ladder_place('00000000-0000-0000-0000-0000000000a4', 'facts-10', 0), false, 'which does not go back');
select is(public.record_placement('00000000-0000-0000-0000-0000000000a4', 'tables-2-5-10', false), true, 'and stores a placement');
select is(public.maths_focus_of('00000000-0000-0000-0000-0000000000a4') #>> '{ladder,furthest}', 'tables-3-4-8', 'both show in the focus');
reset role;

-- Who can call what.
select is((select count(*)::int from before_functions b where not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = b.name and has_function_privilege('authenticated', p.oid, 'execute'))), 0, 'every function a signed-in person could call before still works for them');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')), 0, 'and a signed-out visitor can call none');
select is((select count(*)::int from information_schema.table_privileges where table_schema = 'public' and table_name in ('ladder_places', 'ladder_placements') and grantee in ('anon', 'authenticated')), 0, 'the new tables are closed to the website');

select * from finish();
rollback;
