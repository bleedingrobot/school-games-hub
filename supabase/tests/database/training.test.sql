-- Basic facts training T.2: saving and reading training answers.
-- Students can't touch the tables or the saving functions; they read only their own through
-- my_training(); a batch sent twice counts once; bad dates and sizes are refused; only the newest
-- answers of each fact are kept; a teacher reads one student through teacher_training_student().
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
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
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000000' || who)::uuid $$;
create function pg_temp.batch(n integer) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
-- One answer for a fact, `ago` seconds ago, on the New Zealand day it happened.
create function pg_temp.answer(key text, given integer, ms integer, ago integer default 60) returns jsonb language sql as $$
  select jsonb_build_object('key', key, 'given', given, 'correct', given = 42, 'ms', ms, 'typingMs', 900,
    'day', to_char(((now() - make_interval(secs => ago)) at time zone 'Pacific/Auckland')::date, 'YYYY-MM-DD'),
    'at', (extract(epoch from now() - make_interval(secs => ago)) * 1000)::bigint)
$$;
create function pg_temp.save(who text, batch integer, answers jsonb, keep integer default 30, daily integer default 600)
returns integer language sql as $$
  select public.record_training_answers(pg_temp.id(who), pg_temp.batch(batch), 777, answers, keep, daily)
$$;
create function pg_temp.rows(who text) returns integer language sql as $$
  select count(*)::integer from public.training_answers where player = pg_temp.id(who) $$;

-- ---- Nobody reaches the tables or the saving functions directly ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.training_answers $$, '42501', null, 'students cannot read the answers table');
select throws_ok($$ insert into public.training_answers (player, batch_id, seed, fact_key, given, correct, answer_ms, typing_ms, day, answered_at)
  values (auth.uid(), gen_random_uuid(), 1, 'mul:6x7', 42, true, 1000, 500, current_date, now()) $$,
  '42501', null, 'students cannot add answers directly');
select throws_ok($$ select * from public.training_students $$, '42501', null, 'students cannot read the settings table');
select throws_ok($$ select * from public.training_answer_batches $$, '42501', null, 'students cannot read the batch ids');
select throws_ok($$ select pg_temp.save('a', 1, jsonb_build_array(pg_temp.answer('mul:6x7', 42, 2000))) $$,
  '42501', null, 'students cannot call the saving function');
select throws_ok($$ select public.record_training_student(auth.uid(), '{}', true, 1) $$,
  '42501', null, 'students cannot save settings directly');
select pg_temp.reset();

-- ---- Saving (the server only) ----
select pg_temp.act_as_server();
select is(pg_temp.save('a', 1, jsonb_build_array(pg_temp.answer('mul:6x7', 42, 2000, 120), pg_temp.answer('mul:6x7', 41, 5000, 60))),
  2, 'a batch adds every answer in it');
select is(pg_temp.save('a', 1, jsonb_build_array(pg_temp.answer('mul:6x7', 42, 2000, 120), pg_temp.answer('mul:6x7', 41, 5000, 60))),
  0, 'the same batch again is not counted twice');
select is(pg_temp.rows('a'), 2, '... and adds no rows');
select is(pg_temp.save('a', 2, jsonb_build_array(pg_temp.answer('div:42/6', 7, 3000, 30))), 1, 'a new batch is counted');
select is(pg_temp.save('b', 1, jsonb_build_array(pg_temp.answer('mul:2x5', 10, 1500))), 1, 'the same batch id for another student is a different batch');

select throws_ok($$ select pg_temp.save('d', 9, jsonb_build_array(pg_temp.answer('mul:6x7', 42, 2000))) $$,
  '22023', null, 'answers cannot be saved for someone who has no profile');
select throws_ok($$ select pg_temp.save('a', 3, jsonb_build_array(pg_temp.answer('not a fact', 42, 2000))) $$,
  '23514', null, 'a fact key that is not shaped like one is refused');
select throws_ok($$ select pg_temp.save('a', 3, jsonb_build_array(pg_temp.answer('mul:6x7', 42, -5))) $$,
  '23514', null, 'a negative time is refused');
select throws_ok($$ select pg_temp.save('a', 3, jsonb_build_array(pg_temp.answer('mul:6x7', 42, 700000))) $$,
  '23514', null, 'a silly time is refused');
select throws_ok($$ select pg_temp.save('a', 3, jsonb_build_array(pg_temp.answer('mul:6x7', 42, 2000, -7200))) $$,
  '22023', null, 'an answer from the future is refused');
select throws_ok($$ select pg_temp.save('a', 3, jsonb_build_array(pg_temp.answer('mul:6x7', 42, 2000, 40 * 86400))) $$,
  '22023', null, 'an answer from long ago is refused');
select throws_ok($$ select pg_temp.save('a', 3, jsonb_build_array(
  pg_temp.answer('mul:6x7', 42, 2000) || '{"day":"2020-01-01"}')) $$,
  '22023', null, 'a day that does not fit the time is refused');
select is(pg_temp.rows('a'), 3, 'nothing from the refused batches was kept');
select is(pg_temp.save('a', 3, jsonb_build_array(pg_temp.answer('mul:6x7', 42, 2000))), 1,
  'a refused batch’s id is not used up: it can be sent again, fixed');

-- Only the newest answers of each fact are kept.
select pg_temp.save('b', 20, (select jsonb_agg(pg_temp.answer('mul:3x4', 12, 1000 + n, 600 - n)) from generate_series(1, 5) n), 3);
select is((select count(*)::integer from public.training_answers where player = pg_temp.id('b') and fact_key = 'mul:3x4'), 3,
  'only the newest answers of a fact are kept');
select is((select min(answer_ms) from public.training_answers where player = pg_temp.id('b') and fact_key = 'mul:3x4'), 1003,
  '... the oldest ones go');
select is((select count(*)::integer from public.training_answers where player = pg_temp.id('b') and fact_key = 'mul:2x5'), 1,
  '... and other facts are left alone');

-- A day's limit.
select throws_ok($$ select pg_temp.save('b', 21, (select jsonb_agg(pg_temp.answer('mul:2x2', 4, 1000)) from generate_series(1, 4)), 30, 5) $$,
  '54000', null, 'too many answers in a day asks for a break');

-- Settings.
select lives_ok($$ select public.record_training_student(pg_temp.id('a'), '{"1":[600],"2":[900,950]}', false, 3) $$, 'settings are saved');
select public.record_training_student(pg_temp.id('a'), '{"2":[1000]}', true, 1);
select is((select sessions_done from public.training_students where player = pg_temp.id('a')), 3,
  'the sessions count only goes up');
select throws_ok($$ select public.record_training_student(pg_temp.id('a'), '[600]', true, 1) $$, '23514', null, 'typing times must be an object');
select pg_temp.reset();

-- ---- Reading ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(jsonb_array_length(public.my_training() -> 'answers'), 4, 'a student reads their own answers');
select is((select jsonb_agg(a ->> 'key') from jsonb_array_elements(public.my_training() -> 'answers') a),
  '["mul:6x7", "mul:6x7", "mul:6x7", "div:42/6"]'::jsonb, '... oldest first, none of Ben’s');
select is(public.my_training() #>> '{student,autoSubmit}', 'true', '... and their settings');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'someone@gmail.com');
select is(public.my_training(), null, 'someone who is not at the school gets nothing');
select pg_temp.reset();

-- ---- Teachers ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.teacher_training_student(pg_temp.id('b')) $$, '42501', null, 'a student cannot read another student’s training');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select is(jsonb_array_length(public.teacher_training_student(pg_temp.id('b')) -> 'answers'), 4, 'a teacher reads a student’s training');
select pg_temp.reset();

select * from finish();
rollback;
