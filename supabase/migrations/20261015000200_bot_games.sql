-- Stage 4: every finished game against a bot is saved here.
--
-- The website can't write to this table at all. Games arrive through the save-bot-game
-- server function, which replays every move with chess.js and decides the result itself,
-- so a student can't send in a pretend win. Students can read only their own games.
-- Points, ratings and leaderboards come in Stage 7 and will be worked out from this table.

create table public.bot_games (
  id uuid primary key default gen_random_uuid(),
  player uuid not null references public.profiles (id) on delete cascade,
  game text not null check (game in ('chess', 'checkers')),
  bot_level text not null check (bot_level in ('very-easy', 'easy', 'medium')),
  -- Which side the student played, e.g. 'white' or 'black'.
  player_side text not null check (player_side ~ '^[a-z]{1,10}$'),
  -- Every move in order, in short codes like 'e2e4'. Kept so results can be re-checked.
  moves text[] not null check (cardinality(moves) <= 1000),
  result text not null check (result in ('won', 'lost', 'drawn')),
  -- How it ended, e.g. 'checkmate', 'stalemate', 'resigned', 'abandoned'.
  reason text not null check (reason ~ '^[a-z-]{1,30}$'),
  player_moves integer not null check (player_moves >= 0),
  -- False for abandoned or very short games: they're recorded but will earn nothing.
  counts_for_points boolean not null,
  finished_at timestamptz not null default now()
);

create index bot_games_player_recent on public.bot_games (player, finished_at desc);

alter table public.bot_games enable row level security;
revoke all on public.bot_games from anon, authenticated;
grant select on public.bot_games to authenticated;

create policy "Students can see their own bot games"
on public.bot_games for select to authenticated
using (public.is_school_user() and player = auth.uid());

-- Only the save-bot-game server function calls this (it runs with the server's key),
-- after it has replayed the moves. The website can't call it.
create function public.record_bot_game(
  player uuid,
  game text,
  bot_level text,
  player_side text,
  moves text[],
  result text,
  reason text,
  player_moves integer,
  counts_for_points boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  -- Same school lock as everywhere else: the player must have a profile and a school account.
  if not exists (
    select 1 from public.profiles p join auth.users u on u.id = p.id
    where p.id = record_bot_game.player and public.is_school_email(u.email)
  ) then
    raise exception 'No such player.' using errcode = '22023';
  end if;
  -- A school day never has this many real games. It stops a script flooding the database.
  if (select count(*) from public.bot_games g
      where g.player = record_bot_game.player and g.finished_at > now() - interval '1 day') >= 300 then
    raise exception 'That''s a lot of games today! Have a break and come back tomorrow.' using errcode = '54000';
  end if;
  insert into public.bot_games (player, game, bot_level, player_side, moves, result, reason, player_moves, counts_for_points)
  values (player, game, bot_level, player_side, moves, result, reason, player_moves, counts_for_points)
  returning id into new_id;
  return new_id;
end;
$$;

-- Games played, won, lost and drawn for the signed-in student, per game.
-- Runs as the student, so the row level security above still applies.
create function public.my_bot_game_stats()
returns table (game text, played integer, won integer, lost integer, drawn integer)
language sql
stable
set search_path = ''
as $$
  select g.game,
         count(*)::integer,
         count(*) filter (where g.result = 'won')::integer,
         count(*) filter (where g.result = 'lost')::integer,
         count(*) filter (where g.result = 'drawn')::integer
  from public.bot_games g
  where g.player = auth.uid()
  group by g.game
$$;

revoke execute on function public.record_bot_game(uuid, text, text, text, text[], text, text, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.record_bot_game(uuid, text, text, text, text[], text, text, integer, boolean)
  to service_role;
revoke execute on function public.my_bot_game_stats() from public, anon;
grant execute on function public.my_bot_game_stats() to authenticated;
