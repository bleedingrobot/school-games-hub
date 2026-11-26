/**
 * One hint for any question, with no extra content to write per topic. Pick-one questions lose two wrong
 * choices. Typed questions say which small stretch of numbers the answer is in ("between 50 and 60").
 * It never gives the answer away, and the same question always gets the same hint.
 */
import { isFigure } from './figure';
import type { Question } from './skillPack';

export interface Hint {
  /** One plain sentence to show. */
  text: string;
  /** Choices to grey out (pick-one questions only). */
  remove: number[];
}

const clean = (n: number) => String(Math.round(n * 1e6) / 1e6);

/** The stretch the answer is in: wide enough that it is a nudge, narrow enough to help. */
function stretch(answer: number): [number, number] {
  const size = Math.abs(answer);
  const step = !Number.isInteger(answer) ? (size < 10 ? 1 : 5) : size >= 200 ? 50 : size >= 40 ? 20 : size >= 12 ? 10 : 5;
  const low = Math.floor(answer / step) * step;
  return [low, low + step];
}

export function hintFor(q: Pick<Question, 'answer' | 'choices' | 'parts'>): Hint {
  if (q.choices && q.choices.length > 2) {
    // Take away two wrong choices: the ones furthest from the answer first, so the hint is fair but not a giveaway.
    const wrong = q.choices.filter((c) => c !== q.answer).sort((a, b) => Math.abs(b - q.answer) - Math.abs(a - q.answer) || a - b);
    const remove = wrong.slice(0, 2);
    return { text: 'Two of the choices were wrong. They are greyed out.', remove };
  }
  const [low, high] = stretch(q.answer);
  const money = q.parts.includes('$');
  const show = (n: number) => (money ? `$${n.toFixed(2)}` : clean(n));
  return { text: `The answer is between ${show(low)} and ${show(high)}.`, remove: [] };
}

/**
 * Which free "Help me" picture a question gets (James, 26 Nov 2026): every kind of angle on angle-picture questions, and what
 * < > ≤ ≥ ≠ mean on any question that shows one of them. Unlike the hint it costs nothing and never narrows the answer.
 */
export function helpKind(q: Pick<Question, 'parts' | 'prompt' | 'choiceLabels' | 'figure'>): 'angles' | 'symbols' | 'remainder' | 'axes' | 'fractions' | 'hours' | null {
  if (isFigure(q.figure) && q.figure.kind === 'angle') return 'angles';
  // A division with a remainder ("9 ÷ 4 = ? r 1"): what the r means. A point on an axis: a small grid (James, 26 Nov 2026).
  if (q.parts.includes('r')) return 'remainder';
  if (/\b[xy]-axis\b/.test(q.prompt ?? '')) return 'axes';
  if (fractionSteps(q.parts)) return 'fractions';
  // Hours into minutes ("3 h = ? min"): use the 6 times table (James, 26 Nov 2026).
  if (q.parts.includes('min') && q.parts.some((p) => /(\d|½) h(\s|$)/.test(p))) return 'hours';
  const texts = [...q.parts, q.prompt ?? '', ...(q.choiceLabels ?? [])];
  return texts.some((t) => /[<>≤≥≠]/.test(t)) ? 'symbols' : null;
}

/** One fraction changed into an equivalent one: n/d becomes (n × by)/(d × by). */
export interface FractionChange {
  n: number;
  d: number;
  by: number;
}

/**
 * Adding or taking away two fractions with different bottoms ("1/8 + 3/4 = ?"): which fraction(s) to change, and how
 * (James, 26 Nov 2026). If one bottom is a multiple of the other only the smaller-bottom fraction changes; otherwise both
 * change to the smallest bottom they share. Null for anything else (same bottoms, mixed numbers, no + or −).
 */
export function fractionSteps(parts: readonly string[]): { a: [number, number]; b: [number, number]; sign: '+' | '−'; bottom: number; changes: FractionChange[] } | null {
  const frac = (t: string | undefined) => {
    const m = /^(\d+)\/(\d+)$/.exec(t ?? '');
    return m && Number(m[2]) > 0 ? ([Number(m[1]), Number(m[2])] as [number, number]) : null;
  };
  for (let i = 1; i + 1 < parts.length; i++) {
    const sign = parts[i] === '+' ? '+' : parts[i] === '−' || parts[i] === '-' ? '−' : null;
    const a = frac(parts[i - 1]);
    const b = frac(parts[i + 1]);
    if (!sign || !a || !b || a[1] === b[1]) continue;
    const gcd = (x: number, y: number): number => (y === 0 ? x : gcd(y, x % y));
    const bottom = (a[1] * b[1]) / gcd(a[1], b[1]);
    const changes = [a, b].filter((f) => f[1] !== bottom).map(([n, d]) => ({ n, d, by: bottom / d }));
    return { a, b, sign, bottom, changes };
  }
  return null;
}
