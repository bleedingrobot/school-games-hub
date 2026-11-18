-- Class quest rewards, stage 2: Hero Titles (migration 20261119000500_hero_titles.sql): a teacher can start a quest with a Hero Title;
-- a win leaves an unused reward; the pupil picks a title from the list, owns it, wears it; only the server writes the avatar's title.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

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
create function pg_temp.scrolls(who text) returns integer language sql as $$
  select count(*)::integer from public.name_scrolls s where s.player = pg_temp.id(who) and s.how = 'quest'
$$;

-- ---- Starting with a Hero Title ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fox@douglaspark.school.nz');
select throws_ok($$ select public.teacher_start_class_quest('11111111-1111-4111-8111-111111111111', 'marble-total', 'frame') $$,
                 '22023', 'That reward can''t be given for this quest.', 'a reward that isn''t ready yet is still refused');
select lives_ok($$ select public.teacher_start_class_quest('11111111-1111-4111-8111-111111111111', 'marble-total', 'title') $$,
                'the teacher starts Marble Marathon with a Hero Title');
select pg_temp.reset();
select is((select reward from public.class_quests where kind = 'marble-total'), 'title', 'the quest keeps its reward');

-- ---- Winning leaves an unused reward ----
select public.quest_add(pg_temp.id('a'), 'marble_runs', 12);
select is((select count(*)::integer from public.name_scrolls s where s.player = pg_temp.id('a') and s.how = 'quest'), 0,
          'a Hero Title quest makes no Name Scroll');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(jsonb_array_length(public.my_quest_rewards()), 1, 'Ana has one reward');
select is(public.my_quest_rewards() -> 0 ->> 'reward', 'title', '... a Hero Title');
select is(public.my_quest_rewards() -> 0 ->> 'usedAt', null, '... unused');
select pg_temp.reset();
create temp table t_reward as select id from public.quest_rewards where player = pg_temp.id('a');
grant select on t_reward to authenticated;

-- ---- Using it ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'bea@douglaspark.school.nz');
select throws_ok($$ select public.use_quest_reward((select id from t_reward), '{"title":"the-brave"}') $$,
                 '42501', null, 'Bea can''t use Ana''s reward');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.use_quest_reward((select id from t_reward), '{"title":"the-best"}') $$,
                 '22023', null, 'a title that isn''t on the list is refused');
select throws_ok($$ select public.use_quest_reward((select id from t_reward), '{}') $$,
                 '22023', null, 'no title is refused');
select lives_ok($$ select public.use_quest_reward((select id from t_reward), '{"title":"the-brave"}') $$,
                'Ana picks The Brave');
select isnt(public.my_quest_rewards() -> 0 ->> 'usedAt', null, 'the reward shows used');
select is(public.my_quest_rewards() -> 0 ->> 'title', 'the-brave', '... with the title it became');
select is(public.my_titles(), '{"owned": ["the-brave"], "wearing": "the-brave"}'::jsonb, 'she owns it and wears it');
select pg_temp.reset();
select is((select avatar ->> 'title' from public.profiles where id = pg_temp.id('a')), 'the-brave', 'it is in her avatar');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.use_quest_reward((select id from t_reward), '{"title":"the-kind"}') $$,
                 '22023', 'You''ve already used that reward.', 'a reward can''t be used twice');

-- ---- A second reward ----
select pg_temp.reset();
insert into public.quest_rewards (player, quest, kind, reward) values (pg_temp.id('a'), null, 'marble-total', 'title');
create temp table t_reward2 as select id from public.quest_rewards where player = pg_temp.id('a') and used_at is null;
grant select on t_reward2 to authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.use_quest_reward((select id from t_reward2), '{"title":"the-brave"}') $$,
                 '22023', 'You already have that title. Pick a new one!', 'a title she already has is refused');
select lives_ok($$ select public.use_quest_reward((select id from t_reward2), '{"title":"moon-walker"}') $$,
                'a new title works');
select pg_temp.reset();
update public.owned_titles set got_at = now() - interval '1 day' where title = 'the-brave';
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(public.my_titles() -> 'owned', '["the-brave", "moon-walker"]'::jsonb, 'she now owns both, oldest first');

-- ---- Wearing ----
select throws_ok($$ select public.set_my_title('dragon-friend') $$, '22023', null, 'a title she doesn''t own can''t be worn');
select lives_ok($$ select public.set_my_title('the-brave') $$, 'she can switch back to The Brave');
select is(public.my_titles() ->> 'wearing', 'the-brave', '... and it shows');
select lives_ok($$ select public.save_my_avatar('{"kind":"bear","title":"dragon-friend"}') $$, 'she saves a new look');
select is(public.my_titles() ->> 'wearing', 'the-brave', 'saving a look keeps the worn title and ignores the one sent');
select pg_temp.reset();
select is((select avatar from public.profiles where id = pg_temp.id('a')), '{"kind":"bear","title":"the-brave"}'::jsonb,
          'the saved avatar is the new look plus the worn title');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select lives_ok($$ select public.set_my_title(null) $$, 'she can take her title off');
select pg_temp.reset();
select is((select avatar ? 'title' from public.profiles where id = pg_temp.id('a')), false, '... and it leaves the avatar');

-- ---- Locked down ----
select is(has_function_privilege('anon', 'public.my_titles()', 'execute'), false, 'signed-out visitors can''t call my_titles');
select is(has_function_privilege('authenticated', 'public.hero_title_ids()', 'execute'), false, 'pupils can''t call hero_title_ids');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ insert into public.owned_titles (player, title) values ('00000000-0000-0000-0000-00000000000a', 'the-kind') $$,
                 '42501', null, 'nobody gives themselves a title');
select pg_temp.reset();

select * from finish();
rollback;
