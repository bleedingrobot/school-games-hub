/** Plain data shapes for Clan Quest. Everything here is JSON-safe so the server can save it. */

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
}

export interface Village {
  trainingHall: number;
  smithy: number;
  church: number;
}

export interface Clan {
  name: string;
  members: Member[];
  gold: number;
  followers: number;
  village: Village;
}
