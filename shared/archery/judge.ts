/**
 * How the server checks a fight against a bot (docs/ARCHERY-PLAN.md, section 7). The browser sends every shot of
 * the fight; the server replays them all with the engine and, for each of the bot's turns, works out the bot's shot
 * itself and checks it's the one in the list. So the pupil's own shots are the only thing the browser decides: a
 * made-up bot that always misses isn't possible. It's quick (the bot thinks in about 0.1 ms a turn on a running fight).
 *
 * A finished fight must have ended; a fight left part-way must still be going. Either way the server counts which
 * arrows and helpers were used and gives back the rest.
 */
import { MAX_ROUNDS, MAX_SHOTS_PER_ROUND } from './config';
import { chooseForRun, type BotLevel } from './bot';
import { startFight, takeShot } from './fight';
import type { FightSetup, ItemId, Shot } from './types';

/** The most shots a fight can have (every round to the cap). */
export const MAX_FIGHT_SHOTS = MAX_ROUNDS * MAX_SHOTS_PER_ROUND;

export interface JudgedFight {
  /** 'done' when the fight ended, 'playing' when it was left part-way. */
  status: 'done' | 'playing';
  winner: 0 | 1 | 'draw' | null;
  roundWins: [number, number];
  /** What the pupil (player 0) used. */
  used: Partial<Record<ItemId, number>>;
  /** Damage the pupil did (their score). */
  score: number;
  shots: number;
}

/** Reads a list of shots from a request (null if it isn't one). */
export function readShots(raw: unknown): Shot[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_FIGHT_SHOTS) return null;
  const out: Shot[] = [];
  for (const s of raw) {
    if (!s || typeof s !== 'object') return null;
    const { angle, power, arrow, apple } = s as Record<string, unknown>;
    if (typeof arrow !== 'string' || typeof angle !== 'number' || typeof power !== 'number') return null;
    if (apple !== undefined && typeof apple !== 'boolean') return null;
    out.push({ angle, power, arrow: arrow as Shot['arrow'], ...(apple ? { apple: true } : {}) });
  }
  return out;
}

/**
 * Replays a fight against a bot (the pupil is player 0), checking every shot is allowed and every bot shot is the
 * bot's own. `finished` says whether the fight should have ended. Returns the judged fight or why it's refused.
 */
export function judgeBotFight(seed: number, setup: FightSetup, level: BotLevel, shots: readonly Shot[], finished: boolean): { ok: true; fight: JudgedFight } | { ok: false; problem: string } {
  const run = startFight(seed, setup);
  let score = 0;
  for (let i = 0; i < shots.length; i++) {
    if (run.winner !== null) return { ok: false, problem: 'shots after the fight ended' };
    const shot = shots[i];
    if (run.round.turn === 1) {
      const bot = chooseForRun(run, level).shot;
      if (bot.angle !== shot.angle || bot.power !== shot.power || bot.arrow !== shot.arrow || !!shot.apple) return { ok: false, problem: `shot ${i} is not the bot's` };
    }
    const taken = takeShot(run, shot);
    if (taken.problem) return { ok: false, problem: `shot ${i}: ${taken.problem}` };
    if (taken.record && taken.record.player === 0) score += taken.record.damage[1];
  }
  const done = run.winner !== null;
  if (done !== finished) return { ok: false, problem: finished ? 'the fight has not ended' : 'the fight has ended' };
  return { ok: true, fight: { status: done ? 'done' : 'playing', winner: run.winner, roundWins: [...run.roundWins], used: { ...run.used[0] }, score, shots: shots.length } };
}
