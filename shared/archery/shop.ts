/**
 * The Armory's rules (docs/ARCHERY-PLAN.md, section 4): what everything costs, what one purchase gives, the
 * Armory levels, how much you can carry, and what selling gives back. Pure functions, used by the server
 * function (which does every purchase) and by the screens (to show prices). Coins only ever come from maths
 * (speed.ts). Prices and levels about halved on 28 Oct 2026 (docs/ARCHERY-QUESTIONS-PLAN.md).
 *
 * - Arrows and helpers are used up in fights; you carry at most CARRY_MOST of each.
 * - Shields and bows are bought once and kept (the Starter Bow is free and always yours).
 * - The Armory level goes up as you spend (LEVEL_SPEND), and opens more of the shop. Selling never lowers it.
 * - Selling gives back half (rounded down) of what one item cost.
 * - New Season wipes coins and gear (James, 21 Oct 2026).
 */
import { ARROWS, arrowKind, isArrowId } from './arrows';
import { BOWS, HELPERS, SHIELDS, isBowId, isHelperId, isShieldId } from './gear';
import type { ArrowId, BowId, ItemId, PlayerSetup, ShieldId } from './types';

/** Coins everyone starts a season with, so the first trip to the Armory buys something (the database's default too). */
export const START_COINS = 100;
/** At most this many of each arrow or helper. */
export const CARRY_MOST = 5;
/** Coins spent in all to reach Armory levels 1, 2, 3, 4 and 5. */
export const LEVEL_SPEND: readonly number[] = [0, 100, 300, 600, 1000];
export const TOP_LEVEL = LEVEL_SPEND.length;
/** Levels for the shields and helpers (arrows carry their own in arrows.ts; bows are open to everyone). */
const SHIELD_LEVEL: Record<ShieldId, number> = { wood: 1, charm: 2, bubble: 3 };

/** A pupil's Armory: their coins, what they carry, what they own, and how much they've spent in all. */
export interface Armory {
  coins: number;
  /** Arrows and helpers: how many of each. */
  gear: Partial<Record<ItemId, number>>;
  shields: ShieldId[];
  /** Bows bought (the Starter Bow is always owned and never listed). */
  bows: BowId[];
  spent: number;
}

export const EMPTY_ARMORY: Armory = { coins: 0, gear: {}, shields: [], bows: [], spent: 0 };

export type ShopKind = 'gear' | 'shield' | 'bow';

/** One thing in the shop. */
export interface ShopItem {
  id: ItemId | ShieldId | BowId;
  kind: ShopKind;
  name: string;
  does: string;
  /** Coins for one purchase. */
  price: number;
  /** How many one purchase gives (gear only; 1 for shields and bows). */
  qty: number;
  /** Armory level needed. */
  level: number;
}

const SHOP: ShopItem[] = [
  ...ARROWS.filter((a) => a.forSale).map((a): ShopItem => ({ id: a.id, kind: 'gear', name: a.name, does: a.does, price: a.price, qty: a.perPurchase ?? 1, level: Math.max(1, a.level) })),
  ...HELPERS.map((h): ShopItem => ({ id: h.id, kind: 'gear', name: h.name, does: h.does, price: h.price, qty: 1, level: h.level })),
  ...SHIELDS.map((s): ShopItem => ({ id: s.id, kind: 'shield', name: s.name, does: s.does, price: s.price, qty: 1, level: SHIELD_LEVEL[s.id] })),
  ...BOWS.filter((b) => b.price > 0).map((b): ShopItem => ({ id: b.id, kind: 'bow', name: b.name, does: b.does, price: b.price, qty: 1, level: 1 })),
];
const SHOP_BY = new Map(SHOP.map((s) => [`${s.kind}:${s.id}`, s]));

/** Everything the Armory sells, in shop order. */
export function shopItems(): readonly ShopItem[] {
  return SHOP;
}

/** One shop item, or null if there's no such thing for sale. */
export function shopItem(kind: unknown, id: unknown): ShopItem | null {
  if (kind !== 'gear' && kind !== 'shield' && kind !== 'bow') return null;
  if (typeof id !== 'string') return null;
  return SHOP_BY.get(`${kind}:${id}`) ?? null;
}

/** The Armory level for this much spent (1–5). */
export function armoryLevel(spent: number): number {
  let level = 1;
  for (let i = 1; i < LEVEL_SPEND.length; i++) if (spent >= LEVEL_SPEND[i]) level = i + 1;
  return level;
}

/** Coins still to spend to reach the next level (null at the top). */
export function toNextLevel(spent: number): number | null {
  const level = armoryLevel(spent);
  return level >= TOP_LEVEL ? null : LEVEL_SPEND[level] - spent;
}

/** What one item sells back for: half what one cost, rounded down. */
export function sellPrice(item: ShopItem): number {
  return Math.floor(item.price / item.qty / 2);
}

export type ShopProblem = 'unknown' | 'level' | 'coins' | 'full' | 'owned' | 'none';

/** Why this purchase can't happen, or null. */
export function buyProblem(a: Armory, item: ShopItem): ShopProblem | null {
  if (armoryLevel(a.spent) < item.level) return 'level';
  if (a.coins < item.price) return 'coins';
  if (item.kind === 'gear' && (a.gear[item.id as ItemId] ?? 0) + item.qty > CARRY_MOST) return 'full';
  if (item.kind === 'shield' && a.shields.includes(item.id as ShieldId)) return 'owned';
  if (item.kind === 'bow' && a.bows.includes(item.id as BowId)) return 'owned';
  return null;
}

/** Why this can't be sold (one at a time), or null. */
export function sellProblem(a: Armory, item: ShopItem): ShopProblem | null {
  if (item.kind === 'gear' && (a.gear[item.id as ItemId] ?? 0) < 1) return 'none';
  if (item.kind === 'shield' && !a.shields.includes(item.id as ShieldId)) return 'none';
  if (item.kind === 'bow' && !a.bows.includes(item.id as BowId)) return 'none';
  return null;
}

/** The Armory after a purchase (check `buyProblem` first). */
export function applyBuy(a: Armory, item: ShopItem): Armory {
  const next: Armory = { ...a, gear: { ...a.gear }, shields: [...a.shields], bows: [...a.bows], coins: a.coins - item.price, spent: a.spent + item.price };
  if (item.kind === 'gear') next.gear[item.id as ItemId] = (a.gear[item.id as ItemId] ?? 0) + item.qty;
  else if (item.kind === 'shield') next.shields.push(item.id as ShieldId);
  else next.bows.push(item.id as BowId);
  return next;
}

/** The Armory after selling one (check `sellProblem` first). */
export function applySell(a: Armory, item: ShopItem): Armory {
  const next: Armory = { ...a, gear: { ...a.gear }, shields: a.shields.filter((s) => s !== item.id), bows: a.bows.filter((b) => b !== item.id), coins: a.coins + sellPrice(item) };
  if (item.kind === 'gear') next.gear[item.id as ItemId] = (a.gear[item.id as ItemId] ?? 0) - 1;
  if (!next.gear[item.id as ItemId]) delete next.gear[item.id as ItemId];
  return next;
}

/** Is this an item a pupil can pack (an arrow that isn't the Plain Arrow, or a helper)? */
export function isPackable(id: unknown): id is ItemId {
  if (isHelperId(id)) return true;
  return isArrowId(id) && !arrowKind(id as ArrowId).unlimited;
}

/**
 * Reads a packed quiver from a request: arrows and helpers the pupil owns enough of, the shield and bow they own.
 * Returns the cleaned-up setup, or why it can't be packed.
 */
export function readPack(raw: unknown, a: Armory): { pack: PlayerSetup } | { problem: string } {
  if (!raw || typeof raw !== 'object') return { problem: 'not a quiver' };
  const r = raw as { quiver?: unknown; shield?: unknown; bow?: unknown };
  const quiver: PlayerSetup['quiver'] = {};
  if (r.quiver !== undefined) {
    if (!r.quiver || typeof r.quiver !== 'object' || Array.isArray(r.quiver)) return { problem: 'not a quiver' };
    for (const [id, n] of Object.entries(r.quiver as Record<string, unknown>)) {
      if (!isPackable(id)) return { problem: `can't pack ${id}` };
      if (!Number.isInteger(n) || (n as number) < 0 || (n as number) > CARRY_MOST) return { problem: 'a count is wrong' };
      if ((n as number) > (a.gear[id] ?? 0)) return { problem: `not enough ${id}` };
      if ((n as number) > 0) quiver[id] = n as number;
    }
  }
  let shield: ShieldId | null = null;
  if (r.shield !== undefined && r.shield !== null) {
    if (!isShieldId(r.shield) || !a.shields.includes(r.shield)) return { problem: 'not your shield' };
    shield = r.shield;
  }
  let bow: BowId = 'starter';
  if (r.bow !== undefined && r.bow !== null && r.bow !== 'starter') {
    if (!isBowId(r.bow) || !a.bows.includes(r.bow)) return { problem: 'not your bow' };
    bow = r.bow;
  }
  return { pack: { quiver, shield, bow } };
}

/** What comes back after a fight: everything packed that wasn't used. */
export function unused(pack: PlayerSetup, used: Partial<Record<ItemId, number>>): Partial<Record<ItemId, number>> {
  const back: Partial<Record<ItemId, number>> = {};
  for (const [id, n] of Object.entries(pack.quiver) as [ItemId, number][]) {
    const left = n - (used[id] ?? 0);
    if (left > 0) back[id] = left;
  }
  return back;
}

/** Reads an Armory as the database keeps it (anything odd is left out). */
export function parseArmory(raw: unknown): Armory {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const gear: Armory['gear'] = {};
  if (r.gear && typeof r.gear === 'object') {
    for (const [id, n] of Object.entries(r.gear as Record<string, unknown>)) if (isPackable(id) && Number.isInteger(n) && (n as number) > 0) gear[id] = n as number;
  }
  const list = <T extends string>(v: unknown, ok: (x: unknown) => x is T): T[] => (Array.isArray(v) ? v.filter(ok) : []);
  const num = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : 0);
  return { coins: num(r.coins), gear, shields: list(r.shields, isShieldId), bows: list(r.bows, isBowId), spent: num(r.spent) };
}

/**
 * Something to save up for, shown on Home: the cheapest bow not owned yet, then the cheapest shield, with the coins
 * still needed (0 if it can be bought now). Null when there's nothing left to aim for.
 */
export function nextGoal(a: Armory): { item: ShopItem; need: number } | null {
  const level = armoryLevel(a.spent);
  const wanted = (kind: ShopKind) => SHOP
    .filter((i) => i.kind === kind && i.level <= level && !(kind === 'bow' ? a.bows.includes(i.id as BowId) : a.shields.includes(i.id as ShieldId)))
    .sort((x, y) => x.price - y.price)[0];
  const item = wanted('bow') ?? wanted('shield');
  return item ? { item, need: Math.max(0, item.price - a.coins) } : null;
}
