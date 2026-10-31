-- Clan Quest: pupils may make up their heroes' names (James, 27 Oct 2026), behind a teacher switch that is off by default.
--
-- With the switch off nothing changes: hero names come from the word list, as before. With it on, a pupil may also type a
-- name, which the clans function checks (letters only, 2 to 12 long, no rude words: shared/clans/words.ts) before it is saved.
-- Hero names are only ever shown to the pupil and their teachers, never to classmates. Clan names still come from the lists.
--
-- 1. A column on app_settings (added, nothing rebuilt).
-- 2. clans_settings() as in 20261018002600_clans_schools_and_classes.sql (no later migration changed it), plus 'typedNames'.
--    clan_extras() sends it to the clans function, so the server reads the switch fresh on every request.
-- 3. teacher_set_clan_typed_names(), like teacher_set_clan_raids().
-- 4. teacher_clan_info() as in 20261018002600_clans_schools_and_classes.sql (no later migration changed it), plus 'heroes': the
--    hero names, so a teacher can see a made-up one. teacher_list_hero_names() swaps any made-up name for an unused one from
--    the list (the hero keeps its look: every member is saved with one when the clan is made).

alter table public.app_settings add column clan_typed_names boolean not null default false;

create or replace function public.clans_settings(player uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'enabledTopics', to_jsonb(s.clans_topics), 'yearBand', s.clans_year_band,
    'enabledTables', to_jsonb(s.clans_tables), 'fightsPerDay', s.clans_fights_per_day, 'season', s.clans_season,
    'typedNames', s.clan_typed_names)
  from public.settings_of(coalesce(player, auth.uid())) s
$$;

create function public.teacher_set_clan_typed_names(enabled boolean, target_class uuid default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null then
    raise exception 'Pick on or off.' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings set clan_typed_names = enabled where id in (select public.settings_to_change(target_class));
  return enabled;
end;
$$;

revoke execute on function public.teacher_set_clan_typed_names(boolean, uuid) from public, anon;
grant execute on function public.teacher_set_clan_typed_names(boolean, uuid) to authenticated;

create or replace function public.teacher_clan_info(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.clans;
  avg_level numeric;
begin
  perform public.require_teacher_of(student);
  select * into c from public.clans where clans.player = student;
  if not found then
    return null;
  end if;
  select avg((m.member ->> 'level')::integer) into avg_level from public.clan_members m where m.player = student;
  return jsonb_build_object(
    'name', c.name, 'day', c.day, 'gold', c.gold, 'followers', c.followers, 'fightsLeft', c.fights_left,
    'averageLevel', round(coalesce(avg_level, 1), 1),
    'inFight', exists (select 1 from public.clan_fights f where f.player = student),
    'lastPlayed', c.updated_at,
    'heroes', coalesce((select jsonb_agg(m.member ->> 'name' order by m.slot) from public.clan_members m where m.player = student), '[]'));
end;
$$;

-- The word list, as in shared/clans/words.ts (MEMBER_NAMES). A test checks the two match.
create function public.clan_member_names()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['Aria', 'Bram', 'Cleo', 'Dax', 'Elin', 'Finn', 'Gwen', 'Hugo', 'Isla', 'Jory', 'Kira', 'Leif', 'Mira', 'Nico', 'Orla', 'Pip', 'Quill', 'Rowan', 'Sage', 'Tam', 'Una', 'Vik', 'Wren', 'Xara', 'Yuri', 'Zed', 'Ember', 'Moss', 'Tilly', 'Bodhi', 'Kiri', 'Hemi']::text[] $$;

-- Swaps each made-up hero name for an unused name from the list. Bumps the clan's version, so a save the clans function
-- made from the older copy is refused and redone. Returns how many names were changed (0 if there was nothing to change).
create function public.teacher_list_hero_names(student uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  listed text[] := public.clan_member_names();
  used text[];
  m record;
  pick text;
  changed integer := 0;
begin
  perform public.require_teacher_of(student);
  perform 1 from public.clans c where c.player = student for update;
  if not found then
    return 0;
  end if;
  select coalesce(array_agg(x.member ->> 'name'), '{}') into used from public.clan_members x where x.player = student;
  for m in select x.slot, x.member from public.clan_members x where x.player = student order by x.slot loop
    if not (m.member ->> 'name') = any (listed) then
      select n into pick from unnest(listed) with ordinality as l(n, i) where not n = any (used) order by i limit 1;
      update public.clan_members x set member = jsonb_set(x.member, '{name}', to_jsonb(pick))
      where x.player = student and x.slot = m.slot;
      used := used || pick;
      changed := changed + 1;
    end if;
  end loop;
  if changed > 0 then
    update public.clans c set version = c.version + 1 where c.player = student;
  end if;
  return changed;
end;
$$;

revoke execute on function public.clan_member_names() from public, anon, authenticated;
revoke execute on function public.teacher_list_hero_names(uuid) from public, anon;
grant execute on function public.teacher_list_hero_names(uuid) to authenticated;
