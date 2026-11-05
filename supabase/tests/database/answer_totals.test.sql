-- The running total of maths questions answered (20261105000800_answer_totals.sql).
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000e';

create function pg_temp.facts(who text, batch text, answers text) returns integer language sql as $$
  select public.record_fact_answers(who::uuid, 'times-tables', ('00000000-0000-0000-0000-' || lpad(batch, 12, '0'))::uuid,
    answers::jsonb, 5000, 2, 4)
$$;
create function pg_temp.counted(src text) returns text language sql as $$
  select coalesce(sum(answered), 0) || '/' || coalesce(sum(correct), 0) from public.answer_totals
  where source = src and day is not distinct from (now() at time zone 'Pacific/Auckland')::date
$$;

select pg_temp.facts('00000000-0000-0000-0000-00000000000a', '1',
  '[{"key":"mul:7x8","correct":false,"ms":3000,"at":1792101600000},{"key":"mul:7x8","correct":true,"ms":2000,"at":1792101600001},
    {"key":"mul:3x3","correct":true,"ms":900,"at":1792101600002}]');
select is(pg_temp.counted('times-tables'), '3/2', 'game answers are counted, new facts and repeats alike');

select pg_temp.facts('00000000-0000-0000-0000-00000000000a', '1', '[{"key":"mul:2x2","correct":true,"ms":900,"at":1792101600003}]');
select pg_temp.facts('00000000-0000-0000-0000-00000000000e', '2', '[{"key":"mul:2x2","correct":true,"ms":900,"at":1792101600003}]');
select is(pg_temp.counted('times-tables'), '3/2', 'a batch sent twice and a teacher''s answers are not counted');

select public.record_training_answers('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 1,
  jsonb_build_array(
    jsonb_build_object('key', 'mul:2x3', 'given', 6, 'correct', true, 'ms', 1500, 'typingMs', 400,
      'day', (now() at time zone 'Pacific/Auckland')::date, 'at', floor(extract(epoch from now()) * 1000)),
    jsonb_build_object('key', 'mul:2x3', 'given', 5, 'correct', false, 'ms', 1500, 'typingMs', 400,
      'day', (now() at time zone 'Pacific/Auckland')::date, 'at', floor(extract(epoch from now()) * 1000))),
  1, 1000);
select is(pg_temp.counted('training'), '2/1', 'training answers are counted, even the ones trimmed straight after');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000e',
  'email', 'mr.teacher@douglaspark.school.nz', 'role', 'authenticated')::text, true);
select public.teacher_new_season('NEW SEASON');
select is(pg_temp.counted('times-tables'), '3/2', 'a new season leaves the total alone');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000a',
  'email', 'ana@douglaspark.school.nz', 'role', 'authenticated')::text, true);
select set_config('role', 'authenticated', true);
select ok((public.hub_answer_totals() ->> 'today')::bigint >= 5, 'a signed-in pupil can read the school total');
select throws_ok($$ select * from public.answer_totals $$, '42501', null, 'nobody reads the table directly');

select * from finish();
rollback;
