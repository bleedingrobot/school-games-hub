/** Every tuning number for Clan Quest in one place, so the game can be balanced without hunting through code. */
import type { Stat } from './types';

export const CONFIG = {
  maxLevel: 20,
  statCap: 60,
  pointsPerLevel: 12,
  minMembers: 4,
  maxMembers: 6,
  startGold: 200,
  fightsPerDay: 8,
  maxRounds: 8,
  /** Percent added to shop prices (a fixed village tax; the class lowers it by building). */
  shopTax: 10,
  /** Percent of a price it costs to look at an item's real stats. */
  examinePercent: 25,
  /** Church: gold to wake someone is (level + 1) times this. */
  churchPerLevel: 10,
  /** The first this-many wake-ups each day cost nothing. */
  freeWakesPerDay: 1,
  /** Training points to raise a stat by 1; each Training Hall level makes it 1 cheaper (never below 1). */
  trainCost: { agility: 3, dexterity: 3, strength: 3, wisdom: 3, armor: 5, charisma: 6 } satisfies Record<Stat, number>,
  /** Points for one HP purchase and one SP purchase, and what each gives. */
  hpBuy: { cost: 2, amount: 4 },
  spBuy: { cost: 2, amount: 3 },
  /** After each fight survivors get back this share of their missing HP and SP. */
  betweenFightHeal: 0.5,
  /** Mines deeper than `xpBoostFrom` give more experience per hit: multiplied by 1 + (depth - xpBoostFrom) times `xpDepthBoost`. */
  xpBoostFrom: 8,
  xpDepthBoost: 0.25,
  /** Experience: 30 to reach level 2, then 10 more for each level, but never more than this for one level. */
  xpLevelCap: 90,
  /** Experience: total needed to reach `level` (level 1 needs none). */
  xpToReach(level: number): number {
    let total = 0;
    for (let l = 1; l < level; l++) total += Math.min(CONFIG.xpLevelCap, 30 + 10 * (l - 1));
    return total;
  },
  /** Mine depth hints, as depth minus the clan's average level (from the simulator: 100% wins up to -1, 99% to +1, about 90% to +3, under 80% from +4). */
  depthHint: { easyUpTo: -1, justRightUpTo: 1, toughUpTo: 3 },
  /** How much a Battle Cry answer adds. */
  battleCryDamage: 1.25,
  battleCryHeal: 0.2,
} as const;
