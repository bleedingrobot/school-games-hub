-- Stage 7: points, levels, ratings, achievements, leaderboards and the teacher view.
--
-- Everything is worked out here in the database, the moment a game is saved: a trigger on
-- bot_games (when a game is saved) and one on mp_games (when a game finishes) add points,
-- update ratings and hand out achievements. The website can only read the results through
-- the small read-only functions below. It can't write to any of these tables, and it can't
-- call the functions that fill them. Only games with counts_for_points = true earn anything.
-- The rules, with the numbers, are in docs/PLAN.md ("Stage 7 design").

-- ---------------------------------------------------------------------------
-- The rules. Every number lives here, once.
-- ---------------------------------------------------------------------------

-- Points for a bot game that counts.
create function public.bot_points(bot_level text, result text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case bot_level
    when 'very-easy' then case result when 'won' then 3 when 'drawn' then 2 else 1 end
    when 'easy'      then case result when 'won' then 5 when 'drawn' then 3 else 2 end
    when 'medium'    then case result when 'won' then 8 when 'drawn' then 5 else 3 end
    else 0
  end
$$;

-- Points for a friend game that counts.
create function public.friend_points(result text)
returns integer
language sql
immutable
set search_path = ''
as $$ select case result when 'won' then 8 when 'drawn' then 6 else 4 end $$;

-- Most points a student can earn from bot games in one New Zealand day.
create function public.bot_daily_cap() returns integer language sql immutable set search_path = '' as $$ select 40 $$;
-- Games between the same two students each NZ day that earn points and change ratings.
create function public.pair_daily_limit() returns integer language sql immutable set search_path = '' as $$ select 5 $$;
create function public.achievement_points() returns integer language sql immutable set search_path = '' as $$ select 10 $$;
create function public.start_rating() returns integer language sql immutable set search_path = '' as $$ select 1000 $$;
create function public.rating_k() returns integer language sql immutable set search_path = '' as $$ select 20 $$;

-- Badges: 0 Bronze, 1 Silver, 2 Gold, 3 Champion.
create function public.rank_for(rating integer, rated_games integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when rating >= 1150 and rated_games >= 15 then 3
    when rating >= 1080 then 2
    when rating >= 1030 then 1
    else 0
  end
$$;

create function public.rank_name(rank integer)
returns text
language sql
immutable
set search_path = ''
as $$ select (array['bronze', 'silver', 'gold', 'champion'])[rank + 1] $$;

-- Total points needed to reach a level: 0, 50, 125, 225, 350, ... (each step 25 more).
create function public.level_start(level integer)
returns integer
language sql
immutable
set search_path = ''
as $$ select 25 * (level - 1) * (level + 2) / 2 $$;

create function public.level_for(points integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(max(l), 1)::integer from generate_series(1, 1000) as l
  where public.level_start(l) <= greatest(points, 0)
$$;

-- Days and weeks run on New Zealand time. Weeks start on Monday at midnight.
create function public.nz_day(at timestamptz)
returns date
language sql
immutable
set search_path = ''
as $$ select (at at time zone 'Pacific/Auckland')::date $$;

create function public.nz_week_start(at timestamptz)
returns timestamptz
language sql
immutable
set search_path = ''
as $$ select date_trunc('week', at at time zone 'Pacific/Auckland') at time zone 'Pacific/Auckland' $$;

-- How many men one side crowned in a checkers game, by following the moves.
-- Moves look like '11-15' or '15x24x31'. Red starts on 1-12 and is crowned on 29-32;
-- White starts on 21-32 and is crowned on 1-4. A piece crowned part-way through a jump
-- stops there, so only the last square of a move matters. Jumped pieces don't need
-- removing: a square is only looked at again once a piece has moved onto it.
create function public.checkers_crowns(moves text[], side text)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  -- One letter per square: r/w for men, R/W for kings, '.' for empty.
  board text[] := array_fill('.'::text, array[32]);
  squares text[];
  from_sq integer;
  to_sq integer;
  piece text;
  crowned integer := 0;
  i integer;
begin
  for i in 1..12 loop board[i] := 'r'; end loop;
  for i in 21..32 loop board[i] := 'w'; end loop;
  for i in 1..coalesce(cardinality(moves), 0) loop
    -- The server has already checked every move; anything unreadable is skipped, never an error.
    continue when moves[i] !~ '^[0-9]{1,2}([-x][0-9]{1,2})+$';
    squares := regexp_split_to_array(moves[i], '[-x]');
    from_sq := squares[1]::integer;
    to_sq := squares[cardinality(squares)]::integer;
    continue when from_sq not between 1 and 32 or to_sq not between 1 and 32;
    piece := board[from_sq];
    board[from_sq] := '.';
    if piece = 'r' and to_sq >= 29 then
      piece := 'R';
      if side = 'red' then crowned := crowned + 1; end if;
    elsif piece = 'w' and to_sq <= 4 then
      piece := 'W';
      if side = 'white' then crowned := crowned + 1; end if;
    end if;
    board[to_sq] := piece;
  end loop;
  return crowned;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables. Nobody can write to these from the website; nobody can read them directly
-- either. The website reads them through the functions further down.
-- ---------------------------------------------------------------------------

-- One row per player per game that counts.
create table public.scored_games (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  game text not null check (game in ('chess', 'checkers')),
  kind text not null check (kind in ('bot', 'friend')),
  bot_game uuid references public.bot_games (id) on delete cascade,
  mp_game uuid references public.mp_games (id) on delete cascade,
  -- The other student in a friend game. Becomes null if they're deleted.
  opponent uuid references public.profiles (id) on delete set null,
  bot_level text,
  result text not null check (result in ('won', 'lost', 'drawn')),
  reason text not null,
  crowns integer not null default 0,
  points integer not null check (points >= 0),
  -- Friend games only: did it change ratings, and by how much.
  rated boolean not null default false,
  rating_change integer,
  finished_at timestamptz not null,
  nz_day date not null,
  check ((kind = 'bot') = (bot_game is not null) and (kind = 'friend') = (mp_game is not null))
);
create unique index scored_games_bot on public.scored_games (player, bot_game) where bot_game is not null;
create unique index scored_games_friend on public.scored_games (player, mp_game) where mp_game is not null;
create index scored_games_player on public.scored_games (player, game, finished_at);
create index scored_games_recent on public.scored_games (finished_at);

create table public.ratings (
  player uuid not null references public.profiles (id) on delete cascade,
  game text not null check (game in ('chess', 'checkers')),
  rating integer not null,
  rated_games integer not null default 0,
  best_rank integer not null default 0,
  primary key (player, game)
);

-- The list of achievements. The website reads it for the names and emojis.
create table public.achievement_types (
  id text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  game text not null check (game in ('chess', 'checkers')),
  name text not null,
  emoji text not null,
  -- Which count it's measured by (see progress_counts) and the number to reach.
  measure text not null check (measure in ('games', 'wins', 'beat_very_easy', 'beat_easy', 'beat_medium',
    'friend_wins', 'rank', 'checkmates', 'crowns')),
  goal integer not null check (goal > 0),
  sort integer not null
);

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort)
select g || '-' || a.id, g, a.name, a.emoji, a.measure, a.goal, a.sort
from unnest(array['chess', 'checkers']) as g
cross join (values
  ('first-game', 'First game', '🎮', 'games', 1, 1),
  ('first-win', 'First win', '🏆', 'wins', 1, 2),
  ('games-10', 'Play 10 games', '🔟', 'games', 10, 3),
  ('games-50', 'Play 50 games', '🎖️', 'games', 50, 4),
  ('beat-very-easy', 'Beat the Very Easy bot', '🐣', 'beat_very_easy', 1, 5),
  ('beat-easy', 'Beat the Easy bot', '🤖', 'beat_easy', 1, 6),
  ('beat-medium', 'Beat the Medium bot', '🦾', 'beat_medium', 1, 7),
  ('friend-win', 'Beat a friend', '🤝', 'friend_wins', 1, 8),
  ('silver', 'Reach Silver', '🥈', 'rank', 1, 10),
  ('gold', 'Reach Gold', '🥇', 'rank', 2, 11),
  ('champion', 'Reach Champion', '🌟', 'rank', 3, 12)
) as a (id, name, emoji, measure, goal, sort);
insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('chess-checkmate', 'chess', 'Checkmate!', '♟️', 'checkmates', 1, 9),
  ('checkers-crown-5', 'checkers', 'Crown 5 kings', '👑', 'crowns', 5, 9);

create table public.achievements (
  player uuid not null references public.profiles (id) on delete cascade,
  achievement text not null references public.achievement_types (id) on delete cascade,
  earned_at timestamptz not null,
  primary key (player, achievement)
);
create index achievements_recent on public.achievements (earned_at);

alter table public.scored_games enable row level security;
alter table public.ratings enable row level security;
alter table public.achievement_types enable row level security;
alter table public.achievements enable row level security;
revoke all on public.scored_games, public.ratings, public.achievement_types, public.achievements from anon, authenticated;
grant select on public.achievement_types to authenticated;

create policy "School users can read the list of achievements"
on public.achievement_types for select to authenticated
using (public.is_school_user());

-- ---------------------------------------------------------------------------
-- Working out the scores (run by the triggers; the website can't call these)
-- ---------------------------------------------------------------------------

-- The counts achievements are measured by, for one player and one game.
create function public.progress_counts(who uuid, which_game text)
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
    'rank', coalesce((select r.best_rank from public.ratings r where r.player = who and r.game = which_game), 0)
  )
  from public.scored_games s
  where s.player = who and s.game = which_game
$$;

-- Hands out any achievements the player has now reached. Dated with the game that did it.
create function public.award_achievements(who uuid, which_game text, at timestamptz)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.achievements (player, achievement, earned_at)
  select who, t.id, at
  from public.achievement_types t, public.progress_counts(who, which_game) as c
  where t.game = which_game and (c ->> t.measure)::integer >= t.goal
  on conflict do nothing
$$;

create function public.score_bot_game(g public.bot_games)
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
  select coalesce(sum(s.points), 0) into earned_today
  from public.scored_games s
  where s.player = g.player and s.kind = 'bot' and s.nz_day = day;

  insert into public.scored_games (player, game, kind, bot_game, bot_level, result, reason, crowns, points, finished_at, nz_day)
  values (
    g.player, g.game, 'bot', g.id, g.bot_level, g.result, g.reason,
    case when g.game = 'checkers' then public.checkers_crowns(g.moves, g.player_side) else 0 end,
    least(public.bot_points(g.bot_level, g.result), greatest(public.bot_daily_cap() - earned_today, 0)),
    g.finished_at, day
  )
  on conflict do nothing;

  perform public.award_achievements(g.player, g.game, g.finished_at);
end;
$$;

create function public.score_friend_game(g public.mp_games)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  day date := public.nz_day(g.finished_at);
  first_rating integer;
  second_rating integer;
  first_games integer;
  second_games integer;
  together_today integer := 0;
  is_rated boolean;
  first_score numeric;
  first_change integer := null;
  side text;
  who uuid;
  other uuid;
  change integer;
  result text;
begin
  if g.status <> 'finished' or not g.counts_for_points then
    return;
  end if;
  -- Already scored (the row can be touched again after it finishes, e.g. for a rematch).
  if exists (select 1 from public.scored_games s where s.mp_game = g.id) then
    return;
  end if;

  -- The same two students: only their first few games together each day count.
  if g.first_player is not null and g.second_player is not null then
    select count(*) into together_today
    from public.scored_games s
    where s.player = g.first_player and s.opponent = g.second_player and s.kind = 'friend' and s.nz_day = day;
  end if;
  is_rated := together_today < public.pair_daily_limit();

  if is_rated then
    -- A missing (deleted) player counts as a new player.
    select r.rating, r.rated_games into first_rating, first_games from public.ratings r
    where r.player = g.first_player and r.game = g.game;
    select r.rating, r.rated_games into second_rating, second_games from public.ratings r
    where r.player = g.second_player and r.game = g.game;
    first_rating := coalesce(first_rating, public.start_rating());
    second_rating := coalesce(second_rating, public.start_rating());
    first_score := case g.winner when 'first' then 1 when 'second' then 0 else 0.5 end;
    first_change := round(public.rating_k() * (first_score - 1 / (1 + power(10::numeric, (second_rating - first_rating) / 400.0))));
  end if;

  foreach side in array array['first', 'second'] loop
    who := case side when 'first' then g.first_player else g.second_player end;
    other := case side when 'first' then g.second_player else g.first_player end;
    continue when who is null;
    result := case when g.winner is null then 'drawn' when g.winner = side then 'won' else 'lost' end;
    change := case when not is_rated then null when side = 'first' then first_change else -first_change end;

    if is_rated then
      insert into public.ratings as r (player, game, rating, rated_games, best_rank)
      values (who, g.game, public.start_rating() + change, 1, public.rank_for(public.start_rating() + change, 1))
      on conflict (player, game) do update
      set rating = r.rating + change,
          rated_games = r.rated_games + 1,
          best_rank = greatest(r.best_rank, public.rank_for(r.rating + change, r.rated_games + 1));
    end if;

    insert into public.scored_games (player, game, kind, mp_game, opponent, result, reason, crowns, points, rated, rating_change, finished_at, nz_day)
    values (
      who, g.game, 'friend', g.id, other, result, g.reason,
      case when g.game = 'checkers' then public.checkers_crowns(g.moves, case side when 'first' then 'red' else 'white' end) else 0 end,
      case when is_rated then public.friend_points(result) else 0 end,
      is_rated, change, g.finished_at, day
    )
    on conflict do nothing;

    perform public.award_achievements(who, g.game, g.finished_at);
  end loop;
end;
$$;

create function public.score_bot_game_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.score_bot_game(new);
  return null;
exception when others then
  -- Never lose a saved game because scoring went wrong. rebuild_progress() can fix scores later.
  raise warning 'scoring a bot game failed (%)', sqlstate;
  return null;
end;
$$;

create function public.score_friend_game_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.score_friend_game(new);
  return null;
exception when others then
  -- Never lose a saved game because scoring went wrong. rebuild_progress() can fix scores later.
  raise warning 'scoring a friend game failed (%)', sqlstate;
  return null;
end;
$$;

create trigger score_after_save
after insert on public.bot_games
for each row execute function public.score_bot_game_trigger();

create trigger score_when_finished
after insert or update of status on public.mp_games
for each row
when (new.status = 'finished')
execute function public.score_friend_game_trigger();

-- Wipes every score and works them all out again from the saved games, oldest first.
-- Used once, to fill in scores for games saved before Stage 7. Only the database owner can
-- run it (in the SQL Editor): select public.rebuild_progress();
-- A deleted student's rating is gone, so their old opponents' games are re-scored as if
-- the deleted student were new (1000).
create function public.rebuild_progress()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item record;
begin
  delete from public.achievements;
  delete from public.scored_games;
  delete from public.ratings;
  for item in
    select 'bot' as kind, b.id, b.finished_at from public.bot_games b where b.counts_for_points
    union all
    select 'friend', m.id, m.finished_at from public.mp_games m where m.status = 'finished' and m.counts_for_points
    order by finished_at, id
  loop
    if item.kind = 'bot' then
      perform public.score_bot_game(b) from public.bot_games b where b.id = item.id;
    else
      perform public.score_friend_game(m) from public.mp_games m where m.id = item.id;
    end if;
  end loop;
  return jsonb_build_object(
    'scored_games', (select count(*) from public.scored_games),
    'achievements', (select count(*) from public.achievements),
    'ratings', (select count(*) from public.ratings)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Reading, for students
-- ---------------------------------------------------------------------------

-- The numbers behind "How points work", so the page always matches the database.
create function public.progress_rules()
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

-- Total points: from games, plus the achievement bonus.
create function public.points_total(who uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (coalesce((select sum(s.points) from public.scored_games s where s.player = who), 0)
        + public.achievement_points() * (select count(*) from public.achievements a where a.player = who))::integer
$$;

-- How far through a badge a rating is: the next badge and a fraction, or null at the top.
create function public.rank_progress(rating integer, rated_games integer)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'rank', public.rank_name(public.rank_for(rating, rated_games)),
    'next', case public.rank_for(rating, rated_games) when 0 then 'silver' when 1 then 'gold' when 2 then 'champion' end,
    'progress', case public.rank_for(rating, rated_games)
      when 0 then greatest(0, least(1, (rating - public.start_rating()) / 30.0))
      when 1 then (rating - 1030) / 50.0
      when 2 then least(1, (rating - 1080) / 70.0)
    end,
    -- At Gold with a Champion rating, but not enough games yet.
    'gamesNeeded', case when public.rank_for(rating, rated_games) = 2 and rating >= 1150 then 15 - rated_games end,
    'ratedGames', rated_games
  )
$$;

-- Everything the dashboard and profile show about the signed-in student's progress.
-- No raw ratings: badges and how far to the next one.
create function public.my_progress()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id where public.is_school_user()),
  totals as (select public.points_total(me.id) as points from me),
  week as (select public.nz_week_start(now()) as start)
  select jsonb_build_object(
    'points', t.points,
    'level', public.level_for(t.points),
    'levelStart', public.level_start(public.level_for(t.points)),
    'nextLevelAt', public.level_start(public.level_for(t.points) + 1),
    'weekPoints', (select coalesce(sum(s.points), 0) from public.scored_games s, week
                   where s.player = me.id and s.finished_at >= week.start)
                + public.achievement_points() * (select count(*) from public.achievements a, week
                   where a.player = me.id and a.earned_at >= week.start),
    'games', (select jsonb_agg(jsonb_build_object(
                'game', g,
                'rank', public.rank_progress(coalesce(r.rating, public.start_rating()), coalesce(r.rated_games, 0)),
                'weekRatingChange', (select sum(s.rating_change) from public.scored_games s, week
                   where s.player = me.id and s.game = g and s.rated and s.finished_at >= week.start)
              ) order by g)
              from unnest(array['chess', 'checkers']) as g
              left join public.ratings r on r.player = me.id and r.game = g),
    'achievements', (select jsonb_agg(jsonb_build_object(
                'id', at.id, 'game', at.game, 'name', at.name, 'emoji', at.emoji, 'measure', at.measure,
                'goal', at.goal,
                'progress', least((public.progress_counts(me.id, at.game) ->> at.measure)::integer, at.goal),
                'earnedAt', a.earned_at
              ) order by at.game, at.sort)
              from public.achievement_types at
              left join public.achievements a on a.player = me.id and a.achievement = at.id),
    -- Points earned by the latest games, so Recent games can show "+5".
    'recent', (select coalesce(jsonb_agg(jsonb_build_object('id', coalesce(x.bot_game, x.mp_game), 'points', x.points)), '[]')
               from (select s.bot_game, s.mp_game, s.points from public.scored_games s
                     where s.player = me.id order by s.finished_at desc limit 20) x)
  )
  from me, totals t
$$;

-- One leaderboard: the top 10, plus the signed-in student's own place if they're lower
-- down (or not on it yet). Only names, avatars and badges: no IDs, emails or classes.
-- board: 'week' (points this week), 'all-time' (rating), 'improved' (rating rise this week).
create function public.leaderboard(game text, board text)
returns table (
  place integer,
  display_name text,
  avatar jsonb,
  rank text,
  points integer,
  games integer,
  is_me boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  week_start timestamptz := public.nz_week_start(now());
  which_game text := leaderboard.game;
begin
  if not public.is_school_user() then
    return;
  end if;
  if which_game not in ('chess', 'checkers') or board not in ('week', 'all-time', 'improved') then
    raise exception 'That leaderboard doesn''t exist.' using errcode = '22023';
  end if;

  return query
  with players as (
    -- Everyone who could be on a board: not hidden.
    select p.id, p.display_name, p.avatar,
           coalesce(r.rating, public.start_rating()) as rating,
           coalesce(r.rated_games, 0) as rated_games
    from public.profiles p
    left join public.ratings r on r.player = p.id and r.game = which_game
    where not p.hidden
  ),
  this_week as (
    select s.player,
           sum(s.points)::integer as points,
           count(*)::integer as games,
           count(*) filter (where s.rated)::integer as rated,
           coalesce(sum(s.rating_change) filter (where s.rated), 0)::integer as rise
    from public.scored_games s
    where s.game = which_game and s.finished_at >= week_start
    group by s.player
  ),
  week_badges as (
    select a.player, count(*)::integer * public.achievement_points() as points
    from public.achievements a join public.achievement_types t on t.id = a.achievement
    where t.game = which_game and a.earned_at >= week_start
    group by a.player
  ),
  scored as (
    select pl.id, pl.display_name, pl.avatar,
           public.rank_name(public.rank_for(pl.rating, pl.rated_games)) as rank,
           case board
             when 'week' then coalesce(w.points, 0) + coalesce(wb.points, 0)
             when 'all-time' then pl.rating
             else coalesce(w.rise, 0)
           end as score,
           case board
             when 'week' then coalesce(w.games, 0)
             when 'all-time' then pl.rated_games
             else coalesce(w.rated, 0)
           end as games,
           case board
             when 'week' then coalesce(w.games, 0) >= 3
             when 'all-time' then pl.rated_games >= 5
             else coalesce(w.rated, 0) >= 3 and coalesce(w.rise, 0) > 0
           end as qualifies
    from players pl
    left join this_week w on w.player = pl.id
    left join week_badges wb on wb.player = pl.id
  ),
  placed as (
    select s.*, rank() over (order by s.score desc)::integer as place,
           row_number() over (order by s.score desc, s.display_name) as row_order
    from scored s where s.qualifies
  )
  select pl.place, pl.display_name, pl.avatar, pl.rank,
         case when board = 'week' then pl.score end,
         pl.games, pl.id = auth.uid()
  from placed pl
  where pl.row_order <= 10 or pl.id = auth.uid()
  union all
  -- Not on the board yet: just their own line, with no place, so the page can say why.
  select null, s.display_name, s.avatar, s.rank, case when board = 'week' then s.score end, s.games, true
  from scored s
  where s.id = auth.uid() and not s.qualifies
  order by 1 nulls last, 2;
end;
$$;

-- ---------------------------------------------------------------------------
-- Teachers
-- ---------------------------------------------------------------------------

-- Everyone with an account: what the teacher list shows. Teachers only.
create function public.teacher_students()
returns table (
  id uuid,
  display_name text,
  avatar jsonb,
  role text,
  hidden boolean,
  bot_games integer,
  friend_games integer,
  points integer,
  last_played timestamptz,
  joined timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  return query
  select p.id, p.display_name, p.avatar, p.role, p.hidden,
         (select count(*)::integer from public.bot_games b where b.player = p.id),
         (select count(*)::integer from public.mp_games m
          where m.status = 'finished' and p.id in (m.first_player, m.second_player)),
         public.points_total(p.id),
         greatest(
           (select max(b.finished_at) from public.bot_games b where b.player = p.id),
           (select max(m.finished_at) from public.mp_games m
            where m.status = 'finished' and p.id in (m.first_player, m.second_player))),
         p.created_at
  from public.profiles p
  order by p.role desc, p.display_name;
end;
$$;

-- One student's stats and recent games, for the teacher's detail panel. Teachers only.
-- Friend games show the other player's name only.
create function public.teacher_student_detail(student uuid)
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
          'rank', public.rank_name(public.rank_for(coalesce(r.rating, public.start_rating()), coalesce(r.rated_games, 0))),
          'achievements', (select count(*) from public.achievements a
            join public.achievement_types t on t.id = a.achievement where a.player = student and t.game = g)
        ) order by g)
        from unnest(array['chess', 'checkers']) as g
        left join public.ratings r on r.player = student and r.game = g),
      'recent', (select coalesce(jsonb_agg(x order by x.finished_at desc), '[]') from (
          (select b.game, 'bot' as kind, b.bot_level as against, b.result, b.reason, b.finished_at
           from public.bot_games b where b.player = student order by b.finished_at desc limit 10)
          union all
          (select m.game, 'friend', coalesce(o.display_name, 'a deleted player'),
                  case when m.winner is null then 'drawn'
                       when m.winner = case when m.first_player = student then 'first' else 'second' end then 'won'
                       else 'lost' end,
                  m.reason, m.finished_at
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

-- The Stage 3 switch updated a table without saying which row; say so, to be safe.
create or replace function public.teacher_set_multiplayer(enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  update public.app_settings set multiplayer_enabled = enabled where id;
end;
$$;

-- The Stage 3 role change: also refuse unknown roles and people who don't exist, with a
-- friendly message rather than a database error.
create or replace function public.teacher_set_role(person uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if person = auth.uid() then
    raise exception 'You can''t change your own role.' using errcode = '42501';
  end if;
  if new_role not in ('student', 'teacher') then
    raise exception 'That isn''t a role.' using errcode = '22023';
  end if;
  update public.profiles set role = new_role where id = person;
  if not found then
    raise exception 'We couldn''t find that player.' using errcode = '22023';
  end if;
end;
$$;

-- End-of-year cleanup. Deletes every finished game and every point, rating and achievement,
-- so everyone starts the new year fresh. Keeps accounts, names, avatars, teachers, hidden
-- settings and the multiplayer switch. Games still being played are left alone.
-- The teacher must type NEW SEASON; the words are checked here too.
create function public.teacher_new_season(confirm text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  bot_count integer;
  friend_count integer;
begin
  perform public.require_teacher();
  if confirm is distinct from 'NEW SEASON' then
    raise exception 'Type NEW SEASON to start a new season.' using errcode = '22023';
  end if;
  delete from public.achievements where true;
  delete from public.scored_games where true;
  delete from public.ratings where true;
  delete from public.bot_games where true;
  get diagnostics bot_count = row_count;
  delete from public.mp_games where status in ('finished', 'cancelled', 'expired');
  get diagnostics friend_count = row_count;
  return jsonb_build_object('botGames', bot_count, 'friendGames', friend_count);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.bot_points(text, text), public.friend_points(text), public.bot_daily_cap(), public.pair_daily_limit(),
  public.achievement_points(), public.start_rating(), public.rating_k(), public.rank_for(integer, integer),
  public.rank_name(integer), public.level_start(integer), public.level_for(integer), public.nz_day(timestamptz),
  public.nz_week_start(timestamptz), public.checkers_crowns(text[], text), public.progress_counts(uuid, text),
  public.award_achievements(uuid, text, timestamptz), public.score_bot_game(public.bot_games),
  public.score_friend_game(public.mp_games), public.score_bot_game_trigger(), public.score_friend_game_trigger(),
  public.rebuild_progress(), public.progress_rules(), public.points_total(uuid), public.rank_progress(integer, integer),
  public.my_progress(), public.leaderboard(text, text), public.teacher_students(), public.teacher_student_detail(uuid),
  public.teacher_new_season(text)
from public, anon, authenticated;

grant execute on function
  public.progress_rules(), public.my_progress(), public.leaderboard(text, text),
  public.teacher_students(), public.teacher_student_detail(uuid), public.teacher_new_season(text)
to authenticated;
