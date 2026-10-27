-- Maths Monsters: at most 12 battles a day (James, 27 Oct 2026).
--
-- A battle counts when it asked at least one maths question (running straight off costs nothing) and
-- it wasn't in a Tower (a badge is never held back). Days are New Zealand days, like the points cap.
--  - my_monsters() tells the game how many battles today and the limit, so it stops wild monsters and
--    trainers once the limit is reached (Tower battles stay open). See shared/monsters/world/battleCap.ts.
--  - record_monster_save() still keeps every save (a refused save would lose the child's game), but
--    wins in battles past the limit earn no points. That covers two Chromebooks played offline, or an
--    out-of-date copy of the website.
-- Nothing else changes: the save check, the monster function and the points rules are untouched.

-- EASY TO EDIT: the limit.
create function public.monster_battle_rules()
returns jsonb
language sql
immutable
set search_path = ''
as $$ select jsonb_build_object('battlesPerDay', 12) $$;

-- Does a saved battle count toward the limit? (The same rule as countsTowardCap in battleCap.ts.)
create function public.monster_counts_for_cap(battle jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(battle ->> 'map', '') not like 'tower-%'
     and exists (select 1 from jsonb_array_elements(coalesce(battle -> 'steps', '[]'::jsonb)) s
                 where jsonb_typeof(s -> 'q') = 'object')
$$;

alter table public.monster_events add column counted_battles integer not null default 0;
update public.monster_events e
set counted_battles = (select count(*) from jsonb_array_elements(e.battles) b where public.monster_counts_for_cap(b))
where jsonb_typeof(e.battles) = 'array';

-- Battles counted so far today (New Zealand day).
create function public.monster_battles_today(player uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(e.counted_battles), 0)::integer
  from public.monster_events e
  where e.player = monster_battles_today.player
    and e.finished_at >= (public.nz_day(now())::timestamp at time zone 'Pacific/Auckland')
$$;

-- As in 20261018001500_maths_monsters.sql, plus the battle limit (marked "Battle limit").
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

  pending := coalesce(cur.wild_wins_pending, 0) + greatest(wild - late_wild, 0);
  raw := (pending / (rules ->> 'wildWinsPerPoint')::integer)
       + greatest(trainers - late_trainers, 0) * (rules ->> 'trainerWin')::integer
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

-- As in 20261018001500_maths_monsters.sql, plus 'battles': how many today and the limit.
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
                                  'perDay', (public.monster_battle_rules() ->> 'battlesPerDay')::integer)
  )
  from me
$$;

revoke execute on function
  public.monster_battle_rules(), public.monster_counts_for_cap(jsonb), public.monster_battles_today(uuid)
from public, anon, authenticated;
