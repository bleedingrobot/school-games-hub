/**
 * The replay of a child's taps on a round (docs/HOP-PLAN.md section 3). The browser plays it as the child taps; the
 * server replays the same taps on its own saved round, so nothing that counts comes from the browser.
 *
 * Each tap is a glow-worm picked for the current hop. The right one makes Hop jump to the next hop; a wrong one wobbles
 * and drifts back, with no penalty, and the child tries again. For the maths records each hop counts once: right if the
 * first glow-worm picked was right, with the time to that first pick.
 */
import type { FactAnswer } from '../maths/leitner';
import { HOPS_PER_ROUND, showRound, type Round } from './round';

/** One glow-worm picked: its number and how long the child took over it. */
export interface Tap {
  pick: number;
  ms: number;
}

export interface Replay {
  hopsMade: number;
  mistakes: number;
  done: boolean;
  /** One answer per hop tried, in order, for the maths records. */
  answers: Omit<FactAnswer, 'at'>[];
}

/** Replays a child's taps. A tap on a number that isn't one of the hop's glow-worms, or after the end, stops the replay: the browser never sends them. */
export function replay(round: Round, taps: readonly Tap[]): Replay {
  const hops = showRound(round);
  const answers: Replay['answers'] = [];
  let hopsMade = 0;
  let mistakes = 0;
  let triedThisHop = false;
  for (const { pick, ms } of taps) {
    const hop = hops[hopsMade];
    if (!hop) throw new Error('Taps after the round was done');
    if (!hop.choices.includes(pick)) throw new Error(`${pick} isn't a glow-worm on hop ${hopsMade}`);
    const right = pick === hop.answer;
    if (!triedThisHop) answers.push({ key: hop.key, correct: right, ms });
    triedThisHop = true;
    if (right) {
      hopsMade++;
      triedThisHop = false;
    } else mistakes++;
  }
  return { hopsMade, mistakes, done: hopsMade === hops.length && hops.length === HOPS_PER_ROUND, answers };
}
