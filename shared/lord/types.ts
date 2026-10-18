import type { ExtraTopicId, TopicId } from '../maths/skillPacks';

/** A random-number source returning [0, 1). Real games pass a seeded one so a fight can be replayed. */
export type Random = () => number;

export type HeroClass = 'knight' | 'mage' | 'trickster';
export type SkillId = 'power-strike' | 'zap' | 'mend' | 'dodge' | 'pinch';

export interface Hero {
  level: number; // 1-12
  exp: number; // total ever earned this run (never spent, like LORD)
  hp: number;
  maxHp: number;
  strength: number; // base strength, before the weapon
  defence: number; // base defence, before the armour
  gold: number; // carried: lost if you lose a fight
  bank: number; // safe
  gems: number;
  kindness: number;
  weapon: number; // index into WEAPONS, 0 = bare fists... see data.ts
  armour: number; // index into ARMOURS
  heroClass: HeroClass;
  dragonKills: number; // stars, kept across runs
  // Today's allowances (the server rolls these over on the first play of a new NZ day)
  day: string; // 'YYYY-MM-DD' in New Zealand, of the last rollover
  forestLeft: number;
  arenaLeft: number;
  skillLeft: number;
  masterTried: boolean;
  /** A second master try saved up from a missed day (0 or 1): finishing a master fight uses it before the day's try is spent. */
  masterExtra?: number;
  // Counters, for achievements and the simulator
  forestWins: number;
  arenaWins: number;
  masterWins: number;
}

export interface Monster {
  id: string;
  name: string;
  level: number;
  hp: number;
  strength: number;
  gold: number;
  exp: number;
  /** One cheeky line shown when it appears. */
  intro: string;
}

export interface Master {
  level: number; // the level you reach by beating them (2-12)
  name: string;
  hp: number;
  strength: number;
  defence: number; // masters do not use it in the monster fight, kept for the arena-style maths and the page
  intro: string;
}

export interface Gear {
  name: string;
  cost: number;
  power: number;
  /** Base strength (weapons) or defence (armour) you need before the shop will sell it to you. */
  need: number;
}

export type FightAction =
  | { type: 'attack' }
  | { type: 'run' }
  | { type: 'skill'; skill: SkillId };

export interface FightState {
  monster: Monster;
  monsterHp: number;
  heroHp: number;
  /** 'master' and 'dragon' fights can't be run from. Losing a master fight costs nothing. */
  kind: 'forest' | 'master' | 'dragon';
  heroClass: HeroClass;
  heroAttack: number; // strength + weapon
  heroDefence: number; // defence + armour
  heroMaxHp: number;
  round: number;
  /** The first hit is multiplied by this (Size it up: 1.5, or 1.25 after a hint, otherwise 1). */
  firstHitBonus: number;
  /** A shield from a spell or the dragon trial: this many points are taken off the next hits. */
  shield: number;
  dodging: boolean; // trickster's dodge: the monster's next hit misses
  skillLeft: number;
  goldPinched: number;
  rng: number; // generator state, so a fight can be saved and replayed
  over: boolean;
  outcome: 'won' | 'lost' | 'fled' | null;
  log: FightEvent[];
}

export type FightEvent =
  | { type: 'hero-hit'; damage: number; crit: boolean }
  | { type: 'monster-hit'; damage: number; blocked: number }
  | { type: 'monster-missed' }
  | { type: 'ran'; success: boolean }
  | { type: 'skill'; skill: SkillId; amount: number }
  | { type: 'end'; outcome: 'won' | 'lost' | 'fled' };

export interface ForestEvent {
  id: string;
  title: string;
  text: string;
  /** What it does, applied by applyEvent. All optional. */
  gold?: number;
  exp?: number;
  heal?: 'full' | number; // 'full' or a fraction of max HP (0-1)
  gems?: number;
  kindness?: number;
  /** A maths moment the screens will turn into a question (L.2). The reward is paid when it is answered right. */
  maths?: { topic: TopicId | ExtraTopicId; reward: { gold?: number; exp?: number; gems?: number } };
}

export type TripResult =
  | { kind: 'fight'; monster: Monster; seed: number }
  | { kind: 'event'; event: ForestEvent };
