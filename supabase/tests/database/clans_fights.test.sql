-- Clan Quest stage C.5 part B: the fight kept on the server, the class switch and the midnight job.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(78);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cai@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000e';

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
create function pg_temp.req(n integer) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;

-- A clan the way the server function saves one. `hurt`: members knocked out, with the day's chores half done.
create function pg_temp.member(n integer, hurt boolean default false) returns jsonb language sql as $$
  select jsonb_build_object('name', 'Member' || n, 'race', 'Human', 'cls', 'Warrior', 'level', 2, 'xp', 40,
    'hp', case when hurt then 0 else 20 end, 'maxHp', 20, 'sp', case when hurt then 1 else 5 end, 'maxSp', 5,
    'stats', jsonb_build_object('agility', 8), 'spells', '[]'::jsonb, 'gear', '{}'::jsonb, 'points', 3, 'knockedOut', hurt)
$$;
create function pg_temp.state(who text, day integer default 1, hurt boolean default false, fight jsonb default null, fight_no integer default 0, created integer default 20000)
returns jsonb language sql as $$
  select jsonb_build_object(
    'clan', jsonb_build_object('name', 'Red Banner', 'gold', 200, 'followers', 5,
      'village', jsonb_build_object('trainingHall', 0, 'smithy', 0, 'church', 0), 'wakesToday', case when hurt then 2 else 0 end,
      'members', (select jsonb_agg(pg_temp.member(n, hurt)) from generate_series(1, 4) n),
      'empire', jsonb_build_object('vault', 9, 'wild', 10, 'plots', '[]'::jsonb, 'day', day, 'energyUsed', case when hurt then 50 else 0 end,
        'raidsToday', case when hurt then 1 else 0 end, 'kingdomRaidsToday', case when hurt then 1 else 0 end,
        'raidedToday', case when hurt then '["x"]'::jsonb else '[]'::jsonb end, 'shieldUntil', 0)),
    'seed', public.clan_offer_seed(pg_temp.id(who)), 'day', day, 'createdNzDay', created, 'fightsLeft', case when hurt then 3 else 8 end,
    'fightNo', fight_no, 'raidNo', 0, 'examined', '[]'::jsonb, 'fight', fight)
$$;
create function pg_temp.save(who text, version integer, request integer, state jsonb, result jsonb default '{"type":"test"}') returns jsonb language sql as $$
  select public.save_clan(pg_temp.id(who), version, pg_temp.req(request), 'test', state, result)
$$;
create function pg_temp.fight(no integer, rounds jsonb default '[]', depth integer default 2) returns jsonb language sql as $$
  select jsonb_build_object('depth', depth, 'boss', false, 'seed', -123456, 'no', no,
    'settings', jsonb_build_object('enabledTopics', '["times"]'::jsonb, 'yearBand', 5), 'rounds', rounds)
$$;
create function pg_temp.round(guard boolean default true) returns jsonb language sql as $$
  select jsonb_build_object('orders', '[{"action":"guard"},null,{"action":"attack","target":1}]'::jsonb, 'cry', '{"answer":7,"reward":"damage"}'::jsonb)
$$;

-- ---- Students can't reach the new tables or functions ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.clan_fights $$, '42501', null, 'students cannot read open fights');
select throws_ok($$ select * from public.clan_news $$, '42501', null, 'students cannot read the news table');
select throws_ok($$ select * from public.clan_fight_log $$, '42501', null, 'students cannot read the fight log');
select throws_ok($$ select * from public.clan_daily_runs $$, '42501', null, 'students cannot read the midnight job''s record');
select throws_ok($$ insert into public.clan_news (nz_date, text) values (current_date, 'Ana is the best') $$, '42501', null, 'students cannot write news');
select throws_ok($$ select public.clan_nightly() $$, '42501', null, 'students cannot run the midnight job');
select throws_ok($$ select public.teacher_set_clans(true) $$, '42501', null, 'students cannot switch Clan Quest on');
select throws_ok($$ select public.teacher_clan_info(pg_temp.id('b')) $$, '42501', null, 'students cannot look at a clan through the teacher function');
select ok((select clans_enabled from public.app_settings) is false, 'Clan Quest is off until a teacher turns it on (and a student can read the setting)');
select pg_temp.reset();

-- ---- The class switch ----
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(1)) ->> 'enabled', 'false', 'a student is told Clan Quest is off');
select is(public.load_clan(pg_temp.id('e'), pg_temp.req(1)) ->> 'enabled', 'true', '... but a teacher can always try it');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select is(public.teacher_set_clans(true), true, 'a teacher can switch it on');
select throws_ok($$ select public.teacher_set_clans(null) $$, '22023', null, '... but not to nothing');
select pg_temp.reset();
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(1)) ->> 'enabled', 'true', 'a student is told it is on');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select public.teacher_set_clans(false);
select pg_temp.reset();
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(1)) ->> 'enabled', 'false', '... and off again');

-- ---- A fight is kept, round by round ----
select is(pg_temp.save('a', 0, 1, pg_temp.state('a')) ->> 'status', 'saved', 'a clan is saved');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(2)) -> 'state' -> 'fight', 'null'::jsonb, 'with no fight open');
select is(pg_temp.save('a', 1, 2, pg_temp.state('a', 1, false, pg_temp.fight(1), 1)) ->> 'status', 'saved', 'a fight is started');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(3)) -> 'state' -> 'fight' ->> 'seed', '-123456', 'the open fight comes back (the seed can be negative)');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(3)) -> 'state' ->> 'fightNo', '1', '... with the fight counted');
select is(jsonb_array_length(public.load_clan(pg_temp.id('a'), pg_temp.req(3)) -> 'state' -> 'fight' -> 'rounds'), 0, '... and no rounds yet');
select is(pg_temp.save('a', 2, 3, pg_temp.state('a', 1, false, pg_temp.fight(1, jsonb_build_array(pg_temp.round())), 1)) ->> 'status', 'saved', 'a round is kept');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(4)) -> 'state' -> 'fight' -> 'rounds' -> 0 -> 'orders' -> 1, 'null'::jsonb,
  'an empty order comes back as an empty order (the null is kept)');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(4)) -> 'state' -> 'fight' -> 'rounds' -> 0 -> 'cry' ->> 'answer', '7', '... and so does the Battle Cry answer');
select is((select count(*)::integer from public.clan_fights where player = pg_temp.id('a')), 1, 'only one fight is ever open for a clan');
select is(pg_temp.save('a', 3, 4, pg_temp.state('a', 1, false, pg_temp.fight(1, jsonb_build_array(pg_temp.round(), pg_temp.round())), 1)) ->> 'status', 'saved',
  'another round is kept (still one row)');
select is((select count(*)::integer from public.clan_fights where player = pg_temp.id('a')), 1, '... still one row');

-- ---- The database refuses a fight that makes no sense ----
select throws_ok($$ select pg_temp.save('a', 4, 5, pg_temp.state('a', 1, false, pg_temp.fight(1, (select jsonb_agg(pg_temp.round()) from generate_series(1, 9))), 1)) $$,
  '23514', null, 'a fight has at most 8 rounds');
select throws_ok($$ select pg_temp.save('a', 4, 6, pg_temp.state('a', 1, false, pg_temp.fight(1, '[]', 21), 1)) $$, '23514', null, 'a mine only goes 20 deep');
select throws_ok($$ select pg_temp.save('a', 4, 7, pg_temp.state('a', 1, false, pg_temp.fight(2), 1)) $$, '22023', null, 'a fight cannot be ahead of the clan''s fight count');
select throws_ok($$ select pg_temp.save('a', 4, 8, pg_temp.state('a', 1, false, pg_temp.fight(1), 0)) $$, '22023', null, 'the fight count only goes forwards');
select throws_ok($$ select pg_temp.save('a', 4, 9, pg_temp.state('a', 1, false, '"won"'::jsonb, 1)) $$, '22023', null, 'a fight must be an object');
select throws_ok($$ select pg_temp.save('b', 0, 10, pg_temp.state('b', 1, false, pg_temp.fight(1), 1)) $$, '22023', null, 'a brand-new clan cannot arrive with a fight open');
select is((select jsonb_array_length(rounds) from public.clan_fights where player = pg_temp.id('a')), 2, 'a refused save leaves the fight as it was');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(99)) ->> 'version', '4', '... and the version');

-- ---- Closing the fight pays once and leaves a log line with no name on it ----
select is(pg_temp.save('a', 4, 11, pg_temp.state('a', 1, false, null, 1), '{"type":"fightRound","over":false,"summary":null}') ->> 'status', 'saved', 'a fight can be closed');
select is((select count(*)::integer from public.clan_fights where player = pg_temp.id('a')), 0, '... and the row goes');
select is((select count(*)::integer from public.clan_fight_log), 0, 'a fight closed without being won, lost or fled leaves no log line');
select pg_temp.save('a', 5, 12, pg_temp.state('a', 1, false, pg_temp.fight(2), 2));
select is(pg_temp.save('a', 6, 13, pg_temp.state('a', 1, false, null, 2), '{"type":"fightRound","over":true,"summary":{"result":"won"}}') ->> 'status', 'saved',
  'a fight that ends is closed');
select is((select count(*)::integer from public.clan_fight_log where result = 'won' and depth = 2 and not boss), 1, '... and one line goes in the log');
select is(pg_temp.save('a', 6, 13, pg_temp.state('a', 1, false, null, 2), '{"type":"fightRound","over":true,"summary":{"result":"won"}}') ->> 'status', 'duplicate',
  'the same request again is spotted and logs nothing more');
select is((select count(*)::integer from public.clan_fight_log), 1, '... still one line');
select is((select count(*)::integer from information_schema.columns where table_schema = 'public' and table_name in ('clan_fight_log', 'clan_news')
  and column_name in ('player', 'student', 'user_id', 'clan', 'name')), 0, 'the log and the news have no place for a student''s id or name');

-- ---- A teacher's reset takes the open fight with it ----
select pg_temp.save('b', 0, 20, pg_temp.state('b'));
select pg_temp.save('b', 1, 21, pg_temp.state('b', 1, false, pg_temp.fight(1), 1));
select is((select count(*)::integer from public.clan_fights where player = pg_temp.id('b')), 1, 'another clan has a fight open');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
select is((public.teacher_clan_info(pg_temp.id('b')) ->> 'inFight')::boolean, true, 'the teacher can see a clan is in a fight');
select is(public.teacher_clan_info(pg_temp.id('b')) ->> 'name', 'Red Banner', '... and its name');
select is(public.teacher_clan_info(pg_temp.id('c')), null, '... and that a student with no clan has none');
select is(public.teacher_reset_clan(pg_temp.id('b')), true, 'a teacher can reset it');
select pg_temp.reset();
select is((select count(*)::integer from public.clan_fights where player = pg_temp.id('b')), 0, '... and the open fight goes too');

-- ---- The midnight job ----
select is(public.clan_fights_per_day(), 8, 'the job gives 8 fights a day (a test in the code checks this matches the game''s setting)');
select is(public.clan_nz_day('2026-10-18 10:59:59+00'), public.clan_nz_day('2026-10-18 05:00:00+00'), 'New Zealand''s day is still the same just before its midnight (summer time)');
select is(public.clan_nz_day('2026-10-18 11:00:00+00'), public.clan_nz_day('2026-10-18 05:00:00+00') + 1, '... and is the next day from midnight');
select is(public.clan_nz_day('2026-10-18 05:00:00+00'), ('2026-10-18'::date - date '1970-01-01'), '... counted in days since 1970');
select ok(exists (select 1 from cron.job where jobname = 'clans-midnight-summer' and schedule = '0 11 * * *'), 'the job is scheduled for midnight in summer time');
select ok(exists (select 1 from cron.job where jobname = 'clans-midnight-winter' and schedule = '0 12 * * *'), '... and for midnight in winter time');

-- a: hurt and tired on day 1, c: already on day 4, b: in a fight on day 1
select pg_temp.save('a', 6, 30, pg_temp.state('a', 1, true));
select pg_temp.save('b', 0, 31, pg_temp.state('b', 1, true));
select pg_temp.save('b', 1, 32, pg_temp.state('b', 1, true, pg_temp.fight(1), 1));
select pg_temp.save('c', 0, 33, pg_temp.state('c', 4, true));
insert into public.clan_fight_log (nz_date, depth, boss, result) values
  (date '1970-01-01' + 20002, 3, false, 'won'), (date '1970-01-01' + 20002, 4, false, 'won'), (date '1970-01-01' + 20002, 5, true, 'won'),
  (date '1970-01-01' + 20002, 6, false, 'lost'), (date '1970-01-01' + 20002, 9, true, 'lost'), (date '1970-01-01' + 19000, 1, false, 'won');
insert into public.clan_news (nz_date, text) values (date '1970-01-01' + 19000, 'Very old news.');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(98)) ->> 'version', '7', 'clan a is at version 7 before the job');
select is(public.clan_nightly(20003), '{"ran": true, "day": 20003, "rested": 1}'::jsonb, 'the job rests the one clan that nobody touched today');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(98)) -> 'state' ->> 'day', '4', 'it moves the clan to today''s day number (20003 - 20000 + 1)');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(98)) -> 'state' ->> 'fightsLeft', '8', '... gives the fights back');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(98)) -> 'state' -> 'clan' ->> 'wakesToday', '0', '... and the free Church wake-up');
select is((select count(*)::integer from jsonb_array_elements(public.load_clan(pg_temp.id('a'), pg_temp.req(98)) -> 'state' -> 'clan' -> 'members') m
  where (m ->> 'knockedOut')::boolean is false and m ->> 'hp' = '20' and m ->> 'sp' = '5'), 4, '... wakes and heals everyone (hp and sp back to the top)');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(98)) -> 'state' -> 'clan' -> 'empire',
  '{"vault": 9, "wild": 10, "plots": [], "day": 4, "energyUsed": 0, "raidsToday": 0, "kingdomRaidsToday": 0, "raidedToday": [], "shieldUntil": 0}'::jsonb,
  '... resets the empire''s energy and raids and moves its day (and touches nothing else)');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(98)) ->> 'version', '8', '... and the version goes up, so a request made from the old copy is refused');
select is(pg_temp.save('a', 7, 34, pg_temp.state('a', 4, true)) ->> 'status', 'stale', 'a save made before the job cannot undo it');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(98)) -> 'state' -> 'clan' ->> 'gold', '200', 'gold and the rest are as they were');
select is(public.load_clan(pg_temp.id('b'), pg_temp.req(98)) -> 'state' ->> 'day', '1', 'a clan in the middle of a fight is left alone (it rests when its fight is over)');
select is(public.load_clan(pg_temp.id('c'), pg_temp.req(98)) ->> 'version', '1', 'a clan already on today''s day is not touched, so no clan is rested twice');
select is(public.clan_nightly(20003), '{"ran": false, "day": 20003}'::jsonb, 'the second run of the night finds the day done');
select is(public.load_clan(pg_temp.id('a'), pg_temp.req(98)) ->> 'version', '8', '... and rests nobody again');
select is(public.clan_nightly(20004) ->> 'rested', '2', 'the next night rests every clan that is not in a fight again (a and c; b is still fighting)') ;

-- the news
select is((select count(*)::integer from public.clan_news where nz_date = date '1970-01-01' + 20002), 2, 'the job wrote the news for the day before: 2 lines');
select ok(exists (select 1 from public.clan_news where text = '3 fights were won in the Mines yesterday.'), '... a count of fights won');
select ok(exists (select 1 from public.clan_news where text like 'A boss deep in the Mines (level 5)%'), '... and the boss that fell (only won boss fights)');
select ok(not exists (select 1 from public.clan_news where text like '%level 9%'), '... not the boss that won');
select ok(not exists (select 1 from public.clan_news where text ~* '(member|red banner|ana|ben|cai)'), 'no line has a name in it');
select is(jsonb_array_length(public.load_clan(pg_temp.id('c'), pg_temp.req(97)) -> 'news'), 2, 'the news comes with the clan, newest first');
select is((select count(*)::integer from public.clan_news where text = 'Very old news.'), 0, 'old news is tidied away');
select is((select count(*)::integer from public.clan_fight_log where nz_date < date '1970-01-01' + 19900), 0, '... and so are old fight log lines');

select * from finish();
rollback;
