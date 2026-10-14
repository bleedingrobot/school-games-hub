/**
 * The chess bots.
 *
 * - Very Easy picks a random legal move, with a slight liking for captures. It makes
 *   lots of mistakes and never plans ahead.
 * - Easy and Medium ask Stockfish (a free, open-source chess engine running inside the
 *   browser). Stockfish's "Skill Level" makes it pick weaker moves on purpose, and the
 *   "depth" is how many moves ahead it looks. Easy also plays a random move now and then.
 *
 * Whatever the engine says, the move is checked against the rules before it's played.
 * To make a bot stronger or weaker, change BOT_SETTINGS below.
 */
import type { BotLevel } from '../../../shared/chess/botGame';
import { legalUciMoves, type Chess } from '../../../shared/chess/rules';

export interface EngineSettings {
  /** Stockfish's Skill Level, 0 (weakest) to 20 (strongest). */
  skill: number;
  /** How many moves ahead it looks. */
  depth: number;
}

/** Anything that can suggest a move for a position (Stockfish in a Web Worker, or in tests). */
export interface ChessEngine {
  bestMove(fen: string, settings: EngineSettings): Promise<string | null>;
  newGame(): void;
}

export const BOT_SETTINGS: Record<BotLevel, { engine: EngineSettings | null; randomMoveChance: number }> = {
  'very-easy': { engine: null, randomMoveChance: 1 },
  easy: { engine: { skill: 0, depth: 3 }, randomMoveChance: 0.2 },
  medium: { engine: { skill: 6, depth: 8 }, randomMoveChance: 0 },
};

/** What each bot is like, in words for students. */
export const BOT_DESCRIPTIONS: Record<BotLevel, string> = {
  'very-easy': 'Plays almost any move it can find. It loves grabbing pieces, but it never thinks ahead.',
  easy: 'Thinks a couple of moves ahead, but often misses things. Watch out for its traps!',
  medium: 'Thinks carefully and doesn’t give much away. You’ll need a plan to beat it.',
};

/** A random legal move. Captures are three times as likely as other moves. */
export function randomishMove(chess: Chess, random: () => number = Math.random): string {
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) throw new Error('No legal moves');
  const weights = moves.map((m) => (m.captured ? 3 : 1));
  let pick = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < moves.length; i++) {
    pick -= weights[i];
    if (pick < 0) return moves[i].from + moves[i].to + (moves[i].promotion ?? '');
  }
  const last = moves[moves.length - 1];
  return last.from + last.to + (last.promotion ?? '');
}

/** If the engine takes longer than this, something is wrong with it. */
export const ENGINE_TIMEOUT_MS = 10_000;

export class EngineTrouble extends Error {}

/**
 * Picks the bot's next move. Always returns a legal move. If the engine breaks or takes
 * far too long, it throws EngineTrouble so the page can switch to random moves.
 */
export async function chooseBotMove(
  chess: Chess,
  level: BotLevel,
  engine: ChessEngine | null,
  random: () => number = Math.random,
): Promise<string> {
  const settings = BOT_SETTINGS[level];
  if (!settings.engine || !engine || random() < settings.randomMoveChance) return randomishMove(chess, random);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const tooSlow = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new EngineTrouble('engine timed out')), ENGINE_TIMEOUT_MS);
  });
  try {
    const suggestion = await Promise.race([engine.bestMove(chess.fen(), settings.engine), tooSlow]);
    return suggestion && legalUciMoves(chess).includes(suggestion) ? suggestion : randomishMove(chess, random);
  } catch {
    throw new EngineTrouble('engine failed');
  } finally {
    clearTimeout(timer);
  }
}
