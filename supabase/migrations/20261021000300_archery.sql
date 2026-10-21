-- Archery Challenge, stage 4: the server side (docs/ARCHERY-PLAN.md, sections 4, 5 and 7).
--
-- Archery is its own thing: its own tables and functions, so no other game reads or changes an Archery record. Points,
-- the teacher's switch, How points work, the teacher's "last played" and New Season all go through the hub_games hooks;
-- nothing shared is re-created. Achievements come in stage 7.
--
-- 1. archery_players: one row per pupil: coins (only ever from speed rounds), gear (arrows and helpers, how many of each),
--    the shields and bows they own, coins spent in all (the Armory level), and their best fight score in each world.
-- 2. archery_requests: a purchase, a sale or a fight start sent twice counts once (the reply is kept for 2 days).
-- 3. archery_rounds: a speed round's questions and when each was sent, which pupils can never read (no policy, no grant),
--    and the answers marked so far.
-- 4. archery_fights: a fight against a bot: its seed, world, the bot's level, the quiver packed (taken out of the pupil's
--    gear when it starts) and how it ended. The server function replays the shots before anything is given back.
-- 5. Server-only functions for all of it, every coin change in one statement with the row locked, so a double tap can
--    never spend twice and coins never go below 0.
-- 6. The switch: app_settings.archery_enabled, per class, OFF to start; teacher_set_archery().
-- 7. The hooks: How points work, New Season (wipes coins and gear: James, 21 Oct 2026), last played.
--
-- Depends on 20261020000100_game_hooks.sql.

create table public.archery_players (
  player uuid primary key references public.profiles (id) on delete cascade,
  coins integer not null default 0 check (coins >= 0),
  -- { "<arrow or helper>": n }
  gear jsonb not null default '{}' check (jsonb_typeof(gear) = 'object'),
  -- ["wood", ...] and ["long", ...] (the Starter Bow is always owned and never listed)
  shields jsonb not null default '[]' check (jsonb_typeof(shields) = 'array'),
  bows jsonb not null default '[]' check (jsonb_typeof(bows) = 'array'),
  spent integer not null default 0 check (spent >= 0),
  -- { "<world>": best score }
  best jsonb not null default '{}' check (jsonb_typeof(best) = 'object'),
  updated_at timestamptz not null default now()
);

create table public.archery_requests (
  player uuid not null references public.profiles (id) on delete cascade,
  request_id text not null check (length(request_id) between 8 and 80),
  reply jsonb not null,
  created_at timestamptz not null default now(),
  primary key (player, request_id)
);
create index archery_requests_by_day on public.archery_requests (created_at);

create table public.archery_rounds (
  player uuid not null references public.profiles (id) on delete cascade,
  seed text not null check (length(seed) between 10 and 80),
  questions jsonb not null check (jsonb_typeof(questions) = 'array'),
  -- { "<slot>": ms since 1970 when the server sent it }
  served jsonb not null default '{}',
  -- { "<slot>": { "value": n | null, "right": bool, "coins": n } }
  answered jsonb not null default '{}',
  -- Does this round earn coins (one of the day's first rounds), or is it practice?
  earns boolean not null,
  coins integer not null default 0 check (coins >= 0),
  created_at timestamptz not null default now(),
  primary key (player, seed)
);
create index archery_rounds_by_day on public.archery_rounds (player, created_at);

create table public.archery_fights (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  seed bigint not null check (seed between 0 and 4294967295),
  world text not null check (world in ('forest', 'desert', 'snow', 'city')),
  opponent text not null check (opponent in ('easy', 'medium', 'hard')),
  -- The packed quiver: { quiver: { id: n }, shield, bow }
  pack jsonb not null,
  status text not null default 'playing' check (status in ('playing', 'done', 'left', 'abandoned')),
  score integer check (score >= 0),
  won boolean,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index archery_fights_by_player on public.archery_fights (player, created_at);
create index archery_fights_open on public.archery_fights (player) where status = 'playing';

alter table public.archery_players enable row level security;
alter table public.archery_requests enable row level security;
alter table public.archery_rounds enable row level security;
alter table public.archery_fights enable row level security;
revoke all on public.archery_players, public.archery_requests, public.archery_rounds, public.archery_fights from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Adds (sign 1) or takes away (sign -1) counts of gear. Nothing below 0 is kept; a count of 0 is left out.
create function public.archery_gear_plus(gear jsonb, delta jsonb, sign integer)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(k, n), '{}')
  from (
    select k, sum(n)::integer as n
    from (
      select key as k, (value #>> '{}')::integer as n from jsonb_each(coalesce(gear, '{}'))
      union all
      select key, sign * (value #>> '{}')::integer from jsonb_each(coalesce(delta, '{}'))
    ) parts
    group by k
  ) totals
  where n > 0
$$;

-- Does the pupil carry at least this much of everything in `need`?
create function public.archery_has_gear(gear jsonb, need jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select not exists (
    select 1 from jsonb_each(coalesce(need, '{}')) n
    where (n.value #>> '{}')::integer > coalesce((gear ->> n.key)::integer, 0)
  )
$$;

-- What the browser and the server function see of a pupil's Armory.
create function public.archery_view(p public.archery_players)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('coins', p.coins, 'gear', p.gear, 'shields', p.shields, 'bows', p.bows, 'spent', p.spent, 'best', p.best)
$$;

-- Gives back the packed gear of fights left open for over two hours (the pupil closed the page): their arrows weren't
-- counted, so all of them come back.
create function public.archery_tidy_fights(player uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  f record;
begin
  for f in
    update public.archery_fights x set status = 'abandoned', finished_at = now()
    where x.player = archery_tidy_fights.player and x.status = 'playing' and x.created_at < now() - interval '2 hours'
    returning x.pack
  loop
    update public.archery_players p set gear = public.archery_gear_plus(p.gear, f.pack -> 'quiver', 1), updated_at = now()
    where p.player = archery_tidy_fights.player;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- The pupil's Armory (the server function only)
-- ---------------------------------------------------------------------------

-- The pupil's Armory (made the first time), with how many coin-earning rounds they've played in the last day.
create function public.archery_state(player uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.archery_players;
begin
  perform public.gem_keep_check_player(player);
  insert into public.archery_players (player) values (player) on conflict do nothing;
  perform public.archery_tidy_fights(player);
  select * into me from public.archery_players p where p.player = archery_state.player;
  return public.archery_view(me) || jsonb_build_object('roundsToday', (
    select count(*)::integer from public.archery_rounds r
    where r.player = archery_state.player and r.earns and r.created_at > now() - interval '1 day'));
end;
$$;

-- One purchase or sale, worked out by the server function from the shop's prices (shared/archery/shop.ts).
--   buy:  costs `price`, adds `qty` (gear) or the shield or bow; needs `need_spent` coins spent in all, and gear may
--         not go past `carry`.
--   sell: one item, giving back `price`.
-- Returns { result: 'ok' | 'coins' | 'level' | 'full' | 'owned' | 'none', state }. The same request_id again gets the
-- first reply, and nothing changes twice.
create function public.archery_shop(
  player uuid, request_id text, action text, kind text, item text, price integer, qty integer, need_spent integer, carry integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.archery_players;
  result text := 'ok';
  have integer;
  reply jsonb;
begin
  perform public.gem_keep_check_player(player);
  if action not in ('buy', 'sell') or kind not in ('gear', 'shield', 'bow') or price < 0 or qty < 1 or carry < 1 then
    raise exception 'That shop request is not right.' using errcode = '22023';
  end if;
  select r.reply into reply from public.archery_requests r where r.player = archery_shop.player and r.request_id = archery_shop.request_id;
  if reply is not null then
    return reply;
  end if;
  insert into public.archery_players (player) values (player) on conflict do nothing;
  select * into p from public.archery_players x where x.player = archery_shop.player for update;
  have := coalesce((p.gear ->> item)::integer, 0);
  if action = 'buy' then
    if p.spent < need_spent then result := 'level';
    elsif p.coins < price then result := 'coins';
    elsif kind = 'gear' and have + qty > carry then result := 'full';
    elsif kind = 'shield' and p.shields ? item then result := 'owned';
    elsif kind = 'bow' and p.bows ? item then result := 'owned';
    else
      update public.archery_players x set
        coins = x.coins - price,
        spent = x.spent + price,
        gear = case when kind = 'gear' then public.archery_gear_plus(x.gear, jsonb_build_object(item, qty), 1) else x.gear end,
        shields = case when kind = 'shield' then x.shields || to_jsonb(item) else x.shields end,
        bows = case when kind = 'bow' then x.bows || to_jsonb(item) else x.bows end,
        updated_at = now()
      where x.player = archery_shop.player
      returning * into p;
    end if;
  else
    if kind = 'gear' and have < 1 then result := 'none';
    elsif kind = 'shield' and not p.shields ? item then result := 'none';
    elsif kind = 'bow' and not p.bows ? item then result := 'none';
    else
      update public.archery_players x set
        coins = x.coins + price,
        gear = case when kind = 'gear' then public.archery_gear_plus(x.gear, jsonb_build_object(item, 1), -1) else x.gear end,
        shields = case when kind = 'shield' then x.shields - item else x.shields end,
        bows = case when kind = 'bow' then x.bows - item else x.bows end,
        updated_at = now()
      where x.player = archery_shop.player
      returning * into p;
    end if;
  end if;
  reply := jsonb_build_object('result', result, 'state', public.archery_view(p));
  delete from public.archery_requests r where r.created_at < now() - interval '2 days';
  insert into public.archery_requests (player, request_id, reply) values (player, request_id, reply);
  return reply;
end;
$$;

-- ---------------------------------------------------------------------------
-- Speed rounds (the server function only)
-- ---------------------------------------------------------------------------

-- Keeps a new round's questions and when its first question was sent. Rounds older than two days are thrown away.
create function public.archery_round_start(player uuid, seed text, questions jsonb, earns boolean, served_ms bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if jsonb_typeof(questions) <> 'array' or jsonb_array_length(questions) not between 1 and 20 then
    raise exception 'That question list is not right.' using errcode = '22023';
  end if;
  delete from public.archery_rounds r where r.created_at < now() - interval '2 days';
  insert into public.archery_rounds (player, seed, questions, served, earns)
  values (player, seed, questions, jsonb_build_object('0', served_ms), earns);
end;
$$;

-- { questions, served, answered, earns, coins } of one of the pupil's rounds, or null.
create function public.archery_round_load(player uuid, seed text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('questions', r.questions, 'served', r.served, 'answered', r.answered, 'earns', r.earns, 'coins', r.coins)
  from public.archery_rounds r where r.player = archery_round_load.player and r.seed = archery_round_load.seed
$$;

-- Marks one question, once (it must have been sent and not answered yet), adds its coins to the round and the pupil,
-- and notes when the next question was sent (next_ms; null at the end). Returns { claimed, coins (the pupil's total) }.
create function public.archery_round_answer(
  player uuid, seed text, slot integer, value numeric, right_answer boolean, coins integer, next_ms bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  total integer;
begin
  if coins < 0 or coins > 100 then
    raise exception 'Those coins are not right.' using errcode = '22023';
  end if;
  update public.archery_rounds r set
    answered = r.answered || jsonb_build_object(slot::text, jsonb_build_object('value', archery_round_answer.value, 'right', right_answer, 'coins', archery_round_answer.coins)),
    served = case when next_ms is null then r.served else r.served || jsonb_build_object((slot + 1)::text, next_ms) end,
    coins = r.coins + archery_round_answer.coins
  where r.player = archery_round_answer.player and r.seed = archery_round_answer.seed
    and r.served ? slot::text and not (r.answered ? slot::text);
  if not found then
    return jsonb_build_object('claimed', false);
  end if;
  insert into public.archery_players (player) values (player) on conflict do nothing;
  update public.archery_players p set coins = p.coins + archery_round_answer.coins, updated_at = now()
  where p.player = archery_round_answer.player
  returning p.coins into total;
  return jsonb_build_object('claimed', true, 'coins', total);
end;
$$;

-- ---------------------------------------------------------------------------
-- Fights (the server function only)
-- ---------------------------------------------------------------------------

-- Starts a fight against a bot: any fight still open is given up first (its packed gear comes back), then the packed
-- quiver is taken out of the pupil's gear. The shield and bow must be theirs. Returns { result: 'ok' | 'gear', fight,
-- state }; the same request_id again gets the first reply.
create function public.archery_fight_start(player uuid, request_id text, seed bigint, world text, opponent text, pack jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.archery_players;
  f record;
  fight_id bigint;
  reply jsonb;
begin
  perform public.gem_keep_check_player(player);
  if jsonb_typeof(pack) <> 'object' or jsonb_typeof(coalesce(pack -> 'quiver', '{}')) <> 'object' then
    raise exception 'That quiver is not right.' using errcode = '22023';
  end if;
  select r.reply into reply from public.archery_requests r where r.player = archery_fight_start.player and r.request_id = archery_fight_start.request_id;
  if reply is not null then
    return reply;
  end if;
  insert into public.archery_players (player) values (player) on conflict do nothing;
  select * into p from public.archery_players x where x.player = archery_fight_start.player for update;
  for f in
    update public.archery_fights x set status = 'abandoned', finished_at = now()
    where x.player = archery_fight_start.player and x.status = 'playing'
    returning x.pack
  loop
    p.gear := public.archery_gear_plus(p.gear, f.pack -> 'quiver', 1);
  end loop;
  if not public.archery_has_gear(p.gear, pack -> 'quiver')
     or (pack ->> 'shield' is not null and not p.shields ? (pack ->> 'shield'))
     or (coalesce(pack ->> 'bow', 'starter') <> 'starter' and not p.bows ? (pack ->> 'bow')) then
    update public.archery_players x set gear = p.gear, updated_at = now() where x.player = archery_fight_start.player returning * into p;
    reply := jsonb_build_object('result', 'gear', 'state', public.archery_view(p));
  else
    update public.archery_players x set gear = public.archery_gear_plus(p.gear, pack -> 'quiver', -1), updated_at = now()
    where x.player = archery_fight_start.player returning * into p;
    insert into public.archery_fights (player, seed, world, opponent, pack) values (player, seed, world, opponent, pack)
    returning id into fight_id;
    reply := jsonb_build_object('result', 'ok', 'fight', fight_id, 'state', public.archery_view(p));
  end if;
  delete from public.archery_requests r where r.created_at < now() - interval '2 days';
  insert into public.archery_requests (player, request_id, reply) values (player, request_id, reply);
  return reply;
end;
$$;

-- { seed, world, opponent, pack, status } of one of the pupil's fights, or null.
create function public.archery_fight_load(player uuid, fight bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('seed', f.seed, 'world', f.world, 'opponent', f.opponent, 'pack', f.pack, 'status', f.status)
  from public.archery_fights f where f.player = archery_fight_load.player and f.id = archery_fight_load.fight
$$;

-- Ends an open fight the server function has replayed: 'done' (it was finished) or 'left' (given up part-way). The gear
-- that wasn't used (`back`) is given back, and a finished fight's score may be a new best for its world.
-- Returns { result: 'ok' | 'duplicate', best (true if a new best), state }.
create function public.archery_fight_end(player uuid, fight bigint, status text, back jsonb, score integer, won boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.archery_players;
  w text;
  is_best boolean := false;
begin
  if status not in ('done', 'left') or score < 0 or jsonb_typeof(back) <> 'object' then
    raise exception 'That fight result is not right.' using errcode = '22023';
  end if;
  update public.archery_fights f set status = archery_fight_end.status, score = archery_fight_end.score, won = archery_fight_end.won, finished_at = now()
  where f.player = archery_fight_end.player and f.id = archery_fight_end.fight and f.status = 'playing'
  returning f.world into w;
  if not found then
    select * into p from public.archery_players x where x.player = archery_fight_end.player;
    return jsonb_build_object('result', 'duplicate', 'best', false, 'state', public.archery_view(p));
  end if;
  select * into p from public.archery_players x where x.player = archery_fight_end.player for update;
  is_best := status = 'done' and score > coalesce((p.best ->> w)::integer, -1);
  update public.archery_players x set
    gear = public.archery_gear_plus(x.gear, back, 1),
    best = case when is_best then x.best || jsonb_build_object(w, score) else x.best end,
    updated_at = now()
  where x.player = archery_fight_end.player
  returning * into p;
  return jsonb_build_object('result', 'ok', 'best', is_best, 'state', public.archery_view(p));
end;
$$;

-- ---------------------------------------------------------------------------
-- The switch
-- ---------------------------------------------------------------------------

alter table public.app_settings add column archery_enabled boolean not null default false;

create function public.teacher_set_archery(enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null then
    raise exception 'Unknown Archery Challenge setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings set archery_enabled = enabled where id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- The hooks
-- ---------------------------------------------------------------------------

-- The lines on How points work (the numbers are in shared/archery/points.ts).
create function public.archery_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'Finish a fight against a bot: 2 points, or 3 if you win.',
    'Get 5 or more right in a speed round: 1 point.',
    'Coins come only from speed rounds and are spent in the Armory. A New Season starts everyone with no coins and no gear.'))
$$;

-- What a New Season clears (the game's points always go): coins, gear, bests, rounds and fights (James, 21 Oct 2026).
create function public.archery_season(players uuid[])
returns void
language sql
set search_path = ''
as $$
  with a as (delete from public.archery_players where player = any (players)),
       b as (delete from public.archery_rounds where player = any (players)),
       c as (delete from public.archery_requests where player = any (players))
  delete from public.archery_fights where player = any (players)
$$;

create function public.archery_last_played(player uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select greatest(
    (select max(f.created_at) from public.archery_fights f where f.player = archery_last_played.player),
    (select max(r.created_at) from public.archery_rounds r where r.player = archery_last_played.player))
$$;

insert into public.hub_games (id, switch_column, rules_fn, season_fn, last_played_fn)
values ('archery', 'archery_enabled', 'public.archery_point_rules()', 'public.archery_season(uuid[])', 'public.archery_last_played(uuid)');

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.archery_gear_plus(jsonb, jsonb, integer), public.archery_has_gear(jsonb, jsonb), public.archery_view(public.archery_players),
  public.archery_tidy_fights(uuid), public.archery_state(uuid),
  public.archery_shop(uuid, text, text, text, text, integer, integer, integer, integer),
  public.archery_round_start(uuid, text, jsonb, boolean, bigint), public.archery_round_load(uuid, text),
  public.archery_round_answer(uuid, text, integer, numeric, boolean, integer, bigint),
  public.archery_fight_start(uuid, text, bigint, text, text, jsonb), public.archery_fight_load(uuid, bigint),
  public.archery_fight_end(uuid, bigint, text, jsonb, integer, boolean),
  public.teacher_set_archery(boolean, uuid), public.archery_point_rules(), public.archery_season(uuid[]), public.archery_last_played(uuid)
from public, anon, authenticated;
grant execute on function public.teacher_set_archery(boolean, uuid) to authenticated;
grant execute on function
  public.archery_state(uuid),
  public.archery_shop(uuid, text, text, text, text, integer, integer, integer, integer),
  public.archery_round_start(uuid, text, jsonb, boolean, bigint), public.archery_round_load(uuid, text),
  public.archery_round_answer(uuid, text, integer, numeric, boolean, integer, bigint),
  public.archery_fight_start(uuid, text, bigint, text, text, jsonb), public.archery_fight_load(uuid, bigint),
  public.archery_fight_end(uuid, bigint, text, jsonb, integer, boolean)
to service_role;
