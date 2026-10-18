-- Stage P.5, part 1 of 2: Power Clash with a classmate (the games themselves).
--
-- NOT APPLIED to the live database yet. Apply in order: 20261017001500 (P.4: bot games and
-- points), then this file, then 20261017001700 (scoring and the teacher views). Then deploy
-- the power-clash function, then switch the game on (src/games/registry.ts).
--
-- Two players, nothing hidden, so this is simpler than 101: ONE table, like the space game's.
--
-- 1. power_games: the whole match, one row per game. Students can read only the games they're
--    in (teachers can read them all) and can't write at all: every change goes through the new
--    "power-clash" server function, which runs the shared rules engine (shared/power-clash) and
--    saves "only if nothing changed since it looked" (the version column). Supabase Realtime
--    sends each change to the two players.
-- 2. The private "who's here" channel covers Power Clash games too (still presence only).
-- 3. A code never means two waiting games at once: waiting_code_taken() looks at Power Clash too.
-- 4. Reading: the lobby, my stats. Server only: player status, tidy-up (every 5 minutes).
-- Points, badges and the teacher views are in the next migration. The numbers are in
-- docs/POWER-CLASH-PLAN.md, sections 5 and 6.

-- ---------------------------------------------------------------------------
-- 1. The table
-- ---------------------------------------------------------------------------

create table public.power_games (
  id uuid primary key default gen_random_uuid(),
  -- Same code letters as the other games. The server also checks the others' waiting codes.
  code text check (code ~ '^[CDFGHJKMNPQRTVWXY34679]{5}$'),
  in_lobby boolean not null default false,
  host uuid references public.profiles (id) on delete set null,
  -- The two students. While waiting: in the order they joined (the host first). From the start
  -- seat1 plays X and seat2 plays O for the whole match. A deleted student's seat empties.
  seat1 uuid references public.profiles (id) on delete set null,
  seat2 uuid references public.profiles (id) on delete set null,
  -- A rematch asks for last game's O to play X this time (they start). Null: the server decides.
  first_player uuid references public.profiles (id) on delete set null,
  -- Each player's three powers, in seat order, picked in the waiting room. Null until picked.
  -- The game starts as soon as both have picked. Fixed for the whole match once it has started.
  loadouts jsonb not null default '[null, null]'
    check (jsonb_typeof(loadouts) = 'array' and jsonb_array_length(loadouts) = 2 and pg_column_size(loadouts) < 600),
  status text not null default 'waiting'
    check (status in ('waiting', 'playing', 'finished', 'cancelled', 'expired')),
  -- The rules engine's whole match (shared/power-clash/live.ts LiveGame): board, score, round,
  -- starter, powers used, frozen squares, stats, timed-out turns, who has pressed Next.
  game jsonb check (game is null or pg_column_size(game) < 20000),
  -- What the last change did, for the screens to animate (shared/power-clash/types.ts GameEvent).
  events jsonb not null default '[]' check (pg_column_size(events) < 20000),
  -- Goes up by one with every change. The server saves only if it hasn't moved since it looked.
  version integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  started_at timestamptz,
  -- When the clock runs out for the current step: a turn (60 s) or the pause between rounds (30 s).
  deadline timestamptz,
  -- The last real move or button press (a time-out doesn't count): how the tidy-up job spots a
  -- game everyone has walked away from.
  last_action_at timestamptz,
  finished_at timestamptz,
  -- 'finished' (someone won three rounds) or 'abandoned' (someone left, three missed turns in a
  -- row, a student was hidden or deleted, or nothing happened for 10 minutes).
  ending text check (ending in ('finished', 'abandoned')),
  -- Who left (or missed three turns). Null: nobody in particular (both walked away).
  leaver uuid references public.profiles (id) on delete set null,
  -- At the end, by seat: won the match, earns points, and the stats for the badges.
  won boolean[],
  counts boolean[],
  stats jsonb check (stats is null or jsonb_typeof(stats) = 'array'),
  -- The first to press Rematch makes a new waiting game; the other joins it.
  rematch_game uuid references public.power_games (id) on delete set null,
  check (seat1 is null or seat1 is distinct from seat2),
  check (status not in ('playing', 'finished') or game is not null),
  check (status <> 'finished' or (ending is not null and finished_at is not null and counts is not null))
);

create unique index power_games_waiting_code on public.power_games (code) where status = 'waiting';
create unique index power_games_one_waiting_each on public.power_games (host) where status = 'waiting';
create index power_games_lobby on public.power_games (created_at) where status = 'waiting' and in_lobby;
create index power_games_seat1 on public.power_games (seat1, finished_at desc);
create index power_games_seat2 on public.power_games (seat2, finished_at desc);
create index power_games_idle on public.power_games (last_action_at) where status = 'playing';
create index power_games_rematch_game on public.power_games (rematch_game);

alter table public.power_games enable row level security;
revoke all on public.power_games from anon, authenticated;
grant select on public.power_games to authenticated;

create policy "Players see their Power Clash games, teachers all"
on public.power_games for select to authenticated
using (
  (select public.is_school_user())
  and ((select auth.uid()) in (seat1, seat2) or (select public.is_teacher()))
);

-- Realtime re-checks the rule above for every change, so only the two players (and teachers) hear it.
alter publication supabase_realtime add table public.power_games;

-- ---------------------------------------------------------------------------
-- 2. The "who's here" channel: friend, space, 101 and Power Clash games
-- ---------------------------------------------------------------------------

-- Same as Stage 10.4, plus 'power-game:<id>' topics. The Stage 8 policies on realtime.messages
-- (presence only) use this, so Power Clash games get presence only too.
create or replace function public.is_player_in(game_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_school_user() and (
    exists (
      select 1 from public.mp_games g
      where game_topic = 'mp-game:' || g.id::text
        and auth.uid() in (g.first_player, g.second_player))
    or exists (
      select 1 from public.space_games g
      where game_topic = 'space-game:' || g.id::text
        and auth.uid() in (g.seat1, g.seat2, g.seat3, g.seat4))
    or exists (
      select 1 from public.card_game_seats s
      where game_topic = 'card-game:' || s.game::text
        and s.player = auth.uid())
    or exists (
      select 1 from public.power_games g
      where game_topic = 'power-game:' || g.id::text
        and auth.uid() in (g.seat1, g.seat2)))
$$;

-- ---------------------------------------------------------------------------
-- 3. Codes
-- ---------------------------------------------------------------------------

-- Is this code waiting in any game (chess, checkers, space, 101 or Power Clash)? So a new
-- Power Clash code never means two games at once.
create or replace function public.waiting_code_taken(code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.mp_games g where g.code = waiting_code_taken.code and g.status = 'waiting')
      or exists (select 1 from public.space_games g where g.code = waiting_code_taken.code and g.status = 'waiting')
      or exists (select 1 from public.card_games g where g.code = waiting_code_taken.code and g.status = 'waiting')
      or exists (select 1 from public.power_games g where g.code = waiting_code_taken.code and g.status = 'waiting')
$$;

-- ---------------------------------------------------------------------------
-- 4. Reading, and the server's helpers
-- ---------------------------------------------------------------------------

-- Open Power Clash games anyone can join, for the lobby. No codes or player IDs.
create function public.power_lobby_games()
returns table (
  id uuid,
  creator_name text,
  creator_avatar jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, p.display_name, p.avatar, g.created_at
  from public.power_games g
  join public.profiles p on p.id = g.host
  where public.is_school_user()
    and (select multiplayer_enabled from public.app_settings)
    and g.status = 'waiting'
    and g.in_lobby
    and g.expires_at > now()
    and not p.hidden
    and g.seat2 is null
    and auth.uid() is distinct from g.seat1
  order by g.created_at desc
  limit 30
$$;

-- Matches finished with a classmate, and wins. Games that were left part-way don't count.
-- (Not security definer: the rule on power_games lets a student read only their own.)
create function public.my_power_game_stats()
returns table (played integer, won integer)
language sql
stable
set search_path = ''
as $$
  select count(*)::integer,
         count(*) filter (where case when g.seat1 = auth.uid() then g.won[1] else g.won[2] end)::integer
  from public.power_games g
  where auth.uid() in (g.seat1, g.seat2) and g.status = 'finished' and g.ending = 'finished'
$$;

-- For the server: can this student play, have they been hidden, is the teacher switch on, how
-- many Power Clash games have they started this hour, and which of `others` are hidden or gone.
create function public.power_player_status(player uuid, others uuid[] default '{}')
returns table (
  school boolean,
  hidden boolean,
  multiplayer_enabled boolean,
  created_last_hour integer,
  gone uuid[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1 from public.profiles p join auth.users u on u.id = p.id
           where p.id = player and public.is_school_email(u.email)
         ),
         coalesce((select p.hidden from public.profiles p where p.id = player), true),
         (select s.multiplayer_enabled from public.app_settings s),
         (select count(*)::integer from public.power_games g
          where g.host = player and g.created_at > now() - interval '1 hour'),
         coalesce((select array_agg(o) from unnest(others) as o
           where o is not null and not exists (
             select 1 from public.profiles p join auth.users u on u.id = p.id
             where p.id = o and not p.hidden and public.is_school_email(u.email))), '{}')
$$;

-- Every 5 minutes: waiting games nobody started expire, and games with no real move for 10
-- minutes (both have gone) end as abandoned, with no points for anyone.
create function public.power_tidy()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.power_games
  set status = 'expired', version = version + 1, events = '[]'
  where status = 'waiting' and expires_at <= now();

  update public.power_games
  set status = 'finished',
      ending = 'abandoned',
      won = array[false, false],
      counts = array[false, false],
      finished_at = now(),
      deadline = null,
      events = '[]',
      version = version + 1
  where status = 'playing' and last_action_at < now() - interval '10 minutes';
$$;

select cron.schedule('tidy-power-games', '*/5 * * * *', 'select public.power_tidy()');

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.power_lobby_games(), public.my_power_game_stats(), public.power_player_status(uuid, uuid[]), public.power_tidy()
from public, anon, authenticated;
grant execute on function public.power_lobby_games(), public.my_power_game_stats() to authenticated;
grant execute on function public.power_player_status(uuid, uuid[]), public.power_tidy() to service_role;
