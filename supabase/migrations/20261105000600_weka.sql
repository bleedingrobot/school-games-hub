-- Weka's Stepping Stones (adding within 20 by making ten, for younger students; short id weka): the server side and the
-- hub (docs/WEKA-PLAN.md). Built the same way as Penguin Pairs (20261105000100_korora.sql).
--
-- Weka's Stepping Stones is its own thing: two tables and its own functions, so no other game reads or changes them.
-- Nothing shared is re-created.
--
-- 1. weka_progress: one row a pupil. The count of finished days (everything else, the magic stones' colours, the Golden
--    Picnic Baskets and the friend, is worked out from it by shared/weka/progress.ts), the NZ day a stone last changed,
--    and the furthest level reached (1 to 4: a child never drops back below it). Saved only by the `weka` server
--    function, and only if its version still matches.
-- 2. weka_rounds: one row a challenge started. Its seed, its level, the kind of day (bronze, silver or gold), and its ten
--    goes as the server made them from the pupil's maths records (shared/weka/round.ts: each go's fact, how it is asked
--    and its help), kept so the taps are checked against exactly what the pupil was shown. Once it has finished: the
--    taps and how many picks were wrong. A seed is used once per pupil and a challenge finishes once. Finished
--    challenges over 30 days old go.
-- 3. The switch (app_settings.weka_enabled, per class, ON to start for every class, as every early game), the help
--    setting (app_settings.weka_help: 'fade', 'always' or 'off', 'fade' to start) and teacher_set_weka().
-- 4. The hub: hub_games hooks, one achievement per Golden Picnic Basket (one for each friend), the teacher's class and
--    student lines. No points. Not a season game: days are counted, not dates, so New Season leaves the stream as it is.
--
-- Pupils can't read or change any of it directly; the server function does everything. The maths records it reads come
-- from space_maths_context (20261019000300_maths_generated.sql) and its answers are saved with record_fact_answers.
-- Depends on 20261017001100_gem_keep.sql, 20261020000100_game_hooks.sql (gem_keep_check_player) and 20261018002400_classes_and_warp.sql (settings).

create table public.weka_progress (
  player uuid primary key references public.profiles (id) on delete cascade,
  days_done integer not null default 0 check (days_done >= 0),
  last_stone_day date,
  reached smallint not null default 1 check (reached between 1 and 4),
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now()
);

create table public.weka_rounds (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  seed bigint not null check (seed between 0 and 2147483647),
  level smallint not null check (level between 1 and 4),
  day text not null check (day in ('bronze', 'silver', 'gold')),
  goes jsonb not null check (jsonb_typeof(goes) = 'array' and jsonb_array_length(goes) = 10),
  open boolean not null default true,
  taps jsonb check (taps is null or jsonb_typeof(taps) = 'array'),
  mistakes integer check (mistakes >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create unique index weka_rounds_seed on public.weka_rounds (player, seed);
create index weka_rounds_by_player on public.weka_rounds (player, started_at);

alter table public.weka_progress enable row level security;
alter table public.weka_rounds enable row level security;
revoke all on public.weka_progress, public.weka_rounds from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The server function's jobs (service role only)
-- ---------------------------------------------------------------------------

-- The pupil's stream and its version, or null if they've never played.
create function public.weka_load(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  return (select jsonb_build_object('daysDone', h.days_done, 'lastStoneDay', to_char(h.last_stone_day, 'YYYY-MM-DD'),
                                    'reached', h.reached, 'version', h.version)
          from public.weka_progress h where h.player = weka_load.player);
end;
$$;

-- Keeps a new challenge (making the pupil's stream on their first go) and closes any other open one. False if the pupil
-- has used this seed before.
create function public.weka_start(player uuid, seed bigint, level smallint, day text, goes jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if exists (select 1 from public.weka_rounds r where r.player = weka_start.player and r.seed = weka_start.seed) then
    return false;
  end if;
  insert into public.weka_progress (player) values (player) on conflict on constraint weka_progress_pkey do nothing;
  update public.weka_rounds r set open = false where r.player = weka_start.player and r.open;
  delete from public.weka_rounds r
  where r.player = weka_start.player and not r.open and r.started_at < now() - interval '30 days';
  insert into public.weka_rounds (player, seed, level, day, goes) values (player, seed, level, day, goes);
  return true;
end;
$$;

-- One of the pupil's challenges by its seed: { open, round: { seed, level, day, goes } }, or null if it isn't theirs.
create function public.weka_round(player uuid, seed bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('open', r.open,
                            'round', jsonb_build_object('seed', r.seed, 'level', r.level, 'day', r.day, 'goes', r.goes))
  from public.weka_rounds r where r.player = weka_round.player and r.seed = weka_round.seed
$$;

-- Finishes an open challenge with the server's replay of its taps and saves the progress, together. The count of
-- finished days only ever stays or goes up by one, and the furthest level reached never goes back. False if the challenge
-- had already finished or the version moved on.
create function public.weka_finish(
  player uuid, seed bigint, version integer, days_done integer, last_stone_day date, reached smallint, taps jsonb, mistakes integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(taps) is distinct from 'array' or mistakes is null or mistakes < 0 or days_done is null
     or reached is null or reached not between 1 and 4 then
    raise exception 'That challenge is not right.' using errcode = '22023';
  end if;
  perform 1 from public.weka_rounds r where r.player = weka_finish.player and r.seed = weka_finish.seed and r.open for update;
  if not found then
    return false;
  end if;
  update public.weka_progress h
  set days_done = weka_finish.days_done, last_stone_day = weka_finish.last_stone_day, reached = weka_finish.reached,
      version = h.version + 1, updated_at = now()
  where h.player = weka_finish.player and h.version = weka_finish.version
    and weka_finish.days_done between h.days_done and h.days_done + 1
    and weka_finish.reached >= h.reached;
  if not found then
    return false;
  end if;
  update public.weka_rounds r set open = false, taps = weka_finish.taps, mistakes = weka_finish.mistakes, finished_at = now()
  where r.player = weka_finish.player and r.seed = weka_finish.seed;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- The switch and the help setting
-- ---------------------------------------------------------------------------

alter table public.app_settings add column weka_enabled boolean not null default true;
alter table public.app_settings add column weka_help text not null default 'fade' check (weka_help in ('fade', 'always', 'off'));

-- Either setting, or both (a null one is left as it is).
create function public.teacher_set_weka(enabled boolean default null, help text default null, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if (enabled is null and help is null) or (help is not null and help not in ('fade', 'always', 'off')) then
    raise exception 'Unknown Weka''s Stepping Stones setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings s
  set weka_enabled = coalesce(teacher_set_weka.enabled, s.weka_enabled),
      weka_help = coalesce(teacher_set_weka.help, s.weka_help)
  where s.id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.weka_load(uuid), public.weka_start(uuid, bigint, smallint, text, jsonb),
  public.weka_round(uuid, bigint), public.weka_finish(uuid, bigint, integer, integer, date, smallint, jsonb, integer),
  public.teacher_set_weka(boolean, text, uuid)
from public, anon, authenticated;
grant execute on function public.teacher_set_weka(boolean, text, uuid) to authenticated;
grant execute on function
  public.weka_load(uuid), public.weka_start(uuid, bigint, smallint, text, jsonb),
  public.weka_round(uuid, bigint), public.weka_finish(uuid, bigint, integer, integer, date, smallint, jsonb, integer)
to service_role;

-- ---------------------------------------------------------------------------
-- The hooks
-- ---------------------------------------------------------------------------

-- Golden Picnic Baskets won: one for every 30 finished days.
create function public.weka_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('weka_baskets', coalesce((select h.days_done / 30 from public.weka_progress h where h.player = who), 0))
$$;

-- The lines on How points work.
create function public.weka_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'No points: each Golden Picnic Basket is the prize, and an achievement.'))
$$;

-- Pupils with a stream (a rebuild gives their achievements back).
create function public.weka_players_list()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select h.player from public.weka_progress h
$$;

create function public.weka_last_played(player uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select h.updated_at from public.weka_progress h where h.player = weka_last_played.player
$$;

insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn, keep_achievements)
values ('weka', 'weka_enabled', 'public.weka_counts(uuid)', 'public.weka_point_rules()',
  'public.weka_players_list()', null, 'public.weka_last_played(uuid)', true);

-- The NZ day the pupil last changed a stone, for the home page's "next part" chip (20261105000500_next_part_chips.sql).
create function public.weka_last_day(who uuid)
returns date
language sql
stable
set search_path = ''
as $$
  select w.last_stone_day from public.weka_progress w where w.player = who
$$;
revoke execute on function public.weka_last_day(uuid) from public, anon, authenticated;
update public.hub_games set day_fn = 'public.weka_last_day(uuid)' where id = 'weka';

insert into public.achievement_measures (measure) values ('weka_baskets');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('weka-weka', 'weka', 'Weka’s Golden Picnic Basket', '🧺', 'weka_baskets', 1, 1),
  ('weka-kiwi', 'weka', 'Kiwi’s Golden Picnic Basket', '🥝', 'weka_baskets', 2, 2),
  ('weka-takahe', 'weka', 'Takahē’s Golden Picnic Basket', '🦃', 'weka_baskets', 3, 3),
  ('weka-kakapo', 'weka', 'Kākāpō’s Golden Picnic Basket', '🦜', 'weka_baskets', 4, 4),
  ('weka-pukeko', 'weka', 'Pūkeko’s Golden Picnic Basket', '🐦', 'weka_baskets', 5, 5),
  ('weka-kea', 'weka', 'Kea’s Golden Picnic Basket', '🦜', 'weka_baskets', 6, 6);

-- ---------------------------------------------------------------------------
-- The teacher's lines
-- ---------------------------------------------------------------------------

-- The teacher's Games table line for a class: how many of its pupils play, and the Golden Picnic Baskets won between them.
create function public.teacher_weka_class(target_class uuid)
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
    select jsonb_build_object('players', count(*), 'baskets', coalesce(sum(h.days_done / 30), 0))
    from public.weka_progress h
    join public.my_students() s(id) on s.id = h.player
    where exists (select 1 from public.class_members m where m.student_id = h.player and m.class_id = target_class));
end;
$$;

-- One line's worth for a student's page: finished days in all (the screens work out the day and Golden Picnic Baskets), the NZ day
-- a stone last changed, the level reached (1 to 4), when they last played, and the adding-across-ten
-- facts they find hardest (tried at least twice, not yet secure, fewest right first); or null.
create function public.teacher_weka_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return (select jsonb_build_object('daysDone', h.days_done, 'lastStoneDay', to_char(h.last_stone_day, 'YYYY-MM-DD'),
                                    'reached', h.reached, 'lastPlayed', h.updated_at,
                                    'hardest', coalesce((
                                      select jsonb_agg(f.fact_key order by f.correct::numeric / f.attempts, f.fact_key)
                                      from (select g.fact_key, g.correct, g.attempts from public.gem_keep_facts g
                                            where g.player = student and g.pack = 'add-sub' and g.attempts >= 2 and g.box < 2
                                              and g.fact_key in ('add:2+9', 'add:3+8', 'add:3+9', 'add:4+7', 'add:4+8', 'add:4+9', 'add:5+6',
                                              'add:5+7', 'add:5+8', 'add:5+9', 'add:6+6', 'add:6+7', 'add:6+8', 'add:6+9',
                                              'add:7+7', 'add:7+8', 'add:7+9', 'add:8+8', 'add:8+9', 'add:9+9')
                                            order by g.correct::numeric / g.attempts, g.fact_key limit 3) f), '[]'::jsonb))
          from public.weka_progress h where h.player = student);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.weka_counts(uuid), public.weka_point_rules(), public.weka_players_list(), public.weka_last_played(uuid),
  public.teacher_weka_class(uuid), public.teacher_weka_student(uuid)
from public, anon, authenticated;
grant execute on function public.teacher_weka_class(uuid), public.teacher_weka_student(uuid) to authenticated;
