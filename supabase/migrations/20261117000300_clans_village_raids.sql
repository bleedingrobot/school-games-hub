-- Clan Quest: Village Raids on classmates (docs/CLANS-PVP-PLAN.md, 17 Nov 2026).
--
-- A raid is a siege and a hero fight against a computer-played copy of a classmate's heroes. Nothing is ever taken from
-- anyone: the raiders are paid by the game, and the raided clan is paid when its village holds.
--
--   1. clan_village_mates   each classmate clan's name, its heroes' levels added up, building levels, troops and Banners
--                           (never its gold or a pupil's name). Replaced in place, so its grants still stand.
--   2. clan_raid_target     also gives the raided clan's heroes (the raid fights a copy of them). Replaced in place.
--   3. save_village_raid    saves a finished raid in one transaction: the raiders' clan (save_clan) and the raided clan's
--                           reward. The raided clan's gold can only go up (by at most the held reward) and only its
--                           Banners and held count change. Only the clans function (service_role) may call it.

create or replace function public.clan_village_mates(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cls uuid := public.current_class_of(player);
begin
  perform public.clan_check_player(player);
  if cls is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', t.public_id, 'name', t.name,
      'heroLevels', (select coalesce(sum((m.member ->> 'level')::integer), 0) from public.clan_members m where m.player = t.player),
      'levels', t.empire -> 'levels', 'troops', t.empire -> 'troops', 'banners', t.empire -> 'banners') order by t.name, t.public_id)
    from (select c.player, c.public_id, c.name, e.empire
          from public.clans c join public.clan_empires e on e.player = c.player
          where c.player <> clan_village_mates.player and public.current_class_of(c.player) = cls
          order by c.name, c.public_id limit 100) t), '[]');
end;
$$;

create or replace function public.clan_raid_target(player uuid, target uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.clans;
  e jsonb;
  cls uuid := public.current_class_of(player);
begin
  perform public.clan_check_player(player);
  if cls is null then
    return null;
  end if;
  select * into c from public.clans x where x.public_id = target and x.player <> clan_raid_target.player
    and public.current_class_of(x.player) = cls;
  if not found then
    return null;
  end if;
  select ce.empire into e from public.clan_empires ce where ce.player = c.player;
  return jsonb_build_object('id', c.public_id, 'name', c.name, 'createdNzDay', c.created_nz_day, 'version', c.version, 'empire', e,
    'gold', c.gold, 'village', (select v.levels from public.clan_villages v where v.id = public.clan_village_of(c.player)),
    'members', coalesce((select jsonb_agg(m.member order by m.slot) from public.clan_members m where m.player = c.player), '[]'::jsonb));
end;
$$;

create function public.save_village_raid(
  player uuid, expected_version integer, target uuid, target_version integer, request_id uuid, state jsonb, result jsonb,
  defender_gold integer, defender_banners jsonb, defender_held jsonb, news text, note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.clans;
  a public.clans;
  old_d jsonb;
  raiders text := state -> 'clan' ->> 'name';
  won boolean;
  before_count integer;
  saved jsonb;
begin
  perform public.clan_check_player(player);
  -- Done before: the same answer (save_clan finds the kept one), and nothing is paid again.
  if exists (select 1 from public.clan_requests r where r.player = save_village_raid.player and r.request_id = save_village_raid.request_id) then
    return public.save_clan(player, expected_version, request_id, 'fightRound', state, result);
  end if;
  select x.* into d from public.clans x where x.public_id = target;
  if not found or d.player = player then
    raise exception 'That clan could not be found.' using errcode = '22023';
  end if;
  -- Lock both clans, smaller account id first.
  perform 1 from public.clans x where x.player in (save_village_raid.player, d.player) order by x.player for update;
  select x.* into a from public.clans x where x.player = save_village_raid.player;
  select x.* into d from public.clans x where x.public_id = target;
  if not found or a.player is null or a.version <> expected_version or d.version <> target_version then
    return jsonb_build_object('status', 'stale');
  end if;
  if public.current_class_of(a.player) is null or public.current_class_of(a.player) is distinct from public.current_class_of(d.player) then
    raise exception 'That clan is in another class.' using errcode = '22023';
  end if;
  if not (select s.clan_raids_enabled from public.settings_of(a.player) s) then
    raise exception 'Raids on classmates are switched off.' using errcode = '22023';
  end if;
  if result ->> 'type' is distinct from 'fightRound' or jsonb_typeof(result -> 'raid') is distinct from 'object'
     or jsonb_typeof(result -> 'raid' -> 'won') is distinct from 'boolean' then
    raise exception 'That raid could not be read.' using errcode = '22023';
  end if;
  won := (result -> 'raid' ->> 'won')::boolean;

  -- The held reward: only when the village held, and never more than the most a hold can pay (20 + 5 for each Strongroom level).
  select e.empire into old_d from public.clan_empires e where e.player = d.player;
  if defender_gold is null or defender_gold < 0 or defender_gold > 45 or (won and defender_gold <> 0) then
    raise exception 'That raid paid too much.' using errcode = '22023';
  end if;
  -- Banners: this week's count may go up by at most 2 (a new week starts from 0); the held count is a day and 0 to 3.
  if jsonb_typeof(defender_banners) is distinct from 'object' or jsonb_typeof(defender_banners -> 'week') is distinct from 'number'
     or jsonb_typeof(defender_banners -> 'count') is distinct from 'number'
     or jsonb_typeof(defender_held) is distinct from 'object' or jsonb_typeof(defender_held -> 'nzDay') is distinct from 'number'
     or jsonb_typeof(defender_held -> 'paid') is distinct from 'number' or (defender_held ->> 'paid')::integer not between 0 and 3 then
    raise exception 'That raid could not be read.' using errcode = '22023';
  end if;
  before_count := case when (old_d -> 'banners' ->> 'week') = (defender_banners ->> 'week') then coalesce((old_d -> 'banners' ->> 'count')::integer, 0) else 0 end;
  if (defender_banners ->> 'count')::integer - before_count not between 0 and 2 then
    raise exception 'That raid gave too many Banners.' using errcode = '22023';
  end if;
  -- The lines are exactly the sentences the game writes, naming only the two clans (never a pupil).
  if raiders !~ '^[A-Za-z]{1,20} [A-Za-z]{1,20}$'
     or news is distinct from (case when won then 'The ' || raiders || ' clan raided the ' || d.name || ' clan and won!'
                                    else 'The ' || d.name || ' clan held off a raid by the ' || raiders || ' clan!' end)
     or note is distinct from (case when won then 'Raiders from the ' || raiders || ' clan got past your walls. Nothing was taken.'
                                    else 'Your village held off raiders from the ' || raiders || ' clan!'
                                      || case when defender_gold > 0 then ' You earned ' || defender_gold || ' gold.' else '' end end) then
    raise exception 'That news could not be read.' using errcode = '22023';
  end if;

  saved := public.save_clan(player, expected_version, request_id, 'fightRound', state, result);
  if saved ->> 'status' <> 'saved' then
    return saved;
  end if;
  update public.clan_empires e set empire = e.empire || jsonb_build_object('banners', defender_banners, 'held', defender_held)
  where e.player = d.player;
  update public.clans x set gold = x.gold + defender_gold, version = x.version + 1, updated_at = now() where x.player = d.player;
  insert into public.clan_news (nz_date, village_id, text)
  values ((now() at time zone 'Pacific/Auckland')::date, public.clan_village_of(a.player), news);
  insert into public.clan_raid_notes (defender, text) values (d.player, note);
  return saved;
end;
$$;

revoke execute on function public.save_village_raid(uuid, integer, uuid, integer, uuid, jsonb, jsonb, integer, jsonb, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.save_village_raid(uuid, integer, uuid, integer, uuid, jsonb, jsonb, integer, jsonb, jsonb, text, text) to service_role;
