-- Game kit: which kinds of go a child has seen (migration 20261108000300).
-- Pupils can't reach any of it; the server key can mark and read.
-- Run on a throw-away copy: scripts/scratch-db.sh kitseen, then scripts/scratch-test.sh kitseen supabase/tests/database/kit_seen.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');

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

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok($$ select * from public.kit_seen $$, '42501', null, 'a pupil cannot read the seen list');
select throws_ok($$ select public.kit_seen_get(auth.uid(), 'robin') $$, '42501', null, '... or ask for it');
select throws_ok($$ select public.kit_seen_mark(auth.uid(), 'robin', array['zoom']) $$, '42501', null, '... or mark anything seen');

select pg_temp.act_as_server();
select is(public.kit_seen_get('00000000-0000-0000-0000-00000000000a', 'robin'), '{}'::text[], 'a new pupil has seen nothing');
select is(public.kit_seen_mark('00000000-0000-0000-0000-00000000000a', 'robin', array['zoom', 'swap']), array['swap', 'zoom'], 'the server can mark kinds, sorted');
select is(public.kit_seen_mark('00000000-0000-0000-0000-00000000000a', 'robin', array['zoom']), array['swap', 'zoom'], 'marking a kind twice leaves one');
select throws_ok($$ select public.kit_seen_mark('00000000-0000-0000-0000-00000000000a', 'robin', array['Bad Kind']) $$, '22023', null, 'a bad kind name is refused');
select is(public.kit_seen_get('00000000-0000-0000-0000-00000000000a', 'parrot'), '{}'::text[], 'two games keep separate lists');
select throws_ok($$ select public.kit_seen_get('00000000-0000-0000-0000-000000000099', 'robin') $$, '22023', null, 'nobody who is not a pupil');

select pg_temp.reset();
delete from public.profiles where id = '00000000-0000-0000-0000-00000000000a';
select is((select count(*)::int from public.kit_seen), 0, 'deleting the profile removes the row');
select is((select count(*)::int from public.kit_seen where game = 'parrot'), 0, '... and nothing was made for the other game');

select * from finish();
rollback;
