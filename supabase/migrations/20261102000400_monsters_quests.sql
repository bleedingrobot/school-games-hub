-- Maths Monsters quests (docs/MONSTERS-QUESTS-PLAN.md, stage Q.5). Only Maths Monsters' own functions:
-- 1. Days of play: monster_saves.play_days counts the NZ days with at least one answered question,
--    and play_day is the last one. Eggs hatch after 3, 5 or 7 of them, so a Chromebook's clock can't
--    hurry an egg. load_monster_save() gives them to the monster function (its save check) and
--    my_monsters() gives the count to the game. Existing players start from 0.
-- 2. A sleeping giant's battle ("giant" in the battle) doesn't count towards the 12 battles a day.
-- 3. Quest points: 2 a story quest step, 1 a notice board job (summary.questPoints, from the save
--    check), on top of the save's other points. The daily points cap still applies.
-- 4. eggs_hatched, a running count, ready for an "Egg-cellent" achievement.
-- Not here, because they change shared functions (James to decide, as their own small change): the
-- five new achievements, and the egg line on the dashboard card (my_moves_left).

alter table public.monster_saves
  add column play_days integer not null default 0 check (play_days >= 0),
  add column play_day date,
  add column eggs_hatched integer not null default 0 check (eggs_hatched >= 0);

-- As in 20261027000200_monster_battle_cap.sql, plus: a giant battle never counts.
create or replace function public.monster_counts_for_cap(battle jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(battle ->> 'map', '') not like 'tower-%'
     and not (battle ? 'giant')
     and exists (select 1 from jsonb_array_elements(coalesce(battle -> 'steps', '[]'::jsonb)) s
                 where jsonb_typeof(s -> 'q') = 'object')
$$;

-- As in 20261018001500_maths_monsters.sql, plus the days of play.
create or replace function public.load_monster_save(player uuid)
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
  return jsonb_build_object('world', s.world, 'version', s.version, 'clientAt', s.client_at,
    'playDays', s.play_days, 'playDay', s.play_day);
end;
$$;

-- As in 20261027000200_monster_battle_cap.sql, plus the days of play, quest points and eggs hatched (marked "Quests").
create or replace function public.record_monster_save(player uuid, save jsonb)
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
  per_day integer := (public.monster_battle_rules() ->> 'battlesPerDay')::integer;
  room integer;
  counted integer;
  late_wild integer;
  late_trainers integer;
  -- Quests: a day of play is an NZ day with at least one answered question.
  today date := public.nz_day(now());
  played boolean;
  new_play_days integer;
  new_play_day date;
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

  -- Battle limit: the save is kept, but wins in battles past today's limit earn no points.
  room := greatest(per_day - public.monster_battles_today(player), 0);
  select count(*) filter (where c),
         count(*) filter (where c and n > room and won and kind = 'wild'),
         count(*) filter (where c and n > room and won and kind = 'trainer')
  into counted, late_wild, late_trainers
  from (select public.monster_counts_for_cap(b) as c, b ->> 'outcome' = 'won' as won, b -> 'setup' ->> 'kind' as kind,
               count(*) filter (where public.monster_counts_for_cap(b)) over (order by i) as n
        from jsonb_array_elements(coalesce(save -> 'battles', '[]'::jsonb)) with ordinality as t(b, i)) x;

  played := (smry ->> 'questions')::integer > 0 and (cur.play_day is null or cur.play_day < today);
  new_play_days := coalesce(cur.play_days, 0) + (case when played then 1 else 0 end);
  new_play_day := case when played then today else cur.play_day end;

  pending := coalesce(cur.wild_wins_pending, 0) + greatest(wild - late_wild, 0);
  raw := (pending / (rules ->> 'wildWinsPerPoint')::integer)
       + greatest(trainers - late_trainers, 0) * (rules ->> 'trainerWin')::integer
       + badges * (rules ->> 'badge')::integer
       -- Quests: 2 a story step, 1 a board job (worked out by the save check). Older websites send none.
       + least(greatest(coalesce((smry ->> 'questPoints')::integer, 0), 0), 40);

  insert into public.monster_saves as m (player, world, version, last_save_id, client_at, wild_wins_pending, catches,
    owned_count, seen_count, badges_count, final_in_team, play_days, play_day, eggs_hatched)
  values (player, save -> 'world', (save ->> 'seq')::integer, (save ->> 'saveId')::uuid, (save ->> 'at')::bigint,
    pending % (rules ->> 'wildWinsPerPoint')::integer, (smry ->> 'catches')::integer,
    (smry ->> 'owned')::integer, (smry ->> 'seen')::integer, (smry ->> 'badges')::integer, (smry ->> 'finalInTeam')::integer,
    new_play_days, new_play_day, greatest(coalesce((smry ->> 'hatched')::integer, 0), 0))
  on conflict on constraint monster_saves_pkey do update set
    world = excluded.world, version = excluded.version, last_save_id = excluded.last_save_id,
    saved_at = now(), client_at = excluded.client_at,
    wild_wins_pending = excluded.wild_wins_pending, catches = m.catches + excluded.catches,
    owned_count = excluded.owned_count, seen_count = excluded.seen_count, badges_count = excluded.badges_count,
    final_in_team = excluded.final_in_team,
    play_days = excluded.play_days, play_day = excluded.play_day, eggs_hatched = m.eggs_hatched + excluded.eggs_hatched;

  insert into public.monster_events (player, save_id, version, battles, wild_wins, trainer_wins, new_badges, catches,
    questions, right_answers, points_raw, counts_for_points, counted_battles)
  values (player, (save ->> 'saveId')::uuid, (save ->> 'seq')::integer, save -> 'battles', wild, trainers,
    coalesce((select array_agg(b) from jsonb_array_elements_text(smry -> 'newBadges') as b), '{}'),
    (smry ->> 'catches')::integer, (smry ->> 'questions')::integer, (smry ->> 'right')::integer, raw, raw > 0, counted)
  returning id into new_id;
  -- Scored by the trigger on monster_events; now award what the new counts earned.
  perform public.award_achievements(player, 'monsters', now());
  return jsonb_build_object('status', 'saved', 'version', (save ->> 'seq')::integer,
    'points', (select s.points from public.scored_games s where s.monster_save = new_id));
end;
$$;

-- As in 20261027000200_monster_battle_cap.sql, plus 'playDays'.
create or replace function public.my_monsters()
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
      from public.gem_keep_facts f where f.player = me.id),
    'battles', jsonb_build_object('today', public.monster_battles_today(me.id),
                                  'perDay', (public.monster_battle_rules() ->> 'battlesPerDay')::integer),
    'playDays', coalesce((select s.play_days from public.monster_saves s where s.player = me.id), 0)
  )
  from me
$$;

-- The same grants as before (create or replace keeps them); the new columns need none.
