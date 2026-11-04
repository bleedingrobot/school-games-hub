-- Penguin Pairs (doubles and halves for younger students; short id korora): the server side and the hub
-- (docs/KORORA-PLAN.md). Built the same way as Hop's Glow-worm Pond (20261104000600_hop.sql, 20261104000900_hop_hub.sql).
--
-- Penguin Pairs is its own thing: two tables and its own functions, so no other game reads or changes them. Nothing
-- shared is re-created.
--
-- 1. korora_progress: one row a pupil. The count of finished days (everything else, the pebbles' colours, the Golden
--    Fish and the friend, is worked out from it by shared/korora/progress.ts), the NZ day a pebble last changed, and the
--    furthest level reached (1 to 4: a child never drops back below it). Saved only by the `korora` server function, and
--    only if its version still matches.
-- 2. korora_rounds: one row a challenge started. Its seed, its level, whether it was a gold day, and its ten goes as the
--    server made them from the pupil's maths records (shared/korora/round.ts), kept so the taps are checked against
--    exactly what the pupil was shown. Once it has finished: the taps and how many picks were wrong. A seed is used once
--    per pupil and a challenge finishes once. Finished challenges over 30 days old go.
-- 3. The switch (app_settings.korora_enabled, per class, ON to start for every class: James, 4 Nov 2026), the help
--    setting (app_settings.korora_help: 'fade', 'always' or 'off', 'fade' to start) and teacher_set_korora().
-- 4. The hub: hub_games hooks, one achievement per Golden Fish (one for each friend), the teacher's class and student
--    lines. No points. Not a season game: days are counted, not dates, so New Season leaves the pool as it is.
--
-- Pupils can't read or change any of it directly; the server function does everything. The maths records it reads come
-- from space_maths_context (20261019000300_maths_generated.sql) and its answers are saved with record_fact_answers.
-- Depends on 20261017001100_gem_keep.sql, 20261020000100_game_hooks.sql (gem_keep_check_player) and 20261018002400_classes_and_warp.sql (settings).

create table public.korora_progress (
  player uuid primary key references public.profiles (id) on delete cascade,
  days_done integer not null default 0 check (days_done >= 0),
  last_pebble_day date,
  reached smallint not null default 1 check (reached between 1 and 4),
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now()
);

create table public.korora_rounds (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  seed bigint not null check (seed between 0 and 2147483647),
  level smallint not null check (level between 1 and 4),
  gold boolean not null,
  goes jsonb not null check (jsonb_typeof(goes) = 'array' and jsonb_array_length(goes) = 10),
  open boolean not null default true,
  taps jsonb check (taps is null or jsonb_typeof(taps) = 'array'),
  mistakes integer check (mistakes >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create unique index korora_rounds_seed on public.korora_rounds (player, seed);
create index korora_rounds_by_player on public.korora_rounds (player, started_at);

alter table public.korora_progress enable row level security;
alter table public.korora_rounds enable row level security;
revoke all on public.korora_progress, public.korora_rounds from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The server function's jobs (service role only)
-- ---------------------------------------------------------------------------

-- The pupil's pool and its version, or null if they've never played.
create function public.korora_load(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  return (select jsonb_build_object('daysDone', h.days_done, 'lastPebbleDay', to_char(h.last_pebble_day, 'YYYY-MM-DD'),
                                    'reached', h.reached, 'version', h.version)
          from public.korora_progress h where h.player = korora_load.player);
end;
$$;

-- Keeps a new challenge (making the pupil's pool on their first go) and closes any other open one. False if the pupil
-- has used this seed before.
create function public.korora_start(player uuid, seed bigint, level smallint, gold boolean, goes jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if exists (select 1 from public.korora_rounds r where r.player = korora_start.player and r.seed = korora_start.seed) then
    return false;
  end if;
  insert into public.korora_progress (player) values (player) on conflict on constraint korora_progress_pkey do nothing;
  update public.korora_rounds r set open = false where r.player = korora_start.player and r.open;
  delete from public.korora_rounds r
  where r.player = korora_start.player and not r.open and r.started_at < now() - interval '30 days';
  insert into public.korora_rounds (player, seed, level, gold, goes) values (player, seed, level, gold, goes);
  return true;
end;
$$;

-- One of the pupil's challenges by its seed: { open, round: { seed, level, gold, goes } }, or null if it isn't theirs.
create function public.korora_round(player uuid, seed bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('open', r.open,
                            'round', jsonb_build_object('seed', r.seed, 'level', r.level, 'gold', r.gold, 'goes', r.goes))
  from public.korora_rounds r where r.player = korora_round.player and r.seed = korora_round.seed
$$;

-- Finishes an open challenge with the server's replay of its taps and saves the progress, together. The count of
-- finished days only ever stays or goes up by one, and the furthest level reached never goes back. False if the challenge
-- had already finished or the version moved on.
create function public.korora_finish(
  player uuid, seed bigint, version integer, days_done integer, last_pebble_day date, reached smallint, taps jsonb, mistakes integer
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
  perform 1 from public.korora_rounds r where r.player = korora_finish.player and r.seed = korora_finish.seed and r.open for update;
  if not found then
    return false;
  end if;
  update public.korora_progress h
  set days_done = korora_finish.days_done, last_pebble_day = korora_finish.last_pebble_day, reached = korora_finish.reached,
      version = h.version + 1, updated_at = now()
  where h.player = korora_finish.player and h.version = korora_finish.version
    and korora_finish.days_done between h.days_done and h.days_done + 1
    and korora_finish.reached >= h.reached;
  if not found then
    return false;
  end if;
  update public.korora_rounds r set open = false, taps = korora_finish.taps, mistakes = korora_finish.mistakes, finished_at = now()
  where r.player = korora_finish.player and r.seed = korora_finish.seed;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- The switch and the help setting
-- ---------------------------------------------------------------------------

alter table public.app_settings add column korora_enabled boolean not null default true;
alter table public.app_settings add column korora_help text not null default 'fade' check (korora_help in ('fade', 'always', 'off'));

-- Either setting, or both (a null one is left as it is).
create function public.teacher_set_korora(enabled boolean default null, help text default null, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if (enabled is null and help is null) or (help is not null and help not in ('fade', 'always', 'off')) then
    raise exception 'Unknown Penguin Pairs setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings s
  set korora_enabled = coalesce(teacher_set_korora.enabled, s.korora_enabled),
      korora_help = coalesce(teacher_set_korora.help, s.korora_help)
  where s.id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.korora_load(uuid), public.korora_start(uuid, bigint, smallint, boolean, jsonb),
  public.korora_round(uuid, bigint), public.korora_finish(uuid, bigint, integer, integer, date, smallint, jsonb, integer),
  public.teacher_set_korora(boolean, text, uuid)
from public, anon, authenticated;
grant execute on function public.teacher_set_korora(boolean, text, uuid) to authenticated;
grant execute on function
  public.korora_load(uuid), public.korora_start(uuid, bigint, smallint, boolean, jsonb),
  public.korora_round(uuid, bigint), public.korora_finish(uuid, bigint, integer, integer, date, smallint, jsonb, integer)
to service_role;

-- ---------------------------------------------------------------------------
-- The hooks
-- ---------------------------------------------------------------------------

-- Golden Fish won: one for every 30 finished days.
create function public.korora_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('korora_fish', coalesce((select h.days_done / 30 from public.korora_progress h where h.player = who), 0))
$$;

-- The lines on How points work.
create function public.korora_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'No points: each Golden Fish is the prize, and an achievement.'))
$$;

-- Pupils with a pool (a rebuild gives their achievements back).
create function public.korora_players_list()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select h.player from public.korora_progress h
$$;

create function public.korora_last_played(player uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select h.updated_at from public.korora_progress h where h.player = korora_last_played.player
$$;

insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn, keep_achievements)
values ('korora', 'korora_enabled', 'public.korora_counts(uuid)', 'public.korora_point_rules()',
  'public.korora_players_list()', null, 'public.korora_last_played(uuid)', true);

insert into public.achievement_measures (measure) values ('korora_fish');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('korora-korora', 'korora', 'Kororā’s Golden Fish', '🐧', 'korora_fish', 1, 1),
  ('korora-hoiho', 'korora', 'Hoiho’s Golden Fish', '🐧', 'korora_fish', 2, 2),
  ('korora-kiwi', 'korora', 'Kiwi’s Golden Fish', '🥝', 'korora_fish', 3, 3),
  ('korora-pukeko', 'korora', 'Pūkeko’s Golden Fish', '🐦', 'korora_fish', 4, 4),
  ('korora-kereru', 'korora', 'Kererū’s Golden Fish', '🕊️', 'korora_fish', 5, 5),
  ('korora-takahe', 'korora', 'Takahē’s Golden Fish', '🦃', 'korora_fish', 6, 6);

-- ---------------------------------------------------------------------------
-- The teacher's lines
-- ---------------------------------------------------------------------------

-- The teacher's Games table line for a class: how many of its pupils play, and the Golden Fish won between them.
create function public.teacher_korora_class(target_class uuid)
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
    select jsonb_build_object('players', count(*), 'fish', coalesce(sum(h.days_done / 30), 0))
    from public.korora_progress h
    join public.my_students() s(id) on s.id = h.player
    where exists (select 1 from public.class_members m where m.student_id = h.player and m.class_id = target_class));
end;
$$;

-- One line's worth for a student's page: finished days in all (the screens work out the day and Golden Fish), the NZ day
-- a pebble last changed, the level reached (1 to 4), when they last played, and the doubles, halves and odd-or-even
-- facts they find hardest (tried at least twice, not yet secure, fewest right first); or null.
create function public.teacher_korora_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return (select jsonb_build_object('daysDone', h.days_done, 'lastPebbleDay', to_char(h.last_pebble_day, 'YYYY-MM-DD'),
                                    'reached', h.reached, 'lastPlayed', h.updated_at,
                                    'hardest', coalesce((
                                      select jsonb_agg(f.fact_key order by f.correct::numeric / f.attempts, f.fact_key)
                                      from (select g.fact_key, g.correct, g.attempts from public.gem_keep_facts g
                                            where g.player = student and g.pack = 'early-facts' and g.attempts >= 2 and g.box < 2
                                              and g.fact_key ~ '^(dbl|half|oddeven):[0-9]+$'
                                            order by g.correct::numeric / g.attempts, g.fact_key limit 3) f), '[]'::jsonb))
          from public.korora_progress h where h.player = student);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.korora_counts(uuid), public.korora_point_rules(), public.korora_players_list(), public.korora_last_played(uuid),
  public.teacher_korora_class(uuid), public.teacher_korora_student(uuid)
from public, anon, authenticated;
grant execute on function public.teacher_korora_class(uuid), public.teacher_korora_student(uuid) to authenticated;
