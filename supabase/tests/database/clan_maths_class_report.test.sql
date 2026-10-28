-- Clan Quest's class report for one class (migration 20261028000500): teacher_clan_maths_class(target_class).
-- A teacher sees only the class asked for (how many answered, every kind of question, the hardest kinds), can't read a class
-- they don't teach, and a pupil and a signed-out visitor can't call it.
-- The old call with no class is gone (migration 20261028000600).
-- Run on a throw-away copy: scripts/scratch-db.sh clanclass, then
--   scripts/scratch-test.sh clanclass supabase/tests/database/clan_maths_class_report.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'bea@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'dan@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'fin@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-000000000010', 'gus@douglaspark.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000e';
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000f';

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || who)::uuid $$;
create function pg_temp.ana() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz') $$;
create function pg_temp.eve() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz') $$;
create function pg_temp.fin() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fin@douglaspark.school.nz') $$;
create function pg_temp.keys(report jsonb, part text) returns jsonb language sql as $$
  select coalesce(jsonb_agg(e ->> 'key' order by e ->> 'key'), '[]') from jsonb_array_elements(report -> part) e
$$;
create function pg_temp.report() returns jsonb language sql as $$ select current_setting('test.report')::jsonb $$;

-- Cat and Dan are in Room Two and Gus in Room Three; Fin teaches both (and nothing else). Ana and Bea stay in the school's
-- Everyone class.
insert into public.classes (school_id, name, school_year, warp_code)
values ((select school_id from public.profiles where id = pg_temp.id('0a')), 'Room Two', 2026, 'CDFGH'),
       ((select school_id from public.profiles where id = pg_temp.id('0a')), 'Room Three', 2026, 'JKMNP');
update public.class_members set class_id = (select id from public.classes where name = 'Room Two')
where student_id in (pg_temp.id('0c'), pg_temp.id('0d'));
update public.class_members set class_id = (select id from public.classes where name = 'Room Three') where student_id = pg_temp.id('10');
delete from public.class_teachers where teacher_id = pg_temp.id('0f');
insert into public.class_teachers (class_id, teacher_id)
select id, pg_temp.id('0f') from public.classes where name in ('Room Two', 'Room Three');
select set_config('test.room_two', (select id::text from public.classes where name = 'Room Two'), true);
select set_config('test.room_three', (select id::text from public.classes where name = 'Room Three'), true);
select set_config('test.everyone', (select class_id::text from public.class_members where student_id = pg_temp.id('0a')), true);
select public.give_class_settings(id) from public.classes where name in ('Room Two', 'Room Three');

-- Room Two: Cat and Dan both get ratio wrong (1 of 3 each: a hardest kind, 6 tries by 2 pupils); Cat gets percent-of right.
-- Room Three: Gus gets ratio wrong 4 times (so a leak would make Room Two's ratio 3 pupils and 10 tries) and area right.
-- Everyone: Ana and Bea both get Year 4 money wrong. A times-table fact from another game is never counted.
insert into public.gem_keep_facts (player, pack, fact_key, attempts, correct, avg_ms, box) values
  (pg_temp.id('0c'), 'clan-quest', 'clan:y5:ratio', 3, 1, 4000, 0),
  (pg_temp.id('0d'), 'clan-quest', 'clan:y5:ratio', 3, 1, 4000, 0),
  (pg_temp.id('0c'), 'clan-quest', 'clan:y5:percent-of', 2, 2, 4000, 0),
  (pg_temp.id('10'), 'clan-quest', 'clan:y5:ratio', 4, 0, 4000, 0),
  (pg_temp.id('10'), 'clan-quest', 'clan:y5:area', 3, 3, 4000, 0),
  (pg_temp.id('0a'), 'clan-quest', 'clan:y4:money', 3, 1, 4000, 0),
  (pg_temp.id('0b'), 'clan-quest', 'clan:y4:money', 3, 1, 4000, 0),
  (pg_temp.id('0c'), 'times-tables', 'mul:7x8', 5, 1, 4000, 0);

-- ---- Who can call it ----
select pg_temp.ana();
select throws_ok(format('select public.teacher_clan_maths_class(%L::uuid)', current_setting('test.everyone')), '42501', null,
  'a pupil cannot read the class report, even for their own class');
select pg_temp.reset();
set local role anon;
select throws_ok(format('select public.teacher_clan_maths_class(%L::uuid)', current_setting('test.room_two')), '42501', null,
  'signed-out visitors cannot read it');
select pg_temp.reset();

-- ---- A teacher with two classes sees only the class asked for ----
select pg_temp.fin();
select set_config('test.report', public.teacher_clan_maths_class(current_setting('test.room_two')::uuid)::text, true);
select is((pg_temp.report() ->> 'players')::integer, 2, 'Fin sees Room Two''s two pupils who answered, not Room Three''s');
select is(pg_temp.keys(pg_temp.report(), 'kinds'), '["clan:y5:percent-of", "clan:y5:ratio"]'::jsonb,
  '... only Room Two''s kinds of question (no area from Room Three, no times tables)');
select is(pg_temp.keys(pg_temp.report(), 'hardest'), '["clan:y5:ratio"]'::jsonb, '... ratio as the hardest kind');
select is((pg_temp.report() -> 'hardest' -> 0 ->> 'students')::integer, 2, '... answered by Room Two''s two pupils only');
select is((pg_temp.report() -> 'hardest' -> 0 ->> 'attempts')::integer, 6, '... with only their 6 tries');
select is(pg_temp.report()::text ~* '(ana|bea|cat|dan|gus|douglaspark|@)', false, '... and no pupil names');

select set_config('test.report', public.teacher_clan_maths_class(current_setting('test.room_three')::uuid)::text, true);
select is((pg_temp.report() ->> 'players')::integer, 1, 'Room Three on its own has one pupil who answered');
select is(pg_temp.keys(pg_temp.report(), 'kinds'), '["clan:y5:area", "clan:y5:ratio"]'::jsonb, '... with only Gus''s kinds');
select is(pg_temp.report() -> 'hardest', '[]'::jsonb, '... and no hardest kinds (one pupil is too few)');

-- ---- A class they don't teach, and no class ----
select throws_ok(format('select public.teacher_clan_maths_class(%L::uuid)', current_setting('test.everyone')), '42501', null,
  'Fin cannot read a class he doesn''t teach');
select throws_ok('select public.teacher_clan_maths_class(null::uuid)', '22023', null, 'no class is refused');
select pg_temp.reset();

-- ---- A school admin teaches every class, and each class is still kept apart ----
select pg_temp.eve();
select set_config('test.report', public.teacher_clan_maths_class(current_setting('test.everyone')::uuid)::text, true);
select is((pg_temp.report() ->> 'players')::integer, 2, 'Eve (school admin) sees the Everyone class''s two pupils');
select is(pg_temp.keys(pg_temp.report(), 'kinds'), '["clan:y4:money"]'::jsonb, '... only their kind of question');
select is((public.teacher_clan_maths_class(current_setting('test.room_three')::uuid) ->> 'players')::integer, 1,
  '... and Room Three on its own, without the others');

-- ---- The old call with no class, which read the whole school, is gone (migration 20261028000600) ----
select pg_temp.reset();
select hasnt_function('public', 'teacher_clan_maths_class', '{}'::name[], 'the old teacher_clan_maths_class() with no class is gone');

select * from finish();
rollback;
