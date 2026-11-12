-- Trophies for Marble Rush, Bond Match, Mine Runner on hard, Royal Decree's perfect reign and Training (migration
-- 20261112002300_trophies_games_4.sql; docs/plans/profile/PLAN.md card P8 part 2), and Marble Rush's and Bond Match's
-- first achievements.
-- Run on a throw-away copy: scripts/scratch-test.sh <db> supabase/tests/database/trophies_games_4.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
insert into public.classes (school_id, name, school_year, warp_code, archived) values (1, 'Trophy Room', 2026, 'TRPHY', false);
insert into public.class_members (student_id, class_id)
select v.s::uuid, c.id from (values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b')) v(s)
join public.classes c on c.name = 'Trophy Room'
on conflict (student_id) do update set class_id = excluded.class_id;

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || who)::uuid $$;
create function pg_temp.wins(who text, t text) returns integer language sql as $$
  select count(*)::integer from public.trophies where player = pg_temp.id(who) and trophy = t $$;
create function pg_temp.has(who text, a text) returns boolean language sql as $$
  select exists (select 1 from public.achievements where player = pg_temp.id(who) and achievement = a) $$;
update public.schools set hub_season_start = public.nz_day(now()) - 40, hub_season_days = 35, hub_paused_since = null where id = 1;

-- A Marble best: course, mode, maths, seconds.
create function pg_temp.marble(who text, course text, mode text, maths boolean, secs numeric) returns void language sql as $$
  insert into public.marble_bests as b (player, course, mode, maths, steps, falls, inputs)
  values (pg_temp.id(who), course, mode, maths, (secs * 60)::integer, 0, 'x')
  on conflict on constraint marble_bests_pkey do update set steps = excluded.steps $$;
create function pg_temp.bond(who text, bond text, size text, stars integer) returns void language sql as $$
  insert into public.bond_match_bests as b (player, bond_id, size, best_flips, best_seconds, best_stars)
  values (pg_temp.id(who), bond, size, 10, 30, stars)
  on conflict on constraint bond_match_bests_pkey do update set best_stars = excluded.best_stars $$;
create function pg_temp.mine(who text, lvl text, medal text) returns void language sql as $$
  insert into public.mine_bests as b (player, level, maths, mode, steps, medal, inputs)
  values (pg_temp.id(who), lvl, false, 'steady', 100, medal, 'x')
  on conflict on constraint mine_bests_pkey do update set medal = excluded.medal $$;

select is((select count(*)::integer from public.trophy_types where id in
  ('marble-cup', 'marble-golden', 'bond-star', 'bond-perfect', 'mine-pickaxe', 'decree-crown', 'training-shield')), 7,
  'the seven trophies are there');
select is((select count(*)::integer from public.achievement_types where game in ('marble', 'bond-match')), 6,
  'Marble Rush and Bond Match have three achievements each');

-- ---- Marble Rush ----
-- Gold is 22 s on Boulder Beach (18 s with maths).
select pg_temp.marble('0a', 'boulder-beach', 'up', false, 30);
select ok(pg_temp.has('0a', 'marble-first') and not pg_temp.has('0a', 'marble-gold-1'), 'a first finish gives First roll, not First gold');
select pg_temp.marble('0a', 'boulder-beach', 'up', true, 20);
select ok(not pg_temp.has('0a', 'marble-gold-1'), '20 s with maths is not gold (18 s)');
select pg_temp.marble('0a', 'boulder-beach', 'up', false, 22);
select ok(pg_temp.has('0a', 'marble-gold-1'), '22 s without maths is gold: First gold');
select pg_temp.marble('0a', 'test-easy', 'up', false, 1);
select is((public.marble_counts(pg_temp.id('0a')) ->> 'marble_courses')::integer, 1, 'a practice course is not one of the 8');
select pg_temp.marble('0a', c, 'up', false, 10) from unnest(array['crown-range', 'geyser-valley', 'glacier-run', 'windy-welly',
  'alpine-crossing', 'wide-hill']) c;
select ok(pg_temp.has('0a', 'marble-gold-4') and pg_temp.wins('0a', 'marble-cup') = 0, 'seven golds: Gold rush, no Marble Cup yet');
select pg_temp.marble('0a', 'gap-and-ice', 'up', false, 10);
select is(pg_temp.wins('0a', 'marble-cup'), 1, 'the eighth gold gives the Marble Cup');
select pg_temp.marble('0a', 'gap-and-ice', 'up', false, 9);
select pg_temp.marble('0a', 'gap-and-ice', 'down', false, 9);
select is(pg_temp.wins('0a', 'marble-cup'), 1, 'a faster gold, or the same course gold in hard mode, gives no second cup');
select pg_temp.marble('0a', c, 'down', false, 10) from unnest(array['boulder-beach', 'crown-range', 'geyser-valley', 'glacier-run',
  'windy-welly', 'alpine-crossing']) c;
select pg_temp.marble('0a', 'wide-hill', 'down', true, 20);
select is(pg_temp.wins('0a', 'marble-golden'), 0, 'seven hard golds and a hard run with maths that is too slow: no Golden Marble');
select pg_temp.marble('0a', 'wide-hill', 'down', true, 19);
select is(pg_temp.wins('0a', 'marble-golden'), 1, 'the eighth hard gold gives the Golden Marble picture');

-- ---- Bond Match ----
insert into public.bond_match_games (player, run_id, bond_id, size, seed, flips, flip_count, seconds, stars, counts_for_points)
values (pg_temp.id('0b'), gen_random_uuid(), 'whole-10', 'small', 1, '{1,2}', 1, 20, 2, false);
select ok(pg_temp.has('0b', 'bond-first') and not pg_temp.has('0b', 'bond-three'), 'a finished game gives First match');
select pg_temp.bond('0b', 'whole-10', 'small', 3);
select ok(pg_temp.has('0b', 'bond-three'), 'a three-star board gives Three stars');
-- 16 sets × 3 sizes: 3 stars on 23 boards and 2 on one = 71.
select pg_temp.bond('0b', b.id, s.size, 3) from (select distinct bond_id as id from (values ('whole-20'), ('whole-100-tens'),
  ('whole-100-any'), ('whole-1000-hundreds'), ('whole-1000-tens'), ('decimal-1-tenths'), ('decimal-1-hundredths')) v(bond_id)) b,
  (values ('small'), ('medium'), ('large')) s(size);
select pg_temp.bond('0b', 'whole-10', 'medium', 3);
select pg_temp.bond('0b', 'whole-10', 'large', 2);
select is((public.bond_match_counts(pg_temp.id('0b')) ->> 'bond_match_stars')::integer, 71, '71 stars');
select ok(pg_temp.has('0b', 'bond-stars-36') and pg_temp.wins('0b', 'bond-star') = 0, '71 stars: Star collector, no Bond Star yet');
select pg_temp.bond('0b', 'whole-10', 'large', 3);
select is(pg_temp.wins('0b', 'bond-star'), 1, 'the 72nd star gives the Bond Star');
select pg_temp.bond('0b', b.id, s.size, 3) from (values ('decimal-10-tenths'), ('fraction-halves'), ('fraction-thirds'),
  ('fraction-quarters'), ('fraction-fifths'), ('fraction-sixths'), ('fraction-eighths'), ('fraction-tenths')) b(id),
  (values ('small'), ('medium'), ('large')) s(size);
select is(pg_temp.wins('0b', 'bond-perfect') + pg_temp.wins('0b', 'bond-star'), 2, 'all 144 stars give the Perfect Match picture, and no second Bond Star');

-- ---- Mine Runner on hard ----
select pg_temp.mine('0a', 'l' || n || ':hard', 'gold') from generate_series(1, 5) n;
select pg_temp.mine('0a', 'l6:hard', 'silver');
select pg_temp.mine('0a', 'l' || n, 'gold') from generate_series(1, 6) n;
select ok(pg_temp.wins('0a', 'mine-lamp') = 1 and pg_temp.wins('0a', 'mine-pickaxe') = 0,
  'all 6 plain golds give the lamp; five hard golds give no pickaxe');
select pg_temp.mine('0a', 'l6:hard', 'gold');
select is(pg_temp.wins('0a', 'mine-pickaxe') * 10 + pg_temp.wins('0a', 'mine-lamp'), 11, 'the sixth hard gold gives the Golden Pickaxe');

-- ---- Royal Decree ----
insert into public.decree_reigns (player, look, reign, answered) values (pg_temp.id('0b'), 'ruler-girl-1', '{}',
  (select jsonb_object_agg(n::text, jsonb_build_object('value', 1, 'right', n <> 4)) from generate_series(0, 7) n));
update public.decree_reigns set status = 'full', finished_at = now() where player = pg_temp.id('0b') and status = 'playing';
select ok(pg_temp.wins('0b', 'decree-seal') = 1 and pg_temp.wins('0b', 'decree-crown') = 0, 'a full reign with 7 riddles right: Seal, no Crown');
delete from public.trophies where player = pg_temp.id('0b') and trophy = 'decree-seal';
insert into public.decree_reigns (player, look, reign, answered) values (pg_temp.id('0b'), 'ruler-girl-1', '{}',
  (select jsonb_object_agg(n::text, jsonb_build_object('value', 1, 'right', true)) from generate_series(0, 7) n));
update public.decree_reigns set status = 'over', finished_at = now() where player = pg_temp.id('0b') and status = 'playing';
select is(pg_temp.wins('0b', 'decree-crown'), 0, 'all riddles right in a reign that ends early: no Crown');
insert into public.decree_reigns (player, look, reign, answered) values (pg_temp.id('0b'), 'ruler-girl-1', '{}',
  (select jsonb_object_agg(n::text, jsonb_build_object('value', 1, 'right', true)) from generate_series(0, 7) n));
update public.decree_reigns set status = 'full', finished_at = now() where player = pg_temp.id('0b') and status = 'playing';
select is((select string_agg(season::text, ',') from public.trophies where player = pg_temp.id('0b') and trophy = 'decree-crown'),
  public.hub_season(1)::text, 'a full reign with all 8 right gives the Royal Crown in the hub season');

-- ---- Training ----
insert into public.training_sessions (player, kind, seed, answers, finished_at)
select pg_temp.id('0a'), 'quick', n, 12, now() from generate_series(1, 25) n;
insert into public.training_sessions (player, kind, seed, answers, finished_at)
select pg_temp.id('0a'), 'facts', n, 20, now() from generate_series(1, 19) n;
select is(pg_temp.wins('0a', 'training-shield'), 0, '19 facts sessions (and Quick looks rounds) give no shield');
insert into public.training_sessions (player, kind, seed, answers, finished_at) values (pg_temp.id('0a'), 'facts', 1, 20, now())
on conflict (player, kind, seed) do update set finished_at = excluded.finished_at;
select is(pg_temp.wins('0a', 'training-shield'), 0, 'the same session sent again counts once');
insert into public.training_sessions (player, kind, seed, answers, finished_at) values (pg_temp.id('0a'), 'facts', 20, 20, now());
select is((select string_agg(season::text, ',') from public.trophies where player = pg_temp.id('0a') and trophy = 'training-shield'),
  public.hub_season(1)::text, 'the 20th facts session of the season gives the Times Tables Shield');

-- ---- Pupils ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.marble_counts('00000000-0000-0000-0000-00000000000a') $$, '42501', null,
  'a pupil cannot call a trophy helper');
select pg_temp.reset();

select * from finish();
rollback;
