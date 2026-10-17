-- Maths Monsters, stage N.6: saving, points, achievements, the "most monsters" board and the
-- teacher's switches. (Plan: docs/MONSTER-PLAN.md, sections 8 and 9, and "N.6 results".)
--
-- 1. Tables: monster_saves (one row per student: the whole game as JSON, plus a version number and
--    the counts the board and achievements read), monster_events (one row per accepted save: what
--    happened since the one before, with each battle's actions and random numbers) and
--    monster_refusals (saves the server check turned down, for the teacher page). Students can't
--    read or write any of them directly: they read their own through my_monsters(), and only the
--    `monster` server function writes (through record_monster_save() below).
-- 2. Teacher settings on app_settings: the game switch (OFF until a teacher turns it on) and the
--    topics that are on. Changed through teacher_set_monsters().
-- 3. Saving, for the server only. A save must follow the one before it (seq = version + 1) and is
--    kept only once (save_id). Points and the counts are worked out here from the numbers the server
--    function found when it checked the save.
-- 4. Scoring, inside the same 40-a-day cap as bot games: 1 point per 3 wild battles won, 3 per
--    trainer won, 8 for a Tower badge (the first time only). One block of numbers: monster_point_rules().
-- 5. Eight achievements, from the counts in monster_saves.
-- 6. Reading: my_monsters(), monsters_leaderboard() (most monsters owned, never maths accuracy).
-- 7. Teachers: teacher_monster_student(), teacher_monster_class() (hardest questions per topic,
--    refused saves).
-- 8. A new season clears points only: the adventure (team, box, badges, monster book) and the
--    Maths Monsters achievements stay; the maths records of the five new topics stay too, and the
--    times-table records are cleared with Gem Keep's, as before.
--
-- Times-table records and the records of the five new topics are kept in gem_keep_facts (they are
-- the student's learning data, whatever game they came from), so its key rule is widened here.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table public.monster_saves (
  player uuid primary key references public.profiles (id) on delete cascade,
  -- The WorldState, already checked by the monster function.
  world jsonb not null,
  -- 1 for the first save, one more each time. A save must be version + 1 to be kept.
  version integer not null check (version >= 1),
  last_save_id uuid not null,
  saved_at timestamptz not null default now(),
  -- The device's clock at that save (milliseconds since 1970), for the speed checks.
  client_at bigint not null,
  -- Wild battles won that haven't made a whole point yet (3 make one).
  wild_wins_pending integer not null default 0 check (wild_wins_pending between 0 and 2),
  -- What the board and the achievements read.
  catches integer not null default 0 check (catches >= 0),
  owned_count integer not null default 0 check (owned_count >= 0),
  seen_count integer not null default 0 check (seen_count >= 0),
  badges_count integer not null default 0 check (badges_count between 0 and 6),
  final_in_team integer not null default 0 check (final_in_team between 0 and 6),
  created_at timestamptz not null default now()
);

create table public.monster_events (
  id uuid primary key default gen_random_uuid(),
  player uuid not null references public.profiles (id) on delete cascade,
  -- Made by the browser, so a save sent twice is only kept once.
  save_id uuid not null,
  version integer not null check (version >= 1),
  -- The battles in this save, as reported and replayed. Emptied after 30 days (the rows stay: they carry the points).
  battles jsonb,
  wild_wins integer not null check (wild_wins >= 0),
  trainer_wins integer not null check (trainer_wins >= 0),
  new_badges text[] not null default '{}',
  catches integer not null check (catches >= 0),
  questions integer not null check (questions >= 0),
  right_answers integer not null check (right_answers between 0 and questions),
  points_raw integer not null check (points_raw >= 0),
  counts_for_points boolean not null,
  finished_at timestamptz not null default now(),
  unique (player, save_id)
);
create index monster_events_player on public.monster_events (player, finished_at desc);

-- Saves the server check turned down. Only a short code (never the save itself).
create table public.monster_refusals (
  id uuid primary key default gen_random_uuid(),
  player uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason ~ '^[a-z0-9-]{1,40}$'),
  seq integer,
  at timestamptz not null default now()
);
create index monster_refusals_recent on public.monster_refusals (at desc);

alter table public.monster_saves enable row level security;
alter table public.monster_events enable row level security;
alter table public.monster_refusals enable row level security;
revoke all on public.monster_saves, public.monster_events, public.monster_refusals from anon, authenticated;

-- Times-table records and the new topics' records live in gem_keep_facts. Their keys look like
-- "mul:7x8", "add:7+8" or "pv:round10": lower-case letters, digits and + - / :
alter table public.gem_keep_facts drop constraint gem_keep_facts_fact_key_check;
alter table public.gem_keep_facts add constraint gem_keep_facts_fact_key_check
  check (fact_key ~ '^[a-z]{1,10}:[a-z0-9:+/-]{1,40}$');

-- ---------------------------------------------------------------------------
-- 2. Teacher settings (school-wide: the hub has no classes)
-- ---------------------------------------------------------------------------

alter table public.app_settings
  -- OFF until a teacher says go: the card is hidden and saving is refused.
  add column monsters_enabled boolean not null default false,
  add column monsters_topics text[] not null default '{place-value,add-sub,times-tables,division,fractions,decimals}'
    check (monsters_topics <@ '{place-value,add-sub,times-tables,division,fractions,decimals}' and cardinality(monsters_topics) >= 1);

create function public.monsters_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('enabled', s.monsters_enabled, 'topics', to_jsonb(s.monsters_topics))
  from public.app_settings s
$$;

-- `settings` = { enabled: boolean, topics: ['place-value', ...] }. At least one topic stays on.
create function public.teacher_set_monsters(settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  topics text[];
begin
  perform public.require_teacher();
  if jsonb_typeof(settings) is distinct from 'object'
     or jsonb_typeof(settings -> 'enabled') is distinct from 'boolean'
     or jsonb_typeof(settings -> 'topics') is distinct from 'array' then
    raise exception 'Those settings couldn''t be read.' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct t order by t), '{}') into topics
  from jsonb_array_elements_text(settings -> 'topics') as t;
  if cardinality(topics) <> jsonb_array_length(settings -> 'topics')
     or not topics <@ '{place-value,add-sub,times-tables,division,fractions,decimals}' then
    raise exception 'Those topics couldn''t be read.' using errcode = '22023';
  end if;
  if cardinality(topics) = 0 then
    raise exception 'Leave at least one topic on.' using errcode = '22023';
  end if;
  update public.app_settings set
    monsters_enabled = (settings ->> 'enabled')::boolean,
    monsters_topics = topics
  where id;
  return public.monsters_settings();
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. The points (the one block of numbers; HowPoints.tsx and the teacher text read it)
-- ---------------------------------------------------------------------------

-- A point for every `wildWinsPerPoint` wild battles won, `trainerWin` for each trainer won, `badge`
-- for a Tower badge (the first time only: a badge can only be earned once).
create function public.monster_point_rules() returns jsonb language sql immutable set search_path = ''
as $$ select jsonb_build_object('wildWinsPerPoint', 3, 'trainerWin', 3, 'badge', 8) $$;

-- ---------------------------------------------------------------------------
-- 3. Saving (server only: the monster function checks the save first)
-- ---------------------------------------------------------------------------

-- The last good save, for the server to check the next one against. Null for a new player.
create function public.load_monster_save(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.monster_saves;
begin
  perform public.gem_keep_check_player(player);
  select * into s from public.monster_saves m where m.player = load_monster_save.player;
  if not found then
    return null;
  end if;
  return jsonb_build_object('world', s.world, 'version', s.version, 'clientAt', s.client_at);
end;
$$;

-- One checked save. `save` = { saveId, seq, at, world, battles, summary: { wildWins, trainerWins,
-- newBadges, catches, questions, right, owned, seen, badges, finalInTeam } }.
-- Returns { status: 'saved' | 'duplicate' | 'stale', version, points }.
create function public.record_monster_save(player uuid, save jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cur public.monster_saves;
  new_id uuid;
  rules jsonb := public.monster_point_rules();
  smry jsonb := save -> 'summary';
  wild integer := (smry ->> 'wildWins')::integer;
  trainers integer := (smry ->> 'trainerWins')::integer;
  badges integer := jsonb_array_length(smry -> 'newBadges');
  pending integer;
  raw integer;
begin
  perform public.gem_keep_check_player(player);
  select * into cur from public.monster_saves m where m.player = record_monster_save.player for update;
  if exists (select 1 from public.monster_events e
             where e.player = record_monster_save.player and e.save_id = (save ->> 'saveId')::uuid) then
    return jsonb_build_object('status', 'duplicate', 'version', coalesce(cur.version, 0), 'points', null);
  end if;
  -- A save follows the one before it. Anything else was made from an out-of-date copy (or lost one on the way).
  if (save ->> 'seq')::integer <> coalesce(cur.version, 0) + 1 then
    return jsonb_build_object('status', 'stale', 'version', coalesce(cur.version, 0), 'points', null);
  end if;
  if (select count(*) from public.monster_events e
      where e.player = record_monster_save.player and e.finished_at > now() - interval '1 day') >= 2000 then
    raise exception 'That''s a lot of saving today!' using errcode = '54000';
  end if;

  pending := coalesce(cur.wild_wins_pending, 0) + wild;
  raw := (pending / (rules ->> 'wildWinsPerPoint')::integer)
       + trainers * (rules ->> 'trainerWin')::integer
       + badges * (rules ->> 'badge')::integer;

  insert into public.monster_saves as m (player, world, version, last_save_id, client_at, wild_wins_pending, catches,
    owned_count, seen_count, badges_count, final_in_team)
  values (player, save -> 'world', (save ->> 'seq')::integer, (save ->> 'saveId')::uuid, (save ->> 'at')::bigint,
    pending % (rules ->> 'wildWinsPerPoint')::integer, (smry ->> 'catches')::integer,
    (smry ->> 'owned')::integer, (smry ->> 'seen')::integer, (smry ->> 'badges')::integer, (smry ->> 'finalInTeam')::integer)
  on conflict on constraint monster_saves_pkey do update set
    world = excluded.world, version = excluded.version, last_save_id = excluded.last_save_id,
    saved_at = now(), client_at = excluded.client_at,
    wild_wins_pending = excluded.wild_wins_pending, catches = m.catches + excluded.catches,
    owned_count = excluded.owned_count, seen_count = excluded.seen_count, badges_count = excluded.badges_count,
    final_in_team = excluded.final_in_team;

  insert into public.monster_events (player, save_id, version, battles, wild_wins, trainer_wins, new_badges, catches,
    questions, right_answers, points_raw, counts_for_points)
  values (player, (save ->> 'saveId')::uuid, (save ->> 'seq')::integer, save -> 'battles', wild, trainers,
    coalesce((select array_agg(b) from jsonb_array_elements_text(smry -> 'newBadges') as b), '{}'),
    (smry ->> 'catches')::integer, (smry ->> 'questions')::integer, (smry ->> 'right')::integer, raw, raw > 0)
  returning id into new_id;
  -- Scored by the trigger on monster_events; now award what the new counts earned.
  perform public.award_achievements(player, 'monsters', now());
  return jsonb_build_object('status', 'saved', 'version', (save ->> 'seq')::integer,
    'points', (select s.points from public.scored_games s where s.monster_save = new_id));
end;
$$;

-- A save the server check turned down: only a short code, and not more than 20 a day each.
create function public.record_monster_refusal(player uuid, reason text, seq integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if (select count(*) from public.monster_refusals r
      where r.player = record_monster_refusal.player and r.at > now() - interval '1 day') < 20 then
    insert into public.monster_refusals (player, reason, seq) values (player, left(reason, 40), seq);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Scoring
-- ---------------------------------------------------------------------------

alter table public.scored_games drop constraint scored_games_game_check;
alter table public.scored_games add constraint scored_games_game_check
  check (game in ('chess', 'checkers', 'space', '101', 'gem-keep', 'monsters'));
alter table public.scored_games add column monster_save uuid references public.monster_events (id) on delete cascade;
alter table public.scored_games drop constraint scored_games_check;
alter table public.scored_games add constraint scored_games_check check (
  num_nonnulls(bot_game, mp_game, space_game, card_game, gem_keep_run, monster_save) = 1
  and (kind = 'bot') = (bot_game is not null)
  and (kind = 'friend') = (mp_game is not null or space_game is not null or card_game is not null)
  and (kind = 'solo') = (gem_keep_run is not null or monster_save is not null));
create unique index scored_games_monsters on public.scored_games (player, monster_save) where monster_save is not null;
create index scored_games_monster_save on public.scored_games (monster_save);

create function public.score_monster_events(e public.monster_events)
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
  insert into public.scored_games (player, game, kind, monster_save, result, reason, points, finished_at, nz_day)
  values (e.player, 'monsters', 'solo', e.id, 'won', 'adventure',
    least(e.points_raw, greatest(public.bot_daily_cap() - earned_today, 0)), e.finished_at, day)
  on conflict do nothing;
end;
$$;

create function public.score_monster_events_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.score_monster_events(new);
  return null;
exception when others then
  -- Never lose a save because scoring went wrong. rebuild_progress() can fix scores later.
  raise warning 'scoring a Maths Monsters save failed (%)', sqlstate;
  return null;
end;
$$;

create trigger score_when_saved
after insert on public.monster_events
for each row
execute function public.score_monster_events_trigger();

-- ---------------------------------------------------------------------------
-- 5. Achievements
-- ---------------------------------------------------------------------------

alter table public.achievement_types drop constraint achievement_types_game_check;
alter table public.achievement_types add constraint achievement_types_game_check
  check (game in ('chess', 'checkers', 'space', '101', 'gem-keep', 'monsters'));
alter table public.achievement_types drop constraint achievement_types_measure_check;
alter table public.achievement_types add constraint achievement_types_measure_check
  check (measure in ('games', 'wins', 'beat_very_easy', 'beat_easy', 'beat_medium', 'friend_wins', 'rank',
    'checkmates', 'crowns', 'friend_games', 'wormholes', 'blocks', 'star_kinds', 'docks',
    'zero_hands', 'triples', 'knock_wins', 'saved_by_three',
    'levels_won', 'level_keys', 'three_star_levels', 'stars',
    'maths_right', 'boosts', 'escapes',
    'monster_catches', 'monster_owned', 'monster_badges', 'monster_finals'));

-- Same as Mission Control's, plus the Maths Monsters counts (read from the student's save).
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
    'monster_catches', (select coalesce(sum(m.catches), 0) from public.monster_saves m where m.player = who),
    'monster_owned', (select coalesce(sum(m.owned_count), 0) from public.monster_saves m where m.player = who),
    'monster_badges', (select coalesce(sum(m.badges_count), 0) from public.monster_saves m where m.player = who),
    'monster_finals', (select coalesce(sum(m.final_in_team), 0) from public.monster_saves m where m.player = who)
  )
  from public.scored_games s
  where s.player = who and s.game = which_game
$$;

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('mm-first-catch', 'monsters', 'Catch your first monster', '🎯', 'monster_catches', 1, 1),
  ('mm-book-10', 'monsters', 'Fill 10 pages of the monster book', '📖', 'monster_owned', 10, 2),
  ('mm-book-25', 'monsters', 'Fill 25 pages of the monster book', '📚', 'monster_owned', 25, 3),
  ('mm-book-54', 'monsters', 'Fill every page of the monster book', '🏆', 'monster_owned', 54, 4),
  ('mm-first-badge', 'monsters', 'Win your first Topic Tower badge', '🏅', 'monster_badges', 1, 5),
  ('mm-three-badges', 'monsters', 'Win 3 Topic Tower badges', '🎖️', 'monster_badges', 3, 6),
  ('mm-all-badges', 'monsters', 'Win all 6 Topic Tower badges', '👑', 'monster_badges', 6, 7),
  ('mm-full-team', 'monsters', 'A team of 6 fully grown monsters', '🌟', 'monster_finals', 6, 8);

-- Same as Gem Keep's, with Maths Monsters' rules and the numbers in monster_point_rules().
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
    'monsters', public.monster_point_rules(),
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

-- Same as Gem Keep's, with Maths Monsters saves too.
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
    select 'gem', r.id, r.finished_at from public.gem_keep_runs r where r.counts_for_points
    union all
    select 'monster', e.id, e.finished_at from public.monster_events e where e.counts_for_points
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
    elsif item.kind = 'monster' then
      perform public.score_monster_events(e) from public.monster_events e where e.id = item.id;
    else
      perform public.score_gem_keep_run(r) from public.gem_keep_runs r where r.id = item.id;
    end if;
  end loop;
  -- Gem Keep and Maths Monsters achievements come from progress a rebuild doesn't touch.
  perform public.award_achievements(g.player, 'gem-keep', now())
  from (select distinct player from public.gem_keep_progress) g;
  perform public.award_achievements(m.player, 'monsters', now())
  from (select player from public.monster_saves) m;
  return jsonb_build_object(
    'scored_games', (select count(*) from public.scored_games),
    'achievements', (select count(*) from public.achievements),
    'ratings', (select count(*) from public.ratings)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Reading
-- ---------------------------------------------------------------------------

-- Everything Maths Monsters needs when it opens: the saved game (null for a new player), the
-- teacher's settings, and the student's records for every topic (the questions pick weak facts first).
create function public.my_monsters()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id where public.is_school_user())
  select jsonb_build_object(
    'save', (select jsonb_build_object('world', s.world, 'version', s.version, 'savedAt', s.saved_at)
             from public.monster_saves s where s.player = me.id),
    'settings', public.monsters_settings(),
    'facts', (select coalesce(jsonb_agg(jsonb_build_object(
        'pack', f.pack, 'key', f.fact_key, 'attempts', f.attempts, 'correct', f.correct, 'avgMs', f.avg_ms,
        'box', f.box, 'lastSeen', coalesce((extract(epoch from f.last_seen) * 1000)::bigint, 0),
        'quickDays', to_jsonb(f.quick_days::text[]))), '[]')
      from public.gem_keep_facts f where f.player = me.id)
  )
  from me
$$;

-- Most monsters in the monster book as "owned" (the ones you hold, and the earlier forms they grew
-- from). Monsters only seen don't count. Names, avatars and counts: never maths accuracy. Top 10, plus you.
create function public.monsters_leaderboard()
returns table (
  place integer,
  display_name text,
  avatar jsonb,
  monsters integer,
  badges integer,
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
  with placed as (
    select p.id, p.display_name, p.avatar, m.owned_count as monsters, m.badges_count as badges,
           rank() over (order by m.owned_count desc)::integer as place,
           row_number() over (order by m.owned_count desc, m.badges_count desc, p.display_name) as row_order
    from public.profiles p
    join public.monster_saves m on m.player = p.id
    where not p.hidden and m.owned_count > 0
  )
  select pl.place, pl.display_name, pl.avatar, pl.monsters, pl.badges, pl.id = auth.uid()
  from placed pl
  where pl.row_order <= 10 or pl.id = auth.uid()
  order by pl.row_order;
end;
$$;

-- Same as Gem Keep's, except Recent games' "+5" can point at a Maths Monsters save too.
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
                 'id', coalesce(x.bot_game, x.mp_game, x.space_game, x.card_game, x.gem_keep_run, x.monster_save),
                 'points', x.points)), '[]')
               from (select s.bot_game, s.mp_game, s.space_game, s.card_game, s.gem_keep_run, s.monster_save, s.points
                     from public.scored_games s
                     where s.player = me.id order by s.finished_at desc limit 20) x)
  )
  from me, totals t
$$;

-- ---------------------------------------------------------------------------
-- 7. Teachers
-- ---------------------------------------------------------------------------

-- One student's Maths Monsters: their game at a glance, and how they are getting on in each topic.
create function public.teacher_monster_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  return jsonb_build_object(
    'save', (select jsonb_build_object(
        'owned', m.owned_count, 'seen', m.seen_count, 'badges', m.badges_count, 'catches', m.catches,
        'savedAt', m.saved_at,
        'map', m.world ->> 'map',
        'team', (select coalesce(jsonb_agg(jsonb_build_object('species', t ->> 'species', 'level', (t ->> 'level')::integer)), '[]')
                 from jsonb_array_elements(m.world -> 'team') as t),
        'badgeList', m.world -> 'badges')
      from public.monster_saves m where m.player = student),
    'topics', (select coalesce(jsonb_agg(jsonb_build_object(
        'pack', x.pack, 'facts', x.facts, 'attempts', x.attempts, 'correct', x.correct, 'fluent', x.fluent) order by x.pack), '[]')
      from (select f.pack, count(*) as facts, sum(f.attempts) as attempts, sum(f.correct) as correct,
                   count(*) filter (where f.box >= 4) as fluent
            from public.gem_keep_facts f where f.player = student group by f.pack) x),
    'refused', (select count(*) from public.monster_refusals r where r.player = student and r.at > now() - interval '7 days')
  );
end;
$$;

-- The whole school's students: how many play, how many badges, each topic's answers, the questions
-- most often wrong (asked at least 6 times, by at least 2 students) and the saves the check turned down.
create function public.teacher_monster_class()
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
    packs as (select unnest(array['place-value', 'add-sub', 'times-tables', 'division', 'fractions', 'decimals']) as pack)
    select jsonb_build_object(
      'players', (select count(*) from public.monster_saves m join students s on s.id = m.player),
      'badges', (select coalesce(jsonb_agg(c order by i), '[]') from (
          select n.i, (select count(*) from public.monster_saves m join students s on s.id = m.player where m.badges_count >= n.i) as c
          from generate_series(1, 6) as n(i)) x),
      'topics', (select coalesce(jsonb_agg(jsonb_build_object(
          'pack', pk.pack,
          'students', coalesce(t.students, 0), 'attempts', coalesce(t.attempts, 0), 'correct', coalesce(t.correct, 0)) order by pk.pack), '[]')
        from packs pk left join (
          select f.pack, count(distinct f.player) as students, sum(f.attempts) as attempts, sum(f.correct) as correct
          from public.gem_keep_facts f join students s on s.id = f.player group by f.pack) t on t.pack = pk.pack),
      'hardest', (select coalesce(jsonb_agg(jsonb_build_object(
          'pack', x.pack, 'key', x.fact_key, 'students', x.students, 'attempts', x.attempts, 'correct', x.correct)
          order by x.wrong_share desc, x.attempts desc), '[]')
        from (select f.pack, f.fact_key, count(*) as students, sum(f.attempts) as attempts, sum(f.correct) as correct,
                     1 - sum(f.correct)::numeric / sum(f.attempts) as wrong_share
              from public.gem_keep_facts f join students s on s.id = f.player
              where f.attempts > 0
              group by f.pack, f.fact_key
              having sum(f.attempts) >= 6 and count(*) >= 2 and sum(f.correct) < sum(f.attempts)
              order by wrong_share desc, attempts desc
              limit 12) x),
      'refusals', (select coalesce(jsonb_agg(jsonb_build_object(
          'name', y.display_name, 'realName', y.real_name, 'reason', y.reason, 'at', y.at) order by y.at desc), '[]')
        from (select p.display_name, split_part(u.email, '@', 1) as real_name, r.reason, r.at
              from public.monster_refusals r
              join public.profiles p on p.id = r.player
              left join auth.users u on u.id = p.id
              where r.at > now() - interval '14 days'
              order by r.at desc limit 15) y)
    )
  );
end;
$$;

-- Same as Gem Keep's, counting Maths Monsters saves in "last played".
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
          where c.status = 'finished' and p.id in (c.seat1, c.seat2, c.seat3, c.seat4)),
         public.points_total(p.id),
         greatest(
           (select max(b.finished_at) from public.bot_games b where b.player = p.id),
           (select max(m.finished_at) from public.mp_games m
            where m.status = 'finished' and p.id in (m.first_player, m.second_player)),
           (select max(s.finished_at) from public.space_games s
            where s.status = 'finished' and p.id in (s.seat1, s.seat2, s.seat3, s.seat4)),
           (select max(c.finished_at) from public.card_games c
            where c.status = 'finished' and p.id in (c.seat1, c.seat2, c.seat3, c.seat4)),
           (select max(r.finished_at) from public.gem_keep_runs r where r.player = p.id),
           (select m.saved_at from public.monster_saves m where m.player = p.id)),
         p.created_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  order by p.role desc, split_part(u.email, '@', 1), p.display_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. A new season: points only
-- ---------------------------------------------------------------------------

-- Same as the last one (Mission Control's, which also clears answer batches), except that Maths
-- Monsters keeps the adventure: the saves, the Maths Monsters achievements and the records of the
-- five new topics all stay. Only points go: the saves' half-finished point (wild wins that hadn't
-- made a point yet) and the save history that carried the points. Times-table records are cleared
-- with Gem Keep's, as before (the fire monsters ask from the same records).
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
  gem_count integer;
begin
  perform public.require_teacher();
  if confirm is distinct from 'NEW SEASON' then
    raise exception 'Type NEW SEASON to start a new season.' using errcode = '22023';
  end if;
  delete from public.achievements
  where achievement not in (select t.id from public.achievement_types t where t.game = 'monsters');
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
  delete from public.gem_keep_runs where true;
  get diagnostics gem_count = row_count;
  delete from public.gem_keep_progress where true;
  delete from public.gem_keep_facts where pack = 'times-tables';
  delete from public.fact_answer_batches where true;
  -- Maths Monsters: the points go, the adventure stays.
  delete from public.monster_events where true;
  update public.monster_saves set wild_wins_pending = 0;
  return jsonb_build_object('botGames', bot_count, 'friendGames', friend_count + space_count + card_count,
    'gemKeepLevels', gem_count);
end;
$$;

-- Saves keep each battle's actions for 30 days (to look at if the teacher page shows a refusal); the
-- rows stay, because they carry the points. Refusals are forgotten after 60 days.
select cron.schedule('trim-monster-events', '23 3 * * *',
  $$update public.monster_events set battles = null where battles is not null and finished_at < now() - interval '30 days'$$);
select cron.schedule('forget-monster-refusals', '29 3 * * *',
  $$delete from public.monster_refusals where at < now() - interval '60 days'$$);

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.monsters_settings(), public.teacher_set_monsters(jsonb), public.monster_point_rules(),
  public.load_monster_save(uuid), public.record_monster_save(uuid, jsonb), public.record_monster_refusal(uuid, text, integer),
  public.score_monster_events(public.monster_events), public.score_monster_events_trigger(),
  public.my_monsters(), public.monsters_leaderboard(), public.teacher_monster_student(uuid),
  public.teacher_monster_class(), public.teacher_students()
from public, anon, authenticated;
grant execute on function
  public.my_monsters(), public.monsters_leaderboard(), public.teacher_set_monsters(jsonb),
  public.teacher_monster_student(uuid), public.teacher_monster_class(), public.teacher_students()
to authenticated;
grant execute on function
  public.load_monster_save(uuid), public.record_monster_save(uuid, jsonb), public.record_monster_refusal(uuid, text, integer)
to service_role;
