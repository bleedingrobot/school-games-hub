-- Own names last 3 weeks (migration 20261128100105_own_names_last_3_weeks.sql): a typed name goes back to a made-up one
-- 3 weeks after the teacher's Yes; unused scrolls never run out; teachers' names never run out.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000e';
update public.schools set default_class = null;
delete from public.class_members;
delete from public.class_teachers;

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000000' || who)::uuid $$;
create function pg_temp.ana() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz') $$;
create function pg_temp.ben() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz') $$;
create function pg_temp.teacher() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz') $$;
create function pg_temp.name_of(who text) returns text language sql as $$ select display_name from public.profiles where id = pg_temp.id(who) $$;

select pg_temp.teacher();
create temp table made as select public.teacher_create_class('Room 12', 2026, 5) as id;
grant all on made to authenticated;
select public.teacher_add_to_class((select id from made), array[pg_temp.id('a'), pg_temp.id('b')]);
select public.teacher_give_name_scroll(pg_temp.id('a'));
select pg_temp.reset();
create temp table ana_first as select pg_temp.name_of('a') as name;

-- ---- A Yes starts the 3 weeks ----
select pg_temp.ana();
select public.ask_for_my_name('Sparky Star');
select ok(public.my_name_status() -> 'typedUntil' = 'null'::jsonb, 'nothing runs out while the name waits');
select pg_temp.teacher();
select public.teacher_answer_name((select id from public.teacher_name_requests() where student_id = pg_temp.id('a')), true);
select ok((public.teacher_name_scrolls(pg_temp.id('a')) ->> 'typedUntil')::timestamptz between now() + interval '20 days 23 hours'
  and now() + interval '21 days 1 hour', 'the teacher sees it lasts 3 weeks');
select pg_temp.ana();
select ok((public.my_name_status() ->> 'typedUntil')::timestamptz > now() + interval '20 days', '... and so does the pupil');
select throws_ok($$ select * from public.own_name_ends $$, '42501', null, 'pupils cannot read the table');
select throws_ok($$ select public.end_own_names() $$, '42501', null, '... or end names');
select throws_ok(format('select public.own_name_back(%L)', pg_temp.id('b')), '42501', null, '... or put a name back');
select pg_temp.reset();

-- ---- Not yet, then gone ----
select is(public.end_own_names(), 0, 'nothing goes back before 3 weeks');
select is(pg_temp.name_of('a'), 'Sparky Star', '... so the name stays');
update public.own_name_ends set ends_at = now() - interval '1 minute' where player = pg_temp.id('a');
select is(public.end_own_names(), 1, 'after 3 weeks it goes back');
select is(pg_temp.name_of('a'), (select name from ana_first), '... to their last made-up name');
select is((select count(*)::integer from public.own_name_ends where player = pg_temp.id('a')), 0, '... and the row is gone');

-- ---- Unused scrolls keep; teachers keep their names ----
select pg_temp.teacher();
select public.teacher_give_name_scroll(pg_temp.id('b'));
select pg_temp.reset();
update public.name_scrolls set given_at = now() - interval '60 days' where player = pg_temp.id('b');
select pg_temp.ben();
select is((public.my_name_status() ->> 'scrolls')::integer, 1, 'an old unused scroll still works');
select pg_temp.reset();
update public.profiles set display_name = 'Mr Teacher' where id = pg_temp.id('e');
select is((select count(*)::integer from public.own_name_ends where player = pg_temp.id('e')), 0, 'a teacher''s name never runs out');

select * from finish();
rollback;
