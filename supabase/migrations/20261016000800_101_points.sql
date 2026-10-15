-- Stage 10.3: saving 101 games against bots, and their points.
--
-- 101 has real skill in it (remembering cards, knowing when to knock), so a bot game earns
-- the same points as chess and checkers, inside the same 40-a-day bot cap. It never
-- changes ratings, badges or leaderboards: up to 4 players and luck of the deal make a
-- rating unfair. The numbers are in docs/101-PLAN.md, section 6.
--
-- 1. bot_games, scored_games and achievement_types allow '101'. ratings doesn't, so a 101
--    rating can't exist.
-- 2. A 101 game keeps its seed, setup and what happened in a new `card101` column. The
--    save-bot-game function replays the game from the seed before saving it.
-- 3. record_101_bot_game(): the save, for the server only. The same seed is only ever saved once.
-- 4. Scoring: score_bot_game() keeps the student's stats for 101 games. Points come from
--    bot_points() exactly as for chess and checkers.
-- 5. Eight 101 achievements, and the counts they're measured by.
-- 6. progress_rules() and teacher_student_detail() include 101.

-- ---------------------------------------------------------------------------
-- 1 and 2. Tables
-- ---------------------------------------------------------------------------

alter table public.bot_games drop constraint bot_games_game_check;
alter table public.bot_games add constraint bot_games_game_check check (game in ('chess', 'checkers', 'space', '101'));
-- 101 games only: { seed, settings, bots, place, players, rounds, total, stats }.
alter table public.bot_games add column card101 jsonb;
alter table public.bot_games add constraint bot_games_card101_check
  check ((game = '101') = (card101 is not null) and (card101 is null or card101 ->> 'seed' is not null));
-- A seed plays exactly one game.
create unique index bot_games_card101_seed on public.bot_games ((card101 ->> 'seed')) where card101 is not null;

alter table public.scored_games drop constraint scored_games_game_check;
alter table public.scored_games add constraint scored_games_game_check
  check (game in ('chess', 'checkers', 'space', '101'));
-- 101 games only: what the student did, for the achievements:
-- { zeroHands, triples, knockWins, savedByThree }.
alter table public.scored_games add column card101 jsonb;

alter table public.achievement_types drop constraint achievement_types_game_check;
alter table public.achievement_types add constraint achievement_types_game_check
  check (game in ('chess', 'checkers', 'space', '101'));
alter table public.achievement_types drop constraint achievement_types_measure_check;
alter table public.achievement_types add constraint achievement_types_measure_check
  check (measure in ('games', 'wins', 'beat_very_easy', 'beat_easy', 'beat_medium', 'friend_wins', 'rank',
    'checkmates', 'crowns', 'friend_games', 'wormholes', 'blocks', 'star_kinds', 'docks',
    'zero_hands', 'triples', 'knock_wins', 'saved_by_three'));

-- ---------------------------------------------------------------------------
-- 4. The rules
-- ---------------------------------------------------------------------------

-- Points for a finished 101 game with classmates (Stage 10.4), and how many a day earn them.
create function public.card101_friend_points(result text) returns integer language sql immutable set search_path = ''
as $$ select case when result = 'won' then 8 else 4 end $$;
create function public.card101_friend_daily_games() returns integer language sql immutable set search_path = '' as $$ select 6 $$;
-- Games of fewer full rounds than this earn nothing (shared/card101/save.ts MIN_ROUNDS_TO_COUNT).
create function public.card101_min_rounds() returns integer language sql immutable set search_path = '' as $$ select 2 $$;

-- ---------------------------------------------------------------------------
-- 3. Saving
-- ---------------------------------------------------------------------------

-- Only the save-bot-game server function calls this (it runs with the server's key), after
-- it has checked the seed's stamp and replayed the game. The website can't call it.
create function public.record_101_bot_game(
  player uuid,
  bot_level text,
  player_side text,
  moves text[],
  result text,
  reason text,
  player_moves integer,
  counts_for_points boolean,
  card101 jsonb
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
    where p.id = record_101_bot_game.player and public.is_school_email(u.email)
  ) then
    raise exception 'No such player.' using errcode = '22023';
  end if;
  -- Each seed plays one game. Seen it already? Then it's the same game sent again (a retry
  -- after a Wi-Fi blip): hand back the saved one. A seed is stamped for one student, so it
  -- can't be someone else's.
  select g.id into new_id from public.bot_games g
  where g.card101 ->> 'seed' = record_101_bot_game.card101 ->> 'seed' and g.player = record_101_bot_game.player;
  if new_id is not null then
    return new_id;
  end if;
  if (select count(*) from public.bot_games g
      where g.player = record_101_bot_game.player and g.finished_at > now() - interval '1 day') >= 300 then
    raise exception 'That''s a lot of games today! Have a break and come back tomorrow.' using errcode = '54000';
  end if;
  begin
    insert into public.bot_games (player, game, bot_level, player_side, moves, result, reason, player_moves,
      counts_for_points, card101)
    values (player, '101', bot_level, player_side, moves, result, reason, player_moves, counts_for_points, card101)
    returning id into new_id;
  exception when unique_violation then
    -- Two copies arrived at the same moment and the other one got there first.
    select g.id into new_id from public.bot_games g where g.card101 ->> 'seed' = record_101_bot_game.card101 ->> 'seed';
  end;
  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Scoring (same as Stage 9.3, plus 101's stats)
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
  -- Every bot game shares one daily cap, space and 101 games included.
  select coalesce(sum(s.points), 0) into earned_today
  from public.scored_games s
  where s.player = g.player and s.kind = 'bot' and s.nz_day = day;

  insert into public.scored_games (player, game, kind, bot_game, bot_level, result, reason, crowns, points, finished_at,
    nz_day, space, card101)
  values (
    g.player, g.game, 'bot', g.id, g.bot_level, g.result, g.reason,
    case when g.game = 'checkers' then public.checkers_crowns(g.moves, g.player_side) else 0 end,
    least(
      case when g.game = 'space' then public.space_bot_points() else public.bot_points(g.bot_level, g.result) end,
      greatest(public.bot_daily_cap() - earned_today, 0)),
    g.finished_at, day,
    case when g.game = 'space' then g.space -> 'stats' end,
    case when g.game = '101' then g.card101 -> 'stats' end
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
    'saved_by_three', coalesce(sum((s.card101 ->> 'savedByThree')::integer), 0)
  )
  from public.scored_games s
  where s.player = who and s.game = which_game
$$;

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('101-first-game', '101', 'First game of 101', '🃏', 'games', 1, 1),
  ('101-first-win', '101', 'Win a game of 101', '🏆', 'wins', 1, 2),
  ('101-classmates-win', '101', 'Win against classmates', '👫', 'friend_wins', 1, 3),
  ('101-perfect-zero', '101', 'Perfect zero: a hand worth 0', '0️⃣', 'zero_hands', 1, 4),
  ('101-triples', '101', 'Triples! Three of a kind', '🎰', 'triples', 1, 5),
  ('101-knock-win', '101', 'Knock and win the round', '✊', 'knock_wins', 1, 6),
  ('101-saved-by-3', '101', 'Saved by a 3: cancel a 10-point card', '3️⃣', 'saved_by_three', 1, 7),
  ('101-ten-games', '101', 'Finish 10 games', '🔟', 'games', 10, 8);

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

-- Same as Stage 9.4, with a 101 line (put last: alphabetically '101' would come first and
-- move the others). 101 has no badge, so its rank is null. (101 games with
-- classmates come in Stage 10.4; until then that line is all zeros.) A 101 bot game's place
-- shows in Recent, like a space game's.
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
    with space_mine as (
      select s.id, s.finished_at, s.ending,
             s.places[array_position(array[s.seat1, s.seat2, s.seat3, s.seat4], student)] as place,
             coalesce((s.seat_info -> (array_position(array[s.seat1, s.seat2, s.seat3, s.seat4], student) - 1)
               ->> 'left')::boolean, false) or s.ending = 'abandoned' as left_game
      from public.space_games s
      where s.status = 'finished' and student in (s.seat1, s.seat2, s.seat3, s.seat4)
    )
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
          'friend', case when g = 'space' then
            (select jsonb_build_object(
              'played', count(*), 'won', count(*) filter (where not sm.left_game and sm.place = 1),
              'lost', count(*) filter (where not sm.left_game and sm.place > 1), 'drawn', 0,
              'left', count(*) filter (where sm.left_game))
             from space_mine sm)
          when g = '101' then
            jsonb_build_object('played', 0, 'won', 0, 'lost', 0, 'drawn', 0, 'left', 0)
          else
            (select jsonb_build_object(
              'played', count(*),
              'won', count(*) filter (where m.winner = case when m.first_player = student then 'first' else 'second' end),
              'lost', count(*) filter (where m.winner = case when m.first_player = student then 'second' else 'first' end),
              'drawn', count(*) filter (where m.winner is null),
              'left', count(*) filter (where m.reason = 'abandoned'
                and m.winner = case when m.first_player = student then 'second' else 'first' end))
            from public.mp_games m
            where m.status = 'finished' and m.game = g and student in (m.first_player, m.second_player))
          end,
          'rank', case when g in ('chess', 'checkers') then
            public.rank_name(public.rank_for(coalesce(r.rating, public.start_rating()), coalesce(r.rated_games, 0))) end,
          'achievements', (select count(*) from public.achievements a
            join public.achievement_types t on t.id = a.achievement where a.player = student and t.game = g)
        ) order by g = '101', g)
        from unnest(array['chess', 'checkers', 'space', '101']) as g
        left join public.ratings r on r.player = student and r.game = g),
      'recent', (select coalesce(jsonb_agg(x order by x.finished_at desc), '[]') from (
          (select b.game, 'bot' as kind, b.bot_level as against, b.result, b.reason, b.finished_at,
                  (coalesce(b.space, b.card101) ->> 'place')::integer as place
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
          union all
          (select 'space', 'friend', 'classmates', case when sm.place = 1 and not sm.left_game then 'won' else 'lost' end,
                  case when sm.left_game then 'abandoned' else sm.ending end, sm.finished_at,
                  case when sm.left_game then null else sm.place end
           from space_mine sm order by sm.finished_at desc limit 10)
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
  public.card101_friend_points(text), public.card101_friend_daily_games(), public.card101_min_rounds(),
  public.record_101_bot_game(uuid, text, text, text[], text, text, integer, boolean, jsonb)
from public, anon, authenticated;
grant execute on function
  public.record_101_bot_game(uuid, text, text, text[], text, text, integer, boolean, jsonb)
to service_role;
