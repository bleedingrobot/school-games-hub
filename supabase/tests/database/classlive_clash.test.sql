-- Colour Clash (migration 20261125001200_classlive_clash.sql): painting on a saved move, bombs, the count, who can read what.
-- Run on a throw-away copy: scripts/scratch-db.sh clash, then scripts/scratch-test.sh clash supabase/tests/database/classlive_clash.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

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

select ok(exists (select 1 from public.classlive_activities where id = 'clash' and moves), 'Colour Clash is a moving activity');

-- A live room in round 1, painting on, Ana in team 2.
select pg_temp.act_as_server();
select set_config('test.clash', public.classlive_open(current_setting('test.cls')::uuid, pg_temp.id('0e'), 'clash',
  jsonb_build_object('state', 'live', 'game', jsonb_build_object('kind', 'clash', 'zeroMs', floor(extract(epoch from clock_timestamp()) * 1000) - 10000,
    'round', jsonb_build_object('n', 1, 'paintFrom', 0, 'paintTo', 9999999, 'result', null, 'hole', false, 'teleports', '[]'::jsonb),
    'mine', jsonb_build_object(pg_temp.id('0a')::text, jsonb_build_object('team', 2, 'brushTo', null)))),
  '{"state":"live"}', '{"showNames":true,"seq":0,"events":[],"people":[]}')::text, true);
update public.classlive_rooms set state = 'live' where id = current_setting('test.clash')::bigint;
insert into public.classlive_players (room, player, view) values (current_setting('test.clash')::bigint, pg_temp.id('0a'), '{}');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(public.classlive_clash_paint(current_setting('test.clash')::bigint, 0.5, 0.5, null) -> 'tiles', '[]'::jsonb, 'the first saved spot paints nothing');
select pg_temp.reset();
update public.classlive_spots set at_ms = at_ms - 500 where room = current_setting('test.clash')::bigint;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(jsonb_array_length(public.classlive_clash_paint(current_setting('test.clash')::bigint, 0.6, 0.5, null) -> 'tiles'), 3,
  'a move paints the tiles on the line from the last spot');
select throws_ok($$ select count(*) from public.classlive_clash_tiles $$, '42501', null, 'a pupil can''t read the tiles table');
select throws_ok($$ select public.classlive_clash_bomb(1, 1, 1, null, '{1}') $$, '42501', null, 'a pupil can''t drop a bomb');
select throws_ok($$ select public.classlive_clash_count(1, 1) $$, '42501', null, 'a pupil can''t read the count');
select is(public.classlive_clash_board(current_setting('test.clash')::bigint, null), null, 'a pupil can''t read the projector''s board');
select pg_temp.act_as_server();
select is(public.classlive_clash_bomb(current_setting('test.clash')::bigint, 1, 3, pg_temp.id('0a'), '{0,1,2,300}'), 4, 'a bomb paints its tiles, other teams'' too');
select is(length(public.classlive_clash_count(current_setting('test.clash')::bigint, 1) ->> 'tiles'), 576, 'the count has every tile');
select is(public.classlive_clash_count(current_setting('test.clash')::bigint, 1) #>> array['painted', pg_temp.id('0a')::text], '7', 'tiles painted are counted per pupil');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select is(jsonb_array_length(public.classlive_clash_board(current_setting('test.clash')::bigint, null) -> 'tiles'), 6, 'the teacher''s projector reads the board');

select * from finish();
rollback;
