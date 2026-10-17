/**
 * A Wormholes & Black Holes game against bots, played in the browser from a seed.
 *
 * It plays exactly the way `replaySolo` (shared/space/replay.ts) replays a game, so the
 * server can check it in Stage 9.3: the same seeded dice, the same turn order, and bot
 * decisions from the same seeded stream. The bots think in a Web Worker, which can't share
 * the page's random stream, so a bot decision is worked out from the seed plus how many
 * numbers the bots have used so far (`botDraws`). That gives the same numbers as one
 * long stream.
 */
import type { BotLevel } from '../../../shared/botGame';
import { botAction } from '../../../shared/space/bot';
import { play, type SpaceAction, type SpaceEvent, type SpaceState } from '../../../shared/space/engine';
import { boardFor } from '../../../shared/space/boards';
import { newGame } from '../../../shared/space/engine';
import { randomFromSeed, seededDice, type Dice } from '../../../shared/space/random';
import { startSolo, type SoloSetup } from '../../../shared/space/replay';
import type { SpaceMathsAnswer } from '../../../shared/space/save';

export interface SoloRun {
  setup: SoloSetup;
  state: SpaceState;
  studentSeat: number;
  dice: Dice;
  /** How many random numbers the bots have used so far. */
  botDraws: number;
  /** Everything the student did, in order: what Stage 9.3 sends to the server. */
  studentActions: SpaceAction[];
  /** Pass-and-play: every seat is a person sharing this device, and there are no bots. */
  passAndPlay: boolean;
  /** Mission Control maths answers the student gave, in order (saved with the game). */
  mathsAnswers: SpaceMathsAnswer[];
}

/** A fresh seed for a game played on this device. */
export function newSeed(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `local-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export function startRun(setup: SoloSetup): { run: SoloRun; events: SpaceEvent[] } {
  const game = startSolo(setup);
  return {
    run: { setup, state: game.state, studentSeat: game.studentSeat, dice: game.dice, botDraws: 0, studentActions: [], passAndPlay: false, mathsAnswers: [] },
    events: game.events,
  };
}

/**
 * Pass-and-play: 2–4 people take turns on one device. Seat 0 goes first. Never saved, so
 * the seed is only for the dice.
 */
export function startPassRun(setup: Omit<SoloSetup, 'bots' | 'level'>, players: number): { run: SoloRun; events: SpaceEvent[] } {
  const { state, events } = newGame(boardFor(setup.board), setup.settings, players);
  return {
    run: {
      setup: { ...setup, bots: 0, level: 'very-easy' },
      state,
      studentSeat: 0,
      dice: seededDice(`${setup.seed}:dice`),
      botDraws: 0,
      studentActions: [],
      passAndPlay: true,
      mathsAnswers: [],
    },
    events,
  };
}

/** True when a person (not a bot) is to move. */
export const isStudentsTurn = (run: SoloRun) =>
  run.state.phase !== 'over' && (run.passAndPlay || run.state.turn === run.studentSeat);

/** Plays the student's action. Throws SpaceRuleError (with a message for the student) if it's not allowed. */
export function studentPlay(run: SoloRun, action: SpaceAction): SpaceEvent[] {
  if (!isStudentsTurn(run)) throw new Error('Not the student’s turn');
  const { state, events } = play(run.state, action, run.dice);
  run.state = state;
  run.studentActions.push(action);
  return events;
}

/** What a bot needs to decide its move: everything is plain data, so it can go to a worker. */
export interface BotQuestion {
  state: SpaceState;
  level: BotLevel;
  seed: string;
  draws: number;
}

export interface BotAnswer {
  action: SpaceAction;
  draws: number;
}

export function botQuestion(run: SoloRun): BotQuestion {
  return { state: run.state, level: run.setup.level, seed: run.setup.seed, draws: run.botDraws };
}

/** A bot's decision. The same question always gets the same answer, in a worker or on the page. */
export function decideBot(question: BotQuestion): BotAnswer {
  const stream = randomFromSeed(`${question.seed}:bots`);
  for (let i = 0; i < question.draws; i++) stream();
  let used = 0;
  const action = botAction(question.state, question.level, () => {
    used++;
    return stream();
  });
  return { action, draws: question.draws + used };
}

/** Plays a bot's decision. */
export function botPlay(run: SoloRun, answer: BotAnswer): SpaceEvent[] {
  if (run.state.phase === 'over' || isStudentsTurn(run)) throw new Error('Not a bot’s turn');
  const { state, events } = play(run.state, answer.action, run.dice);
  run.state = state;
  run.botDraws = answer.draws;
  return events;
}
