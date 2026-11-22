-- Star Trader quests Q.5: the Quest Log, hub points, the Star Quest Master achievement and trophy
-- (supabase/migrations/20261121000500_trader_quest_log.sql). Pupils can't reach the log; a save that finishes a quest
-- logs it once with 2 hub points (a save sent twice, or the same game saved again, earns once); a New Season clears the
-- game but keeps the log; all five in one season gives the trophy and the achievement. R.4 (20261122000600): quests 6 to
-- 10 log with points too, five of any ten is not Master, and all ten in a season is Star Quest Legend.
-- Run on a throw-away copy: scripts/scratch-test.sh <name> supabase/tests/database/trader_quest_log.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || who)::uuid $$;
-- A saved game whose quests have these finished.
create function pg_temp.game(finished text) returns text language sql as $$
  select jsonb_build_object('quests', jsonb_build_object('open', null, 'done', '[]'::jsonb, 'finished', finished::jsonb))::text
$$;
create function pg_temp.save(who text, expected integer, finished text, req text, season integer default 1)
returns integer language sql as $$
  select public.trader_save(pg_temp.id(who), expected, pg_temp.game(finished)::jsonb, 1, 0, false, season, req, '{"ok":true}', '{}'::jsonb)
$$;
create function pg_temp.points(who text) returns integer language sql as $$
  select coalesce(sum(g.points_raw), 0)::integer from public.game_points g where g.player = pg_temp.id(who) and g.game = 'trader'
$$;

-- ---- Pupils reach nothing ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.trader_quest_log $$, '42501', null, 'pupils cannot read the Quest Log table');
select throws_ok($$ select public.trader_quest_log_of(auth.uid()) $$, '42501', null, 'pupils cannot call the Quest Log reader');
select throws_ok($$ select public.trader_quest_finished(auth.uid(), 'zuzu', 1) $$, '42501', null, 'pupils cannot finish a quest themselves');
select pg_temp.reset();

-- ---- A finished quest is logged once, with 2 points ----
select is(pg_temp.save('0a', 0, '[]', 'req-r1-xxxx'), 1, 'a new game with no quests saves');
select is(pg_temp.save('0a', 1, '["zuzu"]', 'req-r2-xxxx'), 2, 'the save that finishes a quest goes through');
select is(public.trader_quest_log_of(pg_temp.id('0a')), array['zuzu'], 'it is in the Quest Log');
select is(pg_temp.points('0a'), 2, '... with 2 hub points');
select is(pg_temp.save('0a', 2, '["zuzu"]', 'req-r3-xxxx'), 3, 'saving the same game again');
select is(pg_temp.points('0a'), 2, '... gives no more points');
select is(pg_temp.save('0a', 2, '["zuzu","sprocket"]', 'req-r4-xxxx'), null, 'a save from an old version is refused');
select is(public.trader_quest_log_of(pg_temp.id('0a')), array['zuzu'], '... and logs nothing');

-- ---- A New Season clears the game but keeps the log ----
select public.trader_season(array[pg_temp.id('0a')]);
select is((select count(*)::integer from public.trader_games where player = pg_temp.id('0a')), 0, 'New Season clears the game');
select is(public.trader_quest_log_of(pg_temp.id('0a')), array['zuzu'], '... but the keepsake stays');

-- ---- All five in one season: the trophy and the achievement ----
select pg_temp.save('0b', 0, '["zuzu","sprocket","nettle","vex"]', 'req-b1-xxxx', 3);
select is((select count(*)::integer from public.trophies t where t.player = pg_temp.id('0b') and t.trophy = 'trader-quest-master'), 0,
  'four quests: no trophy yet');
select pg_temp.save('0b', 1, '["zuzu","sprocket","nettle","vex","kai"]', 'req-b2-xxxx', 3);
select is((select count(*)::integer from public.trophies t where t.player = pg_temp.id('0b') and t.trophy = 'trader-quest-master' and t.season = 3), 1,
  'all five in a season: the Star Quest Master trophy');
select ok(exists (select 1 from public.achievements a where a.player = pg_temp.id('0b') and a.achievement = 'trader-quest-master'),
  '... and the Star Quest Master achievement');

-- ---- R.4: quests 6 to 10, Star Quest Legend (20261122000600) ----
select pg_temp.save('0a', 0, '["zuzu","puddle","gorbo","zip","pippop"]', 'req-c1-xxxx', 2);
select is(pg_temp.points('0a'), 12, 'quests 6 to 10 go in the Quest Log with 2 points each');
select is((select count(*)::integer from public.trophies t where t.player = pg_temp.id('0a') and t.trophy = 'trader-quest-master' and t.season = 2), 0,
  'five quests that are not the first five: no Star Quest Master');
select pg_temp.save('0b', 2, '["zuzu","sprocket","nettle","vex","kai","puddle","gorbo","zip","pippop"]', 'req-b3-xxxx', 3);
select is((select count(*)::integer from public.trophies t where t.player = pg_temp.id('0b') and t.trophy = 'trader-quest-legend'), 0,
  'nine quests: no Star Quest Legend yet');
select pg_temp.save('0b', 3, '["zuzu","sprocket","nettle","vex","kai","puddle","gorbo","zip","pippop","sable"]', 'req-b4-xxxx', 3);
select is((select count(*)::integer from public.trophies t where t.player = pg_temp.id('0b') and t.trophy = 'trader-quest-legend' and t.season = 3), 1,
  'all ten in a season: the Star Quest Legend trophy');
select ok(exists (select 1 from public.achievements a where a.player = pg_temp.id('0b') and a.achievement = 'trader-quest-legend'),
  '... and the Star Quest Legend achievement');
select is(public.trader_counts(pg_temp.id('0b')), '{"trader_quests": 5, "trader_quests_all": 10}'::jsonb, 'Master counts the first five, Legend all ten');

select * from finish();
rollback;
