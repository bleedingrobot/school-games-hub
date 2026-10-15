-- Checks the scoring rules: points for bot and friend games, the daily bot cap, the
-- same-friend limit, levels, ratings (wins, draws, new players, deleted opponents), badge
-- cut-offs, achievements, crowned kings and New Zealand days and weeks.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(63);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'dan@douglaspark.school.nz');

-- Saves a bot game the way the server does, with a chosen time.
create function pg_temp.bot(who text, game text, level text, result text, at timestamptz,
  counts boolean default true, side text default 'white', moves text[] default '{e2e4}') returns uuid language sql as $$
  insert into public.bot_games (player, game, bot_level, player_side, moves, result, reason, player_moves, counts_for_points, finished_at)
  values (('00000000-0000-0000-0000-00000000000' || who)::uuid, game, level, side, moves, result,
          case result when 'won' then 'checkmate' when 'lost' then 'resigned' else 'stalemate' end, 12, counts, at)
  returning id
$$;
-- Finishes a friend game. winner: 'first', 'second' or null for a draw.
create function pg_temp.friend(first_p text, second_p text, game text, winner text, at timestamptz,
  counts boolean default true, reason text default 'checkmate') returns uuid language sql as $$
  insert into public.mp_games (game, created_by, first_player, second_player, status, winner, reason, counts_for_points, finished_at)
  values (game, ('00000000-0000-0000-0000-00000000000' || first_p)::uuid, ('00000000-0000-0000-0000-00000000000' || first_p)::uuid,
          ('00000000-0000-0000-0000-00000000000' || second_p)::uuid, 'finished', winner, reason, counts, at)
  returning id
$$;
create function pg_temp.points(who text) returns integer language sql as $$
  select coalesce(sum(points), 0)::integer from public.scored_games where player = ('00000000-0000-0000-0000-00000000000' || who)::uuid
$$;
create function pg_temp.rating(who text, game text default 'chess') returns integer language sql as $$
  select rating from public.ratings where player = ('00000000-0000-0000-0000-00000000000' || who)::uuid and ratings.game = $2
$$;
create function pg_temp.has(who text, achievement text) returns boolean language sql as $$
  select exists (select 1 from public.achievements
    where player = ('00000000-0000-0000-0000-00000000000' || who)::uuid and achievements.achievement = $2)
$$;

-- ---- The rules themselves ----
select is(public.bot_points('very-easy', 'lost'), 1, 'very easy bot: a loss earns 1');
select is(public.bot_points('very-easy', 'won'), 3, 'very easy bot: a win earns 3');
select is(public.bot_points('easy', 'drawn'), 3, 'easy bot: a draw earns 3');
select is(public.bot_points('medium', 'lost'), 3, 'medium bot: even a loss earns 3');
select is(public.bot_points('medium', 'won'), 8, 'medium bot: a win earns 8');
select is(public.friend_points('lost'), 4, 'friend: a loss earns 4');
select is(public.friend_points('drawn'), 6, 'friend: a draw earns 6');
select is(public.friend_points('won'), 8, 'friend: a win earns 8');

select is(public.level_for(0), 1, 'everyone starts on level 1');
select is(public.level_for(49), 1, '49 points is still level 1');
select is(public.level_for(50), 2, 'level 2 at 50 points');
select is(public.level_for(124), 2, '124 points is level 2');
select is(public.level_for(125), 3, 'level 3 at 125 (75 more)');
select is(public.level_for(225), 4, 'level 4 at 225 (100 more)');
select is(public.level_start(10), 1350, 'level 10 at 1,350');

select is(public.rank_for(1029, 30), 0, '1029 is Bronze');
select is(public.rank_for(1030, 1), 1, 'Silver at 1030');
select is(public.rank_for(1080, 5), 2, 'Gold at 1080');
select is(public.rank_for(1200, 14), 2, 'a Champion rating with 14 games is still Gold');
select is(public.rank_for(1150, 15), 3, 'Champion at 1150 with 15 games');

-- New Zealand time. NZ daylight time is UTC+13 from late September.
select is(public.nz_day('2026-10-14 10:59:59+00'), '2026-10-14'::date, '11:59pm in NZ is still that day');
select is(public.nz_day('2026-10-14 11:00:00+00'), '2026-10-15'::date, 'midnight in NZ is the next day');
select is(public.nz_week_start('2026-10-18 10:59:59+00'), '2026-10-11 11:00:00+00'::timestamptz,
  'Sunday 11:59pm in NZ is still last week (which began Monday 12 Oct, NZ midnight)');
select is(public.nz_week_start('2026-10-18 11:00:00+00'), '2026-10-18 11:00:00+00'::timestamptz,
  'Monday 12am in NZ starts a new week');
select is(public.nz_week_start('2026-07-08 03:00:00+00'), '2026-07-05 12:00:00+00'::timestamptz,
  'in winter (NZ standard time, UTC+12) weeks still start at NZ midnight');

-- Crowned kings, by following the moves.
select is(public.checkers_crowns(array['12x32', '21-17', '32-27', '17-13', '27-32'], 'red'), 1,
  'a red man reaching 32 is crowned once; the king moving back there again doesn''t count');
select is(public.checkers_crowns(array['12x32', '24x4'], 'white'), 1, 'a white man reaching 4 is crowned');
select is(public.checkers_crowns(array['12x32', '24x4'], 'red'), 1, 'each side only counts its own crowns');
select is(public.checkers_crowns(array['11-15', '22-18'], 'red'), 0, 'no crowns in an ordinary opening');

-- ---- Bot games ----
select pg_temp.bot('a', 'chess', 'easy', 'won', '2026-10-14 01:00+00');
select is(pg_temp.points('a'), 5, 'saving a bot game scores it straight away');
select pg_temp.bot('a', 'chess', 'medium', 'won', '2026-10-14 01:10+00', counts => false);
select is(pg_temp.points('a'), 5, 'a game that doesn''t count earns nothing');
select is((select count(*)::int from public.scored_games where player = '00000000-0000-0000-0000-00000000000a'), 1,
  'a game that doesn''t count isn''t scored at all');

-- Ana keeps winning against Medium (8 each): 5 + 8 x 4 = 37, then the next game gets only 3.
select pg_temp.bot('a', 'checkers', 'medium', 'won', '2026-10-14 02:00+00'::timestamptz + n * interval '1 minute') from generate_series(1, 4) n;
select is(pg_temp.points('a'), 37, 'bot points add up across chess and checkers');
select pg_temp.bot('a', 'chess', 'medium', 'won', '2026-10-14 03:00+00');
select is(pg_temp.points('a'), 40, 'the game that reaches the daily cap gets only what''s left');
select pg_temp.bot('a', 'chess', 'medium', 'won', '2026-10-14 04:00+00');
select is(pg_temp.points('a'), 40, 'after 40 bot points in a day, bot games earn nothing');
select is((select count(*)::int from public.scored_games where player = '00000000-0000-0000-0000-00000000000a'), 7,
  '...but they still count (for achievements)');
select pg_temp.bot('a', 'chess', 'very-easy', 'lost', '2026-10-14 10:59+00');
select is(pg_temp.points('a'), 40, '11:59pm NZ time is still the same day');
select pg_temp.bot('a', 'chess', 'very-easy', 'lost', '2026-10-14 11:01+00');
select is(pg_temp.points('a'), 41, 'after midnight NZ time, bot games earn again');

-- ---- Achievements ----
select ok(pg_temp.has('a', 'chess-first-game') and pg_temp.has('a', 'chess-first-win'), 'first game and first win');
select ok(pg_temp.has('a', 'chess-beat-easy') and pg_temp.has('a', 'chess-beat-medium'), 'beat the Easy and Medium bots');
select ok(not pg_temp.has('a', 'chess-beat-very-easy'), 'not "beat Very Easy": Ana only lost to it');
select ok(pg_temp.has('a', 'chess-checkmate'), 'won by checkmate');
select ok(not pg_temp.has('a', 'chess-games-10'), 'not 10 chess games yet');
select ok(pg_temp.has('a', 'checkers-beat-medium') and not pg_temp.has('a', 'checkers-crown-5'),
  'checkers achievements are separate from chess ones');
select is((select earned_at from public.achievements where player = '00000000-0000-0000-0000-00000000000a'
  and achievement = 'chess-first-win'), '2026-10-14 01:00+00'::timestamptz, 'an achievement is dated with the game that earned it');

-- Crowning kings across games: 5 crowns earns the badge.
select pg_temp.bot('b', 'checkers', 'easy', 'lost', '2026-10-13 01:00+00'::timestamptz + n * interval '1 minute', side => 'red',
  moves => array['12x32', '21-17', '11x31']) from generate_series(1, 3) n;
select ok(pg_temp.has('b', 'checkers-crown-5'), 'crowning 2 kings a game for 3 games earns "Crown 5 kings"');

-- ---- Friend games and ratings ----
-- Cat beats Dan: both new (1000), so +10 / -10.
select pg_temp.friend('c', 'd', 'chess', 'first', '2026-10-14 01:00+00');
select is(pg_temp.rating('c'), 1010, 'beating an equal player: +10');
select is(pg_temp.rating('d'), 990, 'losing to an equal player: -10');
select is(pg_temp.points('c'), 8, 'a friend win earns 8');
select is(pg_temp.points('d'), 4, 'a friend loss earns 4');
select is(public.points_total('00000000-0000-0000-0000-00000000000c'), 8 + 4 * 10,
  'total points add 10 for each achievement (First game, First win, Beat a friend, Checkmate!)');
-- A draw between unequal players: the lower one gains a little.
select pg_temp.friend('c', 'd', 'chess', null, '2026-10-14 01:10+00', reason => 'agreed-draw');
select is(pg_temp.rating('d'), 991, 'a draw against a stronger player gains a little');
select is(pg_temp.rating('c'), 1009, '...and the stronger player loses the same amount');
select is(pg_temp.rating('c', 'checkers'), null, 'chess games don''t touch checkers ratings');
-- Bot games never touch ratings.
select is((select count(*)::int from public.ratings where player = '00000000-0000-0000-0000-00000000000a'), 0,
  'bot games never give a rating');

-- Same pair: 3 more games today makes 5. The 6th earns nothing and doesn't change ratings.
select pg_temp.friend('d', 'c', 'chess', 'second', '2026-10-14 02:00+00'::timestamptz + n * interval '1 minute') from generate_series(1, 3) n;
select pg_temp.friend('c', 'd', 'chess', 'first', '2026-10-14 03:00+00');
select is((select points from public.scored_games s join public.mp_games m on m.id = s.mp_game
  where s.player = '00000000-0000-0000-0000-00000000000c' order by s.finished_at desc limit 1), 0,
  'the 6th game with the same friend in a day earns no points');
select is((select count(*)::int from public.scored_games where player = '00000000-0000-0000-0000-00000000000c' and rated), 5,
  '...and doesn''t change ratings');

-- A finished game touched again (e.g. a rematch request) isn't scored twice.
create temp table rating_before as select pg_temp.rating('c') as rating;
update public.mp_games set status = 'finished', first_wants_rematch = true
where id = (select mp_game from public.scored_games where player = '00000000-0000-0000-0000-00000000000c' order by finished_at limit 1);
select is((select count(*)::int from public.scored_games where player = '00000000-0000-0000-0000-00000000000c'), 6,
  'touching a finished game again doesn''t score it twice');
select is(pg_temp.rating('c'), (select rating from rating_before), '...or change ratings twice');

-- An opponent deleted before the game is scored counts as a new player (1000).
insert into public.mp_games (game, first_player, status, winner, reason, counts_for_points, finished_at)
values ('checkers', '00000000-0000-0000-0000-00000000000d', 'finished', 'first', 'no-pieces', true, '2026-10-14 05:00+00');
select is(pg_temp.rating('d', 'checkers'), 1010, 'a game against a deleted player still scores for the one left');

-- Deleting a student keeps their opponents' scores.
delete from auth.users where id = '00000000-0000-0000-0000-00000000000d';
select is((select count(*)::int from public.scored_games where player = '00000000-0000-0000-0000-00000000000c'), 6,
  'deleting a student keeps their opponents'' scored games');
select is((select count(*)::int from public.scored_games where opponent = '00000000-0000-0000-0000-00000000000d'), 0,
  '...without anything pointing back to them');

-- Starting again from scratch gives the same answer for the players still here.
create temp table before_rebuild as select player, game, points, rating_change, rated from public.scored_games;
select public.rebuild_progress();
select is((select count(*)::int from (select player, game, points from public.scored_games
  where player <> '00000000-0000-0000-0000-00000000000c'
  except select player, game, points from before_rebuild) x), 0,
  'working everything out again from the saved games gives the same bot points');

select * from finish();
rollback;
