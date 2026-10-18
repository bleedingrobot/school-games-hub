-- Maths focus F.2, part 3 of 3: the school and class check in every row rule and function.
--
-- One helper, my_school() (and, for teachers, my_students() / require_teacher_of()), is used in every
-- rule and function that shows or changes another person's data. docs/MATHS-FOCUS-PLAN.md ("Stage F.2
-- results") lists every table and function and the ones that did not need it.
--
-- Most of the functions below are the existing ones with a single, small change (a school filter, a
-- class check, or the settings of the right class). Each one says what changed.

-- ---------------------------------------------------------------------------
-- Settings: every reader asks for the settings of the right person
-- ---------------------------------------------------------------------------

-- Gem Keep settings for a player (default: the signed-in person).
drop function public.gem_keep_settings();

create function public.gem_keep_settings(player uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'mode', s.gem_keep_mode,
    'enabledTables', to_jsonb(s.gem_keep_tables),
    'division', s.gem_keep_division,
    'missingFactor', s.gem_keep_missing_factor,
    'multipleChoice', s.gem_keep_multiple_choice,
    'keyPassMark', s.gem_keep_key_pass)
  from public.settings_of(coalesce(player, auth.uid())) s
$$;

-- Dragon Maths: the settings, and the season, for a player.
drop function public.lord_settings();

create function public.lord_settings(player uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('enabled', s.lord_enabled, 'forestPerDay', s.lord_forest_per_day,
    'seasonStart', to_char(s.lord_season_start, 'YYYY-MM-DD'), 'pausedSince', to_char(s.lord_paused_since, 'YYYY-MM-DD'))
  from public.settings_of(coalesce(player, auth.uid())) s
$$;

drop function public.lord_server_settings();

create function public.lord_server_settings(player uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.lord_settings(player)
$$;

drop function public.lord_current_season();

create function public.lord_current_season(player uuid default null)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when s.lord_season_start is null or public.nz_day(now()) < s.lord_season_start then null
    else ((public.nz_day(now()) - s.lord_season_start) / 35) + 1 end
  from public.settings_of(coalesce(player, auth.uid())) s
$$;

-- Maths Monsters: the settings for a player.
drop function public.monsters_settings();

create function public.monsters_settings(player uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('enabled', s.monsters_enabled, 'topics', to_jsonb(s.monsters_topics))
  from public.settings_of(coalesce(player, auth.uid())) s
$$;

-- Mission Control maths: the player's own settings.
CREATE OR REPLACE FUNCTION public.space_maths_context(player uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'facts', (select coalesce(jsonb_agg(jsonb_build_object(
        'key', f.fact_key, 'attempts', f.attempts, 'correct', f.correct, 'avgMs', f.avg_ms, 'box', f.box,
        'lastSeen', coalesce((extract(epoch from f.last_seen) * 1000)::bigint, 0),
        'quickDays', to_jsonb(f.quick_days::text[]))), '[]')
      from public.gem_keep_facts f where f.player = space_maths_context.player and f.pack = 'times-tables'),
    'settings', public.gem_keep_settings(player))
$function$;

-- Gem Keep Level Key: the pass mark of the player's class.
CREATE OR REPLACE FUNCTION public.record_gem_keep_key(player uuid, level_id text, right_answers integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  was public.gem_keep_progress;
begin
  perform public.gem_keep_check_player(player);
  select * into was from public.gem_keep_progress g
  where g.player = record_gem_keep_key.player and g.level_id = record_gem_keep_key.level_id
  for update;
  if not found or was.wins = 0 then
    return 'no-win';
  end if;
  if was.key_passed then
    return 'already';
  end if;
  if right_answers < (select s.gem_keep_key_pass from public.settings_of(record_gem_keep_key.player) s) then
    return 'not-passed';
  end if;
  update public.gem_keep_progress g set key_passed = true, key_passed_at = now(), updated_at = now()
  where g.player = record_gem_keep_key.player and g.level_id = record_gem_keep_key.level_id;
  perform public.award_achievements(player, 'gem-keep', now());
  return 'passed';
end;
$function$;

-- Points page: the switches of the viewer's class.
CREATE OR REPLACE FUNCTION public.progress_rules()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    'monsters', case when (select a.monsters_enabled from public.settings_of(auth.uid()) a) then public.monster_point_rules() end,
    'dragonMaths', case when (select a.lord_enabled from public.settings_of(auth.uid()) a) then public.lord_point_rules() end,
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
$function$;

-- Progress: the switches of the viewer's class.
CREATE OR REPLACE FUNCTION public.my_progress()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
              where (at.game <> 'monsters' or (select s.monsters_enabled from public.settings_of(auth.uid()) s))
                and (at.game <> 'dragon-maths' or (select s.lord_enabled from public.settings_of(auth.uid()) s))),
    'recent', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', coalesce(x.bot_game, x.mp_game, x.space_game, x.card_game, x.gem_keep_run, x.power_game, x.monster_save, x.lord_score),
                 'points', x.points)), '[]')
               from (select s.bot_game, s.mp_game, s.space_game, s.card_game, s.gem_keep_run, s.power_game, s.monster_save, s.lord_score, s.points
                     from public.scored_games s
                     where s.player = me.id order by s.finished_at desc limit 20) x)
  )
  from me, totals t
$function$;


-- ---------------------------------------------------------------------------
-- Changing settings: a teacher changes the classes they teach (a school admin: also the school default)
-- ---------------------------------------------------------------------------


-- Which settings rows may the signed-in teacher change? A given class they teach; or, when no class is
-- given, every class they teach (a school admin: every class in the school and the school's default).
create function public.settings_to_change(target_class uuid default null)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id from public.app_settings s
  where public.is_teacher() and s.school_id = public.my_school()
    and (
      (target_class is null and (s.class_id in (select public.my_classes())
                                 or (s.class_id is null and public.is_school_admin())))
      or (target_class is not null and s.class_id = target_class and public.teaches_class(target_class))
    )
$$;

create function public.require_settings_target(target_class uuid default null)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.settings_to_change(target_class)) then
    raise exception 'You don''t teach a class yet. Make one on the My classes page first.' using errcode = '42501';
  end if;
end;
$$;

drop function public.teacher_set_multiplayer(boolean);

create function public.teacher_set_multiplayer(enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  perform public.require_settings_target(target_class);
  update public.app_settings set multiplayer_enabled = enabled where id in (select public.settings_to_change(target_class));
end;
$$;

drop function public.teacher_set_space_reactions(boolean);

create function public.teacher_set_space_reactions(enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  perform public.require_settings_target(target_class);
  update public.app_settings set space_reactions_enabled = enabled where id in (select public.settings_to_change(target_class));
end;
$$;

drop function public.teacher_set_space_maths(text);

create function public.teacher_set_space_maths(mode text, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if mode is null or mode not in ('off', 'choose', 'on') then
    raise exception 'Unknown maths setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings set space_maths = mode where id in (select public.settings_to_change(target_class));
end;
$$;

drop function public.teacher_set_gem_keep(jsonb);
CREATE OR REPLACE FUNCTION public.teacher_set_gem_keep(settings jsonb, target_class uuid default null)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  tables integer[];
begin
  perform public.require_teacher();
  if jsonb_typeof(settings) is distinct from 'object'
     or settings ->> 'mode' not in ('calm', 'challenge')
     or jsonb_typeof(settings -> 'enabledTables') is distinct from 'array'
     or jsonb_typeof(settings -> 'division') is distinct from 'boolean'
     or coalesce(jsonb_typeof(settings -> 'missingFactor'), 'null') not in ('boolean', 'null')
     or jsonb_typeof(settings -> 'multipleChoice') is distinct from 'boolean'
     or jsonb_typeof(settings -> 'keyPassMark') is distinct from 'number' then
    raise exception 'Those settings couldn''t be read.' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct t::integer order by t::integer), '{}') into tables
  from jsonb_array_elements_text(settings -> 'enabledTables') as t
  where t ~ '^[0-9]{1,2}$';
  if cardinality(tables) <> jsonb_array_length(settings -> 'enabledTables')
     or not tables <@ '{1,2,3,4,5,6,7,8,9,10,11,12}' then
    raise exception 'Those times tables couldn''t be read.' using errcode = '22023';
  end if;
  if cardinality(tables) = 0 then
    raise exception 'Leave at least one times table on.' using errcode = '22023';
  end if;
  if (settings ->> 'keyPassMark') !~ '^[0-9]{1,2}$' or (settings ->> 'keyPassMark')::integer not between 5 and 10 then
    raise exception 'The Level Key pass mark must be between 5 and 10.' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings set
    gem_keep_mode = settings ->> 'mode',
    gem_keep_tables = tables,
    gem_keep_division = (settings ->> 'division')::boolean,
    gem_keep_missing_factor = (settings ->> 'missingFactor')::boolean,
    gem_keep_multiple_choice = (settings ->> 'multipleChoice')::boolean,
    gem_keep_key_pass = (settings ->> 'keyPassMark')::integer
  where id in (select public.settings_to_change(target_class));
  return public.gem_keep_settings();
end;
$function$;

drop function public.teacher_set_monsters(jsonb);
CREATE OR REPLACE FUNCTION public.teacher_set_monsters(settings jsonb, target_class uuid default null)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  perform public.require_settings_target(target_class);
  update public.app_settings set
    monsters_enabled = (settings ->> 'enabled')::boolean,
    monsters_topics = topics
  where id in (select public.settings_to_change(target_class));
  return public.monsters_settings();
end;
$function$;

-- Dragon Maths switch: the season pause rules run for each class that is changed.
drop function public.teacher_set_lord(jsonb);

create function public.teacher_set_lord(settings jsonb, target_class uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg public.app_settings;
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
  perform public.require_settings_target(target_class);
  now_on := (settings ->> 'enabled')::boolean;
  if settings ? 'forestPerDay' then
    if jsonb_typeof(settings -> 'forestPerDay') is distinct from 'number'
       or (settings ->> 'forestPerDay')::numeric <> trunc((settings ->> 'forestPerDay')::numeric)
       or (settings ->> 'forestPerDay')::numeric not between 1 and 30 then
      raise exception 'Forest fights a day must be a whole number from 1 to 30.' using errcode = '22023';
    end if;
  end if;
  if settings ? 'seasonStart' then
    if jsonb_typeof(settings -> 'seasonStart') <> 'null'
       and not (jsonb_typeof(settings -> 'seasonStart') = 'string' and (settings ->> 'seasonStart') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') then
      raise exception 'That start date couldn''t be read.' using errcode = '22023';
    end if;
  end if;
  for cfg in
    select s.* from public.app_settings s where s.id in (select public.settings_to_change(target_class)) for update
  loop
    per_day := cfg.lord_forest_per_day;
    start := cfg.lord_season_start;
    paused := cfg.lord_paused_since;
    was_on := cfg.lord_enabled;
    if settings ? 'forestPerDay' then
      per_day := (settings ->> 'forestPerDay')::integer;
    end if;
    if settings ? 'seasonStart' then
      if jsonb_typeof(settings -> 'seasonStart') = 'null' then
        start := null;
      else
        start := (settings ->> 'seasonStart')::date;
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
    where id = cfg.id;
  end loop;
  return public.lord_settings();
end;
$$;


-- ---------------------------------------------------------------------------
-- Who can look at which student: teachers see the students in their classes
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.teacher_delete_student(student uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.require_teacher_of(student);
  if exists (select 1 from public.profiles where id = student and role = 'teacher') then
    raise exception 'Teachers can''t be deleted this way.' using errcode = '42501';
  end if;
  delete from auth.users where id = student;
end;
$function$;

CREATE OR REPLACE FUNCTION public.teacher_reset_name(student uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  new_name text;
begin
  perform public.require_teacher_of(student);
  new_name := public.pick_display_name();
  update public.profiles set display_name = new_name where id = student;
  return new_name;
end;
$function$;

CREATE OR REPLACE FUNCTION public.teacher_set_hidden(student uuid, hide boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.require_teacher_of(student);
  update public.profiles set hidden = hide where id = student;
end;
$function$;

CREATE OR REPLACE FUNCTION public.teacher_reset_lord_hero(student uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  had boolean;
begin
  perform public.require_teacher_of(student);
  update public.lord_fights f set status = 'abandoned', finished_at = now() where f.player = student and f.status = 'open';
  delete from public.lord_heroes h where h.player = student;
  get diagnostics had = row_count;
  return jsonb_build_object('reset', had);
end;
$function$;

CREATE OR REPLACE FUNCTION public.teacher_gem_keep_student(student uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.require_teacher_of(student);
  return jsonb_build_object(
    'levels', (select coalesce(jsonb_agg(jsonb_build_object(
        'levelId', g.level_id, 'stars', g.best_stars, 'keyPassed', g.key_passed, 'plays', g.plays, 'wins', g.wins)
        order by g.level_id), '[]')
      from public.gem_keep_progress g where g.player = student),
    'facts', (select coalesce(jsonb_agg(jsonb_build_object(
        'key', f.fact_key, 'attempts', f.attempts, 'correct', f.correct, 'avgMs', f.avg_ms, 'box', f.box,
        'lastSeen', coalesce((extract(epoch from f.last_seen) * 1000)::bigint, 0),
        'quickDays', to_jsonb(f.quick_days::text[]))), '[]')
      from public.gem_keep_facts f where f.player = student and f.pack = 'times-tables'),
    'lastPlayed', (select max(r.finished_at) from public.gem_keep_runs r where r.player = student)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.teacher_lord_student(student uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.require_teacher_of(student);
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
$function$;

CREATE OR REPLACE FUNCTION public.teacher_monster_student(student uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.require_teacher_of(student);
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
$function$;

CREATE OR REPLACE FUNCTION public.teacher_student_detail(student uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.require_teacher_of(student);
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
    ),
    power_mine as (
      select pg.id, pg.finished_at, pg.ending,
             coalesce(pg.won[array_position(array[pg.seat1, pg.seat2], student)], false) as won,
             pg.ending = 'abandoned' as left_game
      from public.power_games pg
      where pg.status = 'finished' and student in (pg.seat1, pg.seat2)
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
          when g = 'power-clash' then
            (select jsonb_build_object(
              'played', count(*), 'won', count(*) filter (where not pm.left_game and pm.won),
              'lost', count(*) filter (where not pm.left_game and not pm.won), 'drawn', 0,
              'left', count(*) filter (where pm.left_game))
             from power_mine pm)
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
        ) order by g in ('101', 'power-clash'), g)
        from unnest(array['chess', 'checkers', 'space', '101', 'power-clash']) as g
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
          union all
          (select 'power-clash', 'friend',
                  coalesce((select o.display_name from public.profiles o
                            where o.id = case when pg.seat1 = student then pg.seat2 else pg.seat1 end), 'a classmate'),
                  case when pm.won and not pm.left_game then 'won' else 'lost' end,
                  case when pm.left_game then 'abandoned' else pm.ending end, pm.finished_at, null
           from power_mine pm join public.power_games pg on pg.id = pm.id
           order by pm.finished_at desc limit 10)
          order by finished_at desc limit 10) x)
    )
    where exists (select 1 from public.profiles p where p.id = student)
  );
end;
$function$;

-- Class totals: only the students in the teacher's classes.
CREATE OR REPLACE FUNCTION public.teacher_gem_keep_class()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.require_teacher();
  return (
    with students as (select m as id from public.my_students() as m)
    select jsonb_build_object(
      'players', (select count(distinct g.player) from public.gem_keep_progress g join students s on s.id = g.player),
      'levels', (select coalesce(jsonb_agg(jsonb_build_object('levelId', x.level_id, 'won', x.won, 'keys', x.keys)
          order by x.level_id), '[]')
        from (select g.level_id, count(*) filter (where g.wins > 0) as won, count(*) filter (where g.key_passed) as keys
              from public.gem_keep_progress g join students s on s.id = g.player group by g.level_id) x),
      'hardest', (select coalesce(jsonb_agg(jsonb_build_object(
          'key', x.fact_key, 'students', x.students, 'attempts', x.attempts, 'correct', x.correct)
          order by x.wrong_share desc, x.attempts desc), '[]')
        from (select f.fact_key, count(*) as students, sum(f.attempts) as attempts, sum(f.correct) as correct,
                     1 - sum(f.correct)::numeric / sum(f.attempts) as wrong_share
              from public.gem_keep_facts f join students s on s.id = f.player
              where f.pack = 'times-tables' and f.attempts > 0
              group by f.fact_key
              having sum(f.attempts) >= 6 and count(*) >= 2 and sum(f.correct) < sum(f.attempts)
              order by wrong_share desc, attempts desc
              limit 10) x)
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.teacher_monster_class()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.require_teacher();
  return (
    with students as (select m as id from public.my_students() as m),
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
              where r.at > now() - interval '14 days' and r.player in (select public.my_students())
              order by r.at desc limit 15) y)
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.teacher_lord_class()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.require_teacher();
  return (
    with students as (select m as id from public.my_students() as m),
    heroes as (select h.player, h.season, h.hero from public.lord_heroes h join students s on s.id = h.player)
    select jsonb_build_object(
      'season', (select jsonb_build_object(
          'number', public.lord_current_season(),
          'start', to_char(a.lord_season_start, 'YYYY-MM-DD'),
          'daysLeft', case when public.lord_current_season() is null then null
                           else 35 - (((public.nz_day(now()) - a.lord_season_start) % 35) + 1) end)
        from public.settings_of(auth.uid()) a),
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
              where r.at > now() - interval '14 days' and r.player in (select public.my_students())
              order by r.at desc limit 20) w),
      'hall', (select coalesce(jsonb_agg(jsonb_build_object(
          'season', v.season, 'name', v.display_name, 'realName', v.real_name, 'kills', v.kills) order by v.season desc, v.kills desc, v.first_at), '[]')
        from (select hl.season, p.display_name, split_part(u.email, '@', 1) as real_name, hl.kills, hl.first_at
              from public.lord_hall hl
              join public.profiles p on p.id = hl.player
              left join auth.users u on u.id = p.id
              where hl.player in (select public.my_students())
              order by hl.season desc, hl.kills desc, hl.first_at limit 60) v)
    )
  );
end;
$function$;

-- The list of players on the teacher page: my students (a school admin: every student in the school), and the school's teachers.

create or replace function public.teacher_students()
returns table(id uuid, display_name text, real_name text, avatar jsonb, role text, hidden boolean, bot_games integer, friend_games integer, points integer, last_played timestamp with time zone, joined timestamp with time zone)
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
  where p.id in (select public.my_students())
     or (p.role = 'teacher' and p.school_id = public.my_school())
  order by p.role desc, split_part(u.email, '@', 1), p.display_name;
end;
$$;

-- Making and un-making teachers: a school admin, inside their own school.

create or replace function public.teacher_set_role(person uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_school_admin();
  if person = auth.uid() then
    raise exception 'You can''t change your own role.' using errcode = '42501';
  end if;
  if new_role not in ('student', 'teacher') then
    raise exception 'That isn''t a role.' using errcode = '22023';
  end if;
  update public.profiles set role = new_role, school_admin = (school_admin and new_role = 'teacher')
  where id = person and school_id = public.my_school();
  if not found then
    raise exception 'We couldn''t find that player.' using errcode = '22023';
  end if;
  -- A teacher turned back into a student stops teaching; a student made a teacher leaves their class.
  delete from public.class_teachers where teacher_id = person and new_role <> 'teacher';
  delete from public.class_members where student_id = person and new_role <> 'student';
end;
$$;

-- Make another teacher of this school a school admin, or take it away.

create function public.school_set_admin(person uuid, make_admin boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_school_admin();
  if person = auth.uid() then
    raise exception 'You can''t change your own role.' using errcode = '42501';
  end if;
  update public.profiles set school_admin = make_admin
  where id = person and school_id = public.my_school() and role = 'teacher';
  if not found then
    raise exception 'That person isn''t a teacher at your school.' using errcode = '22023';
  end if;
end;
$$;

-- New season: a school admin starts it, for their own school only.

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
  mine uuid[];
begin
  perform public.require_school_admin();
  if confirm is distinct from 'NEW SEASON' then
    raise exception 'Type NEW SEASON to start a new season.' using errcode = '22023';
  end if;
  select coalesce(array_agg(p.id), '{}') into mine from public.profiles p where p.school_id = public.my_school();
  delete from public.achievements
  where player = any (mine)
    and achievement not in (select t.id from public.achievement_types t where t.game in ('monsters', 'dragon-maths'));
  delete from public.scored_games where player = any (mine);
  delete from public.ratings where player = any (mine);
  delete from public.bot_games where player = any (mine);
  get diagnostics bot_count = row_count;
  delete from public.mp_games
  where status in ('finished', 'cancelled', 'expired') and coalesce(created_by, first_player, second_player) = any (mine);
  get diagnostics friend_count = row_count;
  -- A finished game a newer one points at (a rematch) goes too; the link just empties.
  delete from public.space_games
  where status in ('finished', 'cancelled', 'expired') and coalesce(host, seat1) = any (mine);
  get diagnostics space_count = row_count;
  delete from public.card_games
  where status in ('finished', 'cancelled', 'expired') and coalesce(host, seat1) = any (mine);
  get diagnostics card_count = row_count;
  delete from public.power_games
  where status in ('finished', 'cancelled', 'expired') and coalesce(host, seat1) = any (mine);
  get diagnostics power_count = row_count;
  delete from public.gem_keep_runs where player = any (mine);
  get diagnostics gem_count = row_count;
  delete from public.gem_keep_progress where player = any (mine);
  delete from public.gem_keep_facts where pack = 'times-tables' and player = any (mine);
  delete from public.fact_answer_batches where player = any (mine);
  -- Maths Monsters: the points go, the adventure stays.
  delete from public.monster_events where player = any (mine);
  update public.monster_saves set wild_wins_pending = 0 where player = any (mine);
  -- Dragon Maths: the points go, the heroes, stars, Hall of Heroes and achievements stay.
  delete from public.lord_scores where player = any (mine);
  update public.lord_heroes set wins_pending = 0 where player = any (mine);
  return jsonb_build_object('botGames', bot_count, 'friendGames', friend_count + space_count + card_count + power_count,
    'gemKeepLevels', gem_count);
end;
$$;


-- ---------------------------------------------------------------------------
-- Playing, boards and lobbies stay inside one school
-- ---------------------------------------------------------------------------

-- Chess and checkers boards: this school only.
CREATE OR REPLACE FUNCTION public.leaderboard(game text, board text)
 RETURNS TABLE(place integer, display_name text, avatar jsonb, rank text, points integer, games integer, is_me boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  week_start timestamptz := public.nz_week_start(now());
  which_game text := leaderboard.game;
begin
  if not public.is_school_user() then
    return;
  end if;
  if which_game not in ('chess', 'checkers') or board not in ('week', 'all-time', 'improved') then
    raise exception 'That leaderboard doesn''t exist.' using errcode = '22023';
  end if;

  return query
  with players as (
    -- Everyone who could be on a board: not hidden.
    select p.id, p.display_name, p.avatar,
           coalesce(r.rating, public.start_rating()) as rating,
           coalesce(r.rated_games, 0) as rated_games
    from public.profiles p
    left join public.ratings r on r.player = p.id and r.game = which_game
    where not p.hidden and p.school_id = public.my_school()
  ),
  this_week as (
    select s.player,
           sum(s.points)::integer as points,
           count(*)::integer as games,
           count(*) filter (where s.rated)::integer as rated,
           coalesce(sum(s.rating_change) filter (where s.rated), 0)::integer as rise
    from public.scored_games s
    where s.game = which_game and s.finished_at >= week_start
    group by s.player
  ),
  week_badges as (
    select a.player, count(*)::integer * public.achievement_points() as points
    from public.achievements a join public.achievement_types t on t.id = a.achievement
    where t.game = which_game and a.earned_at >= week_start
    group by a.player
  ),
  scored as (
    select pl.id, pl.display_name, pl.avatar,
           public.rank_name(public.rank_for(pl.rating, pl.rated_games)) as rank,
           case board
             when 'week' then coalesce(w.points, 0) + coalesce(wb.points, 0)
             when 'all-time' then pl.rating
             else coalesce(w.rise, 0)
           end as score,
           case board
             when 'week' then coalesce(w.games, 0)
             when 'all-time' then pl.rated_games
             else coalesce(w.rated, 0)
           end as games,
           case board
             when 'week' then coalesce(w.games, 0) >= 3
             when 'all-time' then pl.rated_games >= 5
             else coalesce(w.rated, 0) >= 3 and coalesce(w.rise, 0) > 0
           end as qualifies
    from players pl
    left join this_week w on w.player = pl.id
    left join week_badges wb on wb.player = pl.id
  ),
  placed as (
    select s.*, rank() over (order by s.score desc)::integer as place,
           row_number() over (order by s.score desc, s.display_name) as row_order
    from scored s where s.qualifies
  )
  select pl.place, pl.display_name, pl.avatar, pl.rank,
         case when board = 'week' then pl.score end,
         pl.games, pl.id = auth.uid()
  from placed pl
  where pl.row_order <= 10 or pl.id = auth.uid()
  union all
  -- Not on the board yet: just their own line, with no place, so the page can say why.
  select null, s.display_name, s.avatar, s.rank, case when board = 'week' then s.score end, s.games, true
  from scored s
  where s.id = auth.uid() and not s.qualifies
  order by 1 nulls last, 2;
end;
$function$;

-- Gem Keep board.
CREATE OR REPLACE FUNCTION public.gem_keep_leaderboard()
 RETURNS TABLE(place integer, display_name text, avatar jsonb, stars integer, level_keys integer, is_me boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_school_user() then
    return;
  end if;
  return query
  with totals as (
    select p.id, p.display_name, p.avatar,
           coalesce(sum(g.best_stars), 0)::integer as stars,
           (count(*) filter (where g.key_passed))::integer as level_keys
    from public.profiles p
    join public.gem_keep_progress g on g.player = p.id
    where not p.hidden and p.school_id = public.my_school()
    group by p.id
  ),
  placed as (
    select t.*, rank() over (order by t.stars desc)::integer as place,
           row_number() over (order by t.stars desc, t.level_keys desc, t.display_name) as row_order
    from totals t where t.stars > 0
  )
  select pl.place, pl.display_name, pl.avatar, pl.stars, pl.level_keys, pl.id = auth.uid()
  from placed pl
  where pl.row_order <= 10 or pl.id = auth.uid()
  order by pl.row_order;
end;
$function$;

-- Maths Monsters board.
CREATE OR REPLACE FUNCTION public.monsters_leaderboard()
 RETURNS TABLE(place integer, display_name text, avatar jsonb, monsters integer, badges integer, is_me boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    where not p.hidden and p.school_id = public.my_school() and m.owned_count > 0
  )
  select pl.place, pl.display_name, pl.avatar, pl.monsters, pl.badges, pl.id = auth.uid()
  from placed pl
  where pl.row_order <= 10 or pl.id = auth.uid()
  order by pl.row_order;
end;
$function$;

-- Dragon Maths: Hall of Heroes and warriors.
CREATE OR REPLACE FUNCTION public.lord_hall()
 RETURNS TABLE(season integer, display_name text, avatar jsonb, kills integer, is_me boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_school_user() then
    return;
  end if;
  return query
  select hl.season, p.display_name, p.avatar, hl.kills, hl.player = auth.uid()
  from public.lord_hall hl
  join public.profiles p on p.id = hl.player
  where not p.hidden and p.school_id = public.my_school()
  order by hl.season desc, hl.kills desc, hl.first_at
  limit 100;
end;
$function$;

CREATE OR REPLACE FUNCTION public.lord_warriors()
 RETURNS TABLE(place integer, display_name text, avatar jsonb, level integer, stars integer, dragons integer, is_me boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_school_user() then
    return;
  end if;
  return query
  with cur as (select public.lord_current_season(auth.uid()) as n),
  base as (
    select p.id, p.display_name as name, p.avatar as pic,
           (h.hero ->> 'level')::integer as hero_level,
           coalesce((h.hero ->> 'dragonKills')::integer, 0) as hero_stars,
           coalesce((h.hero ->> 'exp')::numeric, 0) as hero_exp,
           coalesce((select hl.kills from public.lord_hall hl where hl.player = h.player and hl.season = cur.n), 0) as season_kills
    from public.lord_heroes h
    join public.profiles p on p.id = h.player
    cross join cur
    where h.season = cur.n and not p.hidden and p.school_id = public.my_school()
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
$function$;

-- Dragon Maths arena: only classmates from the same school as the player.
CREATE OR REPLACE FUNCTION public.lord_arena_candidates(player uuid, season integer, lvl integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
        and p.school_id = (select me.school_id from public.profiles me where me.id = lord_arena_candidates.player)
        and abs((h.hero ->> 'level')::integer - lvl) <= 2
      order by abs((h.hero ->> 'level')::integer - lvl), random()
      limit 12) x);
end;
$function$;


-- Daily News belongs to a school (the village line is one a day for each school, not one for the whole hub).
alter table public.lord_news add column school_id integer references public.schools (id);
update public.lord_news n set school_id = coalesce((select p.school_id from public.profiles p where p.id = n.player), 1);
alter table public.lord_news alter column school_id set not null;
alter table public.lord_news drop constraint lord_news_day_dedupe_key;
alter table public.lord_news add constraint lord_news_school_day_dedupe_key unique (school_id, day, dedupe);

create function public.lord_news_school()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.school_id is null and new.player is not null then
    new.school_id := (select p.school_id from public.profiles p where p.id = new.player);
  end if;
  return new;
end;
$$;
-- Before-row triggers run before the not-null check, so a line about a pupil gets its school here.
create trigger lord_news_school before insert on public.lord_news
for each row execute function public.lord_news_school();

CREATE OR REPLACE FUNCTION public.lord_commit(player uuid, change jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    on conflict (school_id, day, dedupe) do nothing;
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
$function$;

-- The day's own news lines are written for the school of the pupil who opened the game.
drop function public.lord_daily_news(date, jsonb);

create function public.lord_daily_news(player uuid, news_day date, lines jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  line jsonb;
  home integer;
begin
  if news_day is distinct from public.nz_day(now()) or jsonb_typeof(lines) is distinct from 'array' then
    raise exception 'That news couldn''t be read.' using errcode = '22023';
  end if;
  perform public.gem_keep_check_player(player);
  select p.school_id into home from public.profiles p where p.id = lord_daily_news.player;
  for line in select * from jsonb_array_elements(lines) loop
    insert into public.lord_news (school_id, day, kind, player, text, dedupe)
    values (home, news_day, line ->> 'kind', null, left(line ->> 'text', 300), left(line ->> 'dedupe', 80))
    on conflict (school_id, day, dedupe) do nothing;
  end loop;
end;
$$;

CREATE OR REPLACE FUNCTION public.load_lord(player uuid, request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    'dailyDone', exists (select 1 from public.lord_news n
      where n.day = public.nz_day(now()) and n.dedupe = 'village'
        and n.school_id = (select me.school_id from public.profiles me where me.id = load_lord.player)));
end;
$function$;

CREATE OR REPLACE FUNCTION public.lord_news()
 RETURNS TABLE(day date, kind text, line text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_school_user() then
    return;
  end if;
  return query
  select n.day, n.kind, replace(n.text, '{p}', coalesce(p.display_name, 'A hero'))
  from public.lord_news n
  left join public.profiles p on p.id = n.player
  where n.day >= public.nz_day(now()) - 3 and (n.player is null or not p.hidden)
    and n.school_id = public.my_school()
  order by n.day desc, n.created_at desc
  limit 60;
end;
$function$;

-- Lobbies list only games made by students of the same school (and honour my class's switch).
CREATE OR REPLACE FUNCTION public.lobby_games()
 RETURNS TABLE(id uuid, game text, creator_name text, creator_avatar jsonb, open_side text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select g.id, g.game, p.display_name, p.avatar,
         case when g.first_player is null then 'first' else 'second' end,
         g.created_at
  from public.mp_games g
  join public.profiles p on p.id = g.created_by
  where public.is_school_user()
    and (select s.multiplayer_enabled from public.settings_of(auth.uid()) s)
    and g.status = 'waiting'
    and g.in_lobby
    and g.expires_at > now()
    and not p.hidden
    and p.school_id = public.my_school()
    and g.created_by <> auth.uid()
  order by g.created_at desc
  limit 30
$function$;

CREATE OR REPLACE FUNCTION public.card_lobby_games()
 RETURNS TABLE(id uuid, creator_name text, creator_avatar jsonb, players integer, wanted integer, target integer, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select g.id, p.display_name, p.avatar, num_nonnulls(g.seat1, g.seat2, g.seat3, g.seat4), g.wanted::integer,
         (g.settings ->> 'target')::integer, g.created_at
  from public.card_games g
  join public.profiles p on p.id = g.host
  where public.is_school_user()
    and (select s.multiplayer_enabled from public.settings_of(auth.uid()) s)
    and g.status = 'waiting'
    and g.in_lobby
    and g.expires_at > now()
    and not p.hidden
    and p.school_id = public.my_school()
    and num_nonnulls(g.seat1, g.seat2, g.seat3, g.seat4) < g.wanted
    and auth.uid() is distinct from g.seat1 and auth.uid() is distinct from g.seat2
    and auth.uid() is distinct from g.seat3 and auth.uid() is distinct from g.seat4
  order by g.created_at desc
  limit 30
$function$;

CREATE OR REPLACE FUNCTION public.space_lobby_games()
 RETURNS TABLE(id uuid, creator_name text, creator_avatar jsonb, players integer, board jsonb, mode text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select g.id, p.display_name, p.avatar, num_nonnulls(g.seat1, g.seat2, g.seat3, g.seat4),
         g.setup -> 'board', g.setup -> 'settings' ->> 'mode', g.created_at
  from public.space_games g
  join public.profiles p on p.id = g.host
  where public.is_school_user()
    and (select s.multiplayer_enabled from public.settings_of(auth.uid()) s)
    and g.status = 'waiting'
    and g.in_lobby
    and g.expires_at > now()
    and not p.hidden
    and p.school_id = public.my_school()
    and num_nonnulls(g.seat1, g.seat2, g.seat3, g.seat4) < 4
    and auth.uid() is distinct from g.seat1 and auth.uid() is distinct from g.seat2
    and auth.uid() is distinct from g.seat3 and auth.uid() is distinct from g.seat4
  order by g.created_at desc
  limit 30
$function$;

CREATE OR REPLACE FUNCTION public.power_lobby_games()
 RETURNS TABLE(id uuid, creator_name text, creator_avatar jsonb, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select g.id, p.display_name, p.avatar, g.created_at
  from public.power_games g
  join public.profiles p on p.id = g.host
  where public.is_school_user()
    and (select s.multiplayer_enabled from public.settings_of(auth.uid()) s)
    and g.status = 'waiting'
    and g.in_lobby
    and g.expires_at > now()
    and not p.hidden
    and p.school_id = public.my_school()
    and g.seat2 is null
    and auth.uid() is distinct from g.seat1
  order by g.created_at desc
  limit 30
$function$;

-- Game servers ask this before letting someone in. New last column: the player's school.
drop function public.mp_player_status(uuid);

create function public.mp_player_status(player uuid)
returns table(school boolean, hidden boolean, multiplayer_enabled boolean, created_last_hour integer, school_id integer)
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
         coalesce((select s.multiplayer_enabled from public.settings_of(player) s), false),
         (select count(*)::integer from public.mp_games g
          where g.created_by = player and g.created_at > now() - interval '1 hour'),
         (select p.school_id from public.profiles p where p.id = player)
$$;

drop function public.card_player_status(uuid, uuid[]);
CREATE OR REPLACE FUNCTION public.card_player_status(player uuid, others uuid[] DEFAULT '{}'::uuid[])
 RETURNS TABLE(school boolean, hidden boolean, multiplayer_enabled boolean, created_last_hour integer, gone uuid[], school_id integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
           select 1 from public.profiles p join auth.users u on u.id = p.id
           where p.id = player and public.is_school_email(u.email)
         ),
         coalesce((select p.hidden from public.profiles p where p.id = player), true),
         coalesce((select s.multiplayer_enabled from public.settings_of(player) s), false),
         (select count(*)::integer from public.card_games g
          where g.host = player and g.created_at > now() - interval '1 hour'),
         coalesce((select array_agg(o) from unnest(others) as o
           where o is not null and not exists (
             select 1 from public.profiles p join auth.users u on u.id = p.id
             where p.id = o and not p.hidden and public.is_school_email(u.email)
               and p.school_id = (select me.school_id from public.profiles me where me.id = player))), '{}'),
         (select p.school_id from public.profiles p where p.id = player)
$function$;

drop function public.power_player_status(uuid, uuid[]);
CREATE OR REPLACE FUNCTION public.power_player_status(player uuid, others uuid[] DEFAULT '{}'::uuid[])
 RETURNS TABLE(school boolean, hidden boolean, multiplayer_enabled boolean, created_last_hour integer, gone uuid[], school_id integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
           select 1 from public.profiles p join auth.users u on u.id = p.id
           where p.id = player and public.is_school_email(u.email)
         ),
         coalesce((select p.hidden from public.profiles p where p.id = player), true),
         coalesce((select s.multiplayer_enabled from public.settings_of(player) s), false),
         (select count(*)::integer from public.power_games g
          where g.host = player and g.created_at > now() - interval '1 hour'),
         coalesce((select array_agg(o) from unnest(others) as o
           where o is not null and not exists (
             select 1 from public.profiles p join auth.users u on u.id = p.id
             where p.id = o and not p.hidden and public.is_school_email(u.email)
               and p.school_id = (select me.school_id from public.profiles me where me.id = player))), '{}'),
         (select p.school_id from public.profiles p where p.id = player)
$function$;

drop function public.space_player_status(uuid, uuid[]);
CREATE OR REPLACE FUNCTION public.space_player_status(player uuid, others uuid[] DEFAULT '{}'::uuid[])
 RETURNS TABLE(school boolean, hidden boolean, multiplayer_enabled boolean, reactions_enabled boolean, created_last_hour integer, gone uuid[], school_id integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
           select 1 from public.profiles p join auth.users u on u.id = p.id
           where p.id = player and public.is_school_email(u.email)
         ),
         coalesce((select p.hidden from public.profiles p where p.id = player), true),
         coalesce((select s.multiplayer_enabled from public.settings_of(player) s), false),
         coalesce((select s.space_reactions_enabled from public.settings_of(player) s), false),
         (select count(*)::integer from public.space_games g
          where g.host = player and g.created_at > now() - interval '1 hour'),
         coalesce((select array_agg(o) from unnest(others) as o
           where o is not null and not exists (
             select 1 from public.profiles p join auth.users u on u.id = p.id
             where p.id = o and not p.hidden and public.is_school_email(u.email)
               and p.school_id = (select me.school_id from public.profiles me where me.id = player))), '{}'),
         (select p.school_id from public.profiles p where p.id = player)
$function$;


-- Nobody is ever seated with a player from another school, whatever a game server does (a second wall
-- behind the servers' own checks).
create function public.check_same_school_seats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  schools integer;
begin
  if tg_table_name = 'mp_games' then
    select count(distinct p.school_id) into schools from public.profiles p
    where p.id in (new.created_by, new.first_player, new.second_player);
  elsif tg_table_name = 'space_games' then
    select count(distinct p.school_id) into schools from public.profiles p
    where p.id in (new.host, new.seat1, new.seat2, new.seat3, new.seat4);
  elsif tg_table_name = 'power_games' then
    select count(distinct p.school_id) into schools from public.profiles p
    where p.id in (new.host, new.seat1, new.seat2);
  elsif tg_table_name = 'card_game_seats' then
    select count(distinct p.school_id) into schools from public.profiles p
    where p.id in (new.player, (select g.host from public.card_games g where g.id = new.game));
  end if;
  if schools > 1 then
    raise exception 'You can only play with students from your own school.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger check_same_school_seats before insert or update on public.mp_games
for each row execute function public.check_same_school_seats();
create trigger check_same_school_seats before insert or update on public.space_games
for each row execute function public.check_same_school_seats();
create trigger check_same_school_seats before insert or update on public.power_games
for each row execute function public.check_same_school_seats();
create trigger check_same_school_seats before insert or update on public.card_game_seats
for each row execute function public.check_same_school_seats();

-- Teachers could read every Power Clash game. Now only those of their own students.
drop policy "Players see their Power Clash games, teachers all" on public.power_games;
create policy "Players see their Power Clash games, teachers those of their own students"
on public.power_games for select to authenticated
using (
  public.is_school_user()
  and (auth.uid() in (seat1, seat2)
       or (public.is_teacher() and (public.can_manage_student(seat1) or public.can_manage_student(seat2))))
);


-- ---------------------------------------------------------------------------
-- Who can call what (the functions replaced above with a new argument list start locked)
-- ---------------------------------------------------------------------------


grant execute on function
  public.teacher_set_multiplayer(boolean, uuid),
  public.teacher_set_space_reactions(boolean, uuid),
  public.teacher_set_space_maths(text, uuid),
  public.teacher_set_gem_keep(jsonb, uuid),
  public.teacher_set_monsters(jsonb, uuid),
  public.teacher_set_lord(jsonb, uuid),
  public.school_set_admin(uuid, boolean)
to authenticated;

-- >>> lock new functions
-- Supabase lets everyone (even a signed-out visitor) call a new function unless it is locked, so lock
-- every function this file made. The grants above and in the earlier migrations are the only way in.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'card_lobby_games',
      'card_player_status',
      'check_same_school_seats',
      'gem_keep_leaderboard',
      'gem_keep_settings',
      'leaderboard',
      'load_lord',
      'lobby_games',
      'lord_arena_candidates',
      'lord_commit',
      'lord_current_season',
      'lord_daily_news',
      'lord_hall',
      'lord_news',
      'lord_news_school',
      'lord_server_settings',
      'lord_settings',
      'lord_warriors',
      'monsters_leaderboard',
      'monsters_settings',
      'mp_player_status',
      'my_progress',
      'power_lobby_games',
      'power_player_status',
      'progress_rules',
      'record_gem_keep_key',
      'require_settings_target',
      'school_set_admin',
      'settings_to_change',
      'space_lobby_games',
      'space_maths_context',
      'space_player_status',
      'teacher_delete_student',
      'teacher_gem_keep_class',
      'teacher_gem_keep_student',
      'teacher_lord_class',
      'teacher_lord_student',
      'teacher_monster_class',
      'teacher_monster_student',
      'teacher_new_season',
      'teacher_reset_lord_hero',
      'teacher_reset_name',
      'teacher_set_gem_keep',
      'teacher_set_hidden',
      'teacher_set_lord',
      'teacher_set_monsters',
      'teacher_set_multiplayer',
      'teacher_set_role',
      'teacher_set_space_maths',
      'teacher_set_space_reactions',
      'teacher_student_detail',
      'teacher_students'
    )
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
  end loop;
end;
$$;
-- <<< lock new functions
