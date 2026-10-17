/**
 * Plays lots of all-bot Power Clash matches and reports who wins, how long matches last and
 * how long the bot thinks. Used by the tests ("Medium beats Easy") and by
 * `npm run power-clash:sim`, whose numbers are in docs/POWER-CLASH-PLAN.md.
 *
 * Each match is two bots: one is X and one is O, and they swap sides from match to match.
 * Round starters alternate inside a match as usual, so each bot starts half the rounds.
 */
import type { BotLevel } from '../botGame';
import { randomFromSeed } from '../space/random';
import { chooseAction, chooseLoadout } from './bot';
import { play } from './engine';
import { newMatch, nextRound, scoreRound } from './match';
import type { Player, PowerId } from './types';

export interface SimOptions {
  /** The two levels; `a` is X in even-numbered matches and O in odd ones. */
  a: BotLevel;
  b: BotLevel;
  matches: number;
  seed: string;
  /** Chaos Mode: a surprise every third go. */
  chaos?: boolean;
  /** Override the powers instead of letting each level choose (for picking Medium's set). */
  powers?: { a?: PowerId[]; b?: PowerId[] };
}

export interface SimReport {
  matches: number;
  /** Rounds won by a / b / drawn. */
  rounds: { a: number; b: number; draws: number };
  matchWins: { a: number; b: number };
  /** Share of decided rounds that `a` won. */
  aRoundShare: number;
  /** Actions (placing, powers, skips) a bot takes in a match, on average. */
  actionsPerMatch: { a: number; b: number };
  roundsPerMatch: number;
  /** Most positions-worth of thinking: the slowest single decision, in milliseconds. */
  slowestMs: number;
  meanMs: number;
}

export function simulate(options: SimOptions): SimReport {
  const rounds = { a: 0, b: 0, draws: 0 };
  const matchWins = { a: 0, b: 0 };
  const actions = { a: 0, b: 0 };
  let roundsTotal = 0;
  let slowest = 0;
  let totalMs = 0;
  let decisions = 0;

  for (let m = 0; m < options.matches; m++) {
    const random = randomFromSeed(`${options.seed}:${m}`);
    const aSide: Player = m % 2 === 0 ? 'X' : 'O';
    const sideOf = { a: aSide, b: aSide === 'X' ? 'O' : 'X' } as const;
    const loadout = {
      [sideOf.a]: options.powers?.a ?? chooseLoadout(options.a, random),
      [sideOf.b]: options.powers?.b ?? chooseLoadout(options.b, random),
    } as Record<Player, PowerId[]>;
    const levelOf = { [sideOf.a]: options.a, [sideOf.b]: options.b } as Record<Player, BotLevel>;
    let match = newMatch(loadout, 'X', options.chaos);
    let n = 0;
    while (match.winner === null && n < 400) {
      const state = match.state;
      if (state.status !== 'active') {
        match = nextRound(match);
        continue;
      }
      const t0 = performance.now();
      const action = chooseAction(state, levelOf[state.active], random);
      const ms = performance.now() - t0;
      slowest = Math.max(slowest, ms);
      totalMs += ms;
      decisions++;
      const result = play(state, action, random);
      if (!result.ok) throw new Error(`Bot made an illegal move: ${result.reason}`);
      actions[state.active === sideOf.a ? 'a' : 'b']++;
      match = scoreRound({ ...match, state: result.state });
      n++;
    }
    roundsTotal += match.round;
    const aWon = match.score[sideOf.a];
    const bWon = match.score[sideOf.b];
    rounds.a += aWon;
    rounds.b += bWon;
    rounds.draws += match.draws;
    if (match.winner === sideOf.a) matchWins.a++;
    else if (match.winner === sideOf.b) matchWins.b++;
  }
  const decided = rounds.a + rounds.b;
  return {
    matches: options.matches,
    rounds,
    matchWins,
    aRoundShare: decided ? rounds.a / decided : 0,
    actionsPerMatch: { a: actions.a / options.matches, b: actions.b / options.matches },
    roundsPerMatch: roundsTotal / options.matches,
    slowestMs: slowest,
    meanMs: decisions ? totalMs / decisions : 0,
  };
}
