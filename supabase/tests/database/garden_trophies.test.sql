-- Early-years profile rewards (migration 20261112001900_garden_trophies.sql; docs/plans/profile/PLAN.md card P9).
-- Garden Cups from days played, a friend's picture for each finished 30-day golden prize, Quick looks' Garden Gate, the
-- back-award, and that a pupil can't give themselves any of it.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');

create function pg_temp.ana() returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"ana@douglaspark.school.nz","role":"authenticated"}', true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.has(who text, trophy text) returns integer language sql as $$
  select count(*)::integer from public.trophies w where w.player = ('00000000-0000-0000-0000-0000000000' || who)::uuid and w.trophy = has.trophy
$$;
create function pg_temp.cup_level(who text, game text) returns integer language sql as $$
  select c.level from public.trophy_counts(('00000000-0000-0000-0000-0000000000' || who)::uuid) c where c.trophy = game || '-cup'
$$;

select is((select count(*)::integer from public.trophy_types where id like '%-cup' and repeat = 'steps'), 11, 'a Garden Cup for each of the 11 games');
select is((select count(*)::integer from public.trophy_types where kind = 'picture' and sort between 5000 and 5239), 62, '... and 62 friend pictures');

-- ---- A finished day, through the game's own table ----
insert into public.weka_progress (player, days_done) values ('00000000-0000-0000-0000-00000000000a', 29);
update public.weka_progress set days_done = 30 where player = '00000000-0000-0000-0000-00000000000a';
select is(pg_temp.has('0a', 'weka-weka'), 1, 'the 30th day (the first Golden Picnic Basket) gives Weka''s picture');
select is(pg_temp.cup_level('0a', 'weka'), 1, '... and the bronze Garden Cup');
update public.weka_progress set days_done = 31 where player = '00000000-0000-0000-0000-00000000000a';
select is((select count(*)::integer from public.trophies where player = '00000000-0000-0000-0000-00000000000a'), 2, 'day 31 gives nothing more');
update public.weka_progress set days_done = 59 where player = '00000000-0000-0000-0000-00000000000a';
update public.weka_progress set days_done = 60 where player = '00000000-0000-0000-0000-00000000000a';
select is(pg_temp.has('0a', 'weka-kiwi'), 1, 'the second basket gives the second friend, Kiwi');
update public.weka_progress set days_done = 90 where player = '00000000-0000-0000-0000-00000000000a';
select is(pg_temp.cup_level('0a', 'weka'), 2, 'day 90 makes the Garden Cup silver');
select is(pg_temp.has('0a', 'weka-takahe'), 1, '... with the third friend''s picture');

-- ---- Back-award from today's records: 200 days in Hop ----
select public.garden_rewards('00000000-0000-0000-0000-00000000000b', 'hop', 200, true);
select is(pg_temp.cup_level('0b', 'hop'), 3, 'back-award: 200 days played is a gold Garden Cup');
select is((select count(*)::integer from public.trophies where player = '00000000-0000-0000-0000-00000000000b' and trophy like 'hop-%' and trophy <> 'hop-cup'),
          6, '... and all six of Hop''s friends (six golden jars)');
select is(public.garden_rewards('00000000-0000-0000-0000-00000000000b', 'hop', 200, true)::text, '', 'back-award twice changes nothing');
select is((select count(*)::integer from public.trophies where player = '00000000-0000-0000-0000-00000000000b'), 9, '... still 3 cup steps and 6 pictures');

-- ---- Quick looks' Garden Gate ----
insert into public.training_students (player, typing) values ('00000000-0000-0000-0000-00000000000a', '{"q": {"f": 6}}');
select is(pg_temp.has('0a', 'quick-looks-gate'), 0, 'six stages grown: no Garden Gate yet');
update public.training_students set typing = '{"q": {"f": 7}}' where player = '00000000-0000-0000-0000-00000000000a';
select is(pg_temp.has('0a', 'quick-looks-gate'), 1, 'the whole garden (seven stages) opens the Garden Gate');

-- ---- The pupil ----
select pg_temp.ana();
select lives_ok($$ select public.save_my_avatar('{"kind": "cat", "pic": "weka-weka"}') $$, 'Ana can wear the Weka she won');
select throws_ok($$ select public.garden_rewards('00000000-0000-0000-0000-00000000000a', 'pipi', 300, true) $$, '42501', null,
                 'a pupil cannot give themselves garden rewards');
select pg_temp.reset();

select * from finish();
rollback;
