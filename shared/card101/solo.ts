/**
 * 101 against bots. The server hands out a stamped seed (as for the space game); the
 * browser plays the whole game from it; at the end it sends the seed and the student's
 * own actions, and the server replays the game here with `replaySolo`.
 *
 * The shuffles come from the seed, and so does every bot decision (each one gets its own
 * numbers, `seed:bot:<n>`), so a Web Worker, the page and the server all get the same
 * game. Only the student's actions need sending, and a made-up result can't match.
 *
 * The student is always seat 0 (the bottom of the screen). Who starts is shuffled.
 */
import type { BotLevel } from '../botGame';
import { decide, newMemory, observe, type BotMemory } from './bot';
import { isSlot, type Slot } from './cards';
import { newGame, play, RuleError, type Action, type Actor, type Game, type GameEvent, type Settings } from './engine';
import { randomFromSeed, seededDice, type Dice } from './random';
import { eventsFor, viewFor } from './view';

export const STUDENT_SEAT = 0;

export interface SoloSetup {
  seed: string;
  /** 1 to 3 bots. */
  bots: number;
  level: BotLevel;
  settings: Settings;
}

export interface SoloGame {
  setup: SoloSetup;
  game: Game;
  dice: Dice;
  /** Each bot's memory (null for the student's seat). */
  memories: (BotMemory | null)[];
  /** How many bot decisions so far (each one gets its own random numbers). */
  decisions: number;
}

/** What the student can send. Short text, so a saved game is small. */
export type StudentAction = 'peek' | 'draw:stack' | 'draw:discard' | `swap:${Slot}` | 'throw' | 'knock' | 'next' | 'leave';

export function parseStudentAction(text: unknown): { actor: Actor; action: Action } | null {
  switch (text) {
    case 'peek': return { actor: STUDENT_SEAT, action: { type: 'peek-done' } };
    case 'draw:stack': return { actor: STUDENT_SEAT, action: { type: 'draw', from: 'stack' } };
    case 'draw:discard': return { actor: STUDENT_SEAT, action: { type: 'draw', from: 'discard' } };
    case 'throw': return { actor: STUDENT_SEAT, action: { type: 'throw' } };
    case 'knock': return { actor: STUDENT_SEAT, action: { type: 'knock' } };
    case 'leave': return { actor: STUDENT_SEAT, action: { type: 'leave' } };
    // Dealing the next round is the referee's job; in a bot game the student says when.
    case 'next': return { actor: 'system', action: { type: 'next-round' } };
    default: {
      if (typeof text !== 'string' || !text.startsWith('swap:')) return null;
      const slot = Number(text.slice(5));
      return isSlot(slot) && text === `swap:${slot}` ? { actor: STUDENT_SEAT, action: { type: 'swap', slot } } : null;
    }
  }
}

export function startSolo(setup: SoloSetup): { solo: SoloGame; events: GameEvent[] } {
  if (!Number.isInteger(setup.bots) || setup.bots < 1 || setup.bots > 3) throw new RuleError('1 to 3 bots');
  const dice = seededDice(`${setup.seed}:deck`);
  const { game, events } = newGame(setup.bots + 1, setup.settings, dice);
  const solo: SoloGame = {
    setup,
    game,
    dice,
    memories: Array.from({ length: game.players }, (_, seat) => (seat === STUDENT_SEAT ? null : newMemory(seat, game.players))),
    decisions: 0,
  };
  tellBots(solo, events);
  return { solo, events: eventsFor(events, STUDENT_SEAT, game) };
}

/** Plays one action and shows every bot what its seat saw. Returns the student's events. */
export function applySolo(solo: SoloGame, actor: Actor, action: Action): GameEvent[] {
  const { game, events } = play(solo.game, actor, action, solo.dice);
  solo.game = game;
  tellBots(solo, events);
  return eventsFor(events, STUDENT_SEAT, game);
}

function tellBots(solo: SoloGame, events: GameEvent[]): void {
  solo.memories = solo.memories.map((memory, seat) =>
    memory ? observe(memory, viewFor(solo.game, seat), eventsFor(events, seat, solo.game)) : null,
  );
}

/** The next thing a bot wants to do, or null when it's the student's move (or between rounds). */
export function nextBotMove(solo: SoloGame): { seat: number; action: Action } | null {
  const g = solo.game;
  if (g.phase === 'peek') {
    const seat = solo.memories.findIndex((m, s) => m && !g.out[s] && !g.peeked[s]);
    return seat >= 0 ? { seat, action: { type: 'peek-done' } } : null;
  }
  if (g.phase !== 'play' || g.turn === STUDENT_SEAT) return null;
  const random = randomFromSeed(`${solo.setup.seed}:bot:${solo.decisions}`);
  const action = decide(viewFor(g, g.turn), solo.memories[g.turn]!, solo.setup.level, random);
  return { seat: g.turn, action };
}

/** Plays bot moves until the student has to act. `onEvents` gets the student's events after each one. */
export function playBots(solo: SoloGame, onEvents?: (events: GameEvent[], seat: number) => void): void {
  for (let guard = 0; ; guard++) {
    if (guard > 5000) throw new Error('Bots never finished their turns');
    const move = nextBotMove(solo);
    if (!move) return;
    if (move.action.type !== 'peek-done') solo.decisions += 1;
    const events = applySolo(solo, move.seat, move.action);
    onEvents?.(events, move.seat);
  }
}

/** The most student actions a real game could need. */
export const MAX_STUDENT_ACTIONS = 3000;

export type ReplayResult =
  | { ok: true; game: Game; studentTurns: number; rounds: number; finished: boolean; left: boolean }
  | { ok: false; reason: string };

/** Replays a saved bot game from its seed and the student's actions (for the server). */
export function replaySolo(setup: SoloSetup, actions: readonly unknown[]): ReplayResult {
  if (!Array.isArray(actions) || actions.length > MAX_STUDENT_ACTIONS) return { ok: false, reason: 'Too many moves' };
  let solo: SoloGame;
  try {
    solo = startSolo(setup).solo;
    playBots(solo);
  } catch (error) {
    return { ok: false, reason: error instanceof RuleError ? error.message : 'Bad game' };
  }
  let studentTurns = 0;
  let left = false;
  for (const text of actions) {
    const parsed = parseStudentAction(text);
    if (!parsed) return { ok: false, reason: 'Unknown move' };
    try {
      applySolo(solo, parsed.actor, parsed.action);
      // A turn ends with a swap, a throw or a knock.
      if (['swap', 'throw', 'knock'].includes(parsed.action.type)) studentTurns += 1;
      if (parsed.action.type === 'leave') left = true;
      playBots(solo);
    } catch (error) {
      return { ok: false, reason: error instanceof RuleError ? error.message : 'Bad game' };
    }
  }
  const g = solo.game;
  const rounds = g.results.length;
  return { ok: true, game: g, studentTurns, rounds, finished: g.phase === 'over', left };
}
