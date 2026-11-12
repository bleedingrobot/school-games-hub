-- Trophies and earned profile pictures, the database half (docs/PROFILE-REVIEW.md section 4; docs/plans/profile/PLAN.md card P3;
-- James, 12 Nov 2026). No screens and no trophies yet: each game's card adds its own trophy types and award calls.
--
--   1. hub_season(school)          the hub's season number, from the hub's own clock on the school's row (not Dragon Maths')
--   2. trophy_types                what can be won (each game's migration inserts its own rows)
--      trophies                    what each pupil has won. The yearly New Season never touches either table.
--   3. trophy_tier, trophy_counts  bronze, silver, gold
--   4. award_trophy                the only way a trophy is given: server only (the server key, or another database function)
--   5. my_trophies, trophies_of, mark_my_trophies_seen    what the browser reads
--   6. save_my_avatar              now refuses a `pic` the pupil has not won, and writes the ring (`picTier`) itself
--
-- Nothing is dropped. save_my_avatar keeps its name, arguments and grants (first written in 20261015000100, never changed since).

-- ---------------------------------------------------------------------------
-- 1. The hub's season
-- ---------------------------------------------------------------------------

-- The hub's own clock, one per school (James, 12 Nov 2026). It is NOT the Dragon Maths clock: changing or pausing the dragon's
-- season (app_settings.lord_season_start, lord_paused_since) never moves a trophy season. They sit on the school's own row
-- because they are the school's, not a class's. Nothing changes them yet: card P12 adds the admin panel.
alter table public.schools
  add column hub_season_start date not null default public.nz_day(now()),
  add column hub_season_days integer not null default 35 check (hub_season_days between 7 and 366),
  add column hub_paused_since date;
comment on column public.schools.hub_season_start is 'Trophies: the first day of the hub''s season 1. A new school starts on the day it is made.';
comment on column public.schools.hub_season_days is 'Trophies: how many days a hub season lasts.';
comment on column public.schools.hub_paused_since is 'Trophies: while set, the hub''s season number stands still at this day (holidays).';
-- Every school there is today starts where Dragon Maths season 1 started, so "season 1" is the same weeks so far.
update public.schools set hub_season_start = date '2026-10-18';

-- The hub's season number for one school today: seasons run back to back from hub_season_start, each hub_season_days long.
-- While the school is paused the number stands still. 0 before the first day, or for a school that doesn't exist.
create function public.hub_season(school integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when least(public.nz_day(now()), coalesce(s.hub_paused_since, public.nz_day(now()))) < s.hub_season_start then 0
      else (least(public.nz_day(now()), coalesce(s.hub_paused_since, public.nz_day(now()))) - s.hub_season_start) / s.hub_season_days + 1 end
    from public.schools s
    where s.id = hub_season.school), 0)
$$;

-- ---------------------------------------------------------------------------
-- 2. The tables
-- ---------------------------------------------------------------------------

-- What can be won. The id is also what an avatar's `pic` holds, so it must pass is_valid_avatar's short-code rule (24 at most).
create table public.trophy_types (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,23}$'),
  -- The game's home card id ('lord', 'weka', ...), or 'hub' for a reward that belongs to no one game.
  game text not null check (game ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  name text not null check (length(name) between 1 and 40),
  -- How to win it, in a child's words. Never a maths level.
  how text not null check (length(how) between 1 and 140),
  -- 'picture' can also be worn in place of the built avatar.
  kind text not null check (kind in ('trophy', 'picture')),
  -- How often it can be won: once per hub season, once per calendar year, once ever, or in steps (1 bronze, 2 silver, 3 gold).
  repeat text not null check (repeat in ('season', 'year', 'once', 'steps')),
  -- A short code for the painting, or null while there is only the placeholder.
  art text check (art ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  sort integer not null default 0
);
comment on table public.trophy_types is
  'Trophies and earned pictures that can be won. Each game''s migration inserts its own rows. Kept through New Season.';

-- What each pupil has won: one row per win. `season` and `year` say which win it was, so the same feat counts once:
--   repeat 'season': season = the season won in, year = the calendar year      'year': season 0, year = the calendar year
--   repeat 'once':   season 0, year 0                                       'steps': season = the step (1 to 3), year 0
-- Rows go only when the pupil's account goes. teacher_new_season never touches this table.
create table public.trophies (
  player uuid not null references public.profiles (id) on delete cascade,
  trophy text not null references public.trophy_types (id),
  season integer not null default 0 check (season >= 0),
  year integer not null default 0 check (year >= 0),
  earned_at timestamptz not null default now(),
  -- When the pupil was shown the "New trophy!" moment. Null = not yet.
  seen_at timestamptz,
  -- Whatever the game wants to remember about the win (a time, a place). Only the winner and the server ever read it.
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object' and pg_column_size(detail) <= 2048),
  primary key (player, trophy, season, year)
);
comment on table public.trophies is
  'Trophies each pupil has won, given only by award_trophy. Kept through New Season; removed with the account.';

alter table public.trophy_types enable row level security;
alter table public.trophies enable row level security;
-- No policy and no grant: pupils read through my_trophies and trophies_of, and only award_trophy writes.
revoke all on public.trophy_types, public.trophies from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Bronze, silver, gold
-- ---------------------------------------------------------------------------

-- The metal for a level: 1 bronze, 2 silver, 3 or more gold. Must match tierOf in src/avatar/earnedPictures.ts.
create function public.trophy_tier(level integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when level >= 3 then 'gold' when level = 2 then 'silver' when level = 1 then 'bronze' end
$$;

-- One row per trophy a player holds: how many wins, and the level the metal comes from (the number of wins, or for a
-- 'steps' trophy the highest step reached).
create function public.trophy_counts(who uuid)
returns table (trophy text, wins integer, level integer, first_at timestamptz, last_at timestamptz, unseen boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select w.trophy, count(*)::integer,
         least(3, case when t.repeat = 'steps' then max(w.season) else count(*)::integer end),
         min(w.earned_at), max(w.earned_at), bool_or(w.seen_at is null)
  from public.trophies w
  join public.trophy_types t on t.id = w.trophy
  where w.player = who
  group by w.trophy, t.repeat
$$;

-- ---------------------------------------------------------------------------
-- 4. Awarding
-- ---------------------------------------------------------------------------

-- Gives a trophy. Server only: the server key, or a game's own security-definer function (where it already calls
-- game_progress_changed). Safe to call again for the same feat: the second call changes nothing.
-- A 'steps' trophy needs detail.step (1, 2 or 3). Gives no hub points.
-- `season` is for a game with its own season number (Dragon Maths sends lord_hall.season). Left out, a 'season' trophy
-- uses the hub's season. It is ignored for the other kinds.
-- Returns { won, trophy, tier, count }: `won` is true only when this call added a row.
create function public.award_trophy(who uuid, trophy text, detail jsonb default '{}'::jsonb, season integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.trophy_types;
  school integer;
  today date := public.nz_day(now());
  s integer := 0;
  y integer := 0;
  added integer := 0;
  c record;
begin
  select * into t from public.trophy_types x where x.id = award_trophy.trophy;
  if not found then
    raise exception 'There is no trophy called %.', award_trophy.trophy using errcode = '22023';
  end if;
  select p.school_id into school from public.profiles p where p.id = who;
  if not found then
    raise exception 'That player doesn''t exist.' using errcode = '22023';
  end if;
  if detail is null or jsonb_typeof(detail) <> 'object' then
    raise exception 'A trophy''s detail must be an object.' using errcode = '22023';
  end if;

  if t.repeat = 'season' then
    if award_trophy.season < 0 then
      raise exception 'A season number can''t be below 0.' using errcode = '22023';
    end if;
    s := coalesce(award_trophy.season, public.hub_season(school));
    y := extract(year from today)::integer;
  elsif t.repeat = 'year' then
    y := extract(year from today)::integer;
  elsif t.repeat = 'steps' then
    if coalesce(detail ->> 'step', '') !~ '^[123]$' then
      raise exception 'A steps trophy needs a step of 1, 2 or 3.' using errcode = '22023';
    end if;
    s := (detail ->> 'step')::integer;
  end if;

  -- A season that runs over New Year's Day is still one season: a win earlier in it already counts.
  if t.repeat <> 'season' or not exists (
    select 1 from public.trophies w
    where w.player = who and w.trophy = t.id and w.season = s and w.earned_at > now() - interval '200 days') then
    insert into public.trophies (player, trophy, season, year, detail)
    values (who, t.id, s, y, award_trophy.detail)
    on conflict do nothing;
    get diagnostics added = row_count;
  end if;

  select * into c from public.trophy_counts(who) k where k.trophy = t.id;
  -- A picture the pupil is wearing gets its new ring straight away.
  if added > 0 and t.kind = 'picture' then
    update public.profiles p set avatar = p.avatar || jsonb_build_object('picTier', public.trophy_tier(c.level))
    where p.id = who and p.avatar ->> 'pic' = t.id;
  end if;
  return jsonb_build_object('won', added > 0, 'trophy', t.id, 'tier', public.trophy_tier(c.level), 'count', coalesce(c.wins, 0));
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. What the browser reads
-- ---------------------------------------------------------------------------

-- My own cabinet: { season, trophies: [...], next: [...] }.
--   trophies: every trophy I hold, in shelf order, with its metal, how many times, and each win (with its detail).
--   next: up to three I have not won yet, with how to win them.
create function public.my_trophies()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  perform public.require_school_user();
  return jsonb_build_object(
    'season', public.hub_season(public.my_school()),
    'trophies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'game', t.game, 'name', t.name, 'how', t.how, 'kind', t.kind, 'repeat', t.repeat, 'art', t.art,
        'tier', public.trophy_tier(c.level), 'count', c.wins, 'firstAt', c.first_at, 'lastAt', c.last_at, 'isNew', c.unseen,
        'wins', (select jsonb_agg(jsonb_build_object('season', w.season, 'year', w.year, 'at', w.earned_at, 'detail', w.detail)
                                  order by w.earned_at, w.season)
                 from public.trophies w where w.player = me and w.trophy = t.id))
        order by t.sort, t.id)
      from public.trophy_counts(me) c join public.trophy_types t on t.id = c.trophy), '[]'::jsonb),
    'next', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'game', n.game, 'name', n.name, 'how', n.how, 'kind', n.kind,
        'repeat', n.repeat, 'art', n.art) order by n.sort, n.id)
      from (select t.* from public.trophy_types t
            where not exists (select 1 from public.trophies w where w.player = me and w.trophy = t.id)
            order by t.sort, t.id limit 3) n), '[]'::jsonb));
end;
$$;

-- A schoolmate's trophies, for beside their name: [{ id, tier }] and nothing else (no dates, no detail).
-- An empty list for someone in another school.
create function public.trophies_of(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_school_user();
  if not public.same_school(trophies_of.player) then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', t.id, 'tier', public.trophy_tier(c.level)) order by t.sort, t.id)
    from public.trophy_counts(trophies_of.player) c join public.trophy_types t on t.id = c.trophy), '[]'::jsonb);
end;
$$;

-- I have been shown my new trophies. Returns how many were new.
create function public.mark_my_trophies_seen()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  perform public.require_school_user();
  update public.trophies set seen_at = now() where player = auth.uid() and seen_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Saving an avatar with an earned picture
-- ---------------------------------------------------------------------------

-- As before (20261015000100), plus: `pic` must be a picture trophy this player has won, and the ring (`picTier`) is whatever
-- the server says it is, never what the browser sent. Every screen that draws an avatar gets the picture and ring with it.
create or replace function public.save_my_avatar(avatar jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean jsonb;
  lvl integer;
begin
  perform public.require_school_user();
  if not public.is_valid_avatar(avatar) then
    raise exception 'That avatar isn''t valid.' using errcode = '22023';
  end if;
  clean := save_my_avatar.avatar - 'picTier';
  if clean ? 'pic' then
    select c.level into lvl
    from public.trophy_counts(auth.uid()) c join public.trophy_types t on t.id = c.trophy
    where c.trophy = clean ->> 'pic' and t.kind = 'picture';
    if lvl is null then
      raise exception 'You haven''t won that picture yet.' using errcode = '22023';
    end if;
    clean := clean || jsonb_build_object('picTier', public.trophy_tier(lvl));
  end if;
  update public.profiles set avatar = clean where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- Lock new functions
-- ---------------------------------------------------------------------------

revoke execute on function
  public.hub_season(integer),
  public.trophy_tier(integer),
  public.trophy_counts(uuid),
  public.award_trophy(uuid, text, jsonb, integer),
  public.my_trophies(),
  public.trophies_of(uuid),
  public.mark_my_trophies_seen()
from public, anon, authenticated;
grant execute on function public.my_trophies(), public.trophies_of(uuid), public.mark_my_trophies_seen() to authenticated;
grant execute on function public.hub_season(integer), public.award_trophy(uuid, text, jsonb, integer) to service_role;
