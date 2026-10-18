-- Rehearsal for the schools-and-classes migrations (F.2): the checks after the migrations ran on "today's" data.
select plan(27);

select is((select count(*)::int from public.profiles where school_id = 1), (select n::int from before_counts where t = 'profiles'),
  'every existing profile is in school 1');
select is((select count(*)::int from public.schools), 1, 'Douglas Park is the only school');
select is((select domain from public.school_domains where school_id = 1), 'douglaspark.school.nz', 'with its one domain');
select is((select count(*)::int from public.classes), 1, 'there is one class');
select is((select name from public.classes), 'Everyone', 'called Everyone');
select is((select default_class from public.schools where id = 1), (select id from public.classes), 'which is the school''s default class');
select is((select count(*)::int from public.class_members where class_id = (select id from public.classes)), 5, 'it holds all five students');
select is((select count(*)::int from public.class_members m join public.profiles p on p.id = m.student_id where p.role <> 'student'), 0, '(and no teachers)');
select is((select count(*)::int from public.class_teachers where class_id = (select id from public.classes)), 2, 'both teachers teach it');
select is((select count(*)::int from public.profiles where school_admin), 0, 'nobody is a school admin until it is set by hand');

-- Settings: the school default and Everyone's row both equal today's settings.
select is((select count(*)::int from public.app_settings), 2, 'two settings rows: the school default and Everyone');
select is((select count(*)::int from public.app_settings a, before_settings b
  where a.multiplayer_enabled = b.multiplayer_enabled and a.space_reactions_enabled = b.space_reactions_enabled
    and a.gem_keep_mode = b.gem_keep_mode and a.gem_keep_tables = b.gem_keep_tables and a.gem_keep_division = b.gem_keep_division
    and a.gem_keep_multiple_choice = b.gem_keep_multiple_choice and a.gem_keep_key_pass = b.gem_keep_key_pass
    and a.space_maths = b.space_maths and a.monsters_enabled = b.monsters_enabled and a.monsters_topics = b.monsters_topics
    and a.lord_enabled = b.lord_enabled and a.lord_forest_per_day = b.lord_forest_per_day
    and a.lord_season_start is not distinct from b.lord_season_start and a.lord_paused_since is not distinct from b.lord_paused_since), 2,
  'both rows are exactly today''s settings');

-- A student: same settings, same everything they read.
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"ana@douglaspark.school.nz","role":"authenticated"}', true);
select is((select count(*)::int from public.app_settings), 1, 'a student reads one settings row');
select is((select space_maths from public.app_settings), 'on', '...with today''s values');
select is((public.my_gem_keep() -> 'settings' ->> 'mode'), 'challenge', 'Gem Keep settings read as before');
select is((public.my_gem_keep() -> 'settings' -> 'enabledTables')::text, '[2, 5, 10]', 'including the times tables');
select is((public.my_monsters() -> 'settings' ->> 'enabled'), 'true', 'Maths Monsters is still on');
select is((public.my_lord() -> 'settings' ->> 'forestPerDay'), '7', 'and Dragon Maths keeps its setting');
select is(jsonb_typeof(public.my_progress()), 'object', 'the progress page still works');
select is((select count(*)::int from public.lobby_games()), 0, 'the lobby is empty (multiplayer is off in today''s settings)');
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);

-- A teacher: the same list as before.
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","email":"mr.teacher@douglaspark.school.nz","role":"authenticated"}', true);
select is_empty($$ select id, display_name, real_name, role, hidden, bot_games, friend_games, points from before_teacher_list
  except select id, display_name, real_name, role, hidden, bot_games, friend_games, points from public.teacher_students() $$,
  'a teacher''s list has everyone it had');
select is_empty($$ select id, display_name, real_name, role, hidden, bot_games, friend_games, points from public.teacher_students()
  except select id, display_name, real_name, role, hidden, bot_games, friend_games, points from before_teacher_list $$,
  'and nobody it did not');
select lives_ok($$ select public.teacher_student_detail('00000000-0000-0000-0000-0000000000a5') $$, 'including the hidden student''s detail');
select is((select count(*)::int from public.profiles), 7, 'and sees every profile, hidden ones too');
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);

-- Nothing saved was lost.
select is_empty($$ select b.t from before_counts b where b.n <> case b.t
  when 'profiles' then (select count(*) from public.profiles)
  when 'bot_games' then (select count(*) from public.bot_games)
  when 'mp_games' then (select count(*) from public.mp_games)
  when 'gem_keep_progress' then (select count(*) from public.gem_keep_progress)
  when 'scored_games' then (select count(*) from public.scored_games)
  when 'ratings' then (select count(*) from public.ratings)
  when 'achievements' then (select count(*) from public.achievements)
  when 'lord_news' then (select count(*) from public.lord_news) end $$, 'no table lost a row');
select is((select school_id from public.lord_news where dedupe = 'village'), 1, 'the Daily News line belongs to Douglas Park');
select is_empty($$ select name from before_functions where name <> 'school_domain'
  except select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute') $$,
  'everything a signed-in user could call before can still be called (except the old one-school function)');

select * from finish();
rollback;
