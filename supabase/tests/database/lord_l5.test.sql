-- Dragon Maths L.5: the Daily News (computer-written lines, read only through a function), the arena's
-- classmate list, the Warriors list and the Hall of Heroes, points inside the daily cap, achievements, the
-- season pause, the teacher's views and "reset a hero", and a new points season that keeps the heroes.
-- The lord server function does the thinking (tested in TypeScript); these tests are about the database rules around it.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(119);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'dan@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'fay@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-000000000010', 'gus@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000e';
update public.profiles set hidden = true where id = '00000000-0000-0000-0000-00000000000d';

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
create function pg_temp.today() returns date language sql as $$ select (now() at time zone 'Pacific/Auckland')::date $$;
create function pg_temp.name(who text) returns text language sql as $$
  select display_name from public.profiles where id = pg_temp.id(who)
$$;

-- A hero as the server function hands it over.
create function pg_temp.hero(level integer default 1, stars integer default 0) returns jsonb language sql as $$
  select jsonb_build_object('level', level, 'exp', level * 100, 'hp', 20, 'maxHp', 20, 'strength', 8, 'defence', 1, 'gold', 50, 'bank', 0,
    'gems', 0, 'kindness', 0, 'weapon', 0, 'armour', 0, 'heroClass', 'knight', 'dragonKills', stars, 'day', pg_temp.today()::text,
    'forestLeft', 10, 'arenaLeft', 3, 'skillLeft', 3, 'masterTried', false, 'forestWins', 0, 'arenaWins', 0, 'masterWins', 0)
$$;
create function pg_temp.version(who text) returns integer language sql as $$
  select coalesce((select version from public.lord_heroes where player = pg_temp.id(who)), 0)
$$;
-- One accepted request: the next version, a fresh id, and whatever extras (news, score, hall, doneFight, stats) the test wants.
create function pg_temp.c(who text, extras jsonb default '{}', level integer default 1, season integer default 1, stats jsonb default null)
returns text language sql as $$
  select public.lord_commit(pg_temp.id(who), jsonb_build_object(
    'expect', pg_temp.version(who), 'hero', pg_temp.hero(level), 'season', season,
    'extra', jsonb_build_object('stats', coalesce(stats, '{"forestWins":0,"masterWins":0,"arenaWins":0,"riddles":0,"dragons":0,"bestLevel":1}'::jsonb)),
    'event', jsonb_build_object('requestId', gen_random_uuid(), 'action', 'forest', 'summary', '{}'::jsonb)) || extras) ->> 'status'
$$;
create function pg_temp.points(who text) returns integer language sql as $$
  select coalesce(sum(points), 0)::integer from public.scored_games where player = pg_temp.id(who) and game = 'dragon-maths'
$$;
create function pg_temp.has(who text, achievement text) returns boolean language sql as $$
  select exists (select 1 from public.achievements where player = pg_temp.id(who) and achievements.achievement = $2)
$$;
create function pg_temp.news_for(who text) returns text[] language sql as $$
  select coalesce(array_agg(line order by line), '{}') from public.lord_news()
$$;

-- The game is on, and season 1 started today.
update public.app_settings set lord_enabled = true, lord_season_start = public.nz_day(now()), lord_paused_since = null;

-- ---- Everything new is closed to students ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.lord_news $$, '42501', null, 'students cannot read the news table');
select throws_ok($$ select * from public.lord_hall $$, '42501', null, 'students cannot read the hall table');
select throws_ok($$ select * from public.lord_scores $$, '42501', null, 'students cannot read the scores table');
select throws_ok($$ insert into public.lord_news (day, kind, text, dedupe) values (current_date, 'village', 'Free gold!', 'x') $$, '42501', null, 'students cannot write news');
select throws_ok($$ insert into public.lord_hall (player, season, kills) values (pg_temp.id('a'), 1, 5) $$, '42501', null, 'students cannot write themselves into the Hall of Heroes');
select throws_ok($$ select public.lord_daily_news(pg_temp.id('a'), current_date, '[]') $$, '42501', null, 'students cannot write the day''s news');
select throws_ok($$ select public.lord_arena_candidates(pg_temp.id('a'), 1, 5) $$, '42501', null, 'students cannot ask for classmates'' heroes');
select throws_ok($$ select public.record_lord_score(pg_temp.id('a'), 0, 0, 100) $$, '42501', null, 'students cannot give themselves points');
select throws_ok($$ select public.teacher_lord_class() $$, '42501', null, 'students cannot see the class view');
select throws_ok($$ select public.teacher_lord_student(pg_temp.id('b')) $$, '42501', null, 'students cannot see another pupil''s view');
select throws_ok($$ select public.teacher_reset_lord_hero(pg_temp.id('b')) $$, '42501', null, 'students cannot reset a hero');
select pg_temp.reset();

-- ---- The Daily News: written by the code, read through a function ----
select is(public.load_lord(pg_temp.id('a')) ->> 'dailyDone', 'false', 'the day''s own news has not been written yet');
select lives_ok($$ select public.lord_daily_news(pg_temp.id('a'), pg_temp.today(), '[
  {"kind":"village","text":"Market day! 6 trays of 8 pies make 48.","dedupe":"village"},
  {"kind":"computer","text":"Sir Gareth (computer hero) beat Master Basalt and reached level 4!","dedupe":"computer:gareth"}]') $$, 'the day''s lines go in');
select lives_ok($$ select public.lord_daily_news(pg_temp.id('a'), pg_temp.today(), '[{"kind":"village","text":"A different line","dedupe":"village"}]') $$, 'writing a line again is allowed');
select is((select count(*)::integer from public.lord_news where day = pg_temp.today()), 2, 'but a line with the same key is kept once');
select is((select text from public.lord_news where dedupe = 'village'), 'Market day! 6 trays of 8 pies make 48.', 'and the first one stays');
select throws_ok($$ select public.lord_daily_news(pg_temp.id('a'), pg_temp.today() - 1, '[]') $$, '22023', null, 'news for another day is refused');
select throws_ok($$ select public.lord_daily_news(pg_temp.id('a'), pg_temp.today(), '[{"kind":"gossip","text":"x","dedupe":"x"}]') $$, '23514', null, 'a kind of line that does not exist is refused');
select is(public.load_lord(pg_temp.id('a')) ->> 'dailyDone', 'true', 'the server is told the day''s news is done');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is(cardinality(pg_temp.news_for('b')), 2, 'a pupil reads the day''s lines');
select ok('Market day! 6 trays of 8 pies make 48.' = any (pg_temp.news_for('b')), 'including the village event');
select pg_temp.reset();

-- ---- Lines about a pupil: their name is filled in on reading, once a day per key, nothing for hidden pupils ----
select is(pg_temp.c('a', jsonb_build_object('news', jsonb_build_array(jsonb_build_object('kind','master','text','{p} beat Master Basalt and reached level 2!',
  'player', pg_temp.id('a'), 'dedupe', 'master:a:2')))), 'saved', 'a request can bring a news line');
select is(pg_temp.c('a', jsonb_build_object('news', jsonb_build_array(jsonb_build_object('kind','master','text','{p} beat Master Basalt and reached level 2!',
  'dedupe', 'master:a:2')))), 'saved', 'the same line again is allowed');
select is((select count(*)::integer from public.lord_news where dedupe = 'master:a:2'), 1, 'but it is kept once');
select is((select player from public.lord_news where dedupe = 'master:a:2'), pg_temp.id('a'), 'it is always about the pupil who made the request');
select is(pg_temp.c('d', jsonb_build_object('news', jsonb_build_array(jsonb_build_object('kind','arena','text','{p} won a fight in the arena!','dedupe','arena:d')))), 'saved', 'a hidden pupil can play');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select ok(pg_temp.name('a') || ' beat Master Basalt and reached level 2!' = any (pg_temp.news_for('b')), 'the news names the pupil by their hub name');
select is((select count(*)::integer from public.lord_news() where line like '%{p}%'), 0, 'with no placeholder left');
select is((select count(*)::integer from public.lord_news() where line like '%arena%'), 0, 'a hidden pupil leaves no lines');
select pg_temp.reset();
insert into public.lord_news (school_id, day, kind, text, dedupe) values (1, pg_temp.today() - 2, 'village', 'Two days ago.', 'old2'), (1, pg_temp.today() - 5, 'village', 'Too old.', 'old5');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select ok('Two days ago.' = any (pg_temp.news_for('b')), 'news from a couple of days ago is still read');
select ok(not ('Too old.' = any (pg_temp.news_for('b'))), 'but not news from last week');
select pg_temp.reset();

-- ---- Points: 1 for 3 forest wins, 3 for a master, 10 for the dragon ----
select is(pg_temp.c('a', '{"score":{"forest":2,"master":0,"dragon":0}}'), 'saved', 'two forest wins are saved');
select is(pg_temp.points('a'), 0, 'they do not make a point yet');
select is((select wins_pending from public.lord_heroes where player = pg_temp.id('a')), 2, 'the two wins are kept');
select is(pg_temp.c('a', '{"score":{"forest":1,"master":0,"dragon":0}}'), 'saved', 'the third win is saved');
select is(pg_temp.points('a'), 1, 'three forest wins make a point');
select is((select wins_pending from public.lord_heroes where player = pg_temp.id('a')), 0, 'and the count starts again');
select is(pg_temp.c('a', '{"score":{"forest":0,"master":1,"dragon":0}}'), 'saved', 'a master is beaten');
select is(pg_temp.points('a'), 4, 'a master is worth 3 points');
select is(pg_temp.c('a', '{"score":{"forest":0,"master":0,"dragon":1}}'), 'saved', 'the dragon is beaten');
select is(pg_temp.points('a'), 14, 'the dragon is worth 10 points');
select is(pg_temp.c('a'), 'saved', 'a request with nothing to score is saved');
select is(pg_temp.points('a'), 14, 'and scores nothing');
select is((select count(*)::integer from public.scored_games where player = pg_temp.id('a') and kind = 'solo' and game = 'dragon-maths'), 3, 'each scoring request is one row, none for nothing');
select is(pg_temp.c('a', '{"score":{"forest":0,"master":0,"dragon":5}}'), 'saved', 'a pile of dragons at once');
select is(pg_temp.points('a'), 40, 'is held to the 40 points a day every game against the computer shares');
select is(public.points_total(pg_temp.id('a')), 40, 'and the pupil''s points total counts them');
select is((select points from public.scored_games where player = pg_temp.id('b') limit 1), null, 'nobody else gets them');

-- ---- Achievements come from the lifetime counts ----
select ok(not pg_temp.has('a', 'dm-first-master'), 'no achievement before the counts move');
select is(pg_temp.c('a', '{}', 2, 1, '{"forestWins":3,"masterWins":1,"arenaWins":0,"riddles":0,"dragons":0,"bestLevel":2}'), 'saved', 'a master is counted');
select ok(pg_temp.has('a', 'dm-first-master'), 'beating a master earns the first achievement');
select ok(not pg_temp.has('a', 'dm-level-6'), 'and nothing else yet');
select is(pg_temp.c('a', '{}', 6, 1, '{"forestWins":60,"masterWins":5,"arenaWins":11,"riddles":51,"dragons":2,"bestLevel":6}'), 'saved', 'a long adventure is counted');
select ok(pg_temp.has('a', 'dm-level-6') and pg_temp.has('a', 'dm-forest-50') and pg_temp.has('a', 'dm-arena-10') and pg_temp.has('a', 'dm-riddles-50'), 'level 6, 50 forest wins, 10 arena wins and 50 riddles');
select ok(pg_temp.has('a', 'dm-dragon') and pg_temp.has('a', 'dm-dragon-2'), 'and the dragon, twice');
select ok(not pg_temp.has('a', 'dm-level-12'), 'but not level 12');
select is((select count(*)::integer from public.achievement_types where game = 'dragon-maths'), 8, 'there are eight in all');
select is((select count(*)::integer from public.achievements where player = pg_temp.id('a') and achievement like 'dm-%'), 7, 'a pupil has the seven they earned');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select ok(exists (select 1 from jsonb_array_elements(public.my_progress() -> 'achievements') x where x ->> 'id' = 'dm-dragon' and x ->> 'earnedAt' is not null), 'my_progress shows them');
select is(public.progress_rules() -> 'dragonMaths' ->> 'dragonWin', '10', 'the points rules say what the dragon is worth');
select is(public.progress_rules() -> 'dragonMaths' ->> 'forestWinsPerPoint', '3', 'and the forest wins per point');
select pg_temp.reset();
update public.app_settings set lord_enabled = false;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select ok(not exists (select 1 from jsonb_array_elements(public.my_progress() -> 'achievements') x where x ->> 'id' like 'dm-%'), 'while the game is off, its achievements are hidden');
select is(public.progress_rules() -> 'dragonMaths', 'null'::jsonb, 'and so are its points rules');
select pg_temp.reset();
update public.app_settings set lord_enabled = true;

-- ---- The Hall of Heroes and a finished arena fight ----
select is(pg_temp.c('b', '{"hall":{"season":1}}', 1, 1), 'saved', 'a dragon beaten this season is written in the Hall');
select is(pg_temp.c('b', '{"hall":{"season":1}}', 1, 1), 'saved', 'and again');
select is((select kills from public.lord_hall where player = pg_temp.id('b') and season = 1), 2, 'it counts how many times in the season');
select is(pg_temp.c('b', '{"hall":{"season":2}}', 1, 1), 'saved', 'another season is another row');
select is((select count(*)::integer from public.lord_hall where player = pg_temp.id('b')), 2, 'one row per season');
select is(pg_temp.c('c', jsonb_build_object('doneFight', jsonb_build_object('id', gen_random_uuid(), 'kind', 'arena', 'monster', 'computer-gareth', 'seed', 77,
  'start', '{"a":{},"b":{}}'::jsonb, 'info', '{"day":"x"}'::jsonb, 'result', '{"outcome":"won"}'::jsonb)), 3, 1), 'saved', 'an arena fight is saved finished in one request');
select is((select status from public.lord_fights where player = pg_temp.id('c') and kind = 'arena'), 'finished', 'it is stored as finished');
select is((select result ->> 'outcome' from public.lord_fights where player = pg_temp.id('c') and kind = 'arena'), 'won', 'with its result');
select is((select count(*)::integer from public.lord_fights where player = pg_temp.id('c') and status = 'open'), 0, 'it never blocks the next fight');

-- ---- The arena's classmate list ----
update public.lord_heroes set hero = pg_temp.hero(5), season = 1 where player = pg_temp.id('a');
update public.lord_heroes set hero = pg_temp.hero(4), season = 1 where player = pg_temp.id('b');
update public.lord_heroes set hero = pg_temp.hero(7), season = 1 where player = pg_temp.id('c');
update public.lord_heroes set hero = pg_temp.hero(5), season = 1 where player = pg_temp.id('d');
select is(pg_temp.c('f', '{}', 5, 2), 'saved', 'a hero from another season is saved');
select is((select jsonb_array_length(public.lord_arena_candidates(pg_temp.id('a'), 1, 5))), 2, 'a pupil is offered two classmates');
select is((select string_agg(x ->> 'name', ',' order by (x -> 'hero' ->> 'level')::integer) from jsonb_array_elements(public.lord_arena_candidates(pg_temp.id('a'), 1, 5)) x),
  pg_temp.name('b') || ',' || pg_temp.name('c'), 'the closest first, never themselves, never a hidden pupil, never another season');
select is((select jsonb_array_length(public.lord_arena_candidates(pg_temp.id('a'), 1, 12))), 0, 'nobody near level 12 means nobody');

-- ---- Warriors: dragons this season, then level; names, avatars, levels and stars only ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz');
select is((select count(*)::integer from public.lord_warriors()), 3, 'three warriors this season (not the hidden one, not last season''s)');
select is((select display_name from public.lord_warriors() where place = 1), pg_temp.name('b'), 'the pupil who beat the dragon this season is first');
select is((select string_agg(display_name, ',' order by place) from public.lord_warriors()), pg_temp.name('b') || ',' || pg_temp.name('c') || ',' || pg_temp.name('a'), 'then by level');
select is((select count(*)::integer from public.lord_warriors() where is_me), 1, 'you are marked');
select ok(not exists (select 1 from information_schema.columns where table_name = 'lord_warriors'), 'it is a function, with no table to read');
select is((select string_agg(p.proargnames::text, '') from pg_proc p where p.proname = 'lord_warriors'), '{place,display_name,avatar,level,stars,dragons,is_me}', 'and gives only place, name, avatar, level, stars and dragons');
select pg_temp.reset();
insert into auth.users (id, email)
  select ('00000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid, 'kid' || n || '@douglaspark.school.nz' from generate_series(1, 12) n;
insert into public.lord_heroes (player, hero, version, season, day)
  select ('00000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid, pg_temp.hero(8 + n % 4), 1, 1, pg_temp.today()::text from generate_series(1, 12) n;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is((select count(*)::integer from public.lord_warriors()), 11, 'only the top ten are shown, plus you');
select is((select count(*)::integer from public.lord_warriors() where is_me and place > 10), 1, 'with you in your own place');
select pg_temp.reset();

-- ---- The Hall of Heroes list ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is((select count(*)::integer from public.lord_hall()), 2, 'the Hall lists every season someone beat the dragon');
select is((select season from public.lord_hall() order by season desc limit 1), 2, 'newest first');
select is((select kills from public.lord_hall() where season = 1), 2, 'with how many times');
select is((select count(*)::integer from public.lord_hall() where is_me), 2, 'and which are yours');
select pg_temp.reset();

-- ---- The season pause ----
update public.app_settings set lord_enabled = true, lord_season_start = pg_temp.today() - 10, lord_paused_since = null;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select is(public.teacher_set_lord('{"enabled":false}') ->> 'pausedSince', pg_temp.today()::text, 'switching the game off starts the pause');
select pg_temp.reset();
update public.app_settings set lord_paused_since = pg_temp.today() - 7;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select is(public.teacher_set_lord('{"enabled":true}') ->> 'seasonStart', (pg_temp.today() - 3)::text, 'switching it back on moves the start forward by the days it was closed');
select pg_temp.reset();
select is((select lord_paused_since from public.app_settings order by class_id nulls last limit 1), null, 'and the pause is over');
select is(public.lord_current_season(pg_temp.id('a')), 1, 'the season carries on where it left off');
update public.app_settings set lord_enabled = false, lord_season_start = pg_temp.today() + 5, lord_paused_since = pg_temp.today() - 2;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select is(public.teacher_set_lord('{"enabled":true}') ->> 'seasonStart', (pg_temp.today() + 5)::text, 'a pause before the first season starts moves nothing');
select pg_temp.reset();
select is(public.lord_current_season(pg_temp.id('a')), null::integer, 'and the season is not under way yet');
update public.app_settings set lord_enabled = false, lord_season_start = pg_temp.today() - 10, lord_paused_since = pg_temp.today() - 7;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select is(public.teacher_set_lord(jsonb_build_object('enabled', true, 'seasonStart', (pg_temp.today() - 40)::text)) ->> 'seasonStart', (pg_temp.today() - 40)::text, 'a start date the teacher types wins over the pause');
select pg_temp.reset();
select is(public.lord_current_season(pg_temp.id('a')), 2, 'forty days in is the second season');
select is((select lord_paused_since from public.app_settings order by class_id nulls last limit 1), null, 'and clears the pause');
update public.app_settings set lord_enabled = true, lord_season_start = pg_temp.today(), lord_paused_since = null;

-- ---- The teacher's views ----
select pg_temp.reset();
select public.record_lord_refusal(pg_temp.id('a'), 'tampered', 'fight-finish');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select is(public.teacher_lord_class() -> 'season' ->> 'number', '1', 'the class view says which season it is');
select is(public.teacher_lord_class() ->> 'players', '17', 'how many pupils have a hero');
select is((public.teacher_lord_class() -> 'levels' ->> 3), '1', 'and how many are at each level this season');
select is(public.teacher_lord_class() -> 'refusals' -> 0 ->> 'realName', 'ana', 'a turned-down request is listed with the real name');
select is(public.teacher_lord_class() -> 'refusals' -> 0 ->> 'reason', 'tampered', 'and why');
select is(jsonb_array_length(public.teacher_lord_class() -> 'hall'), 2, 'the Hall is listed');
select is(public.teacher_lord_student(pg_temp.id('a')) -> 'hero' ->> 'level', '5', 'one pupil''s hero at a glance');
select is(public.teacher_lord_student(pg_temp.id('a')) -> 'hero' -> 'stats' ->> 'masterWins', '5', 'with everything they have done');
select is(public.teacher_lord_student(pg_temp.id('a')) ->> 'refused', '1', 'and the requests turned down this week');
select is(public.teacher_lord_student('00000000-0000-0000-0000-000000000010') -> 'hero', 'null'::jsonb, 'a pupil with no hero has none');
select pg_temp.reset();

-- ---- Resetting a hero ----
select is(pg_temp.c('b', jsonb_build_object('openFight', jsonb_build_object('id', '00000000-0000-0000-0000-0000000000b1', 'kind', 'forest', 'seed', 5,
  'start', '{"monster":{"id":"slime-1"}}'::jsonb, 'info', '{}'::jsonb)), 4, 1), 'saved', 'a pupil is in the middle of a fight');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select is(public.teacher_reset_lord_hero(pg_temp.id('b')) ->> 'reset', 'true', 'the teacher resets their hero');
select pg_temp.reset();
select is((select count(*)::integer from public.lord_heroes where player = pg_temp.id('b')), 0, 'the hero is gone');
select is((select status from public.lord_fights where id = '00000000-0000-0000-0000-0000000000b1'), 'abandoned', 'a fight in progress is abandoned');
select is((select sum(kills)::integer from public.lord_hall where player = pg_temp.id('b')), 3, 'the Hall of Heroes keeps its entries');
select is(pg_temp.c('b', '{}', 1, 1), 'saved', 'they can start again');

-- ---- A new points season: points go, heroes, stars, Hall and achievements stay ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select public.teacher_new_season('NEW SEASON');
select pg_temp.reset();
select is(pg_temp.points('a'), 0, 'the points are cleared');
select is((select count(*)::integer from public.lord_scores), 0, 'with the scores that carried them');
select is((select count(*)::integer from public.lord_heroes where player = pg_temp.id('a')), 1, 'the hero stays');
select is((select sum(kills)::integer from public.lord_hall), 3, 'and the Hall of Heroes');
select ok(pg_temp.has('a', 'dm-dragon'), 'and the achievements');
select is((select wins_pending from public.lord_heroes where player = pg_temp.id('a')), 0, 'wins that had not made a point are forgotten too');

select * from finish();
rollback;
