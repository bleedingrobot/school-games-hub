/**
 * The maths that earns coins (docs/ARCHERY-PLAN.md, section 5, and docs/ARCHERY-QUESTIONS-PLAN.md): question sets from
 * the pupil's maths focus, made and marked by the server, one question at a time. Three kinds:
 *
 * - speed:   the speed round on Home. 10 questions; the first has 10 seconds, the next 9 … down to 5 (never less).
 * - chest:   the loot chest after a fight. 3 questions, 10 seconds each; more coins if you won.
 * - restock: between rounds of a bot fight. 3 questions, 10 seconds each.
 * - supply:  a supply chest before a bot fight, before packing. 3 questions, 10 seconds each.
 *
 * Each right answer in time earns coins, plus a streak bonus from the third right in a row. Coins from maths stop for
 * the day at DAILY_COINS (sets after that are practice: the maths still counts).
 *
 * The timer is checked twice: by the pupil's screen (`ms`, from the question appearing to the answer, plus a moment
 * for the key tap) and by the server's own clock (from when it sent the question, plus an allowance for slow school
 * wi-fi). A right answer that's late still counts as right for the maths records; it just earns no coins.
 */
import { isFocusKey, solveParts, type MathsFocus } from '../maths/focus';
import type { FactStats } from '../maths/leitner';
import type { Question } from '../maths/skillPack';
import { makeSpacePack, pickSpaceQuestion, type MathsQuestionSettings } from '../space/mathsQuestion';

export type SetKind = 'speed' | 'chest' | 'restock' | 'supply';
export const SET_KINDS: readonly SetKind[] = ['speed', 'chest', 'restock', 'supply'];

/** Questions in a speed round, the seconds for the first (each next one has a second less), and the least. */
export const ROUND_QUESTIONS = 10;
export const FIRST_SECONDS = 10;
export const LAST_SECONDS = 5;
/** Questions in a loot chest or a restock, and the seconds for each. */
export const SHORT_QUESTIONS = 3;
export const SHORT_SECONDS = 10;
/** Coins for each right answer in time: a speed round or restock, and a loot chest after a win or a loss. */
export const COINS_PER_RIGHT = 10;
export const CHEST_WIN_COINS = 20;
export const CHEST_LOSS_COINS = 10;
/** From the STREAK_AT-th right answer in a row (in time), each one earns STREAK_BONUS more. */
export const STREAK_AT = 3;
export const STREAK_BONUS = 5;
/** Coins a day from maths; after that a set is practice (maths still counts, no coins). */
export const DAILY_COINS = 600;
/** A moment for the key tap on the pupil's own clock, and for slow wi-fi on the server's (ms). */
export const TAP_MS = 200;
export const NETWORK_MS = 2500;
/** Right answers in a speed round that earn a hub point. */
export const POINT_AT = 5;

/** How many questions a set of this kind has. */
export function setSize(kind: SetKind): number {
  return kind === 'speed' ? ROUND_QUESTIONS : SHORT_QUESTIONS;
}

/** Coins for one right answer in time, before any streak bonus. */
export function baseCoins(kind: SetKind, won: boolean): number {
  return kind === 'chest' ? (won ? CHEST_WIN_COINS : CHEST_LOSS_COINS) : COINS_PER_RIGHT;
}

/** The streak bonus for an answer that earned coins, given how many answers in a row before it earned coins. */
export function streakBonus(earnedInARowBefore: number): number {
  return earnedInARowBefore + 1 >= STREAK_AT ? STREAK_BONUS : 0;
}

/** How many answers in a row, just before `slot`, earned coins (`earned[i]` is slot i's coins). */
export function streakBefore(earned: readonly (number | undefined)[], slot: number): number {
  let n = 0;
  for (let i = slot - 1; i >= 0 && (earned[i] ?? 0) > 0; i--) n++;
  return n;
}

/** The time limit for a question (ms). A speed round: 10 s, 9 s … down to 5 s. A chest or restock: 10 s each. */
export function limitMs(slot: number, kind: SetKind = 'speed'): number {
  if (kind !== 'speed') return SHORT_SECONDS * 1000;
  return Math.max(LAST_SECONDS, FIRST_SECONDS - slot) * 1000;
}

/** Was this answer in time? `ms` is the pupil's screen's measure; `servedAgo` the server's, since it sent the question. */
export function inTime(limit: number, ms: number, servedAgo: number): boolean {
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
