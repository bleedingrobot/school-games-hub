-- Mission Control maths M.4: questions the server asked in classmates games are locked away
-- from students, and the server can read a student's records for picking the next question.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');

insert into public.space_games (id, code, host, seat1, seat2, status, setup, rockets, seat_info, state)
values ('00000000-0000-0000-0000-0000000000a1', 'CDFGH', '00000000-0000-0000-0000-00000000000a',
  '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'playing', '{}', 2, '[]', '{}');
insert into public.space_game_questions (game, seat, kind, stamp, question)
values ('00000000-0000-0000-0000-0000000000a1', 0, 'charge', 1, '{"answer": 56}');

select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000a',
  'email', 'ana@douglaspark.school.nz', 'role', 'authenticated')::text, true);
select throws_ok($$ select * from public.space_game_questions $$, '42501', null, 'students cannot read the questions');
select throws_ok($$ delete from public.space_game_questions $$, '42501', null, 'students cannot change the questions');
select throws_ok($$ select public.space_maths_context('00000000-0000-0000-0000-00000000000a') $$, '42501', null,
  'students cannot call the server''s records reader');

select set_config('role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is((select count(*)::integer from public.space_game_questions), 1, 'the server can read the questions');
select is(public.space_maths_context('00000000-0000-0000-0000-00000000000a') -> 'facts', '[]'::jsonb, 'no records yet: an empty list');
select ok(public.space_maths_context('00000000-0000-0000-0000-00000000000a') -> 'settings' ? 'enabledTables',
  'the teacher''s question settings come with it');

select set_config('role', 'postgres', true);
delete from public.space_games where id = '00000000-0000-0000-0000-0000000000a1';
select is((select count(*)::integer from public.space_game_questions), 0, 'questions go when their game is deleted');

select * from finish();
rollback;
