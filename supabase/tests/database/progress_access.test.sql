-- Checks who can see and change progress: students can't write points, ratings or
-- achievements; leaderboards show only names, avatars and badges and leave out hidden
-- students; the teacher functions refuse students and outsiders, and work for teachers.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(63);

-- 14 students (s1..s14) and a teacher. IDs end in the student's number.
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid, 's' || n || '@douglaspark.school.nz'
from generate_series(1, 14) n;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000e';

create function pg_temp.id(n integer) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid
$$;
create function pg_temp.act_as(id uuid, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.act_as_student(n integer) returns void language sql as $$
  select pg_temp.act_as(pg_temp.id(n), 's' || n || '@douglaspark.school.nz')
$$;
create function pg_temp.act_as_teacher() returns void language sql as $$
  select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz')
$$;
create function pg_temp.act_as_anon() returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.bot(n integer, level text, result text, how_many integer) returns void language sql as $$
  insert into public.bot_games (player, game, bot_level, player_side, moves, result, reason, player_moves, counts_for_points)
  select pg_temp.id(n), 'chess', level, 'white', '{e2e4}', result, 'resigned', 12, true from generate_series(1, how_many)
$$;

-- This week's chess points: student n (1..12) loses 3 games to Very Easy (1 point each) and
-- wins n (3 each): 3 + 3n points. s13 just loses 3 (3 points, last). s14 has the most but is
-- hidden. s11 has only 2 games: not enough to be on the weekly board.
select pg_temp.bot(n, 'very-easy', 'lost', 3) from generate_series(1, 12) n where n <> 11;
select pg_temp.bot(n, 'very-easy', 'won', n) from generate_series(1, 12) n where n <> 11;
select pg_temp.bot(11, 'very-easy', 'won', 2);
select pg_temp.bot(13, 'very-easy', 'lost', 3);
select pg_temp.bot(14, 'medium', 'won', 5);
update public.profiles set hidden = true where id = pg_temp.id(14);
-- Checkers friend games: s1 beats s2 five times, so both have 5 rated games.
insert into public.mp_games (game, created_by, first_player, second_player, status, winner, reason, counts_for_points, finished_at)
select 'checkers', pg_temp.id(1), pg_temp.id(1), pg_temp.id(2), 'finished', 'first', 'checkmate', true, now() - n * interval '1 minute'
from generate_series(1, 5) n;

-- ---- Nobody can write scores from the website ----
select pg_temp.act_as_student(1);
select throws_ok($$ insert into public.scored_games (player, game, kind, bot_game, result, reason, points, finished_at, nz_day)
  values (auth.uid(), 'chess', 'bot', gen_random_uuid(), 'won', 'checkmate', 999, now(), current_date) $$,
  '42501', null, 'a student can''t add points');
select throws_ok($$ update public.ratings set rating = 3000 $$, '42501', null, 'a student can''t change ratings');
select throws_ok($$ insert into public.achievements values (auth.uid(), 'chess-champion', now()) $$,
  '42501', null, 'a student can''t give themselves an achievement');
select throws_ok($$ delete from public.achievements $$, '42501', null, 'a student can''t delete achievements');
select throws_ok($$ update public.achievement_types set goal = 1 $$, '42501', null, 'a student can''t change the achievement list');
select throws_ok($$ select * from public.scored_games $$, '42501', null, 'a student can''t read the score table directly');
select throws_ok($$ select * from public.ratings $$, '42501', null, 'a student can''t read raw ratings');
select throws_ok($$ select public.rebuild_progress() $$, '42501', null, 'a student can''t re-run the scoring');
select throws_ok($$ select public.score_bot_game(b) from public.bot_games b limit 1 $$, '42501', null,
  'a student can''t score a game');
select throws_ok($$ select public.award_achievements(auth.uid(), 'chess', now()) $$, '42501', null,
  'a student can''t hand out achievements');
select throws_ok($$ update public.bot_games set result = 'won' $$, '42501', null, 'a student can''t change a saved game');
select is((select count(*)::int from public.achievement_types), 38, 'students can read the achievement list');

-- ---- Signed-out visitors and outsiders see nothing ----
select pg_temp.act_as_anon();
select throws_ok($$ select * from public.leaderboard('chess', 'week') $$, '42501', null, 'signed out: no leaderboard');
select throws_ok($$ select public.my_progress() $$, '42501', null, 'signed out: no progress');
select throws_ok($$ select public.progress_rules() $$, '42501', null, 'signed out: no rules');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000ff', 'someone@gmail.com');
select is((select count(*)::int from public.leaderboard('chess', 'week')), 0, 'a non-school token sees an empty leaderboard');
select is(public.my_progress(), null, 'a non-school token has no progress');

-- ---- Leaderboards ----
select is(pg_get_function_result('public.leaderboard(text, text)'::regprocedure),
  'TABLE(place integer, display_name text, avatar jsonb, rank text, points integer, games integer, is_me boolean)',
  'a leaderboard row is only a place, name, avatar, badge, points and games: no IDs or emails');

select pg_temp.act_as_student(13);
select is((select count(*)::int from public.leaderboard('chess', 'week')), 11, 'top 10, plus my own line below them');
select is((select array_agg(points order by place) from public.leaderboard('chess', 'week') where place <= 10),
  -- 3 + 3n from games, plus 10 a badge: First game, First win, Beat Very Easy, and 10 games for n >= 7.
  array[79, 73, 70, 67, 64, 51, 48, 45, 42, 39], 'the weekly board is ordered by points this week, badges included');
select is((select place from public.leaderboard('chess', 'week') where is_me), 12,
  'I see my own place even outside the top 10');
select ok(not exists (select 1 from public.leaderboard('chess', 'week') where display_name =
  (select display_name from public.profiles where id = pg_temp.id(14))), 'hidden students aren''t on the board');
select pg_temp.act_as_student(11);
select is((select place from public.leaderboard('chess', 'week') where is_me), null,
  'with only 2 games this week I''m not on the board yet (no place)...');
select is((select games from public.leaderboard('chess', 'week') where is_me), 2, '...and the page can say how many I''ve played');
select is((select count(*)::int from public.leaderboard('chess', 'week') where not is_me and place is null), 0,
  'other people never appear without a place');
select pg_temp.act_as_student(14);
select is((select place from public.leaderboard('chess', 'week') where is_me), null, 'a hidden student has no place either');

select pg_temp.act_as_student(5);
select is((select array_agg(rank order by place) from public.leaderboard('checkers', 'all-time') where place is not null),
  array['silver', 'bronze'], 'the all-time board shows badges, best first, and only players with 5 rated games');
select is((select count(*)::int from public.leaderboard('checkers', 'all-time') where points is not null), 0,
  'the all-time board shows no numbers');
select is((select count(*)::int from public.leaderboard('checkers', 'improved') where place is not null), 1,
  'most improved: only players whose rating went up this week');
select is((select count(*)::int from public.leaderboard('chess', 'all-time') where place is not null), 0,
  'chess and checkers have separate boards');
select throws_ok($$ select * from public.leaderboard('chess', 'everything') $$, '22023', null, 'unknown boards are refused');

-- ---- My progress ----
select pg_temp.act_as_student(1);
-- 3 chess badges (First game, First win, Beat Very Easy), 4 checkers (First game, First win, Beat a friend, Silver).
select is((public.my_progress() ->> 'points')::int, 6 + 5 * 8 + 7 * 10,
  'my points: bot games + friend games + 10 for each achievement');
select is((public.my_progress() ->> 'level')::int, 2, 'and my level');
select is(public.my_progress() #>> '{games,0,game}', 'checkers', 'my progress for each game');
select is(public.my_progress() #>> '{games,0,rank,rank}', 'silver', 'my checkers badge');
select is(public.my_progress() #>> '{games,0,rank,next}', 'gold', 'and the next one to aim for');
select ok(public.my_progress()::text !~ '"rating"', 'no raw rating numbers are sent to the page');
select is(jsonb_array_length(public.my_progress() -> 'achievements'), 38, 'every achievement, with my progress on each');
select is((public.progress_rules() ->> 'botDailyCap')::int, 40, 'the rules page reads the real daily cap');

-- ---- Teacher functions refuse students ----
select pg_temp.act_as_student(1);
select throws_ok($$ select * from public.teacher_students() $$, '42501', null, 'a student can''t list students');
select throws_ok(format('select public.teacher_student_detail(%L)', pg_temp.id(2)), '42501', null,
  'a student can''t see another student''s games');
select throws_ok($$ select public.teacher_set_multiplayer(false) $$, '42501', null, 'a student can''t switch off friend games');
select throws_ok(format('select public.teacher_set_role(%L, ''teacher'')', pg_temp.id(2)), '42501', null,
  'a student can''t make someone a teacher');
select throws_ok(format('select public.teacher_set_hidden(%L, true)', pg_temp.id(2)), '42501', null, 'a student can''t hide someone');
select throws_ok(format('select public.teacher_reset_name(%L)', pg_temp.id(2)), '42501', null, 'a student can''t rename someone');
select throws_ok(format('select public.teacher_delete_student(%L)', pg_temp.id(2)), '42501', null, 'a student can''t delete someone');
select throws_ok($$ select public.teacher_new_season('NEW SEASON') $$, '42501', null, 'a student can''t start a new season');
select pg_temp.act_as_anon();
select throws_ok($$ select * from public.teacher_students() $$, '42501', null, 'signed-out visitors can''t list students');

-- ---- Teachers can do each thing ----
select pg_temp.act_as_teacher();
select is((select count(*)::int from public.teacher_students()), 15, 'a teacher sees everyone, hidden students too');
select is((select bot_games from public.teacher_students() where id = pg_temp.id(3)), 6, 'with how many games they''ve played');
select is(public.teacher_student_detail(pg_temp.id(1)) #>> '{games,0,friend,won}', '5', 'a teacher can see a student''s stats');
select is(jsonb_array_length(public.teacher_student_detail(pg_temp.id(1)) -> 'recent'), 9, 'and their recent games');
select lives_ok($$ select public.teacher_set_multiplayer(false) $$, 'a teacher can switch off friend games');
select is((select multiplayer_enabled from public.app_settings), false, '...and they''re off');
select lives_ok(format('select public.teacher_set_role(%L, ''teacher'')', pg_temp.id(2)), 'a teacher can make someone a teacher');
select throws_ok($$ select public.teacher_set_role('00000000-0000-0000-0000-00000000000e', 'student') $$, '42501', null,
  'but not change their own role');
select isnt(public.teacher_reset_name(pg_temp.id(3)), (select display_name from public.profiles where id = pg_temp.id(3)),
  'a teacher can give someone a new name');
select lives_ok(format('select public.teacher_set_hidden(%L, true)', pg_temp.id(4)), 'a teacher can hide someone');
select lives_ok(format('select public.teacher_delete_student(%L)', pg_temp.id(5)), 'a teacher can delete a student');
select is((select count(*)::int from public.profiles where id = pg_temp.id(5)), 0, '...and their profile and scores are gone');
select throws_ok($$ select public.teacher_new_season('new season please') $$, '22023', null,
  'a new season needs the exact words NEW SEASON');
select is(public.teacher_new_season('NEW SEASON') ->> 'botGames', '102', 'a new season deletes the finished games');
select pg_temp.reset();
select is((select count(*)::int from public.scored_games) + (select count(*)::int from public.ratings)
  + (select count(*)::int from public.achievements), 0, '...and every point, rating and achievement');

select * from finish();
rollback;
