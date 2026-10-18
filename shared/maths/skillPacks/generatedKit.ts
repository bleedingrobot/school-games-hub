/**
 * Small tools shared by the generated skills (bonds to 100 and 1000, rounding, times with tens and hundreds, factor pairs,
 * squares and cubes, order of operations). These skills make endless questions, so mastery is kept per question TYPE, not per
 * fact (docs/MATHS-FOCUS-PLAN.md section 3 and the F.5 results).
 *
 * Key format: `<skill word>:<detail>[:<detail>]`, lower case, for example `round:100:3digit`, `round:100:near-halfway`,
 * `bond100:fives` or `bedmas:brackets-first`. The part before the first colon is 1 to 10 letters or digits (it starts with a
 * letter); the rest uses only a-z, 0-9, ':', '+', '/' and '-', and is at most 40 characters. The database check on
 * `gem_keep_facts.fact_key` allows exactly that, so no key here needs a migration of its own.
 */
import { sameAnswer, tidy, type Family, type Made } from '../banded';

/** The shape the database accepts for a record key (kept in step with `gem_keep_facts_fact_key_check`). */
export const RECORD_KEY = /^[a-z][a-z0-9]{0,9}:[a-z0-9:+/-]{1,40}$/;

/** What a parser finds in a question's parts: the type of question and the numbers it was made from. */
export interface Parsed {
  key: string;
  params: number[];
}

/** Reads a question as it was shown (its parts) back into a key and numbers, or null when it isn't one of ours. */
export type Parser = (parts: readonly string[]) => Parsed | null;

/** "12 500" → 12500, "4.15" → 4.15. Null when it isn't written the way `show` writes numbers. */
export function readNumber(text: string): number | null {
  if (!/^\d+(?: \d{3})*(?:\.\d+)?$/.test(text)) return null;
  const n = Number(text.replace(/ /g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Numbers of decimal places in how a number was written ("4.15" → 2, "7" → 0). */
export const decimalPlaces = (text: string) => (text.split('.')[1] ?? '').length;

/** The mistakes behind a question's wrong choices, by name. */
export type Named = Record<string, number>;

/**
 * Wrong choices that come from named common mistakes, never from random numbers. Every kept value is different from the
 * answer and from each other, a real number the student could type (whole unless `decimal`), and passes `ok` (used when a
 * mistake can't be allowed to be right by accident, e.g. a "factor of 24" choice that really is a factor).
 * Null when fewer than three are left: the question can't be a multiple-choice one, so the generator must roll again.
 */
export function mistakes(answer: number, named: Named, opts: { decimal?: boolean; ok?: (n: number) => boolean } = {}): { wrong: number[]; named: Named } | null {
  const kept: Named = {};
  const seen: number[] = [];
  for (const [name, raw] of Object.entries(named)) {
    const n = tidy(raw);
    if (!Number.isFinite(n) || n < 0 || sameAnswer(n, answer)) continue;
    if (!opts.decimal && !Number.isInteger(n)) continue;
    if (opts.ok && !opts.ok(n)) continue;
    if (seen.some((s) => sameAnswer(s, n))) continue;
    seen.push(n);
    kept[name] = n;
  }
  return seen.length >= 3 ? { wrong: seen, named: kept } : null;
}

/** A question made from named mistakes (null when there aren't enough). */
export function withMistakes(base: Omit<Made, 'wrong' | 'named'>, named: Named, opts: { decimal?: boolean; ok?: (n: number) => boolean } = {}): Made | null {
  const found = mistakes(base.answer, named, { decimal: base.input === 'decimal', ...opts });
  return found ? { ...base, wrong: found.wrong, named: found.named } : null;
}

export const sameParts = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((p, i) => p === b[i]);

/**
 * A family that owns one question type. `size` is how many numbers a question is made from (null if it varies): numbers of
 * any other count are refused. A roll that makes a question which could not be asked (too few named mistakes, say) is thrown
 * away and rolled again, so every roll is a question the server will also accept.
 */
export function oneKey(key: string, label: string, tags: string[], size: number | null, roll: Family['roll'], make: Family['make']): Family {
  const safe: Family['make'] = (k, params) => (size === null || params.length === size ? make(k, params) : null);
  return {
    label,
    curriculumTags: tags,
    keys: [key],
    make: safe,
    roll: (k, random) => {
      for (let tries = 0; tries < 1000; tries++) {
        const params = roll(k, random);
        if (safe(k, params)) return params;
      }
      throw new Error(`${key}: no question could be rolled`);
    },
  };
}

/** A number for a screen reader: 12500 → "12500", 4.15 → "4 point 1 5" (a point and then the digits one by one). */
export function say(n: number): string {
  const [whole, frac] = String(tidy(n)).split('.');
  return frac ? `${whole} point ${frac.split('').join(' ')}` : whole;
}
