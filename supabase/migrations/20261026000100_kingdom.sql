-- Kingdom Keeper: the server side (docs/KINGDOM-PLAN.md, sections 5 and 6).
--
-- Kingdom Keeper is its own thing: one table and its own functions, so no other game reads or changes a reign. Points,
-- the teacher's switch, How points work, achievements, the teacher's "last played" and New Season all go through the
-- hub_games hooks; nothing shared is re-created.
--
-- 1. kingdom_reigns: one row a reign. The city as it is now (the rules are shared/kingdom/engine.ts), the seed its years
--    are rolled from, the ruler's look, and this year's council: its questions, which pupils can never read (no policy,
--    no grant), and the answers marked so far.
-- 2. Server-only functions: load, start, answer (a council slot is marked once) and turn (a year is turned once).
-- 3. The switch: app_settings.kingdom_enabled, per class, OFF to start; teacher_set_kingdom().
-- 4. The hooks, measures and six achievements.
--
-- Depends on 20261020000100_game_hooks.sql.

create table public.kingdom_reigns (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  seed text not null check (seed ~ '^[a-f0-9]{16,64}$'),
  look text not null check (look ~ '^ruler-(girl|boy)-[0-9]{1,2}$'),
  status text not null default 'playing' check (status in ('playing', 'done', 'ended', 'left')),
  -- The year being ruled (1 to 10), and how many years have been turned.
  year integer not null default 1 check (year between 1 and 10),
  turned integer not null default 0 check (turned between 0 and 10),
  city jsonb not null check (jsonb_typeof(city) = 'object'),
  -- { year, advisers, questions, answered }, or null in a year with no council
  council jsonb check (council is null or jsonb_typeof(council) = 'object'),
  -- Council answers marked right over the whole reign (for the Wise council achievement).
  council_right integer not null default 0 check (council_right >= 0),
  -- Once it's over: how it was rated, the points it gave and the people at the end.
  rating text check (rating in ('legendary', 'good', 'fair', 'hard')),
  points integer not null default 0 check (points between 0 and 10),
  people integer check (people >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create index kingdom_reigns_by_player on public.kingdom_reigns (player, created_at);
create unique index kingdom_reigns_one_open on public.kingdom_reigns (player) where status = 'playing';

alter table public.kingdom_reigns enable row level security;
revoke all on public.kingdom_reigns from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The server function's jobs (service role only)
-- ---------------------------------------------------------------------------

-- The pupil's open reign (with its seed and questions: the server function never sends those on), their record, and how
-- many reigns they've finished in the last day (only the first few a day give points).
create function public.kingdom_load(player uuid)
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
  select jsonb_build_object('id', r.id, 'seed', r.seed, 'look', r.look, 'city', r.city, 'council', r.council)
  into open_reign
  from public.kingdom_reigns r where r.player = kingdom_load.player and r.status = 'playing';
  return jsonb_build_object(
    'reign', open_reign,
    'record', (
      select jsonb_build_object(
        'reigns', count(*) filter (where r.status = 'done'),
        'legendary', count(*) filter (where r.rating = 'legendary'),
        'best', coalesce(max(r.people) filter (where r.status = 'done'), 0))
      from public.kingdom_reigns r where r.player = kingdom_load.player),
    'finishedToday', (
      select count(*) from public.kingdom_reigns r
      where r.player = kingdom_load.player and r.status in ('done', 'ended') and r.finished_at > now() - interval '1 day'));
end;
$$;

-- Leaves any open reign and starts a new one. Returns its id.
create function public.kingdom_start(player uuid, seed text, look text, city jsonb, council jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  perform public.gem_keep_check_player(player);
  update public.kingdom_reigns r set status = 'left', finished_at = now(), updated_at = now()
  where r.player = kingdom_start.player and r.status = 'playing';
  insert into public.kingdom_reigns (player, seed, look, city, council)
  values (player, seed, look, city, council)
  returning id into new_id;
  return new_id;
end;
$$;

-- Marks one council answer, once: the reign must be the pupil's, open, on this year, and the slot one of this year's
-- questions not answered yet. True if it was marked now.
create function public.kingdom_answer(player uuid, reign bigint, year integer, slot integer, value numeric, right_answer boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.kingdom_reigns r set
    council = jsonb_set(r.council, '{answered}',
      coalesce(r.council -> 'answered', '{}') || jsonb_build_object(slot::text, jsonb_build_object('value', value, 'right', right_answer))),
    council_right = r.council_right + case when right_answer then 1 else 0 end,
    updated_at = now()
  where r.id = kingdom_answer.reign and r.player = kingdom_answer.player and r.status = 'playing'
    and r.year = kingdom_answer.year and r.council is not null and (r.council ->> 'year')::integer = kingdom_answer.year
    and slot >= 0 and slot < jsonb_array_length(r.council -> 'questions')
    and not coalesce(r.council -> 'answered', '{}') ? slot::text;
  return found;
end;
$$;

-- Keeps a year the server function has turned, only if the reign is still open on `from_year` with `turned` years
-- turned (so a year sent twice is turned once). With a rating the reign is over ('done' after ten years, 'ended' if
-- it ended early, from the city's own status). True if it was kept now.
create function public.kingdom_turn(
  player uuid, reign bigint, from_year integer, turned integer, city jsonb, council jsonb, rating text, points integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  over boolean := city ->> 'status' in ('done', 'ended');
begin
  if (city ->> 'status') not in ('playing', 'done', 'ended') or (over and rating is null) or points < 0 or points > 10 then
    raise exception 'That year is not right.' using errcode = '22023';
  end if;
  update public.kingdom_reigns r set
    city = kingdom_turn.city,
    council = kingdom_turn.council,
    year = (kingdom_turn.city ->> 'year')::integer,
    turned = r.turned + 1,
    status = kingdom_turn.city ->> 'status',
    rating = case when over then kingdom_turn.rating end,
    points = case when over then kingdom_turn.points else 0 end,
    people = case when over then (kingdom_turn.city ->> 'people')::integer end,
    finished_at = case when over then now() end,
    updated_at = now()
  where r.id = kingdom_turn.reign and r.player = kingdom_turn.player and r.status = 'playing'
    and r.year = from_year and r.turned = kingdom_turn.turned;
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- The switch
-- ---------------------------------------------------------------------------

alter table public.app_settings add column kingdom_enabled boolean not null default false;

create function public.teacher_set_kingdom(enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null then
    raise exception 'Unknown Kingdom Keeper setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings set kingdom_enabled = enabled where id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- The hooks
-- ---------------------------------------------------------------------------

-- A pupil's counts for the achievements: reigns finished, Legendary reigns, the most people at the end of a finished
-- reign, and council answers marked right.
create function public.kingdom_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'kingdom_reigns', count(*) filter (where r.status = 'done'),
    'kingdom_legendary', count(*) filter (where r.rating = 'legendary'),
    'kingdom_people', coalesce(max(r.people) filter (where r.status = 'done'), 0),
    'kingdom_council', coalesce(sum(r.council_right), 0))
  from public.kingdom_reigns r where r.player = who
$$;

-- The lines on How points work (the numbers are shared/kingdom/config.ts: POINTS and POINT_REIGNS_PER_DAY).
create function public.kingdom_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'Rule Riverstone for all ten years: 3 points, 4 as a Good ruler, 5 as a Legendary ruler.',
    'A reign that ends early: 1 point.',
    'Only your first 3 reigns each day give points. Council answers give boons for your city, not points.'))
$$;

-- Pupils with Kingdom Keeper progress outside points (a rebuild gives their achievements back).
create function public.kingdom_players()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select distinct r.player from public.kingdom_reigns r
$$;

-- What a New Season clears (the game's points always go): every reign.
create function public.kingdom_season(players uuid[])
returns void
language sql
set search_path = ''
as $$
  delete from public.kingdom_reigns where player = any (players)
$$;

create function public.kingdom_last_played(player uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select max(r.updated_at) from public.kingdom_reigns r where r.player = kingdom_last_played.player
$$;

insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn)
values ('kingdom', 'kingdom_enabled', 'public.kingdom_counts(uuid)', 'public.kingdom_point_rules()', 'public.kingdom_players()',
  'public.kingdom_season(uuid[])', 'public.kingdom_last_played(uuid)');

insert into public.achievement_measures (measure) values ('kingdom_reigns'), ('kingdom_legendary'), ('kingdom_people'), ('kingdom_council');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('kingdom-first-crown', 'kingdom', 'First crown', '👑', 'kingdom_reigns', 1, 1),
  ('kingdom-seasoned', 'kingdom', 'Seasoned ruler', '📜', 'kingdom_reigns', 5, 2),
  ('kingdom-legendary', 'kingdom', 'Legendary ruler', '🏰', 'kingdom_legendary', 1, 3),
  ('kingdom-great-city', 'kingdom', 'Great city', '🏙️', 'kingdom_people', 200, 4),
  ('kingdom-wise-council', 'kingdom', 'Wise council', '🦉', 'kingdom_council', 30, 5),
  ('kingdom-golden-age', 'kingdom', 'Golden age', '🌟', 'kingdom_legendary', 3, 6);

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.kingdom_load(uuid), public.kingdom_start(uuid, text, text, jsonb, jsonb),
  public.kingdom_answer(uuid, bigint, integer, integer, numeric, boolean),
  public.kingdom_turn(uuid, bigint, integer, integer, jsonb, jsonb, text, integer),
  public.teacher_set_kingdom(boolean, uuid), public.kingdom_counts(uuid), public.kingdom_point_rules(), public.kingdom_players(),
  public.kingdom_season(uuid[]), public.kingdom_last_played(uuid)
from public, anon, authenticated;
grant execute on function public.teacher_set_kingdom(boolean, uuid) to authenticated;
grant execute on function
  public.kingdom_load(uuid), public.kingdom_start(uuid, text, text, jsonb, jsonb),
  public.kingdom_answer(uuid, bigint, integer, integer, numeric, boolean),
  public.kingdom_turn(uuid, bigint, integer, integer, jsonb, jsonb, text, integer)
to service_role;
