-- Class Live (migrations 20261124000100_classlive.sql, 20261124000700_classlive_mural.sql and 20261124000800_classlive_rewards.sql, id classlive): rooms, the hidden session, the projector's screen
-- (teachers only), each pupil's own row, the compare-and-swap save, the switch, and the join pop-up in hub_here().
-- Run on a throw-away copy: scripts/scratch-db.sh classlive, then scripts/scratch-test.sh classlive supabase/tests/database/classlive.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'fay@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id in ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000000f');
insert into public.classes (id, school_id, name, school_year, warp_code) values
  ('00000000-0000-0000-0000-0000000000c1', 1, 'Room One', 2026, 'CDFGH'), ('00000000-0000-0000-0000-0000000000c2', 1, 'Room Two', 2026, 'CDFGJ');
select set_config('test.cls', '00000000-0000-0000-0000-0000000000c1', true);
insert into public.class_teachers (class_id, teacher_id) values
  (current_setting('test.cls')::uuid, '00000000-0000-0000-0000-00000000000e'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000000f') on conflict do nothing;
insert into public.class_members (student_id, class_id, how) values
  ('00000000-0000-0000-0000-00000000000a', current_setting('test.cls')::uuid, 'teacher'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000c2', 'teacher')
on conflict (student_id) do update set class_id = excluded.class_id;

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

select ok(exists (select 1 from public.hub_games where id = 'classlive' and switch_column = 'classlive_enabled'), 'it is in hub_games with its switch');

-- ---- The server opens a room for Eve's class ----
select pg_temp.act_as_server();
select is(public.classlive_teacher_class(pg_temp.id('0e'), current_setting('test.cls')::uuid) ->> 'enabled', 'true', 'Eve teaches her class and it is on');
select is(public.classlive_teacher_class(pg_temp.id('0e'), '00000000-0000-0000-0000-0000000000c2'), null, 'she does not teach Room Two');
select is(public.classlive_pupil(pg_temp.id('0a')) ->> 'class_id', current_setting('test.cls'), 'Ana is a pupil in her class');
select is(public.classlive_pupil(pg_temp.id('0e')), null, 'a teacher is not a pupil');
select set_config('test.room', public.classlive_open(current_setting('test.cls')::uuid, pg_temp.id('0e'), 'stars',
  '{"state":"lobby","secret":"session"}', '{"state":"lobby"}', '{"showNames":true,"seq":0,"events":[],"people":[]}')::text, true);
select is((public.classlive_load(current_setting('test.room')::bigint) ->> 'version')::int, 1, 'a new room starts at version 1');
select is(public.classlive_class_room(current_setting('test.cls')::uuid) ->> 'id', current_setting('test.room'), 'the class finds its open room');

-- ---- Saves: version checked ----
select is(public.classlive_save(current_setting('test.room')::bigint, 1, '{"state":"live","secret":"session"}', '{"state":"live"}',
  '{"seq":2,"events":[{"seq":1,"type":"start"},{"seq":2,"type":"star"}],"people":[{"name":"Ana"}]}', 1000,
  '[{"player":"00000000-0000-0000-0000-00000000000a","name":"Ana","found":1}]'), 'ok', 'a save at the right version lands');
select is(public.classlive_save(current_setting('test.room')::bigint, 1, '{"state":"live"}', '{"state":"live"}', '{"seq":3}', 1000, '[]'), 'stale',
  'a save at an old version is refused');
select is((public.classlive_load(current_setting('test.room')::bigint) ->> 'seq')::int, 2, '... and the screen keeps its events');

-- ---- Mystery Mural's kept questions: claimed once ----
select is(public.classlive_keep_question(current_setting('test.room')::bigint, pg_temp.id('0a'), '{"parts":["2","+","2","=","?"],"answer":4}') ->> 'slot', '0',
  'the first question is slot 0');
select is(public.classlive_keep_question(current_setting('test.room')::bigint, pg_temp.id('0a'), '{"parts":["3","+","3","=","?"],"answer":6}') -> 'question' ->> 'answer', '4',
  'asking again while one is open gives the open one back');
select is(public.classlive_save(current_setting('test.room')::bigint, 2, '{"state":"live"}', '{"state":"live"}', '{"seq":2}', 1000, '[]',
  '{"player":"00000000-0000-0000-0000-00000000000a","slot":0,"value":4,"right":true}'), 'ok', 'a save with a claim lands');
select is(public.classlive_save(current_setting('test.room')::bigint, 3, '{"state":"live"}', '{"state":"live"}', '{"seq":2}', 1000, '[]',
  '{"player":"00000000-0000-0000-0000-00000000000a","slot":0,"value":4,"right":true}'), 'answered', 'the same question claimed again is refused');
select is(public.classlive_open_question(current_setting('test.room')::bigint, pg_temp.id('0a')), null, '... and none is open after the answer');

-- ---- Pupils: their class's room (no session, no names), their own row, never the screen or session ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is((select count(*)::int from public.classlive_rooms), 1, 'Ana sees her class''s room');
select ok((select view::text not like '%secret%' from public.classlive_rooms), '... whose view has no session in it');
select is((select view ->> 'found' from public.classlive_players), '1', 'Ana sees her own row');
select is((select count(*)::int from public.classlive_screens), 0, 'pupils never see the screen (it names pupils)');
select throws_ok($$ select * from public.classlive_state $$, '42501', null, 'a pupil cannot read the session');
select throws_ok($$ select public.classlive_save(1, 1, '{}', '{}', '{}', null, '[]') $$, '42501', null, '... or save a room');
select throws_ok($$ select * from public.classlive_questions $$, '42501', null, '... or read the kept questions');
select is(public.hub_here() -> 'waiting' ? 'classlive', false, 'Ana has joined, so no pop-up');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is((select count(*)::int from public.classlive_rooms), 0, 'Ben (Room Two) sees no room of another class');

-- ---- The pop-up: a pupil in the class who hasn't joined ----
select pg_temp.reset();
update public.class_members set class_id = current_setting('test.cls')::uuid where student_id = pg_temp.id('0b');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is(public.hub_here() -> 'waiting' ? 'classlive', true, 'Ben, now in the class, gets the pop-up');
select is(jsonb_array_length(public.classlive_here()), 1, '... with the room''s details');

-- ---- The teacher: her class's screen only ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select is((select (screen ->> 'seq')::int from public.classlive_screens), 2, 'Eve sees her room''s screen');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fay@douglaspark.school.nz');
select is((select count(*)::int from public.classlive_screens), 0, 'Fay, who teaches another class, does not');

-- ---- Stage 4: a finished session pays once, with points and trophies ----
select pg_temp.act_as_server();
select is(public.classlive_finish(current_setting('test.room')::bigint, jsonb_build_object('seed', 7, 'activity', 'stars', 'goal', true,
  'players', jsonb_build_array(jsonb_build_object('player', pg_temp.id('0a'), 'points', 5, 'stars', 12),
    jsonb_build_object('player', pg_temp.id('0e'), 'points', 5)))), 'ok', 'a finished session is paid');
select is(public.classlive_finish(current_setting('test.room')::bigint, jsonb_build_object('seed', 7, 'players', '[]'::jsonb)), 'paid', '... once');
select is((select count(*)::int from public.game_points where game = 'classlive' and player = pg_temp.id('0a')), 1, 'Ana got her points');
select is((select count(*)::int from public.game_points where game = 'classlive' and player = pg_temp.id('0e')), 0, '... a teacher (not in the class) gets none');
select ok(exists (select 1 from public.achievements where player = pg_temp.id('0a') and achievement = 'classlive-stargazer'),
  'and Ana has the Stargazer trophy');

select * from finish();
rollback;
