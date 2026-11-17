-- A daily and a weekly class quest at the same time (migration 20261118003200_class_quests_two.sql): the teacher can run
-- one of each, not two of one; pupils see both (daily first) on the home page; stopping one leaves the other.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'fox@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000f';
update public.schools set default_class = null;
delete from public.class_members;
delete from public.class_teachers;
insert into public.classes (id, school_id, name, school_year, warp_code) values
  ('11111111-1111-4111-8111-111111111111', 1, 'Room 1', 2026, 'CDFGH');
insert into public.class_members (student_id, class_id, how) values
  ('00000000-0000-0000-0000-00000000000a', '11111111-1111-4111-8111-111111111111', 'teacher');
insert into public.class_teachers (class_id, teacher_id) values ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-00000000000f');

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.running() returns integer language sql as $$
  select count(*)::integer from public.class_quests where stopped_at is null
$$;

-- ---- One of each ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fox@douglaspark.school.nz');
select lives_ok($$ select public.teacher_start_class_quest('11111111-1111-4111-8111-111111111111', 'marble-total') $$,
                'the teacher starts a weekly quest');
select lives_ok($$ select public.teacher_start_class_quest('11111111-1111-4111-8111-111111111111', 'bond-daily') $$,
                '... and a daily one alongside it');
select throws_ok($$ select public.teacher_start_class_quest('11111111-1111-4111-8111-111111111111', 'toonflap-daily') $$, '22023',
                 'This class already has a daily quest running. Stop it first.', '... but not a second daily one');
select throws_ok($$ select public.teacher_start_class_quest('11111111-1111-4111-8111-111111111111', 'trader-planets') $$, '22023',
                 'This class already has a weekly quest running. Stop it first.', '... or a second weekly one');
select pg_temp.reset();

-- ---- Pupils see both, daily first ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(jsonb_array_length(public.my_class_quests()), 2, 'Ana sees both quests');
select is(public.my_class_quests() -> 0 -> 'quest' ->> 'kind', 'bond-daily', '... the daily one first');
select is(public.my_home_page() -> 'classQuests' -> 1 -> 'quest' ->> 'kind', 'marble-total', '... in the home page''s one answer too');
select throws_ok($$ select public.teacher_stop_class_quest('11111111-1111-4111-8111-111111111111', null) $$, '42501', null,
                 'a pupil can''t stop a quest');
select pg_temp.reset();

-- ---- Stopping one leaves the other ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fox@douglaspark.school.nz');
select pg_temp.reset();
select set_config('test.daily', (select id::text from public.class_quests where kind = 'bond-daily'), true);
select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fox@douglaspark.school.nz');
select public.teacher_stop_class_quest('11111111-1111-4111-8111-111111111111', current_setting('test.daily')::uuid);
select pg_temp.reset();
select is(pg_temp.running(), 1, 'stopping the daily quest leaves the weekly one running');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fox@douglaspark.school.nz');
select lives_ok($$ select public.teacher_start_class_quest('11111111-1111-4111-8111-111111111111', 'toonflap-daily') $$,
                '... and a new daily one can start');
select public.teacher_stop_class_quest('11111111-1111-4111-8111-111111111111');
select pg_temp.reset();
select is(pg_temp.running(), 0, 'with no quest named, both stop');

select * from finish();
rollback;
