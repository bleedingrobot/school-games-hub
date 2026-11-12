-- Leaderboard redesign, card L1 (docs/LEADERBOARD-PLAN.md).
--
--   (Plan: docs/LEADERBOARD-PLAN.md.)
--   1. board_achievement_counts(measure)  which achievements count on the boards: not the ones that measure maths level
--                                          (the early-years '*_step' ones and Space's 'maths_right').
--   2. achievements_board(board, scope)   most achievements: 'all-time' (every one held) or 'week' (earned since Monday NZ),
--                                          for my 'school', my 'year' or my 'class'.
--   3. hard_workers_board(board, scope)   effort: school days (Monday to Friday) with a finished game ('week' or this hub
--                                          'season'), then games finished; plus everyone with 4 or more school days this week.
--   4. achievements_by_game(player)       one schoolmate's board achievements, counted per game (tap a row).
--   5. recent_trophies()                  the newest 8 trophies won at my school in the last 7 days, as a new 'recentTrophies'
--                                          part of my_home_page (exact text edit that must match once).
--
-- Pupils only (no teachers, no hidden test pupils), my school only. Nothing is written. Game feats and turning up only:
-- never a maths result. Names: the boards show display_name like the other boards (trophy shelves are found by it); the home
-- strip follows the Hall of fame (hall_name: "A classmate" without a made-up name), and leaves out the garden games' friend
-- pictures, which come from maths progress.

-- ---------------------------------------------------------------------------
-- 1. Which achievements count
-- ---------------------------------------------------------------------------

create function public.board_achievement_counts(measure text)
returns boolean
language sql
immutable
set search_path = ''
as $$ select not (measure like '%\_step' or measure = 'maths_right') $$;

-- ---------------------------------------------------------------------------
-- Shared: who can be on my boards
-- ---------------------------------------------------------------------------

-- The pupils on my boards: my school's pupils, not hidden; with 'year' only those in my year, with 'class' only my class.
-- A teacher (no year, no class) gets nobody for 'year' and 'class'. The year comes from year_level_of() (migration
-- 20261113000200, the pupils' own years); until that is live, from the class's year level. Nobody's year is ever sent.
create function public.board_pupils(scope text)
returns table (id uuid, display_name text, avatar jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  school integer := public.my_school();
  mine uuid := public.current_class_of(auth.uid());
  own_years boolean := to_regprocedure('public.year_level_of(uuid)') is not null;
  my_year integer;
begin
  if scope not in ('school', 'year', 'class') then
    raise exception 'That leaderboard doesn''t exist.' using errcode = '22023';
  end if;
  if scope = 'class' and mine is null then
    return;
  end if;
  if scope = 'year' then
    if own_years then
      execute 'select public.year_level_of($1)' into my_year using auth.uid();
      if my_year is null then
        return;
      end if;
      return query execute
        'select p.id, p.display_name, p.avatar::jsonb from public.profiles p
         where p.school_id = $1 and p.role = ''student'' and not p.hidden and public.year_level_of(p.id) = $2'
        using school, my_year;
      return;
    end if;
    select c.year_level into my_year from public.classes c where c.id = mine;
    if my_year is null then
      return;
    end if;
    return query
    select p.id, p.display_name, p.avatar::jsonb
    from public.profiles p
    join public.classes c on c.id = public.current_class_of(p.id)
    where p.school_id = school and p.role = 'student' and not p.hidden and c.year_level = my_year;
    return;
  end if;
  return query
  select p.id, p.display_name, p.avatar::jsonb
  from public.profiles p
  where p.school_id = school and p.role = 'student' and not p.hidden
    and (scope = 'school' or public.current_class_of(p.id) = mine);
end;
$$;
revoke execute on function public.board_pupils(text) from public, anon, authenticated;

-- School days (Monday to Friday) with a finished game since `since`, and games finished, per pupil.
create function public.board_school_days(since date)
returns table (player uuid, days integer, games integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.player,
         count(distinct s.nz_day) filter (where extract(isodow from s.nz_day) between 1 and 5)::integer,
         count(*)::integer
  from public.scored_games s
  where since is not null and s.nz_day >= since
  group by s.player
$$;
revoke execute on function public.board_school_days(date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Most achievements
-- ---------------------------------------------------------------------------

-- [{ place, name, avatar, count, week, hard, is_me }]: the top 10 with a count above 0 (ties share a place), then me if I'm
-- further down. `week` is how many were earned this week; `hard` = 4 or more school days played this week.
create function public.achievements_board(board text, scope text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  week_start timestamptz := public.nz_week_start(now());
begin
  perform public.require_school_user();
  if board not in ('all-time', 'week') then
    raise exception 'That leaderboard doesn''t exist.' using errcode = '22023';
  end if;
  return coalesce((
    with pupils as (select * from public.board_pupils(scope)),
    counts as (
      select a.player,
             count(*)::integer as total,
             count(*) filter (where a.earned_at >= week_start)::integer as week
      from public.achievements a
      join public.achievement_types t on t.id = a.achievement
      where public.board_achievement_counts(t.measure) and a.player in (select id from pupils)
      group by a.player),
    days as (select * from public.board_school_days(public.nz_day(week_start))),
    placed as (
      select p.id, p.display_name, p.avatar, c.total, c.week, coalesce(d.days, 0) >= 4 as hard,
             case when board = 'week' then c.week else c.total end as score
      from pupils p
      join counts c on c.player = p.id
      left join days d on d.player = p.id),
    ranked as (
      select r.*, rank() over (order by r.score desc)::integer as place,
             row_number() over (order by r.score desc, r.display_name)::integer as n
      from placed r where r.score > 0)
    select jsonb_agg(jsonb_build_object('place', r.place, 'name', r.display_name, 'avatar', r.avatar, 'count', r.total,
                                        'week', r.week, 'hard', r.hard, 'is_me', r.id = auth.uid()) order by r.n)
    from ranked r where r.n <= 10 or r.id = auth.uid()), '[]'::jsonb);
end;
$$;
revoke execute on function public.achievements_board(text, text) from public, anon, authenticated;
grant execute on function public.achievements_board(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Hard workers
-- ---------------------------------------------------------------------------

-- { rows: [{ place, name, avatar, days, games, is_me }] top 10 with a school day (ties on days, then games, share a place),
--   then me further down;
--   everyone: [{ name, avatar, days }] every pupil with 4 or more school days this week, most days first (up to 60);
--   season: the hub season number }
create function public.hard_workers_board(board text, scope text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  school integer;
  week_day date := public.nz_day(public.nz_week_start(now()));
  since date;
begin
  perform public.require_school_user();
  if board not in ('week', 'season') then
    raise exception 'That leaderboard doesn''t exist.' using errcode = '22023';
  end if;
  school := public.my_school();
  since := case when board = 'week' then week_day else public.hub_season_start_day(school) end;
  return jsonb_build_object(
    'season', public.hub_season(school),
    'rows', coalesce((
      with pupils as (select * from public.board_pupils(scope)),
      ranked as (
        select p.id, p.display_name, p.avatar, d.days, d.games,
               rank() over (order by d.days desc, d.games desc)::integer as place,
               row_number() over (order by d.days desc, d.games desc, p.display_name)::integer as n
        from pupils p join public.board_school_days(since) d on d.player = p.id
        where d.days > 0)
      select jsonb_agg(jsonb_build_object('place', r.place, 'name', r.display_name, 'avatar', r.avatar, 'days', r.days,
                                          'games', r.games, 'is_me', r.id = auth.uid()) order by r.n)
      from ranked r where r.n <= 10 or r.id = auth.uid()), '[]'::jsonb),
    'everyone', coalesce((
      select jsonb_agg(jsonb_build_object('name', x.display_name, 'avatar', x.avatar, 'days', x.days)
                       order by x.days desc, x.display_name)
      from (select p.display_name, p.avatar, d.days
            from public.board_pupils(scope) p join public.board_school_days(week_day) d on d.player = p.id
            where d.days >= 4
            order by d.days desc, p.display_name
            limit 60) x), '[]'::jsonb));
end;
$$;
revoke execute on function public.hard_workers_board(text, text) from public, anon, authenticated;
grant execute on function public.hard_workers_board(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. One schoolmate's achievements, per game
-- ---------------------------------------------------------------------------

-- [{ game, count, names: [achievement names, newest first, up to 3] }] most first. Empty for anyone outside my school, a
-- teacher or a hidden pupil.
create function public.achievements_by_game(player text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  who uuid;
begin
  perform public.require_school_user();
  select p.id into who from public.profiles p
  where p.display_name = achievements_by_game.player and p.school_id = public.my_school() and p.role = 'student' and not p.hidden;
  if who is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('game', g.game, 'count', g.n, 'names', g.names) order by g.n desc, g.game)
    from (select t.game, count(*)::integer as n,
                 (array_agg(t.emoji || ' ' || t.name order by a.earned_at desc))[1:3] as names
          from public.achievements a join public.achievement_types t on t.id = a.achievement
          where a.player = who and public.board_achievement_counts(t.measure)
          group by t.game) g), '[]'::jsonb);
end;
$$;
revoke execute on function public.achievements_by_game(text) from public, anon, authenticated;
grant execute on function public.achievements_by_game(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. New trophies, for the home page strip
-- ---------------------------------------------------------------------------

-- [{ trophy, title, how, game, kind, tier, name, avatar, at }] newest first, up to 8, won in the last 7 days at my school.
create function public.recent_trophies()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  school integer;
begin
  if not public.is_school_user() then
    return '[]'::jsonb;
  end if;
  school := public.my_school();
  return coalesce((
    select jsonb_agg(x.row order by x.at desc)
    from (
      select w.earned_at at, jsonb_build_object(
               'trophy', t.id, 'title', t.name, 'how', t.how, 'game', t.game, 'kind', t.kind,
               'tier', public.trophy_tier(case when t.repeat = 'steps' then w.season
                                               else (select count(*)::integer from public.trophies c
                                                     where c.player = w.player and c.trophy = w.trophy and c.earned_at <= w.earned_at) end),
               'name', public.hall_name(p.display_name), 'avatar', p.avatar, 'at', w.earned_at) row
      from public.trophies w
      join public.trophy_types t on t.id = w.trophy
      join public.profiles p on p.id = w.player
      where w.earned_at > now() - interval '7 days'
        and not (t.kind = 'picture'
                 and exists (select 1 from public.trophy_types cup where cup.id = t.game || '-cup' and cup.repeat = 'steps'))
        and p.school_id = school and p.role = 'student' and not p.hidden
      order by w.earned_at desc
      limit 8) x), '[]'::jsonb);
end;
$$;
revoke execute on function public.recent_trophies() from public, anon, authenticated;
grant execute on function public.recent_trophies() to authenticated;

do $migration$
declare
  def text := pg_get_functiondef('public.my_home_page()'::regprocedure);
  -- No line ending in the needle: the live copy of my_home_page has Windows (\r\n) line endings.
  needle text := '''topGames'', public.my_top_games(),';
begin
  if (length(def) - length(replace(def, needle, ''))) / length(needle) <> 1 then
    raise exception 'my_home_page edit did not match exactly once; nothing was changed';
  end if;
  def := replace(def, needle, '''recentTrophies'', public.recent_trophies(), ' || needle);
  execute def;
end;
$migration$;

revoke execute on function public.my_home_page() from public, anon, authenticated;
grant execute on function public.my_home_page() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Homework: achievements and trophies for playing at home (James, 13 Nov 2026)
-- ---------------------------------------------------------------------------
-- A finished go (a row in scored_games) counts as home play when it ends outside school hours, NZ time:
--   Monday to Friday 6:00 to 8:30 am or 3:00 to 8:30 pm; Saturday and Sunday 7:00 am to 8:30 pm.
-- Late at night never counts, so nothing nudges a child to play at bedtime. School holidays count only in those hours too.
-- The achievements belong to the hub game 'homework' (no card, no switch: on for everyone) and stay through a New Season.

create function public.home_time(at timestamptz)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when extract(isodow from l) between 1 and 5
              then (l::time >= '06:00' and l::time < '08:30') or (l::time >= '15:00' and l::time < '20:30')
              else l::time >= '07:00' and l::time < '20:30' end
  from (select at at time zone 'Pacific/Auckland' as l) x
$$;

-- Home goes since `since` (null = all of them): goes, different days, different weekends.
create function public.homework_tally(who uuid, since date)
returns table (games integer, days integer, weekends integer)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer,
         count(distinct s.nz_day)::integer,
         count(distinct date_trunc('week', s.nz_day)) filter (where extract(isodow from s.nz_day) in (6, 7))::integer
  from public.scored_games s
  where s.player = who and public.home_time(s.finished_at) and (since is null or s.nz_day >= since)
$$;
revoke execute on function public.homework_tally(uuid, date) from public, anon, authenticated;

create function public.homework_counts(who uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('homework_games', t.games, 'homework_days', t.days, 'homework_weekends', t.weekends)
  from public.homework_tally(who, null) t
$$;
revoke execute on function public.homework_counts(uuid) from public, anon, authenticated;

create function public.homework_players_list()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$ select distinct s.player from public.scored_games s where public.home_time(s.finished_at) $$;
revoke execute on function public.homework_players_list() from public, anon, authenticated;

create function public.homework_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'Homework: finish a game at home (before 8:30 am or after 3 pm on school days, or at the weekend) to earn homework achievements and trophies. Games after 8:30 pm don''t count.'))
$$;

insert into public.hub_games (id, counts_fn, rules_fn, players_fn, keep_achievements)
values ('homework', 'public.homework_counts(uuid)', 'public.homework_point_rules()', 'public.homework_players_list()', true);

insert into public.achievement_measures (measure) values ('homework_games'), ('homework_days'), ('homework_weekends');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('hw-first', 'homework', 'Home learner', '🏠', 'homework_games', 1, 1),
  ('hw-games-10', 'homework', 'Ten at home', '🔟', 'homework_games', 10, 2),
  ('hw-days-5', 'homework', 'Five home days', '📅', 'homework_days', 5, 3),
  ('hw-weekend-1', 'homework', 'Weekend player', '🌞', 'homework_weekends', 1, 4),
  ('hw-days-20', 'homework', 'Homework hero', '🦸', 'homework_days', 20, 5),
  ('hw-weekend-4', 'homework', 'Weekend regular', '🪁', 'homework_weekends', 4, 6),
  ('hw-games-50', 'homework', 'Fifty at home', '📚', 'homework_games', 50, 7);

insert into public.trophy_types (id, game, name, how, kind, repeat, art, sort) values
  ('hw-star', 'hub', 'Homework Star', 'Play at home on 8 different days in one season.', 'trophy', 'season', 'homework-star', 340),
  ('hw-weekend', 'hub', 'Weekend Explorer', 'Play at home on 4 different weekends in one season.', 'trophy', 'season', 'weekend-explorer', 341),
  ('hw-cup', 'hub', 'Home Learning Cup', 'Play at home on 40 different days in one year.', 'trophy', 'year', 'home-learning-cup', 342);

-- Gives the homework trophies `who` has reached. Safe to run again: award_trophy gives each once per season or year.
create function public.homework_trophy_check(who uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  since date;
  season_t record;
  year_days integer;
begin
  select public.hub_season_start_day(p.school_id) into since from public.profiles p where p.id = who and p.role = 'student';
  if since is not null then
    select * into season_t from public.homework_tally(who, since);
    if season_t.days >= 8 then
      perform public.award_trophy(who, 'hw-star', jsonb_build_object('days', season_t.days));
    end if;
    if season_t.weekends >= 4 then
      perform public.award_trophy(who, 'hw-weekend', jsonb_build_object('weekends', season_t.weekends));
    end if;
  end if;
  if exists (select 1 from public.profiles p where p.id = who and p.role = 'student') then
    select t.days into year_days
    from public.homework_tally(who, make_date(extract(year from public.nz_day(now()))::integer, 1, 1)) t;
    if year_days >= 40 then
      perform public.award_trophy(who, 'hw-cup', jsonb_build_object('days', year_days));
    end if;
  end if;
end;
$$;
revoke execute on function public.homework_trophy_check(uuid) from public, anon, authenticated;

-- On a finished go at home: achievements, then trophies. Never loses a save if this goes wrong.
create function public.scored_games_homework_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.home_time(new.finished_at) then
    begin
      perform public.award_achievements(new.player, 'homework', new.finished_at);
      perform public.homework_trophy_check(new.player);
    exception when others then
      raise warning 'homework check failed (%)', sqlstate;
    end;
  end if;
  return null;
end;
$$;
revoke execute on function public.scored_games_homework_trigger() from public, anon, authenticated;

create trigger homework_when_scored
after insert on public.scored_games
for each row execute function public.scored_games_homework_trigger();

-- Back-award from the goes already saved (achievements dated now; trophies only for this season and year).
select public.award_achievements(p, 'homework', now()) from public.homework_players_list() p;
select public.homework_trophy_check(p) from public.homework_players_list() p;

revoke execute on function public.board_achievement_counts(text), public.home_time(timestamptz), public.homework_point_rules()
  from public, anon, authenticated;
