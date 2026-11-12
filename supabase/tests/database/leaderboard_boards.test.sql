-- Leaderboard redesign L1 (migration 20261113000100): the achievements board, the hard workers board, one pupil's
-- achievements per game, the home page's New trophies, and the homework achievements and trophies.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

create function pg_temp.uid(n integer) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;
select setval(pg_get_serial_sequence('public.schools', 'id'), 1);
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id) values ('otherschool.school.nz', 2);

-- 1 Ana and 2 Ben share Room 12. 3 Cat is in no class. 4 Dan is a hidden test pupil. 11 is their teacher.
insert into auth.users (id, email) values
  (pg_temp.uid(1), 'ana@otherschool.school.nz'), (pg_temp.uid(2), 'ben@otherschool.school.nz'),
  (pg_temp.uid(3), 'cat@otherschool.school.nz'), (pg_temp.uid(4), 'dan@otherschool.school.nz'),
  (pg_temp.uid(11), 'mr.teacher@otherschool.school.nz');
update public.profiles set role = 'teacher' where id = pg_temp.uid(11);
update public.profiles set hidden = true where id = pg_temp.uid(4);
create temp table emails as select id, email from auth.users;
grant select on emails to public;
create temp table made (name text primary key, id uuid);
grant all on made to authenticated;
create function pg_temp.as(n integer) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(n),
           'email', (select e.email from pg_temp.emails e where e.id = pg_temp.uid(n)), 'role', 'authenticated')::text, true)
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.names(board jsonb) returns text[] language sql as $$
  select coalesce(array_agg(e ->> 'name' order by o), '{}') from jsonb_array_elements(board) with ordinality as x(e, o)
$$;

select pg_temp.as(11);
insert into pg_temp.made values ('room12', public.teacher_create_class('Room 12', 2026, 5));
select public.teacher_add_to_class((select id from pg_temp.made where name = 'room12'), array[pg_temp.uid(1), pg_temp.uid(2)]);
select pg_temp.reset();

-- Ana 3 achievements (one this week). Ben 2, plus two early-years step ones that must not count. Cat 1. Dan (hidden) 5.
-- The teacher 6.
insert into public.achievements (player, achievement, earned_at) values
  (pg_temp.uid(1), 'chess-first-game', now() - interval '30 days'), (pg_temp.uid(1), 'chess-first-win', now() - interval '30 days'),
  (pg_temp.uid(1), 'checkers-first-game', now()),
  (pg_temp.uid(2), 'chess-first-game', now()), (pg_temp.uid(2), 'checkers-first-game', now()),
  (pg_temp.uid(2), 'robin-ten', now()), (pg_temp.uid(2), 'robin-twenty', now()),
  (pg_temp.uid(3), 'chess-first-game', now()),
  (pg_temp.uid(4), 'chess-first-game', now()), (pg_temp.uid(4), 'chess-first-win', now()), (pg_temp.uid(4), 'chess-games-10', now()),
  (pg_temp.uid(4), 'checkers-first-game', now()), (pg_temp.uid(4), 'checkers-first-win', now()),
  (pg_temp.uid(11), 'chess-first-game', now()), (pg_temp.uid(11), 'chess-first-win', now()), (pg_temp.uid(11), 'chess-games-10', now()),
  (pg_temp.uid(11), 'checkers-first-game', now()), (pg_temp.uid(11), 'checkers-first-win', now()), (pg_temp.uid(11), 'checkers-games-10', now());
update public.profiles set display_name = v.name
from (values (1, 'Brave Otter 1'), (2, 'Calm Kea 2'), (3, 'Swift Tui 3'), (4, 'Lucky Weka 4')) v(n, name)
where id = pg_temp.uid(v.n);

select pg_temp.as(1);
select is(pg_temp.names(public.achievements_board('all-time', 'school')), array['Brave Otter 1', 'Calm Kea 2', 'Swift Tui 3'],
  'all time: most first; maths-level achievements, hidden pupils and teachers left out');
select is((select e ->> 'count' from jsonb_array_elements(public.achievements_board('all-time', 'school')) e where e ->> 'name' = 'Calm Kea 2'),
  '2', 'the two step achievements do not count');
select is(pg_temp.names(public.achievements_board('week', 'school')), array['Calm Kea 2', 'Brave Otter 1', 'Swift Tui 3'],
  'this week: only achievements earned since Monday');
select is(pg_temp.names(public.achievements_board('all-time', 'class')), array['Brave Otter 1', 'Calm Kea 2'], 'my class only');
select is((select count(*)::integer from jsonb_array_elements(public.achievements_board('all-time', 'school')) e where (e ->> 'is_me')::boolean),
  1, 'my own row is marked');
select is((select jsonb_agg(e ->> 'game' order by e ->> 'game') from jsonb_array_elements(public.achievements_by_game('Calm Kea 2')) e),
  '["checkers", "chess"]'::jsonb, 'a schoolmate''s achievements per game, without the step ones');
select is(public.achievements_by_game('Lucky Weka 4'), '[]'::jsonb, 'nothing for a hidden pupil');

select pg_temp.as(3);
select is(public.achievements_board('all-time', 'class'), '[]'::jsonb, 'Cat has no class, so her class board is empty');

-- Homework: a finished go on a Saturday morning (NZ) counts, one on a school-day lunchtime or late at night doesn't.
select pg_temp.reset();
select ok(public.home_time('2026-11-07 10:00 Pacific/Auckland') and public.home_time('2026-11-09 16:00 Pacific/Auckland')
          and not public.home_time('2026-11-09 12:00 Pacific/Auckland') and not public.home_time('2026-11-07 21:30 Pacific/Auckland'),
  'home time: weekends and after school, never school hours or late at night');
insert into public.bot_games (player, game, bot_level, player_side, moves, result, reason, player_moves, counts_for_points, finished_at)
values (pg_temp.uid(3), 'chess', 'easy', 'white', '{}'::text[], 'won', 'checkmate', 20, true, '2026-11-07 10:00 Pacific/Auckland'),
       (pg_temp.uid(2), 'chess', 'easy', 'white', '{}'::text[], 'won', 'checkmate', 20, true, '2026-11-09 12:00 Pacific/Auckland');
select is((select array_agg(a.player order by a.player) from public.achievements a where a.achievement = 'hw-first'),
  array[pg_temp.uid(3)], 'Home learner for the Saturday go only');
select ok(exists (select 1 from public.achievements a where a.player = pg_temp.uid(3) and a.achievement = 'hw-weekend-1'), 'and Weekend player');

-- New trophies: my school's pupils only, and never a trophy won by a maths result (the Royal Crown).
select public.award_trophy(pg_temp.uid(1), 'decree-crown');
select public.award_trophy(pg_temp.uid(1), 'hub-regular'), public.award_trophy(pg_temp.uid(4), 'hub-regular'),
       public.award_trophy(pg_temp.uid(11), 'hub-regular');
select pg_temp.as(2);
select is((select jsonb_agg(e ->> 'title') from jsonb_array_elements(public.my_home_page() -> 'recentTrophies') e),
  '["Season Regular"]'::jsonb, 'the home page shows a classmate''s new trophy, not a hidden pupil''s, a teacher''s or a maths one');

select pg_temp.reset();
select set_config('role', 'anon', true);
select throws_ok($$ select public.achievements_board('all-time', 'school') $$, '42501', null, 'not for visitors who are not signed in');

select * from finish();
rollback;
