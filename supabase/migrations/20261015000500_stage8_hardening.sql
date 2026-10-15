-- Stage 8: small fixes from the security review and the classroom-load check.
--
-- 1. Saving the same bot game twice no longer saves (or scores) it twice. On patchy Wi-Fi
--    a save can reach the server but its answer can get lost, so the page tries again; and a
--    student could re-send a winning game from the browser's developer tools.
-- 2. The private "who's here" channel for a friend game carries presence only. Before, the
--    two players could also send each other messages on it with developer tools: a hidden
--    chat the website never shows, but one the brief says we mustn't have.
-- 3. New tables start locked. Supabase gives signed-out visitors and students full rights to
--    every new table by default; each migration so far took them away by hand. Now a
--    forgotten line can't leave a table open.
-- 4. Speed-ups from Supabase's performance advisor: the read rules check who's asking once
--    per query instead of once per row, and a few lookups get an index.

-- ---------------------------------------------------------------------------
-- 1. Saving a bot game twice
-- ---------------------------------------------------------------------------

create or replace function public.record_bot_game(
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
  -- Already saved this exact game? Then it's the same game sent again, not a new one: hand
  -- back the saved one. Only games that count are checked. Two real games of 10+ moves
  -- each with exactly the same moves don't happen, but short ones (e.g. resigning straight
  -- away) do, and those earn nothing anyway.
  if counts_for_points then
    select g.id into new_id from public.bot_games g
    where g.player = record_bot_game.player
      and g.game = record_bot_game.game
      and g.bot_level = record_bot_game.bot_level
      and g.player_side = record_bot_game.player_side
      and g.result = record_bot_game.result
      and g.moves = record_bot_game.moves
    limit 1;
    if new_id is not null then
      return new_id;
    end if;
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

revoke execute on function public.record_bot_game(uuid, text, text, text, text[], text, text, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.record_bot_game(uuid, text, text, text, text[], text, text, integer, boolean)
  to service_role;

-- ---------------------------------------------------------------------------
-- 2. The "who's here" channel: presence only
-- ---------------------------------------------------------------------------

drop policy "Players can listen on their game's channel" on realtime.messages;
drop policy "Players can say they're here on their game's channel" on realtime.messages;

create policy "Players can see who's here on their game's channel"
on realtime.messages for select to authenticated
using (realtime.messages.extension = 'presence' and public.is_player_in(realtime.topic()));

create policy "Players can say they're here on their game's channel"
on realtime.messages for insert to authenticated
with check (realtime.messages.extension = 'presence' and public.is_player_in(realtime.topic()));

-- ---------------------------------------------------------------------------
-- 3. New tables start locked
-- ---------------------------------------------------------------------------

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Speed-ups
-- ---------------------------------------------------------------------------

-- Same rules as before. Wrapping the "who's asking" checks in (select ...) makes Postgres
-- work them out once per query rather than once for every row.
alter policy "School users can see visible profiles, their own, or all if a teacher"
on public.profiles
using ((select public.is_school_user()) and (not hidden or id = (select auth.uid()) or (select public.is_teacher())));

alter policy "Students can see their own bot games"
on public.bot_games
using ((select public.is_school_user()) and player = (select auth.uid()));

alter policy "Students can see the games they're playing in"
on public.mp_games
using ((select public.is_school_user()) and (select auth.uid()) in (first_player, second_player));

alter policy "School users can read the name words" on public.name_words using ((select public.is_school_user()));
alter policy "School users can read the settings" on public.app_settings using ((select public.is_school_user()));
alter policy "School users can read the list of achievements" on public.achievement_types
using ((select public.is_school_user()));

-- Scoring a friend game first checks "already scored?" by game, and deleting a game or a
-- student looks these up too.
create index scored_games_mp_game on public.scored_games (mp_game);
create index scored_games_bot_game on public.scored_games (bot_game);
create index scored_games_opponent on public.scored_games (opponent);
create index mp_games_rematch_game on public.mp_games (rematch_game);
create index achievements_achievement on public.achievements (achievement);
