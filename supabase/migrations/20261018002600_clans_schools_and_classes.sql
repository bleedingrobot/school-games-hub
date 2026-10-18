-- Maths focus, stage F.2 (part 4): Clan Quest and Training, made to fit schools and classes.
--
-- Clan Quest and Training were built after F.2 was written, so none of this was in F.2's first three migrations. This file
-- goes after them (and after Training's 20261018002200) and does for Clan Quest what F.2 did for Dragon Maths:
--
-- 1. Settings. The switches and maths settings of Clan Quest (on/off, raids, year band, topics, tables, fights a day, fame season)
--    live in app_settings, which now has one row per school and one per class. Everything that read "the" row now reads the
--    row of the right player (settings_of), and the teacher's buttons change the classes they teach (or the one they name).
-- 2. Villages belong to a school. Each school has its own "Everyone else" village (Douglas Park's is village 1, as before), a
--    teacher's groups belong to their school, and a pupil can only be moved into a group of their own school. Raids, votes,
--    chests and news therefore never cross a school.
-- 3. Village news and the Mines log belong to a school; the midnight job writes each school's "fights won" lines on its own.
-- 4. The scoreboard shows this school's clans only. Teacher reads (a clan, a pupil's maths, Training) need the pupil to be in one of
--    the teacher's classes (a school admin: anyone in the school).
--
-- Nothing here is applied until James says so.

-- ---------------------------------------------------------------------------
-- 1. Villages, news and the Mines log belong to a school
-- ---------------------------------------------------------------------------

alter table public.clan_villages add column school_id integer references public.schools (id) on delete cascade;
update public.clan_villages set school_id = 1;
alter table public.clan_villages alter column school_id set not null;
drop index public.clan_villages_one_default;
create unique index clan_villages_one_default on public.clan_villages (school_id) where is_default;
create index clan_villages_school on public.clan_villages (school_id);

-- Every other school that already exists gets its own default village now; later schools get one when they are made.
insert into public.clan_villages (name, is_default, closed_week, school_id)
select 'Everyone else', true, public.clan_nz_week() - 1, s.id
from public.schools s
where not exists (select 1 from public.clan_villages v where v.school_id = s.id and v.is_default);

create function public.give_school_village()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.clan_villages (name, is_default, closed_week, school_id)
  values ('Everyone else', true, public.clan_nz_week() - 1, new.id);
  return new;
end;
$$;
create trigger give_school_village after insert on public.schools
for each row execute function public.give_school_village();

-- A pupil's village: the group the teacher moved them to, otherwise their school's "Everyone else".
create or replace function public.clan_village_of(who uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select m.village_id from public.clan_village_members m where m.player = who),
    (select v.id from public.clan_villages v join public.profiles p on p.school_id = v.school_id where p.id = who and v.is_default))
$$;

alter table public.clan_news add column school_id integer references public.schools (id) on delete cascade;
update public.clan_news n set school_id = coalesce((select v.school_id from public.clan_villages v where v.id = n.village_id), 1);
alter table public.clan_news alter column school_id set not null;
create index clan_news_school on public.clan_news (school_id, id);

-- A line for a village belongs to that village's school, so the functions that write village news need no change.
create function public.clan_news_school()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.school_id is null then
    new.school_id := (select v.school_id from public.clan_villages v where v.id = new.village_id);
  end if;
  return new;
end;
$$;
create trigger clan_news_school before insert on public.clan_news
for each row execute function public.clan_news_school();

alter table public.clan_fight_log add column school_id integer references public.schools (id) on delete cascade;
update public.clan_fight_log set school_id = 1;
alter table public.clan_fight_log alter column school_id set not null;
create index clan_fight_log_school on public.clan_fight_log (school_id, nz_date);

-- ---------------------------------------------------------------------------
-- 2. Settings: the row that applies to the player
-- ---------------------------------------------------------------------------

drop function public.clans_settings();

create function public.clans_settings(player uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'enabledTopics', to_jsonb(s.clans_topics), 'yearBand', s.clans_year_band,
    'enabledTables', to_jsonb(s.clans_tables), 'fightsPerDay', s.clans_fights_per_day, 'season', s.clans_season)
  from public.settings_of(coalesce(player, auth.uid())) s
$$;

drop function public.clan_fights_per_day();

create function public.clan_fights_per_day(player uuid default null)
returns integer
language sql
stable
security definer
set search_path = ''
as $$ select coalesce((select s.clans_fights_per_day from public.settings_of(coalesce(player, auth.uid())) s), 8) $$;

create or replace function public.clan_extras(player uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'settings', public.clans_settings(clan_extras.player),
    'fame', coalesce((select c.fame from public.clans c where c.player = clan_extras.player), 0),
    'achievements', coalesce((
      select jsonb_agg(a.achievement order by a.achievement) from public.achievements a
      join public.achievement_types t on t.id = a.achievement
      where a.player = clan_extras.player and t.game = 'clan-quest'), '[]'))
$$;

drop function public.teacher_set_clans(boolean);

create function public.teacher_set_clans(enabled boolean, target_class uuid default null)
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
  update public.app_settings set clans_enabled = enabled where id in (select public.settings_to_change(target_class));
  return enabled;
end;
$$;

drop function public.teacher_set_clan_raids(boolean);

create function public.teacher_set_clan_raids(enabled boolean, target_class uuid default null)
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
  update public.app_settings set clan_raids_enabled = enabled where id in (select public.settings_to_change(target_class));
  return enabled;
end;
$$;

-- `settings` = { yearBand?: 4|5|6, enabledTopics?: [...], enabledTables?: [1-12...], fightsPerDay?: 1-30 }. Leave a key out to keep it
-- (in each class that is changed). At least one topic and one table stay on. An open fight keeps the settings it started with.
drop function public.teacher_set_clan_maths(jsonb);

create function public.teacher_set_clan_maths(settings jsonb, target_class uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  band integer;
  topics text[];
  tables integer[];
  per_day integer;
begin
  perform public.require_teacher();
  if jsonb_typeof(settings) is distinct from 'object' then
    raise exception 'Those settings couldn''t be read.' using errcode = '22023';
  end if;
  if settings ? 'yearBand' then
    if jsonb_typeof(settings -> 'yearBand') is distinct from 'number' or (settings ->> 'yearBand')::numeric not in (4, 5, 6) then
      raise exception 'The year band must be 4, 5 or 6.' using errcode = '22023';
    end if;
    band := (settings ->> 'yearBand')::integer;
  end if;
  if settings ? 'enabledTopics' then
    if jsonb_typeof(settings -> 'enabledTopics') is distinct from 'array' then
      raise exception 'Those topics couldn''t be read.' using errcode = '22023';
    end if;
    select coalesce(array_agg(distinct t order by t), '{}') into topics from jsonb_array_elements_text(settings -> 'enabledTopics') as t;
    if cardinality(topics) <> jsonb_array_length(settings -> 'enabledTopics')
       or not topics <@ '{times,percentages,money,area,division,ratios,rates,integers}' then
      raise exception 'Those topics couldn''t be read.' using errcode = '22023';
    end if;
    if cardinality(topics) = 0 then
      raise exception 'Leave at least one topic on.' using errcode = '22023';
    end if;
  end if;
  if settings ? 'enabledTables' then
    if jsonb_typeof(settings -> 'enabledTables') is distinct from 'array'
       or exists (select 1 from jsonb_array_elements(settings -> 'enabledTables') e where jsonb_typeof(e) <> 'number' or (e #>> '{}')::numeric <> trunc((e #>> '{}')::numeric)) then
      raise exception 'Those times tables couldn''t be read.' using errcode = '22023';
    end if;
    select coalesce(array_agg(distinct (e #>> '{}')::integer order by (e #>> '{}')::integer), '{}') into tables
    from jsonb_array_elements(settings -> 'enabledTables') e;
    if cardinality(tables) = 0 or not tables <@ '{1,2,3,4,5,6,7,8,9,10,11,12}' then
      raise exception 'Choose at least one times table, from 1 to 12.' using errcode = '22023';
    end if;
  end if;
  if settings ? 'fightsPerDay' then
    if jsonb_typeof(settings -> 'fightsPerDay') is distinct from 'number'
       or (settings ->> 'fightsPerDay')::numeric <> trunc((settings ->> 'fightsPerDay')::numeric)
       or (settings ->> 'fightsPerDay')::numeric not between 1 and 30 then
      raise exception 'Mine fights a day must be a whole number from 1 to 30.' using errcode = '22023';
    end if;
    per_day := (settings ->> 'fightsPerDay')::integer;
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings set
    clans_year_band = coalesce(band, clans_year_band),
    clans_topics = coalesce(topics, clans_topics),
    clans_tables = coalesce(tables, clans_tables),
    clans_fights_per_day = coalesce(per_day, clans_fights_per_day)
  where id in (select public.settings_to_change(target_class));
  return public.clans_settings();
end;
$$;

-- A new fame season for the classes that are changed: their clans' fame goes to 0 and their season number goes up by one. Clans,
-- levels, gold, empires, points and achievements stay. Type NEW SEASON to confirm.
drop function public.teacher_clans_new_season(text);

create function public.teacher_clans_new_season(confirm text, target_class uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
  season integer;
begin
  perform public.require_teacher();
  if confirm is distinct from 'NEW SEASON' then
    raise exception 'Type NEW SEASON to start a new season.' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.clans set fame = 0
  where public.settings_id_of(player) in (select public.settings_to_change(target_class));
  get diagnostics n = row_count;
  with bumped as (
    update public.app_settings set clans_season = clans_season + 1
    where id in (select public.settings_to_change(target_class))
    returning clans_season
  )
  select max(b.clans_season) into season from bumped b;
  return jsonb_build_object('season', season, 'clans', n);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Loading, saving, raids and the midnight job (the same as before, reading the right settings and school)
-- ---------------------------------------------------------------------------

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
        'depth', f.depth, 'boss', f.boss, 'seed', f.seed, 'no', f.no, 'settings', f.settings, 'rounds', f.rounds) end));
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

create or replace function public.save_raid(
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
  if not (select s.clan_raids_enabled from public.settings_of(a.player) s) then
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
  sid integer;
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
      empire = e.empire || jsonb_build_object('day', moved.day, 'energyUsed', 0, 'raidsToday', 0, 'kingdomRaidsToday', 0, 'raidedToday', '[]'::jsonb)
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
-- 4. Teachers: villages and reads stay inside the school and the teacher's classes
-- ---------------------------------------------------------------------------

create or replace function public.teacher_reset_clan(student uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  had boolean;
begin
  perform public.require_teacher_of(student);
  delete from public.clans c where c.player = student;
  had := found;
  delete from public.clan_requests r where r.player = student;
  delete from public.clan_seeds s where s.player = student;
  return had;
end;
$$;

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
    'lastPlayed', c.updated_at);
end;
$$;

-- Villages of this school, and the pupils the teacher may see (their classes; a school admin: the school).
create or replace function public.teacher_villages()
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
      'pupils', (select count(*) from public.profiles p where p.role = 'student' and p.school_id = v.school_id and public.clan_village_of(p.id) = v.id)) order by v.id)
      from public.clan_villages v where v.school_id = public.my_school()), '[]'),
    'pupils', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'village', public.clan_village_of(p.id)) order by p.display_name)
      from public.profiles p where p.id in (select public.my_students())), '[]'));
end;
$$;

create or replace function public.teacher_create_village(new_name text)
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
  if (select count(*) from public.clan_villages v where v.school_id = public.my_school()) >= 40 then
    raise exception 'That is plenty of groups.' using errcode = '22023';
  end if;
  insert into public.clan_villages (name, closed_week, school_id)
  values (trim(new_name), public.clan_nz_week() - 1, public.my_school()) returning id into made;
  return made;
end;
$$;

create or replace function public.teacher_rename_village(village bigint, new_name text)
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
  update public.clan_villages v set name = trim(new_name) where v.id = village and v.school_id = public.my_school();
end;
$$;

create or replace function public.teacher_delete_village(village bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  delete from public.clan_villages v where v.id = village and not v.is_default and v.school_id = public.my_school();
  return found;
end;
$$;

create or replace function public.teacher_move_pupil(student uuid, village bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old bigint := public.clan_village_of(student);
begin
  perform public.require_teacher_of(student);
  if not exists (select 1 from public.profiles p where p.id = student and p.role = 'student') then
    raise exception 'No such pupil.' using errcode = '22023';
  end if;
  if village is not null and not exists (select 1 from public.clan_villages v where v.id = village and v.school_id = public.my_school()) then
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

-- The scoreboard: this school's clans only.
create or replace function public.clan_scoreboard()
returns table (
  place integer,
  clan_name text,
  fame integer,
  is_me boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_school_user() then
    return;
  end if;
  return query
  with base as (
    select c.player as who, c.name as clan, c.fame as points, c.created_at as born
    from public.clans c join public.profiles p on p.id = c.player
    where not p.hidden and p.school_id = public.my_school()
  ),
  placed as (
    select b.*,
           rank() over (order by b.points desc)::integer as pl,
           row_number() over (order by b.points desc, b.born, b.clan, b.who) as row_order
    from base b
  )
  select x.pl, x.clan, x.points, x.who = auth.uid()
  from placed x
  where (x.row_order <= 10 and x.points > 0) or x.who = auth.uid()
  order by x.row_order;
end;
$$;

-- Across the teacher's pupils (a school admin: the school).
create or replace function public.teacher_clan_maths_class()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  return (
    with facts as (
      select f.player, f.fact_key, f.attempts, f.correct
      from public.gem_keep_facts f join public.profiles p on p.id = f.player
      where f.pack = 'clan-quest' and p.role = 'student' and f.attempts > 0
        and p.id in (select public.my_students())
    )
    select jsonb_build_object(
      'players', (select count(distinct x.player) from facts x),
      'kinds', (select coalesce(jsonb_agg(jsonb_build_object(
          'key', y.fact_key, 'students', y.students, 'attempts', y.attempts, 'correct', y.correct) order by y.fact_key), '[]')
        from (select x.fact_key, count(*) as students, sum(x.attempts) as attempts, sum(x.correct) as correct
              from facts x group by x.fact_key) y),
      'hardest', (select coalesce(jsonb_agg(jsonb_build_object(
          'key', z.fact_key, 'students', z.students, 'attempts', z.attempts, 'correct', z.correct)
          order by z.wrong_share desc, z.attempts desc), '[]')
        from (select x.fact_key, count(*) as students, sum(x.attempts) as attempts, sum(x.correct) as correct,
                     1 - sum(x.correct)::numeric / sum(x.attempts) as wrong_share
              from facts x
              group by x.fact_key
              having sum(x.attempts) >= 6 and count(*) >= 2 and sum(x.correct) < sum(x.attempts)
              order by wrong_share desc, attempts desc
              limit 12) z)
    )
  );
end;
$$;

create or replace function public.teacher_clan_maths_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return jsonb_build_object(
    'fame', (select c.fame from public.clans c where c.player = student),
    'kinds', (select coalesce(jsonb_agg(jsonb_build_object(
        'key', y.fact_key, 'attempts', y.attempts, 'correct', y.correct) order by y.wrong_share desc, y.attempts desc), '[]')
      from (select f.fact_key, f.attempts, f.correct, 1 - f.correct::numeric / f.attempts as wrong_share
            from public.gem_keep_facts f
            where f.player = student and f.pack = 'clan-quest' and f.attempts > 0) y));
end;
$$;

-- Training: a teacher reads the training of a pupil in one of their classes.
create or replace function public.teacher_training_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return public.training_data(student);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what (functions made with a new argument list start locked)
-- ---------------------------------------------------------------------------

revoke execute on function
  public.clans_settings(uuid), public.clan_fights_per_day(uuid), public.give_school_village(), public.clan_news_school()
from public, anon, authenticated;
revoke execute on function
  public.teacher_set_clans(boolean, uuid), public.teacher_set_clan_raids(boolean, uuid),
  public.teacher_set_clan_maths(jsonb, uuid), public.teacher_clans_new_season(text, uuid)
from public, anon;
grant execute on function
  public.teacher_set_clans(boolean, uuid), public.teacher_set_clan_raids(boolean, uuid),
  public.teacher_set_clan_maths(jsonb, uuid), public.teacher_clans_new_season(text, uuid)
to authenticated;
