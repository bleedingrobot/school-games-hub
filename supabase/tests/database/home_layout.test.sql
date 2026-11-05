-- Each person's home page layout (migration 20261105000700): folded sections and pinned games, kept on the server.
-- Run on a throw-away copy: scripts/scratch-db.sh layout, then scripts/scratch-test.sh layout supabase/tests/database/home_layout.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(public.my_home_layout(), '{}'::jsonb, 'nothing saved yet: an empty layout');
select lives_ok($$ select public.save_my_home_layout('{"collapsed": ["foundational"], "pinned": ["chess", "pipi"], "extra": 1}') $$,
  'a pupil saves their layout');
select is(public.my_home_layout(), '{"collapsed": ["foundational"], "pinned": ["chess", "pipi"]}'::jsonb, '... and gets it back, tidied');
select lives_ok($$ select public.save_my_home_layout('{"collapsed": []}') $$, 'saving again replaces it');
select is(public.my_home_layout(), '{"collapsed": []}'::jsonb, '... all of it');
select throws_ok($$ select public.save_my_home_layout('{"pinned": [1, 2]}') $$, '22023', null, 'odd layouts are refused');
select throws_ok($$ select * from public.home_layouts $$, '42501', null, 'nobody reads the table directly');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is(public.my_home_layout(), '{}'::jsonb, 'a classmate sees only their own (empty) layout');

select * from finish();
rollback;
