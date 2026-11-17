-- Weekly class quests, stage 2 (docs/CLASS-QUESTS-PLAN.md, James 18 Nov 2026): two quests for every complex and easy maths
-- game, 27 new kinds. They reward playing more, never winning: a small amount on 5 of 7 days ('days'), a weekly total on any
-- days ('total'), or a number of different things ('distinct': planets, villagers).
--
--   1. quest_kinds gains rule, measure and amount; the 27 new kinds
--   2. quest_tallies (how much of a measure a player did on a NZ day) and quest_marks (which different things)
--   3. quest_add(): the one way watchers count, then the win check
--   4. quest_progress() and a general quest_win_check() for every rule (stage 1's 'turns' quests work as before)
--   5. Watchers on each game's own table (the games' code is not changed; a watcher error never loses a save)
--   6. my_class_quest() and teacher_class_quests() answer with the count and target too
--   7. Who can call what

-- ---------------------------------------------------------------------------
-- 1. Quest kinds
-- ---------------------------------------------------------------------------

alter table public.quest_kinds
  add column rule text not null default 'turns' check (rule in ('turns', 'days', 'total', 'distinct')),
  -- What a 'days', 'total' or 'distinct' quest counts (a quest_tallies / quest_marks measure).
  add column measure text check (measure ~ '^[a-z][a-z_]{0,31}$'),
  -- 'days': the amount on a day for it to count. 'total' and 'distinct': the week's target.
  add column amount integer check (amount between 1 and 1000),
  add constraint quest_kinds_rule_has_measure check ((rule = 'turns') = (measure is null and amount is null));

-- shared/quests/kinds.ts has the same list (names, words, art). Numbers sized from 3 weeks of real play (plan, stage 2).
insert into public.quest_kinds (id, switch_column, sort, rule, measure, amount) values
  ('trader-planets', 'trader_enabled', 11, 'distinct', 'trader_planets', 6),
  ('lord-arena', 'lord_enabled', 21, 'days', 'lord_arena', 1),
  ('clans-raids', 'clan_raids_enabled', 31, 'total', 'clan_raids', 6),
  ('kingdom-years', 'kingdom_enabled', 40, 'days', 'kingdom_years', 1),
  ('kingdom-reigns', 'kingdom_enabled', 41, 'total', 'kingdom_reigns', 2),
  ('monsters-battles', 'monsters_enabled', 50, 'days', 'monster_battles', 3),
  ('monsters-catches', 'monsters_enabled', 51, 'total', 'monster_catches', 3),
  ('archery-fights', 'archery_enabled', 60, 'days', 'archery_fights', 1),
  ('archery-sets', 'archery_enabled', 61, 'total', 'archery_sets', 6),
  ('bond-daily', 'bond_match_enabled', 70, 'days', 'bond_matches', 2),
  ('bond-total', 'bond_match_enabled', 71, 'total', 'bond_matches', 10),
  ('decree-cards', 'decree_enabled', 80, 'days', 'decree_cards', 10),
  ('decree-villagers', 'decree_enabled', 81, 'distinct', 'decree_villagers', 6),
  ('diamond-daily', 'diamond_enabled', 90, 'days', 'diamond_levels', 1),
  ('diamond-total', 'diamond_enabled', 91, 'total', 'diamond_levels', 10),
  ('gemkeep-daily', null, 100, 'days', 'gemkeep_levels', 1),
  ('gemkeep-total', null, 101, 'total', 'gemkeep_levels', 6),
  ('isles-turns', 'isles_enabled', 110, 'days', 'isles_turns', 6),
  ('isles-races', 'isles_enabled', 111, 'total', 'isles_races', 6),
  ('marble-daily', null, 120, 'days', 'marble_runs', 2),
  ('marble-total', null, 121, 'total', 'marble_runs', 12),
  ('mine-daily', 'mine_enabled', 130, 'days', 'mine_runs', 2),
  ('mine-total', 'mine_enabled', 131, 'total', 'mine_runs', 10),
  ('space-games', null, 140, 'days', 'space_games', 1),
  ('space-wormholes', null, 141, 'total', 'space_wormholes', 10),
  ('toonflap-daily', 'toonflap_enabled', 150, 'days', 'toonflap_runs', 3),
  ('toonflap-total', 'toonflap_enabled', 151, 'total', 'toonflap_runs', 15);

-- ---------------------------------------------------------------------------
-- 2. Tallies
-- ---------------------------------------------------------------------------

-- How much of a measure a player did on a New Zealand day. Written only through quest_add.
create table public.quest_tallies (
  player uuid not null references public.profiles (id) on delete cascade,
  measure text not null check (measure ~ '^[a-z][a-z_]{0,31}$'),
  day date not null,
  n integer not null default 0 check (n >= 0),
  primary key (player, measure, day)
);
alter table public.quest_tallies enable row level security;

-- The different things counted for a 'distinct' quest (a planet's number, a villager's id), on the day first seen.
create table public.quest_marks (
  player uuid not null references public.profiles (id) on delete cascade,
  measure text not null check (measure ~ '^[a-z][a-z_]{0,31}$'),
  day date not null,
  key text not null check (length(key) between 1 and 60),
  primary key (player, measure, day, key)
);
alter table public.quest_marks enable row level security;

comment on table public.quest_tallies is 'Weekly class quests: how much a pupil played of each measure on a day. Kept through New Season.';
comment on table public.quest_marks is 'Weekly class quests: different things a pupil reached on a day (planets, villagers).';

-- ---------------------------------------------------------------------------
-- 3. Counting
-- ---------------------------------------------------------------------------

create function public.quest_classes_running(who uuid, on_day date)
returns setof public.class_quests
language sql
stable
security definer
set search_path = ''
as $$
  select cq.* from public.class_quests cq
  where cq.class_id in (select public.quest_classes_of(who))
    and cq.stopped_at is null and on_day between cq.starts_on and cq.ends_on
$$;

-- Counts `n` of `what` for today (or the thing `key`, for a 'distinct' measure), then checks the running quests that use it.
-- Only players with a running quest that counts it are written, so nothing is kept when no class is questing.
create function public.quest_add(who uuid, what text, n integer default 1, key text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := public.nz_day(now());
  k text;
begin
  if who is null or coalesce(n, 0) <= 0 then
    return;
  end if;
  if not exists (select 1 from public.quest_classes_running(who, today) cq
                 join public.quest_kinds qk on qk.id = cq.kind where qk.measure = what) then
    return;
  end if;
  if key is null then
    insert into public.quest_tallies (player, measure, day, n) values (who, what, today, n)
    on conflict (player, measure, day) do update set n = public.quest_tallies.n + excluded.n;
  else
    insert into public.quest_marks (player, measure, day, key) values (who, what, today, left(key, 60))
    on conflict do nothing;
  end if;
  for k in select distinct cq.kind from public.quest_classes_running(who, today) cq
           join public.quest_kinds qk on qk.id = cq.kind where qk.measure = what loop
    perform public.quest_win_check(who, k, today);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Progress and wins, for every rule
-- ---------------------------------------------------------------------------

-- A player's progress in a quest: the days to light on the bar, the count so far and the target.
--   turns:    days they used all their turns; count = those days; target = days_needed
--   days:     days the tally reached the amount; count = those days; target = days_needed
--   total:    days they played it; count = the week's tally; target = amount
--   distinct: days they reached something new; count = different things; target = amount
create function public.quest_progress(who uuid, quest uuid)
returns table (days date[], count integer, target integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  q public.class_quests;
  k public.quest_kinds;
begin
  select * into q from public.class_quests x where x.id = quest;
  if not found then
    return;
  end if;
  select * into k from public.quest_kinds x where x.id = q.kind;
  if k.rule = 'turns' then
    return query select coalesce(array_agg(d.day order by d.day), '{}'), count(*)::integer, q.days_needed
      from public.quest_days d where d.player = who and d.kind = q.kind and d.day between q.starts_on and q.ends_on;
  elsif k.rule = 'days' then
    return query select coalesce(array_agg(t.day order by t.day), '{}'), count(*)::integer, q.days_needed
      from public.quest_tallies t
      where t.player = who and t.measure = k.measure and t.n >= k.amount and t.day between q.starts_on and q.ends_on;
  elsif k.rule = 'total' then
    return query select coalesce(array_agg(t.day order by t.day) filter (where t.n > 0), '{}'), coalesce(sum(t.n), 0)::integer, k.amount
      from public.quest_tallies t where t.player = who and t.measure = k.measure and t.day between q.starts_on and q.ends_on;
  else
    return query select coalesce((select array_agg(distinct m.day order by m.day) from public.quest_marks m
                                  where m.player = who and m.measure = k.measure and m.day between q.starts_on and q.ends_on), '{}'),
                        (select count(distinct m.key)::integer from public.quest_marks m
                         where m.player = who and m.measure = k.measure and m.day between q.starts_on and q.ends_on),
                        k.amount;
  end if;
end;
$$;

-- Replaces stage 1's: writes the win for every running quest of kind `which` in the player's classes that `on_day` is part of,
-- once their progress reaches the target.
create or replace function public.quest_win_check(who uuid, which text, on_day date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.class_quests;
  p record;
  added integer;
begin
  for q in select * from public.quest_classes_running(who, on_day) cq where cq.kind = which loop
    select * into p from public.quest_progress(who, q.id);
    if p.count >= p.target then
      insert into public.quest_wins (quest, player, kind) values (q.id, who, q.kind) on conflict do nothing;
      get diagnostics added = row_count;
      if added > 0 then
        perform public.quest_won(who);
      end if;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. The game watchers
-- ---------------------------------------------------------------------------

-- Star Trader: landing at a planet (the ship's location changes).
create function public.trader_quest_tally()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.game -> 't' ->> 'location') is not null
     and (tg_op = 'INSERT' or (old.game -> 't' ->> 'location') is distinct from (new.game -> 't' ->> 'location')) then
    perform public.quest_add(new.player, 'trader_planets', 1, new.game -> 't' ->> 'location');
  end if;
  return null;
exception when others then
  raise warning 'a Star Trader quest tally failed (%)', sqlstate;
  return null;
end;
$$;
create trigger quest_tally_when_saved after insert or update of game on public.trader_games
for each row execute function public.trader_quest_tally();

-- Dragon Maths: arena fights used (arenaLeft goes down; a new day starts from 3, ARENA_FIGHTS_PER_DAY in shared/lord/data.ts).
create function public.lord_quest_tally()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  before integer;
  used integer;
begin
  -- Worked out inside the block, so a bad value is only a warning, never a lost save.
  before := case when tg_op = 'INSERT' or (old.hero ->> 'day') is distinct from (new.hero ->> 'day') then 3
                 else coalesce((old.hero ->> 'arenaLeft')::integer, 0) end;
  used := before - coalesce((new.hero ->> 'arenaLeft')::integer, before);
  if used > 0 then
    perform public.quest_add(new.player, 'lord_arena', used);
  end if;
  return null;
exception when others then
  raise warning 'a Dragon Maths quest tally failed (%)', sqlstate;
  return null;
end;
$$;
create trigger quest_tally_when_saved after insert or update of hero on public.lord_heroes
for each row execute function public.lord_quest_tally();

-- Clan Quest: village raids (the raider's empire counts raidsToday; it starts again from 0 on a new clan day).
create function public.clans_quest_tally()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  before integer;
  raided integer;
begin
  before := case when tg_op = 'INSERT' or (old.empire ->> 'day') is distinct from (new.empire ->> 'day') then 0
                 else coalesce((old.empire ->> 'raidsToday')::integer, 0) end;
  raided := coalesce((new.empire ->> 'raidsToday')::integer, 0) - before;
  if raided > 0 then
    perform public.quest_add(new.player, 'clan_raids', raided);
  end if;
  return null;
exception when others then
  raise warning 'a Clan Quest quest tally failed (%)', sqlstate;
  return null;
end;
$$;
create trigger quest_tally_when_saved after insert or update of empire on public.clan_empires
for each row execute function public.clans_quest_tally();

-- Kingdom Keeper: years turned, and reigns finished (done or ended, not left).
create function public.kingdom_quest_tally()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.turned > coalesce(old.turned, 0) then
    perform public.quest_add(new.player, 'kingdom_years', new.turned - coalesce(old.turned, 0));
  end if;
  if new.status in ('done', 'ended') and old.status = 'playing' then
    perform public.quest_add(new.player, 'kingdom_reigns', 1);
  end if;
  return null;
exception when others then
  raise warning 'a Kingdom Keeper quest tally failed (%)', sqlstate;
  return null;
end;
$$;
create trigger quest_tally_when_saved after update of turned, status on public.kingdom_reigns
for each row execute function public.kingdom_quest_tally();

-- Maths Monsters: each saved batch of battles, and its catches.
create function public.monsters_quest_tally()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.quest_add(new.player, 'monster_battles', coalesce(new.counted_battles, 0));
  perform public.quest_add(new.player, 'monster_catches', coalesce(new.catches, 0));
  return null;
exception when others then
  raise warning 'a Maths Monsters quest tally failed (%)', sqlstate;
  return null;
end;
$$;
create trigger quest_tally_when_saved after insert on public.monster_events
for each row execute function public.monsters_quest_tally();

-- Archery Challenge: a bot fight finished (win or lose), and a maths set with every question answered.
create function public.archery_fight_quest_tally()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.finished_at is not null and old.finished_at is null then
    perform public.quest_add(new.player, 'archery_fights', 1);
  end if;
  return null;
exception when others then
  raise warning 'an Archery quest tally failed (%)', sqlstate;
  return null;
end;
$$;
create trigger quest_tally_when_saved after update of finished_at on public.archery_fights
for each row execute function public.archery_fight_quest_tally();

create function public.archery_set_quest_tally()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  asked integer;
  was integer;
  now_ integer;
begin
  asked := jsonb_array_length(new.questions);
  was := (select count(*) from jsonb_object_keys(old.answered));
  now_ := (select count(*) from jsonb_object_keys(new.answered));
  if asked > 0 and was < asked and now_ >= asked then
    perform public.quest_add(new.player, 'archery_sets', 1);
  end if;
  return null;
exception when others then
  raise warning 'an Archery quest tally failed (%)', sqlstate;
  return null;
end;
$$;
create trigger quest_tally_when_saved after update of answered on public.archery_rounds
for each row execute function public.archery_set_quest_tally();

-- Royal Decree: cards decided (moves saved), and villagers met (the reign's 'met' list).
create function public.decree_quest_tally()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v text;
begin
  if jsonb_array_length(new.moves) > coalesce(jsonb_array_length(old.moves), 0) then
    perform public.quest_add(new.player, 'decree_cards', jsonb_array_length(new.moves) - coalesce(jsonb_array_length(old.moves), 0));
  end if;
  for v in select m from jsonb_array_elements_text(coalesce(new.reign -> 'met', '[]')) m
           except select m from jsonb_array_elements_text(coalesce(case when tg_op = 'UPDATE' then old.reign -> 'met' end, '[]')) m loop
    perform public.quest_add(new.player, 'decree_villagers', 1, v);
  end loop;
  return null;
exception when others then
  raise warning 'a Royal Decree quest tally failed (%)', sqlstate;
  return null;
end;
$$;
create trigger quest_tally_when_saved after insert or update of moves, reign on public.decree_reigns
for each row execute function public.decree_quest_tally();

-- Diamond Drop: a level go ended (replays count).
create function public.diamond_quest_tally()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.ended_at is not null and (tg_op = 'INSERT' or old.ended_at is null) then
    perform public.quest_add(new.player, 'diamond_levels', 1);
  end if;
  return null;
exception when others then
  raise warning 'a Diamond Drop quest tally failed (%)', sqlstate;
  return null;
end;
$$;
create trigger quest_tally_when_saved after insert or update of ended_at on public.diamond_levels
for each row execute function public.diamond_quest_tally();

-- Toon Flap: a run finished.
create function public.toonflap_quest_tally()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.finished_at is not null and (tg_op = 'INSERT' or old.finished_at is null) then
    perform public.quest_add(new.player, 'toonflap_runs', 1);
  end if;
  return null;
exception when others then
  raise warning 'a Toon Flap quest tally failed (%)', sqlstate;
  return null;
end;
$$;
create trigger quest_tally_when_saved after insert or update of finished_at on public.toonflap_runs
for each row execute function public.toonflap_quest_tally();

-- The games that save one row per go: Bond Match, Gem Keep, Sky Isles turns and races, Marble Rush, Mine Runner.
-- The measure is the trigger's argument.
create function public.quest_tally_per_row()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.quest_add(new.player, tg_argv[0], 1);
  return null;
exception when others then
  raise warning 'a quest tally failed (%, %)', tg_argv[0], sqlstate;
  return null;
end;
$$;
create trigger quest_tally_when_saved after insert on public.bond_match_games
for each row execute function public.quest_tally_per_row('bond_matches');
create trigger quest_tally_when_saved after insert on public.gem_keep_runs
for each row execute function public.quest_tally_per_row('gemkeep_levels');
create trigger quest_tally_when_saved after insert on public.isles_turns
for each row execute function public.quest_tally_per_row('isles_turns');
create trigger quest_tally_when_saved after insert on public.isles_races
for each row execute function public.quest_tally_per_row('isles_races');
create trigger quest_tally_when_saved after insert on public.marble_runs
for each row execute function public.quest_tally_per_row('marble_runs');
create trigger quest_tally_when_saved after insert on public.mine_runs
for each row execute function public.quest_tally_per_row('mine_runs');

-- Wormholes & Black Holes: a finished game (bots or classmates) in scored_games, and the wormholes ridden in it.
create function public.space_quest_tally()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.game = 'space' then
    perform public.quest_add(new.player, 'space_games', 1);
    perform public.quest_add(new.player, 'space_wormholes', coalesce((new.space ->> 'wormholes')::integer, 0));
  end if;
  return null;
exception when others then
  raise warning 'a Wormholes quest tally failed (%)', sqlstate;
  return null;
end;
$$;
create trigger quest_tally_when_scored after insert on public.scored_games
for each row execute function public.space_quest_tally();

-- ---------------------------------------------------------------------------
-- 6. Reads: now with the count and target
-- ---------------------------------------------------------------------------

-- As stage 1, plus 'rule', 'count' and 'target'. 'days' are the days to light: done days for a turns or days quest, played
-- days for a total or distinct quest.
create or replace function public.my_class_quest()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id where public.is_school_user()),
  t as (select public.nz_day(now()) as today),
  q as (
    select cq.* from public.class_quests cq, me, t
    where cq.class_id in (select public.quest_classes_of(me.id))
      and cq.stopped_at is null and cq.starts_on <= t.today and cq.ends_on >= t.today - 2
    order by cq.starts_on desc, cq.started_at desc
    limit 1)
  select jsonb_build_object(
    'quest', jsonb_build_object('id', q.id, 'kind', q.kind, 'startsOn', q.starts_on, 'endsOn', q.ends_on, 'daysNeeded', q.days_needed,
                                'rule', k.rule),
    'today', t.today,
    'days', to_jsonb(p.days),
    'count', p.count,
    'target', p.target,
    'won', exists (select 1 from public.quest_wins w where w.quest = q.id and w.player = me.id),
    'classWon', (select count(*) from public.quest_wins w where w.quest = q.id),
    'questsDone', (select count(*) from public.quest_wins w where w.player = me.id))
  from q join public.quest_kinds k on k.id = q.kind, me, t, lateral public.quest_progress(me.id, q.id) p
$$;

create or replace function public.teacher_class_quests(target_class uuid, which uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  shown public.class_quests;
  settings jsonb;
begin
  perform public.require_teacher();
  if target_class is null or not public.teaches_class(target_class, true) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  select * into shown from public.class_quests cq
  where cq.class_id = target_class and (which is null or cq.id = which)
  order by cq.starts_on desc, cq.started_at desc limit 1;
  select to_jsonb(s) into settings from public.app_settings s where s.class_id = target_class;

  return jsonb_build_object(
    'today', public.nz_day(now()),
    -- A kind with no switch is always on; null (not known) when the class has no settings row of its own.
    'switches', (select coalesce(jsonb_object_agg(k.id, case when k.switch_column is null then true
                                                             else (settings ->> k.switch_column)::boolean end), '{}'::jsonb)
                 from public.quest_kinds k),
    'quests', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', cq.id, 'kind', cq.kind, 'startsOn', cq.starts_on, 'endsOn', cq.ends_on, 'stoppedAt', cq.stopped_at,
                 'won', (select count(*) from public.quest_wins w where w.quest = cq.id))
               order by cq.starts_on desc, cq.started_at desc)
               from (select * from public.class_quests x where x.class_id = target_class
                     order by x.starts_on desc, x.started_at desc limit 30) cq), '[]'::jsonb),
    'shown', shown.id,
    'pupils', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', m.id,
                 'teacher', m.teacher,
                 'name', case when m.teacher then p.display_name end,
                 'days', coalesce(to_jsonb(pr.days), '[]'::jsonb),
                 'count', coalesce(pr.count, 0),
                 'target', pr.target,
                 'won', shown.id is not null and exists (select 1 from public.quest_wins w where w.quest = shown.id and w.player = m.id),
                 'questsDone', (select count(*) from public.quest_wins w where w.player = m.id)) order by m.teacher)
               from (select cm.student_id as id, false as teacher from public.class_members cm where cm.class_id = target_class
                     union
                     select ct.teacher_id, true from public.class_teachers ct where ct.class_id = target_class) m
               join public.profiles p on p.id = m.id and p.role = case when m.teacher then 'teacher' else 'student' end
               left join lateral public.quest_progress(m.id, shown.id) pr on true), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.quest_classes_running(uuid, date), public.quest_add(uuid, text, integer, text), public.quest_progress(uuid, uuid),
  public.quest_win_check(uuid, text, date),
  public.trader_quest_tally(), public.lord_quest_tally(), public.clans_quest_tally(), public.kingdom_quest_tally(),
  public.monsters_quest_tally(), public.archery_fight_quest_tally(), public.archery_set_quest_tally(), public.decree_quest_tally(),
  public.diamond_quest_tally(), public.toonflap_quest_tally(), public.quest_tally_per_row(), public.space_quest_tally()
from public, anon, authenticated;

grant execute on function public.my_class_quest(), public.teacher_class_quests(uuid, uuid) to authenticated;
