/**
 * Number facts for Year 7 and 8: decimals, estimating, fractions, percent change, ratio and money (docs/plans/ladder-7-8/PLAN.md
 * section 3c, card Y5). Recall, not working: small friendly numbers, one number to type or one of four choices to tap.
 *
 * Typed answers are decimals where a point can be needed (`input: 'decimal'`) and are tidied to 3 places so no floating dust
 * is ever shown. A fraction answer is four choices to tap in its simplest form, always under one. Wrong choices are the answers
 * named slips give, never random numbers. Money parts read '$40', and the blank is '$' then '?'.
 *
 * Types (all keys start `nf:`):
 *   decimal-facts     (Y7) nf:dec-tenth  nf:dec-tens  nf:dec-hund  nf:dec-div
 *   estimate          (Y7) nf:est-times
 *   fraction-add-easy (Y7) nf:fadd  nf:fsub
 *   fraction-divide   (Y7) nf:fdiv-whole  nf:fdiv-frac
 *   percent-change    (Y7) nf:pc-off*  nf:pc-more*  nf:pc-swap
 *   ratio             (Y7) nf:ratio-eq  nf:ratio-share*  nf:ratio-blue*
 *   money             (Y7) nf:change  nf:cash
 *   round-thousandth  (Y8) nf:round-3dp
 *   fraction-times    (Y8) nf:ftimes
 * (* two-step: NUMFACT_SLOW_KEYS)
 */
import { dollars, int, isInt, pickOne, show, tidy, type Family, type Made } from '../banded';
import { oneKey, say, withMistakes } from './generatedKit';
import { frac, gcd, goodPick, labelValue, pick, rollPick, talk, type PickBase } from './pickKit';

const DEC_TAGS = ['MS.Y7.NUM.RN.P1', 'MS.Y7.NUM.RN.P2'];
const EST_TAGS = ['MS.Y7.NUM.NS.P1'];
const FADD_TAGS = ['MS.Y7.NUM.RN.P3'];
const FDIV_TAGS = ['MS.Y7.NUM.RN.P4'];
const PCT_TAGS = ['MS.Y7.NUM.RN.P5'];
const RATIO_TAGS = ['MS.Y7.NUM.RN.P6'];
const MONEY_TAGS = ['MS.Y7.NUM.RN.P7'];
const ROUND_TAGS = ['MS.Y8.NUM.NS.P1'];
const FTIMES_TAGS = ['MS.Y8.NUM.RN.P3'];

/** The two pick numbers every pick family here ends with. */
const withPick = (random: () => number, ...params: number[]) => [...params, ...rollPick(random)];

/** A fraction label in its simplest form ("6/12" → "1/2"). */
const simple = (n: number, d: number) => {
  const g = gcd(n, d);
  return frac(n / g, d / g);
};
/** A fraction label, or an empty one (dropped later) when it has no top or bottom. */
const lab = (n: number, d: number) => (n > 0 && d > n && Number.isInteger(n) && Number.isInteger(d) ? frac(n, d) : '');

/**
 * A fraction pick: the right label (simplest form) and slips by name. A slip with the right value but a different shape
 * ("did not simplify") is a wrong choice on purpose; any other slip that has the right value, or the value of an earlier slip, is dropped.
 */
function fracPick(base: PickBase, right: string, named: Record<string, string>, slot: number, salt: number): Made | null {
  const rightValue = labelValue(right);
  if (rightValue === null) return null;
  const clean: Record<string, string> = {};
  const seen: number[] = [];
  for (const [name, label] of Object.entries(named)) {
    const v = label ? labelValue(label) : null;
    if (v === null || label === right) continue;
    if (name !== 'did not simplify') {
      if (Math.abs(v - rightValue) < 1e-9 || seen.some((x) => Math.abs(x - v) < 1e-9)) continue;
      seen.push(v);
    }
    clean[name] = label;
  }
  const made = pick(base, right, clean, { slot, salt, allowEqual: true });
  return made ? { ...made, prompt: 'Give the answer in its simplest form.' } : null;
}

// ---------------------------------------------------------------- decimal-facts (Y7)

const RIGHT10 = 'point one place too far right (10 times too big)';
const LEFT10 = 'point one place too far left (10 times too small)';

/** 0.7 × 5 = 3.5: tenths times a single digit. */
const decTenth = oneKey(
  'nf:dec-tenth',
  'A tenth number times a single digit (0.7 × 5)',
  DEC_TAGS,
  2,
  (_k, r) => [int(r, 2, 9), int(r, 2, 9)],
  (_k, [a, b]) => {
    if (!isInt(a, 2, 9) || !isInt(b, 2, 9)) return null;
    const parts = [show(a / 10), '×', String(b), '=', '?'];
    const answer = tidy((a * b) / 10);
    return withMistakes({ parts, spoken: talk(parts), answer, input: 'decimal' }, { [RIGHT10]: answer * 10, [LEFT10]: answer / 10, 'added the numbers': tidy(a / 10 + b), 'one tenth too many': answer + 0.1, 'one tenth too few': answer - 0.1 });
  },
);

/** 0.7 × 50 = 35: tenths times a multiple of ten. */
const decTens = oneKey(
  'nf:dec-tens',
  'A tenth number times a multiple of ten (0.7 × 50)',
  DEC_TAGS,
  2,
  (_k, r) => [int(r, 2, 9), int(r, 2, 9)],
  (_k, [a, m]) => {
    if (!isInt(a, 2, 9) || !isInt(m, 2, 9)) return null;
    const parts = [show(a / 10), '×', String(m * 10), '=', '?'];
    const answer = a * m;
    return withMistakes({ parts, spoken: talk(parts), answer, input: 'decimal' }, { [RIGHT10]: answer * 10, [LEFT10]: answer / 10, 'added the numbers': tidy(a / 10 + m * 10), 'one too many': answer + 1, 'one too few': answer - 1 });
  },
);

/** 0.04 × 6 = 0.24: hundredths times a single digit. */
const decHund = oneKey(
  'nf:dec-hund',
  'A hundredth number times a single digit (0.04 × 6)',
  DEC_TAGS,
  2,
  (_k, r) => [int(r, 2, 9), int(r, 2, 9)],
  (_k, [a, b]) => {
    if (!isInt(a, 2, 9) || !isInt(b, 2, 9)) return null;
    const parts = [show(a / 100), '×', String(b), '=', '?'];
    const answer = tidy((a * b) / 100);
    return withMistakes({ parts, spoken: talk(parts), answer, input: 'decimal' }, { [RIGHT10]: answer * 10, [LEFT10]: answer / 10, 'one hundredth too many': answer + 0.01, 'one hundredth too few': answer - 0.01 });
  },
);

/** 2.4 ÷ 8 = 0.3: a tenths number divided by a single digit, from the fact 24 ÷ 8 = 3. */
const decDiv = oneKey(
  'nf:dec-div',
  'A decimal divided by a single digit (2.4 ÷ 8)',
  DEC_TAGS,
  2,
  (_k, r) => [int(r, 2, 9), int(r, 2, 9)],
  (_k, [b, k]) => {
    if (!isInt(b, 2, 9) || !isInt(k, 2, 9) || (b * k) % 10 === 0) return null;
    const parts = [show((b * k) / 10), '÷', String(b), '=', '?'];
    const answer = k / 10;
    return withMistakes({ parts, spoken: talk(parts), answer, input: 'decimal' }, { [RIGHT10]: k, [LEFT10]: k / 100, 'one tenth too many': answer + 0.1, 'one tenth too few': answer - 0.1 });
  },
);

// ---------------------------------------------------------------- estimate (Y7)

/** 19.8 × 5 is about 100: round the decimal to the nearest ten first, four round-number choices. */
const estTimes = oneKey(
  'nf:est-times',
  'Estimating a times by rounding (19.8 × 5 is about 100)',
  EST_TAGS,
  5,
  (_k, r) => withPick(r, int(r, 2, 9), int(r, -4, 4), int(r, 2, 9)),
  (_k, [k, d, b, slot, salt]) => {
    if (!isInt(k, 2, 9) || !isInt(d, -4, 4) || d === 0 || !isInt(b, 2, 9) || !goodPick(slot, salt)) return null;
    const a = show(10 * k + d / 10);
    const right = 10 * k * b;
    const parts = [a, '×', String(b), '≈', '?'];
    const named: Record<string, string> = {
      'zero in the wrong place (10 times too big)': String(right * 10),
      'zero left off (10 times too small)': String(right / 10),
      'rounded the wrong way': String(10 * (d < 0 ? k - 1 : k + 1) * b),
      'added instead of multiplying': String(10 * k + b),
    };
    const made = pick({ parts, spoken: `${say(10 * k + d / 10)} times ${b} is about what?`, fact: `${a} × ${b} is about ${right}` }, String(right), named, { slot, salt });
    return made ? { ...made, prompt: 'Round first, then estimate.' } : null;
  },
);

// ---------------------------------------------------------------- fraction-add-easy (Y7)

interface Pair {
  a: number;
  b: number;
  c: number;
  d: number;
}
/** Bottoms where one is a multiple of the other, the bigger one at most 12. */
const RELATED: [number, number][] = [[2, 4], [2, 6], [2, 8], [3, 6], [3, 9], [3, 12], [4, 8], [4, 12], [5, 10], [4, 2], [6, 2], [8, 2], [6, 3], [9, 3], [12, 3], [8, 4], [12, 4], [10, 5]];
const propers = (b: number) => Array.from({ length: b - 1 }, (_, i) => i + 1).filter((a) => gcd(a, b) === 1);
/** Every a/b ± c/d with related bottoms. Sums stay under one; differences stay above zero. */
const pairs = (keep: (p: Pair) => boolean): Pair[] =>
  RELATED.flatMap(([b, d]) => propers(b).flatMap((a) => propers(d).map((c) => ({ a, b, c, d })))).filter(keep);
const ADDS = pairs(({ a, b, c, d }) => a / b + c / d < 1);
const SUBS = pairs(({ a, b, c, d }) => a / b - c / d > 0);

/** ½ + ¼ = ¾ (four fraction labels). */
const fAdd = oneKey(
  'nf:fadd',
  'Adding fractions with related bottoms (½ + ¼)',
  FADD_TAGS,
  3,
  (_k, r) => withPick(r, int(r, 0, ADDS.length - 1)),
  (_k, [i, slot, salt]) => {
    if (!isInt(i, 0, ADDS.length - 1) || !goodPick(slot, salt)) return null;
    const { a, b, c, d } = ADDS[i];
    const bottom = Math.max(b, d);
    const top = a * (bottom / b) + c * (bottom / d);
    const g = gcd(top, bottom);
    const right = simple(top, bottom);
    const parts = [frac(a, b), '+', frac(c, d), '=', '?'];
    const named: Record<string, string> = {
      'added the tops and the bottoms': lab(a + c, b + d),
      'added the tops, kept the bigger bottom': lab(a + c, bottom),
      'added the tops, kept the smaller bottom': lab(a + c, Math.min(b, d)),
      'did not simplify': lab(top, bottom),
      'took away instead': lab(Math.abs(a * (bottom / b) - c * (bottom / d)), bottom),
      'one too many on the top': lab(top / g + 1, bottom / g),
    };
    return fracPick({ parts, spoken: talk(parts), fact: `${parts[0]} + ${parts[2]} = ${right}` }, right, named, slot, salt);
  },
);

/** ⅔ − ⅙ = ½. */
const fSub = oneKey(
  'nf:fsub',
  'Taking away fractions with related bottoms (⅔ − ⅙)',
  FADD_TAGS,
  3,
  (_k, r) => withPick(r, int(r, 0, SUBS.length - 1)),
  (_k, [i, slot, salt]) => {
    if (!isInt(i, 0, SUBS.length - 1) || !goodPick(slot, salt)) return null;
    const { a, b, c, d } = SUBS[i];
    const bottom = Math.max(b, d);
    const top = a * (bottom / b) - c * (bottom / d);
    const g = gcd(top, bottom);
    const right = simple(top, bottom);
    const parts = [frac(a, b), '−', frac(c, d), '=', '?'];
    const named: Record<string, string> = {
      'took the tops away, kept the bigger bottom': lab(a - c, bottom),
      'took the tops away, kept the first bottom': lab(a - c, b),
      'took the tops and the bottoms away': lab(a - c, b - d),
      'did not simplify': lab(top, bottom),
      'added instead': lab(a * (bottom / b) + c * (bottom / d), bottom),
      'one too many on the top': lab(top / g + 1, bottom / g),
      'one too few on the top': lab(top / g - 1, bottom / g),
    };
    return fracPick({ parts, spoken: talk(parts), fact: `${parts[0]} − ${parts[2]} = ${right}` }, right, named, slot, salt);
  },
);

// ---------------------------------------------------------------- fraction-divide (Y7)

/** 4 ÷ 1/3 = 12 (typed). */
const fDivWhole = oneKey(
  'nf:fdiv-whole',
  'A whole number divided by a unit fraction (4 ÷ ⅓)',
  FDIV_TAGS,
  2,
  (_k, r) => [int(r, 2, 9), int(r, 2, 6)],
  (_k, [w, d]) => {
    if (!isInt(w, 2, 9) || !isInt(d, 2, 6)) return null;
    const parts = [String(w), '÷', frac(1, d), '=', '?'];
    const answer = w * d;
    return withMistakes({ parts, spoken: talk(parts), answer }, { 'divided by the bottom number': w / d, 'gave the bottom number': d, 'added them': w + d, 'gave the whole number': w, 'one too many': answer + 1, 'one too few': answer - 1 });
  },
);

/** 1/2 ÷ 3 = 1/6 (tap). */
const fDivFrac = oneKey(
  'nf:fdiv-frac',
  'A unit fraction divided by a whole number (½ ÷ 3)',
  FDIV_TAGS,
  4,
  (_k, r) => withPick(r, int(r, 2, 4), int(r, 2, 5)),
  (_k, [b, c, slot, salt]) => {
    if (!isInt(b, 2, 4) || !isInt(c, 2, 5) || !goodPick(slot, salt)) return null;
    const parts = [frac(1, b), '÷', String(c), '=', '?'];
    const right = frac(1, b * c);
    const named: Record<string, string> = {
      'used the whole number as the bottom': lab(1, c),
      'added the bottoms': lab(1, b + c),
      'did nothing to it': lab(1, b),
      'multiplied instead of dividing': c <= b ? lab(c, b) : '',
      'divided the bottom by the number': b % c === 0 ? lab(1, b / c) : '',
    };
    return fracPick({ parts, spoken: talk(parts), fact: `${parts[0]} ÷ ${c} = ${right}` }, right, named, slot, salt);
  },
);

// ---------------------------------------------------------------- percent-change (Y7)

const CHANGES = [10, 20, 25, 50];
const worth = (p: number, k: number) => (p === 25 ? 20 * k : 10 * k);

/** 20% off $40 = $32 (two steps). */
const pcOff = oneKey(
  'nf:pc-off',
  'A percent off a price (20% off $40)',
  PCT_TAGS,
  2,
  (_k, r) => [int(r, 0, 3), int(r, 2, 10)],
  (_k, [pi, k]) => {
    if (!isInt(pi, 0, 3) || !isInt(k, 2, 10)) return null;
    const p = CHANGES[pi];
    const amount = worth(p, k);
    const off = (amount * p) / 100;
    const parts = ['Sale price', '=', '$', '?'];
    const spoken = `${p} percent off ${amount} dollars. How many dollars?`;
    return withMistakes({ parts, spoken, answer: amount - off, prompt: `${p}% off $${show(amount)}` }, { 'gave the discount': off, 'added it on': amount + off, 'took the percent number off': amount - p, 'took off 10% only': (amount * 90) / 100, 'took it off twice': amount - 2 * off });
  },
);

/** 10% more than $30 = $33 (two steps). */
const pcMore = oneKey(
  'nf:pc-more',
  'A percent more than a price (10% more than $30)',
  PCT_TAGS,
  2,
  (_k, r) => [int(r, 0, 3), int(r, 2, 10)],
  (_k, [pi, k]) => {
    if (!isInt(pi, 0, 3) || !isInt(k, 2, 10)) return null;
    const p = CHANGES[pi];
    const amount = worth(p, k);
    const extra = (amount * p) / 100;
    const parts = ['New price', '=', '$', '?'];
    const spoken = `${p} percent more than ${amount} dollars. How many dollars?`;
    return withMistakes({ parts, spoken, answer: amount + extra, prompt: `${p}% more than $${show(amount)}` }, { 'gave the increase': extra, 'took it off instead': amount - extra, 'added the percent number': amount + p, 'added 10% only': (amount * 110) / 100, 'added it on twice': amount + 2 * extra });
  },
);

const SWAP_BOTTOMS = [10, 20, 25, 30, 40, 50, 60];
/** 45% of 20 = 20% of ? (the swap trick: 45). */
const pcSwap = oneKey(
  'nf:pc-swap',
  'The swap trick (45% of 20 = 20% of ?)',
  PCT_TAGS,
  2,
  (_k, r) => [int(r, 11, 89), pickOne(r, SWAP_BOTTOMS)],
  (_k, [a, b]) => {
    if (!isInt(a, 11, 89) || !SWAP_BOTTOMS.includes(b) || a === b) return null;
    const parts = [`${a}%`, '×', String(b), '=', `${b}%`, '×', '?'];
    return withMistakes({ parts, spoken: `${a} percent of ${b} equals ${b} percent of what?`, answer: a }, { 'gave the other number': b, 'worked out the first side': (a * b) / 100, 'added the numbers': a + b, 'multiplied the numbers': a * b, 'took it from 100': 100 - a });
  },
);

// ---------------------------------------------------------------- ratio (Y7)

/** Pairs in their simplest form, the smaller first. */
const RATIOS: [number, number][] = [[1, 2], [1, 3], [1, 4], [1, 5], [2, 3], [2, 5], [3, 4], [3, 5], [4, 5]];

/** 6 : 9 = 2 : ? (typed 3). */
const ratioEq = oneKey(
  'nf:ratio-eq',
  'An equal ratio (6 : 9 = 2 : ?)',
  RATIO_TAGS,
  3,
  (_k, r) => [int(r, 0, RATIOS.length - 1), int(r, 2, 5), int(r, 0, 1)],
  (_k, [ri, k, flip]) => {
    if (!isInt(ri, 0, RATIOS.length - 1) || !isInt(k, 2, 5) || !isInt(flip, 0, 1)) return null;
    const [lo, hi] = RATIOS[ri];
    const [a, b] = flip ? [hi, lo] : [lo, hi];
    const parts = [String(k * a), ':', String(k * b), '=', String(a), ':', '?'];
    const spoken = `${k * a} to ${k * b} equals ${a} to what?`;
    return withMistakes({ parts, spoken, answer: b }, { 'kept the same difference': a + k * (b - a), 'gave the big number': k * b, 'gave the scale factor': k, 'gave the top number': a, 'one too many': b + 1, 'one too few': b - 1 });
  },
);

/** Share 20 in the ratio 2 : 3, the bigger part (typed 12, two steps). */
const ratioShare = oneKey(
  'nf:ratio-share',
  'Sharing in a ratio, the bigger part (share 20 as 2 : 3)',
  RATIO_TAGS,
  2,
  (_k, r) => [int(r, 0, RATIOS.length - 1), int(r, 2, 6)],
  (_k, [ri, k]) => {
    if (!isInt(ri, 0, RATIOS.length - 1) || !isInt(k, 2, 6)) return null;
    const [a, b] = RATIOS[ri];
    const total = k * (a + b);
    const prompt = `Share ${total} in the ratio ${a} : ${b}.`;
    return withMistakes({ parts: ['Bigger part', '=', '?'], prompt, spoken: `Share ${total} in the ratio ${a} to ${b}. How much is the bigger part?`, answer: k * b }, { 'gave the smaller part': k * a, 'gave one share': k, 'gave the number of shares': a + b, 'took the bigger ratio number off the total': total - b, 'halved the total': total / 2 });
  },
);

/** 3 red to 7 blue and 18 red: how many blue (typed 42, two steps). */
const ratioBlue = oneKey(
  'nf:ratio-blue',
  'Using a ratio to find a count (3 red to 7 blue, 18 red)',
  RATIO_TAGS,
  3,
  (_k, r) => [int(r, 2, 8), int(r, 2, 9), int(r, 2, 6)],
  (_k, [a, b, k]) => {
    if (!isInt(a, 2, 8) || !isInt(b, 2, 9) || !isInt(k, 2, 6) || a === b) return null;
    const prompt = `${a} red to ${b} blue. There are ${k * a} red.`;
    return withMistakes({ parts: ['Blue', '=', '?'], prompt, spoken: `${a} red to ${b} blue. There are ${k * a} red. How many blue?`, answer: k * b }, { 'kept the same difference': k * a + (b - a), 'gave the ratio number': b, 'gave the scale factor': k, 'gave the total shares times the scale': (a + b) * k, 'added the ratio number to the red': k * a + b });
  },
);

// ---------------------------------------------------------------- money (Y7)

const NOTES = [10, 20, 50];
/** Change from $20 for $13.60 (typed 6.4). */
const change = oneKey(
  'nf:change',
  'Change from a note ($20 for $13.60)',
  MONEY_TAGS,
  2,
  (_k, r) => [pickOne(r, NOTES), int(r, 11, 79)],
  (_k, [pay, t]) => {
    if (!NOTES.includes(pay) || !isInt(t, 11, 79) || t % 10 === 0) return null;
    const cost = pay * 100 - t * 10;
    const whole = Math.floor(cost / 100);
    const answer = tidy((t * 10) / 100);
    const parts = [`$${pay}`, '−', dollars(cost), '=', '$', '?'];
    const spoken = `You pay ${pay} dollars for something that costs ${say(cost / 100)} dollars. What is the change in dollars?`;
    return withMistakes(
      { parts, spoken, answer, input: 'decimal', prompt: 'What is the change?' },
      { 'ignored the cents': pay - whole, 'took the cents the wrong way round': tidy(pay - whole - 1 + (cost % 100) / 100), [RIGHT10]: answer * 10, [LEFT10]: answer / 10, 'one dollar too many': answer + 1, 'one dollar too few': answer - 1 },
    );
  },
);

/** $4.37 in cash is $4.40 (typed 4.4). A cent digit of 5 is left out: only clear cases. */
const CENTS = [1, 2, 3, 4, 6, 7, 8, 9];
const cash = oneKey(
  'nf:cash',
  'Cash rounding to the nearest 10c ($4.37)',
  MONEY_TAGS,
  3,
  (_k, r) => [int(r, 1, 19), int(r, 0, 9), pickOne(r, CENTS)],
  (_k, [d, t, u]) => {
    if (!isInt(d, 1, 19) || !isInt(t, 0, 9) || !CENTS.includes(u)) return null;
    const cents = d * 100 + t * 10 + u;
    const down = d * 100 + t * 10;
    const answer = tidy((u < 5 ? down : down + 10) / 100);
    const parts = [dollars(cents), '≈', '$', '?'];
    const spoken = `${d} dollars and ${t * 10 + u} cents, rounded to the nearest 10 cents, is how many dollars?`;
    return withMistakes(
      { parts, spoken, answer, input: 'decimal', prompt: 'Cash rounding: nearest 10c.' },
      { 'rounded the wrong way': tidy((u < 5 ? down + 10 : down) / 100), 'rounded to the nearest dollar': Math.round(cents / 100), 'rounded to the nearest 5c': tidy((Math.round(cents / 5) * 5) / 100), [RIGHT10]: answer * 10 },
    );
  },
);

// ---------------------------------------------------------------- round-thousandth (Y8)

/** 3.4567 to 3 decimal places = 3.457 (typed). */
const round3 = oneKey(
  'nf:round-3dp',
  'Rounding to 3 decimal places (3.4567)',
  ROUND_TAGS,
  2,
  (_k, r) => [int(r, 1, 9), int(r, 1, 9999)],
  (_k, [w, n]) => {
    if (!isInt(w, 1, 9) || !isInt(n, 1, 9999) || n % 10 === 0) return null;
    const digits = String(n).padStart(4, '0');
    const total = w * 10000 + n;
    const answer = tidy(Math.round(total / 10) / 1000);
    const parts = [`${w}.${digits}`, '≈', '?'];
    const spoken = `${w} point ${digits.split('').join(' ')}, rounded to 3 decimal places, is what?`;
    return withMistakes(
      { parts, spoken, answer, input: 'decimal', prompt: 'Round to 3 decimal places.' },
      { 'cut off after 3 places (truncated)': tidy(Math.floor(total / 10) / 1000), 'rounded to 2 places': tidy(Math.round(total / 100) / 100), 'rounded to 1 place': tidy(Math.round(total / 1000) / 10), 'rounded up every time': tidy((Math.floor(total / 10) + 1) / 1000) },
    );
  },
);

// ---------------------------------------------------------------- fraction-times (Y8)

const FTIMES: Pair[] = [2, 3, 4, 5, 6].flatMap((b) => [2, 3, 4, 5, 6].flatMap((d) => propers(b).flatMap((a) => propers(d).map((c) => ({ a, b, c, d })))));

/** 2/3 × 3/4 = 1/2. */
const fTimes = oneKey(
  'nf:ftimes',
  'A fraction times a fraction (⅔ × ¾)',
  FTIMES_TAGS,
  3,
  (_k, r) => withPick(r, int(r, 0, FTIMES.length - 1)),
  (_k, [i, slot, salt]) => {
    if (!isInt(i, 0, FTIMES.length - 1) || !goodPick(slot, salt)) return null;
    const { a, b, c, d } = FTIMES[i];
    const right = simple(a * c, b * d);
    const parts = [frac(a, b), '×', frac(c, d), '=', '?'];
    const named: Record<string, string> = {
      'added the tops and the bottoms': lab(a + c, b + d),
      'did not simplify': lab(a * c, b * d),
      'crossed the wrong way (flipped the second fraction)': lab(a * d, b * c),
      'multiplied the tops, added the bottoms': lab(a * c, b + d),
      'multiplied the tops, kept one bottom': lab(a * c, b),
      'multiplied the tops, kept the other bottom': lab(a * c, d),
    };
    return fracPick({ parts, spoken: talk(parts), fact: `${parts[0]} × ${parts[2]} = ${right}` }, right, named, slot, salt);
  },
);

// ---------------------------------------------------------------- the lot

export const NUMFACT_FAMILIES: Record<string, Family> = Object.fromEntries(
  [decTenth, decTens, decHund, decDiv, estTimes, fAdd, fSub, fDivWhole, fDivFrac, pcOff, pcMore, pcSwap, ratioEq, ratioShare, ratioBlue, change, cash, round3, fTimes].map((f) => [f.keys[0], f]),
);

export const NUMFACT_SKILL_KEYS = {
  'decimal-facts': ['nf:dec-tenth', 'nf:dec-tens', 'nf:dec-hund', 'nf:dec-div'],
  estimate: ['nf:est-times'],
  'fraction-add-easy': ['nf:fadd', 'nf:fsub'],
  'fraction-divide': ['nf:fdiv-whole', 'nf:fdiv-frac'],
  'percent-change': ['nf:pc-off', 'nf:pc-more', 'nf:pc-swap'],
  ratio: ['nf:ratio-eq', 'nf:ratio-share', 'nf:ratio-blue'],
  money: ['nf:change', 'nf:cash'],
  'round-thousandth': ['nf:round-3dp'],
  'fraction-times': ['nf:ftimes'],
};

/** The two-step types: 12 seconds to count as quick. */
export const NUMFACT_SLOW_KEYS: string[] = ['nf:pc-off', 'nf:pc-more', 'nf:ratio-share', 'nf:ratio-blue'];

/** The ladder rows, in order (Year 7 first). `tiny` is the short name (20 characters at most). */
export const NUMFACT_LADDER: { id: keyof typeof NUMFACT_SKILL_KEYS; label: string; tiny: string; stage: 'fractions-decimals-percentages'; year: 7 | 8; tags: string[] }[] = [
  { id: 'decimal-facts', label: 'Decimals times and divided by a whole number (0.7 × 5)', tiny: 'Decimal facts', stage: 'fractions-decimals-percentages', year: 7, tags: DEC_TAGS },
  { id: 'estimate', label: 'Estimating by rounding (14.7 × 5)', tiny: 'Estimating', stage: 'fractions-decimals-percentages', year: 7, tags: EST_TAGS },
  { id: 'fraction-add-easy', label: 'Adding and taking away fractions with related bottoms (½ + ¼)', tiny: 'Add easy fractions', stage: 'fractions-decimals-percentages', year: 7, tags: FADD_TAGS },
  { id: 'fraction-divide', label: 'Dividing with fractions (4 ÷ ⅓, ½ ÷ 3)', tiny: 'Divide fractions', stage: 'fractions-decimals-percentages', year: 7, tags: FDIV_TAGS },
  { id: 'percent-change', label: 'Discounts, increases and the swap trick (20% off $40)', tiny: 'Percent change', stage: 'fractions-decimals-percentages', year: 7, tags: PCT_TAGS },
  { id: 'ratio', label: 'Ratio (6 : 9 = 2 : ?, share 20 as 2 : 3)', tiny: 'Ratio', stage: 'fractions-decimals-percentages', year: 7, tags: RATIO_TAGS },
  { id: 'money', label: 'Change and cash rounding ($20 for $13.60)', tiny: 'Change, cash round', stage: 'fractions-decimals-percentages', year: 7, tags: MONEY_TAGS },
  { id: 'round-thousandth', label: 'Rounding to a thousandth (3.4567)', tiny: 'Round to thousandth', stage: 'fractions-decimals-percentages', year: 8, tags: ROUND_TAGS },
  { id: 'fraction-times', label: 'A fraction times a fraction (⅔ × ¾)', tiny: 'Fraction times', stage: 'fractions-decimals-percentages', year: 8, tags: FTIMES_TAGS },
];
