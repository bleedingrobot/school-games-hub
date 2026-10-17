-- Stage P.4: saving Power Clash games against bots, and their points.
--
-- NOT APPLIED to the live database yet. Apply it, then deploy the save-bot-game function
-- (supabase/functions/save-bot-game/index.ts), then switch the card on (src/games/registry.ts).
--
-- Power Clash is taking-part only (docs/POWER-CLASH-PLAN.md, section 6): luck and powers make
-- a rating unfair, so it is never ranked. A finished bot game earns 2 points, win or lose, inside
-- the same daily bot cap as every other game. A game left part-way earns nothing.
--
-- 1. bot_games, scored_games and achievement_types allow 'power-clash'. ratings doesn't, so a
--    Power Clash rating can't exist.
-- 2. A Power Clash game keeps its seed, side, both sets of powers and what happened in a new
--    `power_clash` column. The save-bot-game function replays the match from the seed before
--    saving it.
-- 3. record_power_clash_bot_game(): the save, for the server only. A seed is only ever saved once.
-- 4. Scoring: score_bot_game() keeps the student's stats and gives 2 points for Power Clash.
-- 5. Three Power Clash achievements, and the counts they're measured by.
-- 6. progress_rules() includes Power Clash's points.
--
-- Built on the latest versions of score_bot_game(), progress_counts() and progress_rules()
-- (Gem Keep, 20261017001100). If another migration changes them before this is applied, merge
-- the Power Clash lines into the newer versions rather than running this over them.

-- ---------------------------------------------------------------------------
-- 1 and 2. Tables
-- ---------------------------------------------------------------------------

alter table public.bot_games drop constraint bot_games_game_check;
alter table public.bot_games add constraint bot_games_game_check
  check (game in ('chess', 'checkers', 'space', '101', 'power-clash'));
-- Power Clash games only: { seed, side, loadouts, roundsWon, roundsLost, roundsDrawn, stats }.
alter table public.bot_games add column power_clash jsonb;
alter table public.bot_games add constraint bot_games_power_clash_check
  check ((game = 'power-clash') = (power_clash is not null) and (power_clash is null or power_clash ->> 'seed' is not null));
-- A seed plays exactly one game.
create unique index bot_games_power_clash_seed on public.bot_games ((power_clash ->> 'seed')) where power_clash is not null;

alter table public.scored_games drop constraint scored_games_game_check;
alter table public.scored_games add constraint scored_games_game_check
  check (game in ('chess', 'checkers', 'space', '101', 'gem-keep', 'power-clash'));
-- Power Clash games only: what the student did, for the achievements:
-- { powersUsed, bodySwapWins, noPowerWin, roundsWon, roundsLost, roundsDrawn }.
alter table public.scored_games add column power_clash jsonb;

alter table public.achievement_types drop constraint achievement_types_game_check;
alter table public.achievement_types add constraint achievement_types_game_check
  check (game in ('chess', 'checkers', 'space', '101', 'gem-keep', 'power-clash'));
alter table public.achievement_types drop constraint achievement_types_measure_check;
alter table public.achievement_types add constraint achievement_types_measure_check
  check (measure in ('games', 'wins', 'beat_very_easy', 'beat_easy', 'beat_medium', 'friend_wins', 'rank',
    'checkmates', 'crowns', 'friend_games', 'wormholes', 'blocks', 'star_kinds', 'docks',
    'zero_hands', 'triples', 'knock_wins', 'saved_by_three',
    'levels_won', 'level_keys', 'three_star_levels', 'stars',
    'all_three_powers', 'body_swap_wins', 'no_power_wins'));

-- ---------------------------------------------------------------------------
-- 4. The rules
-- ---------------------------------------------------------------------------

-- Points for a finished bot game (shared/power-clash/save.ts decides if it counts).
create function public.power_clash_bot_points() returns integer language sql immutable set search_path = '' as $$ select 2 $$;

-- ---------------------------------------------------------------------------
-- 3. Saving
-- ---------------------------------------------------------------------------

-- Only the save-bot-game server function calls this (it runs with the server's key), after
-- it has checked the seed's stamp and replayed the match. The website can't call it.
create function public.record_power_clash_bot_game(
  player uuid,
  bot_level text,
  player_side text,
  moves text[],
  result text,
  reason text,
  player_moves integer,
  counts_for_points boolean,
  power_clash jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not exists (
    select 1 from public.profiles p join auth.users u on u.id = p.id
    where p.id = record_power_clash_bot_game.player and public.is_school_email(u.email)
  ) then
    raise exception 'No such player.' using errcode = '22023';
  end if;
  -- Each seed plays one game. Seen it already? Then it's the same game sent again (a retry
  -- after a Wi-Fi blip): hand back the saved one. A seed is stamped for one student, so it
  -- can't be someone else's.
  select g.id into new_id from public.bot_games g
  where g.power_clash ->> 'seed' = record_power_clash_bot_game.power_clash ->> 'seed'
    and g.player = record_power_clash_bot_game.player;
  if new_id is not null then
    return new_id;
  end if;
  if (select count(*) from public.bot_games g
      where g.player = record_power_clash_bot_game.player and g.finished_at > now() - interval '1 day') >= 300 then
    raise exception 'That''s a lot of games today! Have a break and come back tomorrow.' using errcode = '54000';
  end if;
  begin
    insert into public.bot_games (player, game, bot_level, player_side, moves, result, reason, player_moves,
      counts_for_points, power_clash)
    values (player, 'power-clash', bot_level, player_side, moves, result, reason, player_moves, counts_for_points,
      power_clash)
    returning id into new_id;
  exception when unique_violation then
    -- Two copies arrived at the same moment and the other one got there first.
    select g.id into new_id from public.bot_games g
    where g.power_clash ->> 'seed' = record_power_clash_bot_game.power_clash ->> 'seed';
  end;
  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Scoring (same as Gem Keep's version, plus Power Clash)
-- ---------------------------------------------------------------------------

create or replace function public.score_bot_game(g public.bot_games)
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
  -- Every bot game shares one daily cap, space, 101, Power Clash and Gem Keep included.
  select coalesce(sum(s.points), 0) into earned_today
  from public.scored_games s
  where s.player = g.player and s.kind in ('bot', 'solo') and s.nz_day = day;

  insert into public.scored_games (player, game, kind, bot_game, bot_level, result, reason, crowns, points, finished_at,
    nz_day, space, card101, power_clash)
  values (
    g.player, g.game, 'bot', g.id, g.bot_level, g.result, g.reason,
    case when g.game = 'checkers' then public.checkers_crowns(g.moves, g.player_side) else 0 end,
    least(
      case when g.game = 'space' then public.space_bot_points()
           when g.game = 'power-clash' then public.power_clash_bot_points()
           else public.bot_points(g.bot_level, g.result) end,
      greatest(public.bot_daily_cap() - earned_today, 0)),
    g.finished_at, day,
    case when g.game = 'space' then g.space -> 'stats' end,
    case when g.game = '101' then g.card101 -> 'stats' end,
    case when g.game = 'power-clash' then g.power_clash -> 'stats' end
  )
  on conflict do nothing;

  perform public.award_achievements(g.player, g.game, g.finished_at);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Achievements
-- ---------------------------------------------------------------------------

create or replace function public.progress_counts(who uuid, which_game text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'games', count(*),
    'wins', count(*) filter (where s.result = 'won'),
    'beat_very_easy', count(*) filter (where s.result = 'won' and s.bot_level = 'very-easy'),
    'beat_easy', count(*) filter (where s.result = 'won' and s.bot_level = 'easy'),
    'beat_medium', count(*) filter (where s.result = 'won' and s.bot_level = 'medium'),
    'friend_wins', count(*) filter (where s.result = 'won' and s.kind = 'friend'),
    'checkmates', count(*) filter (where s.result = 'won' and s.reason = 'checkmate'),
    'crowns', coalesce(sum(s.crowns), 0),
    'rank', coalesce((select r.best_rank from public.ratings r where r.player = who and r.game = which_game), 0),
    'friend_games', count(*) filter (where s.kind = 'friend'),
    'wormholes', coalesce(sum((s.space ->> 'wormholes')::integer), 0),
    'blocks', coalesce(sum((s.space ->> 'blocks')::integer), 0),
    'docks', count(*) filter (where (s.space ->> 'docked')::boolean),
    'star_kinds', (select count(distinct star) from public.scored_games s2,
                     jsonb_array_elements_text(coalesce(s2.space -> 'stars', '[]')) as star
                   where s2.player = who and s2.game = which_game),
    'zero_hands', coalesce(sum((s.card101 ->> 'zeroHands')::integer), 0),
    'triples', coalesce(sum((s.card101 ->> 'triples')::integer), 0),
    'knock_wins', coalesce(sum((s.card101 ->> 'knockWins')::integer), 0),
    'saved_by_three', coalesce(sum((s.card101 ->> 'savedByThree')::integer), 0),
    'levels_won', (select count(*) from public.gem_keep_progress g where g.player = who and g.wins > 0),
    'level_keys', (select count(*) from public.gem_keep_progress g where g.player = who and g.key_passed),
    'three_star_levels', (select count(*) from public.gem_keep_progress g where g.player = who and g.best_stars = 3),
    'stars', (select coalesce(sum(g.best_stars), 0) from public.gem_keep_progress g where g.player = who),
    'all_three_powers', count(*) filter (where (s.power_clash ->> 'powersUsed')::integer >= 3),
    'body_swap_wins', coalesce(sum((s.power_clash ->> 'bodySwapWins')::integer), 0),
    'no_power_wins', count(*) filter (where (s.power_clash ->> 'noPowerWin')::boolean)
  )
  from public.scored_games s
  where s.player = who and s.game = which_game
$$;

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('pc-first-game', 'power-clash', 'Play a game of Power Clash', '⚡', 'games', 1, 1),
  ('pc-all-three', 'power-clash', 'Used all three powers in one match', '🎴', 'all_three_powers', 1, 2),
  ('pc-body-swap-win', 'power-clash', 'Won a round with a Body Swap', '🌀', 'body_swap_wins', 1, 3),
  ('pc-no-power-win', 'power-clash', 'Won a match without using a power', '🧘', 'no_power_wins', 1, 4);

-- ---------------------------------------------------------------------------
-- 6. What the website reads
-- ---------------------------------------------------------------------------

create or replace function public.progress_rules()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'bot', (select jsonb_object_agg(level, jsonb_build_object(
              'lost', public.bot_points(level, 'lost'),
              'drawn', public.bot_points(level, 'drawn'),
              'won', public.bot_points(level, 'won')))
            from unnest(array['very-easy', 'easy', 'medium']) as level),
    'friend', jsonb_build_object('lost', public.friend_points('lost'), 'drawn', public.friend_points('drawn'),
              'won', public.friend_points('won')),
    'space', jsonb_build_object('bot', public.space_bot_points(), 'friend', public.space_friend_points(),
              'friendDailyGames', public.space_friend_daily_games(), 'minTurns', 5),
    'card101', jsonb_build_object('friendLost', public.card101_friend_points('lost'),
              'friendWon', public.card101_friend_points('won'),
              'friendDailyGames', public.card101_friend_daily_games(), 'minRounds', public.card101_min_rounds()),
    'gemKeep', jsonb_build_object(
              'won', jsonb_build_array(public.gem_keep_points('won', 1), public.gem_keep_points('won', 2),
                public.gem_keep_points('won', 3)),
              'lost', public.gem_keep_points('lost', 0), 'minWavesForLoss', public.gem_keep_min_waves_for_loss()),
    'powerClash', jsonb_build_object('bot', public.power_clash_bot_points()),
    'botDailyCap', public.bot_daily_cap(),
    'pairDailyLimit', public.pair_daily_limit(),
    'achievementPoints', public.achievement_points(),
    'levels', (select jsonb_agg(public.level_start(l) order by l) from generate_series(1, 10) as l),
    'ratingK', public.rating_k(),
    'weeklyMinGames', 3,
    'allTimeMinGames', 5,
    'improvedMinGames', 3,
    'championMinGames', 15
  )
  where public.is_school_user()
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.power_clash_bot_points(),
  public.record_power_clash_bot_game(uuid, text, text, text[], text, text, integer, boolean, jsonb)
from public, anon, authenticated;
grant execute on function
  public.record_power_clash_bot_game(uuid, text, text, text[], text, text, integer, boolean, jsonb)
to service_role;
