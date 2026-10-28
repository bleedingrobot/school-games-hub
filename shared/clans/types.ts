/** Plain data shapes for Clan Quest. Everything here is JSON-safe so the server can save it. */
import type { Look } from './looks';

export const STATS = ['agility', 'dexterity', 'strength', 'wisdom', 'armor', 'charisma'] as const;
export type Stat = (typeof STATS)[number];
export type Stats = Record<Stat, number>;

export interface RaceDef {
  name: string;
  stats: Stats;
  hp: number;
  sp: number;
  spells: number[];
}
export type ClassDef = RaceDef;

export interface ItemDef {
  name: string;
  kind: 'weapon' | 'armor' | 'shield';
  /** Price in gold, before the village tax. */
  price: number;
  bonus: Partial<Stats>;
  /** Minimum base stats to get the bonus. */
  needs: Partial<Stats>;
  /** 6 = sold everywhere, 0 = only in a fully built Smithy. */
  shopLevel: number;
}

export interface MonsterDef {
  name: string;
  zone: string;
  /** The mine depth it first turns up at. */
  mine: number;
  boss: boolean;
  difficulty: number;
  hp: number;
  sp: number;
  stats: Stats;
  spells: number[];
}

export interface Gear {
  weapon?: string;
  armor?: string;
  shield?: string;
}

export interface Member {
  name: string;
  race: string;
  cls: string;
  level: number;
  /** Total experience earned, ever. */
  xp: number;
  hp: number;
  maxHp: number;
  sp: number;
  maxSp: number;
  /** Base stats: race + class + the roll + training. Gear is added on top in a fight. */
  stats: Stats;
  spells: number[];
  gear: Gear;
  /** Training points waiting to be spent. */
  points: number;
  /** Knocked out: out of fights until the Church wakes them (or tomorrow). */
  knockedOut: boolean;
  /** Which of the four paintings shows them (looks.ts). Missing on members saved before looks existed. */
  look?: Look;
}

export interface Village {
  trainingHall: number;
  smithy: number;
  church: number;
}

export const TROOP_KINDS = ['footman', 'axeman', 'knight'] as const;
export type TroopKind = (typeof TROOP_KINDS)[number];
export type Troops = Record<TroopKind, number>;

/** The buildings the old empire could put on a plot. Only the save conversion (`upgradeSave`) still knows about them. */
export const BUILDING_KINDS = ['barracks', 'walls', 'tower', 'steelMill', 'stables', 'gymnasium', 'developersHall'] as const;
export type BuildingKind = (typeof BUILDING_KINDS)[number];

/** A developed piece of land in an old empire save: width by length squares, with at most one building on it. */
export interface Plot {
  width: number;
  length: number;
  building?: BuildingKind;
}

/** The eight buildings of "My Village". Each has a level from 0 (not built) up to its own maximum. */
export const VILLAGE_BUILDINGS = ['trainingHall', 'smithy', 'church', 'barracks', 'walls', 'tower', 'forge', 'strongroom'] as const;
export type VillageBuilding = (typeof VILLAGE_BUILDINGS)[number];
export type Levels = Record<VillageBuilding, number>;

/**
 * The clan's empire (save version 2). Plain JSON. Days are whole numbers counted from the clan's first day (day 1).
 * All gold is the clan's one purse (`Clan.gold`): there is no vault.
 */
export interface Empire {
  /** Marks the shape of the save; an empire without it is an `OldEmpire` and goes through `upgradeSave`. */
  version: 2;
  /** The level of every building, 0 to its maximum (config.ts, CONFIG.empire.buildings). */
  levels: Levels;
  /** Upgrades made today (at most CONFIG.empire.buildsPerDay). */
  buildsToday: number;
  /** Builds from earlier days that were not used, up to CONFIG.empire.buildsSavedMax. Missing means 0. */
  buildsSaved?: number;
  troops: Troops;
  /** Today's day number. */
  day: number;
  /** The day the empire began (for new-clan protection). */
  createdDay: number;
  /** Raids on classmates and on computer kingdoms made today. */
  raidsToday: number;
  kingdomRaidsToday: number;
  /** Nobody can raid this empire on or before this day (set after a raid on it). */
  shieldUntil: number;
  /** Classmate empires this one raided today (a clan can be raided by the same empire once a day). */
  raidedToday: string[];
}

/** The empire before "My Village" (no version marker). Only `upgradeSave` reads this shape. */
export interface OldEmpire {
  version?: undefined;
  vault: number;
  wild: number;
  claimed: number;
  plots: Plot[];
  troops: Troops;
  draftPercent: number;
  day: number;
  createdDay: number;
  energyUsed: number;
  raidsToday: number;
  kingdomRaidsToday: number;
  shieldUntil: number;
  raidedToday: string[];
}

export interface Clan {
  name: string;
  members: Member[];
  gold: number;
  followers: number;
  /** A copy of the Training Hall, Smithy and Church levels, kept in step with `empire.levels` (which is the truth) for the screens. */
  village: Village;
  /** Wake-ups at the Church so far today (the first few are free). Missing means none. */
  wakesToday?: number;
  /** The day number of the last quest done (one quest a day). Missing means none yet. */
  questDay?: number;
  /** Missing until the clan opens its empire. A save without `version: 2` is converted by `upgradeSave` when it loads. */
  empire?: Empire;
  /** The season number this save belongs to. Missing means it has not been stamped yet. */
  season?: number;
}
