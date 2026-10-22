-- Maths focus F.5: records for the generated skills (bonds, rounding, times with tens, factors, squares, order of operations).
-- They are kept per question TYPE ("round:100:3digit", "bedmas:brackets-first") in gem_keep_facts under the pack "generated".
-- Checks that every key the games can ask is accepted, that bad keys and pack names are refused, that only the server writes
-- the records, that Gem Keep and Mission Control are handed them (and not Maths Monsters' own), and that each student sees only
-- their own. Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

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
    jsonb_build_array(jsonb_build_object('key', key, 'correct', correct, 'ms', ms, 'at', at)), 5000, 2, 4)
$$;

-- ---- Every key the games ask is accepted ----
create temp table keys as select k from unnest(array['bond100:tens', 'bond100:fives', 'bond100:any', 'bond100:take', 'bond1000:hundreds', 'bond1000:fifties', 'bond1000:tens', 'bond1000:take', 'times:tens', 'times:hundreds', 'times:tens-tens', 'times:shift', 'times:powers', 'times:div-tens', 'factor:pair', 'factor:count', 'factor:largest', 'factor:common', 'square:of', 'cube:of', 'square:root', 'cube:root', 'square:next', 'round:10:2digit', 'round:10:3digit', 'round:10:halfway', 'round:10:near-halfway', 'round:100:3digit', 'round:100:4digit', 'round:100:halfway', 'round:100:near-halfway', 'round:1000:4digit', 'round:1000:5digit', 'round:1000:halfway', 'round:1000:near-halfway', 'round:10000:5digit', 'round:10000:halfway', 'round:100000:6digit', 'round:100000:halfway', 'round:whole:tenths', 'round:whole:hundredths', 'round:whole:halfway', 'round:tenth:hundredths', 'round:tenth:halfway', 'round:1000000:7digit', 'round:1000000:halfway', 'round:1000000:near-halfway', 'round:100000:7digit', 'round:hundredth:thousandths', 'round:hundredth:halfway', 'bedmas:mul-first', 'bedmas:div-first', 'bedmas:left-to-right', 'bedmas:brackets-first', 'bedmas:brackets-div', 'bedmas:mixed', 'bedmas:mixed-brackets']) as k;
select is((select count(*)::integer from keys), 57, 'there are 57 question types in the ladder');
select is(
  (select sum(public.record_fact_answers('00000000-0000-0000-0000-00000000000a', 'generated', gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('key', k, 'correct', true, 'ms', 1500, 'at', 1792101600000)), 5000, 2, 4))::integer from keys),
  57, 'an answer for each of them is stored under the pack "generated"');
select is((select count(*)::integer from public.gem_keep_facts where player = '00000000-0000-0000-0000-00000000000a' and pack = 'generated'), 57, 'one record each');
select is((select count(*)::integer from keys where k !~ '^[a-z][a-z0-9]{0,9}:[a-z0-9:+/-]{1,40}$'), 0, 'every key fits the shape the database allows');
select is((select max(length(k)) from keys) <= 50, true, 'and none is near the length limit');

-- ---- Keys and pack names that do not fit are refused ----
select throws_ok($$ select pg_temp.answer('00000000-0000-0000-0000-00000000000a', '1001', 'Round:100:3digit', true, 1000, 1792101600000) $$, '23514', null, 'capital letters are refused');
select throws_ok($$ select pg_temp.answer('00000000-0000-0000-0000-00000000000a', '1002', 'round:100.5', true, 1000, 1792101600000) $$, '23514', null, 'a decimal point in a key is refused');
select throws_ok($$ select pg_temp.answer('00000000-0000-0000-0000-00000000000a', '1003', 'round', true, 1000, 1792101600000) $$, '23514', null, 'a key with no colon is refused');
select throws_ok($$ select pg_temp.answer('00000000-0000-0000-0000-00000000000a', '1004', 'bondsandtimes:tens', true, 1000, 1792101600000) $$, '23514', null, 'a first word longer than 10 characters is refused');
select throws_ok($$ select pg_temp.answer('00000000-0000-0000-0000-00000000000a', '1005', '1round:tens', true, 1000, 1792101600000) $$, '23514', null, 'a key that starts with a digit is refused');
select throws_ok($$ select pg_temp.answer('00000000-0000-0000-0000-00000000000a', '1006', 'round:' || repeat('a', 41), true, 1000, 1792101600000) $$, '23514', null, 'a key with more than 40 characters after the colon is refused');
select throws_ok($$ select pg_temp.answer('00000000-0000-0000-0000-00000000000a', '1007', 'round:100:3digit', true, 1000, 1792101600000, 'Generated') $$, '23514', null, 'a pack name with a capital is refused');

-- ---- Records are made by the Leitner rules, per question type ----
select pg_temp.answer('00000000-0000-0000-0000-00000000000b', '2001', 'round:100:3digit', true, 1500, 1792101600000);
select pg_temp.answer('00000000-0000-0000-0000-00000000000b', '2002', 'round:100:3digit', true, 1500, 1792101600001);
select is((select box from public.gem_keep_facts where player = '00000000-0000-0000-0000-00000000000b' and fact_key = 'round:100:3digit'), 2, 'two quick right answers: box 2');
select pg_temp.answer('00000000-0000-0000-0000-00000000000b', '2003', 'round:100:3digit', false, 1500, 1792101600002);
select is((select box from public.gem_keep_facts where player = '00000000-0000-0000-0000-00000000000b' and fact_key = 'round:100:3digit'), 1, 'a wrong answer: back to box 1');

-- ---- Only the server writes them ----
select pg_temp.as_student('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select throws_ok($$ select pg_temp.answer('00000000-0000-0000-0000-00000000000b', '3001', 'round:100:3digit', true, 1000, 1792101600000) $$, '42501', null, 'a student cannot add answers directly');
select throws_ok($$ insert into public.gem_keep_facts (player, pack, fact_key, attempts, correct, avg_ms, box) values ('00000000-0000-0000-0000-00000000000b', 'generated', 'bedmas:mixed', 9, 9, 100, 4) $$, '42501', null, 'nor write a record themselves');

-- ---- Gem Keep and Mission Control are handed them ----
select pg_temp.reset();
insert into public.gem_keep_facts (player, pack, fact_key, attempts, correct, avg_ms, box) values
  ('00000000-0000-0000-0000-00000000000b', 'place-value', 'pv:round10', 4, 4, 2000, 2); -- Maths Monsters' own record of rounding
select pg_temp.as_student('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is(jsonb_array_length(public.my_gem_keep() -> 'facts'), 1, 'Gem Keep gets the generated records (and not Maths Monsters'' own)');
select is(public.my_gem_keep() -> 'facts' -> 0 ->> 'key', 'round:100:3digit', 'the question type, with its box');
select pg_temp.reset();
select is(jsonb_array_length(public.space_maths_context('00000000-0000-0000-0000-00000000000a') -> 'facts'), 57, 'Mission Control gets them too, for the player asked about');
select is(jsonb_array_length(public.space_maths_context('00000000-0000-0000-0000-00000000000b') -> 'facts'), 1, 'and each player gets only their own');

select * from finish();
rollback;
