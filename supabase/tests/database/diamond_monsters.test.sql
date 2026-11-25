-- Diamond Drop Monster Dig (migration 20261125000400_diamond_monsters.sql): the new counts, the Monster Book trophy's
-- three steps, the Full Monster Book picture, and that nothing is given twice.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000b', 'bo@douglaspark.school.nz');

create function pg_temp.has(trophy text) returns integer language sql as $$
  select count(*)::integer from public.trophies w where w.player = '00000000-0000-0000-0000-00000000000b' and w.trophy = has.trophy
$$;
create function pg_temp.cup() returns integer language sql as $$
  select c.level from public.trophy_counts('00000000-0000-0000-0000-00000000000b') c where c.trophy = 'diamond-monster-book'
$$;
-- A book with the first n of these ids (made-up ids beyond the real ones only pad the count).
create function pg_temp.book(n integer, extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('lifetime', jsonb_build_object('monsters',
    coalesce((select jsonb_object_agg('m' || i, jsonb_build_object('count', 1, 'first', '2026-11-25')) from generate_series(1, n) i), '{}') || extra))
$$;
create function pg_temp.count(measure text) returns jsonb language sql as $$
  select public.diamond_counts('00000000-0000-0000-0000-00000000000b') -> measure
$$;

select is((select count(*)::integer from public.achievement_types where game = 'diamond' and measure like 'diamond_monster%'), 7, 'seven Monster Dig achievements');

insert into public.diamond_players (player, state)
values ('00000000-0000-0000-0000-00000000000b', pg_temp.book(2, '{"napsea-2": {"count": 1, "first": "2026-11-25", "shiny": 1}, "equalizard-1": {"count": 2, "first": "2026-11-25"}}'));
select is(pg_temp.count('diamond_monster_kinds'), '4'::jsonb, 'four kinds counted');
select is(pg_temp.count('diamond_monster_total'), '5'::jsonb, '... five monsters in all');
select is(pg_temp.count('diamond_monster_shiny') || pg_temp.count('diamond_monster_giant') || pg_temp.count('diamond_monster_ultra'), '[1, 1, 1]'::jsonb, '... a shiny, a giant and an ultra');
select is(pg_temp.cup(), null, 'four kinds: no trophy yet');

update public.diamond_players set state = pg_temp.book(40) where player = '00000000-0000-0000-0000-00000000000b';
select is(pg_temp.cup(), 2, 'forty kinds: silver');

update public.diamond_players set state = pg_temp.book(75) where player = '00000000-0000-0000-0000-00000000000b';
select is(pg_temp.cup(), 3, 'all 75: gold');
update public.diamond_players set version = version + 1, state = state where player = '00000000-0000-0000-0000-00000000000b';
select is(pg_temp.has('diamond-monster-full'), 1, 'the Full Monster Book picture, once, even after saving again');

select is(public.diamond_monster_kinds('{"lifetime": {"monsters": {"digibud-1": {"count": "lots"}, "divvy-1": {"count": 0}}}}'), 0, 'broken or empty pages count as nothing');

select * from finish();
rollback;
