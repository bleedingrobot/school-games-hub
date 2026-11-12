-- Games tab, "All on / All off" for a whole section (teacher controls card C4): one request sets many of a class's game switches.
--
-- teacher_set_games(changes, target_class): `changes` is { "<column>": true|false, ... }. Each key must be the switch column of a
-- game in hub_games, or one of the switches that live outside hub_games: Maths Monsters, Dragon Maths and Clan Quest (their
-- hub_games rows have no switch_column, and giving them one would hide their achievements and points rules while off, which
-- is a change of behaviour) and Non-maths games. Anything else is refused and nothing changes. All changes are applied by one
-- UPDATE of the class's settings row.
--
-- Turning Dragon Maths on does what teacher_set_lord does: a school with no season start yet gets today's date.
-- Nothing is dropped or changed; this only adds a function.

create function public.teacher_set_games(changes jsonb, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
  v jsonb;
  allowed text[];
  sets text[] := '{}';
begin
  perform public.require_teacher();
  if jsonb_typeof(changes) is distinct from 'object' then
    raise exception 'Those settings couldn''t be read.' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  select coalesce(array_agg(distinct g.switch_column), '{}') || array['monsters_enabled', 'lord_enabled', 'clans_enabled', 'non_maths_games']
  into allowed
  from public.hub_games g
  where g.switch_column is not null;
  for k, v in select * from jsonb_each(changes) loop
    if not k = any (allowed) or jsonb_typeof(v) is distinct from 'boolean' then
      raise exception 'Unknown games setting' using errcode = '22023';
    end if;
    sets := sets || pg_catalog.format('%I = %L::boolean', k, v #>> '{}');
  end loop;
  if cardinality(sets) = 0 then
    return;
  end if;
  execute pg_catalog.format(
    'update public.app_settings set %s where id in (select public.settings_to_change(%L::uuid))',
    pg_catalog.array_to_string(sets, ', '), target_class);
  if (changes ->> 'lord_enabled') = 'true' then
    update public.app_settings d set lord_season_start = public.nz_day(now())
    where d.school_id = public.my_school() and d.class_id is null and d.lord_season_start is null;
  end if;
end;
$$;
revoke execute on function public.teacher_set_games(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.teacher_set_games(jsonb, uuid) to authenticated;
