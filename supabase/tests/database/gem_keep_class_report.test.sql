-- Gem Keep's class report for one class (migration 20261028000100): teacher_gem_keep_class(target_class).
-- A teacher sees only the class asked for, can't read a class they don't teach, a pupil can't call it, and the old call
-- with no class still works.
-- Run on a throw-away copy: scripts/scratch-db.sh gemclass, then
--   scripts/scratch-test.sh gemclass supabase/tests/database/gem_keep_class_report.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

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
select set_config('test.room_three', (select id::text from public.classes where name = 'Room Three'), true);
select set_config('test.room_two', (select id::text from public.classes where name = 'Room Two'), true);
select set_config('test.everyone', (select class_id::text from public.class_members where student_id = pg_temp.id('0a')), true);

-- Room Two: both won level 1, Cat passed its Key; both get 7 x 8 wrong a lot.
-- Room Three: Gus won level 2 and gets 7 x 8 wrong too (so a leak would show in Fin's Room Two report).
-- Everyone: Ana and Bea won level 1 and level 2; both get 6 x 7 wrong a lot.
insert into public.gem_keep_progress (player, level_id, best_stars, key_passed, plays, wins) values
  (pg_temp.id('0c'), 'level-01', 2, true, 3, 1),
  (pg_temp.id('0d'), 'level-01', 1, false, 2, 1),
  (pg_temp.id('0a'), 'level-01', 3, true, 1, 1),
  (pg_temp.id('0a'), 'level-02', 3, true, 1, 1),
  (pg_temp.id('0b'), 'level-01', 3, true, 1, 1),
  (pg_temp.id('0b'), 'level-02', 2, false, 1, 1),
  (pg_temp.id('10'), 'level-02', 1, false, 1, 1);
insert into public.gem_keep_facts (player, pack, fact_key, attempts, correct, avg_ms, box) values
  (pg_temp.id('0c'), 'times-tables', 'mul:7x8', 5, 1, 4000, 0),
  (pg_temp.id('0d'), 'times-tables', 'mul:7x8', 5, 2, 4000, 0),
  (pg_temp.id('0a'), 'times-tables', 'mul:6x7', 5, 1, 4000, 0),
  (pg_temp.id('0b'), 'times-tables', 'mul:6x7', 5, 2, 4000, 0),
  (pg_temp.id('10'), 'times-tables', 'mul:7x8', 5, 0, 4000, 0);

-- ---- Who can call it ----
select pg_temp.ana();
select throws_ok(format('select public.teacher_gem_keep_class(%L::uuid)', current_setting('test.everyone')), '42501', null,
  'a pupil cannot read the class report, even for their own class');
select pg_temp.reset();
set local role anon;
select throws_ok(format('select public.teacher_gem_keep_class(%L::uuid)', current_setting('test.room_two')), '42501', null,
  'signed-out visitors cannot read it');
select pg_temp.reset();

-- ---- A teacher sees only the class asked for ----
select pg_temp.fin();
select set_config('test.report', public.teacher_gem_keep_class(current_setting('test.room_two')::uuid)::text, true);
select is((current_setting('test.report')::jsonb ->> 'players')::integer, 2, 'Fin sees Room Two''s two players, not Room Three''s');
select is(current_setting('test.report')::jsonb -> 'levels',
  '[{"levelId": "level-01", "won": 2, "keys": 1}]'::jsonb, '... only Room Two''s levels');
select is((select jsonb_agg(h ->> 'key') from jsonb_array_elements(current_setting('test.report')::jsonb -> 'hardest') h),
  '["mul:7x8"]'::jsonb, '... and only Room Two''s hardest fact');
select is((public.teacher_gem_keep_class(current_setting('test.room_three')::uuid) ->> 'players')::integer, 1,
  '... and Room Three on its own has one player');

-- ---- A class they don't teach ----
select throws_ok(format('select public.teacher_gem_keep_class(%L::uuid)', current_setting('test.everyone')), '42501', null,
  'Fin cannot read a class he doesn''t teach');
select throws_ok('select public.teacher_gem_keep_class(null::uuid)', '22023', null, 'no class is refused');
select pg_temp.reset();

-- ---- A school admin teaches every class, and each class is still kept apart ----
select pg_temp.eve();
select is((public.teacher_gem_keep_class(current_setting('test.everyone')::uuid) ->> 'players')::integer, 2,
  'Eve (school admin) sees the Everyone class''s two players');
select is((select jsonb_agg(h ->> 'key') from jsonb_array_elements(public.teacher_gem_keep_class(current_setting('test.everyone')::uuid) -> 'hardest') h),
  '["mul:6x7"]'::jsonb, '... and only its hardest fact');
select is(public.teacher_gem_keep_class(current_setting('test.everyone')::uuid) -> 'levels',
  '[{"levelId": "level-01", "won": 2, "keys": 2}, {"levelId": "level-02", "won": 2, "keys": 1}]'::jsonb, '... and only its levels');

-- ---- The old call with no class still works, as before ----
select is((public.teacher_gem_keep_class() ->> 'players')::integer, 5, 'the old call still gives Eve every player in the school');
select is(jsonb_array_length(public.teacher_gem_keep_class() -> 'hardest'), 2, '... and the school''s hardest facts');
select pg_temp.reset();
select pg_temp.fin();
select is((public.teacher_gem_keep_class() ->> 'players')::integer, 3, 'the old call still gives Fin all his students');
select pg_temp.reset();
select pg_temp.ana();
select throws_ok('select public.teacher_gem_keep_class()', '42501', null, 'a pupil still cannot make the old call');
select pg_temp.reset();

select * from finish();
rollback;
