-- P10: a fact keeps a pupil's last three wrong answers; an answer without `given` still saves.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');

create function pg_temp.answer(batch text, key text, correct boolean, given text) returns integer language sql as $$
  select public.record_fact_answers('00000000-0000-0000-0000-00000000000a', 'times-tables',
    ('00000000-0000-0000-0000-' || lpad(batch, 12, '0'))::uuid,
    jsonb_build_array(case when given is null
      then jsonb_build_object('key', key, 'correct', correct, 'ms', 900, 'at', 1792101600000)
      else jsonb_build_object('key', key, 'correct', correct, 'ms', 900, 'at', 1792101600000, 'given', given) end),
    10000, 2, 4, 0)
$$;
create function pg_temp.wrong(key text) returns text language sql as $$
  select wrong_recent::text from public.gem_keep_facts where player = '00000000-0000-0000-0000-00000000000a' and fact_key = key
$$;

select pg_temp.answer('1', 'mul:7x8', false, '54');
select is(pg_temp.wrong('mul:7x8'), '["54"]', 'a wrong answer with given is remembered');
select pg_temp.answer('2', 'mul:7x8', false, '56');
select pg_temp.answer('3', 'mul:7x8', false, '54');
select pg_temp.answer('4', 'mul:7x8', false, '48');
select is(pg_temp.wrong('mul:7x8'), '["56", "54", "48"]', 'four wrong answers keep the last three, oldest first');
select pg_temp.answer('5', 'mul:7x8', true, '56');
select is(pg_temp.wrong('mul:7x8'), '["56", "54", "48"]', 'a right answer leaves the list alone');
select is(pg_temp.answer('6', 'mul:2x5', false, null), 1, 'a wrong answer without given (an old client) still saves');
select is(pg_temp.wrong('mul:2x5'), '[]', '... and leaves the list empty');

select * from finish();
rollback;
