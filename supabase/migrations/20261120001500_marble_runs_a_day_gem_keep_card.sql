-- Marble Rush: 10 runs a day, and home-card lines for Marble Rush and Gem Keep (James, 20 Nov 2026).
--
-- 1. marble_runs_today(player): finished runs saved today (New Zealand day). The marble function asks before handing
--    out a seed and won't start an 11th run (shared/marble/config.ts MARBLE_RUNS_A_DAY). Server only.
-- 2. teacher_set_unlimited_today accepts 'marble' (newest body: 20261120001100_toonflap_limits.sql), so the teacher's
--    "Unlimited today" lifts it.
-- 3. my_moves_left() also sends 'marble' ({ runs } today) and 'gemKeep' ({ keys, keyToday }: Level Keys passed, and
--    whether one was passed today), for the home cards (src/data/movesLeft.ts). An exact edit: if the text is not found
--    exactly once, nothing changes.

-- 1. Runs today
create or replace function public.marble_runs_today(player uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.marble_runs r
  where r.player = marble_runs_today.player
    and r.created_at >= ((now() at time zone 'Pacific/Auckland')::date)::timestamp at time zone 'Pacific/Auckland'
$$;

revoke execute on function public.marble_runs_today(uuid) from public, anon, authenticated;
grant execute on function public.marble_runs_today(uuid) to service_role;

-- 2. "Unlimited today" for Marble Rush
create or replace function public.teacher_set_unlimited_today(game text, enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null or game is null
     or game not in ('dragon-maths', 'clan-quest', 'monsters', 'diamond', 'trader', 'isles', 'goblinstorm', 'toonflap', 'marble') then
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

-- 3. The home cards
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

select pg_temp.edit_function('public.my_moves_left()', array[array[
  E'                    where r.player = me.id and r.day = (now() at time zone ''Pacific/Auckland'')::date)\n',
  E'                    where r.player = me.id and r.day = (now() at time zone ''Pacific/Auckland'')::date),\n'
  || E'    ''marble'', jsonb_build_object(''runs'', public.marble_runs_today(me.id)),\n'
  || E'    ''gemKeep'', (select jsonb_build_object(\n'
  || E'                  ''keys'', count(*) filter (where g.key_passed),\n'
  || E'                  ''keyToday'', coalesce(bool_or(g.key_passed and (g.key_passed_at at time zone ''Pacific/Auckland'')::date\n'
  || E'                                                 = (now() at time zone ''Pacific/Auckland'')::date), false))\n'
  || E'                from public.gem_keep_progress g where g.player = me.id)\n'
]]);
