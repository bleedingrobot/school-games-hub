/**
 * Toon Flap's maths plan (docs/TOON-FLAP-PLAN.md, section 3, way A). The server makes and marks every question; this file
 * says how many a run needs, which gap of each answer wall is right (from the run's seed, like Marble's doors) and what
 * the gaps are labelled.
 */
import { seededRandom } from '../maths/serverQuestions';
import type { Course } from './levels';

/** Question slots for a run: the checks first (0 … checks−1), then one per answer sign. */
export function slotPlan(course: Course): { checks: number; gaps: number; total: number } {
  const checks = course.perches.length;
  const gaps = course.signs.length;
  return { checks, gaps, total: checks + gaps };
}

/** For each answer sign, which gap (counted from the bottom) holds the right answer. Fixed by the run's seed. */
export function rightGaps(course: Course, seed: string): number[] {
  return course.signs.map((sign) => {
    const n = course.walls[sign.wall].gaps.length;
    return Math.floor(seededRandom(`${seed}:gap:${sign.i}`)() * n) % n;
  });
}

/** How many answer gaps were flown through the right way. */
export const gapsRight = (picks: ReadonlyArray<number | null>, right: readonly number[]): number =>
  picks.reduce<number>((n, p, i) => (p !== null && p === right[i] ? n + 1 : n), 0);

/**
 * The numbers on an answer wall's gaps (bottom to top), the right answer at `right`. Wrong ones come from the question's
 * own choices when it has them (the pack's likely mistakes), otherwise close numbers. Always different, never below 0.
 */
export function gapLabels(answer: number, count: number, right: number, seed: string, choices?: readonly number[]): number[] {
  const random = seededRandom(`${seed}:labels:${answer}`);
  const wrong: number[] = [];
  const add = (v: number) => {
    const r = Math.round(v * 1000) / 1000;
    if (r >= 0 && r !== answer && !wrong.includes(r)) wrong.push(r);
  };
  for (const c of choices ?? []) add(c);
  const near = Number.isInteger(answer) ? [1, -1, 2, -2, 10, -10, 3, -3] : [0.1, -0.1, 1, -1, 0.2, -0.2];
  // Shuffle the close numbers a little so the wrong answer isn't always one more.
  const order = near.map((d) => ({ d, r: random() })).sort((a, b) => a.r - b.r).map((o) => o.d);
  for (const d of order) add(answer + d);
  const pick = wrong.slice(0, count - 1);
  const out: number[] = [];
  for (let i = 0, w = 0; i < count; i++) out.push(i === right ? answer : pick[w++]);
  return out;
}
