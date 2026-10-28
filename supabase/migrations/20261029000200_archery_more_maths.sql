-- Archery Challenge: maths on the path (docs/ARCHERY-QUESTIONS-PLAN.md, James chose option B on 28 Oct 2026).
--
-- 1. archery_rounds gets a kind ('speed', 'chest' after a fight, 'restock' between rounds of a bot fight), the coins
--    for each right answer, and `after`: what a chest or restock belongs to, so each one can be opened only once.
-- 2. archery_round_start gets a second version that takes these (the first stays for the function already deployed).
-- 3. archery_round_load sends them back; archery_state also says how many coins maths earned in the last day.
-- 4. archery_bonus_for says whether a chest or restock may be opened, and whether the fight was won.
-- 5. Everyone starts with 100 coins: the new default, a New Season (it deletes the row, so the default applies), and a
--    one-off top-up of players below 100.
-- 6. How points work says where coins come from now.

alter table public.archery_rounds
  add column kind text not null default 'speed' check (kind in ('speed', 'chest', 'restock')),
  add column per_right integer not null default 10 check (per_right between 0 and 50),
  add column after text check (after is null or length(after) between 3 and 80);
create unique index archery_rounds_after on public.archery_rounds (player, after) where after is not null;

alter table public.archery_players alter column coins set default 100;

-- ---------------------------------------------------------------------------
-- Question sets (the server function only)
-- ---------------------------------------------------------------------------

-- Keeps a new set's questions and when its first question was sent. Returns false if `after` already has a set (a
-- chest or restock opened twice). Sets older than two days are thrown away.
create function public.archery_round_start(
  player uuid, seed text, questions jsonb, earns boolean, served_ms bigint, kind text, after text, per_right integer
)
returns boolean
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
  insert into public.archery_rounds (player, seed, questions, served, earns, kind, after, per_right)
  values (player, seed, questions, jsonb_build_object('0', served_ms), earns, kind, after, per_right)
  on conflict (player, after) where after is not null do nothing;
  return found;
end;
$$;

-- { questions, served, answered, earns, coins, kind, perRight } of one of the pupil's sets, or null.
create or replace function public.archery_round_load(player uuid, seed text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('questions', r.questions, 'served', r.served, 'answered', r.answered, 'earns', r.earns,
    'coins', r.coins, 'kind', r.kind, 'perRight', r.per_right)
  from public.archery_rounds r where r.player = archery_round_load.player and r.seed = archery_round_load.seed
$$;

-- The pupil's Armory (made the first time), with coin-earning sets and the coins maths earned in the last day.
create or replace function public.archery_state(player uuid)
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
  return public.archery_view(me) || (
    select jsonb_build_object('roundsToday', count(*) filter (where r.earns)::integer, 'coinsToday', coalesce(sum(r.coins), 0)::integer)
    from public.archery_rounds r
    where r.player = archery_state.player and r.created_at > now() - interval '1 day');
end;
$$;

-- May this chest or restock be opened? A chest: a bot fight of the pupil's that was finished (not left) in the last
-- hour, or a classmate fight they were in that ended in the last hour, unless they were the one who left it. A
-- restock: a bot fight of theirs that is still being played. Returns { won } or null. (Each opens once:
-- archery_rounds.after.)
create function public.archery_bonus_for(player uuid, kind text, fight bigint, duel bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  f public.archery_fights;
  d public.archery_duels;
  seat smallint;
begin
  if fight is not null then
    select * into f from public.archery_fights x where x.id = archery_bonus_for.fight and x.player = archery_bonus_for.player;
    if not found then return null; end if;
    if kind = 'restock' and f.status = 'playing' and f.created_at > now() - interval '2 hours' then
      return jsonb_build_object('won', false);
    end if;
    if kind = 'chest' and f.status = 'done' and f.finished_at > now() - interval '1 hour' then
      return jsonb_build_object('won', coalesce(f.won, false));
    end if;
    return null;
  end if;
  if duel is not null and kind = 'chest' then
    select * into d from public.archery_duels x where x.id = archery_bonus_for.duel;
    if not found then return null; end if;
    seat := case when d.seat_a = archery_bonus_for.player then 0 when d.seat_b = archery_bonus_for.player then 1 end;
    if seat is null or d.status <> 'done' or d.ending not in ('finished', 'left', 'timeouts')
       or d.leaver is not distinct from seat or d.finished_at < now() - interval '1 hour' then
      return null;
    end if;
    return jsonb_build_object('won', d.winner is not distinct from seat);
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- How points work
-- ---------------------------------------------------------------------------

create or replace function public.archery_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'Finish a fight against a bot: 2 points, or 3 if you win.',
    'Finish a fight against a classmate: 3 points, or 4 if you win.',
    'Get 5 or more right in a speed round: 1 point.',
    'Coins come only from maths: speed rounds, the loot chest after each fight, and restocks between rounds. They are spent in the Armory. A New Season starts everyone with 100 coins and no gear.'))
$$;

-- ---------------------------------------------------------------------------
-- Everyone starts with at least 100 coins (James chose this with option B, 28 Oct 2026)
-- ---------------------------------------------------------------------------

update public.archery_players set coins = 100, updated_at = now() where coins < 100;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.archery_round_start(uuid, text, jsonb, boolean, bigint, text, text, integer),
  public.archery_round_load(uuid, text), public.archery_state(uuid),
  public.archery_bonus_for(uuid, text, bigint, bigint), public.archery_point_rules()
from public, anon, authenticated;
grant execute on function
  public.archery_round_start(uuid, text, jsonb, boolean, bigint, text, text, integer),
  public.archery_round_load(uuid, text), public.archery_state(uuid),
  public.archery_bonus_for(uuid, text, bigint, bigint)
to service_role;
