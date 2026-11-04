-- Unlimited turns today (migration 20261105000200): a per-class switch for each game. Off to start; a student can't change
-- it; a teacher changes only a class they teach and only that game; it is on for today's NZ date only; the games can read it.
-- Run on a throw-away copy: scripts/scratch-db.sh unlimited, then
--   scripts/scratch-test.sh unlimited supabase/tests/database/unlimited_turns.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

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

-- Cat is in Room Two, which Fin teaches (Fin teaches nothing else). Ana stays in the school's Everyone class.
insert into public.classes (school_id, name, school_year, warp_code)
values ((select school_id from public.profiles where id = pg_temp.id('0a')), 'Room Two', 2026, 'CDFGH');
update public.class_members set class_id = (select id from public.classes where name = 'Room Two') where student_id = pg_temp.id('0c');
delete from public.class_teachers where teacher_id = pg_temp.id('0f');
insert into public.class_teachers (class_id, teacher_id) values ((select id from public.classes where name = 'Room Two'), pg_temp.id('0f'));
select public.give_class_settings((select id from public.classes where name = 'Room Two'));
select set_config('test.room_two', (select id::text from public.classes where name = 'Room Two'), true);
select set_config('test.ana_class', (select class_id::text from public.class_members where student_id = pg_temp.id('0a')), true);

select is((select count(*)::integer from public.app_settings where unlimited_days <> '{}'), 0, 'the switches start off everywhere');

select pg_temp.cat();
select throws_ok(format('select public.teacher_set_unlimited_today(%L, true, %L)', 'trader', current_setting('test.room_two')),
  null, null, 'a student cannot switch one on');
select throws_ok($$ select public.unlimited_today(null, 'trader') $$, '42501', null, 'a student cannot ask about any player directly');
select pg_temp.reset();

select pg_temp.fin();
select throws_ok(format('select public.teacher_set_unlimited_today(%L, true, %L)', 'chess', current_setting('test.room_two')),
  '22023', null, 'only the games with a daily limit have one');
select throws_ok(format('select public.teacher_set_unlimited_today(%L, true, %L)', 'trader', current_setting('test.ana_class')),
  '42501', null, 'a teacher cannot switch one on for a class they don''t teach');
select lives_ok(format('select public.teacher_set_unlimited_today(%L, true, %L)', 'trader', current_setting('test.room_two')), 'a teacher switches Star Trader on for their class');
select pg_temp.reset();
select is(public.unlimited_games(pg_temp.id('0c')), '["trader"]'::jsonb, '... only Star Trader, for today');
select is(public.unlimited_today(pg_temp.id('0c'), 'trader') and not public.unlimited_today(pg_temp.id('0a'), 'trader'), true, '... only for that class');

update public.app_settings set unlimited_days = jsonb_build_object('trader', to_char((now() at time zone 'Pacific/Auckland')::date - 1, 'YYYY-MM-DD'))
where class_id = current_setting('test.room_two')::uuid;
select is(public.unlimited_today(pg_temp.id('0c'), 'trader'), false, 'yesterday''s switch is off today');

select pg_temp.fin();
select lives_ok(format('select public.teacher_set_unlimited_today(g, true, %L) from unnest(array[%L, %L, %L]) g', current_setting('test.room_two'), 'dragon-maths', 'clan-quest', 'monsters'), 'three more switched on');
select lives_ok(format('select public.teacher_set_unlimited_today(%L, false, %L)', 'trader', current_setting('test.room_two')), 'and Star Trader off');
select pg_temp.reset();
select is((public.clans_settings(pg_temp.id('0c')) ->> 'unlimitedToday')::boolean
  and (public.monster_battle_rules(pg_temp.id('0c')) ->> 'unlimitedToday')::boolean
  and (public.lord_server_settings(pg_temp.id('0c')) ->> 'unlimitedToday')::boolean
  and not public.unlimited_today(pg_temp.id('0c'), 'trader'), true, 'the games'' settings say so');

select * from finish();
rollback;
