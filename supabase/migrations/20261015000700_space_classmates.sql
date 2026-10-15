-- Stage 9.4: Wormholes & Black Holes with classmates (2–4 students, plus bots if the host wants).
--
-- A new table, space_games, one row per game. The table chess and checkers use (mp_games) is
-- not changed. Like mp_games, students can read only the games they're in and can't write
-- to it at all: every change goes through the new "space-game" server function, which rolls
-- the dice, runs the shared rules engine and saves the result "only if nothing changed since
-- it looked" (the version column). Supabase Realtime sends each change to the players.
--
-- 1. space_games and space_game_log (every action, for the mission log after a reload).
-- 2. The private "who's here" channel covers space games too (still presence only).
-- 3. Scoring: 4 points a finished game, win or lose, for the first 6 a day. Never ratings.
-- 4. Emoji reactions: a teacher switch (off to start) and a server-only function that keeps
--    the limits (one every 5 seconds, 20 a game).
-- 5. Reading: the lobby, my stats. Server only: player status, tidy-up (every 5 minutes).
-- 6. Teacher view, new season and rebuild_progress() include space games.
-- The numbers are in docs/SPACE-GAME-PLAN.md, sections 5 and 7.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table public.space_games (
  id uuid primary key default gen_random_uuid(),
  -- Same code letters as friend games. The server also checks mp_games, so a code never
  -- means two games at once.
  code text check (code ~ '^[CDFGHJKMNPQRTVWXY34679]{5}$'),
  in_lobby boolean not null default false,
  host uuid references public.profiles (id) on delete set null,
  -- The students. While waiting: in the order they joined (the host first). From launch: in
  -- turn order, rocket 1 to 4, with an empty seat for each bot. If a student is deleted their
  -- seat empties and the game carries on for the others (autopilot flies their rocket).
  seat1 uuid references public.profiles (id) on delete set null,
  seat2 uuid references public.profiles (id) on delete set null,
  seat3 uuid references public.profiles (id) on delete set null,
  seat4 uuid references public.profiles (id) on delete set null,
  status text not null default 'waiting'
    check (status in ('waiting', 'playing', 'finished', 'cancelled', 'expired')),
  -- The board and rules: { board, settings } (shared/space/live.ts LiveSetup).
  setup jsonb not null check (jsonb_typeof(setup) = 'object' and pg_column_size(setup) < 2000),
  -- How many rockets, from launch.
  rockets smallint check (rockets between 2 and 4),
  -- One entry per rocket: { bot, autopilot, left, timeouts, stats } (shared/space/live.ts SeatInfo).
  seat_info jsonb check (seat_info is null or jsonb_typeof(seat_info) = 'array'),
  -- The rules engine's state (positions, items, whose turn...). A few KB.
  state jsonb check (state is null or pg_column_size(state) < 60000),
  -- What the last change did, for the screens to animate, and who did what.
  events jsonb not null default '[]' check (pg_column_size(events) < 60000),
  actions jsonb not null default '[]',
  -- Goes up by one with every move. The server saves only if it hasn't moved since it looked.
  version integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  started_at timestamptz,
  -- When the clock runs out for whoever's turn it is.
  turn_deadline timestamptz,
  last_action_at timestamptz,
  finished_at timestamptz,
  -- 'docked', 'mission-clock' (out of fuel), or 'abandoned' (everyone left).
  ending text check (ending in ('docked', 'mission-clock', 'abandoned')),
  -- Per rocket: 1st, 2nd...; and whether it earns points.
  places smallint[],
  counts boolean[],
  -- The last emoji reaction, and how many each rocket has sent: { last, sent[], at[] }.
  -- Changed only by space_add_reaction(), which doesn't move the version.
  reactions jsonb not null default '{"last": null, "sent": [0, 0, 0, 0], "at": [0, 0, 0, 0]}',
  -- The first to press Rematch makes a new waiting game; the others join it.
  rematch_game uuid references public.space_games (id) on delete set null,
  check ((seat1 is null or seat1 is distinct from seat2) and (seat1 is null or seat1 is distinct from seat3)
    and (seat1 is null or seat1 is distinct from seat4) and (seat2 is null or seat2 is distinct from seat3)
    and (seat2 is null or seat2 is distinct from seat4) and (seat3 is null or seat3 is distinct from seat4)),
  check (status not in ('playing', 'finished') or (rockets is not null and state is not null and seat_info is not null)),
  check (status <> 'finished' or (ending is not null and finished_at is not null and counts is not null))
);

create unique index space_games_waiting_code on public.space_games (code) where status = 'waiting';
create unique index space_games_one_waiting_each on public.space_games (host) where status = 'waiting';
create index space_games_lobby on public.space_games (created_at) where status = 'waiting' and in_lobby;
create index space_games_seat1 on public.space_games (seat1, finished_at desc);
create index space_games_seat2 on public.space_games (seat2, finished_at desc);
create index space_games_seat3 on public.space_games (seat3, finished_at desc);
create index space_games_seat4 on public.space_games (seat4, finished_at desc);
create index space_games_idle on public.space_games (last_action_at) where status = 'playing';
create index space_games_rematch_game on public.space_games (rematch_game);

alter table public.space_games enable row level security;
revoke all on public.space_games from anon, authenticated;
grant select on public.space_games to authenticated;

create policy "Students can see the space games they're in"
on public.space_games for select to authenticated
using ((select public.is_school_user()) and (select auth.uid()) in (seat1, seat2, seat3, seat4));

alter publication supabase_realtime add table public.space_games;

-- Every change to a game, oldest first: what was done and what happened. Pages read it when
-- they open a game, to fill in the mission log. It isn't sent live (that would double the data).
create table public.space_game_log (
  id bigint generated always as identity primary key,
  game uuid not null references public.space_games (id) on delete cascade,
  version integer not null,
  actions jsonb not null,
  events jsonb not null,
  at timestamptz not null default now(),
  unique (game, version)
);

alter table public.space_game_log enable row level security;
revoke all on public.space_game_log from anon, authenticated;
grant select on public.space_game_log to authenticated;

create policy "Students can see the log of space games they're in"
on public.space_game_log for select to authenticated
using ((select public.is_school_user()) and exists (
  select 1 from public.space_games g
  where g.id = space_game_log.game and (select auth.uid()) in (g.seat1, g.seat2, g.seat3, g.seat4)));

-- The server saves a move and its log line in one step: this trigger writes the log line.
create function public.log_space_game()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.version > old.version and jsonb_array_length(new.events) > 0 then
    insert into public.space_game_log (game, version, actions, events)
    values (new.id, new.version, new.actions, new.events)
    on conflict do nothing;
  end if;
  return null;
end;
$$;

create trigger log_after_change
after update of version on public.space_games
for each row execute function public.log_space_game();

-- ---------------------------------------------------------------------------
-- 2. The "who's here" channel: friend games and space games
-- ---------------------------------------------------------------------------

-- Same as Stage 6, plus 'space-game:<id>' topics. The Stage 8 policies on realtime.messages
-- (presence only) use this, so space games get presence only too.
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
        and auth.uid() in (g.seat1, g.seat2, g.seat3, g.seat4)))
$$;

-- ---------------------------------------------------------------------------
-- 3. Scoring
-- ---------------------------------------------------------------------------

alter table public.scored_games add column space_game uuid references public.space_games (id) on delete cascade;
alter table public.scored_games drop constraint scored_games_check;
alter table public.scored_games add constraint scored_games_check check (
  num_nonnulls(bot_game, mp_game, space_game) = 1
  and (kind = 'bot') = (bot_game is not null)
  and (kind = 'friend') = (mp_game is not null or space_game is not null));
create unique index scored_games_space on public.scored_games (player, space_game) where space_game is not null;
create index scored_games_space_game on public.scored_games (space_game);

-- Each student in a finished game that counts: 4 points (win or lose), for the first 6 such
-- games each NZ day; 0 after that (still in their history). No ratings, ever.
create function public.score_space_game(g public.space_games)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  day date := public.nz_day(g.finished_at);
  seats uuid[] := array[g.seat1, g.seat2, g.seat3, g.seat4];
  who uuid;
  earned_today integer;
  i integer;
begin
  if g.status <> 'finished' or g.counts is null then
    return;
  end if;
  if exists (select 1 from public.scored_games s where s.space_game = g.id) then
    return;
  end if;
  for i in 1..coalesce(g.rockets, 0) loop
    who := seats[i];
    continue when who is null or not coalesce(g.counts[i], false);
    select count(*) into earned_today from public.scored_games s
    where s.player = who and s.game = 'space' and s.kind = 'friend' and s.nz_day = day and s.points > 0;
    insert into public.scored_games (player, game, kind, space_game, result, reason, points, finished_at, nz_day, space)
    values (
      who, 'space', 'friend', g.id,
      case when g.places[i] = 1 then 'won' else 'lost' end,
      case g.ending when 'mission-clock' then 'out-of-fuel' else g.ending end,
      case when earned_today < public.space_friend_daily_games() then public.space_friend_points() else 0 end,
      g.finished_at, day,
      g.seat_info -> (i - 1) -> 'stats'
    )
    on conflict do nothing;
    perform public.award_achievements(who, 'space', g.finished_at);
  end loop;
end;
$$;

create function public.score_space_game_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.score_space_game(new);
  return null;
exception when others then
  -- Never lose a game because scoring went wrong. rebuild_progress() can fix scores later.
  raise warning 'scoring a space game failed (%)', sqlstate;
  return null;
end;
$$;

create trigger score_when_finished
after insert or update of status on public.space_games
for each row
when (new.status = 'finished')
execute function public.score_space_game_trigger();

-- Same as Stage 7, with space games too.
create or replace function public.rebuild_progress()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item record;
begin
  delete from public.achievements;
  delete from public.scored_games;
  delete from public.ratings;
  for item in
    select 'bot' as kind, b.id, b.finished_at from public.bot_games b where b.counts_for_points
    union all
    select 'friend', m.id, m.finished_at from public.mp_games m where m.status = 'finished' and m.counts_for_points
    union all
    select 'space', s.id, s.finished_at from public.space_games s where s.status = 'finished' and true = any (s.counts)
    order by finished_at, id
  loop
    if item.kind = 'bot' then
      perform public.score_bot_game(b) from public.bot_games b where b.id = item.id;
    elsif item.kind = 'friend' then
      perform public.score_friend_game(m) from public.mp_games m where m.id = item.id;
    else
      perform public.score_space_game(s) from public.space_games s where s.id = item.id;
    end if;
  end loop;
  return jsonb_build_object(
    'scored_games', (select count(*) from public.scored_games),
    'achievements', (select count(*) from public.achievements),
    'ratings', (select count(*) from public.ratings)
  );
end;
$$;

-- Same as Stage 7, except Recent games' "+4" can point at a space game too.
create or replace function public.my_progress()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id where public.is_school_user()),
  totals as (select public.points_total(me.id) as points from me),
  week as (select public.nz_week_start(now()) as start)
  select jsonb_build_object(
    'points', t.points,
    'level', public.level_for(t.points),
    'levelStart', public.level_start(public.level_for(t.points)),
    'nextLevelAt', public.level_start(public.level_for(t.points) + 1),
    'weekPoints', (select coalesce(sum(s.points), 0) from public.scored_games s, week
                   where s.player = me.id and s.finished_at >= week.start)
                + public.achievement_points() * (select count(*) from public.achievements a, week
                   where a.player = me.id and a.earned_at >= week.start),
    'games', (select jsonb_agg(jsonb_build_object(
                'game', g,
                'rank', public.rank_progress(coalesce(r.rating, public.start_rating()), coalesce(r.rated_games, 0)),
                'weekRatingChange', (select sum(s.rating_change) from public.scored_games s, week
                   where s.player = me.id and s.game = g and s.rated and s.finished_at >= week.start)
              ) order by g)
              from unnest(array['chess', 'checkers']) as g
              left join public.ratings r on r.player = me.id and r.game = g),
    'achievements', (select jsonb_agg(jsonb_build_object(
                'id', at.id, 'game', at.game, 'name', at.name, 'emoji', at.emoji, 'measure', at.measure,
                'goal', at.goal,
                'progress', least((public.progress_counts(me.id, at.game) ->> at.measure)::integer, at.goal),
                'earnedAt', a.earned_at
              ) order by at.game, at.sort)
              from public.achievement_types at
              left join public.achievements a on a.player = me.id and a.achievement = at.id),
    'recent', (select coalesce(jsonb_agg(jsonb_build_object('id', coalesce(x.bot_game, x.mp_game, x.space_game),
                 'points', x.points)), '[]')
               from (select s.bot_game, s.mp_game, s.space_game, s.points from public.scored_games s
                     where s.player = me.id order by s.finished_at desc limit 20) x)
  )
  from me, totals t
$$;

-- ---------------------------------------------------------------------------
-- 4. Emoji reactions
-- ---------------------------------------------------------------------------

alter table public.app_settings add column space_reactions_enabled boolean not null default false;

create function public.teacher_set_space_reactions(enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  update public.app_settings set space_reactions_enabled = enabled where id;
end;
$$;

-- Server only (the space-game function checks the switch, the player and their seat first).
-- Puts a reaction on the game, keeping the limits: one every 5 seconds, 20 a game, per rocket.
-- Returns 'ok', 'too-soon', 'too-many', 'not-playing' or 'not-allowed'.
create function public.space_add_reaction(game_id uuid, seat integer, emoji text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
  st text;
  sent integer;
  last_at numeric;
  now_s numeric := extract(epoch from clock_timestamp());
begin
  if emoji is null or emoji not in ('🚀', '👏', '😮', '🎉', '😂', '👍') or seat not between 0 and 3 then
    return 'not-allowed';
  end if;
  select g.reactions, g.status into r, st from public.space_games g where g.id = game_id for update;
  if st is distinct from 'playing' then
    return 'not-playing';
  end if;
  sent := coalesce((r -> 'sent' ->> seat)::integer, 0);
  last_at := coalesce((r -> 'at' ->> seat)::numeric, 0);
  if sent >= 20 then
    return 'too-many';
  end if;
  if now_s - last_at < 5 then
    return 'too-soon';
  end if;
  update public.space_games g
  set reactions = jsonb_build_object(
    'last', jsonb_build_object('seat', seat, 'emoji', emoji, 'id', coalesce((r -> 'last' ->> 'id')::integer, 0) + 1),
    'sent', jsonb_set(r -> 'sent', array[seat::text], to_jsonb(sent + 1)),
    'at', jsonb_set(r -> 'at', array[seat::text], to_jsonb(floor(now_s))))
  where g.id = game_id;
  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Reading, and the server's helpers
-- ---------------------------------------------------------------------------

-- Open space games anyone can join, for the lobby. No codes or player IDs.
create function public.space_lobby_games()
returns table (
  id uuid,
  creator_name text,
  creator_avatar jsonb,
  players integer,
  board jsonb,
  mode text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, p.display_name, p.avatar, num_nonnulls(g.seat1, g.seat2, g.seat3, g.seat4),
         g.setup -> 'board', g.setup -> 'settings' ->> 'mode', g.created_at
  from public.space_games g
  join public.profiles p on p.id = g.host
  where public.is_school_user()
    and (select multiplayer_enabled from public.app_settings)
    and g.status = 'waiting'
    and g.in_lobby
    and g.expires_at > now()
    and not p.hidden
    and num_nonnulls(g.seat1, g.seat2, g.seat3, g.seat4) < 4
    and auth.uid() is distinct from g.seat1 and auth.uid() is distinct from g.seat2
    and auth.uid() is distinct from g.seat3 and auth.uid() is distinct from g.seat4
  order by g.created_at desc
  limit 30
$$;

-- Space games finished with classmates, and how many 1st places. Runs as the student, so
-- the read rule above still applies. Games they left don't count as played here.
create function public.my_space_game_stats()
returns table (played integer, firsts integer)
language sql
stable
set search_path = ''
as $$
  with mine as (
    select g.places[array_position(array[g.seat1, g.seat2, g.seat3, g.seat4], auth.uid())] as place,
           g.seat_info -> (array_position(array[g.seat1, g.seat2, g.seat3, g.seat4], auth.uid()) - 1) ->> 'left' as left_game
    from public.space_games g
    where g.status = 'finished' and g.ending <> 'abandoned'
      and auth.uid() in (g.seat1, g.seat2, g.seat3, g.seat4)
  )
  select count(*)::integer, count(*) filter (where place = 1)::integer
  from mine where left_game is distinct from 'true'
$$;

-- For the server: can this student play, have they been hidden, are the teacher switches on,
-- how many space games have they started this hour, and which of `others` (the other
-- students in a game) are hidden or gone.
create function public.space_player_status(player uuid, others uuid[] default '{}')
returns table (
  school boolean,
  hidden boolean,
  multiplayer_enabled boolean,
  reactions_enabled boolean,
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
         (select s.space_reactions_enabled from public.app_settings s),
         (select count(*)::integer from public.space_games g
          where g.host = player and g.created_at > now() - interval '1 hour'),
         coalesce((select array_agg(o) from unnest(others) as o
           where o is not null and not exists (
             select 1 from public.profiles p join auth.users u on u.id = p.id
             where p.id = o and not p.hidden and public.is_school_email(u.email))), '{}')
$$;

-- Every 5 minutes: waiting games nobody launched expire, and games with nothing happening
-- for 10 minutes (everyone has gone) end with no points for anyone.
create function public.space_tidy()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.space_games
  set status = 'expired', version = version + 1, events = '[]', actions = '[]'
  where status = 'waiting' and expires_at <= now();

  update public.space_games
  set status = 'finished',
      ending = 'abandoned',
      counts = array_fill(false, array[rockets]),
      finished_at = now(),
      turn_deadline = null,
      events = '[]',
      actions = '[]',
      version = version + 1
  where status = 'playing' and last_action_at < now() - interval '10 minutes';
$$;

select cron.schedule('tidy-space-games', '*/5 * * * *', 'select public.space_tidy()');

-- ---------------------------------------------------------------------------
-- 6. Teachers
-- ---------------------------------------------------------------------------

-- Same as Stage 7, counting space games with classmates as friend games.
create or replace function public.teacher_students()
returns table (
  id uuid,
  display_name text,
  avatar jsonb,
  role text,
  hidden boolean,
  bot_games integer,
  friend_games integer,
  points integer,
  last_played timestamptz,
  joined timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  return query
  select p.id, p.display_name, p.avatar, p.role, p.hidden,
         (select count(*)::integer from public.bot_games b where b.player = p.id),
         (select count(*)::integer from public.mp_games m
          where m.status = 'finished' and p.id in (m.first_player, m.second_player))
         + (select count(*)::integer from public.space_games s
          where s.status = 'finished' and p.id in (s.seat1, s.seat2, s.seat3, s.seat4)),
         public.points_total(p.id),
         greatest(
           (select max(b.finished_at) from public.bot_games b where b.player = p.id),
           (select max(m.finished_at) from public.mp_games m
            where m.status = 'finished' and p.id in (m.first_player, m.second_player)),
           (select max(s.finished_at) from public.space_games s
            where s.status = 'finished' and p.id in (s.seat1, s.seat2, s.seat3, s.seat4))),
         p.created_at
  from public.profiles p
  order by p.role desc, p.display_name;
end;
$$;

-- Same as Stage 9.3, with space games against classmates in the space line and in Recent.
-- "Won" is 1st place; "left" is a game they left (autopilot) or that everyone left.
create or replace function public.teacher_student_detail(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  return (
    with space_mine as (
      select s.id, s.finished_at, s.ending,
             s.places[array_position(array[s.seat1, s.seat2, s.seat3, s.seat4], student)] as place,
             coalesce((s.seat_info -> (array_position(array[s.seat1, s.seat2, s.seat3, s.seat4], student) - 1)
               ->> 'left')::boolean, false) or s.ending = 'abandoned' as left_game
      from public.space_games s
      where s.status = 'finished' and student in (s.seat1, s.seat2, s.seat3, s.seat4)
    )
    select jsonb_build_object(
      'points', public.points_total(student),
      'level', public.level_for(public.points_total(student)),
      'games', (select jsonb_agg(jsonb_build_object(
          'game', g,
          'bot', (select jsonb_build_object(
              'played', count(*), 'won', count(*) filter (where b.result = 'won'),
              'lost', count(*) filter (where b.result = 'lost'), 'drawn', count(*) filter (where b.result = 'drawn'),
              'left', count(*) filter (where b.reason = 'abandoned'))
            from public.bot_games b where b.player = student and b.game = g),
          'friend', case when g = 'space' then
            (select jsonb_build_object(
              'played', count(*), 'won', count(*) filter (where not sm.left_game and sm.place = 1),
              'lost', count(*) filter (where not sm.left_game and sm.place > 1), 'drawn', 0,
              'left', count(*) filter (where sm.left_game))
             from space_mine sm)
          else
            (select jsonb_build_object(
              'played', count(*),
              'won', count(*) filter (where m.winner = case when m.first_player = student then 'first' else 'second' end),
              'lost', count(*) filter (where m.winner = case when m.first_player = student then 'second' else 'first' end),
              'drawn', count(*) filter (where m.winner is null),
              'left', count(*) filter (where m.reason = 'abandoned'
                and m.winner = case when m.first_player = student then 'second' else 'first' end))
            from public.mp_games m
            where m.status = 'finished' and m.game = g and student in (m.first_player, m.second_player))
          end,
          'rank', case when g <> 'space' then
            public.rank_name(public.rank_for(coalesce(r.rating, public.start_rating()), coalesce(r.rated_games, 0))) end,
          'achievements', (select count(*) from public.achievements a
            join public.achievement_types t on t.id = a.achievement where a.player = student and t.game = g)
        ) order by g)
        from unnest(array['chess', 'checkers', 'space']) as g
        left join public.ratings r on r.player = student and r.game = g),
      'recent', (select coalesce(jsonb_agg(x order by x.finished_at desc), '[]') from (
          (select b.game, 'bot' as kind, b.bot_level as against, b.result, b.reason, b.finished_at,
                  (b.space ->> 'place')::integer as place
           from public.bot_games b where b.player = student order by b.finished_at desc limit 10)
          union all
          (select m.game, 'friend', coalesce(o.display_name, 'a deleted player'),
                  case when m.winner is null then 'drawn'
                       when m.winner = case when m.first_player = student then 'first' else 'second' end then 'won'
                       else 'lost' end,
                  m.reason, m.finished_at, null
           from public.mp_games m
           left join public.profiles o
             on o.id = case when m.first_player = student then m.second_player else m.first_player end
           where m.status = 'finished' and student in (m.first_player, m.second_player)
           order by m.finished_at desc limit 10)
          union all
          (select 'space', 'friend', 'classmates', case when sm.place = 1 and not sm.left_game then 'won' else 'lost' end,
                  case when sm.left_game then 'abandoned' else sm.ending end, sm.finished_at,
                  case when sm.left_game then null else sm.place end
           from space_mine sm order by sm.finished_at desc limit 10)
          order by finished_at desc limit 10) x)
    )
    where exists (select 1 from public.profiles p where p.id = student)
  );
end;
$$;

-- Same as Stage 7, clearing space games too (games still being played are left alone).
create or replace function public.teacher_new_season(confirm text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  bot_count integer;
  friend_count integer;
  space_count integer;
begin
  perform public.require_teacher();
  if confirm is distinct from 'NEW SEASON' then
    raise exception 'Type NEW SEASON to start a new season.' using errcode = '22023';
  end if;
  delete from public.achievements where true;
  delete from public.scored_games where true;
  delete from public.ratings where true;
  delete from public.bot_games where true;
  get diagnostics bot_count = row_count;
  delete from public.mp_games where status in ('finished', 'cancelled', 'expired');
  get diagnostics friend_count = row_count;
  -- A finished game a newer one points at (a rematch) goes too; the link just empties.
  delete from public.space_games where status in ('finished', 'cancelled', 'expired');
  get diagnostics space_count = row_count;
  return jsonb_build_object('botGames', bot_count, 'friendGames', friend_count + space_count);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.log_space_game(), public.score_space_game(public.space_games), public.score_space_game_trigger(),
  public.teacher_set_space_reactions(boolean), public.space_add_reaction(uuid, integer, text),
  public.space_lobby_games(), public.my_space_game_stats(), public.space_player_status(uuid, uuid[]),
  public.space_tidy()
from public, anon, authenticated;
grant execute on function
  public.teacher_set_space_reactions(boolean), public.space_lobby_games(), public.my_space_game_stats()
to authenticated;
grant execute on function
  public.space_add_reaction(uuid, integer, text), public.space_player_status(uuid, uuid[]), public.space_tidy()
to service_role;
