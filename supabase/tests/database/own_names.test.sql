-- Earn your own name (migration 20261112002800_own_names.sql; docs/plans/profile/PLAN.md card P11): Name Scrolls, typed names
-- waiting for a teacher, the name history, putting the made-up name back, and the once-a-day limit on made-up names.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(48);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'ms.other@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id in ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000000f');
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
create function pg_temp.cat() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz') $$;
create function pg_temp.teacher() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz') $$;
create function pg_temp.other() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000f', 'ms.other@douglaspark.school.nz') $$;
create function pg_temp.name_of(who text) returns text language sql as $$ select display_name from public.profiles where id = pg_temp.id(who) $$;
create function pg_temp.scrolls(who text) returns integer language sql as $$
  select count(*)::integer from public.name_scrolls where player = pg_temp.id(who) and used_at is null $$;

-- Ana, Ben and Cat are in Mr Teacher's class. Ms Other teaches a different class.
select pg_temp.teacher();
create temp table made as select public.teacher_create_class('Room 12', 2026, 5) as id;
grant all on made to authenticated;
select public.teacher_add_to_class((select id from made), array[pg_temp.id('a'), pg_temp.id('b'), pg_temp.id('c')]);
select pg_temp.other();
select public.teacher_create_class('Room 9', 2026, 5);
select pg_temp.reset();

-- Trophy types for the scroll rules: two games, a 'hub' reward, and pictures.
insert into public.trophy_types (id, game, name, how, kind, repeat, sort) values
  ('t-one', 'game-one', 'Cup one', 'Win.', 'trophy', 'season', 2000), ('t-one-b', 'game-one', 'Cup one b', 'Win.', 'trophy', 'season', 2001),
  ('t-two', 'game-two', 'Cup two', 'Win.', 'trophy', 'season', 2002), ('t-hub', 'hub', 'Hub cup', 'Win.', 'trophy', 'season', 2003),
  ('p-1', 'game-one', 'Pic 1', 'Win.', 'picture', 'once', 2004), ('p-2', 'game-two', 'Pic 2', 'Win.', 'picture', 'once', 2005),
  ('p-3', 'game-two', 'Pic 3', 'Win.', 'picture', 'once', 2006);

-- ---- Name Scrolls ----
insert into public.trophies (player, trophy, season, year) select pg_temp.id('a'), 't-one', s, 2026 from generate_series(1, 3) s;
insert into public.trophies (player, trophy, season, year) select pg_temp.id('a'), 't-one-b', s, 2026 from generate_series(1, 3) s;
insert into public.trophies (player, trophy, season, year) select pg_temp.id('a'), 't-hub', s, 2026 from generate_series(1, 3) s;
select is(pg_temp.scrolls('a'), 0, 'gold in one game twice, and a hub gold, give no scroll');
insert into public.trophies (player, trophy, season, year) select pg_temp.id('a'), 't-two', s, 2026 from generate_series(1, 2) s;
select is(pg_temp.scrolls('a'), 0, 'silver in the second game gives no scroll yet');
insert into public.trophies (player, trophy, season, year) values (pg_temp.id('a'), 't-two', 3, 2026);
select is(pg_temp.scrolls('a'), 1, 'gold in two different games gives a scroll');
insert into public.trophies (player, trophy, season, year) values (pg_temp.id('a'), 't-two', 4, 2026);
select is(pg_temp.scrolls('a'), 1, '... once only');

insert into public.trophies (player, trophy) values (pg_temp.id('b'), 'p-1'), (pg_temp.id('b'), 'p-2');
select is(pg_temp.scrolls('b'), 0, 'two earned pictures give no scroll');
select public.award_trophy(pg_temp.id('b'), 'p-3');
select is(pg_temp.scrolls('b'), 1, 'the third earned picture gives a scroll (through award_trophy too)');

select pg_temp.cat();
select throws_ok($$ select public.teacher_give_name_scroll(pg_temp.id('c')) $$, '42501', null, 'a pupil cannot give a scroll');
select throws_ok($$ insert into public.name_scrolls (player, how) values (pg_temp.id('c'), 'teacher') $$, '42501', null,
  '... or write one in');
select throws_ok($$ select public.ask_for_my_name('Sparky') $$, '42501', null, 'no scroll, no typed name');
select pg_temp.other();
select throws_ok($$ select public.teacher_give_name_scroll(pg_temp.id('c')) $$, '42501', null, 'a teacher of another class cannot give one');
select pg_temp.teacher();
select is(public.teacher_give_name_scroll(pg_temp.id('c')), true, 'their own teacher can give a scroll');
select is(public.teacher_give_name_scroll(pg_temp.id('c')), false, '... one unused at a time');
select pg_temp.reset();

-- ---- Asking: the server's checks ----
select pg_temp.ana();
select throws_ok($$ select public.ask_for_my_name('Sp4rky') $$, '22023', 'Use letters only (one space is fine).', 'letters only');
select throws_ok($$ select public.ask_for_my_name('Big Fat Cat') $$, '22023', null, 'one space only');
select throws_ok($$ select public.ask_for_my_name('Abcdefghijklmno') $$, '22023', 'A name can be up to 14 letters long.', '14 letters at most');
select throws_ok($$ select public.ask_for_my_name('Q') $$, '22023', 'Each word needs at least 2 letters.', 'at least 2 letters');
select throws_ok($$ select public.ask_for_my_name('Fuuuck') $$, '22023', 'Please pick a kinder name.', 'rude words, stretched, are refused');
select throws_ok($$ select public.ask_for_my_name('Big Bum') $$, '22023', 'Please pick a kinder name.', 'a rude word on its own is refused');
select throws_ok($$ select public.ask_for_my_name('ana') $$, '22023', 'Please don''t use your real name. Make one up!', 'their own real name is refused');
select pg_temp.reset();
update public.profiles set display_name = 'Comet' where id = pg_temp.id('b');
select pg_temp.ana();
select throws_ok($$ select public.ask_for_my_name('COMET') $$, '23505', null, 'a name someone has (any case) is refused');
select is(public.ask_for_my_name('  sparky   star '), 'Sparky Star', 'a good name is tidied and sent');
select throws_ok($$ select public.ask_for_my_name('Other') $$, '22023', null, 'one waiting name at a time');
select is(public.my_name_status() -> 'waiting' ->> 'name', 'Sparky Star', 'the pupil sees their waiting name');
select ok(pg_temp.name_of('a') ~ ' [0-9]+$', '... and keeps their old name until a teacher says Yes');
select throws_ok($$ update public.profiles set display_name = 'Sparky Star' where id = auth.uid() $$, '42501', null,
  'a pupil cannot write their name in themself');
select pg_temp.reset();

-- ---- Nobody else sees it ----
create temp table ana_req as select id from public.name_requests where player = pg_temp.id('a');
grant all on ana_req to authenticated;
select pg_temp.ben();
select throws_ok($$ select * from public.name_requests $$, '42501', null, 'a classmate cannot read waiting names');
select is((select count(*)::integer from public.profiles where display_name = 'Sparky Star'), 0, '... nor find it on anyone''s profile');
select ok(public.my_name_status() -> 'waiting' = 'null'::jsonb, '... and their own status shows only their own');
select throws_ok($$ select * from public.teacher_name_requests() $$, '42501', null, '... and they cannot read the teacher list');
select pg_temp.other();
select is((select count(*)::integer from public.teacher_name_requests()), 0, 'a teacher of another class does not see it');
select throws_ok(format('select public.teacher_answer_name(%L, true)', (select id from ana_req)),
  '22023', null, '... and cannot answer it');
select pg_temp.reset();

-- ---- No, then Yes ----
select pg_temp.teacher();
select is((select wanted from public.teacher_name_requests() where student_id = pg_temp.id('a')), 'Sparky Star', 'their teacher sees it');
select is(public.teacher_answer_name((select id from public.teacher_name_requests() where student_id = pg_temp.id('a')), false) ->> 'status',
  'declined', 'the teacher says No');
select pg_temp.ana();
select is(public.my_name_status() -> 'last' ->> 'status', 'declined', 'the pupil hears No');
select is((public.my_name_status() ->> 'scrolls')::integer, 1, '... and keeps the scroll');
select public.ask_for_my_name('Sparky');
select pg_temp.reset();
create temp table old_name as select pg_temp.name_of('a') as name;
grant all on old_name to authenticated;
select pg_temp.teacher();
select is(public.teacher_answer_name((select id from public.teacher_name_requests() where student_id = pg_temp.id('a')), true) ->> 'status',
  'approved', 'the teacher says Yes');
select pg_temp.reset();
select is(pg_temp.name_of('a'), 'Sparky', 'the typed name is now theirs');
select is(pg_temp.scrolls('a'), 0, '... and the scroll is used');

-- Taken by the time the teacher answers.
select pg_temp.cat();
select public.ask_for_my_name('Rocket');
select pg_temp.reset();
update public.profiles set display_name = 'Rocket' where id = pg_temp.id('b');
select pg_temp.teacher();
select is(public.teacher_answer_name((select id from public.teacher_name_requests() where student_id = pg_temp.id('c')), true) ->> 'status',
  'taken', 'a name someone got first is not given twice');
select pg_temp.reset();
select is(pg_temp.scrolls('c'), 1, '... and the scroll is free again');

-- ---- History and putting the made-up name back ----
select pg_temp.ana();
select throws_ok($$ select public.teacher_name_history(pg_temp.id('a')) $$, '42501', null, 'a pupil cannot read the name history');
select pg_temp.teacher();
select is(public.teacher_name_history(pg_temp.id('a')) -> 0 ->> 'name', (select name from old_name), 'the teacher sees the old name');
select is(public.teacher_made_up_name_back(pg_temp.id('a')), (select name from old_name), 'Put the made-up name back gives the old one');
select is(public.teacher_name_history(pg_temp.id('a')) -> 0 ->> 'name', 'Sparky', '... and the typed name stays in the history');

-- ---- Made-up names once a day ----
select pg_temp.cat();
select ok(public.choose_my_name('Speedy', 'Otter') like 'Speedy Otter %', 'a pupil picks a new made-up name');
select throws_ok($$ select public.choose_my_name('Happy', 'Kiwi') $$, '22023', 'You can pick a new name once a day. Come back tomorrow!',
  '... but only once a day');
select is((public.my_name_status() ->> 'canPickToday')::boolean, false, '... and their status says so');
select pg_temp.reset();

-- ---- The name rule on the table itself ----
select throws_ok($$ update public.profiles set display_name = 'sparky' where id = pg_temp.id('c') $$, '23514', null,
  'the table refuses a name that breaks the rule');

select * from finish();
rollback;
