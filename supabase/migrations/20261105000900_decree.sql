-- Royal Decree: the server side (docs/DECREE-PLAN.md, section 5).
--
-- Royal Decree is its own thing: one table and its own functions, so no other game reads or changes a reign. Points, the
-- teacher's switch, How points work, achievements and the teacher's "last played" all go through the hub_games hooks;
-- nothing shared is re-created.
--
-- 1. decree_reigns: one row a reign. The reign as it is now (the rules are shared/decree/engine.ts), every move saved so
--    far, the ruler's look, and the riddles (questions, which pupils can never read: no policy, no grant) with the
--    answers marked so far.
-- 2. Server-only functions: load, start, answer (a riddle is marked once) and save (a save is kept once).
-- 3. The switch: app_settings.decree_enabled, per class, ON to start (James: new games go live switched on);
--    teacher_set_decree().
-- 4. The hooks, measures and six achievements. Not a season game: the album and achievements are kept through a New
--    Season (keep_achievements), and every reign is a fresh start, so there is no season_fn.
--
-- Depends on 20261020000100_game_hooks.sql and 20261017001100_gem_keep.sql (gem_keep_check_player).

create table public.decree_reigns (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  look text not null check (look ~ '^ruler-(girl|boy)-[0-9]{1,2}$'),
  -- { seed, meters, turn, flags, used, stars, met, status, ending }
  reign jsonb not null check (jsonb_typeof(reign) = 'object'),
  -- Every move saved so far: ["yes", "no", "riddle", ...]
  moves jsonb not null default '[]' check (jsonb_typeof(moves) = 'array'),
  -- The riddles, answers included (never sent on to the browser)
  questions jsonb not null default '[]' check (jsonb_typeof(questions) = 'array'),
  -- { "<slot>": { value, right } }
  answered jsonb not null default '{}' check (jsonb_typeof(answered) = 'object'),
  status text not null default 'playing' check (status in ('playing', 'over', 'full', 'left')),
  ending text,
  points integer not null default 0 check (points between 0 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create index decree_reigns_by_player on public.decree_reigns (player, created_at);
create unique index decree_reigns_one_open on public.decree_reigns (player) where status = 'playing';

alter table public.decree_reigns enable row level security;
revoke all on public.decree_reigns from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The server function's jobs (service role only)
-- ---------------------------------------------------------------------------

-- The pupil's open reign (with its questions: the server function never sends the answers on), their Royal Album, and
-- how many reigns they've finished in the last day (only the first few a day give points).
create function public.decree_load(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  open_reign jsonb;
begin
  perform public.gem_keep_check_player(player);
  select jsonb_build_object('id', r.id, 'look', r.look, 'reign', r.reign, 'moves', r.moves,
                            'questions', r.questions, 'answered', r.answered)
  into open_reign
  from public.decree_reigns r where r.player = decree_load.player and r.status = 'playing';
  return jsonb_build_object(
    'reign', open_reign,
    'album', jsonb_build_object(
      'reigns', (select count(*) from public.decree_reigns r
                 where r.player = decree_load.player and r.status in ('over', 'full')),
      'full', (select count(*) from public.decree_reigns r where r.player = decree_load.player and r.status = 'full'),
      'best', (select coalesce(max((r.reign ->> 'turn')::integer), 0) from public.decree_reigns r
               where r.player = decree_load.player and r.status in ('over', 'full')),
      'endings', (select coalesce(jsonb_agg(distinct r.ending), '[]') from public.decree_reigns r
                  where r.player = decree_load.player and r.status in ('over', 'full') and r.ending is not null),
      'met', (select coalesce(jsonb_agg(distinct m.v), '[]')
              from public.decree_reigns r, jsonb_array_elements_text(r.reign -> 'met') as m (v)
              where r.player = decree_load.player)),
    'finishedToday', (
      select count(*) from public.decree_reigns r
      where r.player = decree_load.player and r.status in ('over', 'full') and r.finished_at > now() - interval '1 day'));
end;
$$;

-- Leaves any open reign and starts a new one. Returns its id.
create function public.decree_start(player uuid, look text, reign jsonb, questions jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  perform public.gem_keep_check_player(player);
  update public.decree_reigns r set status = 'left', finished_at = now(), updated_at = now()
  where r.player = decree_start.player and r.status = 'playing';
  insert into public.decree_reigns (player, look, reign, questions)
  values (player, look, reign, questions)
  returning id into new_id;
  return new_id;
end;
$$;

-- Marks one riddle, once: the reign must be the pupil's and open, and the slot one of its riddles not answered yet.
-- True if it was marked now.
create function public.decree_answer(player uuid, reign bigint, slot integer, value numeric, right_answer boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.decree_reigns r set
    answered = r.answered || jsonb_build_object(slot::text, jsonb_build_object('value', value, 'right', right_answer)),
    updated_at = now()
  where r.id = decree_answer.reign and r.player = decree_answer.player and r.status = 'playing'
    and slot >= 0 and slot < jsonb_array_length(r.questions)
    and not r.answered ? slot::text;
  return found;
end;
$$;

-- Keeps a reign the server function has replayed, only if it is still open with `from_turn` cards played (so a save sent
-- twice is kept once). `state` is the reign after the new moves; `new_moves` is every move so far. When the reign is
-- over, `state`'s status ('over' or 'full') closes the row with its ending and the points; `points` is then 0 to 10.
-- True if it was kept now.
create function public.decree_save(player uuid, reign bigint, from_turn integer, state jsonb, new_moves jsonb, points integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_status text := state ->> 'status';
  over boolean := new_status in ('over', 'full');
begin
  if new_status is null or new_status not in ('playing', 'over', 'full') or jsonb_typeof(new_moves) is distinct from 'array'
     or (not over and points is not null and points <> 0) or (over and (points is null or points < 0 or points > 10)) then
    raise exception 'That reign is not right.' using errcode = '22023';
  end if;
  update public.decree_reigns r set
    reign = decree_save.state,
    moves = decree_save.new_moves,
    status = new_status,
    ending = case when over then state ->> 'ending' end,
    points = case when over then decree_save.points else 0 end,
    finished_at = case when over then now() end,
    updated_at = now()
  where r.id = decree_save.reign and r.player = decree_save.player and r.status = 'playing'
    and (r.reign ->> 'turn')::integer = from_turn;
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- The switch (ON to start, for every class)
-- ---------------------------------------------------------------------------

alter table public.app_settings add column decree_enabled boolean not null default true;

create function public.teacher_set_decree(enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null then
    raise exception 'Unknown Royal Decree setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings set decree_enabled = enabled where id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- The hooks
-- ---------------------------------------------------------------------------

-- A pupil's counts for the achievements: reigns finished, reigns lived through to the end, villagers met and endings seen.
create function public.decree_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'decree_reigns', (select count(*) from public.decree_reigns r where r.player = who and r.status in ('over', 'full')),
    'decree_full', (select count(*) from public.decree_reigns r where r.player = who and r.status = 'full'),
    'decree_met', (select count(distinct m.v) from public.decree_reigns r, jsonb_array_elements_text(r.reign -> 'met') as m (v)
                   where r.player = who),
    'decree_endings', (select count(distinct r.ending) from public.decree_reigns r
                       where r.player = who and r.status in ('over', 'full') and r.ending is not null))
$$;

-- The lines on How points work (the numbers are shared/decree/config.ts: POINTS and POINT_REIGNS_PER_DAY).
create function public.decree_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'Any reign: 1 point, +1 for each year lived (up to 3), +1 for a full reign. The first 5 reigns a day give points.'))
$$;

-- Pupils with an album (a rebuild gives their achievements back).
create function public.decree_players()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select distinct r.player from public.decree_reigns r
$$;

create function public.decree_last_played(player uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select max(r.updated_at) from public.decree_reigns r where r.player = decree_last_played.player
$$;

insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn, keep_achievements)
values ('decree', 'decree_enabled', 'public.decree_counts(uuid)', 'public.decree_point_rules()', 'public.decree_players()',
  null, 'public.decree_last_played(uuid)', true);

insert into public.achievement_measures (measure) values ('decree_reigns'), ('decree_full'), ('decree_met'), ('decree_endings');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('decree-first', 'decree', 'First decree', '📜', 'decree_reigns', 1, 1),
  ('decree-long-live', 'decree', 'Long live the ruler', '👑', 'decree_full', 1, 2),
  ('decree-royal-friend', 'decree', 'Royal friend', '🤝', 'decree_met', 20, 3),
  ('decree-everyone', 'decree', 'Everyone''s ruler', '🏰', 'decree_met', 32, 4),
  ('decree-storyteller', 'decree', 'Storyteller', '📖', 'decree_endings', 5, 5),
  ('decree-golden-throne', 'decree', 'Golden throne', '🪑', 'decree_full', 5, 6);

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.decree_load(uuid), public.decree_start(uuid, text, jsonb, jsonb),
  public.decree_answer(uuid, bigint, integer, numeric, boolean),
  public.decree_save(uuid, bigint, integer, jsonb, jsonb, integer),
  public.teacher_set_decree(boolean, uuid), public.decree_counts(uuid), public.decree_point_rules(), public.decree_players(),
  public.decree_last_played(uuid)
from public, anon, authenticated;
grant execute on function public.teacher_set_decree(boolean, uuid) to authenticated;
grant execute on function
  public.decree_load(uuid), public.decree_start(uuid, text, jsonb, jsonb),
  public.decree_answer(uuid, bigint, integer, numeric, boolean),
  public.decree_save(uuid, bigint, integer, jsonb, jsonb, integer)
to service_role;
