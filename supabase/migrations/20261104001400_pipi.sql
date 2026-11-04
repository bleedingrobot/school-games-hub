-- Pipi's Hidden Shells: the server side and the hub (docs/PIPI-PLAN.md, stages 4 and 5). Built the same way as Hop's
-- Glow-worm Pond (20261104000600_hop.sql and 20261104000900_hop_hub.sql), in one file.
--
-- 1. pipi_progress: one row a pupil. The count of finished days (the shells' colours, the pearls and the friend are
--    worked out from it by shared/pipi/progress.ts), the NZ day a shell last changed, the furthest level reached (1:
--    wholes 3 to 5, 2: 6 and 7, 3: 8 to 10; a child never drops back) and how many challenges they have finished (the
--    first one starts with the guided go). Saved only by the `pipi` server function, and only if its version matches.
-- 2. pipi_rounds: one row a challenge started: its seed, level, the day's colour and its ten goes as the server made them
--    from the pupil's maths records (shared/pipi/round.ts). Once finished: the taps and how many shells were wrong. A seed
--    is used once per pupil and a challenge finishes once. Finished challenges over 30 days old go.
-- 3. The switch (app_settings.pipi_enabled, ON to start for every class, as James wants for every game), the help
--    setting (app_settings.pipi_help: the frame and outlines in the sand, on to start) and teacher_set_pipi().
-- 4. The hub: hub_games hooks, one achievement per Golden Pearl (one per friend, no points), the teacher's lines.
--
-- Pupils can't read or change any of it directly. Maths records come from space_maths_context and answers are saved
-- with record_fact_answers. Not a season game: New Season leaves the beach and the achievements as they are.

create table public.pipi_progress (
  player uuid primary key references public.profiles (id) on delete cascade,
  days_done integer not null default 0 check (days_done >= 0),
  last_shell_day date,
  reached smallint not null default 1 check (reached between 1 and 3),
  played integer not null default 0 check (played >= 0),
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now()
);

create table public.pipi_rounds (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  seed bigint not null check (seed between 0 and 2147483647),
  level smallint not null check (level between 1 and 3),
  colour text not null check (colour in ('bronze', 'silver', 'gold')),
  goes jsonb not null check (jsonb_typeof(goes) = 'array' and jsonb_array_length(goes) = 10),
  open boolean not null default true,
  taps jsonb check (taps is null or jsonb_typeof(taps) = 'array'),
  mistakes integer check (mistakes >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create unique index pipi_rounds_seed on public.pipi_rounds (player, seed);
create index pipi_rounds_by_player on public.pipi_rounds (player, started_at);

alter table public.pipi_progress enable row level security;
alter table public.pipi_rounds enable row level security;
revoke all on public.pipi_progress, public.pipi_rounds from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The server function's jobs (service role only)
-- ---------------------------------------------------------------------------

-- The pupil's beach and its version, or null if they've never played.
create function public.pipi_load(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  return (select jsonb_build_object('daysDone', h.days_done, 'lastShellDay', to_char(h.last_shell_day, 'YYYY-MM-DD'),
                                    'reached', h.reached, 'played', h.played, 'version', h.version)
          from public.pipi_progress h where h.player = pipi_load.player);
end;
$$;

-- Keeps a new challenge (making the pupil's beach on their first go) and closes any other open one. False if the pupil
-- has used this seed before.
create function public.pipi_start(player uuid, seed bigint, level smallint, colour text, goes jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if exists (select 1 from public.pipi_rounds r where r.player = pipi_start.player and r.seed = pipi_start.seed) then
    return false;
  end if;
  insert into public.pipi_progress (player) values (player) on conflict on constraint pipi_progress_pkey do nothing;
  update public.pipi_rounds r set open = false where r.player = pipi_start.player and r.open;
  delete from public.pipi_rounds r
  where r.player = pipi_start.player and not r.open and r.started_at < now() - interval '30 days';
  insert into public.pipi_rounds (player, seed, level, colour, goes) values (player, seed, level, colour, goes);
  return true;
end;
$$;

-- One of the pupil's challenges by its seed: { open, round: { seed, level, colour, goes } }, or null if it isn't theirs.
create function public.pipi_round(player uuid, seed bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('open', r.open,
                            'round', jsonb_build_object('seed', r.seed, 'level', r.level, 'colour', r.colour, 'goes', r.goes))
  from public.pipi_rounds r where r.player = pipi_round.player and r.seed = pipi_round.seed
$$;

-- Finishes an open challenge with the server's replay of its taps and saves the progress, together. The count of
-- finished days only ever stays or goes up by one, the challenges played go up by one, and the furthest level reached
-- never goes back. False if the challenge
-- had already finished or the version moved on.
create function public.pipi_finish(
  player uuid, seed bigint, version integer, days_done integer, last_shell_day date, reached smallint, played integer, taps jsonb, mistakes integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(taps) is distinct from 'array' or mistakes is null or mistakes < 0 or days_done is null
     or reached is null or reached not between 1 and 3 or played is null then
    raise exception 'That challenge is not right.' using errcode = '22023';
  end if;
  perform 1 from public.pipi_rounds r where r.player = pipi_finish.player and r.seed = pipi_finish.seed and r.open for update;
  if not found then
    return false;
  end if;
  update public.pipi_progress h
  set days_done = pipi_finish.days_done, last_shell_day = pipi_finish.last_shell_day, reached = pipi_finish.reached,
      played = pipi_finish.played, version = h.version + 1, updated_at = now()
  where h.player = pipi_finish.player and h.version = pipi_finish.version
    and pipi_finish.days_done between h.days_done and h.days_done + 1
    and pipi_finish.played = h.played + 1
    and pipi_finish.reached >= h.reached;
  if not found then
    return false;
  end if;
  update public.pipi_rounds r set open = false, taps = pipi_finish.taps, mistakes = pipi_finish.mistakes, finished_at = now()
  where r.player = pipi_finish.player and r.seed = pipi_finish.seed;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- The switch and the help in the sand
-- ---------------------------------------------------------------------------

alter table public.app_settings add column pipi_enabled boolean not null default true;
alter table public.app_settings add column pipi_help boolean not null default true;

-- Either setting, or both (a null one is left as it is).
create function public.teacher_set_pipi(enabled boolean default null, help boolean default null, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null and help is null then
    raise exception 'Unknown Pipi''s Hidden Shells setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings s
  set pipi_enabled = coalesce(teacher_set_pipi.enabled, s.pipi_enabled),
      pipi_help = coalesce(teacher_set_pipi.help, s.pipi_help)
  where s.id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.pipi_load(uuid), public.pipi_start(uuid, bigint, smallint, text, jsonb),
  public.pipi_round(uuid, bigint), public.pipi_finish(uuid, bigint, integer, integer, date, smallint, integer, jsonb, integer),
  public.teacher_set_pipi(boolean, boolean, uuid)
from public, anon, authenticated;
grant execute on function public.teacher_set_pipi(boolean, boolean, uuid) to authenticated;
grant execute on function
  public.pipi_load(uuid), public.pipi_start(uuid, bigint, smallint, text, jsonb),
  public.pipi_round(uuid, bigint), public.pipi_finish(uuid, bigint, integer, integer, date, smallint, integer, jsonb, integer)
to service_role;

-- ---------------------------------------------------------------------------
-- The hooks
-- ---------------------------------------------------------------------------

-- Golden Pearls won: one for every 30 finished days.
create function public.pipi_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('pipi_pearls', coalesce((select h.days_done / 30 from public.pipi_progress h where h.player = who), 0))
$$;

-- The lines on How points work.
create function public.pipi_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'No points: each Golden Pearl is the prize, and an achievement.'))
$$;

-- Pupils with a beach (a rebuild gives their achievements back).
create function public.pipi_players_list()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select h.player from public.pipi_progress h
$$;

create function public.pipi_last_played(player uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select h.updated_at from public.pipi_progress h where h.player = pipi_last_played.player
$$;

insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn, keep_achievements)
values ('pipi', 'pipi_enabled', 'public.pipi_counts(uuid)', 'public.pipi_point_rules()',
  'public.pipi_players_list()', null, 'public.pipi_last_played(uuid)', true);

insert into public.achievement_measures (measure) values ('pipi_pearls');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('pipi-pipi', 'pipi', 'Pipi’s Golden Pearl', '🐚', 'pipi_pearls', 1, 1),
  ('pipi-korora', 'pipi', 'Kororā’s Golden Pearl', '🐧', 'pipi_pearls', 2, 2),
  ('pipi-tuatara', 'pipi', 'Tuatara’s Golden Pearl', '🦎', 'pipi_pearls', 3, 3),
  ('pipi-weta', 'pipi', 'Wētā’s Golden Pearl', '🦗', 'pipi_pearls', 4, 4),
  ('pipi-kiwi', 'pipi', 'Kiwi’s Golden Pearl', '🥝', 'pipi_pearls', 5, 5),
  ('pipi-tui', 'pipi', 'Tūī’s Golden Pearl', '🐦', 'pipi_pearls', 6, 6);

-- ---------------------------------------------------------------------------
-- The teacher's lines
-- ---------------------------------------------------------------------------

-- The teacher's Games table line for a class: how many of its pupils play, and the Golden Pearls won between them.
create function public.teacher_pipi_class(target_class uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if target_class is null or not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object('players', count(*), 'pearls', coalesce(sum(h.days_done / 30), 0))
    from public.pipi_progress h
    join public.my_students() s(id) on s.id = h.player
    where exists (select 1 from public.class_members m where m.student_id = h.player and m.class_id = target_class));
end;
$$;

-- One line's worth for a student's page: finished days in all (the screens work out the day and pearls), the NZ day a
-- shell last changed, the level reached (1 to 3) and when they last played; or null.
create function public.teacher_pipi_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return (select jsonb_build_object('daysDone', h.days_done, 'lastShellDay', to_char(h.last_shell_day, 'YYYY-MM-DD'),
                                    'reached', h.reached, 'lastPlayed', h.updated_at)
          from public.pipi_progress h where h.player = student);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.pipi_counts(uuid), public.pipi_point_rules(), public.pipi_players_list(), public.pipi_last_played(uuid),
  public.teacher_pipi_class(uuid), public.teacher_pipi_student(uuid)
from public, anon, authenticated;
grant execute on function public.teacher_pipi_class(uuid), public.teacher_pipi_student(uuid) to authenticated;
