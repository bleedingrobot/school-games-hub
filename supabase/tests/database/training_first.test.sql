-- Training before games (migration 20261022000300): the per-class switch, finished sessions, and my_training_lock().
-- Students can't touch the sessions table or the saving function; a session only counts once enough of its answers are
-- saved; a session sent twice is one row; teachers are never locked; the switch changes only the class it is set for.
-- Run on a throw-away copy: scripts/scratch-db.sh training, then
--   scripts/scratch-test.sh training supabase/tests/database/training_first.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

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
create function pg_temp.act_as_server() returns void language sql as $$
  select set_config('role', 'service_role', true), set_config('request.jwt.claims', '{"role":"service_role"}', true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || who)::uuid $$;
create function pg_temp.ana() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz') $$;
create function pg_temp.cat() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz') $$;
create function pg_temp.fin() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fin@douglaspark.school.nz') $$;
-- `n` answers to `key`, the newest `ago` seconds ago, a second apart.
create function pg_temp.answers(key text, n integer, ago integer default 60) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('key', key, 'given', 1, 'correct', true, 'ms', 1000, 'typingMs', 0,
    'day', to_char(((now() - make_interval(secs => ago + i)) at time zone 'Pacific/Auckland')::date, 'YYYY-MM-DD'),
    'at', (extract(epoch from now() - make_interval(secs => ago + i)) * 1000)::bigint) order by i desc)
  from generate_series(0, n - 1) as i
$$;
create function pg_temp.save(who text, seed integer, answers jsonb) returns integer language sql as $$
  select public.record_training_answers(pg_temp.id(who), gen_random_uuid(), seed, answers, 30, 600)
$$;
-- A session finishing `ago` seconds ago.
create function pg_temp.finish(who text, kind text, seed integer, ago integer default 30, min integer default 2) returns timestamptz language sql as $$
  select public.record_training_session(pg_temp.id(who), kind, seed, (extract(epoch from now() - make_interval(secs => ago)) * 1000)::bigint, min)
$$;

-- Cat is in Room Two, which Fin teaches (Fin teaches nothing else). Ana stays in the school's Everyone class. Eve is the school admin.
insert into public.classes (school_id, name, school_year, warp_code)
values ((select school_id from public.profiles where id = pg_temp.id('0a')), 'Room Two', 2026, 'CDFGH');
update public.class_members set class_id = (select id from public.classes where name = 'Room Two') where student_id = pg_temp.id('0c');
delete from public.class_teachers where teacher_id = pg_temp.id('0f');
insert into public.class_teachers (class_id, teacher_id) values ((select id from public.classes where name = 'Room Two'), pg_temp.id('0f'));
select public.give_class_settings((select id from public.classes where name = 'Room Two'));
select set_config('test.room_two', (select id::text from public.classes where name = 'Room Two'), true);
-- Ana's class, for checks run as a teacher (who can't read class_members).
select set_config('test.ana_class', (select class_id::text from public.class_members where student_id = pg_temp.id('0a')), true);

-- ---- Nobody reaches the table or the saving function directly ----
select is((select bool_or(training_first) from public.app_settings), false, 'the switch starts off everywhere');
select pg_temp.cat();
select throws_ok($$ select * from public.training_sessions $$, '42501', null, 'students cannot read the sessions table');
select throws_ok($$ insert into public.training_sessions (player, kind, seed, answers, finished_at) values (auth.uid(), 'facts', 1, 30, now()) $$,
  '42501', null, 'students cannot add a session');
select throws_ok($$ select pg_temp.finish('0c', 'facts', 1) $$, '42501', null, 'students cannot call the saving function');
select is(public.my_training_lock(), '{"on": false, "lastFinishedAt": null}'::jsonb, 'with the switch off, the lock is off');
select throws_ok($$ select public.teacher_set_training_first(true) $$, null, null, 'a student cannot switch it on');
select pg_temp.reset();
set local role anon;
select throws_ok($$ select public.my_training_lock() $$, '42501', null, 'signed-out visitors cannot ask');
select pg_temp.reset();

-- ---- The switch, per class ----
select pg_temp.fin();
select throws_ok($$ select public.teacher_set_training_first(null) $$, '22023', null, 'a missing setting is refused');
select throws_ok(format('select public.teacher_set_training_first(true, %L)', current_setting('test.ana_class')),
  '42501', null, 'a teacher cannot switch it on for a class they don''t teach');
select lives_ok(format('select public.teacher_set_training_first(true, %L)', current_setting('test.room_two')), 'a teacher switches it on for their class');
select is(public.my_training_lock() -> 'on', 'false'::jsonb, 'a teacher is never locked, even with their class''s switch on');
select pg_temp.reset();
select is((select count(*)::integer from public.app_settings where training_first), 1, '... and only that class has it on');
select is((select training_first from public.app_settings where class_id = current_setting('test.room_two')::uuid), true, '... Room Two');

select pg_temp.cat();
select is(public.my_training_lock(), '{"on": true, "lastFinishedAt": null}'::jsonb, 'a student in that class is locked and has never trained');
select pg_temp.ana();
select is(public.my_training_lock() -> 'on', 'false'::jsonb, 'a student in another class is not');
select pg_temp.reset();

-- ---- Finishing a session (the server only) ----
select pg_temp.act_as_server();
select throws_ok($$ select pg_temp.finish('0c', 'facts', 5) $$, '22023', null, 'a session with no saved answers does not count');
select is(pg_temp.save('0c', 5, pg_temp.answers('mul:6x7', 1)), 1, 'one answer saved');
select throws_ok($$ select pg_temp.finish('0c', 'facts', 5) $$, '22023', null, '... is not enough');
select is(pg_temp.save('0c', 5, pg_temp.answers('mul:2x5', 1, 40)), 1, 'a second answer saved');
select isnt(pg_temp.finish('0c', 'facts', 5), null, '... and now the session counts');
select lives_ok($$ select pg_temp.finish('0c', 'facts', 5, 10) $$, 'the same session sent again is fine');
select is((select count(*)::integer from public.training_sessions where player = pg_temp.id('0c')), 1, '... and is still one row');
select ok((select finished_at > now() - interval '15 seconds' from public.training_sessions where player = pg_temp.id('0c')), '... with the later time');

select throws_ok($$ select pg_temp.finish('0c', 'quick', 5, 30, 12) $$, '22023', null, 'times-table answers don''t count as a Quick looks round');
select is(pg_temp.save('0c', 9, pg_temp.answers('sub:line-2', 11)), 11, 'eleven Quick looks answers saved');
select throws_ok($$ select pg_temp.finish('0c', 'quick', 9, 30, 12) $$, '22023', null, '... are not a whole round');
select is(pg_temp.save('0c', 9, pg_temp.answers('subh:line-3', 1, 5)), 1, 'a twelfth (helped) answer saved');
select isnt(pg_temp.finish('0c', 'quick', 9, 1, 12), null, '... and the round counts');

select throws_ok($$ select pg_temp.finish('0c', 'facts', 5, -3600) $$, '22023', null, 'a session from the future is refused');
select throws_ok($$ select pg_temp.finish('0c', 'facts', 5, 13 * 3600) $$, '22023', null, 'a session from more than 12 hours ago is refused');
select pg_temp.reset();

-- ---- Reading it back ----
select pg_temp.cat();
select ok((public.my_training_lock() ->> 'lastFinishedAt')::bigint > (extract(epoch from now() - interval '1 minute') * 1000)::bigint,
  'the student sees when they last finished a session');
select pg_temp.reset();

select * from finish();
rollback;
