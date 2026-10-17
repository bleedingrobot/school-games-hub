/**
 * What trainers and chests give you. EASY TO EDIT: a bundle is a name and the items in it. A
 * map's chest or trainer says which bundle it gives (`loot`), the loader checks the name, and the
 * game hands it over once (the first time you open the chest or beat the trainer).
 * There is no money in the game, so this is how the bag fills up. Keep the numbers small.
 */
import type { Bag, ItemId } from '../engine';

export const LOOT: Readonly<Record<string, Bag>> = {
  // Ordinary trainers
  'trainer-small': { potion: 1, ball: 2 },
  'trainer-big': { potion: 2, ball: 3 },
  // Chests in the long grass
  potions: { potion: 3 },
  balls: { ball: 4 },
  mixed: { potion: 2, ball: 3 },
  super: { 'super-potion': 1, potion: 1 },
  great: { 'great-ball': 2 },
  repel: { repel: 2 },
  // A Tower trainer's prize, with the badge
  tower: { 'super-potion': 1, 'great-ball': 2 },
};

/** How many steps a Repel lasts (steps in long grass, not steps anywhere). */
export const REPEL_STEPS = 50;

export const ITEM_ORDER: readonly ItemId[] = ['potion', 'super-potion', 'ball', 'great-ball', 'repel'];

const NAMES: Record<ItemId, [string, string]> = {
  potion: ['potion', 'potions'],
  'super-potion': ['super potion', 'super potions'],
  ball: ['ball', 'balls'],
  'great-ball': ['great ball', 'great balls'],
  repel: ['Repel', 'Repels'],
};

/** "2 potions and 3 balls". */
export function describeLoot(bag: Bag): string {
  const parts = ITEM_ORDER.filter((i) => (bag[i] ?? 0) > 0).map((i) => `${bag[i]} ${NAMES[i][bag[i] === 1 ? 0 : 1]}`);
  if (parts.length <= 1) return parts[0] ?? 'nothing';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export function addToBag(bag: Bag, loot: Bag): Bag {
  const out: Bag = { ...bag };
  for (const i of ITEM_ORDER) if (loot[i]) out[i] = (out[i] ?? 0) + loot[i]!;
  return out;
}
