/**
 * The replay of a child's taps on a round (docs/KERERU-PLAN.md). The browser plays it as the child taps; the server replays
 * the same taps on its own saved round, so nothing that counts comes from the browser.
 *
 * A tap is a number card (read, ten more or less, nearest goes) or a place on the line, saved as a whole number from 0 to 1000
 * along the line (a place go). The right one moves on; a wrong one has no penalty and the child tries again. For the maths
 * records each key counts once a round: right if the first tap at its first go was right, with the time to that tap. A key
 * asked a second time in the same round is practice only. `firstRight` counts every go right at the first tap.
 */
import type { FactAnswer } from '../maths/leitner';
import { GOES_PER_ROUND, placeRight, showRound, type Go, type Round } from './round';

/** One tap: a card's number, or a place along the line (0 to 1000), and how long the child took over it. */
export interface Tap {
  pick: number;
  ms: number;
}

export interface Replay {
  goesDone: number;
  mistakes: number;
  firstRight: number;
  done: boolean;
  /** One answer per key tried, in order, for the maths records. */
  answers: Omit<FactAnswer, 'at'>[];
  /** The place taps' distances: for each place go, the first tap's distance from the number in the line's units. */
  misses: { key: string; n: number; max: number; off: number }[];
}

/** True when a tap is right for a go. A tap that can't be made on it (a card that isn't there) throws. */
export function tapRight(go: Go, pick: number): boolean {
  if (go.kind === 'place') {
    if (!Number.isInteger(pick) || pick < 0 || pick > 1000) throw new Error(`${pick} isn't on the line`);
    return placeRight(go, pick);
  }
  if (!go.choices.includes(pick)) throw new Error(`${pick} isn't a card`);
  return pick === go.answer;
}

/** Replays a child's taps. A tap that couldn't be made, or one after the end, throws: the browser never sends them. */
export function replay(round: Round, taps: readonly Tap[]): Replay {
  const goes = showRound(round);
  const answers: Replay['answers'] = [];
  const misses: Replay['misses'] = [];
  const counted = new Set<string>();
  let goesDone = 0;
  let mistakes = 0;
  let firstRight = 0;
  let triedThisGo = false;
  for (const { pick, ms } of taps) {
    const go = goes[goesDone];
    if (!go) throw new Error('Taps after the round was done');
    const right = tapRight(go, pick);
    if (!triedThisGo) {
      if (right) firstRight++;
      if (!counted.has(go.key)) {
        answers.push({ key: go.key, correct: right, ms });
        counted.add(go.key);
      }
      if (go.kind === 'place') misses.push({ key: go.key, n: go.n, max: go.max, off: Math.round(go.lo + ((go.hi - go.lo) * pick) / 1000 - go.n) });
    }
    triedThisGo = true;
    if (right) {
      goesDone++;
      triedThisGo = false;
    } else mistakes++;
  }
  return { goesDone, mistakes, firstRight, done: goesDone === goes.length && goes.length === GOES_PER_ROUND, answers, misses };
}
