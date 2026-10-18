-- Clan Quest, stage C.5 part A: saving a clan between visits.
--
-- 1. Tables: clan_seeds (the number each student's clan is built from, chosen by the server),
--    clans (one per student), clan_members, clan_empires and clan_requests (each request is
--    remembered for two days, so a request sent twice only counts once). Students can't read or
--    write any of them: the clans server function does everything, through the functions below.
-- 2. Saving, for the server only: clan_offer_seed(), load_clan(), save_clan(). The rules
--    (prices, daily limits, who may raid whom) are the shared/clans TypeScript code, run by the
--    server function; the database keeps what it is told and refuses numbers that make no sense.
-- 3. Teachers: teacher_reset_clan() deletes one student's clan so they can make a new one.
--
-- Not here yet (part B and stage C.6): mine fights half-played, the midnight job, the village
-- chest, votes, news, points and achievements. A new season keeps clans (James, 18 Oct 2026).
-- Design: docs/CLANS-PLAN.md, "Stage C.5, part A: design".

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- The number a student's whole clan is built from: the creator's rolls, the order of quests, the
-- puzzle numbers and every raid. The server picks it, so nobody can shop around for good rolls.
create table public.clan_seeds (
  player uuid primary key references public.profiles (id) on delete cascade,
  seed integer not null default (floor(random() * 2147483647))::integer check (seed >= 0),
  created_at timestamptz not null default now()
);

create table public.clans (
  player uuid primary key references public.profiles (id) on delete cascade,
  -- One adjective and one noun from the creator's lists.
  name text not null check (name ~ '^[A-Za-z]{1,20} [A-Za-z]{1,20}$'),
  seed integer not null check (seed >= 0),
  -- Goes up by one with every save. A save that was made from an older copy is refused.
  version integer not null default 1 check (version >= 1),
  -- The clan's day number (1 on the first day) and the New Zealand day number (days since 1970) of day 1.
  day integer not null check (day between 1 and 100000),
  created_nz_day integer not null check (created_nz_day > 0),
  -- The clan purse and the followers waiting to be drafted.
  gold integer not null check (gold between 0 and 100000000),
  followers integer not null check (followers between 0 and 100000000),
  -- Training Hall, Smithy and Church levels (the class village sets them in stage C.6).
  village jsonb not null check (jsonb_typeof(village) = 'object'),
  wakes_today integer not null default 0 check (wakes_today between 0 and 100),
  -- The day number of the last quest done: one quest a day.
  quest_day integer check (quest_day is null or quest_day >= 1),
  fights_left integer not null check (fights_left between 0 and 100),
  fight_no integer not null default 0 check (fight_no >= 0),
  -- Counts up with each raid and Friendly War, so each gets its own seed.
  raid_no integer not null default 0 check (raid_no >= 0),
  -- Items a member has looked at closely, as "member|item".
  examined text[] not null default '{}' check (cardinality(examined) <= 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clan_members (
  player uuid not null references public.clans (player) on delete cascade,
  slot integer not null check (slot between 0 and 5),
  -- The whole member (stats, gear, spells, HP...), as the shared/clans code keeps it.
  member jsonb not null check (
    jsonb_typeof(member) = 'object'
    and (member ->> 'level')::integer between 1 and 20
    and (member ->> 'maxHp')::integer >= 1
    and (member ->> 'points')::integer >= 0
    and (member ->> 'xp')::integer >= 0),
  primary key (player, slot)
);

create table public.clan_empires (
  player uuid primary key references public.clans (player) on delete cascade,
  -- Vault, land, buildings, troops and today's raids.
  empire jsonb not null check (
    jsonb_typeof(empire) = 'object'
    and (empire ->> 'vault')::integer >= 0
    and (empire ->> 'wild')::integer >= 0)
);

-- Every request that changed something, kept for two days so a request sent twice (a slow
-- connection, a double tap) gets the first answer back instead of paying twice.
create table public.clan_requests (
  player uuid not null references public.profiles (id) on delete cascade,
  request_id uuid not null,
  action text not null check (action ~ '^[a-zA-Z]{1,20}$'),
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (player, request_id)
);
create index clan_requests_age on public.clan_requests (created_at);

alter table public.clan_seeds enable row level security;
alter table public.clans enable row level security;
alter table public.clan_members enable row level security;
alter table public.clan_empires enable row level security;
alter table public.clan_requests enable row level security;
revoke all on public.clan_seeds, public.clans, public.clan_members, public.clan_empires, public.clan_requests
from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Saving (server only)
-- ---------------------------------------------------------------------------

create function public.clan_check_player(who uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p join auth.users u on u.id = p.id
    where p.id = who and public.is_school_email(u.email)
  ) then
    raise exception 'No such player.' using errcode = '22023';
  end if;
end;
$$;

-- The student's clan seed. The first call picks it; every call after gives the same number.
create function public.clan_offer_seed(player uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_seed integer;
begin
  perform public.clan_check_player(player);
  insert into public.clan_seeds (player) values (player) on conflict do nothing;
  select s.seed into found_seed from public.clan_seeds s where s.player = clan_offer_seed.player;
  return found_seed;
end;
$$;

-- The student's clan as { seed, version, state, replay }. `state` is null until they have made one (version 0).
-- `replay` is the answer kept for `request_id`, if that request was already done.
create function public.load_clan(player uuid, request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.clans;
  replay jsonb;
  members jsonb;
  empire jsonb;
begin
  perform public.clan_check_player(player);
  select r.result into replay from public.clan_requests r
  where r.player = load_clan.player and r.request_id = load_clan.request_id;
  select * into c from public.clans where clans.player = load_clan.player;
  if not found then
    return jsonb_build_object('seed', public.clan_offer_seed(player), 'version', 0, 'state', null, 'replay', replay);
  end if;
  select jsonb_agg(m.member order by m.slot) into members from public.clan_members m where m.player = load_clan.player;
  select e.empire into empire from public.clan_empires e where e.player = load_clan.player;
  return jsonb_build_object(
    'seed', c.seed,
    'version', c.version,
    'replay', replay,
    'state', jsonb_build_object(
      'clan', jsonb_strip_nulls(jsonb_build_object(
        'name', c.name, 'members', coalesce(members, '[]'), 'gold', c.gold, 'followers', c.followers,
        'village', c.village, 'wakesToday', c.wakes_today, 'questDay', c.quest_day, 'empire', empire)),
      'seed', c.seed, 'day', c.day, 'createdNzDay', c.created_nz_day, 'fightsLeft', c.fights_left,
      'fightNo', c.fight_no, 'raidNo', c.raid_no, 'examined', to_jsonb(c.examined)));
end;
$$;

-- Saves the clan after one request. `expected_version` is the version the server loaded (0 for a first
-- save). `state` is the clan the shared/clans rules produced; `result` is what the browser is told, kept
-- for two days under `request_id`.
-- Returns { status: 'saved', version } | { status: 'duplicate', result } | { status: 'stale' }.
-- 'stale' means another request saved first: load again and redo the action.
create function public.save_clan(player uuid, expected_version integer, request_id uuid, action text, state jsonb, result jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clan jsonb := state -> 'clan';
  stored jsonb;
  c public.clans;
  new_version integer;
  new_day integer := (state ->> 'day')::integer;
  members jsonb := clan -> 'members';
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

  if expected_version = 0 then
    -- A first save must use the seed this student was given.
    if not exists (select 1 from public.clan_seeds s where s.player = save_clan.player and s.seed = (state ->> 'seed')::integer) then
      raise exception 'That clan seed was not given to this player.' using errcode = '22023';
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

  insert into public.clan_requests (player, request_id, action, result) values (player, request_id, action, result);
  delete from public.clan_requests r where r.player = save_clan.player and r.created_at < now() - interval '2 days';
  return jsonb_build_object('status', 'saved', 'version', new_version);
exception when unique_violation then
  -- The same request arrived twice at the very same moment and the other copy saved first.
  return jsonb_build_object('status', 'stale');
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Teachers
-- ---------------------------------------------------------------------------

-- Deletes one student's clan (members, empire and remembered requests go with it) and the seed it was
-- built from, so they make a new clan with new rolls. Returns whether they had one.
create function public.teacher_reset_clan(student uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  had boolean;
begin
  perform public.require_teacher();
  delete from public.clans c where c.player = student;
  had := found;
  delete from public.clan_requests r where r.player = student;
  delete from public.clan_seeds s where s.player = student;
  return had;
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.clan_check_player(uuid), public.clan_offer_seed(uuid), public.load_clan(uuid, uuid),
  public.save_clan(uuid, integer, uuid, text, jsonb, jsonb), public.teacher_reset_clan(uuid)
from public, anon, authenticated;
grant execute on function public.teacher_reset_clan(uuid) to authenticated;
grant execute on function
  public.clan_offer_seed(uuid), public.load_clan(uuid, uuid), public.save_clan(uuid, integer, uuid, text, jsonb, jsonb)
to service_role;
