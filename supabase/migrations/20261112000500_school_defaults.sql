-- Teacher controls C7: school defaults for new classes, and one rule for a new game.
--
-- 1. The school's defaults row (app_settings with class_id null) is what give_class_settings() copies into every new class.
--    Until now nothing could change it. Three new functions, all for a school admin only:
--      admin_school_defaults()                  the defaults row of the admin's school, as json
--      admin_set_school_default(changes jsonb)  sets some columns of that row ({ "<column>": value }) and nothing else
--      admin_copy_defaults_to_classes(columns)  copies those columns from the defaults row to every class in the school that is
--                                               not archived, and writes one admin_log row ('school_defaults')
--    Which columns may be set: the same check as teacher_set_games (a hub_games.switch_column, or Maths Monsters, Dragon Maths,
--    Clan Quest, Non-maths games), plus the lesson controls: multiplayer_enabled, space_reactions_enabled, training_first
--    (true or false) and question_skips ('on', 'limited' or 'off'). Anything else is refused and nothing changes.
--    give_class_settings() is not touched: it copies the whole defaults row by column name, so it keeps working.
--
-- 2. A new game's switch starts on for every class (James, 11 Nov 2026). Every hub_games.switch_column now defaults to true
--    (a pgTAP test checks it for every game, now and later). These columns defaulted to false and are set to true: bond_match_enabled,
--    mine_enabled, archery_enabled, kingdom_enabled, trader_enabled, diamond_enabled, isles_enabled, beanstalk_enabled, and the three
--    switches outside hub_games: monsters_enabled, lord_enabled, clans_enabled. Changing a column's default changes no existing row,
--    so no class's settings change. Only classes made after this (and the defaults row's future copies) start with them on.
--
-- 3. admin_log.action may now also be 'school_defaults'. The old check only listed the six end-of-year steps; it is replaced by one
--    that lists the same six and the new one. No row is changed or lost.

-- ---------------------------------------------------------------------------
-- 2. New games start on
-- ---------------------------------------------------------------------------
alter table public.app_settings alter column bond_match_enabled set default true;
alter table public.app_settings alter column mine_enabled set default true;
alter table public.app_settings alter column archery_enabled set default true;
alter table public.app_settings alter column kingdom_enabled set default true;
alter table public.app_settings alter column trader_enabled set default true;
alter table public.app_settings alter column diamond_enabled set default true;
alter table public.app_settings alter column isles_enabled set default true;
alter table public.app_settings alter column beanstalk_enabled set default true;
alter table public.app_settings alter column monsters_enabled set default true;
alter table public.app_settings alter column lord_enabled set default true;
alter table public.app_settings alter column clans_enabled set default true;

-- ---------------------------------------------------------------------------
-- 3. The admin log may say 'school_defaults'
-- ---------------------------------------------------------------------------
alter table public.admin_log drop constraint admin_log_action_check;
alter table public.admin_log add constraint admin_log_action_check
  check (action in ('classes', 'archive', 'leavers', 'points', 'fame', 'dragon', 'school_defaults'));

-- ---------------------------------------------------------------------------
-- 1. School defaults
-- ---------------------------------------------------------------------------

-- The columns the school defaults may set, with what each holds: 'boolean' or 'skip' (question_skips). Private: no client can call it.
create function public.school_default_columns()
returns table (col text, kind text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct g.switch_column::text, 'boolean'::text from public.hub_games g where g.switch_column is not null
  union
  select c, 'boolean' from unnest(array['monsters_enabled', 'lord_enabled', 'clans_enabled', 'non_maths_games',
                                        'multiplayer_enabled', 'space_reactions_enabled', 'training_first']) c
  union
  select 'question_skips', 'skip'
$$;
revoke execute on function public.school_default_columns() from public, anon, authenticated;

create function public.admin_school_defaults()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform public.require_school_admin();
  select to_jsonb(s) into result from public.app_settings s
  where s.school_id = public.my_school() and s.class_id is null;
  return result;
end;
$$;
revoke execute on function public.admin_school_defaults() from public, anon, authenticated;
grant execute on function public.admin_school_defaults() to authenticated;

create function public.admin_set_school_default(changes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
  v jsonb;
  kind_of text;
  sets text[] := '{}';
begin
  perform public.require_school_admin();
  if jsonb_typeof(changes) is distinct from 'object' then
    raise exception 'Those settings couldn''t be read.' using errcode = '22023';
  end if;
  for k, v in select * from jsonb_each(changes) loop
    select d.kind into kind_of from public.school_default_columns() d where d.col = k;
    if kind_of is null
       or (kind_of = 'boolean' and jsonb_typeof(v) is distinct from 'boolean')
       or (kind_of = 'skip' and (jsonb_typeof(v) is distinct from 'string' or (v #>> '{}') not in ('on', 'limited', 'off'))) then
      raise exception 'Unknown school default' using errcode = '22023';
    end if;
    sets := sets || pg_catalog.format('%I = %L::%s', k, v #>> '{}', case kind_of when 'skip' then 'text' else 'boolean' end);
  end loop;
  if cardinality(sets) = 0 then
    return;
  end if;
  execute pg_catalog.format(
    'update public.app_settings set %s where school_id = %L::integer and class_id is null',
    pg_catalog.array_to_string(sets, ', '), public.my_school());
end;
$$;
revoke execute on function public.admin_set_school_default(jsonb) from public, anon, authenticated;
grant execute on function public.admin_set_school_default(jsonb) to authenticated;

-- Returns how many classes were changed.
create function public.admin_copy_defaults_to_classes(columns text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
  sets text[] := '{}';
  n integer;
begin
  perform public.require_school_admin();
  if columns is null or cardinality(columns) = 0 then
    raise exception 'Pick something to copy.' using errcode = '22023';
  end if;
  foreach k in array columns loop
    if not exists (select 1 from public.school_default_columns() d where d.col = k) then
      raise exception 'Unknown school default' using errcode = '22023';
    end if;
    sets := sets || pg_catalog.format('%I = d.%I', k, k);
  end loop;
  execute pg_catalog.format(
    'update public.app_settings s set %s from public.app_settings d
     where d.school_id = %L::integer and d.class_id is null
       and s.school_id = d.school_id and s.class_id in (
         select c.id from public.classes c where c.school_id = d.school_id and not c.archived)',
    pg_catalog.array_to_string(sets, ', '), public.my_school());
  get diagnostics n = row_count;
  perform public.admin_log_add('school_defaults', jsonb_build_object('count', n, 'columns', to_jsonb(columns)));
  return n;
end;
$$;
revoke execute on function public.admin_copy_defaults_to_classes(text[]) from public, anon, authenticated;
grant execute on function public.admin_copy_defaults_to_classes(text[]) to authenticated;
