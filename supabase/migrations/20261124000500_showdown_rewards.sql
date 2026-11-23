-- Class Showdown stage 5 (docs/SHOWDOWN-PLAN.md): rewards, achievements, the class boss roster, and on for every class.
--
--   1. showdown_roster: the bosses each class has beaten, with its best time. showdown_class_roster() for the server.
--   2. showdown_stats: each pupil's totals for achievements; showdown_finished: rounds already paid (room + seed).
--   3. showdown_chest_games(): each pupil's favourite game a chest can pay into (Goblin Storm gold or Archery coins).
--   4. showdown_finish(room, done): pays a finished round once: hub points (add_game_points), the chest, the stats and
--      the roster, then checks achievements.
--   5. hub_games hooks, measures and achievements.
--   6. On for every class (Stage 4 had it on for James's class only).
-- Everything here is for the server key only. Nothing is deleted.

-- ---------------------------------------------------------------------------
-- 1. The roster
-- ---------------------------------------------------------------------------

create table public.showdown_roster (
  class_id uuid not null references public.classes (id) on delete cascade,
  boss text not null check (boss in ('river-titan', 'storm-kraken', 'clockwork-colossus', 'comet-wyrm')),
  best_ms integer not null check (best_ms >= 0),
  beaten_at timestamptz not null default now(),
  times integer not null default 1 check (times > 0),
  primary key (class_id, boss)
);
alter table public.showdown_roster enable row level security;

-- { "<boss>": best ms } for a class.
create function public.showdown_class_roster(target_class uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(r.boss, r.best_ms), '{}') from public.showdown_roster r where r.class_id = target_class
$$;

-- ---------------------------------------------------------------------------
-- 2. Pupils' totals, and rounds paid
-- ---------------------------------------------------------------------------

create table public.showdown_stats (
  player uuid primary key references public.profiles (id) on delete cascade,
  rounds integer not null default 0 check (rounds >= 0),
  bosses_beaten integer not null default 0 check (bosses_beaten >= 0),
  last_hits integer not null default 0 check (last_hits >= 0),
  shields integer not null default 0 check (shields >= 0),
  revives integer not null default 0 check (revives >= 0),
  best_streak integer not null default 0 check (best_streak >= 0),
  bosses text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.showdown_stats enable row level security;

create table public.showdown_finished (
  room bigint not null references public.showdown_rooms (id) on delete cascade,
  seed bigint not null,
  finished_at timestamptz not null default now(),
  primary key (room, seed)
);
alter table public.showdown_finished enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Where a chest goes: the pupil's own favourite (most recently played) game that has coins, if it's on for them
-- ---------------------------------------------------------------------------

create function public.showdown_chest_games(players uuid[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(p.id, (
    select g.game from (values
      ('goblinstorm', (select s.updated_at from public.goblinstorm_saves s where s.player = p.id), coalesce(st.goblinstorm_enabled, true), 1),
      ('archery', (select a.updated_at from public.archery_players a where a.player = p.id), coalesce(st.archery_enabled, false), 2)
    ) g(game, played, enabled, pref)
    order by g.enabled desc, g.played desc nulls last, g.pref
    limit 1
  )), '{}')
  from unnest(players) p(id)
  left join lateral (select * from public.settings_of(p.id)) st on true
$$;

-- ---------------------------------------------------------------------------
-- 4. Paying out a finished round (once per room + seed)
-- ---------------------------------------------------------------------------

-- done: { classId, seed, boss, beaten, ms, players: [{ player, points, game, amount, beaten, lastHit, shields, revives,
-- bestStreak, correct }] }. Pupils not in the room's class are skipped.
create function public.showdown_finish(target bigint, done jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  room_class uuid;
  p jsonb;
  who uuid;
  the_boss text := done ->> 'boss';
  was_beaten boolean := coalesce((done ->> 'beaten')::boolean, false);
  amount integer;
begin
  select r.class_id into room_class from public.showdown_rooms r where r.id = target;
  if room_class is null then
    return 'gone';
  end if;
  insert into public.showdown_finished (room, seed) values (target, (done ->> 'seed')::bigint) on conflict do nothing;
  if not found then
    return 'paid';
  end if;
  if was_beaten and the_boss in ('river-titan', 'storm-kraken', 'clockwork-colossus', 'comet-wyrm') then
    insert into public.showdown_roster (class_id, boss, best_ms)
    values (room_class, the_boss, greatest(0, least(coalesce((done ->> 'ms')::integer, 0), 3600000)))
    on conflict (class_id, boss) do update
      set best_ms = least(public.showdown_roster.best_ms, excluded.best_ms), times = public.showdown_roster.times + 1;
  end if;
  for p in select * from jsonb_array_elements(coalesce(done -> 'players', '[]')) loop
    who := (p ->> 'player')::uuid;
    if public.current_class_of(who) is distinct from room_class then
      continue;
    end if;
    perform public.add_game_points(who, 'showdown', least(greatest(coalesce((p ->> 'points')::integer, 0), 0), 10),
      'showdown:' || target || ':' || (done ->> 'seed'));
    amount := least(greatest(coalesce((p ->> 'amount')::integer, 0), 0), 100);
    if amount > 0 and p ->> 'game' = 'goblinstorm' then
      insert into public.goblinstorm_saves (player, gold) values (who, amount)
      on conflict (player) do update set gold = public.goblinstorm_saves.gold + excluded.gold, updated_at = now();
    elsif amount > 0 and p ->> 'game' = 'archery' then
      insert into public.archery_players (player, coins) values (who, amount)
      on conflict (player) do update set coins = public.archery_players.coins + excluded.coins, updated_at = now();
    end if;
    insert into public.showdown_stats as s (player, rounds, bosses_beaten, last_hits, shields, revives, best_streak, bosses)
    values (who, 1, case when was_beaten then 1 else 0 end, case when (p ->> 'lastHit')::boolean then 1 else 0 end,
      greatest(coalesce((p ->> 'shields')::integer, 0), 0), greatest(coalesce((p ->> 'revives')::integer, 0), 0),
      greatest(coalesce((p ->> 'bestStreak')::integer, 0), 0), case when was_beaten then array[the_boss] else '{}' end)
    on conflict (player) do update set
      rounds = s.rounds + 1,
      bosses_beaten = s.bosses_beaten + excluded.bosses_beaten,
      last_hits = s.last_hits + excluded.last_hits,
      shields = s.shields + excluded.shields,
      revives = s.revives + excluded.revives,
      best_streak = greatest(s.best_streak, excluded.best_streak),
      bosses = (select array_agg(distinct b) from unnest(s.bosses || excluded.bosses) b),
      updated_at = now();
    perform public.game_progress_changed(who, 'showdown');
  end loop;
  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Achievements and points rules
-- ---------------------------------------------------------------------------

create function public.showdown_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'showdown_rounds', coalesce(s.rounds, 0),
    'showdown_bosses_beaten', coalesce(s.bosses_beaten, 0),
    'showdown_last_hits', coalesce(s.last_hits, 0),
    'showdown_shields', coalesce(s.shields, 0),
    'showdown_revives', coalesce(s.revives, 0),
    'showdown_best_streak', coalesce(s.best_streak, 0),
    'showdown_bosses_unique', coalesce(cardinality(s.bosses), 0))
  from (select 1) one left join public.showdown_stats s on s.player = who
$$;

create function public.showdown_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'Play a round: 1 point, or 3 points with at least one right answer.',
    'Your class beats the boss: 5 points.',
    'Every round also opens a Showdown chest for your favourite game.'))
$$;

create function public.showdown_players()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select s.player from public.showdown_stats s
$$;

update public.hub_games
set counts_fn = 'public.showdown_counts(uuid)', rules_fn = 'public.showdown_rules()', players_fn = 'public.showdown_players()',
    keep_achievements = true
where id = 'showdown';

insert into public.achievement_measures (measure)
values ('showdown_rounds'), ('showdown_bosses_beaten'), ('showdown_last_hits'), ('showdown_shields'), ('showdown_revives'),
  ('showdown_best_streak'), ('showdown_bosses_unique');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort, how, tier) values
  ('showdown-first', 'showdown', 'First Showdown', '⚔️', 'showdown_rounds', 1, 1, 'Play your first Class Showdown.', 1),
  ('showdown-titan-slayer', 'showdown', 'Titan Slayer', '🗿', 'showdown_bosses_beaten', 1, 2, 'Help your class beat a Class Showdown boss.', 1),
  ('showdown-last-hit', 'showdown', 'Last Hit', '💥', 'showdown_last_hits', 1, 3, 'Land the final blow on a Class Showdown boss.', 2),
  ('showdown-shield-wall', 'showdown', 'Shield Wall', '🛡️', 'showdown_shields', 10, 4, 'Help hold 10 shields as a Guard in Class Showdown.', 2),
  ('showdown-lifesaver', 'showdown', 'Lifesaver', '💚', 'showdown_revives', 10, 5, 'Wake up 10 dazed classmates as a Healer in Class Showdown.', 2),
  ('showdown-on-fire', 'showdown', 'On Fire', '🔥', 'showdown_best_streak', 10, 6, 'Get 10 answers in a row in one Class Showdown round.', 2),
  ('showdown-veteran', 'showdown', 'Showdown Veteran', '🎖️', 'showdown_rounds', 20, 7, 'Play 20 Class Showdown rounds.', 3),
  ('showdown-boss-hunter', 'showdown', 'Boss Hunter', '👑', 'showdown_bosses_unique', 4, 8, 'Beat all 4 Class Showdown bosses with your class.', 3);

-- ---------------------------------------------------------------------------
-- 6. Server key only; on for every class
-- ---------------------------------------------------------------------------

revoke execute on function public.showdown_class_roster(uuid), public.showdown_chest_games(uuid[]), public.showdown_finish(bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.showdown_class_roster(uuid), public.showdown_chest_games(uuid[]), public.showdown_finish(bigint, jsonb)
  to service_role;

update public.app_settings set showdown_enabled = true;
