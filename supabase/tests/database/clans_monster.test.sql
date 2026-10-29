-- Clan Quest's season monster (29 Oct 2026, migration 20261029000600): the first win of a season pays once (fame, points, news, Giant Slayer),
-- every try updates the Hall's tries, and a broken result never loses a save.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select setval(pg_get_serial_sequence('public.schools', 'id'), 1);
select setval(pg_get_serial_sequence('public.clan_villages', 'id'), 1);
select plan(60);

-- School 1 is Douglas Park (made by the migration). School 2 is made here.
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id) values ('otherschool.school.nz', 2);
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cai@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'dee@otherschool.school.nz');
update public.app_settings set clans_enabled = true;

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000000' || who)::uuid $$;
create function pg_temp.req(n integer) returns uuid language sql as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create function pg_temp.as_a() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz') $$;
create function pg_temp.as_d() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000d', 'dee@otherschool.school.nz') $$;

create function pg_temp.member(n integer) returns jsonb language sql as $$
  select jsonb_build_object('name', 'Member' || n, 'race', 'Human', 'cls', 'Warrior', 'level', 2, 'xp', 40, 'hp', 20, 'maxHp', 20, 'sp', 5, 'maxSp', 5,
    'stats', jsonb_build_object('agility', 8), 'spells', '[]'::jsonb, 'gear', '{}'::jsonb, 'points', 3, 'knockedOut', false)
$$;
create function pg_temp.empire(lv jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('version', 2,
    'levels', jsonb_build_object('trainingHall', 0, 'smithy', 0, 'church', 0, 'barracks', 0, 'walls', 0, 'tower', 0, 'forge', 0, 'strongroom', 0) || lv,
    'buildsToday', 0, 'troops', jsonb_build_object('footman', 40, 'axeman', 0, 'knight', 0), 'day', 15, 'createdDay', 1,
    'raidsToday', 0, 'kingdomRaidsToday', 0, 'shieldUntil', 0, 'raidedToday', '[]'::jsonb)
$$;
create function pg_temp.state(who text, clan_name text) returns jsonb language sql as $$
  select jsonb_build_object(
    'clan', jsonb_build_object('name', clan_name, 'gold', 200, 'followers', 5,
      'village', jsonb_build_object('trainingHall', 0, 'smithy', 0, 'church', 0), 'wakesToday', 0,
      'members', (select jsonb_agg(pg_temp.member(n)) from generate_series(1, 4) n), 'empire', pg_temp.empire()),
    'seed', public.clan_offer_seed(pg_temp.id(who)), 'day', 15, 'createdNzDay', 19000, 'fightsLeft', 8, 'fightNo', 0, 'raidNo', 0,
    'examined', '[]'::jsonb, 'fight', null)
$$;
create function pg_temp.save(who text, request integer, clan_name text) returns jsonb language sql as $$
  select public.save_clan(pg_temp.id(who), 0, pg_temp.req(request), 'test', pg_temp.state(who, clan_name), '{"type":"test"}')
$$;

-- Saves a finished request for this clan with this result (as the owner of the database, the way the server's save does), which fires the triggers.
create function pg_temp.result(who text, request integer, res jsonb) returns void language sql as $$
  insert into public.clan_requests (player, request_id, action, result) values (pg_temp.id($1), pg_temp.req($2), 'fightRound', $3)
$$;
create function pg_temp.mon(kind text, season integer, won boolean, first boolean, tries integer) returns jsonb language sql as $$
  select jsonb_build_object('type', 'fightRound', 'round', 7, 'over', true, 'summary', jsonb_build_object('result', case when $3 then 'won' else 'lost' end),
    'monster', jsonb_build_object('kind', $1, 'season', $2, 'won', $3, 'first', $4, 'tries', $5))
$$;
create function pg_temp.fame(who text) returns integer language sql as $$ select fame from public.clans where player = pg_temp.id(who) $$;
create function pg_temp.slain(who text) returns integer language sql as $$ select coalesce((stats ->> 'monsterSlain')::integer, 0) from public.clans where player = pg_temp.id(who) $$;
create function pg_temp.hall_rows(who text) returns integer language sql as $$ select count(*)::integer from public.clan_hall where player = pg_temp.id(who) $$;
create function pg_temp.tries(who text, s integer) returns integer language sql as $$ select monster_tries from public.clan_hall where player = pg_temp.id(who) and season = s $$;
create function pg_temp.monster_scores(who text) returns integer language sql as $$
  select count(*)::integer from public.clan_scores where player = pg_temp.id(who) and points_raw = 10 $$;
create function pg_temp.news(line text) returns integer language sql as $$ select count(*)::integer from public.clan_news where text = line $$;
create function pg_temp.slayer(who text) returns boolean language sql as $$
  select exists (select 1 from public.achievements where player = pg_temp.id(who) and achievement = 'cq-giant-slayer') $$;

-- ---- The rules and the achievement ----
select is(public.clan_season_rules() -> 'monsterReward', '{"fame":100,"points":10}'::jsonb, 'the monster reward is 100 fame and 10 points');
select is(public.clan_season_rules() -> 'villageReward', '{"fame":50,"points":10}'::jsonb, '... and the village reward is as it was');
select is(public.clan_season_rules() ->> 'monsterFrom', '29', '... and so is the rest');
select is((select name || '/' || emoji || '/' || measure || '/' || goal || '/' || sort from public.achievement_types where id = 'cq-giant-slayer'), 'Giant Slayer/🗡️/clan_monster/1/10',
  'Giant Slayer is a Clan Quest achievement');
select ok(exists (select 1 from public.achievement_measures where measure = 'clan_monster'), '... with its own measure');
select is((select game from public.achievement_types where id = 'cq-giant-slayer'), 'clan-quest', '... in Clan Quest');
select ok((select counts_fn = 'public.clan_quest_counts(uuid)'::regprocedure from public.hub_games where id = 'clan-quest'), 'Clan Quest counts it through the game hooks');

-- ---- The clans ----
select is(pg_temp.save('a', 1, 'Red Banner') ->> 'status', 'saved', 'ana''s clan is saved');
select pg_temp.save('b', 2, 'Blue Fox');
select is(public.clan_quest_counts(pg_temp.id('a')), '{"clan_monster":0}'::jsonb, 'nobody has beaten the monster yet');
select is(pg_temp.hall_rows('a'), 0, 'nothing is in the Hall yet');

-- ---- A result with no monster does nothing ----
select pg_temp.result('a', 10, '{"type":"fightRound","round":3,"over":true,"summary":{"result":"won"}}');
select is(pg_temp.hall_rows('a') + pg_temp.fame('a') + pg_temp.slain('a'), 0, 'a result without a monster changes nothing');
select pg_temp.result('a', 11, '{"type":"fightRound","monster":null}');
select is(pg_temp.hall_rows('a'), 0, '... nor does a monster that is null');

-- ---- A lost try only counts the try ----
select pg_temp.result('a', 12, pg_temp.mon('giant', 3, false, false, 1));
select is(pg_temp.tries('a', 3), 1, 'a lost try is one try in the Hall');
select is((select clan_name || '/' || school_id from public.clan_hall where player = pg_temp.id('a') and season = 3), 'Red Banner/1', '... with the clan''s name and school');
select ok((select monster_done_on is null from public.clan_hall where player = pg_temp.id('a') and season = 3), '... and no day for the monster');
select is(pg_temp.fame('a'), 0, '... and no fame');
select is(pg_temp.monster_scores('a'), 0, '... nor points');
select is(pg_temp.news('Red Banner beat Grimmor the Storm Giant!'), 0, '... nor news');
select ok(not pg_temp.slayer('a'), '... nor the achievement');
select pg_temp.result('a', 13, pg_temp.mon('giant', 3, false, false, 3));
select is(pg_temp.tries('a', 3), 3, 'a later lost try raises the tries');
select pg_temp.result('a', 14, pg_temp.mon('giant', 3, false, false, 2));
select is(pg_temp.tries('a', 3), 3, '... but never lowers them');

-- ---- The first win pays once ----
select pg_temp.result('a', 15, pg_temp.mon('giant', 3, true, true, 4));
select is(pg_temp.fame('a'), 100, 'the first win gives 100 fame');
select is(pg_temp.monster_scores('a'), 1, '... and one 10 point score');
select is((select sum(points)::integer from public.scored_games where player = pg_temp.id('a') and game = 'clan-quest'), 10, '... which becomes 10 hub points');
select is(pg_temp.slain('a'), 1, '... stats.monsterSlain is 1');
select is((select monster_done_on from public.clan_hall where player = pg_temp.id('a') and season = 3), public.nz_day(now()), '... the Hall notes the day');
select is(pg_temp.tries('a', 3), 4, '... and the tries');
select is(pg_temp.news('Red Banner beat Grimmor the Storm Giant!'), 1, '... the school is told in the news');
select is((select school_id from public.clan_news where text = 'Red Banner beat Grimmor the Storm Giant!'), 1, '... in the clan''s school');
select ok(pg_temp.slayer('a'), '... and Giant Slayer is earned in the same save');
select is(public.clan_quest_counts(pg_temp.id('a')), '{"clan_monster":1}'::jsonb, '... counted by clan_quest_counts');
select ok(not exists (select 1 from public.achievements where player = pg_temp.id('a') and achievement = 'cq-master-builder'), '... and nothing else was handed out');

-- ---- ... and nothing more for the same season ----
select pg_temp.result('a', 16, pg_temp.mon('giant', 3, true, true, 5));
select is(pg_temp.fame('a'), 100, 'a second win marked first in the same season gives nothing more (fame)');
select is(pg_temp.slain('a'), 1, '... nor another slaying');
select is(pg_temp.monster_scores('a'), 1, '... nor points');
select is(pg_temp.news('Red Banner beat Grimmor the Storm Giant!'), 1, '... nor another news line');
select is(pg_temp.tries('a', 3), 5, '... though the tries are kept');
select pg_temp.result('a', 17, pg_temp.mon('giant', 3, true, false, 6));
select is(pg_temp.fame('a'), 100, 'a win that is not the first gives nothing');
select is(pg_temp.hall_rows('a'), 1, '... and the Hall still has one row');

-- ---- ... but again in the next season ----
select pg_temp.result('a', 18, pg_temp.mon('golem', 4, true, true, 1));
select is(pg_temp.fame('a'), 200, 'the next season''s first win pays again');
select is(pg_temp.slain('a'), 2, '... stats.monsterSlain is 2');
select is(pg_temp.hall_rows('a'), 2, '... with a Hall row for each season');
select is(pg_temp.news('Red Banner beat Old Craghold the Stone Golem!'), 1, '... and the golem''s name in the news');

-- ---- The other monsters, and a win straight away ----
select pg_temp.result('b', 20, pg_temp.mon('troll', 3, true, true, 1));
select is(pg_temp.news('Blue Fox beat Frostjaw the Frost Troll!'), 1, 'the troll''s name is in the news');
select is(pg_temp.fame('b'), 100, '... and a first try that wins pays (fame)');
select is(pg_temp.tries('b', 3), 1, '... with one try');

-- ---- The reward is not overwritten by the rewards of the same request ----
select is(pg_temp.save('c', 3, 'Green Owl') ->> 'status', 'saved', 'cai''s clan is saved');
select pg_temp.result('c', 30, pg_temp.mon('giant', 3, true, true, 1));
select is(pg_temp.fame('c'), 100, 'fame added by the monster trigger is kept (it runs after the earned-rewards trigger)');
select ok(pg_temp.slayer('c'), '... with the achievement');

-- ---- A broken monster never fails the save ----
select lives_ok($$ select pg_temp.result('a', 40, '{"type":"fightRound","monster":"giant"}') $$, 'a monster that is not an object is ignored');
select lives_ok($$ select pg_temp.result('a', 41, '{"type":"fightRound","monster":{"kind":"giant","season":"x","won":true,"first":true,"tries":1}}') $$, 'a season that is not a number does not fail the save');
select lives_ok($$ select pg_temp.result('a', 42, '{"type":"fightRound","monster":{}}') $$, 'an empty monster does not fail the save');
select lives_ok($$ select pg_temp.result('a', 43, '{"type":"fightRound","monster":{"kind":"giant","season":9,"won":"maybe","first":true,"tries":1}}') $$, 'a won that is not true or false does not fail the save');
select lives_ok($$ select pg_temp.result('a', 44, '{"type":"fightRound","monster":{"kind":"giant","season":-2,"won":true,"first":true,"tries":1}}') $$, 'a season below 0 does not fail the save');
select is(pg_temp.fame('a'), 200, '... and none of them paid anything');
select is((select count(*)::integer from public.clan_requests where player = pg_temp.id('a') and request_id in (pg_temp.req(40), pg_temp.req(41), pg_temp.req(42), pg_temp.req(43), pg_temp.req(44))), 5,
  '... and all five requests were saved');
select pg_temp.result('a', 45, pg_temp.mon('dragon', 5, true, true, 1));
select is(pg_temp.news('Red Banner beat the season monster!'), 1, 'a monster kind the database does not know still pays, with a plain news line');

-- ---- Who can call what ----
select pg_temp.as_a();
select throws_ok('select public.clan_monster_try()', '42501', null, 'a pupil cannot call the monster trigger function');
select throws_ok($$ select public.clan_quest_counts(pg_temp.id('a')) $$, '42501', null, 'a pupil cannot call clan_quest_counts');
select pg_temp.reset();
select ok(not has_function_privilege('service_role', 'public.clan_monster_try()', 'execute')
  and not has_function_privilege('anon', 'public.clan_quest_counts(uuid)', 'execute'), 'the server and visitors cannot call them either');

select * from finish();
rollback;
