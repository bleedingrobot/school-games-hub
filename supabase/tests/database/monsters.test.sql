-- Maths Monsters N.6: saving (in order, once each), points inside the daily cap, achievements, the
-- "most monsters" board, the teacher's switches and views, and a new season that keeps the adventure.
-- The server function does the checking of a save (shared/monsters/save, tested in TypeScript); these
-- tests are about the database rules around it.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(87);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'dan@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000e';

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-00000000000' || who)::uuid
$$;

-- A save as the server function hands it over (already checked).
create function pg_temp.save(who text, seq integer, wild integer default 0, trainers integer default 0,
  new_badges text[] default '{}', catches integer default 0, owned integer default 2, seen integer default 2,
  badges integer default 0, finals integer default 0, save_id uuid default gen_random_uuid())
returns jsonb language sql as $$
  select public.record_monster_save(pg_temp.id(who), jsonb_build_object(
    'saveId', save_id, 'seq', seq, 'at', 1792000000000 + seq,
    'world', jsonb_build_object('version', 1, 'map', 'harbour-town', 'team', '[]'::jsonb, 'badges', to_jsonb(new_badges)),
    'battles', '[]'::jsonb,
    'summary', jsonb_build_object('wildWins', wild, 'trainerWins', trainers, 'newBadges', to_jsonb(new_badges),
      'catches', catches, 'questions', 0, 'right', 0, 'owned', owned, 'seen', seen, 'badges', badges, 'finalInTeam', finals)))
$$;
create function pg_temp.points(who text) returns integer language sql as $$
  select coalesce(sum(points), 0)::integer from public.scored_games where player = pg_temp.id(who) and game = 'monsters'
$$;
create function pg_temp.has(who text, achievement text) returns boolean language sql as $$
  select exists (select 1 from public.achievements where player = pg_temp.id(who) and achievements.achievement = $2)
$$;

-- ---- Students can't save, look up or change anything directly ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select pg_temp.save('a', 1) $$, '42501', null, 'a student cannot save a game directly');
select throws_ok($$ select public.load_monster_save(pg_temp.id('a')) $$, '42501', null, 'a student cannot ask for a save to check against');
select throws_ok($$ select public.record_monster_refusal(pg_temp.id('a'), 'badge', 1) $$, '42501', null,
  'a student cannot write a refusal');
select throws_ok($$ select * from public.monster_saves $$, '42501', null, 'students cannot read saves');
select throws_ok($$ select * from public.monster_events $$, '42501', null, 'students cannot read the save history');
select throws_ok($$ select * from public.monster_refusals $$, '42501', null, 'students cannot read refusals');
select throws_ok($$ insert into public.monster_saves (player, world, version, last_save_id, client_at)
  values (pg_temp.id('a'), '{}', 1, gen_random_uuid(), 0) $$, '42501', null, 'students cannot write a save');
select throws_ok($$ update public.monster_saves set owned_count = 54 $$, '42501', null, 'students cannot change a save');
select throws_ok($$ select public.teacher_monster_class() $$, '42501', null, 'students cannot see the class view');
select throws_ok($$ select public.teacher_monster_student(pg_temp.id('b')) $$, '42501', null,
  'students cannot see another student''s Maths Monsters');
select throws_ok($$ select public.teacher_set_monsters('{"enabled":true,"topics":["add-sub"]}') $$, '42501', null,
  'students cannot change the settings');
select is(public.my_monsters() -> 'save', 'null'::jsonb, 'a new student has no save');
select is(public.my_monsters() -> 'settings' ->> 'enabled', 'false', 'the game is off by default');
select is(public.my_monsters() -> 'settings' -> 'topics', '["place-value","add-sub","times-tables","division","fractions","decimals"]'::jsonb,
  'every topic is on by default');
select pg_temp.reset();

-- ---- Saving in order, once each ----
select is(pg_temp.save('a', 1, save_id => '00000000-0000-0000-0000-0000000000f1') ->> 'status', 'saved', 'the first save is kept');
select is(pg_temp.save('a', 1, save_id => '00000000-0000-0000-0000-0000000000f1') ->> 'status', 'duplicate',
  'the same save sent again is spotted');
select is(pg_temp.save('a', 1) ->> 'status', 'stale', 'a different save for the same place in line is out of date');
select is(pg_temp.save('a', 3) ->> 'status', 'stale', 'a save that skips one is out of date too');
select is(pg_temp.save('a', 2) ->> 'status', 'saved', 'the next save in line is kept');
select is((select version from public.monster_saves where player = pg_temp.id('a')), 2, 'the version counts up');
select is((select count(*)::integer from public.monster_events where player = pg_temp.id('a')), 2, 'each kept save is in the history once');
select is((select count(*)::integer from public.monster_saves where player = pg_temp.id('a')), 1, 'one row per student');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(public.my_monsters() -> 'save' -> 'world' ->> 'map', 'harbour-town', 'a student reads their own save back');
select is((public.my_monsters() -> 'save' ->> 'version')::integer, 2, '... with its version');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is(public.my_monsters() -> 'save', 'null'::jsonb, 'and not someone else''s');
select pg_temp.reset();

-- ---- Points: 1 per 3 wild wins, 3 per trainer, 8 per badge, inside the cap ----
select is(pg_temp.save('b', 1, wild => 2) ->> 'points', null, 'two wild wins make no point yet');
select is(pg_temp.save('b', 2, wild => 1) ->> 'points', '1', '... the third makes one');
select is((select wild_wins_pending from public.monster_saves where player = pg_temp.id('b')), 0, '... and nothing is left over');
select is(pg_temp.save('b', 3, wild => 2, trainers => 1) ->> 'points', '3', 'two wild wins and a trainer: 3 (the trainer)');
select is((select wild_wins_pending from public.monster_saves where player = pg_temp.id('b')), 2, '... and the two wild wins wait');
select is(pg_temp.save('b', 4, wild => 1, new_badges => array['leaf'], badges => 1) ->> 'points', '9', 'a wild win that finishes a point, and a badge: 1 + 8');
select is(pg_temp.points('b'), 13, 'the points add up');
select is(pg_temp.save('b', 5, new_badges => '{}') ->> 'points', null, 'a save with nothing new earns nothing');
select is((select count(*)::integer from public.scored_games where player = pg_temp.id('b') and game = 'monsters'), 3,
  'only saves that earned something are scored');
select is(pg_temp.save('b', 6, trainers => 5) ->> 'points', '15', 'five trainers: 15');
select is(pg_temp.save('b', 7, trainers => 5) ->> 'points', '12', 'then only what is left of the daily 40');
select is(pg_temp.save('b', 8, trainers => 5) ->> 'points', '0', 'then nothing');
select is(pg_temp.points('b'), 40, 'never over the cap');
select is((select points from public.scored_games where player = pg_temp.id('b') order by finished_at desc, id desc limit 1), 0,
  'the last save is scored, at nothing');

-- shared with bot games
select public.record_bot_game(pg_temp.id('c'), 'chess', 'medium', 'white', array['e2e4', 'm' || g], 'won', 'checkmate', 20, true)
from generate_series(1, 4) as g;
select is(pg_temp.save('c', 1, trainers => 3) ->> 'points', '8', 'bot games use up the same cap (32 used, 8 left)');
select is(pg_temp.save('c', 2, trainers => 3) ->> 'points', '0', 'and then none left');

-- ---- Achievements ----
select pg_temp.save('d', 1, catches => 1, owned => 3, seen => 4);
select ok(pg_temp.has('d', 'mm-first-catch'), 'first catch is an achievement');
select ok(not pg_temp.has('d', 'mm-book-10'), '... and 3 monsters is not 10');
select pg_temp.save('d', 2, catches => 0, owned => 10, seen => 12);
select ok(pg_temp.has('d', 'mm-book-10'), '10 monsters');
select ok(not pg_temp.has('d', 'mm-book-25'), '... not 25 yet');
select pg_temp.save('d', 3, owned => 25, seen => 30, new_badges => array['leaf'], badges => 1);
select ok(pg_temp.has('d', 'mm-book-25') and pg_temp.has('d', 'mm-first-badge'), '25 monsters and the first badge');
select ok(not pg_temp.has('d', 'mm-three-badges'), '... one badge is not three');
select pg_temp.save('d', 4, owned => 54, seen => 54, badges => 6, finals => 6, new_badges => array['water', 'fire', 'ice', 'spark', 'stone']);
select ok(pg_temp.has('d', 'mm-book-54') and pg_temp.has('d', 'mm-three-badges') and pg_temp.has('d', 'mm-all-badges')
  and pg_temp.has('d', 'mm-full-team'), 'the whole book, six badges and a grown team');
select is((select count(*)::integer from public.achievements where player = pg_temp.id('d') and achievement like 'mm-%'), 8,
  'eight achievements in all, each once');
select pg_temp.save('d', 5, owned => 54, seen => 54, badges => 6, finals => 6);
select is((select count(*)::integer from public.achievements where player = pg_temp.id('d') and achievement like 'mm-%'), 8,
  'saving again does not earn them twice');
select is((select count(*)::integer from public.achievement_types where game = 'monsters'), 8, 'there are eight to earn');

-- ---- The "most monsters" board ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is((select count(*)::integer from public.monsters_leaderboard()), 4, 'everyone with a save is on the board (4 here)');
select is((select display_name || ':' || monsters from public.monsters_leaderboard() where place = 1 limit 1),
  (select display_name || ':54' from public.profiles where id = pg_temp.id('d')), 'the most monsters owned comes first');
select is((select monsters from public.monsters_leaderboard() where is_me), 2, 'it counts owned entries, not the 54 seen');
select pg_temp.reset();
update public.monster_saves set owned_count = 2, seen_count = 54 where player = pg_temp.id('c');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is((select monsters from public.monsters_leaderboard() where display_name = (select display_name from public.profiles where id = pg_temp.id('c'))),
  2, 'seen-only entries never raise a place');
select pg_temp.reset();
update public.profiles set hidden = true where id = pg_temp.id('d');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is((select count(*)::integer from public.monsters_leaderboard()), 3, 'a hidden player is not on the board');
select pg_temp.reset();
update public.profiles set hidden = false where id = pg_temp.id('d');
-- more than 10: top 10 plus me
insert into auth.users (id, email)
select ('10000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'kid' || g || '@douglaspark.school.nz' from generate_series(1, 12) as g;
select public.record_monster_save(('10000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, jsonb_build_object(
  'saveId', gen_random_uuid(), 'seq', 1, 'at', 1792000000000, 'world', '{"version":1}'::jsonb, 'battles', '[]'::jsonb,
  'summary', jsonb_build_object('wildWins', 0, 'trainerWins', 0, 'newBadges', '[]'::jsonb, 'catches', 0, 'questions', 0,
    'right', 0, 'owned', 20 + g, 'seen', 20 + g, 'badges', 0, 'finalInTeam', 0)))
from generate_series(1, 12) as g;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is((select count(*)::integer from public.monsters_leaderboard()), 11, 'the top 10 and my own line');
select is((select count(*)::integer from public.monsters_leaderboard() where is_me), 1, '... and it is me');
select pg_temp.reset();

-- ---- Teacher switches ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select is(public.teacher_set_monsters('{"enabled":true,"topics":["fractions","add-sub"]}') ->> 'enabled', 'true', 'a teacher switches the game on');
select is((select monsters_topics from public.app_settings order by class_id nulls last limit 1), array['add-sub', 'fractions'], '... and picks the topics');
select throws_ok($$ select public.teacher_set_monsters('{"enabled":true,"topics":[]}') $$, '22023', 'Leave at least one topic on.',
  'at least one topic stays on');
select throws_ok($$ select public.teacher_set_monsters('{"enabled":true,"topics":["pizza"]}') $$, '22023', null, 'unknown topics are refused');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is((select count(*)::integer from jsonb_array_elements(public.my_progress() -> 'achievements') a where a ->> 'game' = 'monsters'), 8,
  'students see the eight achievements while the game is on');
select is(public.progress_rules() -> 'monsters', '{"wildWinsPerPoint":3,"trainerWin":3,"badge":8}'::jsonb, '... and the points rules');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select is(public.teacher_set_monsters('{"enabled":false,"topics":["add-sub","fractions"]}') ->> 'enabled', 'false', 'and off again');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is((select count(*)::integer from jsonb_array_elements(public.my_progress() -> 'achievements') a where a ->> 'game' = 'monsters'), 0,
  'the achievements are hidden while it is off');
select is(public.progress_rules() -> 'monsters', 'null'::jsonb, '... and so are the points rules');
select pg_temp.reset();
select is((select count(*)::integer from public.achievements where player = pg_temp.id('d') and achievement like 'mm-%'), 8,
  '... but what was earned is kept');
select is((select monsters_enabled from public.app_settings order by class_id nulls last limit 1), false, 'it is off again for the rest of these tests');

-- ---- Maths records for the new topics ----
select is(public.record_fact_answers(pg_temp.id('a'), 'add-sub', gen_random_uuid(),
  '[{"key":"add:7+8","correct":false,"ms":4000,"at":1792101600000},{"key":"pv:round10","correct":true,"ms":2000,"at":1792101600100}]', 5000, 2, 4),
  2, 'answers for the new topics are recorded (their keys are allowed)');
select is((select attempts || '/' || correct from public.gem_keep_facts where player = pg_temp.id('a') and fact_key = 'add:7+8'), '1/0',
  '... into the same records every game uses');
select throws_ok($$ insert into public.gem_keep_facts (player, pack, fact_key, attempts, correct, avg_ms, box)
  values (pg_temp.id('a'), 'add-sub', 'DROP TABLE;', 1, 1, 1, 1) $$, '23514', null, 'but not any text');

-- ---- The teacher's views ----
select public.record_fact_answers(pg_temp.id('b'), 'add-sub', gen_random_uuid(),
  '[{"key":"add:7+8","correct":false,"ms":4000,"at":1792101600000},{"key":"add:7+8","correct":false,"ms":4000,"at":1792101600001},{"key":"add:7+8","correct":true,"ms":4000,"at":1792101600002}]', 5000, 2, 4);
select public.record_fact_answers(pg_temp.id('c'), 'add-sub', gen_random_uuid(),
  '[{"key":"add:7+8","correct":false,"ms":4000,"at":1792101600000},{"key":"add:7+8","correct":false,"ms":4000,"at":1792101600001}]', 5000, 2, 4);
select public.record_monster_refusal(pg_temp.id('c'), 'badge', 3);
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select is((public.teacher_monster_class() ->> 'players')::integer, 16, 'the class view counts the players (16)');
select is(public.teacher_monster_class() -> 'hardest' -> 0 ->> 'key', 'add:7+8', 'the hardest question is the one most often wrong');
select is(public.teacher_monster_class() -> 'refusals' -> 0 ->> 'reason', 'badge', 'refused saves are listed for the teacher');
select is(jsonb_array_length(public.teacher_monster_class() -> 'topics'), 6, 'there is a line for each topic');
select is((public.teacher_monster_student(pg_temp.id('d')) -> 'save' ->> 'owned')::integer, 54, 'a student''s game at a glance');
select is((public.teacher_monster_student(pg_temp.id('c')) ->> 'refused')::integer, 1, '... and how many of their saves were refused lately');
select pg_temp.reset();

-- ---- A new season: points go, the adventure stays ----
select pg_temp.save('a', 3, wild => 2);
select is((select wild_wins_pending from public.monster_saves where player = pg_temp.id('a')), 2, 'two wild wins are waiting for a point');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select public.teacher_new_season('NEW SEASON');
select pg_temp.reset();
select is((select count(*)::integer from public.scored_games where game = 'monsters'), 0, 'all the Maths Monsters points are gone');
select is((select owned_count from public.monster_saves where player = pg_temp.id('d')), 54, 'the monster book is kept');
select is((select badges_count from public.monster_saves where player = pg_temp.id('d')), 6, '... and the badges');
select is((select world ->> 'map' from public.monster_saves where player = pg_temp.id('a')), 'harbour-town', '... and the game');
select is((select wild_wins_pending from public.monster_saves where player = pg_temp.id('a')), 0, 'a half-made point starts again');
select is((select count(*)::integer from public.achievements where player = pg_temp.id('d') and achievement like 'mm-%'), 8,
  'the Maths Monsters achievements stay with the adventure');
select is((select count(*)::integer from public.gem_keep_facts where player = pg_temp.id('a') and pack = 'add-sub'), 2,
  'the new topics'' records stay');
select is(pg_temp.save('a', 4, wild => 3) ->> 'points', '1', 'saving carries on in the new season');

select * from finish();
rollback;
