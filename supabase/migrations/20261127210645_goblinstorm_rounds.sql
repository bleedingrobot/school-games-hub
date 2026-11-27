-- Goblin Storm round bonuses (James, 27 Nov 2026): to spread play over every map, each map counts how many times its
-- boss has been beaten, and beating every boss in a group again pays more gold: round 1 +10, round 2 +20, round 3 +30 ...
-- The Kingdom (maps 0-4) and the Storm Lands (maps 5-9) are separate groups. Same rules as shared/goblinstorm/rounds.ts
-- (keep them together). Gold is the game's own money: hub points are unchanged.
--   1. goblinstorm_saves.beats (wins per map, 1-based: beats[1] is Castle Fields) and rounds_paid ({"kingdom": n, ...}).
--   2. beats filled in from the boss wins already in goblinstorm_runs. rounds_paid starts at 0, so rounds already
--      finished are paid on the pupil's next run in that group.
--   3. record_goblinstorm_run: as migration 20261120000100, plus the beat and the round bonus.
--   4. my_goblinstorm: as migration 20261122001100, plus 'beats' and 'roundsPaid' for the map cards.
-- Nothing is removed; grants stay as they are (create or replace keeps them).

alter table public.goblinstorm_saves
  add column beats integer[] not null default '{}',
  add column rounds_paid jsonb not null default '{}' check (jsonb_typeof(rounds_paid) = 'object');

update public.goblinstorm_saves s
set beats = array(select coalesce(c.n, 0)::integer from generate_series(0, 9) i
                  left join (select r.map, count(*) as n from public.goblinstorm_runs r
                             where r.player = s.player and r.boss_beaten group by r.map) c on c.map = i
                  order by i)
where exists (select 1 from public.goblinstorm_runs r where r.player = s.player and r.boss_beaten);

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
  -- Round bonuses (shared/goblinstorm/rounds.ts): the map's group, its maps as 1-based array places, rounds done and paid.
  grp text := null;
  lo integer;
  hi integer;
  done integer;
  paid integer;
  bonus integer := 0;
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
  -- One more win on this map, then any whole rounds of its group not yet paid: round n pays 10 x n gold. Rounds finished
  -- before bonuses began (27 Nov 2026) are paid on the pupil's next run in that group. Gold only, no hub points.
  grp := case when map_index < 5 then 'kingdom' else 'storm' end;
  lo := case when grp = 'kingdom' then 1 else 6 end;
  hi := lo + 4;
  if boss then
    update public.goblinstorm_saves s
    set beats = array(select coalesce(s.beats[i], 0) + case when i = map_index + 1 then 1 else 0 end
                      from generate_series(1, greatest(10, coalesce(array_length(s.beats, 1), 0))) i order by i)
    where s.player = record_goblinstorm_run.player;
  end if;
  select (select min(coalesce(s.beats[i], 0)) from generate_series(lo, hi) i), coalesce((s.rounds_paid ->> grp)::integer, 0)
  into done, paid
  from public.goblinstorm_saves s where s.player = record_goblinstorm_run.player;
  if done > paid then
    bonus := 10 * (done * (done + 1) / 2 - paid * (paid + 1) / 2);
    update public.goblinstorm_saves s
    set gold = s.gold + bonus, rounds_paid = s.rounds_paid || jsonb_build_object(grp, done)
    where s.player = record_goblinstorm_run.player;
  end if;
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

create or replace function public.my_goblinstorm()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'gold', coalesce(s.gold, 0), 'shop', coalesce(s.shop, '{}'::jsonb), 'heroes', to_jsonb(coalesce(s.heroes, '{}')),
    'bosses', to_jsonb(coalesce(s.bosses, '{}')), 'codex', to_jsonb(coalesce(s.codex, '{}')),
    'weapons', to_jsonb(coalesce(s.weapons, '{}')),
    'runs', coalesce(s.runs, 0), 'kills', coalesce(s.kills, 0), 'guideSeen', coalesce(s.guide_seen, false),
    'bestGold', coalesce((select max(r.gold) from public.goblinstorm_runs r where r.player = me.player), 0),
    'today', (select count(*)::integer from public.goblinstorm_runs r
              where r.player = auth.uid() and r.day = (now() at time zone 'Pacific/Auckland')::date),
    'unlimited', public.unlimited_today(me.player, 'goblinstorm'),
    'beats', to_jsonb(coalesce(s.beats, '{}')), 'roundsPaid', coalesce(s.rounds_paid, '{}'::jsonb))
  from (select auth.uid() as player) me
  left join public.goblinstorm_saves s on s.player = me.player
  where me.player is not null
$$;
