/**
 * Mine Runner's maths (docs/MINE-PLAN.md, section 7): which question belongs to which door or pad, and how the server
 * makes and marks them. The questions come from the shared maths focus system only; they are made and marked on the
 * server, never in the browser.
 *
 * Every question door and every pad has its own block of question slots, so a right answer is known to belong to
 * *that* door or pad. A door has several (a wrong answer costs shield and time, and the next try is a new question);
 * a pad has three tries and a wrong answer costs nothing.
 */
import { isFocusKey, solveParts, type MathsFocus } from '../maths/focus';
import type { FactStats } from '../maths/leitner';
import type { PublicQuestion } from '../maths/serverQuestions';
import type { Question } from '../maths/skillPack';
import { makeSpacePack, pickSpaceQuestion, type MathsQuestionSettings } from '../space/mathsQuestion';
import type { Level } from './level';

/** Questions held for each question door: the most wrong answers at one door in one run is this less one. */
export const DOOR_QUESTIONS = 6;
/** Tries at each power-up pad in a run. */
export const PAD_QUESTIONS = 3;

/** A question door or a pad, with its block of question slots. `id` is the number a `GRANT` input names. */
export interface QuestionTarget {
  id: number;
  kind: 'door' | 'pad';
  first: number;
  count: number;
}

export interface QuestionPlan {
  targets: QuestionTarget[];
  /** How many questions a run with maths holds. */
  total: number;
}

/** Every question door (in door order) and then every pad, each with its slots. */
export function questionPlan(level: Pick<Level, 'doors' | 'pads'>): QuestionPlan {
  const targets: QuestionTarget[] = [];
  let at = 0;
  for (const door of level.doors) {
    if (door.kind !== 'question') continue;
    targets.push({ id: door.id, kind: 'door', first: at, count: DOOR_QUESTIONS });
    at += DOOR_QUESTIONS;
  }
  level.pads.forEach((pad) => {
    targets.push({ id: pad.id, kind: 'pad', first: at, count: PAD_QUESTIONS });
    at += PAD_QUESTIONS;
  });
  return { targets, total: at };
}

/** The target a slot belongs to, or undefined if it is out of range. */
export function targetOfSlot(plan: QuestionPlan, slot: number): QuestionTarget | undefined {
  return plan.targets.find((t) => slot >= t.first && slot < t.first + t.count);
}

/** What the browser gets back when a run starts. */
export interface StartReply {
  seed: string;
  stamp: string;
  /** True if this run has maths (the questions below are for its doors and pads). */
  maths: boolean;
  questions: PublicQuestion[];
}

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

/**
 * `count` questions for one run, different from each other where the focus allows (a repeat only if the focus has
 * nothing more to ask). Every question can be marked; anything that can't is left out.
 */
export function makeRunQuestions(context: MathsContext, count: number, random: () => number): Question[] {
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
