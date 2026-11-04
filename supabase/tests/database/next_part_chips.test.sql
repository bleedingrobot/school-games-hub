-- The "next part" chips (migration 20261105000400_next_part_chips.sql): hub_games.day_fn and my_next_parts().
-- Run on a throw-away copy: scripts/scratch-db.sh chips, then scripts/scratch-test.sh chips supabase/tests/database/next_part_chips.test.sql
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
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.nz_today() returns date language sql as $$ select (now() at time zone 'Pacific/Auckland')::date $$;

-- ---- The four games have the hook ----
select is((select array_agg(id order by id) from public.hub_games where day_fn is not null),
  array['beanstalk', 'hop', 'korora', 'pipi'], 'the four daily games have the day hook');
select throws_ok($$ update public.hub_games set day_fn = 'public.beanstalk_last_played(uuid)' where id = 'beanstalk' $$,
  '22023', null, 'a hook with the wrong shape is refused');

-- ---- Ana changed a leaf today and a lily pad yesterday; Ben has never played ----
insert into public.beanstalk_progress (player, days_done, last_leaf_day) values ('00000000-0000-0000-0000-00000000000a', 3, pg_temp.nz_today());
insert into public.hop_progress (player, days_done, last_pad_day) values ('00000000-0000-0000-0000-00000000000a', 2, pg_temp.nz_today() - 1);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is((public.my_next_parts() ->> 'beanstalk')::boolean, true, 'today''s leaf is done');
select is((public.my_next_parts() ->> 'hop')::boolean, false, 'yesterday''s lily pad means today''s is ready');
select is((public.my_next_parts() ->> 'pipi')::boolean, false, 'a game never played is ready');
select is((public.my_next_parts() ->> 'korora')::boolean, false, '... in every game');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is(public.my_next_parts(), '{"beanstalk": false, "hop": false, "korora": false, "pipi": false}'::jsonb, 'Ben sees only his own days');
select throws_ok($$ select public.korora_last_day('00000000-0000-0000-0000-00000000000a') is not null $$, '42501', null,
  'a pupil can''t read another pupil''s progress through a hook');
select pg_temp.reset();

select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select public.my_next_parts() $$, '42501', null, 'not signed in can''t call it');
select pg_temp.reset();

select * from finish();
rollback;
