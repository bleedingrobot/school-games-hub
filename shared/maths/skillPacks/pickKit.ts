/**
 * Tools for the fraction, decimal and percentage skills (F.6): questions where the student taps one of several text choices
 * ("3/4", "0.25", "25%"), and spoken text that reads fractions, decimals and percentages well.
 *
 * A pick question is made from its numbers like every other: the numbers end with two more, `slot` (where the right choice sits)
 * and `salt` (which of the named mistakes are used), both rolled once and kept in `Question.params`. So the same numbers always
 * make the same question, choices in the same order, and the server can rebuild it to mark the tap (the answer is the index of
 * the choice, 0 to 3).
 *
 * Wrong choices are always the answer a student gets by following a named mistake, never a random number. Fractions stay under
 * one (James, 19 Oct 2026): no 7/4 or 1 3/4 as a question or a choice.
 */
import { int, isInt, spokenLabel, type Made } from '../banded';
import { say } from './generatedKit';

/** The value a choice shows: "3/4" → 0.75, "25%" → 0.25, "0.25" → 0.25. Null for anything else. */
export function labelValue(label: string): number | null {
  const f = /^(\d+)\/(\d+)$/.exec(label);
  if (f) return Number(f[2]) > 0 ? Number(f[1]) / Number(f[2]) : null;
  const p = /^(\d+(?:\.\d+)?)%$/.exec(label);
  if (p) return Number(p[1]) / 100;
  return /^\d+(?:\.\d+)?$/.test(label) ? Number(label) : null;
}

/** A fraction under one (or exactly one) is a fraction a student can be asked about here. */
export const isProper = (label: string) => {
  const v = labelValue(label);
  return v !== null && v <= 1;
};

export const frac = (n: number, d: number) => `${n}/${d}`;
export const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** A question's parts spoken for a screen reader: "3/4" is "3 quarters", "25%" is "25 percent", "0.25" is "0 point 2 5". */
export function talk(parts: readonly string[]): string {
  const words: Record<string, string> = { '+': 'plus', '−': 'minus', '×': 'times', '÷': 'divided by', '=': 'equals', '?': 'what', '%': 'percent' };
  const text = parts
    .map((p) => words[p] ?? (/^\d+\.\d+$/.test(p) ? say(Number(p)) : spokenLabel(p)))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return /[?.!:]$/.test(text) ? text : `${text}?`;
}

export interface PickBase {
  parts: string[];
  spoken: string;
  /** The right answer in words, shown after a wrong tap ("3/10 is 0.3"): a pick answer is an index, so filling the blank would say "2". */
  fact: string;
}

export interface PickOptions {
  /** Where the right choice sits among the choices (0 to the number of wrong choices). */
  slot: number;
  /** Which of the named mistakes to use when there are more than needed. */
  salt: number;
  /** Wrong choices needed (default 3: four choices). Two-choice questions ("which is bigger?") use 1. */
  wrong?: number;
  /** A wrong choice may have the same value as the right one ("stopped before the simplest"). Default: it may not. */
  allowEqual?: boolean;
}

/** The two numbers every pick question ends with. */
export const rollPick = (random: () => number, wrong = 3): number[] => [int(random, 0, wrong), int(random, 0, 9)];

/** Are `slot` and `salt` numbers a roll could have given? */
export const goodPick = (slot: number, salt: number, wrong = 3) => isInt(slot, 0, wrong) && isInt(salt, 0, 9);

/**
 * A question with the right choice and choices from named mistakes. `named` maps the name of each mistake to the choice it
 * gives. Choices that repeat the right one (or each other, in value) are dropped; null when fewer than needed are left, so the
 * generator rolls again.
 */
export function pick(base: PickBase, right: string, named: Record<string, string>, opts: PickOptions): Made | null {
  const need = opts.wrong ?? 3;
  if (!goodPick(opts.slot, opts.salt, need)) return null;
  const kept: [string, string][] = [];
  const labels = new Set([right]);
  const values: number[] = [];
  const rightValue = labelValue(right);
  if (rightValue !== null) values.push(rightValue);
  for (const [name, label] of Object.entries(named)) {
    if (labels.has(label)) continue;
    const v = labelValue(label);
    // A fraction choice is under one (or exactly one) and has a top number: no 7/4, no 0/5, no x/0.
    if (/^\d+\/\d+$/.test(label) && (v === null || v > 1 || v === 0)) continue;
    if (!opts.allowEqual && v !== null && values.some((x) => Math.abs(x - v) < 1e-9)) continue;
    labels.add(label);
    if (v !== null) values.push(v);
    kept.push([name, label]);
  }
  if (kept.length < need) return null;
  const start = opts.salt % kept.length;
  const used = Array.from({ length: need }, (_, i) => kept[(start + i) % kept.length]);
  const choices = used.map(([, label]) => label);
  choices.splice(opts.slot, 0, right);
  return { ...base, answer: opts.slot, pick: choices, namedLabels: Object.fromEntries(used), fact: base.fact };
}
