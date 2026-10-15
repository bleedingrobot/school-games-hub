-- Stage 10.4: 101 with classmates (2–4 students).
--
-- The big difference from every other game: hidden cards. So there are two new tables.
--
-- 1. card_games: the whole game, with the stack and everyone's cards. LOCKED: students have
--    no permission to read it at all (no table rights, no row rules, not in Realtime). Only
--    the new "card-game" server function and the database's own scoring code use it.
-- 2. card_game_seats: one small row per player per game, holding only what that player may
--    know (shared/card101/view.ts viewFor). A student can read only their own row. The
--    server rewrites every seat row with each change, and Realtime sends each one only to
--    its player. card_game_write() saves the game and its seat rows in one step, "only if
--    nothing changed since the server looked" (the version column).
-- 3. The private "who's here" channel covers 101 games too (still presence only).
-- 4. Scoring: 8 points for a win, 4 for finishing, for the first 6 games each NZ day. A game
--    of fewer than 2 full rounds, or one you were out of, earns nothing. Never ratings.
-- 5. Reading: the lobby, my stats. Server only: saving, player status, tidy-up (every 5 minutes).
-- 6. Teacher view, new season, rebuild_progress() and my_progress() include 101 games.
-- The numbers are in docs/101-PLAN.md, sections 5 and 6.

-- ---------------------------------------------------------------------------
-- 1. The whole game: no student access
-- ---------------------------------------------------------------------------

create table public.card_games (
  id uuid primary key default gen_random_uuid(),
  -- Same code letters as the other games. The server checks the other games' waiting codes too.
  code text check (code ~ '^[CDFGHJKMNPQRTVWXY34679]{5}$'),
  in_lobby boolean not null default false,
  host uuid references public.profiles (id) on delete set null,
  -- The students, by seat. While waiting: in the order they joined (the host first). From the
  -- start the seats are fixed. A deleted student's seat empties; they're out of the game.
  seat1 uuid references public.profiles (id) on delete set null,
  seat2 uuid references public.profiles (id) on delete set null,
  seat3 uuid references public.profiles (id) on delete set null,
  seat4 uuid references public.profiles (id) on delete set null,
  -- How many players the host asked for. The game starts by itself when that many have joined.
  wanted smallint not null check (wanted between 2 and 4),
  -- { target: 101 or 50 }
  settings jsonb not null check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) < 200),
  status text not null default 'waiting'
    check (status in ('waiting', 'playing', 'finished', 'cancelled', 'expired')),
  -- The rules engine's whole game (shared/card101/engine.ts Game): the stack, every hand.
  game jsonb check (game is null or pg_column_size(game) < 60000),
  -- Between rounds: who has pressed Next.
  ready boolean[],
  -- Goes up by one with every change. The server saves only if it hasn't moved since it looked.
  version integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  started_at timestamptz,
  -- When the clock runs out for the current step: the peek, a turn, or the pause between rounds.
  deadline timestamptz,
  last_action_at timestamptz,
  finished_at timestamptz,
  -- 'finished' (someone reached the target, or only one player was left) or 'abandoned'
  -- (nothing happened for 10 minutes).
  ending text check (ending in ('finished', 'abandoned')),
  -- At the end, by seat: place (0 = was out), won, out, earns points, and the stats for achievements.
  places smallint[],
  won boolean[],
  out_of_game boolean[],
  counts boolean[],
  stats jsonb check (stats is null or jsonb_typeof(stats) = 'array'),
  -- The first to press Rematch makes a new waiting game; the others join it.
  rematch_game uuid references public.card_games (id) on delete set null,
  check ((seat1 is null or seat1 is distinct from seat2) and (seat1 is null or seat1 is distinct from seat3)
    and (seat1 is null or seat1 is distinct from seat4) and (seat2 is null or seat2 is distinct from seat3)
    and (seat2 is null or seat2 is distinct from seat4) and (seat3 is null or seat3 is distinct from seat4)),
  check (status not in ('playing', 'finished') or game is not null),
  check (status <> 'finished' or (ending is not null and finished_at is not null and counts is not null))
);

create unique index card_games_waiting_code on public.card_games (code) where status = 'waiting';
create unique index card_games_one_waiting_each on public.card_games (host) where status = 'waiting';
create index card_games_lobby on public.card_games (created_at) where status = 'waiting' and in_lobby;
create index card_games_seat1 on public.card_games (seat1, finished_at desc);
create index card_games_seat2 on public.card_games (seat2, finished_at desc);
create index card_games_seat3 on public.card_games (seat3, finished_at desc);
create index card_games_seat4 on public.card_games (seat4, finished_at desc);
create index card_games_idle on public.card_games (last_action_at) where status = 'playing';
create index card_games_rematch_game on public.card_games (rematch_game);

-- Locked: row level security on with no rules at all, and no rights for students.
alter table public.card_games enable row level security;
revoke all on public.card_games from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Each player's own view
-- ---------------------------------------------------------------------------

create table public.card_game_seats (
  game uuid not null references public.card_games (id) on delete cascade,
  player uuid not null references public.profiles (id) on delete cascade,
  seat smallint not null check (seat between 0 and 3),
  version integer not null,
  status text not null check (status in ('waiting', 'playing', 'finished', 'cancelled', 'expired')),
  -- What every player may know: codes, names by seat, the clock, places at the end
  -- (shared/card101/live.ts PublicInfo). No cards.
  info jsonb not null check (jsonb_typeof(info) = 'object' and pg_column_size(info) < 4000),
  -- What this player may know of the cards (viewFor). Null while waiting.
  view jsonb check (view is null or pg_column_size(view) < 20000),
  -- What the last change did, as this player may see it (eventsFor), and the last 40 of those.
  events jsonb not null default '[]' check (pg_column_size(events) < 20000),
  log jsonb not null default '[]' check (pg_column_size(log) < 20000),
  updated_at timestamptz not null default now(),
  primary key (game, player),
  -- Checked at the end of each step, so seats can be renumbered when someone leaves the waiting room.
  unique (game, seat) deferrable initially deferred
);

create index card_game_seats_player on public.card_game_seats (player, updated_at desc);

alter table public.card_game_seats enable row level security;
revoke all on public.card_game_seats from anon, authenticated;
grant select on public.card_game_seats to authenticated;

create policy "Students can see only their own seat"
on public.card_game_seats for select to authenticated
using ((select public.is_school_user()) and player = (select auth.uid()));

-- Realtime sends a row change only to people the row rule above lets read it: its player.
alter publication supabase_realtime add table public.card_game_seats;

-- The last 40 of a list of events: each seat row's log, for the "What happened" list after a reload.
create function public.card_recent_events(events jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(x.e order by x.n), '[]')
  from jsonb_array_elements(events) with ordinality as x(e, n)
  where x.n > jsonb_array_length(events) - 40
$$;

-- Saves a game and all its seat rows in one step. Only the server calls this.
-- expected_version null: a new game. Otherwise the game is saved only if it's still at
-- that version (returns nothing if it has changed). Seat rows not in `seats` are removed
-- (someone left the waiting room).
create function public.card_game_write(expected_version integer, game_row jsonb, seats jsonb)
returns setof public.card_games
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.card_games := jsonb_populate_record(null::public.card_games, game_row);
  saved public.card_games;
begin
  if jsonb_typeof(seats) <> 'array' then
    raise exception 'Seats must be a list.' using errcode = '22023';
  end if;
  if expected_version is null then
    insert into public.card_games (id, code, in_lobby, host, seat1, seat2, seat3, seat4, wanted, settings, status, game,
      ready, version, expires_at, started_at, deadline, last_action_at, finished_at, ending, places, won, out_of_game,
      counts, stats, rematch_game)
    values (coalesce(r.id, gen_random_uuid()), r.code, coalesce(r.in_lobby, false), r.host, r.seat1, r.seat2, r.seat3,
      r.seat4, r.wanted, r.settings, coalesce(r.status, 'waiting'), r.game, r.ready, coalesce(r.version, 0),
      coalesce(r.expires_at, now() + interval '10 minutes'), r.started_at, r.deadline, r.last_action_at, r.finished_at,
      r.ending, r.places, r.won, r.out_of_game, r.counts, r.stats, r.rematch_game)
    returning * into saved;
  else
    update public.card_games g
    set code = r.code, in_lobby = r.in_lobby, host = r.host, seat1 = r.seat1, seat2 = r.seat2, seat3 = r.seat3,
        seat4 = r.seat4, wanted = r.wanted, settings = r.settings, status = r.status, game = r.game, ready = r.ready,
        version = r.version, expires_at = r.expires_at, started_at = r.started_at, deadline = r.deadline,
        last_action_at = r.last_action_at, finished_at = r.finished_at, ending = r.ending, places = r.places,
        won = r.won, out_of_game = r.out_of_game, counts = r.counts, stats = r.stats, rematch_game = r.rematch_game
    where g.id = r.id and g.version = expected_version
    returning g.* into saved;
    if not found then
      return;
    end if;
  end if;

  delete from public.card_game_seats s
  where s.game = saved.id
    and s.player not in (select (x ->> 'player')::uuid from jsonb_array_elements(seats) x);
  insert into public.card_game_seats (game, player, seat, version, status, info, view, events, log, updated_at)
  select saved.id, (x ->> 'player')::uuid, (x ->> 'seat')::smallint, saved.version, saved.status, x -> 'info',
         case when x -> 'view' = 'null'::jsonb then null else x -> 'view' end,
         coalesce(x -> 'events', '[]'), public.card_recent_events(coalesce(x -> 'events', '[]')), now()
  from jsonb_array_elements(seats) x
  on conflict (game, player) do update
  set seat = excluded.seat, version = excluded.version, status = excluded.status, info = excluded.info,
      view = excluded.view, events = excluded.events,
      log = public.card_recent_events(card_game_seats.log || excluded.events), updated_at = excluded.updated_at;
  return next saved;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. The "who's here" channel: friend games, space games and 101 games
-- ---------------------------------------------------------------------------

-- Same as Stage 9.4, plus 'card-game:<id>' topics. The Stage 8 policies on realtime.messages
-- (presence only) use this, so 101 games get presence only too.
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
        and s.player = auth.uid()))
$$;

-- ---------------------------------------------------------------------------
-- 4. Scoring
-- ---------------------------------------------------------------------------

alter table public.scored_games add column card_game uuid references public.card_games (id) on delete cascade;
alter table public.scored_games drop constraint scored_games_check;
alter table public.scored_games add constraint scored_games_check check (
  num_nonnulls(bot_game, mp_game, space_game, card_game) = 1
  and (kind = 'bot') = (bot_game is not null)
  and (kind = 'friend') = (mp_game is not null or space_game is not null or card_game is not null));
create unique index scored_games_card on public.scored_games (player, card_game) where card_game is not null;
create index scored_games_card_game on public.scored_games (card_game);

-- Each student in a finished game that counts: 8 for a win, 4 for finishing, for the first
-- 6 such games each NZ day; 0 after that (still in their history). No ratings, ever.
create function public.score_card_game(g public.card_games)
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
  if exists (select 1 from public.scored_games s where s.card_game = g.id) then
    return;
  end if;
  for i in 1..coalesce(array_length(g.counts, 1), 0) loop
    who := seats[i];
    continue when who is null or not coalesce(g.counts[i], false);
    select count(*) into earned_today from public.scored_games s
    where s.player = who and s.game = '101' and s.kind = 'friend' and s.nz_day = day and s.points > 0;
    insert into public.scored_games (player, game, kind, card_game, result, reason, points, finished_at, nz_day, card101)
    values (
      who, '101', 'friend', g.id,
      case when g.won[i] then 'won' else 'lost' end,
      g.ending,
      case when earned_today < public.card101_friend_daily_games()
        then public.card101_friend_points(case when g.won[i] then 'won' else 'lost' end) else 0 end,
      g.finished_at, day,
      g.stats -> (i - 1)
    )
    on conflict do nothing;
    perform public.award_achievements(who, '101', g.finished_at);
  end loop;
end;
$$;

create function public.score_card_game_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.score_card_game(new);
  return null;
exception when others then
  -- Never lose a game because scoring went wrong. rebuild_progress() can fix scores later.
  raise warning 'scoring a 101 game failed (%)', sqlstate;
  return null;
end;
$$;

create trigger score_when_finished
after insert or update of status on public.card_games
for each row
when (new.status = 'finished')
execute function public.score_card_game_trigger();

-- Same as Stage 9.4, with 101 games too.
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
    union all
    select 'card', c.id, c.finished_at from public.card_games c where c.status = 'finished' and true = any (c.counts)
    order by finished_at, id
  loop
    if item.kind = 'bot' then
      perform public.score_bot_game(b) from public.bot_games b where b.id = item.id;
    elsif item.kind = 'friend' then
      perform public.score_friend_game(m) from public.mp_games m where m.id = item.id;
    elsif item.kind = 'space' then
      perform public.score_space_game(s) from public.space_games s where s.id = item.id;
    else
      perform public.score_card_game(c) from public.card_games c where c.id = item.id;
    end if;
  end loop;
  return jsonb_build_object(
    'scored_games', (select count(*) from public.scored_games),
    'achievements', (select count(*) from public.achievements),
    'ratings', (select count(*) from public.ratings)
  );
end;
$$;

-- Same as Stage 9.4, except Recent games' "+8" can point at a 101 game too.
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
    'recent', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', coalesce(x.bot_game, x.mp_game, x.space_game, x.card_game), 'points', x.points)), '[]')
               from (select s.bot_game, s.mp_game, s.space_game, s.card_game, s.points from public.scored_games s
                     where s.player = me.id order by s.finished_at desc limit 20) x)
  )
  from me, totals t
$$;

-- ---------------------------------------------------------------------------
-- 5. Reading, and the server's helpers
-- ---------------------------------------------------------------------------

-- Open 101 games anyone can join, for the lobby. No codes, player IDs or cards.
create function public.card_lobby_games()
returns table (
  id uuid,
  creator_name text,
  creator_avatar jsonb,
  players integer,
  wanted integer,
  target integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, p.display_name, p.avatar, num_nonnulls(g.seat1, g.seat2, g.seat3, g.seat4), g.wanted::integer,
         (g.settings ->> 'target')::integer, g.created_at
  from public.card_games g
  join public.profiles p on p.id = g.host
  where public.is_school_user()
    and (select multiplayer_enabled from public.app_settings)
    and g.status = 'waiting'
    and g.in_lobby
    and g.expires_at > now()
    and not p.hidden
    and num_nonnulls(g.seat1, g.seat2, g.seat3, g.seat4) < g.wanted
    and auth.uid() is distinct from g.seat1 and auth.uid() is distinct from g.seat2
    and auth.uid() is distinct from g.seat3 and auth.uid() is distinct from g.seat4
  order by g.created_at desc
  limit 30
$$;

-- 101 games finished with classmates, and wins. Read from the student's own seat rows (the
-- whole-game table is locked). Games they were out of, or that everyone left, don't count.
create function public.my_card_game_stats()
returns table (played integer, won integer)
language sql
stable
set search_path = ''
as $$
  select count(*)::integer,
         count(*) filter (where (s.info -> 'places' ->> s.seat::integer)::integer = 1)::integer
  from public.card_game_seats s
  where s.player = auth.uid() and s.status = 'finished' and s.info ->> 'ending' = 'finished'
    and coalesce((s.info -> 'places' ->> s.seat::integer)::integer, 0) > 0
$$;

-- For the server: can this student play, have they been hidden, is the teacher switch on, how
-- many 101 games have they started this hour, and which of `others` are hidden or gone.
create function public.card_player_status(player uuid, others uuid[] default '{}')
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
         (select count(*)::integer from public.card_games g
          where g.host = player and g.created_at > now() - interval '1 hour'),
         coalesce((select array_agg(o) from unnest(others) as o
           where o is not null and not exists (
             select 1 from public.profiles p join auth.users u on u.id = p.id
             where p.id = o and not p.hidden and public.is_school_email(u.email))), '{}')
$$;

-- Is this code waiting in any game (chess, checkers, space or 101)? So a new 101 code never
-- means two games at once.
create function public.waiting_code_taken(code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.mp_games g where g.code = waiting_code_taken.code and g.status = 'waiting')
      or exists (select 1 from public.space_games g where g.code = waiting_code_taken.code and g.status = 'waiting')
      or exists (select 1 from public.card_games g where g.code = waiting_code_taken.code and g.status = 'waiting')
$$;

-- Every 5 minutes: waiting games nobody started expire, and games with nothing happening for
-- 10 minutes (everyone has gone) end with no points for anyone. The seat rows say so too.
create function public.card_tidy()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  with expired as (
    update public.card_games
    set status = 'expired', version = version + 1
    where status = 'waiting' and expires_at <= now()
    returning id, version
  )
  update public.card_game_seats s
  set status = 'expired', version = e.version, events = '[]', updated_at = now(),
      info = s.info || jsonb_build_object('status', 'expired', 'version', e.version)
  from expired e where s.game = e.id;

  with ended as (
    update public.card_games
    set status = 'finished',
        ending = 'abandoned',
        counts = array_fill(false, array[num_nonnulls(seat1, seat2, seat3, seat4)]),
        finished_at = now(),
        deadline = null,
        version = version + 1
    where status = 'playing' and last_action_at < now() - interval '10 minutes'
    returning id, version
  )
  update public.card_game_seats s
  set status = 'finished', version = e.version, events = '[]', updated_at = now(),
      info = s.info || jsonb_build_object('status', 'finished', 'version', e.version, 'ending', 'abandoned',
        'deadline', null)
  from ended e where s.game = e.id;
end;
$$;

select cron.schedule('tidy-card-games', '*/5 * * * *', 'select public.card_tidy()');

-- ---------------------------------------------------------------------------
-- 6. Teachers
-- ---------------------------------------------------------------------------

-- Same as Stage 9.4, counting 101 games with classmates as friend games.
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
          where s.status = 'finished' and p.id in (s.seat1, s.seat2, s.seat3, s.seat4))
         + (select count(*)::integer from public.card_games c
          where c.status = 'finished' and p.id in (c.seat1, c.seat2, c.seat3, c.seat4)),
         public.points_total(p.id),
         greatest(
           (select max(b.finished_at) from public.bot_games b where b.player = p.id),
           (select max(m.finished_at) from public.mp_games m
            where m.status = 'finished' and p.id in (m.first_player, m.second_player)),
           (select max(s.finished_at) from public.space_games s
            where s.status = 'finished' and p.id in (s.seat1, s.seat2, s.seat3, s.seat4)),
           (select max(c.finished_at) from public.card_games c
            where c.status = 'finished' and p.id in (c.seat1, c.seat2, c.seat3, c.seat4))),
         p.created_at
  from public.profiles p
  order by p.role desc, p.display_name;
end;
$$;

-- Same as Stage 10.3, with 101 games against classmates in the 101 line and in Recent.
-- "Won" is the lowest total (shared wins too); "left" is a game they were out of, or that
-- everyone left.
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
    ),
    card_mine as (
      select c.id, c.finished_at, c.ending,
             c.places[array_position(array[c.seat1, c.seat2, c.seat3, c.seat4], student)] as place,
             coalesce(c.won[array_position(array[c.seat1, c.seat2, c.seat3, c.seat4], student)], false) as won,
             coalesce(c.out_of_game[array_position(array[c.seat1, c.seat2, c.seat3, c.seat4], student)], false)
               or c.ending = 'abandoned' as left_game
      from public.card_games c
      where c.status = 'finished' and student in (c.seat1, c.seat2, c.seat3, c.seat4)
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
          when g = '101' then
            (select jsonb_build_object(
              'played', count(*), 'won', count(*) filter (where not cm.left_game and cm.won),
              'lost', count(*) filter (where not cm.left_game and not cm.won), 'drawn', 0,
              'left', count(*) filter (where cm.left_game))
             from card_mine cm)
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
          'rank', case when g in ('chess', 'checkers') then
            public.rank_name(public.rank_for(coalesce(r.rating, public.start_rating()), coalesce(r.rated_games, 0))) end,
          'achievements', (select count(*) from public.achievements a
            join public.achievement_types t on t.id = a.achievement where a.player = student and t.game = g)
        ) order by g = '101', g)
        from unnest(array['chess', 'checkers', 'space', '101']) as g
        left join public.ratings r on r.player = student and r.game = g),
      'recent', (select coalesce(jsonb_agg(x order by x.finished_at desc), '[]') from (
          (select b.game, 'bot' as kind, b.bot_level as against, b.result, b.reason, b.finished_at,
                  (coalesce(b.space, b.card101) ->> 'place')::integer as place
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
          union all
          (select '101', 'friend', 'classmates', case when cm.won and not cm.left_game then 'won' else 'lost' end,
                  case when cm.left_game then 'abandoned' else cm.ending end, cm.finished_at,
                  case when cm.left_game then null else cm.place end
           from card_mine cm order by cm.finished_at desc limit 10)
          order by finished_at desc limit 10) x)
    )
    where exists (select 1 from public.profiles p where p.id = student)
  );
end;
$$;

-- Same as Stage 9.4, clearing 101 games too (games still being played are left alone).
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
  card_count integer;
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
  delete from public.card_games where status in ('finished', 'cancelled', 'expired');
  get diagnostics card_count = row_count;
  return jsonb_build_object('botGames', bot_count, 'friendGames', friend_count + space_count + card_count);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.card_game_write(integer, jsonb, jsonb), public.score_card_game(public.card_games),
  public.score_card_game_trigger(), public.card_lobby_games(), public.my_card_game_stats(),
  public.card_player_status(uuid, uuid[]), public.waiting_code_taken(text), public.card_tidy(),
  public.card_recent_events(jsonb)
from public, anon, authenticated;
grant execute on function public.card_lobby_games(), public.my_card_game_stats() to authenticated;
grant execute on function
  public.card_game_write(integer, jsonb, jsonb), public.card_player_status(uuid, uuid[]),
  public.waiting_code_taken(text), public.card_tidy()
to service_role;
