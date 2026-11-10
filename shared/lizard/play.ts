/**
 * The replay of a child's tries on a round (docs/LIZARD-PLAN.md). The browser plays it as the child works; the server replays
 * the same tries on its own saved round, so nothing that counts comes from the browser.
 *
 * A try is a number card (read and more goes) or what the child built on the mat when they pressed "That's it" (a build, tie
 * or untie go; see `Go.answer`). The right one moves on; a wrong one has no penalty and the child tries again. For the maths
 * records each key counts once a round: right if the first try at its first go was right, with the time to that try. A key
 * asked a second time in the same round is practice only. `firstRight` counts every go right at the first try.
 */
import type { FactAnswer } from '../maths/leitner';
import { thoughtOf } from '../juniorQuick';
import { GOES_PER_ROUND, MAX_PICK } from './config';
import { showRound, type Go, type Round, type Slip } from './round';

/** One try: a card's number, or what was built (0 to 9999), and how long the child took over it. */
export interface Tap {
  pick: number;
  ms: number;
}

export interface Replay {
  goesDone: number;
  mistakes: number;
  firstRight: number;
  /** Each go in order: its kind and whether the first try was right (for the help of each kind). */
  goes: { kind: Go['kind']; right: boolean }[];
  done: boolean;
  /** One answer per key tried, in order, for the maths records. */
  answers: Omit<FactAnswer, 'at'>[];
  /** Each go's first wrong try and the slip it was (null when a built number or a plain neighbour): for the teacher. */
  slips: { key: string; kind: Go['kind']; slip: Slip | 'other' }[];
}

/** True when a try is right for a go. A card that isn't there, or a number that couldn't be made, throws. */
export function tapRight(go: Go, pick: number): boolean {
  if (!Number.isInteger(pick) || pick < 0 || pick > MAX_PICK) throw new Error(`${pick} can't be made`);
  if (go.choices.length && !go.choices.includes(pick)) throw new Error(`${pick} isn't a card`);
  return pick === go.answer;
}

/** The slip behind a wrong first try: the named slip of the card, or 'other' (a built number is not a slip). */
export const slipOf = (go: Go, pick: number): Slip | 'other' => go.wrongs.find((w) => w.n === pick)?.kind ?? 'other';

/** Replays a child's tries. A try that couldn't be made, or one after the end, throws: the browser never sends them. */
export function replay(round: Round, taps: readonly Tap[]): Replay {
  const goes = showRound(round);
  const answers: Replay['answers'] = [];
  const slips: Replay['slips'] = [];
  const goneThrough: Replay['goes'] = [];
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
      goneThrough.push({ kind: go.kind, right: right && thoughtOf(ms) });
      if (right && thoughtOf(ms)) firstRight++;
      if (!right) slips.push({ key: go.key, kind: go.kind, slip: slipOf(go, pick) });
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
  return { goesDone, mistakes, firstRight, goes: goneThrough, done: goesDone === goes.length && goes.length === GOES_PER_ROUND, answers, slips };
}
