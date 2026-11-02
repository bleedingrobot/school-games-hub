-- Non-maths games, per class (James, 3 Nov 2026): a teacher can turn off the games with no maths in them (the dashboard's
-- "Non-maths games": chess, checkers, 101, Power Clash) for one class. ON to start, so nothing changes until a teacher
-- turns it off. The website hides the cards and closes those games' pages; the database only keeps the switch.
--
-- 1. app_settings.non_maths_games (a new class copies its school's row, so this reaches new classes too).
-- 2. teacher_set_non_maths_games().
--
-- Nothing else is changed.

alter table public.app_settings add column non_maths_games boolean not null default true;

create function public.teacher_set_non_maths_games(enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null then
    raise exception 'Unknown Non-maths games setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings set non_maths_games = enabled where id in (select public.settings_to_change(target_class));
end;
$$;

revoke execute on function public.teacher_set_non_maths_games(boolean, uuid) from public, anon, authenticated;
grant execute on function public.teacher_set_non_maths_games(boolean, uuid) to authenticated;
