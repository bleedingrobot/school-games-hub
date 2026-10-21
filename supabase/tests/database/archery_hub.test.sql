-- Archery Challenge stage 7 (migration 20261022000200): the Classmate fights switch, achievement counts through the
-- hub_games hooks, and the teacher's class summary. Nothing shared is re-created.
-- Run on a throw-away copy: scripts/scratch-db.sh archery, then
--   scripts/scratch-test.sh archery supabase/tests/database/archery_hub.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'fin@douglaspark.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000e';
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000f';

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
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || who)::uuid $$;
create function pg_temp.ana() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz') $$;
create function pg_temp.eve() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz') $$;
create function pg_temp.fin() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'fin@douglaspark.school.nz') $$;
create function pg_temp.has(who text, ach text) returns boolean language sql as $$
  select exists (select 1 from public.achievements a where a.player = pg_temp.id(who) and a.achievement = ach)
$$;

-- Cat is in Room Two, which Fin teaches (Fin teaches nothing else). Eve is the school admin.
insert into public.classes (school_id, name, school_year, warp_code)
values ((select school_id from public.profiles where id = pg_temp.id('0a')), 'Room Two', 2026, 'CDFGH');
update public.class_members set class_id = (select id from public.classes where name = 'Room Two') where student_id = pg_temp.id('0c');
delete from public.class_teachers where teacher_id = pg_temp.id('0f');
insert into public.class_teachers (class_id, teacher_id) values ((select id from public.classes where name = 'Room Two'), pg_temp.id('0f'));
select public.give_class_settings((select id from public.classes where name = 'Room Two'));
update public.app_settings set archery_enabled = true;
-- Ana's class, for checks run as a teacher (who can't read class_members).
select set_config('test.ana_class', (select class_id::text from public.class_members where student_id = pg_temp.id('0a')), true);

-- ---- Registered, and the switch starts on ----
select ok(exists (select 1 from public.hub_games where id = 'archery' and counts_fn is not null and players_fn is not null
  and rules_fn is not null and season_fn is not null and last_played_fn is not null), 'Archery has every hook now');
select is((select keep_achievements from public.hub_games where id = 'archery'), true, '... and its achievements stay through a New Season');
select is((select count(*)::integer from public.achievement_types where game = 'archery'), 10, 'ten Archery achievements');
select is((select count(*)::integer from public.achievement_measures where measure like 'archery\_%'), 10, '... with ten measures');
select is((select bool_and(archery_duels) from public.app_settings), true, 'classmate fights start on everywhere');

-- ---- The teacher's Classmate fights switch ----
select pg_temp.ana();
select throws_ok($$ select public.teacher_set_archery_duels(false) $$, null, null, 'a pupil cannot switch classmate fights off');
select throws_ok($$ select public.archery_note(auth.uid(), 'stats:x:1', '{"duels": 1}') $$, '42501', null, 'pupils cannot add achievement counts');
select throws_ok($$ select public.archery_counts(auth.uid()) $$, '42501', null, '... or call the counts hook');
select throws_ok($$ select public.archery_duels_end_for(auth.uid()) $$, '42501', null, '... or end fights');
select throws_ok($$ select public.archery_duels_on_for(auth.uid()) $$, '42501', null, '... or read the switch that way');
select throws_ok($$ select public.archery_duel_load(1) $$, '42501', null, '... or load a fight the server''s way');
select throws_ok($$ select public.teacher_archery_summary() $$, null, null, '... or read the teacher''s summary');
select is(public.archery_here() -> 'duels', 'true'::jsonb, '"I''m here" says classmate fights are on');
select pg_temp.fin();
select throws_ok(format('select public.teacher_set_archery_duels(false, %L)', current_setting('test.ana_class')),
  '42501', null, 'a teacher cannot switch another teacher''s class');
select lives_ok($$ select public.teacher_set_archery_duels(false) $$, 'a teacher switches classmate fights off for their class');
select pg_temp.reset();
select is((select archery_duels from public.settings_of(pg_temp.id('0c'))), false, '... and it is saved for that class');
select is((select archery_duels from public.settings_of(pg_temp.id('0a'))), true, '... and no other');
select pg_temp.eve();
select throws_ok($$ select public.teacher_set_archery_duels(null) $$, '22023', null, 'a missing setting is refused');
select lives_ok($$ select public.teacher_set_archery_duels(false) $$, 'the school admin switches them off everywhere');
select pg_temp.reset();

-- ---- While it's off: nobody listed, and open fights end fairly ----
-- Ana and Ben are in a fight; Ana packed 2 Steel and used 1.
insert into public.archery_players (player, gear) values (pg_temp.id('0a'), '{"steel": 1}'), (pg_temp.id('0b'), '{}');
insert into public.archery_here (player) values (pg_temp.id('0a')), (pg_temp.id('0b')) on conflict do nothing;
insert into public.archery_duels (seat_a, seat_b, name_a, name_b, world, seed, status, packs, used, deadline)
values (pg_temp.id('0a'), pg_temp.id('0b'), 'A', 'B', 'snow', 77, 'playing',
  '[{"quiver": {"steel": 2}, "shield": null, "bow": "starter"}, {"quiver": {}, "shield": null, "bow": "starter"}]', '[{"steel": 1}, {}]', now() + interval '45 seconds');
select pg_temp.act_as_server();
select is((public.archery_duel_load((select id from public.archery_duels where seed = 77)) -> 'duels'), '[false, false]'::jsonb,
  'the server function sees classmate fights are off for both players');
select pg_temp.ana();
select is(public.archery_here(), '{"duels": false, "online": [], "asks": [], "duel": null}'::jsonb, '"I''m here" lists nobody and brings no challenges');
select pg_temp.reset();
select is((select status || ':' || ending from public.archery_duels where seed = 77), 'done:duels-off', '... and ends the open fight');
select is((select winner from public.archery_duels where seed = 77), null, '... with nobody winning');
select is((select gear from public.archery_players where player = pg_temp.id('0a')), '{"steel": 2}'::jsonb, '... and the unused Steel Arrow back');
select ok(not exists (select 1 from public.archery_here where player = pg_temp.id('0a')), '... and Ana is not listed as here');
select is((select count(*)::integer from public.scored_games where game = 'archery'), 0, 'nobody gets points');
update public.app_settings set archery_duels = true;
select pg_temp.ana();
select is(public.archery_here() -> 'duels', 'true'::jsonb, 'switched back on, "I''m here" works again');
select pg_temp.reset();

-- ---- Achievement counts ----
select pg_temp.act_as_server();
select is(public.archery_note(pg_temp.id('0a'), 'stats:fight:1', '{"win_snow": 1, "plain_wins": 1, "hawk_wins": 1}'), true, 'the server adds a won fight''s counts');
select is(public.archery_note(pg_temp.id('0a'), 'stats:fight:1', '{"win_snow": 1, "plain_wins": 1, "hawk_wins": 1}'), false, '... once');
select throws_ok($$ select public.archery_note('00000000-0000-0000-0000-00000000000a', 'stats:fight:2', '{"coins": 1}') $$, '22023', null, 'an unknown count is refused');
select throws_ok($$ select public.archery_note('00000000-0000-0000-0000-00000000000a', 'stats:fight:3', '{"duels": 50}') $$, '22023', null, '... and a silly number');
select throws_ok($$ select public.archery_note('00000000-0000-0000-0000-00000000000a', 'stats:fight:4', '{"duels": 0.5}') $$, '22023', null, '... and part of one');
select is(public.archery_note(pg_temp.id('0a'), 'stats:round:abc', '{"perfect_rounds": 1}'), true, 'a perfect round');
select pg_temp.reset();
select is(public.archery_counts(pg_temp.id('0a')) - 'archery_bows',
  '{"archery_win_forest": 0, "archery_win_desert": 0, "archery_win_snow": 1, "archery_win_city": 0, "archery_plain_wins": 1, "archery_hawk_wins": 1, "archery_perfect_rounds": 1, "archery_duel_wins": 0, "archery_duels": 0}'::jsonb,
  'the counts follow');
select is(public.archery_counts(pg_temp.id('0c')) ->> 'archery_duels', '0', 'a pupil who never played counts 0');
select ok(pg_temp.has('0a', 'archery-snow') and pg_temp.has('0a', 'archery-plain') and pg_temp.has('0a', 'archery-hawk') and pg_temp.has('0a', 'archery-perfect'),
  'the achievements are given straight away');
select ok(not pg_temp.has('0a', 'archery-forest') and not pg_temp.has('0a', 'archery-bows'), '... and only those');
update public.archery_players set bows = '["long", "recurve", "hunter", "golden"]' where player = pg_temp.id('0b');
select pg_temp.act_as_server();
select public.archery_note(pg_temp.id('0b'), 'stats:buy:req-1', '{}');
select pg_temp.reset();
select ok(pg_temp.has('0b', 'archery-bows'), 'owning every bow earns Every bow');
select is((select array_agg(p order by p) from public.archery_progress_players() p), array[pg_temp.id('0a'), pg_temp.id('0b')], 'both have progress for a rebuild');

-- ---- The teacher's summary ----
insert into public.archery_fights (player, seed, world, opponent, pack, status, finished_at)
values (pg_temp.id('0a'), 1, 'snow', 'hard', '{}', 'done', now()), (pg_temp.id('0c'), 2, 'city', 'easy', '{}', 'done', now());
select pg_temp.eve();
select is(public.teacher_archery_summary() - 'pupils', '{"played": 3, "botFights": 2, "duels": 0, "rounds": 0}'::jsonb,
  'the school admin sees counts for every pupil (the ended fight counts Ana and Ben as playing)');
select pg_temp.fin();
select is(public.teacher_archery_summary(), '{"pupils": 1, "played": 1, "botFights": 1, "duels": 0, "rounds": 0}'::jsonb, 'a teacher sees only their own class');
select throws_ok(format('select public.teacher_archery_summary(%L)', current_setting('test.ana_class')),
  '42501', null, '... and never another class');
select pg_temp.reset();

-- ---- New Season ----
select pg_temp.eve();
select lives_ok($$ select public.teacher_new_season('NEW SEASON') $$, 'a school admin starts a new season');
select pg_temp.reset();
select is((select count(*)::integer from public.archery_players), 0, 'it wipes the counts with the rest of the Armory');
select is((select count(*)::integer from public.achievements where achievement like 'archery-%'), 5, '... but keeps the Archery achievements (James, 22 Oct 2026)');

select * from finish();
rollback;
