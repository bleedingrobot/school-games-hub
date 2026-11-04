-- Leaderboards and halls show pupils only (James, 4 Nov 2026): teachers who play a game are left off every board.
-- Nothing is deleted: each board just skips profiles whose role isn't 'student'. Marble Rush, Mine, Diamond, Sky Isles
-- and Star Trader's gallery already did this. Each function below is main's newest version with that one filter added.

CREATE OR REPLACE FUNCTION public.leaderboard(game text, board text)
 RETURNS TABLE(place integer, display_name text, avatar jsonb, rank text, points integer, games integer, is_me boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    where not p.hidden and p.role = 'student' and p.school_id = public.my_school()
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
$function$;

CREATE OR REPLACE FUNCTION public.gem_keep_leaderboard()
 RETURNS TABLE(place integer, display_name text, avatar jsonb, stars integer, level_keys integer, is_me boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_school_user() then
    return;
  end if;
  return query
  with totals as (
    select p.id, p.display_name, p.avatar,
           coalesce(sum(g.best_stars), 0)::integer as stars,
           (count(*) filter (where g.key_passed))::integer as level_keys
    from public.profiles p
    join public.gem_keep_progress g on g.player = p.id
    where not p.hidden and p.role = 'student' and p.school_id = public.my_school()
    group by p.id
  ),
  placed as (
    select t.*, rank() over (order by t.stars desc)::integer as place,
           row_number() over (order by t.stars desc, t.level_keys desc, t.display_name) as row_order
    from totals t where t.stars > 0
  )
  select pl.place, pl.display_name, pl.avatar, pl.stars, pl.level_keys, pl.id = auth.uid()
  from placed pl
  where pl.row_order <= 10 or pl.id = auth.uid()
  order by pl.row_order;
end;
$function$;

CREATE OR REPLACE FUNCTION public.monsters_leaderboard()
 RETURNS TABLE(place integer, display_name text, avatar jsonb, monsters integer, badges integer, is_me boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_school_user() then
    return;
  end if;
  return query
  with placed as (
    select p.id, p.display_name, p.avatar, m.owned_count as monsters, m.badges_count as badges,
           rank() over (order by m.owned_count desc)::integer as place,
           row_number() over (order by m.owned_count desc, m.badges_count desc, p.display_name) as row_order
    from public.profiles p
    join public.monster_saves m on m.player = p.id
    where not p.hidden and p.role = 'student' and p.school_id = public.my_school() and m.owned_count > 0
  )
  select pl.place, pl.display_name, pl.avatar, pl.monsters, pl.badges, pl.id = auth.uid()
  from placed pl
  where pl.row_order <= 10 or pl.id = auth.uid()
  order by pl.row_order;
end;
$function$;

CREATE OR REPLACE FUNCTION public.lord_hall()
 RETURNS TABLE(season integer, display_name text, avatar jsonb, kills integer, is_me boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_school_user() then
    return;
  end if;
  return query
  select hl.season, p.display_name, p.avatar, hl.kills, hl.player = auth.uid()
  from public.lord_hall hl
  join public.profiles p on p.id = hl.player
  where not p.hidden and p.role = 'student' and p.school_id = public.my_school()
  order by hl.season desc, hl.kills desc, hl.first_at
  limit 100;
end;
$function$;

CREATE OR REPLACE FUNCTION public.lord_warriors()
 RETURNS TABLE(place integer, display_name text, avatar jsonb, level integer, stars integer, dragons integer, is_me boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_school_user() then
    return;
  end if;
  return query
  with cur as (select public.lord_current_season(auth.uid()) as n),
  base as (
    select p.id, p.display_name as name, p.avatar as pic,
           (h.hero ->> 'level')::integer as hero_level,
           coalesce((h.hero ->> 'dragonKills')::integer, 0) as hero_stars,
           coalesce((h.hero ->> 'exp')::numeric, 0) as hero_exp,
           coalesce((select hl.kills from public.lord_hall hl where hl.player = h.player and hl.season = cur.n), 0) as season_kills
    from public.lord_heroes h
    join public.profiles p on p.id = h.player
    cross join cur
    where h.season = cur.n and not p.hidden and p.role = 'student' and p.school_id = public.my_school()
  ),
  placed as (
    select b.*,
           rank() over (order by b.season_kills desc, b.hero_level desc)::integer as pl,
           row_number() over (order by b.season_kills desc, b.hero_level desc, b.hero_exp desc, b.name) as row_order
    from base b
  )
  select x.pl, x.name, x.pic, x.hero_level, x.hero_stars, x.season_kills::integer, x.id = auth.uid()
  from placed x
  where x.row_order <= 10 or x.id = auth.uid()
  order by x.row_order;
end;
$function$;

create or replace function public.clan_scoreboard()
returns table (
  place integer,
  clan_name text,
  fame integer,
  is_me boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_school_user() then
    return;
  end if;
  return query
  with base as (
    select c.player as who, c.name as clan, c.fame as points, c.created_at as born
    from public.clans c join public.profiles p on p.id = c.player
    where not p.hidden and p.role = 'student' and p.school_id = public.my_school()
  ),
  placed as (
    select b.*,
           rank() over (order by b.points desc)::integer as pl,
           row_number() over (order by b.points desc, b.born, b.clan, b.who) as row_order
    from base b
  )
  select x.pl, x.clan, x.points, x.who = auth.uid()
  from placed x
  where (x.row_order <= 10 and x.points > 0) or x.who = auth.uid()
  order by x.row_order;
end;
$$;

create or replace function public.clan_hall_of_legends()
returns table (
  season integer,
  clan_name text,
  village_done_on date,
  monster_done_on date,
  is_me boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_school_user() then
    return;
  end if;
  return query
  select h.season, h.clan_name, h.village_done_on, h.monster_done_on, h.player = auth.uid()
  from public.clan_hall h join public.profiles p on p.id = h.player
  where not p.hidden and p.role = 'student' and h.school_id = public.my_school()
    and (h.village_done_on is not null or h.monster_done_on is not null)
  order by h.season desc, coalesce(h.monster_done_on, h.village_done_on), h.clan_name
  limit 200;
end;
$$;
