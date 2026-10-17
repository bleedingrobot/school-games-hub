/**
 * Power Clash against a bot, as a game that can be replayed.
 *
 * The screen and the server both play a bot game through this file, so they can't
 * disagree. Everything the bot does comes from the seed: its three powers, and (for each
 * of its moves) a random source made from the seed and the number of the move. So the only
 * thing a game needs to remember is what the student did, written as short text:
 *
 *   "place:4"            put a symbol on square 4
 *   "power:freeze-ray:7" use a power (targets after the second colon, separated by commas)
 *   "power:body-swap"
 *   "skip"               miss a go (only when every empty square is frozen)
 *   "next"               start the next round (after a round that didn't end the match)
 *
 * Rounds alternate who starts; the student is X or O for the whole match, and X starts round 1.
 * Random powers (Portal Chaos, Wild Card) and Chaos Mode surprises take their dice from the seed too:
 * action number N uses `seed:roll:N`.
 */
import type { BotLevel } from '../botGame';
import { randomFromSeed } from '../space/random';
import { chooseAction, chooseLoadout } from './bot';
import { validLoadout, play, POWER_IDS } from './engine';
import { newMatch, nextRound, scoreRound, type Match } from './match';
import type { Action, GameEvent, Player, PowerId } from './types';

export type StudentAction = string;

export interface SoloSetup {
  seed: string;
  level: BotLevel;
  /** The student's side for the whole match. */
  side: Player;
  /** The student's three powers. */
  loadout: PowerId[];
  /** Chaos Mode: a surprise after every third go. */
  chaos?: boolean;
}

/** What the student did in a match, for the badges. */
export interface PowerClashStats {
  /** How many of their powers the student used. */
  powersUsed: number;
  /** Rounds the student won on a turn where they played Body Swap. */
  bodySwapWins: number;
  /** Won the whole match without using a power. */
  noPowerWin: boolean;
  roundsWon: number;
  roundsLost: number;
  roundsDrawn: number;
}

export interface SoloGame {
  setup: SoloSetup;
  match: Match;
  /** How many moves the bot has made (each one has its own random source). */
  botMoves: number;
  studentMoves: number;
  /** How many actions have been played so far; each one gets its own dice from the seed (`seed:roll:N`). */
  rolls: number;
  stats: PowerClashStats;
}

/** The bot's three powers for this game: a pure function of the seed and level. */
export function botLoadoutFor(seed: string, level: BotLevel): PowerId[] {
  return chooseLoadout(level, randomFromSeed(`${seed}:powers`));
}

export const botSide = (setup: Pick<SoloSetup, 'side'>): Player => (setup.side === 'X' ? 'O' : 'X');

export function startSolo(setup: SoloSetup): SoloGame {
  if (!validLoadout(setup.loadout)) throw new Error('The student needs three different powers');
  const bot = botLoadoutFor(setup.seed, setup.level);
  const loadouts = { X: setup.side === 'X' ? setup.loadout : bot, O: setup.side === 'O' ? setup.loadout : bot };
  return {
    setup,
    match: newMatch(loadouts, 'X', setup.chaos === true),
    botMoves: 0,
    studentMoves: 0,
    rolls: 0,
    stats: { powersUsed: 0, bodySwapWins: 0, noPowerWin: false, roundsWon: 0, roundsLost: 0, roundsDrawn: 0 },
  };
}

export const isStudentTurn = (solo: SoloGame) =>
  solo.match.state.status === 'active' && solo.match.state.active === solo.setup.side;
export const isBotTurn = (solo: SoloGame) =>
  solo.match.state.status === 'active' && solo.match.state.active === botSide(solo.setup);
export const roundIsOver = (solo: SoloGame) => solo.match.state.status !== 'active';
export const matchIsOver = (solo: SoloGame) => solo.match.winner !== null;

/** Does the round end between these two states (and how, for the stats)? */
function noteRound(solo: SoloGame, mover: Player, powerThisTurn: PowerId | null) {
  const { status } = solo.match.state;
  if (status === 'active' || solo.match.counted === false) return;
  const side = solo.setup.side;
  if (status === 'draw') solo.stats.roundsDrawn++;
  else if (status === side) {
    solo.stats.roundsWon++;
    if (mover === side && powerThisTurn === 'body-swap') solo.stats.bodySwapWins++;
  } else solo.stats.roundsLost++;
}

/** Plays one action for whoever's turn it is, and keeps the score and stats. Throws if it isn't legal. */
function applyAction(solo: SoloGame, action: Action): GameEvent[] {
  const before = solo.match.state;
  // Portal Chaos, Wild Card and Chaos Mode surprises roll their dice from the seed, so a replay lands the same way.
  const result = play(before, action, randomFromSeed(`${solo.setup.seed}:roll:${solo.rolls}`));
  if (!result.ok) throw new Error(result.reason);
  solo.rolls++;
  const mover = before.active;
  const countedBefore = solo.match.counted;
  solo.match = scoreRound({ ...solo.match, state: result.state });
  if (action.type === 'use-power' && mover === solo.setup.side) solo.stats.powersUsed++;
  // A Time Heist gives the other player back the power they used in the go it undid: it doesn't count as used.
  if (action.type === 'use-power' && action.power === 'time-heist' && mover !== solo.setup.side) {
    const back = before.used[solo.setup.side].length - result.state.used[solo.setup.side].length;
    solo.stats.powersUsed = Math.max(0, solo.stats.powersUsed - back);
  }
  if (!countedBefore && solo.match.counted) {
    noteRound(solo, mover, result.state.powerThisTurn);
    if (solo.match.winner === solo.setup.side && solo.stats.powersUsed === 0) solo.stats.noPowerWin = true;
  }
  return result.events;
}

/** The student's action text, as the action the engine understands. Null if it isn't well made. */
export function parseStudentAction(text: string): Action | 'next' | null {
  if (text === 'next') return 'next';
  if (text === 'skip') return { type: 'skip' };
  const place = /^place:([0-8])$/.exec(text);
  if (place) return { type: 'place', square: Number(place[1]) };
  const use = /^power:([a-z-]{1,20})(?::([0-8](?:,[0-8]){0,1}))?$/.exec(text);
  if (use && POWER_IDS.includes(use[1] as PowerId)) {
    return { type: 'use-power', power: use[1] as PowerId, targets: use[2] ? use[2].split(',').map(Number) : [] };
  }
  return null;
}

/** The opposite of parseStudentAction. */
export function encodeStudentAction(action: Action | 'next'): string {
  if (action === 'next') return 'next';
  if (action.type === 'skip') return 'skip';
  if (action.type === 'place') return `place:${action.square}`;
  return action.targets.length ? `power:${action.power}:${action.targets.join(',')}` : `power:${action.power}`;
}

/** Applies what the student did. Throws (with a reason a student can read) if it isn't allowed. */
export function applyStudent(solo: SoloGame, text: StudentAction): GameEvent[] {
  const parsed = parseStudentAction(text);
  if (!parsed) throw new Error('That move could not be read');
  if (matchIsOver(solo)) throw new Error('The match is over');
  if (parsed === 'next') {
    if (!roundIsOver(solo)) throw new Error('The round is not over yet');
    solo.match = nextRound(solo.match);
    return [];
  }
  if (!isStudentTurn(solo)) throw new Error('It is not your turn');
  const events = applyAction(solo, parsed);
  solo.studentMoves++;
  return events;
}

/** The bot's next action, without playing it (the screen shows its "thinking" first). */
export function pickBotAction(solo: SoloGame): Action | null {
  if (!isBotTurn(solo)) return null;
  return chooseAction(solo.match.state, solo.setup.level, randomFromSeed(`${solo.setup.seed}:move:${solo.botMoves}`));
}

/** Plays the bot's move, if it's the bot's turn. Null if not. */
export function playOneBot(solo: SoloGame): { action: Action; events: GameEvent[] } | null {
  const action = pickBotAction(solo);
  if (!action) return null;
  const events = applyAction(solo, action);
  solo.botMoves++;
  return { action, events };
}

// ---------- Replay (the server, and the tests) ----------

export type Replayed =
  | { ok: true; solo: SoloGame; finished: boolean }
  | { ok: false; reason: string };

/**
 * Plays a whole game from its setup and the student's actions. The bot moves whenever it's
 * its turn. Fails on anything the rules don't allow, or any action left over after the
 * match is over.
 */
export function replaySolo(setup: SoloSetup, actions: StudentAction[]): Replayed {
  let solo: SoloGame;
  try {
    solo = startSolo(setup);
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'bad setup' };
  }
  const runBot = () => {
    for (let guard = 0; guard < 200 && playOneBot(solo); guard++);
  };
  runBot();
  for (const [i, text] of actions.entries()) {
    try {
      applyStudent(solo, text);
      runBot();
    } catch (error) {
      return { ok: false, reason: `action ${i + 1}: ${error instanceof Error ? error.message : 'not allowed'}` };
    }
  }
  return { ok: true, solo, finished: matchIsOver(solo) };
}
