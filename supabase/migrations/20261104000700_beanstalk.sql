-- Kiwi's Beanstalk: the server side (docs/BEANSTALK-PLAN.md, section 5).
--
-- Kiwi's Beanstalk is its own thing: two tables and its own functions, so no other game reads or changes them. Its
-- achievement, the teacher's "last played" and the hub_games hooks come in Stage 4's own migration; nothing shared is
-- re-created.
--
-- 1. beanstalk_progress: one row a pupil. Jack or Jill, the count of finished days (everything else, the leaves' colours,
--    the eggs and the friend, is worked out from it by shared/beanstalk/progress.ts) and the NZ day a leaf last changed.
--    Saved only by the `beanstalk` server function, and only if its version still matches.
-- 2. beanstalk_rounds: one row a challenge started. Its seed (the leaves come from it: shared/beanstalk/round.ts), and
--    once it has finished the taps and how many pairs were wrong. A seed is used once per pupil and a challenge finishes
--    once. Finished challenges over 30 days old go.
-- 3. The switch (app_settings.beanstalk_enabled, per class, OFF to start), the dots setting (app_settings.beanstalk_dots,
--    on to start) and teacher_set_beanstalk().
--
-- Pupils can't read or change any of it directly; the server function does everything.
-- Depends on 20261017001100_gem_keep.sql (gem_keep_check_player) and 20261018002400_classes_and_warp.sql (settings).

create table public.beanstalk_progress (
  player uuid primary key references public.profiles (id) on delete cascade,
  child text check (child in ('jack', 'jill')),
  days_done integer not null default 0 check (days_done >= 0),
  last_leaf_day date,
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now()
);

create table public.beanstalk_rounds (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  seed bigint not null check (seed between 0 and 2147483647),
  open boolean not null default true,
  taps jsonb check (taps is null or jsonb_typeof(taps) = 'array'),
  mistakes integer check (mistakes >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create unique index beanstalk_rounds_seed on public.beanstalk_rounds (player, seed);
create index beanstalk_rounds_by_player on public.beanstalk_rounds (player, started_at);

alter table public.beanstalk_progress enable row level security;
alter table public.beanstalk_rounds enable row level security;
revoke all on public.beanstalk_progress, public.beanstalk_rounds from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The server function's jobs (service role only)
-- ---------------------------------------------------------------------------

-- The pupil's beanstalk and its version, or null if they've never played.
create function public.beanstalk_load(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  return (select jsonb_build_object('child', b.child, 'daysDone', b.days_done,
                                    'lastLeafDay', to_char(b.last_leaf_day, 'YYYY-MM-DD'), 'version', b.version)
          from public.beanstalk_progress b where b.player = beanstalk_load.player);
end;
$$;

-- Jack or Jill, making the pupil's beanstalk on their first go.
create function public.beanstalk_choose(player uuid, child text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if child is null or child not in ('jack', 'jill') then
    raise exception 'That isn''t Jack or Jill.' using errcode = '22023';
  end if;
  insert into public.beanstalk_progress as b (player, child) values (player, child)
  on conflict on constraint beanstalk_progress_pkey
  do update set child = excluded.child, version = b.version + 1, updated_at = now();
  return true;
end;
$$;

-- Keeps a new challenge and closes any other open one. False if the pupil has used this seed before.
create function public.beanstalk_start(player uuid, seed bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if exists (select 1 from public.beanstalk_rounds r where r.player = beanstalk_start.player and r.seed = beanstalk_start.seed) then
    return false;
  end if;
  update public.beanstalk_rounds r set open = false where r.player = beanstalk_start.player and r.open;
  delete from public.beanstalk_rounds r
  where r.player = beanstalk_start.player and not r.open and r.started_at < now() - interval '30 days';
  insert into public.beanstalk_rounds (player, seed) values (player, seed);
  return true;
end;
$$;

-- One of the pupil's challenges by its seed: { open }, or null if it isn't theirs.
create function public.beanstalk_round(player uuid, seed bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('open', r.open)
  from public.beanstalk_rounds r where r.player = beanstalk_round.player and r.seed = beanstalk_round.seed
$$;

-- Finishes an open challenge with the server's replay of its taps and saves the progress, together. The count of
-- finished days only ever stays or goes up by one. False if the challenge had already finished or the version moved on.
create function public.beanstalk_finish(
  player uuid, seed bigint, version integer, days_done integer, last_leaf_day date, taps jsonb, mistakes integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(taps) is distinct from 'array' or mistakes is null or mistakes < 0 or days_done is null then
    raise exception 'That challenge is not right.' using errcode = '22023';
  end if;
  perform 1 from public.beanstalk_rounds r where r.player = beanstalk_finish.player and r.seed = beanstalk_finish.seed and r.open for update;
  if not found then
    return false;
  end if;
  update public.beanstalk_progress b
  set days_done = beanstalk_finish.days_done, last_leaf_day = beanstalk_finish.last_leaf_day, version = b.version + 1, updated_at = now()
  where b.player = beanstalk_finish.player and b.version = beanstalk_finish.version
    and beanstalk_finish.days_done between b.days_done and b.days_done + 1;
  if not found then
    return false;
  end if;
  update public.beanstalk_rounds r set open = false, taps = beanstalk_finish.taps, mistakes = beanstalk_finish.mistakes, finished_at = now()
  where r.player = beanstalk_finish.player and r.seed = beanstalk_finish.seed;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- The switch and the dots
-- ---------------------------------------------------------------------------

alter table public.app_settings add column beanstalk_enabled boolean not null default false;
alter table public.app_settings add column beanstalk_dots boolean not null default true;

-- Either setting, or both (a null one is left as it is).
create function public.teacher_set_beanstalk(enabled boolean default null, dots boolean default null, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null and dots is null then
    raise exception 'Unknown Kiwi''s Beanstalk setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings s
  set beanstalk_enabled = coalesce(teacher_set_beanstalk.enabled, s.beanstalk_enabled),
      beanstalk_dots = coalesce(teacher_set_beanstalk.dots, s.beanstalk_dots)
  where s.id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.beanstalk_load(uuid), public.beanstalk_choose(uuid, text), public.beanstalk_start(uuid, bigint),
  public.beanstalk_round(uuid, bigint), public.beanstalk_finish(uuid, bigint, integer, integer, date, jsonb, integer),
  public.teacher_set_beanstalk(boolean, boolean, uuid)
from public, anon, authenticated;
grant execute on function public.teacher_set_beanstalk(boolean, boolean, uuid) to authenticated;
grant execute on function
  public.beanstalk_load(uuid), public.beanstalk_choose(uuid, text), public.beanstalk_start(uuid, bigint),
  public.beanstalk_round(uuid, bigint), public.beanstalk_finish(uuid, bigint, integer, integer, date, jsonb, integer)
to service_role;
