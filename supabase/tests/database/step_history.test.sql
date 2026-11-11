-- P9 (migration 20261111000700): step history. A change to a Foundational game's saved step adds one row to step_changes, the teacher
-- of that class reads the last moves through teacher_foundational_class, and no one else can (no direct reads for anyone).
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

create function pg_temp.uid(n integer) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;
-- Students 1 and 2, teachers 11 (class A: pupil 1) and 12 (class B: pupil 2).
insert into auth.users (id, email)
select pg_temp.uid(n), 's' || n || '@douglaspark.school.nz' from generate_series(1, 2) n;
insert into auth.users (id, email) values
  (pg_temp.uid(11), 't11@douglaspark.school.nz'), (pg_temp.uid(12), 't12@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id in (pg_temp.uid(11), pg_temp.uid(12));
update public.schools set default_class = null;
delete from public.class_members;

create temp table emails as select id, email from auth.users;
grant select on emails to public;
create function pg_temp.as(n integer) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(n),
           'email', (select e.email from pg_temp.emails e where e.id = pg_temp.uid(n)), 'role', 'authenticated')::text, true)
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create temp table made (name text primary key, id uuid);
grant all on made to authenticated, anon;
create function pg_temp.klass(n text) returns uuid language sql as $$ select id from pg_temp.made where name = n $$;

select pg_temp.as(11);
insert into pg_temp.made values ('A', public.teacher_create_class('Room 12', 2026, 5));
select pg_temp.as(12);
insert into pg_temp.made values ('B', public.teacher_create_class('Room 14', 2026, null));
select pg_temp.as(11);
select public.teacher_add_to_class(pg_temp.klass('A'), array[pg_temp.uid(1)]);
select pg_temp.as(12);
select public.teacher_add_to_class(pg_temp.klass('B'), array[pg_temp.uid(2)]);
select pg_temp.reset();

-- A new progress row is not a move; changing the step is.
insert into public.robin_progress (player, step) values (pg_temp.uid(1), 2);
insert into public.hop_progress (player, reached) values (pg_temp.uid(1), 10);
select is((select count(*)::integer from public.step_changes where player = pg_temp.uid(1)), 0, 'a new progress row adds no step change');

update public.robin_progress set step = 3 where player = pg_temp.uid(1);
select is((select count(*)::integer from public.step_changes where player = pg_temp.uid(1) and game = 'robin'), 1, 'robin_progress.step 2 to 3 adds one row');
select is((select step_from || '>' || step_to from public.step_changes where player = pg_temp.uid(1) and game = 'robin'), '2>3', '... from 2 to 3');
select is((select estimated from public.step_changes where player = pg_temp.uid(1) and game = 'robin'), false, '... seen as it happened, not estimated');

update public.robin_progress set days_done = 5 where player = pg_temp.uid(1);
select is((select count(*)::integer from public.step_changes where player = pg_temp.uid(1) and game = 'robin'), 1, 'changing something else adds none');

update public.hop_progress set reached = 5 where player = pg_temp.uid(1);
select is((select step_from || '>' || step_to from public.step_changes where player = pg_temp.uid(1) and game = 'hop'), '10>5', 'Hop keeps the value as saved');

-- ---- Who can read it ----
select pg_temp.as(11);
select is(public.teacher_foundational_class(pg_temp.klass('A')) #>> array[pg_temp.uid(1)::text, 'robin', 'moves', '0', 'to'], '3', 'the class''s teacher sees the move');
select is(public.teacher_foundational_class(pg_temp.klass('A')) #>> array[pg_temp.uid(1)::text, 'robin', 'moves', '0', 'from'], '2', '... with the step before');
select is(public.teacher_foundational_class(pg_temp.klass('A')) #>> array[pg_temp.uid(1)::text, 'robin', 'moves', '0', 'est'], 'false', '... and that it is not an estimate');
select throws_ok($$ select * from public.step_changes $$, '42501', null, 'a teacher cannot read the table directly');
select pg_temp.as(12);
select throws_ok(format('select public.teacher_foundational_class(%L)', pg_temp.klass('A')), '42501', null, 'a teacher of another class cannot read the moves');
select pg_temp.as(1);
select throws_ok($$ select * from public.step_changes $$, '42501', null, 'a pupil cannot read the table');
select pg_temp.reset();

select * from finish();
rollback;
