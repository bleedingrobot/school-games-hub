/** Every tuning number for Clan Quest in one place, so the game can be balanced without hunting through code. */
import { TROOP_COST } from '../maths/practical';
import type { BuildingKind, Stat, TroopKind } from './types';

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
  /** The empire (stage C.4). Every number is in the rule sheet's section 12. */
  empire: {
    /** Wild land plots a new empire starts with. */
    startWild: 10,
    /** Claiming one more plot of wild land costs `base` gold plus `step` for each one claimed before it, up to `max` claims. */
    claim: { base: 50, step: 25, max: 24 },
    /** A plot is between this many and this many squares along each side. */
    plotSide: { min: 2, max: 6 },
    /** Gold to develop a plot: this much a square of area, plus this much for each unit of fence round it. */
    landPerSquare: 2,
    fencePerUnit: 1,
    /** Worker energy a day, in percent. */
    energyPerDay: 100,
    /** Gold for one troop (the same numbers the troop-cost question uses). */
    troopCost: TROOP_COST satisfies Record<TroopKind, number>,
    /** How many of each troop one barracks holds. */
    troopCap: { footman: 20, axeman: 10, knight: 5 } satisfies Record<TroopKind, number>,
    /** How much each troop counts for in a battle (a knight is worth four footmen, like its price). */
    troopMight: { footman: 1, axeman: 2, knight: 4 } satisfies Record<TroopKind, number>,
    /** The most followers a village will send, as a percent. */
    draftMax: 20,
    draftStep: 5,
    /** Size in squares, worker energy in percent, gold, and how many you can have. `per` is the effect of each one, in percent (or points). */
    buildings: {
      barracks: { size: 15, energy: 30, gold: 100, max: 12, per: 0 },
      walls: { size: 6, energy: 7, gold: 40, max: 5, per: 10 },
      tower: { size: 5, energy: 12, gold: 60, max: 5, per: 10 },
      steelMill: { size: 12, energy: 25, gold: 120, max: 3, per: 10 },
      stables: { size: 10, energy: 20, gold: 100, max: 3, per: 20 },
      gymnasium: { size: 10, energy: 20, gold: 100, max: 2, per: 5 },
      developersHall: { size: 15, energy: 35, gold: 150, max: 3, per: 10 },
    } satisfies Record<BuildingKind, { size: number; energy: number; gold: number; max: number; per: number }>,
    battle: {
      maxRounds: 5,
      /** A side loses about this share of its strength each round. */
      roundDamage: 0.25,
      /** `hit` scales the damage you do, `takes` the damage you suffer. */
      push: { careful: { hit: 0.6, takes: 0.6 }, steady: { hit: 1, takes: 1 }, bold: { hit: 1.5, takes: 1.5 } },
      /** Each round's luck: a side does between `min`% and `min + span - 1`% of its usual damage. */
      luck: { min: 60, span: 80 },
      /** The defenders give way if they end the battle down to this share of where they began (and worse off than the attackers). */
      retreatAt: 0.5,
      /** Of the troops who were hurt, this share do not come home. */
      lossShare: 0.25,
      lootChoices: [5, 10, 15, 20],
    },
    raids: {
      newClanDays: 3,
      /** Raids on classmates a day, and on computer kingdoms a day. */
      perDay: 1,
      kingdomPerDay: 1,
      shieldDays: 1,
      /** A classmate must have between 1/this and this times your strength. */
      fairRatio: 2,
      /** Most you may take from a classmate, in percent. */
      classmateLootMax: 10,
    },
  },
  /** Quests (stage C.4 part C): one a day, small rewards next to the Mines (a fight earns about 50 gold and 4-13 followers). */
  quests: {
    perDay: 1,
    /** The best charisma in the clan has to reach `open` for a charm choice, `high` for a very charming one. */
    charm: { open: 8, high: 11 },
    /** What "small", "medium" and "big" mean in a quest. Points go to every member. */
    reward: {
      gold: { small: 15, medium: 30, big: 50 },
      followers: { small: 3, medium: 7, big: 12 },
      points: { small: 1, medium: 2, big: 3 },
    },
    /** A found item is never worth more than this in the shop; if nobody can use it, the clan gets half its price in gold. */
    itemMaxPrice: 70,
    /** A wrong puzzle answer keeps the story going; the prize is just the smaller one. */
  },
  /**
   * The class village (stage C.6 part A). The class builds these with the village chest; building to level n costs
   * `base` times n gold. Training Hall and Smithy already work in the rules; each Church level gives one more free wake-up a day.
   * The same costs are in the SQL function clan_village_cost (a test keeps them equal). `order` breaks a tie in the vote.
   */
  village: {
    trainingHall: { max: 5, base: 300 },
    smithy: { max: 6, base: 250 },
    church: { max: 3, base: 400 },
    order: ['trainingHall', 'smithy', 'church'],
    /** The most gold anyone can give the chest in one go. */
    giveMax: 100000,
  },
  /** How much a Battle Cry answer adds. */
  battleCryDamage: 1.25,
  battleCryHeal: 0.2,
} as const;
