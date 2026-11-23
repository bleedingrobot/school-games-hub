-- Class Showdown stage 2: the server and live play (docs/SHOWDOWN-PLAN.md section 6). A live game for the whole room:
-- the teacher's screen (the projector) runs the round, every pupil's iPad is a controller. Nothing is shown to pupils
-- yet: the code switch (src/games/showdown/switch.ts) is off until stage 4.
--
--   1. Tables: showdown_rooms (what pupils of the class and the projector may see of a room: no names, no maths),
--      showdown_state (the whole Stage 1 round, hidden), showdown_players (each pupil's own row, for their iPad),
--      showdown_questions (hidden, like marble_questions) and showdown_feed (the projector's events, kept 1 hour).
--   2. Live updates: rooms, players and feed in the supabase_realtime publication, each with a rule for who hears it.
--   3. The server function's steps (service role only). A save lands only at the version it was loaded at
--      (compare-and-swap), with the answer's claim in the same transaction, so 30 iPads at once can't overwrite each other.
--   4. The switch (on for every class to start, James 11 Nov 2026; the code switch holds it back) and the names switch.
--   5. The join pop-up: showdown_waiting() and showdown_here(), and one exact edit to hub_here().
--   6. The hub_games row.
--   7. Who can call what.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table public.showdown_rooms (
  id bigint generated always as identity primary key,
  class_id uuid not null references public.classes (id) on delete cascade,
  teacher uuid not null references public.profiles (id) on delete cascade,
  arena text not null default 'boss' check (arena in ('boss')),
  mode text not null check (mode in ('class', 'teams2', 'teams4', 'solo')),
  length_min smallint not null check (length_min in (5, 10, 15)),
  state text not null default 'lobby' check (state in ('lobby', 'live', 'over')),
  version integer not null default 1 check (version >= 1),
  -- Server times in ms since 1970 (the round's clock is ms from started_ms, frozen while paused_ms is set).
  started_ms bigint,
  paused_ms bigint,
  show_names boolean not null default true,
  -- What the projector and the class's iPads draw: boss health, team bars, weak spot, wind-up... (RoomView in
  -- shared/showdown/server.ts). No names, no ladder places, no maths.
  view jsonb not null check (jsonb_typeof(view) = 'object'),
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index showdown_rooms_by_class on public.showdown_rooms (class_id, opened_at desc);

create table public.showdown_state (
  room bigint primary key references public.showdown_rooms (id) on delete cascade,
  round jsonb not null check (jsonb_typeof(round) = 'object')
);

create table public.showdown_players (
  room bigint not null references public.showdown_rooms (id) on delete cascade,
  player uuid not null references public.profiles (id) on delete cascade,
  -- PlayerView: name, team, role, score, streak, next answer time, dazed until... (only this pupil and the teacher read it)
  view jsonb not null check (jsonb_typeof(view) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (room, player)
);
create index showdown_players_by_player on public.showdown_players (player);

create table public.showdown_questions (
  room bigint not null references public.showdown_rooms (id) on delete cascade,
  player uuid not null references public.profiles (id) on delete cascade,
  slot integer not null check (slot >= 0),
  question jsonb not null check (jsonb_typeof(question) = 'object'),
  golden boolean not null default false,
  answered boolean not null default false,
  value numeric,
  right_answer boolean,
  made_at timestamptz not null default now(),
  primary key (room, player, slot)
);

create table public.showdown_feed (
  id bigint generated always as identity primary key,
  room bigint not null references public.showdown_rooms (id) on delete cascade,
  event jsonb not null check (jsonb_typeof(event) = 'object'),
  at timestamptz not null default now()
);
create index showdown_feed_by_room on public.showdown_feed (room, id);
create index showdown_feed_by_time on public.showdown_feed (at);

alter table public.showdown_rooms enable row level security;
alter table public.showdown_state enable row level security;
alter table public.showdown_players enable row level security;
alter table public.showdown_questions enable row level security;
alter table public.showdown_feed enable row level security;
revoke all on public.showdown_rooms, public.showdown_state, public.showdown_players, public.showdown_questions, public.showdown_feed
  from anon, authenticated;

-- The switch and the names switch (section 4 has the save).
alter table public.app_settings add column showdown_enabled boolean not null default true;
-- First names on the projector (off: avatars only).
alter table public.app_settings add column showdown_names boolean not null default true;

-- ---------------------------------------------------------------------------
-- 2. Who may read (and hear live) what. Nobody writes except the server function.
-- ---------------------------------------------------------------------------

-- Is this a teacher of the room's class? (security definer, so the rules below don't need to read classes themselves.)
create function public.showdown_teaches_room(target bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.showdown_rooms r
    join public.class_teachers t on t.class_id = r.class_id
    where r.id = target and t.teacher_id = auth.uid()
  )
$$;

-- Is the reader a pupil or a teacher of this class? (Pupils can't read class_members or class_teachers themselves.)
create function public.showdown_in_class(target_class uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.class_members m where m.class_id = target_class and m.student_id = auth.uid())
    or exists (select 1 from public.class_teachers t where t.class_id = target_class and t.teacher_id = auth.uid())
$$;

grant select on public.showdown_rooms, public.showdown_players, public.showdown_feed to authenticated;

-- A room: its class's pupils (their pop-up and controller) and the class's teachers (the projector).
create policy "Pupils and teachers of the class see a Class Showdown room" on public.showdown_rooms
  for select to authenticated
  using (public.showdown_in_class(class_id));

-- A pupil's own row; the teacher sees the whole room's.
create policy "Pupils see their own Class Showdown row" on public.showdown_players
  for select to authenticated
  using (player = auth.uid() or public.showdown_teaches_room(room));

-- The feed names pupils, so only the class's teachers (the projector) see it.
create policy "Teachers see their class's Class Showdown feed" on public.showdown_feed
  for select to authenticated
  using (public.showdown_teaches_room(room));

alter publication supabase_realtime add table public.showdown_rooms;
alter publication supabase_realtime add table public.showdown_players;
alter publication supabase_realtime add table public.showdown_feed;

-- ---------------------------------------------------------------------------
-- 3. The server function's steps (service role only)
-- ---------------------------------------------------------------------------

-- The room as the server holds it (RoomRow in shared/showdown/server.ts).
create function public.showdown_row(target bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('id', r.id, 'class_id', r.class_id, 'teacher', r.teacher, 'arena', r.arena, 'version', r.version,
    'started_ms', r.started_ms, 'paused_ms', r.paused_ms, 'show_names', r.show_names, 'round', s.round)
  from public.showdown_rooms r join public.showdown_state s on s.room = r.id
  where r.id = target
$$;

create function public.showdown_load(target bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$ select public.showdown_row(target) $$;

-- The class's newest room opened in the last 3 hours (lobby, live or just over), or null.
create function public.showdown_class_room(target_class uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.showdown_row(r.id) from public.showdown_rooms r
  where r.class_id = target_class and r.opened_at > now() - interval '3 hours'
  order by r.opened_at desc, r.id desc limit 1
$$;

-- Does this teacher teach this class, and is the game on for it? Null if they don't teach it.
create function public.showdown_teacher_class(teacher uuid, target_class uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('enabled', s.showdown_enabled, 'show_names', s.showdown_names)
  from public.class_teachers t
  join public.classes c on c.id = t.class_id and not c.archived
  join public.app_settings s on s.class_id = t.class_id
  where t.teacher_id = showdown_teacher_class.teacher and t.class_id = target_class
  limit 1
$$;

-- A pupil's class, display name and the game's switch. Null if they aren't a pupil in a class.
create function public.showdown_pupil(player uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('class_id', m.class_id, 'name', p.display_name,
    'enabled', coalesce((select s.showdown_enabled from public.settings_of(showdown_pupil.player) s), false))
  from public.profiles p
  join public.class_members m on m.student_id = p.id
  where p.id = showdown_pupil.player and p.role = 'student'
$$;

-- A new room for the class: any other open room of the class ends, and old feed rows and questions are cleared.
create function public.showdown_open(target_class uuid, teacher uuid, arena text, round jsonb, view jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  made bigint;
begin
  perform 1 from public.classes c where c.id = target_class for update;
  update public.showdown_rooms r set state = 'over', version = r.version + 1, updated_at = now(),
    view = r.view || jsonb_build_object('state', 'over')
  where r.class_id = target_class and r.state <> 'over';
  delete from public.showdown_feed f where f.at < now() - interval '1 hour';
  delete from public.showdown_questions q where q.made_at < now() - interval '1 day';
  insert into public.showdown_rooms (class_id, teacher, arena, mode, length_min, state, show_names, view)
  values (target_class, teacher, arena, round ->> 'mode', (round ->> 'lengthMin')::smallint, 'lobby',
          coalesce((view ->> 'showNames')::boolean, true), view)
  returning id into made;
  insert into public.showdown_state (room, round) values (made, round);
  return made;
end;
$$;

-- One step's save: lands only if the room is still at `seen_version` ('stale' otherwise, and nothing changes); a claimed
-- answer is marked in the same transaction ('answered' if it already was, and nothing changes). Writes the round, the
-- room's view, the changed pupils' rows and the feed events, in order.
create function public.showdown_save(target bigint, seen_version integer, round jsonb, view jsonb, started_ms bigint,
  paused_ms bigint, players jsonb, events jsonb, claim jsonb default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_version integer;
begin
  select r.version into now_version from public.showdown_rooms r where r.id = target for update;
  if now_version is null then
    raise exception 'No such room' using errcode = '22023';
  end if;
  if now_version <> seen_version then
    return 'stale';
  end if;
  if claim is not null then
    update public.showdown_questions q
    set answered = true, value = (claim ->> 'value')::numeric, right_answer = (claim ->> 'right')::boolean
    where q.room = target and q.player = (claim ->> 'player')::uuid and q.slot = (claim ->> 'slot')::integer and not q.answered;
    if not found then
      return 'answered';
    end if;
  end if;
  update public.showdown_rooms r
  set version = r.version + 1, state = round ->> 'state', view = showdown_save.view, started_ms = showdown_save.started_ms,
      paused_ms = showdown_save.paused_ms, updated_at = now()
  where r.id = target;
  update public.showdown_state s set round = showdown_save.round where s.room = target;
  insert into public.showdown_players as p (room, player, view, updated_at)
  select target, (v ->> 'player')::uuid, v, now() from jsonb_array_elements(coalesce(players, '[]'::jsonb)) v
  on conflict (room, player) do update set view = excluded.view, updated_at = now();
  insert into public.showdown_feed (room, event)
  select target, e from jsonb_array_elements(coalesce(events, '[]'::jsonb)) with ordinality as x(e, n) order by n;
  return 'ok';
end;
$$;

-- The pupil's newest question not yet answered, or null.
create function public.showdown_open_question(target bigint, player uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('slot', q.slot, 'question', q.question, 'golden', q.golden, 'answered', q.answered)
  from public.showdown_questions q
  where q.room = target and q.player = showdown_open_question.player and not q.answered
  order by q.slot desc limit 1
$$;

create function public.showdown_load_question(target bigint, player uuid, slot integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('slot', q.slot, 'question', q.question, 'golden', q.golden, 'answered', q.answered)
  from public.showdown_questions q
  where q.room = target and q.player = showdown_load_question.player and q.slot = showdown_load_question.slot
$$;

-- Keeps a new question at the pupil's next slot, unless one is still open: then that one comes back (two asks at once
-- from a re-joining iPad give the same question).
create function public.showdown_keep_question(target bigint, player uuid, question jsonb, golden boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  open_one jsonb;
  next_slot integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('showdown:' || target || ':' || player, 0));
  open_one := public.showdown_open_question(target, player);
  if open_one is not null then
    return open_one;
  end if;
  select coalesce(max(q.slot) + 1, 0) into next_slot from public.showdown_questions q
  where q.room = target and q.player = showdown_keep_question.player;
  insert into public.showdown_questions (room, player, slot, question, golden)
  values (target, player, next_slot, question, golden);
  return jsonb_build_object('slot', next_slot, 'question', question, 'golden', golden, 'answered', false);
end;
$$;

-- Every pupil's row of a room (the projector after a refresh).
create function public.showdown_room_players(target bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(p.view order by p.updated_at), '[]'::jsonb) from public.showdown_players p where p.room = target
$$;

-- ---------------------------------------------------------------------------
-- 4. The switch and the names switch
-- ---------------------------------------------------------------------------

-- (The two columns are added in section 1, before the functions that read them.)

create function public.teacher_set_showdown(enabled boolean default null, names boolean default null, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null and names is null then
    raise exception 'Unknown Class Showdown setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings s
  set showdown_enabled = coalesce(teacher_set_showdown.enabled, s.showdown_enabled),
      showdown_names = coalesce(teacher_set_showdown.names, s.showdown_names)
  where s.id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. The join pop-up: "Class Showdown is starting! Join" anywhere in the hub
-- ---------------------------------------------------------------------------

-- Is a showdown open in this pupil's class that they haven't joined, with the game on? (Called by hub_here().)
create function public.showdown_waiting(me uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.showdown_enabled from public.settings_of(me) s), false)
    and exists (
      select 1 from public.showdown_rooms r
      join public.class_members m on m.class_id = r.class_id and m.student_id = me
      where r.state in ('lobby', 'live') and r.opened_at > now() - interval '3 hours'
        and not exists (select 1 from public.showdown_players p where p.room = r.id and p.player = me)
    )
$$;

-- The pop-up's details: the room and the class's name. Empty when nothing is waiting.
create function public.showdown_here()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('room', r.id, 'class', c.name, 'state', r.state,
      'until', to_char((r.opened_at + interval '3 hours') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))), '[]'::jsonb)
  from public.showdown_rooms r
  join public.classes c on c.id = r.class_id
  join public.class_members m on m.class_id = r.class_id and m.student_id = auth.uid()
  where public.showdown_waiting(auth.uid()) and r.state in ('lobby', 'live') and r.opened_at > now() - interval '3 hours'
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

-- hub_here(): also 'showdown' when a showdown in the pupil's class is waiting for them.
select pg_temp.edit_function('public.hub_here()', array[array[
  E'    (select i.game from public.board_invites i where i.seat_b = me and i.status = ''asked'' and i.deadline > now() limit 1)\n',
  E'    (select i.game from public.board_invites i where i.seat_b = me and i.status = ''asked'' and i.deadline > now() limit 1),\n'
  || E'    case when public.showdown_waiting(me) then ''showdown'' end\n'
]]);

-- ---------------------------------------------------------------------------
-- 6. The hub
-- ---------------------------------------------------------------------------

create function public.showdown_last_played(player uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$ select max(p.updated_at) from public.showdown_players p where p.player = showdown_last_played.player $$;

insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn, keep_achievements)
values ('showdown', 'showdown_enabled', null, null, null, null, 'public.showdown_last_played(uuid)', true);

-- ---------------------------------------------------------------------------
-- 7. Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.showdown_teaches_room(bigint), public.showdown_in_class(uuid), public.showdown_row(bigint), public.showdown_load(bigint), public.showdown_class_room(uuid),
  public.showdown_teacher_class(uuid, uuid), public.showdown_pupil(uuid), public.showdown_open(uuid, uuid, text, jsonb, jsonb),
  public.showdown_save(bigint, integer, jsonb, jsonb, bigint, bigint, jsonb, jsonb, jsonb),
  public.showdown_open_question(bigint, uuid), public.showdown_load_question(bigint, uuid, integer),
  public.showdown_keep_question(bigint, uuid, jsonb, boolean), public.showdown_room_players(bigint),
  public.teacher_set_showdown(boolean, boolean, uuid), public.showdown_waiting(uuid), public.showdown_here(),
  public.showdown_last_played(uuid)
from public, anon, authenticated;
-- The table rules call this one as the reader.
grant execute on function public.showdown_teaches_room(bigint), public.showdown_in_class(uuid) to authenticated;
grant execute on function public.teacher_set_showdown(boolean, boolean, uuid), public.showdown_here() to authenticated;
grant execute on function
  public.showdown_load(bigint), public.showdown_class_room(uuid), public.showdown_teacher_class(uuid, uuid),
  public.showdown_pupil(uuid), public.showdown_open(uuid, uuid, text, jsonb, jsonb),
  public.showdown_save(bigint, integer, jsonb, jsonb, bigint, bigint, jsonb, jsonb, jsonb),
  public.showdown_open_question(bigint, uuid), public.showdown_load_question(bigint, uuid, integer),
  public.showdown_keep_question(bigint, uuid, jsonb, boolean), public.showdown_room_players(bigint),
  public.showdown_last_played(uuid)
to service_role;
