-- Stage P.5, part 2 of 2: points, badges and teacher views for Power Clash with a classmate.
--
-- NOT APPLIED to the live database yet. Apply after 20261017001600_power_clash_games.sql.
--
-- 1. Scoring: 4 points for a finished game with a classmate, win or lose, for the first 6 such
--    games each NZ day (0 after that; still in their history). A game left part-way earns nothing
--    for anyone. Never ratings (Power Clash is not ranked). Like 101 and the space game, there is
--    no separate limit for the same two students: only the daily games cap.
-- 2. Badges: "Win against a classmate". The P.4 badges (first game, all three powers, Body Swap
--    win, no-power win) already count classmates games, because they are measured over every
--    scored Power Clash game and this file saves the same stats for them.
-- 3. rebuild_progress() re-scores these games and gives the same points when re-run.
-- 4. The teacher's student table, a student's detail and Recent, and the new-season clear
--    include Power Clash games. my_progress() lets Recent point at a Power Clash game.
-- 5. progress_rules() says what Power Clash with a classmate earns, for the "How points work" page.
--
-- Built on the newest versions of rebuild_progress(), my_progress(), teacher_students() and
-- teacher_new_season() (Gem Keep, 20261017001100) and teacher_student_detail() (101,
-- 20261016000900), and on progress_rules() from 20261017001500. teacher_new_season() also clears
-- the Mission Control maths records (20261017001200, space-maths branch, not live yet) when
-- that table exists, so this file is safe to apply with or without it.

-- ---------------------------------------------------------------------------
-- 1. Scoring
-- ---------------------------------------------------------------------------

alter table public.scored_games add column power_game uuid references public.power_games (id) on delete cascade;
alter table public.scored_games drop constraint scored_games_check;
alter table public.scored_games add constraint scored_games_check check (
  num_nonnulls(bot_game, mp_game, space_game, card_game, gem_keep_run, power_game) = 1
  and (kind = 'bot') = (bot_game is not null)
  and (kind = 'friend') = (mp_game is not null or space_game is not null or card_game is not null or power_game is not null)
  and (kind = 'solo') = (gem_keep_run is not null));
create unique index scored_games_power on public.scored_games (player, power_game) where power_game is not null;
create index scored_games_power_game on public.scored_games (power_game);

-- Points for a finished Power Clash game with a classmate, and how many a day earn them.
create function public.power_clash_friend_points() returns integer language sql immutable set search_path = '' as $$ select 4 $$;
create function public.power_clash_friend_daily_games() returns integer language sql immutable set search_path = '' as $$ select 6 $$;

-- Each student in a finished game that counts: 4 points (win or lose), for the first 6 such
-- games each NZ day; 0 after that. No ratings, ever.
create function public.score_power_game(g public.power_games)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  day date := public.nz_day(g.finished_at);
  seats uuid[] := array[g.seat1, g.seat2];
  who uuid;
  earned_today integer;
  i integer;
begin
  if g.status <> 'finished' or g.counts is null then
    return;
  end if;
  if exists (select 1 from public.scored_games s where s.power_game = g.id) then
    return;
  end if;
  for i in 1..2 loop
    who := seats[i];
    continue when who is null or not coalesce(g.counts[i], false);
    select count(*) into earned_today from public.scored_games s
    where s.player = who and s.game = 'power-clash' and s.kind = 'friend' and s.nz_day = day and s.points > 0;
    insert into public.scored_games (player, game, kind, power_game, result, reason, points, finished_at, nz_day, power_clash)
    values (
      who, 'power-clash', 'friend', g.id,
      case when g.won[i] then 'won' else 'lost' end,
      g.ending,
      case when earned_today < public.power_clash_friend_daily_games() then public.power_clash_friend_points() else 0 end,
      g.finished_at, day,
      g.stats -> (i - 1)
    )
    on conflict do nothing;
    perform public.award_achievements(who, 'power-clash', g.finished_at);
  end loop;
end;
$$;

create function public.score_power_game_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.score_power_game(new);
  return null;
exception when others then
  -- Never lose a game because scoring went wrong. rebuild_progress() can fix scores later.
  raise warning 'scoring a Power Clash game failed (%)', sqlstate;
  return null;
end;
$$;

create trigger score_when_finished
after insert or update of status on public.power_games
for each row
when (new.status = 'finished')
execute function public.score_power_game_trigger();

-- ---------------------------------------------------------------------------
-- 2. Badges
-- ---------------------------------------------------------------------------

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('pc-win-classmate', 'power-clash', 'Win against a classmate', '🤝', 'friend_wins', 1, 5);

-- ---------------------------------------------------------------------------
-- 3. Rebuilding
-- ---------------------------------------------------------------------------

-- Same as Gem Keep's, with Power Clash games too.
create or replace function public.rebuild_progress()
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
    union all
    select 'space', s.id, s.finished_at from public.space_games s where s.status = 'finished' and true = any (s.counts)
    union all
    select 'card', c.id, c.finished_at from public.card_games c where c.status = 'finished' and true = any (c.counts)
    union all
    select 'power', p.id, p.finished_at from public.power_games p where p.status = 'finished' and true = any (p.counts)
    union all
    select 'gem', r.id, r.finished_at from public.gem_keep_runs r where r.counts_for_points
    order by finished_at, id
  loop
    if item.kind = 'bot' then
      perform public.score_bot_game(b) from public.bot_games b where b.id = item.id;
    elsif item.kind = 'friend' then
      perform public.score_friend_game(m) from public.mp_games m where m.id = item.id;
    elsif item.kind = 'space' then
      perform public.score_space_game(s) from public.space_games s where s.id = item.id;
    elsif item.kind = 'card' then
      perform public.score_card_game(c) from public.card_games c where c.id = item.id;
    elsif item.kind = 'power' then
      perform public.score_power_game(p) from public.power_games p where p.id = item.id;
    else
      perform public.score_gem_keep_run(r) from public.gem_keep_runs r where r.id = item.id;
    end if;
  end loop;
  -- Gem Keep achievements come from campaign progress, which a rebuild doesn't touch.
  perform public.award_achievements(g.player, 'gem-keep', now())
  from (select distinct player from public.gem_keep_progress) g;
  return jsonb_build_object(
    'scored_games', (select count(*) from public.scored_games),
    'achievements', (select count(*) from public.achievements),
    'ratings', (select count(*) from public.ratings)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. What the website reads
-- ---------------------------------------------------------------------------

-- Same as Gem Keep's, except Recent games' "+4" can point at a Power Clash game too.
create or replace function public.my_progress()
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
    'recent', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', coalesce(x.bot_game, x.mp_game, x.space_game, x.card_game, x.gem_keep_run, x.power_game),
                 'points', x.points)), '[]')
               from (select s.bot_game, s.mp_game, s.space_game, s.card_game, s.gem_keep_run, s.power_game, s.points
                     from public.scored_games s
                     where s.player = me.id order by s.finished_at desc limit 20) x)
  )
  from me, totals t
$$;

-- Same as 20261017001500's, plus what a Power Clash game with a classmate earns.
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
    'powerClash', jsonb_build_object('bot', public.power_clash_bot_points(), 'friend', public.power_clash_friend_points(),
              'friendDailyGames', public.power_clash_friend_daily_games()),
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
-- 5. Teachers
-- ---------------------------------------------------------------------------

-- Same as Gem Keep's, counting Power Clash games with a classmate as friend games.
drop function public.teacher_students();

create function public.teacher_students()
returns table (
  id uuid,
  display_name text,
  real_name text,
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
  select p.id, p.display_name, split_part(u.email, '@', 1)::text, p.avatar, p.role, p.hidden,
         (select count(*)::integer from public.bot_games b where b.player = p.id)
         + (select count(*)::integer from public.gem_keep_runs r where r.player = p.id),
         (select count(*)::integer from public.mp_games m
          where m.status = 'finished' and p.id in (m.first_player, m.second_player))
         + (select count(*)::integer from public.space_games s
          where s.status = 'finished' and p.id in (s.seat1, s.seat2, s.seat3, s.seat4))
         + (select count(*)::integer from public.card_games c
          where c.status = 'finished' and p.id in (c.seat1, c.seat2, c.seat3, c.seat4))
         + (select count(*)::integer from public.power_games pg
          where pg.status = 'finished' and p.id in (pg.seat1, pg.seat2)),
         public.points_total(p.id),
         greatest(
           (select max(b.finished_at) from public.bot_games b where b.player = p.id),
           (select max(m.finished_at) from public.mp_games m
            where m.status = 'finished' and p.id in (m.first_player, m.second_player)),
           (select max(s.finished_at) from public.space_games s
            where s.status = 'finished' and p.id in (s.seat1, s.seat2, s.seat3, s.seat4)),
           (select max(c.finished_at) from public.card_games c
            where c.status = 'finished' and p.id in (c.seat1, c.seat2, c.seat3, c.seat4)),
           (select max(pg.finished_at) from public.power_games pg
            where pg.status = 'finished' and p.id in (pg.seat1, pg.seat2)),
           (select max(r.finished_at) from public.gem_keep_runs r where r.player = p.id)),
         p.created_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  order by p.role desc, split_part(u.email, '@', 1), p.display_name;
end;
$$;

revoke execute on function public.teacher_students() from public, anon, authenticated;
grant execute on function public.teacher_students() to authenticated;

-- Same as Stage 10.4, with Power Clash games against classmates in the Power Clash line and in
-- Recent. "Won" is winning the match; "left" is a game that was abandoned.
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
    ),
    card_mine as (
      select c.id, c.finished_at, c.ending,
             c.places[array_position(array[c.seat1, c.seat2, c.seat3, c.seat4], student)] as place,
             coalesce(c.won[array_position(array[c.seat1, c.seat2, c.seat3, c.seat4], student)], false) as won,
             coalesce(c.out_of_game[array_position(array[c.seat1, c.seat2, c.seat3, c.seat4], student)], false)
               or c.ending = 'abandoned' as left_game
      from public.card_games c
      where c.status = 'finished' and student in (c.seat1, c.seat2, c.seat3, c.seat4)
    ),
    power_mine as (
      select pg.id, pg.finished_at, pg.ending,
             coalesce(pg.won[array_position(array[pg.seat1, pg.seat2], student)], false) as won,
             pg.ending = 'abandoned' as left_game
      from public.power_games pg
      where pg.status = 'finished' and student in (pg.seat1, pg.seat2)
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
            (select jsonb_build_object(
              'played', count(*), 'won', count(*) filter (where not cm.left_game and cm.won),
              'lost', count(*) filter (where not cm.left_game and not cm.won), 'drawn', 0,
              'left', count(*) filter (where cm.left_game))
             from card_mine cm)
          when g = 'power-clash' then
            (select jsonb_build_object(
              'played', count(*), 'won', count(*) filter (where not pm.left_game and pm.won),
              'lost', count(*) filter (where not pm.left_game and not pm.won), 'drawn', 0,
              'left', count(*) filter (where pm.left_game))
             from power_mine pm)
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
        ) order by g in ('101', 'power-clash'), g)
        from unnest(array['chess', 'checkers', 'space', '101', 'power-clash']) as g
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
          union all
          (select '101', 'friend', 'classmates', case when cm.won and not cm.left_game then 'won' else 'lost' end,
                  case when cm.left_game then 'abandoned' else cm.ending end, cm.finished_at,
                  case when cm.left_game then null else cm.place end
           from card_mine cm order by cm.finished_at desc limit 10)
          union all
          (select 'power-clash', 'friend',
                  coalesce((select o.display_name from public.profiles o
                            where o.id = case when pg.seat1 = student then pg.seat2 else pg.seat1 end), 'a classmate'),
                  case when pm.won and not pm.left_game then 'won' else 'lost' end,
                  case when pm.left_game then 'abandoned' else pm.ending end, pm.finished_at, null
           from power_mine pm join public.power_games pg on pg.id = pm.id
           order by pm.finished_at desc limit 10)
          order by finished_at desc limit 10) x)
    )
    where exists (select 1 from public.profiles p where p.id = student)
  );
end;
$$;

-- Same as Gem Keep's, clearing Power Clash games too (games still being played are left alone),
-- and the Mission Control maths records when that table exists (20261017001200, not live yet).
create or replace function public.teacher_new_season(confirm text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  bot_count integer;
  friend_count integer;
  space_count integer;
  card_count integer;
  power_count integer;
  gem_count integer;
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
  -- A finished game a newer one points at (a rematch) goes too; the link just empties.
  delete from public.space_games where status in ('finished', 'cancelled', 'expired');
  get diagnostics space_count = row_count;
  delete from public.card_games where status in ('finished', 'cancelled', 'expired');
  get diagnostics card_count = row_count;
  delete from public.power_games where status in ('finished', 'cancelled', 'expired');
  get diagnostics power_count = row_count;
  delete from public.gem_keep_runs where true;
  get diagnostics gem_count = row_count;
  delete from public.gem_keep_progress where true;
  delete from public.gem_keep_facts where true;
  if to_regclass('public.fact_answer_batches') is not null then
    delete from public.fact_answer_batches where true;
  end if;
  return jsonb_build_object('botGames', bot_count, 'friendGames', friend_count + space_count + card_count + power_count,
    'gemKeepLevels', gem_count);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.power_clash_friend_points(), public.power_clash_friend_daily_games(),
  public.score_power_game(public.power_games), public.score_power_game_trigger()
from public, anon, authenticated;
