-- Class quest rewards, stage 1 (migration 20261119000400_quest_rewards.sql): the teacher picks the reward when starting a
-- quest; a win gives a Rename Scroll (a Name Scroll); My rewards lists it until it is used; nobody can give themselves one.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

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

-- ---- Starting: the reward is checked ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fox@douglaspark.school.nz');
select throws_ok($$ select public.teacher_start_class_quest('11111111-1111-4111-8111-111111111111', 'marble-total', 'frame') $$,
                 '22023', 'That reward can''t be given for this quest.', 'a reward that isn''t ready yet is refused');
select throws_ok($$ select public.teacher_start_class_quest('11111111-1111-4111-8111-111111111111', 'marble-total', 'gold bars') $$,
                 '22023', 'That reward can''t be given for this quest.', 'a made-up reward is refused');
select lives_ok($$ select public.teacher_start_class_quest('11111111-1111-4111-8111-111111111111', 'marble-total', 'scroll') $$,
                'the teacher starts Marble Marathon with a Rename Scroll');
select pg_temp.reset();
select is((select reward from public.class_quests where kind = 'marble-total'), 'scroll', 'the quest keeps its reward');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fox@douglaspark.school.nz');
select is(public.teacher_class_quests('11111111-1111-4111-8111-111111111111') -> 'quests' -> 0 ->> 'reward', 'scroll',
          'the teacher''s list shows the reward');
select public.teacher_stop_class_quest('11111111-1111-4111-8111-111111111111');
select lives_ok($$ select public.teacher_start_class_quest('11111111-1111-4111-8111-111111111111', 'marble-daily') $$,
                'starting with no reward (the old way) still works and means a Rename Scroll');
select pg_temp.reset();
delete from public.class_quests where kind = 'marble-daily';
update public.class_quests set stopped_at = null where kind = 'marble-total';

-- ---- Before winning ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(public.my_class_quest() -> 'quest' ->> 'reward', 'scroll', 'Ana''s bar shows the reward from day 1');
select is(public.my_class_quest() ->> 'myReward', null, '... and she has none yet');
select pg_temp.reset();

-- ---- Winning gives a Name Scroll ----
select public.quest_add(pg_temp.id('a'), 'marble_runs', 12);
select is(pg_temp.scrolls('a'), 1, 'winning gives Ana a Name Scroll');
select is(pg_temp.scrolls('b'), 0, '... and not Bea, who hasn''t won');
select public.quest_win_check(pg_temp.id('a'), 'marble-total', public.nz_day(now()));
select is(pg_temp.scrolls('a'), 1, 'a second check gives nothing more');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select isnt(public.my_class_quest() ->> 'myReward', null, 'Ana''s bar knows her reward');
select is((public.my_name_status() ->> 'scrolls')::integer, 1, 'the scroll is ready on her name page');
select is(public.my_quest_rewards() -> 0 ->> 'usedAt', null, 'My rewards shows it unused');
select public.ask_for_my_name('Te Ahi');
select isnt(public.my_quest_rewards() -> 0 ->> 'usedAt', null, 'once she asks for a name with it, it shows used');

-- ---- Nobody gives themselves one ----
select throws_ok($$ select public.quest_reward_give('00000000-0000-0000-0000-00000000000a',
                                                    (select id from public.class_quests limit 1)) $$,
                 '42501', null, 'pupils can''t call the reward giver');
select pg_temp.reset();

select * from finish();
rollback;
