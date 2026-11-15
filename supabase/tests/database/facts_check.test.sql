-- The basic facts check (migration 20261115000100): facts_checks, record_facts_check(), my_facts_check() and
-- teacher_facts_checks(). Pupils can't reach the table or the saving function; a check sent twice is saved once and counts
-- as one Training session; a pupil is due again only after the gap; a teacher sees only their own class.
-- Run on a throw-away copy: scripts/scratch-db.sh check, then
--   scripts/scratch-test.sh check supabase/tests/database/facts_check.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'fin@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000f';

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || who)::uuid $$;
create function pg_temp.cat() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz') $$;
create function pg_temp.fin() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fin@douglaspark.school.nz') $$;
-- A check of 24 facts for `who`, `ago` seconds ago, with this many right and quick.
create function pg_temp.save(who uuid, check_id uuid, ago integer, rights integer, quicks integer) returns boolean language sql as $$
  select public.record_facts_check(who, check_id, 1,
    (extract(epoch from now() - make_interval(secs => ago)) * 1000)::bigint, rights, quicks, 2500,
    (select array_agg(case when i <= quicks then 2 when i <= rights then 1 else 0 end) from generate_series(1, 24) i),
    (select jsonb_agg(jsonb_build_object('q', 'x', 'given', 1, 'ms', 3000, 'think', 2000)) from generate_series(1, 24)))
$$;

-- Cat is in Room Two, which Fin teaches. Ana stays in the school's Everyone class.
insert into public.classes (school_id, name, school_year, warp_code)
values ((select school_id from public.profiles where id = pg_temp.id('0a')), 'Room Two', 2026, 'CDFGH');
update public.class_members set class_id = (select id from public.classes where name = 'Room Two') where student_id = pg_temp.id('0c');
delete from public.class_teachers where teacher_id = pg_temp.id('0f');
insert into public.class_teachers (class_id, teacher_id) values ((select id from public.classes where name = 'Room Two'), pg_temp.id('0f'));
select set_config('test.room_two', (select id::text from public.classes where name = 'Room Two'), true);
select set_config('test.ana_class', (select class_id::text from public.class_members where student_id = pg_temp.id('0a')), true);

-- ---- Nobody reaches the table or the saving directly ----
select pg_temp.cat();
select throws_ok($$ select * from public.facts_checks $$, '42501', null, 'pupils cannot read the checks');
select throws_ok($$ select pg_temp.save(auth.uid(), gen_random_uuid(), 0, 24, 24) $$, '42501', null, 'pupils cannot save a check');
select throws_ok(format($$ select public.teacher_facts_checks(%L, 1) $$, current_setting('test.room_two')), '42501', null,
  'pupils cannot read the teacher''s view');
select is((public.my_facts_check(1) ->> 'due')::boolean, true, 'a pupil with no check is due');
select pg_temp.reset();

-- ---- Saving ----
select is(pg_temp.save(pg_temp.id('0c'), '11111111-1111-1111-1111-111111111111', 60, 18, 9), true, 'a check is saved');
select is(pg_temp.save(pg_temp.id('0c'), '11111111-1111-1111-1111-111111111111', 60, 18, 9), false, 'the same check again is not');
select is((select count(*)::integer from public.training_sessions where player = pg_temp.id('0c') and kind = 'facts'), 1,
  'it counts as one Training session');
select throws_ok($$ select pg_temp.save(pg_temp.id('0c'), gen_random_uuid(), 8 * 86400, 18, 9) $$, '22023', null,
  'a check over a week old is refused');
select throws_ok($$ select pg_temp.save(pg_temp.id('0c'), gen_random_uuid(), 0, 5, 9) $$, '22023', null,
  'more quick than right is refused');

-- ---- Due again only after the gap ----
select pg_temp.cat();
select is((public.my_facts_check(1) ->> 'due')::boolean, false, 'not due straight after a check');
select is((public.my_facts_check(1, 0) -> 'last' ->> 'quick')::integer, 9, 'the pupil sees their last check');
select pg_temp.reset();

-- ---- Teachers ----
select pg_temp.fin();
select is((select jsonb_array_length(c -> 'checks') from jsonb_array_elements(public.teacher_facts_checks(current_setting('test.room_two')::uuid, 1)) c
           where c ->> 'id' = pg_temp.id('0c')::text), 1, 'the teacher sees Cat''s check');
select throws_ok(format($$ select public.teacher_facts_checks(%L, 1) $$, current_setting('test.ana_class')), '42501', null,
  'a teacher cannot read a class they don''t teach');
select pg_temp.reset();

select * from finish();
rollback;
