-- Games Hub Pulse for teachers (teacher_pulse, 20261127074205_teacher_pulse.sql): teachers only, counts a pupil's go once,
-- and leaves teachers' own goes out.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'fin@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000f';

-- One finished Basic facts training session by the pupil, one by the teacher.
insert into public.training_sessions (player, kind, seed, answers, finished_at)
values ('00000000-0000-0000-0000-00000000000a', 'facts', 1, 10, now()),
       ('00000000-0000-0000-0000-00000000000f', 'facts', 2, 10, now());

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select throws_ok($$ select public.teacher_pulse() $$, '42501', null, 'a pupil cannot read the Pulse');
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000f", "role": "authenticated"}';
select lives_ok($$ select public.teacher_pulse() $$, 'a teacher can read the Pulse');
select ok(public.teacher_pulse() ?& array['kpis', 'daily', 'games', 'live', 'classes', 'hours', 'answers'], 'it has every part');
select is(jsonb_array_length(public.teacher_pulse() -> 'daily'), 28, 'four weeks of days');
select is(jsonb_array_length(public.teacher_pulse() -> 'hours'), 24, 'every hour');
select is((select (g ->> 'playsEver')::integer from jsonb_array_elements(public.teacher_pulse() -> 'games') g where g ->> 'id' = 'training'),
  1, 'the pupil''s training session counts once, the teacher''s not at all');
select throws_ok($$ select public.pulse_plays(1) $$, '42501', null, 'nobody calls the inner parts directly');
reset role;

select * from finish();
rollback;
