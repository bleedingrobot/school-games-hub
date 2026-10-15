/**
 * Saving a 101 game against bots.
 *
 * It works like the space game (shared/space/save.ts): before a game the server hands out
 * a seed with a stamp (a signature only the server can make), the browser plays the whole
 * game from that seed, and at the end it sends the seed, the stamp, the settings and the
 * student's own actions. The server replays the game here with `replaySolo` and saves only
 * what it worked out itself. The bots' choices come from the seed too, so a made-up result
 * can't match.
 */
import { isBotLevelId, isClaimedEnding, type BotLevel, type ClaimedEnding, type Outcome } from '../botGame';
import { makeSeed, seedProblem } from '../space/save';
import { TARGETS, type Game, type Settings, type Target } from './engine';
import { replaySolo, STUDENT_SEAT, type SoloSetup } from './solo';

export { makeSeed, seedProblem };

/** Games of fewer full rounds than this earn nothing ("very short" for 101). */
export const MIN_ROUNDS_TO_COUNT = 2;
/** The most actions a save can carry (bot_games keeps up to 1,000; a long game to 101 is ~400). */
export const MAX_SAVED_ACTIONS = 1000;

/** What the server signs: the seed and who it was given to, so a seed can't be shared or used for another game. */
export function stampText(player: string, seed: string): string {
  return `101-seed:v1:${player}:${seed}`;
}

// ---------- The report the browser sends ----------

export interface Card101GameReport {
  game: '101';
  seed: string;
  stamp: string;
  bots: number;
  level: BotLevel;
  settings: Settings;
  /** The student's actions (solo.ts StudentAction). */
  actions: string[];
  ending: ClaimedEnding;
}

/** Checks the shape of a report that came from outside (e.g. the browser). */
export function parseCard101Report(input: unknown): Card101GameReport | null {
  if (typeof input !== 'object' || input === null) return null;
  const r = input as Record<string, unknown>;
  if (r.game !== '101') return null;
  if (typeof r.seed !== 'string' || r.seed.length > 64) return null;
  if (typeof r.stamp !== 'string' || !/^[A-Za-z0-9_-]{20,100}$/.test(r.stamp)) return null;
  if (r.bots !== 1 && r.bots !== 2 && r.bots !== 3) return null;
  if (!isBotLevelId(r.level) || !isClaimedEnding(r.ending) || r.ending === 'resigned') return null;
  const settings = r.settings as Record<string, unknown> | null;
  if (typeof settings !== 'object' || settings === null || Object.keys(settings).length !== 1) return null;
  if (!TARGETS.includes(settings.target as Target)) return null;
  if (!Array.isArray(r.actions) || r.actions.length > MAX_SAVED_ACTIONS) return null;
  if (!r.actions.every((a) => typeof a === 'string' && a.length <= 20)) return null;
  return {
    game: '101',
    seed: r.seed,
    stamp: r.stamp,
    bots: r.bots,
    level: r.level,
    settings: { target: settings.target as Target },
    actions: r.actions as string[],
    ending: r.ending,
  };
}

// ---------- Judging ----------

/** What the student did in one game, for the 101 achievements. */
export interface Card101Stats {
  /** Hands that scored 0. */
  zeroHands: number;
  /** Hands with three (or four) of a kind. */
  triples: number;
  /** Rounds the student knocked in and had the lowest hand (ties too). */
  knockWins: number;
  /** Times one of the student's 3s cancelled a 10-point card. */
  savedByThree: number;
}

/** One player's stats from a game's rounds (bot games and classmates games alike). */
export function statsFor(game: Pick<Game, 'results'>, seat: number): Card101Stats {
  const stats: Card101Stats = { zeroHands: 0, triples: 0, knockWins: 0, savedByThree: 0 };
  for (const result of game.results) {
    const score = result.scores[seat];
    if (!score) continue;
    if (score.total === 0) stats.zeroHands += 1;
    if (score.steps.some((s) => s.kind === 'triple')) stats.triples += 1;
    if (result.knocker === seat && result.winners.includes(seat)) stats.knockWins += 1;
    stats.savedByThree += score.steps.filter((s) => s.kind === 'three-cancels' && s.value === 10).length;
  }
  return stats;
}

export type Card101Reason = 'finished' | 'abandoned';

export interface JudgedCard101Game {
  /** Won means the lowest total (a shared win counts); every other place is "lost". */
  outcome: Outcome;
  reason: Card101Reason;
  /** 1st, 2nd…; null if the student left before the end. */
  place: number | null;
  players: number;
  /** Full rounds played. */
  rounds: number;
  /** The student's total at the end (or when they left). */
  total: number;
  studentTurns: number;
  countsForPoints: boolean;
  stats: Card101Stats;
}

export type Card101Judgement = { ok: true; game: JudgedCard101Game } | { ok: false; problem: string };

/** Replays the game from its seed and works out the result. The stamp is checked separately. */
export function judgeCard101Game(report: Card101GameReport): Card101Judgement {
  const setup: SoloSetup = { seed: report.seed, bots: report.bots, level: report.level, settings: report.settings };
  let replayed: ReturnType<typeof replaySolo>;
  try {
    replayed = replaySolo(setup, report.actions);
  } catch {
    return { ok: false, problem: 'replay failed' };
  }
  if (!replayed.ok) return { ok: false, problem: replayed.reason };
  const { game, studentTurns, rounds, left } = replayed;
  // Leaving ends a bot game for the student, even if the bots could carry on.
  const finished = replayed.finished && !left;
  // A game the student says they finished must really be over. One they say they left may
  // have ended anyway (the page closed during the last scoring show): then it's finished.
  if (!finished && report.ending === 'finished') return { ok: false, problem: 'game not over' };

  const stats = statsFor(game, STUDENT_SEAT);

  const total = game.totals[STUDENT_SEAT];
  const won = finished && (game.winners ?? []).includes(STUDENT_SEAT);
  const place = finished ? 1 + game.totals.filter((t, seat) => !game.out[seat] && t < total).length : null;
  return {
    ok: true,
    game: {
      outcome: won ? 'won' : 'lost',
      reason: finished ? 'finished' : 'abandoned',
      place,
      players: game.players,
      rounds,
      total,
      studentTurns,
      countsForPoints: finished && rounds >= MIN_ROUNDS_TO_COUNT,
      stats,
    },
  };
}
