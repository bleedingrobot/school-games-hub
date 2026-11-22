-- Circuit Racer, Stage 2: the server side of the first playable (docs/CIRCUIT-PLAN.md, section 8).
--
-- Circuit Racer is its own thing: two tables and its own functions, so no other game reads or changes them. Nothing shared
-- is re-created except teacher_set_unlimited_today (one more game in its list). The game stays hidden behind its code
-- switch (src/games/circuit/switch.ts) until Stage 6.
--
-- 1. circuit_progress: one row per pupil per road. Best time (physics steps, 30 a second), best medal, the two stars ever
--    won (no crash, battery over half), finishes, and finishes on the last NZ day played (for the 5 a day).
-- 2. circuit_runs: recent finished runs with their inputs, so a run can be checked again. A seed is saved once per pupil,
--    so a finish sent twice counts once. Rows over 30 days old go.
-- 3. The server function's jobs (service role only): circuit_load(player) and record_circuit_finish(...), which counts the
--    day's finishes and refuses a 6th (James, 22 Nov 2026) unless the class has "Unlimited today", in one locked step.
-- 4. The switch: app_settings.circuit_enabled, on for every class to start (James, 11 Nov 2026); teacher_set_circuit().
-- 5. The hub_games row: the switch, points rules and "last played". Achievements come in Stage 6.
-- 6. "Unlimited today" for Circuit Racer (newest body: 20261120001500_marble_runs_a_day_gem_keep_card.sql).

create table public.circuit_progress (
  player uuid not null references public.profiles (id) on delete cascade,
  road text not null check (road ~ '^[a-z0-9-]{1,40}$'),
  best_steps integer not null check (best_steps > 0),
  medal text not null check (medal in ('bronze', 'silver', 'gold')),
  clean boolean not null default false,
  charged boolean not null default false,
  finishes integer not null default 0 check (finishes >= 0),
  -- Finishes on `day` (an NZ date): the 5 a day are the sum over a pupil's roads where day is today.
  day date not null,
  day_finishes integer not null default 0 check (day_finishes >= 0),
  updated_at timestamptz not null default now(),
  primary key (player, road)
);

create table public.circuit_runs (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  road text not null,
  seed text not null check (length(seed) <= 80),
  steps integer not null check (steps > 0),
  medal text not null check (medal in ('bronze', 'silver', 'gold')),
  clean boolean not null,
  charged boolean not null,
  inputs text not null check (length(inputs) <= 60000),
  -- A finish past the day's 5 on an Unlimited day: game rewards, no hub points.
  extra boolean not null default false,
  day date not null,
  created_at timestamptz not null default now()
);
create unique index circuit_runs_seed on public.circuit_runs (player, seed);
create index circuit_runs_by_age on public.circuit_runs (created_at);

alter table public.circuit_progress enable row level security;
alter table public.circuit_runs enable row level security;
revoke all on public.circuit_progress, public.circuit_runs from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The server function's jobs (service role only)
-- ---------------------------------------------------------------------------

-- { roads: { <road>: { best, medal, clean, charged, finishes } }, today }: the pupil's roads and finishes today (NZ day).
create function public.circuit_load(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Pacific/Auckland')::date;
begin
  perform public.gem_keep_check_player(player);
  return jsonb_build_object(
    'roads', coalesce((select jsonb_object_agg(p.road, jsonb_build_object(
                'best', p.best_steps, 'medal', p.medal, 'clean', p.clean, 'charged', p.charged, 'finishes', p.finishes))
              from public.circuit_progress p where p.player = circuit_load.player), '{}'::jsonb),
    'today', coalesce((select sum(p.day_finishes)::integer from public.circuit_progress p
              where p.player = circuit_load.player and p.day = today), 0));
end;
$$;

-- Saves one finish the server function has replayed itself: { status, today }. In order:
--   'duplicate'   this seed was saved already (nothing changes);
--   'locked'      the road before (before_road) has never been finished;
--   'done-today'  5 finishes today already and no "Unlimited today" (unlimited is read by the function from settings_of);
--   'best' or 'saved'  kept, with the best time, medal and stars so far.
-- Hub points on the day's first 5 finishes only (shared/circuit/game.ts FINISH_POINTS, GOLD_POINTS; change together):
-- 3 a finish, 2 more the first time a road gets gold. add_game_points keeps them inside the shared daily cap and counts
-- the seed once; an error there can't lose the save. The pupil's row lock makes two tabs count one at a time.
-- shared/circuit/memoryServices.ts follows this for the preview and tests.
create function public.record_circuit_finish(player uuid, road text, before_road text, seed text, steps integer, medal text,
  clean boolean, charged boolean, inputs text, unlimited boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Pacific/Auckland')::date;
  done integer;
  had public.circuit_progress;
  rank_new integer := case medal when 'gold' then 3 when 'silver' then 2 else 1 end;
  extra_turn boolean;
  points integer;
begin
  perform public.gem_keep_check_player(player);
  if road is null or seed is null or steps is null or steps <= 0 or medal is null or medal not in ('bronze', 'silver', 'gold') then
    raise exception 'That finish is not right.' using errcode = '22023';
  end if;
  -- One pupil's finishes are saved one at a time.
  perform pg_advisory_xact_lock(hashtextextended('circuit:' || player::text, 0));
  done := coalesce((select sum(p.day_finishes)::integer from public.circuit_progress p
                    where p.player = record_circuit_finish.player and p.day = today), 0);
  if exists (select 1 from public.circuit_runs r where r.player = record_circuit_finish.player and r.seed = record_circuit_finish.seed) then
    return jsonb_build_object('status', 'duplicate', 'today', done);
  end if;
  if before_road is not null and not exists (
    select 1 from public.circuit_progress p where p.player = record_circuit_finish.player and p.road = before_road and p.finishes > 0) then
    return jsonb_build_object('status', 'locked', 'today', done);
  end if;
  if done >= 5 and not coalesce(unlimited, false) then
    return jsonb_build_object('status', 'done-today', 'today', done);
  end if;
  extra_turn := done >= 5;

  delete from public.circuit_runs r where r.created_at < now() - interval '30 days';
  insert into public.circuit_runs (player, road, seed, steps, medal, clean, charged, inputs, extra, day)
  values (player, road, seed, steps, medal, coalesce(clean, false), coalesce(charged, false), coalesce(inputs, ''), extra_turn, today);

  select * into had from public.circuit_progress p where p.player = record_circuit_finish.player and p.road = record_circuit_finish.road;
  insert into public.circuit_progress as p (player, road, best_steps, medal, clean, charged, finishes, day, day_finishes)
  values (player, road, steps, medal, coalesce(clean, false), coalesce(charged, false), 1, today, 1)
  on conflict on constraint circuit_progress_pkey do update
  set best_steps = least(p.best_steps, excluded.best_steps),
      medal = case when rank_new > case p.medal when 'gold' then 3 when 'silver' then 2 else 1 end then excluded.medal else p.medal end,
      clean = p.clean or excluded.clean,
      charged = p.charged or excluded.charged,
      finishes = p.finishes + 1,
      day_finishes = case when p.day = today then p.day_finishes + 1 else 1 end,
      day = today,
      updated_at = now();

  points := case when extra_turn then 0 else 3 + case when medal = 'gold' and coalesce(had.medal, '') <> 'gold' then 2 else 0 end end;
  begin
    if points > 0 then
      perform public.add_game_points(player, 'circuit', points, seed);
    else
      perform public.game_progress_changed(player, 'circuit');
    end if;
  exception when others then
    raise warning 'Circuit Racer points failed (%)', sqlstate;
  end;
  return jsonb_build_object('status', case when had.player is null or steps < had.best_steps then 'best' else 'saved' end, 'today', done + 1);
end;
$$;

-- ---------------------------------------------------------------------------
-- The switch
-- ---------------------------------------------------------------------------

-- A new game's switch starts on for every class (James, 11 Nov 2026); the code switch holds it back until Stage 6.
alter table public.app_settings add column circuit_enabled boolean not null default true;

create function public.teacher_set_circuit(enabled boolean default null, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null then
    raise exception 'Unknown Circuit Racer setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings s set circuit_enabled = teacher_set_circuit.enabled
  where s.id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- The hooks: points rules and "last played"
-- ---------------------------------------------------------------------------

create function public.circuit_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'Finish a road: 3 points.',
    'Win a gold medal on a road for the first time: 2 more.',
    'Your 5 finished roads a day earn points. Extra roads on an Unlimited day earn medals only.'))
$$;

create function public.circuit_last_played(player uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(p.updated_at) from public.circuit_progress p where p.player = circuit_last_played.player
$$;

insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn, keep_achievements)
values ('circuit', 'circuit_enabled', null, 'public.circuit_point_rules()', null, null, 'public.circuit_last_played(uuid)', true);

-- ---------------------------------------------------------------------------
-- Unlimited today: Circuit Racer joins the games the teacher can lift. create or replace keeps its grants.
-- ---------------------------------------------------------------------------

create or replace function public.teacher_set_unlimited_today(game text, enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null or game is null
     or game not in ('dragon-maths', 'clan-quest', 'monsters', 'diamond', 'trader', 'isles', 'goblinstorm', 'toonflap', 'marble', 'circuit') then
    raise exception 'Unknown Unlimited turns setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings
  set unlimited_days = case when enabled
    then unlimited_days || jsonb_build_object(game, to_char((now() at time zone 'Pacific/Auckland')::date, 'YYYY-MM-DD'))
    else unlimited_days - game end
  where id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.circuit_load(uuid),
  public.record_circuit_finish(uuid, text, text, text, integer, text, boolean, boolean, text, boolean),
  public.teacher_set_circuit(boolean, uuid),
  public.circuit_point_rules(),
  public.circuit_last_played(uuid)
from public, anon, authenticated;
grant execute on function public.teacher_set_circuit(boolean, uuid) to authenticated;
grant execute on function
  public.circuit_load(uuid),
  public.record_circuit_finish(uuid, text, text, text, integer, text, boolean, boolean, text, boolean)
to service_role;
