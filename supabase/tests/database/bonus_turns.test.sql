-- Class quest rewards, stage 3: Bonus Turns Day (migration 20261119000600_bonus_turns.sql): a quest in a game with daily turns can give
-- a reward that lifts that game's turn limit for one pupil for one NZ day, through settings_of.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'bea@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'fox@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000f';
update public.schools set default_class = null;
delete from public.class_members;
delete from public.class_teachers;
insert into public.classes (id, school_id, name, school_year, warp_code) values
  ('11111111-1111-4111-8111-111111111111', 1, 'Room 1', 2026, 'CDFGH');
insert into public.class_members (student_id, class_id, how) values
  ('00000000-0000-0000-0000-00000000000a', '11111111-1111-4111-8111-111111111111', 'teacher'),
  ('00000000-0000-0000-0000-00000000000b', '11111111-1111-4111-8111-111111111111', 'teacher');
insert into public.class_teachers (class_id, teacher_id) values ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-00000000000f');

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000000' || who)::uuid $$;

create function pg_temp.today() returns text language sql as $$ select to_char((now() at time zone 'Pacific/Auckland')::date, 'YYYY-MM-DD') $$;

-- ---- Starting with Bonus Turns ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fox@douglaspark.school.nz');
select throws_ok($$ select public.teacher_start_class_quest('11111111-1111-4111-8111-111111111111', 'mine-total', 'turns') $$,
                 '22023', 'That reward can''t be given for this quest.', 'a quest in a game with no daily turns can''t give Bonus Turns');
select throws_ok($$ select public.teacher_start_class_quest('11111111-1111-4111-8111-111111111111', 'bond-total', 'turns') $$,
                 '22023', 'That reward can''t be given for this quest.', '... nor can Bond Match');
select throws_ok($$ select public.teacher_start_class_quest('11111111-1111-4111-8111-111111111111', 'trader', 'banner') $$,
                 '22023', 'That reward can''t be given for this quest.', 'a reward that isn''t ready yet is still refused');
select lives_ok($$ select public.teacher_start_class_quest('11111111-1111-4111-8111-111111111111', 'mine-total', 'scroll') $$,
                'a Name Scroll quest still starts');
select pg_temp.reset();
update public.class_quests set stopped_at = now();
select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fox@douglaspark.school.nz');
select lives_ok($$ select public.teacher_start_class_quest('11111111-1111-4111-8111-111111111111', 'marble-total', 'title') $$,
                'a Hero Title quest still starts');
select pg_temp.reset();
update public.class_quests set stopped_at = now();
select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fox@douglaspark.school.nz');
select lives_ok($$ select public.teacher_start_class_quest('11111111-1111-4111-8111-111111111111', 'trader', 'turns') $$,
                'the teacher starts Star Trader with Bonus Turns');
select pg_temp.reset();

-- ---- Winning leaves an unused reward ----
insert into public.quest_wins (quest, player, kind)
select id, pg_temp.id('a'), kind from public.class_quests where kind = 'trader';
select is((select detail ->> 'game' from public.quest_rewards where player = pg_temp.id('a') and reward = 'turns'), 'trader',
          'the win left a Bonus Turns reward for Star Trader');
select is((select used_at from public.quest_rewards where player = pg_temp.id('a') and reward = 'turns'), null, '... unused');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(public.my_quest_rewards() -> 0 ->> 'usedAt', null, 'My rewards shows it unused');
select pg_temp.reset();
create temp table t_reward as select id from public.quest_rewards where player = pg_temp.id('a') and reward = 'turns';
grant select on t_reward to authenticated;

-- ---- Before use ----
select is(public.unlimited_today(pg_temp.id('a'), 'trader'), false, 'Ana has no unlimited turns yet');
select is((select unlimited_days ? 'trader' from public.settings_of(pg_temp.id('a'))), false, '... and settings_of has no trader day');

-- ---- Using it ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'bea@douglaspark.school.nz');
select throws_ok($$ select public.use_quest_reward((select id from t_reward), '{}') $$, '42501', null, 'Bea can''t use Ana''s reward');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select lives_ok($$ select public.use_quest_reward((select id from t_reward), '{}') $$, 'Ana uses her Bonus Turns Day');
select isnt(public.my_quest_rewards() -> 0 ->> 'usedAt', null, 'My rewards shows it used');
select is(public.my_quest_rewards() -> 0 ->> 'day', pg_temp.today(), '... for today');
select pg_temp.reset();
select is(public.unlimited_today(pg_temp.id('a'), 'trader'), true, 'Ana now has unlimited Star Trader turns');
select is(public.unlimited_games(pg_temp.id('a')) ? 'trader', true, '... unlimited_games lists it') ;
select is((select unlimited_days ->> 'trader' from public.settings_of(pg_temp.id('a'))), pg_temp.today(), '... settings_of has today''s date');
select is(public.unlimited_today(pg_temp.id('b'), 'trader'), false, 'Bea is not affected');
select is((select count(*)::integer from public.bonus_turns where player = pg_temp.id('a') and game = 'trader'
             and day = (now() at time zone 'Pacific/Auckland')::date and reward = (select id from t_reward)), 1, 'a bonus_turns row exists');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.use_quest_reward((select id from t_reward), '{}') $$, '22023', 'You''ve already used that reward.', 'it can''t be used twice');

-- ---- A second one the same day ----
select pg_temp.reset();
insert into public.quest_rewards (player, quest, kind, reward, detail) values (pg_temp.id('a'), null, 'trader', 'turns', '{"game":"trader"}');
create temp table t_reward2 as select id from public.quest_rewards where player = pg_temp.id('a') and used_at is null;
grant select on t_reward2 to authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.use_quest_reward((select id from t_reward2), '{}') $$,
                 '22023', 'You already have unlimited turns in that game today. Save this for another day!', 'a second one for the same game the same day is refused');

-- ---- settings_of is unchanged otherwise ----
select pg_temp.reset();
select is((select count(*)::integer from public.settings_of(pg_temp.id('a'))), 1, 'settings_of still returns one row');
select is((select s.id from public.settings_of(pg_temp.id('a')) s), (select a.id from public.app_settings a where a.id = public.settings_id_of(pg_temp.id('a'))),
          '... the class''s own row');
select is((select s.trader_enabled from public.settings_of(pg_temp.id('a')) s),
          (select a.trader_enabled from public.app_settings a where a.id = public.settings_id_of(pg_temp.id('a'))), '... with other columns unchanged');

-- ---- Yesterday doesn't count ----
insert into public.bonus_turns (player, game, day) values (pg_temp.id('a'), 'diamond', (now() at time zone 'Pacific/Auckland')::date - 1);
select is(public.unlimited_today(pg_temp.id('a'), 'diamond'), false, 'a Bonus Turns Day for yesterday doesn''t count');

-- ---- Locked down ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ insert into public.bonus_turns (player, game, day) values ('00000000-0000-0000-0000-00000000000a', 'isles', current_date) $$,
                 '42501', null, 'nobody gives themselves a Bonus Turns Day');
select pg_temp.reset();
select is(has_function_privilege('authenticated', 'public.quest_turns_game(text)', 'execute'), false, 'pupils can''t call quest_turns_game');

-- ---- Hero Title path still works ----
insert into public.quest_rewards (player, quest, kind, reward) values (pg_temp.id('b'), null, 'marble-total', 'title');
create temp table t_reward3 as select id from public.quest_rewards where player = pg_temp.id('b') and reward = 'title';
grant select on t_reward3 to authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'bea@douglaspark.school.nz');
select lives_ok($$ select public.use_quest_reward((select id from t_reward3), '{"title":"the-kind"}') $$, 'a Hero Title can still be used');
select pg_temp.reset();

-- ---- Unlimited today reaches the class's teachers (migration 20261122001200) ----
-- Fox also teaches an older class, so Fox's own settings row is that one's; a switch in Room 1 still reaches Fox.
insert into public.classes (id, school_id, name, school_year, warp_code, created_at) values
  ('11111111-1111-4111-8111-000000000000', 1, 'Room 0', 2026, 'CDFGJ', now() - interval '1 year');
insert into public.class_teachers (class_id, teacher_id) values ('11111111-1111-4111-8111-000000000000', pg_temp.id('f'));
insert into public.app_settings (school_id, class_id) values
  (1, '11111111-1111-4111-8111-000000000000'), (1, '11111111-1111-4111-8111-111111111111') on conflict do nothing;
update public.app_settings set unlimited_days = jsonb_build_object('monsters', pg_temp.today(), 'diamond', '2020-01-01')
  where class_id = '11111111-1111-4111-8111-111111111111';
select is((select s.class_id from public.settings_of(pg_temp.id('f')) s), '11111111-1111-4111-8111-000000000000'::uuid,
  'a teacher of two classes reads the older class''s settings');
select is((select s.unlimited_days from public.settings_of(pg_temp.id('f')) s), jsonb_build_object('monsters', pg_temp.today()),
  '... but gets Unlimited today switched on in another class they teach (today''s switches only)');

select * from finish();
rollback;
