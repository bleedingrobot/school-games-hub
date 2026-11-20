-- Ultimate Dragon Slayer (migration 20261120001700_ultimate_dragon_slayer.sql; docs/plans/ultimate-dragon-slayer/PLAN.md).
-- A second dragon win in one dragon season gives the achievement, the Dragon Slayer's Crown and the special title, once;
-- one win, or one win in each of two seasons, gives none of them; and pupils cannot give it to themselves.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'p1@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-000000000002', 'p2@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-000000000003', 'p3@douglaspark.school.nz');

create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || who)::uuid $$;
create function pg_temp.slew(who text, season integer) returns void language sql as $$
  insert into public.lord_hall (player, season, kills) values (pg_temp.id(who), season, 1)
  on conflict (player, season) do update set kills = public.lord_hall.kills + 1
$$;
create function pg_temp.crowns(who text) returns integer language sql as $$
  select count(*)::integer from public.trophies w where w.player = pg_temp.id(who) and w.trophy = 'dm-crown' $$;
create function pg_temp.has_ach(who text) returns boolean language sql as $$
  select exists (select 1 from public.achievements a where a.player = pg_temp.id(who) and a.achievement = 'dm-double-season') $$;
create function pg_temp.has_title(who text) returns boolean language sql as $$
  select exists (select 1 from public.owned_titles o where o.player = pg_temp.id(who) and o.title = 'ultimate-dragon-slayer') $$;
create function pg_temp.wearing(who text) returns text language sql as $$
  select avatar ->> 'title' from public.profiles where id = pg_temp.id(who) $$;

update public.app_settings set lord_enabled = true, lord_season_start = public.nz_day(now()), lord_paused_since = null;

select is((select kind || '/' || repeat || '/' || game from public.trophy_types where id = 'dm-crown'), 'trophy/season/dragon-maths',
  'the Dragon Slayer''s Crown is a trophy, won each dragon season');

-- One win: nothing yet.
select pg_temp.slew('01', 1);
select ok(pg_temp.crowns('01') = 0 and not pg_temp.has_ach('01') and not pg_temp.has_title('01'), 'one dragon win gives none of it');

-- A second win in the same season: all three.
select pg_temp.slew('01', 1);
select is(pg_temp.crowns('01'), 1, 'a second win in the season gives the crown');
select ok(pg_temp.has_ach('01'), '... the Ultimate Dragon Slayer achievement');
select ok(pg_temp.has_title('01'), '... and the title');
select is(pg_temp.wearing('01'), 'ultimate-dragon-slayer', '... worn straight away');
select is((select public.trophy_tier(c.level) from public.trophy_counts(pg_temp.id('01')) c where c.trophy = 'dm-crown'), 'bronze',
  'a first season''s crown is bronze');

-- A third win the same season changes nothing; taking the title off sticks.
update public.profiles set avatar = avatar - 'title' where id = pg_temp.id('01');
select pg_temp.slew('01', 1);
select is(pg_temp.crowns('01'), 1, 'a third win the same season wins no second crown');
select is(pg_temp.wearing('01'), null, '... and does not put the title back on');

-- Two wins in the next dragon season: a second crown (silver), still one title.
select pg_temp.slew('01', 2);
select pg_temp.slew('01', 2);
select is(pg_temp.crowns('01'), 2, 'twice again next season wins the crown again');
select is((select count(*)::integer from public.owned_titles where player = pg_temp.id('01')), 1, '... but the title only once');

-- One win in each of two seasons is not twice in one season.
select pg_temp.slew('02', 1);
select pg_temp.slew('02', 2);
select ok(pg_temp.crowns('02') = 0 and not pg_temp.has_ach('02') and not pg_temp.has_title('02'), 'one win in each of two seasons gives none of it');

-- Pupils cannot give it to themselves.
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', json_build_object('sub', pg_temp.id('03'), 'email', 'p3@douglaspark.school.nz', 'role', 'authenticated')::text, true);
select throws_ok($$ select public.lord_give_double('00000000-0000-0000-0000-000000000003', 1) $$, '42501', null,
  'a pupil cannot call lord_give_double');
select throws_ok($$ select public.dragon_maths_counts('00000000-0000-0000-0000-000000000003') $$, '42501', null,
  'a pupil cannot call dragon_maths_counts');

select * from finish();
rollback;
