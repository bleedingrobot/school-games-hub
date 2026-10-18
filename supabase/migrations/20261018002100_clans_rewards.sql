-- Clan Quest, stage C.6 part B: fame and the scoreboard, points, achievements, the teacher's private view of maths answers,
-- and the Teacher page for maths topics and settings. (Plan: docs/CLANS-PLAN.md, "Stage C.6, part B: design".)
--
-- 1. Settings on app_settings: year band, maths topics, times tables, mine fights a day, and the fame season. The `clans`
--    function reads them on every request (clan_extras), so the browser and the server always agree.
-- 2. Fame and what a request earned. `clans` gets fame, the mine wins waiting for a whole point, and lifetime counts (stats).
--    The rules put what a request earned (counts only) inside the result they save; a trigger on clan_requests turns it
--    into fame, points and achievements in the SAME transaction as the save. A request id is the table's key, so a request
--    earns once, however many times it is sent.
-- 3. Points: clan_scores (like lord_scores) feeds scored_games inside the shared 40-a-day cap. Raids earn fame, never points.
-- 4. Eight achievements. progress_counts, progress_rules, rebuild_progress, my_progress, teacher_students and
--    teacher_new_season are redone from their latest versions (Dragon Maths') with Clan Quest added; nothing else in them changes.
-- 5. The class village: when a week's vote builds something, everyone who voted that week gets fame and points (once, because
--    each village closes each week once).
-- 6. Reading: the scoreboard (clan names and fame only), and for teachers the maths records and the fame season button.
--
-- Nothing here is applied until James says so.

-- ---------------------------------------------------------------------------
-- 1. Settings
-- ---------------------------------------------------------------------------

alter table public.app_settings
  add column clans_year_band integer not null default 5 check (clans_year_band in (4, 5, 6)),
  -- Same defaults as DEFAULT_PRACTICAL_SETTINGS in shared/maths/practical.ts (a test checks it).
  add column clans_topics text[] not null default '{percentages,money,area,division,ratios,rates}'
    check (clans_topics <@ '{times,percentages,money,area,division,ratios,rates,integers}' and cardinality(clans_topics) >= 1),
  add column clans_tables integer[] not null default '{2,3,4,5,6,7,8,9,10}'
    check (clans_tables <@ '{1,2,3,4,5,6,7,8,9,10,11,12}' and cardinality(clans_tables) >= 1),
  add column clans_fights_per_day integer not null default 8 check (clans_fights_per_day between 1 and 30),
  -- The fame season. A new season sets every clan's fame to 0 and adds one to this; clans stay.
  add column clans_season integer not null default 1 check (clans_season >= 1);

create function public.clans_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'enabledTopics', to_jsonb(s.clans_topics), 'yearBand', s.clans_year_band,
    'enabledTables', to_jsonb(s.clans_tables), 'fightsPerDay', s.clans_fights_per_day, 'season', s.clans_season)
  from public.app_settings s
$$;

-- `settings` = { yearBand?: 4|5|6, enabledTopics?: [...], enabledTables?: [1-12...], fightsPerDay?: 1-30 }. Leave a key out to keep it.
-- At least one topic and one table stay on. An open fight keeps the settings it started with.
create function public.teacher_set_clan_maths(settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  band integer;
  topics text[];
  tables integer[];
  per_day integer;
begin
  perform public.require_teacher();
  if jsonb_typeof(settings) is distinct from 'object' then
    raise exception 'Those settings couldn''t be read.' using errcode = '22023';
  end if;
  select s.clans_year_band, s.clans_topics, s.clans_tables, s.clans_fights_per_day into band, topics, tables, per_day from public.app_settings s;
  if settings ? 'yearBand' then
    if jsonb_typeof(settings -> 'yearBand') is distinct from 'number' or (settings ->> 'yearBand')::numeric not in (4, 5, 6) then
      raise exception 'The year band must be 4, 5 or 6.' using errcode = '22023';
    end if;
    band := (settings ->> 'yearBand')::integer;
  end if;
  if settings ? 'enabledTopics' then
    if jsonb_typeof(settings -> 'enabledTopics') is distinct from 'array' then
      raise exception 'Those topics couldn''t be read.' using errcode = '22023';
    end if;
    select coalesce(array_agg(distinct t order by t), '{}') into topics from jsonb_array_elements_text(settings -> 'enabledTopics') as t;
    if cardinality(topics) <> jsonb_array_length(settings -> 'enabledTopics')
       or not topics <@ '{times,percentages,money,area,division,ratios,rates,integers}' then
      raise exception 'Those topics couldn''t be read.' using errcode = '22023';
    end if;
    if cardinality(topics) = 0 then
      raise exception 'Leave at least one topic on.' using errcode = '22023';
    end if;
  end if;
  if settings ? 'enabledTables' then
    if jsonb_typeof(settings -> 'enabledTables') is distinct from 'array'
       or exists (select 1 from jsonb_array_elements(settings -> 'enabledTables') e where jsonb_typeof(e) <> 'number' or (e #>> '{}')::numeric <> trunc((e #>> '{}')::numeric)) then
      raise exception 'Those times tables couldn''t be read.' using errcode = '22023';
    end if;
    select coalesce(array_agg(distinct (e #>> '{}')::integer order by (e #>> '{}')::integer), '{}') into tables
    from jsonb_array_elements(settings -> 'enabledTables') e;
    if cardinality(tables) = 0 or not tables <@ '{1,2,3,4,5,6,7,8,9,10,11,12}' then
      raise exception 'Choose at least one times table, from 1 to 12.' using errcode = '22023';
    end if;
  end if;
  if settings ? 'fightsPerDay' then
    if jsonb_typeof(settings -> 'fightsPerDay') is distinct from 'number'
       or (settings ->> 'fightsPerDay')::numeric <> trunc((settings ->> 'fightsPerDay')::numeric)
       or (settings ->> 'fightsPerDay')::numeric not between 1 and 30 then
      raise exception 'Mine fights a day must be a whole number from 1 to 30.' using errcode = '22023';
    end if;
    per_day := (settings ->> 'fightsPerDay')::integer;
  end if;
  update public.app_settings set clans_year_band = band, clans_topics = topics, clans_tables = tables, clans_fights_per_day = per_day where id;
  return public.clans_settings();
end;
$$;

-- Mine fights a clan gets each day: the teacher's setting (8 until they change it; CONFIG.fightsPerDay is the same default).
-- Now stable instead of immutable, because it reads the setting.
create or replace function public.clan_fights_per_day()
returns integer
language sql
stable
set search_path = ''
as $$ select s.clans_fights_per_day from public.app_settings s $$;

-- A new fame season: every clan's fame goes to 0 and the season number goes up by one. Clans, levels, gold, empires, points and
-- achievements stay (James, 18 Oct 2026: a new season keeps clans and resets fame). Type NEW SEASON to confirm.
create function public.teacher_clans_new_season(confirm text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
  season integer;
begin
  perform public.require_teacher();
  if confirm is distinct from 'NEW SEASON' then
    raise exception 'Type NEW SEASON to start a new season.' using errcode = '22023';
  end if;
  update public.clans set fame = 0 where true;
  get diagnostics n = row_count;
  update public.app_settings set clans_season = clans_season + 1 where id returning clans_season into season;
  return jsonb_build_object('season', season, 'clans', n);
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Fame and what a request earned
-- ---------------------------------------------------------------------------

alter table public.clans
  add column fame integer not null default 0 check (fame between 0 and 100000000),
  -- Mine wins that have not made a whole point yet (3 make one).
  add column wins_pending integer not null default 0 check (wins_pending between 0 and 2),
  -- Lifetime counts the achievements are measured by: mineWins, bossWins, warWins, kingdomRaids, classRaids, cries, villageBuilt.
  add column stats jsonb not null default '{}' check (jsonb_typeof(stats) = 'object');
create index clans_fame on public.clans (fame desc);

-- Fame and points. Must equal CONFIG.rewards in shared/clans/config.ts (a test checks it). Raids earn fame but no points.
create function public.clan_reward_rules() returns jsonb language sql immutable set search_path = ''
as $$ select jsonb_build_object(
  'fame', jsonb_build_object('mineWin', 1, 'bossWin', 5, 'warWin', 2, 'kingdomRaidWin', 2, 'classRaidWin', 3, 'villageBuilt', 10),
  'points', jsonb_build_object('minesPerPoint', 3, 'boss', 3, 'war', 2, 'villageBuilt', 5)) $$;

-- What a save or the midnight job earned toward points (like lord_scores). A new points season clears these; clans stay.
create table public.clan_scores (
  id uuid primary key default gen_random_uuid(),
  player uuid not null references public.profiles (id) on delete cascade,
  wins integer not null default 0 check (wins >= 0),
  bosses integer not null default 0 check (bosses >= 0),
  wars integer not null default 0 check (wars >= 0),
  village integer not null default 0 check (village >= 0),
  points_raw integer not null check (points_raw >= 0),
  counts_for_points boolean not null,
  finished_at timestamptz not null default now()
);
create index clan_scores_player on public.clan_scores (player, finished_at desc);
alter table public.clan_scores enable row level security;
revoke all on public.clan_scores from anon, authenticated;

alter table public.scored_games drop constraint scored_games_game_check;
alter table public.scored_games add constraint scored_games_game_check
  check (game in ('chess', 'checkers', 'space', '101', 'gem-keep', 'power-clash', 'monsters', 'dragon-maths', 'clan-quest'));
alter table public.scored_games add column clan_score uuid references public.clan_scores (id) on delete cascade;
alter table public.scored_games drop constraint scored_games_check;
alter table public.scored_games add constraint scored_games_check check (
  num_nonnulls(bot_game, mp_game, space_game, card_game, gem_keep_run, power_game, monster_save, lord_score, clan_score) = 1
  and (kind = 'bot') = (bot_game is not null)
  and (kind = 'friend') = (mp_game is not null or space_game is not null or card_game is not null or power_game is not null)
  and (kind = 'solo') = (gem_keep_run is not null or monster_save is not null or lord_score is not null or clan_score is not null));
create unique index scored_games_clan on public.scored_games (player, clan_score) where clan_score is not null;
create index scored_games_clan_score on public.scored_games (clan_score);

create function public.score_clan_scores(e public.clan_scores)
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
  -- Shares the cap with every other game against the computer.
  select coalesce(sum(s.points), 0) into earned_today
  from public.scored_games s
  where s.player = e.player and s.kind in ('bot', 'solo') and s.nz_day = day;
  insert into public.scored_games (player, game, kind, clan_score, result, reason, points, finished_at, nz_day)
  values (e.player, 'clan-quest', 'solo', e.id, 'won', 'adventure',
    least(e.points_raw, greatest(public.bot_daily_cap() - earned_today, 0)), e.finished_at, day)
  on conflict do nothing;
end;
$$;

create function public.score_clan_scores_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.score_clan_scores(new);
  return null;
exception when others then
  -- Never lose a save because scoring went wrong. rebuild_progress() can fix scores later.
  raise warning 'scoring a Clan Quest save failed (%)', sqlstate;
  return null;
end;
$$;

create trigger score_when_saved
after insert on public.clan_scores
for each row
execute function public.score_clan_scores_trigger();

-- Adds what one saved request earned (`e` = the counts the rules put in the result, or null) to the clan: fame, the lifetime counts,
-- the wins waiting for a point and any whole points (a clan_scores row), then hands out achievements. Also called for requests that earned
-- nothing, because levels and buildings (two of the achievements) change in all sorts of requests.
create function public.clan_apply_earned(who uuid, e jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rules jsonb := public.clan_reward_rules();
  c public.clans;
  w integer := 0;
  b integer := 0;
  v_wars integer := 0;
  k integer := 0;
  r integer := 0;
  v_cries integer := 0;
  v_fame integer;
  v_pending integer;
  v_raw integer;
  per integer := (rules -> 'points' ->> 'minesPerPoint')::integer;
begin
  select * into c from public.clans x where x.player = who for update;
  if not found then
    return;
  end if;
  if jsonb_typeof(e) = 'object' then
    w := coalesce((e ->> 'wins')::integer, 0);
    b := coalesce((e ->> 'bosses')::integer, 0);
    v_wars := coalesce((e ->> 'wars')::integer, 0);
    k := coalesce((e ->> 'kingdomRaids')::integer, 0);
    r := coalesce((e ->> 'classRaids')::integer, 0);
    v_cries := coalesce((e ->> 'cries')::integer, 0);
    if least(w, b, v_wars, k, r, v_cries) < 0 or greatest(w, b, v_wars, k, r, v_cries) > 100 then
      raise exception 'Those rewards could not be read.' using errcode = '22023';
    end if;
  end if;
  if w + b + v_wars + k + r + v_cries > 0 then
    v_fame := w * (rules -> 'fame' ->> 'mineWin')::integer + b * (rules -> 'fame' ->> 'bossWin')::integer
      + v_wars * (rules -> 'fame' ->> 'warWin')::integer + k * (rules -> 'fame' ->> 'kingdomRaidWin')::integer
      + r * (rules -> 'fame' ->> 'classRaidWin')::integer;
    v_pending := c.wins_pending + w;
    v_raw := v_pending / per + b * (rules -> 'points' ->> 'boss')::integer + v_wars * (rules -> 'points' ->> 'war')::integer;
    update public.clans x set
      fame = x.fame + v_fame,
      wins_pending = v_pending % per,
      stats = x.stats || jsonb_build_object(
        'mineWins', coalesce((x.stats ->> 'mineWins')::integer, 0) + w,
        'bossWins', coalesce((x.stats ->> 'bossWins')::integer, 0) + b,
        'warWins', coalesce((x.stats ->> 'warWins')::integer, 0) + v_wars,
        'kingdomRaids', coalesce((x.stats ->> 'kingdomRaids')::integer, 0) + k,
        'classRaids', coalesce((x.stats ->> 'classRaids')::integer, 0) + r,
        'cries', coalesce((x.stats ->> 'cries')::integer, 0) + v_cries)
    where x.player = who;
    if v_raw > 0 then
      insert into public.clan_scores (player, wins, bosses, wars, points_raw, counts_for_points)
      values (who, w, b, v_wars, v_raw, true);
    end if;
  end if;
  perform public.award_achievements(who, 'clan-quest', now());
end;
$$;

create function public.clan_requests_earned_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.clan_apply_earned(new.player, new.result -> 'earned');
  return null;
exception when others then
  -- Never lose a save because a reward went wrong.
  raise warning 'rewarding a Clan Quest save failed (%)', sqlstate;
  return null;
end;
$$;

create trigger earned_when_saved
after insert on public.clan_requests
for each row
execute function public.clan_requests_earned_trigger();

-- ---------------------------------------------------------------------------
-- 5. The class village pays everyone who voted
-- ---------------------------------------------------------------------------

-- When a week's vote built something: fame, a lifetime count and points for everyone in the village who voted that week (and still has
-- a clan). Called by clan_village_close, which runs once per village per week. Returns how many clans were rewarded.
create function public.clan_village_reward(vid bigint, closing_week integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  rules jsonb := public.clan_reward_rules();
  voter uuid;
  n integer := 0;
begin
  for voter in
    select c.player from public.clan_votes v join public.clans c on c.player = v.player
    where v.village_id = vid and v.week = closing_week
    order by c.player
  loop
    update public.clans x set
      fame = x.fame + (rules -> 'fame' ->> 'villageBuilt')::integer,
      stats = x.stats || jsonb_build_object('villageBuilt', coalesce((x.stats ->> 'villageBuilt')::integer, 0) + 1)
    where x.player = voter;
    insert into public.clan_scores (player, village, points_raw, counts_for_points)
    values (voter, 1, (rules -> 'points' ->> 'villageBuilt')::integer, true);
    perform public.award_achievements(voter, 'clan-quest', now());
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Reading
-- ---------------------------------------------------------------------------

-- The scoreboard: the top 10 clans by fame (ties share a place), plus your own clan wherever it is. Clan names and fame only: no
-- pupil name, no account id, no level, nothing about maths. Clans of hidden profiles are left off. Clans with no fame yet are not listed
-- (except your own).
create function public.clan_scoreboard()
returns table (
  place integer,
  clan_name text,
  fame integer,
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
  with base as (
    select c.player as who, c.name as clan, c.fame as points, c.created_at as born
    from public.clans c join public.profiles p on p.id = c.player
    where not p.hidden
  ),
  placed as (
    select b.*,
           rank() over (order by b.points desc)::integer as pl,
           row_number() over (order by b.points desc, b.born, b.clan, b.who) as row_order
    from base b
  )
  select x.pl, x.clan, x.points, x.who = auth.uid()
  from placed x
  where (x.row_order <= 10 and x.points > 0) or x.who = auth.uid()
  order by x.row_order;
end;
$$;

-- What the server needs besides the clan on every request: the teacher's settings, this clan's fame and the achievements it has earned.
create function public.clan_extras(player uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'settings', public.clans_settings(),
    'fame', coalesce((select c.fame from public.clans c where c.player = clan_extras.player), 0),
    'achievements', coalesce((
      select jsonb_agg(a.achievement order by a.achievement) from public.achievements a
      join public.achievement_types t on t.id = a.achievement
      where a.player = clan_extras.player and t.game = 'clan-quest'), '[]'))
$$;

-- ---------------------------------------------------------------------------
-- 7. Teachers: the private maths records
-- ---------------------------------------------------------------------------

-- Across the school: how many pupils have answered Clan Quest questions, how each kind of question is going, and the kinds most often
-- wrong (asked at least 6 times, by at least 2 pupils). Keys are the kind of question and the year band, never the numbers.
create function public.teacher_clan_maths_class()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  return (
    with facts as (
      select f.player, f.fact_key, f.attempts, f.correct
      from public.gem_keep_facts f join public.profiles p on p.id = f.player
      where f.pack = 'clan-quest' and p.role = 'student' and f.attempts > 0
    )
    select jsonb_build_object(
      'players', (select count(distinct x.player) from facts x),
      'kinds', (select coalesce(jsonb_agg(jsonb_build_object(
          'key', y.fact_key, 'students', y.students, 'attempts', y.attempts, 'correct', y.correct) order by y.fact_key), '[]')
        from (select x.fact_key, count(*) as students, sum(x.attempts) as attempts, sum(x.correct) as correct
              from facts x group by x.fact_key) y),
      'hardest', (select coalesce(jsonb_agg(jsonb_build_object(
          'key', z.fact_key, 'students', z.students, 'attempts', z.attempts, 'correct', z.correct)
          order by z.wrong_share desc, z.attempts desc), '[]')
        from (select x.fact_key, count(*) as students, sum(x.attempts) as attempts, sum(x.correct) as correct,
                     1 - sum(x.correct)::numeric / sum(x.attempts) as wrong_share
              from facts x
              group by x.fact_key
              having sum(x.attempts) >= 6 and count(*) >= 2 and sum(x.correct) < sum(x.attempts)
              order by wrong_share desc, attempts desc
              limit 12) z)
    )
  );
end;
$$;

-- One pupil: their fame and how each kind of question is going, hardest first.
create function public.teacher_clan_maths_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  return jsonb_build_object(
    'fame', (select c.fame from public.clans c where c.player = student),
    'kinds', (select coalesce(jsonb_agg(jsonb_build_object(
        'key', y.fact_key, 'attempts', y.attempts, 'correct', y.correct) order by y.wrong_share desc, y.attempts desc), '[]')
      from (select f.fact_key, f.attempts, f.correct, 1 - f.correct::numeric / f.attempts as wrong_share
            from public.gem_keep_facts f
            where f.player = student and f.pack = 'clan-quest' and f.attempts > 0) y));
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Achievements
-- ---------------------------------------------------------------------------

alter table public.achievement_types drop constraint achievement_types_game_check;
alter table public.achievement_types add constraint achievement_types_game_check
  check (game in ('chess', 'checkers', 'space', '101', 'gem-keep', 'power-clash', 'monsters', 'dragon-maths', 'clan-quest'));
alter table public.achievement_types drop constraint achievement_types_measure_check;
alter table public.achievement_types add constraint achievement_types_measure_check
  check (measure in ('games', 'wins', 'beat_very_easy', 'beat_easy', 'beat_medium', 'friend_wins', 'rank',
    'checkmates', 'crowns', 'friend_games', 'wormholes', 'blocks', 'star_kinds', 'docks',
    'zero_hands', 'triples', 'knock_wins', 'saved_by_three',
    'levels_won', 'level_keys', 'three_star_levels', 'stars',
    'maths_right', 'boosts', 'escapes',
    'all_three_powers', 'body_swap_wins', 'no_power_wins',
    'monster_catches', 'monster_owned', 'monster_badges', 'monster_finals',
    'lord_masters', 'lord_best_level', 'lord_arena_wins', 'lord_riddles', 'lord_forest_wins', 'lord_dragons',
    'clan_wins', 'clan_bosses', 'clan_level', 'clan_buildings', 'clan_wars', 'clan_village', 'clan_cries'));

-- The same ids, names, measures and goals as ACHIEVEMENTS in shared/clans/rewards.ts (a test checks it).
insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('cq-first-win', 'clan-quest', 'First win', '⚔️', 'clan_wins', 1, 1),
  ('cq-first-boss', 'clan-quest', 'Boss beaten', '👹', 'clan_bosses', 1, 2),
  ('cq-level-10', 'clan-quest', 'Level 10', '🛡️', 'clan_level', 10, 3),
  ('cq-level-20', 'clan-quest', 'Level 20', '🏅', 'clan_level', 20, 4),
  ('cq-buildings-5', 'clan-quest', 'Five buildings', '🏰', 'clan_buildings', 5, 5),
  ('cq-first-war', 'clan-quest', 'Friendly War win', '🤝', 'clan_wars', 1, 6),
  ('cq-village', 'clan-quest', 'Village builders', '🔨', 'clan_village', 1, 7),
  ('cq-cries-50', 'clan-quest', 'Loud and right', '📣', 'clan_cries', 50, 8);

-- Same as part A's, plus: when the vote built something, everyone who voted that week is rewarded (once: a week is closed once).
create or replace function public.clan_village_close(vid bigint, closing_week integer, news_date date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.clan_villages;
  won text;
  level integer;
  cost integer;
  pretty text;
begin
  select * into v from public.clan_villages x where x.id = vid for update;
  select t.kind into won
  from (select x.kind, count(*) as n from public.clan_votes x where x.village_id = vid and x.week = closing_week group by x.kind) t
  where (v.levels ->> t.kind)::integer < public.clan_village_max(t.kind)
  order by t.n desc,
    public.clan_village_cost(t.kind, (v.levels ->> t.kind)::integer + 1),
    case t.kind when 'trainingHall' then 1 when 'smithy' then 2 else 3 end
  limit 1;
  if won is null then
    return null;
  end if;
  level := (v.levels ->> won)::integer + 1;
  cost := public.clan_village_cost(won, level);
  pretty := case won when 'trainingHall' then 'Training Hall' when 'smithy' then 'Smithy' else 'Church' end;
  if v.chest < cost then
    insert into public.clan_news (nz_date, village_id, text)
    values (news_date, vid, 'The class voted for the ' || pretty || ' (level ' || level || ') but the chest was ' || (cost - v.chest) || ' gold short.');
    return null;
  end if;
  update public.clan_villages x set chest = x.chest - cost, levels = jsonb_set(x.levels, array[won], to_jsonb(level)) where x.id = vid;
  insert into public.clan_news (nz_date, village_id, text) values (news_date, vid, 'The class built the ' || pretty || ' (level ' || level || ')!');
  perform public.clan_village_reward(vid, closing_week);
  return won;
end;
$$;

-- Same as Dragon Maths', plus Clan Quest's counts (lifetime counts kept on the clan; level and buildings read from the clan itself).
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
    'lord_dragons', (select coalesce(sum((h.extra -> 'stats' ->> 'dragons')::integer), 0) from public.lord_heroes h where h.player = who),
    'clan_wins', (select coalesce((c.stats ->> 'mineWins')::integer, 0) + coalesce((c.stats ->> 'bossWins')::integer, 0) from public.clans c where c.player = who),
    'clan_bosses', (select coalesce((c.stats ->> 'bossWins')::integer, 0) from public.clans c where c.player = who),
    'clan_level', (select coalesce(max((m.member ->> 'level')::integer), 0) from public.clan_members m where m.player = who),
    'clan_buildings', (select coalesce(public.clan_buildings_of(e.empire), 0) from public.clan_empires e where e.player = who),
    'clan_wars', (select coalesce((c.stats ->> 'warWins')::integer, 0) from public.clans c where c.player = who),
    'clan_village', (select coalesce((c.stats ->> 'villageBuilt')::integer, 0) from public.clans c where c.player = who),
    'clan_cries', (select coalesce((c.stats ->> 'cries')::integer, 0) from public.clans c where c.player = who)
  )
  from public.scored_games s
  where s.player = who and s.game = which_game
$$;

-- Same as Dragon Maths', plus Clan Quest's rules (hidden while the game is switched off).
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
    'clanQuest', case when (select a.clans_enabled from public.app_settings a) then public.clan_reward_rules() end,
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

-- Same as Dragon Maths', plus Clan Quest's scores.
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
    union all
    select 'clan', k.id, k.finished_at from public.clan_scores k where k.counts_for_points
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
    elsif item.kind = 'clan' then
      perform public.score_clan_scores(k) from public.clan_scores k where k.id = item.id;
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
  perform public.award_achievements(q.player, 'clan-quest', now())
  from (select player from public.clans) q;
  return jsonb_build_object(
    'scored_games', (select count(*) from public.scored_games),
    'achievements', (select count(*) from public.achievements),
    'ratings', (select count(*) from public.ratings)
  );
end;
$$;

-- Same as Dragon Maths', except Recent games' "+5" can point at a Clan Quest score too, and Clan Quest's achievements are hidden
-- while the game is switched off.
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
                and (at.game <> 'dragon-maths' or (select s.lord_enabled from public.app_settings s))
                and (at.game <> 'clan-quest' or (select s.clans_enabled from public.app_settings s))),
    'recent', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', coalesce(x.bot_game, x.mp_game, x.space_game, x.card_game, x.gem_keep_run, x.power_game, x.monster_save, x.lord_score, x.clan_score),
                 'points', x.points)), '[]')
               from (select s.bot_game, s.mp_game, s.space_game, s.card_game, s.gem_keep_run, s.power_game, s.monster_save, s.lord_score, s.clan_score, s.points
                     from public.scored_games s
                     where s.player = me.id order by s.finished_at desc limit 20) x)
  )
  from me, totals t
$$;

-- Same as Dragon Maths', counting Clan Quest clans in "last played".
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
           (select l.saved_at from public.lord_heroes l where l.player = p.id),
           (select c.updated_at from public.clans c where c.player = p.id)),
         p.created_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  order by p.role desc, split_part(u.email, '@', 1), p.display_name;
end;
$$;

-- Same as Dragon Maths' latest, plus Clan Quest: only its points go (the scores that carried them, and the wins that hadn't made a
-- point yet). Clans, fame and achievements all stay; fame has its own season (teacher_clans_new_season).
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
  where achievement not in (select t.id from public.achievement_types t where t.game in ('monsters', 'dragon-maths', 'clan-quest'));
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
  -- Clan Quest: the points go; clans, fame and achievements stay (fame has its own season button).
  delete from public.clan_scores where true;
  update public.clans set wins_pending = 0 where true;
  return jsonb_build_object('botGames', bot_count, 'friendGames', friend_count + space_count + card_count + power_count,
    'gemKeepLevels', gem_count);
end;
$$;


-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.clans_settings(), public.teacher_set_clan_maths(jsonb), public.teacher_clans_new_season(text),
  public.clan_reward_rules(), public.score_clan_scores(public.clan_scores), public.score_clan_scores_trigger(),
  public.clan_apply_earned(uuid, jsonb), public.clan_requests_earned_trigger(), public.clan_village_reward(bigint, integer),
  public.clan_scoreboard(), public.clan_extras(uuid), public.teacher_clan_maths_class(), public.teacher_clan_maths_student(uuid),
  public.teacher_students()
from public, anon, authenticated;
grant execute on function
  public.clan_scoreboard(), public.teacher_set_clan_maths(jsonb), public.teacher_clans_new_season(text),
  public.teacher_clan_maths_class(), public.teacher_clan_maths_student(uuid), public.teacher_students()
to authenticated;
grant execute on function public.clan_extras(uuid) to service_role;
