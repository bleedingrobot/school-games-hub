-- Hop's Glow-worm Pond: the server side (docs/HOP-PLAN.md, section 4). Built the same way as Kiwi's Beanstalk.
--
-- Hop's Glow-worm Pond is its own thing: two tables and its own functions, so no other game reads or changes them. Its
-- achievement, the teacher's "last played" and the hub_games hooks come in Stage 4's own migration; nothing shared is
-- re-created.
--
-- 1. hop_progress: one row a pupil. The count of finished days (everything else, the pads' colours, the jars and the
--    friend, is worked out from it by shared/hop/progress.ts), the NZ day a pad last changed, and the furthest step
--    reached (10s, 5s or 2s: a child never drops back below it). Saved only by the `hop` server function, and only if its
--    version still matches.
-- 2. hop_rounds: one row a challenge started. Its seed, its step, whether it was a gold day, and its ten hops as the
--    server made them from the pupil's maths records (shared/hop/round.ts), kept so the taps are checked against exactly
--    what the pupil was shown. Once it has finished: the taps and how many glow-worms were wrong. A seed is used once per
--    pupil and a challenge finishes once. Finished challenges over 30 days old go.
-- 3. The switch (app_settings.hop_enabled, per class, ON to start for every class: James, 4 Nov 2026, "I always want switches on by default"), the step-label setting (app_settings.hop_labels,
--    on to start) and teacher_set_hop().
--
-- Pupils can't read or change any of it directly; the server function does everything. The maths records it reads come
-- from space_maths_context (20261019000300_maths_generated.sql) and its answers are saved with record_fact_answers.
-- Depends on 20261017001100_gem_keep.sql (gem_keep_check_player) and 20261018002400_classes_and_warp.sql (settings).

create table public.hop_progress (
  player uuid primary key references public.profiles (id) on delete cascade,
  days_done integer not null default 0 check (days_done >= 0),
  last_pad_day date,
  reached smallint not null default 10 check (reached in (10, 5, 2)),
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now()
);

create table public.hop_rounds (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  seed bigint not null check (seed between 0 and 2147483647),
  step smallint not null check (step in (10, 5, 2)),
  gold boolean not null,
  hops jsonb not null check (jsonb_typeof(hops) = 'array' and jsonb_array_length(hops) = 10),
  open boolean not null default true,
  taps jsonb check (taps is null or jsonb_typeof(taps) = 'array'),
  mistakes integer check (mistakes >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create unique index hop_rounds_seed on public.hop_rounds (player, seed);
create index hop_rounds_by_player on public.hop_rounds (player, started_at);

alter table public.hop_progress enable row level security;
alter table public.hop_rounds enable row level security;
revoke all on public.hop_progress, public.hop_rounds from anon, authenticated;

-- The steps in order, so the furthest step reached can only go on: 10s, then 5s, then 2s.
create function public.hop_step_rank(step integer)
returns integer
language sql
immutable
set search_path = ''
as $$ select array_position(array[10, 5, 2], step) $$;

-- ---------------------------------------------------------------------------
-- The server function's jobs (service role only)
-- ---------------------------------------------------------------------------

-- The pupil's pond and its version, or null if they've never played.
create function public.hop_load(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  return (select jsonb_build_object('daysDone', h.days_done, 'lastPadDay', to_char(h.last_pad_day, 'YYYY-MM-DD'),
                                    'reached', h.reached, 'version', h.version)
          from public.hop_progress h where h.player = hop_load.player);
end;
$$;

-- Keeps a new challenge (making the pupil's pond on their first go) and closes any other open one. False if the pupil
-- has used this seed before.
create function public.hop_start(player uuid, seed bigint, step smallint, gold boolean, hops jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if exists (select 1 from public.hop_rounds r where r.player = hop_start.player and r.seed = hop_start.seed) then
    return false;
  end if;
  insert into public.hop_progress (player) values (player) on conflict on constraint hop_progress_pkey do nothing;
  update public.hop_rounds r set open = false where r.player = hop_start.player and r.open;
  delete from public.hop_rounds r
  where r.player = hop_start.player and not r.open and r.started_at < now() - interval '30 days';
  insert into public.hop_rounds (player, seed, step, gold, hops) values (player, seed, step, gold, hops);
  return true;
end;
$$;

-- One of the pupil's challenges by its seed: { open, round: { seed, step, gold, hops } }, or null if it isn't theirs.
create function public.hop_round(player uuid, seed bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('open', r.open,
                            'round', jsonb_build_object('seed', r.seed, 'step', r.step, 'gold', r.gold, 'hops', r.hops))
  from public.hop_rounds r where r.player = hop_round.player and r.seed = hop_round.seed
$$;

-- Finishes an open challenge with the server's replay of its taps and saves the progress, together. The count of
-- finished days only ever stays or goes up by one, and the furthest step reached never goes back. False if the challenge
-- had already finished or the version moved on.
create function public.hop_finish(
  player uuid, seed bigint, version integer, days_done integer, last_pad_day date, reached smallint, taps jsonb, mistakes integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(taps) is distinct from 'array' or mistakes is null or mistakes < 0 or days_done is null
     or reached is null or reached not in (10, 5, 2) then
    raise exception 'That challenge is not right.' using errcode = '22023';
  end if;
  perform 1 from public.hop_rounds r where r.player = hop_finish.player and r.seed = hop_finish.seed and r.open for update;
  if not found then
    return false;
  end if;
  update public.hop_progress h
  set days_done = hop_finish.days_done, last_pad_day = hop_finish.last_pad_day, reached = hop_finish.reached,
      version = h.version + 1, updated_at = now()
  where h.player = hop_finish.player and h.version = hop_finish.version
    and hop_finish.days_done between h.days_done and h.days_done + 1
    and public.hop_step_rank(hop_finish.reached) >= public.hop_step_rank(h.reached);
  if not found then
    return false;
  end if;
  update public.hop_rounds r set open = false, taps = hop_finish.taps, mistakes = hop_finish.mistakes, finished_at = now()
  where r.player = hop_finish.player and r.seed = hop_finish.seed;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- The switch and the step labels
-- ---------------------------------------------------------------------------

alter table public.app_settings add column hop_enabled boolean not null default true;
alter table public.app_settings add column hop_labels boolean not null default true;

-- Either setting, or both (a null one is left as it is).
create function public.teacher_set_hop(enabled boolean default null, labels boolean default null, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null and labels is null then
    raise exception 'Unknown Hop''s Glow-worm Pond setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings s
  set hop_enabled = coalesce(teacher_set_hop.enabled, s.hop_enabled),
      hop_labels = coalesce(teacher_set_hop.labels, s.hop_labels)
  where s.id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.hop_step_rank(integer), public.hop_load(uuid), public.hop_start(uuid, bigint, smallint, boolean, jsonb),
  public.hop_round(uuid, bigint), public.hop_finish(uuid, bigint, integer, integer, date, smallint, jsonb, integer),
  public.teacher_set_hop(boolean, boolean, uuid)
from public, anon, authenticated;
grant execute on function public.teacher_set_hop(boolean, boolean, uuid) to authenticated;
grant execute on function
  public.hop_step_rank(integer), public.hop_load(uuid), public.hop_start(uuid, bigint, smallint, boolean, jsonb),
  public.hop_round(uuid, bigint), public.hop_finish(uuid, bigint, integer, integer, date, smallint, jsonb, integer)
to service_role;
