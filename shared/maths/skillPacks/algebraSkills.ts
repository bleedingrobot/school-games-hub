/**
 * Algebra, Year 7 and 8 (docs/plans/ladder-7-8/PLAN.md section 3d, card Y6).
 *
 * Fluency, not method: every question is one number to type or four choices to tap, from small numbers. A letter is a plain
 * letter (x, t, a). A question that asks for an unknown shows the equation in the prompt ("If t + 7 = 12") and the sum under
 * it is "t = ?", so the blank is always the thing to find. A negative answer is four choices to tap (no minus key), as in
 * integerSkills.ts; one that is zero or more is typed.
 *
 * Types (key prefix `alg`):
 *   substitute            (Y7) alg:sub-sq  alg:sub-area  alg:sub-lin*
 *   equations-1           (Y7) alg:eq-add  alg:eq-mul  alg:eq-div  alg:eq-two*
 *   like-terms            (Y7) alg:like-add  alg:like-sub
 *   patterns-rule         (Y7) alg:pat-next  alg:pat-term*  alg:pat-rule
 *   true-false-sentences  (Y7) alg:tf-whole*  alg:tf-dec*
 *   equations-2           (Y8) alg:eq2-dec  alg:eq2-ineq  alg:eq2-two*
 * (* = two steps, in ALGEBRA_SLOW_KEYS.)
 */
import { int, isInt, type Family, type Made } from '../banded';
import { oneKey, withMistakes, type Named } from './generatedKit';
import { signedText } from './integerSkills';
import { goodPick, pick, rollPick } from './pickKit';

const Y7 = ['MS.Y7.ALG.P1', 'MS.Y7.ALG.P2'];
const Y8 = ['MS.Y8.ALG.P1', 'MS.Y8.ALG.P2'];

/** The letters a question may use (a number from a roll picks one). */
const LETTERS = ['x', 't', 'a', 'n', 'm', 'p', 'y', 's'];
const letterOk = (i: number) => isInt(i, 0, LETTERS.length - 1);
const rollLetter = (r: () => number) => int(r, 0, LETTERS.length - 1);

/** "3x", or "x" for one of them. */
const coef = (c: number, v: string) => (c === 1 ? v : `${c}${v}`);
const SIGN_WORDS: Record<string, string> = { '+': 'plus', '−': 'minus', '×': 'times', '÷': 'divided by', '=': 'equals', '≥': 'is at least', '≤': 'is at most', '<': 'is less than', '>': 'is more than' };

/** An expression read aloud: "3x + 2" is "3 x plus 2", "−5" is "negative 5", "0.8" is "0 point 8", "a²" is "a squared". */
export function sayAlg(text: string): string {
  return text
    .replace(/−(?=\d)/g, 'negative ')
    .replace(/(\d+)\.(\d+)/g, (_, w: string, f: string) => `${w} point ${f.split('').join(' ')}`)
    .replace(/²/g, ' squared')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/[+−×÷=≥≤<>]/g, (c) => ` ${SIGN_WORDS[c]} `)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Typed when the answer is zero or more, four choices to tap when it is below zero (as integerSkills.ts). A mistake that is
 * not a whole number is dropped from a whole-number question, so a choice never looks like a different kind of answer.
 */
function signed(base: { parts: string[]; prompt?: string; spoken: string; decimal?: boolean }, answer: number, named: Named, slot: number, salt: number): Made | null {
  const keep: Named = {};
  for (const [name, n] of Object.entries(named)) if (Number.isFinite(n) && (base.decimal || Number.isInteger(n))) keep[name] = Math.round(n * 100) / 100;
  const extra = base.prompt ? { prompt: base.prompt } : {};
  if (answer >= 0) return withMistakes({ parts: base.parts, spoken: base.spoken, answer, ...(base.decimal ? { input: 'decimal' as const } : {}), ...extra }, keep);
  const labels: Record<string, string> = {};
  for (const [name, n] of Object.entries(keep)) if (n !== answer) labels[name] = signedText(n);
  const fact = `${base.prompt ? `${base.prompt}, ` : ''}${base.parts.map((p) => p.replace('?', signedText(answer))).join(' ')}`;
  const made = pick({ parts: base.parts, spoken: base.spoken, fact }, signedText(answer), labels, { slot, salt });
  return made ? { ...made, ...extra } : null;
}

const withPick = (random: () => number, ...params: number[]) => [...params, ...rollPick(random)];

// ---------------------------------------------------------------- substitute (Y7)

/** "a² when a = 6". */
const subSq = oneKey(
  'alg:sub-sq',
  'Putting a number in a square (a² when a = 6)',
  Y7,
  2,
  (_k, r) => [rollLetter(r), int(r, 2, 12)],
  (_k, [li, a]) => {
    if (!letterOk(li) || !isInt(a, 2, 12)) return null;
    const v = LETTERS[li];
    const parts = [`${v}²`, '=', '?'];
    return withMistakes(
      { parts, prompt: `When ${v} = ${a}`, spoken: `When ${v} equals ${a}, ${v} squared equals what?`, answer: a * a },
      { 'doubled instead of squared': 2 * a, 'added 2': a + 2, 'cubed': a * a * a, 'one more': a * a + 1, 'one less': a * a - 1 },
    );
  },
);

/** "A = lw with l = 6, w = 4". */
const subArea = oneKey(
  'alg:sub-area',
  'Putting numbers in a formula (A = lw)',
  Y7,
  2,
  (_k, r) => [int(r, 3, 12), int(r, 2, 9)],
  (_k, [l, w]) => {
    if (!isInt(l, 3, 12) || !isInt(w, 2, 9)) return null;
    return withMistakes(
      { parts: ['A', '=', '?'], prompt: `A = lw, when l = ${l} and w = ${w}`, spoken: `A equals l w, when l equals ${l} and w equals ${w}. What is A?`, answer: l * w },
      { 'added them': l + w, 'found the distance round (perimeter)': 2 * (l + w), 'squared the length': l * l, 'joined the digits': Number(`${l}${w}`), 'one more row': l * w + l },
    );
  },
);

/** "3x + 2 when x = 5" (two steps). */
const subLin = oneKey(
  'alg:sub-lin',
  'Putting a number in (3x + 2 when x = 5)',
  Y7,
  5,
  (_k, r) => {
    const a = int(r, 2, 9);
    const x = int(r, 2, 9);
    const minus = int(r, 0, 1);
    return [rollLetter(r), a, x, int(r, 1, minus ? Math.min(9, a * x - 1) : 9), minus];
  },
  (_k, [li, a, x, b, minus]) => {
    if (!letterOk(li) || !isInt(a, 2, 9) || !isInt(x, 2, 9) || !isInt(b, 1, 9) || !isInt(minus, 0, 1)) return null;
    if (minus && a * x - b < 1) return null;
    const v = LETTERS[li];
    const s = minus ? -1 : 1;
    const expr = `${a}${v} ${minus ? '−' : '+'} ${b}`;
    return withMistakes(
      { parts: [expr, '=', '?'], prompt: `When ${v} = ${x}`, spoken: `When ${v} equals ${x}, ${sayAlg(expr)} equals what?`, answer: a * x + s * b },
      {
        'added instead of multiplied': a + x + s * b,
        'forgot the last number': a * x,
        'multiplied the lot': a * (x + s * b),
        'joined the digits': Number(`${a}${x}`) + s * b,
        'one more': a * x + s * b + 1,
        'one less': a * x + s * b - 1,
      },
    );
  },
);

// ---------------------------------------------------------------- equations-1 (Y7)

const eqParts = (v: string) => [v, '=', '?'];

/** "t + 7 = 12" or "t − 3 = 5". */
const eqAdd = oneKey(
  'alg:eq-add',
  'One-step equation with + or − (t + 7 = 12)',
  Y7,
  4,
  (_k, r) => {
    const minus = int(r, 0, 1);
    const a = int(r, 2, 12);
    return [rollLetter(r), minus, a, minus ? int(r, a + 1, a + 12) : int(r, 2, 12)];
  },
  (_k, [li, minus, a, t]) => {
    if (!letterOk(li) || !isInt(minus, 0, 1) || !isInt(a, 2, 12) || !isInt(t, 2, 24) || (minus ? t <= a : t > 12)) return null;
    const v = LETTERS[li];
    const rhs = minus ? t - a : t + a;
    const eq = `${v} ${minus ? '−' : '+'} ${a} = ${rhs}`;
    return withMistakes(
      { parts: eqParts(v), prompt: `If ${eq}`, spoken: `If ${sayAlg(eq)}, what is ${v}?`, answer: t },
      { 'did the wrong operation': minus ? rhs - a : rhs + a, 'gave the number in the equation': a, 'gave the right-hand side': rhs, 'one more': t + 1, 'one less': t - 1 },
    );
  },
);

/** "3a = 18". */
const eqMul = oneKey(
  'alg:eq-mul',
  'One-step equation with × (3a = 18)',
  Y7,
  3,
  (_k, r) => [rollLetter(r), int(r, 2, 9), int(r, 2, 9)],
  (_k, [li, a, v]) => {
    if (!letterOk(li) || !isInt(a, 2, 9) || !isInt(v, 2, 9)) return null;
    const x = LETTERS[li];
    const eq = `${a}${x} = ${a * v}`;
    return withMistakes(
      { parts: eqParts(x), prompt: `If ${eq}`, spoken: `If ${sayAlg(eq)}, what is ${x}?`, answer: v },
      { 'took away': a * v - a, 'added': a * v + a, 'gave the number in front': a, 'gave the right-hand side': a * v, 'one more': v + 1, 'one less': v - 1 },
    );
  },
);

/** "x ÷ 4 = 6". */
const eqDiv = oneKey(
  'alg:eq-div',
  'One-step equation with ÷ (x ÷ 4 = 6)',
  Y7,
  3,
  (_k, r) => [rollLetter(r), int(r, 2, 9), int(r, 2, 9)],
  (_k, [li, a, v]) => {
    if (!letterOk(li) || !isInt(a, 2, 9) || !isInt(v, 2, 9)) return null;
    const x = LETTERS[li];
    const eq = `${x} ÷ ${a} = ${v}`;
    return withMistakes(
      { parts: eqParts(x), prompt: `If ${eq}`, spoken: `If ${sayAlg(eq)}, what is ${x}?`, answer: a * v },
      { 'added': v + a, 'took away': v - a, 'gave the number divided by': a, 'gave the right-hand side': v, 'one more': a * v + 1, 'one less': a * v - 1 },
    );
  },
);

/** "5s + 3 = 18" (two steps). */
const eqTwo = oneKey(
  'alg:eq-two',
  'Two-step equation (5s + 3 = 18)',
  Y7,
  5,
  (_k, r) => [rollLetter(r), int(r, 2, 6), int(r, 2, 9), int(r, 1, 9), int(r, 0, 1)],
  (_k, [li, a, s, b, minus]) => {
    if (!letterOk(li) || !isInt(a, 2, 6) || !isInt(s, 2, 9) || !isInt(b, 1, 9) || !isInt(minus, 0, 1)) return null;
    if (minus && a * s - b < 1) return null;
    const v = LETTERS[li];
    const rhs = minus ? a * s - b : a * s + b;
    const eq = `${a}${v} ${minus ? '−' : '+'} ${b} = ${rhs}`;
    return withMistakes(
      { parts: eqParts(v), prompt: `If ${eq}`, spoken: `If ${sayAlg(eq)}, what is ${v}?`, answer: s },
      {
        'forgot to divide': a * s,
        'did the wrong operation first': minus ? rhs - b : rhs + b,
        'gave the number in front': a,
        'gave the right-hand side': rhs,
        'one more': s + 1,
        'one less': s - 1,
      },
    );
  },
);

// ---------------------------------------------------------------- like-terms (Y7)

/** "3a + a + a = ?a". */
const likeAdd = oneKey(
  'alg:like-add',
  'Adding like terms (3a + a + a = ?a)',
  Y7,
  4,
  (_k, r) => [rollLetter(r), int(r, 1, 6), int(r, 1, 6), int(r, 0, 6)],
  (_k, [li, c1, c2, c3]) => {
    if (!letterOk(li) || !isInt(c1, 1, 6) || !isInt(c2, 1, 6) || !isInt(c3, 0, 6)) return null;
    const cs = c3 ? [c1, c2, c3] : [c1, c2];
    const sum = cs.reduce((x, y) => x + y, 0);
    if (sum > 12 || Math.max(...cs) === 1) return null;
    const v = LETTERS[li];
    const expr = cs.map((c) => coef(c, v)).join(' + ');
    return withMistakes(
      { parts: [expr, '=', `?${v}`], spoken: `${sayAlg(expr)} equals what ${v}?`, answer: sum },
      {
        'multiplied': cs.reduce((x, y) => x * y, 1),
        'counted the letters': cs.length,
        'ignored the lone letters': cs.filter((c) => c > 1).reduce((x, y) => x + y, 0),
        'one more': sum + 1,
        'one less': sum - 1,
      },
    );
  },
);

/** "7b − 2b = ?b". */
const likeSub = oneKey(
  'alg:like-sub',
  'Taking away like terms (7b − 2b = ?b)',
  Y7,
  3,
  (_k, r) => {
    const p = int(r, 3, 12);
    return [rollLetter(r), p, int(r, 1, p - 1)];
  },
  (_k, [li, p, q]) => {
    if (!letterOk(li) || !isInt(p, 3, 12) || !isInt(q, 1, p - 1)) return null;
    const v = LETTERS[li];
    const expr = `${coef(p, v)} − ${coef(q, v)}`;
    return withMistakes(
      { parts: [expr, '=', `?${v}`], spoken: `${sayAlg(expr)} equals what ${v}?`, answer: p - q },
      { 'added': p + q, 'gave the first number': p, 'gave the second number': q, 'one more': p - q + 1, 'one less': p - q - 1 },
    );
  },
);

// ---------------------------------------------------------------- patterns-rule (Y7)

/** "4, 7, 10, 13, ?": the next term, going up or down. */
const patNext = oneKey(
  'alg:pat-next',
  'The next number in a pattern (4, 7, 10, 13)',
  Y7,
  3,
  (_k, r) => {
    const down = int(r, 0, 1);
    const step = int(r, 2, down ? 7 : 9);
    return [down, down ? 4 * step + int(r, 1, 9) : int(r, 1, 10), step];
  },
  (_k, [down, start, step]) => {
    if (!isInt(down, 0, 1) || !isInt(step, 2, 9) || !isInt(start, 1, 50)) return null;
    const s = down ? -step : step;
    if (down && start + 4 * s < 1) return null;
    const shown = [0, 1, 2, 3].map((i) => start + i * s);
    const last = shown[3];
    const parts = [...shown.map((n) => `${n},`), '?'];
    return withMistakes(
      { parts, prompt: 'What comes next?', spoken: `${shown.join(', ')}, what comes next?`, answer: last + s },
      {
        'repeated the last number': last,
        'went the other way': last - s,
        'added the last two numbers': last + shown[2],
        'one more': last + s + 1,
        'one less': last + s - 1,
        'jumped twice': last + 2 * s,
      },
    );
  },
);

const ordinal = (n: number) => `${n}th`;

/** "Rule t = 3n + 4, the 10th term" (two steps). */
const patTerm = oneKey(
  'alg:pat-term',
  'A term from its rule (t = 3n + 4, the 10th term)',
  Y7,
  3,
  (_k, r) => [int(r, 2, 6), int(r, 1, 9), int(r, 6, 10)],
  (_k, [a, b, n]) => {
    if (!isInt(a, 2, 6) || !isInt(b, 1, 9) || !isInt(n, 6, 10)) return null;
    const rule = `${a}n + ${b}`;
    return withMistakes(
      { parts: [`${ordinal(n)} term`, '=', '?'], prompt: `Rule: t = ${rule}`, spoken: `The rule is t equals ${sayAlg(rule)}. What is the ${n}th term?`, answer: a * n + b },
      {
        'forgot the last number': a * n,
        'added everything': a + n + b,
        'added before multiplying': a * (n + b),
        'took the next term': a * (n + 1) + b,
        'took the one before': a * (n - 1) + b,
      },
    );
  },
);

/** "Which rule makes 5, 9, 13, 17?" (pick the rule). */
const patRule = oneKey(
  'alg:pat-rule',
  'Which rule makes a pattern (5, 9, 13, 17)',
  Y7,
  4,
  (_k, r) => {
    const d = int(r, 2, 6);
    const b = int(r, -3, 6);
    return withPick(r, d, b === 0 ? 1 : b);
  },
  (_k, [d, b, slot, salt]) => {
    if (!isInt(d, 2, 6) || !isInt(b, -3, 6) || b === 0 || !goodPick(slot, salt)) return null;
    const rule = (m: number, c: number) => `${coef(m, 'n')}${c === 0 ? '' : ` ${c < 0 ? '−' : '+'} ${Math.abs(c)}`}`;
    const first = d + b;
    if (first < 1) return null;
    const terms = [0, 1, 2, 3].map((i) => first + i * d);
    const right = rule(d, b);
    const named: Record<string, string> = {
      'added the step to n': rule(1, d),
      'forgot the start': rule(d, 0),
      'used the first term as the start': rule(d, first),
      'used the first term as the multiplier': rule(first, 0),
      'swapped the numbers': b > 0 ? rule(b, d) : rule(d, -b),
    };
    const made = pick({ parts: ['t', '=', '?'], spoken: `Which rule makes ${terms.join(', ')}?`, fact: `${right} makes ${terms.join(', ')}` }, right, named, { slot, salt });
    return made ? { ...made, prompt: `Which rule makes ${terms.join(', ')}?` } : null;
  },
);

// ---------------------------------------------------------------- true-false-sentences (Y7)

/**
 * "Which sign makes it true?" two sides and four signs to tap. The right one is < or ≤ (or > or ≥) the right way round; the
 * others are the turned-round signs and "=". The sides are never equal, so only one sentence is true.
 */
function sentences(left: string, lv: number, right: string, rv: number, lenient: number, swap: number, slot: number, salt: number): Made | null {
  if (lv === rv || !isInt(lenient, 0, 1) || !isInt(swap, 0, 1) || !goodPick(slot, salt)) return null;
  // Written as `first sign second`: the sentence reads left to right in the order shown.
  const [first, second, fv, sv] = swap ? [right, left, rv, lv] : [left, right, lv, rv];
  const less = fv < sv;
  const say = (sign: string) => `${first} ${sign} ${second}`;
  const truth = less ? (lenient ? '≤' : '<') : lenient ? '≥' : '>';
  const wrongSigns = less ? ['>', '≥', '='] : ['<', '≤', '='];
  const names = ['turned the sign round', 'turned the sign round (or equal)', 'thought they were equal'];
  const named = Object.fromEntries(wrongSigns.map((s, i) => [names[i], s]));
  const spoken = `${sayAlg(first)}, which sign goes in the gap, then ${sayAlg(second)}?`;
  const made = pick({ parts: [first, '?', second], spoken, fact: `${say(truth)} is true` }, truth, named, { slot, salt });
  return made ? { ...made, prompt: 'Which sign makes it true?' } : null;
}

/** "6 × 4 < 9 + 18". */
const tfWhole = oneKey(
  'alg:tf-whole',
  'True or false with <, ≤, ≥, > (6 × 4 < 9 + 18)',
  Y7,
  8,
  (_k, r) => withPick(r, int(r, 2, 9), int(r, 2, 9), int(r, 2, 20), int(r, 2, 20), int(r, 0, 1), int(r, 0, 1)),
  (_k, [a, b, c, d, lenient, swap, slot, salt]) => {
    if (!isInt(a, 2, 9) || !isInt(b, 2, 9) || !isInt(c, 2, 20) || !isInt(d, 2, 20)) return null;
    const lv = a * b;
    const rv = c + d;
    if (Math.abs(lv - rv) < 1 || Math.abs(lv - rv) > 8 || lv < 8 || rv < 8) return null;
    return sentences(`${a} × ${b}`, lv, `${c} + ${d}`, rv, lenient, swap, slot, salt);
  },
);

/** "0.8 × 12 ≤ 8 + 4". */
const tfDec = oneKey(
  'alg:tf-dec',
  'True or false with decimals (0.8 × 12 ≤ 8 + 4)',
  Y7,
  8,
  (_k, r) => withPick(r, int(r, 2, 9), int(r, 4, 15), int(r, 2, 9), int(r, 2, 9), int(r, 0, 1), int(r, 0, 1)),
  (_k, [tenths, q, c, d, lenient, swap, slot, salt]) => {
    if (!isInt(tenths, 2, 9) || !isInt(q, 4, 15) || !isInt(c, 2, 9) || !isInt(d, 2, 9)) return null;
    // Compared in tenths, so there is no floating-point dust.
    const diff = tenths * q - 10 * (c + d);
    if (Math.abs(diff) < 5 || Math.abs(diff) > 60) return null;
    return sentences(`0.${tenths} × ${q}`, tenths * q, `${c} + ${d}`, 10 * (c + d), lenient, swap, slot, salt);
  },
);

// ---------------------------------------------------------------- equations-2 (Y8)

/** "t + 7 = 6.5": a decimal answer, below zero as often as not. */
const eq2Dec = oneKey(
  'alg:eq2-dec',
  'Equation with a decimal answer (t + 7 = 6.5)',
  Y8,
  5,
  (_k, r) => {
    const a = int(r, 2, 9);
    // The answer in halves (−9 to 9, never a whole number): −1 is −0.5, 5 is 2.5.
    let h = int(r, -4, 4) * 2 + 1;
    if (a + h / 2 < 0.5) h = -h;
    return withPick(r, int(r, 0, 7), a, h);
  },
  (_k, [li, a, h, slot, salt]) => {
    if (!letterOk(li) || !isInt(a, 2, 9) || !isInt(h, -9, 9) || Math.abs(h) % 2 !== 1) return null;
    const ans = h / 2;
    const rhs = a + ans;
    if (rhs < 0.5) return null;
    const v = LETTERS[li];
    const eq = `${v} + ${a} = ${rhs}`;
    return signed(
      { parts: eqParts(v), prompt: `If ${eq}`, spoken: `If ${sayAlg(eq)}, what is ${v}?`, decimal: true },
      ans,
      { 'added instead': rhs + a, 'turned the answer round': -ans, 'gave the right-hand side': rhs, 'gave the number in the equation': a, 'one more': ans + 1, 'one less': ans - 1, 'half a unit more': ans + 0.5 },
      slot,
      salt,
    );
  },
);

/** "t − 3 ≥ −5, so t ≥ ?". */
const eq2Ineq = oneKey(
  'alg:eq2-ineq',
  'Inequality with a negative answer (t − 3 ≥ −5)',
  Y8,
  7,
  (_k, r) => withPick(r, rollLetter(r), int(r, 0, 1), int(r, 1, 9), int(r, -8, 8), int(r, 0, 1)),
  (_k, [li, minus, b, c, atMost, slot, salt]) => {
    if (!letterOk(li) || !isInt(minus, 0, 1) || !isInt(b, 1, 9) || !isInt(c, -8, 8) || !isInt(atMost, 0, 1)) return null;
    const v = LETTERS[li];
    const ans = minus ? c + b : c - b;
    if (ans === c) return null;
    const sign = atMost ? '≤' : '≥';
    const eq = `${v} ${minus ? '−' : '+'} ${b} ${sign} ${signedText(c)}`;
    const words = `${sayAlg(`${v} ${minus ? '−' : '+'} ${b}`)} ${SIGN_WORDS[sign]} ${sayAlg(signedText(c))}`;
    return signed(
      { parts: [v, sign, '?'], prompt: `If ${eq}`, spoken: `If ${words}, then ${v} ${SIGN_WORDS[sign]} what?`.replace(/\bis (at (?:least|most)) what\?/, '$1 what?') },
      ans,
      { 'did the wrong operation': minus ? c - b : c + b, 'turned the answer round': -ans, 'gave the right-hand side': c, 'gave the number in the equation': b, 'one more': ans + 1, 'one less': ans - 1 },
      slot,
      salt,
    );
  },
);

/** "2x + 9 = 1": two steps, an answer below zero as often as not. */
const eq2Two = oneKey(
  'alg:eq2-two',
  'Two-step equation with a negative answer (2x + 9 = 1)',
  Y8,
  6,
  (_k, r) => {
    for (;;) {
      const a = int(r, 2, 5);
      const x = int(r, -6, 5);
      const b = int(r, 1, 9);
      if (x !== 0 && a * x + b >= 0) return withPick(r, rollLetter(r), a, x, b);
    }
  },
  (_k, [li, a, x, b, slot, salt]) => {
    if (!letterOk(li) || !isInt(a, 2, 5) || !isInt(x, -6, 5) || x === 0 || !isInt(b, 1, 9) || a * x + b < 0) return null;
    const v = LETTERS[li];
    const rhs = a * x + b;
    const eq = `${a}${v} + ${b} = ${rhs}`;
    return signed(
      { parts: eqParts(v), prompt: `If ${eq}`, spoken: `If ${sayAlg(eq)}, what is ${v}?`, decimal: false },
      x,
      {
        'forgot to divide': rhs - b,
        'added the number': (rhs + b) / a,
        'turned the answer round': -x,
        'gave the right-hand side': rhs,
        'one more': x + 1,
        'one less': x - 1,
        'did not take it away': rhs / a,
      },
      slot,
      salt,
    );
  },
);

// ---------------------------------------------------------------- the lot

export const ALGEBRA_FAMILIES: Record<string, Family> = Object.fromEntries(
  [subSq, subArea, subLin, eqAdd, eqMul, eqDiv, eqTwo, likeAdd, likeSub, patNext, patTerm, patRule, tfWhole, tfDec, eq2Dec, eq2Ineq, eq2Two].map((f) => [f.keys[0], f]),
);

export const ALGEBRA_SKILL_KEYS = {
  substitute: ['alg:sub-sq', 'alg:sub-area', 'alg:sub-lin'],
  'equations-1': ['alg:eq-add', 'alg:eq-mul', 'alg:eq-div', 'alg:eq-two'],
  'like-terms': ['alg:like-add', 'alg:like-sub'],
  'patterns-rule': ['alg:pat-next', 'alg:pat-term', 'alg:pat-rule'],
  'true-false-sentences': ['alg:tf-whole', 'alg:tf-dec'],
  'equations-2': ['alg:eq2-dec', 'alg:eq2-ineq', 'alg:eq2-two'],
};

/** The two-step types: 12 seconds to count as quick. */
export const ALGEBRA_SLOW_KEYS: string[] = ['alg:sub-lin', 'alg:eq-two', 'alg:pat-term', 'alg:tf-whole', 'alg:tf-dec', 'alg:eq2-two'];

export const ALGEBRA_LADDER: { id: keyof typeof ALGEBRA_SKILL_KEYS; label: string; tiny: string; stage: 'algebra'; year: 7 | 8; tags: string[] }[] = [
  { id: 'substitute', label: 'Putting a number in a letter', tiny: 'Putting in a number', stage: 'algebra', year: 7, tags: Y7 },
  { id: 'equations-1', label: 'One- and two-step equations', tiny: 'Solving equations', stage: 'algebra', year: 7, tags: Y7 },
  { id: 'like-terms', label: 'Collecting like terms', tiny: 'Collecting terms', stage: 'algebra', year: 7, tags: Y7 },
  { id: 'patterns-rule', label: 'Pattern rules', tiny: 'Pattern rules', stage: 'algebra', year: 7, tags: Y7 },
  { id: 'true-false-sentences', label: 'True or false with < and ≤', tiny: 'True or false, < ≤', stage: 'algebra', year: 7, tags: Y7 },
  { id: 'equations-2', label: 'Equations below zero', tiny: 'Equations below 0', stage: 'algebra', year: 8, tags: Y8 },
];
