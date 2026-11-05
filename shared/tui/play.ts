/**
 * The replay of a child's taps on a round (docs/TUI-PLAN.md section 3). The browser plays it as the child taps; the
 * server replays the same taps on its own saved round, so nothing that counts comes from the browser.
 *
 * Each tap is a nest picked for the current go. The right one moves on; a wrong one wobbles back, with no penalty, and
 * the child tries again. For the maths records each fact counts once a round: right if the first pick at its first go
 * was right, with the time to that pick (a go that needed the extra help is still wrong). A fact asked a second time in
 * the same round is practice only. `firstRight` counts every go right at the first tap: it decides a good or hard
 * challenge.
 */
import type { FactAnswer } from '../maths/leitner';
import { GOES_PER_ROUND, showRound, type Round } from './round';

/** One nest picked: its number and how long the child took over it. */
export interface Tap {
  pick: number;
  ms: number;
}

export interface Replay {
  goesDone: number;
  mistakes: number;
  /** Goes right at the first tap (0 to 10). */
  firstRight: number;
  done: boolean;
  /** One answer per fact tried, in order, for the maths records. */
  answers: Omit<FactAnswer, 'at'>[];
}

/** Replays a child's taps. A tap on a number that isn't one of the go's nests, or after the end, stops the replay: the browser never sends them. */
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
    if (!go.choices.includes(pick)) throw new Error(`${pick} isn't a nest on go ${goesDone}`);
    const right = pick === go.answer;
    if (!triedThisGo) {
      if (right) firstRight++;
      if (!counted.has(go.key)) {
        answers.push({ key: go.key, correct: right, ms });
        counted.add(go.key);
      }
    }
    triedThisGo = true;
    if (right) {
      goesDone++;
      triedThisGo = false;
    } else mistakes++;
  }
  return { goesDone, mistakes, firstRight, done: goesDone === goes.length && goes.length === GOES_PER_ROUND, answers };
}
