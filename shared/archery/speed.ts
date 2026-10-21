/**
 * The speed round (docs/ARCHERY-PLAN.md, section 5): the only way to earn coins. Up to 10 questions from the
 * pupil's maths focus, made and marked by the server, one at a time. The first has 10 seconds, the next 9, and so
 * on down to 1; then the round ends. A wrong answer moves straight on. Each right answer in time earns coins.
 *
 * The timer is checked twice: by the pupil's screen (`ms`, from the question appearing to the answer, plus a moment
 * for the key tap) and by the server's own clock (from when it sent the question, plus an allowance for slow school
 * wi-fi). A right answer that's late still counts as right for the maths records; it just earns no coins.
 */
import { isFocusKey, solveParts, type MathsFocus } from '../maths/focus';
import type { FactStats } from '../maths/leitner';
import type { Question } from '../maths/skillPack';
import { makeSpacePack, pickSpaceQuestion, type MathsQuestionSettings } from '../space/mathsQuestion';

/** Questions in a round, and the seconds for the first (each next one has a second less). */
export const ROUND_QUESTIONS = 10;
export const FIRST_SECONDS = 10;
/** Coins for each right answer in time (a perfect round earns 100). */
export const COINS_PER_RIGHT = 10;
/** Rounds a day that earn coins; after that a round is practice (maths still counts, no coins). */
export const EARNING_ROUNDS_PER_DAY = 8;
/** A moment for the key tap on the pupil's own clock, and for slow wi-fi on the server's (ms). */
export const TAP_MS = 200;
export const NETWORK_MS = 2500;
/** Right answers in a round that earn a hub point. */
export const POINT_AT = 5;

/** The time limit for a question (ms): 10 s for the first, 9 s for the second … 1 s for the tenth. */
export function limitMs(slot: number): number {
  return (FIRST_SECONDS - slot) * 1000;
}

/** Was this answer in time? `ms` is the pupil's screen's measure; `servedAgo` the server's, since it sent the question. */
export function inTime(slot: number, ms: number, servedAgo: number): boolean {
  const limit = limitMs(slot);
  return ms <= limit + TAP_MS && servedAgo <= limit + NETWORK_MS;
}

/** The answer's time for the maths records: the smaller of the two measures. */
export function recordedMs(ms: number, servedAgo: number): number {
  return Math.max(0, Math.round(Math.min(ms, servedAgo)));
}

/** What the server reads to make a pupil's questions. */
export interface MathsContext {
  facts: FactStats[];
  settings: MathsQuestionSettings;
  focus?: MathsFocus | null;
}

/** A stored question's right answer and its record key (null if it can't be marked). */
export function markQuestion(q: Question | undefined): { answer: number; key: string } | null {
  if (q && typeof q.answer === 'number' && Number.isFinite(q.answer) && typeof q.factKey === 'string' && isFocusKey(q.factKey)) {
    return { answer: q.answer, key: q.factKey };
  }
  const solved = solveParts(q?.parts);
  return solved ? { answer: solved.answer, key: solved.keys[0] } : null;
}

export const sameAnswer = (typed: number, answer: number): boolean => Math.abs(typed - answer) < 1e-9;

/**
 * A round's questions from the pupil's maths focus (or the times-table step without one), all different where the
 * pack allows. Seeded, so the same seed makes the same round.
 */
export function makeRoundQuestions(context: MathsContext, random: () => number, count = ROUND_QUESTIONS): Question[] {
  const pack = makeSpacePack(context.facts, context.focus ?? null, context.settings, random);
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
