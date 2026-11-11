-- R7 Stage 1 / game kit K5 (migration 20261107000100): the teacher's Foundational views. A teacher gets their own class's
-- pupils and nobody else's; another class's teacher, a student and a signed-out visitor are refused with 42501, exactly as for
-- teacher_class_skill_map.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

create function pg_temp.uid(n integer) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;
-- Students 1, 2, 3 and teachers 11 (class A: pupils 1 and 3) and 12 (class B: pupil 2).
insert into auth.users (id, email)
select pg_temp.uid(n), 's' || n || '@douglaspark.school.nz' from generate_series(1, 3) n;
insert into auth.users (id, email) values
  (pg_temp.uid(11), 't11@douglaspark.school.nz'), (pg_temp.uid(12), 't12@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id in (pg_temp.uid(11), pg_temp.uid(12));
-- New pupils start in the school's default class, and teacher_add_to_class only takes pupils who have no class.
update public.schools set default_class = null;
delete from public.class_members;

create temp table emails as select id, email from auth.users;
grant select on emails to public;
create function pg_temp.as(n integer) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(n),
           'email', (select e.email from pg_temp.emails e where e.id = pg_temp.uid(n)), 'role', 'authenticated')::text, true)
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create temp table made (name text primary key, id uuid);
grant all on made to authenticated, anon;
create function pg_temp.klass(n text) returns uuid language sql as $$ select id from pg_temp.made where name = n $$;

select pg_temp.as(11);
insert into pg_temp.made values ('A', public.teacher_create_class('Room 12', 2026, 5));
select pg_temp.as(12);
insert into pg_temp.made values ('B', public.teacher_create_class('Room 14', 2026, null));
select pg_temp.as(11);
select public.teacher_add_to_class(pg_temp.klass('A'), array[pg_temp.uid(1), pg_temp.uid(3)]);
select pg_temp.as(12);
select public.teacher_add_to_class(pg_temp.klass('B'), array[pg_temp.uid(2)]);
select pg_temp.reset();

-- Pupil 1 has played Hop (two finished challenges and one still open) and Beanstalk, and done some Quick looks.
-- Pupil 2 (class B) has played Hop. Pupil 3 has played nothing.
insert into public.hop_progress (player, days_done, last_pad_day, reached) values
  (pg_temp.uid(1), 7, '2026-11-05', 5), (pg_temp.uid(2), 3, '2026-11-05', 10);
insert into public.hop_rounds (player, seed, step, gold, hops, open, taps, mistakes, started_at, finished_at) values
  (pg_temp.uid(1), 1, 5, false, '[1,2,3,4,5,6,7,8,9,10]', false, '[1,2,3]', 11, '2026-11-04 01:00+00', '2026-11-04 01:05+00'),
  (pg_temp.uid(1), 2, 5, false, '[1,2,3,4,5,6,7,8,9,10]', false, '[1,2]', 0, '2026-11-05 01:00+00', '2026-11-05 01:05+00'),
  (pg_temp.uid(1), 3, 5, false, '[1,2,3,4,5,6,7,8,9,10]', true, null, null, '2026-11-06 01:00+00', null),
  (pg_temp.uid(2), 4, 10, false, '[1,2,3,4,5,6,7,8,9,10]', false, '[1]', 2, '2026-11-05 01:00+00', '2026-11-05 01:05+00');
insert into public.beanstalk_progress (player, child, days_done, last_leaf_day) values (pg_temp.uid(1), 'jill', 31, '2026-11-05');
insert into public.training_students (player, typing, sessions_done) values
  (pg_temp.uid(1), '{"q":{"p":1,"s":1,"f":4,"g":0,"v":2}}', 6),
  (pg_temp.uid(2), '{"q":{"p":1,"s":1,"f":7,"g":0,"v":2}}', 9);
insert into public.training_answers (player, batch_id, seed, fact_key, given, correct, answer_ms, typing_ms, day, answered_at) values
  (pg_temp.uid(1), gen_random_uuid(), 1, 'sub:line-5', 5, true, 900, 300, '2026-11-05', now() - interval '3 days'),
  (pg_temp.uid(1), gen_random_uuid(), 1, 'sub:line-6', 5, false, 1500, 300, '2026-11-05', now() - interval '2 days'),
  (pg_temp.uid(1), gen_random_uuid(), 1, 'gap:frame-4', 6, true, 1100, 300, '2026-11-05', now() - interval '1 day'),
  (pg_temp.uid(1), gen_random_uuid(), 1, 'subh:line-7', 7, true, 2500, 300, '2026-11-05', now()),
  (pg_temp.uid(2), gen_random_uuid(), 1, 'sub:line-5', 5, true, 900, 300, '2026-11-05', now());

-- P4: pupil 1 is on Robin step 3 with one good go; the step-3 run began on 5 Nov (NZ), after a step-2 round on 3 Nov.
insert into public.robin_progress (player, days_done, last_day, step, good_at_step) values (pg_temp.uid(1), 4, '2026-11-08', 3, 1);
insert into public.robin_rounds (player, seed, round, open, taps, mistakes, started_at, finished_at) values
  (pg_temp.uid(1), 1, '{"step":2}', false, '[1]', 0, '2026-11-03 01:00+00', '2026-11-03 01:05+00'),
  (pg_temp.uid(1), 2, '{"step":3}', false, '[1]', 0, '2026-11-05 01:00+00', '2026-11-05 01:05+00'),
  (pg_temp.uid(1), 3, '{"step":3}', false, '[1]', 0, '2026-11-06 01:00+00', '2026-11-06 01:05+00'),
  (pg_temp.uid(1), 4, '{"step":3}', false, '[1]', 0, '2026-11-08 01:00+00', '2026-11-08 01:05+00');

-- ---- A teacher gets their own class ----
select pg_temp.as(11);
select is((select array_agg(k order by k) from jsonb_object_keys(public.teacher_foundational_class(pg_temp.klass('A'))) k),
  array[pg_temp.uid(1)::text, pg_temp.uid(3)::text], 'the games view holds the pupils of that class, and no one from another class');
select is(public.teacher_foundational_class(pg_temp.klass('A')) #>> array[pg_temp.uid(1)::text, 'hop', 'level'], '5', 'a pupil''s level in a game');
select is(public.teacher_foundational_class(pg_temp.klass('A')) #>> array[pg_temp.uid(1)::text, 'hop', 'daysDone'], '7', 'and their days done');
select is(jsonb_array_length(public.teacher_foundational_class(pg_temp.klass('A')) #> array[pg_temp.uid(1)::text, 'hop', 'recent']), 2, 'only finished challenges come with it');
select is(public.teacher_foundational_class(pg_temp.klass('A')) #>> array[pg_temp.uid(1)::text, 'hop', 'recent', '0', 'm'], '0', 'newest first, with the wrong taps');
select is(public.teacher_foundational_class(pg_temp.klass('A')) #>> array[pg_temp.uid(1)::text, 'robin', 'good'], '1', 'a step game sends the good goes so far at this step');
select is(public.teacher_foundational_class(pg_temp.klass('A')) #>> array[pg_temp.uid(1)::text, 'robin', 'since'], '2026-11-05', 'and the NZ day the current step began: the run of rounds at it, not the earlier step');
select is(public.teacher_foundational_class(pg_temp.klass('A')) #>> array[pg_temp.uid(1)::text, 'beanstalk', 'daysDone'], '31', 'Beanstalk has its days');
select is(public.teacher_foundational_class(pg_temp.klass('A')) -> pg_temp.uid(3)::text, '{}'::jsonb, 'a pupil who has played nothing is an empty object');
select is(public.teacher_quick_looks_class(pg_temp.klass('A')) #>> array[pg_temp.uid(1)::text, 'q', 'f'], '4', 'Quick looks gives the saved stages finished');
select is(public.teacher_quick_looks_class(pg_temp.klass('A')) #>> array[pg_temp.uid(1)::text, 'recent', 'answered'], '3', 'and the counted answers, leaving out those given with help');
select is(public.teacher_quick_looks_class(pg_temp.klass('A')) -> pg_temp.uid(3)::text, '{}'::jsonb, 'a pupil who has not used it is an empty object');
select is((select count(*)::integer from jsonb_object_keys(public.teacher_quick_looks_class(pg_temp.klass('A')))), 2, 'and the other class''s pupils are not in it');

-- ---- Who is refused ----
select pg_temp.as(12);
select throws_ok(format('select public.teacher_foundational_class(%L)', pg_temp.klass('A')), '42501', null, 'a teacher of another class cannot read the games view');
select throws_ok(format('select public.teacher_quick_looks_class(%L)', pg_temp.klass('A')), '42501', null, 'nor the Quick looks view');
select pg_temp.as(1);
select throws_ok(format('select public.teacher_foundational_class(%L)', pg_temp.klass('A')), '42501', null, 'a student cannot, even in their own class');
select throws_ok(format('select public.teacher_quick_looks_class(%L)', pg_temp.klass('A')), '42501', null, 'nor Quick looks');
select pg_temp.reset();
set local role anon;
select throws_ok(format('select public.teacher_foundational_class(%L)', pg_temp.klass('A')), '42501', null, 'a signed-out visitor cannot call them');
select pg_temp.reset();

select * from finish();
rollback;
