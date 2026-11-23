-- Class Live stage 1: the shared live room and Star Web (docs/CLASSLIVE-PLAN.md section 5). Whole-class games: the
-- teacher's screen (the projector) runs the session, every pupil's device is a controller. Copies Class Showdown's
-- pattern (20261123000900_showdown.sql).
--
--   1. Tables: classlive_rooms (what pupils of the class may see: the game and counts, no names), classlive_state (the
--      whole session, hidden), classlive_screens (what the projector draws, with first names: teachers only) and
--      classlive_players (each pupil's own row).
--   2. Live updates: rooms, screens and players in the supabase_realtime publication, each with a rule for who hears it.
--   3. The server function's steps (service role only). A save lands only at the version it was loaded at.
--   4. The switch (on for every class; nothing happens until a teacher opens a room) and the names switch.
--   5. The join pop-up: classlive_waiting() and classlive_here(), and one exact edit to hub_here().
--   6. The hub_games row.
--   7. Who can call what.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table public.classlive_rooms (
  id bigint generated always as identity primary key,
  class_id uuid not null references public.classes (id) on delete cascade,
  teacher uuid not null references public.profiles (id) on delete cascade,
  activity text not null check (activity in ('stars', 'serpent', 'mural')),
  state text not null default 'lobby' check (state in ('lobby', 'live', 'over')),
  version integer not null default 1 check (version >= 1),
  started_ms bigint,
  show_names boolean not null default true,
  -- RoomView in shared/classlive/server.ts: the game, its state and counts. No names.
  view jsonb not null check (jsonb_typeof(view) = 'object'),
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index classlive_rooms_by_class on public.classlive_rooms (class_id, opened_at desc);

create table public.classlive_state (
  room bigint primary key references public.classlive_rooms (id) on delete cascade,
  session jsonb not null check (jsonb_typeof(session) = 'object')
);

create table public.classlive_screens (
  room bigint primary key references public.classlive_rooms (id) on delete cascade,
  -- ScreenView: the whole game, first names (when allowed) and the newest events, numbered by seq.
  screen jsonb not null check (jsonb_typeof(screen) = 'object'),
  seq integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.classlive_players (
  room bigint not null references public.classlive_rooms (id) on delete cascade,
  player uuid not null references public.profiles (id) on delete cascade,
  view jsonb not null check (jsonb_typeof(view) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (room, player)
);
create index classlive_players_by_player on public.classlive_players (player);

alter table public.classlive_rooms enable row level security;
alter table public.classlive_state enable row level security;
alter table public.classlive_screens enable row level security;
alter table public.classlive_players enable row level security;
revoke all on public.classlive_rooms, public.classlive_state, public.classlive_screens, public.classlive_players from anon, authenticated;

alter table public.app_settings add column classlive_enabled boolean not null default true;
alter table public.app_settings add column classlive_names boolean not null default true;

-- ---------------------------------------------------------------------------
-- 2. Who may read (and hear live) what. Nobody writes except the server function.
-- ---------------------------------------------------------------------------

create function public.classlive_teaches_room(target bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.classlive_rooms r
    join public.class_teachers t on t.class_id = r.class_id
    where r.id = target and t.teacher_id = auth.uid()
  )
$$;

create function public.classlive_in_class(target_class uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.class_members m where m.class_id = target_class and m.student_id = auth.uid())
    or exists (select 1 from public.class_teachers t where t.class_id = target_class and t.teacher_id = auth.uid())
$$;

grant select on public.classlive_rooms, public.classlive_screens, public.classlive_players to authenticated;

create policy "Pupils and teachers of the class see a Class Live room" on public.classlive_rooms
  for select to authenticated
  using (public.classlive_in_class(class_id));

-- The screen names pupils, so only the class's teachers (the projector) see it.
create policy "Teachers see their class's Class Live screen" on public.classlive_screens
  for select to authenticated
  using (public.classlive_teaches_room(room));

create policy "Pupils see their own Class Live row" on public.classlive_players
  for select to authenticated
  using (player = auth.uid() or public.classlive_teaches_room(room));

alter publication supabase_realtime add table public.classlive_rooms;
alter publication supabase_realtime add table public.classlive_screens;
alter publication supabase_realtime add table public.classlive_players;

-- ---------------------------------------------------------------------------
-- 3. The server function's steps (service role only)
-- ---------------------------------------------------------------------------

-- The room as the server holds it (RoomRow in shared/classlive/server.ts).
create function public.classlive_load(target bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('id', r.id, 'class_id', r.class_id, 'teacher', r.teacher, 'version', r.version,
    'started_ms', r.started_ms, 'show_names', r.show_names, 'session', s.session,
    'seq', coalesce(sc.seq, 0), 'events', coalesce(sc.screen -> 'events', '[]'::jsonb))
  from public.classlive_rooms r
  join public.classlive_state s on s.room = r.id
  left join public.classlive_screens sc on sc.room = r.id
  where r.id = target
$$;

-- The class's newest room opened in the last 3 hours, or null.
create function public.classlive_class_room(target_class uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.classlive_load(r.id) from public.classlive_rooms r
  where r.class_id = target_class and r.opened_at > now() - interval '3 hours'
  order by r.opened_at desc, r.id desc limit 1
$$;

create function public.classlive_teacher_class(teacher uuid, target_class uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('enabled', coalesce(s.classlive_enabled, d.classlive_enabled, true),
    'show_names', coalesce(s.classlive_names, d.classlive_names, true))
  from public.class_teachers t
  join public.classes c on c.id = t.class_id and not c.archived
  left join public.app_settings s on s.class_id = t.class_id
  left join public.app_settings d on d.school_id = c.school_id and d.class_id is null
  where t.teacher_id = classlive_teacher_class.teacher and t.class_id = target_class
  limit 1
$$;

create function public.classlive_pupil(player uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('class_id', m.class_id, 'name', p.display_name,
    'enabled', coalesce((select s.classlive_enabled from public.settings_of(classlive_pupil.player) s), false))
  from public.profiles p
  join public.class_members m on m.student_id = p.id
  where p.id = classlive_pupil.player and p.role = 'student'
$$;

-- A new room for the class: any other open room of the class ends.
create function public.classlive_open(target_class uuid, teacher uuid, activity text, session jsonb, view jsonb, screen jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  made bigint;
begin
  perform 1 from public.classes c where c.id = target_class for update;
  update public.classlive_rooms r set state = 'over', version = r.version + 1, updated_at = now(),
    view = r.view || jsonb_build_object('state', 'over')
  where r.class_id = target_class and r.state <> 'over';
  insert into public.classlive_rooms (class_id, teacher, activity, state, show_names, view)
  values (target_class, teacher, activity, 'lobby', coalesce((screen ->> 'showNames')::boolean, true), view)
  returning id into made;
  insert into public.classlive_state (room, session) values (made, session);
  insert into public.classlive_screens (room, screen, seq) values (made, screen, 0);
  return made;
end;
$$;

-- One step's save: lands only if the room is still at `seen_version` ('stale' otherwise, and nothing changes).
create function public.classlive_save(target bigint, seen_version integer, session jsonb, view jsonb, screen jsonb,
  started_ms bigint, players jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_version integer;
begin
  select r.version into now_version from public.classlive_rooms r where r.id = target for update;
  if now_version is null then
    raise exception 'No such room' using errcode = '22023';
  end if;
  if now_version <> seen_version then
    return 'stale';
  end if;
  update public.classlive_rooms r
  set version = r.version + 1, state = session ->> 'state', view = classlive_save.view,
      started_ms = classlive_save.started_ms, updated_at = now()
  where r.id = target;
  update public.classlive_state s set session = classlive_save.session where s.room = target;
  update public.classlive_screens sc set screen = classlive_save.screen, seq = coalesce((classlive_save.screen ->> 'seq')::integer, sc.seq),
    updated_at = now()
  where sc.room = target;
  insert into public.classlive_players as p (room, player, view, updated_at)
  select target, (v ->> 'player')::uuid, v, now() from jsonb_array_elements(coalesce(players, '[]'::jsonb)) v
  on conflict (room, player) do update set view = excluded.view, updated_at = now();
  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. The switch and the names switch
-- ---------------------------------------------------------------------------

create function public.teacher_set_classlive(enabled boolean default null, names boolean default null, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null and names is null then
    raise exception 'Unknown Class Live setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings s
  set classlive_enabled = coalesce(teacher_set_classlive.enabled, s.classlive_enabled),
      classlive_names = coalesce(teacher_set_classlive.names, s.classlive_names)
  where s.id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. The join pop-up
-- ---------------------------------------------------------------------------

create function public.classlive_waiting(me uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.classlive_enabled from public.settings_of(me) s), false)
    and exists (
      select 1 from public.classlive_rooms r
      join public.class_members m on m.class_id = r.class_id and m.student_id = me
      where r.state in ('lobby', 'live') and r.opened_at > now() - interval '3 hours'
        and not exists (select 1 from public.classlive_players p where p.room = r.id and p.player = me)
    )
$$;

create function public.classlive_here()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('room', r.id, 'class', c.name, 'state', r.state, 'activity', r.activity,
      'until', to_char((r.opened_at + interval '3 hours') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))), '[]'::jsonb)
  from public.classlive_rooms r
  join public.classes c on c.id = r.class_id
  join public.class_members m on m.class_id = r.class_id and m.student_id = auth.uid()
  where public.classlive_waiting(auth.uid()) and r.state in ('lobby', 'live') and r.opened_at > now() - interval '3 hours'
$$;

create or replace function pg_temp.edit_function(sig text, edits text[][])
returns void
language plpgsql
as $$
declare
  def text := pg_get_functiondef(sig::regprocedure);
  i integer;
begin
  for i in 1 .. array_length(edits, 1) loop
    if (length(def) - length(replace(def, edits[i][1], ''))) / length(edits[i][1]) <> 1 then
      raise exception '% edit % did not match exactly once; nothing was changed', sig, i;
    end if;
    def := replace(def, edits[i][1], edits[i][2]);
  end loop;
  execute def;
end;
$$;

-- hub_here(): also 'classlive' when a Class Live room in the pupil's class is waiting for them.
select pg_temp.edit_function('public.hub_here()', array[array[
  E'    case when public.showdown_waiting(me) then ''showdown'' end\n',
  E'    case when public.showdown_waiting(me) then ''showdown'' end,\n'
  || E'    case when public.classlive_waiting(me) then ''classlive'' end\n'
]]);

-- ---------------------------------------------------------------------------
-- 6. The hub
-- ---------------------------------------------------------------------------

create function public.classlive_last_played(player uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$ select max(p.updated_at) from public.classlive_players p where p.player = classlive_last_played.player $$;

insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn, keep_achievements)
values ('classlive', 'classlive_enabled', null, null, null, null, 'public.classlive_last_played(uuid)', true);

-- ---------------------------------------------------------------------------
-- 7. Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.classlive_teaches_room(bigint), public.classlive_in_class(uuid), public.classlive_load(bigint), public.classlive_class_room(uuid),
  public.classlive_teacher_class(uuid, uuid), public.classlive_pupil(uuid), public.classlive_open(uuid, uuid, text, jsonb, jsonb, jsonb),
  public.classlive_save(bigint, integer, jsonb, jsonb, jsonb, bigint, jsonb),
  public.teacher_set_classlive(boolean, boolean, uuid), public.classlive_waiting(uuid), public.classlive_here(),
  public.classlive_last_played(uuid)
from public, anon, authenticated;
grant execute on function public.classlive_teaches_room(bigint), public.classlive_in_class(uuid) to authenticated;
grant execute on function public.teacher_set_classlive(boolean, boolean, uuid), public.classlive_here() to authenticated;
grant execute on function
  public.classlive_load(bigint), public.classlive_class_room(uuid), public.classlive_teacher_class(uuid, uuid),
  public.classlive_pupil(uuid), public.classlive_open(uuid, uuid, text, jsonb, jsonb, jsonb),
  public.classlive_save(bigint, integer, jsonb, jsonb, jsonb, bigint, jsonb), public.classlive_last_played(uuid)
to service_role;
