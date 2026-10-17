import { newRound, other } from './engine';
import type { Player, PowerClashState, PowerId } from './types';

export const ROUNDS_TO_WIN = 3;

export interface Match {
  score: Record<Player, number>;
  draws: number;
  /** 1-based number of the round being played or just finished. */
  round: number;
  loadout: Record<Player, PowerId[]>;
  starter: Player;
  /** Chaos Mode: a surprise every third go. */
  chaos: boolean;
  state: PowerClashState;
  /** Set when someone has won three rounds. */
  winner: Player | null;
  /** True once this round's result has been added to the score. */
  counted: boolean;
}

export function newMatch(loadout: Record<Player, PowerId[]>, starter: Player = 'X', chaos = false): Match {
  return {
    score: { X: 0, O: 0 },
    draws: 0,
    round: 1,
    loadout,
    starter,
    chaos,
    state: newRound(loadout, starter, chaos),
    winner: null,
    counted: false,
  };
}

/** Call once the round is over: adds the result to the score. Safe to call more than once. */
export function scoreRound(match: Match): Match {
  const { status } = match.state;
  if (status === 'active') return match;
  if (match.counted) return match;
  const score = { ...match.score };
  let draws = match.draws;
  if (status === 'draw') draws += 1;
  else score[status] += 1;
  const winner = score.X >= ROUNDS_TO_WIN ? 'X' : score.O >= ROUNDS_TO_WIN ? 'O' : null;
  return { ...match, score, draws, winner, counted: true };
}

/** Next round: the starter swaps, and powers refresh (loadout may be changed). */
export function nextRound(match: Match, loadout: Record<Player, PowerId[]> = match.loadout): Match {
  const starter = other(match.starter);
  return {
    ...match,
    round: match.round + 1,
    loadout,
    starter,
    state: newRound(loadout, starter, match.chaos),
    counted: false,
  };
}
