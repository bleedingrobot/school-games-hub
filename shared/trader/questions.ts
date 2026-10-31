/**
 * Star Trader's maths questions (docs/TRADER-PLAN.md, sections 6 and 14). Every question comes from the pupil's shared
 * focus (`makeFocusPack` through `makeSpacePack`). The server makes a day's list when the pupil first plays that day, keeps
 * it where pupils can't read it, hands out one at a time in order, and marks each answer against the list.
 */
import { isFocusKey, solveParts, type MathsFocus } from '../maths/focus';
import type { FactStats } from '../maths/leitner';
import type { Question } from '../maths/skillPack';
import { makeSpacePack, pickSpaceQuestion, type MathsQuestionSettings } from '../space/mathsQuestion';

/** How many questions a pupil gets in a day (a check on about one trade in three, laser rounds, junk). */
export const QUESTIONS_PER_DAY = 40;

/** What the database knows about a pupil for maths: their records, the class's question settings and their focus. */
export interface MathsContext {
  facts: FactStats[];
  settings: MathsQuestionSettings;
  focus?: MathsFocus;
}

/** The answer and the mastery record of a stored question. Null if it can't be marked. */
export function markQuestion(q: Question | undefined): { answer: number; key: string } | null {
  if (q && typeof q.answer === 'number' && Number.isFinite(q.answer) && typeof q.factKey === 'string' && isFocusKey(q.factKey)) {
    return { answer: q.answer, key: q.factKey };
  }
  const solved = solveParts(q?.parts);
  return solved ? { answer: solved.answer, key: solved.keys[0] } : null;
}

/** Decimal answers are typed as text, so compare with a hair of room. */
export const sameAnswer = (typed: number, answer: number): boolean => Math.abs(typed - answer) < 1e-9;

/** `count` questions for one day, different from each other where the focus allows. Every one can be marked. */
export function makeDayQuestions(context: MathsContext, count: number, random: () => number): Question[] {
  const pack = makeSpacePack(context.facts, context.focus, context.settings, random);
  const out: Question[] = [];
  const seen = new Set<string>();
  const spare: Question[] = [];
  for (let tries = 0; tries < count * 8 && out.length < count; tries++) {
    const q = pickSpaceQuestion(pack, context.settings);
    if (!q || !markQuestion(q)) continue;
    if (seen.has(q.factKey)) spare.push(q);
    else {
      seen.add(q.factKey);
      out.push({ ...q, id: out.length });
    }
  }
  while (out.length < count && spare.length) out.push({ ...(spare.shift() as Question), id: out.length });
  return out;
}
