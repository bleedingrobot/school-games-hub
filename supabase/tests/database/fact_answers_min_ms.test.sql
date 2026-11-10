-- S14: a right answer faster than min_ms is saved but is not quick (its box and quick days stay); the default of 0 keeps
-- the old behaviour for every caller that sends seven arguments.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');

create function pg_temp.answer(batch text, key text, correct boolean, ms integer, min_ms integer) returns integer language sql as $$
  select public.record_fact_answers('00000000-0000-0000-0000-00000000000a', 'times-tables',
    ('00000000-0000-0000-0000-' || lpad(batch, 12, '0'))::uuid,
    jsonb_build_array(jsonb_build_object('key', key, 'correct', correct, 'ms', ms, 'at', 1792101600000)), 10000, 2, 4, min_ms)
$$;
create function pg_temp.record(key text) returns text language sql as $$
  select attempts || '/' || correct || '/' || avg_ms || '/' || box || '/' || quick_days::text
  from public.gem_keep_facts where player = '00000000-0000-0000-0000-00000000000a' and fact_key = key
$$;

select is(pg_temp.answer('1', 'mul:2x5', true, 50, 600), 1, 'a fast right answer is added');
select is(pg_temp.record('mul:2x5'), '1/1/50/0/{}', '... with its time, but its box and quick days stay');
select pg_temp.answer('2', 'mul:2x5', true, 700, 600);
select is(pg_temp.record('mul:2x5'), '2/2/375/1/{2026-10-16}', 'at 700 ms it is quick: up a box');
select pg_temp.answer('3', 'mul:2x5', false, 50, 600);
select is(pg_temp.record('mul:2x5'), '3/2/267/1/{2026-10-16}', 'a wrong answer is the same as ever');

-- The old seven-argument call (no min_ms) still counts a fast answer as quick.
select is(public.record_fact_answers('00000000-0000-0000-0000-00000000000a', 'times-tables', '00000000-0000-0000-0000-0000000000b1',
  '[{"key":"mul:3x3","correct":true,"ms":50,"at":1792101600000}]', 10000, 2, 4), 1, 'seven arguments still work');
select is(pg_temp.record('mul:3x3'), '1/1/50/1/{2026-10-16}', '... and, with the default 0, a fast right answer moves up');

select * from finish();
rollback;
