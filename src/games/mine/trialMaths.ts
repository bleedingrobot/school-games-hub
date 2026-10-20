/**
 * TRIAL MATHS: A STAND-IN FOR THE PREVIEW ONLY.
 *
 * Mine Runner's real question doors and power-up pads get their questions from the school's maths focus, made and marked
 * by the server (docs/MINE-PLAN.md, section 7; that is Stage 4). There is no server in this stage, so the phone preview
 * asks these simple sums, made and marked right here in the browser, just so the doors and pads can be tried.
 *
 * Nothing here is used by the real game, nothing is recorded, and nothing counts towards a pupil's maths. Do not copy it.
 */
import type { Question } from '../../../shared/maths/skillPack';

/** The words shown on every trial question, so it can't be mistaken for the real thing. */
export const TRIAL_NOTE = 'Trial question (preview only). It is not saved.';

let counter = 0;

/** A simple sum: adding, taking away, or a times table. `random` gives a number from 0 up to (not including) 1. */
export function trialQuestion(random: () => number = Math.random): Question {
  const pick = (n: number) => Math.floor(random() * n);
  const kind = pick(3);
  let parts: string[];
  let spoken: string;
  let answer: number;
  if (kind === 0) {
    const a = 3 + pick(17);
    const b = 3 + pick(17);
    parts = [String(a), '+', String(b), '=', '?'];
    spoken = `${a} plus ${b} equals what?`;
    answer = a + b;
  } else if (kind === 1) {
    const a = 10 + pick(15);
    const b = 2 + pick(Math.min(9, a - 2));
    parts = [String(a), '−', String(b), '=', '?'];
    spoken = `${a} minus ${b} equals what?`;
    answer = a - b;
  } else {
    const tables = [2, 3, 4, 5, 10];
    const a = tables[pick(tables.length)];
    const b = 2 + pick(9);
    parts = [String(a), '×', String(b), '=', '?'];
    spoken = `${a} times ${b} equals what?`;
    answer = a * b;
  }
  counter++;
  return { id: counter, skill: 'trial', factKey: 'trial', kind: 'trial', parts, spoken, answer, band: 'focus' };
}

/** The whole fact for a wrong answer: "7 × 8 = 56". */
export function trialFact(q: Question): string {
  return q.parts.map((p) => (p === '?' ? String(q.answer) : p)).join(' ');
}
