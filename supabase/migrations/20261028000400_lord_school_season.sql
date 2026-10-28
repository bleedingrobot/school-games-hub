-- Dragon Maths: one season date for the whole school (docs/DRAGON-SCHOOL-SEASON.md, decided by James 28 Oct 2026).
--
-- Before this, each class had its own "first day of season 1" (app_settings.lord_season_start on the class's row), and
-- switching a class off paused that class's season clock (lord_paused_since). Now:
--
-- * The school's date and its holiday pause live on the school's default settings row (class_id is null). Everything else
--   (on/off, forest fights, topics) stays on each class's row. The class rows' own dates stay in the table, unread, so
--   going back is one migration that points lord_settings at the class row again.
-- * Switching one class off only closes Dragon Maths for that class. The school's seasons carry on.
-- * A school admin can pause the seasons for the holidays (admin_set_lord_holiday). While paused, Dragon Maths is closed for
--   every class and the clock waits: the date handed out is moved forward a day for every day of the pause, so the season
--   number and day stand still, and switching the pause off saves that moved date.
-- * Only a school admin sets the date (admin_set_lord_season), and never so the current season number goes down: the game
--   starts a hero again only when the number goes up, and the Hall of Heroes is one row per season number.
-- * The data step at the end gives each school the earliest date any of its rows has, so no class's number goes down.
--
-- The `lord` server function needs no change: it reads the date and the switch through lord_settings(player).
--
-- Before this goes live: run the read-only query in docs/DRAGON-SCHOOL-SEASON.md section 2.3 on the live database (with
-- James's OK) to see which classes jump forward a season, apply it at a quiet time, and tell teachers the day before.

-- ---------------------------------------------------------------------------
-- The school's season
-- ---------------------------------------------------------------------------

-- The school's start date and pause, from its default row. While paused, the start is moved forward by the days paused so
-- far (counting only days the season was already running), which is the date resuming would save.
create function public.lord_school_season_row(school integer)
returns table (season_start date, paused_since date)
language sql
stable
security definer
set search_path = ''
as $$
  select case when d.lord_season_start is not null and d.lord_paused_since is not null
              then d.lord_season_start + greatest(0, public.nz_day(now()) - greatest(d.lord_paused_since, d.lord_season_start))
              else d.lord_season_start end,
         d.lord_paused_since
  from public.app_settings d
  where d.school_id = school and d.class_id is null
  limit 1
$$;

-- The season number a start date gives today (35-day seasons; shared/lord/data.ts SEASON_DAYS). 0 before it starts or
-- with no date, so "goes down" can be checked with a plain comparison.
create function public.lord_season_number(season_start date)
returns integer
language sql
stable
set search_path = ''
as $$
  select case when season_start is null or public.nz_day(now()) < season_start then 0
    else ((public.nz_day(now()) - season_start) / 35) + 1 end
$$;

-- The game's settings for a player: the date and the pause from the school, the rest from their class (or their school's
-- default row, for a pupil with no class). While the school is paused the game is closed for everyone.
create or replace function public.lord_settings(player uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('enabled', s.lord_enabled and d.paused_since is null, 'forestPerDay', s.lord_forest_per_day,
    'seasonStart', to_char(d.season_start, 'YYYY-MM-DD'), 'pausedSince', to_char(d.paused_since, 'YYYY-MM-DD'),
    'topics', to_jsonb(s.lord_topics))
  from public.settings_of(coalesce(player, auth.uid())) s
  left join lateral public.lord_school_season_row(s.school_id) d on true
$$;

-- The season number today, from the school's date (the Warriors list and the old class report use it). Null before the
-- first season starts.
create or replace function public.lord_current_season(player uuid default null)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(public.lord_season_number(d.season_start), 0)
  from public.settings_of(coalesce(player, auth.uid())) s
  left join lateral public.lord_school_season_row(s.school_id) d on true
$$;

-- Where the school's season is, for any teacher: { start, pausedSince, number, dayOfSeason, daysLeft, startsIn, canChange }.
-- `number`, `dayOfSeason` and `daysLeft` are null before season 1 starts; `startsIn` is the days until it does.
create function public.lord_school_season()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  start date;
  paused date;
  today date := public.nz_day(now());
  n integer;
begin
  perform public.require_teacher();
  select d.season_start, d.paused_since into start, paused from public.lord_school_season_row(public.my_school()) d;
  n := public.lord_season_number(start);
  return jsonb_build_object(
    'start', to_char(start, 'YYYY-MM-DD'),
    'pausedSince', to_char(paused, 'YYYY-MM-DD'),
    'number', nullif(n, 0),
    'dayOfSeason', case when n = 0 then null else ((today - start) % 35) + 1 end,
    'daysLeft', case when n = 0 then null else 35 - (((today - start) % 35) + 1) end,
    'startsIn', case when start is not null and n = 0 then start - today end,
    'canChange', public.is_school_admin());
end;
$$;

-- A school admin sets the first day of season 1 for the whole school. Any date before season 1 has started; after that, not
-- one that takes the current season number down. While the holidays pause is on, the new date counts from today (the pause
-- carries on from today, so the days before it don't move the new date).
create function public.admin_set_lord_season(start date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := public.nz_day(now());
  cur date;
  cur_n integer;
  new_n integer;
  latest date;
begin
  if not public.is_school_admin() then
    raise exception 'Only a school admin can change the season date.' using errcode = '42501';
  end if;
  if start is null then
    raise exception 'Pick a date for the first day of season 1.' using errcode = '22023';
  end if;
  perform 1 from public.app_settings d where d.school_id = public.my_school() and d.class_id is null for update;
  select d.season_start into cur from public.lord_school_season_row(public.my_school()) d;
  cur_n := public.lord_season_number(cur);
  new_n := public.lord_season_number(start);
  if new_n < cur_n then
    latest := today - (cur_n - 1) * 35;
    raise exception '% Pick a day on or before %.',
      case when new_n = 0 then 'That would put the school back before season 1.'
           else format('That would take the school back to season %s.', new_n) end,
      to_char(latest, case when extract(year from latest) = extract(year from today) then 'FMDD Mon' else 'FMDD Mon YYYY' end)
      using errcode = '22023';
  end if;
  update public.app_settings d
  set lord_season_start = start, lord_paused_since = case when d.lord_paused_since is null then null else today end
  where d.school_id = public.my_school() and d.class_id is null;
  return public.lord_school_season();
end;
$$;

-- A school admin pauses the seasons for the holidays (closed for every class, the clock waits) or ends the pause (the
-- start moves forward by the days paused, so the season carries on where it left off).
create function public.admin_set_lord_holiday(paused boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := public.nz_day(now());
begin
  if not public.is_school_admin() then
    raise exception 'Only a school admin can pause the seasons.' using errcode = '42501';
  end if;
  if paused is null then
    raise exception 'The holiday pause must be on or off.' using errcode = '22023';
  end if;
  if paused then
    update public.app_settings d set lord_paused_since = coalesce(d.lord_paused_since, today)
    where d.school_id = public.my_school() and d.class_id is null;
  else
    update public.app_settings d
    set lord_season_start = case when d.lord_season_start is null then null
          else d.lord_season_start + greatest(0, today - greatest(d.lord_paused_since, d.lord_season_start)) end,
        lord_paused_since = null
    where d.school_id = public.my_school() and d.class_id is null and d.lord_paused_since is not null;
  end if;
  return public.lord_school_season();
end;
$$;

-- ---------------------------------------------------------------------------
-- The teacher's switch and settings
-- ---------------------------------------------------------------------------

-- `settings` = { enabled: boolean, forestPerDay?: 1-30, seasonStart?: 'YYYY-MM-DD', topics?: ['add-sub', ...] }.
-- The switch only switches now: no per-class pause or date shift. Switching on while the school has no date starts season 1
-- today for the whole school. `seasonStart` is for school admins only (it does what admin_set_lord_season does); the old
-- teacher page still sends it from its date box.
create or replace function public.teacher_set_lord(settings jsonb, target_class uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_on boolean;
  topics text[];
  today date := public.nz_day(now());
begin
  perform public.require_teacher();
  if jsonb_typeof(settings) is distinct from 'object' or jsonb_typeof(settings -> 'enabled') is distinct from 'boolean' then
    raise exception 'Those settings couldn''t be read.' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  now_on := (settings ->> 'enabled')::boolean;
  if settings ? 'forestPerDay' then
    if jsonb_typeof(settings -> 'forestPerDay') is distinct from 'number'
       or (settings ->> 'forestPerDay')::numeric <> trunc((settings ->> 'forestPerDay')::numeric)
       or (settings ->> 'forestPerDay')::numeric not between 1 and 30 then
      raise exception 'Forest fights a day must be a whole number from 1 to 30.' using errcode = '22023';
    end if;
  end if;
  if settings ? 'seasonStart' then
    if jsonb_typeof(settings -> 'seasonStart') <> 'null'
       and not (jsonb_typeof(settings -> 'seasonStart') = 'string' and (settings ->> 'seasonStart') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') then
      raise exception 'That start date couldn''t be read.' using errcode = '22023';
    end if;
    if not public.is_school_admin() then
      raise exception 'Only a school admin can change the season date.' using errcode = '42501';
    end if;
  end if;
  if settings ? 'topics' then
    if jsonb_typeof(settings -> 'topics') is distinct from 'array'
       or exists (select 1 from jsonb_array_elements(settings -> 'topics') e where jsonb_typeof(e) <> 'string') then
      raise exception 'Those topics couldn''t be read.' using errcode = '22023';
    end if;
    select coalesce(array_agg(distinct t order by t), '{}') into topics from jsonb_array_elements_text(settings -> 'topics') as t;
    if not topics <@ '{place-value,add-sub,times-tables,division,fractions,decimals,money,patterns}' then
      raise exception 'Those topics couldn''t be read.' using errcode = '22023';
    end if;
    if cardinality(topics) = 0 then
      raise exception 'Leave at least one topic on.' using errcode = '22023';
    end if;
  end if;
  update public.app_settings s set
    lord_enabled = now_on,
    lord_forest_per_day = case when settings ? 'forestPerDay' then (settings ->> 'forestPerDay')::integer else s.lord_forest_per_day end,
    lord_topics = case when settings ? 'topics' then topics else s.lord_topics end
  where s.id in (select public.settings_to_change(target_class));
  if settings ? 'seasonStart' then
    perform public.admin_set_lord_season((settings ->> 'seasonStart')::date);
  elsif now_on then
    update public.app_settings d set lord_season_start = today
    where d.school_id = public.my_school() and d.class_id is null and d.lord_season_start is null;
  end if;
  return public.lord_settings();
end;
$$;

-- ---------------------------------------------------------------------------
-- The class reports: the school's season
-- ---------------------------------------------------------------------------

-- As in 20261028000300, with the season from the school's row.
create or replace function public.teacher_lord_class(target_class uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  season_start date;
  season_now integer;
  today date := public.nz_day(now());
begin
  perform public.require_teacher();
  if target_class is null then
    raise exception 'Choose a class first.' using errcode = '22023';
  end if;
  if not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  select d.season_start into season_start from public.lord_school_season_row(public.my_school()) d;
  season_now := nullif(public.lord_season_number(season_start), 0);
  return (
    with students as (
      select s.id from public.my_students() s(id)
      where exists (select 1 from public.class_members m where m.student_id = s.id and m.class_id = target_class)
    ),
    heroes as (select h.player, h.season, h.hero from public.lord_heroes h join students s on s.id = h.player)
    select jsonb_build_object(
      'season', jsonb_build_object(
          'number', season_now,
          'start', to_char(season_start, 'YYYY-MM-DD'),
          'daysLeft', case when season_now is null then null else 35 - (((today - season_start) % 35) + 1) end),
      'players', (select count(*) from heroes),
      'thisSeason', (select count(*) from heroes x where x.season = season_now),
      'levels', (select coalesce(jsonb_agg(y.c order by y.i), '[]') from (
          select n.i, (select count(*) from heroes x where x.season = season_now and (x.hero ->> 'level')::integer = n.i) as c
          from generate_series(1, 12) as n(i)) y),
      'hardest', (select coalesce(jsonb_agg(jsonb_build_object(
          'pack', z.pack, 'key', z.fact_key, 'students', z.students, 'attempts', z.attempts, 'correct', z.correct)
          order by z.wrong_share desc, z.attempts desc), '[]')
        from (select f.pack, f.fact_key, count(*) as students, sum(f.attempts) as attempts, sum(f.correct) as correct,
                     1 - sum(f.correct)::numeric / sum(f.attempts) as wrong_share
              from public.gem_keep_facts f join heroes x on x.player = f.player
              where f.attempts > 0
              group by f.pack, f.fact_key
              having sum(f.attempts) >= 6 and count(*) >= 2 and sum(f.correct) < sum(f.attempts)
              order by wrong_share desc, attempts desc
              limit 12) z),
      'refusals', (select coalesce(jsonb_agg(jsonb_build_object(
          'name', w.display_name, 'realName', w.real_name, 'reason', w.reason, 'action', w.action, 'at', w.at) order by w.at desc), '[]')
        from (select p.display_name, split_part(u.email, '@', 1) as real_name, r.reason, r.action, r.at
              from public.lord_refusals r
              join students s on s.id = r.player
              join public.profiles p on p.id = r.player
              left join auth.users u on u.id = p.id
              where r.at > now() - interval '14 days'
              order by r.at desc limit 20) w),
      'hall', (select coalesce(jsonb_agg(jsonb_build_object(
          'season', v.season, 'name', v.display_name, 'realName', v.real_name, 'kills', v.kills) order by v.season desc, v.kills desc, v.first_at), '[]')
        from (select hl.season, p.display_name, split_part(u.email, '@', 1) as real_name, hl.kills, hl.first_at
              from public.lord_hall hl
              join students s on s.id = hl.player
              join public.profiles p on p.id = hl.player
              left join auth.users u on u.id = p.id
              order by hl.season desc, hl.kills desc, hl.first_at limit 60) v)
    )
  );
end;
$$;

-- The old whole-school report (20261018002500), with the season from the school's row. Dropped with the other old class
-- reports once the website no longer calls it.
create or replace function public.teacher_lord_class()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  season_start date;
  season_now integer;
  today date := public.nz_day(now());
begin
  perform public.require_teacher();
  select d.season_start into season_start from public.lord_school_season_row(public.my_school()) d;
  season_now := nullif(public.lord_season_number(season_start), 0);
  return (
    with students as (select m as id from public.my_students() as m),
    heroes as (select h.player, h.season, h.hero from public.lord_heroes h join students s on s.id = h.player)
    select jsonb_build_object(
      'season', jsonb_build_object(
          'number', season_now,
          'start', to_char(season_start, 'YYYY-MM-DD'),
          'daysLeft', case when season_now is null then null else 35 - (((today - season_start) % 35) + 1) end),
      'players', (select count(*) from heroes),
      'thisSeason', (select count(*) from heroes x where x.season = season_now),
      'levels', (select coalesce(jsonb_agg(y.c order by y.i), '[]') from (
          select n.i, (select count(*) from heroes x where x.season = season_now and (x.hero ->> 'level')::integer = n.i) as c
          from generate_series(1, 12) as n(i)) y),
      'hardest', (select coalesce(jsonb_agg(jsonb_build_object(
          'pack', z.pack, 'key', z.fact_key, 'students', z.students, 'attempts', z.attempts, 'correct', z.correct)
          order by z.wrong_share desc, z.attempts desc), '[]')
        from (select f.pack, f.fact_key, count(*) as students, sum(f.attempts) as attempts, sum(f.correct) as correct,
                     1 - sum(f.correct)::numeric / sum(f.attempts) as wrong_share
              from public.gem_keep_facts f join heroes x on x.player = f.player
              where f.attempts > 0
              group by f.pack, f.fact_key
              having sum(f.attempts) >= 6 and count(*) >= 2 and sum(f.correct) < sum(f.attempts)
              order by wrong_share desc, attempts desc
              limit 12) z),
      'refusals', (select coalesce(jsonb_agg(jsonb_build_object(
          'name', w.display_name, 'realName', w.real_name, 'reason', w.reason, 'action', w.action, 'at', w.at) order by w.at desc), '[]')
        from (select p.display_name, split_part(u.email, '@', 1) as real_name, r.reason, r.action, r.at
              from public.lord_refusals r
              join public.profiles p on p.id = r.player
              left join auth.users u on u.id = p.id
              where r.at > now() - interval '14 days' and r.player in (select public.my_students())
              order by r.at desc limit 20) w),
      'hall', (select coalesce(jsonb_agg(jsonb_build_object(
          'season', v.season, 'name', v.display_name, 'realName', v.real_name, 'kills', v.kills) order by v.season desc, v.kills desc, v.first_at), '[]')
        from (select hl.season, p.display_name, split_part(u.email, '@', 1) as real_name, hl.kills, hl.first_at
              from public.lord_hall hl
              join public.profiles p on p.id = hl.player
              left join auth.users u on u.id = p.id
              where hl.player in (select public.my_students())
              order by hl.season desc, hl.kills desc, hl.first_at limit 60) v)
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- The one-off data step: each school starts from the earliest date any of its rows has
-- ---------------------------------------------------------------------------

-- Every class's season number is at most the earliest date's, so no class's number goes down: classes on the earliest date
-- see no change, every other class moves forward to a newer season (its heroes start again on their next visit). Any pause
-- on the school's row is cleared; a class that is off stays off. The class rows are left as they are (unread from now on).
-- Kept as a function (locked: nobody signed in can call it) so the database test can run it on rows it sets up.
create function public.lord_school_season_step()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.app_settings d
  set lord_season_start = e.first_day, lord_paused_since = null
  from (select s.school_id, min(s.lord_season_start) as first_day from public.app_settings s group by s.school_id) e
  where d.class_id is null and d.school_id = e.school_id
$$;

select public.lord_school_season_step();

-- ---------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------

revoke execute on function public.lord_school_season_row(integer), public.lord_season_number(date),
  public.lord_school_season_step() from public, anon, authenticated;
revoke execute on function public.lord_school_season(), public.admin_set_lord_season(date), public.admin_set_lord_holiday(boolean)
  from public, anon, authenticated;
grant execute on function public.lord_school_season(), public.admin_set_lord_season(date), public.admin_set_lord_holiday(boolean)
  to authenticated;
