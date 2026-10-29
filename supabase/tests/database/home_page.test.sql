-- Server load S.2: my_home_page() gives the home page everything in one answer. It must give exactly what the page got from its
-- separate requests (the jobs it calls, and the same table reads with the same order and limits), for a pupil with lots of games
-- of every kind, a brand-new pupil, a teacher, a hidden pupil, a class with a maths focus and one without, and with the games
-- switched off. It runs as the pupil, so nobody sees another pupil's private rows through it.
-- Run with: npm run test:db  (needs the local Supabase copy running: npx supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

create function pg_temp.uid(n integer) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;
-- A school with no default class, so pupils are only in the classes their teachers put them in.
select setval(pg_get_serial_sequence('public.schools', 'id'), 1);
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id) values ('otherschool.school.nz', 2);

-- 1 Ana: lots of games of every kind, in Room 12 (with a maths focus). 2 Ben: Ana's classmate, in Room 14 (no focus).
-- 3 Cat: hidden, has played Ana. 4 Dan: brand new. 11 and 12: teachers of Room 12 and Room 14.
insert into auth.users (id, email) values
  (pg_temp.uid(1), 'ana@otherschool.school.nz'), (pg_temp.uid(2), 'ben@otherschool.school.nz'),
  (pg_temp.uid(3), 'cat@otherschool.school.nz'), (pg_temp.uid(4), 'dan@otherschool.school.nz'),
  (pg_temp.uid(11), 'mr.teacher@otherschool.school.nz'), (pg_temp.uid(12), 'ms.teacher@otherschool.school.nz');
update public.profiles set role = 'teacher' where id in (pg_temp.uid(11), pg_temp.uid(12));

create temp table emails as select id, email from auth.users;
grant select on emails to public;
create function pg_temp.as(n integer) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(n),
           'email', (select e.email from pg_temp.emails e where e.id = pg_temp.uid(n)), 'role', 'authenticated')::text, true)
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create temp table made (name text primary key, id uuid);
grant all on made to authenticated;

-- Room 12 (Ana and Cat) has a maths focus; Room 14 (Ben) has none.
select pg_temp.as(11);
insert into pg_temp.made values ('room12', public.teacher_create_class('Room 12', 2026, 5));
select public.teacher_add_to_class((select id from pg_temp.made where name = 'room12'), array[pg_temp.uid(1), pg_temp.uid(3)]);
select public.teacher_set_maths_focus((select id from pg_temp.made where name = 'room12'), 'class', null, array['tables-6-9'], false, 'friday');
select pg_temp.as(12);
insert into pg_temp.made values ('room14', public.teacher_create_class('Room 14', 2026, 6));
select public.teacher_add_to_class((select id from pg_temp.made where name = 'room14'), array[pg_temp.uid(2)]);
select pg_temp.reset();

-- ---- Ana's games: more than the page shows of every kind, each a minute apart so the order is clear ----
insert into public.bot_games (player, game, bot_level, player_side, moves, result, reason, player_moves, counts_for_points, finished_at)
select pg_temp.uid(1), case when n % 2 = 0 then 'chess' else 'checkers' end, 'easy', 'white', '{}',
       (array['won', 'lost', 'drawn'])[n % 3 + 1], 'checkmate', 20, true, now() - n * interval '1 minute'
from generate_series(1, 8) n;
insert into public.bot_games (player, game, bot_level, player_side, moves, result, reason, player_moves, counts_for_points, finished_at)
values (pg_temp.uid(2), 'chess', 'medium', 'white', '{}', 'won', 'checkmate', 20, true, now());

-- Friend games: finished against Ben and hidden Cat, two being played and one waiting.
insert into public.mp_games (game, created_by, first_player, second_player, status, winner, reason, counts_for_points, created_at, finished_at)
select case when n % 2 = 0 then 'chess' else 'checkers' end, pg_temp.uid(1), pg_temp.uid(1), pg_temp.uid(case when n % 3 = 0 then 3 else 2 end),
       'finished', (array['first', 'second', null])[n % 3 + 1], 'checkmate', true,
       now() - interval '1 day' - n * interval '1 minute', now() - n * interval '1 minute' - interval '30 seconds'
from generate_series(1, 7) n;
insert into public.mp_games (game, created_by, first_player, second_player, status, created_at, started_at) values
  ('chess', pg_temp.uid(2), pg_temp.uid(2), pg_temp.uid(1), 'playing', now() - interval '2 minutes', now()),
  ('checkers', pg_temp.uid(1), pg_temp.uid(1), pg_temp.uid(3), 'playing', now() - interval '3 minutes', now());
insert into public.mp_games (game, created_by, first_player, status, in_lobby, code, created_at, expires_at)
values ('chess', pg_temp.uid(1), pg_temp.uid(1), 'waiting', true, 'KM4TP', now() - interval '1 minute', now() + interval '10 minutes');
-- Ben plays hidden Cat, a game Ana must never see.
insert into public.mp_games (game, created_by, first_player, second_player, status, created_at, started_at)
values ('chess', pg_temp.uid(2), pg_temp.uid(2), pg_temp.uid(3), 'playing', now(), now());

-- Space games with classmates: six finished, one being played.
insert into public.space_games (code, host, seat1, seat2, status, setup, rockets, seat_info, state, created_at, finished_at, ending, places, counts)
select null, pg_temp.uid(1), pg_temp.uid(1), pg_temp.uid(2), 'finished', '{}', 2, '[]', '{}', now() - interval '1 day' - n * interval '1 minute',
       now() - n * interval '1 minute' - interval '10 seconds', 'docked', case when n % 2 = 0 then array[1, 2] else array[2, 1] end,
       array[true, true]
from generate_series(1, 6) n;
insert into public.space_games (code, host, seat1, seat2, status, setup, rockets, seat_info, state, created_at)
values ('CDFGH', pg_temp.uid(1), pg_temp.uid(1), pg_temp.uid(2), 'playing', '{}', 2, '[]', '{}', now() - interval '4 minutes');

-- Power Clash: six finished, one being played.
create function pg_temp.power(a integer, b integer, status text, at timestamptz) returns uuid language sql as $$
  insert into public.power_games (host, seat1, seat2, status, loadouts, game, created_at, started_at, last_action_at, deadline)
  values (pg_temp.uid(a), pg_temp.uid(a), pg_temp.uid(b), status,
    '[["force-field","body-swap","freeze-ray"],["board-wipe","body-swap","freeze-ray"]]', '{"match":{}}', at, at, at, at + interval '60 seconds')
  returning id
$$;
create temp table powers as select n, pg_temp.power(1, 2, 'playing', now() - interval '1 day' - n * interval '1 minute') as id from generate_series(1, 6) n;
update public.power_games g set status = 'finished', ending = 'finished', won = case when made.n % 2 = 0 then array[true, false] else array[false, true] end,
  counts = array[true, true], finished_at = now() - made.n * interval '1 minute' - interval '20 seconds', deadline = null
from powers made where g.id = made.id;
select pg_temp.power(2, 1, 'playing', now() - interval '5 minutes');

-- 101 with classmates, written the way the server does: six finished, one being played. Each seat row is its player's own.
create function pg_temp.card(players integer[], status text, places jsonb) returns uuid language sql as $$
  select (public.card_game_write(null,
    jsonb_build_object('id', gen_random_uuid(), 'in_lobby', false, 'host', pg_temp.uid(players[1]),
      'seat1', pg_temp.uid(players[1]), 'seat2', pg_temp.uid(players[2]), 'wanted', 2, 'settings', '{"target":101}'::jsonb,
      'status', status, 'version', 0, 'expires_at', now() + interval '10 minutes', 'last_action_at', now(),
      'game', '{"stack":["AS","2S"],"hands":[["KH"]]}'::jsonb, 'ending', case when status = 'finished' then 'finished' end,
      'places', places, 'finished_at', case when status = 'finished' then now() end,
      'counts', case when status = 'finished' then '[true, true]'::jsonb end),
    (select jsonb_agg(jsonb_build_object('player', pg_temp.uid(p), 'seat', i - 1,
       'info', jsonb_build_object('status', status, 'players', to_jsonb(players), 'places', places,
                                  'ending', case when status = 'finished' then 'finished' end, 'expiresAt', now() + interval '10 minutes'),
       'view', jsonb_build_object('mine', 'secret-of-' || p), 'events', '[]'::jsonb))
     from unnest(players) with ordinality t(p, i)))).id
$$;
create temp table cards as
select n, pg_temp.card(array[1, 2], 'finished', case when n % 2 = 0 then '[1, 2]'::jsonb else '[2, 1]'::jsonb end) as id from generate_series(1, 6) n;
insert into cards select 0, pg_temp.card(array[2, 1], 'playing', null);
update public.card_game_seats s set updated_at = now() - c.n * interval '1 minute' from cards c where s.game = c.id;
select pg_temp.reset();
update public.profiles set hidden = true where id = pg_temp.uid(3);

-- ---- What the page asked for before, one request at a time, as the person asking ----
-- Each table read is the page's own (src/data/*.ts) as the server runs it: a list in the order asked for. The names lookup is the
-- page's too: the other players in the recent friend games and the ones being played, not me.
create function pg_temp.separate() returns jsonb language sql as $$
  with
    fr as (select g.* from public.mp_games g where g.status = 'finished' order by g.finished_at desc limit 5),
    fo as (select g.* from public.mp_games g where g.status in ('waiting', 'playing') order by g.created_at desc limit 10)
  select jsonb_build_object(
    'progress', public.my_progress(),
    'botRecent', (select coalesce(json_agg(t), '[]')::jsonb from (select g.id, g.game, g.bot_level, g.result, g.reason, g.finished_at,
                   g.space -> 'place' as place, g.card101 -> 'place' as "card101Place" from public.bot_games g order by g.finished_at desc limit 5) t),
    'botStats', (select coalesce(json_agg(t), '[]')::jsonb from public.my_bot_game_stats() t),
    'friendRecent', (select coalesce(json_agg(t), '[]')::jsonb from (select id, game, code, in_lobby, created_by, first_player, second_player, status,
                     moves, version, created_at, expires_at, started_at, turn_started_at, draw_offer, first_draw_offers, second_draw_offers,
                     first_offer_ply, second_offer_ply, winner, reason, counts_for_points, finished_at, first_wants_rematch, second_wants_rematch,
                     rematch_game from fr order by finished_at desc) t),
    'friendStats', (select coalesce(json_agg(t), '[]')::jsonb from public.my_friend_game_stats() t),
    'friendOpen', (select coalesce(json_agg(t), '[]')::jsonb from (select id, game, code, in_lobby, created_by, first_player, second_player, status,
                   moves, version, created_at, expires_at, started_at, turn_started_at, draw_offer, first_draw_offers, second_draw_offers,
                   first_offer_ply, second_offer_ply, winner, reason, counts_for_points, finished_at, first_wants_rematch, second_wants_rematch,
                   rematch_game from fo order by created_at desc) t),
    'players', (select coalesce(json_agg(t), '[]')::jsonb from (select p.id, p.display_name, p.avatar from public.profiles p where p.id in (
                  select x from (select first_player, second_player from fr union all select first_player, second_player from fo where status = 'playing') g,
                  unnest(array[g.first_player, g.second_player]) x where x <> auth.uid()) order by p.id) t),
    'spaceRecent', (select coalesce(json_agg(t), '[]')::jsonb from (select id, code, in_lobby, host, seat1, seat2, seat3, seat4, status, setup, rockets,
                    seat_info, version, created_at, expires_at, started_at, finished_at, ending, places, counts, rematch_game
                    from public.space_games where status = 'finished' order by finished_at desc limit 5) t),
    'spaceOpen', (select coalesce(json_agg(t), '[]')::jsonb from (select id, code, in_lobby, host, seat1, seat2, seat3, seat4, status, setup, rockets,
                  seat_info, version, created_at, expires_at, started_at, finished_at, ending, places, counts, rematch_game
                  from public.space_games where status in ('waiting', 'playing') order by created_at desc limit 10) t),
    'spaceStats', (select to_jsonb(t) from public.my_space_game_stats() t),
    'cardRecent', (select coalesce(json_agg(t), '[]')::jsonb from (select game, player, seat, version, status, info, updated_at
                   from public.card_game_seats where status = 'finished' order by updated_at desc limit 5) t),
    'cardOpen', (select coalesce(json_agg(t), '[]')::jsonb from (select game, player, seat, version, status, info, updated_at
                 from public.card_game_seats where status in ('waiting', 'playing') order by updated_at desc limit 10) t),
    'cardStats', (select to_jsonb(t) from public.my_card_game_stats() t),
    'powerRecent', (select coalesce(json_agg(t), '[]')::jsonb from (select id, code, in_lobby, host, seat1, seat2, loadouts, status, version, created_at,
                    expires_at, started_at, finished_at, ending, leaver, won, counts, rematch_game
                    from public.power_games where status = 'finished' order by finished_at desc limit 5) t),
    'powerOpen', (select coalesce(json_agg(t), '[]')::jsonb from (select id, code, in_lobby, host, seat1, seat2, loadouts, status, version, created_at,
                  expires_at, started_at, finished_at, ending, leaver, won, counts, rematch_game
                  from public.power_games where status in ('waiting', 'playing') order by created_at desc limit 10) t),
    'powerStats', (select to_jsonb(t) from public.my_power_game_stats() t),
    'movesLeft', public.my_moves_left(),
    'myClass', public.my_class(),
    'focus', public.my_maths_focus(),
    'ladder', public.my_ladder())
$$;
create function pg_temp.home() returns jsonb language sql as $$ select public.my_home_page() $$;
create function pg_temp.len(part text) returns integer language sql as $$ select jsonb_array_length(public.my_home_page() -> part) $$;

-- ---- Ana: lots of games ----
select pg_temp.as(1);
select is(pg_temp.home(), pg_temp.separate(), 'Ana (lots of games of every kind): the same answer as the separate requests');
select is(pg_temp.len('botRecent'), 5, 'her 5 most recent bot games');
select is((select array_agg(g ->> 'finished_at') from jsonb_array_elements(pg_temp.home() -> 'botRecent') g),
  (select array_agg(f::text) from (select to_jsonb(finished_at) #>> '{}' f from public.bot_games order by finished_at desc limit 5) x),
  'newest first');
select is(pg_temp.len('friendRecent'), 5, 'her 5 most recent friend games');
select is(pg_temp.len('friendOpen'), 3, 'the two being played and the waiting one');
select is((select array_agg(p ->> 'display_name' order by p ->> 'display_name') from jsonb_array_elements(pg_temp.home() -> 'players') p),
  (select array_agg(display_name) from public.profiles where id = pg_temp.uid(2)),
  'names and avatars: only Ben, not hidden Cat and not herself');
select is(pg_temp.len('spaceRecent'), 5, '5 space games');
select is(pg_temp.len('spaceOpen'), 1, 'the space game being played');
select is(pg_temp.home() -> 'spaceStats', '{"played": 6, "firsts": 3}', 'space totals');
select is(pg_temp.len('cardRecent'), 5, '5 games of 101');
select is(pg_temp.len('cardOpen'), 1, 'the 101 game being played');
select is((select count(*)::int from jsonb_array_elements((pg_temp.home() -> 'cardRecent') || (pg_temp.home() -> 'cardOpen')) s
           where s ->> 'player' <> pg_temp.uid(1)::text), 0, 'only her own seat rows of 101');
select is(pg_temp.home() -> 'cardStats', '{"played": 6, "won": 3}', '101 totals');
select is(pg_temp.len('powerRecent'), 5, '5 Power Clash games');
select is(pg_temp.len('powerOpen'), 1, 'the Power Clash game being played');
select is(pg_temp.home() -> 'powerStats', '{"played": 6, "won": 3}', 'Power Clash totals');
select is((select sum((s ->> 'played')::int)::int from jsonb_array_elements(pg_temp.home() -> 'botStats') s), 8, 'all 8 bot games in her stats');
select is(pg_temp.home() -> 'myClass' ->> 'className', 'Room 12', 'her class');
select is(pg_temp.home() -> 'focus' ->> 'source', 'teacher-class', 'her class''s maths focus');
select is(pg_temp.home() -> 'focus', public.my_maths_focus(), 'the focus is my_maths_focus''s');
select is(pg_temp.home() -> 'ladder', public.my_ladder(), 'the maths path is my_ladder''s');
select is(pg_temp.home() -> 'progress', public.my_progress(), 'points and level are my_progress''s');
select is(pg_temp.home() -> 'movesLeft', public.my_moves_left(), 'moves left are my_moves_left''s');

-- ---- Ben: a classmate in a class without a focus, who also played Cat ----
select pg_temp.as(2);
select is(pg_temp.home(), pg_temp.separate(), 'Ben (class without a focus): the same answer as the separate requests');
select is(pg_temp.home() -> 'focus' ->> 'source', 'auto', 'no focus in his class');
select is((select count(*)::int from jsonb_array_elements((pg_temp.home() -> 'cardRecent') || (pg_temp.home() -> 'cardOpen')) s
           where s ->> 'player' <> pg_temp.uid(2)::text), 0, 'he never sees Ana''s seat rows of 101 (her cards)');
select is((select count(*)::int from jsonb_array_elements(pg_temp.home() -> 'botRecent')), 1, 'he sees only his own bot game, not Ana''s');
select is((select count(*)::int from jsonb_array_elements(pg_temp.home() -> 'friendOpen') g where g ->> 'status' = 'waiting'), 0,
  'and not Ana''s waiting games');

-- ---- Cat: hidden ----
select pg_temp.as(3);
select is(pg_temp.home(), pg_temp.separate(), 'Cat (hidden): the same answer as the separate requests');
select is(pg_temp.len('friendRecent'), 2, 'a hidden pupil still sees her own games');

-- ---- Dan: brand new ----
select pg_temp.as(4);
select is(pg_temp.home(), pg_temp.separate(), 'Dan (brand new): the same answer as the separate requests');
select is((select count(*)::int from jsonb_each(pg_temp.home()) p where case when jsonb_typeof(p.value) = 'array' then jsonb_array_length(p.value) > 0 else false end), 0,
  'every list is empty for a brand-new pupil (no other pupil''s games)');
select is(pg_temp.home() -> 'spaceStats', '{"played": 0, "firsts": 0}', 'and his totals are nought');
select is(pg_temp.home() -> 'myClass' ->> 'className', null, 'no class yet');

-- ---- Teachers ----
select pg_temp.as(11);
select is(pg_temp.home(), pg_temp.separate(), 'Ana''s teacher: the same answer as the separate requests');
select pg_temp.as(12);
select is(pg_temp.home(), pg_temp.separate(), 'Ben''s teacher: the same answer as the separate requests');

-- ---- Every game switched off ----
select pg_temp.reset();
update public.app_settings set monsters_enabled = false, lord_enabled = false, clans_enabled = false, multiplayer_enabled = false;
select pg_temp.as(1);
select is(pg_temp.home(), pg_temp.separate(), 'with every game switched off, Ana still gets the same answer');
select pg_temp.as(2);
select is(pg_temp.home(), pg_temp.separate(), 'and so does Ben');

-- ---- The season clock (my_moves_left gives the school's Clan Quest season to every signed-in pupil) ----
select pg_temp.as(1);
select ok((pg_temp.home() -> 'movesLeft') ? 'season', 'Ana: moves left has a season');
select ok((pg_temp.home() -> 'movesLeft' -> 'season') ?& array['number', 'day', 'daysLeft', 'clockOn'], 'the season has number, day, daysLeft and clockOn');
select is(jsonb_typeof(pg_temp.home() -> 'movesLeft' -> 'season' -> 'clockOn'), 'boolean', 'clockOn is true or false');
select pg_temp.as(4);
select ok((public.my_moves_left() -> 'season') ?& array['number', 'day', 'daysLeft', 'clockOn'], 'Dan (no clan, no games): still gets the season');

-- ---- Who can call it ----
select pg_temp.reset();
select ok(not has_function_privilege('anon', 'public.my_home_page()', 'execute'), 'signed-out visitors cannot call it');
select ok(not (select prosecdef from pg_proc where oid = 'public.my_home_page()'::regprocedure), 'it runs as the person asking');

select * from finish();
rollback;
