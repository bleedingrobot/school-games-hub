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

export const BUILDING_KINDS = ['barracks', 'walls', 'tower', 'steelMill', 'stables', 'gymnasium', 'developersHall'] as const;
export type BuildingKind = (typeof BUILDING_KINDS)[number];

/** A developed piece of land: width by length squares, with at most one building on it. */
export interface Plot {
  width: number;
  length: number;
  building?: BuildingKind;
}

/** The clan's empire. Plain JSON. Days are whole numbers counted from the clan's first day (day 1). */
export interface Empire {
  /** The empire's own gold: it pays for land, buildings and troops, and it is what raiders can take. The clan's purse is safe. */
  vault: number;
  /** Wild land not yet developed, in plots. */
  wild: number;
  /** Extra plots of wild land claimed with gold so far. */
  claimed: number;
  plots: Plot[];
  troops: Troops;
  /** Share of new followers who join as footmen, 0 to 20. */
  draftPercent: number;
  /** Today's day number. */
  day: number;
  /** The day the empire began (for new-clan protection). */
  createdDay: number;
  /** Worker energy used today, in percent. */
  energyUsed: number;
  /** Raids on classmates and on computer kingdoms made today. */
  raidsToday: number;
  kingdomRaidsToday: number;
  /** Nobody can raid this empire on or before this day (set after a raid on it). */
  shieldUntil: number;
  /** Classmate empires this one raided today (a clan can be raided by the same empire once a day). */
  raidedToday: string[];
}

export interface Clan {
  name: string;
  members: Member[];
  gold: number;
  followers: number;
  village: Village;
  /** Wake-ups at the Church so far today (the first few are free). Missing means none. */
  wakesToday?: number;
  /** The day number of the last quest done (one quest a day). Missing means none yet. */
  questDay?: number;
  /** Missing until the clan opens its empire. */
  empire?: Empire;
}
