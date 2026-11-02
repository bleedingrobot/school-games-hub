/**
 * The three sleeping giants (docs/MONSTERS-QUESTS-PLAN.md section 4). Each lies across the path to a
 * bonus area. Make its wake-up item at the Tinker, wake it, and battle it (it doesn't count towards
 * the 12 a day). Win or catch it and the way is open for good; run or lose and it dozes off again.
 */
import { makeMonster, type Monster } from '../rules';
import type { QuestSave } from './types';

export interface Giant {
  id: string;
  /** The giant's form you battle, and its level (the area it hangs off). */
  species: string;
  level: number;
  /** The map it sleeps on, and the bonus area it blocks. Q.4 places it on the map. */
  map: string;
  opens: string;
  /** The badge you need before it can be woken (the bonus area's monsters suit that level). */
  badge: string;
  /** The flag the Tinker sets when its item is made, and the item's name. */
  item: string;
  itemName: string;
  /** What it says while asleep. */
  asleep: string;
}

export const GIANTS: readonly Giant[] = [
  { id: 'snorumble', species: 'dozepebble-2', level: 24, map: 'fire-mountain', opens: 'steam-valley', badge: 'fire', item: 'made:warm-whistle', itemName: 'Warm whistle', asleep: 'A huge stony monster is fast asleep across the path. It is snoring warm air. Maybe a warm sound would wake it?' },
  { id: 'drowsea', species: 'napsea-2', level: 18, map: 'shell-beach', opens: 'lagoon-isle', badge: 'water', item: 'made:tide-bell', itemName: 'Tide bell', asleep: 'A giant sea monster is dozing in the cave mouth, rocking with the waves. A bell like the tide might stir it.' },
  { id: 'yawnberg', species: 'blinkberg-2', level: 30, map: 'snowy-peaks', opens: 'aurora-hollow', badge: 'ice', item: 'made:frost-horn', itemName: 'Frost horn', asleep: 'An enormous icy monster is sleeping in the pass. Its yawns are freezing! A horn as cold as ice might wake it.' },
];

export const giantById = (id: string) => GIANTS.find((g) => g.id === id);

export const isAwake = (q: QuestSave, g: Giant) => q.flags.includes(`woke:${g.id}`);

/** Can this giant be woken now: badge held, item made, still asleep. */
export function canWake(q: QuestSave, g: Giant, badges: readonly string[]): boolean {
  return !isAwake(q, g) && badges.includes(g.badge) && q.flags.includes(g.item);
}

/** The giant you battle once it wakes. */
export const giantFoe = (g: Giant): Monster => makeMonster(g.species, g.level);

/** After the giant battle: winning or catching opens the way. */
export function afterGiant(q: QuestSave, g: Giant, outcome: 'won' | 'caught' | 'lost' | 'ran'): QuestSave {
  if ((outcome !== 'won' && outcome !== 'caught') || isAwake(q, g)) return q;
  return { ...q, flags: [...q.flags, `woke:${g.id}`] };
}
