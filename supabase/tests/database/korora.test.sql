-- Penguin Pairs (migration 20261105000100, short id korora): progress, challenges, the switch and the help setting, and
-- the hub hooks with one achievement per Golden Fish.
-- Pupils can't read or change any of it directly; the server function does everything.
-- Run on a throw-away copy: scripts/scratch-db.sh korora, then scripts/scratch-test.sh korora supabase/tests/database/korora.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000e';

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
-- Ten goes, as the server keeps them (the database only checks there are ten).
create function pg_temp.goes() returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('key', 'dbl:' || (1 + n % 5), 'v', 1)) from generate_series(1, 10) n
$$;

-- ---- On to start for every class, with the help fading ----
select is((select bool_and(korora_enabled) from public.app_settings), true, 'the game starts switched on everywhere');
select is((select bool_and(korora_help = 'fade') from public.app_settings), true, '... with the help fading');

-- ---- Pupils can't reach anything directly ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.korora_progress $$, '42501', null, 'a pupil cannot read anyone''s pool');
select throws_ok($$ select * from public.korora_rounds $$, '42501', null, '... or the challenges');
select throws_ok($$ select public.korora_load(auth.uid()) $$, '42501', null, '... or load through the server functions');
select throws_ok($$ select public.korora_start(auth.uid(), 5, 1::smallint, false, pg_temp.goes()) $$, '42501', null, '... or start their own challenge');
select throws_ok($$ select public.korora_finish(auth.uid(), 5, 1, 29, '2026-11-04', 2::smallint, '[]', 0) $$, '42501', null, '... or finish one with any day count');
select throws_ok($$ select public.teacher_set_korora(true) $$, null, null, 'a pupil cannot switch the game on');

-- ---- The teacher's switch and help setting ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select lives_ok($$ select public.teacher_set_korora(enabled => true) $$, 'a teacher can switch it on');
select lives_ok($$ select public.teacher_set_korora(help => 'always') $$, '... and keep the help on');
select throws_ok($$ select public.teacher_set_korora() $$, '22023', null, 'a setting must be given');
select throws_ok($$ select public.teacher_set_korora(help => 'lots') $$, '22023', null, '... and a help setting must be one of three');
select pg_temp.reset();
select is((select korora_enabled from public.app_settings where id = public.settings_id_of(pg_temp.id('0e'))), true, '... and the switch stays on');
select is((select korora_help from public.app_settings where id = public.settings_id_of(pg_temp.id('0e'))), 'always', '... with the help always on');

-- ---- A pool and a challenge ----
select pg_temp.act_as_server();
select is(public.korora_load(pg_temp.id('0a')), null, 'a new pupil has no pool yet');
select throws_ok($$ select public.korora_load('00000000-0000-0000-0000-000000000099') $$, '22023', null, 'nobody who is not a pupil');
select ok(public.korora_start(pg_temp.id('0a'), 777, 1::smallint, false, pg_temp.goes()), 'a challenge starts');
select is(public.korora_load(pg_temp.id('0a')), '{"daysDone": 0, "lastPebbleDay": null, "reached": 1, "version": 1}'::jsonb, '... making the pupil''s pool');
select ok(not public.korora_start(pg_temp.id('0a'), 777, 1::smallint, false, pg_temp.goes()), 'a seed is used once per pupil');
select throws_ok($$ select public.korora_start(pg_temp.id('0a'), 778, 1::smallint, false, '[]') $$, '23514', null, 'a challenge has ten goes');
select is(public.korora_round(pg_temp.id('0b'), 777), null, 'another pupil''s challenge is not theirs');
select is(public.korora_round(pg_temp.id('0a'), 777) -> 'round' -> 'goes', pg_temp.goes(), 'the goes are kept as the server made them');

-- Finishing: once, together with the progress, never more than one day at a time, and never back a level.
select ok(not public.korora_finish(pg_temp.id('0a'), 777, 1, 2, '2026-11-04', 1::smallint, '[{"pick":10,"ms":900}]', 0), 'two days at once is refused');
select ok(not public.korora_finish(pg_temp.id('0a'), 777, 5, 1, '2026-11-04', 1::smallint, '[{"pick":10,"ms":900}]', 0), '... and so is an old version');
select ok(public.korora_finish(pg_temp.id('0a'), 777, 1, 1, '2026-11-04', 2::smallint, '[{"pick":10,"ms":900}]', 1), 'the challenge finishes, moving on to level 2');
select ok(not public.korora_finish(pg_temp.id('0a'), 777, 2, 2, '2026-11-05', 2::smallint, '[{"pick":10,"ms":900}]', 1), '... once');
select ok(public.korora_start(pg_temp.id('0a'), 779, 1::smallint, false, pg_temp.goes()), 'another challenge starts');
select ok(not public.korora_finish(pg_temp.id('0a'), 779, 2, 2, '2026-11-05', 1::smallint, '[{"pick":10,"ms":900}]', 0), '... but cannot drop back a level');
select is(public.korora_load(pg_temp.id('0a')), '{"daysDone": 1, "lastPebbleDay": "2026-11-04", "reached": 2, "version": 2}'::jsonb,
  'the pool is saved');
select pg_temp.reset();

-- ---- In the hub: registered, one achievement per Golden Fish, no points ----
select ok(exists (select 1 from public.hub_games where id = 'korora' and switch_column = 'korora_enabled' and counts_fn is not null
  and rules_fn is not null and players_fn is not null and season_fn is null and last_played_fn is not null and keep_achievements),
  'Penguin Pairs is registered with its hooks, with nothing for New Season to clear');
select is((select count(*)::integer from public.achievement_types where game = 'korora'), 6, 'with six achievements, one for each friend''s gold dancing shoes');
select is((select name from public.achievement_types where id = 'korora-korora'), 'Two-Shoes’ gold dancing shoes', 'the first is Two-Shoes'' gold dancing shoes');
select is(public.korora_counts(pg_temp.id('0a')), '{"korora_fish": 0}'::jsonb, 'no Golden Fish after one day');
update public.korora_progress set days_done = 30 where player = pg_temp.id('0a');
select is(public.korora_counts(pg_temp.id('0a')), '{"korora_fish": 1}'::jsonb, 'the first Golden Fish after thirty days');
select public.game_progress_changed(pg_temp.id('0a'), 'korora');
select ok(exists (select 1 from public.achievements where player = pg_temp.id('0a') and achievement = 'korora-korora'), '... and Two-Shoes'' achievement with it');
select ok(not exists (select 1 from public.achievements where player = pg_temp.id('0a') and achievement = 'korora-hoiho'), '... not Hoiho''s yet');
select ok(public.korora_last_played(pg_temp.id('0a')) is not null and public.korora_last_played(pg_temp.id('0b')) is null, 'when a pupil last played comes from their pool');
select pg_temp.reset();
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.teacher_korora_student(pg_temp.id('0b')) $$, null, null, 'a pupil cannot read a classmate''s pool');
select pg_temp.reset();

select * from finish();
rollback;
