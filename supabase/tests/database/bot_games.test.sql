-- Checks that bot game results can only be saved by the server, and that students see only their own.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000c';

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.act_as_server() returns void language sql as $$
  select set_config('role', 'service_role', true), set_config('request.jwt.claims', '{"role":"service_role"}', true);
$$;
create function pg_temp.act_as_anon() returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

select has_table('public', 'bot_games', 'the bot games table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.bot_games'::regclass), 'row level security is on');

-- ---- The server saves games ----
select pg_temp.act_as_server();
select isnt(
  public.record_bot_game('00000000-0000-0000-0000-00000000000a', 'chess', 'easy', 'black',
    array['f2f3', 'e7e5', 'g2g4', 'd8h4'], 'won', 'checkmate', 2, false),
  null, 'the server can save a game');
select lives_ok($$ select public.record_bot_game('00000000-0000-0000-0000-00000000000a', 'chess', 'medium', 'white',
    array['e2e4'], 'lost', 'resigned', 1, false) $$, 'the server can save a resigned game');
select lives_ok($$ select public.record_bot_game('00000000-0000-0000-0000-00000000000a', 'chess', 'very-easy', 'white',
    array['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8'], 'drawn', 'threefold-repetition', 4, false) $$,
  'the server can save a draw');
select lives_ok($$ select public.record_bot_game('00000000-0000-0000-0000-00000000000a', 'checkers', 'medium', 'red',
    array['11-15', '22-18', '15x22'], 'won', 'no-pieces', 2, false) $$, 'the server can save a checkers game');
select lives_ok($$ select public.record_bot_game('00000000-0000-0000-0000-00000000000b', 'chess', 'easy', 'white',
    array['e2e4'], 'lost', 'abandoned', 1, false) $$, 'the server can save a game for another student');
select throws_ok($$ select public.record_bot_game('00000000-0000-0000-0000-0000000000ee', 'chess', 'easy', 'white',
    array['e2e4'], 'lost', 'abandoned', 1, false) $$, '22023', null, 'games for unknown players are refused');
select throws_ok($$ select public.record_bot_game('00000000-0000-0000-0000-00000000000a', 'chess', 'impossible', 'white',
    array['e2e4'], 'won', 'checkmate', 1, true) $$, '23514', null, 'an unknown bot level is refused');
select throws_ok($$ select public.record_bot_game('00000000-0000-0000-0000-00000000000a', 'chess', 'easy', 'white',
    array['e2e4'], 'super-won', 'checkmate', 1, true) $$, '23514', null, 'an unknown result is refused');

-- ---- Outsiders see nothing and can't save ----
select pg_temp.act_as_anon();
select throws_ok('select * from public.bot_games', '42501', null, 'signed-out visitors cannot read games');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000ee', 'someone@gmail.com');
select is((select count(*)::int from public.bot_games), 0, 'a non-school token sees no games');

-- ---- Students ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is((select count(*)::int from public.bot_games), 4, 'a student sees their own games');
select is((select count(*)::int from public.bot_games where player <> auth.uid()), 0, 'a student cannot see anyone else''s games');
select throws_ok($$ insert into public.bot_games (player, game, bot_level, player_side, moves, result, reason, player_moves, counts_for_points)
  values (auth.uid(), 'chess', 'medium', 'white', '{}', 'won', 'checkmate', 30, true) $$,
  '42501', null, 'a student cannot add a game directly');
select throws_ok($$ select public.record_bot_game(auth.uid(), 'chess', 'medium', 'white', '{}', 'won', 'checkmate', 30, true) $$,
  '42501', null, 'a student cannot use the server''s save function');
select throws_ok($$ update public.bot_games set result = 'won' $$, '42501', null, 'a student cannot change a result');
select throws_ok($$ delete from public.bot_games $$, '42501', null, 'a student cannot delete games');
select results_eq(
  'select game, played, won, lost, drawn from public.my_bot_game_stats() order by game',
  $$ values ('checkers'::text, 1, 1, 0, 0), ('chess'::text, 3, 1, 1, 1) $$,
  'a student gets their own stats, for each game');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select results_eq(
  'select game, played, won, lost, drawn from public.my_bot_game_stats()',
  $$ values ('chess'::text, 1, 0, 1, 0) $$,
  'stats only count your own games');

-- ---- Teachers (no teacher view yet; that's Stage 7) ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'mr.teacher@douglaspark.school.nz');
select is((select count(*)::int from public.bot_games), 0, 'teachers only see their own games for now');

-- ---- The daily limit ----
select pg_temp.act_as_server();
select lives_ok($$ select public.record_bot_game('00000000-0000-0000-0000-00000000000b', 'chess', 'easy', 'white',
    array['e2e4'], 'lost', 'abandoned', 1, false) from generate_series(1, 299) $$, 'up to 300 games a day are fine');
select throws_ok($$ select public.record_bot_game('00000000-0000-0000-0000-00000000000b', 'chess', 'easy', 'white',
    array['e2e4'], 'lost', 'abandoned', 1, false) $$, '54000', null, 'game 301 in a day is refused');

-- ---- Deleting a student deletes their games ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'mr.teacher@douglaspark.school.nz');
select lives_ok($$ select public.teacher_delete_student('00000000-0000-0000-0000-00000000000a') $$, 'a teacher deletes a student');
select pg_temp.reset();
select is((select count(*)::int from public.bot_games where player = '00000000-0000-0000-0000-00000000000a'), 0,
  'their games are deleted too');

select * from finish();
rollback;
