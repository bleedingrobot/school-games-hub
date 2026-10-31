-- Mine Runner, stage 5: how it fits into the hub (docs/MINE-PLAN.md, section 9), all through the hub_games hooks.
-- Nothing in the shared progress functions is re-created.
--
-- 1. The teacher's on/off switch: app_settings.mine_enabled, per class, OFF to start; teacher_set_mine(). The mine
--    server function reads it too and refuses to start a run while it is off.
-- 2. The hooks: its achievement counts, its lines on How points work, what a New Season clears, when a pupil last played,
--    and which pupils have progress outside points. One hub_games row ties them together.
-- 3. Measures and achievements (game = 'mine'). Points are given by the server function through add_game_points():
--    2 for the first finish of a mine, 1 for beating your own best (once a day for each mine). Right answers earn nothing.
--
-- Depends on 20261020000100_game_hooks.sql and 20261021000100_mine.sql.

-- ---------------------------------------------------------------------------
-- 1. The switch
-- ---------------------------------------------------------------------------

alter table public.app_settings add column mine_enabled boolean not null default false;

create function public.teacher_set_mine(enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null then
    raise exception 'Unknown Mine Runner setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings set mine_enabled = enabled where id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. The hooks
-- ---------------------------------------------------------------------------

-- A pupil's counts for the achievements: mines finished (the six, either way of flying), boards with a gold medal, hard
-- mines finished, and doors and pads opened by an answer in saved runs.
create function public.mine_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'mine_levels', (select count(distinct b.level)::integer from public.mine_bests b where b.player = who and b.level not like '%:hard'),
    'mine_golds', (select count(distinct b.level)::integer from public.mine_bests b where b.player = who and b.medal = 'gold'),
    'mine_hard', (select count(distinct b.level)::integer from public.mine_bests b where b.player = who and b.level like '%:hard'),
    'mine_answers', (select coalesce(sum(r.grants), 0)::integer from public.mine_runs r where r.player = who))
$$;

-- The lines on How points work (the numbers are shared/mine/config.ts: MINE_POINTS_FIRST and MINE_POINTS_BEST).
create function public.mine_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'Finish a mine for the first time: 2 points.',
    'Beat your own best time on a mine: 1 point, once a day for each mine.',
    'Right answers at doors and pads earn no points, so there is nothing to rush.'))
$$;

-- Pupils with Mine Runner progress outside points (a rebuild gives their achievements back).
create function public.mine_players()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select distinct b.player from public.mine_bests b
$$;

-- What a New Season clears (the game's points always go): times, saved runs and question lists.
create function public.mine_season(players uuid[])
returns void
language sql
set search_path = ''
as $$
  with a as (delete from public.mine_bests where player = any (players)),
       b as (delete from public.mine_runs where player = any (players))
  delete from public.mine_questions where player = any (players)
$$;

create function public.mine_last_played(player uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select max(r.created_at) from public.mine_runs r where r.player = mine_last_played.player
$$;

insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn)
values ('mine', 'mine_enabled', 'public.mine_counts(uuid)', 'public.mine_point_rules()', 'public.mine_players()',
  'public.mine_season(uuid[])', 'public.mine_last_played(uuid)');

-- ---------------------------------------------------------------------------
-- 3. Measures and achievements
-- ---------------------------------------------------------------------------

insert into public.achievement_measures (measure) values ('mine_levels'), ('mine_golds'), ('mine_hard'), ('mine_answers');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('mine-first-dive', 'mine', 'First dive', '⛏️', 'mine_levels', 1, 1),
  ('mine-explorer', 'mine', 'Mineshaft explorer', '🗺️', 'mine_levels', 6, 2),
  ('mine-gold-miner', 'mine', 'Gold miner', '🥇', 'mine_golds', 1, 3),
  ('mine-gold-rush', 'mine', 'Gold rush', '🏆', 'mine_golds', 3, 4),
  ('mine-brain-power', 'mine', 'Brain power', '🧠', 'mine_answers', 10, 5),
  ('mine-hard-hat', 'mine', 'Hard hat', '⛑️', 'mine_hard', 1, 6);

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.teacher_set_mine(boolean, uuid), public.mine_counts(uuid), public.mine_point_rules(), public.mine_players(),
  public.mine_season(uuid[]), public.mine_last_played(uuid)
from public, anon, authenticated;
grant execute on function public.teacher_set_mine(boolean, uuid) to authenticated;
