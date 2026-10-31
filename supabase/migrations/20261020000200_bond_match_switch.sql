-- Bond Match stage M.6 / M.7: the teacher's on/off switch, two-player and computer games, and How points work.
--
-- 1. The switch: app_settings.bond_match_enabled, per class like every other game, OFF to start. Pupils read it from
--    their own settings row (as for Maths Monsters); teachers change it with teacher_set_bond_match(). The bond-match
--    server function reads it too and refuses to save while it is off.
-- 2. Two-player (pass-and-play) and against-the-computer games: bond_match_games.mode. They are saved and earn the same
--    small capped points as a solo game (James, 19 Oct 2026), but only solo games change a student's bests and stars,
--    because a shared board's flips aren't one person's memory.
-- 3. hub_games: Bond Match's row (already there, from the scored_games list) gets the switch and its How points work
--    lines, so they show only for classes where it is on.
--
-- Nothing here touches the shared progress functions or Bond Match's existing rows (every old game is 'solo').

-- ---------------------------------------------------------------------------
-- 1. The switch
-- ---------------------------------------------------------------------------

alter table public.app_settings add column bond_match_enabled boolean not null default false;

create function public.teacher_set_bond_match(enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null then
    raise exception 'Unknown Bond Match setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings set bond_match_enabled = enabled where id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Two-player and computer games
-- ---------------------------------------------------------------------------

alter table public.bond_match_games
  add column mode text not null default 'solo' check (mode in ('solo', 'pass', 'bot'));

-- The same as in 20261019001000_bond_match.sql, plus `mode`: a game that isn't solo is saved and scored but leaves the
-- bests alone, and its answer carries the student's solo best for that bond and size (null if they have none yet).
create or replace function public.record_bond_match_game(player uuid, game jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  counts boolean;
  game_mode text := coalesce(game ->> 'mode', 'solo');
  best public.bond_match_bests;
begin
  if not exists (
    select 1 from public.profiles p join auth.users u on u.id = p.id
    where p.id = player and public.is_school_email(u.email)
  ) then
    raise exception 'No such player.' using errcode = '22023';
  end if;
  if game_mode not in ('solo', 'pass', 'bot') then
    raise exception 'Unknown game mode.' using errcode = '22023';
  end if;

  select g.id into new_id from public.bond_match_games g
  where g.player = record_bond_match_game.player and g.run_id = (game ->> 'runId')::uuid;
  if new_id is not null then
    select * into best from public.bond_match_bests b
    where b.player = record_bond_match_game.player and b.bond_id = game ->> 'bondId' and b.size = game ->> 'size';
    return jsonb_build_object('status', 'duplicate',
      'points', (select s.points from public.scored_games s where s.bond_match_game = new_id),
      'stars', (select g.stars from public.bond_match_games g where g.id = new_id),
      'best', case when best.player is not null
        then jsonb_build_object('flips', best.best_flips, 'seconds', best.best_seconds, 'stars', best.best_stars) end);
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
    insert into public.bond_match_games (player, run_id, bond_id, size, seed, flips, flip_count, seconds, stars, counts_for_points, mode)
    values (player, (game ->> 'runId')::uuid, game ->> 'bondId', game ->> 'size', (game ->> 'seed')::integer,
      array(select jsonb_array_elements_text(game -> 'flips')::integer), (game ->> 'flipCount')::integer,
      (game ->> 'seconds')::integer, (game ->> 'stars')::integer, counts, game_mode)
    returning id into new_id;
  exception when unique_violation then
    -- Two copies arrived at the same moment and the other one got there first.
    return jsonb_build_object('status', 'duplicate', 'points', null, 'stars', (game ->> 'stars')::integer,
      'best', case when game_mode = 'solo' then jsonb_build_object('flips', (game ->> 'flipCount')::integer,
        'seconds', (game ->> 'seconds')::integer, 'stars', (game ->> 'stars')::integer) end);
  end;

  if game_mode = 'solo' then
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
  else
    select * into best from public.bond_match_bests b
    where b.player = record_bond_match_game.player and b.bond_id = game ->> 'bondId' and b.size = game ->> 'size';
  end if;

  return jsonb_build_object('status', 'saved',
    'points', (select s.points from public.scored_games s where s.bond_match_game = new_id),
    'stars', (game ->> 'stars')::integer,
    'best', case when best.player is not null
      then jsonb_build_object('flips', best.best_flips, 'seconds', best.best_seconds, 'stars', best.best_stars) end);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. How points work, and the switch, through hub_games
-- ---------------------------------------------------------------------------

create function public.bond_match_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    format('Finish a game: %s points, for your first %s games each day.',
      public.bond_match_points(), public.bond_match_points_games_per_day())))
$$;

insert into public.hub_games (id) values ('bond-match') on conflict (id) do nothing;
update public.hub_games
set switch_column = 'bond_match_enabled', rules_fn = 'public.bond_match_point_rules()'::regprocedure
where id = 'bond-match';

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function public.teacher_set_bond_match(boolean, uuid), public.bond_match_point_rules()
from public, anon, authenticated;
grant execute on function public.teacher_set_bond_match(boolean, uuid) to authenticated;
