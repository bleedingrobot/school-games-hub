-- Play anyone, stage 4 (migration 20261120000800): invites by name to the board games. Every stage 1 rule (pupils only,
-- hidden never, same school, "Play other classes" in both classes), friends' games and non-maths games switched on for
-- both (not needed for Wormholes & Black Holes), one waiting invite each way, No, Call off, the 60-second wait, Yes taken
-- once by the server, and what hub_here() and lobby_here() say.
-- Run on a throw-away copy: scripts/scratch-test.sh <name> supabase/tests/database/name_invites.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

-- Ana and Ben in Room 1, Cat in Room 2, Hid in Room 2 but hidden, Dan at another school, Eve a teacher of both rooms.
select setval(pg_get_serial_sequence('public.schools', 'id'), 1);
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id) values ('otherschool.school.nz', 2);
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'dan@otherschool.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'hid@douglaspark.school.nz');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000000e';
update public.profiles set hidden = true where id = '00000000-0000-0000-0000-00000000000f';
update public.schools set default_class = null where id = 1;
delete from public.class_members where student_id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b',
  '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000f');
insert into public.classes (id, school_id, name, school_year, warp_code) values
  ('11111111-1111-4111-8111-111111111111', 1, 'Room 1', 2026, 'CDFGH'), ('22222222-2222-4222-8222-222222222222', 1, 'Room 2', 2026, 'CDFGJ');
insert into public.class_members (student_id, class_id, how) values
  ('00000000-0000-0000-0000-00000000000a', '11111111-1111-4111-8111-111111111111', 'teacher'),
  ('00000000-0000-0000-0000-00000000000b', '11111111-1111-4111-8111-111111111111', 'teacher'),
  ('00000000-0000-0000-0000-00000000000c', '22222222-2222-4222-8222-222222222222', 'teacher'),
  ('00000000-0000-0000-0000-00000000000f', '22222222-2222-4222-8222-222222222222', 'teacher');
insert into public.class_teachers (class_id, teacher_id) values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-00000000000e'), ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-00000000000e');
insert into public.app_settings (school_id, class_id) select school_id, id from public.classes
  where id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222')
  and not exists (select 1 from public.app_settings s where s.class_id = classes.id);
update public.app_settings set multiplayer_enabled = true, non_maths_games = true;

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000000' || who)::uuid $$;
create function pg_temp.kid(who text) returns void language sql as $$
  select pg_temp.act_as(pg_temp.id(who)::text, (case who when 'a' then 'ana' when 'b' then 'ben' when 'c' then 'cat' when 'f' then 'hid' else 'dan' end)
    || (case who when 'd' then '@otherschool.school.nz' else '@douglaspark.school.nz' end))
$$;
create function pg_temp.room(n integer, on_ boolean) returns void language sql as $$
  select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
  select public.teacher_set_play_other_classes(on_, (repeat(n::text, 8) || '-' || repeat(n::text, 4) || '-4' || repeat(n::text, 3) || '-8' || repeat(n::text, 3) || '-' || repeat(n::text, 12))::uuid);
  select pg_temp.reset();
$$;
create function pg_temp.set_room(n integer, col text, on_ boolean) returns void language plpgsql as $$
begin
  execute format('update public.app_settings set %I = $1 where class_id = %L', col,
    case n when 1 then '11111111-1111-4111-8111-111111111111' else '22222222-2222-4222-8222-222222222222' end) using on_;
end $$;
-- An invite from one kid to another; the reply.
create function pg_temp.send(who text, game text, other text, setup jsonb default null) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform pg_temp.kid(who);
  r := public.board_invite_send(game, pg_temp.id(other), setup);
  perform pg_temp.reset();
  return r;
end $$;
create function pg_temp.msg(r jsonb) returns text language sql as $$ select case when (r ->> 'ok')::boolean then 'ok' else r ->> 'message' end $$;
create function pg_temp.cancel(who text) returns void language plpgsql as $$
begin
  perform pg_temp.kid(who);
  perform public.board_invite_cancel();
  perform pg_temp.reset();
end $$;
create function pg_temp.seen(who text) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.kid(who);
  select count(*) into n from public.board_invites;
  perform pg_temp.reset();
  return n;
end $$;
create function pg_temp.status(invite bigint) returns text language sql as $$ select status from public.board_invites where id = invite $$;
create function pg_temp.take(invite bigint, who text, kind text) returns uuid language plpgsql as $$
declare r uuid;
begin
  perform set_config('role', 'service_role', true);
  select t.seat_a into r from public.board_invite_take(invite, pg_temp.id(who), kind) t;
  perform pg_temp.reset();
  return r;
end $$;
create function pg_temp.lobby_games(who text, other text) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform pg_temp.kid(who);
  select o -> 'games' into r from jsonb_array_elements(public.lobby_here() -> 'online') o where o ->> 'id' = pg_temp.id(other)::text;
  perform pg_temp.reset();
  return r;
end $$;
insert into public.hub_here (player) select pg_temp.id(w) from unnest(array['a', 'b', 'c', 'd', 'f']) w;

-- Across classes at one school.
create temp table sent (name text primary key, id bigint);
grant all on sent to authenticated, service_role;
select is(pg_temp.msg(pg_temp.send('a', 'chess', 'c')), 'ok', 'Ana (Room 1) can invite Cat (Room 2) to Chess');
insert into sent select 'ac', max(id) from public.board_invites;
select ok((select deadline between now() + interval '59 seconds' and now() + interval '61 seconds' from public.board_invites where id = (select id from sent where name = 'ac')),
  'the invite waits 60 seconds');
select is((select seat_a from public.board_invites where id = (select id from sent where name = 'ac')), pg_temp.id('a'), 'Ana is seat 1');
select is(pg_temp.seen('c'), 1::bigint, 'Cat can read the invite sent to her');
select is(pg_temp.seen('b'), 0::bigint, 'Ben can’t read it');

-- What the hub and the Lobby say.
select pg_temp.kid('c');
select ok(public.hub_here() -> 'waiting' ? 'chess', 'Cat''s hub check-in says a Chess invite is waiting');
select pg_temp.reset();
select is(pg_temp.lobby_games('b', 'c') ->> 'chess', 'busy', 'in Ben''s Lobby Cat is busy: she has an invite waiting');
select is(pg_temp.lobby_games('b', 'a') ->> 'checkers', 'ok', 'Ben can invite Ana to Checkers');

-- One waiting invite each way.
select is(pg_temp.msg(pg_temp.send('a', 'checkers', 'b')), 'You already have an invite waiting. Call it off first.', 'one invite out at a time');
select is(pg_temp.msg(pg_temp.send('b', 'chess', 'c')), 'They have another invite waiting. Try again in a minute.', 'one invite in at a time');

-- No, from Cat only.
select pg_temp.kid('b');
select public.board_invite_decline((select id from sent where name = 'ac'));
select pg_temp.reset();
select is(pg_temp.status((select id from sent where name = 'ac')), 'asked', 'Ben can’t say no for Cat');
select pg_temp.kid('c');
select public.board_invite_decline((select id from sent where name = 'ac'));
select pg_temp.reset();
select is(pg_temp.status((select id from sent where name = 'ac')), 'declined', 'Cat says no');
select is(pg_temp.take((select id from sent where name = 'ac'), 'c', 'chess'), null, 'a declined invite can’t be taken');

-- Never other schools, never hidden kids, never yourself.
select is(pg_temp.msg(pg_temp.send('a', 'chess', 'd')), 'That player’s class isn’t playing other classes right now.', 'never a kid at another school');
select is(pg_temp.msg(pg_temp.send('d', 'chess', 'a')), 'That player’s class isn’t playing other classes right now.', 'not the other way either');
select is(pg_temp.msg(pg_temp.send('a', 'chess', 'f')), 'They can’t play right now.', 'never a hidden kid');
select is(pg_temp.msg(pg_temp.send('f', 'chess', 'a')), 'Playing friends isn’t available for you right now. Ask your teacher.', 'a hidden kid can’t invite');
select is(pg_temp.msg(pg_temp.send('a', 'chess', 'a')), 'That’s you!', 'not yourself');

-- "Play other classes" off in either class stops it (but never within a class).
select pg_temp.room(2, false);
select is(pg_temp.msg(pg_temp.send('a', 'chess', 'c')), 'That player’s class isn’t playing other classes right now.', 'Room 2 off: Ana can’t invite Cat');
select pg_temp.room(2, true);
select pg_temp.room(1, false);
select is(pg_temp.msg(pg_temp.send('c', 'chess', 'a')), 'That player’s class isn’t playing other classes right now.', 'Room 1 off: Cat can’t invite Ana');
select is(pg_temp.msg(pg_temp.send('a', 'chess', 'b')), 'ok', 'Room 1 off: Ana can still invite Ben, in her class');
select pg_temp.cancel('a');
select is((select status from public.board_invites where seat_a = pg_temp.id('a') order by id desc limit 1), 'cancelled', 'Ana calls it off');
select pg_temp.room(1, true);

-- Friends' games and non-maths games.
select pg_temp.set_room(2, 'multiplayer_enabled', false);
select is(pg_temp.msg(pg_temp.send('a', 'space', 'c')), 'Their class has paused this game right now.', 'friends'' games off in Room 2 stops even Wormholes');
select is(pg_temp.lobby_games('a', 'c') ->> 'space', 'off', 'and Ana''s Lobby shows Cat as off');
select pg_temp.set_room(2, 'multiplayer_enabled', true);
select pg_temp.set_room(1, 'non_maths_games', false);
select is(pg_temp.msg(pg_temp.send('a', 'power-clash', 'c')), 'Your teacher has paused this.', 'non-maths paused in Ana''s class stops Power Clash');
select is(pg_temp.msg(pg_temp.send('c', '101', 'a')), 'Their class has paused this game right now.', 'and Cat can’t invite Ana to 101');
select ok(not (pg_temp.lobby_games('a', 'c') ? 'chess') and pg_temp.lobby_games('a', 'c') ? 'space', 'Ana''s Lobby offers only Wormholes');
select is(pg_temp.msg(pg_temp.send('a', 'space', 'c', '{"board": "nebula"}')), 'ok', 'Wormholes is maths: still fine');
insert into sent select 'space', max(id) from public.board_invites;
select is((select setup from public.board_invites where id = (select id from sent where name = 'space')), '{"board": "nebula"}'::jsonb, 'the Wormholes choices are kept');

-- Yes, through the game's server: the right kid and game only, once.
select pg_temp.set_room(1, 'non_maths_games', true);
select is(pg_temp.take((select id from sent where name = 'space'), 'b', 'space'), null, 'only Cat can take it');
select is(pg_temp.take((select id from sent where name = 'space'), 'c', 'chess'), null, 'only for its own game');
select is(pg_temp.take((select id from sent where name = 'space'), 'c', 'space'), pg_temp.id('a'), 'Cat''s Yes gives the server Ana, for seat 1');
select is(pg_temp.take((select id from sent where name = 'space'), 'c', 'space'), null, 'and only once');
select set_config('role', 'service_role', true);
select public.board_invite_made((select id from sent where name = 'space'), '/space-game/12345678-1234-4234-8234-123456789012');
select pg_temp.reset();
select is((select status || ' ' || path from public.board_invites where id = (select id from sent where name = 'space')),
  'accepted /space-game/12345678-1234-4234-8234-123456789012', 'the game is made: Ana hears where it is');

-- Pupils can't take or make an invite themselves.
select pg_temp.kid('c');
select throws_ok($$ select public.board_invite_take(1, '00000000-0000-0000-0000-00000000000c', 'chess') $$, '42501', null, 'pupils can’t take an invite');
select pg_temp.reset();

-- After 60 seconds the invite is gone, and a new one can go.
select is(pg_temp.msg(pg_temp.send('b', 'checkers', 'c')), 'ok', 'Ben invites Cat');
insert into sent select 'bc', max(id) from public.board_invites;
update public.board_invites set deadline = now() - interval '1 second' where id = (select id from sent where name = 'bc');
select is(pg_temp.take((select id from sent where name = 'bc'), 'c', 'checkers'), null, 'too late to say yes');
select is(pg_temp.msg(pg_temp.send('a', 'chess', 'c')), 'ok', 'Cat can be invited again');
select is(pg_temp.status((select id from sent where name = 'bc')), 'expired', 'and Ben''s old invite is marked run out');

select * from finish();
rollback;
