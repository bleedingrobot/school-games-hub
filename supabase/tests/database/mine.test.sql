-- Mine Runner stage 4: saving runs and best times, boards, the maths switch and the question lists.
-- Pupils can't touch the tables or the saving functions; a seed saves once; only a faster run replaces a best; a pupil is
-- stopped at the daily limit; boards show the own school only and leave out hidden profiles and teachers; the question
-- lists can't be read by pupils and each slot is answered once.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(65);

-- School 1 is Douglas Park (made by the migration). School 2 is made here.
select setval(pg_get_serial_sequence('public.schools', 'id'), 1);
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id) values ('otherschool.school.nz', 2);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cai@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'dee@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'eli@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000001a', 'zed@otherschool.school.nz');
update public.profiles set hidden = true where id = '00000000-0000-0000-0000-00000000000d';
-- Eli is a teacher: teachers never appear on a board.
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000e';

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
-- Saves a run for a pupil: `n` makes the seed, so the same n is the same seed.
create function pg_temp.save(who text, n integer, in_steps integer, in_level text default 'l3',
  in_maths boolean default false, in_daily integer default 20, in_mode text default 'steady') returns text language sql as $$
  select public.record_mine_run(pg_temp.id(who), 'seed-for-run-' || who || '-' || n, in_level, in_mode, in_maths,
    in_steps, 0, 0, '1x' || in_steps, in_daily, null)
$$;

-- ---- Nobody reaches the tables or the saving functions directly ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.mine_runs $$, '42501', null, 'pupils cannot read the runs table');
select throws_ok($$ select * from public.mine_bests $$, '42501', null, 'pupils cannot read the bests table');
select throws_ok($$ insert into public.mine_bests (player, level, mode, steps, inputs)
  values (auth.uid(), 'l3', 'steady', 1, '1x1') $$, '42501', null, 'pupils cannot add a best directly');
select throws_ok($$ select pg_temp.save('0a', 1, 3000) $$, '42501', null, 'pupils cannot call the saving function');
select throws_ok($$ select public.mine_runs_today(auth.uid()) $$, '42501', null, 'pupils cannot ask how many runs anyone has saved');
select pg_temp.reset();
set local role anon;
select throws_ok($$ select public.my_mine() $$, '42501', null, 'signed-out visitors cannot read bests');
select throws_ok($$ select public.mine_board('l3', false) $$, '42501', null, '... or a board');
select pg_temp.reset();

-- ---- Saving (the server only) ----
select pg_temp.act_as_server();
select is(pg_temp.save('0a', 1, 3000), 'first', 'a first run is the pupil''s first finish of the mine');
select is(pg_temp.save('0a', 1, 3000), 'duplicate', 'the same seed again is not counted twice');
select is((select count(*)::integer from public.mine_runs where player = pg_temp.id('0a')), 1, '... and adds no run');
select is(pg_temp.save('0a', 2, 3500), 'saved', 'a slower run is saved but is not a best');
select is((select steps from public.mine_bests where player = pg_temp.id('0a')), 3000, '... and the best stays');
select is(pg_temp.save('0a', 3, 2900), 'best', 'a faster run is a new best (not a first)');
select is((select steps from public.mine_bests where player = pg_temp.id('0a') and level = 'l3'), 2900, '... and replaces the best');
select is((select inputs from public.mine_bests where player = pg_temp.id('0a')), '1x2900', '... with its recorded inputs');
select is(pg_temp.save('0a', 4, 2900), 'saved', 'a tie does not replace the best');
select is(pg_temp.save('0a', 5, 3300, 'l3:hard'), 'first', 'hard mode has its own best');
select is(pg_temp.save('0a', 6, 4000, 'l5'), 'first', 'so does each level');
select is(pg_temp.save('0a', 7, 2500, 'l3', true), 'best', 'so does a run with maths (and it is not a first: the mine was finished already)');
select is((select count(*)::integer from public.mine_bests where player = pg_temp.id('0a')), 4, '... four bests so far');
select is(pg_temp.save('0b', 1, 3000), 'first', 'the same seed text for another pupil is a different seed');

select throws_ok($$ select pg_temp.save('0f', 1, 3000) $$, '22023', null, 'nothing can be saved for someone with no profile');
select throws_ok($$ select pg_temp.save('0a', 8, 0) $$, '23514', null, 'a time of zero is refused');
select throws_ok($$ select pg_temp.save('0a', 8, 3000, 'l9') $$, '23514', null, 'a level that is not one of the mines is refused');
select throws_ok($$ select pg_temp.save('0a', 8, 3000, 'practice') $$, '23514', null, '... the practice mine never counts');
select throws_ok($$ select pg_temp.save('0a', 8, 3000, 'l3', false, 20, 'sideways') $$, '23514', null, 'a flight mode that is not steady or free is refused');
select is(pg_temp.save('0a', 8, 3100, 'l3', false, 20, 'free'), 'saved', 'free flight is accepted');
-- Ana has saved 8 runs so far (seeds 1 to 7, and the free-flight one).
select is(public.mine_runs_today(pg_temp.id('0a')), 8, 'the server can count a pupil''s runs today');
select throws_ok($$ select pg_temp.save('0a', 9, 3000, 'l3', false, 8) $$, '54000', null, 'too many runs in a day asks for a break');
select is(pg_temp.save('0a', 10, 3000, 'l3', false, 9), 'saved', '... and one more is fine below the limit');

-- A board with several pupils. Ana 2900, Ben 3000; add Cai 2500 (fastest), Dee 2000 (hidden), Eli 1500 (teacher), Zed 1000 (other school).
select pg_temp.save('0c', 1, 2500);
select pg_temp.save('0d', 1, 2000);
select pg_temp.save('0e', 1, 1500);
select pg_temp.save('1a', 1, 1000);
select pg_temp.reset();

-- Recorded inputs are only kept for a week.
select pg_temp.reset();
insert into public.mine_runs (player, level, mode, maths, seed, steps, inputs, created_at)
values (pg_temp.id('0b'), 'l5', 'steady', false, 'old-run-seed-1', 5000, '1x5000', now() - interval '8 days');
select pg_temp.act_as_server();
select pg_temp.save('0b', 20, 4000, 'l5');
select pg_temp.reset();
select is((select inputs from public.mine_runs where seed = 'old-run-seed-1'), null, 'a run older than a week loses its recorded inputs when the next run is saved');
select is((select inputs from public.mine_runs where seed = 'seed-for-run-0b-20'), '1x4000', '... and a new run keeps them');

-- ---- Reading ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(jsonb_array_length(public.my_mine()), 4, 'a pupil reads their own bests');
select is(public.my_mine() -> 0 ? 'inputs', false, '... without the inputs');
select is((select jsonb_agg(b ->> 'level' || ':' || (b ->> 'maths')) from jsonb_array_elements(public.my_mine()) b),
  '["l3:false", "l3:true", "l3:hard:false", "l5:false"]'::jsonb, '... and none of anyone else''s');

select is((select jsonb_agg(t ->> 'name') from jsonb_array_elements(public.mine_board('l3', false) -> 'top') t),
  (select jsonb_agg(p.display_name order by x.o) from (values ('0c', 1), ('0a', 2), ('0b', 3)) x(id, o) join public.profiles p on p.id = pg_temp.id(x.id)),
  'the board is fastest first, own school only, hidden profiles and teachers left out');
select is(public.mine_board('l3', false) #>> '{me,rank}', '2', '... and says where the pupil stands');
select is(public.mine_board('l3', false) ->> 'total', '3', '... and how many are on it');
select is(public.mine_board('l3', false) #>> '{top,1,me}', 'true', '... marking which row is the pupil');
select is(public.mine_board('l3', true) ->> 'total', '1', 'the maths board is separate');
select is(public.mine_board('l3:hard', false) ->> 'total', '1', 'so is hard mode');
select is(public.mine_board('l3', false) #>> '{top,0,inputs}', null, 'a board never carries the inputs');
select is((select count(*)::integer from jsonb_object_keys(public.mine_board('l3', false) #> '{top,0}')), 5, '... five things in all, nothing about maths or years');

select pg_temp.act_as('00000000-0000-0000-0000-00000000001a', 'zed@otherschool.school.nz');
select is(public.mine_board('l3', false) ->> 'total', '1', 'another school sees only its own board');
select is(public.my_mine() -> 0 ->> 'steps', '1000', '... and only its own bests');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'someone@gmail.com');
select is(public.mine_board('l3', false), null, 'someone who is not at a school gets no board');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000d', 'dee@douglaspark.school.nz');
select is(public.mine_board('l3', false) #>> '{me,rank}', '1', 'a hidden profile sees their own place on their own board');
select pg_temp.reset();

-- ---- Maths: the teacher's switch ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.teacher_set_mine_maths('on') $$, null, null, 'a pupil cannot change the maths switch');
select is((select mine_maths from public.app_settings limit 1), 'choose', 'the maths switch starts at "students choose"');
select pg_temp.reset();
update public.profiles set role = 'teacher', school_admin = true where id = pg_temp.id('0c');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'cai@douglaspark.school.nz');
select lives_ok($$ select public.teacher_set_mine_maths('on') $$, 'a teacher can switch maths on for everyone');
select is((select mine_maths from public.app_settings limit 1), 'on', '... and it is saved');
select throws_ok($$ select public.teacher_set_mine_maths('sometimes') $$, '22023', null, 'an unknown setting is refused');
select pg_temp.reset();

-- ---- Maths: the question list of a run (the server function only) ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.mine_questions $$, '42501', null, 'pupils cannot read the question lists');
select throws_ok($$ select public.mine_load_run(auth.uid(), 'question-seed-1') $$, '42501', null, 'pupils cannot load a question list');
select throws_ok($$ select public.mine_claim_answer(auth.uid(), 'question-seed-1', 0, 1, true) $$, '42501', null, 'pupils cannot mark an answer');
select pg_temp.act_as_server();
select lives_ok($$ select public.mine_store_run(pg_temp.id('0a'), 'question-seed-1', 'l3', '[{"answer":56},{"answer":48}]') $$, 'the server keeps a run''s questions');
select is(public.mine_load_run(pg_temp.id('0a'), 'question-seed-1') #>> '{questions,1,answer}', '48', '... and loads them back with their answers');
select is(public.mine_load_run(pg_temp.id('0b'), 'question-seed-1'), null, '... but not for another pupil');
select is(public.mine_load_run(pg_temp.id('0a'), 'question-seed-none'), null, 'a run with no list (no maths) loads as nothing');
select is(public.mine_claim_answer(pg_temp.id('0a'), 'question-seed-1', 3, 56, true), true, 'an answer is marked once');
select is(public.mine_claim_answer(pg_temp.id('0a'), 'question-seed-1', 3, 12, false), false, '... and a second answer to the same slot is turned away');
select is(public.mine_load_run(pg_temp.id('0a'), 'question-seed-1') #>> '{answered,3,right}', 'true', '... and the first one stands');
select is(public.mine_claim_answer(pg_temp.id('0b'), 'question-seed-1', 4, 1, true), false, 'another pupil cannot answer this run''s questions');
select throws_ok($$ select public.mine_store_run(pg_temp.id('0a'), 'question-seed-2', 'l3', '[]') $$, '22023', null, 'an empty question list is refused');
select throws_ok($$ select public.mine_store_run(pg_temp.id('0a'), 'question-seed-3', 'nope', '[{"answer":1}]') $$, '23514', null, 'a question list for a level that does not exist is refused');

select * from finish();
rollback;
