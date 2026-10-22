-- Stage 8 security review, kept checked: who can read, write or call what, across the
-- whole database, so a future change can't quietly open something up.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(50);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000e';

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.act_as_server() returns void language sql as $$
  select set_config('role', 'service_role', true), set_config('request.jwt.claims', '{"role":"service_role"}', true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true),
         set_config('realtime.topic', '', true);
$$;

-- ---- The whole database, checked from the catalogue ----
select is_empty($$
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
$$, 'every table has row level security on');

select is_empty($$
  select table_name || ' ' || privilege_type from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'PUBLIC')
$$, 'signed-out visitors have no rights on any table');

select is_empty($$
  select table_name || ' ' || privilege_type from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'authenticated' and privilege_type <> 'SELECT'
$$, 'signed-in users can only read tables, never write to them');

select set_eq($$
  select table_name::text from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'authenticated'
$$, array['achievement_types', 'app_settings', 'archery_duels', 'bot_games', 'card_game_seats', 'mp_games', 'name_words', 'profiles',
  'power_games', 'space_game_log', 'space_games'],
  'signed-in users can read only these tables (row level security narrows them further)');

select is_empty($$
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
$$, 'signed-out visitors cannot call any function');

select set_eq($$
  select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')
$$, array[
  'archery_here', 'can_manage_student', 'cancel_warp_request', 'card_lobby_games', 'choose_my_name', 'clan_scoreboard', 'clear_my_maths_focus',
  'gem_keep_leaderboard', 'is_player_in', 'is_school_admin', 'is_school_email', 'is_school_user', 'is_site_owner',
  'is_teacher', 'is_valid_avatar', 'leaderboard', 'lobby', 'lobby_games', 'log_questions', 'lord_hall', 'lord_news', 'lord_warriors', 'marble_board', 'marble_ghost', 'mine_board',
  'monsters_leaderboard', 'my_bond_match', 'my_bot_game_stats', 'my_card_game_stats', 'my_class', 'my_friend_game_stats',
  'my_gem_keep', 'my_home_page', 'my_ladder', 'my_lord', 'my_marble', 'my_maths_focus', 'my_mine', 'my_monsters', 'my_moves_left', 'my_power_game_stats', 'my_progress', 'my_school', 'my_school_info',
  'my_settings_id', 'my_space_game_stats', 'my_training', 'my_training_lock', 'owner_add_school', 'owner_add_school_domain',
  'owner_schools', 'owner_set_school_active', 'owner_set_school_contact', 'power_lobby_games', 'progress_rules',
  'save_my_avatar', 'school_set_admin', 'school_set_default_class', 'server_time', 'set_my_maths_focus', 'space_lobby_games',
  'teacher_add_co_teacher', 'teacher_add_to_class', 'teacher_answer_warp', 'teacher_archive_class', 'teacher_bond_match_student',
  'teacher_clan_info', 'teacher_clan_maths_class', 'teacher_clan_maths_student', 'teacher_clans_new_season',
  'teacher_class_detail', 'teacher_class_events', 'teacher_class_settings', 'teacher_class_skill_map', 'teacher_classes', 'teacher_create_class', 'teacher_create_group',
  'teacher_create_village', 'teacher_delete_group', 'teacher_delete_student', 'teacher_delete_village', 'teacher_end_maths_focus', 'teacher_extend_maths_focus',
  'teacher_gem_keep_class', 'teacher_gem_keep_student', 'teacher_lord_class', 'teacher_lord_student',
  'teacher_maths_focus_history', 'teacher_maths_focus_results', 'teacher_maths_focuses', 'teacher_monster_class', 'teacher_monster_student', 'teacher_move_pupil', 'teacher_move_student',
  'teacher_new_season', 'teacher_question_skips', 'teacher_remove_co_teacher', 'teacher_remove_from_class', 'teacher_rename_group', 'teacher_rename_village',
  'teacher_reset_clan', 'teacher_reset_lord_hero', 'teacher_reset_name', 'teacher_reset_placement', 'teacher_reset_warp_code',
  'teacher_school_teachers', 'teacher_set_clan_maths', 'teacher_set_clan_raids', 'teacher_set_clans',
  'teacher_set_gem_keep', 'teacher_set_group_member', 'teacher_set_maths_auto', 'teacher_set_hidden', 'teacher_set_lord', 'teacher_set_marble_maths', 'teacher_set_marble_rescue', 'teacher_set_maths_focus',
  'teacher_archery_summary', 'teacher_set_archery', 'teacher_set_archery_duels', 'teacher_set_bond_match', 'teacher_set_mine', 'teacher_set_mine_maths', 'teacher_set_monsters', 'teacher_set_multiplayer', 'teacher_set_role', 'teacher_set_space_maths', 'teacher_set_students_choose_focus', 'teacher_set_trader', 'teacher_reset_trader',
  'teacher_set_space_reactions', 'teacher_set_training_first', 'teacher_set_warp_mode', 'teacher_student_detail', 'teacher_student_ladder', 'teacher_students',
  'teacher_training_student', 'teacher_unassigned_students', 'teacher_update_class', 'teacher_villages',
  'teacher_warp_requests', 'warp_join', 'warp_preview'
], 'signed-in users can call only this list of functions (each checks who is asking)');

select is_empty($$
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) as c where c like 'search_path=%')
$$, 'every function has a fixed search_path');

select set_eq($$
  select schemaname || '.' || tablename from pg_publication_tables where pubname = 'supabase_realtime'
$$, array['public.archery_duels', 'public.card_game_seats', 'public.mp_games', 'public.power_games', 'public.space_games'],
  'live updates are switched on for friend games, space games, Power Clash games, 101 seat rows and Archery classmate fights only');

-- A table made by a future migration starts locked, even if it forgets to say so.
create table public.zz_security_test (id integer);
select ok(not has_table_privilege('anon', 'public.zz_security_test', 'select'), 'a new table is closed to signed-out visitors');
select ok(not has_table_privilege('authenticated', 'public.zz_security_test', 'select,insert,update,delete'),
  'a new table is closed to signed-in users until a migration opens it');
drop table public.zz_security_test;

-- ---- Students can't reach the score tables or the scoring code ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok('select * from public.scored_games', '42501', null, 'a student cannot read scores directly');
select throws_ok('select * from public.ratings', '42501', null, 'a student cannot read ratings directly');
select throws_ok('select * from public.achievements', '42501', null, 'a student cannot read achievements directly');
select throws_ok($$ insert into public.ratings values ('00000000-0000-0000-0000-00000000000a', 'chess', 2000, 50, 3) $$,
  '42501', null, 'a student cannot give themself a rating');
select throws_ok($$ select public.record_bot_game('00000000-0000-0000-0000-00000000000a', 'chess', 'medium', 'white',
    array['e2e4'], 'won', 'checkmate', 10, true) $$, '42501', null, 'a student cannot save a bot game directly');
select throws_ok($$ select public.record_space_bot_game('00000000-0000-0000-0000-00000000000a', 'easy', 'first',
    array['roll'], 'won', 'docked', 10, true, '{"seed":"s1-made-up"}') $$, '42501', null,
  'a student cannot save a space game directly');
select throws_ok($$ select public.record_101_bot_game('00000000-0000-0000-0000-00000000000a', 'easy', 'first',
    array['peek'], 'won', 'finished', 10, true, '{"seed":"s1-made-up"}') $$, '42501', null,
  'a student cannot save a 101 game directly');
select throws_ok('select public.rebuild_progress()', '42501', null, 'a student cannot rebuild the scores');
select throws_ok('select public.mp_tidy()', '42501', null, 'a student cannot run the tidy-up');
select throws_ok('select public.space_tidy()', '42501', null, 'a student cannot run the space tidy-up');
select throws_ok($$ select public.space_add_reaction('10000000-0000-0000-0000-000000000002', 0, '🚀') $$, '42501', null,
  'a student cannot send a reaction without the server');
select throws_ok($$ select * from public.space_player_status('00000000-0000-0000-0000-00000000000b') $$, '42501', null,
  'a student cannot look up another player''s status for space games');
select throws_ok($$ select * from public.power_player_status('00000000-0000-0000-0000-00000000000b') $$, '42501', null,
  'a student cannot look up another player''s status for Power Clash games');
select throws_ok('select public.power_tidy()', '42501', null, 'a student cannot run the Power Clash tidy-up');
select throws_ok($$ select public.score_power_game(g) from public.power_games g $$, '42501', null,
  'a student cannot run Power Clash scoring');
select throws_ok($$ select public.mp_player_status('00000000-0000-0000-0000-00000000000b') $$, '42501', null,
  'a student cannot look up another player''s status');
select throws_ok($$ select public.points_total('00000000-0000-0000-0000-00000000000b') $$, '42501', null,
  'a student cannot look up another player''s points');

-- ---- Teacher tools: students, and teachers whose token isn't a school one ----
select throws_ok('select * from public.teacher_students()', '42501', null, 'a student cannot list everyone');
select throws_ok($$ select public.teacher_student_detail('00000000-0000-0000-0000-00000000000b') $$, '42501', null,
  'a student cannot see another student''s details');
select throws_ok($$ select public.teacher_new_season('NEW SEASON') $$, '42501', null, 'a student cannot start a new season');
select throws_ok('select public.teacher_set_multiplayer(false)', '42501', null, 'a student cannot pause friend games');
select throws_ok('select public.teacher_set_space_reactions(true)', '42501', null, 'a student cannot switch on reactions');
select throws_ok($$select public.teacher_set_space_maths('on')$$, '42501', null, 'a student cannot change the maths switch');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@gmail.com');
select throws_ok('select * from public.teacher_students()', '42501', null,
  'a teacher''s ID with a non-school email in the token gets no teacher powers');

-- ---- The private "who's here" channel for a friend game ----
select pg_temp.reset();
insert into public.mp_games (id, game, code, created_by, first_player, second_player, status, started_at, turn_started_at)
values ('10000000-0000-0000-0000-000000000001', 'chess', 'KMTPX', '00000000-0000-0000-0000-00000000000a',
  '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'playing', now(), now());
insert into realtime.messages (topic, extension, payload, private)
values ('mp-game:10000000-0000-0000-0000-000000000001', 'presence', '{"here":true}', true);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select set_config('realtime.topic', 'mp-game:10000000-0000-0000-0000-000000000001', true);
select lives_ok($$ insert into realtime.messages (topic, extension, payload, private)
  values ('mp-game:10000000-0000-0000-0000-000000000001', 'presence', '{"here":true}', true) $$,
  'a player can say they''re here');
select throws_ok($$ insert into realtime.messages (topic, extension, payload, event, private)
  values ('mp-game:10000000-0000-0000-0000-000000000001', 'broadcast', '{"text":"hi"}', 'chat', true) $$,
  '42501', null, 'a player cannot send messages on the channel (no hidden chat)');
select is((select count(*)::int from realtime.messages where topic = 'mp-game:10000000-0000-0000-0000-000000000001'), 2,
  'a player can see who''s here');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz');
select set_config('realtime.topic', 'mp-game:10000000-0000-0000-0000-000000000001', true);
select is((select count(*)::int from realtime.messages where topic = 'mp-game:10000000-0000-0000-0000-000000000001'), 0,
  'someone else cannot listen in on the game''s channel');
select throws_ok($$ insert into realtime.messages (topic, extension, payload, private)
  values ('mp-game:10000000-0000-0000-0000-000000000001', 'presence', '{"here":true}', true) $$,
  '42501', null, 'someone else cannot join the game''s channel');
select is((select count(*)::int from public.mp_games), 0, 'someone else cannot read the game');
select ok(not public.is_player_in('mp-game:10000000-0000-0000-0000-000000000001'), 'and is not counted as a player in it');

-- ---- The "who's here" channel for a space game: presence only, players only ----
select pg_temp.reset();
insert into public.space_games (id, code, host, seat1, seat2, status, setup, rockets, seat_info, state)
values ('10000000-0000-0000-0000-000000000002', 'KMTPY', '00000000-0000-0000-0000-00000000000a',
  '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'playing', '{}', 2, '[]', '{}');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select set_config('realtime.topic', 'space-game:10000000-0000-0000-0000-000000000002', true);
select lives_ok($$ insert into realtime.messages (topic, extension, payload, private)
  values ('space-game:10000000-0000-0000-0000-000000000002', 'presence', '{"here":true}', true) $$,
  'a space player can say they''re here');
select throws_ok($$ insert into realtime.messages (topic, extension, payload, event, private)
  values ('space-game:10000000-0000-0000-0000-000000000002', 'broadcast', '{"text":"hi"}', 'chat', true) $$,
  '42501', null, 'a space player cannot send messages on the channel (no hidden chat)');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz');
select set_config('realtime.topic', 'space-game:10000000-0000-0000-0000-000000000002', true);
select throws_ok($$ insert into realtime.messages (topic, extension, payload, private)
  values ('space-game:10000000-0000-0000-0000-000000000002', 'presence', '{"here":true}', true) $$,
  '42501', null, 'someone else cannot join a space game''s channel');
select pg_temp.reset();

-- ---- Saving the same bot game twice ----
select pg_temp.act_as_server();
create temporary table saves (n integer, id uuid) on commit drop;
grant all on saves to service_role;
insert into saves select 1, public.record_bot_game('00000000-0000-0000-0000-00000000000a', 'chess', 'medium', 'white',
  array['e2e4','e7e5','f1c4','b8c6','d1h5','g8f6','h5f7','a7a6','a2a3','a6a5','b2b3','a5a4','c2c3','h7h6',
        'd2d3','h6h5','e1d1','h5h4','d1e2','h4h3'], 'lost', 'resigned', 10, true);
insert into saves select 2, public.record_bot_game('00000000-0000-0000-0000-00000000000a', 'chess', 'medium', 'white',
  array['e2e4','e7e5','f1c4','b8c6','d1h5','g8f6','h5f7','a7a6','a2a3','a6a5','b2b3','a5a4','c2c3','h7h6',
        'd2d3','h6h5','e1d1','h5h4','d1e2','h4h3'], 'lost', 'resigned', 10, true);
select pg_temp.reset();
select is((select count(distinct id)::int from saves), 1, 'sending the same game twice hands back the saved game');
select is((select count(*)::int from public.bot_games where player = '00000000-0000-0000-0000-00000000000a'), 1,
  'and saves it only once');
select is((select count(*)::int from public.scored_games where player = '00000000-0000-0000-0000-00000000000a'), 1,
  'and scores it only once');

select pg_temp.act_as_server();
select lives_ok($$ select public.record_bot_game('00000000-0000-0000-0000-00000000000a', 'chess', 'medium', 'white',
  array['e2e4'], 'lost', 'resigned', 1, false) $$, 'a short game that earns nothing...');
select lives_ok($$ select public.record_bot_game('00000000-0000-0000-0000-00000000000a', 'chess', 'medium', 'white',
  array['e2e4'], 'lost', 'resigned', 1, false) $$, '...can be played the same way again');
select pg_temp.reset();
select is((select count(*)::int from public.bot_games where player = '00000000-0000-0000-0000-00000000000a'), 3,
  'and both short games are kept in the history');

select * from finish();
rollback;
