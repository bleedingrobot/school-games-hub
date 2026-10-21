/**
 * The Armory's arrows (docs/ARCHERY-PLAN.md, section 4), as a table. Each arrow is one small entry; what
 * the special ones do when they fly and land is in `effects.ts` (one function each).
 *
 * James (21 Oct 2026): special arrows are scarce, mostly sold one at a time. The Glass Arrow is the pupil's own.
 * Blast sizes and damage were tuned with the balance simulator (scripts/archery-sim.mjs, Stage 3).
 */
import type { ArrowId } from './types';

export interface ArrowKind {
  id: ArrowId;
  name: string;
  /** What it does, in a few words, for the Armory. */
  does: string;
  /** Blast radius in px (for Mud Ball, the dirt ball's radius; for Sticky Goo, the splash). */
  blastRadius: number;
  /** Damage at the very centre of the blast, before the direct-hit bonus. */
  peakDamage: number;
  /** Coins for one purchase. */
  price: number;
  /** How many arrows one purchase gives (null for the Plain Arrow, which is free and never runs out). */
  perPurchase: number | null;
  /** Armory level that unlocks it (0 = from the start). */
  level: number;
  /** In the Armory? Bots also only ever use arrows that are for sale (or unlimited). */
  forSale: boolean;
  /** Never runs out (the Plain Arrow). */
  unlimited: boolean;
}

type Entry = Omit<ArrowKind, 'forSale' | 'unlimited'> & Partial<Pick<ArrowKind, 'forSale' | 'unlimited'>>;

const ENTRIES: Entry[] = [
  { id: 'plain', name: 'Plain Arrow', does: 'A small blast. You never run out.', blastRadius: 24, peakDamage: 25, price: 0, perPurchase: null, level: 0, forSale: false, unlimited: true },
  { id: 'steel', name: 'Steel Arrow', does: 'A bigger blast.', blastRadius: 34, peakDamage: 40, price: 50, perPurchase: 2, level: 1 },
  { id: 'log', name: 'Rolling Log', does: 'Lands, rolls downhill, bursts in a dip or at an archer.', blastRadius: 28, peakDamage: 35, price: 60, perPurchase: 1, level: 1 },
  { id: 'mole', name: 'Mole Arrow', does: 'Digs a deep hole straight down. Knock the ground out from under someone.', blastRadius: 12, peakDamage: 10, price: 40, perPurchase: 1, level: 1 },
  { id: 'mud', name: 'Mud Ball', does: 'Drops a big ball of dirt: bury someone, or build a wall.', blastRadius: 36, peakDamage: 0, price: 50, perPurchase: 1, level: 1 },
  { id: 'rain', name: 'Arrow Rain', does: 'Splits at the top of its flight into 5 small arrows.', blastRadius: 16, peakDamage: 15, price: 150, perPurchase: 1, level: 2 },
  { id: 'skip', name: 'Skipping Arrow', does: 'Hops forward twice, with 3 growing blasts.', blastRadius: 26, peakDamage: 24, price: 120, perPurchase: 1, level: 2 },
  { id: 'goo', name: 'Sticky Goo Arrow', does: 'A goo puddle runs into the dip and hurts anyone standing in it.', blastRadius: 30, peakDamage: 12, price: 120, perPurchase: 1, level: 3 },
  { id: 'shaker', name: 'Earth Shaker', does: 'Shakes the ground: cliffs crumble and anyone on a ledge tumbles down.', blastRadius: 14, peakDamage: 10, price: 100, perPurchase: 1, level: 3 },
  { id: 'owl', name: 'Owl Arrow', does: 'Steers itself toward an archer it passes close to.', blastRadius: 24, peakDamage: 30, price: 250, perPurchase: 1, level: 3 },
  { id: 'firework', name: 'Firework Arrow', does: '5 sparkly pops around where it lands.', blastRadius: 18, peakDamage: 16, price: 180, perPurchase: 1, level: 4 },
  { id: 'sneaky', name: 'Sneaky Mole', does: 'Tunnels toward the other archer and pops up under them.', blastRadius: 22, peakDamage: 35, price: 220, perPurchase: 1, level: 4 },
  { id: 'bolt', name: 'Crossbow Bolt', does: 'Flies dead straight through dirt. Power sets how far it goes.', blastRadius: 14, peakDamage: 35, price: 150, perPurchase: 1, level: 4 },
  { id: 'giant', name: 'Giant Arrow', does: 'A huge blast with a shockwave of leaves and confetti.', blastRadius: 75, peakDamage: 55, price: 400, perPurchase: 1, level: 5 },
  // The pupil's own arrow (James, 21 Oct 2026, from the pupil's drawing): "When it stabs them, shards keep
  // hurting, like a poison effect. It should be the most powerful arrow in the game. It kills them next turn
  // if they don't do anything in 1 turn." A stab or a near miss leaves shards; see effects.ts and fight.ts.
  { id: 'glass', name: 'Glass Arrow', does: 'Its glass shards stick in them. They must hit you back next turn, or they pop.', blastRadius: 26, peakDamage: 30, price: 500, perPurchase: 1, level: 5 },
];

export const ARROWS: readonly ArrowKind[] = ENTRIES.map((e) => ({ forSale: true, unlimited: false, ...e }));

const BY_ID = new Map(ARROWS.map((a) => [a.id, a]));

export function arrowKind(id: ArrowId): ArrowKind {
  const a = BY_ID.get(id);
  if (!a) throw new Error(`no arrow called ${id}`);
  return a;
}

export function isArrowId(id: unknown): id is ArrowId {
  return typeof id === 'string' && BY_ID.has(id as ArrowId);
}

/** Can this arrow be used in a fight at all? Only unlimited ones and ones the Armory sells. */
export function usable(a: ArrowKind): boolean {
  return a.unlimited || a.forSale;
}

/** What the Armory sells. */
export function armoryArrows(): ArrowKind[] {
  return ARROWS.filter((a) => a.forSale);
}

/**
 * The arrows a bot may choose from: never one that isn't for sale, and never the pupil's Glass Arrow (its
 * "hit back or pop" curse is for pupils to use on each other and on bots, not for a bot to use on a pupil).
 */
export function botArrows(): ArrowKind[] {
  return ARROWS.filter((a) => usable(a) && a.id !== 'glass');
}
