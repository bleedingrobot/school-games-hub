-- Diamond Drop rare gems (migration 20261118003400_diamond_rare_gems.sql): the new counts, the Rare Gem Cup's three steps,
-- the Phoenix Gem picture, and that nothing is given twice.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');

create function pg_temp.has(trophy text) returns integer language sql as $$
  select count(*)::integer from public.trophies w where w.player = '00000000-0000-0000-0000-00000000000a' and w.trophy = has.trophy
$$;
create function pg_temp.cup() returns integer language sql as $$
  select c.level from public.trophy_counts('00000000-0000-0000-0000-00000000000a') c where c.trophy = 'diamond-rare-cup'
$$;
create function pg_temp.rare(variadic gems text[]) returns jsonb language sql as $$
  select jsonb_build_object('lifetime', jsonb_build_object('rare',
    coalesce((select jsonb_object_agg(g, jsonb_build_object('count', 2, 'first', '2026-11-18')) from unnest(gems) g), '{}')))
$$;

select is((select count(*)::integer from public.achievement_types where game = 'diamond' and (measure like 'diamond_rare%' or measure = 'diamond_phoenix')), 5, 'five rare gem achievements');

insert into public.diamond_players (player, state) values ('00000000-0000-0000-0000-00000000000a', pg_temp.rare('moonstone', 'sunstone'));
select is(public.diamond_counts('00000000-0000-0000-0000-00000000000a') -> 'diamond_rare_kinds', '2'::jsonb, 'two kinds counted');
select is(public.diamond_counts('00000000-0000-0000-0000-00000000000a') -> 'diamond_rare_total', '4'::jsonb, '... four rare gems in all');
select is(pg_temp.cup(), null, 'two kinds: no Rare Gem Cup yet');

update public.diamond_players set state = pg_temp.rare('moonstone', 'sunstone', 'frostCrystal') where player = '00000000-0000-0000-0000-00000000000a';
select is(pg_temp.cup(), 1, 'three kinds: a bronze Rare Gem Cup');

update public.diamond_players set state = pg_temp.rare('moonstone', 'sunstone', 'frostCrystal', 'rainbowOpal', 'phoenixGem') where player = '00000000-0000-0000-0000-00000000000a';
select is(pg_temp.cup(), 2, 'five kinds: silver');
select is(pg_temp.has('diamond-phoenix'), 1, 'the Phoenix Gem gives its picture');
select is(public.diamond_counts('00000000-0000-0000-0000-00000000000a') -> 'diamond_phoenix', '2'::jsonb, '... and counts for Phoenix Finder');

update public.diamond_players set state = pg_temp.rare('moonstone', 'sunstone', 'frostCrystal', 'rainbowOpal', 'dragonEye', 'galaxyGem', 'phoenixGem') where player = '00000000-0000-0000-0000-00000000000a';
select is(pg_temp.cup(), 3, 'all seven: gold');
update public.diamond_players set version = version + 1, state = state where player = '00000000-0000-0000-0000-00000000000a';
select is(pg_temp.has('diamond-phoenix'), 1, 'saving again gives no second Phoenix picture');

-- A gem page with a broken count is not counted.
select is(public.diamond_rare_kinds('{"lifetime": {"rare": {"moonstone": {"count": "lots"}, "sunstone": {"count": 0}}}}'), 0, 'broken or empty pages count as nothing');

select * from finish();
rollback;
