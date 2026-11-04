/**
 * The starting check: a binary search for the first stage the student does not pass, over stages
 * 1 to 7. A stage is tested with 2 pictures and passed when both are right. The search always takes
 * 3 tests (6 pictures), the first at stage 4. The answers are not kept as practice (they don't count
 * towards finishing a stage).
 */
import { STAGES, SUBITISING_CONFIG, type StageNumber, type SubitisingConfig } from './config';
import { progressFrom } from './engine';
import { buildTrial, type Trial } from './trials';

/** Pictures per tested stage. */
export const PLACEMENT_PER_TEST = 2;

const LAST = STAGES.length;

interface Search {
  /** The first stage not passed lies in lo..hi (hi = 8 means "none failed yet"). */
  lo: number;
  hi: number;
  /** The stage being tested now, and how many of its pictures are already answered. */
  stage: number;
  done: number;
}

function searchFrom(answers: readonly boolean[]): Search {
  let lo = 1;
  let hi = LAST + 1;
  let at = 0;
  while (lo < hi && at + PLACEMENT_PER_TEST <= answers.length) {
    const m = Math.floor((lo + hi) / 2);
    const pass = answers.slice(at, at + PLACEMENT_PER_TEST).every(Boolean);
    if (pass) lo = m + 1;
    else hi = m;
    at += PLACEMENT_PER_TEST;
  }
  return { lo, hi, stage: Math.min(Math.floor((lo + hi) / 2), LAST), done: lo < hi ? answers.length - at : 0 };
}

const clamp = (n: number): StageNumber => Math.max(1, Math.min(LAST, n)) as StageNumber;

/** The stage the check is testing next (before the check is over), or where it has ended up. */
export const placementLevel = (answers: readonly boolean[]): StageNumber => clamp(searchFrom(answers).stage);

/** The next picture of the check: no review, no stepping back, just the stage being tested. */
export function placementTrial(answers: readonly boolean[], seed: number, config: SubitisingConfig = SUBITISING_CONFIG): Trial {
  const { stage, done } = searchFrom(answers);
  const progress = progressFrom([], clamp(stage), config);
  const cfg = { ...config, reviewShare: 0 };
  const base = answers.length - done; // index of the test's first picture
  const first = buildTrial(progress, seed, base, null, cfg);
  if (done === 0) return first;
  // The second picture of a test: a different kind of picture where the stage has more than one.
  const several = STAGES[stage - 1].types.length > 1;
  let second = first;
  for (let k = 0; k < 12; k++) {
    second = buildTrial(progress, seed + k * 101, base + done, first, cfg);
    if (second.key !== first.key && (!several || second.type !== first.type)) break;
  }
  return second;
}

/** Where practice starts after the check (also when it is ended early: the best guess so far). */
export function startStageFrom(answers: readonly boolean[]): StageNumber {
  return clamp(Math.min(searchFrom(answers).lo, LAST));
}
