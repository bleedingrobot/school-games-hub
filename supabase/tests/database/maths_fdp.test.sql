-- Maths focus F.6: the fraction, decimal and percentage question types (61 of them) are kept in the same table and pack as the
-- F.5 ones, and the nine "ten and" facts in early-facts, with NO migration: the key check F.3 widened already accepts them.
-- Checks every new key is accepted, keys that do not fit (a percent sign, a capital, a point, a slash-less typo) are refused, the
-- records follow the Leitner rules, only the server writes them, and Gem Keep and Mission Control are handed them (never Maths
-- Monsters' own). Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');

create function pg_temp.as_student(id uuid, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true)
$$;
create function pg_temp.answer(player uuid, batch text, key text, correct boolean, ms integer, at bigint, pack text default 'generated') returns integer language sql as $$
  select public.record_fact_answers(player, pack, ('00000000-0000-0000-0000-' || lpad(batch, 12, '0'))::uuid,
    jsonb_build_array(jsonb_build_object('key', key, 'correct', correct, 'ms', ms, 'at', at)), 8000, 2, 4)
$$;

create temp table keys as select k from unnest(array['fracof:half', 'fracof:third', 'fracof:quarter', 'fracof:fifth', 'fracof:tenth', 'fracof:big', 'tenth:to-fraction', 'tenth:to-decimal', 'tenth:divide', 'tenth:count', 'tenth:half', 'addten:add', 'addten:carry', 'addten:take', 'addten:borrow', 'addten:whole', 'addten:to-one', 'deceq:common', 'deceq:pick', 'deceq:hundredths', 'deceq:to-fraction', 'deceq:compare', 'pct:half', 'pct:ten', 'pct:quarter', 'pct:to-fraction', 'pct:from-fraction', 'pct:to-decimal', 'fracof:non:thirds', 'fracof:non:quarters', 'fracof:non:fifths', 'fracof:non:sixths', 'fracof:non:eighths', 'fracof:non:tenths', 'timesdec:ten', 'timesdec:hundred', 'timesdec:div-ten', 'timesdec:div-hundred', 'timesdec:missing', 'equiv:missing-top', 'equiv:missing-bottom', 'equiv:same-as', 'equiv:simplify', 'equiv:simplify-blank', 'fdp:frac-to-pct', 'fdp:pct-to-frac', 'fdp:dec-to-pct', 'fdp:pct-to-dec', 'fdp:match', 'pct:one', 'pct:twenty', 'pct:three-quarters', 'pct:big', 'pct:whole:ten', 'pct:whole:fifty', 'pct:whole:quarter', 'whole:half', 'whole:unit', 'whole:thirds', 'whole:quarters', 'whole:other']) as k;
select is((select count(*)::integer from keys), 61, 'there are 61 new question types');
select is((select count(*)::integer from keys where k !~ '^[a-z][a-z0-9]{0,9}:[a-z0-9:+/-]{1,40}$'), 0, 'every key fits the shape the database allows');
select is(
  (select sum(public.record_fact_answers('00000000-0000-0000-0000-00000000000a', 'generated', gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('key', k, 'correct', true, 'ms', 2500, 'at', 1792101600000)), 8000, 2, 4))::integer from keys),
  61, 'an answer for each is stored under the pack "generated"');
select is(
  (select sum(public.record_fact_answers('00000000-0000-0000-0000-00000000000a', 'early-facts', gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('key', 'tenand:' || n, 'correct', true, 'ms', 2500, 'at', 1792101600000)), 5000, 2, 4))::integer from generate_series(1, 9) n),
  9, 'and each ten-and fact under early-facts');
select is((select count(*)::integer from public.gem_keep_facts where player = '00000000-0000-0000-0000-00000000000a'), 70, 'one record each');

select throws_ok($$ select pg_temp.answer('00000000-0000-0000-0000-00000000000a', '1001', 'pct:50%', true, 1000, 1792101600000) $$, '23514', null, 'a percent sign in a key is refused');
select throws_ok($$ select pg_temp.answer('00000000-0000-0000-0000-00000000000a', '1002', 'Pct:half', true, 1000, 1792101600000) $$, '23514', null, 'a capital is refused');
select throws_ok($$ select pg_temp.answer('00000000-0000-0000-0000-00000000000a', '1003', 'pct:0.5', true, 1000, 1792101600000) $$, '23514', null, 'a decimal point is refused');
select throws_ok($$ select pg_temp.answer('00000000-0000-0000-0000-00000000000a', '1004', 'fraction-of:half', true, 1000, 1792101600000) $$, '23514', null, 'a first word over 10 characters is refused');

select pg_temp.answer('00000000-0000-0000-0000-00000000000b', '2001', 'fdp:match', true, 7500, 1792101600000);
select pg_temp.answer('00000000-0000-0000-0000-00000000000b', '2002', 'fdp:match', true, 7500, 1792101600001);
select is((select box from public.gem_keep_facts where player = '00000000-0000-0000-0000-00000000000b' and fact_key = 'fdp:match'), 2, 'two right answers inside 8 seconds: box 2');

select pg_temp.as_student('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select throws_ok($$ select pg_temp.answer('00000000-0000-0000-0000-00000000000b', '3001', 'pct:half', true, 1000, 1792101600000) $$, '42501', null, 'a student cannot add answers directly');
select is(public.my_gem_keep() -> 'facts' -> 0 ->> 'key', 'fdp:match', 'Gem Keep is handed the record');
select pg_temp.reset();
select is(jsonb_array_length(public.space_maths_context('00000000-0000-0000-0000-00000000000a') -> 'facts'), 70, 'Mission Control is handed all of one player''s');
select is(jsonb_array_length(public.space_maths_context('00000000-0000-0000-0000-00000000000b') -> 'facts'), 1, 'and each player only their own');

select * from finish();
rollback;
