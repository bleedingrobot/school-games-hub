/**
 * Making and marking the questions of a Marble Rush run (docs/MARBLE-PLAN.md, section 7). The server makes the list when a
 * run starts, keeps it where students can't read it, and marks every answer against it.
 *
 * Questions come from the shared focus system, as in Mission Control: `makeSpacePack` -> `makeFocusPack`, so a teacher's
 * focus, a student's own pick or the whole ladder (auto) all decide what the gates, pit stops and rescues ask.
 */
import { isFocusKey, solveParts, type MathsFocus } from '../maths/focus';
import type { FactStats } from '../maths/leitner';
import type { Question } from '../maths/skillPack';
import { makeSpacePack, pickSpaceQuestion, type MathsQuestionSettings } from '../space/mathsQuestion';

/** What the database knows about a student for maths: their records, the class's question settings and their focus. */
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

/**
 * `count` questions for one run, different from each other where the focus allows. Every question can be marked
 * (anything that can't is left out). Fewer than `count` come back only if the focus really has nothing more to ask.
 */
export function makeRunQuestions(context: MathsContext, count: number, random: () => number): Question[] {
  const pack = makeSpacePack(context.facts, context.focus, context.settings, random);
  const out: Question[] = [];
  const seen = new Set<string>();
  const spare: Question[] = [];
  for (let tries = 0; tries < count * 8 && out.length < count; tries++) {
    const q = pickSpaceQuestion(pack, context.settings);
    if (!q || !markQuestion(q)) continue;
    // Gates need an answer you can pick, so a question with no answer to choose between is still fine: gates make their own wrong answers.
    if (seen.has(q.factKey)) spare.push(q);
    else {
      seen.add(q.factKey);
      out.push({ ...q, id: out.length });
    }
  }
  while (out.length < count && spare.length) out.push({ ...(spare.shift() as Question), id: out.length });
  return out;
}
