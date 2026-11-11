-- Teacher controls C2: every settings save must name its class.
--
-- Every teacher_set_* function calls require_settings_target(target_class) before it updates. With target_class null,
-- settings_to_change() returns every class the teacher teaches (a school admin: every class in the school plus the
-- school's defaults row), so one forgotten argument would change the whole school. Now null is refused here, once,
-- for all 43 save functions. The school's defaults row can only be changed by the admin function added in card C7.
--
-- Changed in place: the body is the one in 20261018002500_school_and_class_checks.sql (nothing newer defines it), with
-- the null check added first. The function has no explicit grants (it is only called from the security definer
-- teacher_set_* functions), and create or replace keeps that.

create or replace function public.require_settings_target(target_class uuid default null)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if target_class is null then
    raise exception 'Pick a class first.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.settings_to_change(target_class)) then
    raise exception 'You don''t teach a class yet. Make one on the My classes page first.' using errcode = '42501';
  end if;
end;
$$;

-- Clan Quest's New Season (Students tab, "Seasons and end of year") is the one caller that sends no class on purpose: it
-- starts a new fame season for every class the teacher teaches (every class for a school admin). It keeps that, so it now
-- does the old check itself instead of calling require_settings_target. Changed in place: the body is the one in
-- 20261018002600_clans_schools_and_classes.sql with only that line swapped; create or replace keeps its grants.
create or replace function public.teacher_clans_new_season(confirm text, target_class uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
  season integer;
begin
  perform public.require_teacher();
  if confirm is distinct from 'NEW SEASON' then
    raise exception 'Type NEW SEASON to start a new season.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.settings_to_change(target_class)) then
    raise exception 'You don''t teach a class yet. Make one on the My classes page first.' using errcode = '42501';
  end if;
  update public.clans set fame = 0
  where public.settings_id_of(player) in (select public.settings_to_change(target_class));
  get diagnostics n = row_count;
  with bumped as (
    update public.app_settings set clans_season = clans_season + 1
    where id in (select public.settings_to_change(target_class))
    returning clans_season
  )
  select max(b.clans_season) into season from bumped b;
  return jsonb_build_object('season', season, 'clans', n);
end;
$$;
