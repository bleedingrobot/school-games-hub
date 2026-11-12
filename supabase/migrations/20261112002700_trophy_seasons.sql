-- Coming back, two-game rewards and the school hall of fame (docs/plans/profile/PLAN.md card P10; docs/PROFILE-REVIEW.md
-- sections 5 and 7; James, 12 Nov 2026).
--
--   1. hub_season_start_day(school): the first day of the hub season running now (null before season 1).
--   2. New trophy types: Season Regular, All-rounder, the six two-game rewards and the Best Friends Cup.
--   3. trophy_pairs: which two trophies make each two-game reward, and whether both must be in the same season or year.
--   4. trophy_followups(who): the one check run whenever a trophy is won (a trigger on trophies): two-game rewards,
--      All-rounder (trophies from 5 games) and the Best Friends Cup (golden prizes in 2, 4 and 6 garden games).
--   5. Season Regular: a finished go (a row in scored_games) on 15 different school days (Monday to Friday) in a hub season.
--   6. my_trophy_pairs(): each two-game reward with the halves the pupil holds, for the cabinet's half-lit pairs.
--   7. hall_of_fame(): each season's first five dragon slayers and this season's new picture winners in my school.
--      Game feats only, pupils only, made-up names only (an approved own name shows as null).
--   8. The once-only "new season" note: season_notes, my_season_note(), mark_season_note_seen(); my_home_page carries it.
--   9. Back-award from what pupils already hold and have played this season.
--
-- A failed check never loses a game's save or another trophy: each trigger catches its own errors.

-- ---------------------------------------------------------------------------
-- 1. When this hub season started
-- ---------------------------------------------------------------------------

create function public.hub_season_start_day(school integer)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.hub_season(school) < 1 then null
              else s.hub_season_start + (public.hub_season(school) - 1) * s.hub_season_days end
  from public.schools s
  where s.id = hub_season_start_day.school
$$;

-- ---------------------------------------------------------------------------
-- 2. The trophy types
-- ---------------------------------------------------------------------------

insert into public.trophy_types (id, game, name, how, kind, repeat, art, sort) values
  ('hub-regular', 'hub', 'Season Regular', 'Finish a game on 15 different school days in one season.', 'trophy', 'season', null, 330),
  ('hub-allrounder', 'hub', 'All-rounder', 'Win trophies in 5 different games.', 'picture', 'once', null, 340),
  ('pair-double-slayer', 'hub', 'Double Slayer',
   'Slay the dragon in Dragon Maths and beat your clan''s season monster in Clan Quest, in the same season.', 'picture', 'season', null, 400),
  ('pair-board-master', 'hub', 'Board Master', 'Reach Champion rank in both chess and checkers in the same year.', 'picture', 'year', null, 410),
  ('pair-treasure-keeper', 'hub', 'Treasure Keeper',
   'Light the Sky Lighthouse in Sky Isles and find the Heart Diamond in Diamond Drop, in the same year.', 'picture', 'year', null, 420),
  ('pair-adventurer', 'hub', 'Adventurer''s Badge',
   'Beat Hawk in Archery and win gold in all 6 mines in Mine Runner, in the same year.', 'trophy', 'year', null, 430),
  ('pair-star-monarch', 'hub', 'Star Monarch',
   'Finish a full reign in Royal Decree and build the Star Ring in Star Trader, in the same year.', 'trophy', 'year', null, 440),
  ('pair-golden-wings', 'hub', 'Golden Wings',
   'Win gold on every Marble Rush course and every Toon Flap level, in the same year.', 'trophy', 'year', null, 450),
  ('hub-best-friends', 'hub', 'Best Friends Cup',
   'Finish a golden prize in two different garden games. Four games for silver, six for gold.', 'trophy', 'steps', null, 5300);

-- ---------------------------------------------------------------------------
-- 3. The pairs
-- ---------------------------------------------------------------------------

-- A two-game reward and its two halves. 'season': both halves won since this hub season started; 'year': both won this
-- calendar year. A pair whose half isn't built yet simply isn't listed: add its row in the migration that builds the half.
create table public.trophy_pairs (
  trophy text primary key references public.trophy_types (id) on delete cascade,
  first_half text not null references public.trophy_types (id) on delete cascade,
  second_half text not null references public.trophy_types (id) on delete cascade,
  within text not null check (within in ('season', 'year')),
  check (first_half <> second_half)
);
comment on table public.trophy_pairs is 'Two-game rewards: the two trophies that make each one (profile card P10).';
alter table public.trophy_pairs enable row level security;
-- The server only: no policy, no grant.

insert into public.trophy_pairs (trophy, first_half, second_half, within) values
  ('pair-double-slayer', 'dm-slayer', 'clan-tooth', 'season'),
  ('pair-board-master', 'chess-knight', 'checkers-king', 'year'),
  ('pair-treasure-keeper', 'isles-lighthouse', 'diamond-heart', 'year'),
  ('pair-adventurer', 'archery-feather', 'mine-lamp', 'year'),
  ('pair-star-monarch', 'decree-seal', 'trader-ring', 'year'),
  ('pair-golden-wings', 'marble-cup', 'toonflap-rainbow', 'year');

-- Does `who` hold this trophy within the pair's time? 'season' counts wins on or after `since` (the hub season's first
-- day: Dragon Maths runs its own season clock, so the day is what the two games share); 'year' counts this year's wins.
create function public.trophy_held_within(who uuid, trophy text, within text, since date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trophies w
    where w.player = who and w.trophy = trophy_held_within.trophy
      and case when within = 'season' then since is not null and public.nz_day(w.earned_at) >= since
               else w.year = extract(year from public.nz_day(now()))::integer end)
$$;

-- ---------------------------------------------------------------------------
-- 4. The check run whenever a trophy is won
-- ---------------------------------------------------------------------------

-- Gives every reward that `who` now qualifies for. Safe to call again: award_trophy adds nothing twice.
-- Returns the ids it gave.
create function public.trophy_followups(who uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  school integer;
  since date;
  pair record;
  games integer;
  garden integer;
  step integer;
  given text[] := '{}';
begin
  select p.school_id into school from public.profiles p where p.id = who;
  if not found then
    return given;
  end if;
  since := public.hub_season_start_day(school);

  -- Two-game rewards.
  for pair in select * from public.trophy_pairs loop
    if public.trophy_held_within(who, pair.first_half, pair.within, since)
       and public.trophy_held_within(who, pair.second_half, pair.within, since)
       and (public.award_trophy(who, pair.trophy, jsonb_build_object('halves', jsonb_build_array(pair.first_half, pair.second_half)))
            ->> 'won')::boolean then
      given := given || pair.trophy;
    end if;
  end loop;

  -- All-rounder: trophies from 5 different games (hub-wide rewards are not a game).
  select count(distinct t.game)::integer into games
  from public.trophies w join public.trophy_types t on t.id = w.trophy
  where w.player = who and t.game <> 'hub';
  if games >= 5 and (public.award_trophy(who, 'hub-allrounder', jsonb_build_object('games', games)) ->> 'won')::boolean then
    given := given || 'hub-allrounder'::text;
  end if;

  -- Best Friends Cup: friend pictures (golden prizes) from 2, 4 and 6 different garden games. A garden game is one with a
  -- Garden Cup ('<game>-cup', in steps).
  select count(distinct t.game)::integer into garden
  from public.trophies w
  join public.trophy_types t on t.id = w.trophy
  join public.trophy_types cup on cup.id = t.game || '-cup' and cup.repeat = 'steps'
  where w.player = who and t.kind = 'picture';
  for step in 1 .. least(3, garden / 2) loop
    if (public.award_trophy(who, 'hub-best-friends', jsonb_build_object('step', step, 'games', garden)) ->> 'won')::boolean then
      given := given || 'hub-best-friends'::text;
    end if;
  end loop;

  return given;
end;
$$;

-- On every new trophy row. Hub-wide rewards are never half of anything, so they don't start another check.
create function public.trophies_followups_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.trophy_types t where t.id = new.trophy and t.game <> 'hub') then
    begin
      perform public.trophy_followups(new.player);
    exception when others then
      raise warning 'trophy follow-up check failed (%)', sqlstate;
    end;
  end if;
  return null;
end;
$$;

create trigger trophies_followups
after insert on public.trophies
for each row execute function public.trophies_followups_trigger();

-- ---------------------------------------------------------------------------
-- 5. Season Regular
-- ---------------------------------------------------------------------------

-- Gives Season Regular when `who` has finished a go on 15 different school days (Monday to Friday) this hub season.
-- Returns how many such days they have.
create function public.season_regular_check(who uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  since date;
  days integer;
begin
  select public.hub_season_start_day(p.school_id) into since from public.profiles p where p.id = who;
  if since is null then
    return 0;
  end if;
  select count(distinct s.nz_day)::integer into days
  from public.scored_games s
  where s.player = who and s.nz_day >= since and extract(isodow from s.nz_day) between 1 and 5;
  if days >= 15 then
    perform public.award_trophy(who, 'hub-regular', jsonb_build_object('days', days));
  end if;
  return days;
end;
$$;

-- On a finished go: only the first one of a school day can add a day, so the rest of that day's goes skip the count.
create function public.scored_games_regular_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if extract(isodow from new.nz_day) between 1 and 5
     and not exists (select 1 from public.scored_games s where s.player = new.player and s.nz_day = new.nz_day and s.id <> new.id) then
    begin
      perform public.season_regular_check(new.player);
    exception when others then
      raise warning 'Season Regular check failed (%)', sqlstate;
    end;
  end if;
  return null;
end;
$$;

create trigger scored_games_regular
after insert on public.scored_games
for each row execute function public.scored_games_regular_trigger();

-- ---------------------------------------------------------------------------
-- 6. The cabinet's half-lit pairs
-- ---------------------------------------------------------------------------

-- Each two-game reward: whether I hold it now (within its season or year) and each half's game, name and whether I hold
-- it within the same time. The cabinet shows a pair with one half lit, so a pupil can see which other game to try.
create function public.my_trophy_pairs()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  since date;
begin
  perform public.require_school_user();
  since := public.hub_season_start_day(public.my_school());
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'name', t.name, 'how', t.how, 'kind', t.kind, 'within', p.within,
      'won', public.trophy_held_within(me, t.id, p.within, since),
      'halves', jsonb_build_array(
        jsonb_build_object('trophy', a.id, 'game', a.game, 'name', a.name,
                           'held', public.trophy_held_within(me, a.id, p.within, since)),
        jsonb_build_object('trophy', b.id, 'game', b.game, 'name', b.name,
                           'held', public.trophy_held_within(me, b.id, p.within, since))))
      order by t.sort)
    from public.trophy_pairs p
    join public.trophy_types t on t.id = p.trophy
    join public.trophy_types a on a.id = p.first_half
    join public.trophy_types b on b.id = p.second_half), '[]');
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. The hall of fame
-- ---------------------------------------------------------------------------

-- A made-up name (two list words and a number), or null for a typed own name: the hall shows made-up names only.
create function public.hall_name(n text)
returns text
language sql
immutable
set search_path = ''
as $$ select case when n ~ '^[A-Z][a-z]+ [A-Z][a-z]+ [1-9][0-9]?$' then n end $$;

-- { season, dragon: [{ season, slayers: [{ place, name, avatar }] }] newest season first,
--   pictures: [{ trophy, title, game, tier, name, avatar, at }] newest first }
-- My school's pupils only (no teachers, no hidden test pupils). Game feats only: the garden games' friend pictures come from
-- maths progress, so they stay off the hall.
create function public.hall_of_fame()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  school integer;
  since date;
begin
  perform public.require_school_user();
  school := public.my_school();
  since := public.hub_season_start_day(school);
  return jsonb_build_object(
    'season', public.hub_season(school),
    'dragon', coalesce((
      select jsonb_agg(jsonb_build_object('season', d.season, 'slayers', d.slayers) order by d.season desc)
      from (
        select w.season, jsonb_agg(jsonb_build_object(
                 'place', (w.detail ->> 'place')::integer, 'name', public.hall_name(p.display_name), 'avatar', p.avatar)
               order by (w.detail ->> 'place')::integer, w.earned_at) slayers
        from public.trophies w
        join public.profiles p on p.id = w.player
        where w.trophy = 'dm-first-five' and p.school_id = school and p.role = 'student' and not p.hidden
        group by w.season) d), '[]'),
    'pictures', coalesce((
      select jsonb_agg(x.row order by x.at desc)
      from (
        select w.earned_at at, jsonb_build_object(
                 'trophy', t.id, 'title', t.name, 'game', t.game,
                 'tier', public.trophy_tier((select count(*)::integer from public.trophies c
                                             where c.player = w.player and c.trophy = w.trophy)),
                 'name', public.hall_name(p.display_name), 'avatar', p.avatar, 'at', w.earned_at) row
        from public.trophies w
        join public.trophy_types t on t.id = w.trophy
        join public.profiles p on p.id = w.player
        where since is not null and public.nz_day(w.earned_at) >= since
          and t.kind = 'picture' and t.id <> 'dm-first-five'
          and not exists (select 1 from public.trophy_types cup where cup.id = t.game || '-cup' and cup.repeat = 'steps')
          and p.school_id = school and p.role = 'student' and not p.hidden
        order by w.earned_at desc
        limit 40) x), '[]'));
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. The once-only "new season" note
-- ---------------------------------------------------------------------------

-- The last hub season each pupil saw the note for.
create table public.season_notes (
  player uuid primary key references public.profiles (id) on delete cascade,
  season integer not null check (season >= 0)
);
alter table public.season_notes enable row level security;
-- The server only: no policy, no grant.

-- { season } when a new hub season (2 or later) has started and I haven't seen its note, and I won a trophy before it
-- began (so "your trophies can go silver" means something). Null otherwise, and always for teachers.
create function public.my_season_note()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me record;
  n integer;
  since date;
begin
  select p.id, p.school_id, p.role into me from public.profiles p where p.id = auth.uid();
  if me.id is null or me.role <> 'student' or me.school_id is null then
    return null;
  end if;
  n := public.hub_season(me.school_id);
  since := public.hub_season_start_day(me.school_id);
  if n < 2 or exists (select 1 from public.season_notes s where s.player = me.id and s.season >= n)
     or not exists (select 1 from public.trophies w where w.player = me.id and public.nz_day(w.earned_at) < since) then
    return null;
  end if;
  return jsonb_build_object('season', n);
end;
$$;

-- The note was shown: never again this season.
create function public.mark_season_note_seen()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  perform public.require_school_user();
  n := public.hub_season(public.my_school());
  insert into public.season_notes (player, season) values (auth.uid(), n)
  on conflict (player) do update set season = greatest(public.season_notes.season, excluded.season);
end;
$$;

-- my_home_page carries it as 'seasonNote', so the home page is still one request. Edited in place (see 20261112002600).
do $migration$
declare
  def text := pg_get_functiondef('public.my_home_page()'::regprocedure);
  -- No line ending in the needle: the live copy of my_home_page has Windows (\r\n) line endings.
  needle text := '''trophyShelf'', public.my_trophy_shelf(),';
begin
  if (length(def) - length(replace(def, needle, ''))) / length(needle) <> 1 then
    raise exception 'my_home_page edit did not match exactly once; nothing was changed';
  end if;
  def := replace(def, needle, '''seasonNote'', public.my_season_note(), ' || needle);
  execute def;
end;
$migration$;

-- ---------------------------------------------------------------------------
-- Lock the new functions
-- ---------------------------------------------------------------------------

revoke execute on function
  public.hub_season_start_day(integer),
  public.trophy_held_within(uuid, text, text, date),
  public.trophy_followups(uuid),
  public.trophies_followups_trigger(),
  public.season_regular_check(uuid),
  public.scored_games_regular_trigger(),
  public.my_trophy_pairs(),
  public.hall_name(text),
  public.hall_of_fame(),
  public.my_season_note(),
  public.mark_season_note_seen(),
  public.my_home_page()
from public, anon, authenticated;
-- my_season_note is called by my_home_page, which runs as the pupil.
grant execute on function public.my_trophy_pairs(), public.hall_of_fame(), public.my_season_note(), public.mark_season_note_seen(),
  public.my_home_page() to authenticated;
grant execute on function public.trophy_followups(uuid), public.season_regular_check(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 9. Back-award
-- ---------------------------------------------------------------------------

select public.season_regular_check(x.player)
from (select distinct s.player from public.scored_games s where s.nz_day >= public.nz_day(now()) - 60) x;

select public.trophy_followups(x.player) from (select distinct w.player from public.trophies w) x;
