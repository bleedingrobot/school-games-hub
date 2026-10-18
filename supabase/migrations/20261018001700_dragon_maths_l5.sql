-- Dragon Maths, stage L.5: the arena, the Daily News, the Warriors list and the Hall of Heroes, points and
-- achievements, the season pause, and the teacher's page. (Plan: docs/LORD-PLAN.md, sections 9 to 11, and "L.5 results".)
--
-- 1. Settings: the school-holiday pause. Switching the game off stops the season clock; switching it on carries on
--    where it left off (teacher_set_lord moves the season's start date forward by the days it was closed).
-- 2. Tables: lord_news (computer-written lines only), lord_hall (who beat the dragon, per season, kept for good) and
--    lord_scores (what a request earned toward points, like monster_events). lord_fights may now hold an 'arena' fight
--    (played by the server in one request) and lord_heroes remembers the wins that haven't made a whole point yet.
-- 3. Saving: lord_commit() also keeps the news lines, the Hall of Heroes entry, an arena fight and the points the
--    request earned, in the same all-or-nothing save as the hero. lord_daily_news() writes the day's own lines
--    (the village event, the computer heroes); lord_arena_candidates() hands the server a few classmates' heroes.
-- 4. Points, inside the same 40-a-day cap as every game against the computer: 1 point per 3 forest wins, 3 for a master,
--    10 for the dragon (lord_point_rules(): the one block of numbers HowPoints.tsx reads). Never ranked.
-- 5. Eight achievements, from the counts the server keeps in each hero's `extra.stats`. progress_counts, progress_rules,
--    rebuild_progress, my_progress, teacher_students and teacher_new_season are redone from their latest versions
--    (Maths Monsters') with Dragon Maths added; nothing of Maths Monsters' is changed.
-- 6. Reading, for pupils: lord_news(), lord_warriors() (level and dragon stars, never maths), lord_hall().
-- 7. Teachers: teacher_lord_class(), teacher_lord_student(), teacher_reset_lord_hero().
-- 8. A new points season clears Dragon Maths' points only. Heroes, stars, the Hall and the achievements all stay.

-- ---------------------------------------------------------------------------
-- 1. The season pause
-- ---------------------------------------------------------------------------

alter table public.app_settings add column lord_paused_since date;

create or replace function public.lord_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('enabled', s.lord_enabled, 'forestPerDay', s.lord_forest_per_day,
    'seasonStart', to_char(s.lord_season_start, 'YYYY-MM-DD'), 'pausedSince', to_char(s.lord_paused_since, 'YYYY-MM-DD'))
  from public.app_settings s
$$;

-- `settings` = { enabled: boolean, forestPerDay?: 1-30, seasonStart?: 'YYYY-MM-DD' | null }.
-- Switching the game on without a start date starts season 1 today. Switching it OFF pauses the season clock
-- (the school holidays); switching it back ON moves the start date forward by the days it was closed, so the
-- season carries on where it left off. Giving a start date yourself wins over the pause.
create or replace function public.teacher_set_lord(settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  per_day integer;
  start date;
  paused date;
  was_on boolean;
  now_on boolean;
  today date := public.nz_day(now());
  from_day date;
begin
  perform public.require_teacher();
  if jsonb_typeof(settings) is distinct from 'object' or jsonb_typeof(settings -> 'enabled') is distinct from 'boolean' then
    raise exception 'Those settings couldn''t be read.' using errcode = '22023';
  end if;
  select s.lord_forest_per_day, s.lord_season_start, s.lord_paused_since, s.lord_enabled
  into per_day, start, paused, was_on from public.app_settings s;
  now_on := (settings ->> 'enabled')::boolean;
  if settings ? 'forestPerDay' then
    if jsonb_typeof(settings -> 'forestPerDay') is distinct from 'number'
       or (settings ->> 'forestPerDay')::numeric <> trunc((settings ->> 'forestPerDay')::numeric)
       or (settings ->> 'forestPerDay')::numeric not between 1 and 30 then
      raise exception 'Forest fights a day must be a whole number from 1 to 30.' using errcode = '22023';
    end if;
    per_day := (settings ->> 'forestPerDay')::integer;
  end if;
  if settings ? 'seasonStart' then
    if jsonb_typeof(settings -> 'seasonStart') = 'null' then
      start := null;
    elsif jsonb_typeof(settings -> 'seasonStart') = 'string' and (settings ->> 'seasonStart') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      start := (settings ->> 'seasonStart')::date;
    else
      raise exception 'That start date couldn''t be read.' using errcode = '22023';
    end if;
    paused := null;
  elsif was_on and not now_on then
    paused := today;
  elsif now_on and not was_on and paused is not null then
    -- Only the days the season was already running count as paused.
    if start is not null then
      from_day := greatest(paused, start);
      if today > from_day then
        start := start + (today - from_day);
      end if;
    end if;
    paused := null;
  end if;
  if now_on and start is null then
    start := today;
  end if;
  update public.app_settings set
    lord_enabled = now_on, lord_forest_per_day = per_day, lord_season_start = start, lord_paused_since = paused
  where id;
  return public.lord_settings();
end;
$$;

-- The season number today (a season is 35 days; shared/lord/data.ts SEASON_DAYS). Null before the first season starts.
create function public.lord_current_season()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when s.lord_season_start is null or public.nz_day(now()) < s.lord_season_start then null
    else ((public.nz_day(now()) - s.lord_season_start) / 35) + 1 end
  from public.app_settings s
$$;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

alter table public.lord_heroes
  -- Forest wins that haven't made a whole point yet (3 make one).
  add column wins_pending integer not null default 0 check (wins_pending between 0 and 2);

-- The arena is played by the server in one request, and stored finished.
alter table public.lord_fights drop constraint lord_fights_kind_check;
alter table public.lord_fights add constraint lord_fights_kind_check check (kind in ('forest', 'master', 'dragon', 'arena'));

-- The Daily News. Every line is written by the code (never by a pupil). `{p}` in the text stands for the pupil's hub
-- name and is filled in when the news is read. One line per day and key, so the same thing can't flood the page.
create table public.lord_news (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  kind text not null check (kind in ('village', 'computer', 'master', 'dragon', 'arena', 'flattened')),
  player uuid references public.profiles (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 300),
  dedupe text not null check (dedupe ~ '^[a-z0-9:-]{1,80}$'),
  created_at timestamptz not null default now(),
  unique (day, dedupe)
);
create index lord_news_recent on public.lord_news (day desc, created_at desc);

-- The Hall of Heroes: who beat the dragon in each season, and how many times. Kept for good.
create table public.lord_hall (
  player uuid not null references public.profiles (id) on delete cascade,
  season integer not null check (season >= 1),
  kills integer not null check (kills >= 1),
  first_at timestamptz not null default now(),
  primary key (player, season)
);

-- What a request earned toward points (like monster_events). A new points season clears these; the heroes stay.
create table public.lord_scores (
  id uuid primary key default gen_random_uuid(),
  player uuid not null references public.profiles (id) on delete cascade,
  forest_wins integer not null check (forest_wins >= 0),
  master_wins integer not null check (master_wins >= 0),
  dragon_wins integer not null check (dragon_wins >= 0),
  points_raw integer not null check (points_raw >= 0),
  counts_for_points boolean not null,
  finished_at timestamptz not null default now()
);
create index lord_scores_player on public.lord_scores (player, finished_at desc);

alter table public.lord_news enable row level security;
alter table public.lord_hall enable row level security;
alter table public.lord_scores enable row level security;
revoke all on public.lord_news, public.lord_hall, public.lord_scores from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Points
-- ---------------------------------------------------------------------------

-- A point for every `forestWinsPerPoint` forest fights won, `masterWin` for each master beaten and `dragonWin` for
-- beating the Red Dragon. Arena fights and maths answers earn no points.
create function public.lord_point_rules() returns jsonb language sql immutable set search_path = ''
as $$ select jsonb_build_object('forestWinsPerPoint', 3, 'masterWin', 3, 'dragonWin', 10) $$;

alter table public.scored_games drop constraint scored_games_game_check;
alter table public.scored_games add constraint scored_games_game_check
  check (game in ('chess', 'checkers', 'space', '101', 'gem-keep', 'power-clash', 'monsters', 'dragon-maths'));
alter table public.scored_games add column lord_score uuid references public.lord_scores (id) on delete cascade;
alter table public.scored_games drop constraint scored_games_check;
alter table public.scored_games add constraint scored_games_check check (
  num_nonnulls(bot_game, mp_game, space_game, card_game, gem_keep_run, power_game, monster_save, lord_score) = 1
  and (kind = 'bot') = (bot_game is not null)
  and (kind = 'friend') = (mp_game is not null or space_game is not null or card_game is not null or power_game is not null)
  and (kind = 'solo') = (gem_keep_run is not null or monster_save is not null or lord_score is not null));
create unique index scored_games_lord on public.scored_games (player, lord_score) where lord_score is not null;
create index scored_games_lord_score on public.scored_games (lord_score);

create function public.score_lord_scores(e public.lord_scores)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  day date := public.nz_day(e.finished_at);
  earned_today integer;
begin
  if not e.counts_for_points then
    return;
  end if;
  -- Shares the bot cap with every other game against the computer.
  select coalesce(sum(s.points), 0) into earned_today
  from public.scored_games s
  where s.player = e.player and s.kind in ('bot', 'solo') and s.nz_day = day;
  insert into public.scored_games (player, game, kind, lord_score, result, reason, points, finished_at, nz_day)
  values (e.player, 'dragon-maths', 'solo', e.id, 'won', 'adventure',
    least(e.points_raw, greatest(public.bot_daily_cap() - earned_today, 0)), e.finished_at, day)
  on conflict do nothing;
end;
$$;

create function public.score_lord_scores_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.score_lord_scores(new);
  return null;
exception when others then
  -- Never lose a save because scoring went wrong. rebuild_progress() can fix scores later.
  raise warning 'scoring a Dragon Maths save failed (%)', sqlstate;
  return null;
end;
$$;

create trigger score_when_saved
after insert on public.lord_scores
for each row
execute function public.score_lord_scores_trigger();

-- What a request earned: the wins that haven't made a whole point yet are kept on the hero (3 forest wins make one).
-- Called by lord_commit() after the hero is saved.
create function public.record_lord_score(player uuid, forest integer, master integer, dragon integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rules jsonb := public.lord_point_rules();
  pending integer;
  raw integer;
begin
  select h.wins_pending into pending from public.lord_heroes h where h.player = record_lord_score.player for update;
  pending := coalesce(pending, 0) + forest;
  raw := (pending / (rules ->> 'forestWinsPerPoint')::integer) + master * (rules ->> 'masterWin')::integer + dragon * (rules ->> 'dragonWin')::integer;
  update public.lord_heroes h set wins_pending = pending % (rules ->> 'forestWinsPerPoint')::integer where h.player = record_lord_score.player;
  insert into public.lord_scores (player, forest_wins, master_wins, dragon_wins, points_raw, counts_for_points)
  values (record_lord_score.player, forest, master, dragon, raw, raw > 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Saving
-- ---------------------------------------------------------------------------

-- The same as before, and it tells the server whether today's own news lines have been written yet.
create or replace function public.load_lord(player uuid, request_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  h public.lord_heroes;
  f public.lord_fights;
begin
  perform public.gem_keep_check_player(player);
  select * into h from public.lord_heroes x where x.player = load_lord.player;
  select * into f from public.lord_fights x where x.player = load_lord.player and x.status = 'open';
  return jsonb_build_object(
    'row', case when h.player is null then null else
      jsonb_build_object('hero', h.hero, 'version', h.version, 'season', h.season, 'extra', h.extra) end,
    'openFight', case when f.id is null then null else
      jsonb_build_object('id', f.id, 'kind', f.kind, 'seed', f.seed, 'start', f.start, 'info', f.options) end,
    'seen', request_id is not null and exists (
      select 1 from public.lord_events e where e.player = load_lord.player and e.request_id = load_lord.request_id),
    'dailyDone', exists (select 1 from public.lord_news n where n.day = public.nz_day(now()) and n.dedupe = 'village'));
end;
$$;

-- One checked change. `change` = { expect, hero, season, extra, openFight, closeFight, event, news, score, hall, doneFight }
-- as the lord function sends it (shared/lord/server.ts `Commit`). Everything happens or nothing does. Returns
-- { status: 'saved' | 'duplicate' | 'stale' | 'open-fight' | 'no-fight', version }.
create or replace function public.lord_commit(player uuid, change jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cur public.lord_heroes;
  expect integer := (change ->> 'expect')::integer;
  req uuid := (change #>> '{event,requestId}')::uuid;
  fight jsonb := change -> 'openFight';
  closing jsonb := change -> 'closeFight';
  done_fight jsonb := change -> 'doneFight';
  score jsonb := change -> 'score';
  line jsonb;
  new_version integer;
begin
  perform public.gem_keep_check_player(player);
  select * into cur from public.lord_heroes h where h.player = lord_commit.player for update;
  if exists (select 1 from public.lord_events e where e.player = lord_commit.player and e.request_id = req) then
    return jsonb_build_object('status', 'duplicate', 'version', coalesce(cur.version, 0));
  end if;
  -- A change follows the version it was made from. Anything else was made from an out-of-date copy.
  if expect <> coalesce(cur.version, 0) then
    return jsonb_build_object('status', 'stale', 'version', coalesce(cur.version, 0));
  end if;
  if (select count(*) from public.lord_events e
      where e.player = lord_commit.player and e.at > now() - interval '1 day') >= 1000 then
    raise exception 'That''s a lot of playing today!' using errcode = '54000';
  end if;

  -- The hero comes first: if two devices race to make the very first save, one of them is told it is out of date
  -- before anything else is written.
  new_version := expect + 1;
  if cur.player is null then
    begin
      insert into public.lord_heroes (player, hero, version, season, day, extra)
      values (lord_commit.player, change -> 'hero', new_version, (change ->> 'season')::integer, change #>> '{hero,day}',
        coalesce(change -> 'extra', '{}'));
    exception when unique_violation then
      return jsonb_build_object('status', 'stale', 'version', 1);
    end;
  else
    update public.lord_heroes h set
      hero = change -> 'hero', version = new_version, season = (change ->> 'season')::integer,
      day = change #>> '{hero,day}', extra = coalesce(change -> 'extra', '{}'), saved_at = now()
    where h.player = lord_commit.player;
  end if;

  -- A fight is finished once. (A refusal below raises, which undoes everything above, hero included.)
  if jsonb_typeof(closing) = 'object' then
    update public.lord_fights f set
      status = closing ->> 'status', actions = closing -> 'actions', result = closing -> 'result', finished_at = now()
    where f.id = (closing ->> 'id')::uuid and f.player = lord_commit.player and f.status = 'open';
    if not found then
      raise exception 'no-fight' using errcode = 'P0001';
    end if;
  end if;
  -- Only one fight is open at a time.
  if jsonb_typeof(fight) = 'object' then
    begin
      insert into public.lord_fights (id, player, kind, monster, seed, start, options)
      values ((fight ->> 'id')::uuid, lord_commit.player, fight ->> 'kind', fight #>> '{start,monster,id}',
        (fight ->> 'seed')::bigint, fight -> 'start', fight -> 'info');
    exception when unique_violation then
      raise exception 'open-fight' using errcode = 'P0001';
    end;
  end if;
  -- An arena fight began and ended in this request: it goes in finished (the two heroes and the seed replay it).
  if jsonb_typeof(done_fight) = 'object' then
    insert into public.lord_fights (id, player, kind, monster, seed, start, options, status, actions, result, finished_at)
    values ((done_fight ->> 'id')::uuid, lord_commit.player, done_fight ->> 'kind', done_fight ->> 'monster',
      (done_fight ->> 'seed')::bigint, done_fight -> 'start', done_fight -> 'info', 'finished', '[]', done_fight -> 'result', now());
  end if;

  -- The Hall of Heroes: the dragon was beaten this season.
  if jsonb_typeof(change -> 'hall') = 'object' then
    insert into public.lord_hall as hl (player, season, kills)
    values (lord_commit.player, (change #>> '{hall,season}')::integer, 1)
    on conflict on constraint lord_hall_pkey do update set kills = hl.kills + 1;
  end if;

  -- News about this pupil only; one line per day and key.
  for line in select * from jsonb_array_elements(coalesce(change -> 'news', '[]')) loop
    insert into public.lord_news (day, kind, player, text, dedupe)
    values (public.nz_day(now()), line ->> 'kind', lord_commit.player, left(line ->> 'text', 300), left(line ->> 'dedupe', 80))
    on conflict (day, dedupe) do nothing;
  end loop;

  -- Points: only what the server worked out the request earned.
  if jsonb_typeof(score) = 'object' then
    perform public.record_lord_score(lord_commit.player, (score ->> 'forest')::integer, (score ->> 'master')::integer, (score ->> 'dragon')::integer);
  end if;

  insert into public.lord_events (player, request_id, action, version, summary)
  values (lord_commit.player, req, change #>> '{event,action}', new_version, coalesce(change #> '{event,summary}', '{}'));

  -- New achievements, when the lifetime counts moved. Never lose a save because of them.
  if (cur.extra -> 'stats') is distinct from (change #> '{extra,stats}') then
    begin
      perform public.award_achievements(lord_commit.player, 'dragon-maths', now());
    exception when others then
      raise warning 'awarding Dragon Maths achievements failed (%)', sqlstate;
    end;
  end if;
  return jsonb_build_object('status', 'saved', 'version', new_version);
exception when raise_exception then
  if sqlerrm in ('open-fight', 'no-fight') then
    return jsonb_build_object('status', sqlerrm, 'version', coalesce(cur.version, 0));
  end if;
  raise;
end;
$$;

-- The day's own news lines (the village event and what the computer heroes did), written by whoever opens the game
-- first. `lines` = [{ kind, text, dedupe }]. A line already there is left alone.
create function public.lord_daily_news(news_day date, lines jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  line jsonb;
begin
  if news_day is distinct from public.nz_day(now()) or jsonb_typeof(lines) is distinct from 'array' then
    raise exception 'That news couldn''t be read.' using errcode = '22023';
  end if;
  for line in select * from jsonb_array_elements(lines) loop
    insert into public.lord_news (day, kind, player, text, dedupe)
    values (news_day, line ->> 'kind', null, left(line ->> 'text', 300), left(line ->> 'dedupe', 80))
    on conflict (day, dedupe) do nothing;
  end loop;
end;
$$;

-- A few classmates' heroes of this season near `lvl`, for the arena: [{ player, name, hero }]. Never the pupil's own,
-- never a hidden profile. Only the server asks; nothing is changed for the classmates.
create function public.lord_arena_candidates(player uuid, season integer, lvl integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  return (
    select coalesce(jsonb_agg(jsonb_build_object('player', x.id, 'name', x.display_name, 'hero', x.hero)), '[]')
    from (
      select p.id, p.display_name, h.hero
      from public.lord_heroes h
      join public.profiles p on p.id = h.player
      where h.season = lord_arena_candidates.season
        and h.player <> lord_arena_candidates.player
        and not p.hidden
        and abs((h.hero ->> 'level')::integer - lvl) <= 2
      order by abs((h.hero ->> 'level')::integer - lvl), random()
      limit 12) x);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Achievements
-- ---------------------------------------------------------------------------

alter table public.achievement_types drop constraint achievement_types_game_check;
alter table public.achievement_types add constraint achievement_types_game_check
  check (game in ('chess', 'checkers', 'space', '101', 'gem-keep', 'power-clash', 'monsters', 'dragon-maths'));
alter table public.achievement_types drop constraint achievement_types_measure_check;
alter table public.achievement_types add constraint achievement_types_measure_check
  check (measure in ('games', 'wins', 'beat_very_easy', 'beat_easy', 'beat_medium', 'friend_wins', 'rank',
    'checkmates', 'crowns', 'friend_games', 'wormholes', 'blocks', 'star_kinds', 'docks',
    'zero_hands', 'triples', 'knock_wins', 'saved_by_three',
    'levels_won', 'level_keys', 'three_star_levels', 'stars',
    'maths_right', 'boosts', 'escapes',
    'all_three_powers', 'body_swap_wins', 'no_power_wins',
    'monster_catches', 'monster_owned', 'monster_badges', 'monster_finals',
    'lord_masters', 'lord_best_level', 'lord_arena_wins', 'lord_riddles', 'lord_forest_wins', 'lord_dragons'));

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('dm-first-master', 'dragon-maths', 'Beat your first master', '🥋', 'lord_masters', 1, 1),
  ('dm-level-6', 'dragon-maths', 'Reach level 6', '⚔️', 'lord_best_level', 6, 2),
  ('dm-level-12', 'dragon-maths', 'Reach level 12', '🛡️', 'lord_best_level', 12, 3),
  ('dm-dragon', 'dragon-maths', 'Beat the Red Dragon', '🐉', 'lord_dragons', 1, 4),
  ('dm-dragon-2', 'dragon-maths', 'Beat the Red Dragon twice', '🔥', 'lord_dragons', 2, 5),
  ('dm-forest-50', 'dragon-maths', 'Win 50 forest fights', '🌲', 'lord_forest_wins', 50, 6),
  ('dm-arena-10', 'dragon-maths', 'Win 10 arena fights', '🏟️', 'lord_arena_wins', 10, 7),
  ('dm-riddles-50', 'dragon-maths', 'Solve 50 riddles and puzzles', '🧩', 'lord_riddles', 50, 8);

-- Same as Maths Monsters', plus Dragon Maths' counts (read from each hero's lifetime counts).
create or replace function public.progress_counts(who uuid, which_game text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'games', count(*),
    'wins', count(*) filter (where s.result = 'won'),
    'beat_very_easy', count(*) filter (where s.result = 'won' and s.bot_level = 'very-easy'),
    'beat_easy', count(*) filter (where s.result = 'won' and s.bot_level = 'easy'),
    'beat_medium', count(*) filter (where s.result = 'won' and s.bot_level = 'medium'),
    'friend_wins', count(*) filter (where s.result = 'won' and s.kind = 'friend'),
    'checkmates', count(*) filter (where s.result = 'won' and s.reason = 'checkmate'),
    'crowns', coalesce(sum(s.crowns), 0),
    'rank', coalesce((select r.best_rank from public.ratings r where r.player = who and r.game = which_game), 0),
    'friend_games', count(*) filter (where s.kind = 'friend'),
    'wormholes', coalesce(sum((s.space ->> 'wormholes')::integer), 0),
    'blocks', coalesce(sum((s.space ->> 'blocks')::integer), 0),
    'docks', count(*) filter (where (s.space ->> 'docked')::boolean),
    'star_kinds', (select count(distinct star) from public.scored_games s2,
                     jsonb_array_elements_text(coalesce(s2.space -> 'stars', '[]')) as star
                   where s2.player = who and s2.game = which_game),
    'maths_right', coalesce(sum((s.space ->> 'mathsRight')::integer), 0),
    'boosts', coalesce(sum((s.space ->> 'boosts')::integer), 0),
    'escapes', coalesce(sum((s.space ->> 'escapes')::integer), 0),
    'zero_hands', coalesce(sum((s.card101 ->> 'zeroHands')::integer), 0),
    'triples', coalesce(sum((s.card101 ->> 'triples')::integer), 0),
    'knock_wins', coalesce(sum((s.card101 ->> 'knockWins')::integer), 0),
    'saved_by_three', coalesce(sum((s.card101 ->> 'savedByThree')::integer), 0),
    'levels_won', (select count(*) from public.gem_keep_progress g where g.player = who and g.wins > 0),
    'level_keys', (select count(*) from public.gem_keep_progress g where g.player = who and g.key_passed),
    'three_star_levels', (select count(*) from public.gem_keep_progress g where g.player = who and g.best_stars = 3),
    'stars', (select coalesce(sum(g.best_stars), 0) from public.gem_keep_progress g where g.player = who),
    'all_three_powers', count(*) filter (where (s.power_clash ->> 'powersUsed')::integer >= 3),
    'body_swap_wins', coalesce(sum((s.power_clash ->> 'bodySwapWins')::integer), 0),
    'no_power_wins', count(*) filter (where (s.power_clash ->> 'noPowerWin')::boolean),
    'monster_catches', (select coalesce(sum(m.catches), 0) from public.monster_saves m where m.player = who),
    'monster_owned', (select coalesce(sum(m.owned_count), 0) from public.monster_saves m where m.player = who),
    'monster_badges', (select coalesce(sum(m.badges_count), 0) from public.monster_saves m where m.player = who),
    'monster_finals', (select coalesce(sum(m.final_in_team), 0) from public.monster_saves m where m.player = who),
    'lord_masters', (select coalesce(sum((h.extra -> 'stats' ->> 'masterWins')::integer), 0) from public.lord_heroes h where h.player = who),
    'lord_best_level', (select coalesce(max((h.extra -> 'stats' ->> 'bestLevel')::integer), 0) from public.lord_heroes h where h.player = who),
    'lord_arena_wins', (select coalesce(sum((h.extra -> 'stats' ->> 'arenaWins')::integer), 0) from public.lord_heroes h where h.player = who),
    'lord_riddles', (select coalesce(sum((h.extra -> 'stats' ->> 'riddles')::integer), 0) from public.lord_heroes h where h.player = who),
    'lord_forest_wins', (select coalesce(sum((h.extra -> 'stats' ->> 'forestWins')::integer), 0) from public.lord_heroes h where h.player = who),
    'lord_dragons', (select coalesce(sum((h.extra -> 'stats' ->> 'dragons')::integer), 0) from public.lord_heroes h where h.player = who)
  )
  from public.scored_games s
  where s.player = who and s.game = which_game
$$;

-- Same as Maths Monsters', plus Dragon Maths' rules (hidden while the game is switched off).
create or replace function public.progress_rules()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'bot', (select jsonb_object_agg(level, jsonb_build_object(
              'lost', public.bot_points(level, 'lost'),
              'drawn', public.bot_points(level, 'drawn'),
              'won', public.bot_points(level, 'won')))
            from unnest(array['very-easy', 'easy', 'medium']) as level),
    'friend', jsonb_build_object('lost', public.friend_points('lost'), 'drawn', public.friend_points('drawn'),
              'won', public.friend_points('won')),
    'space', jsonb_build_object('bot', public.space_bot_points(), 'friend', public.space_friend_points(),
              'friendDailyGames', public.space_friend_daily_games(), 'minTurns', 5),
    'card101', jsonb_build_object('friendLost', public.card101_friend_points('lost'),
              'friendWon', public.card101_friend_points('won'),
              'friendDailyGames', public.card101_friend_daily_games(), 'minRounds', public.card101_min_rounds()),
    'gemKeep', jsonb_build_object(
              'won', jsonb_build_array(public.gem_keep_points('won', 1), public.gem_keep_points('won', 2),
                public.gem_keep_points('won', 3)),
              'lost', public.gem_keep_points('lost', 0), 'minWavesForLoss', public.gem_keep_min_waves_for_loss()),
    'powerClash', jsonb_build_object('bot', public.power_clash_bot_points(), 'friend', public.power_clash_friend_points(),
              'friendDailyGames', public.power_clash_friend_daily_games()),
    -- Hidden while the game is switched off.
    'monsters', case when (select a.monsters_enabled from public.app_settings a) then public.monster_point_rules() end,
    'dragonMaths', case when (select a.lord_enabled from public.app_settings a) then public.lord_point_rules() end,
    'botDailyCap', public.bot_daily_cap(),
    'pairDailyLimit', public.pair_daily_limit(),
    'achievementPoints', public.achievement_points(),
    'levels', (select jsonb_agg(public.level_start(l) order by l) from generate_series(1, 10) as l),
    'ratingK', public.rating_k(),
    'weeklyMinGames', 3,
    'allTimeMinGames', 5,
    'improvedMinGames', 3,
    'championMinGames', 15
  )
  where public.is_school_user()
$$;

-- Same as Maths Monsters', plus Dragon Maths' scores.
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
    union all
    select 'power', p.id, p.finished_at from public.power_games p where p.status = 'finished' and true = any (p.counts)
    union all
    select 'gem', r.id, r.finished_at from public.gem_keep_runs r where r.counts_for_points
    union all
    select 'monster', e.id, e.finished_at from public.monster_events e where e.counts_for_points
    union all
    select 'lord', l.id, l.finished_at from public.lord_scores l where l.counts_for_points
    order by finished_at, id
  loop
    if item.kind = 'bot' then
      perform public.score_bot_game(b) from public.bot_games b where b.id = item.id;
    elsif item.kind = 'friend' then
      perform public.score_friend_game(m) from public.mp_games m where m.id = item.id;
    elsif item.kind = 'space' then
      perform public.score_space_game(s) from public.space_games s where s.id = item.id;
    elsif item.kind = 'card' then
      perform public.score_card_game(c) from public.card_games c where c.id = item.id;
    elsif item.kind = 'power' then
      perform public.score_power_game(p) from public.power_games p where p.id = item.id;
    elsif item.kind = 'monster' then
      perform public.score_monster_events(e) from public.monster_events e where e.id = item.id;
    elsif item.kind = 'lord' then
      perform public.score_lord_scores(l) from public.lord_scores l where l.id = item.id;
    else
      perform public.score_gem_keep_run(r) from public.gem_keep_runs r where r.id = item.id;
    end if;
  end loop;
  -- Gem Keep, Maths Monsters and Dragon Maths achievements come from progress a rebuild doesn't touch.
  perform public.award_achievements(g.player, 'gem-keep', now())
  from (select distinct player from public.gem_keep_progress) g;
  perform public.award_achievements(m.player, 'monsters', now())
  from (select player from public.monster_saves) m;
  perform public.award_achievements(d.player, 'dragon-maths', now())
  from (select player from public.lord_heroes) d;
  return jsonb_build_object(
    'scored_games', (select count(*) from public.scored_games),
    'achievements', (select count(*) from public.achievements),
    'ratings', (select count(*) from public.ratings)
  );
end;
$$;

-- Same as Maths Monsters', except Recent games' "+5" can point at a Dragon Maths score too, and Dragon Maths'
-- achievements are hidden while the game is switched off.
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
              left join public.achievements a on a.player = me.id and a.achievement = at.id
              -- Maths Monsters' and Dragon Maths' achievements are hidden while the game is switched off.
              where (at.game <> 'monsters' or (select s.monsters_enabled from public.app_settings s))
                and (at.game <> 'dragon-maths' or (select s.lord_enabled from public.app_settings s))),
    'recent', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', coalesce(x.bot_game, x.mp_game, x.space_game, x.card_game, x.gem_keep_run, x.power_game, x.monster_save, x.lord_score),
                 'points', x.points)), '[]')
               from (select s.bot_game, s.mp_game, s.space_game, s.card_game, s.gem_keep_run, s.power_game, s.monster_save, s.lord_score, s.points
                     from public.scored_games s
                     where s.player = me.id order by s.finished_at desc limit 20) x)
  )
  from me, totals t
$$;

-- Same as Maths Monsters', counting Dragon Maths heroes in "last played".
drop function public.teacher_students();

create function public.teacher_students()
returns table (
  id uuid,
  display_name text,
  real_name text,
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
  select p.id, p.display_name, split_part(u.email, '@', 1)::text, p.avatar, p.role, p.hidden,
         (select count(*)::integer from public.bot_games b where b.player = p.id)
         + (select count(*)::integer from public.gem_keep_runs r where r.player = p.id),
         (select count(*)::integer from public.mp_games m
          where m.status = 'finished' and p.id in (m.first_player, m.second_player))
         + (select count(*)::integer from public.space_games s
          where s.status = 'finished' and p.id in (s.seat1, s.seat2, s.seat3, s.seat4))
         + (select count(*)::integer from public.card_games c
          where c.status = 'finished' and p.id in (c.seat1, c.seat2, c.seat3, c.seat4))
         + (select count(*)::integer from public.power_games pg
          where pg.status = 'finished' and p.id in (pg.seat1, pg.seat2)),
         public.points_total(p.id),
         greatest(
           (select max(b.finished_at) from public.bot_games b where b.player = p.id),
           (select max(m.finished_at) from public.mp_games m
            where m.status = 'finished' and p.id in (m.first_player, m.second_player)),
           (select max(s.finished_at) from public.space_games s
            where s.status = 'finished' and p.id in (s.seat1, s.seat2, s.seat3, s.seat4)),
           (select max(c.finished_at) from public.card_games c
            where c.status = 'finished' and p.id in (c.seat1, c.seat2, c.seat3, c.seat4)),
           (select max(pg.finished_at) from public.power_games pg
            where pg.status = 'finished' and p.id in (pg.seat1, pg.seat2)),
           (select max(r.finished_at) from public.gem_keep_runs r where r.player = p.id),
           (select m.saved_at from public.monster_saves m where m.player = p.id),
           (select l.saved_at from public.lord_heroes l where l.player = p.id)),
         p.created_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  order by p.role desc, split_part(u.email, '@', 1), p.display_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. A new points season: points only
-- ---------------------------------------------------------------------------

-- Same as Maths Monsters' latest, except that Dragon Maths keeps its heroes, dragon stars, Hall of Heroes and
-- achievements. Only its points go (the scores that carried them, and the wins that hadn't made a point yet).
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
  power_count integer;
  gem_count integer;
begin
  perform public.require_teacher();
  if confirm is distinct from 'NEW SEASON' then
    raise exception 'Type NEW SEASON to start a new season.' using errcode = '22023';
  end if;
  delete from public.achievements
  where achievement not in (select t.id from public.achievement_types t where t.game in ('monsters', 'dragon-maths'));
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
  delete from public.power_games where status in ('finished', 'cancelled', 'expired');
  get diagnostics power_count = row_count;
  delete from public.gem_keep_runs where true;
  get diagnostics gem_count = row_count;
  delete from public.gem_keep_progress where true;
  delete from public.gem_keep_facts where pack = 'times-tables';
  delete from public.fact_answer_batches where true;
  -- Maths Monsters: the points go, the adventure stays.
  delete from public.monster_events where true;
  update public.monster_saves set wild_wins_pending = 0;
  -- Dragon Maths: the points go, the heroes, stars, Hall of Heroes and achievements stay.
  delete from public.lord_scores where true;
  update public.lord_heroes set wins_pending = 0;
  return jsonb_build_object('botGames', bot_count, 'friendGames', friend_count + space_count + card_count + power_count,
    'gemKeepLevels', gem_count);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Reading, for pupils
-- ---------------------------------------------------------------------------

-- The last few days of the Daily News, newest first, with the pupil's hub name filled in. Hidden profiles leave no lines.
create function public.lord_news()
returns table (
  day date,
  kind text,
  line text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_school_user() then
    return;
  end if;
  return query
  select n.day, n.kind, replace(n.text, '{p}', coalesce(p.display_name, 'A hero'))
  from public.lord_news n
  left join public.profiles p on p.id = n.player
  where n.day >= public.nz_day(now()) - 3 and (n.player is null or not p.hidden)
  order by n.day desc, n.created_at desc
  limit 60;
end;
$$;

-- The Warriors list for this season: most dragons beaten this season, then highest level. Level and dragon stars only,
-- never maths. Top 10, plus you.
create function public.lord_warriors()
returns table (
  place integer,
  display_name text,
  avatar jsonb,
  level integer,
  stars integer,
  dragons integer,
  is_me boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_school_user() then
    return;
  end if;
  return query
  with cur as (select public.lord_current_season() as n),
  base as (
    select p.id, p.display_name as name, p.avatar as pic,
           (h.hero ->> 'level')::integer as hero_level,
           coalesce((h.hero ->> 'dragonKills')::integer, 0) as hero_stars,
           coalesce((h.hero ->> 'exp')::numeric, 0) as hero_exp,
           coalesce((select hl.kills from public.lord_hall hl where hl.player = h.player and hl.season = cur.n), 0) as season_kills
    from public.lord_heroes h
    join public.profiles p on p.id = h.player
    cross join cur
    where h.season = cur.n and not p.hidden
  ),
  placed as (
    select b.*,
           rank() over (order by b.season_kills desc, b.hero_level desc)::integer as pl,
           row_number() over (order by b.season_kills desc, b.hero_level desc, b.hero_exp desc, b.name) as row_order
    from base b
  )
  select x.pl, x.name, x.pic, x.hero_level, x.hero_stars, x.season_kills::integer, x.id = auth.uid()
  from placed x
  where x.row_order <= 10 or x.id = auth.uid()
  order by x.row_order;
end;
$$;

-- The Hall of Heroes: who beat the Red Dragon in each season, and how many times. Newest season first.
create function public.lord_hall()
returns table (
  season integer,
  display_name text,
  avatar jsonb,
  kills integer,
  is_me boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_school_user() then
    return;
  end if;
  return query
  select hl.season, p.display_name, p.avatar, hl.kills, hl.player = auth.uid()
  from public.lord_hall hl
  join public.profiles p on p.id = hl.player
  where not p.hidden
  order by hl.season desc, hl.kills desc, hl.first_at
  limit 100;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Teachers
-- ---------------------------------------------------------------------------

-- The whole school's Dragon Maths: where the season is, how many play and at which level, the questions most often
-- wrong (asked at least 6 times, by at least 2 players), the requests the server turned down and the Hall of Heroes.
create function public.teacher_lord_class()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  return (
    with students as (select p.id from public.profiles p where p.role = 'student'),
    heroes as (select h.player, h.season, h.hero from public.lord_heroes h join students s on s.id = h.player)
    select jsonb_build_object(
      'season', (select jsonb_build_object(
          'number', public.lord_current_season(),
          'start', to_char(a.lord_season_start, 'YYYY-MM-DD'),
          'daysLeft', case when public.lord_current_season() is null then null
                           else 35 - (((public.nz_day(now()) - a.lord_season_start) % 35) + 1) end)
        from public.app_settings a),
      'players', (select count(*) from heroes),
      'thisSeason', (select count(*) from heroes x where x.season = public.lord_current_season()),
      'levels', (select coalesce(jsonb_agg(y.c order by y.i), '[]') from (
          select n.i, (select count(*) from heroes x
                       where x.season = public.lord_current_season() and (x.hero ->> 'level')::integer = n.i) as c
          from generate_series(1, 12) as n(i)) y),
      'hardest', (select coalesce(jsonb_agg(jsonb_build_object(
          'pack', z.pack, 'key', z.fact_key, 'students', z.students, 'attempts', z.attempts, 'correct', z.correct)
          order by z.wrong_share desc, z.attempts desc), '[]')
        from (select f.pack, f.fact_key, count(*) as students, sum(f.attempts) as attempts, sum(f.correct) as correct,
                     1 - sum(f.correct)::numeric / sum(f.attempts) as wrong_share
              from public.gem_keep_facts f join heroes x on x.player = f.player
              where f.attempts > 0
              group by f.pack, f.fact_key
              having sum(f.attempts) >= 6 and count(*) >= 2 and sum(f.correct) < sum(f.attempts)
              order by wrong_share desc, attempts desc
              limit 12) z),
      'refusals', (select coalesce(jsonb_agg(jsonb_build_object(
          'name', w.display_name, 'realName', w.real_name, 'reason', w.reason, 'action', w.action, 'at', w.at) order by w.at desc), '[]')
        from (select p.display_name, split_part(u.email, '@', 1) as real_name, r.reason, r.action, r.at
              from public.lord_refusals r
              join public.profiles p on p.id = r.player
              left join auth.users u on u.id = p.id
              where r.at > now() - interval '14 days'
              order by r.at desc limit 20) w),
      'hall', (select coalesce(jsonb_agg(jsonb_build_object(
          'season', v.season, 'name', v.display_name, 'realName', v.real_name, 'kills', v.kills) order by v.season desc, v.kills desc, v.first_at), '[]')
        from (select hl.season, p.display_name, split_part(u.email, '@', 1) as real_name, hl.kills, hl.first_at
              from public.lord_hall hl
              join public.profiles p on p.id = hl.player
              left join auth.users u on u.id = p.id
              order by hl.season desc, hl.kills desc, hl.first_at limit 60) v)
    )
  );
end;
$$;

-- One pupil's Dragon Maths: their hero at a glance, how they are getting on in each topic, and the questions they
-- get wrong most.
create function public.teacher_lord_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  return jsonb_build_object(
    'hero', (select jsonb_build_object(
        'level', (h.hero ->> 'level')::integer, 'heroClass', h.hero ->> 'heroClass', 'exp', (h.hero ->> 'exp')::numeric,
        'stars', coalesce((h.hero ->> 'dragonKills')::integer, 0), 'season', h.season, 'savedAt', h.saved_at,
        'stats', h.extra -> 'stats',
        'hall', (select coalesce(sum(hl.kills), 0) from public.lord_hall hl where hl.player = student))
      from public.lord_heroes h where h.player = student),
    'topics', (select coalesce(jsonb_agg(jsonb_build_object(
        'pack', x.pack, 'facts', x.facts, 'attempts', x.attempts, 'correct', x.correct, 'fluent', x.fluent) order by x.pack), '[]')
      from (select f.pack, count(*) as facts, sum(f.attempts) as attempts, sum(f.correct) as correct,
                   count(*) filter (where f.box >= 4) as fluent
            from public.gem_keep_facts f where f.player = student group by f.pack) x),
    'hardest', (select coalesce(jsonb_agg(jsonb_build_object(
        'pack', y.pack, 'key', y.fact_key, 'attempts', y.attempts, 'correct', y.correct) order by y.wrong_share desc, y.attempts desc), '[]')
      from (select f.pack, f.fact_key, f.attempts, f.correct, 1 - f.correct::numeric / f.attempts as wrong_share
            from public.gem_keep_facts f
            where f.player = student and f.attempts >= 3 and f.correct < f.attempts
            order by wrong_share desc, f.attempts desc limit 8) y),
    'refused', (select count(*) from public.lord_refusals r where r.player = student and r.at > now() - interval '7 days')
  );
end;
$$;

-- Starts one pupil's hero again: the hero and any fight in progress go, and they pick a class next time they play.
-- Their points, achievements and Hall of Heroes entries stay.
create function public.teacher_reset_lord_hero(student uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  had boolean;
begin
  perform public.require_teacher();
  update public.lord_fights f set status = 'abandoned', finished_at = now() where f.player = student and f.status = 'open';
  delete from public.lord_heroes h where h.player = student;
  get diagnostics had = row_count;
  return jsonb_build_object('reset', had);
end;
$$;

-- ---------------------------------------------------------------------------
-- Tidying
-- ---------------------------------------------------------------------------

-- News is read for three days; a month is plenty to keep. Scores and the Hall are kept (they carry points and glory).
select cron.schedule('trim-lord-news', '37 3 * * *', $$delete from public.lord_news where day < public.nz_day(now()) - 30$$);

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.lord_current_season(), public.lord_point_rules(), public.score_lord_scores(public.lord_scores), public.score_lord_scores_trigger(),
  public.record_lord_score(uuid, integer, integer, integer), public.lord_daily_news(date, jsonb), public.lord_arena_candidates(uuid, integer, integer),
  public.lord_news(), public.lord_warriors(), public.lord_hall(),
  public.teacher_lord_class(), public.teacher_lord_student(uuid), public.teacher_reset_lord_hero(uuid),
  public.teacher_students()
from public, anon, authenticated;
grant execute on function
  public.lord_news(), public.lord_warriors(), public.lord_hall(),
  public.teacher_lord_class(), public.teacher_lord_student(uuid), public.teacher_reset_lord_hero(uuid), public.teacher_students()
to authenticated;
grant execute on function
  public.lord_daily_news(date, jsonb), public.lord_arena_candidates(uuid, integer, integer)
to service_role;
