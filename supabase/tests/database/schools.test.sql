-- Maths focus F.2: schools. A second school can sign in once its domain is added, an unknown domain still
-- can't, and one school can never read another's students, games, records, boards, lobbies or settings.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(84);

-- School 1 is Douglas Park (made by the migration). School 2 is made here.
-- (Sequences aren't rolled back, so say where the numbers start: school 2, then 3.)
select setval(pg_get_serial_sequence('public.schools', 'id'), 1);
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id) values ('otherschool.school.nz', 2);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'head@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000001a', 'zed@otherschool.school.nz'),
  ('00000000-0000-0000-0000-00000000001b', 'zoe@otherschool.school.nz'),
  ('00000000-0000-0000-0000-00000000001e', 'ms.other@otherschool.school.nz'),
  ('00000000-0000-0000-0000-00000000001f', 'boss@otherschool.school.nz');
update public.profiles set role = 'teacher' where id in ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000001e');
update public.profiles set role = 'teacher', school_admin = true
where id in ('00000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-00000000001f');

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.act_as_server() returns void language sql as $$
  select set_config('role', 'service_role', true), set_config('request.jwt.claims', '{"role":"service_role"}', true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
-- Who is who: s1a/s1b students at school 1, t1 a plain teacher, adm1 school admin; the same at school 2.
create function pg_temp.as_s1a() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz') $$;
create function pg_temp.as_s1b() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz') $$;
create function pg_temp.as_t1() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz') $$;
create function pg_temp.as_adm1() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'head@douglaspark.school.nz') $$;
create function pg_temp.as_s2a() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000001a', 'zed@otherschool.school.nz') $$;
create function pg_temp.as_s2b() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000001b', 'zoe@otherschool.school.nz') $$;
create function pg_temp.as_t2() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000001e', 'ms.other@otherschool.school.nz') $$;
create function pg_temp.as_adm2() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000001f', 'boss@otherschool.school.nz') $$;

-- ---- Sign-in: the domain list decides (lock 2) ----
select ok(public.is_school_email('ana@douglaspark.school.nz'), 'Douglas Park is school 1 and its domain works');
select ok(public.is_school_email('zed@otherschool.school.nz'), 'a second school''s domain works once it is added');
select ok(public.is_school_email('Zed@OtherSchool.School.NZ'), 'capital letters are fine');
select ok(not public.is_school_email('zed@gmail.com'), 'an unknown domain is refused');
select ok(not public.is_school_email('zed@evil-otherschool.school.nz'), 'a look-alike domain is refused');
select ok(not public.is_school_email('zed@otherschool.school.nz.evil.com'), 'a domain with an extra ending is refused');
select ok(not public.is_school_email('zed@@otherschool.school.nz'), 'two @ signs are refused');
select ok(not public.is_school_email(null), 'no email is refused');
select is(public.school_for_email('zed@otherschool.school.nz'), 2, 'the email says which school');
select throws_ok($$ insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f1', 'x@gmail.com') $$,
  '42501', null, 'an unknown domain still cannot make an account');
select is((select school_id from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 1, 'a Douglas Park profile is in school 1');
select is((select school_id from public.profiles where id = '00000000-0000-0000-0000-00000000001a'), 2, 'a profile at the second school is in school 2');
select is(public.hook_before_user_created('{"user":{"email":"zed@otherschool.school.nz"}}'::jsonb), '{}'::jsonb, 'the sign-up hook lets the second school in');
select ok(public.hook_before_user_created('{"user":{"email":"x@gmail.com"}}'::jsonb) ? 'error', 'and refuses an unknown domain');
update public.schools set active = false where id = 2;
select ok(not public.is_school_email('zed@otherschool.school.nz'), 'a school that is switched off is refused');
select throws_ok($$ insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f2', 'new@otherschool.school.nz') $$,
  '42501', null, 'and cannot make new accounts');
select pg_temp.as_s2a();
select is((select count(*)::int from public.profiles), 0, 'its students can read nothing while it is switched off');
select pg_temp.reset();
update public.schools set active = true where id = 2;
select hasnt_function('public', 'school_domain', array[]::name[], 'the one-school function is gone');

-- ---- Roles: nobody changes their own school or role ----
select pg_temp.as_s1a();
select throws_ok($$ update public.profiles set school_id = 2 where id = auth.uid() $$, '42501', null, 'a student cannot change their own school');
select throws_ok($$ update public.profiles set role = 'teacher' where id = auth.uid() $$, '42501', null, 'a student cannot make themselves a teacher');
select throws_ok($$ update public.profiles set school_admin = true where id = auth.uid() $$, '42501', null, 'or a school admin');
select throws_ok($$ select public.teacher_set_role(auth.uid(), 'teacher') $$, '42501', null, 'a student cannot ask the function either');
select throws_ok($$ select public.school_set_admin('00000000-0000-0000-0000-00000000000e', true) $$, '42501', null, 'a student cannot make a school admin');
select pg_temp.reset();
select throws_ok($$ update public.profiles set school_id = 2 where id = '00000000-0000-0000-0000-00000000000a' $$, '42501', null,
  'even the database refuses to move a profile to another school');
select pg_temp.as_t1();
select throws_ok($$ select public.teacher_set_role('00000000-0000-0000-0000-00000000000a', 'teacher') $$, '42501', null, 'a plain teacher cannot make teachers (a school admin does)');
select throws_ok($$ select public.teacher_new_season('NEW SEASON') $$, '42501', null, 'or start a new season');
select pg_temp.as_adm1();
select lives_ok($$ select public.teacher_set_role('00000000-0000-0000-0000-00000000000b', 'teacher') $$, 'a school admin makes a teacher');
select lives_ok($$ select public.teacher_set_role('00000000-0000-0000-0000-00000000000b', 'student') $$, '...and can turn them back');
select throws_ok($$ select public.teacher_set_role('00000000-0000-0000-0000-00000000001a', 'teacher') $$, '22023', null,
  'but not for a student at another school');
select pg_temp.reset();
select is((select role from public.profiles where id = '00000000-0000-0000-0000-00000000001a'), 'student', '...whose role did not change');
select is(public.is_school_admin(), false, 'the database owner is not a school admin');

-- ---- The site owner ----
select pg_temp.as_adm1();
select throws_ok($$ select public.owner_add_school('Third School', 'third.school.nz') $$, '42501', null, 'a school admin is not the site owner');
select throws_ok($$ select * from public.owner_schools() $$, '42501', null, 'and cannot list the schools');
select pg_temp.reset();
select public.make_site_owner('head@douglaspark.school.nz');
select pg_temp.as_adm1();
select is(public.is_site_owner(), true, 'the site owner is set by hand in the SQL editor');
select is(public.owner_add_school('Third School', 'third.school.nz', '2026-11-01'), 3, 'the owner adds a school');
select ok(public.is_school_email('kid@third.school.nz'), '...whose domain works at once');
select lives_ok($$ select public.owner_add_school_domain(3, 'third.example.nz') $$, 'a school can have more than one domain');
select ok(public.is_school_email('kid@third.example.nz'), '...and both work');
select is((select students from public.owner_schools() where id = 1), 2, 'the owner list only has counts of students');
select ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'owner\_%' and pg_get_function_result(p.oid) ~* 'display_name|real_name|avatar'),
  'and nothing the owner can call returns a name');
select lives_ok($$ select public.owner_set_school_active(3, false) $$, 'the owner switches a school off');
select ok(not public.is_school_email('kid@third.school.nz'), '...and its sign-in stops');
select pg_temp.as_adm2();
select throws_ok($$ select public.owner_add_school('Fourth', 'fourth.school.nz') $$, '42501', null, 'another school''s admin is not the site owner either');
select pg_temp.reset();

-- ---- Settings are kept apart ----
update public.app_settings set multiplayer_enabled = false where school_id = 2;
select pg_temp.as_s1a();
select is((select count(*)::int from public.app_settings), 1, 'a student reads exactly one settings row');
select is((select multiplayer_enabled from public.app_settings), true, 'their own school''s');
select is((select id from public.app_settings), public.my_settings_id(), 'and the helper agrees which one it is');
select pg_temp.as_s2a();
select is((select multiplayer_enabled from public.app_settings), false, 'the other school has its own settings');
select pg_temp.reset();
select is((select school_id from public.app_settings where id = public.settings_id_of('00000000-0000-0000-0000-00000000001a')), 2, 'school 2 students use school 2''s row');
select pg_temp.as_adm2();
select lives_ok($$ select public.teacher_set_space_maths('off') $$, 'a school admin changes their school''s settings');
select pg_temp.reset();
select is((select space_maths from public.app_settings where school_id = 2 and class_id is null), 'off', 'school 2''s default changed');
select is((select space_maths from public.app_settings where school_id = 1 and class_id is null), 'choose', 'school 1''s did not');
select is((select count(*)::int from public.app_settings where school_id = 1 and space_maths <> 'choose'), 0, 'and none of school 1''s classes did either');

-- ---- Students, profiles, boards: one school only ----
select pg_temp.as_s1a();
select is((select count(*)::int from public.profiles where school_id = 2), 0, 'a student sees no profile from another school');
select is((select count(*)::int from public.profiles), 4, 'only their own school''s (2 students, 2 teachers)');
select pg_temp.as_s2a();
select is((select count(*)::int from public.profiles where school_id = 1), 0, 'and the other way round');
select pg_temp.as_t1();
select is((select count(*)::int from public.profiles where school_id = 2), 0, 'a teacher sees no profile from another school');
select pg_temp.as_adm2();
select is((select count(*)::int from public.profiles where school_id = 1), 0, 'nor does the other school''s admin');
select is((select count(*)::int from public.teacher_students() where id = '00000000-0000-0000-0000-00000000000a'), 0, 'teacher_students does not list another school''s students');
select throws_ok($$ select public.teacher_student_detail('00000000-0000-0000-0000-00000000000a') $$, '42501', null, 'the detail of another school''s student is refused');
select throws_ok($$ select public.teacher_gem_keep_student('00000000-0000-0000-0000-00000000000a') $$, '42501', null, 'so are their Gem Keep records');
select throws_ok($$ select public.teacher_lord_student('00000000-0000-0000-0000-00000000000a') $$, '42501', null, 'their Dragon Maths records');
select throws_ok($$ select public.teacher_monster_student('00000000-0000-0000-0000-00000000000a') $$, '42501', null, 'and their Maths Monsters records');
select throws_ok($$ select public.teacher_set_hidden('00000000-0000-0000-0000-00000000000a', true) $$, '42501', null, 'hiding another school''s student is refused');
select throws_ok($$ select public.teacher_reset_name('00000000-0000-0000-0000-00000000000a') $$, '42501', null, 'renaming them is refused');
select throws_ok($$ select public.teacher_delete_student('00000000-0000-0000-0000-00000000000a') $$, '42501', null, 'deleting them is refused');
select pg_temp.reset();
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-00000000000a' and not hidden), 1, '...and none of that changed anything');

-- Boards: ratings, Gem Keep stars, Dragon Maths Hall
insert into public.ratings (player, game, rating, rated_games) values
  ('00000000-0000-0000-0000-00000000000a', 'chess', 1400, 10),
  ('00000000-0000-0000-0000-00000000001a', 'chess', 1500, 10);
insert into public.gem_keep_progress (player, level_id, best_stars, plays, wins) values
  ('00000000-0000-0000-0000-00000000000a', 'meadow-1', 3, 2, 2),
  ('00000000-0000-0000-0000-00000000001a', 'meadow-1', 3, 2, 2);
insert into public.lord_hall (player, season, kills) values
  ('00000000-0000-0000-0000-00000000000a', 1, 1),
  ('00000000-0000-0000-0000-00000000001a', 1, 2);
insert into public.lord_news (school_id, day, kind, text, dedupe) values (1, current_date, 'village', 'School one news', 'village'), (2, current_date, 'village', 'School two news', 'village');
select pg_temp.as_s1a();
select is((select count(*)::int from public.leaderboard('chess', 'all-time')), 1, 'the chess board has only my school');
select is((select count(*)::int from public.gem_keep_leaderboard()), 1, 'the Gem Keep board has only my school');
select is((select count(*)::int from public.lord_hall()), 1, 'the Hall of Heroes has only my school');
select is((select array_agg(line) from public.lord_news()), array['School one news'], 'the Daily News is my school''s own');
select pg_temp.as_s2a();
select is((select kills from public.lord_hall()), 2, 'the other school sees only its own Hall');
select is((select array_agg(line) from public.lord_news()), array['School two news'], 'and its own news');
select is((select count(*)::int from public.leaderboard('chess', 'all-time')), 1, 'and its own chess board');
select pg_temp.reset();

-- ---- Games, lobbies, codes: inside one school ----
insert into public.mp_games (id, game, created_by, first_player, status, in_lobby, code, expires_at)
values ('10000000-0000-0000-0000-000000000001', 'chess', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'waiting', true, 'KM4TP', now() + interval '10 minutes');
select pg_temp.as_s1b();
select is((select count(*)::int from public.lobby_games()), 1, 'a classmate sees the open game in the lobby');
select pg_temp.as_s2a();
select is((select count(*)::int from public.lobby_games()), 0, 'a student from another school does not');
select is((select count(*)::int from public.mp_games), 0, 'and cannot read the game row');
select pg_temp.reset();
select throws_ok($$ update public.mp_games set second_player = '00000000-0000-0000-0000-00000000001a' where id = '10000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'the database refuses to seat a student from another school in a game');
select is((select first_player::text from public.mp_games where id = '10000000-0000-0000-0000-000000000001'), '00000000-0000-0000-0000-00000000000a', '(the game is unchanged)');
select is((select school_id from public.mp_player_status('00000000-0000-0000-0000-00000000001a')), 2, 'the game server learns each player''s school');
select is((select gone from public.power_player_status('00000000-0000-0000-0000-00000000000a',
  array['00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000001a']::uuid[])), array['00000000-0000-0000-0000-00000000001a']::uuid[],
  'a player from another school counts as gone');

-- ---- A new season belongs to one school ----
select pg_temp.reset();
select pg_temp.as_adm2();
select lives_ok($$ select public.teacher_new_season('NEW SEASON') $$, 'a school admin starts a new season');
select pg_temp.reset();
select is((select count(*)::int from public.gem_keep_progress where player = '00000000-0000-0000-0000-00000000001a'), 0, 'school 2''s records were cleared');
select is((select count(*)::int from public.gem_keep_progress where player = '00000000-0000-0000-0000-00000000000a'), 1, 'school 1''s were not');
select is((select count(*)::int from public.ratings where player = '00000000-0000-0000-0000-00000000000a'), 1, 'nor its ratings');

select * from finish();
rollback;
