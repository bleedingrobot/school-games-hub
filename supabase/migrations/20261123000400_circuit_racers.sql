-- Circuit Racer, Stage 5: each pupil's racer (docs/CIRCUIT-PLAN.md, section 9). Still behind the code switch.
--
-- 1. circuit_racers: one row per pupil, the racer they picked (Spark, Pixel, Byte or Quark; shared/circuit/game.ts RACERS,
--    change together). No row: Spark. The server function checks the racer's world is open before saving it.
-- 2. circuit_set_racer(player, racer): saves it (service role only).
-- 3. circuit_load also gives the racer (newest body before this: 20261123000200_circuit_worlds.sql).

create table public.circuit_racers (
  player uuid primary key references public.profiles (id) on delete cascade,
  racer text not null check (racer in ('spark', 'pixel', 'byte', 'quark')),
  updated_at timestamptz not null default now()
);
alter table public.circuit_racers enable row level security;
revoke all on public.circuit_racers from anon, authenticated;

-- { roads: { <road>: { best, medal, clean, charged, finishes, hardFinishes, hardBest } }, today, racer }.
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
              where p.player = circuit_load.player and p.day = today), 0))
    -- No racer saved: no key (the function reads that as Spark).
    || coalesce((select jsonb_build_object('racer', r.racer) from public.circuit_racers r where r.player = circuit_load.player), '{}'::jsonb);
end;
$$;

-- Saves the pupil's racer: true when saved. The function has already checked the racer is unlocked.
create function public.circuit_set_racer(player uuid, racer text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if racer is null or racer not in ('spark', 'pixel', 'byte', 'quark') then
    raise exception 'That racer is not right.' using errcode = '22023';
  end if;
  insert into public.circuit_racers as c (player, racer) values (circuit_set_racer.player, circuit_set_racer.racer)
  on conflict (player) do update set racer = excluded.racer, updated_at = now();
  return true;
end;
$$;

revoke execute on function public.circuit_set_racer(uuid, text) from public, anon, authenticated;
grant execute on function public.circuit_set_racer(uuid, text) to service_role;
