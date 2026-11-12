-- Trophies on the leaderboard (James, 13 Nov 2026 NZ). docs/LEADERBOARD-PLAN.md.
--
--   1. James doesn't want maths trophies kept off the public lists after all: the Royal Crown goes back on the Hall of fame
--      and the New trophies strip (trophy_types.on_hall, migration 20261113000300, is true again for every trophy).
--   2. trophies_board(board, scope): pupils ranked by how many different trophies they hold, then by wins. 'all-time', or
--      'season' (won since this hub season started). Same rules as the other boards: my school's pupils only, no teachers,
--      no hidden pupils, Whole school / My year / My class through board_pupils(), and no garden friend pictures (they
--      follow a pupil's maths step, as on the New trophies strip).
--   3. trophies_of(player): one schoolmate's trophies (name, game, metal, wins) for when a row is tapped.
--   4. Teachers can filter the boards too (James couldn't see the Who chips: a teacher has no class or year of their own).
--      board_pupils() also takes 'year:<n>' (pupils in year n) and 'class:<id>' (a class at my school), for teachers only.

update public.trophy_types set on_hall = true where not on_hall;

-- Garden friend pictures: a picture from a game whose cup goes up in steps. Never counted or shown on the boards.
create function public.board_trophy_counts(t public.trophy_types)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not (t.kind = 'picture'
              and exists (select 1 from public.trophy_types cup where cup.id = t.game || '-cup' and cup.repeat = 'steps'))
$$;
revoke execute on function public.board_trophy_counts(public.trophy_types) from public, anon, authenticated;

-- [{ place, name, avatar, count, wins, season, is_me }]: the top 10 with a trophy (ties share a place), then me if I'm
-- further down. `count` = different trophies held, `wins` = every win, `season` = wins this hub season.
create function public.trophies_board(board text, scope text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  season_start date;
begin
  perform public.require_school_user();
  if board not in ('all-time', 'season') then
    raise exception 'That leaderboard doesn''t exist.' using errcode = '22023';
  end if;
  season_start := public.hub_season_start_day(public.my_school());
  return coalesce((
    with pupils as (select * from public.board_pupils(scope)),
    counts as (
      select w.player,
             count(distinct w.trophy)::integer as total,
             count(*)::integer as wins,
             count(*) filter (where season_start is not null
                              and w.earned_at >= (season_start::timestamp at time zone 'Pacific/Auckland'))::integer as season,
             count(distinct w.trophy) filter (where season_start is not null
                              and w.earned_at >= (season_start::timestamp at time zone 'Pacific/Auckland'))::integer as season_kinds
      from public.trophies w
      join public.trophy_types t on t.id = w.trophy
      where public.board_trophy_counts(t) and w.player in (select id from pupils)
      group by w.player),
    placed as (
      select p.id, p.display_name, p.avatar, c.total, c.wins, c.season,
             case when board = 'season' then c.season_kinds else c.total end as score,
             case when board = 'season' then c.season else c.wins end as tie
      from pupils p join counts c on c.player = p.id),
    ranked as (
      select r.*, rank() over (order by r.score desc, r.tie desc)::integer as place,
             row_number() over (order by r.score desc, r.tie desc, r.display_name)::integer as n
      from placed r where r.score > 0)
    select jsonb_agg(jsonb_build_object('place', r.place, 'name', r.display_name, 'avatar', r.avatar, 'count', r.total,
                                        'wins', r.wins, 'season', r.season, 'is_me', r.id = auth.uid()) order by r.n)
    from ranked r where r.n <= 10 or r.id = auth.uid()), '[]'::jsonb);
end;
$$;
revoke execute on function public.trophies_board(text, text) from public, anon, authenticated;
grant execute on function public.trophies_board(text, text) to authenticated;

-- [{ trophy, title, how, game, kind, tier, wins }]: a schoolmate's trophies, best metal first. Empty for a hidden pupil,
-- a teacher or someone at another school.
create function public.trophies_of(player text)
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
  where p.display_name = trophies_of.player and p.school_id = public.my_school() and p.role = 'student' and not p.hidden;
  if who is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('trophy', t.id, 'title', t.name, 'how', t.how, 'game', t.game, 'kind', t.kind,
                                        'tier', public.trophy_tier(c.level), 'wins', c.wins)
                     order by c.level desc, c.wins desc, t.sort)
    from public.trophy_counts(who) c
    join public.trophy_types t on t.id = c.trophy
    where public.board_trophy_counts(t)), '[]'::jsonb);
end;
$$;
revoke execute on function public.trophies_of(text) from public, anon, authenticated;
grant execute on function public.trophies_of(text) to authenticated;

-- Who is on a board. Pupils: 'school', 'year' (my year), 'class' (my class). Teachers also: 'year:<n>' and 'class:<id>'.
-- Replaces the 20261113000100 version (same answers for the first three).
create or replace function public.board_pupils(scope text)
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
  picked_class uuid;
begin
  if scope ~ '^(year|class):' then
    if not public.is_teacher() then
      raise exception 'That leaderboard doesn''t exist.' using errcode = '22023';
    end if;
    if scope ~ '^year:([0-9]|1[0-3])$' then
      my_year := substring(scope from 6)::integer;
      if own_years then
        return query execute
          'select p.id, p.display_name, p.avatar::jsonb from public.profiles p
           where p.school_id = $1 and p.role = ''student'' and not p.hidden and public.year_level_of(p.id) = $2'
          using school, my_year;
      else
        return query
        select p.id, p.display_name, p.avatar::jsonb
        from public.profiles p join public.classes c on c.id = public.current_class_of(p.id)
        where p.school_id = school and p.role = 'student' and not p.hidden and c.year_level = my_year;
      end if;
      return;
    end if;
    if scope ~ '^class:[0-9a-f-]{36}$' then
      select c.id into picked_class from public.classes c
      where c.id = substring(scope from 7)::uuid and c.school_id = school and not c.archived;
      if picked_class is null then
        return;
      end if;
      return query
      select p.id, p.display_name, p.avatar::jsonb
      from public.profiles p
      where p.school_id = school and p.role = 'student' and not p.hidden and public.current_class_of(p.id) = picked_class;
      return;
    end if;
    raise exception 'That leaderboard doesn''t exist.' using errcode = '22023';
  end if;
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

-- A board for every game (James, 13 Nov 2026: "why are so few games on here?"). [{ place, name, avatar, count, week, games,
-- is_me }]: pupils ranked by achievements in that game (all time, or earned this week), then by finished goes of it. The
-- achievements that measure maths level are left out, as on the main board, so no game's board ranks maths.
create function public.game_board(game text, board text, scope text)
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
  if board not in ('all-time', 'week') or not exists (select 1 from public.achievement_types t where t.game = game_board.game) then
    raise exception 'That leaderboard doesn''t exist.' using errcode = '22023';
  end if;
  return coalesce((
    with pupils as (select * from public.board_pupils(scope)),
    counts as (
      select a.player, count(*)::integer as total, count(*) filter (where a.earned_at >= week_start)::integer as week
      from public.achievements a
      join public.achievement_types t on t.id = a.achievement
      where t.game = game_board.game and public.board_achievement_counts(t.measure) and a.player in (select id from pupils)
      group by a.player),
    goes as (
      select s.player, count(*)::integer as n, count(*) filter (where s.nz_day >= public.nz_day(week_start))::integer as week
      from public.scored_games s
      where s.game = game_board.game and s.player in (select id from pupils)
      group by s.player),
    placed as (
      select p.id, p.display_name, p.avatar, coalesce(c.total, 0) as total, coalesce(c.week, 0) as week,
             coalesce(g.n, 0) as games,
             case when board = 'week' then coalesce(c.week, 0) else coalesce(c.total, 0) end as score,
             case when board = 'week' then coalesce(g.week, 0) else coalesce(g.n, 0) end as tie
      from pupils p
      left join counts c on c.player = p.id
      left join goes g on g.player = p.id
      where c.player is not null or g.player is not null),
    ranked as (
      select r.*, rank() over (order by r.score desc, r.tie desc)::integer as place,
             row_number() over (order by r.score desc, r.tie desc, r.display_name)::integer as n
      from placed r where r.score > 0 or r.tie > 0)
    select jsonb_agg(jsonb_build_object('place', r.place, 'name', r.display_name, 'avatar', r.avatar, 'count', r.total,
                                        'week', r.week, 'games', r.games, 'is_me', r.id = auth.uid()) order by r.n)
    from ranked r where r.n <= 10 or r.id = auth.uid()), '[]'::jsonb);
end;
$$;
revoke execute on function public.game_board(text, text, text) from public, anon, authenticated;
grant execute on function public.game_board(text, text, text) to authenticated;
