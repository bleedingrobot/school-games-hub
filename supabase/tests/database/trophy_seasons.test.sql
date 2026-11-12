-- Coming back, two-game rewards and the hall of fame (migration 20261112002700_trophy_seasons.sql;
-- docs/plans/profile/PLAN.md card P10).
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

select setval(pg_get_serial_sequence('public.schools', 'id'), (select max(id) from public.schools));
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id)
  values ('otherschool.school.nz', (select id from public.schools where name = 'Other School'));

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'dan@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-000000000011', 'hid@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'far@otherschool.school.nz');
update public.profiles set hidden = true where id = '00000000-0000-0000-0000-000000000011';

-- Both schools are in hub season 2, which started 25 days ago.
update public.schools set hub_season_start = public.nz_day(now()) - 60, hub_season_days = 35, hub_paused_since = null;

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || who)::uuid $$;
create function pg_temp.has(who text, trophy text) returns boolean language sql as $$
  select exists (select 1 from public.trophies w where w.player = pg_temp.id(who) and w.trophy = has.trophy) $$;
create function pg_temp.since() returns date language sql as $$
  select public.hub_season_start_day((select id from public.schools where name <> 'Other School' order by id limit 1)) $$;
-- A finished go on a given day (scored by the game_points trigger, which writes scored_games).
create function pg_temp.go(who text, day date) returns void language sql as $$
  insert into public.game_points (player, game, once, points_raw, finished_at)
  values (pg_temp.id(who), 'archery', 'go-' || who || '-' || day || '-' || gen_random_uuid(), 1, (day + time '11:00') at time zone 'Pacific/Auckland');
$$;

select is(pg_temp.since(), public.nz_day(now()) - 25, 'hub season 2 started 25 days ago');

-- ---- Season Regular ----
select pg_temp.go('0a', d) from (
  select d::date from generate_series(pg_temp.since(), public.nz_day(now()), interval '1 day') d
  where extract(isodow from d) between 1 and 5 order by d limit 14) x;
select pg_temp.go('0a', d::date) from generate_series(pg_temp.since(), pg_temp.since() + 6, interval '1 day') d
  where extract(isodow from d) in (6, 7);
select pg_temp.go('0a', pg_temp.since() - 3);
select is((select count(*)::integer from public.scored_games where player = pg_temp.id('0a')), 17, 'Ana: 17 finished goes saved');
select ok(not pg_temp.has('0a', 'hub-regular'), '14 school days (weekends and last season don''t count): no Season Regular yet');
select pg_temp.go('0a', (select max(d)::date from generate_series(pg_temp.since(), public.nz_day(now()), interval '1 day') d
  where extract(isodow from d) between 1 and 5));
select ok(pg_temp.has('0a', 'hub-regular'), 'the 15th school day gives Season Regular');
select is((select season from public.trophies where player = pg_temp.id('0a') and trophy = 'hub-regular'), 2, '... for season 2');

-- ---- Two-game rewards ----
select public.award_trophy(pg_temp.id('0a'), 'dm-slayer', '{}', 1);
select ok(not pg_temp.has('0a', 'pair-double-slayer'), 'one half (the sword) is not enough');
select public.award_trophy(pg_temp.id('0a'), 'clan-tooth');
select ok(pg_temp.has('0a', 'pair-double-slayer'), 'the sword and the Monster Tooth in the same season give Double Slayer');
select is((select detail -> 'halves' from public.trophies where player = pg_temp.id('0a') and trophy = 'pair-double-slayer'),
  '["dm-slayer", "clan-tooth"]'::jsonb, '... noting both halves');

-- Cat slew the dragon before this season began, then won the tooth now: not the same season.
insert into public.trophies (player, trophy, season, year, earned_at)
  values (pg_temp.id('0c'), 'dm-slayer', 1, 2026, (pg_temp.since() - 3 + time '11:00') at time zone 'Pacific/Auckland');
select public.award_trophy(pg_temp.id('0c'), 'clan-tooth');
select ok(not pg_temp.has('0c', 'pair-double-slayer'), 'halves from different seasons don''t make a pair');

-- Ben: Champion's Knight only.
select public.award_trophy(pg_temp.id('0b'), 'chess-knight');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is((select p -> 'halves' from jsonb_array_elements(public.my_trophy_pairs()) p where p ->> 'id' = 'pair-board-master'),
  '[{"game": "chess", "held": true, "name": "Champion''s Knight", "trophy": "chess-knight"},
    {"game": "checkers", "held": false, "name": "Champion''s King", "trophy": "checkers-king"}]'::jsonb,
  'the cabinet sees which half Ben holds, and which game to try next');
select is((select (p ->> 'won')::boolean from jsonb_array_elements(public.my_trophy_pairs()) p where p ->> 'id' = 'pair-board-master'),
  false, '... and that the pair is not won');
select is(jsonb_array_length(public.my_trophy_pairs()), 6, 'six two-game rewards');
select pg_temp.reset();
select public.award_trophy(pg_temp.id('0b'), 'checkers-king');
select ok(pg_temp.has('0b', 'pair-board-master'), 'both champion ranks this year give Board Master');

-- ---- All-rounder ----
select public.award_trophy(pg_temp.id('0d'), t) from unnest(array['archery-feather', 'mine-lamp', 'decree-seal', 'isles-keeper']) t;
select ok(not pg_temp.has('0d', 'hub-allrounder'), 'trophies from 4 games: no All-rounder');
select ok(pg_temp.has('0d', 'pair-adventurer'), '(Hawk Feather and Miner''s Lamp made Adventurer''s Badge, which is not a game)');
select public.award_trophy(pg_temp.id('0d'), '101-shark');
select ok(pg_temp.has('0d', 'hub-allrounder'), 'trophies from 5 games give the All-rounder picture');

-- ---- Best Friends Cup ----
select public.award_trophy(pg_temp.id('0e'), t) from unnest(array['beanstalk-kiwi', 'beanstalk-tui']) t;
select ok(not pg_temp.has('0e', 'hub-best-friends'), 'two golden prizes in one garden game: no Best Friends Cup');
select public.award_trophy(pg_temp.id('0e'), 'hop-hop');
select is((select level from public.trophy_counts(pg_temp.id('0e')) where trophy = 'hub-best-friends'), 1,
  'golden prizes in two garden games: bronze Best Friends Cup');
select public.award_trophy(pg_temp.id('0e'), t) from unnest(array['pipi-pipi', 'korora-korora']) t;
select is((select level from public.trophy_counts(pg_temp.id('0e')) where trophy = 'hub-best-friends'), 2, 'four games: silver');

-- ---- Hall of fame ----
select public.award_trophy(pg_temp.id('0a'), 'dm-first-five', '{"place": 1}', 1);
select public.award_trophy(pg_temp.id('11'), 'dm-first-five', '{"place": 2}', 1);
select public.award_trophy(pg_temp.id('0f'), 'dm-first-five', '{"place": 1}', 1);
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is(public.hall_of_fame() -> 'dragon' -> 0 -> 'slayers' -> 0 ->> 'name',
  (select display_name from public.profiles where id = pg_temp.id('0a')), 'the hall shows Ana as season 1''s first slayer');
select is(jsonb_array_length(public.hall_of_fame() -> 'dragon' -> 0 -> 'slayers'), 1, '... and no hidden pupil, no other school');
select ok((select bool_or(p ->> 'trophy' = 'pair-double-slayer') from jsonb_array_elements(public.hall_of_fame() -> 'pictures') p),
  'this season''s new pictures include Ana''s Double Slayer');
select ok(not (select bool_or(p ->> 'trophy' like 'beanstalk-%') from jsonb_array_elements(public.hall_of_fame() -> 'pictures') p),
  'garden friend pictures (maths progress) stay off the hall');
select pg_temp.reset();
select is(public.hall_name('Bob'), null, 'a typed own name never shows in the hall');

-- ---- The new season note ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is(public.my_season_note(), null, 'Ben won his trophies this season: no note');
select pg_temp.reset();
insert into public.trophies (player, trophy, season, year, earned_at)
  values (pg_temp.id('0b'), 'clan-tooth', 1, 2026, (pg_temp.since() - 3 + time '11:00') at time zone 'Pacific/Auckland');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is(public.my_season_note(), '{"season": 2}'::jsonb, 'with a trophy from last season, Ben sees the season 2 note');
select is(public.my_home_page() -> 'seasonNote', '{"season": 2}'::jsonb, '... on his home page');
select public.mark_season_note_seen();
select is(public.my_season_note(), null, 'once only');

-- ---- Who can call what ----
select throws_ok($$ select public.trophy_followups('00000000-0000-0000-0000-00000000000b') $$, '42501', null,
  'pupils can''t run the reward check');
select pg_temp.reset();
set local role anon;
select throws_ok($$ select public.hall_of_fame() $$, '42501', null, 'not for visitors who are not signed in');

select * from finish();
rollback;
