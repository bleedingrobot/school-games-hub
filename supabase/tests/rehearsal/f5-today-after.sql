-- Rehearsal for the generated-skills migration (F.5): the checks after the migration ran on the live site's data.
select plan(36);

-- Nothing lost.
select is((select count(*)::int from public.gem_keep_facts), (select count(*)::int from before_facts), 'every maths record is still there');
select is((select count(*)::int from public.gem_keep_facts g join before_facts b using (player, pack, fact_key) where g.attempts = b.attempts and g.correct = b.correct and g.box = b.box),
  (select count(*)::int from before_facts), 'with the same numbers');
select is((select count(*)::int from public.maths_focuses m join before_focuses b using (id) where m.skills = b.skills and m.only_these = b.only_these and m.ends_at = b.ends_at and m.class_id = b.class_id), (select count(*)::int from before_focuses), 'every teacher focus is exactly as it was');
select is((select count(*)::int from public.student_maths_focus s join before_own b using (student_id) where s.skills = b.skills), (select count(*)::int from before_own), 'and so is the student''s own pick');
select is((select count(*)::int from public.ladder_places p join before_places b using (student_id) where p.skill = b.skill and p.rank = b.rank), (select count(*)::int from before_places), 'every furthest place is as it was');
select is((select count(*)::int from public.ladder_placements p join before_placements b using (student_id) where p.skill is not distinct from b.skill and p.skipped = b.skipped), (select count(*)::int from before_placements), 'and every placement');

-- Settings: every row is exactly what it was (this migration touches no table).
select is((select count(*)::int from public.app_settings), (select count(*)::int from before_settings), 'the same number of settings rows');
select is((select count(*)::int from public.app_settings a join before_settings b using (id) where to_jsonb(a) = to_jsonb(b)), (select count(*)::int from before_settings), 'and every setting is exactly what it was');
select is((select count(*)::int from public.app_settings where maths_auto), 1, 'auto is still on for only the one class');

-- Every student's focus is exactly as it was.
select is((select count(*)::int from generate_series(1, 6) n where public.maths_focus_of(('00000000-0000-0000-0000-0000000000a' || n)::uuid) = (select value from before_json where what = 'focus-' || n)), 6, 'every student''s focus is exactly what it was');
select is(public.maths_focus_of('00000000-0000-0000-0000-0000000000a4') #>> '{ladder,furthest}', 'tables-3-4-8', 'a stored furthest place still shows');
select is(public.maths_focus_of('00000000-0000-0000-0000-0000000000a4') #>> '{ladder,placement}', 'tables-2-5-10', 'and a stored placement');

-- Teachers: the same lists as before.
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","email":"ms.teacher@douglaspark.school.nz","role":"authenticated"}', true);
select is((select jsonb_agg(to_jsonb(c) order by c.name) from public.teacher_classes() c), (select value from before_json where what = 'classes'), 'a teacher''s class list is the same');
select is((select jsonb_agg(to_jsonb(s) order by s.display_name) from public.teacher_students() s), (select value from before_json where what = 'students'), 'and their students');
select is(public.teacher_class_detail((select id from made where name = 'R12')), (select value from before_json where what = 'detail'), 'and a class page');
select is(public.teacher_maths_focuses(), (select value from before_json where what = 'running'), 'and the running focuses');

-- Students: Gem Keep and the home page read as before, until a generated record exists.
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"ana@douglaspark.school.nz","role":"authenticated"}', true);
select is(public.my_gem_keep() -> 'settings', (select value -> 'settings' from before_json where what = 'gem'), 'Gem Keep settings read as before');
select is(public.my_gem_keep() -> 'progress', (select value -> 'progress' from before_json where what = 'gem'), 'and progress');
select is(public.my_gem_keep() -> 'facts', (select value -> 'facts' from before_json where what = 'gem'), 'and records (Maths Monsters'' own place-value record is still not handed over)');
select is(public.my_gem_keep() -> 'focus', (select value -> 'focus' from before_json where what = 'gem'), 'and the focus');
select is(public.my_ladder(), (select value from before_json where what = 'ladder'), 'the home page''s path call gives exactly what it did');

-- The server records answers of every generated type, for a real student, and the games are handed them.
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
create temp table keys as select k from unnest(array['bond100:tens', 'bond100:fives', 'bond100:any', 'bond100:take', 'bond1000:hundreds', 'bond1000:fifties', 'bond1000:tens', 'bond1000:take', 'times:tens', 'times:hundreds', 'times:tens-tens', 'times:shift', 'times:powers', 'times:div-tens', 'factor:pair', 'factor:count', 'factor:largest', 'factor:common', 'square:of', 'cube:of', 'square:root', 'cube:root', 'square:next', 'round:10:2digit', 'round:10:3digit', 'round:10:halfway', 'round:10:near-halfway', 'round:100:3digit', 'round:100:4digit', 'round:100:halfway', 'round:100:near-halfway', 'round:1000:4digit', 'round:1000:5digit', 'round:1000:halfway', 'round:1000:near-halfway', 'round:10000:5digit', 'round:10000:halfway', 'round:100000:6digit', 'round:100000:halfway', 'round:whole:tenths', 'round:whole:hundredths', 'round:whole:halfway', 'round:tenth:hundredths', 'round:tenth:halfway', 'round:1000000:7digit', 'round:1000000:halfway', 'round:1000000:near-halfway', 'round:100000:7digit', 'round:hundredth:thousandths', 'round:hundredth:halfway', 'bedmas:mul-first', 'bedmas:div-first', 'bedmas:left-to-right', 'bedmas:brackets-first', 'bedmas:brackets-div', 'bedmas:mixed', 'bedmas:mixed-brackets']) as k;
select is(
  (select sum(public.record_fact_answers('00000000-0000-0000-0000-0000000000a1', 'generated', gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('key', k, 'correct', true, 'ms', 2500, 'at', 1792101600000)), 8000, 2, 4))::integer from keys),
  57, 'an answer for each of the 57 question types is recorded');
select is((select count(*)::int from public.gem_keep_facts where player = '00000000-0000-0000-0000-0000000000a1' and pack = 'generated' and box = 1), 57, 'each one is in box 1 after one quick right answer');
select is(public.record_fact_answers('00000000-0000-0000-0000-0000000000a1', 'generated', gen_random_uuid(),
    '[{"key":"round:100:3digit","correct":true,"ms":7500,"at":1792101600001},{"key":"round:100:3digit","correct":true,"ms":7600,"at":1792101600002}]', 8000, 2, 4), 2, 'two more answers, quick for a generated skill (up to 8 seconds)');
select is((select box from public.gem_keep_facts where player = '00000000-0000-0000-0000-0000000000a1' and fact_key = 'round:100:3digit'), 3, 'move that type to box 3 (but not fluent: one quick day)');
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"ana@douglaspark.school.nz","role":"authenticated"}', true);
select is(jsonb_array_length(public.my_gem_keep() -> 'facts'), 5 + 57, 'Gem Keep is now handed the old five plus the 57 generated records');
select is(jsonb_array_length(public.my_ladder() -> 'facts'), 5 + 57, 'and so is the home page');
select is((select count(*)::int from jsonb_array_elements(public.my_gem_keep() -> 'facts') f where f ->> 'key' like 'pv:%'), 0, 'but never Maths Monsters'' own records');
select is(public.my_gem_keep() -> 'focus', (select value -> 'focus' from before_json where what = 'gem'), 'the focus is unchanged by any of it');
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
select is(jsonb_array_length(public.space_maths_context('00000000-0000-0000-0000-0000000000a1') -> 'facts'), 5 + 57, 'Mission Control is handed them too');
select is(jsonb_array_length(public.space_maths_context('00000000-0000-0000-0000-0000000000a2') -> 'facts'), 1, 'and another player only their own');

-- Bad keys are still refused on this data.
select throws_ok($$ select public.record_fact_answers('00000000-0000-0000-0000-0000000000a1', 'generated', gen_random_uuid(), '[{"key":"Round:100","correct":true,"ms":2500,"at":1792101600000}]', 8000, 2, 4) $$, '23514', null, 'a key with a capital is refused');

-- Who can call what: nothing new, nothing lost.
select is((select count(*)::int from before_functions b where not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = b.name and has_function_privilege('authenticated', p.oid, 'execute'))), 0, 'every function a signed-in person could call before still works for them');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')), 0, 'and a signed-out visitor can call none');
select is((select count(*)::int from (select distinct p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')) now_fns where now_fns.proname not in (select name from before_functions)), 0, 'and no new function can be called by a student');
select throws_ok($$ select set_config('role', 'authenticated', true); select public.record_fact_answers('00000000-0000-0000-0000-0000000000a1', 'generated', gen_random_uuid(), '[]', 8000, 2, 4) $$, '42501', null, 'a student still cannot add answers themselves');

select * from finish();
rollback;
