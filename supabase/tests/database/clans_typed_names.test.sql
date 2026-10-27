-- Clan Quest: made-up hero names (27 Oct 2026). The teacher's switch (off by default, per class), the server being told it,
-- and the teacher seeing a pupil's hero names and swapping made-up ones for names from the list.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000e';
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
create function pg_temp.as_ana() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz') $$;
create function pg_temp.as_t1() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'mr.teacher@douglaspark.school.nz') $$;

create function pg_temp.member(member_name text) returns jsonb language sql as $$
  select jsonb_build_object('name', member_name, 'race', 'Human', 'cls', 'Warrior', 'level', 2, 'xp', 40, 'hp', 20, 'maxHp', 20, 'sp', 5, 'maxSp', 5,
    'stats', jsonb_build_object('agility', 8), 'spells', '[]'::jsonb, 'gear', '{}'::jsonb, 'points', 3, 'knockedOut', false, 'look', 'female-2')
$$;
create function pg_temp.empire() returns jsonb language sql as $$
  select jsonb_build_object('vault', 500, 'wild', 40, 'claimed', 0, 'plots', '[]'::jsonb,
    'troops', jsonb_build_object('footman', 40, 'axeman', 0, 'knight', 0), 'draftPercent', 0, 'day', 15, 'createdDay', 1, 'energyUsed', 0,
    'raidsToday', 0, 'kingdomRaidsToday', 0, 'shieldUntil', 0, 'raidedToday', '[]'::jsonb)
$$;
-- Ben's clan: one made-up name (Zoe), one that would clash with a list name already in use (Wren is kept), and two more.
select is(public.save_clan(pg_temp.id('b'), 0, '00000000-0000-0000-0000-000000000001', 'test', jsonb_build_object(
    'clan', jsonb_build_object('name', 'Blue Banner', 'gold', 200, 'followers', 5,
      'village', jsonb_build_object('trainingHall', 0, 'smithy', 0, 'church', 0), 'wakesToday', 0,
      'members', jsonb_build_array(pg_temp.member('Zoe'), pg_temp.member('Wren'), pg_temp.member('Aria'), pg_temp.member('Te Ahi')),
      'empire', pg_temp.empire()),
    'seed', public.clan_offer_seed(pg_temp.id('b')), 'day', 15, 'createdNzDay', 19000, 'fightsLeft', 8, 'fightNo', 0, 'raidNo', 0,
    'examined', '[]'::jsonb, 'fight', null), '{"type":"test"}') ->> 'status', 'saved', 'ben has a clan with two made-up names');

-- ---- The switch ----
select is(public.clans_settings(pg_temp.id('b')) ->> 'typedNames', 'false', 'made-up names start off');
select is(public.clan_extras(pg_temp.id('b')) -> 'settings' ->> 'typedNames', 'false', 'and the server is told so');

select pg_temp.as_ana();
select throws_ok($$ select public.teacher_set_clan_typed_names(true) $$, '42501', null, 'a pupil cannot switch them on');
select pg_temp.reset();

select pg_temp.as_t1();
create temp table made as select public.teacher_create_class('Room 12', 2026, 5) as id;
grant all on made to authenticated;
select lives_ok($$ select public.teacher_add_to_class((select id from made), array['00000000-0000-0000-0000-00000000000b'::uuid]) $$, 'a teacher puts ben in their class');
select throws_ok($$ select public.teacher_set_clan_typed_names(null, (select id from made)) $$, '22023', null, 'on or off has to be picked');
select is(public.teacher_set_clan_typed_names(true, (select id from made)), true, 'the teacher switches made-up names on for the class');
select pg_temp.reset();
select is(public.clan_extras(pg_temp.id('b')) -> 'settings' ->> 'typedNames', 'true', 'ben''s clan server is told they are on');
select is(public.clans_settings(pg_temp.id('a')) ->> 'typedNames', 'false', 'ana (in no class) still has them off');

-- ---- The teacher sees and swaps hero names ----
select pg_temp.as_t1();
select is(public.teacher_clan_info(pg_temp.id('b')) -> 'heroes', '["Zoe", "Wren", "Aria", "Te Ahi"]'::jsonb, 'the teacher sees ben''s hero names');
select throws_ok($$ select public.teacher_list_hero_names('00000000-0000-0000-0000-00000000000a') $$, '42501', null, 'but cannot change a pupil in no class of theirs');
select is(public.teacher_list_hero_names(pg_temp.id('b')), 2, 'two made-up names are swapped');
select is(public.teacher_clan_info(pg_temp.id('b')) -> 'heroes', '["Bram", "Wren", "Aria", "Cleo"]'::jsonb, '...for the first unused list names, in order');
select is(public.teacher_list_hero_names(pg_temp.id('b')), 0, 'a second go has nothing to change');
select pg_temp.reset();
select is((select version from public.clans where player = pg_temp.id('b')), 2, 'the swap bumps the clan''s version once, so an older save is refused');
select is((select member ->> 'look' from public.clan_members where player = pg_temp.id('b') and slot = 0), 'female-2', 'the hero keeps its look');

select * from finish();
rollback;
