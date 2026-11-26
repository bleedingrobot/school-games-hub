-- "Feedback on this question" (migration 20261127052528): teachers save notes on a question; only a school admin reads
-- the list and ticks notes off; pupils can do neither; one school never sees another's notes.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select setval(pg_get_serial_sequence('public.schools', 'id'), (select max(id) from public.schools));
insert into public.schools (name) values ('Feedback Other School');
insert into public.school_domains (domain, school_id)
  values ('fbother.school.nz', (select id from public.schools where name = 'Feedback Other School'));

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'fin@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000001e', 'boss@fbother.school.nz');
update public.profiles set role = 'teacher', school_admin = true
  where id in ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000001e');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000f';

-- A pupil can't save a note.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated", "email": "ana@douglaspark.school.nz"}';
select throws_ok($$ select public.maths_feedback_add('{"feedback": "hi", "question": {"prompt": "1 + 1"}}') $$,
  '42501', null, 'a pupil cannot save question feedback');
select throws_ok($$ select public.maths_feedback_list() $$, '42501', null, 'a pupil cannot read the tweak list');
select throws_ok($$ select * from public.maths_question_feedback $$, '42501', null, 'nobody reads the table directly');

-- A teacher (not an admin) saves a note.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000f", "role": "authenticated", "email": "fin@douglaspark.school.nz"}';
select lives_ok($$ select public.maths_feedback_add(jsonb_build_object(
    'feedback', 'The picture should show 20 and 3', 'game', 'gems', 'key', 'mul:23x4', 'tags', jsonb_build_array('picture', 'nonsense'),
    'question', jsonb_build_object('prompt', '23 × 4'),
    'picture', jsonb_build_object('kind', 'split-box', 'tens', 20, 'ones', 3, 'by', 4),
    'help', jsonb_build_object('title', 'Split it', 'steps', jsonb_build_array('20 × 4 = ?')))) $$,
  'a teacher can save feedback on a question');
select throws_ok($$ select public.maths_feedback_add('{"feedback": "  ", "question": {"prompt": "1 + 1"}}') $$,
  '22023', null, '... but not an empty note');
select throws_ok($$ select public.maths_feedback_list() $$, '42501', null, '... and only an admin reads the list');

-- The admin reads it, with the picture and help kept.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000e", "role": "authenticated", "email": "eve@douglaspark.school.nz"}';
select is(jsonb_array_length(public.maths_feedback_list()), 1, 'the admin sees the open note');
select is(public.maths_feedback_list() -> 0 -> 'picture' ->> 'tens', '20', '... with the picture it was showing');
select is(public.maths_feedback_list() -> 0 -> 'tags', '["picture"]'::jsonb, '... and only known tags');
select lives_ok($$ select public.maths_feedback_set_status(
    (select (public.maths_feedback_list() -> 0 ->> 'id')::bigint), 'fixed', 'Box now 20 | 3') $$, 'the admin ticks it off');
select is(jsonb_array_length(public.maths_feedback_list('done')), 1, '... and it moves to the done list');

-- Another school's admin sees nothing.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000001e", "role": "authenticated", "email": "boss@fbother.school.nz"}';
select is(jsonb_array_length(public.maths_feedback_list('all')), 0, 'another school sees none of these notes');

reset role;
select * from finish();
rollback;
