-- Marble Rush M.4: saving runs and best times, boards and ghosts.
-- Students can't touch the tables or the saving function; a seed saves once; only a faster run
-- replaces a best; boards show the own school only and leave out hidden profiles; ghosts come from
-- the best runs of the own school.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(64);

-- School 1 is Douglas Park (made by the migration). School 2 is made here.
select setval(pg_get_serial_sequence('public.schools', 'id'), 1);
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id) values ('otherschool.school.nz', 2);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cai@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'dee@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000001a', 'zed@otherschool.school.nz');
update public.profiles set hidden = true where id = '00000000-0000-0000-0000-00000000000d';

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.act_as_server() returns void language sql as $$
  select set_config('role', 'service_role', true), set_config('request.jwt.claims', '{"role":"service_role"}', true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || who)::uuid $$;
-- Saves a run for a student: `n` makes the seed, so the same n is the same seed.
create function pg_temp.save(who text, n integer, in_steps integer, in_course text default 'boulder-beach',
  in_mode text default 'up', in_daily integer default 400, in_doors integer default 0) returns text language sql as $$
  select public.record_marble_run(pg_temp.id(who), 'seed-for-run-' || who || '-' || n, in_course, in_mode, false,
    in_steps, 1, 0, 0, '1x' || in_steps, in_daily, in_doors)
$$;

-- ---- Nobody reaches the tables or the saving function directly ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.marble_runs $$, '42501', null, 'students cannot read the runs table');
select throws_ok($$ select * from public.marble_bests $$, '42501', null, 'students cannot read the bests table');
select throws_ok($$ insert into public.marble_bests (player, course, mode, steps, falls, inputs)
  values (auth.uid(), 'boulder-beach', 'up', 1, 0, '1x1') $$, '42501', null, 'students cannot add a best directly');
select throws_ok($$ select pg_temp.save('0a', 1, 3000) $$, '42501', null, 'students cannot call the saving function');
select pg_temp.reset();

-- ---- Saving (the server only) ----
select pg_temp.act_as_server();
select is(pg_temp.save('0a', 1, 3000), 'best', 'a first run is a best');
select is(pg_temp.save('0a', 1, 3000), 'duplicate', 'the same seed again is not counted twice');
select is((select count(*)::integer from public.marble_runs where player = pg_temp.id('0a')), 1, '... and adds no run');
select is(pg_temp.save('0a', 2, 3500), 'saved', 'a slower run is saved but is not a best');
select is((select steps from public.marble_bests where player = pg_temp.id('0a')), 3000, '... and the best stays');
select is(pg_temp.save('0a', 3, 2900), 'best', 'a faster run is a new best');
select is((select steps from public.marble_bests where player = pg_temp.id('0a') and course = 'boulder-beach' and mode = 'up'), 2900, '... and replaces the best');
select is((select inputs from public.marble_bests where player = pg_temp.id('0a')), '1x2900', '... with its recorded inputs');
select is(pg_temp.save('0a', 4, 2900), 'saved', 'a tie does not replace the best');
select is(pg_temp.save('0a', 5, 3300, 'boulder-beach', 'down'), 'best', 'hard mode has its own best');
select is(pg_temp.save('0a', 6, 4000, 'crown-range'), 'best', 'so does each course');
select is((select count(*)::integer from public.marble_bests where player = pg_temp.id('0a')), 3, '... three bests so far');
select is(pg_temp.save('0b', 1, 3000), 'best', 'the same seed text for another student is a different seed');

select throws_ok($$ select pg_temp.save('0f', 1, 3000) $$, '22023', null, 'nothing can be saved for someone with no profile');
select throws_ok($$ select pg_temp.save('0a', 7, 0) $$, '23514', null, 'a time of zero is refused');
select throws_ok($$ select pg_temp.save('0a', 7, 3000, 'Bad Course!') $$, '23514', null, 'a course name that is not shaped like one is refused');
select throws_ok($$ select pg_temp.save('0a', 7, 3000, 'boulder-beach', 'sideways') $$, '23514', null, 'a mode that is not up or down is refused');
select throws_ok($$ select pg_temp.save('0a', 8, 3000, 'boulder-beach', 'up', 3) $$, '54000', null, 'too many runs in a day asks for a break');

-- A board with several students. Ana 2900, Ben 3000; add Cai 2500 (fastest), Dee 2000 (hidden), Zed 1000 (other school).
select pg_temp.save('0c', 1, 2500);
select pg_temp.save('0d', 1, 2000);
select pg_temp.save('1a', 1, 1000);
select pg_temp.reset();

-- ---- Reading ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(jsonb_array_length(public.my_marble()), 3, 'a student reads their own bests');
select is(public.my_marble() -> 0 ? 'inputs', false, '... without the inputs');
select is((select jsonb_agg(b ->> 'course' || ':' || (b ->> 'mode')) from jsonb_array_elements(public.my_marble()) b),
  '["boulder-beach:down", "boulder-beach:up", "crown-range:up"]'::jsonb, '... and none of anyone else''s');

select is((select jsonb_agg(t ->> 'name') from jsonb_array_elements(public.marble_board('boulder-beach', 'up', false) -> 'top') t),
  (select jsonb_agg(p.display_name order by x.o) from (values ('0c', 1), ('0a', 2), ('0b', 3)) x(id, o) join public.profiles p on p.id = pg_temp.id(x.id)),
  'the board is fastest first, own school only, hidden profiles left out');
select is(public.marble_board('boulder-beach', 'up', false) #>> '{me,rank}', '2', '... and says where the student stands');
select is(public.marble_board('boulder-beach', 'up', false) ->> 'total', '3', '... and how many are on it');
select is(public.marble_board('boulder-beach', 'up', false) #>> '{top,1,me}', 'true', '... marking which row is the student');
select is(public.marble_board('boulder-beach', 'up', true) ->> 'total', '0', 'the maths board is separate (and empty)');
select is(public.marble_board('boulder-beach', 'down', false) ->> 'total', '1', 'so is hard mode');
select is(public.marble_board('boulder-beach', 'up', false) #>> '{top,0,inputs}', null, 'a board never carries the inputs');

-- Ghosts.
select is(public.marble_ghost('boulder-beach', 'up', false, 'mine') ->> 'steps', '2900', 'the "mine" ghost is the student''s own best');
select is(public.marble_ghost('boulder-beach', 'up', false, 'next') ->> 'steps', '2500', 'the "next" ghost is the classmate just faster');
select is(public.marble_ghost('boulder-beach', 'up', false, 'top') ->> 'steps', '2500', 'the "top" ghost is the fastest in the school (not hidden, not another school)');
select is(public.marble_ghost('boulder-beach', 'up', false, 'top') ->> 'inputs', '1x2500', '... with the inputs to play back');
select throws_ok($$ select public.marble_ghost('boulder-beach', 'up', false, 'everyone') $$, '22023', null, 'an unknown ghost is refused');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'cai@douglaspark.school.nz');
select is(public.marble_ghost('boulder-beach', 'up', false, 'next'), null, 'the fastest student has nobody ahead to chase');

select pg_temp.act_as('00000000-0000-0000-0000-00000000001a', 'zed@otherschool.school.nz');
select is(public.marble_board('boulder-beach', 'up', false) ->> 'total', '1', 'another school sees only its own board');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'someone@gmail.com');
select is(public.marble_board('boulder-beach', 'up', false), null, 'someone who is not at a school gets no board');

-- ---- Maths (M.6): doors kept with a run, the teacher's switches, and the questions of a run ----
select pg_temp.act_as_server();
select is(public.record_marble_run(pg_temp.id('0b'), 'maths-seed-1', 'boulder-beach', 'up', true, 2000, 0, 0, 0, '1x2000', 400, 5), 'best', 'a run with maths is saved on its own');
select is((select doors from public.marble_bests where player = pg_temp.id('0b') and maths), 5, '... with the doors that were open');
select is((select count(*)::integer from public.marble_bests where player = pg_temp.id('0b') and not maths), 1, '... and the run without maths is kept apart');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'cai@douglaspark.school.nz');
select is(public.marble_ghost('boulder-beach', 'up', true, 'top') ->> 'doors', '5', 'a ghost carries the doors it was run with');
select is(public.marble_board('boulder-beach', 'up', true) ->> 'total', '1', 'the with-maths board is separate');
select is((public.marble_ghost('boulder-beach', 'up', false, 'top') ->> 'doors')::integer, 0, 'a run with no gates keeps no doors');
select pg_temp.reset();

-- The teacher's switches (a student cannot change them)
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.teacher_set_marble_maths('on') $$, null, null, 'a student cannot change the maths switch');
select throws_ok($$ select public.teacher_set_marble_rescue(false) $$, null, null, 'a student cannot change the rescue switch');
select is((select marble_maths from public.app_settings limit 1), 'choose', 'the maths switch starts at "students choose"');
select is((select marble_rescue from public.app_settings limit 1), true, '... and rescue questions start on');
select pg_temp.reset();
update public.profiles set role = 'teacher', school_admin = true where id = pg_temp.id('0c');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'cai@douglaspark.school.nz');
select lives_ok($$ select public.teacher_set_marble_maths('on') $$, 'a teacher can switch maths on for everyone');
select is((select marble_maths from public.app_settings limit 1), 'on', '... and it is saved');
select throws_ok($$ select public.teacher_set_marble_maths('sometimes') $$, '22023', null, 'an unknown setting is refused');
select lives_ok($$ select public.teacher_set_marble_rescue(false) $$, 'a teacher can switch rescue questions off');
select is((select marble_rescue from public.app_settings limit 1), false, '... and it is saved');
select pg_temp.reset();

-- The question list of a run: only the server function can use it
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.marble_questions $$, '42501', null, 'students cannot read the question lists');
select throws_ok($$ select public.marble_load_run(auth.uid(), 'question-seed-1') $$, '42501', null, 'students cannot load a question list');
select pg_temp.act_as_server();
select lives_ok($$ select public.marble_store_run(pg_temp.id('0a'), 'question-seed-1', true, '[{"answer":56},{"answer":48}]') $$, 'the server keeps a run''s questions');
select is(public.marble_load_run(pg_temp.id('0a'), 'question-seed-1') #>> '{questions,1,answer}', '48', '... and loads them back with their answers');
select is(public.marble_load_run(pg_temp.id('0a'), 'question-seed-none'), null, 'a run with no list (no maths) loads as nothing');
select is(public.marble_claim_answer(pg_temp.id('0a'), 'question-seed-1', 3, 56, true), true, 'an answer is marked once');
select is(public.marble_claim_answer(pg_temp.id('0a'), 'question-seed-1', 3, 12, false), false, '... and a second answer to the same slot is turned away');
select is(public.marble_load_run(pg_temp.id('0a'), 'question-seed-1') #>> '{answered,3,right}', 'true', '... and the first one stands');
select throws_ok($$ select public.marble_store_run(pg_temp.id('0a'), 'question-seed-2', true, '[]') $$, '22023', null, 'an empty question list is refused');

select * from finish();
rollback;
