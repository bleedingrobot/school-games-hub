/**
 * The gold shop and the Weapon Codex, as pure rules (docs/GOBLINSTORM-PLAN.md, "Between runs" and stage 5). The
 * database's buy_goblinstorm() keeps the same prices and tops (migration 20261120000600): change them together.
 */
import { LEGENDARY, SHOP_ARMOUR_MAX, SHOP_COSTS, SHOP_IDS, SHOP_LEVELS, WEAPON_IDS, type LegendaryId, type ShopId, type ShopLevels, type WeaponId } from './config';

/** The top level of a shop item: Armour stops at 3, the rest at 5. */
export const shopTop = (id: ShopId): number => (id === 'armour' ? SHOP_ARMOUR_MAX : SHOP_LEVELS);

/** The level an item is at (0 to its top). Anything odd counts as 0. */
export function shopLevelOf(shop: ShopLevels, id: ShopId): number {
  const n = shop[id];
  return Number.isInteger(n) ? Math.max(0, Math.min(shopTop(id), n as number)) : 0;
}

/** What the next level of an item costs, or null once it's at the top. */
export function nextCost(shop: ShopLevels, id: ShopId): number | null {
  const level = shopLevelOf(shop, id);
  return level >= shopTop(id) ? null : SHOP_COSTS[level];
}

/** Every level of every item: 21,300 gold. */
export const SHOP_TOTAL = SHOP_IDS.reduce((sum, id) => sum + SHOP_COSTS.slice(0, shopTop(id)).reduce((a, b) => a + b, 0), 0);

/** Is the whole shop bought? Then gold is shown only as the best haul. */
export const allBought = (shop: ShopLevels): boolean => SHOP_IDS.every((id) => nextCost(shop, id) === null);

/** Buys the next level of an item: the new gold and shop, or why not. */
export function buy(save: { gold: number; shop: ShopLevels }, id: ShopId): { gold: number; shop: ShopLevels } | 'top' | 'gold' {
  const cost = nextCost(save.shop, id);
  if (cost === null) return 'top';
  if (save.gold < cost) return 'gold';
  return { gold: save.gold - cost, shop: { ...save.shop, [id]: shopLevelOf(save.shop, id) + 1 } };
}

/** A Legendary upgrade's level (0 to its top). Anything odd counts as 0. */
export function legendLevelOf(shop: ShopLevels, id: LegendaryId): number {
  const n = shop[id];
  return Number.isInteger(n) ? Math.max(0, Math.min(LEGENDARY[id].costs.length, n as number)) : 0;
}

/** What a Legendary upgrade's next level costs, or null at its top or before the whole shop is bought. */
export function nextLegendCost(shop: ShopLevels, id: LegendaryId): number | null {
  if (!allBought(shop)) return null;
  const level = legendLevelOf(shop, id);
  return level >= LEGENDARY[id].costs.length ? null : LEGENDARY[id].costs[level];
}

/**
 * Buys a Legendary upgrade's next level (the Legendary row opens with the whole shop bought; the Storm Gate's other half,
 * the Fire Dragon, is for the maps). The database's buy function must keep the same prices when it goes live.
 */
export function buyLegend(save: { gold: number; shop: ShopLevels }, id: LegendaryId): { gold: number; shop: ShopLevels } | 'top' | 'gold' | 'locked' {
  if (!allBought(save.shop)) return 'locked';
  const cost = nextLegendCost(save.shop, id);
  if (cost === null) return 'top';
  if (save.gold < cost) return 'gold';
  return { gold: save.gold - cost, shop: { ...save.shop, [id]: legendLevelOf(save.shop, id) + 1 } };
}

/** Every level of every Legendary upgrade. */
export const LEGENDARY_TOTAL = (Object.values(LEGENDARY) as { costs: readonly number[] }[]).reduce((sum, l) => sum + l.costs.reduce((a, b) => a + b, 0), 0);

/** The Weapon Codex: each weapon once picked up, and each evolution once made. 16 in all. */
export const CODEX_SIZE = WEAPON_IDS.length * 2;

/** How much of the Codex is filled: weapons seen plus weapons evolved (unknown ids don't count). */
export function codexCount(weapons: readonly string[], evolved: readonly string[]): number {
  const known = (list: readonly string[]) => new Set(list.filter((w) => (WEAPON_IDS as string[]).includes(w))).size;
  return known(weapons) + known(evolved);
}

export type { WeaponId };
