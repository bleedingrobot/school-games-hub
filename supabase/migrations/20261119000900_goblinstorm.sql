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
-- 6. Stage 4: heroes unlocked in record_goblinstorm_run from the replay's summary, and my_goblinstorm() so the screens
--    can show the pupil's own gold, heroes and bosses.
-- 7. Stage 5:
--    - the gold shop: buy_goblinstorm(item), the pupil's own save only, gold and top level checked in one locked update;
--    - each run keeps the shop it started with (goblinstorm_runs.shop), so the replay uses what the browser played with;
--    - the Weapon Codex: weapons picked up (goblinstorm_saves.weapons) as well as weapons evolved (codex);
--    - hub points from record_goblinstorm_run: 5 a finished run, 5 more for a boss win, normal turns only;
--    - the achievements, the Goblin King's Crown trophy, the Game boards board (goblinstorm_board) and the teacher's
--      "Other games" column (teacher_progress_other_games, re-made from its newest body with one more block).
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
  -- Weapons evolved at least once, and weapons picked up at least once (the Weapon Codex: 8 + 8).
  codex text[] not null default '{}',
  weapons text[] not null default '{}',
  runs integer not null default 0 check (runs >= 0),
  kills integer not null default 0 check (kills >= 0),
  -- Has had the guided first go on Castle Fields (or skipped it), so it isn't guided again on another device.
  guide_seen boolean not null default false,
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
  -- The shop levels when the run started. The replay uses these, not the save's shop at finish time.
  shop jsonb not null default '{}' check (jsonb_typeof(shop) = 'object'),
  -- { "<slot>": { "value": n, "ms": n, "mark": "wrong" | "right" | "quick" } }, the first answer to each slot.
  answers jsonb not null default '{}' check (jsonb_typeof(answers) = 'object'),
  open boolean not null default true,
  steering text check (steering is null or length(steering) <= 200000),
  picks jsonb check (picks is null or jsonb_typeof(picks) = 'array'),
  outcome text check (outcome is null or outcome in ('won', 'survived', 'lost', 'quit')),
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

-- The pupil's save ({ gold, shop, heroes, bosses, kills }), or null if they've never finished a run.
create function public.goblinstorm_load(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  return (select jsonb_build_object('gold', s.gold, 'shop', s.shop, 'heroes', to_jsonb(s.heroes), 'bosses', to_jsonb(s.bosses), 'kills', s.kills)
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

-- Keeps a new run, its questions and the shop it starts with. False if the pupil has used this seed before.
create function public.goblinstorm_store_questions(player uuid, seed bigint, hero text, map integer, day date, extra boolean, questions jsonb, shop jsonb)
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
  if jsonb_typeof(shop) is distinct from 'object' then
    raise exception 'That shop is not right.' using errcode = '22023';
  end if;
  delete from public.goblinstorm_questions q where q.created_at < now() - interval '2 days';
  insert into public.goblinstorm_runs (player, seed, hero, map, day, extra, shop)
  values (player, seed, hero, map, day, coalesce(extra, false), shop)
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
    'answers', r.answers, 'shop', r.shop, 'startedAt', r.started_at, 'open', r.open, 'summary', r.summary)
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
--
-- Heroes are unlocked here from the replay's summary (never from anything the browser said), by the same rules as
-- `unlockMet` in shared/goblinstorm/server.ts and `UNLOCK_AT` in config.ts (change them together):
--   wizard     reach level 20 in one run          barbarian  5,000 monsters beaten in all runs
--   cleric     beat the Goblin King (map 0)       rogue      90 seconds without being hit
--   witch      beat the Ice Dragon (map 3)        dragonkid  evolve 3 different weapons in one run
--
-- Hub points (stage 5): 5 for a run played to the end (won, survived or fell; not one the pupil left) and 5 more for a
-- boss win, on normal turns only. An "Unlimited today" turn gives gold but no points. add_game_points keeps them inside
-- the shared 40-a-day cap, writes the scored_games row and checks achievements; the run's seed makes it count once. With
-- no points, game_progress_changed checks the achievements. Neither can lose the save: an error is only a warning.
create function public.record_goblinstorm_run(player uuid, seed bigint, steering text, picks jsonb, summary jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  map_index smallint;
  extra_turn boolean;
  -- The 8 weapons (config.ts WEAPON_IDS): anything else in a summary is left out of the codex.
  known text[] := array['blades', 'fireball', 'lightning', 'aura', 'nova', 'axes', 'arrows', 'bubble'];
  evolved text[] := array(select distinct w from jsonb_array_elements_text(coalesce(summary -> 'evolved', '[]'::jsonb)) w
                          where w = any (known));
  held text[] := array(select distinct w from jsonb_array_elements_text(coalesce(summary -> 'weapons', '[]'::jsonb)) w
                       where w = any (known));
  boss boolean := coalesce((summary ->> 'bossBeaten')::boolean, false);
  run_outcome text := summary ->> 'outcome';
  run_gold integer := greatest(0, coalesce((summary ->> 'gold')::integer, 0));
  run_kills integer := greatest(0, coalesce((summary ->> 'kills')::integer, 0));
  run_level integer := coalesce((summary ->> 'level')::integer, 1);
  no_hit integer := coalesce((summary ->> 'longestNoHitSeconds')::integer, 0);
  kills_before integer;
  earned text[] := '{}';
  points integer;
begin
  if jsonb_typeof(record_goblinstorm_run.summary) is distinct from 'object' or jsonb_typeof(record_goblinstorm_run.picks) is distinct from 'array' then
    raise exception 'That run is not right.' using errcode = '22023';
  end if;
  update public.goblinstorm_runs r
  set open = false, steering = record_goblinstorm_run.steering, picks = record_goblinstorm_run.picks,
      outcome = run_outcome, seconds = (record_goblinstorm_run.summary ->> 'seconds')::integer,
      level = run_level,
      kills = run_kills, gold = run_gold, boss_beaten = boss, evolutions = evolved,
      summary = record_goblinstorm_run.summary, finished_at = now()
  where r.player = record_goblinstorm_run.player and r.seed = record_goblinstorm_run.seed and r.open
  returning r.map, r.extra into map_index, extra_turn;
  if not found then
    return false;
  end if;
  select s.kills into kills_before from public.goblinstorm_saves s where s.player = record_goblinstorm_run.player for update;
  kills_before := coalesce(kills_before, 0);
  if run_level >= 20 then earned := earned || 'wizard'::text; end if;
  if kills_before + run_kills >= 5000 then earned := earned || 'barbarian'::text; end if;
  if boss and map_index = 0 then earned := earned || 'cleric'::text; end if;
  if no_hit >= 90 then earned := earned || 'rogue'::text; end if;
  if boss and map_index = 3 then earned := earned || 'witch'::text; end if;
  if cardinality(evolved) >= 3 then earned := earned || 'dragonkid'::text; end if;
  insert into public.goblinstorm_saves as s (player, gold, heroes, bosses, codex, weapons, runs, kills)
  values (player, run_gold, earned, case when boss then array[map_index] else '{}' end, evolved, held, 1, run_kills)
  on conflict on constraint goblinstorm_saves_pkey do update
  set gold = s.gold + excluded.gold,
      heroes = s.heroes || array(select h from unnest(excluded.heroes) h where not (h = any (s.heroes))),
      bosses = case when boss and not (map_index = any (s.bosses)) then s.bosses || map_index else s.bosses end,
      codex = array(select distinct unnest(s.codex || excluded.codex) order by 1),
      weapons = array(select distinct unnest(s.weapons || excluded.weapons) order by 1),
      runs = s.runs + 1,
      kills = s.kills + excluded.kills,
      updated_at = now();
  points := case when run_outcome in ('won', 'survived', 'lost') and not extra_turn then 5 + case when boss then 5 else 0 end else 0 end;
  begin
    if points > 0 then
      perform public.add_game_points(player, 'goblinstorm', points, seed::text);
    else
      perform public.game_progress_changed(player, 'goblinstorm');
    end if;
  exception when others then
    raise warning 'Goblin Storm points failed (%)', sqlstate;
  end;
  return true;
end;
$$;

-- The signed-in pupil's own save, for the screens: gold, shop, heroes unlocked, bosses beaten, the codex (weapons
-- evolved and picked up), totals, the best gold from one run and runs started today (NZ date). Only ever the caller's own row; a pupil who has never played gets an empty save.
create function public.my_goblinstorm()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'gold', coalesce(s.gold, 0), 'shop', coalesce(s.shop, '{}'::jsonb), 'heroes', to_jsonb(coalesce(s.heroes, '{}')),
    'bosses', to_jsonb(coalesce(s.bosses, '{}')), 'codex', to_jsonb(coalesce(s.codex, '{}')),
    'weapons', to_jsonb(coalesce(s.weapons, '{}')),
    'runs', coalesce(s.runs, 0), 'kills', coalesce(s.kills, 0), 'guideSeen', coalesce(s.guide_seen, false),
    'bestGold', coalesce((select max(r.gold) from public.goblinstorm_runs r where r.player = me.player), 0),
    'today', (select count(*)::integer from public.goblinstorm_runs r
              where r.player = auth.uid() and r.day = (now() at time zone 'Pacific/Auckland')::date))
  from (select auth.uid() as player) me
  left join public.goblinstorm_saves s on s.player = me.player
  where me.player is not null
$$;

-- Notes that the signed-in pupil has had the guided first go (stage 6). It can only ever set the caller's own flag to
-- true, so it changes nothing that counts; a pupil with no save yet gets one with nothing else in it.
create function public.goblinstorm_guide_seen()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Please sign in again.' using errcode = '42501';
  end if;
  perform public.gem_keep_check_player(me);
  insert into public.goblinstorm_saves (player, guide_seen) values (me, true)
  on conflict (player) do update set guide_seen = true, updated_at = now()
  where not public.goblinstorm_saves.guide_seen;
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
-- The gold shop (stage 5)
-- ---------------------------------------------------------------------------

-- Buys the next level of one forever-upgrade for the signed-in pupil: { bought, reason, gold, shop }. A database function
-- rather than an action on the server function, because buying needs nothing the function has (no replay, no maths):
-- one locked update checks the gold and the top level and takes the gold together, so two taps or two tabs can't
-- overspend. The prices and tops are shared/goblinstorm/shop.ts and config.ts SHOP_COSTS (change them together):
-- 100, 200, 350, 550, 800 gold for levels 1 to 5; Armour stops at 3. reason is 'gold' (not enough), 'top' (already at
-- the top) or 'none' (no save yet: finish a run first). A run already going keeps the shop it started with.
create function public.buy_goblinstorm(item text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  costs integer[] := array[100, 200, 350, 550, 800];
  top integer := case when item = 'armour' then 3 else 5 end;
  done jsonb;
  have public.goblinstorm_saves;
begin
  if me is null then
    raise exception 'Please sign in again.' using errcode = '42501';
  end if;
  perform public.gem_keep_check_player(me);
  if item is null or item not in ('might', 'armour', 'speed', 'health', 'magnet', 'gold') then
    raise exception 'Unknown Goblin Storm upgrade' using errcode = '22023';
  end if;
  update public.goblinstorm_saves s
  set gold = s.gold - costs[coalesce((s.shop ->> item)::integer, 0) + 1],
      shop = s.shop || jsonb_build_object(item, coalesce((s.shop ->> item)::integer, 0) + 1),
      updated_at = now()
  where s.player = me
    and coalesce((s.shop ->> item)::integer, 0) < top
    and s.gold >= costs[coalesce((s.shop ->> item)::integer, 0) + 1]
  returning jsonb_build_object('bought', true, 'reason', null, 'gold', s.gold, 'shop', s.shop) into done;
  if done is not null then
    return done;
  end if;
  select * into have from public.goblinstorm_saves s where s.player = me;
  if not found then
    return jsonb_build_object('bought', false, 'reason', 'none', 'gold', 0, 'shop', '{}'::jsonb);
  end if;
  return jsonb_build_object('bought', false,
    'reason', case when coalesce((have.shop ->> item)::integer, 0) >= top then 'top' else 'gold' end,
    'gold', have.gold, 'shop', have.shop);
end;
$$;

-- ---------------------------------------------------------------------------
-- The hooks: points, achievements, the trophy (stage 5)
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

-- Runs played to the end (not ones left early), different weapons evolved, bosses beaten, and heroes open (the two
-- free ones count).
create function public.goblinstorm_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'goblinstorm_runs', (select count(*) from public.goblinstorm_runs r
                         where r.player = who and r.outcome in ('won', 'survived', 'lost')),
    'goblinstorm_evolutions', coalesce((select cardinality(s.codex) from public.goblinstorm_saves s where s.player = who), 0),
    'goblinstorm_bosses', coalesce((select cardinality(s.bosses) from public.goblinstorm_saves s where s.player = who), 0),
    'goblinstorm_heroes', 2 + coalesce((select cardinality(s.heroes) from public.goblinstorm_saves s where s.player = who), 0))
$$;

-- The lines on How points work.
create function public.goblinstorm_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'Play a run to the end: 5 points.',
    'Beat the boss: 5 more.',
    'Your 5 runs a day earn points. Extra runs on an Unlimited day earn gold only.'))
$$;

create function public.goblinstorm_players_list()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select s.player from public.goblinstorm_saves s
$$;

insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn, keep_achievements)
values ('goblinstorm', 'goblinstorm_enabled', 'public.goblinstorm_counts(uuid)', 'public.goblinstorm_point_rules()',
  'public.goblinstorm_players_list()', null, 'public.goblinstorm_last_played(uuid)', true);

insert into public.achievement_measures (measure)
values ('goblinstorm_runs'), ('goblinstorm_evolutions'), ('goblinstorm_bosses'), ('goblinstorm_heroes');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort, how, tier) values
  ('goblinstorm-first', 'goblinstorm', 'First Storm', '🌪️', 'goblinstorm_runs', 1, 1, 'Finish a Goblin Storm run.', 1),
  ('goblinstorm-evolve', 'goblinstorm', 'It Evolves!', '✨', 'goblinstorm_evolutions', 1, 2, 'Evolve a weapon in Goblin Storm.', 2),
  ('goblinstorm-king', 'goblinstorm', 'King Slayer', '👑', 'goblinstorm_bosses', 1, 3, 'Beat the Goblin King.', 2),
  ('goblinstorm-heroes', 'goblinstorm', 'Hero Collector', '🦸', 'goblinstorm_heroes', 8, 4, 'Unlock all 8 Goblin Storm heroes.', 3),
  ('goblinstorm-master', 'goblinstorm', 'Storm Master', '⚡', 'goblinstorm_bosses', 5, 5, 'Beat all 5 Goblin Storm bosses.', 3);

-- The Goblin King's Crown: beating the Goblin King (map 0's boss) the first time. Never for maths. Given by a watcher on
-- the save, as in 20261112001700_trophies_games_1.sql: only when the feat comes true in that save, and an error can
-- never lose the save. No back-award: nobody has played before this migration goes live.
insert into public.trophy_types (id, game, name, how, kind, repeat, art, sort) values
  ('goblinstorm-crown', 'goblinstorm', 'Goblin King''s Crown', 'Beat the Goblin King in Goblin Storm.', 'trophy', 'once', null, 350);

create function public.goblinstorm_save_trophies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if 0 = any (new.bosses) and (tg_op = 'INSERT' or not (0 = any (old.bosses))) then
    perform public.award_trophy(new.player, 'goblinstorm-crown', '{}'::jsonb);
  end if;
  return null;
exception when others then
  raise warning 'a Goblin Storm trophy failed (%)', sqlstate;
  return null;
end;
$$;

create trigger trophies_when_saved
after insert or update of bosses on public.goblinstorm_saves
for each row
execute function public.goblinstorm_save_trophies();

-- ---------------------------------------------------------------------------
-- The Game boards board and the teacher's column (stage 5)
-- ---------------------------------------------------------------------------

-- Goblin Storm's own board on the 🎮 Game boards tab: own school, pupils only, hidden profiles left out (board_pupils).
-- Bosses beaten, then the most monsters beaten in one run. Never maths.
-- [{ place, name, avatar, bosses, best, is_me }], the top 10 and the caller.
create function public.goblinstorm_board(scope text default 'school')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_school_user();
  return coalesce((
    with pupils as (select * from public.board_pupils(scope)),
    placed as (
      select p.id, p.display_name, p.avatar, coalesce(cardinality(s.bosses), 0) as bosses,
             coalesce((select max(r.kills) from public.goblinstorm_runs r where r.player = p.id and not r.open), 0) as best
      from pupils p join public.goblinstorm_saves s on s.player = p.id),
    ranked as (
      select r.*, rank() over (order by r.bosses desc, r.best desc)::integer as place,
             row_number() over (order by r.bosses desc, r.best desc, r.display_name)::integer as n
      from placed r where r.bosses > 0 or r.best > 0)
    select jsonb_agg(jsonb_build_object('place', r.place, 'name', r.display_name, 'avatar', r.avatar, 'bosses', r.bosses,
                                        'best', r.best, 'is_me', r.id = auth.uid()) order by r.n)
    from ranked r where r.n <= 10 or r.id = auth.uid()), '[]'::jsonb);
end;
$$;

-- The Progress tab's "Other games": the newest body (20261114000300_glyph_teacher.sql) with Goblin Storm's block added:
-- bosses beaten (0 to 5), and the last run started. If another migration changes this function before this one goes
-- live, copy its body here again at go-live (stage 7).
create or replace function public.teacher_progress_other_games(target_class uuid)
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
    rows as (
      select g.player as student, 'gem-keep' as game,
             coalesce(max(g.level_number) filter (where g.result = 'won'), 0) as value, max(g.finished_at) as at
        from public.gem_keep_runs g join students s on s.id = g.player group by g.player
      union all
      select d.player, 'diamond', coalesce((d.state ->> 'deepest')::integer, 0), d.updated_at
        from public.diamond_players d join students s on s.id = d.player
      union all
      select h.player, 'dragon-maths', coalesce((h.hero ->> 'level')::integer, 0), h.saved_at
        from public.lord_heroes h join students s on s.id = h.player
      union all
      select b.player, 'bond-match', sum(b.best_stars)::integer, max(b.updated_at)
        from public.bond_match_bests b join students s on s.id = b.player group by b.player
      union all
      select t.player, 'toonflap',
             (select count(*) from jsonb_each(t.progress -> 'levels') l(id, rec) where (l.rec ->> 'finishes')::int > 0)::integer, t.updated_at
        from public.toonflap_progress t join students s on s.id = t.player
      union all
      select o.player, 'orderup', o.passed, o.updated_at
        from public.orderup_progress o join students s on s.id = o.player
      union all
      select p.player, 'glyph', coalesce((p.progress ->> 'passed')::integer, 0),
             (select max(g.started_at) from public.glyph_goes g where g.player = p.player)
        from public.glyph_progress p join students s on s.id = p.player
      union all
      select gs.player, 'goblinstorm', cardinality(gs.bosses),
             (select max(r.started_at) from public.goblinstorm_runs r where r.player = gs.player)
        from public.goblinstorm_saves gs join students s on s.id = gs.player
    )
    select coalesce(jsonb_agg(jsonb_build_object('student', r.student, 'game', r.game, 'value', r.value, 'at', r.at)
                              order by r.game, r.student), '[]'::jsonb)
    from rows r
  );
end;
$$;
revoke execute on function public.teacher_progress_other_games(uuid) from public, anon, authenticated;
grant execute on function public.teacher_progress_other_games(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Unlimited today: Goblin Storm joins the games the teacher can lift (newest body: 20261105000200_unlimited_turns.sql).
-- create or replace keeps its grants.
-- ---------------------------------------------------------------------------

create or replace function public.teacher_set_unlimited_today(game text, enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null or game is null or game not in ('dragon-maths', 'clan-quest', 'monsters', 'diamond', 'trader', 'isles', 'goblinstorm') then
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
  public.goblinstorm_load(uuid), public.goblinstorm_runs_on(uuid, date),
  public.goblinstorm_store_questions(uuid, bigint, text, integer, date, boolean, jsonb, jsonb),
  public.goblinstorm_load_questions(uuid, bigint),
  public.goblinstorm_claim_answer(uuid, bigint, integer, numeric, integer, text),
  public.record_goblinstorm_run(uuid, bigint, text, jsonb, jsonb),
  public.teacher_set_goblinstorm(boolean, uuid),
  public.goblinstorm_last_played(uuid),
  public.my_goblinstorm(),
  public.goblinstorm_guide_seen(),
  public.buy_goblinstorm(text),
  public.goblinstorm_counts(uuid), public.goblinstorm_point_rules(), public.goblinstorm_players_list(),
  public.goblinstorm_save_trophies(),
  public.goblinstorm_board(text)
from public, anon, authenticated;
grant execute on function
  public.teacher_set_goblinstorm(boolean, uuid), public.my_goblinstorm(), public.goblinstorm_guide_seen(),
  public.buy_goblinstorm(text), public.goblinstorm_board(text)
to authenticated;
grant execute on function
  public.goblinstorm_load(uuid), public.goblinstorm_runs_on(uuid, date),
  public.goblinstorm_store_questions(uuid, bigint, text, integer, date, boolean, jsonb, jsonb),
  public.goblinstorm_load_questions(uuid, bigint),
  public.goblinstorm_claim_answer(uuid, bigint, integer, numeric, integer, text),
  public.record_goblinstorm_run(uuid, bigint, text, jsonb, jsonb)
to service_role;
