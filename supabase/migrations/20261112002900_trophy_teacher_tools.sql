-- Profile and trophies plan, card P12 (docs/plans/profile/PLAN.md): the teacher's tools for trophies.
--
--   1. admin_trophy_season() / admin_set_trophy_season(days, paused): the admin's "Trophy season" panel. Reads and changes the
--      hub clock on the school's row (hub_season_start, hub_season_days, hub_paused_since, added by P3).
--      Changing the length keeps this season's number and first day: only its last day moves. A length shorter than the days
--      already gone is refused, so a change never jumps the season on.
--      Pausing stops the clock at today (hub_season already reads hub_paused_since); going on moves hub_season_start forward
--      by the days paused, so the season picks up where it stopped.
--   2. teacher_pupil_trophies(student): every trophy a pupil in my classes holds, for the teacher's pupil page.
--   3. teacher_reset_avatar(student): back to "no avatar yet" (the pupil sees "Make your avatar" again). Trophies stay.
--   4. teacher_new_trophies(target): trophies won in the last 7 days by pupils in a class I teach, for class shout-outs.
--      Game feats only: the early-years garden games' rewards and the Best Friends Cup are maths progress, so they are
--      left out (as in hall_of_fame).
--
-- Nothing here deletes a trophy or a picture; teacher_new_season never touches them.

-- ---------------------------------------------------------------------------
-- 1. The Trophy season panel (school admins)
-- ---------------------------------------------------------------------------

-- { season, start, days, pausedSince, seasonStart, seasonEnd, daysLeft }. seasonStart and seasonEnd are this season's first
-- and last day (before season 1: null, and daysLeft counts to the first day). While paused, daysLeft stands still.
create function public.admin_trophy_season()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.schools;
  n integer;
  today date := public.nz_day(now());
  clock date;
  first_day date;
begin
  perform public.require_school_admin();
  select * into s from public.schools where id = public.my_school();
  n := public.hub_season(s.id);
  clock := least(today, coalesce(s.hub_paused_since, today));
  first_day := case when n >= 1 then s.hub_season_start + (n - 1) * s.hub_season_days end;
  return jsonb_build_object(
    'season', n,
    'start', s.hub_season_start,
    'days', s.hub_season_days,
    'pausedSince', s.hub_paused_since,
    'seasonStart', first_day,
    'seasonEnd', case when n >= 1 then first_day + s.hub_season_days - 1 end,
    'daysLeft', case when n >= 1 then first_day + s.hub_season_days - clock else s.hub_season_start - clock end);
end;
$$;

-- Changes the length (7 to 366 days) and/or pauses or goes on. Returns the panel's new state.
create function public.admin_set_trophy_season(days integer default null, paused boolean default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.schools;
  n integer;
  today date := public.nz_day(now());
  clock date;
  first_day date;
begin
  perform public.require_school_admin();
  select * into s from public.schools where id = public.my_school() for update;

  -- Going on after a pause first, so a new length below is measured on the moved clock.
  if paused is false and s.hub_paused_since is not null then
    s.hub_season_start := s.hub_season_start + greatest(today - s.hub_paused_since, 0);
    s.hub_paused_since := null;
  elsif paused is true and s.hub_paused_since is null then
    s.hub_paused_since := today;
  end if;

  if days is not null and days <> s.hub_season_days then
    if days < 7 or days > 366 then
      raise exception 'A season must be 7 to 366 days long.' using errcode = '22023';
    end if;
    clock := least(today, coalesce(s.hub_paused_since, today));
    n := case when clock < s.hub_season_start then 0
              else (clock - s.hub_season_start) / s.hub_season_days + 1 end;
    if n >= 1 then
      first_day := s.hub_season_start + (n - 1) * s.hub_season_days;
      if days <= clock - first_day then
        raise exception 'This season has already run % days. Pick at least % days.', clock - first_day, clock - first_day + 1
          using errcode = '22023';
      end if;
      -- Same number, same first day: only the last day moves.
      s.hub_season_start := first_day - (n - 1) * days;
    end if;
    s.hub_season_days := days;
  end if;

  update public.schools
  set hub_season_start = s.hub_season_start, hub_season_days = s.hub_season_days, hub_paused_since = s.hub_paused_since
  where id = s.id;
  return public.admin_trophy_season();
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. A pupil's trophies, for their teacher
-- ---------------------------------------------------------------------------

-- [{ id, game, name, how, kind, tier, count, lastAt }], newest first.
create function public.teacher_pupil_trophies(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', t.id, 'game', t.game, 'name', t.name, 'how', t.how, 'kind', t.kind,
      'tier', public.trophy_tier(c.level), 'count', c.wins, 'lastAt', c.last_at) order by c.last_at desc, t.sort)
    from public.trophy_counts(student) c join public.trophy_types t on t.id = c.trophy), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Reset a pupil's avatar
-- ---------------------------------------------------------------------------

create function public.teacher_reset_avatar(student uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  update public.profiles set avatar = '{}'::jsonb where id = student and role = 'student';
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. New trophies this week, for class shout-outs
-- ---------------------------------------------------------------------------

-- [{ player, name, avatar, id, game, trophy, kind, tier, at }], newest first, at most 60. Pupils in the class only.
create function public.teacher_new_trophies(target uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if not public.teaches_class(target) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(x.row order by x.at desc)
    from (
      select w.earned_at as at,
             jsonb_build_object('player', p.id, 'name', p.display_name, 'avatar', p.avatar, 'id', t.id, 'game', t.game,
               'trophy', t.name, 'kind', t.kind, 'tier', public.trophy_tier(c.level), 'at', w.earned_at) as row
      from public.class_members m
      join public.profiles p on p.id = m.student_id and p.role = 'student'
      join public.trophies w on w.player = p.id
      join public.trophy_types t on t.id = w.trophy
      join lateral (select k.level from public.trophy_counts(p.id) k where k.trophy = t.id) c on true
      where m.class_id = teacher_new_trophies.target
        and w.earned_at > now() - interval '7 days'
        and t.id <> 'hub-best-friends'
        and not exists (select 1 from public.trophy_types cup where cup.id = t.game || '-cup' and cup.repeat = 'steps')
      order by w.earned_at desc
      limit 60) x), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.admin_trophy_season(), public.admin_set_trophy_season(integer, boolean), public.teacher_pupil_trophies(uuid),
  public.teacher_reset_avatar(uuid), public.teacher_new_trophies(uuid)
from public, anon, authenticated;

grant execute on function
  public.admin_trophy_season(), public.admin_set_trophy_season(integer, boolean), public.teacher_pupil_trophies(uuid),
  public.teacher_reset_avatar(uuid), public.teacher_new_trophies(uuid)
to authenticated;
