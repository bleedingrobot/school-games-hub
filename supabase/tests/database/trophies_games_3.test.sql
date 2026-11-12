-- Trophies for Chess, Checkers, 101, Power Clash, Wormholes and Archery (migration 20261112002200_trophies_games_3.sql;
-- docs/plans/profile/PLAN.md card P8 part 1): classmate wins counted per hub season, the season's top three, Champion rank,
-- Hawk Feather and Golden Bow.
-- Run on a throw-away copy: scripts/scratch-db.sh t1, then scripts/scratch-test.sh t1 supabase/tests/database/trophies_games_3.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'dan@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
insert into public.classes (school_id, name, school_year, warp_code, archived) values (1, 'Trophy Room', 2026, 'TRPHY', false);
insert into public.class_members (student_id, class_id)
select v.s::uuid, c.id from (values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c'), ('00000000-0000-0000-0000-00000000000d')) v(s)
join public.classes c on c.name = 'Trophy Room'
on conflict (student_id) do update set class_id = excluded.class_id;
update public.profiles set role = 'teacher', school_id = 1 where id = '00000000-0000-0000-0000-00000000000e';

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || who)::uuid $$;
create function pg_temp.wins(who text, t text) returns integer language sql as $$
  select count(*)::integer from public.trophies where player = pg_temp.id(who) and trophy = t $$;
create function pg_temp.seasons(who text, t text) returns text language sql as $$
  select coalesce(string_agg(season::text, ',' order by season), '') from public.trophies where player = pg_temp.id(who) and trophy = t $$;
create function pg_temp.count(who text, g text, k text) returns integer language sql as $$
  select coalesce(sum(n), 0)::integer from public.season_counts where player = pg_temp.id(who) and game = g and key = k $$;
-- A finished game's scored row (the games' own references are left out here: the check that wants one is dropped below).
create function pg_temp.game(who text, g text, kind text, result text, points integer, times integer default 1) returns void
language sql as $$
  insert into public.scored_games (player, game, kind, result, reason, points, finished_at, nz_day)
  select pg_temp.id(who), g, kind, result, 'finished', points, now(), public.nz_day(now()) from generate_series(1, times) $$;
-- Archery: what archery_note adds for one fight.
create function pg_temp.fight(who text, add jsonb) returns void language sql as $$
  insert into public.archery_players (player) values (pg_temp.id(who)) on conflict do nothing;
  update public.archery_players set stats = public.archery_gear_plus(stats, add, 1) where player = pg_temp.id(who) $$;
alter table public.scored_games drop constraint scored_games_check;
-- Season 2 of the hub, 40 days in.
update public.schools set hub_season_start = public.nz_day(now()) - 40, hub_season_days = 35, hub_paused_since = null where id = 1;

select is((select count(*)::integer from public.trophy_types where id in ('chess-crown', 'chess-knight', 'checkers-crown',
  'checkers-king', '101-shark', 'pc-cup', 'space-wormhole', 'archery-feather', 'archery-bow')), 9, 'the nine trophies are there');

-- ---- 15 classmate wins ----
select pg_temp.game('0a', '101', 'friend', 'won', 5, 14);
select is(pg_temp.wins('0a', '101-shark'), 0, '14 classmate wins at 101 give no Card Shark');
select pg_temp.game('0a', '101', 'friend', 'won', 0, 3);
select pg_temp.game('0a', '101', 'friend', 'lost', 2, 3);
select pg_temp.game('0a', '101', 'bot', 'won', 2, 3);
select is(pg_temp.count('0a', '101', 'wins'), 14, 'wins with no points, losses and wins against the computer are not counted');
select pg_temp.game('0a', '101', 'friend', 'won', 5);
select is(pg_temp.seasons('0a', '101-shark'), '2', 'the 15th classmate win gives the Card Shark for this hub season');
select pg_temp.game('0a', '101', 'friend', 'won', 5, 20);
select is(pg_temp.wins('0a', '101-shark'), 1, '... once a season');
select pg_temp.game('0b', 'power-clash', 'friend', 'won', 5, 15);
select pg_temp.game('0b', 'space', 'friend', 'won', 5, 15);
select is(pg_temp.wins('0b', 'pc-cup') + pg_temp.wins('0b', 'space-wormhole'), 2, 'Power Clash and Wormholes work the same way');
select pg_temp.game('0b', 'chess', 'friend', 'won', 5, 20);
select is(pg_temp.count('0b', 'chess', 'wins'), 20, 'Chess classmate wins are counted');
select is(pg_temp.wins('0b', 'chess-crown'), 0, '... and give no trophy by themselves');
select is((select year from public.season_counts where player = pg_temp.id('0b') and game = 'chess'),
  extract(year from public.nz_day(now()) - 40)::integer, 'a season''s count is kept under the year the season began');

-- ---- The season's top three ----
insert into public.season_counts (player, game, season, year, key, n)
select pg_temp.id(w), 'chess', 1, extract(year from public.nz_day(now()) - 40)::integer, 'wins', n
from (values ('0a', 9), ('0b', 4), ('0c', 4), ('0d', 2), ('0e', 50)) v(w, n);
insert into public.season_counts (player, game, season, year, key, n)
values (pg_temp.id('0d'), 'checkers', 1, extract(year from public.nz_day(now()) - 40)::integer, 'wins', 1);
select ok(public.season_crowns() > 0, 'the season job crowns season 1 once it has ended');
select is(pg_temp.seasons('0a', 'chess-crown'), '1', 'the most classmate wins: Chess Crown for season 1');
select is(pg_temp.wins('0b', 'chess-crown') + pg_temp.wins('0c', 'chess-crown'), 2, 'pupils tied for a place both get it');
select is(pg_temp.wins('0d', 'chess-crown'), 0, 'fourth place gets nothing');
select is(pg_temp.wins('0e', 'chess-crown'), 0, 'a teacher is never ranked');
select is(pg_temp.seasons('0d', 'checkers-crown'), '1', 'Checkers is ranked on its own');
select is(public.season_crowns(), 0, 'running the job again gives nothing more');

-- ---- Champion rank ----
insert into public.ratings (player, game, rating, rated_games, best_rank) values (pg_temp.id('0c'), 'chess', 1100, 12, 2);
update public.ratings set rating = 1160, rated_games = 15, best_rank = 3 where player = pg_temp.id('0c');
select is(pg_temp.wins('0c', 'chess-knight'), 1, 'reaching Champion rank gives the Champion''s Knight');
update public.ratings set rating = 1170, rated_games = 16 where player = pg_temp.id('0c');
select is(pg_temp.wins('0c', 'chess-knight'), 1, '... once a year');

-- ---- Archery ----
select pg_temp.fight('0d', '{"win_forest": 1, "plain_wins": 1, "duel_wins": 1, "duels": 1}');
select is(pg_temp.wins('0d', 'archery-feather'), 0, 'a Plain Arrow win against a classmate is not beating Hawk');
select pg_temp.fight('0d', '{"win_forest": 1, "hawk_wins": 1}');
select is(pg_temp.seasons('0d', 'archery-feather'), '2', 'beating Hawk gives the Hawk Feather for this hub season');
select pg_temp.fight('0d', '{"win_forest": 1, "hawk_wins": 1, "plain_wins": 1}');
select pg_temp.fight('0d', '{"win_forest": 1, "hawk_wins": 1, "plain_wins": 1}');
select pg_temp.fight('0d', '{"win_desert": 1, "hawk_wins": 1, "plain_wins": 1}');
select pg_temp.fight('0d', '{"win_snow": 1, "hawk_wins": 1, "plain_wins": 1}');
select is(pg_temp.wins('0d', 'archery-bow'), 0, 'Hawk beaten with Plain Arrows in three worlds is no Golden Bow yet');
select pg_temp.fight('0d', '{"win_city": 1, "hawk_wins": 1, "plain_wins": 1}');
select is(pg_temp.wins('0d', 'archery-bow') + pg_temp.wins('0d', 'archery-feather'), 2,
  'the fourth world gives the Golden Bow picture (and the feather stays one a season)');

-- ---- Pupils ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.season_crowns() $$, '42501', null, 'a pupil cannot run the season job');
select pg_temp.reset();

select * from finish();
rollback;
