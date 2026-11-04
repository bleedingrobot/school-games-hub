-- Unlimited turns today (James, 4 Nov 2026): one switch per game on the teacher's Today page that lifts that game's daily
-- turn limit for one class, for the rest of that New Zealand day only. Each turns itself off at midnight.
--
-- Games: Dragon Maths ('dragon-maths': forest and arena fights), Clan Quest ('clan-quest': mine fights), Maths Monsters
-- ('monsters': battles), Diamond Drop ('diamond': new levels), Star Trader ('trader': jumps), Sky Isles ('isles': turns).
-- Master tries, builds, races and gifts keep their limits.
--
-- How it works in every game: the normal turns are used first, as on any day. When they run out the game no longer says
-- "come back tomorrow", and the extra turns give everything in the game as usual (gold, XP, loot), but no hub points,
-- so the class leaderboard and levels stay fair between classes. Tomorrow is a normal day.
--
-- 1. app_settings.unlimited_days: { game id: the NZ date its switch is on for }. An old date means off. A new class copies
--    its school's row, which is harmless.
-- 2. unlimited_today(player, game) and unlimited_games(player) (the game ids on today).
-- 3. teacher_set_unlimited_today(game, enabled, target_class).
-- 4. Exact edits so the games can read it: lord_server_settings, clans_settings and monster_battle_rules gain
--    'unlimitedToday'; my_monsters() gains battles.unlimited; my_moves_left() gains 'unlimited' (a list of game ids).
--    Diamond Drop, Star Trader and Sky Isles read the settings row itself.

alter table public.app_settings add column unlimited_days jsonb not null default '{}'::jsonb;

create function public.unlimited_today(player uuid, game text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.unlimited_days ->> game = to_char((now() at time zone 'Pacific/Auckland')::date, 'YYYY-MM-DD')
     from public.settings_of(coalesce(unlimited_today.player, auth.uid())) s),
    false)
$$;

create function public.unlimited_games(player uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(e.key order by e.key), '[]'::jsonb)
  from public.settings_of(coalesce(unlimited_games.player, auth.uid())) s,
       jsonb_each_text(s.unlimited_days) e
  where e.value = to_char((now() at time zone 'Pacific/Auckland')::date, 'YYYY-MM-DD')
$$;

create function public.teacher_set_unlimited_today(game text, enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null or game is null or game not in ('dragon-maths', 'clan-quest', 'monsters', 'diamond', 'trader', 'isles') then
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

revoke execute on function public.unlimited_today(uuid, text), public.unlimited_games(uuid),
  public.teacher_set_unlimited_today(text, boolean, uuid) from public, anon, authenticated;
-- Pupils see it only through the games and my_moves_left(), never for another player.
grant execute on function public.unlimited_today(uuid, text), public.unlimited_games(uuid) to service_role;
grant execute on function public.teacher_set_unlimited_today(text, boolean, uuid) to authenticated;

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
  E'select public.lord_settings(player) || jsonb_build_object(''unlimitedToday'', public.unlimited_today(player, ''dragon-maths''))'
]]);

select pg_temp.edit_function('public.clans_settings(uuid)', array[array[
  E'    ''season'', s.clans_season,',
  E'    ''season'', s.clans_season,\n    ''unlimitedToday'', public.unlimited_today(coalesce(clans_settings.player, auth.uid()), ''clan-quest''),'
]]);

select pg_temp.edit_function('public.monster_battle_rules(uuid)', array[array[
  E'    12))',
  E'    12),\n    ''unlimitedToday'', public.unlimited_today(monster_battle_rules.player, ''monsters''))'
]]);

-- Maths Monsters' browser reads its battles a day from my_monsters().
select pg_temp.edit_function('public.my_monsters()', array[array[
  E'''perDay'', (public.monster_battle_rules() ->> ''battlesPerDay'')::integer),\n    ''playDays''',
  E'''perDay'', (public.monster_battle_rules() ->> ''battlesPerDay'')::integer,\n                                  ''unlimited'', (public.monster_battle_rules() ->> ''unlimitedToday'')::boolean),\n    ''playDays'''
]]);

select pg_temp.edit_function('public.my_moves_left()', array[array[
  E'  select jsonb_build_object(\n    ''lord'',',
  E'  select jsonb_build_object(\n    ''unlimited'', public.unlimited_games(me.id),\n    ''lord'','
]]);
