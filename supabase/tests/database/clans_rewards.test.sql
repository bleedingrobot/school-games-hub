-- Clan Quest stage C.6 part B: fame, points, achievements, the scoreboard, the fame season, the teacher's maths settings and records.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(132);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cai@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'dee@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000e';

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000000' || who)::uuid $$;
create function pg_temp.req(n integer) returns uuid language sql as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create function pg_temp.teacher() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz') $$;

create function pg_temp.member(n integer) returns jsonb language sql as $$
  select jsonb_build_object('name', 'Member' || n, 'race', 'Human', 'cls', 'Warrior', 'level', 2, 'xp', 40, 'hp', 20, 'maxHp', 20, 'sp', 5, 'maxSp', 5,
    'stats', jsonb_build_object('agility', 8), 'spells', '[]'::jsonb, 'gear', '{}'::jsonb, 'points', 3, 'knockedOut', false)
$$;
-- An empire the way the server keeps it: gold in the vault, land, plots (the third argument is how many plots have a barracks), troops.
create function pg_temp.empire(vault integer, wild integer, buildings integer default 0, footmen integer default 40, shield integer default 0) returns jsonb language sql as $$
  select jsonb_build_object('vault', vault, 'wild', wild, 'claimed', 0,
    'plots', coalesce((select jsonb_agg(jsonb_build_object('width', 3, 'length', 3, 'building', 'barracks')) from generate_series(1, buildings)), '[]'::jsonb),
    'troops', jsonb_build_object('footman', footmen, 'axeman', 0, 'knight', 0), 'draftPercent', 0, 'day', 15, 'createdDay', 1, 'energyUsed', 0,
    'raidsToday', 0, 'kingdomRaidsToday', 0, 'shieldUntil', shield, 'raidedToday', '[]'::jsonb)
$$;
create function pg_temp.state(who text, clan_name text, emp jsonb, gold integer default 200, raid_no integer default 0) returns jsonb language sql as $$
  select jsonb_build_object(
    'clan', jsonb_build_object('name', clan_name, 'gold', gold, 'followers', 5,
      'village', jsonb_build_object('trainingHall', 0, 'smithy', 0, 'church', 0), 'wakesToday', 0,
      'members', (select jsonb_agg(pg_temp.member(n)) from generate_series(1, 4) n), 'empire', emp),
    'seed', public.clan_offer_seed(pg_temp.id(who)), 'day', 15, 'createdNzDay', 19000, 'fightsLeft', 8, 'fightNo', 0, 'raidNo', raid_no,
    'examined', '[]'::jsonb, 'fight', null)
$$;
create function pg_temp.save(who text, version integer, request integer, state jsonb, result jsonb default '{"type":"test"}') returns jsonb language sql as $$
  select public.save_clan(pg_temp.id(who), version, pg_temp.req(request), 'test', state, result)
$$;
create function pg_temp.version(who text) returns integer language sql as $$ select (public.load_clan(pg_temp.id(who), pg_temp.req(900)) ->> 'version')::integer $$;
create function pg_temp.fame(who text) returns integer language sql as $$ select fame from public.clans where player = pg_temp.id(who) $$;
create function pg_temp.pts(who text) returns integer language sql as $$ select coalesce(sum(points), 0)::integer from public.scored_games where player = pg_temp.id(who) and game = 'clan-quest' $$;
create function pg_temp.has(who text, ach text) returns boolean language sql as $$ select exists (select 1 from public.achievements where player = pg_temp.id(who) and achievement = ach) $$;
-- Save as the server does, with the result carrying what was earned. The first argument is the person, then the version the save is made from.
create function pg_temp.earn(who text, version integer, request integer, earned jsonb, st jsonb default null) returns jsonb language sql as $$
  select pg_temp.save(who, version, request, jsonb_set(coalesce(st, pg_temp.state(who, 'Red Banner', pg_temp.empire(500, 10))), '{day}',
      to_jsonb(coalesce((select c.day from public.clans c where c.player = pg_temp.id(who)), 15))),
    jsonb_build_object('type', 'fightRound', 'over', true, 'earned', earned))
$$;
create function pg_temp.uid(i integer) returns uuid language sql as $$ select ('00000000-0000-0000-0001-' || lpad(i::text, 12, '0'))::uuid $$;
create function pg_temp.mkclan(i integer) returns jsonb language sql as $$
  select public.save_clan(pg_temp.uid(i), 0, pg_temp.req(1000 + i), 'test', jsonb_build_object(
    'clan', jsonb_build_object('name', 'Clan ' || chr(64 + i), 'gold', 200, 'followers', 5,
      'village', jsonb_build_object('trainingHall', 0, 'smithy', 0, 'church', 0), 'wakesToday', 0,
      'members', (select jsonb_agg(pg_temp.member(n)) from generate_series(1, 4) n), 'empire', pg_temp.empire(100, 10)),
    'seed', public.clan_offer_seed(pg_temp.uid(i)), 'day', 15, 'createdNzDay', 19000, 'fightsLeft', 8, 'fightNo', 0, 'raidNo', 0,
    'examined', '[]'::jsonb, 'fight', null), '{"type":"create"}')
$$;
create function pg_temp.level_state(who text, lvl integer, emp jsonb default null) returns jsonb language sql as $$
  select jsonb_set(pg_temp.state(who, 'Red Banner', coalesce(emp, pg_temp.empire(500, 10))), '{clan,members,0,level}', to_jsonb(lvl))
$$;

-- ---- Students can't reach any of it ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.clan_scores $$, '42501', null, 'students cannot read the clan scores');
select throws_ok($$ select public.clan_apply_earned(pg_temp.id('a'), '{"wins":50}') $$, '42501', null, 'students cannot give themselves fame');
select throws_ok($$ select public.clan_village_reward(1, 1) $$, '42501', null, 'students cannot call the village reward');
select throws_ok($$ select public.clan_extras(pg_temp.id('a')) $$, '42501', null, 'students cannot call the server''s extras');
select throws_ok($$ update public.clans set fame = 99999 $$, '42501', null, 'students cannot write fame');
select throws_ok($$ select public.teacher_set_clan_maths('{"yearBand":6}') $$, '42501', null, 'students cannot change the maths settings');
select throws_ok($$ select public.teacher_clans_new_season('NEW SEASON') $$, '42501', null, 'students cannot start a new season');
select throws_ok($$ select public.teacher_clan_maths_class() $$, '42501', null, 'students cannot read the class''s maths records');
select throws_ok($$ select public.teacher_clan_maths_student(pg_temp.id('a')) $$, '42501', null, 'students cannot read a pupil''s maths records');
select pg_temp.reset();

-- ---- Settings ----
create function pg_temp.cs() returns jsonb language sql security definer as $$ select public.clans_settings() $$;
create function pg_temp.rules() returns jsonb language sql security definer as $$ select public.clan_reward_rules() $$;
create function pg_temp.fpd() returns integer language sql security definer as $$ select public.clan_fights_per_day() $$;
select is(pg_temp.cs(), '{"season": 1, "yearBand": 5, "fightsPerDay": 8, "enabledTables": [2,3,4,5,6,7,8,9,10], "enabledTopics": ["percentages","money","area","division","ratios","rates"]}'::jsonb,
  'the settings start as the Year 5 defaults, 8 fights a day, season 1');
select is(pg_temp.fpd(), 8, 'the night''s rest gives back 8 fights by default');
select pg_temp.teacher();
select is(public.teacher_set_clan_maths('{"yearBand": 6, "fightsPerDay": 5}') ->> 'yearBand', '6', 'a teacher sets the year band');
select is(pg_temp.cs() ->> 'fightsPerDay', '5', '... and the fights a day');
select is(pg_temp.cs() -> 'enabledTopics', '["percentages","money","area","division","ratios","rates"]'::jsonb, '... and leaving a key out keeps it');
select is(public.teacher_set_clan_maths('{"enabledTopics": ["times","integers"], "enabledTables": [12, 3, 3]}') -> 'enabledTopics', '["integers","times"]'::jsonb, 'topics can be switched');
select is(pg_temp.cs() -> 'enabledTables', '[3,12]'::jsonb, '... and times tables (sorted, no repeats)');
select throws_ok($$ select public.teacher_set_clan_maths('{"yearBand": 7}') $$, '22023', null, 'there is no year 7 band');
select throws_ok($$ select public.teacher_set_clan_maths('{"enabledTopics": []}') $$, '22023', null, 'at least one topic stays on');
select throws_ok($$ select public.teacher_set_clan_maths('{"enabledTopics": ["magic"]}') $$, '22023', null, 'a topic must be one of the eight');
select throws_ok($$ select public.teacher_set_clan_maths('{"enabledTables": []}') $$, '22023', null, 'at least one times table stays on');
select throws_ok($$ select public.teacher_set_clan_maths('{"enabledTables": [13]}') $$, '22023', null, 'times tables are 1 to 12');
select throws_ok($$ select public.teacher_set_clan_maths('{"fightsPerDay": 0}') $$, '22023', null, 'at least one fight a day');
select throws_ok($$ select public.teacher_set_clan_maths('{"fightsPerDay": 31}') $$, '22023', null, '... and at most 30');
select throws_ok($$ select public.teacher_set_clan_maths('{"fightsPerDay": 2.5}') $$, '22023', null, '... in whole fights');
select throws_ok($$ select public.teacher_set_clan_maths('[]') $$, '22023', null, 'settings must be an object');
select pg_temp.reset();
select is(pg_temp.fpd(), 5, 'the night''s rest follows the teacher''s fights a day');
select is(public.clan_extras(pg_temp.id('a')) -> 'settings' ->> 'yearBand', '6', 'the server is handed the settings with the clan');
update public.app_settings set clans_year_band = 5, clans_topics = '{percentages,money,area,division,ratios,rates}', clans_tables = '{2,3,4,5,6,7,8,9,10}', clans_fights_per_day = 8;

-- ---- Fame, once ----
select is(pg_temp.save('a', 0, 1, pg_temp.state('a', 'Red Banner', pg_temp.empire(500, 10))) ->> 'status', 'saved', 'a clan is saved');
select pg_temp.save('b', 0, 2, pg_temp.state('b', 'Blue Fox', pg_temp.empire(500, 10)));
select pg_temp.save('c', 0, 3, pg_temp.state('c', 'Green Owl', pg_temp.empire(500, 10)));
select pg_temp.save('d', 0, 4, pg_temp.state('d', 'Gold Hawk', pg_temp.empire(500, 10)));
select is(pg_temp.fame('a'), 0, 'a new clan has no fame');
select is(pg_temp.earn('a', 1, 10, '{"wins":1}') ->> 'status', 'saved', 'a won fight is saved');
select is(pg_temp.fame('a'), 1, '... and earns 1 fame');
select is(pg_temp.earn('a', 1, 10, '{"wins":1}') ->> 'status', 'duplicate', 'the same fight sent twice');
select is(pg_temp.fame('a'), 1, '... earns nothing more');
select is(pg_temp.earn('a', 1, 11, '{"wins":1}') ->> 'status', 'stale', 'a save made from an old copy of the clan');
select is(pg_temp.fame('a'), 1, '... earns nothing');
select is(pg_temp.pts('a'), 0, 'no points yet: the 3rd win makes one');
select pg_temp.earn('a', 2, 12, '{"wins":1}');
select is(pg_temp.pts('a'), 0, 'two wins make no point');
select pg_temp.earn('a', 3, 13, '{"wins":1}');
select is(pg_temp.fame('a'), 3, 'three wins are 3 fame');
select is(pg_temp.pts('a'), 1, '... and the third makes 1 point');
select is((select wins_pending from public.clans where player = pg_temp.id('a')), 0, '... with none left waiting');
select pg_temp.earn('a', 4, 14, '{"wins":2}');
select is((select wins_pending from public.clans where player = pg_temp.id('a')), 2, 'two more wins wait for a point');
select pg_temp.earn('a', 5, 15, '{"bosses":1}');
select is(pg_temp.fame('a'), 10, 'a boss is 5 fame');
select is(pg_temp.pts('a'), 4, '... and 3 points, and does not touch the wins that were waiting');
select is((select wins_pending from public.clans where player = pg_temp.id('a')), 2, '... (still 2 waiting)');
select pg_temp.earn('a', 6, 16, '{"wars":1}');
select is(pg_temp.fame('a'), 12, 'a Friendly War win is 2 fame');
select is(pg_temp.pts('a'), 6, '... and 2 points');
select pg_temp.earn('a', 7, 17, '{"kingdomRaids":1}');
select pg_temp.earn('a', 8, 18, '{"classRaids":1}');
select is(pg_temp.fame('a'), 17, 'a raid on a kingdom is 2 fame and on a classmate 3');
select is(pg_temp.pts('a'), 6, '... and raids earn no points');
select pg_temp.earn('a', 9, 19, '{"cries":4}');
select is(pg_temp.fame('a'), 17, 'right Battle Cry answers earn no fame');
select is(pg_temp.pts('a'), 6, '... and no points');
select is(pg_temp.earn('a', 10, 20, null) ->> 'status', 'saved', 'a save that earned nothing');
select is(pg_temp.fame('a'), 17, '... changes nothing');
select is(pg_temp.save('a', 11, 21, pg_temp.state('a', 'Red Banner', pg_temp.empire(500, 10)), '{"type":"fightRound","over":true,"summary":{"result":"won"},"fame":999,"points":999}') ->> 'status', 'saved',
  'a result that claims its own fame');
select is(pg_temp.fame('a'), 17, '... is not believed (only the counts in "earned" are used)');
select is((select stats from public.clans where player = pg_temp.id('a')),
  '{"mineWins": 5, "bossWins": 1, "warWins": 1, "kingdomRaids": 1, "classRaids": 1, "cries": 4}'::jsonb, 'the lifetime counts add up');
select is(pg_temp.earn('a', 12, 22, '{"wins":-1}') ->> 'status', 'saved', 'a made-up negative count does not lose the save');
select is(pg_temp.fame('a'), 17, '... and fame never goes down');
select is(pg_temp.earn('a', 13, 23, '{"wins":500}') ->> 'status', 'saved', 'a made-up huge count does not lose the save either');
select is(pg_temp.fame('a'), 17, '... and gives nothing');
select throws_ok($$ update public.clans set fame = -1 where player = pg_temp.id('a') $$, '23514', null, 'fame can never be negative');

-- ---- The daily cap ----
select pg_temp.earn('d', 1, 30, '{"bosses":15}');
select is(pg_temp.pts('d'), 40, 'points stop at the 40-a-day cap (15 bosses would be 45)');
select pg_temp.earn('d', 2, 31, '{"wars":1}');
select is(pg_temp.pts('d'), 40, '... and the war that follows earns none');
select is(pg_temp.fame('d'), 77, '... but fame is not capped (15 bosses and a war: 75 + 2)');
select is((select sum(points_raw)::integer from public.clan_scores where player = pg_temp.id('d')), 47, 'what was earned is kept, even past the cap');

-- ---- Achievements ----
select ok(pg_temp.has('a', 'cq-first-win'), 'the first win is an achievement');
select ok(pg_temp.has('a', 'cq-first-boss') and pg_temp.has('a', 'cq-first-war'), '... and so are the first boss and the first Friendly War');
select ok(not pg_temp.has('a', 'cq-village') and not pg_temp.has('a', 'cq-level-10') and not pg_temp.has('a', 'cq-buildings-5') and not pg_temp.has('a', 'cq-cries-50'), 'the others are not given early');
select is((select count(*)::integer from public.achievements where player = pg_temp.id('a') and achievement like 'cq-%'), 3, 'each is given once');
select pg_temp.save('b', 1, 40, pg_temp.level_state('b', 10), '{"type":"fightRound","over":false}');
select ok(pg_temp.has('b', 'cq-level-10') and not pg_temp.has('b', 'cq-level-20'), 'a member at level 10 earns that, and not level 20, in a save that earned nothing');
select pg_temp.save('b', 2, 41, pg_temp.level_state('b', 20), '{"type":"fightRound","over":false}');
select ok(pg_temp.has('b', 'cq-level-20'), '... and level 20 later');
select pg_temp.save('c', 1, 42, pg_temp.state('c', 'Green Owl', pg_temp.empire(500, 10, 4)), '{"type":"build"}');
select ok(not pg_temp.has('c', 'cq-buildings-5'), 'four buildings are not five');
select pg_temp.save('c', 2, 43, pg_temp.state('c', 'Green Owl', pg_temp.empire(500, 10, 5)), '{"type":"build"}');
select ok(pg_temp.has('c', 'cq-buildings-5'), 'five buildings are');
select pg_temp.earn('c', 3, 44, '{"cries":49}', pg_temp.state('c', 'Green Owl', pg_temp.empire(500, 10, 5)));
select ok(not pg_temp.has('c', 'cq-cries-50'), '49 right answers are not 50');
select pg_temp.earn('c', 4, 45, '{"cries":1}', pg_temp.state('c', 'Green Owl', pg_temp.empire(500, 10, 5)));
select ok(pg_temp.has('c', 'cq-cries-50'), '50 are');
select is(public.points_total(pg_temp.id('c')), 20, 'each achievement is worth 10 points on top (2 earned, no game points)');
select is(public.clan_extras(pg_temp.id('c')) -> 'achievements', '["cq-buildings-5","cq-cries-50"]'::jsonb, 'the server is handed the ids earned');
select is(public.clan_extras(pg_temp.id('c')) ->> 'fame', '0', '... and the fame');

-- ---- The class village rewards everyone who voted ----
create function pg_temp.monday() returns integer language sql as $$ select public.clan_nz_week() * 7 - 3 $$;
update public.clan_villages set chest = 1000 where id = 1;
update public.clans set fame = 0;
delete from public.clan_scores;
delete from public.achievements where achievement = 'cq-village';
insert into public.clan_votes (village_id, week, player, kind) values
  (1, public.clan_nz_week(), pg_temp.id('a'), 'smithy'), (1, public.clan_nz_week(), pg_temp.id('b'), 'church');
select public.clan_nightly(pg_temp.monday() + 6);
select is((public.clan_nightly(pg_temp.monday() + 7) ->> 'villagesClosed')::integer, 1, 'the week closes');
select is((select levels ->> 'smithy' from public.clan_villages where id = 1), '1', '... and the Smithy was built');
select is(pg_temp.fame('a'), 10, 'a pupil who voted for it gets 10 fame');
select is(pg_temp.fame('b'), 10, '... and so does one who voted for something else (they took part)');
select is(pg_temp.fame('c'), 0, 'a pupil who did not vote gets nothing');
select is(pg_temp.pts('a'), 5, '... the voters get 5 points');
select is(pg_temp.pts('c'), 0, '... and the others none');
select ok(pg_temp.has('a', 'cq-village') and pg_temp.has('b', 'cq-village') and not pg_temp.has('c', 'cq-village'), '... and the Village builders achievement');
select is((select (stats ->> 'villageBuilt')::integer from public.clans where player = pg_temp.id('a')), 1, 'the lifetime count goes up');
select public.clan_nightly(pg_temp.monday() + 8);
select public.clan_nightly(pg_temp.monday() + 9);
select is(pg_temp.fame('a'), 10, 'later nights do not pay the same week again');
select is(pg_temp.pts('a'), 5, '... in points either');
update public.clan_villages set chest = 10 where id = 1;
insert into public.clan_votes (village_id, week, player, kind) values (1, public.clan_nz_week() + 1, pg_temp.id('a'), 'church');
select public.clan_nightly(pg_temp.monday() + 14);
select is(pg_temp.fame('a'), 10, 'a chest too small to build pays nothing');

-- ---- The scoreboard ----
do $$ begin
  for i in 1..12 loop
    insert into auth.users (id, email) values (pg_temp.uid(i), 'p' || lpad(i::text, 2, '0') || '@douglaspark.school.nz');
    perform pg_temp.mkclan(i);
  end loop;
end $$;
update public.clans set fame = 0;
update public.clans c set fame = i * 10 from (select pg_temp.uid(n) as u, n as i from generate_series(1, 12) n) t where c.player = t.u;
select pg_temp.act_as(pg_temp.uid(12)::text, 'p12@douglaspark.school.nz');
select is((select count(*)::integer from public.clan_scoreboard()), 10, 'the top clan sees ten clans');
select is((select clan_name from public.clan_scoreboard() where place = 1), 'Clan L', '... the leader first');
select is((select count(*)::integer from public.clan_scoreboard() where is_me), 1, '... and itself marked');
select pg_temp.act_as(pg_temp.uid(1)::text, 'p01@douglaspark.school.nz');
select is((select count(*)::integer from public.clan_scoreboard()), 11, 'a clan outside the top ten sees ten and itself');
select is((select place from public.clan_scoreboard() where is_me), 12, '... at its real place');
select is((select fame from public.clan_scoreboard() where is_me), 10, '... with its fame');
select is((select array_agg(clan_name order by place) from public.clan_scoreboard() where place <= 3), array['Clan L', 'Clan K', 'Clan J'], 'places go by fame');
select pg_temp.reset();
update public.clans set fame = 120 where player = pg_temp.uid(11);
select pg_temp.act_as(pg_temp.uid(1)::text, 'p01@douglaspark.school.nz');
select is((select array_agg(place order by place, clan_name) from public.clan_scoreboard() where place <= 3), array[1, 1, 3], 'a tie shares a place and the next place is skipped');
select pg_temp.reset();
update public.profiles set hidden = true where id = pg_temp.uid(12);
select pg_temp.act_as(pg_temp.uid(1)::text, 'p01@douglaspark.school.nz');
select is((select count(*)::integer from public.clan_scoreboard() where clan_name = 'Clan L'), 0, 'a hidden profile''s clan is left off');
select pg_temp.reset();
update public.profiles set hidden = false where id = pg_temp.uid(12);
update public.clans set fame = 0 where player = pg_temp.id('a');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is((select fame from public.clan_scoreboard() where is_me), 0, 'your own clan is shown even with no fame');
select is((select count(*)::integer from public.clan_scoreboard() where clan_name = 'Blue Fox'), 0, '... but other clans with no fame are not');
select is(pg_get_function_result('public.clan_scoreboard'::regproc), 'TABLE(place integer, clan_name text, fame integer, is_me boolean)', 'the scoreboard can only give a place, a clan name, fame and "is me"');
select pg_temp.reset();
select is((select count(*)::integer from pg_proc p where p.proname = 'clan_scoreboard' and prosrc ~* '(display_name|email|avatar|real_name|level)'), 0, '... and its code never looks at a pupil''s name, email, picture or level');

-- ---- A new fame season ----
update public.clans set fame = 40 where player in (pg_temp.id('a'), pg_temp.id('b'));
select pg_temp.teacher();
select throws_ok($$ select public.teacher_clans_new_season('yes') $$, '22023', null, 'a new season must be confirmed by typing NEW SEASON');
select pg_temp.reset();
select is(pg_temp.fame('b'), 40, '... and nothing changed');
select pg_temp.teacher();
select is(public.teacher_clans_new_season('NEW SEASON') ->> 'season', '2', 'a teacher starts season 2');
select pg_temp.reset();
select is((select max(fame) from public.clans), 0, 'every clan''s fame is 0');
select is((select count(*)::integer from public.clans), 16, '... and every clan is still there');
select ok((select count(*) from public.achievements where achievement like 'cq-%') > 0 and pg_temp.has('a', 'cq-first-win'), '... and achievements are kept');
select is((select count(*)::integer from public.clan_members where player = pg_temp.id('a')), 4, '... and members, gold and the rest');
select is(public.clan_extras(pg_temp.id('a')) -> 'settings' ->> 'season', '2', 'the server is told the season');
select pg_temp.earn('a', pg_temp.version('a'), 60, '{"bosses":1}');
select is(pg_temp.fame('a'), 5, 'fame starts again from 0');

-- ---- The school-wide new points season ----
select ok((select count(*) from public.clan_scores) > 0, 'there are scores to clear');
update public.clans set wins_pending = 2 where player = pg_temp.id('a');
select pg_temp.teacher();
select public.teacher_new_season('NEW SEASON');
select pg_temp.reset();
select is((select count(*)::integer from public.clan_scores), 0, 'a new points season clears Clan Quest''s points');
select is((select wins_pending from public.clans where player = pg_temp.id('a')), 0, '... and the wins waiting for a point');
select is(pg_temp.fame('a'), 5, '... but not fame');
select ok(pg_temp.has('a', 'cq-first-boss'), '... or achievements');

-- ---- Rebuilding the points ----
select pg_temp.earn('a', pg_temp.version('a'), 61, '{"bosses":2}');
select is(pg_temp.pts('a'), 6, 'two bosses are 6 points');
select public.rebuild_progress();
select is(pg_temp.pts('a'), 6, 'rebuilding the points from the scores gives the same');

-- ---- The rules the browser reads ----
update public.app_settings set clans_enabled = false;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(public.progress_rules() -> 'clanQuest', 'null'::jsonb, 'while Clan Quest is off the rules are hidden');
select is((select count(*)::integer from jsonb_array_elements(public.my_progress() -> 'achievements') a where a ->> 'game' = 'clan-quest'), 0, '... and so are its achievements');
select pg_temp.reset();
update public.app_settings set clans_enabled = true;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(public.progress_rules() -> 'clanQuest', pg_temp.rules(), 'switched on, the rules are shown');
select is((select count(*)::integer from jsonb_array_elements(public.my_progress() -> 'achievements') a where a ->> 'game' = 'clan-quest'), 8, '... and the eight achievements');
select is((select count(*)::integer from jsonb_array_elements(public.my_progress() -> 'achievements') a where a ->> 'game' = 'clan-quest' and a ->> 'earnedAt' is not null), 4, '... with the earned ones marked (first win, boss, war, village)');
select pg_temp.reset();

-- ---- The teacher's private maths records ----
select is(public.record_fact_answers(pg_temp.id('a'), 'clan-quest', pg_temp.req(70),
  '[{"key":"clan:y5:percent-of","correct":true,"ms":60000,"at":1800000000000},{"key":"clan:y5:percent-of","correct":false,"ms":60000,"at":1800000001000},{"key":"clan:y5:quest-pattern","correct":true,"ms":60000,"at":1800000002000}]'::jsonb, 3000, 5, 4),
  3, 'answers go in the pack clan-quest, keyed by the kind and the year band');
select is(public.record_fact_answers(pg_temp.id('a'), 'clan-quest', pg_temp.req(70), '[{"key":"clan:y5:percent-of","correct":true,"ms":60000,"at":1800000000000}]'::jsonb, 3000, 5, 4),
  0, 'the same batch sent again counts once');
select ok((select max(box) from public.gem_keep_facts where player = pg_temp.id('a') and pack = 'clan-quest') <= 1, 'untimed answers never move a question toward "fluent"');
select public.record_fact_answers(pg_temp.id('a'), 'clan-quest', pg_temp.req(71), '[{"key":"clan:y5:ratio","correct":true,"ms":60000,"at":1800000003000},{"key":"clan:y5:ratio","correct":false,"ms":60000,"at":1800000004000},{"key":"clan:y5:ratio","correct":false,"ms":60000,"at":1800000005000}]'::jsonb, 3000, 5, 4);
select public.record_fact_answers(pg_temp.id('b'), 'clan-quest', pg_temp.req(72), '[{"key":"clan:y5:ratio","correct":false,"ms":60000,"at":1800000006000},{"key":"clan:y5:ratio","correct":false,"ms":60000,"at":1800000007000},{"key":"clan:y5:ratio","correct":false,"ms":60000,"at":1800000008000}]'::jsonb, 3000, 5, 4);
select pg_temp.teacher();
select is(public.teacher_clan_maths_student(pg_temp.id('a')) -> 'kinds' -> 0 ->> 'key', 'clan:y5:ratio', 'a teacher sees a pupil''s hardest kind first');
select is((public.teacher_clan_maths_student(pg_temp.id('a')) -> 'kinds' -> 1 ->> 'attempts')::integer, 2, '... with how often it was tried');
select is((public.teacher_clan_maths_class() ->> 'players')::integer, 2, 'the class view counts the pupils who answered');
select is(public.teacher_clan_maths_class() -> 'hardest' -> 0 ->> 'key', 'clan:y5:ratio', '... and lists the kinds most often wrong (6 tries, 2 pupils)');
select is((public.teacher_clan_maths_class() -> 'hardest' -> 0 ->> 'correct')::integer, 1, '... with how many were right');
select is(public.teacher_clan_maths_class()::text ~* '(ana|ben|cai|dee|douglaspark|@)', false, 'the class view has no pupil names');
select pg_temp.reset();

select * from finish();
rollback;
