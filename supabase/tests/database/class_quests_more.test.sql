-- Weekly class quests, stage 2 (migration 20261118003100_class_quests_more.sql): daily ('days'), weekly ('total') and
-- different-things ('distinct') quests, counted by watchers on the games' own tables; nothing is kept without a quest; the
-- reads give the count and target; pupils can't count for themselves.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
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
create function pg_temp.wins(who text) returns integer language sql as $$
  select count(*)::integer from public.quest_wins w where w.player = pg_temp.id(who)
$$;
create function pg_temp.quest(class_no text, which text) returns uuid language sql as $$
  insert into public.class_quests (class_id, kind, starts_on, ends_on)
  values (case class_no when '1' then '11111111-1111-4111-8111-111111111111'::uuid else '22222222-2222-4222-8222-222222222222'::uuid end,
          which, public.nz_day(now()), public.nz_day(now()) + 6)
  returning id
$$;

select is((select count(*)::integer from public.quest_kinds), 32, '32 quests: the 3 first ones, 27 new and Goblin Storm''s 2 (20261120000200)');

-- ---- Nothing is kept without a quest ----
select public.quest_add(pg_temp.id('a'), 'marble_runs', 3);
select is((select count(*)::integer from public.quest_tallies), 0, 'no running quest: nothing is kept');

-- ---- A daily quest: Kingdom Keeper's Royal Routine (1 year a day), through the game's own table ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fox@douglaspark.school.nz');
select lives_ok($$ select public.teacher_start_class_quest('11111111-1111-4111-8111-111111111111', 'kingdom-years') $$,
                'the teacher starts Royal Routine');
select pg_temp.reset();
insert into public.kingdom_reigns (player, seed, look, city) values (pg_temp.id('a'), 'aaaaaaaaaaaaaaaa', 'ruler-girl-1', '{}');
update public.kingdom_reigns set turned = 1 where player = pg_temp.id('a');
select is((select n from public.quest_tallies where player = pg_temp.id('a') and measure = 'kingdom_years'), 1,
          'turning a year counts');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(public.my_class_quest() -> 'quest' ->> 'rule', 'days', 'Ana sees a daily quest');
select is((public.my_class_quest() ->> 'count')::integer, 1, '... with today done (1 of 5 days)');
select is((public.my_class_quest() ->> 'target')::integer, 5, '... out of 5');
select pg_temp.reset();
insert into public.quest_tallies (player, measure, day, n)
select pg_temp.id('a'), 'kingdom_years', public.nz_day(now()) + n, 1 from generate_series(1, 3) n;
select public.quest_add(pg_temp.id('a'), 'kingdom_years', 0);
select is(pg_temp.wins('a'), 0, '4 days: not won');
insert into public.quest_tallies (player, measure, day, n) values (pg_temp.id('a'), 'kingdom_years', public.nz_day(now()) + 4, 1);
select public.quest_win_check(pg_temp.id('a'), 'kingdom-years', public.nz_day(now()) + 4);
select is(pg_temp.wins('a'), 1, 'the 5th day wins');

-- ---- A daily quest needs the day's amount: Marble Rush's Daily Roll (2 runs) ----
select pg_temp.quest('1', 'marble-daily');
select public.quest_add(pg_temp.id('a'), 'marble_runs', 1);
select is((select p.count from public.class_quests q, public.quest_progress(pg_temp.id('a'), q.id) p where q.kind = 'marble-daily'), 0,
          '1 run is not a day of Daily Roll');
select public.quest_add(pg_temp.id('a'), 'marble_runs', 1);
select is((select p.count from public.class_quests q, public.quest_progress(pg_temp.id('a'), q.id) p where q.kind = 'marble-daily'), 1,
          '2 runs is');

-- ---- A weekly total: Bond Match's Match Marathon (10 matches), any days ----
select pg_temp.quest('2', 'bond-total');
select public.quest_add(pg_temp.id('d'), 'bond_matches', 9);
select is(pg_temp.wins('d'), 0, '9 matches: not yet');
select public.quest_add(pg_temp.id('d'), 'bond_matches', 1);
select is(pg_temp.wins('d'), 1, 'the 10th match wins Match Marathon');

-- ---- Different things: Royal Decree's Meet the Village (6 villagers), through the game's own table ----
select pg_temp.quest('1', 'decree-villagers');
insert into public.decree_reigns (player, look, reign) values (pg_temp.id('a'), 'ruler-boy-2', '{"met": ["baker", "smith"]}');
update public.decree_reigns set reign = '{"met": ["baker", "smith", "baker", "fisher", "gardener", "bard"]}' where player = pg_temp.id('a');
select is((select p.count from public.class_quests q, public.quest_progress(pg_temp.id('a'), q.id) p where q.kind = 'decree-villagers'), 5,
          'the same villager twice counts once (5 different)');
update public.decree_reigns set reign = '{"met": ["baker", "smith", "fisher", "gardener", "bard", "knight"]}' where player = pg_temp.id('a');
select is(pg_temp.wins('a'), 2, 'the 6th different villager wins Meet the Village');

-- ---- Pupils can't count for themselves ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.quest_add(pg_temp.id('a'), 'marble_runs', 50) $$, '42501', null, 'a pupil can''t add to their tally');
select throws_ok($$ select * from public.quest_tallies $$, '42501', null, 'a pupil can''t read tallies directly');
select pg_temp.reset();

select * from finish();
rollback;
