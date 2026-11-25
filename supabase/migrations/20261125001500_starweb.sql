-- Star Web solo (single-player Star Web on the pupils' home page; id starweb): the server side and the hub
-- (docs/STARWEB-PLAN.md, stages SW1 to SW4). Built the same way as Glyph Gates (20261113000800_glyph.sql).
--
-- 1. starweb_progress: one row a pupil. Their Star Map as shared/starweb/map.ts keeps it (best medal per table, lit skies,
--    golds, counted stars, skies lit with no help, the last few known facts, guide seen). Saved only by the `starweb` server
--    function, and only if its version still matches.
-- 2. starweb_skies: one row a sky started. Its known fact, the stars found so far (the server re-checks every one with the
--    shared rules before saving), the help shown, and once finished its medal and points. One open sky a pupil; a seed is
--    used once; a sky saves only if its version still matches and finishes once. Only a pupil's last 200 skies are kept.
-- 3. The switch (per class): app_settings.starweb_enabled (on to start; the code switch holds the game back).
-- 4. The hub: hub_games hooks, achievements and points from the function (add_game_points). Not a season game: New Season
--    keeps the Star Map.
-- 5. teacher_starweb_class(class): one read for the Games table and Today's "Hardest right now" (the arm the class lights
--    least this week).
-- Depends on 20261017001100_gem_keep.sql (gem_keep_check_player) and 20261020000100_game_hooks.sql.

create table public.starweb_progress (
  player uuid primary key references public.profiles (id) on delete cascade,
  progress jsonb not null check (jsonb_typeof(progress) = 'object'),
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now()
);

create table public.starweb_skies (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  seed text not null check (seed ~ '^[0-9a-f]{16,32}$'),
  mode text not null check (mode in ('map', 'free')),
  x smallint not null check (x between 2 and 12),
  y smallint not null check (y between 2 and 12 and y <> x),
  stars jsonb not null default '[]'::jsonb check (jsonb_typeof(stars) = 'array' and jsonb_array_length(stars) <= 120),
  hints integer not null default 0 check (hints between 0 and 99),
  version integer not null default 1 check (version >= 1),
  open boolean not null default true,
  started_at timestamptz not null default now(),
  saved_at timestamptz not null default now(),
  finished_at timestamptz,
  finished_day date,
  medal smallint check (medal is null or medal between 0 and 3),
  points integer check (points is null or points between 0 and 10)
);
create unique index starweb_skies_seed on public.starweb_skies (player, seed);
create unique index starweb_skies_one_open on public.starweb_skies (player) where open;
create index starweb_skies_by_player on public.starweb_skies (player, started_at);

alter table public.starweb_progress enable row level security;
alter table public.starweb_skies enable row level security;
revoke all on public.starweb_progress, public.starweb_skies from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The server function's jobs (service role only)
-- ---------------------------------------------------------------------------

-- The pupil's progress and version, or null if they've never played.
create function public.starweb_load(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  return (select jsonb_build_object('progress', p.progress, 'version', p.version)
          from public.starweb_progress p where p.player = starweb_load.player);
end;
$$;

-- A sky as the function keeps it (shared/starweb/server.ts KeptSky).
create function public.starweb_sky_json(s public.starweb_skies)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'seed', s.seed, 'mode', s.mode, 'anchor', jsonb_build_object('x', s.x, 'y', s.y, 'p', s.x * s.y),
    'stars', s.stars, 'hints', s.hints, 'version', s.version, 'open', s.open,
    'savedAt', floor(extract(epoch from s.saved_at) * 1000)::bigint)
$$;

-- The pupil's open sky, or null.
create function public.starweb_open_sky(player uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.starweb_sky_json(s) from public.starweb_skies s where s.player = starweb_open_sky.player and s.open
$$;

-- One of the pupil's skies by its seed, or null if it isn't theirs.
create function public.starweb_sky(player uuid, seed text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.starweb_sky_json(s) from public.starweb_skies s where s.player = starweb_sky.player and s.seed = starweb_sky.seed
$$;

-- Keeps a new sky and closes the pupil's other open one. False if the pupil has used this seed before.
create function public.starweb_start(player uuid, seed text, mode text, x integer, y integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if seed is null or seed !~ '^[0-9a-f]{16,32}$' or mode is null or mode not in ('map', 'free')
     or x is null or y is null or x not between 2 and 12 or y not between 2 and 12 or x = y then
    raise exception 'That sky is not right.' using errcode = '22023';
  end if;
  if exists (select 1 from public.starweb_skies s where s.player = starweb_start.player and s.seed = starweb_start.seed) then
    return false;
  end if;
  update public.starweb_skies s set open = false where s.player = starweb_start.player and s.open;
  delete from public.starweb_skies s
  where s.player = starweb_start.player and not s.open
    and s.id not in (select k.id from public.starweb_skies k where k.player = starweb_start.player order by k.started_at desc limit 199);
  insert into public.starweb_skies (player, seed, mode, x, y) values (player, seed, mode, x, y);
  return true;
end;
$$;

-- Saves an open sky's stars (already re-checked by the function) if its version still matches.
create function public.starweb_save(player uuid, seed text, sky_version integer, stars jsonb, hints integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(stars) is distinct from 'array' or jsonb_array_length(stars) > 120 or hints is null or hints not between 0 and 99
     or sky_version is null then
    raise exception 'That sky is not right.' using errcode = '22023';
  end if;
  update public.starweb_skies s
  set stars = starweb_save.stars, hints = starweb_save.hints, version = s.version + 1, saved_at = now()
  where s.player = starweb_save.player and s.seed = starweb_save.seed and s.open and s.version = sky_version;
  return found;
end;
$$;

-- Finishes an open sky with its medal and points and saves the pupil's new progress, together. False if the sky had
-- already finished or either version moved on (a finish sent twice counts once).
create function public.starweb_finish(
  player uuid, seed text, sky_version integer, stars jsonb, hints integer, medal integer, points integer, version integer, progress jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(stars) is distinct from 'array' or jsonb_array_length(stars) > 120 or hints is null or hints not between 0 and 99
     or medal is null or medal not between 1 and 3 or points is null or points not between 0 and 10
     or jsonb_typeof(progress) is distinct from 'object' or version is null or version < 0 or sky_version is null then
    raise exception 'That sky is not right.' using errcode = '22023';
  end if;
  perform 1 from public.starweb_skies s
  where s.player = starweb_finish.player and s.seed = starweb_finish.seed and s.open and s.version = sky_version for update;
  if not found then
    return false;
  end if;
  if version = 0 then
    insert into public.starweb_progress (player, progress) values (player, progress)
    on conflict on constraint starweb_progress_pkey do nothing;
  else
    update public.starweb_progress p
    set progress = starweb_finish.progress, version = p.version + 1, updated_at = now()
    where p.player = starweb_finish.player and p.version = starweb_finish.version;
  end if;
  if not found then
    return false;
  end if;
  update public.starweb_skies s
  set open = false, stars = starweb_finish.stars, hints = starweb_finish.hints, version = s.version + 1, saved_at = now(),
      finished_at = now(), finished_day = (now() at time zone 'Pacific/Auckland')::date,
      medal = starweb_finish.medal, points = starweb_finish.points
  where s.player = starweb_finish.player and s.seed = starweb_finish.seed;
  return true;
end;
$$;

-- Skies that earned points on an NZ day (the first 5 a day do).
create function public.starweb_point_skies(player uuid, day date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.starweb_skies s
  where s.player = starweb_point_skies.player and s.finished_day = day and s.points > 0
$$;

-- Saves the progress alone (the guide seen), if the version still matches.
create function public.starweb_save_progress(player uuid, version integer, progress jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if jsonb_typeof(progress) is distinct from 'object' or version is null or version < 0 then
    raise exception 'That progress is not right.' using errcode = '22023';
  end if;
  if version = 0 then
    insert into public.starweb_progress (player, progress) values (player, progress)
    on conflict on constraint starweb_progress_pkey do nothing;
  else
    update public.starweb_progress p
    set progress = starweb_save_progress.progress, version = p.version + 1, updated_at = now()
    where p.player = starweb_save_progress.player and p.version = starweb_save_progress.version;
  end if;
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- The switch
-- ---------------------------------------------------------------------------

alter table public.app_settings add column starweb_enabled boolean not null default true;

create function public.teacher_set_starweb(enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null then
    raise exception 'Unknown Star Web setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings s
  set starweb_enabled = teacher_set_starweb.enabled
  where s.id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- The hooks
-- ---------------------------------------------------------------------------

-- The measures, the same as shared/starweb/map.ts keeps them. Tables lit follow the pupil's times tables, so those two
-- end in _step and the boards leave them out.
create function public.starweb_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with p as (select coalesce((select g.progress from public.starweb_progress g where g.player = who), '{}'::jsonb) as v)
  select jsonb_build_object(
    'starweb_lit', coalesce((p.v ->> 'lit')::int, 0),
    'starweb_stars', coalesce((p.v ->> 'stars')::int, 0),
    'starweb_nohint', coalesce((p.v ->> 'nohint')::int, 0),
    'starweb_gold', coalesce((p.v ->> 'gold')::int, 0),
    'starweb_tables_step', (select count(*) from jsonb_each_text(coalesce(p.v -> 'tables', '{}'::jsonb)) t(k, m) where t.m::int >= 1),
    'starweb_gold_tables_step', (select count(*) from jsonb_each_text(coalesce(p.v -> 'tables', '{}'::jsonb)) t(k, m) where t.m::int >= 3))
  from p
$$;

create function public.starweb_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'Light every arm of a sky: 2 points.',
    'Silver (25 stars): 3 points. Gold (30 stars): 4 points.',
    'Only your first 5 lit skies each day earn points.'))
$$;

create function public.starweb_players_list()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select p.player from public.starweb_progress p
$$;

create function public.starweb_last_played(player uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select max(s.saved_at) from public.starweb_skies s where s.player = starweb_last_played.player
$$;

insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn, keep_achievements)
values ('starweb', 'starweb_enabled', 'public.starweb_counts(uuid)', 'public.starweb_point_rules()',
  'public.starweb_players_list()', null, 'public.starweb_last_played(uuid)', true);

insert into public.achievement_measures (measure)
values ('starweb_lit'), ('starweb_stars'), ('starweb_nohint'), ('starweb_gold'), ('starweb_tables_step'), ('starweb_gold_tables_step');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort, how, tier) values
  ('starweb-first-light', 'starweb', 'First Light', '🌟', 'starweb_lit', 1, 1, 'Light every arm of a Star Web sky.', 1),
  ('starweb-finder', 'starweb', 'Star Finder', '⭐', 'starweb_stars', 100, 2, 'Find 100 new facts in Star Web skies.', 2),
  ('starweb-every-way', 'starweb', 'Every Way', '🧭', 'starweb_nohint', 1, 3, 'Light a Star Web sky without a hint.', 2),
  ('starweb-supernova', 'starweb', 'Supernova', '💥', 'starweb_gold', 1, 4, 'Get gold (30 stars) on a Star Web sky.', 2),
  ('starweb-bright-ten', 'starweb', 'Bright Ten', '✨', 'starweb_lit', 10, 5, 'Light 10 Star Web skies.', 2),
  ('starweb-star-map', 'starweb', 'Star Map', '🗺️', 'starweb_tables_step', 11, 6, 'Light every table from 2 to 12 on your Star Map.', 3),
  ('starweb-golden-map', 'starweb', 'Golden Map', '🏆', 'starweb_gold_tables_step', 11, 7, 'Get gold on every table of your Star Map.', 3);

-- ---------------------------------------------------------------------------
-- The teacher's read
-- ---------------------------------------------------------------------------

-- One read for the Games table and Today: pupils playing, tables lit added up, and for the class's Star Map skies of the
-- last 7 days how many lit each arm (turn needs 1 star, the others 3).
create function public.teacher_starweb_class(target_class uuid)
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
    with students as (
      select s.id from public.my_students() s(id)
      where exists (select 1 from public.class_members m where m.student_id = s.id and m.class_id = target_class)
    ),
    week as (
      select k.player, k.stars from public.starweb_skies k join students s on s.id = k.player
      where k.mode = 'map' and k.saved_at > now() - interval '7 days' and jsonb_array_length(k.stars) > 0
    ),
    arms(arm, goal) as (values ('turn', 1), ('divide', 3), ('double', 3), ('halve', 3), ('tens', 3), ('near', 3), ('wild', 3))
    select jsonb_build_object(
      'players', (select count(*) from public.starweb_progress p join students s on s.id = p.player),
      'tablesLit', coalesce((select sum((select count(*) from jsonb_each_text(coalesce(p.progress -> 'tables', '{}'::jsonb)) t(k, m) where t.m::int >= 1))
                             from public.starweb_progress p join students s on s.id = p.player), 0),
      'skies', (select count(*) from week),
      'pupils', (select count(distinct w.player) from week w),
      'arms', (select jsonb_object_agg(a.arm, (select count(*) from week w
                 where (select count(*) from jsonb_array_elements(w.stars) e(star) where e.star ->> 'a' = a.arm) >= a.goal))
               from arms a))
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.starweb_load(uuid), public.starweb_sky_json(public.starweb_skies), public.starweb_open_sky(uuid), public.starweb_sky(uuid, text),
  public.starweb_start(uuid, text, text, integer, integer), public.starweb_save(uuid, text, integer, jsonb, integer),
  public.starweb_finish(uuid, text, integer, jsonb, integer, integer, integer, integer, jsonb),
  public.starweb_point_skies(uuid, date), public.starweb_save_progress(uuid, integer, jsonb),
  public.starweb_counts(uuid), public.starweb_point_rules(), public.starweb_players_list(), public.starweb_last_played(uuid),
  public.teacher_set_starweb(boolean, uuid), public.teacher_starweb_class(uuid)
from public, anon, authenticated;
grant execute on function public.teacher_set_starweb(boolean, uuid), public.teacher_starweb_class(uuid) to authenticated;
grant execute on function
  public.starweb_load(uuid), public.starweb_sky_json(public.starweb_skies), public.starweb_open_sky(uuid), public.starweb_sky(uuid, text),
  public.starweb_start(uuid, text, text, integer, integer), public.starweb_save(uuid, text, integer, jsonb, integer),
  public.starweb_finish(uuid, text, integer, jsonb, integer, integer, integer, integer, jsonb),
  public.starweb_point_skies(uuid, date), public.starweb_save_progress(uuid, integer, jsonb)
to service_role;
