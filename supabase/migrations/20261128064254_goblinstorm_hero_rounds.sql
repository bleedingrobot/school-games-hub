-- Goblin Storm hero rounds (James, 28 Nov 2026): to spread play over every hero, a boss win with each hero the pupil has
-- open is a hero round, paid like map rounds: +10, +20, +30 ... gold. Same rules as shared/goblinstorm/rounds.ts (keep
-- them together). Gold only: hub points are unchanged.
--   1. goblinstorm_saves.hero_wins ({"knight": 3, ...} boss wins by hero), hero_round (heroes won with since the last hero
--      round) and hero_rounds_paid.
--   2. hero_wins filled in from the boss wins already in goblinstorm_runs. Hero rounds start now (none back-paid).
--   3. record_goblinstorm_run: as migration 20261127210645, plus the hero round.
--   4. my_goblinstorm: as migration 20261127210645, plus 'heroWins', 'heroRound' and 'heroRoundsPaid'.
-- Nothing is removed; grants stay as they are (create or replace keeps them).

alter table public.goblinstorm_saves
  add column hero_wins jsonb not null default '{}' check (jsonb_typeof(hero_wins) = 'object'),
  add column hero_round text[] not null default '{}',
  add column hero_rounds_paid integer not null default 0 check (hero_rounds_paid >= 0);

update public.goblinstorm_saves s
set hero_wins = w.wins
from (select r.player, jsonb_object_agg(r.hero, r.n) as wins
      from (select player, hero, count(*)::integer as n from public.goblinstorm_runs where boss_beaten group by player, hero) r
      group by r.player) w
where w.player = s.player;

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
  -- Hero rounds (migration 20261128064254): the run's hero, whether every open hero has now won, and the hero bonus.
  run_hero text;
  hero_full boolean;
  hero_paid integer;
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
  returning r.map, r.extra, r.hero into map_index, extra_turn, run_hero;
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
  -- Hero rounds: a boss win counts for its hero; once every open hero (Knight, Ranger and those unlocked, including any
  -- this run unlocked) has won since the last hero round, hero round n pays 10 x n gold. Gold only, no hub points.
  if boss then
    update public.goblinstorm_saves s
    set hero_wins = s.hero_wins || jsonb_build_object(run_hero, coalesce((s.hero_wins ->> run_hero)::integer, 0) + 1),
        hero_round = case when run_hero = any (s.hero_round) then s.hero_round else s.hero_round || run_hero end
    where s.player = record_goblinstorm_run.player;
    select (array['knight', 'ranger']::text[] || s.heroes) <@ s.hero_round, s.hero_rounds_paid into hero_full, hero_paid
    from public.goblinstorm_saves s where s.player = record_goblinstorm_run.player;
    if hero_full then
      update public.goblinstorm_saves s
      set gold = s.gold + 10 * (hero_paid + 1), hero_rounds_paid = hero_paid + 1, hero_round = '{}'
      where s.player = record_goblinstorm_run.player;
    end if;
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
    'beats', to_jsonb(coalesce(s.beats, '{}')), 'roundsPaid', coalesce(s.rounds_paid, '{}'::jsonb),
    'heroWins', coalesce(s.hero_wins, '{}'::jsonb), 'heroRound', to_jsonb(coalesce(s.hero_round, '{}')),
    'heroRoundsPaid', coalesce(s.hero_rounds_paid, 0))
  from (select auth.uid() as player) me
  left join public.goblinstorm_saves s on s.player = me.player
  where me.player is not null
$$;
