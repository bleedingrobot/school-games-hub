-- The teacher's trophy tools (migration 20261112002900_trophy_teacher_tools.sql; docs/plans/profile/PLAN.md card P12):
-- the admin's Trophy season panel, a pupil's trophies, resetting an avatar, and new trophies this week.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'admin@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'ms.other@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id in ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000000f');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000d';
update public.schools set default_class = null;
delete from public.class_members;
delete from public.class_teachers;

-- The school is in hub season 2, which started 25 days ago and lasts 35 days.
update public.schools set hub_season_start = public.nz_day(now()) - 60, hub_season_days = 35, hub_paused_since = null;

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000000' || who)::uuid $$;
create function pg_temp.ana() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz') $$;
create function pg_temp.admin() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000d', 'admin@douglaspark.school.nz') $$;
create function pg_temp.teacher() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz') $$;
create function pg_temp.other() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'ms.other@douglaspark.school.nz') $$;
create function pg_temp.hs() returns integer language sql security definer as $$ select public.hub_season((select id from public.schools order by id limit 1)) $$;
create function pg_temp.today() returns date language sql security definer as $$ select public.nz_day(now()) $$;
create function pg_temp.school() returns integer language sql security definer as $$ select id from public.schools order by id limit 1 $$;
create function pg_temp.start() returns date language sql security definer as $$ select hub_season_start from public.schools where id = pg_temp.school() $$;

-- Ana and Ben are in Mr Teacher's class. Ms Other teaches a different class.
select pg_temp.teacher();
create temp table made as select public.teacher_create_class('Room 12', 2026, 5) as id;
grant all on made to authenticated;
select public.teacher_add_to_class((select id from made), array[pg_temp.id('a'), pg_temp.id('b')]);
select pg_temp.other();
create temp table made_other as select public.teacher_create_class('Room 9', 2026, 5) as id;
grant all on made_other to authenticated;
select pg_temp.reset();

-- A game trophy (not a garden game), and a garden picture (beanstalk has a 'beanstalk-cup' steps type).
insert into public.trophy_types (id, game, name, how, kind, repeat, sort) values
  ('tt-cup', 'game-one', 'Cup one', 'Win.', 'trophy', 'season', 2000),
  ('tt-old', 'game-one', 'Old cup', 'Win.', 'trophy', 'season', 2001);

-- ---- The Trophy season panel ----
select pg_temp.ana();
select throws_ok($$ select public.admin_trophy_season() $$, '42501', null, 'a pupil cannot read the season panel');
select pg_temp.teacher();
select throws_ok($$ select public.admin_trophy_season() $$, '42501', null, 'a plain teacher cannot read it');
select throws_ok($$ select public.admin_set_trophy_season(40, null) $$, '42501', null, '... or change it');
select pg_temp.admin();
select is((public.admin_trophy_season() ->> 'season')::integer, pg_temp.hs(), 'a school admin gets the season number hub_season gives');
select is((public.admin_trophy_season() ->> 'season')::integer, 2, '... season 2');
select is((public.admin_trophy_season() ->> 'seasonStart')::date, pg_temp.today() - 25, '... which began 25 days ago');

-- Length: same season, same first day, last day moves.
select is((public.admin_set_trophy_season(40, null) ->> 'season')::integer, 2, 'a new length keeps the season number');
select is((public.admin_trophy_season() ->> 'seasonStart')::date, pg_temp.today() - 25, '... and its first day');
select is((public.admin_trophy_season() ->> 'seasonEnd')::date, pg_temp.today() - 25 + 39, '... and moves the last day');
select throws_ok($$ select public.admin_set_trophy_season(20, null) $$, '22023', null, 'a length shorter than the days already gone is refused');
select throws_ok($$ select public.admin_set_trophy_season(6, null) $$, '22023', null, 'fewer than 7 days is refused');
select throws_ok($$ select public.admin_set_trophy_season(367, null) $$, '22023', null, 'more than 366 days is refused');

-- Pause, then go on after 10 days stopped.
select is(public.admin_set_trophy_season(null, true) ->> 'pausedSince', pg_temp.today()::text, 'pausing sets pausedSince to today');
select pg_temp.reset();
update public.schools set hub_paused_since = public.nz_day(now()) - 10;
create temp table before as select pg_temp.start() as s, pg_temp.hs() as n;
grant all on before to authenticated;
select pg_temp.admin();
select public.admin_set_trophy_season(null, false);
select is(pg_temp.start(), (select s from before) + 10, 'going on moves the season start forward by the paused days');
select is(pg_temp.hs(), (select n from before), '... and the season number does not jump');
select ok(public.admin_trophy_season() -> 'pausedSince' = 'null'::jsonb, '... and the pause is cleared');
select pg_temp.reset();

-- ---- Trophies for the teacher ----
insert into public.trophies (player, trophy, season, year) values (pg_temp.id('a'), 'tt-cup', 1, 2026);
insert into public.trophies (player, trophy, season, year, earned_at) values (pg_temp.id('a'), 'tt-old', 1, 2026, now() - interval '10 days');
insert into public.trophies (player, trophy, earned_at) values (pg_temp.id('a'), 'beanstalk-kiwi', now());

select pg_temp.teacher();
select ok(jsonb_array_length(public.teacher_pupil_trophies(pg_temp.id('a'))) >= 3
  and public.teacher_pupil_trophies(pg_temp.id('a')) @> '[{"id": "tt-cup"}]'::jsonb, 'a pupil''s teacher sees the pupil''s trophies');
select pg_temp.other();
select throws_ok(format('select public.teacher_pupil_trophies(%L)', pg_temp.id('a')), '42501', null, 'a teacher of another class is refused');
select throws_ok(format('select public.teacher_reset_avatar(%L)', pg_temp.id('a')), '42501', null, '... also for reset avatar');

select pg_temp.reset();
update public.profiles set avatar = '{"hat": "cap"}'::jsonb where id = pg_temp.id('a');
select pg_temp.teacher();
select public.teacher_reset_avatar(pg_temp.id('a'));
select pg_temp.reset();
select is((select avatar from public.profiles where id = pg_temp.id('a')), '{}'::jsonb, 'resetting sets the avatar to {}');
select is((select count(*)::integer from public.trophies where player = pg_temp.id('a')), 3, '... and keeps the trophies');

-- ---- New trophies this week ----
select pg_temp.teacher();
select ok(public.teacher_new_trophies((select id from made)) @> '[{"id": "tt-cup"}]'::jsonb, 'new trophies lists one won this week');
select ok(not public.teacher_new_trophies((select id from made)) @> '[{"id": "tt-old"}]'::jsonb, '... leaves out one older than 7 days');
select ok(not public.teacher_new_trophies((select id from made)) @> '[{"id": "beanstalk-kiwi"}]'::jsonb, '... and leaves out a garden game trophy');
select throws_ok(format('select public.teacher_new_trophies(%L)', (select id from made_other)), '42501', null, 'a class the teacher doesn''t teach is refused');

select * from finish();
rollback;
