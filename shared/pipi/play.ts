/**
 * The replay of a child's taps on a round (docs/PIPI-PLAN.md section 3). The browser plays it as the child taps; the
 * server replays the same taps on its own saved round, so nothing that counts comes from the browser.
 *
 * Each tap is a shell picked for the current go. The right one lifts the sand and the hiding pipi pop up; a wrong one
 * wobbles back, with no penalty, and the child tries again. For the maths records each go counts once: right if the
 * first shell picked was right, with the time to that first pick.
 */
import type { FactAnswer } from '../maths/leitner';
import { thoughtOf } from '../juniorQuick';
import { GOES_PER_ROUND, showRound, type WrongKind, type Round } from './round';
import { slipsOf as kitSlipsOf } from '../kit/slips';

/** One shell picked: its number and how long the child took over it. */
export interface Tap {
  pick: number;
  ms: number;
}

export interface Replay {
  goesDone: number;
  mistakes: number;
  /** Goes whose first shell was right and not a guess (the think floor, S14): what the finish words are about. */
  firstRight: number;
  done: boolean;
  /** One answer per go tried, in order, for the maths records. */
  answers: Omit<FactAnswer, 'at'>[];
}

/** Replays a child's taps. A tap on a number that isn't one of the go's shells, or after the end, stops the replay: the browser never sends them. */
export function replay(round: Round, taps: readonly Tap[]): Replay {
  const goes = showRound(round);
  const answers: Replay['answers'] = [];
  let goesDone = 0;
  let mistakes = 0;
  let firstRight = 0;
  let triedThisGo = false;
  for (const { pick, ms } of taps) {
    const go = goes[goesDone];
    if (!go) throw new Error('Taps after the round was done');
    if (!go.choices.includes(pick)) throw new Error(`${pick} isn't a shell on go ${goesDone}`);
    const right = pick === go.answer;
    if (!triedThisGo) {
      answers.push({ key: go.key, correct: right, ms });
      if (right && thoughtOf(ms)) firstRight++;
    }
    triedThisGo = true;
    if (right) {
      goesDone++;
      triedThisGo = false;
    } else mistakes++;
  }
  return { goesDone, mistakes, firstRight, done: goesDone === goes.length && goes.length === GOES_PER_ROUND, answers };
}

/** Goes in a row, the latest first, whose first shell was wrong: three bring the full help back for the rest of the round (R6). */
export const wrongFirstRun = (answers: readonly { correct: boolean }[]): number => {
  let run = 0;
  for (let i = answers.length - 1; i >= 0 && !answers[i].correct; i--) run++;
  return run;
};

/** The kind of slip behind each go's first wrong tap (null for a go right first time), saved for the teacher's "usual slip" line (LEARNING-DESIGN rule 9). */
export const slipsOf = (round: Round, taps: readonly Tap[]): (WrongKind | null)[] =>
  kitSlipsOf(
    showRound(round).map((go) => ({ answer: go.answer, kindOf: (pick: number): WrongKind | null => go.wrongs.find((w) => w.n === pick)?.kind ?? null })),
    taps,
  );
