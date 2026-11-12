-- The trophy cabinet (migration 20261112002100_trophy_cabinet.sql; docs/plans/profile/PLAN.md card P5):
-- favourites saved on the server, more "next" spots, and the small read for the "New trophy!" moment.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

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
create function pg_temp.ana() returns void language sql as $$
  select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz') $$;
create function pg_temp.ben() returns void language sql as $$
  select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz') $$;

insert into public.trophy_types (id, game, name, how, kind, repeat, sort)
select 'c-' || n, 'test-game', 'Cup ' || n, 'Do thing ' || n || '.', 'trophy', 'once', 1000 + n
from generate_series(1, 16) n;

select public.award_trophy('00000000-0000-0000-0000-00000000000a', 'c-' || n) from generate_series(1, 4) n;

-- ---- Favourites ----
select pg_temp.ana();
select is(public.set_my_favourite_trophies('{c-2, c-9, c-1}'), '{c-2,c-1}'::text[],
  'favourites keep only trophies I hold, in my order');
select is(public.my_trophies() -> 'favourites', '["c-2", "c-1"]'::jsonb, '... and my cabinet sends them back');
select throws_ok($$ select public.set_my_favourite_trophies('{c-1, c-2, c-3, c-4}') $$, '22023', null, 'four favourites is too many');
select is(public.set_my_favourite_trophies('{}'), '{}'::text[], 'I can clear my favourites');
select throws_ok($$ update public.profiles set trophy_favourites = '{c-1}' $$, '42501', null, '... but not write the column myself');
select pg_temp.reset();

-- ---- More "next" spots ----
select pg_temp.ana();
select ok(jsonb_array_length(public.my_trophies() -> 'next') between 4 and 12, 'next sends more than three, up to twelve');
select is((select count(*)::integer from jsonb_array_elements(public.my_trophies() -> 'next') t where t ->> 'id' in ('c-1', 'c-2', 'c-3', 'c-4')),
  0, '... none of them won already');

-- ---- The "New trophy!" moment ----
select is(jsonb_array_length(public.my_new_trophies()), 4, 'my four new trophies wait to be shown');
select is(public.my_new_trophies() -> 0 ->> 'tier', 'bronze', '... each with its metal');
select pg_temp.ben();
select is(public.my_new_trophies(), '[]'::jsonb, 'a classmate sees none of mine');
select pg_temp.ana();
select public.mark_my_trophies_seen();
select is(public.my_new_trophies(), '[]'::jsonb, 'once shown, they are not shown again');
select pg_temp.reset();
select public.award_trophy('00000000-0000-0000-0000-00000000000a', 'c-5');
select pg_temp.ana();
select is(public.my_new_trophies() -> 0 ->> 'id', 'c-5', 'a later win shows by itself');

select * from finish();
rollback;
