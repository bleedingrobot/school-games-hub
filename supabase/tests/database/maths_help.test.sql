-- Help me H1 (docs/plans/help-me/PLAN.md): the answer saved after a pupil opens Help me changes nothing in the records and is
-- kept in maths_help_uses; the next one counts as usual. Cancel forgets an opened help.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'fin@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000f';
select set_config('test.ana_class', (select class_id::text from public.class_members
  where student_id = '00000000-0000-0000-0000-00000000000a'), true);

create function pg_temp.answer(batch text, key text, correct boolean) returns integer language sql as $$
  select public.record_fact_answers('00000000-0000-0000-0000-00000000000a', 'times-tables',
    ('00000000-0000-0000-0000-' || lpad(batch, 12, '0'))::uuid,
    jsonb_build_array(jsonb_build_object('key', key, 'correct', correct, 'ms', 900,
      'at', (extract(epoch from now()) * 1000)::bigint + 1000)),
    10000, 2, 4, 0)
$$;
create function pg_temp.attempts(key text) returns integer language sql as $$
  select coalesce((select attempts from public.gem_keep_facts
    where player = '00000000-0000-0000-0000-00000000000a' and fact_key = key), 0)
$$;

-- The pupil's own calls.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select lives_ok($$ select public.maths_help_opened('tables') $$, 'a pupil can say they opened Help me');
select throws_ok($$ select * from public.maths_help_uses $$, '42501', null, 'a pupil cannot read the helped answers');
reset role;

select is(pg_temp.answer('1', 'mul:7x8', true), 0, 'the answer after Help me is not saved to the records');
select is(pg_temp.attempts('mul:7x8'), 0, '... and the fact has no attempt');
select is((select count(*)::integer from public.maths_help_uses where fact_key = 'mul:7x8' and kind = 'tables' and correct), 1,
  '... it is kept as a helped answer');
select is(pg_temp.answer('2', 'mul:7x8', true), 1, 'the next answer counts as usual');
select is(pg_temp.attempts('mul:7x8'), 1, '... and adds an attempt');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select public.maths_help_opened('tables');
select public.maths_help_cancel();
reset role;
select is(pg_temp.answer('3', 'mul:6x8', false), 1, 'after a cancel (the box closed unanswered) the next answer counts');
select is(pg_temp.attempts('mul:6x8'), 1, '... and a wrong one is recorded');

-- H9: the teacher sees who used Help me; a pupil can't.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select throws_ok(format($$ select public.teacher_help_uses(%L) $$, current_setting('test.ana_class')), '42501', null,
  'a pupil cannot see the class''s helped answers');
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000f", "email": "fin@douglaspark.school.nz", "role": "authenticated"}';
select is(jsonb_array_length(public.teacher_help_uses(current_setting('test.ana_class')::uuid)), 1, 'the teacher sees one pupil');
select is((public.teacher_help_uses(current_setting('test.ana_class')::uuid) -> 0) - 'id' - 'name' - 'realName' - 'lastAt',
  '{"helped": 1, "right": 1, "days": 1, "topKeys": ["mul:7x8"]}'::jsonb, '... with one helped answer, right, on 7 x 8');
reset role;

select * from finish();
rollback;
