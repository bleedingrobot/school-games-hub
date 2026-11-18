-- Chess looks (20261118003300_chess_looks.sql): unlocks come only from games the server saved, a pupil can't pick a look
-- they haven't unlocked, pupils can't read or write the table directly, and unlocks stay after the games are gone.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.act_as_server() returns void language sql as $$
  select set_config('role', 'service_role', true), set_config('request.jwt.claims', '{"role":"service_role"}', true);
$$;
create function pg_temp.act_as_anon() returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

-- ---- Reading a game's moves ----
select is((public.chess_look_facts(array['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'e1g1'], true)).castled, true,
  'castling as White is spotted');
select is((public.chess_look_facts(array['e2e4', 'e7e5', 'e1e2', 'b8c6', 'e2e1', 'g8f6'], true)).castled, false,
  'a king walking back is not castling');
select is((public.chess_look_facts(array['a2a4', 'h7h5', 'a4a5', 'h5h4', 'a5a6', 'h4h3', 'a6b7', 'h3g2', 'b7a8q', 'g2h1n'],
  false)).promotions, 1, 'promoting a pawn is counted for the right side');
select is((public.chess_look_facts(array['e2e4', 'g8f6', 'd2d4', 'f6g4', 'h2h3', 'g4f2'], false)).last_piece, 'n',
  'the piece that made the last move is known (a knight)');

-- ---- Unlocks come from the server's saved games ----
select pg_temp.act_as_server();
-- A quick win against the Easy bot as White with castling: coast (a win), forest (castled), space (under 20 moves),
-- the Ice Crystal set (beat Easy).
select public.record_bot_game('00000000-0000-0000-0000-00000000000a', 'chess', 'easy', 'white',
  array['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'e1g1'], 'won', 'checkmate', 12, true);
-- A short game (it doesn't count) unlocks nothing for Ben.
select public.record_bot_game('00000000-0000-0000-0000-00000000000b', 'chess', 'easy', 'white',
  array['e2e4', 'e7e5', 'e1g1'], 'won', 'checkmate', 2, false);
select pg_temp.reset();

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(
  (select array(select jsonb_array_elements_text(public.my_chess_looks() -> 'unlocked') order by 1)),
  array['bg:coast', 'bg:forest', 'bg:space', 'set:ice'],
  'a saved win unlocks what the plan says');
select is((public.my_chess_looks() -> 'progress' -> 'bg:snow' ->> 'have')::integer, 1, 'progress counts games that count');
select is(jsonb_array_length(public.my_chess_looks() -> 'fresh'), 4, 'new unlocks wait for the treasure chest');
select lives_ok($$ select public.mark_chess_looks_seen(array['bg:coast', 'bg:volcano']) $$, 'a pupil can mark unlocks seen');
select is(
  (select array(select jsonb_array_elements_text(public.my_chess_looks() -> 'fresh') order by 1)),
  array['bg:forest', 'bg:space', 'set:ice'], 'only unlocked things become seen');

-- ---- Choosing ----
select is(public.set_chess_look('background', 'coast') ->> 'background', 'coast', 'a pupil can use an unlocked background');
select throws_ok($$ select public.set_chess_look('background', 'volcano') $$, '42501', null,
  'a locked background is refused');
select throws_ok($$ select public.set_chess_look('hat', 'castle') $$, '22023', null, 'something that isn''t a look is refused');
select throws_ok($$ update public.chess_looks set unlocked = array['bg:volcano'] $$, '42501', null,
  'pupils cannot write the table themselves');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz');
select is(jsonb_array_length(public.my_chess_looks() -> 'unlocked'), 0, 'a game that doesn''t count unlocks nothing');

-- ---- A New Season deletes the games; the unlocks stay ----
select pg_temp.reset();
delete from public.bot_games where true;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz');
select is(jsonb_array_length(public.my_chess_looks() -> 'unlocked'), 4, 'unlocks stay when the games are deleted');

select pg_temp.act_as_anon();
select throws_ok($$ select public.my_chess_looks() $$, '42501', null, 'signed-out visitors cannot call it');

select * from finish();
rollback;
