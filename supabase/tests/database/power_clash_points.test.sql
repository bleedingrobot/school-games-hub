-- Stage P.4: Power Clash games against bots. Saving (once per seed), 2 taking-part points win
-- or lose inside the shared daily bot cap, the Power Clash achievements, and that Power Clash
-- games never touch ratings or leaderboards.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
-- Written in Stage P.4; first run in Stage P.5 (17 Oct 2026), against a scratch copy of the local database.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

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
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

-- Saves a Power Clash game the way the server does.
create function pg_temp.pc(who text, seed text, won boolean default false, level text default 'easy',
  counts boolean default true, used integer default 1, swap_wins integer default 0, no_power boolean default false)
returns uuid language sql as $$
  select public.record_power_clash_bot_game(('00000000-0000-0000-0000-00000000000' || who)::uuid, level, 'x',
    array['place:4', 'next'], case when won then 'won' else 'lost' end,
    case when counts then 'finished' else 'abandoned' end, 20, counts,
    jsonb_build_object('seed', seed, 'side', 'X', 'loadouts', '{"X":["force-field","body-swap","freeze-ray"],"O":["board-wipe","body-swap","freeze-ray"]}'::jsonb,
      'roundsWon', 3, 'roundsLost', 1, 'roundsDrawn', 0,
      'stats', jsonb_build_object('powersUsed', used, 'bodySwapWins', swap_wins, 'noPowerWin', no_power,
        'roundsWon', 3, 'roundsLost', 1, 'roundsDrawn', 0)))
$$;
create function pg_temp.points(who text, which text default 'power-clash') returns integer language sql as $$
  select coalesce(sum(points), 0)::integer from public.scored_games
  where player = ('00000000-0000-0000-0000-00000000000' || who)::uuid and game = which
$$;
create function pg_temp.has(who text, achievement text) returns boolean language sql as $$
  select exists (select 1 from public.achievements
    where player = ('00000000-0000-0000-0000-00000000000' || who)::uuid and achievements.achievement = $2)
$$;

-- ---- Only the server can save one ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select pg_temp.pc('a', 's1-sneaky') $$, '42501', null, 'a student cannot save a Power Clash game directly');
select pg_temp.reset();

select throws_ok($$ insert into public.bot_games (player, game, bot_level, player_side, moves, result, reason, player_moves, counts_for_points)
  values ('00000000-0000-0000-0000-00000000000a', 'power-clash', 'easy', 'x', '{}', 'won', 'finished', 10, true) $$,
  '23514', null, 'a Power Clash game must keep its seed and setup');
select throws_ok($$ insert into public.bot_games (player, game, bot_level, player_side, moves, result, reason, player_moves, counts_for_points, power_clash)
  values ('00000000-0000-0000-0000-00000000000a', 'chess', 'easy', 'white', '{}', 'won', 'checkmate', 10, true, '{"seed":"x"}') $$,
  '23514', null, 'only Power Clash games carry Power Clash details');
select throws_ok($$ insert into public.ratings values ('00000000-0000-0000-0000-00000000000a', 'power-clash', 1000, 0, 0) $$,
  '23514', null, 'there is no such thing as a Power Clash rating');

-- ---- Points: 2 for taking part, win or lose, whatever the level ----
select pg_temp.act_as_server();
create temporary table saves (n integer, id uuid) on commit drop;
grant all on saves to service_role;
insert into saves select 1, pg_temp.pc('a', 's1-0000000001-aaa', true);
insert into saves select 2, pg_temp.pc('a', 's1-0000000001-aaa', true);
insert into saves select 3, pg_temp.pc('a', 's1-0000000002-bbb', false);
insert into saves select 4, pg_temp.pc('a', 's1-0000000003-ccc', true, 'medium');
insert into saves select 5, pg_temp.pc('a', 's1-0000000004-ddd', true, 'very-easy');
select pg_temp.reset();

select is((select count(distinct id)::int from saves where n <= 2), 1, 'the same seed sent twice hands back the saved game');
select is((select count(*)::int from public.bot_games where game = 'power-clash'), 4, 'and saves it only once');
select is((select array_agg(points order by finished_at, id) from public.scored_games where game = 'power-clash')::text, '{2,2,2,2}', 'every finished game earns 2, win or lose, at any level');
select is((select power_clash from public.scored_games where bot_game = (select id from saves where n = 1)),
  '{"powersUsed":1,"bodySwapWins":0,"noPowerWin":false,"roundsWon":3,"roundsLost":1,"roundsDrawn":0}'::jsonb, 'the stats are kept for achievements');

select pg_temp.act_as_server();
select pg_temp.pc('a', 's1-0000000005-eee', false, 'easy', false);
select pg_temp.reset();
select is((select count(*)::int from public.scored_games where game = 'power-clash'), 4, 'a game left part-way earns nothing');

-- The daily bot cap is shared with chess.
insert into public.bot_games (player, game, bot_level, player_side, moves, result, reason, player_moves, counts_for_points)
select '00000000-0000-0000-0000-00000000000b', 'chess', case when n = 5 then 'easy' else 'medium' end, 'white',
  array['e2e4', n::text], 'won', 'checkmate', 12, true
from generate_series(1, 5) as n;
select is(pg_temp.points('b', 'chess'), 37, 'Ben earns 37 from chess today');
select pg_temp.act_as_server();
select pg_temp.pc('b', 's1-0000000007-ggg', true);
select pg_temp.pc('b', 's1-0000000008-hhh', true);
select pg_temp.reset();
select is(pg_temp.points('b'), 3, 'Power Clash games get only what''s left of the 40-a-day cap');
select ok(pg_temp.has('b', 'pc-first-game'), 'achievements still count after the cap');
select is((select count(*)::int from public.ratings where game = 'power-clash'), 0, 'Power Clash games never make a rating');

-- ---- Achievements ----
select ok(pg_temp.has('a', 'pc-first-game'), 'one finished game: Play a game of Power Clash');
select ok(not pg_temp.has('a', 'pc-all-three'), 'one power used is not all three');
select ok(not pg_temp.has('a', 'pc-body-swap-win'), 'no Body Swap win yet');
select pg_temp.act_as_server();
select pg_temp.pc('a', 's1-0000000010-g1', true, 'easy', true, 3, 1, false);
select pg_temp.pc('a', 's1-0000000011-g2', true, 'easy', true, 0, 0, true);
select pg_temp.reset();
select ok(pg_temp.has('a', 'pc-all-three') and pg_temp.has('a', 'pc-body-swap-win') and pg_temp.has('a', 'pc-no-power-win'),
  'all three powers, a Body Swap win and a win without powers each earn their badge');

-- ---- What the website reads ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(public.progress_rules() -> 'powerClash' ->> 'bot', '2', 'How points work reads the Power Clash bot rule from here');
select throws_ok($$ select * from public.leaderboard('power-clash', 'week') $$, '22023', null, 'there is no Power Clash leaderboard');

select pg_temp.reset();
select * from finish();
rollback;
