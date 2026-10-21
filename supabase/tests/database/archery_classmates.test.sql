-- Archery Challenge stage 6 (migration 20261022000100): fights against classmates. Pupils read only their own fights,
-- can't change any, see only classmates in their own class, and can't challenge another class or school. Gear comes out
-- when a pupil packs and back (less what was used) when the fight ends; requests sent twice count once.
-- Run on a throw-away copy: scripts/scratch-db.sh archery, then
--   scripts/scratch-test.sh archery supabase/tests/database/archery_classmates.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(59);

-- Dan is at another school (it has no default class, so he starts with none).
select setval(pg_get_serial_sequence('public.schools', 'id'), 1);
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id) values ('otherschool.school.nz', 2);
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'dan@otherschool.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000e';

create function pg_temp.act_as(id text, email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', id, 'email', email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.act_as_server() returns void language sql as $$
  select set_config('role', 'service_role', true), set_config('request.jwt.claims', '{"role":"service_role"}', true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(who text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || who)::uuid $$;
create function pg_temp.gear(who text) returns jsonb language sql as $$ select gear from public.archery_players where player = pg_temp.id(who) $$;
create function pg_temp.duel(seed bigint) returns public.archery_duels language sql as $$ select * from public.archery_duels where archery_duels.seed = duel.seed $$;
create function pg_temp.ana() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz') $$;
create function pg_temp.ben() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz') $$;
create function pg_temp.cat() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz') $$;

-- Everyone at Douglas Park starts in its first class; Cat moves to another class.
insert into public.classes (school_id, name, school_year, warp_code)
values ((select school_id from public.profiles where id = pg_temp.id('0a')), 'Room Two', 2026, 'CDFGH');
update public.class_members set class_id = (select id from public.classes where name = 'Room Two') where student_id = pg_temp.id('0c');
-- The game on everywhere, and some gear to pack.
update public.app_settings set archery_enabled = true;
insert into public.archery_players (player, gear, shields)
select p, '{"steel": 3, "apple": 2, "giant": 1}', '["wood"]' from unnest(array[pg_temp.id('0a'), pg_temp.id('0b'), pg_temp.id('0c'), pg_temp.id('0d')]) p;

select ok(exists (select 1 from cron.job where jobname = 'tidy-archery-duels' and schedule = '*/5 * * * *'), 'the tidy-up job is scheduled');
select ok((select relrowsecurity from pg_class where oid = 'public.archery_duels'::regclass), 'the fights table has row level security on');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'archery_duels'), 'fight changes go out through Realtime');

-- ---- Pupils can't reach the server's steps or the "here" table ----
select pg_temp.ana();
select throws_ok($$ select * from public.archery_here $$, '42501', null, 'a pupil cannot read who is here directly');
select throws_ok($$ select public.archery_duel_challenge(auth.uid(), 'req-00000001', '00000000-0000-0000-0000-00000000000b', 'forest', 1, 60000) $$, '42501', null,
  'a pupil cannot send a challenge without the server');
select throws_ok($$ select public.archery_duel_pack(auth.uid(), 1, '{"quiver":{}}', 45000) $$, '42501', null, '... or pack');
select throws_ok($$ select public.archery_duel_move(1, 0, '[]', '[{},{}]', '{0,0}', 0, true) $$, '42501', null, '... or play a turn');
select throws_ok($$ select public.archery_duel_end(1, 0, 'done', 'finished', 0::smallint, null, null, null, null) $$, '42501', null, '... or end a fight');
select throws_ok($$ select public.archery_duel_close(1, 0, 'done', 'finished', 0::smallint, null, null, null, null) $$, '42501', null, '... or give gear back');
select throws_ok($$ select public.archery_duel_tidy() $$, '42501', null, '... or run the tidy-up');
select throws_ok($$ select public.archery_duel_load(1) $$, '42501', null, '... or load any fight through the server');
select throws_ok($$ insert into public.archery_duels (seat_a, seat_b, name_a, name_b, world, seed, deadline)
  values (auth.uid(), '00000000-0000-0000-0000-00000000000b', 'a', 'b', 'forest', 1, now()) $$, '42501', null, 'a pupil cannot make a fight row');

-- ---- "I'm here": the classmates in your own class with the game open ----
select is(public.archery_here() -> 'online', '[]'::jsonb, 'Ana is here, alone');
select pg_temp.ben();
select is(jsonb_array_length(public.archery_here() -> 'online'), 1, 'Ben sees Ana');
select is(public.archery_here() -> 'online' -> 0 ->> 'id', pg_temp.id('0a')::text, '... by id');
select is((select array_agg(k order by k) from jsonb_object_keys(public.archery_here() -> 'online' -> 0) k), array['avatar', 'busy', 'id', 'name'],
  '... with a display name and avatar only (no coins or maths)');
select pg_temp.cat();
select is(public.archery_here() -> 'online', '[]'::jsonb, 'Cat (another class) sees nobody');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d', 'dan@otherschool.school.nz');
select is(public.archery_here() -> 'online', '[]'::jsonb, 'Dan (another school) sees nobody');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz');
select is(public.archery_here() -> 'online', '[]'::jsonb, 'a teacher is not listed and sees nobody');
select pg_temp.reset();

-- ---- Challenges ----
select pg_temp.act_as_server();
select is(public.archery_duel_challenge(pg_temp.id('0a'), 'chal-req-001', pg_temp.id('0c'), 'forest', 101, 60000) ->> 'result', 'class',
  'Ana cannot challenge Cat (another class)');
select is(public.archery_duel_challenge(pg_temp.id('0a'), 'chal-req-002', pg_temp.id('0d'), 'forest', 102, 60000) ->> 'result', 'class',
  '... or Dan (another school)');
select is(public.archery_duel_challenge(pg_temp.id('0a'), 'chal-req-003', pg_temp.id('0e'), 'forest', 103, 60000) ->> 'result', 'away',
  '... or a teacher');
select is(public.archery_duel_challenge(pg_temp.id('0a'), 'chal-req-004', pg_temp.id('0b'), 'snow', 104, 60000) ->> 'result', 'ok', 'Ana challenges Ben');
select is(public.archery_duel_challenge(pg_temp.id('0a'), 'chal-req-004', pg_temp.id('0b'), 'snow', 104, 60000),
  (select reply from public.archery_requests where request_id = 'chal-req-004'), 'the same challenge sent again gets the same reply');
select is((select count(*)::integer from public.archery_duels where seed = 104), 1, '... and makes no second fight');
select pg_temp.reset();

select pg_temp.ben();
select is(public.archery_here() -> 'asks' -> 0 ->> 'from', (select display_name from public.profiles where id = pg_temp.id('0a')), 'Ben sees the challenge, from Ana');
select is((select count(*)::integer from public.archery_duels), 1, 'Ben can read the fight he is in');
select pg_temp.cat();
select is((select count(*)::integer from public.archery_duels), 0, 'Cat cannot read other people''s fights (or their packs)');
select pg_temp.reset();

select pg_temp.act_as_server();
select is(public.archery_duel_answer(pg_temp.id('0a'), (pg_temp.duel(104)).id, true, 120000) ->> 'result', 'not-yours', 'only the challenged pupil can answer');
select is(public.archery_duel_answer(pg_temp.id('0b'), (pg_temp.duel(104)).id, true, 120000) ->> 'result', 'ok', 'Ben says yes');
select is((pg_temp.duel(104)).status, 'packing', '... and both pack');

-- ---- Packing ----
select is(public.archery_duel_pack(pg_temp.id('0a'), (pg_temp.duel(104)).id, '{"quiver":{"steel":9},"shield":null,"bow":"starter"}', 45000) ->> 'result', 'gear',
  'you cannot pack more than you have');
select is(public.archery_duel_pack(pg_temp.id('0a'), (pg_temp.duel(104)).id, '{"quiver":{},"shield":"bubble","bow":"starter"}', 45000) ->> 'result', 'gear',
  '... or a shield that is not yours');
select is(public.archery_duel_pack(pg_temp.id('0a'), (pg_temp.duel(104)).id, '{"quiver":{"steel":2,"apple":1},"shield":"wood","bow":"starter"}', 45000) ->> 'result', 'ok',
  'Ana packs');
select is(pg_temp.gear('0a'), '{"steel": 1, "apple": 1, "giant": 1}'::jsonb, '... and her pack comes out of her bag');
select is(public.archery_duel_pack(pg_temp.id('0a'), (pg_temp.duel(104)).id, '{"quiver":{"steel":2,"apple":1},"shield":"wood","bow":"starter"}', 45000) ->> 'result', 'already',
  'packing again counts once');
select is(pg_temp.gear('0a'), '{"steel": 1, "apple": 1, "giant": 1}'::jsonb, '... and takes nothing more');
select is(public.archery_duel_pack(pg_temp.id('0b'), (pg_temp.duel(104)).id, '{"quiver":{"giant":1},"shield":null,"bow":"starter"}', 45000) -> 'duel' ->> 'status', 'playing',
  'when Ben packs too, the fight starts');
select ok((pg_temp.duel(104)).deadline between now() + interval '44 seconds' and now() + interval '46 seconds', '... with 45 seconds on the clock');
select is(public.archery_duel_challenge(pg_temp.id('0c'), 'chal-req-005', pg_temp.id('0a'), 'forest', 105, 60000) ->> 'result', 'class',
  'nobody else can pull Ana into a second fight (Cat is another class anyway)');
update public.class_members set class_id = (select class_id from public.class_members where student_id = pg_temp.id('0a')) where student_id = pg_temp.id('0c');
select pg_temp.reset();
insert into public.archery_here (player) values (pg_temp.id('0a')) on conflict (player) do update set seen_at = now();
select pg_temp.act_as_server();
select is(public.archery_duel_challenge(pg_temp.id('0c'), 'chal-req-006', pg_temp.id('0a'), 'forest', 106, 60000) ->> 'result', 'busy',
  'a pupil in a fight cannot be challenged again');

-- ---- Turns ----
select ok((public.archery_duel_move((pg_temp.duel(104)).id, (pg_temp.duel(104)).version, '[{"angle":50,"power":60,"arrow":"steel"}]', '[{"steel":1},{}]', '{0,0}',
  (extract(epoch from now()) * 1000 + 45000)::bigint, true)).id is not null, 'the server saves a turn');
select ok((public.archery_duel_move((pg_temp.duel(104)).id, (pg_temp.duel(104)).version - 1, '[]', '[{},{}]', '{0,0}', 0, true)).id is null,
  'a turn saved against an old version is refused (no playing twice, or out of turn)');
select is(jsonb_array_length((pg_temp.duel(104)).turns), 1, '... and changes nothing');

-- ---- The end: gear back, less what was used ----
select is((public.archery_duel_end((pg_temp.duel(104)).id, (pg_temp.duel(104)).version, 'done', 'finished', 1::smallint, null, null, '[{"steel":1,"apple":1},{"giant":1}]', null)).status,
  'done', 'the fight ends');
select is(pg_temp.gear('0a'), '{"steel": 2, "apple": 1, "giant": 1}'::jsonb, 'Ana gets back the Steel Arrow she did not use (not the Apple she ate)');
select is(pg_temp.gear('0b'), '{"steel": 3, "apple": 2}'::jsonb, 'Ben used his Giant Arrow');
select ok((public.archery_duel_end((pg_temp.duel(104)).id, (pg_temp.duel(104)).version - 1, 'done', 'finished', 1::smallint, null, null, '[{},{}]', null)).id is null,
  'ending it again changes nothing');
select is(pg_temp.gear('0a'), '{"steel": 2, "apple": 1, "giant": 1}'::jsonb, '... no gear twice');

-- ---- Three time-outs in a row: gear back to both, nobody wins ----
select is(public.archery_duel_challenge(pg_temp.id('0b'), 'chal-req-007', pg_temp.id('0a'), 'city', 107, 60000) ->> 'result', 'ok', 'a new fight, Ben against Ana');
select is(public.archery_duel_answer(pg_temp.id('0a'), (pg_temp.duel(107)).id, true, 120000) ->> 'result', 'ok', '... accepted');
select is(public.archery_duel_pack(pg_temp.id('0a'), (pg_temp.duel(107)).id, '{"quiver":{"steel":2},"shield":null,"bow":"starter"}', 45000) ->> 'result', 'ok', '... Ana packs');
select is(public.archery_duel_pack(pg_temp.id('0b'), (pg_temp.duel(107)).id, '{"quiver":{"apple":1},"shield":null,"bow":"starter"}', 45000) ->> 'result', 'ok', '... Ben packs');
select is((public.archery_duel_end((pg_temp.duel(107)).id, (pg_temp.duel(107)).version, 'done', 'timeouts', null, 0::smallint,
  '[{"pass":true},{"angle":90,"power":5,"arrow":"plain"},{"pass":true},{"angle":90,"power":5,"arrow":"plain"},{"pass":true}]', '[{},{}]', '{3,0}')).ending,
  'timeouts', 'three of Ana''s turns used up end the fight');
select is(pg_temp.gear('0a'), '{"steel": 2, "apple": 1, "giant": 1}'::jsonb, '... and give all her packed gear back');
select is(pg_temp.gear('0b'), '{"steel": 3, "apple": 2}'::jsonb, '... and Ben''s');
select pg_temp.reset();

-- ---- The tidy-up, and New Season ----
update public.archery_duels set status = 'asked', deadline = now() - interval '1 minute' where seed = 104;
select pg_temp.act_as_server();
select public.archery_duel_tidy();
select pg_temp.reset();
select is((pg_temp.duel(104)).status, 'expired', 'the tidy-up ends a challenge that ran out');
select ok((public.archery_point_rules() -> 'lines') ? 'Finish a fight against a classmate: 3 points, or 4 if you win.', 'How points work has the classmate line');
select pg_temp.act_as_server();
select public.archery_season(array[pg_temp.id('0a')]);
select pg_temp.reset();
select is((select count(*)::integer from public.archery_duels where pg_temp.id('0a') in (seat_a, seat_b)), 0, 'New Season clears classmate fights too');

select * from finish();
rollback;
