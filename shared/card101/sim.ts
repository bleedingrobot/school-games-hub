/**
 * Plays lots of all-bot games of 101 and reports what happened: how long games last,
 * who wins, how often things happen. Used by the tests ("Medium beats Easy") and by
 * `npm run 101:sim`, whose summary is in docs/101-PLAN.md.
 *
 * Every seat is a bot, each seeing only its own view, exactly as in a real game.
 */
import type { BotLevel } from '../botGame';
import { decide, newMemory, observe, type BotMemory } from './bot';
import { newGame, play, type Action, type Actor, type Game, type GameEvent, type Settings } from './engine';
import { randomFromSeed, seededDice } from './random';
import { eventsFor, viewFor } from './view';

/** Rough seconds for a student's turn, the peek and the scoring show (for the time estimate). */
export const SECONDS_PER_TURN = 8;
export const SECONDS_PER_ROUND = 25;

export interface SimOptions {
  /** One level per seat (2 to 4 seats). */
  levels: BotLevel[];
  games: number;
  seed: string;
  settings: Settings;
}

interface Spread {
  mean: number;
  p95: number;
  max: number;
}

export interface SimReport {
  games: number;
  rounds: Spread;
  turns: Spread;
  turnsPerRound: number;
  /** Minutes if every seat were a student (a classmates game). */
  minutes: Spread;
  /** Share of games each seat won (ties count for each winner). */
  winsBySeat: number[];
  /** Share of wins that were shared. */
  sharedWins: number;
  averageHand: number;
  zeroHands: number;
  /** How often the knocker had the lowest hand (or tied it). */
  knockerWon: number;
  reshufflesPerGame: number;
  /** Rounds that ended because only one player was left (never in all-bot games). */
  longestRound: number;
}

const spread = (values: number[]): Spread => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    mean: values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1),
    p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
  };
};

/** Plays one all-bot game to the end. */
export function playBotGame(levels: BotLevel[], settings: Settings, seed: string): { game: Game; turns: number; reshuffles: number; longestRound: number } {
  const dice = seededDice(`${seed}:deck`);
  let { game, events } = newGame(levels.length, settings, dice);
  let memories: BotMemory[] = levels.map((_, seat) => newMemory(seat, levels.length));
  let decisions = 0;
  let turns = 0;
  let reshuffles = 0;
  let roundTurns = 0;
  let longestRound = 0;
  const tell = (evs: GameEvent[]) => {
    memories = memories.map((m, seat) => observe(m, viewFor(game, seat), eventsFor(evs, seat, game)));
    for (const e of evs) {
      if (e.kind === 'reshuffle') reshuffles += 1;
      if (e.kind === 'turn' || e.kind === 'round-end') {
        turns += 1;
        roundTurns += 1;
      }
      if (e.kind === 'round-end') {
        longestRound = Math.max(longestRound, roundTurns);
        roundTurns = 0;
      }
    }
  };
  tell(events);
  for (let guard = 0; game.phase !== 'over'; guard++) {
    if (guard > 50_000) throw new Error(`A simulated game never ended (${seed})`);
    let actor: Actor;
    let action: Action;
    if (game.phase === 'round-over') {
      actor = 'system';
      action = { type: 'next-round' };
    } else if (game.phase === 'peek') {
      actor = game.peeked.findIndex((done) => !done);
      action = { type: 'peek-done' };
    } else {
      actor = game.turn;
      action = decide(viewFor(game, actor), memories[actor], levels[actor], randomFromSeed(`${seed}:bot:${decisions++}`));
    }
    ({ game, events } = play(game, actor, action, dice));
    tell(events);
  }
  return { game, turns, reshuffles, longestRound };
}

export function simulate(options: SimOptions): SimReport {
  const rounds: number[] = [];
  const turns: number[] = [];
  const minutes: number[] = [];
  const winsBySeat = options.levels.map(() => 0);
  let shared = 0;
  let hands = 0;
  let handTotal = 0;
  let zeroHands = 0;
  let knocks = 0;
  let knockerWon = 0;
  let reshuffles = 0;
  let longestRound = 0;

  for (let n = 0; n < options.games; n++) {
    const result = playBotGame(options.levels, options.settings, `${options.seed}:${n}`);
    const g = result.game;
    rounds.push(g.results.length);
    turns.push(result.turns);
    minutes.push((result.turns * SECONDS_PER_TURN + g.results.length * SECONDS_PER_ROUND) / 60);
    for (const w of g.winners!) winsBySeat[w] += 1;
    if (g.winners!.length > 1) shared += 1;
    reshuffles += result.reshuffles;
    longestRound = Math.max(longestRound, result.longestRound);
    for (const r of g.results) {
      for (const s of r.scores) {
        if (!s) continue;
        hands += 1;
        handTotal += s.total;
        if (s.total === 0) zeroHands += 1;
      }
      if (r.knocker !== null) {
        knocks += 1;
        if (r.winners.includes(r.knocker)) knockerWon += 1;
      }
    }
  }

  const totalRounds = rounds.reduce((a, b) => a + b, 0);
  return {
    games: options.games,
    rounds: spread(rounds),
    turns: spread(turns),
    turnsPerRound: turns.reduce((a, b) => a + b, 0) / Math.max(totalRounds, 1),
    minutes: spread(minutes),
    winsBySeat: winsBySeat.map((w) => w / options.games),
    sharedWins: shared / options.games,
    averageHand: handTotal / Math.max(hands, 1),
    zeroHands: zeroHands / Math.max(hands, 1),
    knockerWon: knockerWon / Math.max(knocks, 1),
    reshufflesPerGame: reshuffles / options.games,
    longestRound,
  };
}
