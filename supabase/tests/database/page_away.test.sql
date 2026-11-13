-- Leaving the game page (migration 20261114000400): page_away, log_page_away() and teacher_page_away().
-- Pupils can't read or write the table directly; log_page_away() stores only readable notes of 3 seconds or more, as the
-- pupil sending them; teachers' own notes are not kept; a teacher sees only their own class; long breaks are kept apart.
-- Run on a throw-away copy: scripts/scratch-db.sh away, then
--   scripts/scratch-test.sh away supabase/tests/database/page_away.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

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
-- One note: away `ms`, left `ago` seconds ago.
create function pg_temp.away(game text, spot text, ms integer, ago integer default 60) returns jsonb language sql as $$
  select jsonb_build_object('game', game, 'spot', spot, 'kind', 'tab', 'ms', ms,
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
select throws_ok($$ select * from public.page_away $$, '42501', null, 'pupils cannot read the notes');
select throws_ok($$ insert into public.page_away (player, game, kind, away_ms, at) values (auth.uid(), 'marble', 'tab', 5000, now()) $$,
  '42501', null, 'pupils cannot write notes directly');
select throws_ok($$ select public.page_away_tidy() $$, '42501', null, 'pupils cannot run the tidy');
select throws_ok(format($$ select public.teacher_page_away(%L) $$, current_setting('test.room_two')), '42501', null,
  'pupils cannot read the teacher''s view');
select pg_temp.reset();
set local role anon;
select throws_ok($$ select public.log_page_away('[]') $$, '42501', null, 'signed-out visitors cannot send notes');
select pg_temp.reset();

-- ---- Sending notes ----
select pg_temp.cat();
select is(public.log_page_away(jsonb_build_array(
  pg_temp.away('marble', 'Pit stop', 8000), pg_temp.away('marble', null, 4000), pg_temp.away('toonflap', 'Gate', 20000),
  pg_temp.away('marble', null, 1200000))), 4, 'four readable notes are stored');
select is(public.log_page_away(jsonb_build_array(
  pg_temp.away('marble', null, 1500),
  pg_temp.away('Bad Game!', null, 5000),
  pg_temp.away('marble', null, 5000, 4 * 86400),
  jsonb_build_object('game', 'marble', 'kind', 'phone', 'ms', 5000, 'at', 1),
  '"not an object"'::jsonb)), 0, 'blips under 3 seconds, bad names, old notes and bad kinds are left out');
select throws_ok($$ select public.log_page_away((select jsonb_agg(pg_temp.away('marble', null, 5000)) from generate_series(1, 51))) $$,
  '22023', null, 'more than 50 at once is refused');
select pg_temp.reset();
select is((select count(*)::integer from public.page_away where player = pg_temp.id('0c')), 4, 'all of Cat''s notes are hers');
select ok((select max(at) <= now() from public.page_away), 'no note is in the future');

-- A teacher's own notes are not kept.
select pg_temp.fin();
select is(public.log_page_away(jsonb_build_array(pg_temp.away('marble', null, 5000))), 0, 'a teacher''s notes are not kept');
select pg_temp.reset();

-- Ana leaves once too (she is not in Room Two).
select pg_temp.ana();
select public.log_page_away(jsonb_build_array(pg_temp.away('marble', null, 5000)));
select pg_temp.reset();

-- ---- The teacher's view ----
select pg_temp.fin();
select is(jsonb_array_length(public.teacher_page_away(current_setting('test.room_two')::uuid)), 1, 'Fin sees only Room Two');
select is((public.teacher_page_away(current_setting('test.room_two')::uuid) -> 0) - 'id' - 'name' - 'realName' - 'lastAt',
  '{"times": 3, "duringQuestion": 2, "awaySecs": 32, "longBreaks": 1, "questions": 0, "days": 1, "topGame": "marble"}'::jsonb,
  'times away, during a question, seconds away and long breaks kept apart');
select throws_ok(format($$ select public.teacher_page_away(%L) $$, current_setting('test.ana_class')), '42501', null,
  'a class the teacher does not teach is refused');
select throws_ok(format($$ select public.teacher_page_away(%L, 0) $$, current_setting('test.room_two')), '22023', null,
  'days must be 1 to 60');
select pg_temp.reset();

-- ---- Tidy ----
insert into public.page_away (player, game, kind, away_ms, at) values (pg_temp.id('0c'), 'marble', 'tab', 5000, now() - interval '61 days');
select public.page_away_tidy();
select is((select count(*)::integer from public.page_away where at < now() - interval '60 days'), 0, 'notes older than 60 days are tidied');

select * from finish();
rollback;
