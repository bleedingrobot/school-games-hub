-- Circuit Racer, Stage 4: worlds 2 to 5 and hard mode (docs/CIRCUIT-PLAN.md, section 9). Still behind the code switch.
--
-- 1. Hard mode: a finished road can be raced again with Auto-Pilot off and a count-down clock (🔥). The server function
--    replays it that way; the database keeps hard finishes apart (circuit_progress.hard_finishes and hard_best,
--    circuit_runs.hard), for the Firewall Free achievement in Stage 6. A hard finish is also a finish (best time, medal,
--    one of the day's 5). It only counts as hard on a road already finished before.
-- 2. Which roads are open: a world opens when 4 of the 6 roads of the world before are finished (James, 22 Nov 2026), so
--    record_circuit_finish now takes the roads a road needs (`needs`) and how many of them (`need`) instead of one road
--    before. The function works these out (shared/circuit/game.ts roadNeeds); shared/circuit/memoryServices.ts follows this.
-- 3. circuit_load also gives each road's hard finishes and best hard time.

alter table public.circuit_progress
  add column hard_finishes integer not null default 0 check (hard_finishes >= 0),
  add column hard_best integer check (hard_best > 0);
alter table public.circuit_runs add column hard boolean not null default false;

-- { roads: { <road>: { best, medal, clean, charged, finishes, hardFinishes, hardBest } }, today }.
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
              where p.player = circuit_load.player and p.day = today), 0));
end;
$$;

drop function public.record_circuit_finish(uuid, text, text, text, integer, text, boolean, boolean, text, boolean);

-- Saves one finish the server function has replayed itself: { status, today }. In order:
--   'duplicate'   this seed was saved already (nothing changes);
--   'locked'      fewer than `need` of the roads in `needs` have been finished (null needs: the first road);
--   'done-today'  5 finishes today already and no "Unlimited today" (unlimited is read by the function from settings_of);
--   'best' or 'saved'  kept, with the best time, medal and stars so far, and the hard finishes.
-- Hub points on the day's first 5 finishes only (shared/circuit/game.ts FINISH_POINTS, GOLD_POINTS; change together):
-- 3 a finish, 2 more the first time a road gets gold. add_game_points keeps them inside the shared daily cap and counts
-- the seed once; an error there can't lose the save. The pupil's row lock makes two tabs count one at a time.
create function public.record_circuit_finish(player uuid, road text, needs text[], need integer, seed text, steps integer, medal text,
  clean boolean, charged boolean, inputs text, unlimited boolean, hard boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Pacific/Auckland')::date;
  done integer;
  had public.circuit_progress;
  rank_new integer := case medal when 'gold' then 3 when 'silver' then 2 else 1 end;
  extra_turn boolean;
  points integer;
  is_hard boolean;
begin
  perform public.gem_keep_check_player(player);
  if road is null or seed is null or steps is null or steps <= 0 or medal is null or medal not in ('bronze', 'silver', 'gold') then
    raise exception 'That finish is not right.' using errcode = '22023';
  end if;
  -- One pupil's finishes are saved one at a time.
  perform pg_advisory_xact_lock(hashtextextended('circuit:' || player::text, 0));
  done := coalesce((select sum(p.day_finishes)::integer from public.circuit_progress p
                    where p.player = record_circuit_finish.player and p.day = today), 0);
  if exists (select 1 from public.circuit_runs r where r.player = record_circuit_finish.player and r.seed = record_circuit_finish.seed) then
    return jsonb_build_object('status', 'duplicate', 'today', done);
  end if;
  if needs is not null and coalesce(need, 0) > 0 and (
    select count(*) from public.circuit_progress p
    where p.player = record_circuit_finish.player and p.road = any (needs) and p.finishes > 0) < need then
    return jsonb_build_object('status', 'locked', 'today', done);
  end if;
  if done >= 5 and not coalesce(unlimited, false) then
    return jsonb_build_object('status', 'done-today', 'today', done);
  end if;
  extra_turn := done >= 5;

  select * into had from public.circuit_progress p where p.player = record_circuit_finish.player and p.road = record_circuit_finish.road;
  -- Hard mode is for a road already finished.
  is_hard := coalesce(hard, false) and coalesce(had.finishes, 0) > 0;

  delete from public.circuit_runs r where r.created_at < now() - interval '30 days';
  insert into public.circuit_runs (player, road, seed, steps, medal, clean, charged, inputs, extra, day, hard)
  values (player, road, seed, steps, medal, coalesce(clean, false), coalesce(charged, false), coalesce(inputs, ''), extra_turn, today, is_hard);

  insert into public.circuit_progress as p (player, road, best_steps, medal, clean, charged, finishes, day, day_finishes, hard_finishes, hard_best)
  values (player, road, steps, medal, coalesce(clean, false), coalesce(charged, false), 1, today, 1, 0, null)
  on conflict on constraint circuit_progress_pkey do update
  set best_steps = least(p.best_steps, excluded.best_steps),
      medal = case when rank_new > case p.medal when 'gold' then 3 when 'silver' then 2 else 1 end then excluded.medal else p.medal end,
      clean = p.clean or excluded.clean,
      charged = p.charged or excluded.charged,
      finishes = p.finishes + 1,
      day_finishes = case when p.day = today then p.day_finishes + 1 else 1 end,
      day = today,
      hard_finishes = p.hard_finishes + case when is_hard then 1 else 0 end,
      hard_best = case when is_hard then least(coalesce(p.hard_best, excluded.best_steps), excluded.best_steps) else p.hard_best end,
      updated_at = now();

  points := case when extra_turn then 0 else 3 + case when medal = 'gold' and coalesce(had.medal, '') <> 'gold' then 2 else 0 end end;
  begin
    if points > 0 then
      perform public.add_game_points(player, 'circuit', points, seed);
    else
      perform public.game_progress_changed(player, 'circuit');
    end if;
  exception when others then
    raise warning 'Circuit Racer points failed (%)', sqlstate;
  end;
  return jsonb_build_object('status', case when had.player is null or steps < had.best_steps then 'best' else 'saved' end, 'today', done + 1);
end;
$$;

revoke execute on function public.record_circuit_finish(uuid, text, text[], integer, text, integer, text, boolean, boolean, text, boolean, boolean)
from public, anon, authenticated;
grant execute on function public.record_circuit_finish(uuid, text, text[], integer, text, integer, text, boolean, boolean, text, boolean, boolean)
to service_role;
