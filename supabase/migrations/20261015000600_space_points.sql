-- Stage 9.3: saving Wormholes & Black Holes games against bots, and their points.
--
-- The game is mostly luck, so it earns taking-part points only (the same win or lose), never
-- ratings, badges or leaderboard places. The numbers are in docs/SPACE-GAME-PLAN.md, section 7.
--
-- 1. bot_games, scored_games and achievement_types allow 'space'. ratings doesn't, so a space
--    rating can't exist.
-- 2. A space game keeps its seed, setup and what happened in a new `space` column. The
--    save-bot-game function replays the game from the seed before saving it.
-- 3. record_space_bot_game(): the save, for the server only. The same seed is only ever saved once.
-- 4. Scoring: 2 points for a finished space game against bots, sharing the 40-a-day bot cap.
--    The chess and checkers points don't change.
-- 5. Six space achievements, and the counts they're measured by.
-- 6. progress_rules() and teacher_student_detail() include space.

-- ---------------------------------------------------------------------------
-- 1 and 2. Tables
-- ---------------------------------------------------------------------------

alter table public.bot_games drop constraint bot_games_game_check;
alter table public.bot_games add constraint bot_games_game_check check (game in ('chess', 'checkers', 'space'));
-- Space games only: { seed, board, settings, bots, place, rockets, stats }.
alter table public.bot_games add column space jsonb;
alter table public.bot_games add constraint bot_games_space_check
  check ((game = 'space') = (space is not null) and (space is null or space ->> 'seed' is not null));
-- A seed plays exactly one game.
create unique index bot_games_space_seed on public.bot_games ((space ->> 'seed')) where space is not null;

alter table public.scored_games drop constraint scored_games_game_check;
alter table public.scored_games add constraint scored_games_game_check check (game in ('chess', 'checkers', 'space'));
-- Space games only: what the student did, for the achievements: { wormholes, blocks, stars, docked }.
alter table public.scored_games add column space jsonb;

alter table public.achievement_types drop constraint achievement_types_game_check;
alter table public.achievement_types add constraint achievement_types_game_check
  check (game in ('chess', 'checkers', 'space'));
alter table public.achievement_types drop constraint achievement_types_measure_check;
alter table public.achievement_types add constraint achievement_types_measure_check
  check (measure in ('games', 'wins', 'beat_very_easy', 'beat_easy', 'beat_medium', 'friend_wins', 'rank',
    'checkmates', 'crowns', 'friend_games', 'wormholes', 'blocks', 'star_kinds', 'docks'));

-- ---------------------------------------------------------------------------
-- 4. The rules
-- ---------------------------------------------------------------------------

-- Points for a finished space game against bots: the same whoever wins.
create function public.space_bot_points() returns integer language sql immutable set search_path = '' as $$ select 2 $$;
-- Points for a finished space game with classmates (Stage 9.4), and how many a day earn them.
create function public.space_friend_points() returns integer language sql immutable set search_path = '' as $$ select 4 $$;
create function public.space_friend_daily_games() returns integer language sql immutable set search_path = '' as $$ select 6 $$;
-- The kinds of star there are (shared/space/board.ts STAR_KINDS), for "Land on every kind of star".
create function public.space_star_kinds() returns integer language sql immutable set search_path = '' as $$ select 9 $$;

-- ---------------------------------------------------------------------------
-- 3. Saving
-- ---------------------------------------------------------------------------

-- Only the save-bot-game server function calls this (it runs with the server's key), after
-- it has checked the seed's stamp and replayed the game. The website can't call it.
create function public.record_space_bot_game(
  player uuid,
  bot_level text,
  player_side text,
  moves text[],
  result text,
  reason text,
  player_moves integer,
  counts_for_points boolean,
  space jsonb
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
    where p.id = record_space_bot_game.player and public.is_school_email(u.email)
  ) then
    raise exception 'No such player.' using errcode = '22023';
  end if;
  -- Each seed plays one game. Seen it already? Then it's the same game sent again (a retry
  -- after a Wi-Fi blip): hand back the saved one. A seed is stamped for one student, so it
  -- can't be someone else's.
  select g.id into new_id from public.bot_games g
  where g.space ->> 'seed' = record_space_bot_game.space ->> 'seed' and g.player = record_space_bot_game.player;
  if new_id is not null then
    return new_id;
  end if;
  if (select count(*) from public.bot_games g
      where g.player = record_space_bot_game.player and g.finished_at > now() - interval '1 day') >= 300 then
    raise exception 'That''s a lot of games today! Have a break and come back tomorrow.' using errcode = '54000';
  end if;
  begin
    insert into public.bot_games (player, game, bot_level, player_side, moves, result, reason, player_moves,
      counts_for_points, space)
    values (player, 'space', bot_level, player_side, moves, result, reason, player_moves, counts_for_points, space)
    returning id into new_id;
  exception when unique_violation then
    -- Two copies arrived at the same moment and the other one got there first.
    select g.id into new_id from public.bot_games g where g.space ->> 'seed' = record_space_bot_game.space ->> 'seed';
  end;
  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Scoring (same as Stage 7, plus the space line)
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
  -- Every bot game shares one daily cap, space games included.
  select coalesce(sum(s.points), 0) into earned_today
  from public.scored_games s
  where s.player = g.player and s.kind = 'bot' and s.nz_day = day;

  insert into public.scored_games (player, game, kind, bot_game, bot_level, result, reason, crowns, points, finished_at,
    nz_day, space)
  values (
    g.player, g.game, 'bot', g.id, g.bot_level, g.result, g.reason,
    case when g.game = 'checkers' then public.checkers_crowns(g.moves, g.player_side) else 0 end,
    least(
      case when g.game = 'space' then public.space_bot_points() else public.bot_points(g.bot_level, g.result) end,
      greatest(public.bot_daily_cap() - earned_today, 0)),
    g.finished_at, day,
    case when g.game = 'space' then g.space -> 'stats' end
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
                   where s2.player = who and s2.game = which_game)
  )
  from public.scored_games s
  where s.player = who and s.game = which_game
$$;

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('space-first-launch', 'space', 'First launch', '🚀', 'games', 1, 1),
  ('space-classmates', 'space', 'Finish a game with classmates', '🛰️', 'friend_games', 1, 2),
  ('space-wormholes-25', 'space', 'Ride 25 wormholes', '🌀', 'wormholes', 25, 3),
  ('space-force-field', 'space', 'Block a black hole with a Force Field', '🛡️', 'blocks', 1, 4),
  ('space-every-star', 'space', 'Land on every kind of star', '⭐', 'star_kinds', public.space_star_kinds(), 5),
  ('space-dock-10', 'space', 'Dock at the station 10 times', '🏁', 'docks', 10, 6);

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

-- The same as Stage 7, plus a line for space games. Space has no badge, so its rank is null.
-- (Space games with classmates come in Stage 9.4; until then that line is all zeros.)
create or replace function public.teacher_student_detail(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  return (
    select jsonb_build_object(
      'points', public.points_total(student),
      'level', public.level_for(public.points_total(student)),
      'games', (select jsonb_agg(jsonb_build_object(
          'game', g,
          'bot', (select jsonb_build_object(
              'played', count(*), 'won', count(*) filter (where b.result = 'won'),
              'lost', count(*) filter (where b.result = 'lost'), 'drawn', count(*) filter (where b.result = 'drawn'),
              'left', count(*) filter (where b.reason = 'abandoned'))
            from public.bot_games b where b.player = student and b.game = g),
          'friend', (select jsonb_build_object(
              'played', count(*),
              'won', count(*) filter (where m.winner = case when m.first_player = student then 'first' else 'second' end),
              'lost', count(*) filter (where m.winner = case when m.first_player = student then 'second' else 'first' end),
              'drawn', count(*) filter (where m.winner is null),
              'left', count(*) filter (where m.reason = 'abandoned'
                and m.winner = case when m.first_player = student then 'second' else 'first' end))
            from public.mp_games m
            where m.status = 'finished' and m.game = g and student in (m.first_player, m.second_player)),
          'rank', case when g <> 'space' then
            public.rank_name(public.rank_for(coalesce(r.rating, public.start_rating()), coalesce(r.rated_games, 0))) end,
          'achievements', (select count(*) from public.achievements a
            join public.achievement_types t on t.id = a.achievement where a.player = student and t.game = g)
        ) order by g)
        from unnest(array['chess', 'checkers', 'space']) as g
        left join public.ratings r on r.player = student and r.game = g),
      'recent', (select coalesce(jsonb_agg(x order by x.finished_at desc), '[]') from (
          (select b.game, 'bot' as kind, b.bot_level as against, b.result, b.reason, b.finished_at,
                  (b.space ->> 'place')::integer as place
           from public.bot_games b where b.player = student order by b.finished_at desc limit 10)
          union all
          (select m.game, 'friend', coalesce(o.display_name, 'a deleted player'),
                  case when m.winner is null then 'drawn'
                       when m.winner = case when m.first_player = student then 'first' else 'second' end then 'won'
                       else 'lost' end,
                  m.reason, m.finished_at, null
           from public.mp_games m
           left join public.profiles o
             on o.id = case when m.first_player = student then m.second_player else m.first_player end
           where m.status = 'finished' and student in (m.first_player, m.second_player)
           order by m.finished_at desc limit 10)
          order by finished_at desc limit 10) x)
    )
    where exists (select 1 from public.profiles p where p.id = student)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.space_bot_points(), public.space_friend_points(), public.space_friend_daily_games(),
  public.space_star_kinds(),
  public.record_space_bot_game(uuid, text, text, text[], text, text, integer, boolean, jsonb)
from public, anon, authenticated;
grant execute on function
  public.record_space_bot_game(uuid, text, text, text[], text, text, integer, boolean, jsonb)
to service_role;
