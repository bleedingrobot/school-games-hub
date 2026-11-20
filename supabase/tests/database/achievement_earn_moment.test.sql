-- The achievement earn moment (migration 20261119000300_achievement_earn_moment.sql; docs/ACHIEVEMENTS-PLAN.md stage 3).
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.ana() returns void language sql as $$
  select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz') $$;
create function pg_temp.ben() returns void language sql as $$
  select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz') $$;

-- Ana earned three: two chess ones (one earlier), and a Maths Monsters one while Monsters is switched off for her class.
insert into public.achievements (player, achievement, earned_at) values
  ('00000000-0000-0000-0000-00000000000a', 'chess-first-game', now() - interval '1 hour'),
  ('00000000-0000-0000-0000-00000000000a', 'chess-first-win', now()),
  ('00000000-0000-0000-0000-00000000000a', 'mm-all-badges', now());

select pg_temp.ana();
select is(jsonb_array_length(public.my_new_achievements()), 2, 'my two new chess achievements wait to be shown (Monsters is off)');
select is(public.my_new_achievements() -> 0 ->> 'id', 'chess-first-win', '... newest first');
select ok((public.my_new_achievements() -> 0) ?& array['name', 'emoji', 'how', 'tier', 'game'], '... with name, emoji, how, tier and game');
select throws_ok($$ update public.achievements set seen_at = now() $$, '42501', null, 'I can''t set seen myself');
select pg_temp.ben();
select is(public.my_new_achievements(), '[]'::jsonb, 'a classmate sees none of mine');
select is(public.mark_my_achievements_seen(), 0, '... and can''t mark mine seen');
select pg_temp.ana();
select is(public.mark_my_achievements_seen('{chess-first-win}'), 1, 'a game marks just the one it showed');
select is(public.my_new_achievements() -> 0 ->> 'id', 'chess-first-game', '... the other still waits for the hub');
select public.mark_my_achievements_seen();
select is(public.my_new_achievements(), '[]'::jsonb, 'once shown, none are shown again');

select * from finish();
rollback;
