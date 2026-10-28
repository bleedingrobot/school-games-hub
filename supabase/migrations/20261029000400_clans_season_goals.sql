-- Clan Quest season goals, the database half (James, 28 Oct 2026; plan in docs/CLANS-SEASON-GOALS-PLAN.md, sections 3, 4, 6 and 7).
--
--   1. app_settings.clans_clock_from   the day Clan Quest's season clock is switched on (null = off: nothing ever resets)
--   2. clan_season_rules()             the numbers shared/clans/config.ts (CONFIG.season, CONFIG.empire) must agree with (a test checks it)
--      clan_school_season(school), clan_season(player)   the school's 35-day season, read from Dragon Maths' school date
--   3. clan_extras                     now also carries `clock`
--   4. clan_hall                       one row per clan per season: village finished (and the day), monster beaten (and the day, tries)
--   5. clan_village_complete()         when a clan's whole village is at its top level: +50 fame, 10 points, news, Master Builder, a Hall place
--   6. the Master Builder achievement
--   7. clan_hall_of_legends()          what the browser reads: this school's winners, newest season first
--   8. clan_nightly                    fame goes back to 0 when the school's season moves on (only while the clock is on)
--
-- The season date is Dragon Maths' (app_settings.lord_season_start and lord_paused_since on the SCHOOL'S DEFAULT row, class_id is null);
-- this file does not use any function from the Dragon Maths school-season migration, which is not live. Nothing is dropped.
-- clan_extras and clan_nightly are re-created from their newest versions (20261018002600 and 20261028001000), changed only where described.

-- ---------------------------------------------------------------------------
-- 1. The clock switch
-- ---------------------------------------------------------------------------

alter table public.app_settings add column clans_clock_from date;
comment on column public.app_settings.clans_clock_from is
  'Clan Quest season clock: the first day it runs (read on the school''s default row). Null = off, so fame never resets by itself. Set by hand at go-live.';

-- ---------------------------------------------------------------------------
-- 2. The rules and the season
-- ---------------------------------------------------------------------------

-- Must equal CONFIG.season and CONFIG.empire.buildings[b].max in shared/clans/config.ts (shared/clans/seasonRules.test.ts checks it).
create function public.clan_season_rules() returns jsonb language sql immutable set search_path = ''
as $$ select jsonb_build_object(
  'length', 35, 'warnFrom', 22, 'monsterFrom', 29,
  'villageReward', jsonb_build_object('fame', 50, 'points', 10),
  'maxLevels', jsonb_build_object('trainingHall', 5, 'smithy', 6, 'church', 3, 'barracks', 5, 'walls', 5, 'tower', 5, 'forge', 5, 'strongroom', 5)) $$;

-- { number, day, daysLeft, clockOn } for one school. Seasons are 35 days back to back from the school's start date; while the school
-- is paused the day is frozen at the day it was paused. Number, day and daysLeft are 0 with no date or before it.
create function public.clan_school_season(school integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d public.app_settings;
  len integer := (public.clan_season_rules() ->> 'length')::integer;
  today date := public.nz_day(now());
  eff date;
  n integer;
  dy integer;
begin
  select s.* into d from public.app_settings s where s.school_id = school and s.class_id is null limit 1;
  if not found or d.lord_season_start is null then
    return jsonb_build_object('number', 0, 'day', 0, 'daysLeft', 0, 'clockOn', false);
  end if;
  eff := case when d.lord_paused_since is not null then least(today, d.lord_paused_since) else today end;
  if eff < d.lord_season_start then
    return jsonb_build_object('number', 0, 'day', 0, 'daysLeft', 0, 'clockOn', false);
  end if;
  n := (eff - d.lord_season_start) / len + 1;
  dy := (eff - d.lord_season_start) % len + 1;
  return jsonb_build_object('number', n, 'day', dy, 'daysLeft', len - dy,
    'clockOn', d.clans_clock_from is not null and today >= d.clans_clock_from);
end;
$$;

-- The same for one pupil's school.
create function public.clan_season(player uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.clan_school_season(coalesce((select p.school_id from public.profiles p where p.id = clan_season.player), 0))
$$;

-- ---------------------------------------------------------------------------
-- 3. clan_extras
-- ---------------------------------------------------------------------------

-- Changed from 20261018002600: one more key, `clock` (clan_season).
create or replace function public.clan_extras(player uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'settings', public.clans_settings(clan_extras.player),
    'fame', coalesce((select c.fame from public.clans c where c.player = clan_extras.player), 0),
    'achievements', coalesce((
      select jsonb_agg(a.achievement order by a.achievement) from public.achievements a
      join public.achievement_types t on t.id = a.achievement
      where a.player = clan_extras.player and t.game = 'clan-quest'), '[]'),
    'clock', public.clan_season(clan_extras.player))
$$;

-- ---------------------------------------------------------------------------
-- 4. The Hall, and the last season each school's fame was reset for
-- ---------------------------------------------------------------------------

-- One row per clan per season. The clan's name and school are copied in, so the Hall still reads right after a rename or a move.
create table public.clan_hall (
  player uuid not null references public.profiles (id) on delete cascade,
  season integer not null check (season >= 0),
  school_id integer,
  clan_name text,
  village_done_on date,
  monster_done_on date,
  monster_tries integer not null default 0,
  primary key (player, season)
);
create index clan_hall_school on public.clan_hall (school_id, season desc);
alter table public.clan_hall enable row level security;
revoke all on public.clan_hall from anon, authenticated;

create table public.clan_school_seasons (
  school_id integer primary key,
  season integer not null
);
alter table public.clan_school_seasons enable row level security;
revoke all on public.clan_school_seasons from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. The village is complete
-- ---------------------------------------------------------------------------

-- Runs after every save of a clan's empire. When every building is at its top level, the clan's Hall row for this season gets the day
-- (once), and only the first time: +fame, points (through clan_scores, so the shared daily cap applies), stats.villageBuilt 2 (the
-- Master Builder achievement), a news line, and the achievements are handed out in the same save. A raid that knocks a level off, or a
-- second full save, gives nothing more. The clan's own save (clans) is written before its empire, so these updates are not overwritten.
create function public.clan_village_complete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rules jsonb := public.clan_season_rules();
  b text;
  mx text;
  c public.clans;
  sid integer;
  v_season integer;
  n integer;
begin
  if new.empire ->> 'version' is distinct from '2' then
    return null;
  end if;
  for b, mx in select k.key, k.value from jsonb_each_text(rules -> 'maxLevels') k loop
    if coalesce((new.empire -> 'levels' ->> b)::integer, 0) < mx::integer then
      return null;
    end if;
  end loop;
  select x.* into c from public.clans x where x.player = new.player;
  if not found then
    return null;
  end if;
  select p.school_id into sid from public.profiles p where p.id = new.player;
  v_season := (public.clan_season(new.player) ->> 'number')::integer;
  insert into public.clan_hall as h (player, season, school_id, clan_name, village_done_on)
  values (new.player, v_season, sid, c.name, public.nz_day(now()))
  on conflict (player, season) do update
    set village_done_on = excluded.village_done_on, school_id = excluded.school_id, clan_name = excluded.clan_name
    where h.village_done_on is null;
  get diagnostics n = row_count;
  if n = 0 then
    return null;
  end if;
  update public.clans x set
    fame = x.fame + (rules -> 'villageReward' ->> 'fame')::integer,
    stats = x.stats || jsonb_build_object('villageBuilt', greatest(coalesce((x.stats ->> 'villageBuilt')::integer, 0), 2))
  where x.player = new.player;
  insert into public.clan_scores (player, wins, bosses, wars, points_raw, counts_for_points)
  values (new.player, 0, 0, 0, (rules -> 'villageReward' ->> 'points')::integer, true);
  if sid is not null then
    insert into public.clan_news (nz_date, school_id, text)
    values (public.nz_day(now()), sid, c.name || ' finished their whole village!');
  end if;
  perform public.award_achievements(new.player, 'clan-quest', now());
  return null;
exception when others then
  -- Never lose a save because a reward went wrong.
  raise warning 'rewarding a finished village failed (%)', sqlstate;
  return null;
end;
$$;

-- Named to run after village_built_when_saved (triggers run in name order); either order gives the same result.
create trigger village_complete_when_saved
after insert or update of empire on public.clan_empires
for each row
execute function public.clan_village_complete();

-- ---------------------------------------------------------------------------
-- 6. Master Builder
-- ---------------------------------------------------------------------------

-- Measured by the same count as "Village builders" (stats.villageBuilt); the trigger above sets it to 2.
insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('cq-master-builder', 'clan-quest', 'Master Builder', '🏰', 'clan_village', 2, 9)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 7. The Hall of Legends
-- ---------------------------------------------------------------------------

-- This school's winners, newest season first (at most 200 rows). Hidden profiles are left off, as on the scoreboard.
create function public.clan_hall_of_legends()
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
  where not p.hidden and h.school_id = public.my_school()
    and (h.village_done_on is not null or h.monster_done_on is not null)
  order by h.season desc, coalesce(h.monster_done_on, h.village_done_on), h.clan_name
  limit 200;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. The midnight job
-- ---------------------------------------------------------------------------

-- Changed from 20261028001000: after the Mines news, a school whose clock is on and whose season number has gone past the last one
-- recorded for it has its clans' fame set to 0 and its clans_season bumped (as teacher_clans_new_season does). A school seen for the
-- first time is only recorded. A school with the clock off is left alone. Everything else is as it was.
create or replace function public.clan_nightly(for_day integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  today integer := coalesce(for_day, public.clan_nz_day());
  yesterday date := date '1970-01-01' + (coalesce(for_day, public.clan_nz_day()) - 1);
  rested_players uuid[];
  wins integer;
  boss_depths integer[];
  d integer;
  this_week integer := public.clan_nz_week(coalesce(for_day, public.clan_nz_day()));
  sid integer;
  season_now jsonb;
  last_season integer;
begin
  insert into public.clan_daily_runs (nz_day) values (today) on conflict do nothing;
  if not found then
    return jsonb_build_object('ran', false, 'day', today);
  end if;

  with due as (
    select c.player, greatest(1, today - c.created_nz_day + 1) as new_day
    from public.clans c
    where c.day < greatest(1, today - c.created_nz_day + 1)
      and not exists (select 1 from public.clan_fights f where f.player = c.player)
    for update of c
  ), moved as (
    update public.clans c set
      day = due.new_day, fights_left = public.clan_fights_per_day(c.player), wakes_today = 0,
      version = c.version + 1, updated_at = now()
    from due where c.player = due.player
    returning c.player, c.day
  ), healed as (
    update public.clan_members m set
      member = m.member || jsonb_build_object('knockedOut', false, 'hp', m.member -> 'maxHp', 'sp', m.member -> 'maxSp')
    from moved where m.player = moved.player
    returning m.player
  ), fresh as (
    update public.clan_empires e set
      empire = case
        when e.empire ->> 'version' = '2' then
          e.empire || jsonb_build_object('day', moved.day, 'buildsToday', 0, 'raidsToday', 0, 'kingdomRaidsToday', 0, 'raidedToday', '[]'::jsonb)
        else
          e.empire || jsonb_build_object('day', moved.day, 'energyUsed', 0, 'raidsToday', 0, 'kingdomRaidsToday', 0, 'raidedToday', '[]'::jsonb)
      end
    from moved where e.player = moved.player
    returning e.player
  )
  select coalesce(array_agg(moved.player), '{}') into rested_players from moved;

  -- Yesterday in the Mines, in words and numbers only, school by school.
  for sid in select s.id from public.schools s where s.active order by s.id loop
    select count(*) into wins from public.clan_fight_log l where l.nz_date = yesterday and l.result = 'won' and l.school_id = sid;
    if wins > 0 then
      insert into public.clan_news (nz_date, school_id, text)
      values (yesterday, sid, case when wins = 1 then 'One fight was won in the Mines yesterday.' else wins || ' fights were won in the Mines yesterday.' end);
    end if;
    select coalesce(array_agg(distinct l.depth order by l.depth), '{}') into boss_depths
    from public.clan_fight_log l where l.nz_date = yesterday and l.boss and l.result = 'won' and l.school_id = sid;
    foreach d in array boss_depths[1:3] loop
      insert into public.clan_news (nz_date, school_id, text) values (yesterday, sid, 'A boss deep in the Mines (level ' || d || ') was beaten yesterday!');
    end loop;
  end loop;

  -- A new season for a school whose Clan Quest clock is on: fame starts again.
  for sid in select s.id from public.schools s where s.active order by s.id loop
    season_now := public.clan_school_season(sid);
    continue when not (season_now ->> 'clockOn')::boolean or (season_now ->> 'number')::integer < 1;
    select q.season into last_season from public.clan_school_seasons q where q.school_id = sid;
    if last_season is not null and (season_now ->> 'number')::integer > last_season then
      update public.clans c set fame = 0 where c.player in (select p.id from public.profiles p where p.school_id = sid);
      update public.app_settings set clans_season = clans_season + 1 where school_id = sid;
    end if;
    if last_season is null or (season_now ->> 'number')::integer > last_season then
      insert into public.clan_school_seasons (school_id, season) values (sid, (season_now ->> 'number')::integer)
      on conflict (school_id) do update set season = excluded.season;
    end if;
  end loop;

  update public.clan_daily_runs set rested = coalesce(cardinality(rested_players), 0) where nz_day = today;

  -- Tidying.
  delete from public.clan_news where nz_date < yesterday - 7;
  delete from public.clan_fight_log where nz_date < yesterday - 60;
  delete from public.clan_daily_runs where nz_day < today - 60;
  delete from public.clan_requests where created_at < now() - interval '2 days';
  delete from public.clan_votes where week < this_week - 4;
  delete from public.clan_raid_notes where created_at < now() - interval '2 days';

  return jsonb_build_object('ran', true, 'day', today, 'rested', coalesce(cardinality(rested_players), 0), 'villagesClosed', 0);
end;
$$;


-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

-- New functions start open to everyone: lock them all, then give the scoreboard-style one to signed-in users.
revoke execute on function
  public.clan_season_rules(), public.clan_school_season(integer), public.clan_season(uuid), public.clan_village_complete(),
  public.clan_hall_of_legends()
from public, anon, authenticated, service_role;
grant execute on function public.clan_hall_of_legends() to authenticated;
-- The server (edge function) may read the rules and one pupil's season; the rest are used only inside the database.
grant execute on function public.clan_season_rules(), public.clan_season(uuid) to service_role;
-- clan_extras and clan_nightly were replaced in place, so their grants still stand.
