-- Question skips (migration 20261022000900): the question log, log_questions() and teacher_question_skips().
-- Students can't read or write the table directly; log_questions() stores only readable notes, as the student sending them;
-- the daily cap holds; a teacher sees only their own class; old rows are tidied.
-- Run on a throw-away copy: scripts/scratch-db.sh skips, then
--   scripts/scratch-test.sh skips supabase/tests/database/question_log.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'fin@douglaspark.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000e';
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000f';

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || who)::uuid $$;
create function pg_temp.ana() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz') $$;
create function pg_temp.cat() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz') $$;
create function pg_temp.fin() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fin@douglaspark.school.nz') $$;
-- One note `ago` seconds ago.
create function pg_temp.note(game text, spot text, skipped boolean, ago integer default 60) returns jsonb language sql as $$
  select jsonb_build_object('game', game, 'spot', spot, 'skipped', skipped, 'ms', 2500,
    'at', (extract(epoch from now() - make_interval(secs => ago)) * 1000)::bigint)
$$;

-- Cat is in Room Two, which Fin teaches (Fin teaches nothing else). Ana stays in the school's Everyone class.
insert into public.classes (school_id, name, school_year, warp_code)
values ((select school_id from public.profiles where id = pg_temp.id('0a')), 'Room Two', 2026, 'CDFGH');
update public.class_members set class_id = (select id from public.classes where name = 'Room Two') where student_id = pg_temp.id('0c');
delete from public.class_teachers where teacher_id = pg_temp.id('0f');
insert into public.class_teachers (class_id, teacher_id) values ((select id from public.classes where name = 'Room Two'), pg_temp.id('0f'));
select set_config('test.room_two', (select id::text from public.classes where name = 'Room Two'), true);
select set_config('test.ana_class', (select class_id::text from public.class_members where student_id = pg_temp.id('0a')), true);

-- ---- Nobody reaches the table directly ----
select pg_temp.cat();
select throws_ok($$ select * from public.question_log $$, '42501', null, 'students cannot read the log');
select throws_ok($$ insert into public.question_log (player, game, spot, skipped, shown_ms, at) values (auth.uid(), 'marble', 'x', false, 1, now()) $$,
  '42501', null, 'students cannot write to the log');
select throws_ok($$ select public.question_log_tidy() $$, '42501', null, 'students cannot run the tidy');
select throws_ok($$ select public.teacher_question_skips() $$, '42501', null, 'students cannot read the teacher''s counts');
select pg_temp.reset();
set local role anon;
select throws_ok($$ select public.log_questions('[]') $$, '42501', null, 'signed-out visitors cannot send notes');
select pg_temp.reset();

-- ---- Sending notes ----
select pg_temp.cat();
select is(public.log_questions(jsonb_build_array(
  pg_temp.note('marble', 'Pit stop', false), pg_temp.note('marble', 'Pit stop', true), pg_temp.note('marble', 'Rescue', true),
  pg_temp.note('dragon-maths', 'size-it-up', true), pg_temp.note('space', 'Charge', false))), 5, 'five readable notes are stored');
select is(public.log_questions(jsonb_build_array(
  pg_temp.note('Marble Rush!', 'Pit stop', true),                       -- not a game id
  pg_temp.note('marble', '', true),                                     -- no spot
  pg_temp.note('marble', repeat('x', 41), true),                        -- spot too long
  jsonb_build_object('game', 'marble', 'spot', 'Pit stop', 'skipped', 'yes', 'ms', 1, 'at', 1),  -- not a true/false
  pg_temp.note('marble', 'Pit stop', true, 3 * 86400),                  -- three days old
  '"just text"'::jsonb)), 0, 'notes that can''t be read, or are too old, are left out without an error');
select throws_ok($$ select public.log_questions('{"game": "marble"}') $$, '22023', null, 'something that isn''t a list is refused');
select throws_ok(format('select public.log_questions(%L)', (select jsonb_agg(pg_temp.note('marble', 'Pit stop', true)) from generate_series(1, 101))),
  '22023', null, 'more than 100 notes at once is refused');
select is(public.log_questions(jsonb_build_array(jsonb_build_object('game', 'marble', 'spot', 'Pit stop', 'skipped', true, 'ms', 99999999,
  'at', (extract(epoch from now() + interval '1 hour') * 1000)::bigint))), 1, 'a time in the future and a huge on-screen time are trimmed');
select pg_temp.reset();
select is((select count(*)::integer from public.question_log where player = pg_temp.id('0c')), 6, 'all Cat''s notes are hers');
select ok((select bool_and(at <= now() and shown_ms <= 3600000) from public.question_log), 'no note is in the future or over an hour long');

select pg_temp.ana();
select is(public.log_questions(jsonb_build_array(pg_temp.note('marble', 'Pit stop', true), pg_temp.note('marble', 'Pit stop', false))), 2,
  'Ana sends hers');
select pg_temp.reset();
-- The daily cap: Ana has already sent 3,000 today.
insert into public.question_log (player, game, spot, skipped, shown_ms, at)
select pg_temp.id('0a'), 'marble', 'Pit stop', false, 1000, now() from generate_series(1, 2998);
select pg_temp.ana();
select is(public.log_questions(jsonb_build_array(pg_temp.note('marble', 'Pit stop', true), pg_temp.note('marble', 'Pit stop', true),
  pg_temp.note('marble', 'Pit stop', true))), 0, 'after 3,000 notes in a day, more are not stored');
select pg_temp.reset();
select is((select count(*)::integer from public.question_log where player = pg_temp.id('0a')), 3000, '... so Ana has exactly 3,000');
delete from public.question_log where player = pg_temp.id('0a') and shown_ms = 1000;

-- ---- The teacher's counts ----
select pg_temp.fin();
select throws_ok(format('select public.teacher_question_skips(%L)', current_setting('test.ana_class')), '42501', null,
  'a teacher cannot read a class they don''t teach');
select throws_ok(format('select public.teacher_question_skips(%L, 0)', current_setting('test.room_two')), '22023', null,
  'days must be 1 to 60');
select is(jsonb_array_length(public.teacher_question_skips(current_setting('test.room_two')::uuid) -> 'students'), 1, 'Fin sees only Cat');
select is(((public.teacher_question_skips(current_setting('test.room_two')::uuid) -> 'students' -> 0) - 'id') - 'name',
  '{"realName": "cat", "shown": 6, "answered": 2, "skipped": 4, "topSkip": {"game": "marble", "spot": "Pit stop", "skipped": 2}}'::jsonb,
  'Cat: 6 shown, 2 answered, 4 skipped, most at Marble pit stops');
select is(public.teacher_question_skips(current_setting('test.room_two')::uuid) -> 'spots' -> 0,
  '{"game": "marble", "spot": "Pit stop", "shown": 3, "skipped": 2}'::jsonb, 'the most skipped kind of question comes first');
select is(public.teacher_question_skips() -> 'students' -> 0 ->> 'realName', 'cat', 'with no class: all Fin''s students');
select pg_temp.reset();

select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select is(jsonb_array_length(public.teacher_question_skips() -> 'students'), 2, 'the school admin sees both students');
select pg_temp.reset();

-- ---- Tidy ----
update public.question_log set at = now() - interval '61 days' where player = pg_temp.id('0a');
select public.question_log_tidy();
select is((select count(*)::integer from public.question_log where player = pg_temp.id('0a')), 0, 'notes older than 60 days are tidied');
select is((select count(*)::integer from public.question_log where player = pg_temp.id('0c')), 6, '... and newer ones stay');

select * from finish();
rollback;
