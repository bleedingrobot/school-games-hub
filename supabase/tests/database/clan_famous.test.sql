-- The Famous (migration 20261122000100_clan_famous.sql). When a school's Clan Quest season moves on, the five pupil clans
-- with the most fame win the Hall of Fame Star, the achievement and the title; teachers, hidden pupils and the sixth don't.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Pupils 01 to 07, a hidden pupil (0d) and a teacher (0e).
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-0000000000' || w)::uuid, 'p' || w || '@douglaspark.school.nz'
from unnest(array['01', '02', '03', '04', '05', '06', '07', '0d']) w;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000e';
update public.profiles set hidden = true where id = '00000000-0000-0000-0000-00000000000d';

create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || who)::uuid $$;
create function pg_temp.result(who text, season integer, fame integer) returns void language sql as $$
  insert into public.clan_season_results (player, season, school_id, clan_name, fame)
  select pg_temp.id(who), season, p.school_id, 'Clan ' || who, fame from public.profiles p where p.id = pg_temp.id(who) $$;
create function pg_temp.stars(who text) returns integer language sql as $$
  select count(*)::integer from public.trophies w where w.player = pg_temp.id(who) and w.trophy = 'clan-famous' $$;
create function pg_temp.has_ach(who text) returns boolean language sql as $$
  select exists (select 1 from public.achievements a where a.player = pg_temp.id(who) and a.achievement = 'cq-famous') $$;
create function pg_temp.has_title(who text) returns boolean language sql as $$
  select exists (select 1 from public.owned_titles o where o.player = pg_temp.id(who) and o.title = 'the-famous') $$;
create function pg_temp.wearing(who text) returns text language sql as $$
  select avatar ->> 'title' from public.profiles where id = pg_temp.id(who) $$;
create function pg_temp.school() returns integer language sql as $$
  select school_id from public.profiles where id = pg_temp.id('01') $$;

select is((select kind || '/' || repeat || '/' || game from public.trophy_types where id = 'clan-famous'), 'trophy/season/clan-quest',
  'the Hall of Fame Star is a trophy, won each Clan Quest season');
select ok('the-famous' = any (public.special_title_ids()), 'The Famous is a special title');

-- Season 2: the teacher and the hidden pupil have the most fame, then pupils 01 to 07 (07 has none).
select pg_temp.result('0e', 2, 900);
select pg_temp.result('0d', 2, 800);
select pg_temp.result('01', 2, 600);
select pg_temp.result('02', 2, 500);
select pg_temp.result('03', 2, 400);
select pg_temp.result('04', 2, 300);
select pg_temp.result('05', 2, 200);
select pg_temp.result('06', 2, 100);
select pg_temp.result('07', 2, 0);

delete from public.clan_school_seasons where school_id = pg_temp.school();
insert into public.clan_school_seasons (school_id, season) values (pg_temp.school(), 2);
select is((select count(*)::integer from public.trophies where trophy = 'clan-famous'), 0, 'nothing is given while the season runs');

-- The season turns (as clan_nightly does it).
insert into public.clan_school_seasons (school_id, season) values (pg_temp.school(), 3)
on conflict (school_id) do update set season = excluded.season;

select ok(pg_temp.stars('01') = 1 and pg_temp.stars('05') = 1, 'the top five pupil clans win the Hall of Fame Star');
select is((select count(*)::integer from public.trophies where trophy = 'clan-famous'), 5, '... and nobody else');
select ok(pg_temp.has_ach('03'), '... with the achievement');
select ok(pg_temp.has_title('03'), '... and the title');
select is(pg_temp.wearing('03'), 'the-famous', '... worn straight away');
select is((select (detail ->> 'place')::integer from public.trophies where player = pg_temp.id('02') and trophy = 'clan-famous'), 2,
  'the trophy keeps the clan''s place');
select ok(pg_temp.stars('06') = 0 and not pg_temp.has_title('06'), 'the sixth clan wins nothing');
select ok(pg_temp.stars('0e') = 0 and pg_temp.stars('0d') = 0, 'teachers and hidden pupils win nothing');

-- Running again changes nothing.
select public.clan_give_famous(pg_temp.school(), 2);
select is((select count(*)::integer from public.trophies where trophy = 'clan-famous'), 5, 'giving it again wins no second star');

-- Season 1 to 2 was given by hand, so the trigger leaves it alone.
select pg_temp.result('07', 1, 50);
update public.clan_school_seasons set season = 1 where school_id = pg_temp.school();
update public.clan_school_seasons set season = 2 where school_id = pg_temp.school();
select is(pg_temp.stars('07'), 0, 'season 1 is not given when the season turns');

-- Pupils cannot give it to themselves.
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', json_build_object('sub', pg_temp.id('07'), 'email', 'p07@douglaspark.school.nz', 'role', 'authenticated')::text, true);
select throws_ok($$ select public.clan_famous_give('00000000-0000-0000-0000-000000000007', 1, 50, 1) $$, '42501', null,
  'a pupil cannot call clan_famous_give');

select * from finish();
rollback;
