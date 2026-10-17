/**
 * Games against bots. The server hands out a stamped seed; the browser plays the whole
 * game from it; at the end it sends the seed and the student's own actions, and the
 * server replays the game here. The dice, the turn order and every bot decision come from
 * the seed, so only the student's actions need sending, and a made-up result can't match.
 */
import type { BotLevel } from '../botGame';
import { botAction } from './bot';
import { boardFor, type BoardChoice } from './boards';
import { newGame, play, SpaceRuleError, type Settings, type SpaceAction, type SpaceEvent, type SpaceState } from './engine';
import { randomFromSeed, seededDice, type Dice } from './random';

export interface SoloSetup {
  seed: string;
  board: BoardChoice;
  settings: Settings;
  /** 1 to 3 bots. */
  bots: number;
  level: BotLevel;
}

export interface SoloGame {
  state: SpaceState;
  events: SpaceEvent[];
  /** Which seat the student is in (turn order is shuffled from the seed). */
  studentSeat: number;
  dice: Dice;
  botRandom: () => number;
}

/** Starts a bot game from its setup. */
export function startSolo(setup: SoloSetup): SoloGame {
  const players = setup.bots + 1;
  const { state, events } = newGame(boardFor(setup.board), setup.settings, players);
  return {
    state,
    events,
    studentSeat: seededDice(`${setup.seed}:order`)(players) - 1,
    dice: seededDice(`${setup.seed}:dice`),
    botRandom: randomFromSeed(`${setup.seed}:bots`),
  };
}

/** Plays bot turns until it's the student's turn or the game is over. */
export function playBots(game: SoloGame, level: BotLevel, onEvents?: (events: SpaceEvent[]) => void): void {
  for (let guard = 0; game.state.phase !== 'over' && game.state.turn !== game.studentSeat; guard++) {
    if (guard > 10_000) throw new Error('Bots never finished their turns');
    const { state, events } = play(game.state, botAction(game.state, level, game.botRandom), game.dice);
    game.state = state;
    game.events.push(...events);
    onEvents?.(events);
  }
}

/** The most student actions a real game could need (a long game is ~200). */
export const MAX_STUDENT_ACTIONS = 2000;

export type ReplayResult =
  | { ok: true; state: SpaceState; studentSeat: number; studentTurns: number; finished: boolean }
  | { ok: false; reason: string };

/**
 * Replays a bot game exactly. Fails if any action is against the rules or left over.
 * `onEvents` sees every event, in order, from the start of the game.
 */
export function replaySolo(
  setup: SoloSetup,
  actions: readonly SpaceAction[],
  onEvents?: (events: SpaceEvent[]) => void,
  /** Sees each student action with the state just before it (to check maths answers). Throws to refuse it. */
  onAction?: (before: SpaceState, action: SpaceAction) => void,
): ReplayResult {
  if (actions.length > MAX_STUDENT_ACTIONS) return { ok: false, reason: 'too many actions' };
  let game: SoloGame;
  try {
    game = startSolo(setup);
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'bad setup' };
  }
  let studentTurns = 0;
  onEvents?.(game.events);
  try {
    playBots(game, setup.level, onEvents);
    for (const action of actions) {
      if (game.state.phase === 'over') return { ok: false, reason: 'actions after the game ended' };
      const before = game.state.turnsTaken;
      onAction?.(game.state, action);
      const { state, events } = play(game.state, action, game.dice);
      game.state = state;
      onEvents?.(events);
      if (game.state.turnsTaken > before || game.state.phase === 'over') studentTurns++;
      playBots(game, setup.level, onEvents);
    }
  } catch (error) {
    if (error instanceof SpaceRuleError) return { ok: false, reason: `an action broke the rules: ${error.message}` };
    throw error;
  }
  return { ok: true, state: game.state, studentSeat: game.studentSeat, studentTurns, finished: game.state.phase === 'over' };
}
