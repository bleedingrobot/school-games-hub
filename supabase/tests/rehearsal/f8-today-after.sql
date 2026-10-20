-- Rehearsal for the focus results migration (F.8): the checks after it ran on the live site's data (the fake rows of
-- f7-today-before.sql, with F.5 to F.7 applied).
select plan(31);

-- Nothing lost, nothing changed: F.8 adds two tables and two functions and touches no existing table.
select is((select count(*)::int from public.gem_keep_facts g join before_facts b using (player, pack, fact_key) where g.attempts = b.attempts and g.correct = b.correct and g.box = b.box),
  (select count(*)::int from before_facts), 'every maths record is still there, with the same numbers');
select is((select count(*)::int from public.maths_focuses m join before_focuses b using (id) where m.skills = b.skills and m.only_these = b.only_these and m.ends_at = b.ends_at and m.ended_at is not distinct from b.ended_at and m.class_id = b.class_id),
  (select count(*)::int from before_focuses), 'every teacher focus (running or ended) is exactly as it was');
select is((select count(*)::int from public.student_maths_focus s join before_own b using (student_id) where s.skills = b.skills), (select count(*)::int from before_own), 'and so is the student''s own pick');
select is((select count(*)::int from public.app_settings a join before_settings b using (id) where to_jsonb(a) = to_jsonb(b)), (select count(*)::int from before_settings), 'every setting is exactly what it was');
select is((select jsonb_object_agg(t, n) from (select 'maths_focuses' as t, count(*) as n from public.maths_focuses union all select 'gem_keep_facts', count(*) from public.gem_keep_facts union all select 'profiles', count(*) from public.profiles union all select 'class_members', count(*) from public.class_members union all select 'ladder_places', count(*) from public.ladder_places union all select 'ladder_placements', count(*) from public.ladder_placements union all select 'classes', count(*) from public.classes) x),
  (select jsonb_object_agg(t, n) from before_counts), 'the number of rows in every table the maths uses is the same');
select is((select count(*)::int from generate_series(1, 6) n where public.maths_focus_of(('00000000-0000-0000-0000-0000000000a' || n)::uuid) = (select value from before_json where what = 'focus-' || n)), 6, 'every student''s focus is exactly what it was');
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","email":"ms.teacher@douglaspark.school.nz","role":"authenticated"}', true);
select is(public.teacher_maths_focuses(), (select value from before_json where what = 'running'), 'the running focuses a teacher sees are the same');
select is((select jsonb_agg(to_jsonb(s) order by s.display_name) from public.teacher_students() s), (select value from before_json where what = 'students'), 'and their students');
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"ana@douglaspark.school.nz","role":"authenticated"}', true);
select is(public.my_gem_keep(), (select value from before_json where what = 'gem'), 'a student''s Gem Keep data is the same');
select is(public.my_ladder(), (select value from before_json where what = 'ladder'), 'and their ladder');
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);

-- Counting starts empty, and from now.
select is((select count(*)::int from public.maths_focus_results), 0, 'there are no results yet: nothing is counted backwards');
select ok((select since from public.maths_focus_results_since) <= now(), 'the day counting began is remembered');

-- The game servers at work. Each server call is "save the answers; if the records took them for the first time, count them for the focus".
-- Ana (a1) is in Room 12 (a class focus on tables-6-9, running) and in group Kea (a group focus on facts-10). Ben (a2) is in Room 12 only.
-- Dan (a4) is in Room 14, which has no focus.
create function pg_temp.server_saves(who uuid, pack text, batch uuid, answers jsonb, counted jsonb) returns integer language sql as $$
  select coalesce(case when x.added > 0 then public.add_maths_focus_results(who, counted) end, 0)
  from (select public.record_fact_answers(who, pack, batch, answers, 5000, 2, 4) as added) x
$$;
-- The whole rehearsal is one transaction, so now() is when the focuses were set: answers are a few seconds after that (a negative "ago").
create function pg_temp.at_ms(ago interval) returns bigint language sql as $$ select (extract(epoch from now() - ago) * 1000)::bigint $$;

select is(pg_temp.server_saves('00000000-0000-0000-0000-0000000000a1', 'times-tables', '00000000-0000-0000-0000-00000000f801',
  jsonb_build_array(jsonb_build_object('key', 'mul:6x7', 'correct', true, 'ms', 1800, 'at', pg_temp.at_ms('-10 seconds')),
                    jsonb_build_object('key', 'mul:9x9', 'correct', false, 'ms', 6000, 'at', pg_temp.at_ms('-9 seconds'))),
  jsonb_build_array(jsonb_build_object('skills', jsonb_build_array('tables-6-9'), 'at', pg_temp.at_ms('-10 seconds'), 'correct', true, 'quick', true),
                    jsonb_build_object('skills', jsonb_build_array('tables-6-9'), 'at', pg_temp.at_ms('-9 seconds'), 'correct', false, 'quick', false))),
  1, 'Ana''s times-table answers are counted for the Room 12 focus only');
select is(pg_temp.server_saves('00000000-0000-0000-0000-0000000000a1', 'early-facts', '00000000-0000-0000-0000-00000000f802',
  jsonb_build_array(jsonb_build_object('key', 'bond10:3+7', 'correct', true, 'ms', 1200, 'at', pg_temp.at_ms('-8 seconds'))),
  jsonb_build_array(jsonb_build_object('skills', jsonb_build_array('facts-10'), 'at', pg_temp.at_ms('-8 seconds'), 'correct', true, 'quick', true))),
  1, 'her number-bond answer is counted for Kea''s group focus only');
-- A retry: the records say 0 for a batch they have seen, so the server does not count it again.
select is(pg_temp.server_saves('00000000-0000-0000-0000-0000000000a1', 'times-tables', '00000000-0000-0000-0000-00000000f801',
  jsonb_build_array(jsonb_build_object('key', 'mul:6x7', 'correct', true, 'ms', 1800, 'at', pg_temp.at_ms('-10 seconds'))),
  jsonb_build_array(jsonb_build_object('skills', jsonb_build_array('tables-6-9'), 'at', pg_temp.at_ms('-10 seconds'), 'correct', true, 'quick', true))),
  0, 'a batch sent twice is counted once');
select pg_temp.server_saves('00000000-0000-0000-0000-0000000000a2', 'times-tables', '00000000-0000-0000-0000-00000000f803',
  jsonb_build_array(jsonb_build_object('key', 'mul:6x7', 'correct', true, 'ms', 4000, 'at', pg_temp.at_ms('-5 seconds'))),
  jsonb_build_array(jsonb_build_object('skills', jsonb_build_array('tables-6-9'), 'at', pg_temp.at_ms('-5 seconds'), 'correct', true, 'quick', true)));
select is(pg_temp.server_saves('00000000-0000-0000-0000-0000000000a4', 'times-tables', '00000000-0000-0000-0000-00000000f804',
  jsonb_build_array(jsonb_build_object('key', 'mul:2x5', 'correct', true, 'ms', 1000, 'at', pg_temp.at_ms('-5 seconds'))),
  jsonb_build_array(jsonb_build_object('skills', jsonb_build_array('tables-2-5-10'), 'at', pg_temp.at_ms('-5 seconds'), 'correct', true, 'quick', true))),
  0, 'a student whose class has no focus costs nothing');

-- The records themselves behave exactly as before (the focus counting is on the side).
select is((select attempts from public.gem_keep_facts where player = '00000000-0000-0000-0000-0000000000a1' and fact_key = 'mul:6x7'), 5, 'the answer still went into the student''s record (4 before, 5 now, not 6)');
select is((select count(*)::int from public.maths_focus_results), 3, 'three results rows: Ana in the class and group focus, Ben in the class focus');

-- What the teacher reads.
create temp table lesson_end as select max(ended_at) as e from public.maths_focuses where skills = '{dbl-half-10}';
grant select on lesson_end to public;
create temp table batches as select (select batch_id from public.maths_focuses where class_id = (select id from made where name = 'R12') and skills = '{tables-6-9}') as r12,
  (select batch_id from public.maths_focuses where class_id = (select id from made where name = 'R12') and skills = '{facts-10}') as kea;
grant select on batches to public;
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","email":"ms.teacher@douglaspark.school.nz","role":"authenticated"}', true);
select is((select s ->> 'name' from jsonb_array_elements(public.teacher_maths_focus_results((select r12 from batches)) -> 'students') s where s ->> 'id' = '00000000-0000-0000-0000-0000000000a1') is not null, true, 'Room 12''s focus lists Ana');
select is((select s ->> 'answers' || '/' || (s ->> 'correct') || '/' || (s ->> 'quick') from jsonb_array_elements(public.teacher_maths_focus_results((select r12 from batches)) -> 'students') s where s ->> 'id' = '00000000-0000-0000-0000-0000000000a1'),
  '2/1/1', 'with her 2 answers, 1 right, 1 quick');
select is((select s ->> 'answers' from jsonb_array_elements(public.teacher_maths_focus_results((select r12 from batches)) -> 'students') s where s ->> 'id' = '00000000-0000-0000-0000-0000000000a3'), '0', 'a classmate who did none is listed with 0');
select is(public.teacher_maths_focus_results((select r12 from batches)) #>> '{total,answers}', '3', 'the class total is 3 (Ana''s two and Ben''s one)');
select is(jsonb_array_length(public.teacher_maths_focus_results((select kea from batches)) -> 'students'), 1, 'the group focus lists just the one student in Kea');
select is(public.teacher_maths_focus_results((select batch_id from lesson)) #>> '{total,answers}', '0', 'the lesson focus that ended before counting began shows none');
select ok((public.teacher_maths_focus_results((select batch_id from lesson)) ->> 'since')::timestamptz >= (select e from lesson_end),
  'and the page can tell it ended before counting began');

-- Refusals.
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","email":"ben@douglaspark.school.nz","role":"authenticated"}', true);
select throws_ok(format('select public.teacher_maths_focus_results(%L)', (select batch_id from lesson)), '42501', null, 'a student cannot read results');
select throws_ok($$ select * from public.maths_focus_results $$, '42501', null, 'nor the table');
select throws_ok(format('select public.add_maths_focus_results(%L, %L)', '00000000-0000-0000-0000-0000000000a2', '[]'), '42501', null, 'nor add to it');
select set_config('role', 'anon', true);
select throws_ok(format('select public.teacher_maths_focus_results(%L)', (select batch_id from lesson)), '42501', null, 'a signed-out visitor cannot read results');
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);

-- Who can call what: one new function for signed-in people (who then pass the teacher check), one for the server only.
select is((select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute') and p.proname not in (select name from before_functions)), array['teacher_maths_focus_results'], 'the only new function a signed-in person can call is the teacher one');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')), 0, 'a signed-out visitor can call none');
