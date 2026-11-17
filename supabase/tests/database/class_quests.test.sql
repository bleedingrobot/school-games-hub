-- Weekly class quests (migration 20261118000100_class_quests.sql, docs/CLASS-QUESTS-PLAN.md): quest days from the three games'
-- own tables, winning on the 5th day, achievements and the Questing Hero trophy, the teacher's start/stop/read, and that a
-- pupil can't give themselves any of it.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'dee@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'fox@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000f';
update public.schools set default_class = null;
delete from public.class_members;
delete from public.class_teachers;
insert into public.classes (id, school_id, name, school_year, warp_code) values
  ('11111111-1111-4111-8111-111111111111', 1, 'Room 1', 2026, 'CDFGH'), ('22222222-2222-4222-8222-222222222222', 1, 'Room 2', 2026, 'CDFGJ');
insert into public.class_members (student_id, class_id, how) values
  ('00000000-0000-0000-0000-00000000000a', '11111111-1111-4111-8111-111111111111', 'teacher'),
  ('00000000-0000-0000-0000-00000000000b', '11111111-1111-4111-8111-111111111111', 'teacher'),
  ('00000000-0000-0000-0000-00000000000d', '22222222-2222-4222-8222-222222222222', 'teacher');
insert into public.class_teachers (class_id, teacher_id) values ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-00000000000f');

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000000' || who)::uuid $$;
create function pg_temp.days(who text, kind text) returns integer language sql as $$
  select count(*)::integer from public.quest_days d where d.player = pg_temp.id(who) and d.kind = days.kind
$$;
create function pg_temp.trader(left_ integer, day integer) returns jsonb language sql as $$
  select jsonb_build_object('t', jsonb_build_object('day', day, 'jumpsLeft', left_))
$$;

-- ---- Quest days from each game's own table ----
insert into public.trader_games (player, school_id, game, day) values (pg_temp.id('a'), 1, pg_temp.trader(10, 100), 100);
update public.trader_games set game = pg_temp.trader(1, 100) where player = pg_temp.id('a');
select is(pg_temp.days('a', 'trader'), 0, 'Star Trader: jumps still left is not a quest day');
update public.trader_games set game = pg_temp.trader(0, 100) where player = pg_temp.id('a');
select is(pg_temp.days('a', 'trader'), 1, '... the last jump makes today a quest day');
update public.trader_games set game = pg_temp.trader(0, 100) || '{"x": 1}' where player = pg_temp.id('a');
select is(pg_temp.days('a', 'trader'), 1, '... saving again with 0 left adds nothing');

insert into public.lord_heroes (player, hero, version, season, day)
values (pg_temp.id('a'), '{"day": "2026-11-18", "forestLeft": 2}', 1, 1, '2026-11-18');
update public.lord_heroes set hero = '{"day": "2026-11-18", "forestLeft": 0}' where player = pg_temp.id('a');
select is(pg_temp.days('a', 'lord'), 1, 'Dragon Maths: the last forest fight makes a quest day');

insert into public.clans (player, name, seed, day, created_nz_day, gold, followers, village, fights_left)
values (pg_temp.id('a'), 'Red Banner', 1, 1, 20000, 0, 0, '{}', 1);
update public.clans set fights_left = 0 where player = pg_temp.id('a');
select is(pg_temp.days('a', 'clans'), 1, 'Clan Quest: the last mine fight makes a quest day');

-- ---- The teacher starts a quest ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fox@douglaspark.school.nz');
select lives_ok($$ select public.teacher_start_class_quest('11111111-1111-4111-8111-111111111111', 'trader') $$, 'the teacher starts a Star Trader quest');
select throws_ok($$ select public.teacher_start_class_quest('11111111-1111-4111-8111-111111111111', 'lord') $$, '22023', null,
                 '... only one quest runs at a time');
select throws_ok($$ select public.teacher_start_class_quest('22222222-2222-4222-8222-222222222222', 'lord') $$, '42501', null,
                 '... and not in a class that isn''t theirs');
select is((public.teacher_class_quests('11111111-1111-4111-8111-111111111111') -> 'pupils' -> 0 -> 'days' ->> 0)::date
          is not null or (public.teacher_class_quests('11111111-1111-4111-8111-111111111111') -> 'pupils' -> 1 -> 'days' ->> 0)::date is not null,
          true, 'today''s day (done before the quest started) counts');
select is(jsonb_array_length(public.teacher_class_quests('11111111-1111-4111-8111-111111111111') -> 'pupils'), 2, 'the teacher sees both pupils');
select pg_temp.reset();

-- ---- Pupils ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(public.my_class_quest() -> 'quest' ->> 'kind', 'trader', 'Ana sees her class''s quest');
select is(jsonb_array_length(public.my_class_quest() -> 'days'), 1, '... with today done');
select is(public.my_home_page() -> 'classQuest' -> 'quest' ->> 'kind', 'trader', '... in the home page''s one answer too');
select is((public.my_class_quest() ->> 'won')::boolean, false, '... not won yet');
select throws_ok($$ select * from public.quest_days $$, '42501', null, 'a pupil can''t read quest days directly');
select throws_ok($$ insert into public.quest_wins (player, kind) values (pg_temp.id('a'), 'trader') $$, '42501', null,
                 'a pupil can''t give themselves a win');
select throws_ok($$ select public.quest_day_done(pg_temp.id('a'), 'trader') $$, '42501', null, 'a pupil can''t give themselves a day');
select throws_ok($$ select public.teacher_start_class_quest('11111111-1111-4111-8111-111111111111', 'lord') $$, '42501', null,
                 'a pupil can''t start a quest');
select pg_temp.reset();

select pg_temp.act_as('00000000-0000-0000-0000-00000000000d', 'dee@douglaspark.school.nz');
select is(public.my_class_quest(), null, 'Dee''s class has no quest: no bar');
select pg_temp.reset();

-- ---- Winning: 4 more days inside the quest's dates ----
insert into public.quest_days (player, kind, day)
select pg_temp.id('a'), 'trader', public.nz_day(now()) + n from generate_series(1, 3) n;
select is((select count(*)::integer from public.quest_wins where player = pg_temp.id('a')), 0, '4 days: not won');
insert into public.quest_days (player, kind, day) values (pg_temp.id('a'), 'trader', public.nz_day(now()) + 4);
select is((select count(*)::integer from public.quest_wins where player = pg_temp.id('a')), 1, 'the 5th day wins the quest');
select is((select count(*)::integer from public.achievements where player = pg_temp.id('a') and achievement = 'quest-1'), 1,
          '... and the First Quest achievement');
insert into public.quest_days (player, kind, day) values (pg_temp.id('a'), 'trader', public.nz_day(now()) + 5);
select is((select count(*)::integer from public.quest_wins where player = pg_temp.id('a')), 1, 'a 6th day wins nothing more');

-- ---- The trophy at 5 wins ----
insert into public.quest_wins (player, kind) select pg_temp.id('b'), 'trader' from generate_series(1, 5);
select public.quest_won(pg_temp.id('b'));
select is((select count(*)::integer from public.trophies where player = pg_temp.id('b') and trophy = 'quest-hero'), 1,
          '5 quests: the bronze Questing Hero');

-- ---- Stopping ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fox@douglaspark.school.nz');
select public.teacher_stop_class_quest('11111111-1111-4111-8111-111111111111');
select is(jsonb_array_length(public.teacher_class_quests('11111111-1111-4111-8111-111111111111') -> 'quests'), 1,
          'a stopped quest stays in the teacher''s list');
select pg_temp.reset();

select * from finish();
rollback;
