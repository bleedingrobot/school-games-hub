-- Goblin Storm: the server side, stage 3 (docs/GOBLINSTORM-PLAN.md, "Server, data and cost").
--
-- ON HOLD (supabase/migrations-on-hold.txt) until the go-live PR. Goblin Storm is its own thing: three tables and its
-- own functions, so no other game reads or changes them. Nothing shared is re-created.
--
-- 1. goblinstorm_saves: one row a pupil. Gold, shop levels, heroes unlocked, bosses beaten, the Weapon Codex and totals.
--    Saved only by the `goblinstorm` server function, from what its replay said.
-- 2. goblinstorm_runs: one row a run started (finished or not: both count towards the 5 a day, by NZ date). Hero, map,
--    each level-up answer (value, ms, mark: the first answer counts), and once finished the steering, picks and what
--    the replay said. A seed is used once per pupil, so a run sent twice counts once.
-- 3. goblinstorm_questions: the level-up questions the server made for a run, with their answers. No policy and no
--    grant: pupils can never read them. Rows over 2 days old go.
-- 4. The switch (app_settings.goblinstorm_enabled, ON for every class to start; the code switch holds the game back)
--    and teacher_set_goblinstorm().
-- 5. The hub_games row (the switch and "last played"). Points, achievements and the trophy come in stage 5.
--
-- Depends on 20261017001100_gem_keep.sql (gem_keep_check_player) and 20261020000100_game_hooks.sql.

create table public.goblinstorm_saves (
  player uuid primary key references public.profiles (id) on delete cascade,
  gold integer not null default 0 check (gold >= 0),
  shop jsonb not null default '{}' check (jsonb_typeof(shop) = 'object'),
  -- Heroes unlocked beyond the two free ones.
  heroes text[] not null default '{}',
  -- Map indexes (0 to 4) whose boss has been beaten.
  bosses smallint[] not null default '{}',
  -- Weapons evolved at least once (the Weapon Codex).
  codex text[] not null default '{}',
  runs integer not null default 0 check (runs >= 0),
  kills integer not null default 0 check (kills >= 0),
  updated_at timestamptz not null default now()
);

create table public.goblinstorm_runs (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  seed bigint not null check (seed between 0 and 4294967295),
  hero text not null check (hero in ('knight', 'ranger', 'wizard', 'barbarian', 'cleric', 'rogue', 'witch', 'dragonkid')),
  map smallint not null check (map between 0 and 4),
  -- The NZ date the run counts against, and whether it was past the normal 5 (an "Unlimited today" turn).
  day date not null,
  extra boolean not null default false,
  -- { "<slot>": { "value": n, "ms": n, "mark": "wrong" | "right" | "quick" } }, the first answer to each slot.
  answers jsonb not null default '{}' check (jsonb_typeof(answers) = 'object'),
  open boolean not null default true,
  steering text check (steering is null or length(steering) <= 200000),
  picks jsonb check (picks is null or jsonb_typeof(picks) = 'array'),
  outcome text check (outcome is null or outcome in ('won', 'survived', 'fell', 'quit')),
  seconds integer check (seconds >= 0),
  level integer check (level >= 1),
  kills integer check (kills >= 0),
  gold integer check (gold >= 0),
  boss_beaten boolean,
  evolutions text[],
  -- The whole replay summary, as shared/goblinstorm/engine.ts `RunSummary` gives it.
  summary jsonb check (summary is null or jsonb_typeof(summary) = 'object'),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create unique index goblinstorm_runs_seed on public.goblinstorm_runs (player, seed);
create index goblinstorm_runs_by_day on public.goblinstorm_runs (player, day);

create table public.goblinstorm_questions (
  player uuid not null references public.profiles (id) on delete cascade,
  seed bigint not null check (seed between 0 and 4294967295),
  questions jsonb not null check (jsonb_typeof(questions) = 'array'),
  created_at timestamptz not null default now(),
  primary key (player, seed)
);
create index goblinstorm_questions_by_age on public.goblinstorm_questions (created_at);

alter table public.goblinstorm_saves enable row level security;
alter table public.goblinstorm_runs enable row level security;
alter table public.goblinstorm_questions enable row level security;
revoke all on public.goblinstorm_saves, public.goblinstorm_runs, public.goblinstorm_questions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The server function's jobs (service role only)
-- ---------------------------------------------------------------------------

-- The pupil's save ({ gold, shop, heroes, bosses }), or null if they've never finished a run.
create function public.goblinstorm_load(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  return (select jsonb_build_object('gold', s.gold, 'shop', s.shop, 'heroes', to_jsonb(s.heroes), 'bosses', to_jsonb(s.bosses))
          from public.goblinstorm_saves s where s.player = goblinstorm_load.player);
end;
$$;

-- Runs started on this NZ date, finished or not.
create function public.goblinstorm_runs_on(player uuid, day date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.goblinstorm_runs r where r.player = goblinstorm_runs_on.player and r.day = goblinstorm_runs_on.day
$$;

-- Keeps a new run and its questions. False if the pupil has used this seed before.
create function public.goblinstorm_store_questions(player uuid, seed bigint, hero text, map integer, day date, extra boolean, questions jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if jsonb_typeof(questions) is distinct from 'array' then
    raise exception 'That question list is not right.' using errcode = '22023';
  end if;
  if jsonb_array_length(questions) > 40 then
    raise exception 'That question list is not right.' using errcode = '22023';
  end if;
  delete from public.goblinstorm_questions q where q.created_at < now() - interval '2 days';
  insert into public.goblinstorm_runs (player, seed, hero, map, day, extra)
  values (player, seed, hero, map, day, coalesce(extra, false))
  on conflict do nothing;
  if not found then
    return false;
  end if;
  insert into public.goblinstorm_questions (player, seed, questions) values (player, seed, questions);
  return true;
end;
$$;

-- One of the pupil's runs: { seed, hero, map, questions, answers, startedAt, open, summary }, or null if it isn't theirs.
create function public.goblinstorm_load_questions(player uuid, seed bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'seed', r.seed, 'hero', r.hero, 'map', r.map,
    'questions', coalesce((select q.questions from public.goblinstorm_questions q where q.player = r.player and q.seed = r.seed), '[]'::jsonb),
    'answers', r.answers, 'startedAt', r.started_at, 'open', r.open, 'summary', r.summary)
  from public.goblinstorm_runs r
  where r.player = goblinstorm_load_questions.player and r.seed = goblinstorm_load_questions.seed
$$;

-- Marks a slot of an open run, once. False if it was answered already or the run has ended.
create function public.goblinstorm_claim_answer(player uuid, seed bigint, slot integer, value numeric, ms integer, mark text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if slot is null or slot not between 0 and 39 or ms is null or ms < 0 or mark is null or mark not in ('wrong', 'right', 'quick') then
    raise exception 'That answer is not right.' using errcode = '22023';
  end if;
  update public.goblinstorm_runs r
  set answers = r.answers || jsonb_build_object(slot::text, jsonb_build_object('value', value, 'ms', ms, 'mark', mark))
  where r.player = goblinstorm_claim_answer.player and r.seed = goblinstorm_claim_answer.seed and r.open
    and not (r.answers ? slot::text);
  return found;
end;
$$;

-- Closes an open run with what the server's replay said and adds it to the save, together. False if it was already
-- closed (a finish sent twice counts once).
create function public.record_goblinstorm_run(player uuid, seed bigint, steering text, picks jsonb, summary jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  map_index smallint;
  evolved text[] := array(select jsonb_array_elements_text(coalesce(summary -> 'evolved', '[]'::jsonb)));
  boss boolean := coalesce((summary ->> 'bossBeaten')::boolean, false);
  run_gold integer := greatest(0, coalesce((summary ->> 'gold')::integer, 0));
  run_kills integer := greatest(0, coalesce((summary ->> 'kills')::integer, 0));
begin
  if jsonb_typeof(record_goblinstorm_run.summary) is distinct from 'object' or jsonb_typeof(record_goblinstorm_run.picks) is distinct from 'array' then
    raise exception 'That run is not right.' using errcode = '22023';
  end if;
  update public.goblinstorm_runs r
  set open = false, steering = record_goblinstorm_run.steering, picks = record_goblinstorm_run.picks,
      outcome = record_goblinstorm_run.summary ->> 'outcome', seconds = (record_goblinstorm_run.summary ->> 'seconds')::integer,
      level = (record_goblinstorm_run.summary ->> 'level')::integer,
      kills = run_kills, gold = run_gold, boss_beaten = boss, evolutions = evolved,
      summary = record_goblinstorm_run.summary, finished_at = now()
  where r.player = record_goblinstorm_run.player and r.seed = record_goblinstorm_run.seed and r.open
  returning r.map into map_index;
  if not found then
    return false;
  end if;
  insert into public.goblinstorm_saves as s (player, gold, bosses, codex, runs, kills)
  values (player, run_gold, case when boss then array[map_index] else '{}' end, evolved, 1, run_kills)
  on conflict on constraint goblinstorm_saves_pkey do update
  set gold = s.gold + excluded.gold,
      bosses = case when boss and not (map_index = any (s.bosses)) then s.bosses || map_index else s.bosses end,
      codex = array(select distinct unnest(s.codex || excluded.codex) order by 1),
      runs = s.runs + 1,
      kills = s.kills + excluded.kills,
      updated_at = now();
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- The switch
-- ---------------------------------------------------------------------------

-- A new game's switch starts on for every class (James, 11 Nov 2026); the code switch holds it back until go-live.
alter table public.app_settings add column goblinstorm_enabled boolean not null default true;

create function public.teacher_set_goblinstorm(enabled boolean default null, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null then
    raise exception 'Unknown Goblin Storm setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings s set goblinstorm_enabled = teacher_set_goblinstorm.enabled
  where s.id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- The hooks (points, achievements and the trophy come in stage 5)
-- ---------------------------------------------------------------------------

create function public.goblinstorm_last_played(player uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(r.started_at) from public.goblinstorm_runs r where r.player = goblinstorm_last_played.player
$$;

insert into public.hub_games (id, switch_column, last_played_fn, keep_achievements)
values ('goblinstorm', 'goblinstorm_enabled', 'public.goblinstorm_last_played(uuid)', true);

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.goblinstorm_load(uuid), public.goblinstorm_runs_on(uuid, date),
  public.goblinstorm_store_questions(uuid, bigint, text, integer, date, boolean, jsonb),
  public.goblinstorm_load_questions(uuid, bigint),
  public.goblinstorm_claim_answer(uuid, bigint, integer, numeric, integer, text),
  public.record_goblinstorm_run(uuid, bigint, text, jsonb, jsonb),
  public.teacher_set_goblinstorm(boolean, uuid),
  public.goblinstorm_last_played(uuid)
from public, anon, authenticated;
grant execute on function public.teacher_set_goblinstorm(boolean, uuid) to authenticated;
grant execute on function
  public.goblinstorm_load(uuid), public.goblinstorm_runs_on(uuid, date),
  public.goblinstorm_store_questions(uuid, bigint, text, integer, date, boolean, jsonb),
  public.goblinstorm_load_questions(uuid, bigint),
  public.goblinstorm_claim_answer(uuid, bigint, integer, numeric, integer, text),
  public.record_goblinstorm_run(uuid, bigint, text, jsonb, jsonb)
to service_role;
