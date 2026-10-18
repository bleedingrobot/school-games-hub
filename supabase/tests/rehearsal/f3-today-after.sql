-- Rehearsal for the maths focus migration (F.3): the checks after the migration ran on the live site's data.
select plan(39);

-- Nothing lost.
select is((select count(*)::int from public.gem_keep_facts), (select count(*)::int from before_facts), 'every maths record is still there');
select is((select count(*)::int from public.gem_keep_facts g join before_facts b using (player, pack, fact_key) where g.attempts = b.attempts and g.correct = b.correct and g.box = b.box),
  (select count(*)::int from before_facts), 'with the same numbers');
select lives_ok($$ insert into public.gem_keep_facts (player, pack, fact_key, attempts, correct, avg_ms, box) values ('00000000-0000-0000-0000-0000000000a2', 'early-facts', 'bond10:3+7', 1, 1, 1000, 1) $$, 'a record with digits in its key (bond10:3+7) can now be saved');
select throws_ok($$ insert into public.gem_keep_facts (player, pack, fact_key, attempts, correct, avg_ms, box) values ('00000000-0000-0000-0000-0000000000a2', 'x', 'Bond10:3+7', 1, 1, 1000, 1) $$, '23514', null, 'but odd keys are still refused');
delete from public.gem_keep_facts where pack = 'early-facts';

-- Settings: every row is exactly what it was, plus the new switch on.
select is((select count(*)::int from public.app_settings), (select count(*)::int from before_settings), 'the same number of settings rows');
select is((select count(*)::int from public.app_settings where students_choose_focus), (select count(*)::int from before_settings), 'every row has the new switch on');
select is((select count(*)::int from public.app_settings a join before_settings b using (id)
  where (to_jsonb(a) - 'students_choose_focus') = to_jsonb(b)), (select count(*)::int from before_settings), 'and every other setting is exactly what it was');
select is((select students_choose_focus from public.app_settings where class_id is null and school_id = 1), true, 'the school default has it on too, so a new class starts with it on');

-- Teachers: the same lists as before, and the group id is the only addition.
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","email":"ms.teacher@douglaspark.school.nz","role":"authenticated"}', true);
select is((select jsonb_agg(to_jsonb(c) order by c.name) from public.teacher_classes() c), (select value from before_json where what = 'classes'), 'a teacher''s class list is the same');
select is((select jsonb_agg(to_jsonb(s) order by s.display_name) from public.teacher_students() s), (select value from before_json where what = 'students'), 'and their students');
select is((select jsonb_pretty(jsonb_set(public.teacher_class_detail((select id from made where name = 'R12')), '{members}',
    (select jsonb_agg(m - 'groupId') from jsonb_array_elements(public.teacher_class_detail((select id from made where name = 'R12')) -> 'members') m)))),
  (select jsonb_pretty(value) from before_json where what = 'detail'), 'a class page is the same, with only the group id added to each student');
select is((select x ->> 'groupId' from jsonb_array_elements(public.teacher_class_detail((select id from made where name = 'R12')) -> 'members') x where x ->> 'name' = (select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a1')),
  (select id::text from made where name = 'Kea'), 'and says which group each student is in');

-- Nothing changes for students: auto, and may choose.
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
select is((select count(*)::int from generate_series(1, 6) n where public.maths_focus_of(('00000000-0000-0000-0000-0000000000a' || n)::uuid) ->> 'source' = 'auto'), 6, 'every student is on auto');
select is((select count(*)::int from generate_series(1, 6) n where (public.maths_focus_of(('00000000-0000-0000-0000-0000000000a' || n)::uuid) ->> 'canChoose')::boolean), 6, 'and may choose their own focus');

-- Gem Keep for a student: the same settings and progress; more of the records (the packs a focus asks for).
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"ana@douglaspark.school.nz","role":"authenticated"}', true);
select is(public.my_gem_keep() -> 'settings', (select value -> 'settings' from before_json where what = 'gem'), 'Gem Keep settings read as before');
select is(public.my_gem_keep() -> 'progress', (select value -> 'progress' from before_json where what = 'gem'), 'and progress');
select is(public.my_gem_keep() -> 'canImport', (select value -> 'canImport' from before_json where what = 'gem'), 'and the trial-import flag');
select is(jsonb_array_length(public.my_gem_keep() -> 'facts'), jsonb_array_length((select value -> 'facts' from before_json where what = 'gem')) + 2, 'the records now include adding and division too (but not fractions or money)');
select is((select count(*)::int from jsonb_array_elements(public.my_gem_keep() -> 'facts') f where f ->> 'key' in ('mul:6x7', 'mul:2x5')), 2, 'and the times-table ones are all still there');
select is(public.my_gem_keep() -> 'focus' ->> 'source', 'auto', 'the focus is auto');
select is(public.my_maths_focus() ->> 'source', 'auto', 'and my_maths_focus agrees');
select is((select space_maths from public.app_settings), 'on', 'a student still reads their class''s settings row');
select is(jsonb_typeof(public.my_progress()), 'object', 'the progress page still works');

-- A teacher can use all of it on today's classes.
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","email":"ms.teacher@douglaspark.school.nz","role":"authenticated"}', true);
select is(public.teacher_set_maths_focus((select id from made where name = 'R12'), 'group', array[(select id from made where name = 'Kea')], array['facts-10'], true, 'friday'), 1, 'a teacher sets a focus for a group');
select is(public.teacher_set_maths_focus((select id from made where name = 'R12'), 'class', null, array['tables-6-9'], false, 'week'), 1, 'and for the class');
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
select is(public.maths_focus_of('00000000-0000-0000-0000-0000000000a1') ->> 'source', 'teacher-group', 'the group''s student follows the group');
select is(public.maths_focus_of('00000000-0000-0000-0000-0000000000a2') ->> 'source', 'teacher-class', 'the others in the class follow the class');
select is(public.maths_focus_of('00000000-0000-0000-0000-0000000000a4') ->> 'source', 'auto', 'the other class is untouched');
select is(public.maths_focus_of('00000000-0000-0000-0000-0000000000a6') ->> 'source', 'auto', 'so is a student with no class');
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","email":"ms.teacher@douglaspark.school.nz","role":"authenticated"}', true);
select lives_ok($$ select public.teacher_set_space_maths('choose', (select id from made where name = 'R12')) $$, 'the switches still work, for a named class');
select lives_ok($$ select public.teacher_set_gem_keep('{"mode":"calm","enabledTables":[2,3],"division":false,"missingFactor":null,"multipleChoice":false,"keyPassMark":8}'::jsonb) $$, 'and for all my classes');
insert into made values ('N1', public.teacher_create_class('', 2026, 4));
insert into made values ('N2', public.teacher_create_class('Room 99', 2026));
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
select is((select name from public.classes where id = (select id from made where name = 'N1')), 'ms.teacher', 'a class made with no name is named from the teacher''s email');
select is((select name from public.classes where id = (select id from made where name = 'N2')), 'Room 99', 'and one made with a name has it');
select is((select students_choose_focus from public.app_settings where class_id = (select id from made where name = 'N1')), true, 'a new class starts with students allowed to choose');

-- Who can call what: nothing that could be called before has gone, and the new ones are open to signed-in people only.
select is((select count(*)::int from before_functions b where not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = b.name and has_function_privilege('authenticated', p.oid, 'execute'))), 0, 'every function a signed-in person could call before still works for them');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')), 0, 'and a signed-out visitor can call none');
select ok(not has_function_privilege('authenticated', 'public.space_maths_context(uuid)', 'execute'), 'the function that gives Mission Control a student''s records is still only for the game servers');
select ok(has_function_privilege('service_role', 'public.space_maths_context(uuid)', 'execute') and has_function_privilege('service_role', 'public.maths_focus_of(uuid)', 'execute'), 'which can use it, and the new focus one');
select is((select count(*)::int from information_schema.table_privileges where table_schema = 'public' and table_name in ('maths_focuses', 'student_maths_focus') and grantee in ('anon', 'authenticated')), 0, 'the new tables are closed to the website');

select * from finish();
rollback;
