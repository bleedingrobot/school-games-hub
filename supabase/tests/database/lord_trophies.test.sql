-- Dragon Maths trophies (migration 20261112002400_dragon_trophies.sql; docs/plans/profile/PLAN.md card P4).
-- The Dragon Head (first five in the school each dragon season) and the Slayer's Sword (any dragon win), given on the
-- dragon's own season number, with bronze then silver; who takes a first-five place; what the season road reads; and that
-- pupils cannot give themselves either.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

select setval(pg_get_serial_sequence('public.schools', 'id'), (select max(id) from public.schools));
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id)
  values ('otherschool.school.nz', (select id from public.schools where name = 'Other School'));

-- Pupils 01 to 09 at Douglas Park, a teacher (0e), a hidden pupil (0d) and a pupil at another school (0f).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'p1@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-000000000002', 'p2@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-000000000003', 'p3@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-000000000004', 'p4@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-000000000005', 'p5@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-000000000006', 'p6@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-000000000007', 'p7@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-000000000008', 'p8@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-000000000009', 'p9@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'hid@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'far@otherschool.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000e';
update public.profiles set hidden = true where id = '00000000-0000-0000-0000-00000000000d';

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || who)::uuid $$;
create function pg_temp.pupil(who text) returns void language sql as $$
  select pg_temp.act_as('00000000-0000-0000-0000-0000000000' || who, 'p' || ltrim(who, '0') || '@douglaspark.school.nz') $$;
-- A first dragon win this many hours ago, written straight into the Hall (as lord_commit would have, back then).
create function pg_temp.slew(who text, season integer, hours_ago numeric) returns void language sql as $$
  insert into public.lord_hall (player, season, kills, first_at) values (pg_temp.id(who), season, 1, now() - make_interval(secs => hours_ago * 3600))
$$;
-- How many wins of a trophy a player has, and its metal.
create function pg_temp.wins(who text, trophy text) returns integer language sql as $$
  select count(*)::integer from public.trophies w where w.player = pg_temp.id(who) and w.trophy = $2 $$;
create function pg_temp.tier(who text, trophy text) returns text language sql as $$
  select public.trophy_tier(c.level) from public.trophy_counts(pg_temp.id(who)) c where c.trophy = $2 $$;
-- A hero as the server function hands it over, and one accepted lord_commit request (from lord_l5.test.sql).
create function pg_temp.hero() returns jsonb language sql as $$
  select jsonb_build_object('level', 12, 'exp', 1200, 'hp', 20, 'maxHp', 20, 'strength', 8, 'defence', 1, 'gold', 50, 'bank', 0,
    'gems', 0, 'kindness', 0, 'weapon', 0, 'armour', 0, 'heroClass', 'knight', 'dragonKills', 1, 'day', public.nz_day(now())::text,
    'forestLeft', 10, 'arenaLeft', 3, 'skillLeft', 3, 'masterTried', false, 'forestWins', 0, 'arenaWins', 0, 'masterWins', 0)
$$;
create function pg_temp.c(who text, extras jsonb) returns text language sql as $$
  select public.lord_commit(pg_temp.id(who), jsonb_build_object(
    'expect', coalesce((select version from public.lord_heroes where player = pg_temp.id(who)), 0), 'hero', pg_temp.hero(), 'season', 1,
    'extra', jsonb_build_object('stats', '{"forestWins":0,"masterWins":0,"arenaWins":0,"riddles":0,"dragons":1,"bestLevel":12}'::jsonb),
    'event', jsonb_build_object('requestId', gen_random_uuid(), 'action', 'dragon', 'summary', '{}'::jsonb)) || extras) ->> 'status'
$$;

-- The game is on, and dragon season 1 started today in this school.
update public.app_settings set lord_enabled = true, lord_season_start = public.nz_day(now()), lord_paused_since = null;

-- ---- The two trophy types ----
select is((select kind || '/' || repeat || '/' || game from public.trophy_types where id = 'dm-first-five'), 'picture/season/dragon-maths',
  'the Dragon Head is a picture, won each season, in Dragon Maths');
select is((select kind || '/' || repeat || '/' || game from public.trophy_types where id = 'dm-slayer'), 'trophy/season/dragon-maths',
  'the Slayer''s Sword is a trophy, won each season, in Dragon Maths');

-- ---- The season road before anyone has slain the dragon ----
select pg_temp.pupil('01');
select is(public.lord_first_five(), '{"season": 1, "left": 5}'::jsonb, 'all five places are open at the start of the season');
select pg_temp.reset();

-- ---- Season 1: five pupils slay the dragon, then a sixth ----
select pg_temp.slew('01', 1, 50);
select pg_temp.slew('02', 1, 40);
-- A teacher and a hidden test pupil slay it early too: they win the sword but never take a pupil's place.
select pg_temp.slew('0e', 1, 35);
select pg_temp.slew('0d', 1, 34);
select pg_temp.slew('03', 1, 30);
select pg_temp.pupil('09');
select is(public.lord_first_five() ->> 'left', '2', 'three pupils in, two places left (teachers and hidden pupils don''t count)');
select pg_temp.reset();
select pg_temp.slew('04', 1, 20);
select pg_temp.slew('05', 1, 10);
-- A pupil at another school is first in their own school.
select pg_temp.slew('0f', 1, 60);

select ok(pg_temp.wins('01', 'dm-first-five') = 1 and pg_temp.wins('02', 'dm-first-five') = 1 and pg_temp.wins('03', 'dm-first-five') = 1
  and pg_temp.wins('04', 'dm-first-five') = 1 and pg_temp.wins('05', 'dm-first-five') = 1, 'the first five pupils each win the Dragon Head');
select ok(pg_temp.wins('01', 'dm-slayer') = 1 and pg_temp.wins('05', 'dm-slayer') = 1, '... and the Slayer''s Sword');
select is(pg_temp.tier('01', 'dm-first-five'), 'bronze', 'a first season''s head is bronze');
select is(pg_temp.tier('05', 'dm-slayer'), 'bronze', '... and so is the sword');
select is((select season from public.trophies where player = pg_temp.id('03') and trophy = 'dm-first-five'), 1, 'it is won for the dragon''s season 1');
select is((select (detail ->> 'place')::integer from public.trophies where player = pg_temp.id('03') and trophy = 'dm-first-five'), 3,
  'the win remembers the place');
select is(pg_temp.wins('0e', 'dm-slayer'), 1, 'the teacher wins the sword');
select is(pg_temp.wins('0e', 'dm-first-five'), 0, '... but not the head');
select is(pg_temp.wins('0d', 'dm-slayer') + pg_temp.wins('0d', 'dm-first-five') * 10, 1, 'a hidden pupil wins the sword but not the head');
select is(pg_temp.wins('0f', 'dm-first-five'), 1, 'the race is per school: first in another school wins a head');

select pg_temp.pupil('09');
select is(public.lord_first_five(), '{"season": 1, "left": 0}'::jsonb, 'the season road says no places are left');
select pg_temp.reset();

-- The sixth pupil slays the dragon through the game itself.
select is(pg_temp.c('06', '{"hall":{"season":1}}'), 'saved', 'the sixth pupil''s dragon win saves');
select is(pg_temp.wins('06', 'dm-slayer'), 1, 'the sixth slayer gets the Slayer''s Sword');
select is(pg_temp.wins('06', 'dm-first-five'), 0, '... but not the Dragon Head');
select is((select count(*)::integer from public.trophies t join public.profiles p on p.id = t.player
           where t.trophy = 'dm-first-five' and t.season = 1 and p.school_id = 1), 5, 'Douglas Park has exactly five heads in season 1');

-- Slaying it again the same season changes nothing.
select is(pg_temp.c('01', '{"hall":{"season":1}}'), 'saved', 'a second dragon win in the season saves');
select is((select kills from public.lord_hall where player = pg_temp.id('01') and season = 1), 2, '... and counts in the Hall');
select is(pg_temp.wins('01', 'dm-slayer') + pg_temp.wins('01', 'dm-first-five'), 2, '... but wins no second trophy that season');

-- Later wins never move an earlier head.
select is(pg_temp.tier('05', 'dm-first-five'), 'bronze', 'the fifth still has their bronze head after the sixth slayer');

-- ---- Season 2: silver ----
select pg_temp.slew('02', 2, 3);
select pg_temp.slew('06', 2, 2);
select is(pg_temp.tier('02', 'dm-first-five'), 'silver', 'a head in a second season is silver');
select is(pg_temp.tier('02', 'dm-slayer'), 'silver', '... and so is the sword');
select is(pg_temp.wins('02', 'dm-first-five'), 2, 'one win for each season');
select is(pg_temp.tier('06', 'dm-first-five'), 'bronze', 'last season''s sixth is in the first five this time: a bronze head');
select is(pg_temp.tier('06', 'dm-slayer'), 'silver', '... and a silver sword');
-- Wearing it: the ring follows the new metal.
select pg_temp.pupil('02');
select lives_ok($$ select public.save_my_avatar('{"kind": "cat", "pic": "dm-first-five"}') $$, 'a pupil can wear the Dragon Head they won');
select is((select avatar ->> 'picTier' from public.profiles where id = auth.uid()), 'silver', '... in its silver ring');
select pg_temp.pupil('07');
select throws_ok($$ select public.save_my_avatar('{"kind": "cat", "pic": "dm-first-five"}') $$, '22023', null,
  'a pupil without one cannot wear it');
select pg_temp.reset();

-- ---- Ties on the same instant all count ----
select pg_temp.slew('01', 3, 9);
select pg_temp.slew('02', 3, 8);
select pg_temp.slew('03', 3, 7);
select pg_temp.slew('04', 3, 6);
insert into public.lord_hall (player, season, kills, first_at) values
  (pg_temp.id('05'), 3, 1, now() - interval '5 hours'), (pg_temp.id('07'), 3, 1, now() - interval '5 hours');
select pg_temp.slew('08', 3, 1);
select ok(pg_temp.wins('05', 'dm-first-five') = 2 and pg_temp.wins('07', 'dm-first-five') = 1,
  'two pupils tied for fifth place both win the head');
select is(pg_temp.wins('08', 'dm-first-five'), 0, 'the next one after them does not');
select is(pg_temp.tier('02', 'dm-first-five'), 'gold', 'a third season''s head is gold');

-- ---- Pupils cannot give themselves trophies ----
select pg_temp.pupil('09');
select throws_ok($$ select public.lord_give_trophies(auth.uid(), 1) $$, '42501', null, 'a pupil cannot call lord_give_trophies');
select throws_ok($$ select public.award_trophy(auth.uid(), 'dm-first-five', '{}', 1) $$, '42501', null, '... or award_trophy');
select throws_ok($$ insert into public.lord_hall (player, season, kills) values (auth.uid(), 4, 1) $$, '42501', null,
  '... or write themselves into the Hall of Heroes');
select throws_ok($$ select public.lord_hall_trophies() $$, '42501', null, '... or call the trigger function');
select pg_temp.reset();
select is(pg_temp.wins('09', 'dm-first-five') + pg_temp.wins('09', 'dm-slayer'), 0, 'and has no Dragon Maths trophies');

-- ---- Outside a school ----
select pg_temp.act_as('00000000-0000-0000-0000-0000000000ff', 'someone@gmail.com');
select throws_ok($$ select public.lord_first_five() $$, null, null, 'someone outside a school cannot read the first-five count');
select pg_temp.reset();

select * from finish();
rollback;
