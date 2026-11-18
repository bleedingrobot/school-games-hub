-- Chess looks, stage 2 (docs/CHESS-LOOK-PLAN.md): each pupil's chosen piece set, board and background, and what they
-- have unlocked.
--
-- Unlocks are worked out here from games the server already checked (bot_games and classmate games in mp_games),
-- never by the browser. A New Season deletes those games, so every unlock is written into chess_looks.unlocked the
-- moment a game is saved (the triggers below) and stays there for good.
--
--   1. chess_looks: one row per pupil. RLS on, no policy, nothing granted: pupils read it through my_chess_looks().
--   2. chess_look_facts(moves, white): walks a game's moves and says whether the pupil castled, how many pawns they
--      promoted, and which piece made the last move (for "checkmate with a knight").
--   3. chess_look_rules(): the unlock table from the plan, as (item, measure, need).
--   4. chess_looks_refresh(who): counts who's checked games, adds anything newly earned to unlocked.
--   5. Triggers on bot_games and mp_games call it when a chess game is saved or finishes.
--   6. my_chess_looks(), set_chess_look(kind, item), mark_chess_looks_seen(items): what the pupil's browser calls.
--   7. Back-fill for pupils who have already played.
--
-- Item names are '<kind>:<name>': 'set:wood', 'board:marble', 'bg:forest'. The free ones (Classic set, Classic wood
-- board, Castle hall) are always open and never revealed.

-- 1. The table
create table public.chess_looks (
  player uuid primary key references public.profiles (id) on delete cascade,
  chess_set text not null default 'classic' check (chess_set ~ '^[a-z]{1,20}$'),
  board text not null default 'classic' check (board ~ '^[a-z]{1,20}$'),
  background text not null default 'castle' check (background ~ '^[a-z]{1,20}$'),
  -- Everything earned so far. Only grows, and a New Season leaves it alone.
  unlocked text[] not null default '{}' check (cardinality(unlocked) <= 100),
  -- Unlocks the pupil has already seen burst out of the treasure chest.
  seen text[] not null default '{}' check (cardinality(seen) <= 100),
  updated_at timestamptz not null default now()
);

alter table public.chess_looks enable row level security;
revoke all on public.chess_looks from anon, authenticated;

-- 2. What happened in one game, from the pupil's side. Moves are the short codes the server checked ('e2e4',
-- 'e7e8q'), so they are all legal: the first move off e1 is always the white king's (nothing else can reach e1
-- before the king leaves it), and so on.
create function public.chess_look_facts(
  moves text[],
  white boolean,
  out castled boolean,
  out promotions integer,
  out last_piece text
)
language plpgsql
immutable
set search_path = ''
as $$
declare
  b text[] := string_to_array('RNBQKBNR' || repeat('P', 8) || repeat('.', 32) || repeat('p', 8) || 'rnbqkbnr', null);
  m text;
  i integer := 0;
  f integer;
  t integer;
  piece text;
  mine boolean;
begin
  castled := false;
  promotions := 0;
  last_piece := null;
  foreach m in array coalesce(moves, '{}') loop
    i := i + 1;
    if m !~ '^[a-h][1-8][a-h][1-8][qrbn]?$' then
      return;
    end if;
    mine := (i % 2 = 1) = white;
    f := (ascii(substr(m, 1, 1)) - 97) + (substr(m, 2, 1)::integer - 1) * 8 + 1;
    t := (ascii(substr(m, 3, 1)) - 97) + (substr(m, 4, 1)::integer - 1) * 8 + 1;
    piece := b[f];
    last_piece := case when mine then lower(piece) end;
    if lower(piece) = 'p' and substr(m, 1, 1) <> substr(m, 3, 1) and b[t] = '.' then
      -- En passant: the pawn taken sits beside the one moving, on the rank it moved from.
      b[(ascii(substr(m, 3, 1)) - 97) + (substr(m, 2, 1)::integer - 1) * 8 + 1] := '.';
    elsif lower(piece) = 'k' and abs(ascii(substr(m, 3, 1)) - ascii(substr(m, 1, 1))) = 2 then
      -- Castling: the rook jumps over the king.
      if substr(m, 3, 1) = 'g' then
        b[t - 1] := b[t + 1];
        b[t + 1] := '.';
      else
        b[t + 1] := b[t - 2];
        b[t - 2] := '.';
      end if;
      if mine then
        castled := true;
      end if;
    end if;
    if length(m) = 5 then
      piece := case when i % 2 = 1 then upper(substr(m, 5, 1)) else substr(m, 5, 1) end;
      if mine then
        promotions := promotions + 1;
      end if;
    end if;
    b[t] := piece;
    b[f] := '.';
  end loop;
end;
$$;

-- 3. The unlock table (docs/CHESS-LOOK-PLAN.md "What can be unlocked"). Only games that count (not abandoned, at least
-- 10 of your own moves) count towards anything.
create function public.chess_look_rules()
returns table (item text, measure text, need integer)
language sql
immutable
set search_path = ''
as $$
  values
    ('set:wood', 'games', 3),
    ('set:birds', 'beat_very_easy', 1),
    ('set:ice', 'beat_easy', 1),
    ('set:robot', 'classmate_games', 10),
    ('set:dragon', 'beat_easy', 5),
    ('set:golden', 'wins', 20),
    ('board:marble', 'checkmates', 5),
    ('board:beach', 'black_wins', 1),
    ('board:lava', 'promotions', 3),
    ('board:starfield', 'classmate_wins', 5),
    ('bg:forest', 'castled', 1),
    ('bg:coast', 'wins', 1),
    ('bg:volcano', 'knight_mates', 1),
    ('bg:snow', 'games', 25),
    ('bg:underwater', 'promotions', 1),
    ('bg:space', 'quick_wins', 1)
$$;

-- 4. Counts who's checked chess games and adds anything newly earned. Returns the counts.
create function public.chess_looks_refresh(who uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  counts jsonb;
  earned text[];
begin
  with games as (
    select g.result = 'won' as won, g.reason, g.player_side = 'white' as white, g.bot_level, g.moves,
           g.player_moves as my_moves, false as classmate
    from public.bot_games g
    where g.player = who and g.game = 'chess' and g.counts_for_points
    union all
    select g.winner is not null and (g.winner = 'first') = (g.first_player = who), g.reason, g.first_player = who, null,
           g.moves,
           case when g.first_player = who then (cardinality(g.moves) + 1) / 2 else cardinality(g.moves) / 2 end,
           true
    from public.mp_games g
    where g.game = 'chess' and g.status = 'finished' and g.counts_for_points and who in (g.first_player, g.second_player)
  ),
  played as (
    select games.*, f.castled, f.promotions, f.last_piece
    from games cross join lateral public.chess_look_facts(games.moves, games.white) f
  )
  select jsonb_build_object(
    'games', count(*),
    'classmate_games', count(*) filter (where classmate),
    'wins', count(*) filter (where won),
    'classmate_wins', count(*) filter (where won and classmate),
    'black_wins', count(*) filter (where won and not white),
    'checkmates', count(*) filter (where won and reason = 'checkmate'),
    'knight_mates', count(*) filter (where won and reason = 'checkmate' and last_piece = 'n'),
    'quick_wins', count(*) filter (where won and my_moves < 20),
    'beat_very_easy', count(*) filter (where won and bot_level = 'very-easy'),
    'beat_easy', count(*) filter (where won and bot_level = 'easy'),
    'castled', count(*) filter (where castled),
    'promotions', coalesce(sum(promotions), 0)
  )
  into counts
  from played;

  select coalesce(array_agg(r.item order by r.item), '{}')
  into earned
  from public.chess_look_rules() r
  where (counts ->> r.measure)::integer >= r.need;

  insert into public.chess_looks as l (player, unlocked)
  values (who, earned)
  on conflict (player) do update
  set unlocked = array(select distinct x from unnest(l.unlocked || excluded.unlocked) x order by x),
      updated_at = now()
  where not (excluded.unlocked <@ l.unlocked);

  return counts;
end;
$$;

-- 5. Write unlocks down the moment a chess game is saved (bot games) or finishes (classmate games).
create function public.chess_looks_after_bot_game()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.chess_looks_refresh(new.player);
  return null;
exception when others then
  -- Never lose a saved game because of a look. my_chess_looks() tries again when the pupil next opens chess.
  raise warning 'chess looks after a bot game failed (%)', sqlstate;
  return null;
end;
$$;

create function public.chess_looks_after_friend_game()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.first_player is not null then
    perform public.chess_looks_refresh(new.first_player);
  end if;
  if new.second_player is not null then
    perform public.chess_looks_refresh(new.second_player);
  end if;
  return null;
exception when others then
  raise warning 'chess looks after a classmate game failed (%)', sqlstate;
  return null;
end;
$$;

create trigger chess_looks_after_save
after insert on public.bot_games
for each row
when (new.game = 'chess')
execute function public.chess_looks_after_bot_game();

create trigger chess_looks_when_finished
after insert or update of status on public.mp_games
for each row
when (new.status = 'finished' and new.game = 'chess')
execute function public.chess_looks_after_friend_game();

-- 6. What the pupil's browser calls.

-- The pupil's chosen look, everything they have unlocked, what is new since they last looked, and how far along they
-- are with each unlock (for "Win 3 more games").
create function public.my_chess_looks()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  counts jsonb;
  l public.chess_looks;
begin
  if me is null or not public.is_school_user() then
    raise exception 'Please sign in again.' using errcode = '42501';
  end if;
  counts := public.chess_looks_refresh(me);
  select * into l from public.chess_looks where player = me;
  return jsonb_build_object(
    'set', l.chess_set,
    'board', l.board,
    'background', l.background,
    'unlocked', to_jsonb(l.unlocked),
    'fresh', to_jsonb(array(select x from unnest(l.unlocked) x where not x = any (l.seen) order by x)),
    'progress', (
      select jsonb_object_agg(r.item, jsonb_build_object('have', least((counts ->> r.measure)::integer, r.need), 'need', r.need))
      from public.chess_look_rules() r
    )
  );
end;
$$;

-- Choose a set, board or background. Refuses anything not unlocked yet.
create function public.set_chess_look(kind text, item text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  key text;
begin
  if me is null or not public.is_school_user() then
    raise exception 'Please sign in again.' using errcode = '42501';
  end if;
  key := case kind when 'set' then 'set:' when 'board' then 'board:' when 'background' then 'bg:' end || item;
  if key is null or item !~ '^[a-z]{1,20}$' then
    raise exception 'That isn''t a chess look.' using errcode = '22023';
  end if;
  perform public.chess_looks_refresh(me);
  if key not in ('set:classic', 'board:classic', 'bg:castle')
     and not exists (select 1 from public.chess_looks l where l.player = me and key = any (l.unlocked)) then
    raise exception 'You haven''t unlocked that yet.' using errcode = '42501';
  end if;
  update public.chess_looks
  set chess_set = case when kind = 'set' then item else chess_set end,
      board = case when kind = 'board' then item else board end,
      background = case when kind = 'background' then item else background end,
      updated_at = now()
  where player = me;
  return public.my_chess_looks();
end;
$$;

-- The treasure chest has shown these: don't show them again.
create function public.mark_chess_looks_seen(items text[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.chess_looks l
  set seen = array(select distinct x from unnest(l.seen || array(select i from unnest(items) i where i = any (l.unlocked))) x
                   order by x)
  where l.player = auth.uid() and public.is_school_user() and cardinality(items) <= 100
$$;

-- 7. Pupils who have already played get their unlocks written down now, before any New Season can wipe the games.
select public.chess_looks_refresh(p.who)
from (
  select g.player as who from public.bot_games g where g.game = 'chess'
  union
  select g.first_player from public.mp_games g where g.game = 'chess' and g.status = 'finished'
  union
  select g.second_player from public.mp_games g where g.game = 'chess' and g.status = 'finished'
) p
where p.who is not null;

-- Who can call what.
revoke execute on function public.chess_look_facts(text[], boolean), public.chess_look_rules(),
  public.chess_looks_refresh(uuid), public.chess_looks_after_bot_game(), public.chess_looks_after_friend_game(),
  public.my_chess_looks(), public.set_chess_look(text, text), public.mark_chess_looks_seen(text[])
  from public, anon, authenticated;
grant execute on function public.my_chess_looks(), public.set_chess_look(text, text), public.mark_chess_looks_seen(text[])
  to authenticated;
