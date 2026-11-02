/**
 * The Claw Workshop's rules (docs/DIAMOND-PLAN.md, section 3.5): buying, wearing one upgrade per slot, and the special
 * of the week. Upgrades are looks only, so nothing here is part of a level's replay.
 */
import { RARITY_PRICE, SPECIAL_SHARE, WEEK_ZERO, type Slot, type WorkshopItem } from './config';
import { nzDate, type Player } from './progress';
import { WORKSHOP_ITEMS } from './workshopItems';

export const itemOf = (id: string): WorkshopItem | undefined => WORKSHOP_ITEMS.find((it) => it.id === id);

/** Upgrades that can be bought (not the earned ones). */
export const BUYABLE: readonly WorkshopItem[] = WORKSHOP_ITEMS.filter((it) => !it.earnedBy);

const dayNumber = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

/** The week number of a New Zealand date: weeks start on Monday and count from WEEK_ZERO. */
export const weekNumber = (date: string): number => Math.floor((dayNumber(date) - dayNumber(WEEK_ZERO)) / 7);

/** This week's special, chosen from the week number so the server and every browser agree. Never the same two weeks running. */
export function weeklySpecial(week: number): WorkshopItem {
  const n = BUYABLE.length;
  // Step through the list by a number with no common factor with its length, so every upgrade comes round in turn.
  let stride = 17;
  while (gcd(stride, n) !== 1) stride++;
  return BUYABLE[(((week * stride) % n) + n) % n];
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** What an upgrade costs this week (the special is cheaper, rounded to 5). */
export function priceOf(item: WorkshopItem, week: number): number {
  const full = RARITY_PRICE[item.rarity];
  return weeklySpecial(week).id === item.id ? Math.round((full * SPECIAL_SHARE) / 5) * 5 : full;
}

export type BuyCheck = { ok: true; price: number } | { ok: false; reason: 'unknown' | 'earned' | 'owned' | 'coins'; price?: number };

/** Can this pupil buy this upgrade now? */
export function canBuy(p: Player, id: string, now: Date): BuyCheck {
  const item = itemOf(id);
  if (!item) return { ok: false, reason: 'unknown' };
  if (item.earnedBy) return { ok: false, reason: 'earned' };
  if (p.owned.includes(id)) return { ok: false, reason: 'owned' };
  const price = priceOf(item, weekNumber(nzDate(now)));
  if (p.coins < price) return { ok: false, reason: 'coins', price };
  return { ok: true, price };
}

/** Buy an upgrade (and wear it straight away), or null if it can't be bought. */
export function buy(p: Player, id: string, now: Date): Player | null {
  const check = canBuy(p, id, now);
  if (!check.ok) return null;
  const item = itemOf(id)!;
  return { ...p, coins: p.coins - check.price, owned: [...p.owned, id], worn: { ...p.worn, [item.slot]: id } };
}

/** Wear an owned upgrade in its slot, or take a slot back to plain (id null). Null if it isn't theirs. */
export function wear(p: Player, slot: Slot, id: string | null): Player | null {
  if (id === null) {
    const worn = { ...p.worn };
    delete worn[slot];
    return { ...p, worn };
  }
  const item = itemOf(id);
  if (!item || item.slot !== slot || !p.owned.includes(id)) return null;
  return { ...p, worn: { ...p.worn, [slot]: id } };
}
