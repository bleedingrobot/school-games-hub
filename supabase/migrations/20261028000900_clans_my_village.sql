-- Clan Quest "My Village" (James, 28 Oct 2026; plan in docs/CLANS-SIMPLER-PLAN.md, "Step 2 build plan").
--
-- Every clan now has its own buildings, paid from its one purse (clans.gold), and classmate raids are limited to the
-- pupil's CLASS instead of the class-village group. Nothing is dropped: the village tables and the teacher's village
-- functions stay where they are, unused.
--
--   1. clan_buildings_of      the "buildings built" count understands the new empire (version 2)
--   2. load_clan              no group-village overlay; returns the group levels for the one-off save conversion
--   3. clan_village_mates     the other clans in the pupil's class (not village)
--      clan_raid_target       one clan in the pupil's class
--   4. save_raid (new args)   conserves the purse and the building levels instead of the vault, plots and land
--   5. clan_nightly           resets buildsToday (and the other daily counters) for version 2 empires; no more village weeks
--   6. cq-village             "Village builders" now means: reached level 3 on any building (stats.villageBuilt, set by a trigger)
--   7. clan_my_village_share_chests()   ONE-TIME go-live step: shares each group's chest among its clans. Nothing runs it here.
--
-- load_clan and clan_nightly are re-created from their newest versions (20261020000300 and 20261018002600), changed only
-- where described. None of the shared functions (settings_of, progress_counts ...) is touched.

-- ---------------------------------------------------------------------------
-- 1. Buildings built
-- ---------------------------------------------------------------------------

-- A version 2 empire has no plots: count the buildings that have at least level 1. An old empire counts plots with a building, as before.
create or replace function public.clan_buildings_of(e jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when e ->> 'version' = '2' then (select count(*)::integer from jsonb_each_text(e -> 'levels') l where l.value::integer > 0)
    else (select count(*)::integer from jsonb_array_elements(coalesce(e -> 'plots', '[]'::jsonb)) p where p ->> 'building' is not null)
  end
$$;

-- ---------------------------------------------------------------------------
-- 2. load_clan
-- ---------------------------------------------------------------------------

-- Changed from 20261020000300: the clan's own `village` copy is used (the group levels are no longer laid over it), the vote and
-- clan-count lookups are gone, and `groupVillage` carries the group's levels so the server can convert an old save once
-- (the rules ignore it for a version 2 save).
create or replace function public.load_clan(player uuid, request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.clans;
  f public.clan_fights;
  v public.clan_villages;
  replay jsonb;
  members jsonb;
  empire jsonb;
  is_on boolean;
  raids_on boolean;
  news jsonb;
  notes jsonb;
  home bigint := public.clan_village_of(player);
begin
  perform public.clan_check_player(player);
  select r.result into replay from public.clan_requests r
  where r.player = load_clan.player and r.request_id = load_clan.request_id;
  select s.clans_enabled or exists (select 1 from public.profiles p where p.id = load_clan.player and p.role = 'teacher'),
         s.clan_raids_enabled
    into is_on, raids_on from public.settings_of(load_clan.player) s;
  select coalesce(jsonb_agg(n.text order by n.id desc), '[]') into news
  from (select x.id, x.text from public.clan_news x
        where (x.village_id is null and x.school_id = (select p.school_id from public.profiles p where p.id = load_clan.player))
           or x.village_id = home
        order by x.id desc limit 12) n;
  select * into c from public.clans where clans.player = load_clan.player;
  if not found then
    return jsonb_build_object('seed', public.clan_offer_seed(player), 'version', 0, 'state', null, 'replay', replay,
      'enabled', coalesce(is_on, false), 'news', news);
  end if;
  select * into v from public.clan_villages x where x.id = home;
  select coalesce(jsonb_agg(n.text order by n.id desc), '[]') into notes
  from (select x.id, x.text from public.clan_raid_notes x where x.defender = load_clan.player and x.created_at > now() - interval '2 days'
        order by x.id desc limit 3) n;
  select jsonb_agg(m.member order by m.slot) into members from public.clan_members m where m.player = load_clan.player;
  select e.empire into empire from public.clan_empires e where e.player = load_clan.player;
  select * into f from public.clan_fights x where x.player = load_clan.player;
  return jsonb_build_object(
    'seed', c.seed,
    'version', c.version,
    'replay', replay,
    'enabled', coalesce(is_on, false),
    'raidsOn', coalesce(raids_on, false),
    'self', c.public_id,
    'news', news,
    'notes', notes,
    'groupVillage', v.levels,
    'state', jsonb_build_object(
      'clan', jsonb_strip_nulls(jsonb_build_object(
        'name', c.name, 'members', coalesce(members, '[]'), 'gold', c.gold, 'followers', c.followers,
        'village', coalesce(c.village, v.levels), 'wakesToday', c.wakes_today, 'questDay', c.quest_day, 'empire', empire)),
      'seed', c.seed, 'day', c.day, 'createdNzDay', c.created_nz_day, 'fightsLeft', c.fights_left,
      'fightNo', c.fight_no, 'raidNo', c.raid_no, 'examined', to_jsonb(c.examined),
      'fight', case when f.player is null then null else jsonb_build_object(
        'depth', f.depth, 'boss', f.boss, 'seed', f.seed, 'no', f.no, 'settings', f.settings, 'rounds', f.rounds)
        -- A ladder fight's questions and marks (an old-style fight has neither).
        || case when f.questions is null then '{}'::jsonb else jsonb_build_object('questions', f.questions, 'marks', coalesce(f.marks, '[]')) end end));
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Raid targets: the same class
-- ---------------------------------------------------------------------------

-- The other clans in this pupil's class: the hidden id, the clan's name, the day it began, its shield and its troops.
-- No gold, no account ids. A pupil with no class gets none.
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
    select jsonb_agg(jsonb_build_object('id', t.public_id, 'name', t.name, 'createdNzDay', t.created_nz_day,
      'shieldUntil', coalesce((t.empire ->> 'shieldUntil')::integer, 0), 'troops', t.empire -> 'troops') order by t.name, t.public_id)
    from (select c.public_id, c.name, c.created_nz_day, e.empire
          from public.clans c join public.clan_empires e on e.player = c.player
          where c.player <> clan_village_mates.player and public.current_class_of(c.player) = cls
          order by c.name, c.public_id limit 100) t), '[]');
end;
$$;

-- One clan in this pupil's class, to raid it: { id, name, createdNzDay, version, empire, gold, village }. Null if there is no such clan
-- in the class (or it is the pupil's own, or the pupil has no class). `gold` is its purse; `village` is its group village's levels,
-- used only if its save is still the old shape.
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
    'gold', c.gold, 'village', (select v.levels from public.clan_villages v where v.id = public.clan_village_of(c.player)));
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. save_raid
-- ---------------------------------------------------------------------------

-- A new argument list (defender_gold), so this is a new function beside the old one. The old one counted vault, plots and land,
-- which a version 2 empire does not have; its permissions are taken away below so nothing can reach it any more.
--
-- Checked here (the server key is the only caller, so these are a second lock behind the rules in shared/clans):
--   * both clans are in the SAME CLASS, and raids are switched on;
--   * gold: the raiders gain exactly what the raided clan loses, and never more than 10% of (its purse - 200 x its Strongroom level),
--     rounded up. (A raided clan whose save is still the old shape is converted by the raid: its purse before is then worked back from
--     what it has afterwards.)
--   * buildings: only levels go down on the raided clan, never the Walls, the Strongroom or the Barracks, and by exactly the number
--     of levels the result says; none go up;
--   * no troops are made;
--   * nothing else about the raided empire changes, and the lines are exactly the sentences the game writes.
-- It then saves the raiders (save_clan) and the raided clan's purse, empire and village copy in the same transaction.
create function public.save_raid(
  player uuid, expected_version integer, target uuid, target_version integer, request_id uuid, state jsonb, defender_empire jsonb,
  defender_gold integer, result jsonb, news text, note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.clans;
  a public.clans;
  old_a jsonb;
  old_d jsonb;
  new_a jsonb := state -> 'clan' -> 'empire';
  new_a_gold integer := (state -> 'clan' ->> 'gold')::integer;
  gain integer := coalesce((result ->> 'gold')::integer, 0);
  drops integer := 0;
  before_gold integer;
  safe integer;
  saved jsonb;
  k text;
begin
  perform public.clan_check_player(player);
  if exists (select 1 from public.clan_requests r where r.player = save_raid.player and r.request_id = save_raid.request_id) then
    return public.save_clan(player, expected_version, request_id, 'raidClass', state, result);
  end if;
  select x.* into d from public.clans x where x.public_id = target;
  if not found or d.player = player then
    raise exception 'That clan could not be found.' using errcode = '22023';
  end if;
  -- Lock both clans, smaller account id first.
  perform 1 from public.clans x where x.player in (save_raid.player, d.player) order by x.player for update;
  select x.* into a from public.clans x where x.player = save_raid.player;
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
  if result ->> 'type' is distinct from 'raidClass' or jsonb_typeof(defender_empire) is distinct from 'object'
     or jsonb_typeof(new_a) is distinct from 'object' or defender_gold is null or defender_gold < 0 or gain < 0 or gain > 100000000
     or defender_empire ->> 'version' is distinct from '2' or new_a ->> 'version' is distinct from '2' then
    raise exception 'That raid could not be read.' using errcode = '22023';
  end if;
  select e.empire into old_a from public.clan_empires e where e.player = a.player;
  select e.empire into old_d from public.clan_empires e where e.player = d.player;

  -- Gold. The raiders gain what the raided clan loses (a clan still in the old shape is converted by the raid and may only have more).
  if old_a ->> 'version' = '2' then
    if new_a_gold <> a.gold + gain then
      raise exception 'That raid made or lost something.' using errcode = '22023';
    end if;
  elsif new_a_gold < a.gold + gain then
    raise exception 'That raid made or lost something.' using errcode = '22023';
  end if;
  if old_d ->> 'version' = '2' then
    if d.gold - defender_gold <> gain then
      raise exception 'That raid made or lost something.' using errcode = '22023';
    end if;
    before_gold := d.gold;
    -- Only the Walls, Strongroom and Barracks levels are safe; the rest may go down by exactly the levels the result lists.
    foreach k in array array['trainingHall', 'smithy', 'church', 'barracks', 'walls', 'tower', 'forge', 'strongroom'] loop
      if (defender_empire -> 'levels' ->> k)::integer > (old_d -> 'levels' ->> k)::integer
         or (k in ('barracks', 'walls', 'strongroom') and (defender_empire -> 'levels' ->> k)::integer <> (old_d -> 'levels' ->> k)::integer) then
        raise exception 'That raid changed the buildings too much.' using errcode = '22023';
      end if;
      drops := drops + (old_d -> 'levels' ->> k)::integer - (defender_empire -> 'levels' ->> k)::integer;
    end loop;
    if drops <> jsonb_array_length(coalesce(result -> 'destroyed', '[]'::jsonb)) then
      raise exception 'That raid made or lost something.' using errcode = '22023';
    end if;
    safe := 200 * (old_d -> 'levels' ->> 'strongroom')::integer;
  else
    if d.gold - defender_gold > gain then
      raise exception 'That raid made or lost something.' using errcode = '22023';
    end if;
    before_gold := defender_gold + gain;
    safe := 200 * (defender_empire -> 'levels' ->> 'strongroom')::integer;
  end if;
  -- At most 10% of what is not in the Strongroom, rounded up.
  if gain > (greatest(0, before_gold - safe) + 9) / 10 then
    raise exception 'That raid took too much.' using errcode = '22023';
  end if;
  foreach k in array array['footman', 'axeman', 'knight'] loop
    if (defender_empire -> 'troops' ->> k)::integer > (old_d -> 'troops' ->> k)::integer then
      raise exception 'That raid made troops.' using errcode = '22023';
    end if;
  end loop;
  -- A raid cannot change anything about the raided empire except what a raid changes.
  if (defender_empire ->> 'day') is distinct from (old_d ->> 'day') or (defender_empire ->> 'createdDay') is distinct from (old_d ->> 'createdDay') then
    raise exception 'That raid changed too much.' using errcode = '22023';
  end if;
  -- The lines are exactly the sentences the game writes, naming only the raiders' clan (never a pupil).
  if news !~ ('^A raider from the ' || (state -> 'clan' ->> 'name') || ' clan (took [0-9]{1,9} gold\.|knocked [0-9]{1,4} levels? off the buildings\.|was driven off\.)$')
     or note !~ ('^A raider from the ' || (state -> 'clan' ->> 'name') || ' clan (attacked, and your defenders drove them off!|beat your defenders and took [0-9]{1,9} gold from your purse\.|beat your defenders and knocked [0-9]{1,4} levels? off your buildings\.)$')
     or (state -> 'clan' ->> 'name') !~ '^[A-Za-z]{1,20} [A-Za-z]{1,20}$' then
    raise exception 'That news could not be read.' using errcode = '22023';
  end if;

  saved := public.save_clan(player, expected_version, request_id, 'raidClass', state, result);
  if saved ->> 'status' <> 'saved' then
    return saved;
  end if;
  update public.clan_empires e set empire = defender_empire where e.player = d.player;
  update public.clans x set
    gold = defender_gold,
    village = jsonb_build_object('trainingHall', (defender_empire -> 'levels' ->> 'trainingHall')::integer,
      'smithy', (defender_empire -> 'levels' ->> 'smithy')::integer, 'church', (defender_empire -> 'levels' ->> 'church')::integer),
    version = x.version + 1, updated_at = now()
  where x.player = d.player;
  insert into public.clan_news (nz_date, village_id, text)
  values ((now() at time zone 'Pacific/Auckland')::date, public.clan_village_of(a.player), news);
  insert into public.clan_raid_notes (defender, text) values (d.player, note);
  return saved;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. The midnight job
-- ---------------------------------------------------------------------------

-- Changed from 20261018002600: a version 2 empire gets a fresh day with buildsToday, raidsToday, kingdomRaidsToday and raidedToday at zero
-- (and no energyUsed, which it no longer has); an empire still in the old shape is reset exactly as before. The class villages' weeks
-- are no longer closed (their tables and clan_village_close stay, unused). Everything else is as it was.
create or replace function public.clan_nightly(for_day integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  today integer := coalesce(for_day, public.clan_nz_day());
  yesterday date := date '1970-01-01' + (coalesce(for_day, public.clan_nz_day()) - 1);
  rested_players uuid[];
  wins integer;
  boss_depths integer[];
  d integer;
  this_week integer := public.clan_nz_week(coalesce(for_day, public.clan_nz_day()));
  sid integer;
begin
  insert into public.clan_daily_runs (nz_day) values (today) on conflict do nothing;
  if not found then
    return jsonb_build_object('ran', false, 'day', today);
  end if;

  with due as (
    select c.player, greatest(1, today - c.created_nz_day + 1) as new_day
    from public.clans c
    where c.day < greatest(1, today - c.created_nz_day + 1)
      and not exists (select 1 from public.clan_fights f where f.player = c.player)
    for update of c
  ), moved as (
    update public.clans c set
      day = due.new_day, fights_left = public.clan_fights_per_day(c.player), wakes_today = 0,
      version = c.version + 1, updated_at = now()
    from due where c.player = due.player
    returning c.player, c.day
  ), healed as (
    update public.clan_members m set
      member = m.member || jsonb_build_object('knockedOut', false, 'hp', m.member -> 'maxHp', 'sp', m.member -> 'maxSp')
    from moved where m.player = moved.player
    returning m.player
  ), fresh as (
    update public.clan_empires e set
      empire = case
        when e.empire ->> 'version' = '2' then
          e.empire || jsonb_build_object('day', moved.day, 'buildsToday', 0, 'raidsToday', 0, 'kingdomRaidsToday', 0, 'raidedToday', '[]'::jsonb)
        else
          e.empire || jsonb_build_object('day', moved.day, 'energyUsed', 0, 'raidsToday', 0, 'kingdomRaidsToday', 0, 'raidedToday', '[]'::jsonb)
      end
    from moved where e.player = moved.player
    returning e.player
  )
  select coalesce(array_agg(moved.player), '{}') into rested_players from moved;

  -- Yesterday in the Mines, in words and numbers only, school by school.
  for sid in select s.id from public.schools s where s.active order by s.id loop
    select count(*) into wins from public.clan_fight_log l where l.nz_date = yesterday and l.result = 'won' and l.school_id = sid;
    if wins > 0 then
      insert into public.clan_news (nz_date, school_id, text)
      values (yesterday, sid, case when wins = 1 then 'One fight was won in the Mines yesterday.' else wins || ' fights were won in the Mines yesterday.' end);
    end if;
    select coalesce(array_agg(distinct l.depth order by l.depth), '{}') into boss_depths
    from public.clan_fight_log l where l.nz_date = yesterday and l.boss and l.result = 'won' and l.school_id = sid;
    foreach d in array boss_depths[1:3] loop
      insert into public.clan_news (nz_date, school_id, text) values (yesterday, sid, 'A boss deep in the Mines (level ' || d || ') was beaten yesterday!');
    end loop;
  end loop;

  update public.clan_daily_runs set rested = coalesce(cardinality(rested_players), 0) where nz_day = today;

  -- Tidying.
  delete from public.clan_news where nz_date < yesterday - 7;
  delete from public.clan_fight_log where nz_date < yesterday - 60;
  delete from public.clan_daily_runs where nz_day < today - 60;
  delete from public.clan_requests where created_at < now() - interval '2 days';
  delete from public.clan_votes where week < this_week - 4;
  delete from public.clan_raid_notes where created_at < now() - interval '2 days';

  return jsonb_build_object('ran', true, 'day', today, 'rested', coalesce(cardinality(rested_players), 0), 'villagesClosed', 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. The "Village builders" achievement
-- ---------------------------------------------------------------------------

-- cq-village reads stats.villageBuilt (clan_village in progress_counts, which this does not touch). It used to count weekly votes that built
-- something; now one clan is "a village builder" once any of its buildings reaches level 3. The count only ever goes up, so a clan that
-- already had it keeps it, and a raid that knocks a level off later does not take it away. This runs inside the save, before the
-- save's rewards are worked out, so the achievement is given in the same request.
create function public.clan_sync_village_built()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.empire ->> 'version' = '2'
     and exists (select 1 from jsonb_each_text(new.empire -> 'levels') l where l.value::integer >= 3) then
    update public.clans c set stats = c.stats || jsonb_build_object('villageBuilt', 1)
    where c.player = new.player and coalesce((c.stats ->> 'villageBuilt')::integer, 0) < 1;
  end if;
  return null;
end;
$$;

create trigger village_built_when_saved
after insert or update of empire on public.clan_empires
for each row
execute function public.clan_sync_village_built();

-- ---------------------------------------------------------------------------
-- 7. The chests (a ONE-TIME step for go-live: nothing in this file calls it)
-- ---------------------------------------------------------------------------

-- Shares each group village's chest gold equally (rounded down) among the clans whose pupils are in that village, adds it to their
-- purses (clans.gold), and sets the chest to 0. A village with no clan keeps its chest. Safe to run twice: the second run finds
-- empty chests and gives nothing. Returns { villages, clans, gold } for this run. Run by hand by the person who goes live:
--   select public.clan_my_village_share_chests();
create function public.clan_my_village_share_chests()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
  n integer;
  share integer;
  villages integer := 0;
  clan_count integer := 0;
  total integer := 0;
begin
  for v in select x.id, x.chest from public.clan_villages x where x.chest > 0 order by x.id for update loop
    select count(*)::integer into n from public.clans c where public.clan_village_of(c.player) = v.id;
    continue when n = 0;
    share := v.chest / n;
    if share > 0 then
      -- The version moves on so any copy a browser is holding is reloaded before it saves.
      update public.clans c set gold = c.gold + share, version = c.version + 1, updated_at = now()
      where public.clan_village_of(c.player) = v.id;
      villages := villages + 1;
      clan_count := clan_count + n;
      total := total + share * n;
    end if;
    update public.clan_villages x set chest = 0 where x.id = v.id;
  end loop;
  return jsonb_build_object('villages', villages, 'clans', clan_count, 'gold', total);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

-- The old save_raid cannot work with a version 2 empire: nothing may call it any more.
revoke execute on function public.save_raid(uuid, integer, uuid, integer, uuid, jsonb, jsonb, jsonb, text, text) from public, anon, authenticated, service_role;
revoke execute on function
  public.save_raid(uuid, integer, uuid, integer, uuid, jsonb, jsonb, integer, jsonb, text, text), public.clan_sync_village_built(),
  public.clan_my_village_share_chests()
from public, anon, authenticated;
grant execute on function public.save_raid(uuid, integer, uuid, integer, uuid, jsonb, jsonb, integer, jsonb, text, text) to service_role;
-- clan_my_village_share_chests() is deliberately given to nobody: it is run once from the SQL editor at go-live.
-- load_clan, clan_nightly, clan_village_mates, clan_raid_target and clan_buildings_of were replaced in place, so their grants still stand.
