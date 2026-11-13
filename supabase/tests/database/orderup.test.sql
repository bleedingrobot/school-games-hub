-- Order Up! (migration 20261114000200, short id orderup): progress, sets and bags, the switch and help setting, the hub
-- hooks and the teacher's class read. Pupils can't read or change any of it directly; the server function does everything.
-- Run on a throw-away copy: scripts/scratch-db.sh orderup, then scripts/scratch-test.sh orderup supabase/tests/database/orderup.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
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
create function pg_temp.set(seed integer, level integer) returns jsonb language sql as $$
  select jsonb_build_object('seed', seed, 'level', level, 'help', 'full',
    'bags', (select jsonb_agg(jsonb_build_object('text', '4 + 3 × 5', 'key', 'bedmas:mul-first')) from generate_series(1, 8)))
$$;
create function pg_temp.bag(seed integer, slot integer, good boolean) returns jsonb language sql as $$
  select public.orderup_bag(pg_temp.id('0a'), seed, slot::smallint, '[{"p":[3,5],"ms":900},{"a":15,"ms":800},{"a":19,"ms":700}]',
    good, good, case when good then 0 else 3 end, 0, case when good then 0 else 3 end,
    case when good then '{}'::text[] else array['rank', 'rank', 'not-same-step'] end, 2400)
$$;

-- Bags 1 to 7 in order (bag 5 a hard one): the last answer.
create function pg_temp.rest(seed integer) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  for s in 1..7 loop r := pg_temp.bag(seed, s, s <> 5); end loop;
  return r;
end $$;

-- ---- On to start for every class, help fading ----
select is((select bool_and(orderup_enabled) from public.app_settings), true, 'the activity starts switched on everywhere');
select is((select bool_and(orderup_help = 'fade') from public.app_settings), true, '... with the help fading');

-- ---- Pupils can't reach anything directly ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.orderup_progress $$, '42501', null, 'a pupil cannot read anyone''s place');
select throws_ok($$ select * from public.orderup_bags $$, '42501', null, '... or the bags');
select throws_ok($$ select public.orderup_save(auth.uid(), 0, 7::smallint, '{}') $$, '42501', null, '... or pass every level themselves');
select throws_ok($$ select public.teacher_set_orderup(true) $$, null, null, 'a pupil cannot change the switch');

-- ---- The teacher's switch and help setting ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select lives_ok($$ select public.teacher_set_orderup(help => 'hints', target_class => current_setting('test.cls')::uuid) $$, 'a teacher can set the help');
select throws_ok($$ select public.teacher_set_orderup(help => 'lots', target_class => current_setting('test.cls')::uuid) $$, '22023', null, '... only to one of three');
select throws_ok($$ select public.teacher_set_orderup(help => 'fade') $$, null, null, '... and must name a class');
select pg_temp.reset();
select is((select orderup_help from public.app_settings where id = public.settings_id_of(pg_temp.id('0e'))), 'hints', '... and it is kept');

-- ---- A set of eight bags ----
select pg_temp.act_as_server();
select is(public.orderup_load(pg_temp.id('0a')), null, 'a new pupil has no place yet');
select ok(public.orderup_start(pg_temp.id('0a'), 4242, 1::smallint, pg_temp.set(4242, 1)), 'a set starts');
select ok(not public.orderup_start(pg_temp.id('0a'), 4242, 1::smallint, pg_temp.set(4242, 1)), 'a seed is used once');
select throws_ok($$ select public.orderup_start(pg_temp.id('0a'), 5, 1::smallint, pg_temp.set(6, 1)) $$, '22023', null, 'the kept set must match its seed');
select is(pg_temp.bag(4242, 1, true), null, 'bags are saved in order');
select is(pg_temp.bag(4242, 0, true), '{"done": 1, "good": 1}'::jsonb, 'the first bag is saved');
select is(pg_temp.bag(4242, 0, true), null, '... once');
select is(pg_temp.rest(4242), '{"done": 8, "good": 7}'::jsonb, 'eight bags close the set');
select is((select open from public.orderup_sets where seed = 4242), false, '... and it is closed');
select ok(public.orderup_save(pg_temp.id('0a'), 1, 1::smallint, '{"1": {"help": "full", "goodDays": ["2026-11-14"], "hardInRow": 0}}'), 'the place is saved');
select ok(not public.orderup_save(pg_temp.id('0a'), 1, 0::smallint, '{}'), 'a stale version is refused');
select is((public.orderup_counts(pg_temp.id('0a')) ->> 'orderup_level_step')::int, 1, 'passing level 1 counts for its achievement');

-- ---- The teacher sees the pupil and the class's mistake ----
select pg_temp.reset();
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select is((public.teacher_orderup_class(current_setting('test.cls')::uuid) -> 'slips' -> 0 ->> 'kind'), 'rank', 'the class''s most common mistake');
select is((select count(*)::int from jsonb_array_elements(public.teacher_progress_other_games(current_setting('test.cls')::uuid)) r where r ->> 'game' = 'orderup'), 1, 'the Progress tab gets one line');

select * from finish();
rollback;
