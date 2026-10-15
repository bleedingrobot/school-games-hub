/**
 * The Wormholes & Black Holes rules engine, shared by the website, the bots and the server.
 *
 * `play(state, action, dice)` is a pure function: it never changes the state it's given,
 * never reads the clock and never makes up random numbers. Every random thing (dice, item
 * draws, mystery cards, cosmic events) comes from `dice`. So the same state, action and
 * dice always give the same new state and the same list of events, which is how the
 * server can replay a bot game and check it.
 *
 * A turn: the rocket whose turn it is may use one item, then rolls. Squares it lands on
 * can carry it on to other squares (at most CHAIN_CAP effects per move, so nothing can
 * loop). Some squares stop and ask for a choice ("pending"); the turn carries on once
 * it's made. The screen animates the events and never works out results itself.
 */
import {
  cometTail,
  isLink,
  moveComet,
  type Board,
  type Comet,
  type GravityKind,
  type Square,
  type StarKind,
} from './board';
import { betterTier, ITEMS, ITEM_TIERS, MAX_ITEMS, type ItemKind, type ItemTier } from './items';
import { pickWeighted, type Dice } from './random';

export type Mode = 'classic' | 'cosmic';
export type Finish = 'any' | 'exact';

export interface Settings {
  /** Classic: wormholes and black holes only. Cosmic: everything. */
  mode: Mode;
  /** "any": any roll that reaches the last square wins. "exact": overshoot bounces back. */
  finish: Finish;
  rollAgainOnSix: boolean;
  cosmicEvents: boolean;
  /** Mission Control maths questions at wormhole mouths (not built yet: always off). */
  maths: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'cosmic',
  finish: 'any',
  rollAgainOnSix: false,
  cosmicEvents: false,
  maths: false,
};

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
/** At most this many squares can act on a rocket in one move. */
export const CHAIN_CAP = 3;
/** Never reached (a test checks): stops a bug from looping for ever. */
const SAFETY_STOP = 25;
/** Games with fewer rockets get this many more rounds on the mission clock per empty seat. */
export const CLOCK_ROUNDS_PER_EMPTY_SEAT = 5;
/** The "fuel low" warning shows this many rounds before the mission clock runs out. */
export const FUEL_WARNING_ROUNDS = 5;
/** Cosmic events happen at the start of every this-many rounds. */
export const COSMIC_EVENT_EVERY = 5;
/** The rocket in last place, this far behind the leader, is sent a Rescue Beacon… */
export const RESCUE_GAP = 30;
/** …at most once in this many rounds. */
export const RESCUE_EVERY = 8;
/** Space Mines fizzle out after this many rounds. */
export const MINE_ROUNDS = 5;
/** Quantum Swap can't target a rocket this close to the end (square 90+ on a 100 board). */
export const SWAP_SAFE_ZONE = 10;
export const SWAP_RANGE = 15;
export const TRACTOR_PULL = 3;
export const MINE_PUSH = 3;
export const PULSAR_RANGE = 5;
export const PULSAR_PUSH = 2;
export const SUPERNOVA_BLAST = 5;
export const SUPERNOVA_RANGE = 10;
export const SUPERNOVA_PUSH = 2;
export const RESCUE_JUMP = 10;
export const METEORS = 5;
/** Where the mystery station can send you, and how likely each is. */
export const MYSTERY_OFFSETS: readonly (readonly [number, number])[] = [
  [3, 2], [5, 2], [8, 2], [12, 1], [-3, 2], [-6, 1],
];

export interface GravityEffect {
  kind: GravityKind;
  /** Rolls it still affects. */
  rolls: number;
}

export interface Rocket {
  position: number;
  items: ItemKind[];
  gravity: GravityEffect | null;
  /** Hit by a Gravity Anchor: the next roll is halved. */
  anchored: boolean;
  /** Solar wind: +1 on the next roll. */
  solarWind: boolean;
  /** Binary star: roll two dice next time and pick one. */
  binary: boolean;
  /** Hit by a hinder: nobody can target it until its next turn. */
  shielded: boolean;
  /** The rocket this one last aimed a hinder at (it can't pick the same one twice in a row). */
  lastTarget: number | null;
  /** The round this rocket was last sent a Rescue Beacon. */
  beaconRound: number | null;
}

export interface Mine {
  square: number;
  owner: number;
  round: number;
}

/** A choice the rocket whose turn it is must make before the game goes on. */
export type Pending =
  | { kind: 'gate'; square: number; twin: number }
  | { kind: 'mystery'; square: number }
  | { kind: 'inventory'; item: ItemKind }
  | { kind: 'binary'; dice: [number, number] }
  | { kind: 'question'; square: number };

export type CosmicEvent = 'solar-wind' | 'meteor-shower' | 'wormhole-shift';

export interface TurnInfo {
  itemUsed: boolean;
  /** Rolled since the turn started (or since a roll-again). Items can only be used before rolling. */
  rolled: boolean;
  booster: boolean;
  hyperdrive: boolean;
  navigator: number | null;
  /** Squares that have acted in the current move (see CHAIN_CAP). */
  effects: number;
  /** The real die showed a 6 (for roll-again-on-6). */
  rolledSix: boolean;
  rollAgainUsed: boolean;
}

export type Ending = 'docked' | 'mission-clock';

export interface SpaceState {
  board: Board;
  settings: Settings;
  rockets: Rocket[];
  /** Whose turn: 0 is the first seat. */
  turn: number;
  /** Starts at 1. A round is everyone having one turn. */
  round: number;
  turnsTaken: number;
  phase: 'ready' | 'choice' | 'over';
  pending: Pending | null;
  turnInfo: TurnInfo;
  comet: Comet | null;
  mines: Mine[];
  /** Asteroid squares from a meteor shower (gone next round). */
  asteroids: number[];
  /** Everyone's place (1st, 2nd…) when the game is over; ties share a place. */
  places: number[] | null;
  ending: Ending | null;
}

export type MoveCause = 'roll' | 'bounce' | 'warp-key' | 'rescue-beacon' | 'supernova';

export type SpaceEvent =
  | { kind: 'turn-start'; seat: number; round: number }
  | { kind: 'round-start'; round: number }
  | { kind: 'item-gained'; seat: number; item: ItemKind; from: 'star' | 'matariki' | 'rescue' }
  | { kind: 'pockets-full'; seat: number; item: ItemKind }
  | { kind: 'item-swapped'; seat: number; dropped: ItemKind; item: ItemKind }
  | { kind: 'item-declined'; seat: number; item: ItemKind }
  | { kind: 'item-used'; seat: number; item: ItemKind; target?: number; value?: number }
  | { kind: 'item-lost'; seat: number; item: ItemKind }
  | { kind: 'dice'; seat: number; dice: number[] }
  | { kind: 'roll'; seat: number; die: number; steps: number; changes: string[] }
  | { kind: 'move'; seat: number; from: number; to: number; cause: MoveCause; bounced?: boolean }
  | { kind: 'wormhole'; seat: number; from: number; to: number }
  | { kind: 'black-hole'; seat: number; from: number; to: number; escapePod?: boolean }
  | { kind: 'force-field'; seat: number; square: number }
  | { kind: 'star'; seat: number; square: number; star: StarKind }
  | { kind: 'pushed'; seat: number; from: number; to: number; by: 'pulsar' | 'supernova' | 'tractor-beam' | 'space-mine'; source: number }
  | { kind: 'swapped'; seat: number; target: number; from: number; to: number }
  | { kind: 'gravity'; seat: number; gravity: GravityKind; source: 'square' | 'neutron-star' }
  | { kind: 'anchored'; seat: number; source: number }
  | { kind: 'repaired'; seat: number }
  | { kind: 'binary-ready'; seat: number }
  | { kind: 'gate'; seat: number; from: number; to: number }
  | { kind: 'gate-stay'; seat: number; square: number }
  | { kind: 'mystery'; seat: number; card: number; from: number; to: number }
  | { kind: 'comet'; seat: number; from: number; to: number }
  | { kind: 'comet-moved'; head: number }
  | { kind: 'mine-placed'; seat: number; square: number }
  | { kind: 'mine-fizzled'; owner: number; square: number }
  | { kind: 'asteroid'; seat: number; square: number }
  | { kind: 'supernova-spent'; square: number }
  | { kind: 'question'; seat: number; correct: boolean; from: number; to: number }
  | { kind: 'chain-cap'; seat: number; square: number }
  | { kind: 'choice'; seat: number; pending: Pending }
  | { kind: 'timeout'; seat: number }
  | { kind: 'roll-again'; seat: number }
  | { kind: 'cosmic'; event: CosmicEvent; squares?: number[]; wormhole?: number; from?: number; to?: number }
  | { kind: 'fuel-warning'; roundsLeft: number }
  | { kind: 'docked'; seat: number }
  | { kind: 'game-over'; ending: Ending; places: number[] };

/**
 * What the rocket whose turn it is does. Choice options:
 * gate 0 stay / 1 jump; mystery 0–2 (the card); inventory 0–2 drop that item / 3 keep what
 * you have; binary 0 or 1 (which die); question 0 wrong / 1 right.
 */
export type SpaceAction =
  | { kind: 'use-item'; item: ItemKind; target?: number; value?: number }
  | { kind: 'roll' }
  | { kind: 'choose'; option: number }
  | { kind: 'timeout' };

export const KEEP_ITEMS = 3;

/** A move the rules don't allow. The message is fine to show a student. */
export class SpaceRuleError extends Error {}

export interface PlayResult {
  state: SpaceState;
  events: SpaceEvent[];
}

const newTurnInfo = (): TurnInfo => ({
  itemUsed: false, rolled: false, booster: false, hyperdrive: false, navigator: null,
  effects: 0, rolledSix: false, rollAgainUsed: false,
});

/** Classic mode keeps only the wormholes and black holes. */
function classicBoard(board: Board): Board {
  const squares: Record<number, Square> = {};
  for (const [n, square] of Object.entries(board.squares)) if (isLink(square)) squares[Number(n)] = square;
  return { ...board, squares, comet: null };
}

/** A new game, everyone on square 1, the first seat to play. */
export function newGame(board: Board, settings: Settings, players: number): PlayResult {
  if (!Number.isInteger(players) || players < MIN_PLAYERS || players > MAX_PLAYERS) {
    throw new SpaceRuleError(`A game needs ${MIN_PLAYERS} to ${MAX_PLAYERS} rockets.`);
  }
  const playBoard = settings.mode === 'classic' ? classicBoard(board) : structuredClone(board);
  const state: SpaceState = {
    board: playBoard,
    settings: { ...settings, cosmicEvents: settings.mode === 'cosmic' && settings.cosmicEvents },
    rockets: Array.from({ length: players }, () => ({
      position: 1, items: [], gravity: null, anchored: false, solarWind: false, binary: false,
      shielded: false, lastTarget: null, beaconRound: null,
    })),
    turn: 0,
    round: 1,
    turnsTaken: 0,
    phase: 'ready',
    pending: null,
    turnInfo: newTurnInfo(),
    comet: playBoard.comet ? { ...playBoard.comet } : null,
    mines: [],
    asteroids: [],
    places: null,
    ending: null,
  };
  const events: SpaceEvent[] = [{ kind: 'round-start', round: 1 }, { kind: 'turn-start', seat: 0, round: 1 }];
  return { state, events };
}

export function play(previous: SpaceState, action: SpaceAction, dice: Dice): PlayResult {
  const s = structuredClone(previous);
  const events: SpaceEvent[] = [];
  const game = new Game(s, dice, events);
  game.act(action);
  return { state: s, events };
}

/**
 * How many rounds before the fuel runs out. The board's number is for 4 rockets; fewer
 * rockets have quicker rounds, so they get a few more.
 */
export function missionRounds(s: SpaceState): number {
  return s.board.missionRounds + (MAX_PLAYERS - s.rockets.length) * CLOCK_ROUNDS_PER_EMPTY_SEAT;
}

/** The lowest square any rocket is on. */
const lastPosition = (s: SpaceState) => Math.min(...s.rockets.map((r) => r.position));
const leaderPosition = (s: SpaceState) => Math.max(...s.rockets.map((r) => r.position));

/** True if this rocket is in last place (tied counts). */
export function isLast(s: SpaceState, seat: number): boolean {
  return s.rockets[seat].position === lastPosition(s);
}

/** The rockets this one could aim this item at right now. */
export function validTargets(s: SpaceState, item: ItemKind, seat = s.turn): number[] {
  if (!ITEMS[item].targeted) return [];
  const me = s.rockets[seat];
  const last = lastPosition(s);
  const targets: number[] = [];
  s.rockets.forEach((other, i) => {
    if (i === seat || other.shielded || i === me.lastTarget) return;
    if (other.position === last) return; // never the rocket in last place
    if (item === 'tractor-beam' && other.position <= 1) return;
    if (item === 'quantum-swap') {
      const ahead = other.position - me.position;
      if (ahead <= 0 || ahead > SWAP_RANGE) return;
      if (other.position >= s.board.size - SWAP_SAFE_ZONE) return; // nobody robbed at the finish
    }
    targets.push(i);
  });
  return targets;
}

/** The nearest wormhole mouth ahead of a square, or null. */
export function nextWormhole(s: SpaceState, from: number): number | null {
  for (let n = from + 1; n < s.board.size; n++) if (s.board.squares[n]?.kind === 'wormhole') return n;
  return null;
}

/** Why an item can't be used right now, or null if it can. */
export function itemProblem(s: SpaceState, item: ItemKind, seat = s.turn): string | null {
  const r = s.rockets[seat];
  if (s.phase !== 'ready' || seat !== s.turn) return "It isn't your turn.";
  if (!r.items.includes(item)) return "You don't have that item.";
  if (s.turnInfo.itemUsed) return 'You can only use one item a turn.';
  if (s.turnInfo.rolled) return 'Use items before you roll.';
  if (ITEMS[item].automatic) return 'That one works by itself.';
  if (item === 'repair-kit' && !r.gravity && !r.anchored) return 'Nothing to repair.';
  if (item === 'warp-key' && nextWormhole(s, r.position) === null) return 'No wormholes ahead.';
  if (item === 'space-mine') {
    if (s.mines.some((m) => m.owner === seat)) return 'You already have a mine out there.';
    if (r.position <= 1) return "You can't leave a mine on Earth.";
    if (s.mines.some((m) => m.square === r.position)) return "There's already a mine here.";
  }
  if (ITEMS[item].targeted && validTargets(s, item, seat).length === 0) return 'No rockets you can aim at.';
  return null;
}

/** The items this rocket could use right now. */
export function usableItems(s: SpaceState, seat = s.turn): ItemKind[] {
  return [...new Set(s.rockets[seat].items)].filter((item) => itemProblem(s, item, seat) === null);
}

/**
 * How far a die roll moves this rocket, and what changed it.
 * Order: Navigator picks the die; doubles (Hyperdrive, slingshot); halves rounded up
 * (heavy gravity, Gravity Anchor); then pluses (Booster, low gravity, solar wind). Never 0.
 */
export function stepsFor(r: Rocket, t: TurnInfo, die: number): { steps: number; changes: string[] } {
  let steps = die;
  const changes: string[] = [];
  if (t.hyperdrive) { steps *= 2; changes.push('hyperdrive'); }
  if (r.gravity?.kind === 'slingshot') { steps *= 2; changes.push('slingshot'); }
  if (r.gravity?.kind === 'heavy') { steps = Math.ceil(steps / 2); changes.push('heavy-gravity'); }
  if (r.anchored) { steps = Math.ceil(steps / 2); changes.push('gravity-anchor'); }
  if (t.booster) { steps += 2; changes.push('booster'); }
  if (r.gravity?.kind === 'low') { steps += 2; changes.push('low-gravity'); }
  if (r.solarWind) { steps += 1; changes.push('solar-wind'); }
  return { steps: Math.max(1, steps), changes };
}

/** Where moving this many squares forward from a square ends, before any square acts. */
export function moveTarget(s: SpaceState, from: number, steps: number): { to: number; bounced: boolean } {
  const size = s.board.size;
  const to = from + steps;
  if (to <= size) return { to, bounced: false };
  if (s.settings.finish === 'any') return { to: size, bounced: false };
  return { to: Math.max(1, size - (to - size)), bounced: true };
}

/** Everyone's place by how far they got (a docked rocket is always 1st). Ties share. */
export function placesFor(s: SpaceState): number[] {
  return s.rockets.map((r) => 1 + s.rockets.filter((o) => o.position > r.position).length);
}

/** True if landing here would make something happen (used for the chain cap). */
function somethingAt(s: SpaceState, seat: number, n: number): boolean {
  if (n >= s.board.size) return false;
  if (s.mines.some((m) => m.square === n && m.owner !== seat)) return true;
  if (s.asteroids.includes(n)) return true;
  if (s.comet && cometTail(s.comet).includes(n)) return true;
  const square = s.board.squares[n];
  return square !== undefined && square.kind !== 'nebula';
}

class Game {
  constructor(
    private s: SpaceState,
    private dice: Dice,
    private events: SpaceEvent[],
  ) {}

  private get seat() { return this.s.turn; }
  private get me() { return this.s.rockets[this.s.turn]; }
  private emit(event: SpaceEvent) { this.events.push(event); }

  act(action: SpaceAction) {
    const s = this.s;
    if (s.phase === 'over') throw new SpaceRuleError('This game is over.');
    switch (action.kind) {
      case 'use-item': return this.useItem(action.item, action.target, action.value);
      case 'roll':
        if (s.phase !== 'ready') throw new SpaceRuleError('Make your choice first.');
        return this.roll();
      case 'choose':
        if (s.phase !== 'choice' || !s.pending) throw new SpaceRuleError("There's nothing to choose.");
        return this.choose(action.option);
      case 'timeout':
        this.emit({ kind: 'timeout', seat: this.seat });
        if (s.phase === 'choice' && s.pending) return this.choose(defaultOption(s.pending));
        return this.roll();
      default:
        throw new SpaceRuleError("That isn't something you can do.");
    }
  }

  // ---- items ----

  private useItem(item: ItemKind, target: number | undefined, value: number | undefined) {
    const problem = ITEMS[item] ? itemProblem(this.s, item) : "That isn't an item.";
    if (problem) throw new SpaceRuleError(problem);
    const s = this.s;
    const me = this.me;
    if (ITEMS[item].targeted) {
      if (target === undefined || !validTargets(s, item).includes(target)) throw new SpaceRuleError("You can't aim at that rocket.");
    }
    if (item === 'navigator' && !(Number.isInteger(value) && value! >= 1 && value! <= 6)) {
      throw new SpaceRuleError('Pick a number from 1 to 6.');
    }
    me.items.splice(me.items.indexOf(item), 1);
    s.turnInfo.itemUsed = true;
    this.emit({ kind: 'item-used', seat: this.seat, item, ...(target !== undefined && ITEMS[item].targeted ? { target } : {}), ...(item === 'navigator' ? { value } : {}) });

    switch (item) {
      case 'booster': s.turnInfo.booster = true; return;
      case 'hyperdrive': s.turnInfo.hyperdrive = true; return;
      case 'navigator': s.turnInfo.navigator = value!; return;
      case 'repair-kit':
        me.gravity = null;
        me.anchored = false;
        this.emit({ kind: 'repaired', seat: this.seat });
        return;
      case 'space-mine':
        s.mines.push({ square: me.position, owner: this.seat, round: s.round });
        this.emit({ kind: 'mine-placed', seat: this.seat, square: me.position });
        return;
      case 'tractor-beam': {
        const other = s.rockets[target!];
        const from = other.position;
        other.position = Math.max(1, from - TRACTOR_PULL);
        this.emit({ kind: 'pushed', seat: target!, from, to: other.position, by: 'tractor-beam', source: this.seat });
        this.hit(target!);
        return;
      }
      case 'gravity-anchor':
        s.rockets[target!].anchored = true;
        this.emit({ kind: 'anchored', seat: target!, source: this.seat });
        this.hit(target!);
        return;
      case 'quantum-swap': {
        const other = s.rockets[target!];
        const [mine, theirs] = [me.position, other.position];
        me.position = theirs;
        other.position = mine;
        this.emit({ kind: 'swapped', seat: this.seat, target: target!, from: mine, to: theirs });
        this.hit(target!);
        return;
      }
      case 'warp-key': {
        const mouth = nextWormhole(s, me.position)!;
        this.moveMe(mouth, 'warp-key');
        return this.afterMove();
      }
      case 'rescue-beacon':
        this.moveMe(Math.min(s.board.size, me.position + RESCUE_JUMP), 'rescue-beacon');
        return this.afterMove();
      default:
        throw new SpaceRuleError('That works by itself.');
    }
  }

  /** A hinder hit this rocket: it's shielded until its next turn. */
  private hit(target: number) {
    this.s.rockets[target].shielded = true;
    this.me.lastTarget = target;
  }

  private gainItem(seat: number, tier: ItemTier, from: 'star' | 'matariki' | 'rescue', item?: ItemKind) {
    const got = item ?? pickWeighted(this.dice, ITEM_TIERS[tier]);
    const r = this.s.rockets[seat];
    if (r.items.length < MAX_ITEMS) {
      r.items.push(got);
      this.emit({ kind: 'item-gained', seat, item: got, from });
    } else if (seat === this.seat && from !== 'rescue') {
      this.ask({ kind: 'inventory', item: got });
    } else {
      this.emit({ kind: 'pockets-full', seat, item: got });
    }
  }

  // ---- rolling and moving ----

  private roll() {
    const s = this.s;
    const me = this.me;
    if (me.binary && s.turnInfo.navigator === null) {
      // (With a Navigator the number is already picked, so the binary star waits for next time.)
      me.binary = false;
      const two: [number, number] = [this.dice(6), this.dice(6)];
      this.emit({ kind: 'dice', seat: this.seat, dice: two });
      this.ask({ kind: 'binary', dice: two });
      return;
    }
    const die = s.turnInfo.navigator ?? this.dice(6);
    if (s.turnInfo.navigator === null) this.emit({ kind: 'dice', seat: this.seat, dice: [die] });
    this.rollWith(die, s.turnInfo.navigator === null);
  }

  private rollWith(die: number, realDie: boolean) {
    const s = this.s;
    const me = this.me;
    const t = s.turnInfo;
    const { steps, changes } = stepsFor(me, t, die);
    this.emit({ kind: 'roll', seat: this.seat, die, steps, changes });
    // Use up what this roll used.
    t.booster = t.hyperdrive = false;
    t.navigator = null;
    me.anchored = false;
    me.solarWind = false;
    if (me.gravity && --me.gravity.rolls <= 0) me.gravity = null;
    t.rolled = true;
    t.rolledSix = realDie && die === 6;
    t.effects = 0;

    const { to, bounced } = moveTarget(s, me.position, steps);
    this.emit({ kind: 'move', seat: this.seat, from: me.position, to, cause: bounced ? 'bounce' : 'roll', ...(bounced ? { bounced } : {}) });
    me.position = to;
    this.land();
    this.afterMove();
  }

  /** Moves the rocket whose turn it is (by an item or a square), then lets squares act. */
  private moveMe(to: number, cause: MoveCause) {
    const me = this.me;
    this.s.turnInfo.effects = 0;
    this.emit({ kind: 'move', seat: this.seat, from: me.position, to, cause });
    me.position = to;
    this.land();
  }

  /** Lets the square the rocket landed on act, and the next, up to CHAIN_CAP. */
  private land() {
    const s = this.s;
    const me = this.me;
    const seat = this.seat;
    for (let guard = 0; ; guard++) {
      if (guard > SAFETY_STOP) throw new Error('Wormholes & Black Holes: safety stop reached');
      const n = me.position;
      if (n >= s.board.size) {
        this.emit({ kind: 'docked', seat });
        this.endGame('docked');
        return;
      }
      if (!somethingAt(s, seat, n)) return;
      if (s.turnInfo.effects >= CHAIN_CAP) {
        this.emit({ kind: 'chain-cap', seat, square: n });
        return;
      }
      s.turnInfo.effects++;

      const mine = s.mines.find((m) => m.square === n && m.owner !== seat);
      if (mine) {
        s.mines.splice(s.mines.indexOf(mine), 1);
        me.position = Math.max(1, n - MINE_PUSH);
        this.emit({ kind: 'pushed', seat, from: n, to: me.position, by: 'space-mine', source: mine.owner });
        continue;
      }
      if (s.asteroids.includes(n)) {
        this.emit({ kind: 'asteroid', seat, square: n });
        if (me.items.length > 0) {
          this.emit({ kind: 'item-lost', seat, item: me.items.pop()! });
          return;
        }
        me.position = Math.max(1, n - 1);
        this.emit({ kind: 'move', seat, from: n, to: me.position, cause: 'bounce' });
        continue;
      }
      if (s.comet && cometTail(s.comet).includes(n)) {
        me.position = s.comet.head;
        this.emit({ kind: 'comet', seat, from: n, to: me.position });
        continue;
      }

      const square = s.board.squares[n];
      switch (square.kind) {
        case 'wormhole':
          if (s.settings.maths) return this.ask({ kind: 'question', square: n });
          me.position = square.to;
          this.emit({ kind: 'wormhole', seat, from: n, to: square.to });
          continue;
        case 'black-hole': {
          const ff = me.items.indexOf('force-field');
          if (ff >= 0) {
            me.items.splice(ff, 1);
            this.emit({ kind: 'force-field', seat, square: n });
            return;
          }
          const pod = me.items.indexOf('escape-pod');
          if (pod >= 0) {
            me.items.splice(pod, 1);
            me.position = n - Math.max(1, Math.floor((n - square.to) / 2));
            this.emit({ kind: 'black-hole', seat, from: n, to: me.position, escapePod: true });
          } else {
            me.position = square.to;
            this.emit({ kind: 'black-hole', seat, from: n, to: square.to });
          }
          continue;
        }
        case 'star':
          this.emit({ kind: 'star', seat, square: n, star: square.star });
          if (this.star(square.star, n)) continue;
          return;
        case 'gravity':
          me.gravity = { kind: square.gravity, rolls: square.gravity === 'slingshot' ? 1 : 2 };
          this.emit({ kind: 'gravity', seat, gravity: square.gravity, source: 'square' });
          return;
        case 'gate':
          return this.ask({ kind: 'gate', square: n, twin: square.twin });
        case 'mystery':
          return this.ask({ kind: 'mystery', square: n });
        case 'nebula':
          return;
      }
    }
  }

  /** A star square acts. Returns true if it moved the rocket (so the new square acts too). */
  private star(star: StarKind, n: number): boolean {
    const s = this.s;
    const me = this.me;
    const seat = this.seat;
    const tier = (base: ItemTier): ItemTier => (isLast(s, seat) ? betterTier(base) : base);
    switch (star) {
      case 'red-dwarf': this.gainItem(seat, tier('common'), 'star'); return false;
      case 'yellow-star': this.gainItem(seat, tier('random'), 'star'); return false;
      case 'blue-giant': this.gainItem(seat, 'rare', 'star'); return false;
      case 'white-dwarf': this.gainItem(seat, 'common', 'star', 'force-field'); return false;
      case 'binary-star':
        me.binary = true;
        this.emit({ kind: 'binary-ready', seat });
        return false;
      case 'neutron-star':
        me.gravity = { kind: 'heavy', rolls: 2 };
        this.emit({ kind: 'gravity', seat, gravity: 'heavy', source: 'neutron-star' });
        return false;
      case 'pulsar':
        this.pushNear(n, PULSAR_RANGE, PULSAR_PUSH, 'pulsar');
        return false;
      case 'supernova':
        this.pushNear(n, SUPERNOVA_RANGE, SUPERNOVA_PUSH, 'supernova');
        s.board.squares[n] = { kind: 'nebula' };
        this.emit({ kind: 'supernova-spent', square: n });
        me.position = Math.min(s.board.size, n + SUPERNOVA_BLAST);
        this.emit({ kind: 'move', seat, from: n, to: me.position, cause: 'supernova' });
        return true;
      case 'matariki':
        // Everyone else first, so the lander's "pockets full" choice (if any) comes last.
        for (let i = 1; i < s.rockets.length; i++) this.gainItem((seat + i) % s.rockets.length, 'common', 'matariki');
        this.gainItem(seat, 'common', 'matariki');
        return false;
    }
  }

  /** Every other rocket within `range` squares (either way) goes back. */
  private pushNear(n: number, range: number, push: number, by: 'pulsar' | 'supernova') {
    this.s.rockets.forEach((r, i) => {
      if (i === this.seat || Math.abs(r.position - n) > range || r.position <= 1) return;
      const from = r.position;
      r.position = Math.max(1, from - push);
      this.emit({ kind: 'pushed', seat: i, from, to: r.position, by, source: this.seat });
    });
  }

  private ask(pending: Pending) {
    this.s.phase = 'choice';
    this.s.pending = pending;
    this.emit({ kind: 'choice', seat: this.seat, pending });
  }

  private choose(option: number) {
    const s = this.s;
    const me = this.me;
    const seat = this.seat;
    const pending = s.pending!;
    if (!Number.isInteger(option) || !choiceOptions(pending).includes(option)) throw new SpaceRuleError("That isn't one of the choices.");
    s.phase = 'ready';
    s.pending = null;
    switch (pending.kind) {
      case 'binary':
        return this.rollWith(pending.dice[option], true);
      case 'gate':
        if (option === 1) {
          me.position = pending.twin;
          this.emit({ kind: 'gate', seat, from: pending.square, to: pending.twin });
        } else {
          this.emit({ kind: 'gate-stay', seat, square: pending.square });
        }
        return this.afterMove();
      case 'mystery': {
        // The destination is drawn only now, after the card is picked: nothing to peek at.
        const offset = pickWeighted(this.dice, MYSTERY_OFFSETS);
        const to = Math.min(s.board.size - 1, Math.max(2, pending.square + offset));
        me.position = to;
        this.emit({ kind: 'mystery', seat, card: option, from: pending.square, to });
        this.land();
        return this.afterMove();
      }
      case 'inventory':
        if (option === KEEP_ITEMS) {
          this.emit({ kind: 'item-declined', seat, item: pending.item });
        } else {
          const [dropped] = me.items.splice(option, 1, pending.item);
          this.emit({ kind: 'item-swapped', seat, dropped, item: pending.item });
        }
        return this.afterMove();
      case 'question': {
        const square = s.board.squares[pending.square] as { kind: 'wormhole'; to: number };
        const bonus = square.to + 3;
        const to = option === 1 && bonus < s.board.size && !isLink(s.board.squares[bonus]) ? bonus : square.to;
        me.position = to;
        this.emit({ kind: 'question', seat, correct: option === 1, from: pending.square, to });
        this.land();
        return this.afterMove();
      }
    }
  }

  /** After a move (or a choice) has finished: wait for a choice, carry on the turn, or end it. */
  private afterMove() {
    const s = this.s;
    if (s.phase === 'over' || s.phase === 'choice') return;
    if (!s.turnInfo.rolled) return; // an item moved the rocket before rolling: now roll
    const t = s.turnInfo;
    if (s.settings.rollAgainOnSix && t.rolledSix && !t.rollAgainUsed) {
      t.rollAgainUsed = true;
      t.rolled = false;
      t.rolledSix = false;
      this.emit({ kind: 'roll-again', seat: this.seat });
      return;
    }
    this.nextTurn();
  }

  private nextTurn() {
    const s = this.s;
    s.turnsTaken++;
    s.turn = (s.turn + 1) % s.rockets.length;
    if (s.turn === 0) {
      this.newRound();
      if (s.phase === 'over') return;
    }
    s.turnInfo = newTurnInfo();
    const me = this.me;
    me.shielded = false;
    this.emit({ kind: 'turn-start', seat: s.turn, round: s.round });
    // Catch-up help: a Rescue Beacon for the rocket in last place, if it's far behind.
    if (
      s.settings.mode === 'cosmic' &&
      isLast(s, s.turn) &&
      leaderPosition(s) - me.position >= RESCUE_GAP &&
      (me.beaconRound === null || s.round - me.beaconRound >= RESCUE_EVERY) &&
      me.items.length < MAX_ITEMS &&
      !me.items.includes('rescue-beacon')
    ) {
      me.beaconRound = s.round;
      this.gainItem(s.turn, 'common', 'rescue', 'rescue-beacon');
    }
  }

  private newRound() {
    const s = this.s;
    if (s.round >= missionRounds(s)) {
      this.endGame('mission-clock');
      return;
    }
    s.round++;
    s.asteroids = [];
    this.emit({ kind: 'round-start', round: s.round });
    const roundsLeft = missionRounds(s) - s.round + 1;
    if (roundsLeft === FUEL_WARNING_ROUNDS) this.emit({ kind: 'fuel-warning', roundsLeft });
    if (s.comet) {
      s.comet = moveComet(s.comet, s.board.size);
      this.emit({ kind: 'comet-moved', head: s.comet.head });
    }
    for (const mine of [...s.mines]) {
      if (s.round - mine.round >= MINE_ROUNDS) {
        s.mines.splice(s.mines.indexOf(mine), 1);
        this.emit({ kind: 'mine-fizzled', owner: mine.owner, square: mine.square });
      }
    }
    if (s.settings.cosmicEvents && (s.round - 1) % COSMIC_EVENT_EVERY === 0) this.cosmicEvent();
  }

  private cosmicEvent() {
    const s = this.s;
    const event = pickWeighted<CosmicEvent>(this.dice, [['solar-wind', 1], ['meteor-shower', 1], ['wormhole-shift', 1]]);
    if (event === 'solar-wind') {
      for (const r of s.rockets) r.solarWind = true;
      this.emit({ kind: 'cosmic', event });
    } else if (event === 'meteor-shower') {
      const empty: number[] = [];
      for (let n = 2; n < s.board.size; n++) {
        if (!somethingAt(s, -1, n) && !s.rockets.some((r) => r.position === n)) empty.push(n);
      }
      const squares: number[] = [];
      for (let i = 0; i < METEORS && empty.length > 0; i++) squares.push(empty.splice(this.dice(empty.length) - 1, 1)[0]);
      s.asteroids = squares.sort((a, b) => a - b);
      this.emit({ kind: 'cosmic', event, squares: s.asteroids });
    } else {
      const wormholes = Object.entries(s.board.squares).filter(([, sq]) => sq.kind === 'wormhole').map(([n]) => Number(n));
      if (wormholes.length === 0) return this.emit({ kind: 'cosmic', event });
      const wormhole = wormholes[this.dice(wormholes.length) - 1];
      const square = s.board.squares[wormhole] as { kind: 'wormhole'; to: number };
      // The exit moves up to 5 squares, still landing on a plain square above the mouth.
      const options: number[] = [];
      for (let d = -5; d <= 5; d++) {
        const to = square.to + d;
        if (d !== 0 && to > wormhole + 1 && to < s.board.size && s.board.squares[to] === undefined) options.push(to);
      }
      if (options.length === 0) return this.emit({ kind: 'cosmic', event, wormhole, from: square.to, to: square.to });
      const to = options[this.dice(options.length) - 1];
      this.emit({ kind: 'cosmic', event, wormhole, from: square.to, to });
      square.to = to;
    }
  }

  private endGame(ending: Ending) {
    const s = this.s;
    s.phase = 'over';
    s.pending = null;
    s.ending = ending;
    s.places = placesFor(s);
    this.emit({ kind: 'game-over', ending, places: s.places });
  }
}

/** The options a choice has (see SpaceAction). */
export function choiceOptions(pending: Pending): number[] {
  switch (pending.kind) {
    case 'gate': return [0, 1];
    case 'mystery': return [0, 1, 2];
    case 'inventory': return [0, 1, 2, KEEP_ITEMS];
    case 'binary': return [0, 1];
    case 'question': return [0, 1];
  }
}

/** What happens when a choice times out: stay, card 1, keep your items, the higher die, "wrong". */
export function defaultOption(pending: Pending): number {
  switch (pending.kind) {
    case 'gate': return 0;
    case 'mystery': return 0;
    case 'inventory': return KEEP_ITEMS;
    case 'binary': return pending.dice[1] > pending.dice[0] ? 1 : 0;
    case 'question': return 0;
  }
}
