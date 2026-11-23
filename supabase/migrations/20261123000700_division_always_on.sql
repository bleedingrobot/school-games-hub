-- Division is always on (James, 23 Nov 2026). The "Division questions" switch sat on the Gem Keep settings page but also
-- decided division for the ladder in every game, and some classes had it off without knowing. Every class and school now has it
-- on, new rows start with it on, and a save that tries to turn it off keeps it on (the switch is gone from the page).
update public.app_settings set gem_keep_division = true where gem_keep_division is distinct from true;

alter table public.app_settings alter column gem_keep_division set default true;

create function public.keep_division_on()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.gem_keep_division := true;
  return new;
end;
$$;
revoke execute on function public.keep_division_on() from public, anon, authenticated;

create trigger keep_division_on before insert or update of gem_keep_division on public.app_settings
  for each row execute function public.keep_division_on();
