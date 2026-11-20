-- Goblin Storm: the gold shop costs about a third more (James, 20 Nov 2026). Only buy_goblinstorm changes; same name,
-- argument and grants as migration 20261120000100. The prices match SHOP_COSTS in shared/goblinstorm/config.ts
-- (change them together):
--   shop       200, 400, 700, 1,100, 1,600 gold for levels 1 to 5 (was 150, 300, 500, 800, 1,200); Armour stops at 3.
-- Shop levels already bought are kept.

create or replace function public.buy_goblinstorm(item text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  costs integer[] := array[200, 400, 700, 1100, 1600];
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
