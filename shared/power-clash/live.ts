/**
 * Power Clash with a classmate. Shared by the `power-clash` server function and the website.
 *
 * The server is the referee: the browser only ever says "place on 4" or "use Freeze Ray on 7".
 * This file holds the part with no network and no clock, so it can be tested on its own and
 * so the screen and the server can't disagree: it plays an action through the same rules
 * engine (engine.ts) and the same match scoring (match.ts) the bot and pass-and-play games
 * use, keeps the stats the badges need, and works out the clock and the result.
 *
 * Seats: seat 0 plays X, seat 1 plays O, for the whole match. X starts round 1 and the starter
 * alternates by round. A rematch swaps who is X. Nothing is hidden in this game, so the whole
 * state goes to both players.
 *
 * Clocks (plan section 5): 60 seconds a turn and 30 to press Next between rounds, plus time
 * for the animations. A turn that runs out is a skipped placement (never a loss by itself).
 * Three in a row by the same player ends the game as abandoned, and it earns nobody anything.
 */
import { LOADOUT_SIZE, POWER_IDS, play, timeoutTurn, validLoadout } from './engine';
import { newMatch, nextRound, scoreRound, type Match } from './match';
import type { PowerClashStats } from './solo';
import type { Action, GameEvent, Player, PowerId } from './types';

export const TURN_MS = 60_000;
export const NEXT_ROUND_MS = 30_000;
/** The server waits this long past a deadline before it lets a page ask for the time-out. */
export const GRACE_MS = 1_500;
/** This many timed-out turns in a row by one player and the game ends, abandoned. */
export const TIMEOUTS_TO_ABANDON = 3;
/** A game with no real move for this long is ended by the tidy-up job (in the database). */
export const IDLE_MINUTES = 10;
/** Two players, always. */
export const SEATS = 2;

/** Everything the server keeps about a running game, apart from who is sitting where. */
export interface LiveGame {
  match: Match;
  /** By seat (0 = X, 1 = O). */
  stats: [PowerClashStats, PowerClashStats];
  /** Timed-out turns in a row, by seat. A real move resets it. */
  timeouts: [number, number];
  /** Between rounds: who has pressed Next, by seat. */
  ready: [boolean, boolean];
}

/** Thrown for anything the rules don't allow. The message is written for students. */
export class LiveRuleError extends Error {}

export const sideOf = (seat: number): Player => (seat === 0 ? 'X' : 'O');
export const seatOf = (side: Player): number => (side === 'X' ? 0 : 1);

const freshStats = (): PowerClashStats => ({ powersUsed: 0, bodySwapWins: 0, noPowerWin: false, roundsWon: 0, roundsLost: 0, roundsDrawn: 0 });

/** A power list from outside (the browser): exactly three different powers, or null. */
export function parseLoadout(input: unknown): PowerId[] | null {
  if (!Array.isArray(input) || input.length !== LOADOUT_SIZE) return null;
  if (!input.every((p) => POWER_IDS.includes(p as PowerId))) return null;
  const powers = input as PowerId[];
  return validLoadout(powers) ? powers : null;
}

/** Round one of a new match. `x` and `o` are the powers of the seat-0 and seat-1 players. */
export function newLiveGame(x: PowerId[], o: PowerId[]): LiveGame {
  return { match: newMatch({ X: x, O: o }, 'X'), stats: [freshStats(), freshStats()], timeouts: [0, 0], ready: [false, false] };
}

const copy = (game: LiveGame): LiveGame => ({
  match: game.match,
  stats: [{ ...game.stats[0] }, { ...game.stats[1] }],
  timeouts: [game.timeouts[0], game.timeouts[1]],
  ready: [game.ready[0], game.ready[1]],
});

export const roundIsOver = (game: LiveGame) => game.match.state.status !== 'active';
export const matchIsOver = (game: LiveGame) => game.match.winner !== null;
/** Whose turn it is, as a seat. Meaningful while the round is active. */
export const turnSeat = (game: LiveGame) => seatOf(game.match.state.active);

/** Adds the result of a round that has just ended to both players' stats. */
function noteRound(game: LiveGame, mover: Player, powerThisTurn: PowerId | null) {
  const { status } = game.match.state;
  if (status === 'active') return;
  if (status === 'draw') {
    game.stats[0].roundsDrawn++;
    game.stats[1].roundsDrawn++;
    return;
  }
  const winner = seatOf(status);
  game.stats[winner].roundsWon++;
  game.stats[1 - winner].roundsLost++;
  if (mover === status && powerThisTurn === 'body-swap') game.stats[winner].bodySwapWins++;
}

/** Plays the engine's result for one action by `mover`, and keeps the score and stats. */
function applyResult(game: LiveGame, mover: Player, action: Action | null, result: { state: Match['state'] }) {
  const countedBefore = game.match.counted;
  game.match = scoreRound({ ...game.match, state: result.state });
  if (action?.type === 'use-power') game.stats[seatOf(mover)].powersUsed++;
  if (!countedBefore && game.match.counted) {
    noteRound(game, mover, result.state.powerThisTurn);
    const winner = game.match.winner;
    if (winner && game.stats[seatOf(winner)].powersUsed === 0) game.stats[seatOf(winner)].noPowerWin = true;
  }
}

export interface Played {
  game: LiveGame;
  events: GameEvent[];
}

/** A player's move. Throws LiveRuleError if it isn't their turn or isn't legal. */
export function playerAction(previous: LiveGame, seat: number, action: Action): Played {
  if (matchIsOver(previous)) throw new LiveRuleError('The match is over.');
  if (roundIsOver(previous)) throw new LiveRuleError('This round is over. Press Next round.');
  if (turnSeat(previous) !== seat) throw new LiveRuleError('It’s not your turn yet.');
  const result = play(previous.match.state, action);
  if (!result.ok) throw new LiveRuleError(result.reason);
  const game = copy(previous);
  applyResult(game, sideOf(seat), action, result);
  game.timeouts[seat] = 0;
  return { game, events: result.events };
}

export interface Pressed extends Played {
  /** True if this press started the next round (both players had pressed). */
  advanced: boolean;
}

/**
 * Between rounds: I have seen the result. When both players have pressed Next the next round
 * starts. Pressing twice is fine. Throws if there is no round to move on from.
 */
export function pressNext(previous: LiveGame, seat: number): Pressed {
  if (matchIsOver(previous)) throw new LiveRuleError('The match is over.');
  if (!roundIsOver(previous)) throw new LiveRuleError('The round isn’t over yet.');
  const game = copy(previous);
  game.ready[seat] = true;
  if (!game.ready[0] || !game.ready[1]) return { game, events: [], advanced: false };
  return { game: dealNext(game), events: [], advanced: true };
}

function dealNext(game: LiveGame): LiveGame {
  return { ...game, match: nextRound(game.match), ready: [false, false] };
}

export interface TimedOut extends Played {
  /** Someone has now missed three turns in a row: the game is over, abandoned. */
  abandoned: boolean;
  /** The seat that timed out (a turn), or null (the pause between rounds ran out). */
  seat: number | null;
}

/** The clock ran out: a skipped placement, or the next round starts by itself. */
export function timeOut(previous: LiveGame): TimedOut {
  if (matchIsOver(previous)) throw new LiveRuleError('The match is over.');
  if (roundIsOver(previous)) {
    return { game: dealNext(copy(previous)), events: [], abandoned: false, seat: null };
  }
  const seat = turnSeat(previous);
  const result = timeoutTurn(previous.match.state);
  if (!result.ok) throw new LiveRuleError(result.reason);
  const game = copy(previous);
  game.match = { ...game.match, state: result.state };
  game.timeouts[seat]++;
  return { game, events: result.events, abandoned: game.timeouts[seat] >= TIMEOUTS_TO_ABANDON, seat };
}

/** Roughly how long the screens take to show these events, in milliseconds. */
export function animationMs(events: readonly GameEvent[]): number {
  let ms = 0;
  for (const e of events) {
    switch (e.kind) {
      case 'place': ms += 600; break;
      case 'double-trouble': ms += 900; break;
      case 'body-swap': ms += 1300; break;
      case 'freeze': ms += 1000; break;
      case 'wipe': ms += 1400; break;
      case 'skip': ms += 700; break;
      case 'win': ms += 2000; break;
      case 'draw': ms += 1500; break;
      case 'thaw': break;
    }
  }
  return Math.min(ms, 6000);
}

/**
 * When the clock should next run out, after a change. `restart` is false for a change that
 * doesn't give anyone new time (someone pressing Next, but not the second): the clock keeps
 * running. A finished match has no clock.
 */
export function deadlineAfter(game: LiveGame, events: readonly GameEvent[], now: number, previous: number | null, restart = true): number | null {
  if (matchIsOver(game)) return null;
  if (!restart && previous !== null) return previous;
  return now + (roundIsOver(game) ? NEXT_ROUND_MS : TURN_MS) + animationMs(events);
}

/** How a game ended and what it earns each seat. */
export interface Outcome {
  /** By seat: this player won the match. */
  won: boolean[];
  /** By seat: the game earns this player points (a finished match; never a game left part-way). */
  counts: boolean[];
  /** By seat, for the badges. */
  stats: PowerClashStats[];
}

export function outcomeOf(game: LiveGame, ending: 'finished' | 'abandoned'): Outcome {
  const finished = ending === 'finished' && game.match.winner !== null;
  return {
    won: [finished && game.match.winner === 'X', finished && game.match.winner === 'O'],
    counts: [finished, finished],
    stats: [{ ...game.stats[0] }, { ...game.stats[1] }],
  };
}

/** True if this value looks like a LiveGame (the database is trusted, but a bad row must not crash the server). */
export function isLiveGame(value: unknown): value is LiveGame {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<LiveGame>;
  return (
    typeof v.match === 'object' && v.match !== null && Array.isArray(v.stats) && v.stats.length === SEATS &&
    Array.isArray(v.timeouts) && v.timeouts.length === SEATS && Array.isArray(v.ready) && v.ready.length === SEATS &&
    (v.match.state.active === 'X' || v.match.state.active === 'O')
  );
}
