-- Dragon Maths live arena clashes (migration 20261117000200): the switch starts off; pupils read only their own clashes
-- and never the hidden picks; challenges are same-class only; the second pick of a round gets both; a clash ends once and
-- pays the winner and half that to the other side, for the first 3 paid clashes a day.
-- Run on a throw-away copy: scripts/scratch-db.sh lord, then scripts/scratch-test.sh lord supabase/tests/database/lord_live_arena.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000e';
select set_config('test.cls', (select default_class::text from public.schools where id = 1), true);
insert into public.class_teachers (class_id, teacher_id) values (current_setting('test.cls')::uuid, '00000000-0000-0000-0000-00000000000e') on conflict do nothing;

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
create function pg_temp.gold(who text) returns integer language sql as $$ select (hero ->> 'gold')::integer from public.lord_heroes where player = pg_temp.id(who) $$;
create function pg_temp.ana() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz') $$;
create function pg_temp.ben() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz') $$;

insert into public.lord_heroes (player, hero, version, season, day) values
  (pg_temp.id('0a'), '{"heroClass": "knight", "look": "knight-girl-01-1", "level": 3, "gold": 10}', 1, 1, '2026-11-17'),
  (pg_temp.id('0b'), '{"heroClass": "mage", "level": 5, "gold": 0}', 1, 1, '2026-11-17');
update public.app_settings set lord_enabled = true;

-- ---- The switch: off to start ----
select is((select lord_live_arena from public.app_settings where class_id = current_setting('test.cls')::uuid), false, 'classmate clashes start switched off');
select pg_temp.ana();
select is(public.lord_here(), '{"off": true}'::jsonb, '... so "I''m here" says so');
select throws_ok($$ select public.teacher_set_lord_live_arena(true, current_setting('test.cls')::uuid) $$, null, null, 'a pupil cannot switch them on');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select lives_ok($$ select public.teacher_set_lord_live_arena(true, current_setting('test.cls')::uuid) $$, 'a teacher can');
select pg_temp.reset();

-- ---- Who's here ----
select pg_temp.ben();
select is(jsonb_array_length(public.lord_here() -> 'online'), 0, 'Ben is the first one here');
select pg_temp.ana();
select is(public.lord_here() -> 'online' -> 0 ->> 'name', (select display_name from public.profiles where id = pg_temp.id('0b')), 'Ana sees Ben');
select throws_ok($$ select * from public.lord_clash_picks $$, '42501', null, 'a pupil cannot read the hidden picks');
select throws_ok($$ select public.lord_clash_challenge(auth.uid(), '00000000-0000-0000-0000-00000000000b', 30000) $$, '42501', null, '... or challenge without the server function');
select pg_temp.reset();

-- ---- A clash ----
select pg_temp.act_as_server();
select is(public.lord_clash_challenge(pg_temp.id('0a'), pg_temp.id('0a'), 30000) ->> 'result', 'away', 'nobody can challenge themselves');
select set_config('test.c1', public.lord_clash_challenge(pg_temp.id('0a'), pg_temp.id('0b'), 30000) ->> 'clash', true);
select is((select status from public.lord_clashes where id = current_setting('test.c1')::bigint), 'asked', 'Ana challenges Ben');
select is((select heroes -> 1 ->> 'heroClass' from public.lord_clashes where id = current_setting('test.c1')::bigint), 'mage', '... with both heroes'' looks');
select is(public.lord_clash_answer(pg_temp.id('0a'), current_setting('test.c1')::bigint, true, 60000) ->> 'result', 'not-yours', 'only Ben can say yes');
select is(public.lord_clash_answer(pg_temp.id('0b'), current_setting('test.c1')::bigint, true, 60000) -> 'clash' ->> 'status', 'playing', 'Ben says yes');
select is(public.lord_clash_pick(pg_temp.id('0a'), current_setting('test.c1')::bigint, 0, 'hammer', true) -> 'picks', '[{"move": "hammer", "right": true}, null]'::jsonb,
  'Ana picks first: only her pick is in');
select is(public.lord_clash_pick(pg_temp.id('0a'), current_setting('test.c1')::bigint, 0, 'net', true) ->> 'result', 'already', '... once');
select is(public.lord_clash_pick(pg_temp.id('0b'), current_setting('test.c1')::bigint, 0, 'sword', false) -> 'picks',
  '[{"move": "hammer", "right": true}, {"move": "sword", "right": false}]'::jsonb, 'Ben''s pick comes second and gets both');
select is((public.lord_clash_round(current_setting('test.c1')::bigint, 1, '[[{"move": "hammer", "right": true}, {"move": "sword", "right": false}]]', '{0,0}',
  (extract(epoch from now()) * 1000 + 60000)::bigint)).version, 2, 'the round is saved');
select is((select count(*)::integer from public.lord_clash_picks), 0, '... and its picks are gone');
select ok(public.lord_clash_round(current_setting('test.c1')::bigint, 1, '[]', '{0,0}', 0) is null, 'a save from an old version is refused');
select is((public.lord_clash_end(current_setting('test.c1')::bigint, 2, 'done', 'finished', 0::smallint, null, null, '{20,10}', 3)).gold, '{20,10}'::integer[],
  'the clash ends and pays both sides');
select is(pg_temp.gold('0a') || '/' || pg_temp.gold('0b'), '30/10', '... into their heroes');
select ok(public.lord_clash_end(current_setting('test.c1')::bigint, 3, 'done', 'finished', 0::smallint, null, null, '{20,10}', 3) is null, 'it ends once');
select pg_temp.reset();

-- ---- Only the two players read it ----
select pg_temp.ben();
select is((select count(*)::integer from public.lord_clashes), 1, 'Ben reads his clash');
select is(public.lord_clash_cheer(current_setting('test.c1')::bigint, 'good-fight') -> 'cheers', '[null, "good-fight"]'::jsonb, '... and cheers at the end');
select pg_temp.reset();

select * from finish();
rollback;
