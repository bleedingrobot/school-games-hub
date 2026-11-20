-- Dragon Maths: the end of a season (migration 20261120001800_lord_season_results.sql;
-- docs/plans/dragon-season-end/PLAN.md stage 2). When lord_commit saves a hero in a newer season, the old hero's results
-- are kept and the Season Veteran trophy given; the ceremony's summary shows them with the school's slayers.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

select setval(pg_get_serial_sequence('public.schools', 'id'), (select max(id) from public.schools));
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id)
  values ('otherschool.school.nz', (select id from public.schools where name = 'Other School'));

-- Pupils 01 to 03 at Douglas Park, a hidden pupil (0d), a teacher (0e) and a pupil at another school (0f).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'p1@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-000000000002', 'p2@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-000000000003', 'p3@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'hid@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'far@otherschool.school.nz');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000e';
update public.profiles set hidden = true where id = '00000000-0000-0000-0000-00000000000d';

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || who)::uuid $$;
create function pg_temp.pupil(who text) returns void language sql as $$
  select pg_temp.act_as('00000000-0000-0000-0000-0000000000' || who, 'p' || ltrim(who, '0') || '@douglaspark.school.nz') $$;
create function pg_temp.slew(who text, season integer, kills integer, hours_ago numeric) returns void language sql as $$
  insert into public.lord_hall (player, season, kills, first_at)
  values (pg_temp.id(who), season, kills, now() - make_interval(secs => hours_ago * 3600))
$$;
-- A hero at this level with this many forest and master wins.
create function pg_temp.hero(lvl integer, forest integer, masters integer) returns jsonb language sql as $$
  select jsonb_build_object('level', lvl, 'exp', 1200, 'hp', 20, 'maxHp', 20, 'strength', 8, 'defence', 1, 'gold', 50, 'bank', 25,
    'gems', 0, 'kindness', 0, 'weapon', 3, 'armour', 2, 'heroClass', 'mage', 'dragonKills', 0, 'day', public.nz_day(now())::text,
    'forestLeft', 10, 'arenaLeft', 3, 'skillLeft', 3, 'masterTried', false, 'forestWins', forest, 'arenaWins', 4, 'masterWins', masters)
$$;
-- One accepted lord_commit save of that hero in that season.
create function pg_temp.save(who text, season integer, h jsonb) returns text language sql as $$
  select public.lord_commit(pg_temp.id(who), jsonb_build_object(
    'expect', coalesce((select version from public.lord_heroes where player = pg_temp.id(who)), 0), 'hero', h, 'season', season,
    'extra', jsonb_build_object('stats', '{"forestWins":0,"masterWins":0,"arenaWins":0,"riddles":0,"dragons":0,"bestLevel":1}'::jsonb),
    'event', jsonb_build_object('requestId', gen_random_uuid(), 'action', 'forest', 'summary', '{}'::jsonb))) ->> 'status'
$$;
create function pg_temp.veteran(who text) returns integer language sql as $$
  select count(*)::integer from public.trophies w where w.player = pg_temp.id(who) and w.trophy = 'dm-veteran' $$;

update public.app_settings set lord_enabled = true, lord_season_start = public.nz_day(now()), lord_paused_since = null;

select is((select kind || '/' || repeat || '/' || game from public.trophy_types where id = 'dm-veteran'), 'trophy/season/dragon-maths',
  'the Season Veteran is a trophy, won each season, in Dragon Maths');

-- ---- Season 1 ----
select is(pg_temp.save('01', 1, pg_temp.hero(11, 40, 10)), 'ok', 'pupil 1 plays season 1 to level 11');
select is(pg_temp.save('02', 1, pg_temp.hero(1, 0, 0)), 'ok', 'pupil 2 opens season 1 but never plays');
select is(pg_temp.save('03', 1, pg_temp.hero(12, 60, 11)), 'ok', 'pupil 3 reaches level 12');
select pg_temp.slew('03', 1, 2, 30);
select pg_temp.slew('01', 1, 1, 20);
select pg_temp.slew('0d', 1, 1, 40);
select pg_temp.slew('0e', 1, 1, 50);
select pg_temp.slew('0f', 1, 3, 60);
select is((select count(*)::integer from public.lord_season_results), 0, 'nothing is saved while the season goes on');
select is(pg_temp.save('01', 1, pg_temp.hero(12, 41, 11)), 'ok', 'another save in season 1');
select is((select count(*)::integer from public.lord_season_results), 0, '... still saves nothing');

-- ---- Season 2 starts ----
select is(pg_temp.save('01', 2, pg_temp.hero(1, 0, 0)), 'ok', 'pupil 1''s first save in season 2 (the hero starts again)');
select is((select format('%s/%s/%s/%s/%s/%s/%s', season, level, masters, forest_wins, gold, dragons, hero_class)
  from public.lord_season_results where player = pg_temp.id('01')), '1/12/11/41/75/1/mage',
  'pupil 1''s season 1 is kept: level 12, 11 masters, 41 forest wins, gold and bank, 1 dragon, mage');
select is(pg_temp.veteran('01'), 1, 'pupil 1 wins the Season Veteran trophy');
select is((select (detail ->> 'level')::integer from public.trophies where player = pg_temp.id('01') and trophy = 'dm-veteran'), 12,
  '... which notes the level reached');
select is(pg_temp.save('01', 2, pg_temp.hero(2, 5, 1)), 'ok', 'another save in season 2');
select is((select count(*)::integer from public.lord_season_results where player = pg_temp.id('01')), 1, '... saves no second row');

select is(pg_temp.save('02', 2, pg_temp.hero(1, 0, 0)), 'ok', 'pupil 2 comes back in season 2');
select is((select level from public.lord_season_results where player = pg_temp.id('02')), 1, 'pupil 2''s empty season is kept');
select is(pg_temp.veteran('02'), 0, '... but a pupil who never played gets no Season Veteran trophy');

-- ---- The ceremony's summary ----
select pg_temp.pupil('01');
select is(public.lord_season_summary() ->> 'season', '1', 'the summary is for my last finished season');
select is((select jsonb_agg(x ->> 'name') from jsonb_array_elements(public.lord_season_summary() -> 'slayers') x),
  (select jsonb_build_array(
    (select display_name from public.profiles where id = pg_temp.id('03')),
    (select display_name from public.profiles where id = pg_temp.id('01')))),
  'slayers: this school''s pupils only, most kills first (no teacher, hidden pupil or other school)');
select is(public.lord_season_summary() #>> '{mine,level}', '12', 'my own season 1 level');
select is(public.lord_season_summary() -> 'trophies', '["dm-veteran", "dm-first-five", "dm-slayer"]'::jsonb,
  'the trophies I won in season 1');
select public.lord_season_seen(1);
select is(public.lord_season_summary() ->> 'seen', 'true', 'watching the ceremony is remembered');
select throws_ok($$ select * from public.lord_season_results $$, '42501', null, 'pupils cannot read the results table');
select pg_temp.reset();

select * from finish();
rollback;
