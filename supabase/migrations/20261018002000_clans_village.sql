-- Clan Quest, stage C.6 part A: the class village and raids on classmates.
--
-- 1. Villages: one per class group (clan_villages), plus a default "Everyone else" village that any pupil the teacher has
--    not moved belongs to (clan_village_members only holds the pupils who were moved). The village holds the chest and the
--    building levels; the server puts those levels on every clan it loads.
-- 2. The chest: a pupil gives gold in the same save that takes it from their purse (save_clan checks the purse really
--    dropped by that much). Nothing takes gold out except the midnight job building the vote's winner.
-- 3. The weekly vote (clan_votes): one vote per pupil per week; the midnight job closes the week once.
-- 4. Raids on classmates: save_raid saves the raiders and the raided clan in ONE transaction, locking both in a fixed order,
--    refusing if either copy is old, and checking nothing was made or lost between the two (gold, land, buildings, troops).
-- 5. News: clan_news gets a village (null = everyone); a raided clan also gets a private note (clan_raid_notes).
-- 6. The teacher: groups (create, rename, delete, move a pupil) and the switch for raids on classmates (off by default).
--
-- The rules themselves (who may raid whom, the battle, what a vote does) are the shared/clans TypeScript code run by the
-- clans server function; the database keeps what it is told and refuses what makes no sense.
-- Design: docs/CLANS-PLAN.md, "Stage C.6, part A: design".

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- Weeks start on Monday (New Zealand). Must equal weekOf() in shared/clans/village.ts (a test checks it).
create function public.clan_nz_week(nz_day integer default null)
returns integer
language sql
stable
set search_path = ''
as $$ select floor((coalesce(nz_day, public.clan_nz_day()) + 3) / 7.0)::integer $$;

-- Gold to build a building up to a level, and the top level. Must equal CONFIG.village in shared/clans/config.ts (a test checks it).
create function public.clan_village_cost(kind text, to_level integer)
returns integer
language sql
immutable
as $$
  select to_level * case kind when 'trainingHall' then 300 when 'smithy' then 250 when 'church' then 400 end
$$;

create function public.clan_village_max(kind text)
returns integer
language sql
immutable
as $$ select case kind when 'trainingHall' then 5 when 'smithy' then 6 when 'church' then 3 end $$;

create table public.clan_villages (
  id bigint generated always as identity primary key,
  name text not null check (name ~ '^[A-Za-z0-9][A-Za-z0-9 ''-]{0,29}$'),
  is_default boolean not null default false,
  -- The class's gold. Only ever added to by a pupil's save and spent by the midnight job.
  chest integer not null default 0 check (chest between 0 and 100000000),
  levels jsonb not null default '{"trainingHall": 0, "smithy": 0, "church": 0}' check (
    jsonb_typeof(levels) = 'object'
    and (levels ->> 'trainingHall')::integer between 0 and 5
    and (levels ->> 'smithy')::integer between 0 and 6
    and (levels ->> 'church')::integer between 0 and 3),
  -- The last week whose vote was closed, so a week is closed once.
  closed_week integer not null,
  created_at timestamptz not null default now()
);
create unique index clan_villages_one_default on public.clan_villages (is_default) where is_default;

-- Only pupils the teacher moved. Everyone else is in the default village (number 1).
create table public.clan_village_members (
  player uuid primary key references public.profiles (id) on delete cascade,
  village_id bigint not null references public.clan_villages (id) on delete cascade
);
create index clan_village_members_village on public.clan_village_members (village_id);

create table public.clan_votes (
  village_id bigint not null references public.clan_villages (id) on delete cascade,
  week integer not null,
  player uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('trainingHall', 'smithy', 'church')),
  primary key (village_id, week, player)
);

insert into public.clan_villages (id, name, is_default, closed_week)
overriding system value
values (1, 'Everyone else', true, public.clan_nz_week() - 1);
alter table public.clan_villages alter column id restart with 2;

-- A hidden id for a clan, used to pick a classmate to raid. It is not the pupil's account id and is made again if the clan is.
alter table public.clans add column public_id uuid not null default gen_random_uuid() unique;

-- News for one village (null: for everyone, like the fights in the Mines).
alter table public.clan_news add column village_id bigint references public.clan_villages (id) on delete cascade;
create index clan_news_village on public.clan_news (village_id, id);

-- What a raided clan reads next time it opens the game. Plain computer sentences naming the raiders' clan only.
create table public.clan_raid_notes (
  id bigint generated always as identity primary key,
  defender uuid not null references public.clans (player) on delete cascade,
  text text not null check (char_length(text) between 1 and 200),
  created_at timestamptz not null default now()
);
create index clan_raid_notes_defender on public.clan_raid_notes (defender, id);

alter table public.app_settings add column clan_raids_enabled boolean not null default false;

alter table public.clan_villages enable row level security;
alter table public.clan_village_members enable row level security;
alter table public.clan_votes enable row level security;
alter table public.clan_raid_notes enable row level security;
revoke all on public.clan_villages, public.clan_village_members, public.clan_votes, public.clan_raid_notes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Which village a pupil is in
-- ---------------------------------------------------------------------------

create function public.clan_village_of(who uuid)
returns bigint
language sql
stable
set search_path = ''
as $$ select coalesce((select m.village_id from public.clan_village_members m where m.player = who), 1::bigint) $$;

-- ---------------------------------------------------------------------------
-- 3. Loading (now with the village) and saving (now with the chest)
-- ---------------------------------------------------------------------------

-- Same as before, plus: `village` (name, chest, levels, this week's votes, this pupil's vote, how many clans), the village's
-- levels put on the clan, `self` (this clan's hidden public id), `raidsOn`, and `notes` (what raiders did to this clan lately).
-- The news is the last 12 lines, for this village and for everyone, newest first (lines are tidied away after a week).
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
    into is_on, raids_on from public.app_settings s;
  select coalesce(jsonb_agg(n.text order by n.id desc), '[]') into news
  from (select x.id, x.text from public.clan_news x
        where x.village_id is null or x.village_id = home
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
        'depth', f.depth, 'boss', f.boss, 'seed', f.seed, 'no', f.no, 'settings', f.settings, 'rounds', f.rounds) end));
end;
$$;

-- Same as before, plus: a save whose result is a gift to the chest (`result.type = 'chestGive'`) also adds exactly that gold
-- to the pupil's village chest, in the same transaction, and refuses unless the purse really dropped by that much.
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
    insert into public.clan_fights as f (player, depth, boss, seed, no, settings, rounds)
    values (player, (fight ->> 'depth')::integer, (fight ->> 'boss')::boolean, (fight ->> 'seed')::integer,
      (fight ->> 'no')::integer, fight -> 'settings', fight -> 'rounds')
    on conflict on constraint clan_fights_pkey do update set
      depth = excluded.depth, boss = excluded.boss, seed = excluded.seed, no = excluded.no,
      settings = excluded.settings, rounds = excluded.rounds;
  else
    delete from public.clan_fights f where f.player = save_clan.player;
    -- A fight that was open and is now closed by a round was just paid: one line in the log, with no name on it.
    if old_fight.player is not null and result ->> 'type' = 'fightRound' and (result ->> 'over')::boolean
       and result -> 'summary' ->> 'result' in ('won', 'lost', 'fled', 'timeout') then
      insert into public.clan_fight_log (nz_date, depth, boss, result)
      values ((now() at time zone 'Pacific/Auckland')::date, old_fight.depth, old_fight.boss, result -> 'summary' ->> 'result');
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

-- ---------------------------------------------------------------------------
-- 4. The vote
-- ---------------------------------------------------------------------------

-- Keeps this pupil's vote for the week (changing it replaces it, so it is only ever counted once).
-- Returns { ok: true } or { ok: false, why }.
create function public.clan_vote(player uuid, kind text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  vid bigint := public.clan_village_of(player);
  v public.clan_villages;
begin
  perform public.clan_check_player(player);
  if not exists (select 1 from public.clans c where c.player = clan_vote.player) then
    return jsonb_build_object('ok', false, 'why', 'no-clan');
  end if;
  if kind is null or kind not in ('trainingHall', 'smithy', 'church') then
    raise exception 'That is not a building.' using errcode = '22023';
  end if;
  select * into v from public.clan_villages x where x.id = vid for share;
  if (v.levels ->> kind)::integer >= public.clan_village_max(kind) then
    return jsonb_build_object('ok', false, 'why', 'built');
  end if;
  insert into public.clan_votes as x (village_id, week, player, kind) values (vid, public.clan_nz_week(), player, kind)
  on conflict on constraint clan_votes_pkey do update set kind = excluded.kind;
  return jsonb_build_object('ok', true);
end;
$$;

-- Closes one week's vote for one village, exactly as closeWeek() in shared/clans/village.ts does: the building with the most
-- votes (a tie goes to the cheaper, then to the fixed order Training Hall, Smithy, Church) is built if the chest covers it.
-- Writes the news line. Returns the building built, or null.
create function public.clan_village_close(vid bigint, closing_week integer, news_date date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.clan_villages;
  won text;
  level integer;
  cost integer;
  pretty text;
begin
  select * into v from public.clan_villages x where x.id = vid for update;
  select t.kind into won
  from (select x.kind, count(*) as n from public.clan_votes x where x.village_id = vid and x.week = closing_week group by x.kind) t
  where (v.levels ->> t.kind)::integer < public.clan_village_max(t.kind)
  order by t.n desc,
    public.clan_village_cost(t.kind, (v.levels ->> t.kind)::integer + 1),
    case t.kind when 'trainingHall' then 1 when 'smithy' then 2 else 3 end
  limit 1;
  if won is null then
    return null;
  end if;
  level := (v.levels ->> won)::integer + 1;
  cost := public.clan_village_cost(won, level);
  pretty := case won when 'trainingHall' then 'Training Hall' when 'smithy' then 'Smithy' else 'Church' end;
  if v.chest < cost then
    insert into public.clan_news (nz_date, village_id, text)
    values (news_date, vid, 'The class voted for the ' || pretty || ' (level ' || level || ') but the chest was ' || (cost - v.chest) || ' gold short.');
    return null;
  end if;
  update public.clan_villages x set chest = x.chest - cost, levels = jsonb_set(x.levels, array[won], to_jsonb(level)) where x.id = vid;
  insert into public.clan_news (nz_date, village_id, text) values (news_date, vid, 'The class built the ' || pretty || ' (level ' || level || ')!');
  return won;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Raids on classmates
-- ---------------------------------------------------------------------------

-- The other clans in this pupil's village, as the server needs to work out who may be raided: the hidden id, the clan's name,
-- the day it began, its shield and its troops. No gold, no account ids.
create function public.clan_village_mates(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  vid bigint := public.clan_village_of(player);
begin
  perform public.clan_check_player(player);
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', t.public_id, 'name', t.name, 'createdNzDay', t.created_nz_day,
      'shieldUntil', coalesce((t.empire ->> 'shieldUntil')::integer, 0), 'troops', t.empire -> 'troops') order by t.name, t.public_id)
    from (select c.public_id, c.name, c.created_nz_day, e.empire
          from public.clans c join public.clan_empires e on e.player = c.player
          where c.player <> clan_village_mates.player and public.clan_village_of(c.player) = vid
          order by c.name, c.public_id limit 100) t), '[]');
end;
$$;

-- One clan in this pupil's village, to raid it: { id, name, createdNzDay, version, empire }. Null if there is no such clan in
-- the village (or it is the pupil's own).
create function public.clan_raid_target(player uuid, target uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.clans;
  e jsonb;
begin
  perform public.clan_check_player(player);
  select * into c from public.clans x where x.public_id = target and x.player <> clan_raid_target.player
    and public.clan_village_of(x.player) = public.clan_village_of(clan_raid_target.player);
  if not found then
    return null;
  end if;
  select ce.empire into e from public.clan_empires ce where ce.player = c.player;
  return jsonb_build_object('id', c.public_id, 'name', c.name, 'createdNzDay', c.created_nz_day, 'version', c.version, 'empire', e);
end;
$$;

-- Total land of an empire (wild land plus developed plots).
create function public.clan_land_of(e jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$ select (e ->> 'wild')::integer + jsonb_array_length(e -> 'plots') $$;

create function public.clan_buildings_of(e jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$ select count(*)::integer from jsonb_array_elements(e -> 'plots') p where p ->> 'building' is not null $$;

-- Saves a raid on a classmate: the raiders' clan as save_clan does, and the raided clan's empire, in ONE transaction.
-- Both clans are locked in a fixed order (so two raids cannot deadlock). If either copy is old the whole thing is
-- refused as 'stale' and the server redoes the request from fresh copies. A repeat of the same request is 'duplicate'.
-- Checked here: both are in the same village, raids are switched on, and between the two empires nothing was made or lost
-- (vault gold and land are only moved, buildings can only be knocked down, nobody gains troops).
-- Returns what save_clan returns.
create function public.save_raid(
  player uuid, expected_version integer, target uuid, target_version integer, request_id uuid, state jsonb, defender_empire jsonb,
  result jsonb, news text, note text)
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
  if public.clan_village_of(a.player) <> public.clan_village_of(d.player) then
    raise exception 'That clan is in another village.' using errcode = '22023';
  end if;
  if not (select s.clan_raids_enabled from public.app_settings s) then
    raise exception 'Raids on classmates are switched off.' using errcode = '22023';
  end if;
  if result ->> 'type' is distinct from 'raidClass' or jsonb_typeof(defender_empire) is distinct from 'object' then
    raise exception 'That raid could not be read.' using errcode = '22023';
  end if;
  select e.empire into old_a from public.clan_empires e where e.player = a.player;
  select e.empire into old_d from public.clan_empires e where e.player = d.player;
  if (old_a ->> 'vault')::integer + (old_d ->> 'vault')::integer <> (new_a ->> 'vault')::integer + (defender_empire ->> 'vault')::integer
     or public.clan_land_of(old_a) + public.clan_land_of(old_d) <> public.clan_land_of(new_a) + public.clan_land_of(defender_empire)
     or public.clan_buildings_of(old_a) + public.clan_buildings_of(old_d) < public.clan_buildings_of(new_a) + public.clan_buildings_of(defender_empire) then
    raise exception 'That raid made or lost something.' using errcode = '22023';
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
  if news !~ ('^A raider from the ' || (state -> 'clan' ->> 'name') || ' clan (took [0-9]{1,9} gold\.|took [0-9]{1,6} plots? of land\.|knocked down [0-9]{1,4} buildings?\.|was driven off\.)$')
     or note !~ ('^A raider from the ' || (state -> 'clan' ->> 'name') || ' clan (attacked, and your defenders drove them off!|beat your defenders and took [0-9]{1,9} gold from your vault\.|beat your defenders and took [0-9]{1,6} plots? of your land\.|beat your defenders and knocked down [0-9]{1,4} buildings?\.)$')
     or (state -> 'clan' ->> 'name') !~ '^[A-Za-z]{1,20} [A-Za-z]{1,20}$' then
    raise exception 'That news could not be read.' using errcode = '22023';
  end if;

  saved := public.save_clan(player, expected_version, request_id, 'raidClass', state, result);
  if saved ->> 'status' <> 'saved' then
    return saved;
  end if;
  update public.clan_empires e set empire = defender_empire where e.player = d.player;
  update public.clans x set version = x.version + 1, updated_at = now() where x.player = d.player;
  insert into public.clan_news (nz_date, village_id, text)
  values ((now() at time zone 'Pacific/Auckland')::date, public.clan_village_of(a.player), news);
  insert into public.clan_raid_notes (defender, text) values (d.player, note);
  return saved;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. The midnight job, now also closing the week's vote
-- ---------------------------------------------------------------------------

-- Same as before, plus: for every village whose last week's vote has not been closed yet, close it (once: the village remembers
-- the last week it closed), and tidy old votes and raid notes.
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
  vid bigint;
  closed integer := 0;
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
      day = due.new_day, fights_left = public.clan_fights_per_day(), wakes_today = 0,
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
      empire = e.empire || jsonb_build_object('day', moved.day, 'energyUsed', 0, 'raidsToday', 0, 'kingdomRaidsToday', 0, 'raidedToday', '[]'::jsonb)
    from moved where e.player = moved.player
    returning e.player
  )
  select coalesce(array_agg(moved.player), '{}') into rested_players from moved;

  -- Yesterday in the Mines, in words and numbers only.
  select count(*) into wins from public.clan_fight_log l where l.nz_date = yesterday and l.result = 'won';
  if wins > 0 then
    insert into public.clan_news (nz_date, text)
    values (yesterday, case when wins = 1 then 'One fight was won in the Mines yesterday.' else wins || ' fights were won in the Mines yesterday.' end);
  end if;
  select coalesce(array_agg(distinct l.depth order by l.depth), '{}') into boss_depths
  from public.clan_fight_log l where l.nz_date = yesterday and l.boss and l.result = 'won';
  foreach d in array boss_depths[1:3] loop
    insert into public.clan_news (nz_date, text) values (yesterday, 'A boss deep in the Mines (level ' || d || ') was beaten yesterday!');
  end loop;

  -- The week that just ended: each village closes its vote once.
  for vid in select v.id from public.clan_villages v where v.closed_week < this_week - 1 order by v.id for update loop
    perform public.clan_village_close(vid, this_week - 1, yesterday);
    update public.clan_villages v set closed_week = this_week - 1 where v.id = vid;
    closed := closed + 1;
  end loop;

  update public.clan_daily_runs set rested = coalesce(cardinality(rested_players), 0) where nz_day = today;

  -- Tidying.
  delete from public.clan_news where nz_date < yesterday - 7;
  delete from public.clan_fight_log where nz_date < yesterday - 60;
  delete from public.clan_daily_runs where nz_day < today - 60;
  delete from public.clan_requests where created_at < now() - interval '2 days';
  delete from public.clan_votes where week < this_week - 4;
  delete from public.clan_raid_notes where created_at < now() - interval '2 days';

  return jsonb_build_object('ran', true, 'day', today, 'rested', coalesce(cardinality(rested_players), 0), 'villagesClosed', closed);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. The teacher: groups, and the switch for raids on classmates
-- ---------------------------------------------------------------------------

create function public.teacher_set_clan_raids(enabled boolean)
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
  update public.app_settings set clan_raids_enabled = enabled where id;
  return enabled;
end;
$$;

-- Every village with its chest, levels and how many pupils are in it, and every pupil with their village.
create function public.teacher_villages()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  return jsonb_build_object(
    'villages', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'isDefault', v.is_default, 'chest', v.chest, 'levels', v.levels,
      'pupils', (select count(*) from public.profiles p where p.role = 'student' and public.clan_village_of(p.id) = v.id)) order by v.id)
      from public.clan_villages v), '[]'),
    'pupils', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'village', public.clan_village_of(p.id)) order by p.display_name)
      from public.profiles p where p.role = 'student'), '[]'));
end;
$$;

create function public.teacher_create_village(new_name text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  made bigint;
begin
  perform public.require_teacher();
  if new_name is null or new_name !~ '^[A-Za-z0-9][A-Za-z0-9 ''-]{0,29}$' then
    raise exception 'Give the group a short name (letters and numbers).' using errcode = '22023';
  end if;
  if (select count(*) from public.clan_villages) >= 40 then
    raise exception 'That is plenty of groups.' using errcode = '22023';
  end if;
  insert into public.clan_villages (name, closed_week) values (trim(new_name), public.clan_nz_week() - 1) returning id into made;
  return made;
end;
$$;

create function public.teacher_rename_village(village bigint, new_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if new_name is null or new_name !~ '^[A-Za-z0-9][A-Za-z0-9 ''-]{0,29}$' then
    raise exception 'Give the group a short name (letters and numbers).' using errcode = '22023';
  end if;
  update public.clan_villages v set name = trim(new_name) where v.id = village;
end;
$$;

-- Deletes a group; its pupils go back to "Everyone else". The default village cannot be deleted. Its chest goes with it.
create function public.teacher_delete_village(village bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  delete from public.clan_villages v where v.id = village and not v.is_default;
  return found;
end;
$$;

-- Moves a pupil to a group (null or the default village: back to "Everyone else"). Their open votes in the old village are
-- taken back. Gold they already gave stays in the old chest.
create function public.teacher_move_pupil(student uuid, village bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old bigint := public.clan_village_of(student);
begin
  perform public.require_teacher();
  if not exists (select 1 from public.profiles p where p.id = student and p.role = 'student') then
    raise exception 'No such pupil.' using errcode = '22023';
  end if;
  if village is not null and not exists (select 1 from public.clan_villages v where v.id = village) then
    raise exception 'No such group.' using errcode = '22023';
  end if;
  if village is null or exists (select 1 from public.clan_villages v where v.id = village and v.is_default) then
    delete from public.clan_village_members m where m.player = student;
  else
    insert into public.clan_village_members (player, village_id) values (student, village)
    on conflict on constraint clan_village_members_pkey do update set village_id = excluded.village_id;
  end if;
  if public.clan_village_of(student) <> old then
    delete from public.clan_votes x where x.player = student and x.village_id = old;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.clan_nz_week(integer), public.clan_village_cost(text, integer), public.clan_village_max(text), public.clan_village_of(uuid),
  public.clan_vote(uuid, text), public.clan_village_close(bigint, integer, date), public.clan_village_mates(uuid), public.clan_raid_target(uuid, uuid),
  public.clan_land_of(jsonb), public.clan_buildings_of(jsonb),
  public.save_raid(uuid, integer, uuid, integer, uuid, jsonb, jsonb, jsonb, text, text),
  public.teacher_set_clan_raids(boolean), public.teacher_villages(), public.teacher_create_village(text),
  public.teacher_rename_village(bigint, text), public.teacher_delete_village(bigint), public.teacher_move_pupil(uuid, bigint)
from public, anon, authenticated;
grant execute on function
  public.teacher_set_clan_raids(boolean), public.teacher_villages(), public.teacher_create_village(text),
  public.teacher_rename_village(bigint, text), public.teacher_delete_village(bigint), public.teacher_move_pupil(uuid, bigint)
to authenticated;
grant execute on function
  public.clan_vote(uuid, text), public.clan_village_mates(uuid), public.clan_raid_target(uuid, uuid),
  public.save_raid(uuid, integer, uuid, integer, uuid, jsonb, jsonb, jsonb, text, text)
to service_role;
-- load_clan, save_clan and clan_nightly were replaced in place, so their earlier grants still stand.
