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

/** What a land cell holds. Stage 2 adds the worlds' own kinds (trees, ice, buildings). */
export const AIR = 0;
export const DIRT = 1;

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
}

/** One shot: a whole-degree angle (0 right, 90 up, 180 left), a whole-number power 0–100 and an arrow. */
export interface Shot {
  angle: number;
  power: number;
  arrow: ArrowId;
}

/** What a flying arrow ran into. */
export type HitKind = 'archer' | 'land' | 'floor' | 'gone' | 'timeout';

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

/** A flight: what it hit, and points along the way (x, y, x, y …) for drawing only. */
export interface Flight {
  hit: ShotHit;
  path: number[];
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
  /** How many cells each archer fell after the blast. */
  fell: [number, number];
  /** Each archer after the shot. */
  after: [Archer, Archer];
  /** Only when asked for (`keepPaths`), for drawing. */
  path?: number[];
}

/** One round: its own land and wind. */
export interface Round {
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
}

/** What each player brings to a fight: how many of each arrow (Plain is always unlimited) and a shield. */
export interface PlayerSetup {
  quiver: Partial<Record<ArrowId, number>>;
  /** Shield points at the start of each round (0 for none). The shields' own rules come in Stage 3. */
  shield: number;
}

export interface FightSetup {
  players: [PlayerSetup, PlayerSetup];
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
  /** How many of each special arrow each player actually shot. The server returns the rest. */
  used: [Partial<Record<ArrowId, number>>, Partial<Record<ArrowId, number>>];
  /** Whose turn is next while playing (null when done). */
  nextPlayer: number | null;
  /** The round being played now (or the last one), so screens can draw it. */
  current: Round;
}
