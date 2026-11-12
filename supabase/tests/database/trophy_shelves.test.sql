-- Trophies around the hub (migration 20261112002500_trophy_shelves.sql; docs/plans/profile/PLAN.md card P6):
-- a schoolmate's trophy count and favourite three, by made-up name, and nothing from another school.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select setval(pg_get_serial_sequence('public.schools', 'id'), (select max(id) from public.schools));
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id)
  values ('otherschool.school.nz', (select id from public.schools where name = 'Other School'));

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'far@otherschool.school.nz');

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.name(who text) returns text language sql as $$
  select display_name from public.profiles where id = ('00000000-0000-0000-0000-0000000000' || who)::uuid $$;

insert into public.trophy_types (id, game, name, how, kind, repeat, sort)
select 's-' || n, 'test-game', 'Shelf ' || n, 'Do thing ' || n || '.', 'trophy', 'season', 2000 + n
from generate_series(1, 4) n;

-- Ana: three different trophies, s-1 won twice (silver); Far (another school) holds one.
select public.award_trophy('00000000-0000-0000-0000-00000000000a', 's-' || n) from generate_series(1, 3) n;
insert into public.trophies (player, trophy, season, year) values ('00000000-0000-0000-0000-00000000000a', 's-1', 99, 2026);
select public.award_trophy('00000000-0000-0000-0000-00000000000f', 's-1');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select public.set_my_favourite_trophies('{s-1, s-3}');
select pg_temp.reset();

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is((public.trophy_shelves(array[pg_temp.name('0a')]) -> pg_temp.name('0a') ->> 'count')::integer, 3,
  'a classmate sees how many different trophies Ana holds');
select is(public.trophy_shelves(array[pg_temp.name('0a')]) -> pg_temp.name('0a') -> 'favourites' -> 0 ->> 'id', 's-1',
  '... and her favourites, in her order');
select is(public.trophy_shelves(array[pg_temp.name('0a')]) -> pg_temp.name('0a') -> 'favourites' -> 0 ->> 'tier', 'silver',
  '... with the metal');
select ok(not (public.trophy_shelves(array[pg_temp.name('0a')]) -> pg_temp.name('0a') -> 'favourites' -> 0) ? 'detail',
  '... but never the detail of a win');
select is((public.trophy_shelves(array[pg_temp.name('0b')]) -> pg_temp.name('0b') ->> 'count')::integer, 0,
  'a pupil with none shows 0');
select is(public.trophy_shelves(array[pg_temp.name('0f')]), '{}'::jsonb, 'nothing about a pupil in another school');
select throws_ok($$ select public.trophy_shelves(array_fill('x'::text, array[61])) $$, '22023', null, 'at most 60 names at once');
select pg_temp.reset();

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is((public.my_home_page() -> 'trophyShelf' ->> 'count')::integer, 3, 'the home page''s one answer carries my own shelf');
select pg_temp.reset();

select * from finish();
rollback;
