-- Dragon Maths: the teacher's topic switches (all on to start, at least one must stay on, checked on the way in,
-- handed to the game and the teacher page, and nothing else about the settings changes).
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000e';

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.topics_of_student() returns text language sql as $$
  select string_agg(t, ',' order by t) from jsonb_array_elements_text(public.lord_settings('00000000-0000-0000-0000-00000000000a') -> 'topics') t
$$;

-- ---- The start: every topic on ----
select is(pg_temp.topics_of_student(), 'add-sub,decimals,division,fractions,money,patterns,place-value,times-tables', 'every topic is on to start');
select is(jsonb_array_length(public.lord_settings('00000000-0000-0000-0000-00000000000a') -> 'topics'), 8, 'all eight');

-- ---- Only a teacher can change them ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.teacher_set_lord('{"enabled":true,"topics":["add-sub"]}') $$, '42501', null, 'a student cannot change the topics');
select pg_temp.reset();

-- ---- A teacher changes them ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select is((select string_agg(t, ',' order by t) from jsonb_array_elements_text(public.teacher_set_lord('{"enabled":true,"topics":["money","add-sub","money"]}') -> 'topics') t),
  'add-sub,money', 'a teacher sets the list (in order, no repeats)');
select pg_temp.reset();
select is(pg_temp.topics_of_student(), 'add-sub,money', 'and the pupil''s class gets it');
select is((select lord_topics from public.app_settings where lord_enabled order by class_id nulls last limit 1), '{add-sub,money}'::text[], 'it is kept on the settings row');

-- ---- Leaving it out leaves it alone; the other settings still work ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select is(public.teacher_set_lord('{"enabled":true,"forestPerDay":7}') ->> 'forestPerDay', '7', 'forest fights a day still saves');
select pg_temp.reset();
select is(pg_temp.topics_of_student(), 'add-sub,money', 'without "topics" the list is left as it was');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select is(public.teacher_set_lord('{"enabled":false}') ->> 'enabled', 'false', 'the switch still works');
select is((public.teacher_set_lord('{"enabled":true}') -> 'topics')::text, '["add-sub", "money"]', 'switching on again keeps the list');

-- ---- Bad lists are refused ----
select throws_ok($$ select public.teacher_set_lord('{"enabled":true,"topics":[]}') $$, '22023', 'Leave at least one topic on.', 'an empty list is refused');
select throws_ok($$ select public.teacher_set_lord('{"enabled":true,"topics":["spelling"]}') $$, '22023', 'Those topics couldn''t be read.', 'a topic that does not exist is refused');
select throws_ok($$ select public.teacher_set_lord('{"enabled":true,"topics":"add-sub"}') $$, '22023', 'Those topics couldn''t be read.', 'so is something that is not a list');
select throws_ok($$ select public.teacher_set_lord('{"enabled":true,"topics":[1,2]}') $$, '22023', 'Those topics couldn''t be read.', 'so is a list of numbers');
select throws_ok($$ select public.teacher_set_lord('{"enabled":true,"topics":null}') $$, '22023', 'Those topics couldn''t be read.', 'so is null');
select throws_ok($$ select public.teacher_set_lord('{"enabled":true,"topics":["add-sub",{"a":1}]}') $$, '22023', 'Those topics couldn''t be read.', 'so is a list with something odd in it');
select pg_temp.reset();
select is(pg_temp.topics_of_student(), 'add-sub,money', 'and a refused list changes nothing');
select throws_ok($$ update public.app_settings set lord_topics = '{}' $$, '23514', null, 'the table itself refuses an empty list');
select throws_ok($$ update public.app_settings set lord_topics = '{spelling}' $$, '23514', null, 'and an unknown topic');

-- ---- All eight can be put back ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select is(jsonb_array_length(public.teacher_set_lord('{"enabled":true,"topics":["place-value","add-sub","times-tables","division","fractions","decimals","money","patterns"]}') -> 'topics'), 8, 'all eight can be put back');
select pg_temp.reset();
select ok(not has_function_privilege('anon', 'public.teacher_set_lord(jsonb, uuid)', 'execute'), 'a signed-out visitor still cannot call it');
select is((select count(*)::integer from pg_proc where proname = 'teacher_set_lord'), 1, 'there is still one teacher_set_lord (no stray older version)');

select * from finish();
rollback;
