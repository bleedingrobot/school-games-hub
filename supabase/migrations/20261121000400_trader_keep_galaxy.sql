-- Star Trader keeps its galaxy (docs/plans/trader-quests/PLAN.md, stage Q.0).
-- James, 21 Nov 2026: no more reshuffle. New Season used to give each school a new galaxy seed, so the planets moved.
-- The quests name fixed planets, so the map now stays for good: New Season does everything it did before (keeps
-- built systems, clears games, days, requests, market and news, counts the season up) but leaves the seed alone.
-- A create or replace of the newest version (20261103000300_trader_forge.sql), so its grants stay as they are.

create or replace function public.trader_season(players uuid[])
returns void
language sql
set search_path = ''
as $$
  with schools as (
    select distinct p.school_id from public.profiles p where p.id = any (players) and p.school_id is not null
  ),
  kept as (
    insert into public.trader_systems (player, school_id, season, design, carry, choice, updated_at)
    select g.player, g.school_id, g.season, g.game -> 'system',
           jsonb_build_object(
             'ship', coalesce(g.game #> '{t,ship}', '0'::jsonb),
             'credits', coalesce(g.game #> '{t,credits}', '0'::jsonb),
             'weapons', coalesce(g.game #> '{t,weapons}', '[]'::jsonb),
             'shields', coalesce(g.game #> '{t,shields}', '[]'::jsonb),
             'pods', coalesce(g.game #> '{t,pods}', '0'::jsonb)),
           'pending', now()
    from public.trader_games g
    where g.player = any (players) and g.game #>> '{system,sun,built}' = 'true'
    on conflict (player) do update
    set school_id = excluded.school_id, season = excluded.season, design = excluded.design, carry = excluded.carry,
        choice = 'pending', updated_at = now()
  ),
  a as (delete from public.trader_games where player = any (players)),
  b as (delete from public.trader_days where player = any (players)),
  c as (delete from public.trader_requests where player = any (players)),
  d as (delete from public.trader_markets where school_id in (select school_id from schools)),
  e as (delete from public.trader_news where school_id in (select school_id from schools))
  update public.trader_schools s
  set season = s.season + 1,
      started_at = now()
  where s.school_id in (select school_id from schools)
$$;
