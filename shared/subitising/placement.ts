/**
 * The starting check: a binary search for the first stage the student does not pass, over stages
 * 1 to 7. A stage is tested with 3 pictures: 3 right passes it, 0 or 1 right does not, and with exactly
 * 2 right a 4th picture decides (so a stage passes with 3 right out of 4, and the 4th is skipped when it
 * cannot change the result). The search always takes 3 tests (9 to 12 pictures), the first at stage 4.
 * The answers are not kept as practice (they don't count towards finishing a stage).
 */
import { STAGES, SUBITISING_CONFIG, type StageNumber, type SubitisingConfig } from './config';
import { progressFrom } from './engine';
import { buildTrial, type Trial } from './trials';

/** The first batch of pictures for each tested stage. */
export const PLACEMENT_PASS_OF_FIRST = 3;
/** The most pictures a check can take: 3 tests of 4. */
export const PLACEMENT_MAX = 12;

const LAST = STAGES.length;

/** One stage test from its answers so far: passed, not passed, or still open; and how many pictures it took. */
export function testOutcome(slice: readonly boolean[]): { result: 'pass' | 'fail' | 'open'; used: number } {
  const n = PLACEMENT_PASS_OF_FIRST;
  if (slice.length < n) return { result: 'open', used: 0 };
  const right = slice.slice(0, n).filter(Boolean).length;
  if (right === n) return { result: 'pass', used: n };
  if (right < n - 1) return { result: 'fail', used: n };
  if (slice.length < n + 1) return { result: 'open', used: 0 };
  return { result: slice[n] ? 'pass' : 'fail', used: n + 1 };
}

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
  while (lo < hi) {
    const out = testOutcome(answers.slice(at));
    if (out.result === 'open') break;
    const m = Math.floor((lo + hi) / 2);
    if (out.result === 'pass') lo = m + 1;
    else hi = m;
    at += out.used;
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
  const several = STAGES[stage - 1].types.length > 1;
  const pictures: Trial[] = [];
  for (let k = 0; k <= done; k++) {
    const before = pictures[k - 1] ?? null;
    let t = buildTrial(progress, seed, base + k, before, cfg);
    // No picture repeats one of the same test, and where the stage has more than one kind, not the same kind twice running.
    for (let r = 1; r < 12 && k > 0 && (pictures.some((p) => p.key === t.key) || (several && t.type === before?.type)); r++) {
      t = buildTrial(progress, seed + r * 101, base + k, before, cfg);
    }
    pictures.push(t);
  }
  return pictures[done];
}

/** Are the 3 tests decided? */
export function placementOver(answers: readonly boolean[]): boolean {
  const { lo, hi } = searchFrom(answers);
  return lo >= hi;
}

/** Where practice starts after the check (also when it is ended early: the best guess so far). */
export function startStageFrom(answers: readonly boolean[]): StageNumber {
  return clamp(Math.min(searchFrom(answers).lo, LAST));
}
