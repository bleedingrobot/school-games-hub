-- Rehearsal for the schools-and-classes migrations (F.2): "today's" Douglas Park, before the migrations.
-- Run by scripts/f2-rehearsal.sh inside one transaction (nothing is kept), in a scratch database that
-- has every migration that is live today (up to Training, 20261018002200) and none of F.2's.
begin;
create extension if not exists pgtap with schema extensions;

-- Fake accounts: 5 students (one hidden), 2 teachers. The sign-up trigger makes the profiles.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-0000000000a2', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-0000000000a3', 'cat@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-0000000000a4', 'dan@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-0000000000a5', 'eve@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-0000000000b1', 'mr.teacher@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-0000000000b2', 'ms.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2');
update public.profiles set hidden = true where id = '00000000-0000-0000-0000-0000000000a5';

-- Today's settings, changed from the defaults so we can see they carry over.
update public.app_settings set multiplayer_enabled = false, space_reactions_enabled = true, gem_keep_mode = 'challenge',
  gem_keep_tables = '{2,5,10}', gem_keep_division = true, gem_keep_multiple_choice = true, gem_keep_key_pass = 9,
  space_maths = 'on', monsters_enabled = true, monsters_topics = '{add-sub,fractions}',
  lord_enabled = true, lord_forest_per_day = 7, lord_season_start = current_date - 3,
  clans_enabled = true, clan_raids_enabled = true, clans_year_band = 6, clans_fights_per_day = 5, clans_season = 3;

-- Clan Quest as it is today: a group, a pupil in it, a news line, a Mines log line.
insert into public.clan_villages (name, closed_week) values ('Room 12', public.clan_nz_week() - 1);
insert into public.clan_village_members (player, village_id) values ('00000000-0000-0000-0000-0000000000a2', 2);
insert into public.clan_news (nz_date, text) values (current_date, 'One fight was won in the Mines yesterday.');
insert into public.clan_fight_log (nz_date, depth, boss, result) values (current_date, 3, false, 'won');

-- Some saved data of each kind.
select public.record_bot_game('00000000-0000-0000-0000-0000000000a1', 'chess', 'easy', 'black', array['f2f3', 'e7e5', 'g2g4', 'd8h4'], 'won', 'checkmate', 2, false);
select public.record_bot_game('00000000-0000-0000-0000-0000000000a2', 'checkers', 'medium', 'red', array['11-15', '22-18', '15x22'], 'won', 'no-pieces', 2, false);
insert into public.gem_keep_progress (player, level_id, best_stars, plays, wins) values ('00000000-0000-0000-0000-0000000000a1', 'meadow-1', 3, 2, 2);
insert into public.ratings (player, game, rating, rated_games) values ('00000000-0000-0000-0000-0000000000a1', 'chess', 1300, 6);
insert into public.mp_games (id, game, code, in_lobby, created_by, first_player)
values ('10000000-0000-0000-0000-0000000000f1', 'chess', 'KM4TP', true, '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a3');
insert into public.lord_news (day, kind, text, dedupe) values (current_date, 'village', 'Market day!', 'village');

-- What a teacher sees today, saved to compare after.
create temp table before_counts as
select 'profiles' as t, count(*) as n from public.profiles
union all select 'bot_games', count(*) from public.bot_games
union all select 'mp_games', count(*) from public.mp_games
union all select 'gem_keep_progress', count(*) from public.gem_keep_progress
union all select 'scored_games', count(*) from public.scored_games
union all select 'ratings', count(*) from public.ratings
union all select 'achievements', count(*) from public.achievements
union all select 'lord_news', count(*) from public.lord_news;
create temp table before_settings as select * from public.app_settings;
create temp table before_functions as
select distinct p.proname::text as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute');
create temp table before_teacher_list (id uuid, display_name text, real_name text, role text, hidden boolean, bot_games integer, friend_games integer, points integer);
grant all on before_teacher_list to public;
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","email":"mr.teacher@douglaspark.school.nz","role":"authenticated"}', true);
insert into before_teacher_list select id, display_name, real_name, role, hidden, bot_games, friend_games, points from public.teacher_students();
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
grant select on before_teacher_list, before_counts, before_settings, before_functions to public;
