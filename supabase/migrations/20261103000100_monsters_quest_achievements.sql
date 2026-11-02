-- Maths Monsters quests, the follow-up James chose (docs/MONSTERS-QUESTS-PLAN.md, "Went live"):
--
-- 1. Four running counts on monster_saves (story quests done, giants woken, rare and ultra rare monsters owned), set
--    from the save check's summary like owned_count. eggs_hatched is already there (20261102000400).
-- 2. Five achievements through the game hooks (20261020000100): a Monsters counts function in hub_games.counts_fn, so
--    progress_counts is not re-created. The older Monsters counts stay where they are.
-- 3. The dashboard egg line: an exact edit to my_moves_left so 'monsters' also sends the eggs carried, the days of play
--    and the last battle day (src/data/movesLeft.ts reads them). If the text is not found exactly once, nothing changes.

-- ---------------------------------------------------------------------------
-- 1. The counts
-- ---------------------------------------------------------------------------

alter table public.monster_saves
  add column quests_done integer not null default 0 check (quests_done >= 0),
  add column giants_woken integer not null default 0 check (giants_woken >= 0),
  add column rares_owned integer not null default 0 check (rares_owned >= 0),
  add column ultras_owned integer not null default 0 check (ultras_owned >= 0);

-- As in 20261102000400_monsters_quests.sql, plus the four counts (marked "Counts"). Older websites send none: 0.
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
    owned_count, seen_count, badges_count, final_in_team, play_days, play_day, eggs_hatched,
    quests_done, giants_woken, rares_owned, ultras_owned)
  values (player, save -> 'world', (save ->> 'seq')::integer, (save ->> 'saveId')::uuid, (save ->> 'at')::bigint,
    pending % (rules ->> 'wildWinsPerPoint')::integer, (smry ->> 'catches')::integer,
    (smry ->> 'owned')::integer, (smry ->> 'seen')::integer, (smry ->> 'badges')::integer, (smry ->> 'finalInTeam')::integer,
    new_play_days, new_play_day, greatest(coalesce((smry ->> 'hatched')::integer, 0), 0),
    -- Counts: totals in the save, like owned.
    greatest(coalesce((smry ->> 'questsDone')::integer, 0), 0), greatest(coalesce((smry ->> 'giantsWoken')::integer, 0), 0),
    greatest(coalesce((smry ->> 'raresOwned')::integer, 0), 0), greatest(coalesce((smry ->> 'ultrasOwned')::integer, 0), 0))
  on conflict on constraint monster_saves_pkey do update set
    world = excluded.world, version = excluded.version, last_save_id = excluded.last_save_id,
    saved_at = now(), client_at = excluded.client_at,
    wild_wins_pending = excluded.wild_wins_pending, catches = m.catches + excluded.catches,
    owned_count = excluded.owned_count, seen_count = excluded.seen_count, badges_count = excluded.badges_count,
    final_in_team = excluded.final_in_team,
    play_days = excluded.play_days, play_day = excluded.play_day, eggs_hatched = m.eggs_hatched + excluded.eggs_hatched,
    quests_done = excluded.quests_done, giants_woken = excluded.giants_woken,
    rares_owned = excluded.rares_owned, ultras_owned = excluded.ultras_owned;

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

-- ---------------------------------------------------------------------------
-- 2. The achievements
-- ---------------------------------------------------------------------------

-- A pupil's quest counts for the achievements (the older Monsters counts are in progress_counts).
create function public.monster_quest_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'monster_hatched', coalesce(sum(m.eggs_hatched), 0),
    'monster_giants', coalesce(sum(m.giants_woken), 0),
    'monster_rares', coalesce(sum(m.rares_owned), 0),
    'monster_quests', coalesce(sum(m.quests_done), 0),
    'monster_ultras', coalesce(sum(m.ultras_owned), 0))
  from public.monster_saves m where m.player = who
$$;
revoke execute on function public.monster_quest_counts(uuid) from public, anon, authenticated;

update public.hub_games set counts_fn = 'public.monster_quest_counts(uuid)' where id = 'monsters';

insert into public.achievement_measures (measure) values
  ('monster_hatched'), ('monster_giants'), ('monster_rares'), ('monster_quests'), ('monster_ultras');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('mm-egg-cellent', 'monsters', 'Egg-cellent: hatch your first egg', '🥚', 'monster_hatched', 1, 9),
  ('mm-wake-up-call', 'monsters', 'Wake-up call: wake a sleeping giant', '😴', 'monster_giants', 1, 10),
  ('mm-rare-find', 'monsters', 'Rare find: catch or hatch a rare monster', '✨', 'monster_rares', 1, 11),
  ('mm-quest-helper', 'monsters', 'Quest helper: finish 5 story quests', '📜', 'monster_quests', 5, 12),
  ('mm-legend-keeper', 'monsters', 'Legend keeper: own an ultra rare monster', '🐉', 'monster_ultras', 1, 13);

-- ---------------------------------------------------------------------------
-- 3. The dashboard egg line
-- ---------------------------------------------------------------------------

create or replace function pg_temp.edit_function(sig text, edits text[][])
returns void
language plpgsql
as $$
declare
  def text := pg_get_functiondef(sig::regprocedure);
  i integer;
begin
  for i in 1 .. array_length(edits, 1) loop
    if (length(def) - length(replace(def, edits[i][1], ''))) / length(edits[i][1]) <> 1 then
      raise exception '% edit % did not match exactly once; nothing was changed', sig, i;
    end if;
    def := replace(def, edits[i][1], edits[i][2]);
  end loop;
  execute def;
end;
$$;

select pg_temp.edit_function('public.my_moves_left()', array[array[
  E'''perDay'', (public.monster_battle_rules() ->> ''battlesPerDay'')::integer)\n                 from public.monster_saves s where s.player = me.id),',
  E'''perDay'', (public.monster_battle_rules() ->> ''battlesPerDay'')::integer,\n'
  || E'                                           ''eggs'', coalesce(s.world -> ''quest'' -> ''eggs'', ''[]''::jsonb),\n'
  || E'                                           ''playDays'', s.play_days, ''lastDay'', s.world -> ''quest'' -> ''lastDay'')\n'
  || E'                 from public.monster_saves s where s.player = me.id),'
]]);
