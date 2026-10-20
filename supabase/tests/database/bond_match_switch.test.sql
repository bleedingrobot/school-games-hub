-- Bond Match's switch, two-player and computer games, and How points work (migration 20261020000200_bond_match_switch.sql).
-- Run with: scripts/scratch-test.sh <scratch-db> supabase/tests/database/bond_match_switch.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000e';

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.ana() returns void language sql as $$
  select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz')
$$;
create function pg_temp.teacher() returns void language sql as $$
  select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz')
$$;
create function pg_temp.ana_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-00000000000a'::uuid $$;

-- Saves a game the way the server does (it has already replayed it).
create function pg_temp.game(mode text, bond text default 'whole-10', flip_count integer default 6, stars integer default 3)
returns jsonb language sql as $$
  select public.record_bond_match_game(pg_temp.ana_id(), jsonb_build_object(
    'runId', gen_random_uuid(), 'bondId', bond, 'size', 'small', 'seed', 7, 'flips', jsonb_build_array(0, 1, 2, 3),
    'flipCount', flip_count, 'seconds', 60, 'stars', stars) || case when mode is null then '{}' else jsonb_build_object('mode', mode) end)
$$;

-- ---- The switch starts off everywhere, and only a teacher changes it, for their own class ----
select is((select count(*) from public.app_settings where bond_match_enabled), 0::bigint, 'Bond Match starts switched off for every class');

select pg_temp.ana();
select throws_ok($$ select public.teacher_set_bond_match(true) $$, '42501', null, 'a student cannot switch it on');
select is((select bond_match_enabled from public.app_settings), false, 'a student can read their own switch (off)');
select pg_temp.reset();

select pg_temp.teacher();
create temp table made as select public.teacher_create_class('Room 12', 2026, 5) as id;
select lives_ok($$ select public.teacher_set_bond_match(true, (select id from made)) $$, 'a teacher switches it on for their class');
select pg_temp.reset();
select is((select bond_match_enabled from public.app_settings where class_id = (select id from made)), true, '... that class is on');
select is((select count(*) from public.app_settings where bond_match_enabled), 1::bigint, '... and no other class or school default changed');
select pg_temp.teacher();
select lives_ok($$ select public.teacher_set_bond_match(false, (select id from made)) $$, 'and switches it off again');
select pg_temp.reset();
select is((select count(*) from public.app_settings where bond_match_enabled), 0::bigint, '... so nothing is on');

-- ---- Game modes: every mode is saved and earns points; only solo changes bests ----
select is(pg_temp.game(null) ->> 'status', 'saved', 'an older save with no mode is still saved');
select is((select mode from public.bond_match_games where player = pg_temp.ana_id()), 'solo', '... as a solo game');
select is((pg_temp.game('pass', 'whole-10', 4, 3) -> 'best' ->> 'flips')::integer, 6,
  'a two-player game answers with the solo best, not its own flips');
select is((select best_flips from public.bond_match_bests where player = pg_temp.ana_id() and bond_id = 'whole-10'), 6,
  '... and leaves the bests alone');
select is((select plays from public.bond_match_bests where player = pg_temp.ana_id() and bond_id = 'whole-10'), 1,
  '... including the count of plays');
select is(pg_temp.game('bot', 'whole-20') -> 'best', 'null'::jsonb, 'a computer game with no solo best answers with no best');
select is((select count(*) from public.scored_games where player = pg_temp.ana_id() and game = 'bond-match'), 3::bigint,
  'every mode earns its taking-part points');
select throws_ok($$ select pg_temp.game('online') $$, '22023', null, 'an unknown mode is refused');

-- ---- How points work shows Bond Match only where it is switched on ----
select pg_temp.ana();
select is(public.progress_rules() -> 'hubGames' -> 'bond-match', null, 'switched off, How points work leaves Bond Match out');
select pg_temp.reset();
update public.app_settings set bond_match_enabled = true;
select pg_temp.ana();
select is(public.progress_rules() -> 'hubGames' -> 'bond-match' -> 'lines' ->> 0,
  'Finish a game: 2 points, for your first 10 games each day.', 'switched on, How points work shows Bond Match''s line');
select pg_temp.reset();

select * from finish();
rollback;
