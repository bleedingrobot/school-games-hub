-- Unlimited turns today (James, 4 Nov 2026): a class switch on the teacher's Today page that lifts the daily turn limit
-- in the games that have one, for the rest of that New Zealand day only. It turns itself off at midnight.
--
-- Games: Dragon Maths (forest and arena fights), Clan Quest (mine fights), Maths Monsters (battles), Diamond Drop (new
-- levels), Star Trader (jumps), Sky Isles (turns). Master tries, builds, races and gifts keep their limits.
--
-- How it works in every game: the normal turns are used first, as on any day. When they run out the game no longer says
-- "come back tomorrow", and the extra turns give everything in the game as usual (gold, XP, loot), but no hub points,
-- so the class leaderboard and levels stay fair between classes. Tomorrow is a normal day.
--
-- 1. app_settings.unlimited_day: the NZ date the switch is on for (null = off). A new class copies its school's row,
--    which is harmless: an old date means off.
-- 2. unlimited_today(player): is it on for this player's class today?
-- 3. teacher_set_unlimited_today(enabled, target_class).
-- 4. Exact edits so the games can read it: lord_server_settings, clans_settings and monster_battle_rules gain
--    'unlimitedToday'; my_moves_left() and my_monsters() gain 'unlimited'. (Diamond Drop, Star Trader and Sky
--    Isles read the settings row itself.)

alter table public.app_settings add column unlimited_day date;

create function public.unlimited_today(player uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.unlimited_day = (now() at time zone 'Pacific/Auckland')::date
     from public.settings_of(coalesce(unlimited_today.player, auth.uid())) s),
    false)
$$;

create function public.teacher_set_unlimited_today(enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null then
    raise exception 'Unknown Unlimited turns setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings
  set unlimited_day = case when enabled then (now() at time zone 'Pacific/Auckland')::date end
  where id in (select public.settings_to_change(target_class));
end;
$$;

revoke execute on function public.unlimited_today(uuid), public.teacher_set_unlimited_today(boolean, uuid)
  from public, anon, authenticated;
-- Pupils see it only through the games and my_moves_left(), never for another player.
grant execute on function public.unlimited_today(uuid) to service_role;
grant execute on function public.teacher_set_unlimited_today(boolean, uuid) to authenticated;

-- Exact edits. If a text is not found exactly once, nothing changes and the migration stops.
create or replace function pg_temp.edit_function(sig text, edits text[][])
returns void
language plpgsql
as $$
declare
  def text := pg_get_functiondef(sig::regprocedure);
  i integer;
begin
  for i in 1 .. array_length(edits, 1) loop
    if (length(def) - length(replace(def, edits[i][1], ''))) / length(edits[i][1]) <> 1 then
      raise exception '% edit % did not match exactly once; nothing was changed', sig, i;
    end if;
    def := replace(def, edits[i][1], edits[i][2]);
  end loop;
  execute def;
end;
$$;

-- Dragon Maths' server reads lord_server_settings (lord_settings itself is left alone: the on-hold school-season
-- migration replaces it).
select pg_temp.edit_function('public.lord_server_settings(uuid)', array[array[
  E'select public.lord_settings(player)',
  E'select public.lord_settings(player) || jsonb_build_object(''unlimitedToday'', public.unlimited_today(player))'
]]);

select pg_temp.edit_function('public.clans_settings(uuid)', array[array[
  E'    ''season'', s.clans_season,',
  E'    ''season'', s.clans_season,\n    ''unlimitedToday'', public.unlimited_today(coalesce(clans_settings.player, auth.uid())),'
]]);

select pg_temp.edit_function('public.monster_battle_rules(uuid)', array[array[
  E'    12))',
  E'    12),\n    ''unlimitedToday'', public.unlimited_today(monster_battle_rules.player))'
]]);

-- Maths Monsters' browser reads its battles a day from my_monsters().
select pg_temp.edit_function('public.my_monsters()', array[array[
  E'''perDay'', (public.monster_battle_rules() ->> ''battlesPerDay'')::integer),\n    ''playDays''',
  E'''perDay'', (public.monster_battle_rules() ->> ''battlesPerDay'')::integer,\n                                  ''unlimited'', (public.monster_battle_rules() ->> ''unlimitedToday'')::boolean),\n    ''playDays'''
]]);

select pg_temp.edit_function('public.my_moves_left()', array[array[
  E'  select jsonb_build_object(\n    ''lord'',',
  E'  select jsonb_build_object(\n    ''unlimited'', public.unlimited_today(me.id),\n    ''lord'','
]]);
