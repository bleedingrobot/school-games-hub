-- Star Trader: sharing (stage S.8, docs/TRADER-SYSTEM-PLAN.md section 7). Pupils can't reach the gallery or sticker tables or
-- the server's functions; the gallery picture bucket is private; the class gallery shows the pupil's own system first and
-- classmates' built systems only; stickers go to classmates only, one per visitor (changed, never stacked), and the owner
-- sees counts but never who; a picture is noted at most once per gap; a teacher's projector tour covers only their class.
-- Run on a throw-away copy: scripts/scratch-db.sh gallery && scripts/scratch-test.sh gallery supabase/tests/database/trader_gallery.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(47);

-- Dan is at another school, in a class of its own there.
select setval(pg_get_serial_sequence('public.schools', 'id'), 1);
insert into public.schools (name) values ('Other School');
insert into public.school_domains (domain, school_id) values ('otherschool.school.nz', 2);
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000d', 'dan@otherschool.school.nz'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-00000000000f', 'fay@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-000000000010', 'gus@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-000000000011', 'hal@douglaspark.school.nz'),
  ('00000000-0000-0000-0000-000000000012', 'ivy@douglaspark.school.nz');
update public.profiles set role = 'teacher', school_admin = true where id = '00000000-0000-0000-0000-00000000000e';
update public.profiles set role = 'teacher', school_admin = false where id in ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000012');
delete from public.class_members where student_id in ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000012');
update public.profiles set hidden = true where id = '00000000-0000-0000-0000-000000000010';

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
create function pg_temp.ana() returns void language sql as $$ select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'ana@douglaspark.school.nz') $$;
-- Saves a game with a sun, built or only planned, named after the pupil.
create function pg_temp.save(who text, label text, built boolean) returns void language sql as $$
  select public.trader_save(pg_temp.id(who), 0,
    jsonb_build_object('t', '{"ship":1,"credits":50,"weapons":[],"shields":[],"pods":0}'::jsonb,
                       'system', jsonb_build_object('v', 1, 'label', label, 'sun', jsonb_build_object('kind', 'red', 'built', built))),
    1, 100, false, 1, 'request-' || who || '-1', '{}'::jsonb, '{}'::jsonb)
$$;
create function pg_temp.names(sys jsonb) returns text language sql as $$
  select coalesce(string_agg(s ->> 'label', ',' order by s ->> 'label'), '') from jsonb_array_elements(sys) s
$$;

-- Everyone at Douglas Park starts in its first class; Fay moves to Room Two, Gus stays hidden in the first class,
-- Dan gets a class at his school. Hal teaches the first class, Ivy Room Two (neither is a school admin).
insert into public.classes (school_id, name, school_year, warp_code)
values ((select school_id from public.profiles where id = pg_temp.id('0a')), 'Room Two', 2026, 'CDFGH');
insert into public.classes (school_id, name, school_year, warp_code) values (2, 'Other Room', 2026, 'JKMNP');
update public.class_members set class_id = (select id from public.classes where name = 'Room Two') where student_id = pg_temp.id('0f');
insert into public.class_members (class_id, student_id) values ((select id from public.classes where name = 'Other Room'), pg_temp.id('0d'))
  on conflict (student_id) do update set class_id = excluded.class_id;
delete from public.class_teachers where teacher_id in (pg_temp.id('11'), pg_temp.id('12'));
insert into public.class_teachers (class_id, teacher_id)
values ((select class_id from public.class_members where student_id = pg_temp.id('0a')), pg_temp.id('11')),
       ((select id from public.classes where name = 'Room Two'), pg_temp.id('12'));

select set_config('test.c1', (select class_id::text from public.class_members where student_id = pg_temp.id('0a')), true),
       set_config('test.c2', (select id::text from public.classes where name = 'Room Two'), true);

select pg_temp.act_as_server();
select public.trader_school_seed(pg_temp.id('0a'));
select public.trader_school_seed(pg_temp.id('0d'));
select pg_temp.save('0a', 'Ana System', true);
select pg_temp.save('0b', 'Ben System', true);
select pg_temp.save('0c', 'Cat System', false);
select pg_temp.save('0d', 'Dan System', true);
select pg_temp.save('0f', 'Fay System', true);
select pg_temp.save('10', 'Gus System', true);
select pg_temp.reset();

-- ---- Pupils reach nothing directly ----
select pg_temp.ana();
select throws_ok($$ select * from public.trader_stickers $$, '42501', null, 'pupils cannot read the stickers table');
select throws_ok($$ select * from public.trader_gallery $$, '42501', null, 'pupils cannot read the gallery table');
select throws_ok($$ select public.trader_gallery_list(auth.uid()) $$, '42501', null, 'pupils cannot call the gallery list directly');
select throws_ok($$ select public.trader_give_sticker(auth.uid(), '00000000-0000-0000-0000-00000000000b', 'wow') $$, '42501', null, 'pupils cannot give a sticker directly');
select throws_ok($$ select public.trader_gallery_drawn(auth.uid(), '5 minutes') $$, '42501', null, 'pupils cannot note a picture directly');
select throws_ok($$ insert into public.trader_stickers (player, visitor, season, sticker) values (auth.uid(), '00000000-0000-0000-0000-00000000000b', 1, 'wow') $$, '42501', null, 'pupils cannot write stickers');
select pg_temp.reset();

select ok(exists (select 1 from storage.buckets where id = 'trader-gallery'), 'the gallery picture bucket exists');
select is((select public from storage.buckets where id = 'trader-gallery'), false, 'the gallery picture bucket is not public');

-- ---- The class gallery ----
select pg_temp.act_as_server();
select is((select jsonb_array_length(public.trader_gallery_list(pg_temp.id('0a')))), 2, 'Ana sees herself and one classmate');
select is((select public.trader_gallery_list(pg_temp.id('0a')) -> 0 ->> 'id'), pg_temp.id('0a')::text, 'her own system comes first');
select is((select (public.trader_gallery_list(pg_temp.id('0a')) -> 0 ->> 'mine')::boolean), true, '... marked as hers');
select is((select public.trader_gallery_list(pg_temp.id('0a')) -> 1 ->> 'id'), pg_temp.id('0b')::text, 'a classmate with a built sun is included');
select is((select (public.trader_gallery_list(pg_temp.id('0a')) -> 1 ->> 'mine')::boolean), false, '... not marked as hers');
select is((select public.trader_gallery_list(pg_temp.id('0a')) -> 1 -> 'design' ->> 'label'), 'Ben System', '... with his system design');
select is((select count(*)::int from jsonb_array_elements(public.trader_gallery_list(pg_temp.id('0a'))) e where e ->> 'id' = pg_temp.id('0c')::text), 0, 'a classmate whose sun is only planned is left out');
select is((select count(*)::int from jsonb_array_elements(public.trader_gallery_list(pg_temp.id('0a'))) e where e ->> 'id' = pg_temp.id('0f')::text), 0, 'a pupil in another class of the same school is left out');
select is((select count(*)::int from jsonb_array_elements(public.trader_gallery_list(pg_temp.id('0a'))) e where e ->> 'id' = pg_temp.id('0d')::text), 0, 'a pupil from another school is left out');
select is((select count(*)::int from jsonb_array_elements(public.trader_gallery_list(pg_temp.id('0a'))) e where e ->> 'id' = pg_temp.id('10')::text), 0, 'a hidden pupil is left out');
select is((select public.trader_gallery_list(pg_temp.id('0b')) -> 0 ->> 'id'), pg_temp.id('0b')::text, 'Ben also sees his own first');
select is((select count(*)::int from jsonb_array_elements(public.trader_gallery_list(pg_temp.id('0b'))) e where e ->> 'id' = pg_temp.id('0a')::text), 1, '... and Ana');

-- ---- Stickers ----
select is(public.trader_give_sticker(pg_temp.id('0b'), pg_temp.id('0a'), 'wow'), 'ok', 'a classmate can give a sticker');
select is(public.trader_give_sticker(pg_temp.id('0b'), pg_temp.id('0a'), 'tech'), 'ok', 'a second sticker is accepted');
select is((select count(*)::int from public.trader_stickers where player = pg_temp.id('0a') and visitor = pg_temp.id('0b')), 1, '... and replaces the first (still one row)');
select is((select sticker from public.trader_stickers where player = pg_temp.id('0a') and visitor = pg_temp.id('0b')), 'tech', '... with the new sticker');
select is(public.trader_give_sticker(pg_temp.id('0c'), pg_temp.id('0a'), 'wow'), 'ok', 'another classmate (whose own sun is only planned) can give one too');
select is(public.trader_give_sticker(pg_temp.id('0c'), pg_temp.id('0a'), null), 'ok', 'a null sticker takes it back');
select is((select count(*)::int from public.trader_stickers where player = pg_temp.id('0a') and visitor = pg_temp.id('0c')), 0, '... and the row is gone');
select is(public.trader_give_sticker(pg_temp.id('0c'), pg_temp.id('0a'), 'wow'), 'ok', 'the sticker can be given again');
select is(public.trader_give_sticker(pg_temp.id('0a'), pg_temp.id('0a'), 'wow'), 'own', 'your own system gets ''own''');
select is(public.trader_give_sticker(pg_temp.id('0b'), pg_temp.id('0f'), 'wow'), 'class', 'a pupil in another class gets ''class''');
select is(public.trader_give_sticker(pg_temp.id('0b'), pg_temp.id('0d'), 'wow'), 'class', 'a pupil at another school gets ''class''');
select is(public.trader_give_sticker(pg_temp.id('0d'), pg_temp.id('0b'), 'wow'), 'class', 'a visitor from another school gets ''class''');
select is(public.trader_give_sticker(pg_temp.id('0b'), pg_temp.id('0c'), 'wow'), 'none', 'a system with no built sun gets ''none''');
select throws_ok($$ select public.trader_give_sticker('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', 'bogus') $$, '22023', null, 'an unknown sticker is refused');
select is((select public.trader_gallery_list(pg_temp.id('0a')) -> 0 -> 'stickers'), '{"tech":1,"wow":1}'::jsonb, 'the owner''s row shows the sticker counts');
select is((select position(pg_temp.id('0b')::text in (public.trader_gallery_list(pg_temp.id('0a')) -> 0)::text)), 0, '... and never who gave them');
select is((select public.trader_gallery_list(pg_temp.id('0b')) -> 1 -> 'stickers'), '"tech"'::jsonb, 'the visitor''s row shows the sticker they gave');
select is((select public.trader_gallery_list(pg_temp.id('0b')) -> 0 -> 'stickers'), '{}'::jsonb, 'a system with no stickers has an empty count');

-- ---- Pictures ----
select is(public.trader_gallery_drawn(pg_temp.id('0a'), '5 minutes'), true, 'the first picture may be saved');
select is(public.trader_gallery_drawn(pg_temp.id('0a'), '5 minutes'), false, 'a second within the gap may not');
select is(public.trader_gallery_drawn(pg_temp.id('0a'), '0 seconds'), true, 'with no gap it may again');
select is(public.trader_gallery_drawn(pg_temp.id('0c'), '0 seconds'), false, 'no picture without a built sun');
select is((select (public.trader_gallery_list(pg_temp.id('0b')) -> 1 ->> 'drawn')::boolean), true, 'a drawn picture shows in the gallery');
select pg_temp.reset();

-- ---- The teacher's projector tour ----
select pg_temp.act_as('00000000-0000-0000-0000-000000000011', 'hal@douglaspark.school.nz');
select is((select pg_temp.names(public.teacher_trader_class_systems(current_setting('test.c1')::uuid))), 'Ana System,Ben System',
  'a teacher gets the class''s built systems (not planned, hidden or other-class ones)');
select throws_ok($$ select public.teacher_trader_class_systems(current_setting('test.c2')::uuid) $$, '42501', null, 'a teacher of a different class is refused');
select pg_temp.act_as('00000000-0000-0000-0000-000000000012', 'ivy@douglaspark.school.nz');
select throws_ok($$ select public.teacher_trader_class_systems(current_setting('test.c1')::uuid) $$, '42501', null, 'a teacher of Room Two is refused the first class');
select pg_temp.ana();
select throws_ok($$ select public.teacher_trader_class_systems(current_setting('test.c1')::uuid) $$, '42501', null, 'a pupil is refused');
select pg_temp.reset();

select * from finish();
rollback;
