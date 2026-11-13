-- Glyph Gates (migration 20261113000800, id glyph): progress, goes, the switch and the hub hooks.
-- Pupils can't read or change any of it directly; the server function does everything.
-- Run on a throw-away copy: scripts/scratch-db.sh glyph, then scripts/scratch-test.sh glyph supabase/tests/database/glyph.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');

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

select is((select bool_and(glyph_enabled) from public.app_settings), true, 'the game is on for every class');

-- ---- Pupils can't reach anything directly ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.glyph_progress $$, '42501', null, 'a pupil cannot read anyone''s progress');
select throws_ok($$ select * from public.glyph_goes $$, '42501', null, '... or the goes');
select throws_ok($$ select public.glyph_finish(auth.uid(), 'aaaaaaaaaaaaaaaa', 0, '{}', '{}', 9, true, 9) $$, '42501', null, '... or finish a go with any result');
select is(public.my_glyph(), null, 'a new pupil has no progress of their own yet');

-- ---- A go: started once, finished once with the progress ----
select pg_temp.act_as_server();
select is(public.glyph_load(pg_temp.id('0a')), null, 'the server sees no progress for a new pupil');
select ok(public.glyph_start(pg_temp.id('0a'), 'aaaaaaaaaaaaaaaa', 1, 2), 'a go starts');
select ok(not public.glyph_start(pg_temp.id('0a'), 'aaaaaaaaaaaaaaaa', 1, 2), 'a seed is used once per pupil');
select is(public.glyph_go(pg_temp.id('0b'), 'aaaaaaaaaaaaaaaa'), null, 'another pupil has no such go');
select ok(public.glyph_start(pg_temp.id('0a'), 'bbbbbbbbbbbbbbbb', 1, 2), 'a second go starts ...');
select is((public.glyph_go(pg_temp.id('0a'), 'aaaaaaaaaaaaaaaa') ->> 'open')::boolean, false, '... and closes the first');
select ok(public.glyph_finish(pg_temp.id('0a'), 'bbbbbbbbbbbbbbbb', 0, '{"passed":1,"best":{"1":8},"help":{"level":2,"goodInRow":1},"walls":9,"guideSeen":true}', '{"walls":[]}', 8, true, 9), 'a go finishes with the progress');
select ok(not public.glyph_finish(pg_temp.id('0a'), 'bbbbbbbbbbbbbbbb', 1, '{}', '{}', 0, false, 0), '... once');
select is(public.glyph_finished_today(pg_temp.id('0a'), (now() at time zone 'Pacific/Auckland')::date), 1, 'it counts as a finished go today');
select is(public.glyph_counts(pg_temp.id('0a')), '{"glyph_walls": 9, "glyph_temple_step": 1}'::jsonb, 'the achievements count walls and temples');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is((public.my_glyph() ->> 'passed')::int, 1, 'the pupil reads their own progress');

select * from finish();
rollback;
