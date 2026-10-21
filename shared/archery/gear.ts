/**
 * The Armory's shields, helpers and bows (docs/ARCHERY-PLAN.md, section 4). Shields and bows are bought
 * once and kept; helpers are used up. In a fight a shield soaks damage until it breaks (it lasts the whole
 * fight, not a round: the balance simulator found a shield refilled every round won ~70–98% of even fights). Bows change what you can reach or see, never how hard an arrow hits,
 * and none of them gives any aiming help (James, 21 Oct 2026).
 */
import type { BowId, HelperId, ShieldId } from './types';

export interface ShieldKind {
  id: ShieldId;
  name: string;
  does: string;
  /** Points it soaks (over the whole fight) before health is hurt. */
  soak: number;
  price: number;
  level: number;
}

export const SHIELDS: readonly ShieldKind[] = [
  { id: 'wood', name: 'Wooden Shield', does: 'Soaks 40 damage, then breaks.', soak: 40, price: 100, level: 1 },
  { id: 'charm', name: 'Wind Charm', does: 'Soaks 30. Until it breaks, its wind lifts arrows that come down on you.', soak: 30, price: 150, level: 2 },
  { id: 'bubble', name: 'Bubble Shield', does: 'Soaks 60, and bounces away the first arrow that reaches it.', soak: 60, price: 250, level: 3 },
];

export interface HelperKind {
  id: HelperId;
  name: string;
  does: string;
  price: number;
  level: number;
}

export const HELPERS: readonly HelperKind[] = [
  { id: 'apple', name: 'Apple', does: 'Eat it on your turn for +15 health.', price: 50, level: 1 },
  { id: 'umbrella', name: 'Umbrella', does: 'Opens by itself when you fall, so the fall doesn\'t hurt.', price: 40, level: 1 },
];

export interface BowKind {
  id: BowId;
  name: string;
  does: string;
  /** Arrow speed × this (more reach). */
  power: number;
  /** The wind's push × this (less drift). */
  wind: number;
  price: number;
}

export const BOWS: readonly BowKind[] = [
  { id: 'starter', name: 'Starter Bow', does: 'Your trusty bow.', power: 1, wind: 1, price: 0 },
  { id: 'long', name: 'Longbow', does: '10% more top power: reach the far side in a strong headwind.', power: 1.1, wind: 1, price: 300 },
  { id: 'recurve', name: 'Recurve Bow', does: 'Faster arrows that drift less in the wind.', power: 1.05, wind: 0.7, price: 400 },
  { id: 'hunter', name: "Hunter's Bow", does: 'Shows what the wind will be next round.', power: 1, wind: 1, price: 250 },
  { id: 'golden', name: 'Golden Bow', does: 'Looks amazing. 10% more top power and a little less drift.', power: 1.1, wind: 0.85, price: 600 },
];

const SHIELD_BY = new Map(SHIELDS.map((s) => [s.id, s]));
const BOW_BY = new Map(BOWS.map((b) => [b.id, b]));
const HELPER_BY = new Map(HELPERS.map((h) => [h.id, h]));

export function shieldKind(id: ShieldId): ShieldKind {
  const s = SHIELD_BY.get(id);
  if (!s) throw new Error(`no shield called ${id}`);
  return s;
}

export function bowKind(id: BowId | undefined): BowKind {
  return BOW_BY.get(id ?? 'starter') ?? BOWS[0];
}

export function isShieldId(id: unknown): id is ShieldId {
  return typeof id === 'string' && SHIELD_BY.has(id as ShieldId);
}

export function isBowId(id: unknown): id is BowId {
  return typeof id === 'string' && BOW_BY.has(id as BowId);
}

export function isHelperId(id: unknown): id is HelperId {
  return typeof id === 'string' && HELPER_BY.has(id as HelperId);
}

export function helperKind(id: HelperId): HelperKind {
  return HELPER_BY.get(id)!;
}
