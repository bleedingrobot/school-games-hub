-- Star Web solo (migration 20261125001500, id starweb): progress, skies, the switch and the hub hooks.
-- Pupils can't read or change any of it directly; the server function does everything.
-- Run on a throw-away copy: scripts/scratch-db.sh starweb, then scripts/scratch-test.sh starweb supabase/tests/database/starweb.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

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
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || who)::uuid $$;

select is((select bool_and(starweb_enabled) from public.app_settings), true, 'the game is on for every class');

-- ---- Pupils can't reach anything directly ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.starweb_progress $$, '42501', null, 'a pupil cannot read anyone''s progress');
select throws_ok($$ select * from public.starweb_skies $$, '42501', null, '... or the skies');
select throws_ok($$ select public.starweb_finish(auth.uid(), 'aaaaaaaaaaaaaaaa', 1, '[]', 0, 3, 4, 0, '{}') $$, '42501', null, '... or finish a sky with any medal');
select throws_ok($$ select public.starweb_save(auth.uid(), 'aaaaaaaaaaaaaaaa', 1, '[]', 0) $$, '42501', null, '... or save stars');

-- ---- A sky: started once, saved in order, finished once with the progress ----
select pg_temp.act_as_server();
select is(public.starweb_load(pg_temp.id('0a')), null, 'the server sees no progress for a new pupil');
select ok(public.starweb_start(pg_temp.id('0a'), 'aaaaaaaaaaaaaaaa', 'map', 6, 7), 'a sky starts');
select ok(not public.starweb_start(pg_temp.id('0a'), 'aaaaaaaaaaaaaaaa', 'map', 6, 7), 'a seed is used once per pupil');
select is(public.starweb_sky(pg_temp.id('0b'), 'aaaaaaaaaaaaaaaa'), null, 'another pupil has no such sky');
select ok(public.starweb_save(pg_temp.id('0a'), 'aaaaaaaaaaaaaaaa', 1, '[{"k":"×600,700","t":"7 × 6 = 42","a":"turn","h":"Turn it around"}]', 1), 'stars save');
select ok(not public.starweb_save(pg_temp.id('0a'), 'aaaaaaaaaaaaaaaa', 1, '[]', 0), '... only while the version still matches');
select is(public.starweb_open_sky(pg_temp.id('0a')) -> 'anchor', '{"x": 6, "y": 7, "p": 42}'::jsonb, 'the open sky comes back to carry on');
select ok(public.starweb_finish(pg_temp.id('0a'), 'aaaaaaaaaaaaaaaa', 2, '[]', 1, 2, 3, 0,
  '{"tables":{"6":2,"7":2},"lit":1,"gold":0,"stars":25,"nohint":0,"recent":["6x7"],"guideSeen":true}'), 'a sky finishes with the progress');
select ok(not public.starweb_finish(pg_temp.id('0a'), 'aaaaaaaaaaaaaaaa', 3, '[]', 1, 2, 3, 1, '{}'), '... once');
select is(public.starweb_point_skies(pg_temp.id('0a'), (now() at time zone 'Pacific/Auckland')::date), 1, 'it counts as a points sky today');
select is(public.starweb_counts(pg_temp.id('0a')),
  '{"starweb_lit": 1, "starweb_gold": 0, "starweb_stars": 25, "starweb_nohint": 0, "starweb_tables_step": 2, "starweb_gold_tables_step": 0}'::jsonb,
  'the achievements count lit skies, stars and tables');
select throws_ok($$ select public.starweb_start(pg_temp.id('0a'), 'bbbbbbbbbbbbbbbb', 'map', 7, 7) $$, '22023', null, 'a square is not a known fact');

select * from finish();
rollback;
