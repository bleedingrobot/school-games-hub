-- Class Showdown (migration 20261123000900_showdown.sql, id showdown): rooms, the hidden round and questions, each pupil's
-- own row, the projector's feed, the compare-and-swap save with its claim, the switch, and the join pop-up in hub_here().
-- Run on a throw-away copy: scripts/scratch-db.sh showdown, then scripts/scratch-test.sh showdown supabase/tests/database/showdown.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

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

-- ---- On for every class, and in the hub's list ----
select is((select bool_and(showdown_enabled and showdown_names) from public.app_settings), true, 'on everywhere, names shown (the code switch holds it back)');
select ok(exists (select 1 from public.hub_games where id = 'showdown' and switch_column = 'showdown_enabled'), 'it is in hub_games with its switch');

-- ---- The server opens a room for Eve's class and keeps a question ----
select pg_temp.act_as_server();
select is(public.showdown_teacher_class(pg_temp.id('0e'), current_setting('test.cls')::uuid) ->> 'enabled', 'true', 'Eve teaches her class and it is on');
select is(public.showdown_teacher_class(pg_temp.id('0e'), '00000000-0000-0000-0000-0000000000c2'), null, 'she does not teach Room Two');
select is(public.showdown_pupil(pg_temp.id('0a')) ->> 'class_id', current_setting('test.cls'), 'Ana is a pupil in her class');
select is(public.showdown_pupil(pg_temp.id('0e')), null, 'a teacher is not a pupil');
select set_config('test.room', public.showdown_open(current_setting('test.cls')::uuid, pg_temp.id('0e'), 'boss',
  '{"mode":"class","lengthMin":10,"state":"lobby","secret":"round"}', '{"state":"lobby","showNames":true}')::text, true);
select is((public.showdown_load(current_setting('test.room')::bigint) ->> 'version')::int, 1, 'a new room starts at version 1');
select is(public.showdown_class_room(current_setting('test.cls')::uuid) ->> 'id', current_setting('test.room'), 'the class finds its open room');
select is(public.showdown_keep_question(current_setting('test.room')::bigint, pg_temp.id('0a'), '{"parts":["2","+","2","=","?"],"answer":4}', false) ->> 'slot', '0',
  'the first question is slot 0');
select is(public.showdown_keep_question(current_setting('test.room')::bigint, pg_temp.id('0a'), '{"parts":["3","+","3","=","?"],"answer":6}', false) -> 'question' ->> 'answer', '4',
  'asking again while one is open gives the open one back');

-- ---- Saves: version checked, claim once ----
select is(public.showdown_save(current_setting('test.room')::bigint, 1, '{"state":"live","secret":"round"}', '{"state":"live"}', 1000, null,
  '[{"player":"00000000-0000-0000-0000-00000000000a","name":"Ana","score":0}]', '[{"type":"start","t":0}]'), 'ok', 'a save at the right version lands');
select is(public.showdown_save(current_setting('test.room')::bigint, 1, '{"state":"live"}', '{"state":"live"}', 1000, null, '[]', '[]'), 'stale',
  'a save at an old version is refused');
select is(public.showdown_save(current_setting('test.room')::bigint, 2, '{"state":"live","secret":"round"}', '{"state":"live"}', 1000, null,
  '[{"player":"00000000-0000-0000-0000-00000000000a","name":"Ana","score":10}]', '[{"type":"hit","t":4000,"pupil":"00000000-0000-0000-0000-00000000000a"}]',
  '{"player":"00000000-0000-0000-0000-00000000000a","slot":0,"value":4,"right":true}'), 'ok', 'a save with a claim lands');
select is(public.showdown_save(current_setting('test.room')::bigint, 3, '{"state":"live"}', '{"state":"live"}', 1000, null, '[]', '[]',
  '{"player":"00000000-0000-0000-0000-00000000000a","slot":0,"value":4,"right":true}'), 'answered', 'the same question claimed again is refused');
select is((public.showdown_load(current_setting('test.room')::bigint) ->> 'version')::int, 3, '... and changed nothing');
select is((select count(*)::int from public.showdown_feed where room = current_setting('test.room')::bigint), 2, 'the feed has both events, in order');
select is(public.showdown_open_question(current_setting('test.room')::bigint, pg_temp.id('0a')), null, 'no question is open after the answer');

-- ---- Pupils: their class's room (no round), their own row, never the feed, questions or round ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is((select count(*)::int from public.showdown_rooms), 1, 'Ana sees her class''s room');
select ok((select view::text not like '%secret%' from public.showdown_rooms), '... whose view has no round in it');
select is((select view ->> 'score' from public.showdown_players), '10', 'Ana sees her own row');
select is((select count(*)::int from public.showdown_feed), 0, 'pupils never see the feed (it names pupils)');
select throws_ok($$ select * from public.showdown_state $$, '42501', null, 'a pupil cannot read the round');
select throws_ok($$ select * from public.showdown_questions $$, '42501', null, '... or the kept questions');
select throws_ok($$ select public.showdown_save(1, 1, '{}', '{}', null, null, '[]', '[]') $$, '42501', null, '... or save a room');
select throws_ok($$ select public.showdown_load(1) $$, '42501', null, '... or load one');
select is(public.hub_here() -> 'waiting' ? 'showdown', false, 'Ana has joined, so no pop-up');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is((select count(*)::int from public.showdown_rooms), 0, 'Ben (Room Two) sees no room of another class');

-- ---- The pop-up: a pupil in the class who hasn't joined ----
select pg_temp.reset();
update public.class_members set class_id = current_setting('test.cls')::uuid where student_id = pg_temp.id('0b');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is(public.hub_here() -> 'waiting' ? 'showdown', true, 'Ben, now in the class, gets the pop-up');
select is(jsonb_array_length(public.showdown_here()), 1, '... with the room''s details');

-- ---- The teacher: the feed of her class's room; the switch ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select is((select count(*)::int from public.showdown_feed), 2, 'Eve sees her room''s feed');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fay@douglaspark.school.nz');
select is((select count(*)::int from public.showdown_feed), 0, 'Fay, who teaches another class, does not');

select * from finish();
rollback;
