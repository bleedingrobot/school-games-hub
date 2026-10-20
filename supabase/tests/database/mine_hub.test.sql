-- Mine Runner stage 5: the hub fit, through hub_games (migrations 20261021000100 and 20261021000200).
-- The teacher's switch, points for a first finish and a better time, achievements, How points work, the teacher's
-- "last played" and a New Season, none of it by re-creating a shared function.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

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
create function pg_temp.save(who text, n integer, in_steps integer, in_level text, in_medal text default null, in_maths boolean default false) returns text language sql as $$
  select public.record_mine_run(pg_temp.id(who), 'hub-seed-' || who || '-' || n, in_level, 'steady', in_maths,
    in_steps, 0, 0, '1x' || in_steps, 20, in_medal)
$$;
create function pg_temp.mine_ach(who text) returns jsonb language sql as $$
  select coalesce(jsonb_agg(a ->> 'id' order by a ->> 'id'), '[]') from public.achievements x
  join public.achievement_types t on t.id = x.achievement and t.game = 'mine'
  cross join lateral (select jsonb_build_object('id', x.achievement) a) s
  where x.player = pg_temp.id(who)
$$;

-- ---- Registered ----
select ok(exists (select 1 from public.hub_games where id = 'mine' and switch_column = 'mine_enabled' and counts_fn is not null
  and rules_fn is not null and players_fn is not null and season_fn is not null and last_played_fn is not null), 'Mine Runner is registered with every hook');
select is((select count(*)::integer from public.achievement_types where game = 'mine'), 6, '... with its six achievements');
select is((select mine_enabled from public.app_settings limit 1), false, 'the game starts switched off');

-- ---- The teacher's switch ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.teacher_set_mine(true) $$, null, null, 'a pupil cannot switch the game on');
select throws_ok($$ select public.mine_counts(auth.uid()) $$, '42501', null, 'pupils cannot call the hooks directly');
select throws_ok($$ select public.mine_season(array[auth.uid()]) $$, '42501', null, '... or clear a season');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select lives_ok($$ select public.teacher_set_mine(true) $$, 'a teacher can switch it on');
select is((select mine_enabled from public.app_settings limit 1), true, '... and it is saved');
select throws_ok($$ select public.teacher_set_mine(null) $$, '22023', null, 'a missing setting is refused');
select lives_ok($$ select public.teacher_set_mine(false) $$, 'and off again');
select pg_temp.reset();

-- ---- Saving gives the first-finish and best signals, and the counts follow ----
select pg_temp.act_as_server();
select is(pg_temp.save('0a', 1, 4000, 'l1', 'bronze'), 'first', 'a first finish says so');
select is(pg_temp.save('0a', 2, 3000, 'l1', 'silver'), 'best', 'a better time is a best');
select is(pg_temp.save('0a', 3, 2500, 'l2', 'gold'), 'first', 'another mine is another first');
select is(pg_temp.save('0a', 4, 2400, 'l2:hard', 'gold'), 'first', 'and a hard mine');
select pg_temp.reset();
select is(public.mine_counts(pg_temp.id('0a')), '{"mine_levels": 2, "mine_golds": 2, "mine_hard": 1, "mine_answers": 0}'::jsonb,
  'the counts: two mines, two gold boards, one hard mine, no answers yet');

-- ---- Points ----
select pg_temp.act_as_server();
select is(public.add_game_points(pg_temp.id('0a'), 'mine', 2, 'mine-first:l1'), true, 'the server gives the first-finish points');
select is(public.add_game_points(pg_temp.id('0a'), 'mine', 2, 'mine-first:l1'), false, '... once');
select is(public.add_game_points(pg_temp.id('0a'), 'mine', 1, 'mine-best:l1:2026-10-21'), true, 'a better time earns a point');
select is(public.add_game_points(pg_temp.id('0a'), 'mine', 1, 'mine-best:l1:2026-10-21'), false, '... once a day for each mine');
select is(public.add_game_points(pg_temp.id('0a'), 'mine', 1, 'mine-best:l1:2026-10-22'), true, '... and again the next day');
select pg_temp.reset();
select is((select sum(points)::integer from public.scored_games where player = pg_temp.id('0a') and game = 'mine'), 4, 'they are scored as a solo game, 4 points in all');
select ok(public.points_total(pg_temp.id('0a')) >= 4, '... and count in the points total');

-- ---- Achievements, the switch and How points work ----
select pg_temp.act_as_server();
select public.game_progress_changed(pg_temp.id('0a'), 'mine');
select pg_temp.reset();
select is(pg_temp.mine_ach('0a'), '["mine-first-dive", "mine-gold-miner", "mine-hard-hat"]'::jsonb,
  'the first dive, a gold and a hard mine earn their achievements');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(public.progress_rules() -> 'hubGames' -> 'mine', null, 'while the game is off, its rules are hidden');
select pg_temp.reset();
update public.app_settings set mine_enabled = true;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(jsonb_array_length(public.progress_rules() -> 'hubGames' -> 'mine' -> 'lines'), 3, 'switched on, How points work lists its lines');
select is(public.progress_rules() -> 'hubGames' -> 'mine' -> 'lines' ->> 0, 'Finish a mine for the first time: 2 points.', '... starting with the points');
select pg_temp.reset();

-- Doors and pads opened by an answer count towards Brain power.
select pg_temp.act_as_server();
select public.record_mine_run(pg_temp.id('0b'), 'hub-seed-0b-9', 'l3', 'steady', true, 5000, 12, 0, '1x5000', 20, 'bronze');
select public.game_progress_changed(pg_temp.id('0b'), 'mine');
select pg_temp.reset();
select ok(exists (select 1 from public.achievements where player = pg_temp.id('0b') and achievement = 'mine-brain-power'), '10 answered doors and pads earn Brain power');

-- ---- The teacher's list, a rebuild and a New Season ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select ok((select last_played from public.teacher_students() where id = pg_temp.id('0a')) > now() - interval '1 minute', 'the teacher sees when the pupil last played');
select lives_ok($$ select public.teacher_new_season('NEW SEASON') $$, 'a school admin starts a new season');
select pg_temp.reset();
select is((select count(*)::integer from public.mine_bests) + (select count(*)::integer from public.mine_runs), 0, 'it clears the times and saved runs');
select is((select count(*)::integer from public.achievements where achievement like 'mine-%'), 0, '... and the achievements');

select * from finish();
rollback;
