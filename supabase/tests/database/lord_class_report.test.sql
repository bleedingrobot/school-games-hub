-- Dragon Maths' class report for one class (migration 20261028000300): teacher_lord_class(target_class).
-- A teacher sees only the class asked for (heroes, levels, hardest questions, refused requests and the Hall of Heroes), with
-- the school's season (one date for the whole school since 20261028000400), can't read a class they don't teach, a pupil can't call it, and the old call with no class still
-- works.
-- Run on a throw-away copy: scripts/scratch-db.sh lordclass, then
--   scripts/scratch-test.sh lordclass supabase/tests/database/lord_class_report.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

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
create function pg_temp.keys(report jsonb, part text, field text) returns jsonb language sql as $$
  select coalesce(jsonb_agg(e ->> field order by e ->> field), '[]') from jsonb_array_elements(report -> part) e
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

-- The school's season started 40 days ago (season 2, day 6, 29 days left). The classes' own old dates (Room Two 40 days ago,
-- Room Three 10 days ago, the Everyone class none) are no longer read (migration 20261028000400).
update public.app_settings set lord_season_start = public.nz_day(now()) - 40, lord_paused_since = null
where class_id is null and school_id = (select school_id from public.profiles where id = pg_temp.id('0a'));
update public.app_settings set lord_season_start = public.nz_day(now()) - 40 where class_id = current_setting('test.room_two')::uuid;
update public.app_settings set lord_season_start = public.nz_day(now()) - 10 where class_id = current_setting('test.room_three')::uuid;
update public.app_settings set lord_season_start = null where class_id = current_setting('test.everyone')::uuid;
select set_config('test.two_start', to_char(public.nz_day(now()) - 40, 'YYYY-MM-DD'), true);

-- Room Two: Cat is level 3 this season (2); Dan's hero is from season 1. Both get 7 x 8 wrong; Cat had a fight turned down
-- and beat the dragon in season 1.
-- Room Three: Gus is level 7 in season 2 (the school's current one), gets 7 x 8 wrong too, had a request turned down and beat
-- the dragon twice in season 1 (so a leak would show in Room Two).
-- Everyone: Ana and Bea have heroes and both get 6 x 7 wrong.
insert into public.lord_heroes (player, hero, version, season, day) values
  (pg_temp.id('0c'), '{"level": 3}', 1, 2, '2026-01-01'),
  (pg_temp.id('0d'), '{"level": 5}', 1, 1, '2026-01-01'),
  (pg_temp.id('10'), '{"level": 7}', 1, 2, '2026-01-01'),
  (pg_temp.id('0a'), '{"level": 2}', 1, 1, '2026-01-01'),
  (pg_temp.id('0b'), '{"level": 2}', 1, 1, '2026-01-01');
insert into public.gem_keep_facts (player, pack, fact_key, attempts, correct, avg_ms, box) values
  (pg_temp.id('0c'), 'times-tables', 'mul:7x8', 5, 1, 4000, 0),
  (pg_temp.id('0d'), 'times-tables', 'mul:7x8', 5, 2, 4000, 0),
  (pg_temp.id('10'), 'times-tables', 'mul:7x8', 5, 0, 4000, 0),
  (pg_temp.id('0a'), 'times-tables', 'mul:6x7', 5, 1, 4000, 0),
  (pg_temp.id('0b'), 'times-tables', 'mul:6x7', 5, 2, 4000, 0);
insert into public.lord_refusals (player, reason, action) values (pg_temp.id('0c'), 'tampered', 'fight-finish'), (pg_temp.id('10'), 'stale', 'forest');
insert into public.lord_hall (player, season, kills) values (pg_temp.id('0c'), 1, 1), (pg_temp.id('10'), 1, 2);

-- ---- Who can call it ----
select pg_temp.ana();
select throws_ok(format('select public.teacher_lord_class(%L::uuid)', current_setting('test.everyone')), '42501', null,
  'a pupil cannot read the class report, even for their own class');
select pg_temp.reset();
set local role anon;
select throws_ok(format('select public.teacher_lord_class(%L::uuid)', current_setting('test.room_two')), '42501', null,
  'signed-out visitors cannot read it');
select pg_temp.reset();

-- ---- A teacher sees only the class asked for, with the school's season ----
select pg_temp.fin();
select set_config('test.report', public.teacher_lord_class(current_setting('test.room_two')::uuid)::text, true);
select is((pg_temp.report() ->> 'players')::integer, 2, 'Fin sees Room Two''s two heroes, not Room Three''s');
select is((pg_temp.report() -> 'season' ->> 'number')::integer, 2, '... the school''s season');
select is((pg_temp.report() -> 'season' ->> 'daysLeft')::integer, 29, '... and its days left');
select is(pg_temp.report() -> 'season' ->> 'start', current_setting('test.two_start'), '... and its first day');
select is((pg_temp.report() ->> 'thisSeason')::integer, 1, '... one hero in this season (Dan''s is last season''s)');
select is(pg_temp.report() -> 'levels', '[0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]'::jsonb, '... at level 3');
select is(pg_temp.report() -> 'hardest' -> 0 ->> 'students', '2', '... only Room Two''s hardest questions');
select is(pg_temp.keys(pg_temp.report(), 'refusals', 'reason'), '["tampered"]'::jsonb, '... only Room Two''s refused requests');
select is(pg_temp.keys(pg_temp.report(), 'hall', 'realName'), '["cat"]'::jsonb, '... and only Room Two''s Hall of Heroes');

select set_config('test.report', public.teacher_lord_class(current_setting('test.room_three')::uuid)::text, true);
select is((pg_temp.report() ->> 'players')::integer, 1, 'Room Three on its own has one hero');
select is(pg_temp.report() -> 'season', jsonb_build_object('number', 2, 'start', current_setting('test.two_start'), 'daysLeft', 29),
  '... in the school''s season 2 with 29 days left, not its old date''s season 1');
select is(pg_temp.report() -> 'levels' -> 6, '1'::jsonb, '... at level 7, counted in this season');

-- ---- A class they don't teach ----
select throws_ok(format('select public.teacher_lord_class(%L::uuid)', current_setting('test.everyone')), '42501', null,
  'Fin cannot read a class he doesn''t teach');
select throws_ok('select public.teacher_lord_class(null::uuid)', '22023', null, 'no class is refused');
select pg_temp.reset();

-- ---- A school admin teaches every class, and each class is still kept apart ----
select pg_temp.eve();
select set_config('test.report', public.teacher_lord_class(current_setting('test.everyone')::uuid)::text, true);
select is((pg_temp.report() ->> 'players')::integer, 2, 'Eve (school admin) sees the Everyone class''s two heroes');
select is(pg_temp.report() -> 'season' -> 'number', '2'::jsonb, '... in the school''s season, though the class has no date of its own');
select is(pg_temp.keys(pg_temp.report(), 'hardest', 'key'), '["mul:6x7"]'::jsonb, '... only its hardest question');
select is((pg_temp.report() -> 'refusals') || (pg_temp.report() -> 'hall'), '[]'::jsonb,
  '... and none of the other classes'' refused requests or Hall of Heroes');

-- ---- The old call with no class still works, as before ----
select is((public.teacher_lord_class() ->> 'players')::integer, 5, 'the old call still gives Eve every hero in the school');
select pg_temp.reset();
select pg_temp.fin();
select is(jsonb_array_length(public.teacher_lord_class() -> 'refusals'), 2, 'the old call still gives Fin both his classes'' refused requests');
select pg_temp.reset();
select pg_temp.ana();
select throws_ok('select public.teacher_lord_class()', '42501', null, 'a pupil still cannot make the old call');
select pg_temp.reset();

select * from finish();
rollback;
