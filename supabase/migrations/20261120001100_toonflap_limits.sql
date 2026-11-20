-- Toon Flap daily limits (James, 20 Nov 2026): 10 level wins a day and 2 Sky Dash goes a day, and the teacher's
-- "Unlimited today" switch lifts both (shared/toonflap/config.ts WINS_A_DAY, DASHES_A_DAY; shared/unlimited.ts).
--
-- 1. toonflap_runs_today also says `wins` (levels finished today, not dashes) and `dashes` (Sky Dashes started today).
--    Its own function, so it is replaced whole; create or replace keeps its grants.
-- 2. teacher_set_unlimited_today accepts 'toonflap' (newest body: 20261119000900_goblinstorm.sql).

create or replace function public.toonflap_runs_today(player uuid, day date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'started', (select count(*) from public.toonflap_runs r where r.player = toonflap_runs_today.player and r.started_day = day),
    'finished', (select count(*) from public.toonflap_runs r where r.player = toonflap_runs_today.player and r.finished_day = day),
    'wins', (select count(*) from public.toonflap_runs r
             where r.player = toonflap_runs_today.player and r.finished_day = day and r.level <> 'dash'),
    'dashes', (select count(*) from public.toonflap_runs r
               where r.player = toonflap_runs_today.player and r.started_day = day and r.level = 'dash'))
$$;

create or replace function public.teacher_set_unlimited_today(game text, enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null or game is null
     or game not in ('dragon-maths', 'clan-quest', 'monsters', 'diamond', 'trader', 'isles', 'goblinstorm', 'toonflap') then
    raise exception 'Unknown Unlimited turns setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings
  set unlimited_days = case when enabled
    then unlimited_days || jsonb_build_object(game, to_char((now() at time zone 'Pacific/Auckland')::date, 'YYYY-MM-DD'))
    else unlimited_days - game end
  where id in (select public.settings_to_change(target_class));
end;
$$;
