/**
 * Marking an answer the server did not see being asked (a solo game's answers, the placement warm-up).
 *
 * The browser sends each answer with how the question was shown (`parts`), the record it counts towards (`key`) and the numbers it
 * was made from (`params`, the question's `Question.params`). The server makes the question again from the key and numbers, throws
 * the answer away unless the rebuilt question comes out EXACTLY as shown, and marks the student's answer against the rebuilt one.
 * So a made-up question, a key that does not match, or numbers that do not make the sum on screen are all refused; the browser's
 * word about the answer is never taken.
 *
 * Why numbers as well as the parts: a pick-one question ("3/10 = ?", four choices) shows only its stem in `parts`, and the right
 * choice is not in it, so the sum alone cannot be marked. The numbers make the choices (and which one is right) the same every time.
 *
 * What is sent: `key` (a record key, at most 51 characters) and `params` (1 to 12 finite numbers, none bigger than a billion).
 * What the server checks: the key is one a generated skill owns; its generator accepts exactly those numbers (they are numbers it
 * could have rolled); and the question they make has exactly the parts that were shown. The answer comes from the rebuilt question.
 *
 * Old browsers (and questions from skills that do not carry numbers, like the times tables) send only the parts: those are worked
 * out from the parts as before (`solveParts`), which still marks every skill that existed before F.6. A question that needs the
 * numbers (any F.6 pick-one question) is refused without them, which cannot happen to a real student: a browser that can ask it
 * also sends them. Numbers that do not make the question shown do not fall back to a guess: the parts are still checked the old way,
 * and only a question that reads back exactly as shown is accepted.
 */
import { solveParts, type Solved } from './focus';
import { solveByNumbers } from './skillPacks/generated';

/** The most numbers a question can be made from (order of operations is the longest, with 5). */
export const MAX_CLAIM_PARAMS = 12;
/** The biggest number a question is made from. */
export const MAX_CLAIM_NUMBER = 1_000_000_000;

/** The numbers if they are a plausible list, else null. */
export function cleanParams(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_CLAIM_PARAMS) return null;
  return raw.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= MAX_CLAIM_NUMBER) ? (raw as number[]) : null;
}

export interface AnswerClaim {
  /** How the question was shown. */
  parts: unknown;
  /** The record it counts towards. */
  key?: unknown;
  /** The numbers it was made from. */
  params?: unknown;
}

/** The right answer and the record of a question as the browser says it was asked, or null when it does not hold up. */
export function solveClaim(claim: AnswerClaim): Solved | null {
  if (typeof claim.key === 'string' && claim.params !== undefined) {
    const params = cleanParams(claim.params);
    if (params && Array.isArray(claim.parts) && claim.parts.every((p) => typeof p === 'string')) {
      const found = solveByNumbers(claim.key, params, claim.parts as string[]);
      if (found) return { answer: found.answer, keys: [found.key] };
    }
  }
  return solveParts(claim.parts);
}
