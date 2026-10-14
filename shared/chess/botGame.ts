/**
 * Deciding the result of a game against a bot. The website uses this to show the result
 * straight away, and the server runs the very same code before saving, so a student
 * can't send in a pretend win.
 */
import {
  isBotLevelId,
  isClaimedEnding,
  isMoveList,
  MAX_PLIES,
  MIN_MOVES_TO_COUNT,
  type BotLevel,
  type ClaimedEnding,
  type Outcome,
} from '../botGame';
import { replay, type Colour, type RuleEnding } from './rules';

export { BOT_LEVEL_IDS, MAX_PLIES, MIN_MOVES_TO_COUNT } from '../botGame';
export type { BotLevel, ClaimedEnding, Outcome } from '../botGame';

export type Reason = RuleEnding | 'resigned' | 'abandoned';

export interface BotGameReport {
  level: BotLevel;
  studentColour: Colour;
  moves: string[];
  ending: ClaimedEnding;
}

export interface JudgedGame {
  outcome: Outcome;
  reason: Reason;
  /** How many moves the student made. */
  studentMoves: number;
  /** False for abandoned or very short games: they're recorded but earn nothing. */
  countsForPoints: boolean;
}

export type Judgement = { ok: true; game: JudgedGame } | { ok: false; problem: string };

/** Checks the shape of a report that came from outside (e.g. the browser). */
export function parseReport(input: unknown): BotGameReport | null {
  if (typeof input !== 'object' || input === null) return null;
  const r = input as Record<string, unknown>;
  if (!isBotLevelId(r.level)) return null;
  if (r.studentColour !== 'white' && r.studentColour !== 'black') return null;
  if (!isClaimedEnding(r.ending) || !isMoveList(r.moves)) return null;
  return { level: r.level, studentColour: r.studentColour, moves: r.moves, ending: r.ending };
}

export function studentMoveCount(moves: readonly unknown[], studentColour: Colour): number {
  // White makes moves 1, 3, 5...; black makes 2, 4, 6...
  return studentColour === 'white' ? Math.ceil(moves.length / 2) : Math.floor(moves.length / 2);
}

export function judgeBotGame(report: BotGameReport): Judgement {
  if (report.moves.length > MAX_PLIES) return { ok: false, problem: 'too many moves' };
  const replayed = replay(report.moves);
  if (!replayed.ok) return { ok: false, problem: `illegal move at ${replayed.badMoveIndex + 1}` };

  const studentMoves = studentMoveCount(report.moves, report.studentColour);
  const longEnough = studentMoves >= MIN_MOVES_TO_COUNT;

  if (replayed.result) {
    // The board says the game is over, whatever the browser claimed.
    const { ending, winner } = replayed.result;
    const outcome: Outcome = winner === null ? 'drawn' : winner === report.studentColour ? 'won' : 'lost';
    return { ok: true, game: { outcome, reason: ending, studentMoves, countsForPoints: longEnough } };
  }

  // Not over on the board, so the student must have resigned or left. Both are losses.
  if (report.ending === 'finished') return { ok: false, problem: 'the game is not over' };
  return {
    ok: true,
    game: {
      outcome: 'lost',
      reason: report.ending,
      studentMoves,
      countsForPoints: report.ending === 'resigned' && longEnough,
    },
  };
}
