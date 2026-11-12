-- Trophies for Star Trader, Diamond Drop, Toon Flap, Gem Keep and Mine Runner (migration 20261112002000_trophies_games_2.sql;
-- docs/plans/profile/PLAN.md card P7 part 2). Each game's own record gives its trophy once, when the feat comes true.
-- Run on a throw-away copy: scripts/scratch-db.sh t1, then scripts/scratch-test.sh t1 supabase/tests/database/trophies_games_2.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

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
-- A Toon Flap progress save with this many golds.
create function pg_temp.flap(golds integer) returns jsonb language sql as $$
  select jsonb_build_object('levels', coalesce((select jsonb_object_agg('level' || n,
    jsonb_build_object('finishes', 1, 'medal', case when n <= golds then 'gold' else 'silver' end)) from generate_series(1, 10) n), '{}')) $$;

select is((select count(*)::integer from public.trophy_types where id in
  ('trader-ring', 'trader-blackhole', 'diamond-heart', 'toonflap-rainbow', 'gem-crown', 'mine-lamp')), 6, 'the six trophies are there');

-- ---- Star Trader ----
insert into public.trader_games (player, school_id, season, game, day) values
  (pg_temp.id('0a'), 1, 1, '{"system": {"sun": {"kind": "blackhole", "built": false}, "tech": [{"kind": "dyson", "built": false}]}}', 1);
select is(pg_temp.wins('0a', 'trader-ring') + pg_temp.wins('0a', 'trader-blackhole'), 0, 'planned pieces give nothing');
update public.trader_games set game = '{"system": {"sun": {"kind": "blackhole", "built": true}, "tech": [{"kind": "dyson", "built": false}]}}'
  where player = pg_temp.id('0a');
select is(pg_temp.wins('0a', 'trader-blackhole'), 1, 'building the black hole sun gives the Black Hole picture');
select is(pg_temp.wins('0a', 'trader-ring'), 0, '... but not the Star Ring');
update public.trader_games set game = '{"system": {"sun": {"kind": "blackhole", "built": true}, "tech": [{"kind": "lanes", "built": true}, {"kind": "dyson", "built": true}]}}'
  where player = pg_temp.id('0a');
select is(pg_temp.wins('0a', 'trader-ring'), 1, 'building the Dyson ring gives the Star Ring');
select is((select season from public.trophies where player = pg_temp.id('0a') and trophy = 'trader-ring'), 0, '... a once-a-year trophy');
-- A kept system starts the next season's game already built.
insert into public.trader_systems (player, school_id, season, design, carry, choice)
  select player, 1, 1, game -> 'system', '{}', 'keep' from public.trader_games where player = pg_temp.id('0a');
delete from public.trophies where player = pg_temp.id('0a') and trophy = 'trader-ring';
delete from public.trader_games where player = pg_temp.id('0a');
insert into public.trader_games (player, school_id, season, game, day)
  select player, 1, 2, jsonb_build_object('system', design), 1 from public.trader_systems where player = pg_temp.id('0a');
select is(pg_temp.wins('0a', 'trader-ring'), 0, 'starting a season with a kept ring does not count as building it');

-- ---- Diamond Drop ----
insert into public.diamond_finds (player, season, found_on) values (pg_temp.id('0b'), 1, public.nz_day(now()));
select is(pg_temp.wins('0b', 'diamond-heart'), 1, 'finding the Heart Diamond gives the Heart Diamond picture');
insert into public.diamond_finds (player, season, found_on) values (pg_temp.id('0b'), 2, public.nz_day(now()));
select is(pg_temp.wins('0b', 'diamond-heart'), 1, '... once a year');

-- ---- Toon Flap ----
insert into public.toonflap_progress (player, progress) values (pg_temp.id('0a'), pg_temp.flap(9));
select is(pg_temp.wins('0a', 'toonflap-rainbow'), 0, 'nine golds give no Rainbow Toon');
update public.toonflap_progress set progress = pg_temp.flap(10) where player = pg_temp.id('0a');
select is(pg_temp.wins('0a', 'toonflap-rainbow'), 1, 'the tenth gold gives the Rainbow Toon picture');
delete from public.trophies where player = pg_temp.id('0a') and trophy = 'toonflap-rainbow';
update public.toonflap_progress set progress = pg_temp.flap(10) || '{"potions": 2}' where player = pg_temp.id('0a');
select is(pg_temp.wins('0a', 'toonflap-rainbow'), 0, 'saving again with the golds already held gives nothing');

-- ---- Gem Keep ----
insert into public.gem_keep_progress (player, level_id, best_stars, key_passed)
  select pg_temp.id('0b'), 'level-' || n, 3, n < 10 from generate_series(1, 10) n;
select is(pg_temp.wins('0b', 'gem-crown'), 0, '30 stars and 9 keys give no Gem Crown');
update public.gem_keep_progress set best_stars = 2 where player = pg_temp.id('0b') and level_id = 'level-3';
update public.gem_keep_progress set key_passed = true where player = pg_temp.id('0b') and level_id = 'level-10';
select is(pg_temp.wins('0b', 'gem-crown'), 0, '29 stars and 10 keys give no Gem Crown');
update public.gem_keep_progress set best_stars = 3 where player = pg_temp.id('0b') and level_id = 'level-3';
select is(pg_temp.wins('0b', 'gem-crown'), 1, 'the 30th star with all 10 keys gives the Gem Crown picture');
update public.gem_keep_progress set plays = plays + 1, best_stars = 3 where player = pg_temp.id('0b') and level_id = 'level-5';
select is(pg_temp.wins('0b', 'gem-crown'), 1, '... once');

-- ---- Mine Runner ----
insert into public.mine_bests (player, level, maths, mode, steps, medal, inputs)
  select pg_temp.id('0a'), 'l' || n, n % 2 = 0, 'steady', 100, case when n < 6 then 'gold' else 'silver' end, 'x'
  from generate_series(1, 6) n;
insert into public.mine_bests (player, level, maths, mode, steps, medal, inputs) values
  (pg_temp.id('0a'), 'l6:hard', false, 'steady', 100, 'gold', 'x'),
  (pg_temp.id('0a'), 'l5', true, 'steady', 90, 'gold', 'x');
select is(pg_temp.wins('0a', 'mine-lamp'), 0, 'five plain golds and a hard gold give no Miner''s Lamp');
update public.mine_bests set medal = 'gold', steps = 80 where player = pg_temp.id('0a') and level = 'l6';
select is(pg_temp.wins('0a', 'mine-lamp'), 1, 'gold in the sixth mine gives the Miner''s Lamp');
update public.mine_bests set steps = 70 where player = pg_temp.id('0a') and level = 'l6';
insert into public.mine_bests (player, level, maths, mode, steps, medal, inputs) values (pg_temp.id('0a'), 'l6', false, 'steady', 60, 'gold', 'x');
select is(pg_temp.wins('0a', 'mine-lamp'), 1, '... once a year');

-- ---- Pupils ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select public.toonflap_golds('{}') $$, '42501', null, 'a pupil cannot call a trophy helper');
select pg_temp.reset();

select * from finish();
rollback;
