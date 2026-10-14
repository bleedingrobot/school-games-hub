-- Stage 6: students playing each other, live.
--
-- One row in mp_games is one game between two students. The website can read only the
-- games its student is playing in, and can't write to the table at all. Every change
-- (create, join, move, resign, draw, claim, rematch) goes through the "multiplayer"
-- server function, which checks it with the same rules code as the bot games and saves it
-- with the server's key. Supabase Realtime tells the other player straight away.
-- Points and ratings come in Stage 7 and will be worked out from the finished rows here.

create table public.mp_games (
  id uuid primary key default gen_random_uuid(),
  game text not null check (game in ('chess', 'checkers')),
  -- The code a friend types to join, e.g. 'KM4TP'. No vowels and no lookalike characters.
  code text check (code ~ '^[CDFGHJKMNPQRTVWXY34679]{5}$'),
  -- True if anyone can see it in the lobby; false if it can only be joined with the code.
  in_lobby boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  -- first_player moves first: White in chess, Red in checkers. If a student is deleted,
  -- their games stay for the other player's history, without anything that points to them.
  first_player uuid references public.profiles (id) on delete set null,
  second_player uuid references public.profiles (id) on delete set null,
  status text not null default 'waiting'
    check (status in ('waiting', 'playing', 'finished', 'cancelled', 'expired')),
  -- Every move in order, in the same short codes as bot games ('e2e4', '11-15').
  moves text[] not null default '{}' check (cardinality(moves) <= 1000),
  -- Goes up by one with every change. The server saves a change only if this hasn't moved
  -- since it read the game, so two requests at once can't both succeed.
  version integer not null default 0,
  created_at timestamptz not null default now(),
  -- A waiting game nobody joins disappears after this.
  expires_at timestamptz not null default now() + interval '10 minutes',
  started_at timestamptz,
  -- The server's time when the current turn began. Used for the 2-minute rule.
  turn_started_at timestamptz,
  -- A draw offer waiting for an answer: which side made it.
  draw_offer text check (draw_offer in ('first', 'second')),
  first_draw_offers integer not null default 0,
  second_draw_offers integer not null default 0,
  -- How many moves had been played when each side last offered a draw.
  first_offer_ply integer,
  second_offer_ply integer,
  -- The result. winner is null for a draw.
  winner text check (winner in ('first', 'second')),
  -- How it ended, e.g. 'checkmate', 'no-pieces', 'resigned', 'agreed-draw', 'abandoned'.
  reason text check (reason ~ '^[a-z-]{1,30}$'),
  -- False for abandoned or very short games: they're recorded but will earn nothing.
  counts_for_points boolean,
  finished_at timestamptz,
  -- Rematch: both players must ask. Then rematch_game is the new game.
  first_wants_rematch boolean not null default false,
  second_wants_rematch boolean not null default false,
  rematch_game uuid references public.mp_games (id) on delete set null,
  check (first_player is null or second_player is null or first_player <> second_player),
  check (status <> 'finished' or (reason is not null and finished_at is not null and counts_for_points is not null))
);

-- A code belongs to one waiting game at a time, and each student has at most one waiting game.
create unique index mp_games_waiting_code on public.mp_games (code) where status = 'waiting';
create unique index mp_games_one_waiting_each on public.mp_games (created_by) where status = 'waiting';
create index mp_games_lobby on public.mp_games (created_at) where status = 'waiting' and in_lobby;
create index mp_games_first_recent on public.mp_games (first_player, finished_at desc);
create index mp_games_second_recent on public.mp_games (second_player, finished_at desc);
create index mp_games_stale on public.mp_games (turn_started_at) where status = 'playing';

alter table public.mp_games enable row level security;
revoke all on public.mp_games from anon, authenticated;
grant select on public.mp_games to authenticated;

-- Teachers don't get extra access here yet; the teacher screens come in Stage 7.
create policy "Students can see the games they're playing in"
on public.mp_games for select to authenticated
using (public.is_school_user() and auth.uid() in (first_player, second_player));

-- Live updates: Realtime sends each change to the players, re-checking the rule above.
alter publication supabase_realtime add table public.mp_games;

-- The two players also share a private live channel, 'mp-game:<game id>', used only to
-- see whether the other player is still there. Only the two players can use it.
create function public.is_player_in(game_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_school_user() and exists (
    select 1 from public.mp_games g
    where game_topic = 'mp-game:' || g.id::text
      and auth.uid() in (g.first_player, g.second_player)
  )
$$;

create policy "Players can listen on their game's channel"
on realtime.messages for select to authenticated
using (public.is_player_in(realtime.topic()));

create policy "Players can say they're here on their game's channel"
on realtime.messages for insert to authenticated
with check (public.is_player_in(realtime.topic()));

-- ---------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------

-- The open lobby: waiting games anyone can join, with only what's needed to choose one.
-- No codes, emails or player IDs. Hidden students' games aren't listed.
create function public.lobby_games()
returns table (
  id uuid,
  game text,
  creator_name text,
  creator_avatar jsonb,
  -- The side the person joining would play: 'first' or 'second'.
  open_side text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.game, p.display_name, p.avatar,
         case when g.first_player is null then 'first' else 'second' end,
         g.created_at
  from public.mp_games g
  join public.profiles p on p.id = g.created_by
  where public.is_school_user()
    and (select multiplayer_enabled from public.app_settings)
    and g.status = 'waiting'
    and g.in_lobby
    and g.expires_at > now()
    and not p.hidden
    and g.created_by <> auth.uid()
  order by g.created_at desc
  limit 30
$$;

-- Games played, won, lost and drawn against other students, per game.
-- Runs as the student, so the row level security above still applies.
create function public.my_friend_game_stats()
returns table (game text, played integer, won integer, lost integer, drawn integer)
language sql
stable
set search_path = ''
as $$
  select g.game,
         count(*)::integer,
         count(*) filter (where g.winner = case when g.first_player = auth.uid() then 'first' else 'second' end)::integer,
         count(*) filter (where g.winner = case when g.first_player = auth.uid() then 'second' else 'first' end)::integer,
         count(*) filter (where g.winner is null)::integer
  from public.mp_games g
  where g.status = 'finished' and auth.uid() in (g.first_player, g.second_player)
  group by g.game
$$;

-- The database's clock, so the page can show the 2-minute timer the way the server sees it.
create function public.server_time()
returns timestamptz
language sql
stable
set search_path = ''
as $$ select now() $$;

-- ---------------------------------------------------------------------------
-- For the server function only (it runs with the server's key)
-- ---------------------------------------------------------------------------

-- Can this person play? Also how many games they've started in the last hour.
create function public.mp_player_status(player uuid)
returns table (school boolean, hidden boolean, multiplayer_enabled boolean, created_last_hour integer)
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
         (select count(*)::integer from public.mp_games g
          where g.created_by = player and g.created_at > now() - interval '1 hour')
$$;

-- Tidies up every few minutes (scheduled below):
-- - waiting games nobody joined expire;
-- - games with no move for 30 minutes end as 'abandoned', a loss for the player whose
--   turn it was. They earn nothing.
create function public.mp_tidy()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.mp_games
  set status = 'expired', version = version + 1
  where status = 'waiting' and expires_at <= now();

  update public.mp_games
  set status = 'finished',
      -- With an even number of moves played it was the first player's turn, so they lose.
      winner = case when cardinality(moves) % 2 = 0 then 'second' else 'first' end,
      reason = 'abandoned',
      counts_for_points = false,
      finished_at = now(),
      draw_offer = null,
      version = version + 1
  where status = 'playing' and turn_started_at < now() - interval '30 minutes';
$$;

create extension if not exists pg_cron;
select cron.schedule('tidy-friend-games', '*/5 * * * *', 'select public.mp_tidy()');

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function public.is_player_in(text), public.lobby_games(), public.my_friend_game_stats(),
  public.server_time(), public.mp_player_status(uuid), public.mp_tidy()
  from public, anon, authenticated;
grant execute on function public.is_player_in(text), public.lobby_games(), public.my_friend_game_stats(),
  public.server_time()
  to authenticated;
grant execute on function public.mp_player_status(uuid), public.mp_tidy() to service_role;
