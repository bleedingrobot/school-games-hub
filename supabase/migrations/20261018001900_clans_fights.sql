-- Clan Quest, stage C.5 part B: mine fights kept on the server, the midnight job, the teacher's switch.
--
-- 1. clan_fights: the mine fight a clan has open (one at most), kept round by round so a refresh or another
--    Chromebook picks it up where it was. The rules (replaying the fight from its seed, marking the Battle Cry
--    answers, paying out) are the shared/clans TypeScript code run by the clans server function; the database keeps
--    what it is told, refuses numbers that make no sense, and closes the fight in the same save that pays it.
-- 2. load_clan / save_clan, replaced: they now carry the open fight, the switch and the village news.
-- 3. clan_news and clan_fight_log: computer-written village news (no student names or text, no student ids anywhere
--    near it) and the finished-fight log it is written from.
-- 4. clan_nightly(): the midnight job (New Zealand time). Gives clans nobody opened today the night's rest (the very
--    same rest the server gives a clan when it is next opened, so a clan is never rested twice), writes the news, tidies.
-- 5. The teacher's switch (app_settings.clans_enabled, off until a teacher turns it on) and teacher_clan_info().
--
-- Design: docs/CLANS-PLAN.md, "Stage C.5, part B: design".

-- ---------------------------------------------------------------------------
-- 1. The fight in progress
-- ---------------------------------------------------------------------------

create table public.clan_fights (
  player uuid primary key references public.clans (player) on delete cascade,
  depth integer not null check (depth between 0 and 20),
  boss boolean not null,
  -- Picked by the server from the clan's seed and the fight number.
  seed integer not null,
  -- The clan's fight number this was (1 for its first fight). Never ahead of the clan's own counter.
  no integer not null check (no >= 1),
  -- The maths settings the Battle Cry questions were made with.
  settings jsonb not null check (jsonb_typeof(settings) = 'object'),
  -- The rounds played so far: [{ orders: [...], cry: null | { answer, reward } }, ...]. A fight ends within 8 rounds.
  rounds jsonb not null default '[]' check (jsonb_typeof(rounds) = 'array' and jsonb_array_length(rounds) <= 8),
  started_at timestamptz not null default now()
);

alter table public.clan_fights enable row level security;
revoke all on public.clan_fights from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. News and the finished-fight log (before the functions that use them)
-- ---------------------------------------------------------------------------

-- What happened in the Mines, with nobody's name or id on it. The midnight job counts these into news lines.
create table public.clan_fight_log (
  id bigint generated always as identity primary key,
  nz_date date not null,
  depth integer not null check (depth between 0 and 20),
  boss boolean not null,
  result text not null check (result in ('won', 'lost', 'fled', 'timeout'))
);
create index clan_fight_log_date on public.clan_fight_log (nz_date);

-- Village news, written by the midnight job and by nothing else. Plain computer sentences.
create table public.clan_news (
  id bigint generated always as identity primary key,
  nz_date date not null,
  text text not null check (char_length(text) between 1 and 200)
);

-- Which New Zealand days the midnight job has already done, so it never does one twice.
create table public.clan_daily_runs (
  nz_day integer primary key,
  ran_at timestamptz not null default now(),
  rested integer not null default 0
);

alter table public.clan_fight_log enable row level security;
alter table public.clan_news enable row level security;
alter table public.clan_daily_runs enable row level security;
revoke all on public.clan_fight_log, public.clan_news, public.clan_daily_runs from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. The teacher's switch
-- ---------------------------------------------------------------------------

alter table public.app_settings add column clans_enabled boolean not null default false;

-- Switch Clan Quest on or off for the class. Returns the new setting.
create function public.teacher_set_clans(enabled boolean)
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
  update public.app_settings set clans_enabled = enabled where id;
  return enabled;
end;
$$;

-- One student's clan at a glance, for the teacher page (null if they have none).
create function public.teacher_clan_info(student uuid)
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
  perform public.require_teacher();
  select * into c from public.clans where clans.player = student;
  if not found then
    return null;
  end if;
  select avg((m.member ->> 'level')::integer) into avg_level from public.clan_members m where m.player = student;
  return jsonb_build_object(
    'name', c.name, 'day', c.day, 'gold', c.gold, 'followers', c.followers, 'fightsLeft', c.fights_left,
    'averageLevel', round(coalesce(avg_level, 1), 1),
    'inFight', exists (select 1 from public.clan_fights f where f.player = student),
    'lastPlayed', c.updated_at);
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Loading and saving (server only), now with the fight, the switch and the news
-- ---------------------------------------------------------------------------

-- Same as before, plus: `state.fight` (null if none), `enabled` (the class switch; a teacher can always play) and `news`.
create or replace function public.load_clan(player uuid, request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.clans;
  f public.clan_fights;
  replay jsonb;
  members jsonb;
  empire jsonb;
  is_on boolean;
  news jsonb;
begin
  perform public.clan_check_player(player);
  select r.result into replay from public.clan_requests r
  where r.player = load_clan.player and r.request_id = load_clan.request_id;
  select s.clans_enabled or exists (select 1 from public.profiles p where p.id = load_clan.player and p.role = 'teacher')
    into is_on from public.app_settings s;
  select coalesce(jsonb_agg(n.text order by n.id desc), '[]') into news
  from (select x.id, x.text from public.clan_news x order by x.id desc limit 5) n;
  select * into c from public.clans where clans.player = load_clan.player;
  if not found then
    return jsonb_build_object('seed', public.clan_offer_seed(player), 'version', 0, 'state', null, 'replay', replay,
      'enabled', coalesce(is_on, false), 'news', news);
  end if;
  select jsonb_agg(m.member order by m.slot) into members from public.clan_members m where m.player = load_clan.player;
  select e.empire into empire from public.clan_empires e where e.player = load_clan.player;
  select * into f from public.clan_fights x where x.player = load_clan.player;
  return jsonb_build_object(
    'seed', c.seed,
    'version', c.version,
    'replay', replay,
    'enabled', coalesce(is_on, false),
    'news', news,
    'state', jsonb_build_object(
      'clan', jsonb_strip_nulls(jsonb_build_object(
        'name', c.name, 'members', coalesce(members, '[]'), 'gold', c.gold, 'followers', c.followers,
        'village', c.village, 'wakesToday', c.wakes_today, 'questDay', c.quest_day, 'empire', empire)),
      'seed', c.seed, 'day', c.day, 'createdNzDay', c.created_nz_day, 'fightsLeft', c.fights_left,
      'fightNo', c.fight_no, 'raidNo', c.raid_no, 'examined', to_jsonb(c.examined),
      'fight', case when f.player is null then null else jsonb_build_object(
        'depth', f.depth, 'boss', f.boss, 'seed', f.seed, 'no', f.no, 'settings', f.settings, 'rounds', f.rounds) end));
end;
$$;

-- Same as before, plus: the open fight in `state.fight` is kept (or removed when it is null), and a fight that has
-- just been paid (`result` says a round ended it) goes into the fight log for the news.
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

  if expected_version = 0 then
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
-- 4. The midnight job
-- ---------------------------------------------------------------------------

-- Mine fights a clan gets each day. Must equal CONFIG.fightsPerDay in shared/clans/config.ts (a test checks it).
create function public.clan_fights_per_day()
returns integer
language sql
immutable
as $$ select 8 $$;

-- New Zealand's calendar day as a whole number of days since 1970, the same number shared/clans/clock.ts gives.
create function public.clan_nz_day(at timestamptz default now())
returns integer
language sql
stable
set search_path = ''
as $$ select ((at at time zone 'Pacific/Auckland')::date - date '1970-01-01')::integer $$;

-- The midnight job. It runs once for each New Zealand day (twice a night is asked for, to follow daylight saving; the
-- second finds the day already done and stops). For every clan that has not been opened today it does exactly what
-- the server does when it next opens a clan on a new day (shared/clans/actions.ts, catchUp): everyone healed and
-- awake, the Church's free wake-up back, the empire's energy and raids reset, the day's fights back, and the clan's
-- day moved to today's number. Because the clan's day is moved, the server then finds nothing left to do: no clan is
-- rested twice. A clan in the middle of a fight is left alone and rests when its fight is over. Then it writes
-- yesterday's news (counts only), and tidies old rows. `for_day` is for the tests.
-- There are no computer clans yet (the computer kingdoms have no day of their own); this is where they will go.
create function public.clan_nightly(for_day integer default null)
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

  update public.clan_daily_runs set rested = coalesce(cardinality(rested_players), 0) where nz_day = today;

  -- Tidying.
  delete from public.clan_news where nz_date < yesterday - 30;
  delete from public.clan_fight_log where nz_date < yesterday - 60;
  delete from public.clan_daily_runs where nz_day < today - 60;
  delete from public.clan_requests where created_at < now() - interval '2 days';

  return jsonb_build_object('ran', true, 'day', today, 'rested', coalesce(cardinality(rested_players), 0));
end;
$$;

-- Midnight in New Zealand is 11:00 UTC in summer time and 12:00 UTC in winter time. Both are asked for; whichever
-- one is the real midnight does the day, and the other finds it already done.
select cron.schedule('clans-midnight-summer', '0 11 * * *', $$select public.clan_nightly()$$);
select cron.schedule('clans-midnight-winter', '0 12 * * *', $$select public.clan_nightly()$$);

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.teacher_set_clans(boolean), public.teacher_clan_info(uuid),
  public.clan_fights_per_day(), public.clan_nz_day(timestamptz), public.clan_nightly(integer)
from public, anon, authenticated;
grant execute on function public.teacher_set_clans(boolean), public.teacher_clan_info(uuid) to authenticated;
-- load_clan and save_clan were replaced in place, so their earlier grants (the server only) still stand.
