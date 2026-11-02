/**
 * Crafting bits and the Tinker (docs/MONSTERS-QUESTS-PLAN.md section 3). Bits drop from battles you
 * win, with no dice, so the server can count exactly what a save may have gained. The Tinker turns
 * bits into items and the wake-up items for the sleeping giants. EASY TO EDIT: BITS and RECIPES.
 */
import type { Bag } from '../engine';
import { speciesOf } from '../monsterBook';
import { TYPES, type TypeId } from '../types';
import type { Bits, QuestSave } from './types';

export const BIT_NAME: Record<TypeId, [string, string]> = {
  leaf: ['kawakawa leaf', 'kawakawa leaves'],
  water: ['shell', 'shells'],
  fire: ['ember', 'embers'],
  ice: ['frost crystal', 'frost crystals'],
  spark: ['glow dust', 'glow dust'],
  stone: ['pebble', 'pebbles'],
};

export const BITS = {
  /** A wild win gives 1 bit of the monster's type, and 1 more if it was grown or uncommon or rarer. */
  wild: 1,
  wildBonus: 1,
  /** A trainer win gives 1 bit for each of their monsters, of its type. */
  trainerEach: 1,
  /** The most bits of one kind you can hold. */
  max: 99,
};

/** The bits for winning a battle against these foes. */
export function bitsForWin(foes: readonly string[], trainer: boolean): Bits {
  const out: Bits = {};
  for (const id of foes) {
    const s = speciesOf(id);
    const bonus = !trainer && (s.stage > 1 || s.rarity !== 'common') ? BITS.wildBonus : 0;
    out[s.type] = (out[s.type] ?? 0) + (trainer ? BITS.trainerEach : BITS.wild + bonus);
  }
  return out;
}

export function addBits(have: Bits, more: Bits): Bits {
  const out: Bits = { ...have };
  for (const t of TYPES) if (more[t]) out[t] = Math.min(BITS.max, (out[t] ?? 0) + more[t]!);
  return out;
}

export const hasBits = (have: Bits, need: Bits) => TYPES.every((t) => (have[t] ?? 0) >= (need[t] ?? 0));

export function takeBits(have: Bits, need: Bits): Bits {
  const out: Bits = { ...have };
  for (const t of TYPES) if (need[t]) out[t] = (out[t] ?? 0) - need[t]!;
  return out;
}

/** "3 embers and 2 shells". */
export function describeBits(bits: Bits): string {
  const parts = TYPES.filter((t) => (bits[t] ?? 0) > 0).map((t) => `${bits[t]} ${BIT_NAME[t][bits[t] === 1 ? 0 : 1]}`);
  if (parts.length <= 1) return parts[0] ?? 'nothing';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export interface Recipe {
  id: string;
  name: string;
  cost: Bits;
  /** Any 3 bits (the basics, so nobody runs out): picks from the kinds you have most of. */
  anyBits?: number;
  /** Flags needed first (a quest part). */
  needs?: string[];
  /** What it makes: items in the bag, or a flag ("made:warm-whistle"), made once. */
  items?: Bag;
  flag?: string;
  /** One day fewer for one egg. */
  warmer?: true;
}

export const RECIPES: readonly Recipe[] = [
  { id: 'potion', name: 'Potion', cost: {}, anyBits: 3, items: { potion: 1 } },
  { id: 'ball', name: 'Ball', cost: {}, anyBits: 3, items: { ball: 1 } },
  { id: 'great-ball', name: 'Great ball', cost: { stone: 4, spark: 2 }, items: { 'great-ball': 1 } },
  { id: 'repel', name: 'Repel', cost: { leaf: 3 }, items: { repel: 1 } },
  { id: 'warm-whistle', name: 'Warm whistle', cost: { fire: 8, stone: 6 }, needs: ['part:miner'], flag: 'made:warm-whistle' },
  { id: 'tide-bell', name: 'Tide bell', cost: { water: 8, stone: 6 }, needs: ['part:lifeguard'], flag: 'made:tide-bell' },
  { id: 'frost-horn', name: 'Frost horn', cost: { ice: 8, spark: 6 }, needs: ['part:cave-guide'], flag: 'made:frost-horn' },
  { id: 'egg-warmer', name: 'Egg warmer', cost: { fire: 6, leaf: 4 }, warmer: true },
];

/** The bits "any 3 bits" takes: one at a time from whichever kind you have most of. */
function anyBitsCost(have: Bits, n: number): Bits | null {
  const left: Bits = { ...have };
  const cost: Bits = {};
  for (let i = 0; i < n; i++) {
    const t = [...TYPES].sort((a, b) => (left[b] ?? 0) - (left[a] ?? 0))[0];
    if (!left[t]) return null;
    left[t]! -= 1;
    cost[t] = (cost[t] ?? 0) + 1;
  }
  return cost;
}

/** What making this would cost right now, or why it can't be made. */
export function canMake(q: QuestSave, recipe: Recipe): { cost: Bits } | { why: string } {
  if (recipe.flag && q.flags.includes(recipe.flag)) return { why: 'You already made this.' };
  for (const f of recipe.needs ?? []) if (!q.flags.includes(f)) return { why: 'You need a special part from a quest first.' };
  const cost = recipe.anyBits ? anyBitsCost(q.bits, recipe.anyBits) : recipe.cost;
  if (!cost || !hasBits(q.bits, cost)) return { why: `You need ${recipe.anyBits ? `${recipe.anyBits} bits of any kind` : describeBits(recipe.cost)}.` };
  return { cost };
}
