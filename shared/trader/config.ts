/**
 * Every tuning number for Star Trader's rules, in one place (docs/TRADER-PLAN.md, sections 14 and 15).
 *
 * Rules and numbers adapted from "Space Trader" by Pieter Spronck (2002, GPL-2). No code or text is copied.
 * The rules only use whole numbers (add, subtract, multiply, divide, floor), so every browser and the server get
 * the same answers. Nothing here uses Math.sin or other functions that can differ a little between browsers.
 * Everything is provisional until `npm run trader:sim` has tuned it.
 */

// ---------------------------------------------------------------------------------------------
// The galaxy
// ---------------------------------------------------------------------------------------------
export const GRID_SIZE = 20;
export const PLANET_COUNT = 24;
/** Planets are at least this far apart (across + up). */
export const MIN_PLANET_GAP = 3;
/** The chance a planet has a special resource (rich soil, lots of water ...), in percent. */
export const RESOURCE_CHANCE_PCT = 40;
/** Shipyards are on planets at this tech level or higher. */
export const SHIPYARD_TECH = 4;

export const GOODS = ['Water', 'Furs', 'Food', 'Ore', 'Games', 'Fireworks', 'Medicine', 'Machines', 'Lollies', 'Robots'] as const;
export type Good = (typeof GOODS)[number];
export const WATER = 0;
export const FURS = 1;
export const FOOD = 2;
export const ORE = 3;
export const GAMES = 4;
export const FIREWORKS = 5;
export const MEDICINE = 6;
export const MACHINES = 7;
export const LOLLIES = 8;
export const ROBOTS = 9;

/** The reasons a price jumps (the original's seven). */
export const EVENTS = ['none', 'war', 'plague', 'drought', 'boredom', 'cold', 'crop failure', 'lack of workers'] as const;
export type EventId = (typeof EVENTS)[number];

export const RESOURCES = ['none', 'rich in minerals', 'poor in minerals', 'desert', 'lots of water', 'rich animals', 'lifeless', 'poor soil', 'rich soil', 'artistic', 'warlike', 'weird mushrooms', 'lots of herbs'] as const;
export type ResourceId = (typeof RESOURCES)[number];

export interface GoodRule {
  /** Price (in the original's money, 10 times ours) at tech level 0. */
  lowTech: number;
  /** How much the price goes up per tech level. */
  step: number;
  /** The most a price is moved up or down at random (original money). */
  variance: number;
  /** The event that makes it dear (index into EVENTS), 0 for none. */
  event: number;
  /** The resource that makes it cheap and the one that makes it dear (index into RESOURCES), 0 for none. */
  cheapWith: number;
  dearWith: number;
  /** Tech level needed to make it (below this a planet can't sell it) and to use it (below this nobody buys it). */
  makeTech: number;
  useTech: number;
  /** How many a planet has to sell on a medium planet on an ordinary day. */
  stock: number;
}

export const GOOD_RULES: readonly GoodRule[] = [
  /* Water     */ { lowTech: 30, step: 3, variance: 4, event: 3, cheapWith: 4, dearWith: 3, makeTech: 0, useTech: 0, stock: 60 },
  /* Furs      */ { lowTech: 250, step: 10, variance: 10, event: 5, cheapWith: 5, dearWith: 6, makeTech: 0, useTech: 0, stock: 30 },
  /* Food      */ { lowTech: 100, step: 5, variance: 5, event: 6, cheapWith: 8, dearWith: 7, makeTech: 1, useTech: 0, stock: 40 },
  /* Ore       */ { lowTech: 350, step: 20, variance: 10, event: 1, cheapWith: 1, dearWith: 2, makeTech: 2, useTech: 2, stock: 25 },
  /* Games     */ { lowTech: 250, step: -10, variance: 5, event: 4, cheapWith: 9, dearWith: 0, makeTech: 3, useTech: 1, stock: 20 },
  /* Fireworks */ { lowTech: 1250, step: -75, variance: 100, event: 1, cheapWith: 10, dearWith: 0, makeTech: 3, useTech: 1, stock: 6 },
  /* Medicine  */ { lowTech: 650, step: -20, variance: 10, event: 2, cheapWith: 12, dearWith: 0, makeTech: 4, useTech: 1, stock: 8 },
  /* Machines  */ { lowTech: 900, step: -30, variance: 5, event: 7, cheapWith: 0, dearWith: 0, makeTech: 4, useTech: 3, stock: 6 },
  /* Lollies   */ { lowTech: 3500, step: -125, variance: 150, event: 4, cheapWith: 11, dearWith: 0, makeTech: 5, useTech: 0, stock: 3 },
  /* Robots    */ { lowTech: 5000, step: -150, variance: 100, event: 7, cheapWith: 0, dearWith: 0, makeTech: 6, useTech: 4, stock: 2 },
];

/** Prices in the original's money are divided by this to get our credits (never below 1 credit). */
export const PRICE_DIVISOR = 10;
/** A price rise from an event, in percent of the price (the original makes it half as much again; ours is gentler). */
export const EVENT_PRICE_PCT = 130;
/** A special resource makes a good this percent of its price (cheap) or this percent (dear); a wanted good costs this percent. (The original: 75, 133, 133.) */
export const RESOURCE_CHEAP_PCT = 85;
export const RESOURCE_DEAR_PCT = 118;
export const WANTED_PCT = 120;
/** An event cuts a planet's stock of that good to a fifth (the original's rule). */
export const EVENT_STOCK_DIVISOR = 5;
/** Percent of the price taken off per planet size (Tiny 0 ... Huge 4): big planets make more, so it's cheaper. */
export const SIZE_NAMES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge'] as const;
/** Each size's stock, in percent of the good's `stock`. */
export const SIZE_STOCK_PCT = [60, 80, 100, 130, 160] as const;
/** The buying price is the selling price plus this much, in percent (at least 1 credit). */
export const SPREAD_PCT = 9;
/** Events: how many days one lasts, the chance a planet has one in a block of days, and the day-block length. */
export const EVENT_BLOCK_DAYS = 3;
export const EVENT_CHANCE_PCT = 20;

// ---------------------------------------------------------------------------------------------
// Governments (9 of the original 17, kid-worded)
// ---------------------------------------------------------------------------------------------
export interface Government {
  name: string;
  /** How often customs, pirates and traders turn up (0 to 7). */
  customs: number;
  pirates: number;
  traders: number;
  /** The tech levels this kind of planet is found at. */
  minTech: number;
  maxTech: number;
  fireworksOk: boolean;
  lolliesOk: boolean;
  /** The good this planet wants (price up by a third), -1 for none. */
  wants: number;
}

export const GOVERNMENTS: readonly Government[] = [
  { name: 'Pirate haven', customs: 0, pirates: 7, traders: 1, minTech: 0, maxTech: 5, fireworksOk: true, lolliesOk: true, wants: FOOD },
  { name: 'Merchant guild', customs: 3, pirates: 2, traders: 7, minTech: 4, maxTech: 7, fireworksOk: true, lolliesOk: true, wants: ORE },
  { name: 'Class vote', customs: 3, pirates: 2, traders: 5, minTech: 3, maxTech: 7, fireworksOk: true, lolliesOk: true, wants: GAMES },
  { name: "Scientists' council", customs: 6, pirates: 3, traders: 6, minTech: 4, maxTech: 7, fireworksOk: true, lolliesOk: true, wants: WATER },
  { name: 'Temple', customs: 6, pirates: 1, traders: 4, minTech: 0, maxTech: 4, fireworksOk: true, lolliesOk: true, wants: LOLLIES },
  { name: 'Peace garden', customs: 2, pirates: 1, traders: 5, minTech: 0, maxTech: 3, fireworksOk: false, lolliesOk: true, wants: -1 },
  { name: 'Star navy', customs: 7, pirates: 0, traders: 6, minTech: 2, maxTech: 7, fireworksOk: true, lolliesOk: false, wants: ROBOTS },
  { name: 'Robot council', customs: 7, pirates: 7, traders: 5, minTech: 6, maxTech: 7, fireworksOk: false, lolliesOk: false, wants: ORE },
  { name: 'Farming co-op', customs: 1, pirates: 6, traders: 2, minTech: 0, maxTech: 3, fireworksOk: true, lolliesOk: true, wants: FIREWORKS },
];

/** Real names (James, 22 Oct 2026). Where they sit on our grid is made up. */
export const PLANET_NAMES = [
  'Mercury', 'Venus', 'Earth', 'Mars', 'Ceres', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Eris', 'Haumea',
  'Makemake', 'Vesta', 'Europa', 'Io', 'Ganymede', 'Callisto', 'Titan', 'Enceladus', 'Triton', 'Charon', 'Titania', 'Phobos',
] as const;

// ---------------------------------------------------------------------------------------------
// Ships and gear (6 of the original 10; prices are the original's divided by 25)
// ---------------------------------------------------------------------------------------------
export interface ShipRule {
  name: string;
  holds: number;
  weaponSlots: number;
  shieldSlots: number;
  /** The most fuel the tank holds, which is also how many squares it can jump in one go. */
  fuelTank: number;
  hull: number;
  price: number;
  /** Fuel costs this many tenths of a credit per square. */
  fuelTenths: number;
  /** Credits to mend one point of hull. */
  repairCost: number;
  /** The planet must be at least this tech level to sell it. */
  minTech: number;
  /** Chance (percent) of getting away when you try to flee. */
  fleePct: number;
}

export const SHIPS: readonly ShipRule[] = [
  { name: 'Flea', holds: 10, weaponSlots: 0, shieldSlots: 0, fuelTank: 20, hull: 25, price: 0, fuelTenths: 5, repairCost: 1, minTech: 4, fleePct: 70 },
  { name: 'Gnat', holds: 15, weaponSlots: 1, shieldSlots: 0, fuelTank: 14, hull: 100, price: 400, fuelTenths: 5, repairCost: 1, minTech: 5, fleePct: 60 },
  { name: 'Firefly', holds: 20, weaponSlots: 1, shieldSlots: 1, fuelTank: 17, hull: 100, price: 1000, fuelTenths: 5, repairCost: 1, minTech: 5, fleePct: 55 },
  { name: 'Bumblebee', holds: 25, weaponSlots: 1, shieldSlots: 2, fuelTank: 15, hull: 100, price: 2400, fuelTenths: 7, repairCost: 1, minTech: 5, fleePct: 50 },
  { name: 'Beetle', holds: 50, weaponSlots: 0, shieldSlots: 0, fuelTank: 14, hull: 50, price: 3200, fuelTenths: 10, repairCost: 1, minTech: 5, fleePct: 35 },
  { name: 'Termite', holds: 60, weaponSlots: 1, shieldSlots: 3, fuelTank: 13, hull: 200, price: 9000, fuelTenths: 15, repairCost: 2, minTech: 7, fleePct: 30 },
];

export interface GearRule {
  name: string;
  price: number;
  /** Laser power, or shield strength. */
  power: number;
  minTech: number;
}
export const WEAPONS: readonly GearRule[] = [
  { name: 'Pulse laser', price: 80, power: 15, minTech: 5 },
  { name: 'Beam laser', price: 500, power: 25, minTech: 6 },
  { name: 'Military laser', price: 1400, power: 35, minTech: 7 },
];
export const SHIELDS: readonly GearRule[] = [
  { name: 'Energy shield', price: 200, power: 100, minTech: 5 },
  { name: 'Reflective shield', price: 800, power: 200, minTech: 6 },
];
/** Extra cargo pods: each adds this many holds, up to this many pods. */
export const POD_HOLDS = 5;
export const POD_PRICE = 100;
export const MAX_PODS = 2;
export const POD_MIN_TECH = 4;
/** A ship you hand in is worth this percent of its price. */
export const TRADE_IN_PCT = 60;

// ---------------------------------------------------------------------------------------------
// Days, money and the moon
// ---------------------------------------------------------------------------------------------
export const JUMPS_PER_DAY = 10;
export const START_CREDITS = 100;
export const MOON_PRICE = 20_000;

/** Loans: up to this much, this percent of what you borrowed added once a week, this share of each sale pays it back. */
export const LOAN_MAX = 500;
export const LOAN_WEEKLY_PCT = 10;
export const LOAN_REPAY_SHARE_PCT = 30;
export const LOAN_WEEK_DAYS = 7;

/** Answering a maths check right takes this much (hundredths of a percent) off a buy or adds it to a sale. */
export const DISCOUNT_BP = 100;
export const DISCOUNT_BIG_BP = 200;
/** A trade this big (credits) always asks a question; smaller ones ask about 1 time in this many. */
export const BIG_TRADE_CREDITS = 150;
export const ASK_EVERY = 3;

// ---------------------------------------------------------------------------------------------
// Encounters
// ---------------------------------------------------------------------------------------------
/** One roll per jump. The chance (percent) is (pirates + customs + traders) times this over this divisor, up to the cap. */
export const ENCOUNTER_DIVISOR = 30;
export const ENCOUNTER_CAP_PCT = 60;
/** Chance of space junk instead (percent of jumps, tried before the others). */
export const JUNK_PCT = 5;
export const JUNK_HULL_DAMAGE = 5;

export interface PirateTier {
  name: string;
  hull: number;
  power: number;
  shield: number;
  bounty: number;
  /** The planet's pirate strength must be at least this for this kind to turn up. */
  minStrength: number;
}
export const PIRATE_TIERS: readonly PirateTier[] = [
  { name: 'Scrappy pirate', hull: 60, power: 15, shield: 0, bounty: 10, minStrength: 0 },
  { name: 'Pirate raider', hull: 100, power: 25, shield: 50, bounty: 25, minStrength: 3 },
  { name: 'Pirate captain', hull: 140, power: 35, shield: 100, bounty: 50, minStrength: 6 },
];

/** A fight lasts at most this many rounds. */
export const FIGHT_ROUNDS = 6;
/** One laser point does this much damage to a hull. */
export const LASER_DAMAGE_MULT = 3;
/** A pirate shot does its power times this percent (then 50 to 100 percent of that, at random). */
export const PIRATE_DAMAGE_PCT = 45;
/** A wrong laser answer does this percent of a full shot. */
export const WRONG_SHOT_PCT = 50;
/** Raising the shields cuts this percent off this round's damage. */
export const SHIELD_UP_CUT_PCT = 50;
/** When the pirates win, they take this percent of each kind of cargo you carry. */
export const PIRATE_LOOT_PCT = 40;
/** Customs take banned goods and charge this base fine plus this much per unit taken. */
export const CUSTOMS_FINE_PER_UNIT = 2;
export const CUSTOMS_FINE_BASE = 5;

/** A friendly trader's deal is this much better or worse than the planet's price (percent). */
export const TRADER_GOOD_PCT = 12;
export const TRADER_BAD_PCT = 8;

// ---------------------------------------------------------------------------------------------
// Sim defaults
// ---------------------------------------------------------------------------------------------
/** The chance a pupil's focus answer is right, for the simulator. */
export const SIM_MATHS_RATE = 0.7;
