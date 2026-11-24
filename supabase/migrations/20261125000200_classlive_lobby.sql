-- Class Live lobby games (James, 25 Nov 2026): a teacher starts a game "for my class" (as before) or "open in the
-- lobby", where any pupil of the school may join: from a "Mr Riley is starting Mystery Mural. Join now?" button on
-- their home page, or with the four-digit code on the projector. The game itself is unchanged; the session's `lobby`
-- ({ code, host }) marks it (shared/classlive/server.ts).
--
--   1. Rooms keep their school, code and host (copied from the session by classlive_open).
--   2. classlive_load, classlive_teacher_class and classlive_pupil also give the school; classlive_code_room finds a code.
--   3. Pupils of the school see open lobby rooms (and hear them live), with the host's words for the button.
--   4. The join pop-up (classlive_waiting, classlive_here) offers lobby games of the school too.
--   5. Points: pupils from other classes of the school are paid for a lobby game too.
--   6. Who can call what.

-- ---------------------------------------------------------------------------
-- 1. Rooms
-- ---------------------------------------------------------------------------

alter table public.classlive_rooms add column school_id integer references public.schools (id) on delete cascade;
update public.classlive_rooms r set school_id = c.school_id from public.classes c where c.id = r.class_id and r.school_id is null;
alter table public.classlive_rooms alter column school_id set not null;
alter table public.classlive_rooms add column code text check (code is null or code ~ '^[0-9]{4}$');
alter table public.classlive_rooms add column host text check (host is null or length(host) between 1 and 30);
create index classlive_rooms_lobby on public.classlive_rooms (school_id, code, opened_at desc) where code is not null;

create or replace function public.classlive_open(target_class uuid, teacher uuid, activity text, session jsonb, view jsonb, screen jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  made bigint;
  school integer;
begin
  select c.school_id into school from public.classes c where c.id = target_class for update;
  update public.classlive_rooms r set state = 'over', version = r.version + 1, updated_at = now(),
    view = r.view || jsonb_build_object('state', 'over')
  where r.class_id = target_class and r.state <> 'over';
  insert into public.classlive_rooms (class_id, school_id, teacher, activity, state, show_names, view, code, host)
  values (target_class, school, teacher, activity, 'lobby', coalesce((screen ->> 'showNames')::boolean, true), view,
    session -> 'lobby' ->> 'code', left(session -> 'lobby' ->> 'host', 30))
  returning id into made;
  insert into public.classlive_state (room, session) values (made, session);
  insert into public.classlive_screens (room, screen, seq) values (made, screen, 0);
  return made;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. The school, and finding a code
-- ---------------------------------------------------------------------------

create or replace function public.classlive_load(target bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('id', r.id, 'class_id', r.class_id, 'school_id', r.school_id, 'teacher', r.teacher, 'version', r.version,
    'started_ms', r.started_ms, 'show_names', r.show_names, 'session', s.session,
    'seq', coalesce(sc.seq, 0), 'events', coalesce(sc.screen -> 'events', '[]'::jsonb))
  from public.classlive_rooms r
  join public.classlive_state s on s.room = r.id
  left join public.classlive_screens sc on sc.room = r.id
  where r.id = target
$$;

create or replace function public.classlive_teacher_class(teacher uuid, target_class uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('enabled', coalesce(s.classlive_enabled, d.classlive_enabled, true),
    'show_names', coalesce(s.classlive_names, d.classlive_names, true), 'school_id', c.school_id)
  from public.class_teachers t
  join public.classes c on c.id = t.class_id and not c.archived
  left join public.app_settings s on s.class_id = t.class_id
  left join public.app_settings d on d.school_id = c.school_id and d.class_id is null
  where t.teacher_id = classlive_teacher_class.teacher and t.class_id = target_class
  limit 1
$$;

create or replace function public.classlive_pupil(player uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('class_id', m.class_id, 'school_id', p.school_id, 'name', p.display_name,
    'enabled', coalesce((select s.classlive_enabled from public.settings_of(classlive_pupil.player) s), false))
  from public.profiles p
  join public.class_members m on m.student_id = p.id
  where p.id = classlive_pupil.player and p.role = 'student'
$$;

-- The school's lobby game with this code, not over, opened in the last 3 hours (the newest), or null.
create function public.classlive_code_room(target_school integer, join_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.classlive_load(r.id) from public.classlive_rooms r
  where r.school_id = target_school and r.code = join_code and r.state <> 'over' and r.opened_at > now() - interval '3 hours'
  order by r.opened_at desc, r.id desc limit 1
$$;

-- ---------------------------------------------------------------------------
-- 3. Pupils of the school see open lobby rooms
-- ---------------------------------------------------------------------------

create function public.classlive_my_school(target_school integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = target_school) $$;

create policy "Pupils of the school see open Class Live lobby games" on public.classlive_rooms
  for select to authenticated
  using (code is not null and state <> 'over' and public.classlive_my_school(school_id));

-- ---------------------------------------------------------------------------
-- 4. The join pop-up: class games and the school's lobby games
-- ---------------------------------------------------------------------------

-- Open rooms this pupil may join and hasn't: their class's, and the lobby games of their school.
create function public.classlive_open_for(me uuid)
returns setof public.classlive_rooms
language sql
stable
security definer
set search_path = ''
as $$
  select r.* from public.classlive_rooms r
  where r.state in ('lobby', 'live') and r.opened_at > now() - interval '3 hours'
    and (
      exists (select 1 from public.class_members m where m.class_id = r.class_id and m.student_id = me)
      or (r.code is not null and exists (select 1 from public.profiles p where p.id = me and p.school_id = r.school_id))
    )
    and not exists (select 1 from public.classlive_players p where p.room = r.id and p.player = me)
$$;

create or replace function public.classlive_waiting(me uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.classlive_enabled from public.settings_of(me) s), false)
    and exists (select 1 from public.classlive_open_for(me))
$$;

-- 'class' is the button's words: the class's name, or "Mr Riley is starting Mystery Mural" for a lobby game.
create or replace function public.classlive_here()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('room', r.id,
      'class', case when r.code is not null and r.host is not null
        then r.host || ' is starting ' || case r.activity when 'stars' then 'Star Web' when 'serpent' then 'Serpent Chain' else 'Mystery Mural' end
        else c.name end,
      'lobby', r.code is not null, 'state', r.state, 'activity', r.activity,
      'until', to_char((r.opened_at + interval '3 hours') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
      order by r.opened_at desc), '[]'::jsonb)
  from public.classlive_open_for(auth.uid()) r
  join public.classes c on c.id = r.class_id
  where coalesce((select s.classlive_enabled from public.settings_of(auth.uid()) s), false)
$$;

-- ---------------------------------------------------------------------------
-- 5. Points for pupils of other classes in a lobby game
-- ---------------------------------------------------------------------------

create or replace function public.classlive_finish(target bigint, done jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  room_class uuid;
  room_school integer;
  room_lobby boolean;
  p jsonb;
  who uuid;
  reached boolean := coalesce((done ->> 'goal')::boolean, false);
  small integer;
begin
  select r.class_id, r.school_id, r.code is not null into room_class, room_school, room_lobby
  from public.classlive_rooms r where r.id = target;
  if room_class is null then
    return 'gone';
  end if;
  insert into public.classlive_finished (room, seed) values (target, (done ->> 'seed')::bigint) on conflict do nothing;
  if not found then
    return 'paid';
  end if;
  for p in select * from jsonb_array_elements(coalesce(done -> 'players', '[]')) loop
    who := (p ->> 'player')::uuid;
    if public.current_class_of(who) is distinct from room_class
      and not (room_lobby and exists (select 1 from public.profiles x where x.id = who and x.school_id = room_school and x.role = 'student')) then
      continue;
    end if;
    perform public.add_game_points(who, 'classlive', least(greatest(coalesce((p ->> 'points')::integer, 0), 0), 10),
      'classlive:' || target || ':' || (done ->> 'seed'));
    small := 500;
    insert into public.classlive_stats as s (player, sessions, stars, boxes, heads, tiles, guessed, goals)
    values (who, 1,
      least(greatest(coalesce((p ->> 'stars')::integer, 0), 0), small),
      least(greatest(coalesce((p ->> 'boxes')::integer, 0), 0), small),
      case when coalesce((p ->> 'head')::boolean, false) then 1 else 0 end,
      least(greatest(coalesce((p ->> 'tiles')::integer, 0), 0), small),
      case when coalesce((p ->> 'guessed')::boolean, false) then 1 else 0 end,
      case when reached then 1 else 0 end)
    on conflict (player) do update set
      sessions = s.sessions + 1,
      stars = s.stars + excluded.stars,
      boxes = s.boxes + excluded.boxes,
      heads = s.heads + excluded.heads,
      tiles = s.tiles + excluded.tiles,
      guessed = s.guessed + excluded.guessed,
      goals = s.goals + excluded.goals,
      updated_at = now();
    perform public.game_progress_changed(who, 'classlive');
  end loop;
  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function public.classlive_code_room(integer, text), public.classlive_my_school(integer), public.classlive_open_for(uuid)
from public, anon, authenticated;
grant execute on function public.classlive_my_school(integer) to authenticated;
grant execute on function public.classlive_code_room(integer, text) to service_role;
-- create or replace keeps each function's grants; these say them again so this file reads whole.
revoke execute on function public.classlive_open(uuid, uuid, text, jsonb, jsonb, jsonb), public.classlive_load(bigint),
  public.classlive_teacher_class(uuid, uuid), public.classlive_pupil(uuid), public.classlive_waiting(uuid),
  public.classlive_finish(bigint, jsonb)
from public, anon, authenticated;
