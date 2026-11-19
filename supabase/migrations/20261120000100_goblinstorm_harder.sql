-- Goblin Storm: heroes take longer to unlock and the gold shop costs more (James, 20 Nov 2026). Only these two
-- functions change; same names, arguments and grants as migration 20261119000900. The numbers match UNLOCK_AT and
-- SHOP_COSTS in shared/goblinstorm/config.ts (change them together):
--   wizard     reach level 35 in one run          barbarian  20,000 monsters beaten in all runs
--   cleric     beat the Goblin King (map 0)       rogue      120 seconds without being hit
--   witch      beat the Ice Dragon (map 3)        dragonkid  evolve 3 different weapons in one run
--   shop       150, 300, 500, 800, 1,200 gold for levels 1 to 5 (was 100, 200, 350, 550, 800); Armour stops at 3.
-- Heroes and shop levels already earned are kept.

create or replace function public.record_goblinstorm_run(player uuid, seed bigint, steering text, picks jsonb, summary jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  map_index smallint;
  extra_turn boolean;
  -- The 8 weapons (config.ts WEAPON_IDS): anything else in a summary is left out of the codex.
  known text[] := array['blades', 'fireball', 'lightning', 'aura', 'nova', 'axes', 'arrows', 'bubble'];
  evolved text[] := array(select distinct w from jsonb_array_elements_text(coalesce(summary -> 'evolved', '[]'::jsonb)) w
                          where w = any (known));
  held text[] := array(select distinct w from jsonb_array_elements_text(coalesce(summary -> 'weapons', '[]'::jsonb)) w
                       where w = any (known));
  boss boolean := coalesce((summary ->> 'bossBeaten')::boolean, false);
  run_outcome text := summary ->> 'outcome';
  run_gold integer := greatest(0, coalesce((summary ->> 'gold')::integer, 0));
  run_kills integer := greatest(0, coalesce((summary ->> 'kills')::integer, 0));
  run_level integer := coalesce((summary ->> 'level')::integer, 1);
  no_hit integer := coalesce((summary ->> 'longestNoHitSeconds')::integer, 0);
  kills_before integer;
  earned text[] := '{}';
  points integer;
begin
  if jsonb_typeof(record_goblinstorm_run.summary) is distinct from 'object' or jsonb_typeof(record_goblinstorm_run.picks) is distinct from 'array' then
    raise exception 'That run is not right.' using errcode = '22023';
  end if;
  update public.goblinstorm_runs r
  set open = false, steering = record_goblinstorm_run.steering, picks = record_goblinstorm_run.picks,
      outcome = run_outcome, seconds = (record_goblinstorm_run.summary ->> 'seconds')::integer,
      level = run_level,
      kills = run_kills, gold = run_gold, boss_beaten = boss, evolutions = evolved,
      summary = record_goblinstorm_run.summary, finished_at = now()
  where r.player = record_goblinstorm_run.player and r.seed = record_goblinstorm_run.seed and r.open
  returning r.map, r.extra into map_index, extra_turn;
  if not found then
    return false;
  end if;
  select s.kills into kills_before from public.goblinstorm_saves s where s.player = record_goblinstorm_run.player for update;
  kills_before := coalesce(kills_before, 0);
  if run_level >= 35 then earned := earned || 'wizard'::text; end if;
  if kills_before + run_kills >= 20000 then earned := earned || 'barbarian'::text; end if;
  if boss and map_index = 0 then earned := earned || 'cleric'::text; end if;
  if no_hit >= 120 then earned := earned || 'rogue'::text; end if;
  if boss and map_index = 3 then earned := earned || 'witch'::text; end if;
  if cardinality(evolved) >= 3 then earned := earned || 'dragonkid'::text; end if;
  insert into public.goblinstorm_saves as s (player, gold, heroes, bosses, codex, weapons, runs, kills)
  values (player, run_gold, earned, case when boss then array[map_index] else '{}' end, evolved, held, 1, run_kills)
  on conflict on constraint goblinstorm_saves_pkey do update
  set gold = s.gold + excluded.gold,
      heroes = s.heroes || array(select h from unnest(excluded.heroes) h where not (h = any (s.heroes))),
      bosses = case when boss and not (map_index = any (s.bosses)) then s.bosses || map_index else s.bosses end,
      codex = array(select distinct unnest(s.codex || excluded.codex) order by 1),
      weapons = array(select distinct unnest(s.weapons || excluded.weapons) order by 1),
      runs = s.runs + 1,
      kills = s.kills + excluded.kills,
      updated_at = now();
  points := case when run_outcome in ('won', 'survived', 'lost') and not extra_turn then 5 + case when boss then 5 else 0 end else 0 end;
  begin
    if points > 0 then
      perform public.add_game_points(player, 'goblinstorm', points, seed::text);
    else
      perform public.game_progress_changed(player, 'goblinstorm');
    end if;
  exception when others then
    raise warning 'Goblin Storm points failed (%)', sqlstate;
  end;
  return true;
end;
$$;

create or replace function public.buy_goblinstorm(item text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  costs integer[] := array[150, 300, 500, 800, 1200];
  top integer := case when item = 'armour' then 3 else 5 end;
  done jsonb;
  have public.goblinstorm_saves;
begin
  if me is null then
    raise exception 'Please sign in again.' using errcode = '42501';
  end if;
  perform public.gem_keep_check_player(me);
  if item is null or item not in ('might', 'armour', 'speed', 'health', 'magnet', 'gold') then
    raise exception 'Unknown Goblin Storm upgrade' using errcode = '22023';
  end if;
  update public.goblinstorm_saves s
  set gold = s.gold - costs[coalesce((s.shop ->> item)::integer, 0) + 1],
      shop = s.shop || jsonb_build_object(item, coalesce((s.shop ->> item)::integer, 0) + 1),
      updated_at = now()
  where s.player = me
    and coalesce((s.shop ->> item)::integer, 0) < top
    and s.gold >= costs[coalesce((s.shop ->> item)::integer, 0) + 1]
  returning jsonb_build_object('bought', true, 'reason', null, 'gold', s.gold, 'shop', s.shop) into done;
  if done is not null then
    return done;
  end if;
  select * into have from public.goblinstorm_saves s where s.player = me;
  if not found then
    return jsonb_build_object('bought', false, 'reason', 'none', 'gold', 0, 'shop', '{}'::jsonb);
  end if;
  return jsonb_build_object('bought', false,
    'reason', case when coalesce((have.shop ->> item)::integer, 0) >= top then 'top' else 'gold' end,
    'gold', have.gold, 'shop', have.shop);
end;
$$;
