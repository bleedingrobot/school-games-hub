-- Class quest rewards, stage 4: Quest Frames (migration 20261119000800_quest_frames.sql): a teacher can start any quest with a Quest Frame;
-- a win leaves an unused reward; the pupil picks a frame from the list, owns it, wears it; only the server writes the avatar's frame.
begin;
create extension if not exists pgtap with schema extensions;
select plan(47);

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

-- ---- Which quests can give a frame ----
select is(public.quest_reward_fits('marble-total', 'frame'), true, 'a Marble quest can give a frame');
select is(public.quest_reward_fits('mine-total', 'frame'), true, 'so can a game with no turns or coins');
select is(public.quest_reward_fits('trader', 'frame'), true, 'so can Star Trader');
select is(public.quest_reward_fits(null, 'frame'), false, 'no quest, no reward');
select is(public.quest_reward_fits('marble-total', 'scroll'), true, 'scrolls still fit');
select is(public.quest_reward_fits('marble-total', 'title'), true, 'titles still fit');
select is(public.quest_reward_fits('trader', 'coins'), true, 'coins still fit a game with money');
select is(public.quest_reward_fits('marble-total', 'coins'), false, 'coins still don''t fit Marble');
select is(public.quest_reward_fits('mine-total', 'turns'), false, 'turns still don''t fit a game without turns');
select is(public.quest_reward_fits('marble-total', 'banner'), false, 'an unknown reward is still refused');

-- ---- Starting and winning ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fox@douglaspark.school.nz');
select lives_ok($$ select public.teacher_start_class_quest('11111111-1111-4111-8111-111111111111', 'marble-total', 'frame') $$,
                'the teacher starts Marble Marathon with a Quest Frame');
select pg_temp.reset();
select is((select reward from public.class_quests where kind = 'marble-total'), 'frame', 'the quest keeps its reward');
select public.quest_add(pg_temp.id('a'), 'marble_runs', 12);
select is((select count(*)::integer from public.quest_rewards where player = pg_temp.id('a') and reward = 'frame' and used_at is null), 1,
          'the win leaves one unused frame reward');
select is((select count(*)::integer from public.name_scrolls s where s.player = pg_temp.id('a') and s.how = 'quest'), 0, '... and no Name Scroll');
create temp table t_reward as select id from public.quest_rewards where player = pg_temp.id('a');
grant select on t_reward to authenticated;

-- ---- Using it ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'bea@douglaspark.school.nz');
select throws_ok($$ select public.use_quest_reward((select id from t_reward), '{"frame":"vine"}') $$,
                 '42501', null, 'Bea can''t use Ana''s reward');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.use_quest_reward((select id from t_reward), '{"frame":"gold-plated"}') $$,
                 '22023', 'Pick a frame from the list.', 'a frame that isn''t on the list is refused');
select throws_ok($$ select public.use_quest_reward((select id from t_reward), '{}') $$,
                 '22023', 'Pick a frame from the list.', 'no frame is refused');
select lives_ok($$ select public.use_quest_reward((select id from t_reward), '{"frame":"vine"}') $$, 'Ana picks Vine');
select is(public.my_quest_rewards() -> 0 ->> 'reward', 'frame', 'My rewards shows a frame reward');
select is(public.my_quest_rewards() -> 0 ->> 'frame', 'vine', '... with the frame it became');
select isnt(public.my_quest_rewards() -> 0 ->> 'usedAt', null, '... marked used');
select is(public.my_frames(), '{"owned": ["vine"], "wearing": "vine"}'::jsonb, 'she owns it and wears it');
select pg_temp.reset();
select is((select detail from public.quest_rewards where id = (select id from t_reward)), '{"frame": "vine"}'::jsonb, 'the reward detail records the frame');
select is((select avatar ->> 'frame' from public.profiles where id = pg_temp.id('a')), 'vine', 'it is in her avatar');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.use_quest_reward((select id from t_reward), '{"frame":"flame"}') $$,
                 '22023', 'You''ve already used that reward.', 'a reward can''t be used twice');

-- ---- A second reward: duplicates, titles and turns still work ----
select pg_temp.reset();
insert into public.quest_rewards (player, quest, kind, reward) values (pg_temp.id('a'), null, 'marble-total', 'frame');
create temp table t_reward2 as select id from public.quest_rewards where player = pg_temp.id('a') and used_at is null;
grant select on t_reward2 to authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.use_quest_reward((select id from t_reward2), '{"frame":"vine"}') $$,
                 '22023', 'You already have that frame. Pick a new one!', 'a frame she already has is refused');
select lives_ok($$ select public.use_quest_reward((select id from t_reward2), '{"frame":"flame"}') $$, 'a new frame works');
select is(public.my_frames() ->> 'wearing', 'flame', 'the new frame is worn straight away');
select pg_temp.reset();
update public.owned_frames set got_at = now() - interval '1 day' where frame = 'vine';
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(public.my_frames() -> 'owned', '["vine", "flame"]'::jsonb, 'she owns both, oldest first');

select pg_temp.reset();
insert into public.quest_rewards (player, quest, kind, reward) values (pg_temp.id('a'), null, 'marble-total', 'title');
insert into public.quest_rewards (player, quest, kind, reward, detail) values (pg_temp.id('a'), null, 'trader', 'turns', '{"game":"trader"}');
create temp table t_title as select id from public.quest_rewards where player = pg_temp.id('a') and reward = 'title';
create temp table t_turns as select id from public.quest_rewards where player = pg_temp.id('a') and reward = 'turns';
grant select on t_title, t_turns to authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select lives_ok($$ select public.use_quest_reward((select id from t_title), '{"title":"the-brave"}') $$,
                'the title path still works');
select lives_ok($$ select public.use_quest_reward((select id from t_turns), '{}') $$,
                'the turns path still works');

-- ---- Wearing ----
select throws_ok($$ select public.set_my_frame('crystal') $$, '22023', 'You haven''t won that frame yet.', 'a frame she doesn''t own can''t be worn');
select lives_ok($$ select public.set_my_frame('vine') $$, 'she can switch back to Vine');
select is(public.my_frames() ->> 'wearing', 'vine', '... and it shows');
select lives_ok($$ select public.save_my_avatar('{"kind":"bear","frame":"crystal","title":"moon-walker"}') $$, 'she saves a new look');
select pg_temp.reset();
select is((select avatar from public.profiles where id = pg_temp.id('a')), '{"kind":"bear","title":"the-brave","frame":"vine"}'::jsonb,
          'saving keeps the server''s frame and title and ignores the ones sent');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select lives_ok($$ select public.save_my_avatar('{"kind":"cat"}') $$, 'she saves a look with no frame or title');
select pg_temp.reset();
select is((select avatar from public.profiles where id = pg_temp.id('a')), '{"kind":"cat","title":"the-brave","frame":"vine"}'::jsonb,
          'a missing frame and title don''t remove the worn ones');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select lives_ok($$ select public.set_my_frame(null) $$, 'she can take her frame off');
select pg_temp.reset();
select is((select avatar ? 'frame' from public.profiles where id = pg_temp.id('a')), false, '... and it leaves the avatar');
select is((select avatar ->> 'title' from public.profiles where id = pg_temp.id('a')), 'the-brave', '... but her title stays');

-- ---- Locked down ----
select throws_ok($$ insert into public.owned_frames (player, frame) values ('00000000-0000-0000-0000-00000000000b', 'not-a-frame') $$,
                 '23514', null, 'the table refuses an unknown frame id');
select is(has_function_privilege('authenticated', 'public.set_my_frame(text)', 'execute'), true, 'pupils can call set_my_frame');
select is(has_function_privilege('authenticated', 'public.my_frames()', 'execute'), true, 'pupils can call my_frames');
select is(has_function_privilege('authenticated', 'public.quest_frame_ids()', 'execute'), false, 'pupils can''t call quest_frame_ids');
select is(has_function_privilege('anon', 'public.my_frames()', 'execute'), false, 'signed-out visitors can''t call my_frames');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ insert into public.owned_frames (player, frame) values ('00000000-0000-0000-0000-00000000000a', 'crystal') $$,
                 '42501', null, 'nobody gives themselves a frame');
select pg_temp.reset();

select * from finish();
rollback;
