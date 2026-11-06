-- Archery Challenge (migration 20261106000400): "Snooze for 30 min" on a classmate's challenge. Snoozing says no, and the
-- sender can't challenge that pupil again until it runs out; the other way round still works. Pupils can't snooze
-- without the server or read the snoozes.
-- Run on a throw-away copy: scripts/scratch-db.sh archery, then
--   scripts/scratch-test.sh archery supabase/tests/database/archery_snooze.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

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
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || who)::uuid $$;
create function pg_temp.duel(seed bigint) returns public.archery_duels language sql as $$ select * from public.archery_duels where archery_duels.seed = duel.seed $$;

update public.app_settings set archery_enabled = true;
insert into public.archery_here (player) values (pg_temp.id('0a')), (pg_temp.id('0b'));

-- ---- Pupils can't snooze without the server, or read snoozes ----
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select throws_ok($$ select public.archery_duel_snooze(auth.uid(), 1, 1800000) $$, '42501', null, 'a pupil cannot snooze without the server');
select throws_ok($$ select * from public.archery_snoozes $$, '42501', null, '... or read who snoozed whom');
select pg_temp.reset();

-- ---- Ana challenges Ben; Ben snoozes her ----
select pg_temp.act_as_server();
select is(public.archery_duel_challenge(pg_temp.id('0a'), 'snooze-req-01', pg_temp.id('0b'), 'forest', 201, 60000) ->> 'result', 'ok', 'Ana challenges Ben');
select is(public.archery_duel_snooze(pg_temp.id('0a'), (pg_temp.duel(201)).id, 1800000) ->> 'result', 'not-yours', 'only the challenged pupil can snooze');
select is(public.archery_duel_snooze(pg_temp.id('0b'), (pg_temp.duel(201)).id, 1800000) -> 'duel' ->> 'status', 'declined', 'Ben snoozes: the challenge is said no to');
select is(public.archery_duel_challenge(pg_temp.id('0a'), 'snooze-req-02', pg_temp.id('0b'), 'forest', 202, 60000) ->> 'result', 'snoozed',
  'Ana cannot challenge Ben again while snoozed');
select is(public.archery_duel_challenge(pg_temp.id('0b'), 'snooze-req-03', pg_temp.id('0a'), 'forest', 203, 60000) ->> 'result', 'ok',
  'Ben can still challenge Ana');
select pg_temp.reset();

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(public.archery_here() -> 'online' -> 0 ->> 'snoozed', 'true', 'Ana''s list says Ben has snoozed her');
select pg_temp.reset();

-- ---- When the snooze runs out, Ana can challenge again ----
update public.archery_snoozes set until = now() - interval '1 second';
update public.archery_duels set status = 'cancelled' where seed = 203;
select pg_temp.act_as_server();
select is(public.archery_duel_challenge(pg_temp.id('0a'), 'snooze-req-04', pg_temp.id('0b'), 'forest', 204, 60000) ->> 'result', 'ok',
  'after 30 minutes Ana can challenge Ben again');
select pg_temp.reset();

select * from finish();
rollback;
