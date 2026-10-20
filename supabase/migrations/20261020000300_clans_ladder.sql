-- Clan Quest: Battle Cry questions from each child's own maths (James, 20 Oct 2026; plan in
-- /home/james/.claude/plans/can-you-carefully-plan-starry-catmull.md, results in docs/CLANS-PLAN.md).
--
-- A ladder fight keeps the questions the server made from the child's maths focus when the fight began (whole
-- questions, answers included) and the server's mark of each answer. They live with the fight in progress, which
-- pupils can't read (clan_fights: RLS on, everything revoked); the server function strips the answers before the
-- browser sees the fight. An old-style fight (started by an older browser) has neither, and plays exactly as before.
--
-- load_clan and save_clan are re-created from their newest versions (20261018002600, checked equal to the live ones
-- on 20 Oct 2026), changed only where they read and write the fight.

alter table public.clan_fights
  add column questions jsonb check (questions is null or (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) <= 8)),
  add column marks jsonb check (marks is null or (jsonb_typeof(marks) = 'array' and jsonb_array_length(marks) <= 8));

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
  votes jsonb;
  my_vote text;
  clan_count integer;
  home bigint := public.clan_village_of(player);
  cur_week integer := public.clan_nz_week();
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
  select coalesce(jsonb_object_agg(t.kind, t.n), '{}') into votes
  from (select kind, count(*)::integer as n from public.clan_votes x where x.village_id = home and x.week = cur_week group by kind) t;
  select x.kind into my_vote from public.clan_votes x where x.village_id = home and x.week = cur_week and x.player = load_clan.player;
  select count(*)::integer into clan_count from public.clans k where public.clan_village_of(k.player) = home;
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
    'village', jsonb_build_object('name', v.name, 'chest', v.chest, 'levels', v.levels, 'week', cur_week, 'votes', votes,
      'myVote', my_vote, 'clans', clan_count),
    'state', jsonb_build_object(
      'clan', jsonb_strip_nulls(jsonb_build_object(
        'name', c.name, 'members', coalesce(members, '[]'), 'gold', c.gold, 'followers', c.followers,
        'village', v.levels, 'wakesToday', c.wakes_today, 'questDay', c.quest_day, 'empire', empire)),
      'seed', c.seed, 'day', c.day, 'createdNzDay', c.created_nz_day, 'fightsLeft', c.fights_left,
      'fightNo', c.fight_no, 'raidNo', c.raid_no, 'examined', to_jsonb(c.examined),
      'fight', case when f.player is null then null else jsonb_build_object(
        'depth', f.depth, 'boss', f.boss, 'seed', f.seed, 'no', f.no, 'settings', f.settings, 'rounds', f.rounds)
        -- A ladder fight's questions and marks (an old-style fight has neither).
        || case when f.questions is null then '{}'::jsonb else jsonb_build_object('questions', f.questions, 'marks', coalesce(f.marks, '[]')) end end));
end;
$$;

create or replace function public.save_clan(player uuid, expected_version integer, request_id uuid, action text, state jsonb, result jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clan jsonb := state -> 'clan';
  fight jsonb := state -> 'fight';
  stored jsonb;
  c public.clans;
  old_fight public.clan_fights;
  new_version integer;
  new_day integer := (state ->> 'day')::integer;
  members jsonb := clan -> 'members';
  given integer := case when result ->> 'type' = 'chestGive' then (result ->> 'gold')::integer end;
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
  if given is not null and (given < 1 or given > 100000) then
    raise exception 'That gift could not be read.' using errcode = '22023';
  end if;

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
        fights_left, fight_no, raid_no, examined)
      values (player, clan ->> 'name', (state ->> 'seed')::integer, new_day, (state ->> 'createdNzDay')::integer,
        (clan ->> 'gold')::integer, (clan ->> 'followers')::integer, clan -> 'village', coalesce((clan ->> 'wakesToday')::integer, 0),
        (clan ->> 'questDay')::integer, (state ->> 'fightsLeft')::integer, (state ->> 'fightNo')::integer,
        (state ->> 'raidNo')::integer, coalesce(array(select jsonb_array_elements_text(state -> 'examined')), '{}'));
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
      version = c.version + 1, updated_at = now()
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
    insert into public.clan_fights as f (player, depth, boss, seed, no, settings, rounds, questions, marks)
    values (player, (fight ->> 'depth')::integer, (fight ->> 'boss')::boolean, (fight ->> 'seed')::integer,
      (fight ->> 'no')::integer, fight -> 'settings', fight -> 'rounds',
      case when jsonb_typeof(fight -> 'questions') = 'array' then fight -> 'questions' end,
      case when jsonb_typeof(fight -> 'marks') = 'array' then fight -> 'marks' end)
    on conflict on constraint clan_fights_pkey do update set
      depth = excluded.depth, boss = excluded.boss, seed = excluded.seed, no = excluded.no,
      settings = excluded.settings, rounds = excluded.rounds, questions = excluded.questions, marks = excluded.marks;
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
$$;
