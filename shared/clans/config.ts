/** Every tuning number for Clan Quest in one place, so the game can be balanced without hunting through code. */
import { TROOP_COST } from '../maths/practical';
import type { BuildingKind, Stat, TroopKind, VillageBuilding } from './types';

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
  /** Mine depth hints, as depth minus the clan's average level (simulator, 27 Oct 2026, the smarter fight plan: a mixed clan wins 99% at -1, 94% at +1, 87% at +3, 84% at +4; an all-fighters clan 15-25 points fewer). */
  depthHint: { easyUpTo: -1, justRightUpTo: 1, toughUpTo: 3 },
  /** The empire and "My Village". Every number is here. */
  empire: {
    /** Upgrades a clan may make a day, in total, across all its buildings. */
    buildsPerDay: 2,
    /** Builds not used pile up, up to this many extra (so at most buildsPerDay + this are available on one day). */
    buildsSavedMax: 4,
    /**
     * The eight buildings. `max` is the top level; going up to level n costs `base` times n gold, from the clan purse.
     * `per` is what each level does, in percent (or gold for the strongroom). The Training Hall, Smithy and Church keep their
     * old effects (trainCost, the shop and churchPerLevel/freeWakes read the level), so they have no `per`.
     */
    buildings: {
      trainingHall: { max: 5, base: 100, per: 0 },
      smithy: { max: 6, base: 100, per: 0 },
      church: { max: 3, base: 100, per: 0 },
      barracks: { max: 5, base: 100, per: 0 },
      walls: { max: 5, base: 100, per: 10 },
      tower: { max: 5, base: 100, per: 10 },
      forge: { max: 5, base: 100, per: 10 },
      strongroom: { max: 5, base: 100, per: 200 },
    } satisfies Record<VillageBuilding, { max: number; base: number; per: number }>,
    /** The width of each building's plan; its length is the level plus `planLengthExtra` (the area and fence moment). */
    planWidth: { trainingHall: 4, smithy: 3, church: 4, barracks: 3, walls: 2, tower: 2, forge: 3, strongroom: 2 } satisfies Record<VillageBuilding, number>,
    planLengthExtra: 2,
    /** Gold for one troop (the same numbers the troop-cost question uses). */
    troopCost: TROOP_COST satisfies Record<TroopKind, number>,
    /** How many of each troop one level of Barracks holds. */
    troopCap: { footman: 20, axeman: 10, knight: 5 } satisfies Record<TroopKind, number>,
    /** How much each troop counts for in a battle (a knight is worth four footmen, like its price). */
    troopMight: { footman: 1, axeman: 2, knight: 4 } satisfies Record<TroopKind, number>,
    battle: {
      /** Every battle is this many rounds and asks for this much loot (a percent); the only choice is the push. */
      rounds: 3,
      loot: 10,
      /** The most rounds `battle()` itself will play (a test or a sum may ask for more than the fixed 3). */
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
    /** What the old (pre-village) empire cost, so `upgradeSave` can give the right gold back. Nothing else reads this. */
    legacy: {
      plotSide: { min: 2, max: 6 },
      landPerSquare: 2,
      fencePerUnit: 1,
      /** Old building prices in gold, and the most of each a clan could have. */
      buildings: {
        barracks: { gold: 100, max: 12 },
        walls: { gold: 40, max: 5 },
        tower: { gold: 60, max: 5 },
        steelMill: { gold: 120, max: 3 },
        stables: { gold: 100, max: 3 },
        gymnasium: { gold: 100, max: 2 },
        developersHall: { gold: 150, max: 3 },
      } satisfies Record<BuildingKind, { gold: number; max: number }>,
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
   * The OLD class village (stage C.6 part A; no longer used by the game, kept so the SQL parity test and the old night job still have these numbers). The class built these with the village chest; building to level n costs
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
  /**
   * Fame and points (stage C.6 part B). Fame is earned, never lost, and never comes from maths scores. Points sit inside the hub's
   * 40-a-day cap; raids earn fame but no points. `minesPerPoint`: every 3rd mine fight won is a point (a boss is worth `boss`
   * and does not count toward the 3). The village rewards go to everyone who voted in the week the class built a building.
   * The same numbers are in the SQL function clan_reward_rules (a test keeps them equal).
   */
  rewards: {
    fame: { mineWin: 1, bossWin: 5, warWin: 2, kingdomRaidWin: 2, classRaidWin: 3, villageBuilt: 10 },
    points: { minesPerPoint: 3, boss: 3, war: 2, villageBuilt: 5 },
    /** Mine fights a day a teacher may choose (the default is `fightsPerDay`). */
    fightsPerDayRange: { min: 1, max: 30 },
  },
  /**
   * The season (5 weeks, days are 1-based: day 1 to `length`). From day `warnFrom` to the end (the "last two weeks")
   * raids on classmates rest. From day `monsterFrom` it is monster week (used later). Finishing the village earns `villageReward`.
   */
  season: { length: 35, warnFrom: 22, monsterFrom: 29, villageReward: { fame: 50, points: 10 } },
  /** How much a Battle Cry answer adds. */
  battleCryDamage: 1.25,
  battleCryHeal: 0.2,
} as const;
