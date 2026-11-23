-- Circuit Racer, Stage 6: Volt's tips, achievements, the teacher's column and reset (docs/CIRCUIT-PLAN.md, section 9).
-- The game is switched on for every class in the same PR (its code switch; the teacher switch was on from the start).
--
-- 1. circuit_seen: Volt's once-only tips each pupil has seen (shared/circuit/game.ts TIPS; change together), and
--    circuit_mark_seen(player, tips) (service role only). circuit_load also gives `seen` (newest body before this:
--    20261123000400_circuit_racers.sql).
-- 2. Achievements: circuit_counts(who) and circuit_players() as hub_games hooks, 6 measures and 9 achievements (game.ts
--    ACHIEVEMENTS; change together). All kept at New Season (keep_achievements).
--    Firewall Free counts hard_finishes, which record_circuit_finish only adds on a road finished before.
-- 3. teacher_progress_other_games: one more block, "Roads finished" (newest body: 20261119000900_goblinstorm.sql).
-- 4. teacher_reset_circuit(student): a teacher starts a pupil's Circuit Racer again (roads, runs, racer, seen tips and
--    kept questions). Points and achievements stay.

create table public.circuit_seen (
  player uuid primary key references public.profiles (id) on delete cascade,
  tips text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.circuit_seen enable row level security;
revoke all on public.circuit_seen from anon, authenticated;

-- { roads: { <road>: { best, medal, clean, charged, finishes, hardFinishes, hardBest } }, today, seen, racer }.
create or replace function public.circuit_load(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Pacific/Auckland')::date;
begin
  perform public.gem_keep_check_player(player);
  return jsonb_build_object(
    'roads', coalesce((select jsonb_object_agg(p.road, jsonb_build_object(
                'best', p.best_steps, 'medal', p.medal, 'clean', p.clean, 'charged', p.charged, 'finishes', p.finishes,
                'hardFinishes', p.hard_finishes, 'hardBest', p.hard_best))
              from public.circuit_progress p where p.player = circuit_load.player), '{}'::jsonb),
    'today', coalesce((select sum(p.day_finishes)::integer from public.circuit_progress p
              where p.player = circuit_load.player and p.day = today), 0),
    'seen', coalesce((select to_jsonb(s.tips) from public.circuit_seen s where s.player = circuit_load.player), '[]'::jsonb))
    -- No racer saved: no key (the function reads that as Spark).
    || coalesce((select jsonb_build_object('racer', r.racer) from public.circuit_racers r where r.player = circuit_load.player), '{}'::jsonb);
end;
$$;

-- Adds tips to the ones the pupil has seen: true when saved. Only Volt's known tips.
create function public.circuit_mark_seen(player uuid, tips text[])
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if tips is null or cardinality(tips) = 0 or cardinality(tips) > 5
     or not tips <@ array['guide', 'short', 'battery', 'crash', 'gate']::text[] then
    raise exception 'Those tips are not right.' using errcode = '22023';
  end if;
  -- `tips` is also a column: name the key (as Stage 5 learned).
  insert into public.circuit_seen as c (player, tips) values (circuit_mark_seen.player, circuit_mark_seen.tips)
  on conflict on constraint circuit_seen_pkey do update
  set tips = (select array_agg(distinct t order by t) from unnest(c.tips || excluded.tips) u(t)), updated_at = now();
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Achievements
-- ---------------------------------------------------------------------------

-- The measures, the same as circuitCounts in shared/circuit/game.ts: roads finished, roads with a no-crash finish, gold
-- medals, worlds open (the Motherboard always; a world opens with 4 of the 6 roads before it), Quantum Core roads
-- finished and hard-mode finishes. A road outside the 30 (a test road) never counts.
create function public.circuit_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with roads(road, world) as (
    values
      ('power-on', 0), ('clock-speed', 0), ('first-charge', 0), ('data-bus', 0), ('bridge-chips', 0), ('kernel-run', 0),
      ('hot-wire', 1), ('fan-alley', 1), ('pixel-pipeline', 1), ('render-farm', 1), ('shader-storm', 1), ('overclock-peak', 1),
      ('ram-stick', 2), ('cache-hit', 2), ('cold-storage', 2), ('tunnel-bus', 2), ('bit-flip', 2), ('stack-overflow', 2),
      ('upload', 3), ('sky-server', 3), ('cloud-hop', 3), ('stream-jump', 3), ('data-drift', 3), ('storm-cell', 3),
      ('qubit', 4), ('superposition', 4), ('entangled', 4), ('wave-bridge', 4), ('quantum-leap', 4), ('the-core', 4)
  ),
  mine as (
    select r.world, p.clean, p.medal, p.hard_finishes
    from public.circuit_progress p join roads r on r.road = p.road
    where p.player = who and p.finishes > 0
  )
  select jsonb_build_object(
    'circuit_roads', (select count(*) from mine),
    'circuit_clean', (select count(*) from mine m where m.clean),
    'circuit_golds', (select count(*) from mine m where m.medal = 'gold'),
    'circuit_worlds_open', 1 + (select count(*) from generate_series(0, 3) w(world)
                                where (select count(*) from mine m where m.world = w.world) >= 4),
    'circuit_core_roads', (select count(*) from mine m where m.world = 4),
    'circuit_hard', coalesce((select sum(m.hard_finishes) from mine m), 0))
$$;

create function public.circuit_players()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select distinct p.player from public.circuit_progress p
$$;

update public.hub_games
set counts_fn = 'public.circuit_counts(uuid)', players_fn = 'public.circuit_players()', keep_achievements = true
where id = 'circuit';

insert into public.achievement_measures (measure)
values ('circuit_roads'), ('circuit_clean'), ('circuit_golds'), ('circuit_worlds_open'), ('circuit_core_roads'), ('circuit_hard');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort, how, tier) values
  ('circuit-first-boot', 'circuit', 'First Boot', '🔌', 'circuit_roads', 1, 1, 'Finish your first Circuit Racer road.', 1),
  ('circuit-clean-run', 'circuit', 'Clean Run', '✨', 'circuit_clean', 1, 2, 'Finish a Circuit Racer road without crashing.', 1),
  ('circuit-world-hopper', 'circuit', 'World Hopper', '🌐', 'circuit_worlds_open', 2, 3, 'Open the Graphics Card in Circuit Racer.', 1),
  ('circuit-overclocked', 'circuit', 'Overclocked', '⚡', 'circuit_roads', 10, 4, 'Finish 10 Circuit Racer roads.', 2),
  ('circuit-gold', 'circuit', 'Gold Circuit', '🥇', 'circuit_golds', 1, 5, 'Win a gold medal on a Circuit Racer road.', 2),
  ('circuit-firewall', 'circuit', 'Firewall Free', '🔥', 'circuit_hard', 1, 6, 'Finish a Circuit Racer road in hard mode.', 2),
  ('circuit-cloud-rider', 'circuit', 'Cloud Rider', '☁️', 'circuit_worlds_open', 4, 7, 'Open The Cloud in Circuit Racer.', 2),
  ('circuit-core', 'circuit', 'Core Complete', '💠', 'circuit_core_roads', 6, 8, 'Finish all 6 Quantum Core roads in Circuit Racer.', 3),
  ('circuit-golden-board', 'circuit', 'Golden Board', '🏆', 'circuit_golds', 30, 9, 'Win gold on all 30 Circuit Racer roads.', 3);

-- ---------------------------------------------------------------------------
-- The teacher: "Roads finished" on the Progress tab, and starting a pupil again
-- ---------------------------------------------------------------------------

create or replace function public.teacher_progress_other_games(target_class uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if target_class is null or not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  return (
    with students as (
      select s.id from public.my_students() s(id)
      where exists (select 1 from public.class_members m where m.student_id = s.id and m.class_id = target_class)
    ),
    rows as (
      select g.player as student, 'gem-keep' as game,
             coalesce(max(g.level_number) filter (where g.result = 'won'), 0) as value, max(g.finished_at) as at
        from public.gem_keep_runs g join students s on s.id = g.player group by g.player
      union all
      select d.player, 'diamond', coalesce((d.state ->> 'deepest')::integer, 0), d.updated_at
        from public.diamond_players d join students s on s.id = d.player
      union all
      select h.player, 'dragon-maths', coalesce((h.hero ->> 'level')::integer, 0), h.saved_at
        from public.lord_heroes h join students s on s.id = h.player
      union all
      select b.player, 'bond-match', sum(b.best_stars)::integer, max(b.updated_at)
        from public.bond_match_bests b join students s on s.id = b.player group by b.player
      union all
      select t.player, 'toonflap',
             (select count(*) from jsonb_each(t.progress -> 'levels') l(id, rec) where (l.rec ->> 'finishes')::int > 0)::integer, t.updated_at
        from public.toonflap_progress t join students s on s.id = t.player
      union all
      select o.player, 'orderup', o.passed, o.updated_at
        from public.orderup_progress o join students s on s.id = o.player
      union all
      select p.player, 'glyph', coalesce((p.progress ->> 'passed')::integer, 0),
             (select max(g.started_at) from public.glyph_goes g where g.player = p.player)
        from public.glyph_progress p join students s on s.id = p.player
      union all
      select gs.player, 'goblinstorm', cardinality(gs.bosses),
             (select max(r.started_at) from public.goblinstorm_runs r where r.player = gs.player)
        from public.goblinstorm_saves gs join students s on s.id = gs.player
      union all
      select c.player, 'circuit', (count(*) filter (where c.finishes > 0))::integer, max(c.updated_at)
        from public.circuit_progress c join students s on s.id = c.player group by c.player
    )
    select coalesce(jsonb_agg(jsonb_build_object('student', r.student, 'game', r.game, 'value', r.value, 'at', r.at)
                              order by r.game, r.student), '[]'::jsonb)
    from rows r
  );
end;
$$;
revoke execute on function public.teacher_progress_other_games(uuid) from public, anon, authenticated;
grant execute on function public.teacher_progress_other_games(uuid) to authenticated;

-- Starts a pupil's Circuit Racer again: every road, run, kept question, their racer and Volt's tips (so the guided first go
-- comes back). Points and achievements stay, as in every game's reset.
create function public.teacher_reset_circuit(student uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  delete from public.circuit_progress where player = student;
  delete from public.circuit_runs where player = student;
  delete from public.circuit_questions where player = student;
  delete from public.circuit_racers where player = student;
  delete from public.circuit_seen where player = student;
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.circuit_mark_seen(uuid, text[]),
  public.circuit_counts(uuid),
  public.circuit_players(),
  public.teacher_reset_circuit(uuid)
from public, anon, authenticated;
grant execute on function public.circuit_mark_seen(uuid, text[]) to service_role;
grant execute on function public.teacher_reset_circuit(uuid) to authenticated;
