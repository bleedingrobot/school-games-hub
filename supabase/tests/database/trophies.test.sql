-- Trophies and earned pictures (migration 20261112000800_trophies.sql; docs/plans/profile/PLAN.md card P3).
-- The hub's own season clock, who may give and read trophies, bronze/silver/gold, wearing an earned picture,
-- and that a New Season keeps every trophy.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(57);

select setval(pg_get_serial_sequence('public.schools', 'id'), (select max(id) from public.schools));
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id)
  values ('otherschool.school.nz', (select id from public.schools where name = 'Other School'));

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'far@otherschool.school.nz');
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
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || who)::uuid $$;
create function pg_temp.ana() returns void language sql as $$
  select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz') $$;
create function pg_temp.ben() returns void language sql as $$
  select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz') $$;
create function pg_temp.far() returns void language sql as $$
  select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'far@otherschool.school.nz') $$;
-- Moves school 1's hub clock so today is `days` days into it.
create function pg_temp.day_of_clock(days integer) returns void language sql as $$
  update public.schools set hub_season_start = public.nz_day(now()) - days, hub_paused_since = null where id = 1 $$;

insert into public.trophy_types (id, game, name, how, kind, repeat, sort) values
  ('t-head', 'test-game', 'Test Head', 'Be one of the first five.', 'picture', 'season', 1),
  ('t-sword', 'test-game', 'Test Sword', 'Win the big fight.', 'trophy', 'season', 2),
  ('t-once', 'test-game', 'Test Star', 'Finish the book.', 'trophy', 'once', 3),
  ('t-year', 'test-game', 'Test Year', 'Play all year.', 'trophy', 'year', 4),
  ('t-cup', 'test-game', 'Test Cup', 'Play on 30, 90 and 150 days.', 'trophy', 'steps', 5),
  ('t-far', 'hub', 'Test Far', 'Try five games.', 'picture', 'once', 6);

-- ---- The hub's own season clock ----
select is((select hub_season_start from public.schools where id = 1), date '2026-10-18', 'today''s school starts its hub season 1 on 18 Oct 2026');
select is((select hub_season_days from public.schools where id = 1), 35, '... with 35-day seasons');
select pg_temp.day_of_clock(0);
select is(public.hub_season(1), 1, 'the first day is season 1');
select pg_temp.day_of_clock(34);
select is(public.hub_season(1), 1, 'day 35 is still season 1');
select pg_temp.day_of_clock(35);
select is(public.hub_season(1), 2, 'day 36 is season 2');
select pg_temp.day_of_clock(-3);
select is(public.hub_season(1), 0, 'before the first day it is season 0');
update public.schools set hub_season_start = public.nz_day(now()) - 80, hub_paused_since = public.nz_day(now()) - 60 where id = 1;
select is(public.hub_season(1), 1, 'while paused the number stands still at the day it was paused');
update public.schools set hub_season_days = 10, hub_paused_since = null where id = 1;
select is(public.hub_season(1), 9, 'the season length is the school''s own setting');
update public.schools set hub_season_days = 35 where id = 1;
select is(public.hub_season(-1), 0, 'a school that doesn''t exist is season 0');
select is(public.hub_season((select id from public.schools where name = 'Other School')), 1, 'a new school starts at season 1 the day it is made');
-- Dragon Maths' clock does not move the hub's.
select pg_temp.day_of_clock(5);
update public.app_settings set lord_season_start = public.nz_day(now()) - 200, lord_paused_since = public.nz_day(now()) - 100;
select is(public.hub_season(1), 1, 'changing or pausing the Dragon Maths season does not move the hub season');

-- ---- Pupils cannot give or read trophies directly ----
select pg_temp.ana();
select throws_ok($$ select public.award_trophy(auth.uid(), 't-head') $$, '42501', null, 'a pupil cannot call award_trophy');
select throws_ok($$ select public.award_trophy(auth.uid(), 't-head', '{}', 4) $$, '42501', null, '... with a season number either');
select throws_ok($$ select * from public.trophies $$, '42501', null, 'a pupil cannot read the trophies table');
select throws_ok($$ select * from public.trophy_types $$, '42501', null, '... or the trophy types');
select throws_ok($$ insert into public.trophies (player, trophy) values (auth.uid(), 't-head') $$, '42501', null, '... or add a row');
select throws_ok($$ select * from public.trophy_counts(auth.uid()) $$, '42501', null, '... or use the counting helper');
select throws_ok($$ select public.hub_season(1) $$, '42501', null, '... or ask for another school''s season');
select throws_ok($$ update public.schools set hub_season_start = '2020-01-01' $$, '42501', null, '... or move the hub clock');
select pg_temp.reset();
set local role anon;
select throws_ok($$ select public.my_trophies() $$, '42501', null, 'someone signed out cannot read trophies');
select pg_temp.reset();

-- ---- The server gives trophies; the same feat counts once ----
select pg_temp.act_as_server();
select is(public.award_trophy(pg_temp.id('0a'), 't-head', '{"place": 2}'),
  '{"won": true, "trophy": "t-head", "tier": "bronze", "count": 1}'::jsonb, 'the server gives a trophy: bronze the first time');
select is(public.award_trophy(pg_temp.id('0a'), 't-head', '{"place": 9}') ->> 'won', 'false', 'the same season again adds nothing');
select throws_ok($$ select public.award_trophy(pg_temp.id('0a'), 'no-such') $$, '22023', null, 'an unknown trophy is refused');
select throws_ok($$ select public.award_trophy(pg_temp.id('99'), 't-head') $$, '22023', null, '... and an unknown player');
select pg_temp.reset();
select is((select array_agg(season || '/' || year) from public.trophies where player = pg_temp.id('0a')),
  array['1/' || extract(year from public.nz_day(now()))::integer], 'the row carries the hub season and the year');

select pg_temp.day_of_clock(40);
select pg_temp.act_as_server();
select is(public.award_trophy(pg_temp.id('0a'), 't-head') ->> 'tier', 'silver', 'a second season is silver');
select pg_temp.reset();
select pg_temp.day_of_clock(75);
select pg_temp.act_as_server();
select is(public.award_trophy(pg_temp.id('0a'), 't-head') ->> 'tier', 'gold', 'a third season is gold');
-- A game with its own season number says which season it was.
select is(public.award_trophy(pg_temp.id('0a'), 't-head', '{}', 7), '{"won": true, "trophy": "t-head", "tier": "gold", "count": 4}'::jsonb,
  'a caller''s own season number is used, and a fourth win stays gold and counts up');
select is(public.award_trophy(pg_temp.id('0a'), 't-head', '{}', 7) ->> 'won', 'false', '... once for that season');
select throws_ok($$ select public.award_trophy(pg_temp.id('0a'), 't-head', '{}', -1) $$, '22023', null, '... and never below 0');

select is(public.award_trophy(pg_temp.id('0a'), 't-once') ->> 'won', 'true', 'a once-only trophy is won');
select is(public.award_trophy(pg_temp.id('0a'), 't-once', '{}', 5) ->> 'count', '1', '... once, whatever season is sent');
select is(public.award_trophy(pg_temp.id('0a'), 't-year') ->> 'tier', 'bronze', 'a yearly trophy is won');
select is(public.award_trophy(pg_temp.id('0a'), 't-year') ->> 'won', 'false', '... once a year');
select is(public.award_trophy(pg_temp.id('0b'), 't-cup', '{"step": 2}') ->> 'tier', 'silver', 'a steps trophy takes its metal from the step');
select is(public.award_trophy(pg_temp.id('0b'), 't-cup', '{"step": 1}') ->> 'tier', 'silver', '... and a lower step later does not take it down');
select throws_ok($$ select public.award_trophy(pg_temp.id('0b'), 't-cup') $$, '22023', null, '... and it needs a step');
select is(public.award_trophy(pg_temp.id('0f'), 't-far') ->> 'won', 'true', 'a pupil in another school wins one too');
select pg_temp.reset();
select is((select count(*)::integer from public.game_points), 0, 'trophies give no hub points');

-- ---- Wearing an earned picture ----
select pg_temp.ben();
select throws_ok($$ select public.save_my_avatar('{"kind": "cat", "pic": "t-head"}') $$, '22023', null, 'a pupil cannot save a picture they have not won');
select throws_ok($$ select public.save_my_avatar('{"kind": "cat", "pic": "t-cup", "picTier": "gold"}') $$, '22023', null,
  '... or wear a trophy that is not a picture, even one they hold');
select throws_ok($$ select public.save_my_avatar('{"kind": "cat", "pic": "no-such"}') $$, '22023', null, '... or a picture that doesn''t exist');
select lives_ok($$ select public.save_my_avatar('{"kind": "cat", "picTier": "gold"}') $$, 'an avatar with no picture still saves');
select is((select avatar from public.profiles where id = pg_temp.id('0b')), '{"kind": "cat"}'::jsonb, '... and a ring sent with no picture is dropped');
select pg_temp.reset();
select pg_temp.act_as_server();
select public.award_trophy(pg_temp.id('0b'), 't-head');
select pg_temp.reset();
select pg_temp.ben();
select lives_ok($$ select public.save_my_avatar('{"kind": "cat", "pic": "t-head", "picTier": "gold"}') $$, 'a pupil can wear a picture they have won');
select is((select avatar from public.profiles where id = pg_temp.id('0b')), '{"kind": "cat", "pic": "t-head", "picTier": "bronze"}'::jsonb,
  '... and the ring is the server''s, not the one the browser sent');
select pg_temp.reset();
select pg_temp.act_as_server();
select public.award_trophy(pg_temp.id('0b'), 't-head', '{}', 8);
select pg_temp.reset();
select is((select avatar ->> 'picTier' from public.profiles where id = pg_temp.id('0b')), 'silver', 'winning it again turns the worn ring silver');

-- ---- What pupils read ----
select pg_temp.ana();
select is((select jsonb_agg(t ->> 'id') from jsonb_array_elements(public.my_trophies() -> 'trophies') t),
  '["t-head", "t-once", "t-year"]'::jsonb, 'my_trophies lists my own trophies in shelf order');
select is((select jsonb_build_array(t ->> 'tier', t -> 'count', t -> 'isNew', t -> 'wins' -> 0 -> 'detail')
  from jsonb_array_elements(public.my_trophies() -> 'trophies') t where t ->> 'id' = 't-head'),
  '["gold", 4, true, {"place": 2}]'::jsonb, '... with the metal, the count, that it is new, and my own detail');
select is((select jsonb_agg(t ->> 'id') from jsonb_array_elements(public.my_trophies() -> 'next') t),
  '["t-sword", "t-cup", "t-far"]'::jsonb, '... and up to three I could win next');
select pg_temp.ben();
select is(public.trophies_of(pg_temp.id('0a')),
  '[{"id": "t-head", "tier": "gold"}, {"id": "t-once", "tier": "bronze"}, {"id": "t-year", "tier": "bronze"}]'::jsonb,
  'a classmate sees only the trophy id and metal: no detail, no dates');
select is(public.trophies_of(pg_temp.id('0f')), '[]'::jsonb, 'nothing about a pupil in another school');
select pg_temp.ana();
select is(public.mark_my_trophies_seen(), 6, 'marking my trophies as seen');

-- ---- New Season keeps trophies; deleting the account removes them ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select public.teacher_new_season('NEW SEASON');
select pg_temp.reset();
select is((select count(*)::integer from public.trophies), 11, 'a New Season keeps every trophy');
select is((select count(*)::integer from public.trophy_types where game in ('test-game', 'hub')), 6, '... and every trophy type');
select is((select avatar ->> 'pic' from public.profiles where id = pg_temp.id('0b')), 't-head', '... and the picture a pupil is wearing');
delete from auth.users where id = pg_temp.id('0a');
select is((select count(*)::integer from public.trophies where player = pg_temp.id('0a')), 0, 'deleting a pupil''s account removes their trophies');

select * from finish();
rollback;
