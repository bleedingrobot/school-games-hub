-- The ladder is always on (James, 23 Nov 2026). "Games pick the maths (auto)" was off by default, and a class with it off and no
-- focus got the old times-table levels in Gem Keep, Space and the other games. Every class and school now has it on, new rows start
-- with it on, and a save that tries to turn it off keeps it on (the switch is gone from the focus page). Same shape as division
-- (20261123000700_division_always_on.sql).
update public.app_settings set maths_auto = true where maths_auto is distinct from true;

alter table public.app_settings alter column maths_auto set default true;

create function public.keep_maths_auto_on()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.maths_auto := true;
  return new;
end;
$$;
revoke execute on function public.keep_maths_auto_on() from public, anon, authenticated;

create trigger keep_maths_auto_on before insert or update of maths_auto on public.app_settings
  for each row execute function public.keep_maths_auto_on();

-- An old page may still call the switch: it checks who is asking as before and changes nothing.
create or replace function public.teacher_set_maths_auto(enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  perform public.require_settings_target(target_class);
end;
$$;
