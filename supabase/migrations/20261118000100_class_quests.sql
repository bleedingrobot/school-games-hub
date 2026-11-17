-- Weekly class quests (docs/CLASS-QUESTS-PLAN.md, James 18 Nov 2026). A teacher starts a quest for the class; it runs 7 days
-- (the day it starts is day 1). A pupil wins it by using up all of a game's daily turns on 5 of those days.
--
--   1. quest_kinds, quest_days, class_quests, quest_wins
--   2. Watchers on each game's own table that write a quest day when the turns left drop to 0 in a save
--      (trader_games: jumps, lord_heroes: forest fights, clans: mine fights). The games' own code is not changed and a
--      watcher error never loses a save (same pattern as 20261112001700_trophies_games_1.sql).
--   3. A watcher on quest_days that writes the win when a pupil reaches the days needed, then checks achievements and the
--      Questing Hero trophy (bronze at 5 wins, silver at 10, gold at 20).
--   4. Hub hooks: the 'quests' achievements (1, 5, 10, 15, 20 quests done) and the trophy type. No points.
--   5. Reads and teacher actions: my_class_quest(), teacher_class_quests(), teacher_start_class_quest(),
--      teacher_stop_class_quest().
--   6. Who can call what.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- The kinds of quest. A new kind later is a row here, a watcher on its game's table and an entry in shared/quests/kinds.ts.
create table public.quest_kinds (
  id text primary key check (id ~ '^[a-z][a-z0-9-]{0,23}$'),
  -- The app_settings true/false column of the game it needs (the teacher sees a note while that game is off).
  switch_column text,
  sort integer not null default 0
);
alter table public.quest_kinds enable row level security;
insert into public.quest_kinds (id, switch_column, sort) values
  ('trader', 'trader_enabled', 1),
  ('lord', 'lord_enabled', 2),
  ('clans', 'clans_enabled', 3);

-- A New Zealand day on which a pupil used up all of a game's turns. Written only by the watchers below.
create table public.quest_days (
  player uuid not null references public.profiles (id) on delete cascade,
  kind text not null references public.quest_kinds (id),
  day date not null,
  done_at timestamptz not null default now(),
  primary key (player, kind, day)
);
alter table public.quest_days enable row level security;

create table public.class_quests (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  kind text not null references public.quest_kinds (id),
  starts_on date not null,
  ends_on date not null,
  days_needed integer not null default 5 check (days_needed between 1 and 7),
  started_by uuid references public.profiles (id) on delete set null,
  started_at timestamptz not null default now(),
  stopped_at timestamptz,
  check (ends_on = starts_on + 6)
);
create index class_quests_class on public.class_quests (class_id, starts_on desc);
alter table public.class_quests enable row level security;

-- A pupil's finished quest. Kept if the quest (or its class) is deleted, so the pupil's count of quests done stays true.
create table public.quest_wins (
  id bigint generated always as identity primary key,
  quest uuid references public.class_quests (id) on delete set null,
  player uuid not null references public.profiles (id) on delete cascade,
  kind text not null references public.quest_kinds (id),
  won_at timestamptz not null default now(),
  unique (quest, player)
);
create index quest_wins_player on public.quest_wins (player);
alter table public.quest_wins enable row level security;

comment on table public.quest_days is 'Days a pupil used all of a game''s turns (weekly class quests). Kept through New Season.';
comment on table public.quest_wins is 'Weekly class quests a pupil finished. Kept through New Season.';

-- ---------------------------------------------------------------------------
-- 2. The game watchers
-- ---------------------------------------------------------------------------

create function public.quest_day_done(who uuid, which text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.quest_days (player, kind, day) values (who, which, public.nz_day(now())) on conflict do nothing
$$;

-- Star Trader: the saved game's t.jumpsLeft drops to 0 (from above 0, or on a new game day: a day with one jump a day).
create function public.trader_quest_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((new.game -> 't' ->> 'jumpsLeft')::integer, 1) = 0
     and (tg_op = 'INSERT'
          or coalesce((old.game -> 't' ->> 'jumpsLeft')::integer, 0) > 0
          or (old.game -> 't' ->> 'day') is distinct from (new.game -> 't' ->> 'day')) then
    perform public.quest_day_done(new.player, 'trader');
  end if;
  return null;
exception when others then
  raise warning 'a Star Trader quest day failed (%)', sqlstate;
  return null;
end;
$$;

create trigger quest_day_when_saved
after insert or update of game on public.trader_games
for each row
execute function public.trader_quest_day();

-- Dragon Maths: the hero's forestLeft drops to 0.
create function public.lord_quest_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((new.hero ->> 'forestLeft')::integer, 1) = 0
     and (tg_op = 'INSERT'
          or coalesce((old.hero ->> 'forestLeft')::integer, 0) > 0
          or (old.hero ->> 'day') is distinct from (new.hero ->> 'day')) then
    perform public.quest_day_done(new.player, 'lord');
  end if;
  return null;
exception when others then
  raise warning 'a Dragon Maths quest day failed (%)', sqlstate;
  return null;
end;
$$;

create trigger quest_day_when_saved
after insert or update of hero on public.lord_heroes
for each row
execute function public.lord_quest_day();

-- Clan Quest: fights_left (mine fights) drops to 0.
create function public.clans_quest_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.fights_left = 0
     and (tg_op = 'INSERT' or old.fights_left > 0 or old.day is distinct from new.day) then
    perform public.quest_day_done(new.player, 'clans');
  end if;
  return null;
exception when others then
  raise warning 'a Clan Quest quest day failed (%)', sqlstate;
  return null;
end;
$$;

create trigger quest_day_when_saved
after insert or update of fights_left, day on public.clans
for each row
execute function public.clans_quest_day();

-- ---------------------------------------------------------------------------
-- 3. Winning a quest
-- ---------------------------------------------------------------------------

-- After a new win: achievements, then each Questing Hero metal reached (award_trophy gives each step once).
create function public.quest_won(who uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  total integer;
  step integer;
begin
  perform public.game_progress_changed(who, 'quests');
  select count(*) into total from public.quest_wins w where w.player = who;
  for step in 1 .. (case when total >= 20 then 3 when total >= 10 then 2 when total >= 5 then 1 else 0 end) loop
    perform public.award_trophy(who, 'quest-hero', jsonb_build_object('step', step, 'quests', total));
  end loop;
end;
$$;

-- Writes the win for every running quest of the pupil's class this day counts towards, once the days reach days_needed.
create function public.quest_win_check(who uuid, which text, on_day date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.class_quests;
  n integer;
  added integer;
begin
  for q in
    select cq.* from public.class_quests cq
    join public.class_members m on m.class_id = cq.class_id and m.student_id = who
    where cq.kind = which and cq.stopped_at is null and on_day between cq.starts_on and cq.ends_on
  loop
    select count(*) into n from public.quest_days d
    where d.player = who and d.kind = q.kind and d.day between q.starts_on and q.ends_on;
    if n >= q.days_needed then
      insert into public.quest_wins (quest, player, kind) values (q.id, who, q.kind) on conflict do nothing;
      get diagnostics added = row_count;
      if added > 0 then
        perform public.quest_won(who);
      end if;
    end if;
  end loop;
end;
$$;

create function public.quest_days_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.quest_win_check(new.player, new.kind, new.day);
  return null;
exception when others then
  raise warning 'a quest win check failed (%)', sqlstate;
  return null;
end;
$$;

create trigger quest_win_when_day_done
after insert on public.quest_days
for each row
execute function public.quest_days_check();

-- ---------------------------------------------------------------------------
-- 4. Hub hooks: achievements and the trophy
-- ---------------------------------------------------------------------------

create function public.quest_counts(who uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$ select jsonb_build_object('quests_done', (select count(*) from public.quest_wins w where w.player = who)) $$;

create function public.quest_point_rules()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'Weekly class quests: when your teacher sets one, play the quest''s game on 5 of the 7 days (using all of that day''s turns) to finish it. Quests earn achievements and the Questing Hero trophy, not points.'))
$$;

create function public.quest_players_list()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$ select distinct w.player from public.quest_wins w $$;

insert into public.hub_games (id, counts_fn, rules_fn, players_fn, keep_achievements)
values ('quests', 'public.quest_counts(uuid)', 'public.quest_point_rules()', 'public.quest_players_list()', true);

insert into public.achievement_measures (measure) values ('quests_done');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('quest-1', 'quests', 'First Quest', '🗺️', 'quests_done', 1, 1),
  ('quest-5', 'quests', 'Quest Seeker', '🧭', 'quests_done', 5, 2),
  ('quest-10', 'quests', 'Quest Knight', '🛡️', 'quests_done', 10, 3),
  ('quest-15', 'quests', 'Quest Champion', '⚔️', 'quests_done', 15, 4),
  ('quest-20', 'quests', 'Quest Legend', '👑', 'quests_done', 20, 5);

insert into public.trophy_types (id, game, name, how, kind, repeat, art, sort) values
  ('quest-hero', 'hub', 'Questing Hero', 'Finish weekly class quests: 5 for bronze, 10 for silver, 20 for gold.', 'trophy', 'steps',
   'questing-hero', 343);

-- ---------------------------------------------------------------------------
-- 5. Reads and teacher actions
-- ---------------------------------------------------------------------------

-- The pupil's class quest for the home page: the running one, or one that ended in the last 2 days. Null when there is none.
-- { quest: { id, kind, startsOn, endsOn, daysNeeded }, today, days: [dates done], won, classWon, questsDone }
-- classWon is a number only: pupils never see which classmates finished.
create function public.my_class_quest()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id where public.is_school_user()),
  t as (select public.nz_day(now()) as today),
  q as (
    select cq.* from public.class_quests cq
    join public.class_members m on m.class_id = cq.class_id
    join me on m.student_id = me.id, t
    where cq.stopped_at is null and cq.starts_on <= t.today and cq.ends_on >= t.today - 2
    order by cq.starts_on desc, cq.started_at desc
    limit 1)
  select jsonb_build_object(
    'quest', jsonb_build_object('id', q.id, 'kind', q.kind, 'startsOn', q.starts_on, 'endsOn', q.ends_on, 'daysNeeded', q.days_needed),
    'today', t.today,
    'days', coalesce((select jsonb_agg(d.day order by d.day) from public.quest_days d
                      where d.player = me.id and d.kind = q.kind and d.day between q.starts_on and q.ends_on), '[]'::jsonb),
    'won', exists (select 1 from public.quest_wins w where w.quest = q.id and w.player = me.id),
    'classWon', (select count(*) from public.quest_wins w where w.quest = q.id),
    'questsDone', (select count(*) from public.quest_wins w where w.player = me.id))
  from q, me, t
$$;

-- The home page gets it in its one answer, as 'classQuest' (same exact-text edit as 20261113000100_leaderboard_boards.sql).
do $migration$
declare
  def text := pg_get_functiondef('public.my_home_page()'::regprocedure);
  -- No line ending in the needle: the live copy of my_home_page has Windows (\r\n) line endings.
  needle text := '''topGames'', public.my_top_games(),';
begin
  if (length(def) - length(replace(def, needle, ''))) / length(needle) <> 1 then
    raise exception 'my_home_page edit did not match exactly once; nothing was changed';
  end if;
  def := replace(def, needle, '''classQuest'', public.my_class_quest(), ' || needle);
  execute def;
end;
$migration$;

-- The Quests tab. `which` picks a quest (default: the newest). Pupils are ids; the page adds names from teacher_students().
-- { today, switches: { kind: on }, quests: [{ id, kind, startsOn, endsOn, stoppedAt, won }], shown: quest id or null,
--   pupils: [{ id, days: [dates done in the shown quest], won, questsDone }] }
create function public.teacher_class_quests(target_class uuid, which uuid default null)
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
    -- null (not known) when the class has no settings row of its own: the page only warns about a game that is plainly off.
    'switches', (select coalesce(jsonb_object_agg(k.id, (settings ->> k.switch_column)::boolean), '{}'::jsonb)
                 from public.quest_kinds k),
    'quests', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', cq.id, 'kind', cq.kind, 'startsOn', cq.starts_on, 'endsOn', cq.ends_on, 'stoppedAt', cq.stopped_at,
                 'won', (select count(*) from public.quest_wins w where w.quest = cq.id))
               order by cq.starts_on desc, cq.started_at desc)
               from (select * from public.class_quests x where x.class_id = target_class
                     order by x.starts_on desc, x.started_at desc limit 30) cq), '[]'::jsonb),
    'shown', shown.id,
    'pupils', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', m.student_id,
                 'days', coalesce((select jsonb_agg(d.day order by d.day) from public.quest_days d
                                   where shown.id is not null and d.player = m.student_id and d.kind = shown.kind
                                     and d.day between shown.starts_on and shown.ends_on), '[]'::jsonb),
                 'won', shown.id is not null and exists (select 1 from public.quest_wins w where w.quest = shown.id and w.player = m.student_id),
                 'questsDone', (select count(*) from public.quest_wins w where w.player = m.student_id)))
               from public.class_members m
               join public.profiles p on p.id = m.student_id and p.role = 'student'
               where m.class_id = target_class), '[]'::jsonb));
end;
$$;

-- Starts a 7-day quest from today. One running quest per class.
create function public.teacher_start_class_quest(target_class uuid, which text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := public.nz_day(now());
  made uuid;
begin
  perform public.require_teacher();
  if target_class is null or not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.quest_kinds k where k.id = which) then
    raise exception 'There is no quest like that.' using errcode = '22023';
  end if;
  perform 1 from public.classes c where c.id = target_class for update;
  if exists (select 1 from public.class_quests cq
             where cq.class_id = target_class and cq.stopped_at is null and cq.ends_on >= today) then
    raise exception 'This class already has a quest running. Stop it first.' using errcode = '22023';
  end if;
  insert into public.class_quests (class_id, kind, starts_on, ends_on, started_by)
  values (target_class, which, today, today + 6, auth.uid())
  returning id into made;
  -- A pupil who already used all their turns earlier today gets today's day (it is already in quest_days).
  return made;
end;
$$;

-- Stops the class's running quest. Wins already made stay.
create function public.teacher_stop_class_quest(target_class uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if target_class is null or not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  update public.class_quests cq set stopped_at = now()
  where cq.class_id = target_class and cq.stopped_at is null and cq.ends_on >= public.nz_day(now());
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.quest_day_done(uuid, text), public.trader_quest_day(), public.lord_quest_day(), public.clans_quest_day(),
  public.quest_won(uuid), public.quest_win_check(uuid, text, date), public.quest_days_check(),
  public.quest_counts(uuid), public.quest_point_rules(), public.quest_players_list(),
  public.my_class_quest(), public.teacher_class_quests(uuid, uuid), public.teacher_start_class_quest(uuid, text),
  public.teacher_stop_class_quest(uuid)
from public, anon, authenticated;

grant execute on function
  public.my_class_quest(), public.teacher_class_quests(uuid, uuid), public.teacher_start_class_quest(uuid, text),
  public.teacher_stop_class_quest(uuid), public.my_home_page()
to authenticated;
