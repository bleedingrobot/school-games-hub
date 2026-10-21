/**
 * The shapes Archery Challenge's rules work with (docs/ARCHERY-PLAN.md, section 2).
 * Plain data only, so a fight can be saved, sent and replayed.
 */

/** Every arrow in the Armory (the table is in `arrows.ts`). `glass` is the pupil's own arrow. */
export type ArrowId =
  | 'plain'
  | 'steel'
  | 'log'
  | 'mole'
  | 'mud'
  | 'rain'
  | 'skip'
  | 'goo'
  | 'shaker'
  | 'owl'
  | 'firework'
  | 'sneaky'
  | 'bolt'
  | 'giant'
  | 'glass';

/** The Armory's helpers: used up when they work (an Apple when you eat it, an Umbrella when it saves a fall). */
export type HelperId = 'apple' | 'umbrella';
/** Anything a player packs in their quiver and uses up: arrows and helpers. */
export type ItemId = ArrowId | HelperId;
/** The shields (bought once and kept; in a fight each soaks damage until it breaks). */
export type ShieldId = 'wood' | 'charm' | 'bubble';
/** The bows (bought once and kept). */
export type BowId = 'starter' | 'long' | 'recurve' | 'hunter' | 'golden';

/** The four worlds (docs/ARCHERY-PLAN.md, section 3). Each plays differently from the start. */
export type WorldId = 'forest' | 'desert' | 'snow' | 'city';
export const WORLD_IDS: readonly WorldId[] = ['forest', 'desert', 'snow', 'city'];

/** What a land cell holds. */
export const AIR = 0;
/** Earth and rock (in the Desert it's sand, which slides). Loose dirt falls. */
export const DIRT = 1;
/** Forest trees: they stop arrows until a blast clears them, and they fall like dirt. */
export const TREE = 2;
/** Snow's ice blocks: an arrow bounces off once. They stay put and hold dirt up. */
export const ICE = 3;
/** City buildings: tough, so a blast only chips them. They stay put and hold dirt up. */
export const BUILDING = 4;
export type CellKind = typeof AIR | typeof DIRT | typeof TREE | typeof ICE | typeof BUILDING;

/** The land: COLS × ROWS cells, row by row from the top (`cells[row * COLS + col]`). */
export interface Land {
  cells: Uint8Array;
}

/** One archer in a round. (x, y) is the middle of their feet, in field pixels; y grows downwards. */
export interface Archer {
  x: number;
  y: number;
  health: number;
  shield: number;
  /** At 0 health an archer pops and sits out the rest of the round. */
  popped: boolean;
  /** Which shield they brought (its points are `shield`), if any. */
  guard?: ShieldId | null;
  /** The Bubble Shield can still bounce an arrow away this round. */
  bubble?: boolean;
  /** Which bow they brought (the Starter Bow if left out). */
  bow?: BowId;
  /** Glass shards stuck in them: the archer who shot the Glass Arrow, or left out / −1 for none. */
  shardsBy?: number;
  /** Umbrellas left in this fight (one is used up automatically to stop a fall hurting). */
  umbrellas?: number;
}

/** One shot: a whole-degree angle (0 right, 90 up, 180 left), a whole-number power 0–100 and an arrow. */
export interface Shot {
  angle: number;
  power: number;
  arrow: ArrowId;
  /** Eat an Apple first (+APPLE_HEALTH), if they packed one. */
  apple?: boolean;
  /**
   * The turn timer ran out (classmate fights only): nothing is shot and nothing is used up, but the turn still ends,
   * so Sticky Goo stings and Glass shards pop (there was no hit back). Angle, power and arrow are ignored.
   */
  pass?: true;
}

/** What a flying arrow ran into. 'split' is Arrow Rain splitting at the top; 'spent' a Crossbow Bolt at the end of its range. */
export type HitKind = 'archer' | 'land' | 'floor' | 'gone' | 'timeout' | 'split' | 'spent';

export interface ShotHit {
  kind: HitKind;
  /** Where it stopped, in field pixels. */
  x: number;
  y: number;
  /** Which archer it hit, for kind 'archer'. */
  archer: number | null;
  /** How many time steps it flew. */
  steps: number;
}

/** A flight: what it hit, where it bounced off ice (or null), and points along the way (x, y, x, y …) for drawing only. */
export interface Flight {
  hit: ShotHit;
  bounce: [number, number] | null;
  path: number[];
}

/**
 * What happened during a shot, in order, for drawing it (only kept with `keepPath`). `t` is the time from
 * the shot leaving the bow, in rule steps (STEPS_PER_SECOND a second). Paths are x, y pairs one every
 * PATH_EVERY steps (60 a second), like a flight's path.
 */
export type ShotEvent =
  | { k: 'fly'; t: number; path: number[]; part: 'main' | 'child' | 'hop' }
  | { k: 'roll'; t: number; path: number[] }
  /** Digging: a tunnel of radius r along the path, one point every `every` steps (PATH_EVERY if left out). `quiet`: a Crossbow Bolt cutting through (no digger to draw). */
  | { k: 'dig'; t: number; path: number[]; r: number; every?: number; quiet?: boolean }
  | { k: 'blast'; t: number; x: number; y: number; r: number; carve: boolean }
  | { k: 'dirt'; t: number; x: number; y: number; r: number }
  | { k: 'goo'; t: number; puddle: Puddle }
  | { k: 'shake'; t: number; x: number; y: number; reach: number }
  | { k: 'bounce'; t: number; x: number; y: number; what: 'ice' | 'bubble' }
  | { k: 'shards'; t: number; archer: number };

/** A Sticky Goo puddle: columns c0 to c1, filled up to row `level`, hurting anyone standing in it for `shots` more shots. */
export interface Puddle {
  c0: number;
  c1: number;
  level: number;
  shots: number;
}

/** One played shot, as `playFight` reports it. */
export interface ShotRecord {
  round: number;
  player: number;
  shot: Shot;
  wind: number;
  hit: ShotHit;
  /** Health plus shield each archer lost to this shot (falling included). */
  damage: [number, number];
  /** Where the arrow bounced off an ice block (Snow), or null. */
  bounce: [number, number] | null;
  /** How many cells each archer fell after the blast (sliding drops included). */
  fell: [number, number];
  /** How many cells each archer slid sideways down a slippery slope (Snow). */
  slid: [number, number];
  /** Each archer after the shot. */
  after: [Archer, Archer];
  /** Health the shooter got from an Apple before shooting (0 if none). */
  apple: number;
  /** Which archers used up an Umbrella this shot (to stop a fall hurting). */
  umbrella: [boolean, boolean];
  /** Damage each archer took from Sticky Goo at the end of the shot (included in `damage`). */
  goo: [number, number];
  /**
   * The Glass Arrow's shards in the shooter (from an earlier shot), settled at the end of this turn: 'broke'
   * (they hit back, or the Glass shooter had popped), 'popped' (they didn't hit back), or null.
   */
  glass: 'broke' | 'popped' | null;
  /** Glass shard sting the shooter took this turn (included in `damage`). */
  sting: number;
  /** Only when asked for (`keepPaths`), for drawing: the main flight's path, and everything that happened. */
  path?: number[];
  events?: ShotEvent[];
}

/** One round: its own land and wind, in the fight's world. */
export interface Round {
  world: WorldId;
  index: number;
  landSeed: number;
  wind: number;
  land: Land;
  archers: [Archer, Archer];
  /** Whose turn it is (0 is the left archer). */
  turn: number;
  shots: number;
  /** 0 or 1 for a winner, 'draw' if both popped or it ran out of shots level, null while playing. */
  winner: 0 | 1 | 'draw' | null;
  /** Sticky Goo puddles on the land now. The list is replaced, never changed, so copies of a round stay apart. */
  goo: readonly Puddle[];
}

/** What each player brings to a fight: how many of each arrow and helper (Plain is always unlimited), a shield and a bow. */
export interface PlayerSetup {
  quiver: Partial<Record<ItemId, number>>;
  /** The shield they brought (it lasts the whole fight, then breaks), or null. */
  shield: ShieldId | null;
  /** The bow they brought (the Starter Bow if left out). */
  bow?: BowId;
}

export interface FightSetup {
  /** Where the fight happens. Each world has its own twist (trees, sliding sand, slippery snow and ice, buildings). */
  world: WorldId;
  players: [PlayerSetup, PlayerSetup];
  /** One round only (classmate fights, James 22 Oct 2026): win the round, win the fight. Otherwise best of 3. */
  oneRound?: boolean;
}

export interface RoundResult {
  index: number;
  landSeed: number;
  wind: number;
  winner: 0 | 1 | 'draw' | null;
  shots: number;
}

/** The whole result of a fight, from `playFight`. */
export interface FightResult {
  /** 'playing' when the shots ran out before the fight ended; 'invalid' when a shot broke the rules. */
  status: 'playing' | 'done' | 'invalid';
  /** Why a shot was refused (status 'invalid'). */
  invalid: string | null;
  /** The fight's winner, or 'draw', or null while playing. */
  winner: 0 | 1 | 'draw' | null;
  roundWins: [number, number];
  rounds: RoundResult[];
  shots: ShotRecord[];
  /** How many of each special arrow and helper each player actually used. The server returns the rest. */
  used: [Partial<Record<ItemId, number>>, Partial<Record<ItemId, number>>];
  /** Whose turn is next while playing (null when done). */
  nextPlayer: number | null;
  /** The round being played now (or the last one), so screens can draw it. */
  current: Round;
}
