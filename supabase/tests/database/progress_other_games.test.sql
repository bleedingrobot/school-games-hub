-- Teacher progress P11 (migration 20261111000800): teacher_progress_other_games(target_class) gives every pupil in the class one
-- number a game (Gem Keep, Diamond Drop, Dragon Maths, Bond Match, Toon Flap). A teacher sees only the class asked for, can't
-- read a class they don't teach, and a pupil can't call it.
-- Run on a throw-away copy: scripts/scratch-db.sh othergames, then
--   scripts/scratch-test.sh othergames supabase/tests/database/progress_other_games.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'dan@douglaspark.school.nz'),
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

create function pg_temp.value(student text, game text) returns integer language sql as $$
  select (r ->> 'value')::integer from jsonb_array_elements(public.teacher_progress_other_games(current_setting('test.room_two')::uuid)) r
  where r ->> 'student' = pg_temp.id(student)::text and r ->> 'game' = game
$$;
-- Cat and Dan are in Room Two; Fin teaches it. Ana stays in the school's Everyone class, which Fin does not teach.
insert into public.classes (school_id, name, school_year, warp_code)
values ((select school_id from public.profiles where id = pg_temp.id('0a')), 'Room Two', 2026, 'CDFGH');
update public.class_members set class_id = (select id from public.classes where name = 'Room Two')
where student_id in (pg_temp.id('0c'), pg_temp.id('0d'));
delete from public.class_teachers where teacher_id = pg_temp.id('0f');
insert into public.class_teachers (class_id, teacher_id) select id, pg_temp.id('0f') from public.classes where name = 'Room Two';
select set_config('test.room_two', (select id::text from public.classes where name = 'Room Two'), true);
select set_config('test.everyone', (select class_id::text from public.class_members where student_id = pg_temp.id('0a')), true);

-- Cat: Gem Keep (won level 3 and 5, lost 7), Diamond (deepest 4), Bond Match (3 + 2 stars). Dan: Dragon Maths level 6.
-- Ana (another class) has Gem Keep too, which must not leak.
insert into public.gem_keep_runs (player, run_id, level_id, level_number, result, stars, waves, waves_total, game_seconds, asked, right_answers, counts_for_points) values
  (pg_temp.id('0c'), gen_random_uuid(), 'level-03', 3, 'won', 2, 5, 5, 100, 5, 5, true),
  (pg_temp.id('0c'), gen_random_uuid(), 'level-05', 5, 'won', 1, 5, 5, 100, 5, 4, true),
  (pg_temp.id('0c'), gen_random_uuid(), 'level-07', 7, 'lost', 0, 2, 5, 100, 5, 1, true),
  (pg_temp.id('0a'), gen_random_uuid(), 'level-09', 9, 'won', 3, 5, 5, 100, 5, 5, true);
insert into public.diamond_players (player, state) values (pg_temp.id('0c'), '{"deepest": 4}');
insert into public.bond_match_bests (player, bond_id, size, best_flips, best_seconds, best_stars) values
  (pg_temp.id('0c'), 'to-10', 'small', 8, 30, 3),
  (pg_temp.id('0c'), 'to-100', 'small', 9, 40, 2);
insert into public.lord_heroes (player, hero, version, season, day) values (pg_temp.id('0d'), '{"level": 6, "heroClass": "knight"}', 1, 1, '2026-11-11');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select throws_ok(format('select public.teacher_progress_other_games(%L::uuid)', current_setting('test.everyone')), '42501', null,
  'a pupil cannot read it, even for their own class');
select pg_temp.reset();

select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fin@douglaspark.school.nz');
select throws_ok(format('select public.teacher_progress_other_games(%L::uuid)', current_setting('test.everyone')), '42501', null,
  'a teacher cannot read a class they do not teach');
select throws_ok('select public.teacher_progress_other_games(null)', '42501', null, '... or no class');

select is(pg_temp.value('0c', 'gem-keep'), 5, 'Gem Keep: the highest level won, not lost');
select is(pg_temp.value('0c', 'diamond'), 4, 'Diamond Drop: the deepest level passed');
select is(pg_temp.value('0c', 'bond-match'), 5, 'Bond Match: the stars added up');
select is(pg_temp.value('0d', 'dragon-maths'), 6, 'Dragon Maths: the hero''s level');
select is(jsonb_array_length(public.teacher_progress_other_games(current_setting('test.room_two')::uuid)), 4,
  'only Room Two''s four lines: nothing from Ana, and no line for a game nobody played');

select * from finish();
rollback;
