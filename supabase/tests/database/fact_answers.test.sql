-- Mission Control maths M.1: times-table records built from each answer, by the same rules as
-- shared/maths/leitner.ts. The expected records below were worked out with `afterAnswer`.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000e';

create function pg_temp.answer(batch text, correct boolean, ms integer, at bigint) returns integer language sql as $$
  select public.record_fact_answers('00000000-0000-0000-0000-00000000000a', 'times-tables',
    ('00000000-0000-0000-0000-' || lpad(batch, 12, '0'))::uuid,
    jsonb_build_array(jsonb_build_object('key', 'mul:7x8', 'correct', correct, 'ms', ms, 'at', at)), 5000, 2, 4)
$$;
create function pg_temp.record() returns text language sql as $$
  select attempts || '/' || correct || '/' || avg_ms || '/' || box || '/' || quick_days::text
  from public.gem_keep_facts where player = '00000000-0000-0000-0000-00000000000a' and fact_key = 'mul:7x8'
$$;

select throws_ok($$ select set_config('role', 'authenticated', true); select pg_temp.answer('1', true, 1000, 0) $$,
  '42501', null, 'students cannot add answers directly');
select set_config('role', 'postgres', true);

select is(pg_temp.answer('1', false, 4000, 1792101600000), 1, 'an answer is added');
select is(pg_temp.record(), '1/0/4000/1/{}', 'wrong: box 1');
select is(pg_temp.answer('1', true, 1000, 1792101600001), 0, 'the same batch again is not counted twice');
select is(pg_temp.answer('2', true, 3000, 1792101600001), 1, '... but a new batch is');
select is(pg_temp.record(), '2/1/3500/2/{2026-10-16}', 'right and quick: up a box, the day kept');
select pg_temp.answer('3', true, 6000, 1792101600002);
select is(pg_temp.record(), '3/2/4333/2/{2026-10-16}', 'right but slow: same box');
select pg_temp.answer('4', true, 2000, 1792101600003);
select is(pg_temp.record(), '4/3/3750/3/{2026-10-16}', 'box 3 is as high as one day goes');
select pg_temp.answer('5', true, 1500, 1792188000000);
select is(pg_temp.record(), '5/4/3300/4/{2026-10-16,2026-10-17}', 'a second quick day: fluent');
select pg_temp.answer('6', true, 1200, 1792188000001);
select pg_temp.answer('7', true, 1000, 1792274400000);
select is(pg_temp.record(), '7/6/2671/4/{2026-10-17,2026-10-18}', 'only the last two quick days are kept');
select pg_temp.answer('8', false, 2500, 1792274400001);
select is(pg_temp.record(), '8/6/2650/1/{2026-10-17,2026-10-18}', 'wrong again: back to box 1');

-- Several answers in one batch, in order.
select is(public.record_fact_answers('00000000-0000-0000-0000-00000000000a', 'times-tables',
  '00000000-0000-0000-0000-0000000000b1', '[{"key":"mul:2x5","correct":false,"ms":3000,"at":1792101600000},
    {"key":"mul:2x5","correct":true,"ms":2000,"at":1792101600001},{"key":"mul:3x3","correct":true,"ms":900,"at":1792101600002}]',
  5000, 2, 4), 3, 'a batch adds every answer in it');
select is((select box from public.gem_keep_facts where player = '00000000-0000-0000-0000-00000000000a' and fact_key = 'mul:2x5'),
  2, 'in order: wrong (box 1), then right (box 2)');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000e',
  'email', 'mr.teacher@douglaspark.school.nz', 'role', 'authenticated')::text, true);
select public.teacher_new_season('NEW SEASON');
select is((select count(*)::integer from public.fact_answer_batches), 0, 'a new season forgets the batches too');

select * from finish();
rollback;
