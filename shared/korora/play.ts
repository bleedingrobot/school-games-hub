/**
 * The replay of a child's taps on a round (docs/KORORA-PLAN.md section 3). The browser plays it as the child taps; the
 * server replays the same taps on its own saved round, so nothing that counts comes from the browser.
 *
 * Each tap is a number picked for the current go (for fair or not: 1 fair, 0 one left over). The right one moves on; a
 * wrong one wobbles back, with no penalty, and the child tries again. For the maths records each fact counts once a
 * round: right if the first pick at its first go was right, with the time to that pick. A fact asked a second time in the
 * same round is practice only.
 */
import type { FactAnswer } from '../maths/leitner';
import { thoughtOf } from '../juniorQuick';
import { GOES_PER_ROUND, showRound, type Round } from './round';

/** One number picked: its value and how long the child took over it. */
export interface Tap {
  pick: number;
  ms: number;
}

export interface Replay {
  goesDone: number;
  mistakes: number;
  /** Goes whose first tap was right and not a guess (the think floor, S14): what the finish words are about. Every go counts, not once per fact. */
  firstRight: number;
  done: boolean;
  /** One answer per fact tried, in order, for the maths records. */
  answers: Omit<FactAnswer, 'at'>[];
}

/** Replays a child's taps. A tap on a number that isn't one of the go's choices, or after the end, stops the replay: the browser never sends them. */
export function replay(round: Round, taps: readonly Tap[]): Replay {
  const goes = showRound(round);
  const answers: Replay['answers'] = [];
  const counted = new Set<string>();
  let goesDone = 0;
  let mistakes = 0;
  let firstRight = 0;
  let triedThisGo = false;
  for (const { pick, ms } of taps) {
    const go = goes[goesDone];
    if (!go) throw new Error('Taps after the round was done');
    if (!go.choices.includes(pick)) throw new Error(`${pick} isn't a choice on go ${goesDone}`);
    const right = pick === go.answer;
    if (!triedThisGo && right && thoughtOf(ms)) firstRight++;
    if (!triedThisGo && !counted.has(go.key)) {
      answers.push({ key: go.key, correct: right, ms });
      counted.add(go.key);
    }
    triedThisGo = true;
    if (right) {
      goesDone++;
      triedThisGo = false;
    } else mistakes++;
  }
  return { goesDone, mistakes, firstRight, done: goesDone === goes.length && goes.length === GOES_PER_ROUND, answers };
}
