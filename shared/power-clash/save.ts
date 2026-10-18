/**
 * Saving a Power Clash game against a bot.
 *
 * It works like 101 (shared/card101/save.ts): before a game the server hands out a seed
 * with a stamp (a signature only the server can make), the browser plays the match from
 * that seed, and at the end it sends the seed, the stamp, the level, both sets of powers
 * and the student's own actions. The server replays the match here with `replaySolo` and
 * saves only what it worked out itself. The bot's powers and every one of its moves come
 * from the seed, so a made-up game can't match.
 */
import { isBotLevelId, isClaimedEnding, type BotLevel, type ClaimedEnding, type Outcome } from '../botGame';
import { makeSeed, seedProblem } from '../space/seed';
import { POWER_IDS, validLoadout } from './engine';
import { botLoadoutFor, replaySolo, type PowerClashStats } from './solo';
import type { Player, PowerId } from './types';

export { makeSeed, seedProblem };

/** The most actions a save can carry (bot_games keeps up to 1,000; a long match is about 60). */
export const MAX_SAVED_ACTIONS = 1000;
/** A match has to be played to the end to earn anything, and the student must have played this many moves. */
export const MIN_MOVES_TO_COUNT = 6;

/** What the server signs: the seed and who it was given to, so a seed can't be shared or used for another game. */
export function stampText(player: string, seed: string): string {
  return `power-clash-seed:v1:${player}:${seed}`;
}

export interface PowerClashGameReport {
  game: 'power-clash';
  seed: string;
  stamp: string;
  level: BotLevel;
  /** The student's side for the whole match. */
  side: Player;
  /** Both sets of powers. The bot's must be the set the seed gives it. */
  loadouts: Record<Player, PowerId[]>;
  /** The student's actions (solo.ts StudentAction). */
  actions: string[];
  ending: ClaimedEnding;
  /** Chaos Mode game (surprises after every third go). Missing means a normal game. */
  chaos: boolean;
}

const powerList = (value: unknown): PowerId[] | null =>
  Array.isArray(value) && value.length === 3 && value.every((p) => POWER_IDS.includes(p as PowerId))
    ? (value as PowerId[])
    : null;

/** Checks the shape of a report that came from outside (e.g. the browser). */
export function parsePowerClashReport(input: unknown): PowerClashGameReport | null {
  if (typeof input !== 'object' || input === null) return null;
  const r = input as Record<string, unknown>;
  if (r.game !== 'power-clash') return null;
  if (typeof r.seed !== 'string' || r.seed.length > 64) return null;
  if (typeof r.stamp !== 'string' || !/^[A-Za-z0-9_-]{20,100}$/.test(r.stamp)) return null;
  if (!isBotLevelId(r.level) || !isClaimedEnding(r.ending) || r.ending === 'resigned') return null;
  if (r.side !== 'X' && r.side !== 'O') return null;
  const loadouts = r.loadouts as Record<string, unknown> | null;
  if (typeof loadouts !== 'object' || loadouts === null) return null;
  const x = powerList(loadouts.X);
  const o = powerList(loadouts.O);
  if (!x || !o) return null;
  if (!Array.isArray(r.actions) || r.actions.length > MAX_SAVED_ACTIONS) return null;
  if (!r.actions.every((a) => typeof a === 'string' && a.length <= 40)) return null;
  return {
    game: 'power-clash',
    seed: r.seed,
    stamp: r.stamp,
    level: r.level,
    side: r.side,
    loadouts: { X: x, O: o },
    actions: r.actions as string[],
    ending: r.ending,
    chaos: r.chaos === true,
  };
}

export type PowerClashReason = 'finished' | 'abandoned';

export interface JudgedPowerClashGame {
  outcome: Outcome;
  reason: PowerClashReason;
  /** Rounds the student won, lost and drew. */
  roundsWon: number;
  roundsLost: number;
  roundsDrawn: number;
  studentMoves: number;
  countsForPoints: boolean;
  stats: PowerClashStats;
}

export type PowerClashJudgement = { ok: true; game: JudgedPowerClashGame } | { ok: false; problem: string };

/** Replays the match from its seed and works out the result. The stamp is checked separately. */
export function judgePowerClashGame(report: PowerClashGameReport): PowerClashJudgement {
  const bot: Player = report.side === 'X' ? 'O' : 'X';
  const student = report.loadouts[report.side];
  if (!validLoadout(student) || !validLoadout(report.loadouts[bot])) return { ok: false, problem: 'bad powers' };
  // The bot's powers belong to the seed; a game that brings different ones was made up.
  const expected = botLoadoutFor(report.seed, report.level);
  if (expected.some((p, i) => report.loadouts[bot][i] !== p)) return { ok: false, problem: 'wrong bot powers' };

  let replayed: ReturnType<typeof replaySolo>;
  try {
    replayed = replaySolo({ seed: report.seed, level: report.level, side: report.side, loadout: student, chaos: report.chaos }, report.actions);
  } catch {
    return { ok: false, problem: 'replay failed' };
  }
  if (!replayed.ok) return { ok: false, problem: replayed.reason };
  const { solo, finished } = replayed;
  // A match the student says they finished must really be over.
  if (!finished && report.ending === 'finished') return { ok: false, problem: 'game not over' };

  const won = finished && solo.match.winner === report.side;
  return {
    ok: true,
    game: {
      outcome: won ? 'won' : 'lost',
      reason: finished ? 'finished' : 'abandoned',
      roundsWon: solo.stats.roundsWon,
      roundsLost: solo.stats.roundsLost,
      roundsDrawn: solo.stats.roundsDrawn,
      studentMoves: solo.studentMoves,
      countsForPoints: finished && solo.studentMoves >= MIN_MOVES_TO_COUNT,
      stats: solo.stats,
    },
  };
}
