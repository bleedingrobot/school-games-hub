/**
 * For games whose server makes the maths questions and marks them itself (docs/GAME_DEVELOPMENT_GUIDE.md, section 4.2 A):
 * a random number generator made from a text seed, so the server can make the same questions again, and the part of a
 * question the browser may see (never its answer).
 *
 * Moved here from shared/marble/questions.ts (20 Oct 2026) so Clan Quest's Battle Cry makes its questions the same way;
 * Marble's file re-exports them, so nothing about a Marble run changed.
 *
 * `seededRandom` gives exactly the same numbers as Marble Rush's own copy (shared/marble/maths.ts on its branch), so
 * Marble can switch to this one without any run changing.
 */
import { makeSpacePack, pickSpaceQuestion, type MathsQuestionSettings } from '../space/mathsQuestion';
import { isFocusKey, solveParts, type MathsFocus } from './focus';
import type { FactStats } from './leitner';
import type { Question } from './skillPack';

function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A small seeded random number generator (numbers from 0 up to 1). The same text always gives the same numbers. */
export function seededRandom(text: string): () => number {
  let a = hashSeed(text);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** What the browser is told about a question: enough to show it (with `QuestionModal`), never its answer or record. */
export interface PublicQuestion {
  /** Which question of the round this is; the browser sends it back with the answer. */
  slot: number;
  parts: string[];
  spoken: string;
  prompt?: string;
  choices?: number[];
  choiceLabels?: string[];
  input?: 'whole' | 'decimal';
  maxLength?: number;
}

export function publicQuestion(q: Question, slot: number): PublicQuestion {
  return {
    slot,
    parts: q.parts,
    spoken: q.spoken,
    ...(q.prompt ? { prompt: q.prompt } : {}),
    ...(q.choices ? { choices: q.choices } : {}),
    ...(q.choiceLabels ? { choiceLabels: q.choiceLabels } : {}),
    ...(q.input ? { input: q.input } : {}),
    ...(q.maxLength ? { maxLength: q.maxLength } : {}),
  };
}

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
