-- Bond Match stage M.4: saving. Finished games, bests, stars, small points, and what teachers see.
--
-- 1. Tables: bond_match_games (one row per finished game; the flips are kept so a game can be replayed) and
--    bond_match_bests (best flips, best time and best stars per bond set and board size, and how many games).
--    Students can't read or write them directly: they read their own through my_bond_match(), and only the
--    bond-match server function writes (through record_bond_match_game()).
-- 2. Points: a finished game earns 2 points (shared/bond-match/save.ts BOND_MATCH_SAVE). Only the first 10 finished games
--    in a New Zealand day earn points, and they sit inside the same 40-a-day cap as bot and solo games.
--    Bond Match NEVER writes to a student's fact records (James, 19 Oct 2026): only stars, bests and points.
-- 3. Reading: my_bond_match() for the student, teacher_bond_match_student() for a teacher (their own students only).
-- 4. Joining the shared lists: scored_games (a new column), rebuild_progress(), my_progress() "recent", teacher_students()
--    and teacher_new_season() are patched from their LIVE definitions (each patch must find its text, or the whole
--    migration stops and nothing changes).

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table public.bond_match_games (
  id uuid primary key default gen_random_uuid(),
  player uuid not null references public.profiles (id) on delete cascade,
  -- Made by the browser when the game starts, so a save sent twice is only kept once.
  run_id uuid not null,
  bond_id text not null check (bond_id ~ '^[a-z0-9-]{1,40}$'),
  size text not null check (size in ('small', 'medium', 'large')),
  seed integer not null check (seed >= 0),
  -- Every card flip in order: enough to rebuild the game.
  flips integer[] not null check (cardinality(flips) between 1 and 400),
  -- Turns taken (a pair of card flips is one) and whole seconds.
  flip_count integer not null check (flip_count >= 1),
  seconds integer not null check (seconds >= 0 and seconds <= 86400),
  stars integer not null check (stars between 1 and 3),
  counts_for_points boolean not null,
  finished_at timestamptz not null default now(),
  unique (player, run_id)
);
create index bond_match_games_player on public.bond_match_games (player, finished_at desc);

create table public.bond_match_bests (
  player uuid not null references public.profiles (id) on delete cascade,
  bond_id text not null check (bond_id ~ '^[a-z0-9-]{1,40}$'),
  size text not null check (size in ('small', 'medium', 'large')),
  best_flips integer not null check (best_flips >= 1),
  best_seconds integer not null check (best_seconds >= 0),
  best_stars integer not null check (best_stars between 1 and 3),
  plays integer not null default 1 check (plays >= 1),
  updated_at timestamptz not null default now(),
  primary key (player, bond_id, size)
);

alter table public.bond_match_games enable row level security;
alter table public.bond_match_bests enable row level security;
revoke all on public.bond_match_games, public.bond_match_bests from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Points
-- ---------------------------------------------------------------------------

alter table public.scored_games drop constraint scored_games_game_check;
alter table public.scored_games add constraint scored_games_game_check
  check (game in ('chess', 'checkers', 'space', '101', 'gem-keep', 'power-clash', 'monsters', 'dragon-maths', 'clan-quest', 'bond-match'));
alter table public.scored_games add column bond_match_game uuid references public.bond_match_games (id) on delete cascade;
alter table public.scored_games drop constraint scored_games_check;
alter table public.scored_games add constraint scored_games_check check (
  num_nonnulls(bot_game, mp_game, space_game, card_game, gem_keep_run, power_game, monster_save, lord_score, clan_score, bond_match_game) = 1
  and (kind = 'bot') = (bot_game is not null)
  and (kind = 'friend') = (mp_game is not null or space_game is not null or card_game is not null or power_game is not null)
  and (kind = 'solo') = (gem_keep_run is not null or monster_save is not null or lord_score is not null or clan_score is not null
                         or bond_match_game is not null));
create unique index scored_games_bond_match on public.scored_games (player, bond_match_game) where bond_match_game is not null;
create index scored_games_bond_match_game on public.scored_games (bond_match_game);

-- The numbers (the same ones as BOND_MATCH_SAVE in shared/bond-match/save.ts).
create function public.bond_match_points() returns integer language sql immutable set search_path = '' as $$ select 2 $$;
create function public.bond_match_points_games_per_day() returns integer language sql immutable set search_path = '' as $$ select 10 $$;
create function public.bond_match_max_games_per_day() returns integer language sql immutable set search_path = '' as $$ select 100 $$;

create function public.score_bond_match_game(g public.bond_match_games)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  day date := public.nz_day(g.finished_at);
  earned_today integer;
begin
  if not g.counts_for_points then
    return;
  end if;
  -- Shares the daily cap with the bot games and the other solo games.
  select coalesce(sum(s.points), 0) into earned_today
  from public.scored_games s
  where s.player = g.player and s.kind in ('bot', 'solo') and s.nz_day = day;
  insert into public.scored_games (player, game, kind, bond_match_game, result, reason, points, finished_at, nz_day)
  values (g.player, 'bond-match', 'solo', g.id, 'won', g.bond_id,
    least(public.bond_match_points(), greatest(public.bot_daily_cap() - earned_today, 0)), g.finished_at, day)
  on conflict do nothing;
end;
$$;

create function public.score_bond_match_game_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.score_bond_match_game(new);
  return null;
exception when others then
  -- Never lose a game because scoring went wrong. rebuild_progress() can fix scores later.
  raise warning 'scoring a Bond Match game failed (%)', sqlstate;
  return null;
end;
$$;

create trigger score_when_saved
after insert on public.bond_match_games
for each row
execute function public.score_bond_match_game_trigger();

-- ---------------------------------------------------------------------------
-- Saving (server only: the bond-match function replays the game first)
-- ---------------------------------------------------------------------------

-- One finished game. `game` = { runId, bondId, size, seed, flips[], flipCount, seconds, stars }, where flipCount and stars
-- are the server's own (from its replay), never the browser's.
-- Returns { status: 'saved' | 'duplicate', points, stars, best: { flips, seconds, stars } }.
create function public.record_bond_match_game(player uuid, game jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  counts boolean;
  was public.bond_match_bests;
  best public.bond_match_bests;
begin
  if not exists (
    select 1 from public.profiles p join auth.users u on u.id = p.id
    where p.id = player and public.is_school_email(u.email)
  ) then
    raise exception 'No such player.' using errcode = '22023';
  end if;

  select g.id into new_id from public.bond_match_games g
  where g.player = record_bond_match_game.player and g.run_id = (game ->> 'runId')::uuid;
  if new_id is not null then
    select * into best from public.bond_match_bests b
    where b.player = record_bond_match_game.player and b.bond_id = game ->> 'bondId' and b.size = game ->> 'size';
    return jsonb_build_object('status', 'duplicate',
      'points', (select s.points from public.scored_games s where s.bond_match_game = new_id),
      'stars', (select g.stars from public.bond_match_games g where g.id = new_id),
      'best', jsonb_build_object('flips', best.best_flips, 'seconds', best.best_seconds, 'stars', best.best_stars));
  end if;

  if (select count(*) from public.bond_match_games g
      where g.player = record_bond_match_game.player and g.finished_at > now() - interval '1 day')
     >= public.bond_match_max_games_per_day() then
    raise exception 'That''s a lot of games today! Have a break and come back tomorrow.' using errcode = '54000';
  end if;

  counts := (select count(*) from public.bond_match_games g
             where g.player = record_bond_match_game.player and g.counts_for_points
               and public.nz_day(g.finished_at) = public.nz_day(now())) < public.bond_match_points_games_per_day();

  begin
    insert into public.bond_match_games (player, run_id, bond_id, size, seed, flips, flip_count, seconds, stars, counts_for_points)
    values (player, (game ->> 'runId')::uuid, game ->> 'bondId', game ->> 'size', (game ->> 'seed')::integer,
      array(select jsonb_array_elements_text(game -> 'flips')::integer), (game ->> 'flipCount')::integer,
      (game ->> 'seconds')::integer, (game ->> 'stars')::integer, counts)
    returning id into new_id;
  exception when unique_violation then
    -- Two copies arrived at the same moment and the other one got there first.
    return jsonb_build_object('status', 'duplicate', 'points', null, 'stars', (game ->> 'stars')::integer,
      'best', jsonb_build_object('flips', (game ->> 'flipCount')::integer, 'seconds', (game ->> 'seconds')::integer,
        'stars', (game ->> 'stars')::integer));
  end;

  insert into public.bond_match_bests as b (player, bond_id, size, best_flips, best_seconds, best_stars)
  values (player, game ->> 'bondId', game ->> 'size', (game ->> 'flipCount')::integer, (game ->> 'seconds')::integer,
    (game ->> 'stars')::integer)
  on conflict on constraint bond_match_bests_pkey do update set
    best_flips = least(b.best_flips, excluded.best_flips),
    best_seconds = least(b.best_seconds, excluded.best_seconds),
    best_stars = greatest(b.best_stars, excluded.best_stars),
    plays = b.plays + 1,
    updated_at = now()
  returning * into best;

  return jsonb_build_object('status', 'saved',
    'points', (select s.points from public.scored_games s where s.bond_match_game = new_id),
    'stars', (game ->> 'stars')::integer,
    'best', jsonb_build_object('flips', best.best_flips, 'seconds', best.best_seconds, 'stars', best.best_stars));
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Reading
-- ---------------------------------------------------------------------------

-- The student's own bests: [{ bondId, size, flips, seconds, stars, plays }].
create function public.my_bond_match()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id where public.is_school_user())
  select jsonb_build_object('bests', (select coalesce(jsonb_agg(jsonb_build_object(
      'bondId', b.bond_id, 'size', b.size, 'flips', b.best_flips, 'seconds', b.best_seconds,
      'stars', b.best_stars, 'plays', b.plays) order by b.bond_id, b.size), '[]')
    from public.bond_match_bests b where b.player = me.id))
  from me
$$;

-- A teacher's view of one of their own students: stars per bond set and board size, and when they last played.
create function public.teacher_bond_match_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if student not in (select public.my_students()) then
    raise exception 'We couldn''t find that student.' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'bests', (select coalesce(jsonb_agg(jsonb_build_object(
        'bondId', b.bond_id, 'size', b.size, 'flips', b.best_flips, 'seconds', b.best_seconds,
        'stars', b.best_stars, 'plays', b.plays) order by b.bond_id, b.size), '[]')
      from public.bond_match_bests b where b.player = student),
    'games', (select count(*) from public.bond_match_games g where g.player = student),
    'lastPlayed', (select max(g.finished_at) from public.bond_match_games g where g.player = student));
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Joining the shared lists (patched from the live definitions)
-- ---------------------------------------------------------------------------

create function pg_temp.patch(fn regprocedure, edits text[]) returns void language plpgsql as $$
declare
  def text := pg_get_functiondef(fn);
  n integer;
begin
  for n in 1 .. cardinality(edits) / 2 loop
    if position(edits[n * 2 - 1] in def) = 0 then
      raise exception 'Bond Match migration: % no longer contains the text patch % looks for', fn, n;
    end if;
    def := replace(def, edits[n * 2 - 1], edits[n * 2]);
  end loop;
  execute def;
end;
$$;

-- A rebuild of everyone's points includes Bond Match games.
select pg_temp.patch('public.rebuild_progress()'::regprocedure, array[
  E'    order by finished_at, id\n',
  E'    union all\n    select ''bond'', bm.id, bm.finished_at from public.bond_match_games bm where bm.counts_for_points\n    order by finished_at, id\n',
  E'    else\n      perform public.score_gem_keep_run(r)',
  E'    elsif item.kind = ''bond'' then\n      perform public.score_bond_match_game(bm) from public.bond_match_games bm where bm.id = item.id;\n    else\n      perform public.score_gem_keep_run(r)'
]);

-- "Recent games" can point at a Bond Match score.
select pg_temp.patch('public.my_progress()'::regprocedure, array[
  'x.lord_score, x.clan_score)', 'x.lord_score, x.clan_score, x.bond_match_game)',
  's.lord_score, s.clan_score, s.points', 's.lord_score, s.clan_score, s.bond_match_game, s.points'
]);

-- The teacher's list counts Bond Match games in "games against the computer" and "last played".
select pg_temp.patch('public.teacher_students()'::regprocedure, array[
  E'         + (select count(*)::integer from public.gem_keep_runs r where r.player = p.id),\n',
  E'         + (select count(*)::integer from public.gem_keep_runs r where r.player = p.id)\n         + (select count(*)::integer from public.bond_match_games bg where bg.player = p.id),\n',
  E'           (select max(r.finished_at) from public.gem_keep_runs r where r.player = p.id),\n',
  E'           (select max(r.finished_at) from public.gem_keep_runs r where r.player = p.id),\n           (select max(bg.finished_at) from public.bond_match_games bg where bg.player = p.id),\n'
]);

-- A new season clears Bond Match games and bests too (like Gem Keep's levels).
select pg_temp.patch('public.teacher_new_season(text)'::regprocedure, array[
  E'  get diagnostics gem_count = row_count;\n',
  E'  get diagnostics gem_count = row_count;\n  delete from public.bond_match_games where player = any (mine);\n  delete from public.bond_match_bests where player = any (mine);\n'
]);

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.bond_match_points(), public.bond_match_points_games_per_day(), public.bond_match_max_games_per_day(),
  public.score_bond_match_game(public.bond_match_games), public.score_bond_match_game_trigger(),
  public.record_bond_match_game(uuid, jsonb), public.my_bond_match(), public.teacher_bond_match_student(uuid)
from public, anon, authenticated;
grant execute on function public.my_bond_match(), public.teacher_bond_match_student(uuid) to authenticated;
grant execute on function public.record_bond_match_game(uuid, jsonb) to service_role;
