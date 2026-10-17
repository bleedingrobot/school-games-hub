/**
 * Wormholes & Black Holes with classmates (2–4 students, plus bots in empty seats if the
 * host wants them). Shared by the `space-game` server function and the website.
 *
 * The server runs every game: it rolls the dice with secure randomness, plays the action
 * through the rules engine, then flies any bots and autopilot rockets until a student has
 * to do something. This file holds that part, with no network and no clock, so it can be
 * tested on its own. The dice and the bots' random numbers are passed in.
 *
 * Timers (plan section 5): 30 seconds a turn and 15 for a choice, plus time for the
 * animations. On time-out the server plays the engine's `timeout` (roll with no item, or
 * the safe choice). Three in a row and autopilot (a Pilot bot) flies that rocket for the
 * rest of the game, which then counts as left for that student.
 */
import type { BotLevel } from '../botGame';
import type { StarKind } from './board';
import { STAR_KINDS } from './board';
import { boardFor, type BoardChoice } from './boards';
import { botAction } from './bot';
import { canCharge, MAX_PLAYERS, MIN_PLAYERS, newGame, play, type Settings, type SpaceAction, type SpaceEvent, type SpaceState } from './engine';
import type { Dice } from './random';
import { encodeAction, MIN_TURNS_TO_COUNT, parseBoard, parseSettings } from './save';

/** Bots in empty seats, and autopilot, play as Pilots. */
export const LIVE_BOT_LEVEL: BotLevel = 'easy';
export const TURN_SECONDS = 30;
export const CHOICE_SECONDS = 15;
/** A wormhole or black hole question (Mission Control maths) gets longer than another choice. */
export const QUESTION_SECONDS = 20;
/** This many timed-out turns in a row and autopilot takes over. */
export const AUTOPILOT_AFTER = 3;
/** The most seconds added to a timer for the animations of what just happened. */
export const MAX_ANIMATION_SECONDS = 25;
/** A game with no action for this long is ended by the tidy-up job (in the database). */
export const IDLE_MINUTES = 10;
/** The only reactions there are. The server refuses anything else. */
export const REACTIONS = ['🚀', '👏', '😮', '🎉', '😂', '👍'] as const;
export type Reaction = (typeof REACTIONS)[number];
export const REACTION_GAP_SECONDS = 5;
export const MAX_REACTIONS = 20;

export function isReaction(value: unknown): value is Reaction {
  return REACTIONS.includes(value as Reaction);
}

/** What one seat did in the game, for the space achievements and the 5-turn rule. */
export interface SeatStats {
  wormholes: number;
  blocks: number;
  stars: StarKind[];
  docked: boolean;
  /** Turns this rocket finished. */
  turns: number;
}

/** Everything about a seat that isn't in the rules engine's state. */
export interface SeatInfo {
  bot: boolean;
  /** Autopilot is flying this rocket right now. */
  autopilot: boolean;
  /** This student left (or was put on autopilot): the game earns them nothing, even if they come back. */
  left: boolean;
  /** Timed-out turns in a row. */
  timeouts: number;
  /**
   * Mission Control maths: this student answered the question after their turn right, and the
   * +1 is waiting for their next roll. Only ever set for a right answer: a wrong one leaves no trace.
   */
  charged?: boolean;
  stats: SeatStats;
}

export interface LiveSetup {
  board: BoardChoice;
  settings: Settings;
}

/** A running game: the engine's state and the seats. */
export interface LiveGame {
  state: SpaceState;
  seats: SeatInfo[];
}

/** Who did what, kept in the game's log. */
export interface LoggedAction {
  seat: number;
  /** encodeAction text, e.g. "roll" or "use:booster". */
  action: string;
  by: 'player' | 'timeout' | 'bot' | 'autopilot';
}

export interface Played {
  game: LiveGame;
  events: SpaceEvent[];
  actions: LoggedAction[];
  /** Every student has left (all on autopilot): the game stops here and earns nobody anything. */
  everyoneLeft: boolean;
}

const newStats = (): SeatStats => ({ wormholes: 0, blocks: 0, stars: [], docked: false, turns: 0 });

/**
 * Starts a game. `entries` is who sits where, in turn order: a player's ID, or null for a bot.
 * The caller shuffles them first.
 */
export function startLive(setup: LiveSetup, entries: readonly (string | null)[]): { game: LiveGame; events: SpaceEvent[] } {
  if (entries.length < MIN_PLAYERS || entries.length > MAX_PLAYERS) throw new Error('A game needs 2 to 4 rockets.');
  const { state, events } = newGame(boardFor(setup.board), setup.settings, entries.length);
  const seats = entries.map((who) => ({ bot: who === null, autopilot: false, left: false, timeouts: 0, stats: newStats() }));
  return { game: { state, seats }, events };
}

/** Starts a game and flies any bots before the first student's turn. */
export function launchLive(setup: LiveSetup, entries: readonly (string | null)[], dice: Dice, random: () => number): Played {
  const { game, events } = startLive(setup, entries);
  const out: Played = { game, events, actions: [], everyoneLeft: false };
  flyBots(game, dice, random, out);
  return out;
}

/** True if nobody needs to tap anything for this seat: a bot or autopilot flies it. */
export const flownByBot = (game: LiveGame, seat: number) => game.seats[seat].bot || game.seats[seat].autopilot;

function addStats(game: LiveGame, actor: number, before: SpaceState, after: SpaceState, events: SpaceEvent[]) {
  for (const event of events) {
    if (!('seat' in event)) continue;
    const stats = game.seats[event.seat]?.stats;
    if (!stats) continue;
    if (event.kind === 'wormhole') stats.wormholes++;
    else if (event.kind === 'force-field') stats.blocks++;
    else if (event.kind === 'docked') stats.docked = true;
    else if (event.kind === 'star' && !stats.stars.includes(event.star)) {
      stats.stars = STAR_KINDS.filter((k) => k === event.star || stats.stars.includes(k));
    }
  }
  if (after.turnsTaken > before.turnsTaken || (after.phase === 'over' && before.phase !== 'over')) {
    game.seats[actor].stats.turns++;
  }
}

/** Plays one action for the seat whose turn it is, keeping the seats' stats. */
function step(game: LiveGame, action: SpaceAction, dice: Dice, by: LoggedAction['by'], out: Played) {
  const seat = game.state.turn;
  const before = game.state;
  const { state, events } = play(before, action, dice);
  game.state = state;
  addStats(game, seat, before, state, events);
  out.events.push(...events);
  out.actions.push({ seat, action: encodeAction(action), by });
  applyCharge(game, dice, out);
}

/** A student with a right answer waiting gets their +1 as soon as they can use it (their turn, before rolling). */
export function applyCharge(game: LiveGame, dice: Dice, out: Played) {
  const info = game.seats[game.state.turn];
  if (!info?.charged || !canCharge(game.state)) return;
  info.charged = false;
  const seat = game.state.turn;
  const action: SpaceAction = { kind: 'charge', right: true };
  const { state, events } = play(game.state, action, dice);
  game.state = state;
  out.events.push(...events);
  out.actions.push({ seat, action: encodeAction(action), by: 'player' });
}

/** Most bot actions one request plays (3 bots × a long turn each is about 20). */
const MAX_BOT_ACTIONS = 200;

/** True while at least one student is still flying their own rocket. */
export const someoneFlying = (game: LiveGame) => game.seats.some((s) => !s.bot && !s.autopilot);

/** Flies bots and autopilot rockets until a student has to act, or the game ends. */
function flyBots(game: LiveGame, dice: Dice, random: () => number, out: Played) {
  if (!someoneFlying(game)) {
    out.everyoneLeft = true;
    return;
  }
  for (let n = 0; game.state.phase !== 'over' && flownByBot(game, game.state.turn); n++) {
    if (n >= MAX_BOT_ACTIONS) throw new Error('Bots never finished their turns');
    const seat = game.state.turn;
    step(game, botAction(game.state, LIVE_BOT_LEVEL, random), dice, game.seats[seat].bot ? 'bot' : 'autopilot', out);
  }
}

/** A deep copy, so a refused action never changes the game it was given. */
const copyGame = (game: LiveGame): LiveGame => structuredClone(game);

/**
 * A student plays an action on their own turn. Throws SpaceRuleError (with a message for
 * the student) if the rules don't allow it. Bots and autopilot then play until it's a
 * student's turn again.
 */
export function playerAction(previous: LiveGame, action: SpaceAction, dice: Dice, random: () => number): Played {
  const out: Played = { game: copyGame(previous), events: [], actions: [], everyoneLeft: false };
  const { game } = out;
  if (action.kind === 'timeout') throw new Error('Time-outs come from the clock, not a player');
  step(game, action, dice, 'player', out);
  const actor = previous.state.turn;
  game.seats[actor].timeouts = 0;
  flyBots(game, dice, random, out);
  return out;
}

/** The clock ran out for the seat whose turn it is. */
export function timeOut(previous: LiveGame, dice: Dice, random: () => number): Played {
  const out: Played = { game: copyGame(previous), events: [], actions: [], everyoneLeft: false };
  const { game } = out;
  const seat = game.state.turn;
  step(game, { kind: 'timeout' }, dice, 'timeout', out);
  const info = game.seats[seat];
  info.timeouts++;
  if (info.timeouts >= AUTOPILOT_AFTER && !info.bot) {
    info.autopilot = true;
    info.left = true;
  }
  flyBots(game, dice, random, out);
  return out;
}

/**
 * Puts seats on autopilot (they left, were hidden by the teacher, or were deleted) and flies
 * them if it's their turn. Returns null if nothing changed.
 */
export function autopilotSeats(previous: LiveGame, seats: readonly number[], dice: Dice, random: () => number): Played | null {
  const fresh = seats.filter((s) => previous.seats[s] && !previous.seats[s].bot && !previous.seats[s].autopilot);
  if (fresh.length === 0 || previous.state.phase === 'over') return null;
  const out: Played = { game: copyGame(previous), events: [], actions: [], everyoneLeft: false };
  for (const s of fresh) {
    out.game.seats[s].autopilot = true;
    out.game.seats[s].left = true;
  }
  flyBots(out.game, dice, random, out);
  return out;
}

/** A student who's back takes the controls from autopilot. It still counts as left for them. */
export function takeControls(previous: LiveGame, seat: number): LiveGame {
  const game = copyGame(previous);
  game.seats[seat].autopilot = false;
  game.seats[seat].timeouts = 0;
  return game;
}

/**
 * Which seats earn points: the game must have ended properly (docked or out of fuel), the
 * seat must be a student who didn't leave, with at least 5 turns, and at least 2 students
 * must have played it to the end.
 */
export function seatsThatCount(game: LiveGame, players: readonly (string | null)[]): boolean[] {
  const over = game.state.phase === 'over';
  const stayed = game.seats.map((s, i) => !s.bot && !s.left && players[i] !== null && players[i] !== undefined);
  const enough = stayed.filter(Boolean).length >= 2;
  return game.seats.map((s, i) => over && enough && stayed[i] && s.stats.turns >= MIN_TURNS_TO_COUNT);
}

/** Roughly how long the screen takes to show these events at Normal speed, in milliseconds. */
export function animationMs(events: readonly SpaceEvent[]): number {
  let ms = 0;
  let steps = 0;
  for (const e of events) {
    switch (e.kind) {
      case 'dice': ms += 850; break;
      case 'roll': steps = e.steps; ms += e.changes.length > 0 ? 700 : 0; break;
      case 'move': ms += e.cause === 'roll' || e.cause === 'bounce' ? 170 * Math.max(steps, Math.abs(e.to - e.from)) : 710; break;
      case 'wormhole': case 'black-hole': ms += 1300; break;
      case 'gate': case 'mystery': case 'comet': ms += 950; break;
      case 'item-gained': ms += 900; break;
      case 'item-used': ms += 800; break;
      case 'force-field': ms += 900; break;
      case 'cosmic': ms += 1800; break;
      case 'fuel-warning': ms += 1500; break;
      case 'docked': ms += 1000; break;
      case 'turn-start': ms += 250; break;
      case 'round-start': case 'game-over': case 'choice': case 'timeout': break;
      default: ms += 450;
    }
  }
  return ms;
}

/**
 * When the clock runs out for whoever's turn it is: 30 seconds (15 for a choice) after the
 * screens have finished showing what just happened. Slower screens (Relaxed speed) get a
 * bit more. Null when the game is over.
 */
export function deadlineAfter(game: LiveGame, events: readonly SpaceEvent[], nowMs: number): number | null {
  if (game.state.phase === 'over') return null;
  const asking = game.state.phase === 'choice' && game.state.pending?.kind === 'question';
  const base = asking ? QUESTION_SECONDS : game.state.phase === 'choice' ? CHOICE_SECONDS : TURN_SECONDS;
  const animation = Math.min(MAX_ANIMATION_SECONDS * 1000, animationMs(events) * 1.5);
  return nowMs + base * 1000 + Math.ceil(animation);
}

/** Bots' names in classmates games: "Pilot Kea" and friends. */
export const LIVE_BOT_CALLSIGNS = ['Kea', 'Tūī', 'Weka', 'Kererū'];

/** Whose page sends "time's up", and how long after the deadline (so normally only one does). */
export function timesUpDelayMs(game: LiveGame, mySeat: number): number {
  const n = game.seats.length;
  const turn = game.state.turn;
  if (mySeat === turn) return 8000;
  // The next student after the one whose turn it is goes first, then the others.
  let order = 0;
  for (let k = 1; k < n; k++) {
    const seat = (turn + k) % n;
    if (game.seats[seat].bot || game.seats[seat].autopilot) continue;
    if (seat === mySeat) break;
    order++;
  }
  return 500 + order * 3000;
}

/** Checks a setup from outside (the browser). Null if it isn't one. */
export function parseLiveSetup(input: unknown): LiveSetup | null {
  if (typeof input !== 'object' || input === null) return null;
  const s = input as Record<string, unknown>;
  const board = parseBoard(s.board);
  const settings = parseSettings(s.settings);
  return board && settings ? { board, settings } : null;
}
