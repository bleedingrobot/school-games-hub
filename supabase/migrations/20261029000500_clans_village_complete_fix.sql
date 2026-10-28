-- Clan Quest season goals, a fix (28 Oct 2026). clan_village_complete (20261029000400) paid whenever a whole village was saved
-- in a season with no Hall row yet. The midnight job saves every empire, so a village finished in an earlier season was paid again
-- at the first midnight of each new season, without any building. Now only the save that takes the village from not whole to whole
-- pays. Changed only in the check after the levels loop.

create or replace function public.clan_village_complete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rules jsonb := public.clan_season_rules();
  b text;
  mx text;
  c public.clans;
  sid integer;
  v_season integer;
  n integer;
  was_whole boolean;
begin
  if new.empire ->> 'version' is distinct from '2' then
    return null;
  end if;
  for b, mx in select k.key, k.value from jsonb_each_text(rules -> 'maxLevels') k loop
    if coalesce((new.empire -> 'levels' ->> b)::integer, 0) < mx::integer then
      return null;
    end if;
  end loop;
  -- Only the save that finishes the village counts: a save of a village that was already whole (the midnight job's rest, a troop
  -- purchase, a new season's number while the clock is off) earns nothing.
  if tg_op = 'UPDATE' and old.empire ->> 'version' = '2' then
    was_whole := true;
    for b, mx in select k.key, k.value from jsonb_each_text(rules -> 'maxLevels') k loop
      if coalesce((old.empire -> 'levels' ->> b)::integer, 0) < mx::integer then
        was_whole := false;
      end if;
    end loop;
    if was_whole then
      return null;
    end if;
  end if;
  select x.* into c from public.clans x where x.player = new.player;
  if not found then
    return null;
  end if;
  select p.school_id into sid from public.profiles p where p.id = new.player;
  v_season := (public.clan_season(new.player) ->> 'number')::integer;
  insert into public.clan_hall as h (player, season, school_id, clan_name, village_done_on)
  values (new.player, v_season, sid, c.name, public.nz_day(now()))
  on conflict (player, season) do update
    set village_done_on = excluded.village_done_on, school_id = excluded.school_id, clan_name = excluded.clan_name
    where h.village_done_on is null;
  get diagnostics n = row_count;
  if n = 0 then
    return null;
  end if;
  update public.clans x set
    fame = x.fame + (rules -> 'villageReward' ->> 'fame')::integer,
    stats = x.stats || jsonb_build_object('villageBuilt', greatest(coalesce((x.stats ->> 'villageBuilt')::integer, 0), 2))
  where x.player = new.player;
  insert into public.clan_scores (player, wins, bosses, wars, points_raw, counts_for_points)
  values (new.player, 0, 0, 0, (rules -> 'villageReward' ->> 'points')::integer, true);
  if sid is not null then
    insert into public.clan_news (nz_date, school_id, text)
    values (public.nz_day(now()), sid, c.name || ' finished their whole village!');
  end if;
  perform public.award_achievements(new.player, 'clan-quest', now());
  return null;
exception when others then
  -- Never lose a save because a reward went wrong.
  raise warning 'rewarding a finished village failed (%)', sqlstate;
  return null;
end;
$$;
