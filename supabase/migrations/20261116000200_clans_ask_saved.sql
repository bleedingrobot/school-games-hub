-- Clan Quest: keep the waiting maths question between "ask" and its answer (James, 16 Nov 2026).
--
-- The shop discount, the quest and the siege ask a ladder question in two steps: `ask` makes it and keeps it on the clan
-- (state.ask, answer included), then `askCheck` marks the answer against it. save_clan never stored state.ask or
-- state.askNo, so the question was gone by the time the answer came in, and every check said "There is no question to
-- answer." (The shop and quest could only be passed with "No thanks".)
--
--   1. clans.ask    jsonb:   the waiting questions and their marks ({ for, no, questions, marks? }), or null
--   2. clans.ask_no integer: how many have been asked (each ask's questions come from the seed and this number)
--   3. save_clan / load_clan replaced in place (from 20261116000100, checked equal to the live ones) to write and read both.
--      Their grants still stand: the server only.
--
-- Pupils can't read clans (RLS on, no policies, everything revoked), and the server function strips the answers before
-- the browser sees state.ask, as it does for a ladder fight's questions.

alter table public.clans
  add column ask jsonb check (ask is null or (jsonb_typeof(ask) = 'object' and octet_length(ask::text) <= 20000)),
  add column ask_no integer check (ask_no is null or ask_no >= 0);

CREATE OR REPLACE FUNCTION public.load_clan(player uuid, request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
        'village', coalesce(c.village, v.levels), 'wakesToday', c.wakes_today, 'questDay', c.quest_day, 'empire', empire)
        -- The season keys (season, monster, bossWins, gearVersion, repick), kept together in clans.extras.
        || coalesce(c.extras, '{}'::jsonb)),
      'seed', c.seed, 'day', c.day, 'createdNzDay', c.created_nz_day, 'fightsLeft', c.fights_left,
      'fightNo', c.fight_no, 'raidNo', c.raid_no, 'examined', to_jsonb(c.examined),
      'fight', case when f.player is null then null else jsonb_build_object(
        'depth', f.depth, 'boss', f.boss, 'seed', f.seed, 'no', f.no, 'settings', f.settings, 'rounds', f.rounds)
        -- A ladder fight's questions and marks (an old-style fight has neither).
        || case when f.questions is null then '{}'::jsonb else jsonb_build_object('questions', f.questions, 'marks', coalesce(f.marks, '[]')) end
        -- A season monster try: its setup and siege.
        || case when f.monster is null then '{}'::jsonb else jsonb_build_object('monster', f.monster) end end)
      -- The waiting ladder question (shop, quest or siege) and the ask counter; left out when there are none.
      || jsonb_strip_nulls(jsonb_build_object('ask', c.ask, 'askNo', c.ask_no)));
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_clan(player uuid, expected_version integer, request_id uuid, action text, state jsonb, result jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  clan jsonb := state -> 'clan';
  fight jsonb := state -> 'fight';
  stored jsonb;
  c public.clans;
  old_fight public.clan_fights;
  new_version integer;
  new_day integer := (state ->> 'day')::integer;
  members jsonb := clan -> 'members';
  new_extras jsonb := jsonb_strip_nulls(jsonb_build_object('season', clan -> 'season', 'monster', clan -> 'monster',
    'bossWins', clan -> 'bossWins', 'gearVersion', clan -> 'gearVersion', 'repick', clan -> 'repick'));
  given integer := case when result ->> 'type' = 'chestGive' then (result ->> 'gold')::integer end;
  new_ask jsonb := case when jsonb_typeof(state -> 'ask') = 'object' then state -> 'ask' end;
  new_ask_no integer;
begin
  perform public.clan_check_player(player);
  select r.result into stored from public.clan_requests r
  where r.player = save_clan.player and r.request_id = save_clan.request_id;
  if found then
    return jsonb_build_object('status', 'duplicate', 'result', stored);
  end if;
  if jsonb_typeof(clan) is distinct from 'object' or jsonb_typeof(members) is distinct from 'array'
     or jsonb_array_length(members) not between 4 and 6 or jsonb_typeof(clan -> 'empire') is distinct from 'object' then
    raise exception 'That clan could not be read.' using errcode = '22023';
  end if;
  if jsonb_typeof(fight) is not null and jsonb_typeof(fight) not in ('object', 'null') then
    raise exception 'That fight could not be read.' using errcode = '22023';
  end if;
  if jsonb_typeof(fight) = 'object' and (fight ->> 'no')::integer > (state ->> 'fightNo')::integer then
    raise exception 'That fight is ahead of the clan.' using errcode = '22023';
  end if;
  if octet_length(new_extras::text) > 8000 or (jsonb_typeof(fight -> 'monster') is not null and jsonb_typeof(fight -> 'monster') <> 'object') then
    raise exception 'That clan could not be read.' using errcode = '22023';
  end if;
  if given is not null and (given < 1 or given > 100000) then
    raise exception 'That gift could not be read.' using errcode = '22023';
  end if;
  -- The waiting question: an object or nothing, and the counter a whole number (or missing).
  if (jsonb_typeof(state -> 'ask') is not null and jsonb_typeof(state -> 'ask') not in ('object', 'null'))
     or octet_length(coalesce(new_ask, '{}')::text) > 20000
     or (jsonb_typeof(state -> 'askNo') is not null and jsonb_typeof(state -> 'askNo') not in ('number', 'null')) then
    raise exception 'That clan could not be read.' using errcode = '22023';
  end if;
  new_ask_no := (state ->> 'askNo')::integer;

  if expected_version = 0 then
    if given is not null then
      raise exception 'A new clan has nothing to give.' using errcode = '22023';
    end if;
    -- A first save must use the seed this student was given.
    if not exists (select 1 from public.clan_seeds s where s.player = save_clan.player and s.seed = (state ->> 'seed')::integer) then
      raise exception 'That clan seed was not given to this player.' using errcode = '22023';
    end if;
    if jsonb_typeof(fight) = 'object' then
      raise exception 'A new clan has no fight yet.' using errcode = '22023';
    end if;
    begin
      insert into public.clans (player, name, seed, day, created_nz_day, gold, followers, village, wakes_today, quest_day,
        fights_left, fight_no, raid_no, examined, extras, ask, ask_no)
      values (player, clan ->> 'name', (state ->> 'seed')::integer, new_day, (state ->> 'createdNzDay')::integer,
        (clan ->> 'gold')::integer, (clan ->> 'followers')::integer, clan -> 'village', coalesce((clan ->> 'wakesToday')::integer, 0),
        (clan ->> 'questDay')::integer, (state ->> 'fightsLeft')::integer, (state ->> 'fightNo')::integer,
        (state ->> 'raidNo')::integer, coalesce(array(select jsonb_array_elements_text(state -> 'examined')), '{}'), new_extras, new_ask, new_ask_no);
    exception when unique_violation then
      return jsonb_build_object('status', 'stale');
    end;
    new_version := 1;
  else
    select * into c from public.clans where clans.player = save_clan.player for update;
    if not found or c.version <> expected_version then
      return jsonb_build_object('status', 'stale');
    end if;
    -- A clan's day only goes forwards, and its seed and first day never change.
    if new_day < c.day or (state ->> 'seed')::integer <> c.seed or (state ->> 'createdNzDay')::integer <> c.created_nz_day then
      raise exception 'That clan does not match the saved one.' using errcode = '22023';
    end if;
    -- The fight counter only goes forwards too.
    if (state ->> 'fightNo')::integer < c.fight_no then
      raise exception 'That clan does not match the saved one.' using errcode = '22023';
    end if;
    -- A gift to the chest takes exactly that much from the purse, and the purse is all it comes from.
    if given is not null and c.gold - (clan ->> 'gold')::integer <> given then
      raise exception 'That gift does not match the purse.' using errcode = '22023';
    end if;
    update public.clans set
      name = clan ->> 'name', day = new_day, gold = (clan ->> 'gold')::integer, followers = (clan ->> 'followers')::integer,
      village = clan -> 'village', wakes_today = coalesce((clan ->> 'wakesToday')::integer, 0),
      quest_day = (clan ->> 'questDay')::integer, fights_left = (state ->> 'fightsLeft')::integer,
      fight_no = (state ->> 'fightNo')::integer, raid_no = (state ->> 'raidNo')::integer,
      examined = coalesce(array(select jsonb_array_elements_text(state -> 'examined')), '{}'),
      extras = new_extras, ask = new_ask, ask_no = new_ask_no, version = c.version + 1, updated_at = now()
    where clans.player = save_clan.player
    returning version into new_version;
    delete from public.clan_members m where m.player = save_clan.player;
  end if;

  insert into public.clan_members (player, slot, member)
  select save_clan.player, (x.ord - 1)::integer, x.member
  from jsonb_array_elements(members) with ordinality as x(member, ord);
  insert into public.clan_empires as e (player, empire) values (player, clan -> 'empire')
  on conflict on constraint clan_empires_pkey do update set empire = excluded.empire;

  if given is not null then
    update public.clan_villages v set chest = v.chest + given where v.id = public.clan_village_of(save_clan.player);
  end if;

  -- The fight in progress: kept as it is, or closed.
  select * into old_fight from public.clan_fights f where f.player = save_clan.player;
  if jsonb_typeof(fight) = 'object' then
    insert into public.clan_fights as f (player, depth, boss, seed, no, settings, rounds, questions, marks, monster)
    values (player, (fight ->> 'depth')::integer, (fight ->> 'boss')::boolean, (fight ->> 'seed')::integer,
      (fight ->> 'no')::integer, fight -> 'settings', fight -> 'rounds',
      case when jsonb_typeof(fight -> 'questions') = 'array' then fight -> 'questions' end,
      case when jsonb_typeof(fight -> 'marks') = 'array' then fight -> 'marks' end,
      case when jsonb_typeof(fight -> 'monster') = 'object' then fight -> 'monster' end)
    on conflict on constraint clan_fights_pkey do update set
      depth = excluded.depth, boss = excluded.boss, seed = excluded.seed, no = excluded.no,
      settings = excluded.settings, rounds = excluded.rounds, questions = excluded.questions, marks = excluded.marks, monster = excluded.monster;
  else
    delete from public.clan_fights f where f.player = save_clan.player;
    -- A fight that was open and is now closed by a round was just paid: one line in the log, with no name on it.
    if old_fight.player is not null and result ->> 'type' = 'fightRound' and (result ->> 'over')::boolean
       and result -> 'summary' ->> 'result' in ('won', 'lost', 'fled', 'timeout') then
      insert into public.clan_fight_log (nz_date, depth, boss, result, school_id)
      values ((now() at time zone 'Pacific/Auckland')::date, old_fight.depth, old_fight.boss, result -> 'summary' ->> 'result',
        (select p.school_id from public.profiles p where p.id = save_clan.player));
    end if;
  end if;

  insert into public.clan_requests (player, request_id, action, result) values (player, request_id, action, result);
  delete from public.clan_requests r where r.player = save_clan.player and r.created_at < now() - interval '2 days';
  return jsonb_build_object('status', 'saved', 'version', new_version);
exception when unique_violation then
  -- The same request arrived twice at the very same moment and the other copy saved first.
  return jsonb_build_object('status', 'stale');
end;
$function$;

-- load_clan and save_clan were replaced in place, so their earlier grants (the server only) still stand.
