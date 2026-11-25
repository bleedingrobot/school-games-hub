-- Class Live games at set times (migration 20261125000600_classlive_auto.sql; docs/plans/classlive-auto/PLAN.md): only a
-- school admin sets times; the job opens one school-wide room per time per day with no class or teacher; pupils of the
-- school see it in the pop-up; it is closed if nobody moved it on.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'ada@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-0000000000a2', 'tia@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-0000000000a3', 'pip@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2');
update public.profiles set school_admin = true where id = '00000000-0000-0000-0000-0000000000a1';
insert into public.classes (id, school_id, name, school_year, warp_code) values ('00000000-0000-0000-0000-0000000000d1', 1, 'Room Auto', 2026, 'CDFKM');
insert into public.class_members (student_id, class_id, how) values ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000d1', 'teacher')
on conflict (student_id) do update set class_id = excluded.class_id;

create function pg_temp.act_as(id text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
-- A time two minutes from now (NZ), every day, so the job's window (3 minutes before) is open now.
create function pg_temp.soon() returns text language sql as $$
  select to_char((now() at time zone 'Pacific/Auckland')::time + interval '2 minutes', 'HH24:MI')
$$;

select ok(exists (select 1 from cron.job where jobname = 'classlive-auto-open'), 'the job runs every minute');

-- ---- Only an admin sets times ----
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
select throws_ok($$ select public.classlive_times_list() $$, '42501', null, 'a teacher who is not an admin cannot list times');
select throws_ok($$ select public.classlive_times_save('{"days":[1],"at":"12:00","activity":"serpent"}') $$, '42501', null, '... or save one');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.classlive_times_save('{"days":[1],"at":"12:00","activity":"stars"}') $$, '23514', null, 'Star Web cannot start by itself');
select throws_ok($$ select public.classlive_times_save('{"days":[],"at":"12:00","activity":"serpent"}') $$, '22023', null, 'a time needs a day');
select set_config('test.time', public.classlive_times_save(jsonb_build_object('days', '[1,2,3,4,5,6,7]'::jsonb, 'at', pg_temp.soon(),
  'activity', 'serpent', 'length', 5, 'min', 4, 'open', 3, 'host', 'Games Hub', 'level', 'gold'))::text, true);
select is(jsonb_array_length(public.classlive_times_list()), 1, 'the admin sees the time');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a3');
select is((select count(*)::int from public.classlive_times), 0, 'pupils cannot read times');

-- ---- The job opens one room ----
select pg_temp.reset();
select is(public.classlive_auto_open(), 1, 'the job opens a room for a time that is due');
select is(public.classlive_auto_open(), 0, '... only once a day');
select ok(exists (select 1 from public.classlive_rooms r join public.classlive_state s on s.room = r.id
  where r.schedule_id = current_setting('test.time')::bigint and r.class_id is null and r.teacher is null and r.code ~ '^[0-9]{4}$'
    and s.session -> 'auto' ->> 'min' = '4' and s.session -> 'game' = 'null'::jsonb), 'a school-wide room with no class, no teacher and no game yet');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a3');
select like(public.classlive_here() -> 0 ->> 'class', 'Games Hub is starting Serpent Chain', 'a pupil of the school gets the pop-up');

-- ---- Nobody moved it on: closed after its start ----
select pg_temp.reset();
update public.classlive_rooms set starts_at = now() - interval '3 minutes' where schedule_id = current_setting('test.time')::bigint;
select public.classlive_auto_open();
select is((select state from public.classlive_rooms where schedule_id = current_setting('test.time')::bigint), 'over', 'a room still waiting after its start is closed');

select * from finish();
rollback;
