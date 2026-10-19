-- Points and achievements for new games through hub_games (migration 20261020000100_game_hooks.sql).
-- A pretend game, "test-game", registers every hook. Its points, the shared daily cap, its achievements, the teacher's
-- switch, How points work, a rebuild, the teacher's list and a New Season all work without changing a shared function,
-- and nobody but the server can give points.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
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
create function pg_temp.ana() returns void language sql as $$
  select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz')
$$;
create function pg_temp.mine(field text) returns jsonb language sql as $$
  select coalesce(jsonb_agg(a), '[]') from jsonb_array_elements(public.my_progress() -> 'achievements') a where a ->> 'game' = field
$$;

-- ---- The older games are all listed, and the old lists of allowed values are now rows ----
select ok((select count(*) from public.hub_games where id in ('chess', 'checkers', 'space', '101', 'gem-keep', 'power-clash',
  'monsters', 'dragon-maths', 'clan-quest')) = 9, 'every older game is in hub_games');
select ok(exists (select 1 from public.achievement_measures where measure = 'clan_cries'), 'the older measures are rows');
select throws_ok($$ insert into public.achievement_types (id, game, name, emoji, measure, goal, sort)
  values ('x-1', 'no-such-game', 'X', '⭐', 'wins', 1, 1) $$, '23503', null, 'an achievement for an unknown game is refused');
select throws_ok($$ insert into public.achievement_types (id, game, name, emoji, measure, goal, sort)
  values ('x-1', 'chess', 'X', '⭐', 'no_such_measure', 1, 1) $$, '23503', null, '... and one with an unknown measure');

-- ---- The pretend game: a switch, its own table, and every hook ----
alter table public.app_settings add column test_game_on boolean not null default false;
create table public.test_game_saves (player uuid primary key, level integer not null, saved_at timestamptz not null);
create function public.test_game_counts(who uuid) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'test_rounds', (select count(*) from public.game_points p where p.player = who and p.game = 'test-game'),
    'test_level', coalesce((select s.level from public.test_game_saves s where s.player = who), 0))
$$;
create function public.test_game_rules() returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('lines', jsonb_build_array('Finish a round: 3 points.'))
$$;
create function public.test_game_players() returns setof uuid language sql stable set search_path = '' as $$
  select s.player from public.test_game_saves s
$$;
create function public.test_game_season(players uuid[]) returns void language sql set search_path = '' as $$
  delete from public.test_game_saves where player = any (players)
$$;
create function public.test_game_last_played(player uuid) returns timestamptz language sql stable set search_path = '' as $$
  select s.saved_at from public.test_game_saves s where s.player = test_game_last_played.player
$$;

select throws_ok($$ insert into public.hub_games (id, counts_fn) values ('test-game', 'public.test_game_rules()') $$,
  '22023', null, 'a hook with the wrong shape is refused');
select throws_ok($$ insert into public.hub_games (id, switch_column) values ('test-game', 'school_id') $$,
  '22023', null, '... and so is a switch that is not a true/false setting');
select lives_ok($$ insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn)
  values ('test-game', 'test_game_on', 'public.test_game_counts(uuid)', 'public.test_game_rules()', 'public.test_game_players()',
    'public.test_game_season(uuid[])', 'public.test_game_last_played(uuid)') $$, 'a new game registers itself with one row');
insert into public.achievement_measures (measure) values ('test_rounds'), ('test_level');
insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('tg-two-rounds', 'test-game', 'Two rounds', '🎯', 'test_rounds', 2, 1),
  ('tg-level-5', 'test-game', 'Level 5', '🏔️', 'test_level', 5, 2);

-- ---- Nobody but the server ----
select pg_temp.ana();
select throws_ok($$ select * from public.hub_games $$, '42501', null, 'students cannot read hub_games');
select throws_ok($$ select * from public.game_points $$, '42501', null, '... or game_points');
select throws_ok($$ select public.add_game_points(auth.uid(), 'test-game', 50, 'cheat') $$, '42501', null, '... or give themselves points');
select throws_ok($$ select public.game_progress_changed(auth.uid(), 'test-game') $$, '42501', null, '... or check achievements');
select throws_ok($$ select public.hub_games_counts(auth.uid(), 'test-game') $$, '42501', null, '... or call the helpers');
select pg_temp.reset();

-- ---- Points ----
select pg_temp.act_as_server();
select is(public.add_game_points(pg_temp.id('0a'), 'test-game', 3, 'round-1'), true, 'the server gives points');
select is(public.add_game_points(pg_temp.id('0a'), 'test-game', 3, 'round-1'), false, 'the same save again gives nothing');
select throws_ok($$ select public.add_game_points(pg_temp.id('0a'), 'nope', 3, 'x') $$, '22023', null, 'an unknown game is refused');
select pg_temp.reset();
select is((select points from public.scored_games where player = pg_temp.id('0a') and game = 'test-game'), 3,
  'the points are scored like any game against the computer');
select is((select kind from public.scored_games where player = pg_temp.id('0a') and game = 'test-game'), 'solo', '... as a solo game');
select is(public.points_total(pg_temp.id('0a')), 3, '... and count in the points total');

-- The shared points-a-day cap.
select pg_temp.act_as_server();
select public.add_game_points(pg_temp.id('0b'), 'test-game', 30, 'b-1');
select public.add_game_points(pg_temp.id('0b'), 'test-game', 30, 'b-2');
select pg_temp.reset();
select is((select sum(points)::integer from public.scored_games where player = pg_temp.id('0b')), public.bot_daily_cap(),
  'points stop at the same daily cap as games against the computer');

-- ---- Achievements, the switch and How points work ----
select is(public.progress_counts(pg_temp.id('0a'), 'test-game') ->> 'test_rounds', '1', 'the game''s own counts are in progress_counts');
select is(public.progress_counts(pg_temp.id('0a'), 'chess') ? 'test_rounds', false, '... and only for that game');
select pg_temp.act_as_server();
select public.add_game_points(pg_temp.id('0a'), 'test-game', 3, 'round-2');
select pg_temp.reset();
select ok(exists (select 1 from public.achievements where player = pg_temp.id('0a') and achievement = 'tg-two-rounds'),
  'an achievement is earned when the count reaches its goal');
insert into public.test_game_saves values (pg_temp.id('0a'), 5, '2026-10-20 10:00+13');
select pg_temp.act_as_server();
select public.game_progress_changed(pg_temp.id('0a'), 'test-game');
select pg_temp.reset();
select ok(exists (select 1 from public.achievements where player = pg_temp.id('0a') and achievement = 'tg-level-5'),
  '... and one from progress outside points, when the server says it changed');

select pg_temp.ana();
select is(jsonb_array_length(pg_temp.mine('test-game')), 0, 'while the game is switched off, its achievements are hidden');
select is(public.progress_rules() -> 'hubGames', null, '... and so are its points rules');
select pg_temp.reset();
update public.app_settings set test_game_on = true;
select pg_temp.ana();
select is(jsonb_array_length(pg_temp.mine('test-game')), 2, 'switched on, the achievements show');
select is(public.progress_rules() -> 'hubGames' -> 'test-game' -> 'lines' ->> 0, 'Finish a round: 3 points.', '... and its rules');
select ok(public.progress_rules() ? 'clanQuest', 'the older games'' rules are still there');
select ok((public.my_progress() -> 'recent') @> jsonb_build_array(jsonb_build_object('points', 3)), 'its scores are in the recent list');
select pg_temp.reset();

-- ---- Rebuild ----
select is(public.rebuild_progress() ->> 'scored_games', (select count(*)::text from public.scored_games), 'a rebuild runs');
select is((select count(*)::integer from public.scored_games where game = 'test-game'), 4, 'a rebuild scores the game''s points again (two rounds each for Ana and Ben)');
select ok(exists (select 1 from public.achievements where player = pg_temp.id('0a') and achievement = 'tg-level-5'),
  '... and gives back achievements from progress outside points');

-- ---- The teacher's list ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select is((select last_played from public.teacher_students() where id = pg_temp.id('0a')), '2026-10-20 10:00+13'::timestamptz,
  'the teacher sees when the pupil last played the new game');

-- ---- New Season ----
select lives_ok($$ select public.teacher_new_season('NEW SEASON') $$, 'a school admin starts a new season');
select pg_temp.reset();
select is((select count(*)::integer from public.game_points), 0, 'the game''s points go');
select is((select count(*)::integer from public.test_game_saves), 0, '... and whatever its own season hook clears');
select is((select count(*)::integer from public.achievements where achievement like 'tg-%'), 0, '... and its achievements, unless it keeps them');

-- Kept achievements.
update public.hub_games set keep_achievements = true where id = 'test-game';
insert into public.test_game_saves values (pg_temp.id('0a'), 5, now());
select public.game_progress_changed(pg_temp.id('0a'), 'test-game');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select public.teacher_new_season('NEW SEASON');
select pg_temp.reset();
select ok(exists (select 1 from public.achievements where achievement = 'tg-level-5'), 'a game that keeps achievements keeps them');

select * from finish();
rollback;
