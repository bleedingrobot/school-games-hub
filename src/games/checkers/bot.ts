/**
 * The checkers bots. They're our own, and they run in the student's browser.
 *
 * Every bot "looks ahead": it tries each of its moves, then each reply, and so on, and
 * scores the positions it reaches (pieces count, kings count more, and pieces that have
 * moved up the board count a little more). Then it picks the move that leads to the best
 * score, assuming the student also plays well.
 *
 * - Very Easy looks 1 move ahead and adds lots of randomness, so it often blunders.
 * - Easy looks 3 moves ahead, with a bit of randomness.
 * - Medium looks 6 moves ahead (more when it has time), and always follows a jump to the end.
 *
 * Every move comes from the shared rules, so the bots can only ever play legal moves.
 * To make a bot stronger or weaker, change BOT_SETTINGS below.
 */
import type { BotLevel } from '../../../shared/botGame';
import {
  applyMove,
  boardResult,
  legalMoves,
  rowCol,
  type CheckersMove,
  type Colour,
  type Position,
} from '../../../shared/checkers/rules';

export interface SearchSettings {
  /** How many moves ahead it looks (each side's move counts as one). */
  depth: number;
  /** After the planned depth, keep following jumps so it doesn't stop half way through a swap. */
  followJumps: boolean;
  /** How much randomness to add to each move's score. A man is worth 100. */
  noise: number;
  /** Stop looking deeper once it has checked this many positions, so it stays quick. */
  maxPositions: number;
}

export const BOT_SETTINGS: Record<BotLevel, SearchSettings> = {
  'very-easy': { depth: 1, followJumps: false, noise: 220, maxPositions: 5_000 },
  easy: { depth: 3, followJumps: false, noise: 40, maxPositions: 20_000 },
  medium: { depth: 8, followJumps: true, noise: 6, maxPositions: 40_000 },
};

/** Medium always looks at least this far ahead, even on a slow computer. */
export const MEDIUM_MIN_DEPTH = 6;

/** What each bot is like, in words for students. */
export const BOT_DESCRIPTIONS: Record<BotLevel, string> = {
  'very-easy': 'Only thinks about the move it’s making right now, and often just guesses. Great for learning the rules!',
  easy: 'Thinks a few moves ahead, so it spots simple jumps. It still makes mistakes you can catch.',
  medium: 'Thinks six or more moves ahead and sets traps. You’ll need to plan your jumps to beat it.',
};

const MAN = 100;
const KING = 150;
const WIN = 100_000;

function materialAndCount(position: Position, colour: Colour) {
  let material = 0;
  let count = 0;
  for (const piece of position.board) {
    if (piece?.colour !== colour) continue;
    material += piece.king ? KING : MAN;
    count++;
  }
  return { material, count };
}

/** How good the position is for `colour`. Bigger is better. */
export function evaluate(position: Position, colour: Colour): number {
  let score = 0;
  const mineKings: number[] = [];
  const theirPieces: number[] = [];
  for (let square = 1; square <= 32; square++) {
    const piece = position.board[square - 1];
    if (!piece) continue;
    const sign = piece.colour === colour ? 1 : -1;
    const { row, col } = rowCol(square);
    let value = piece.king ? KING : MAN;
    if (!piece.king) {
      // Men that have moved up the board are closer to becoming kings.
      const progress = piece.colour === 'red' ? row : 7 - row;
      value += progress * 3;
      // Men on their own back row stop the other side getting kings.
      if (progress === 0) value += 6;
    }
    // The middle of the board is the best place to be.
    if (col >= 2 && col <= 5 && row >= 2 && row <= 5) value += 4;
    score += sign * value;
    if (piece.king && sign === 1) mineKings.push(square);
    if (sign === -1) theirPieces.push(square);
  }

  const mine = materialAndCount(position, colour);
  const theirs = materialAndCount(position, colour === 'red' ? 'white' : 'red');
  const ahead = mine.material - theirs.material;
  // When you're ahead, swapping pieces is good: 3 against 1 is easier to win than 12 against 10.
  score += Math.sign(ahead) * (24 - mine.count - theirs.count) * 4;
  // When you're ahead, send your kings after the other side's pieces.
  if (ahead > 0) {
    for (const king of mineKings) {
      const k = rowCol(king);
      let nearest = 14;
      for (const square of theirPieces) {
        const t = rowCol(square);
        nearest = Math.min(nearest, Math.max(Math.abs(k.row - t.row), Math.abs(k.col - t.col)));
      }
      score -= nearest * 3;
    }
  }
  return score;
}

class OutOfTime extends Error {}

/** How far a jump can be followed beyond the planned depth. */
const MAX_JUMP_EXTENSION = 10;

function search(
  position: Position,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  settings: SearchSettings,
  budget: { left: number },
): number {
  if (--budget.left < 0) throw new OutOfTime();
  const moves = legalMoves(position);
  // No moves (or no pieces) means the side to move has lost. Losing later is better.
  if (moves.length === 0) return -WIN + ply;
  if (position.quietPlies >= 80) return 0;

  const jumping = moves[0].captures.length > 0;
  if (depth <= 0 && !(settings.followJumps && jumping && depth > -MAX_JUMP_EXTENSION)) {
    return evaluate(position, position.turn);
  }

  // Look at the biggest jumps and crownings first; it makes the search much faster.
  moves.sort((a, b) => b.captures.length - a.captures.length || Number(b.crowns) - Number(a.crowns));
  let best = -Infinity;
  for (const move of moves) {
    const score = -search(applyMove(position, move), depth - 1, -beta, -alpha, ply + 1, settings, budget);
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

/** Scores every move for the side to move, looking `depth` moves ahead. */
function scoreMoves(position: Position, moves: CheckersMove[], depth: number, settings: SearchSettings, budget: { left: number }) {
  return moves.map((move) => -search(applyMove(position, move), depth - 1, -Infinity, Infinity, 1, settings, budget));
}

/**
 * Picks the bot's next move. Always returns a legal move. It looks 1 move ahead, then 2,
 * and so on up to the bot's depth, and uses the deepest look it had time to finish.
 */
export function chooseCheckersMove(
  position: Position,
  level: BotLevel,
  random: () => number = Math.random,
): CheckersMove {
  const settings = BOT_SETTINGS[level];
  const moves = legalMoves(position);
  if (moves.length === 0 || boardResult(position)) throw new Error('No legal moves');
  if (moves.length === 1) return moves[0];

  let scores = scoreMoves(position, moves, 1, settings, { left: Infinity });
  const budget = { left: settings.maxPositions };
  const minDepth = level === 'medium' ? MEDIUM_MIN_DEPTH : settings.depth;
  for (let depth = 2; depth <= settings.depth; depth++) {
    // The deepest look the bot must always finish has no limit; deeper looks stop if they run out of time.
    const thisBudget = depth <= minDepth ? { left: Infinity } : budget;
    try {
      scores = scoreMoves(position, moves, depth, settings, thisBudget);
    } catch (error) {
      if (error instanceof OutOfTime) break;
      throw error;
    }
  }

  let bestIndex = 0;
  let bestScore = -Infinity;
  scores.forEach((score, i) => {
    // A sure win or loss isn't blurred by randomness: no bot walks into a loss it can see.
    const noisy = Math.abs(score) > WIN / 2 ? score : score + (random() * 2 - 1) * settings.noise;
    if (noisy > bestScore) {
      bestScore = noisy;
      bestIndex = i;
    }
  });
  return moves[bestIndex];
}
