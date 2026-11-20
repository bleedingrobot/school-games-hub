-- Stories seen (20261121000100_story_seen.sql): a pupil marks and reads only their own stories, bad ids are ignored,
-- outsiders and signed-out visitors get nothing, and nobody reads the table directly.
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
create function pg_temp.act_as_anon() returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
$$;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(public.my_stories_seen(), '{}'::text[], 'nothing seen at first');
select public.mark_story_seen('trader-opening');
select public.mark_story_seen('goblinstorm-hero-knight');
select public.mark_story_seen('trader-opening');
select is(public.my_stories_seen(), array['goblinstorm-hero-knight', 'trader-opening'], 'marked stories come back once each, sorted');
select public.mark_story_seen('Bad Id!');
select public.mark_story_seen('');
select is(cardinality(public.my_stories_seen()), 2, 'bad ids are ignored');
select throws_ok($$ select * from public.story_seen $$, '42501', null, 'a pupil cannot read the table directly');
select throws_ok($$ insert into public.story_seen (player, story) values ('00000000-0000-0000-0000-00000000000b', 'x-y') $$,
  '42501', null, 'a pupil cannot write the table directly');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is(public.my_stories_seen(), '{}'::text[], 'another pupil does not see Ana''s stories');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'cat@gmail.com');
select public.mark_story_seen('trader-opening');
select is(public.my_stories_seen(), '{}'::text[], 'someone outside the school saves nothing');

select pg_temp.act_as_anon();
select throws_ok($$ select public.my_stories_seen() $$, '42501', null, 'signed-out visitors cannot read');
select throws_ok($$ select public.mark_story_seen('trader-opening') $$, '42501', null, 'signed-out visitors cannot mark');

select * from finish();
rollback;
