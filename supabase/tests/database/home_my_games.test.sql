-- Dashboard plan D2: my_top_games() gives the home page's "My games" row: a pupil's most played games in the last 14 days, and
-- their class's most played games for a pupil with none yet. my_home_page() carries it as 'topGames'.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

create function pg_temp.uid(n integer) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;
select setval(pg_get_serial_sequence('public.schools', 'id'), 1);
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id) values ('otherschool.school.nz', 2);

-- 1 Ana and 2 Ben share Room 12. 3 Cat is in no class. 11 is their teacher.
insert into auth.users (id, email) values
  (pg_temp.uid(1), 'ana@otherschool.school.nz'), (pg_temp.uid(2), 'ben@otherschool.school.nz'),
  (pg_temp.uid(3), 'cat@otherschool.school.nz'), (pg_temp.uid(11), 'mr.teacher@otherschool.school.nz');
update public.profiles set role = 'teacher' where id = pg_temp.uid(11);
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

select pg_temp.as(11);
insert into pg_temp.made values ('room12', public.teacher_create_class('Room 12', 2026, 5));
select public.teacher_add_to_class((select id from pg_temp.made where name = 'room12'), array[pg_temp.uid(1), pg_temp.uid(2)]);
select pg_temp.reset();

-- Ana: 3 chess and 1 checkers this week, and 9 chess a month ago (too old to count). Ben: 5 checkers.
insert into public.bot_games (player, game, bot_level, player_side, moves, result, reason, player_moves, counts_for_points, finished_at)
select pg_temp.uid(1), 'chess', 'easy', 'white', '{}', 'won', 'checkmate', 20, true, now() - n * interval '1 hour' from generate_series(1, 3) n
union all select pg_temp.uid(1), 'checkers', 'easy', 'white', '{}', 'won', 'checkmate', 20, true, now() - interval '5 minutes'
union all select pg_temp.uid(1), 'chess', 'easy', 'white', '{}', 'won', 'checkmate', 20, true, now() - interval '30 days' - n * interval '1 hour' from generate_series(1, 9) n
union all select pg_temp.uid(2), 'checkers', 'easy', 'white', '{}', 'won', 'checkmate', 20, true, now() - n * interval '1 hour' from generate_series(1, 5) n;

select is((select count(*)::integer from public.scored_games where player in (pg_temp.uid(1), pg_temp.uid(2))), 18, 'the bot games were scored');

select pg_temp.as(1);
select is(public.my_top_games() -> 'mine', '["chess", "checkers"]'::jsonb, 'Ana: most played in the last 14 days first');
select is(public.my_top_games() -> 'classGames', '["checkers", "chess"]'::jsonb, 'Ana''s class: checkers 6, chess 3 this fortnight');
select is(public.my_home_page() -> 'topGames', public.my_top_games(), 'the home page carries it as topGames');

select pg_temp.as(3);
select is(public.my_top_games(), '{"mine": [], "classGames": []}'::jsonb, 'Cat: no games and no class');

select pg_temp.reset();
select set_config('role', 'anon', true);
select throws_ok($$ select public.my_top_games() $$, '42501', null, 'not for visitors who are not signed in');
select pg_temp.reset();
select ok(has_function_privilege('authenticated', 'public.my_top_games()', 'execute'), 'signed-in people can ask');

select * from finish();
rollback;
