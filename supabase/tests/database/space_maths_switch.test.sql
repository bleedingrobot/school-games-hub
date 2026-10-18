-- Mission Control maths M.5: the teacher's switch, and the three maths achievements.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000e';

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.act_as_server() returns void language sql as $$
  select set_config('role', 'service_role', true), set_config('request.jwt.claims', '{"role":"service_role"}', true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.space(seed text, right_answers integer, boosts integer, escapes integer)
returns uuid language sql as $$
  select public.record_space_bot_game('00000000-0000-0000-0000-00000000000a'::uuid, 'easy', 'second',
    array['roll', 'roll', 'roll', 'roll', 'roll'], 'lost', 'docked', 12, true,
    jsonb_build_object('seed', seed, 'board', '{"id":"nebula"}'::jsonb, 'settings', '{}'::jsonb, 'bots', 3,
      'place', 2, 'rockets', 4,
      'stats', jsonb_build_object('wormholes', 1, 'blocks', 0, 'stars', '[]'::jsonb, 'docked', false,
        'mathsRight', right_answers, 'boosts', boosts, 'escapes', escapes)))
$$;
create function pg_temp.has(achievement text) returns boolean language sql as $$
  select exists (select 1 from public.achievements
    where player = '00000000-0000-0000-0000-00000000000a' and achievements.achievement = $1)
$$;

-- ---- The switch ----
select is((select space_maths from public.app_settings order by class_id nulls last limit 1), 'choose', 'students choose by default');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is((select space_maths from public.app_settings order by class_id nulls last limit 1), 'choose', 'a student can read the switch');
select throws_ok($$ select public.teacher_set_space_maths('off') $$, '42501', null, 'but not change it');
select throws_ok($$ update public.app_settings set space_maths = 'off' $$, '42501', null, 'not even directly');
select pg_temp.reset();

select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select lives_ok($$ select public.teacher_set_space_maths('on') $$, 'a teacher can change it');
select throws_ok($$ select public.teacher_set_space_maths('sometimes') $$, '22023', null, 'to a known setting only');
select pg_temp.reset();
select is((select space_maths from public.app_settings order by class_id nulls last limit 1), 'on', 'and it is saved');

-- ---- Achievements ----
select pg_temp.act_as_server();
select pg_temp.space('s1-0000000001-aaa', 6, 0, 0);
select pg_temp.reset();
select ok(not pg_temp.has('space-mission-control') and not pg_temp.has('space-wormhole-booster') and not pg_temp.has('space-great-escape'),
  'six right answers earn nothing yet');
select pg_temp.act_as_server();
select pg_temp.space('s1-0000000002-bbb', 4, 1, 1);
select pg_temp.reset();
select ok(pg_temp.has('space-mission-control'), '10 right answers across games: Mission Control');
select ok(pg_temp.has('space-wormhole-booster'), 'a powered-up wormhole: Wormhole booster');
select ok(pg_temp.has('space-great-escape'), 'half a black hole escaped: Great escape');
select is((select count(*)::int from public.achievement_types where game = 'space' and measure in ('maths_right', 'boosts', 'escapes')), 3,
  'there are three maths achievements');
select is((select (public.progress_counts('00000000-0000-0000-0000-00000000000a', 'space') ->> 'maths_right')::int), 10,
  'right answers are counted from every game');

select * from finish();
rollback;
