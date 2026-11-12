-- Trophies for six games that play against classmates or a rival: Chess, Checkers, 101, Power Clash, Wormholes and Archery
-- (docs/PROFILE-REVIEW.md section 5; docs/plans/profile/PLAN.md card P8 part 1; trophy system 20261112000800_trophies.sql;
-- the same pattern as cards P7, 20261112001700 and 20261112002000).
--
--   1. season_counts: small counters per pupil, game and season that the New Season keeps (it wipes the games' own tables)
--   2. The trophy types (nine)
--   3. Wins against classmates, counted per hub season, from each game's scored_games row
--        101, Power Clash, Wormholes: 15 classmate wins in a season give the season's trophy
--        Chess, Checkers: the school's top three by classmate wins, worked out once when the hub season ends
--   4. Chess and Checkers Champion rank (ratings.best_rank reaches 3): Champion's Knight, Champion's King
--   5. Archery: Hawk Feather (beat Hawk, each season); Golden Bow picture (beat Hawk with Plain Arrows in all 4 worlds, once
--      a year), from the counts the server function already saves in archery_players.stats
--   6. The season's end: a job that crowns the Chess and Checkers top three of each school's season just ended
--   7. Back-fill and back-awards from today's records
--
-- Only game wins are counted or ranked, never maths results. A classmate win counts when the game gave it points, so each
-- game's own daily limits (Chess and Checkers: 5 rated games a pair a day) stop two friends farming wins. Every watcher
-- runs after the game has written its record and turns any error into a warning, so a game is never lost to a trophy.
-- Trophies give no hub points.

-- ---------------------------------------------------------------------------
-- 1. season_counts
-- ---------------------------------------------------------------------------

-- One number per pupil, game, season and key. A hub-season count has the hub season's number and the year that season
-- began (a season that runs over New Year's Day stays one row); a count for the whole year has season 0. Not in
-- teacher_new_season's list, so the yearly New Season keeps it. Only the server writes it; nobody reads it but the server.
create table public.season_counts (
  player uuid not null references public.profiles (id) on delete cascade,
  game text not null check (game ~ '^[a-z0-9-]{1,24}$'),
  season integer not null check (season >= 0),
  year integer not null check (year between 2000 and 3000),
  key text not null check (key ~ '^[a-z0-9-]{1,40}$'),
  n integer not null default 0 check (n >= 0),
  updated_at timestamptz not null default now(),
  primary key (player, game, season, year, key)
);
create index season_counts_by_season on public.season_counts (game, season, year, key);

alter table public.season_counts enable row level security;
revoke all on public.season_counts from anon, authenticated;

-- The day a school's hub season began (season 1 begins on hub_season_start).
create function public.hub_season_began(school integer, season integer)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select s.hub_season_start + (greatest(season, 1) - 1) * s.hub_season_days from public.schools s where s.id = school
$$;

-- Adds `add` to a pupil's count for their school's hub season now (or for the year, if `whole_year`), and returns the new
-- number.
create function public.season_count_add(who uuid, game text, key text, add integer default 1, whole_year boolean default false)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  school integer;
  s integer := 0;
  y integer;
  total integer;
begin
  select p.school_id into school from public.profiles p where p.id = who;
  if whole_year then
    y := extract(year from public.nz_day(now()))::integer;
  else
    s := public.hub_season(school);
    y := extract(year from coalesce(public.hub_season_began(school, s), public.nz_day(now())))::integer;
  end if;
  insert into public.season_counts as c (player, game, season, year, key, n)
  values (who, season_count_add.game, s, y, season_count_add.key, season_count_add.add)
  on conflict on constraint season_counts_pkey do update set n = c.n + excluded.n, updated_at = now()
  returning c.n into total;
  return total;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. The trophy types
-- ---------------------------------------------------------------------------

-- sort follows the order of the review's section 5 table (10 a row), as in cards P7.
insert into public.trophy_types (id, game, name, how, kind, repeat, art, sort) values
  ('chess-crown', 'chess', 'Chess Crown', 'Be in your school''s top three for wins against classmates in a season.', 'picture', 'season', null, 50),
  ('chess-knight', 'chess', 'Champion''s Knight', 'Reach Champion rank in Chess.', 'trophy', 'year', null, 60),
  ('checkers-crown', 'checkers', 'Checkers Crown', 'Be in your school''s top three for wins against classmates in a season.', 'picture', 'season', null, 70),
  ('checkers-king', 'checkers', 'Champion''s King', 'Reach Champion rank in Checkers.', 'trophy', 'year', null, 80),
  ('101-shark', '101', 'Card Shark', 'Win 15 games of 101 against classmates in a season.', 'trophy', 'season', null, 90),
  ('pc-cup', 'power-clash', 'Clash Cup', 'Win 15 Power Clash games against classmates in a season.', 'trophy', 'season', null, 100),
  ('space-wormhole', 'space', 'Wormhole', 'Win 15 Wormholes games against classmates in a season.', 'trophy', 'season', null, 110),
  ('archery-feather', 'archery', 'Hawk Feather', 'Beat Hawk.', 'trophy', 'season', null, 220),
  ('archery-bow', 'archery', 'Golden Bow', 'Beat Hawk with Plain Arrows only in all 4 worlds.', 'picture', 'year', null, 230);

-- ---------------------------------------------------------------------------
-- 3. Wins against classmates
-- ---------------------------------------------------------------------------

-- The trophy 15 classmate wins in a season give, per game (Chess and Checkers rank them instead: section 6).
create function public.classmate_wins_trophy(game text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case game when '101' then '101-shark' when 'power-clash' then 'pc-cup' when 'space' then 'space-wormhole' end
$$;

-- A finished classmate game's row for one player (score_friend_game, score_card_game, score_power_game, score_space_game).
-- A Wormholes game counts only when at least two pupils played it to the end (bots fill the other seats), as its scoring
-- already checks.
create function public.scored_game_trophies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wins integer;
  t text;
begin
  if new.kind <> 'friend' or new.result <> 'won' or new.points <= 0
     or new.game not in ('chess', 'checkers', '101', 'power-clash', 'space') then
    return null;
  end if;
  wins := public.season_count_add(new.player, new.game, 'wins');
  t := public.classmate_wins_trophy(new.game);
  if t is not null and wins = 15 then
    perform public.award_trophy(new.player, t, jsonb_build_object('wins', wins));
  end if;
  return null;
exception when others then
  raise warning 'a classmate-wins trophy failed (%)', sqlstate;
  return null;
end;
$$;

create trigger trophies_when_saved
after insert on public.scored_games
for each row
execute function public.scored_game_trophies();

-- ---------------------------------------------------------------------------
-- 4. Champion rank
-- ---------------------------------------------------------------------------

-- ratings.best_rank only goes up (score_friend_game): 3 is Champion (rank_for, 20261015000400).
create function public.rating_trophies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.best_rank >= 3 and (tg_op = 'INSERT' or old.best_rank < 3) then
    perform public.award_trophy(new.player, case new.game when 'chess' then 'chess-knight' else 'checkers-king' end);
  end if;
  return null;
exception when others then
  raise warning 'a Champion rank trophy failed (%)', sqlstate;
  return null;
end;
$$;

create trigger trophies_when_saved
after insert or update of best_rank on public.ratings
for each row
execute function public.rating_trophies();

-- ---------------------------------------------------------------------------
-- 5. Archery
-- ---------------------------------------------------------------------------

-- archery_note adds a finished fight's counts in one save (shared/archery/stats.ts, botFightStats): a bot fight won against
-- Hawk adds hawk_wins and win_<world>, and plain_wins too when only Plain Arrows were shot. Classmate fights never add
-- hawk_wins. So a save that adds hawk_wins, plain_wins and one world's win is Hawk beaten with Plain Arrows in that world.
create function public.archery_player_trophies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  more_hawk boolean := coalesce((new.stats ->> 'hawk_wins')::integer, 0) > coalesce((old.stats ->> 'hawk_wins')::integer, 0);
  more_plain boolean := coalesce((new.stats ->> 'plain_wins')::integer, 0) > coalesce((old.stats ->> 'plain_wins')::integer, 0);
  w text;
  worlds integer;
begin
  if not more_hawk then
    return null;
  end if;
  perform public.season_count_add(new.player, 'archery', 'hawk');
  perform public.award_trophy(new.player, 'archery-feather');
  if more_plain then
    foreach w in array array['forest', 'desert', 'snow', 'city'] loop
      if coalesce((new.stats ->> ('win_' || w))::integer, 0) > coalesce((old.stats ->> ('win_' || w))::integer, 0) then
        if public.season_count_add(new.player, 'archery', 'hawk-plain-' || w, 1, true) = 1 then
          select count(*)::integer into worlds from public.season_counts c
          where c.player = new.player and c.game = 'archery' and c.season = 0
            and c.year = extract(year from public.nz_day(now()))::integer and c.key like 'hawk-plain-%';
          if worlds = 4 then
            perform public.award_trophy(new.player, 'archery-bow');
          end if;
        end if;
      end if;
    end loop;
  end if;
  return null;
exception when others then
  raise warning 'an Archery trophy failed (%)', sqlstate;
  return null;
end;
$$;

create trigger trophies_when_saved
after update of stats on public.archery_players
for each row
execute function public.archery_player_trophies();

-- ---------------------------------------------------------------------------
-- 6. The season's end: the Chess and Checkers top three
-- ---------------------------------------------------------------------------

-- Which school seasons have been crowned already, per game, so each is crowned once.
create table public.season_crowns_done (
  school_id integer not null references public.schools (id) on delete cascade,
  game text not null,
  season integer not null,
  done_at timestamptz not null default now(),
  primary key (school_id, game, season)
);
alter table public.season_crowns_done enable row level security;
revoke all on public.season_crowns_done from anon, authenticated;

-- Crowns every season that has ended and not been crowned yet: in each school, the pupils with the most classmate wins in
-- that season (at least one win; pupils tied for a place all get it, so a tie for third crowns everyone in it). Teachers and
-- hidden profiles are left out, as on the boards. Run every hour by pg_cron; safe to run again (it only does what is left).
create function public.season_crowns()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  sc record;
  g record;
  r record;
  given integer := 0;
begin
  for sc in select s.id, public.hub_season(s.id) as cur from public.schools s loop
    for g in select x.game, x.trophy from (values ('chess', 'chess-crown'), ('checkers', 'checkers-crown')) x(game, trophy) loop
      for r in
        select k.season, k.player, k.n,
               rank() over (partition by k.season order by k.n desc) as place
        from public.season_counts k
        join public.profiles p on p.id = k.player
        where p.school_id = sc.id and p.role = 'student' and not p.hidden
          and k.game = g.game and k.key = 'wins' and k.n > 0
          and k.season between 1 and sc.cur - 1
          and k.year = extract(year from public.hub_season_began(sc.id, k.season))::integer
          and not exists (select 1 from public.season_crowns_done d where d.school_id = sc.id and d.game = g.game and d.season = k.season)
      loop
        if r.place <= 3 then
          perform public.award_trophy(r.player, g.trophy, jsonb_build_object('place', r.place, 'wins', r.n), r.season);
          given := given + 1;
        end if;
      end loop;
      insert into public.season_crowns_done (school_id, game, season)
      select sc.id, g.game, n from generate_series(1, sc.cur - 1) n
      on conflict do nothing;
    end loop;
  end loop;
  return given;
end;
$$;

select cron.schedule('season-crowns', '11 * * * *', 'select public.season_crowns()');

revoke execute on function
  public.hub_season_began(integer, integer), public.season_count_add(uuid, text, text, integer, boolean),
  public.classmate_wins_trophy(text), public.scored_game_trophies(), public.rating_trophies(),
  public.archery_player_trophies(), public.season_crowns()
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Back-fill and back-awards
-- ---------------------------------------------------------------------------

-- Seasons that ended before today are marked crowned (there were no counts then, so nothing to crown).
insert into public.season_crowns_done (school_id, game, season)
select s.id, g.game, n from public.schools s
cross join (values ('chess'), ('checkers')) g(game)
cross join lateral generate_series(1, public.hub_season(s.id) - 1) n
on conflict do nothing;

do $$
declare
  r record;
  res jsonb;
begin
  -- Classmate wins still in scored_games (the last New Season wiped older ones), counted in the hub season they were won.
  insert into public.season_counts (player, game, season, year, key, n)
  select w.player, w.game, w.season, extract(year from public.hub_season_began(w.school_id, w.season))::integer, 'wins', count(*)
  from (
    select g.player, g.game, p.school_id,
           (g.nz_day - s.hub_season_start) / s.hub_season_days + 1 as season
    from public.scored_games g
    join public.profiles p on p.id = g.player
    join public.schools s on s.id = p.school_id
    where g.kind = 'friend' and g.result = 'won' and g.points > 0
      and g.game in ('chess', 'checkers', '101', 'power-clash', 'space') and g.nz_day >= s.hub_season_start
  ) w
  group by w.player, w.game, w.season, w.school_id;

  -- 15 wins in a season: the trophy, dated by the 15th win.
  for r in
    select x.player, x.game, x.season, x.finished_at from (
      select g.player, g.game, (g.nz_day - s.hub_season_start) / s.hub_season_days + 1 as season, g.finished_at,
             row_number() over (partition by g.player, g.game, (g.nz_day - s.hub_season_start) / s.hub_season_days
                                order by g.finished_at, g.id) as nth
      from public.scored_games g
      join public.profiles p on p.id = g.player
      join public.schools s on s.id = p.school_id
      where g.kind = 'friend' and g.result = 'won' and g.points > 0
        and g.game in ('101', 'power-clash', 'space') and g.nz_day >= s.hub_season_start) x
    where x.nth = 15 order by x.finished_at
  loop
    res := public.award_trophy(r.player, public.classmate_wins_trophy(r.game), jsonb_build_object('wins', 15), r.season);
    if (res ->> 'won')::boolean then
      update public.trophies set earned_at = r.finished_at
      where player = r.player and trophy = public.classmate_wins_trophy(r.game) and season = r.season;
    end if;
  end loop;

  -- Champion rank held today, dated by the pupil's last classmate game.
  for r in
    select k.player, k.game, (select max(g.finished_at) from public.scored_games g
                              where g.player = k.player and g.game = k.game and g.kind = 'friend') as at
    from public.ratings k where k.best_rank >= 3
  loop
    res := public.award_trophy(r.player, case r.game when 'chess' then 'chess-knight' else 'checkers-king' end);
    if (res ->> 'won')::boolean and r.at is not null then
      update public.trophies set earned_at = r.at
      where player = r.player and trophy = case r.game when 'chess' then 'chess-knight' else 'checkers-king' end and season = 0;
    end if;
  end loop;

  -- Hawk beaten: each won fight against Hawk still kept, in the hub season it was won. (Which arrows were shot isn't kept
  -- with a fight, so the Golden Bow starts from today.)
  for r in
    select f.player, (public.nz_day(f.finished_at) - s.hub_season_start) / s.hub_season_days + 1 as season,
           min(f.finished_at) as at, count(*)::integer as n
    from public.archery_fights f
    join public.profiles p on p.id = f.player
    join public.schools s on s.id = p.school_id
    where f.opponent = 'hard' and f.won and f.finished_at is not null and public.nz_day(f.finished_at) >= s.hub_season_start
    group by f.player, s.hub_season_start, s.hub_season_days, p.school_id, 2
    order by 3
  loop
    insert into public.season_counts (player, game, season, year, key, n)
    select r.player, 'archery', r.season, extract(year from public.hub_season_began(p.school_id, r.season))::integer, 'hawk', r.n
    from public.profiles p where p.id = r.player
    on conflict (player, game, season, year, key) do update set n = excluded.n;
    res := public.award_trophy(r.player, 'archery-feather', '{}', r.season);
    if (res ->> 'won')::boolean then
      update public.trophies set earned_at = r.at where player = r.player and trophy = 'archery-feather' and season = r.season;
    end if;
  end loop;
end;
$$;
