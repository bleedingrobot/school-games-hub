-- Goblin Storm: the Storm Lands go live (docs/GOBLINSTORM-STORM-LANDS-PLAN.md, stage 3; James, 22 Nov 2026).
--
--   1. Runs can be on maps 0 to 9 (the five Storm Lands maps are 5 to 9). Which maps a pupil may start is still the
--      server's check (shared/goblinstorm/server.ts mapOpen: the Storm Gate is the whole shop bought and the Fire Dragon,
--      map 4's boss, beaten; then each map opens by beating the boss before it).
--   2. buy_goblinstorm sells the Legendary upgrades too, once the whole shop is bought. Prices match LEGENDARY in
--      shared/goblinstorm/config.ts (change them together):
--        fifth 4,000 · secondwind 3,500 · stormmight and surge 1,500 / 2,500 / 3,500 · anchor and lantern 1,200 / 2,000
--      A new refusal reason, 'locked': a Legendary upgrade before the whole shop is bought.
--   3. Two achievements: Storm Gate (open the Storm Gate, a new measure goblinstorm_gate) and Storm Breaker (all 10
--      bosses: the goblinstorm_bosses measure, which Storm Master already uses at 5).
--   4. The Storm King's Crown trophy: beating the Storm King (map 9) the first time. Never for maths. No back-award:
--      nobody could play map 9 before this.
-- record_goblinstorm_run needs no change: it already keeps any map's boss, and the 1.5 x gold on the Storm Lands comes
-- from the replay's own summary.

-- ---------------------------------------------------------------------------
-- 1. Maps 0 to 9
-- ---------------------------------------------------------------------------

alter table public.goblinstorm_runs drop constraint goblinstorm_runs_map_check;
alter table public.goblinstorm_runs add constraint goblinstorm_runs_map_check check (map between 0 and 9);

-- ---------------------------------------------------------------------------
-- 2. The shop, with the Legendary row
-- ---------------------------------------------------------------------------

-- Is the whole normal shop bought? (Armour stops at 3, the rest at 5.)
create function public.goblinstorm_shop_full(shop jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce((shop ->> 'might')::integer, 0) >= 5 and coalesce((shop ->> 'armour')::integer, 0) >= 3
     and coalesce((shop ->> 'speed')::integer, 0) >= 5 and coalesce((shop ->> 'health')::integer, 0) >= 5
     and coalesce((shop ->> 'magnet')::integer, 0) >= 5 and coalesce((shop ->> 'gold')::integer, 0) >= 5
$$;
revoke execute on function public.goblinstorm_shop_full(jsonb) from public, anon, authenticated;

create or replace function public.buy_goblinstorm(item text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  legendary boolean := item in ('fifth', 'secondwind', 'stormmight', 'surge', 'anchor', 'lantern');
  costs integer[] := case item
    when 'fifth' then array[4000]
    when 'secondwind' then array[3500]
    when 'stormmight' then array[1500, 2500, 3500]
    when 'surge' then array[1500, 2500, 3500]
    when 'anchor' then array[1200, 2000]
    when 'lantern' then array[1200, 2000]
    else array[200, 400, 700, 1100, 1600] end;
  top integer := case when item = 'armour' then 3 else cardinality(costs) end;
  done jsonb;
  have public.goblinstorm_saves;
begin
  if me is null then
    raise exception 'Please sign in again.' using errcode = '42501';
  end if;
  perform public.gem_keep_check_player(me);
  if item is null or not (legendary or item in ('might', 'armour', 'speed', 'health', 'magnet', 'gold')) then
    raise exception 'Unknown Goblin Storm upgrade' using errcode = '22023';
  end if;
  update public.goblinstorm_saves s
  set gold = s.gold - costs[coalesce((s.shop ->> item)::integer, 0) + 1],
      shop = s.shop || jsonb_build_object(item, coalesce((s.shop ->> item)::integer, 0) + 1),
      updated_at = now()
  where s.player = me
    and coalesce((s.shop ->> item)::integer, 0) < top
    and s.gold >= costs[coalesce((s.shop ->> item)::integer, 0) + 1]
    and (not legendary or public.goblinstorm_shop_full(s.shop))
  returning jsonb_build_object('bought', true, 'reason', null, 'gold', s.gold, 'shop', s.shop) into done;
  if done is not null then
    return done;
  end if;
  select * into have from public.goblinstorm_saves s where s.player = me;
  if not found then
    return jsonb_build_object('bought', false, 'reason', 'none', 'gold', 0, 'shop', '{}'::jsonb);
  end if;
  return jsonb_build_object('bought', false,
    'reason', case when legendary and not public.goblinstorm_shop_full(have.shop) then 'locked'
                   when coalesce((have.shop ->> item)::integer, 0) >= top then 'top' else 'gold' end,
    'gold', have.gold, 'shop', have.shop);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Achievements
-- ---------------------------------------------------------------------------

insert into public.achievement_measures (measure) values ('goblinstorm_gate');

-- Same as 20261119000900 with goblinstorm_gate: 1 once the Storm Gate is open (the whole shop and the Fire Dragon).
create or replace function public.goblinstorm_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'goblinstorm_runs', (select count(*) from public.goblinstorm_runs r
                         where r.player = who and r.outcome in ('won', 'survived', 'lost')),
    'goblinstorm_evolutions', coalesce((select cardinality(s.codex) from public.goblinstorm_saves s where s.player = who), 0),
    'goblinstorm_bosses', coalesce((select cardinality(s.bosses) from public.goblinstorm_saves s where s.player = who), 0),
    'goblinstorm_heroes', 2 + coalesce((select cardinality(s.heroes) from public.goblinstorm_saves s where s.player = who), 0),
    'goblinstorm_gate', coalesce((select case when public.goblinstorm_shop_full(s.shop) and 4 = any (s.bosses) then 1 else 0 end
                                  from public.goblinstorm_saves s where s.player = who), 0))
$$;

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort, how, tier) values
  ('goblinstorm-gate', 'goblinstorm', 'Storm Gate', '🌀', 'goblinstorm_gate', 1, 6, 'Buy the whole Goblin Storm shop and beat the Fire Dragon to open the Storm Lands.', 3),
  ('goblinstorm-breaker', 'goblinstorm', 'Storm Breaker', '🌈', 'goblinstorm_bosses', 10, 7, 'Beat all 10 Goblin Storm bosses, the Storm King last.', 3);

-- ---------------------------------------------------------------------------
-- 4. The Storm King's Crown
-- ---------------------------------------------------------------------------

insert into public.trophy_types (id, game, name, how, kind, repeat, art, sort) values
  ('goblinstorm-stormcrown', 'goblinstorm', 'Storm King''s Crown', 'Beat the Storm King in Goblin Storm.', 'trophy', 'once', null, 352);

-- Same as 20261120000400 with the Storm King (map 9) added; the trigger on goblinstorm_saves stays as it is.
create or replace function public.goblinstorm_save_trophies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if 0 = any (new.bosses) and (tg_op = 'INSERT' or not (0 = any (old.bosses))) then
    perform public.award_trophy(new.player, 'goblinstorm-crown', '{}'::jsonb);
  end if;
  if 4 = any (new.bosses) and (tg_op = 'INSERT' or not (4 = any (old.bosses))) then
    perform public.award_trophy(new.player, 'goblinstorm-scale', '{}'::jsonb);
  end if;
  if 9 = any (new.bosses) and (tg_op = 'INSERT' or not (9 = any (old.bosses))) then
    perform public.award_trophy(new.player, 'goblinstorm-stormcrown', '{}'::jsonb);
  end if;
  return null;
exception when others then
  raise warning 'a Goblin Storm trophy failed (%)', sqlstate;
  return null;
end;
$$;
