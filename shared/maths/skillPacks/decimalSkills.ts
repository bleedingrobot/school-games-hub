/**
 * Tenths and decimals (ladder skills `tenths`, `add-tenths`, `decimal-equivalents` and `times-decimals`).
 *
 * Number answers (1.3 + 0.2, 34 ÷ 10) are typed on the pad with the point key. A question whose answer is a fraction or a
 * decimal that is picked from a list is always four choices to tap, with text labels ("3/10", "0.3"). Wrong choices are the
 * answer a named mistake gives ("put it in the hundredths place", "thought the longer decimal is bigger"), never a random number.
 *
 * Decimals are made from whole numbers of tenths or hundredths (1.3 is 13 tenths), so no question is ever made from a number that
 * carries floating-point dust.
 *
 * Types:
 *   tenths              tenth:to-fraction  tenth:to-decimal  tenth:divide  tenth:count  tenth:half
 *   add-tenths          addten:add  addten:carry  addten:take  addten:borrow  addten:whole  addten:to-one
 *   decimal-equivalents deceq:common  deceq:pick  deceq:hundredths  deceq:to-fraction  deceq:compare
 *   times-decimals      timesdec:ten  timesdec:hundred  timesdec:div-ten  timesdec:div-hundred  timesdec:missing
 */
import { int, isInt, pickOne, show, type Family } from '../banded';
import { oneKey, withMistakes, type Named } from './generatedKit';
import { frac, goodPick, pick, rollPick, talk } from './pickKit';

const range = (from: number, to: number, step = 1) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
const tenths = (n: number) => show(n / 10);
const hundredths = (n: number) => show(n / 100);
const notTen = (n: number) => n % 10 !== 0;

// ---------------------------------------------------------------- tenths

const TENTH_TAGS = ['MS.Y4.NUM.RN.P3', 'MS.Y4.NUM.RN.P5'];

/** Whole tenths, which a tenth count of 1 to 39 that is not a whole number can be shown as (0.7, 1.4, 3.9). */
const COUNTS = range(1, 39).filter(notTen);

const tenthFamilies: Family[] = [
  oneKey(
    'tenth:to-fraction',
    'A decimal as tenths (0.3 = 3/10)',
    TENTH_TAGS,
    3,
    (_k, r) => [int(r, 2, 9), ...rollPick(r)],
    (_k, [d, slot, salt]) => {
      if (!isInt(d, 2, 9) || !goodPick(slot, salt)) return null;
      const right = frac(d, 10);
      const parts = [tenths(d), '=', '?'];
      return pick(
        { parts, spoken: talk(parts), fact: `${tenths(d)} = ${right}` },
        right,
        {
          'put it over 100': frac(d, 100),
          'put 1 over the digit': frac(1, d),
          'counted from the other end': frac(10 - d, 10),
          'put 1 over the digit with a zero': frac(1, d * 10),
        },
        { slot, salt },
      );
    },
  ),
  oneKey(
    'tenth:to-decimal',
    'Tenths as a decimal (3/10 = 0.3)',
    TENTH_TAGS,
    3,
    (_k, r) => [int(r, 1, 9), ...rollPick(r)],
    (_k, [d, slot, salt]) => {
      if (!isInt(d, 1, 9) || !goodPick(slot, salt)) return null;
      const right = tenths(d);
      const parts = [frac(d, 10), '=', '?'];
      return pick(
        { parts, spoken: talk(parts), fact: `${frac(d, 10)} = ${right}` },
        right,
        {
          'put it in the hundredths place': hundredths(d),
          'read it as a whole number and a tenth': `${d}.1`,
          'counted from the other end': tenths(10 - d),
          'wrote just the top number': String(d),
        },
        { slot, salt },
      );
    },
  ),
  oneKey(
    'tenth:divide',
    'Dividing by 10 to make tenths (27 ÷ 10 = 2.7)',
    TENTH_TAGS,
    1,
    (_k, r) => [pickOne(r, range(1, 99).filter(notTen))],
    (_k, [n]) => {
      if (!isInt(n, 1, 99) || !notTen(n)) return null;
      const parts = [show(n), '÷', '10', '=', '?'];
      return withMistakes(
        { parts, spoken: talk(parts), answer: n / 10, input: 'decimal' },
        { 'multiplied by 10 instead': n * 10, 'moved the point two places': n / 100, 'left it as it was': n, 'moved the point two places the wrong way': n * 100 },
      );
    },
  ),
  oneKey(
    'tenth:count',
    'How many tenths (1.4 = ?/10)',
    TENTH_TAGS,
    1,
    (_k, r) => [pickOne(r, COUNTS)],
    (_k, [t]) => {
      if (!COUNTS.includes(t)) return null;
      const parts = [tenths(t), '=', '?/10'];
      return withMistakes(
        { parts, spoken: talk(parts), answer: t },
        {
          'used the digit after the point only': t % 10,
          'added a zero': t * 10,
          'used the whole number only': Math.floor(t / 10),
          'one tenth too many': t + 1,
          'one tenth too few': t - 1,
        },
      );
    },
  ),
  oneKey(
    'tenth:half',
    'Half and double of tenths (half of 1.4 = 0.7)',
    TENTH_TAGS,
    2,
    (_k, r) => (r() < 0.5 ? [pickOne(r, range(2, 38, 2)), 0] : [int(r, 1, 24), 1]),
    (_k, [t, v]) => {
      if (v === 0) {
        if (!isInt(t, 2, 38) || t % 2 !== 0) return null;
        const parts = ['Half', 'of', tenths(t), '=', '?'];
        const whole = Math.floor(t / 10);
        const part = t % 10;
        return withMistakes(
          { parts, spoken: talk(parts), answer: t / 20, input: 'decimal' },
          {
            'halved only the whole number': whole / 2 + part / 10,
            'halved only the tenths': whole + part / 20,
            'doubled instead of halving': t / 5,
            'gave the number back': t / 10,
            'took half off the number': t / 10 - 0.5,
          },
        );
      }
      if (v !== 1 || !isInt(t, 1, 24)) return null;
      const parts = ['Double', tenths(t), '=', '?'];
      const whole = Math.floor(t / 10);
      const part = t % 10;
      return withMistakes(
        { parts, spoken: talk(parts), answer: t / 5, input: 'decimal' },
        {
          'doubled only the whole number': whole * 2 + part / 10,
          'doubled only the tenths': whole + part / 5,
          'halved instead of doubling': t / 20,
          'gave the number back': t / 10,
          'added 2': t / 10 + 2,
        },
      );
    },
  ),
];

// ---------------------------------------------------------------- adding and taking away tenths

const ADD_TAGS = ['MS.Y4.NUM.RN.P10'];
const ones = (t: number) => Math.floor(t / 10);
const dig = (t: number) => t % 10;

/** A pair of tenth counts for "a + b" or "a − b", made by `make`; the type checks which kind of pair it is. */
function twoTenths(key: string, label: string, ok: (a: number, b: number) => boolean, sign: '+' | '−', named: (a: number, b: number) => Named, aLo: number, aHi: number): Family {
  const pool = range(aLo, aHi).flatMap((a) => range(1, aHi).filter((b) => ok(a, b)).map((b) => [a, b] as [number, number]));
  return oneKey(
    key,
    label,
    ADD_TAGS,
    2,
    (_k, r) => pickOne(r, pool),
    (_k, [a, b]) => {
      if (!isInt(a, 1, 99) || !isInt(b, 1, 99) || !ok(a, b)) return null;
      const parts = [tenths(a), sign, tenths(b), '=', '?'];
      const answer = (sign === '+' ? a + b : a - b) / 10;
      return withMistakes({ parts, spoken: talk(parts), answer, input: 'decimal' }, { ...named(a, b), 'one tenth too many': answer + 0.1, 'one tenth too few': answer - 0.1 });
    },
  );
}

const addFamilies: Family[] = [
  twoTenths(
    'addten:add',
    'Adding tenths (1.3 + 0.2)',
    (a, b) => dig(a) > 0 && dig(b) > 0 && dig(a) + dig(b) < 10 && a + b <= 49,
    '+',
    (a, b) => ({ 'forgot the point': a + b, 'put the point in the hundredths place': (a + b) / 100 }),
    1,
    49,
  ),
  twoTenths(
    'addten:carry',
    'Adding tenths that make a whole (0.7 + 0.5)',
    (a, b) => dig(a) > 0 && dig(b) > 0 && dig(a) + dig(b) >= 10 && a + b <= 59,
    '+',
    (a, b) => ({
      'wrote the tenths total after the point': Number(`${ones(a) + ones(b)}.${dig(a) + dig(b)}`),
      'forgot to carry the ten tenths': ones(a) + ones(b) + (dig(a) + dig(b) - 10) / 10,
      'carried to the wrong place': ones(a) + ones(b) + (dig(a) + dig(b)) / 10,
      'forgot the point': a + b,
    }),
    1,
    49,
  ),
  twoTenths(
    'addten:take',
    'Taking away tenths (1.5 − 0.2)',
    (a, b) => a > b && dig(b) > 0 && dig(b) <= dig(a) && a - b >= 1,
    '−',
    (a, b) => ({ 'added instead': (a + b) / 10, 'forgot the point': a - b }),
    2,
    49,
  ),
  twoTenths(
    'addten:borrow',
    'Taking away tenths across a whole (1.2 − 0.5)',
    (a, b) => a > b && dig(b) > dig(a) && a - b >= 1 && a <= 49,
    '−',
    (a, b) => ({
      'took the smaller tenths digit from the bigger': ones(a) - ones(b) + Math.abs(dig(a) - dig(b)) / 10,
      'did not take one off the whole after borrowing': (a - b) / 10 + 1,
      'added instead': (a + b) / 10,
      'forgot the point': a - b,
    }),
    2,
    49,
  ),
  oneKey(
    'addten:whole',
    'A whole number and tenths (3 + 0.4, 5 − 0.3)',
    ADD_TAGS,
    3,
    (_k, r) => [int(r, 1, 9), int(r, 1, 9), int(r, 0, 2)],
    (_k, [w, t, v]) => {
      if (!isInt(w, 1, 9) || !isInt(t, 1, 9) || !isInt(v, 0, 2)) return null;
      const small = tenths(t);
      if (v === 2) {
        const parts = [String(w), '−', small, '=', '?'];
        const answer = w - t / 10;
        return withMistakes(
          { parts, spoken: talk(parts), answer, input: 'decimal' },
          { 'took off whole ones, not tenths': w - t, 'added instead': w + t / 10, 'took one off the whole and kept the tenths': w - 1 + t / 10, 'one tenth too many': answer + 0.1, 'one tenth too few': answer - 0.1 },
        );
      }
      const parts = v === 0 ? [String(w), '+', small, '=', '?'] : [small, '+', String(w), '=', '?'];
      const answer = w + t / 10;
      return withMistakes(
        { parts, spoken: talk(parts), answer, input: 'decimal' },
        { 'ignored the point': w * 10 + t, 'put the tenths in the hundredths place': w + t / 100, 'added the digits': w + t, 'one tenth too many': answer + 0.1, 'one tenth too few': answer - 0.1 },
      );
    },
  ),
  oneKey(
    'addten:to-one',
    'Tenths that make a whole (0.4 + ? = 1)',
    ADD_TAGS,
    3,
    (_k, r) => [int(r, 1, 9), int(r, 1, 2), int(r, 0, 2)],
    (_k, [t, target, v]) => {
      if (!isInt(t, 1, 9) || !isInt(target, 1, 2) || !isInt(v, 0, 2)) return null;
      const small = tenths(t);
      const parts = v === 0 ? [small, '+', '?', '=', String(target)] : v === 1 ? ['?', '+', small, '=', String(target)] : [String(target), '−', small, '=', '?'];
      const answer = target - t / 10;
      return withMistakes(
        { parts, spoken: talk(parts), answer, input: 'decimal' },
        {
          'wrote the same tenths': t / 10,
          'added instead': target + t / 10,
          'forgot the point': answer * 10,
          'put it in the hundredths place': answer / 10,
          'one tenth too many': answer + 0.1,
          'one tenth too few': answer - 0.1,
        },
      );
    },
  ),
];

// ---------------------------------------------------------------- decimal equivalents of fractions

const EQUIV_TAGS = ['MS.Y5.NUM.RN.P4'];

/** Fractions with an easy decimal: [top, bottom]. */
const COMMON: [number, number][] = [[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5]];
const isCommon = (n: number, d: number) => COMMON.some(([a, b]) => a === n && b === d);
const decimalOf = (n: number, d: number) => n / d;

/** What a student gets by following each named mistake, as a decimal. */
function decimalMistakes(n: number, d: number): Named {
  return {
    'put the top and bottom either side of the point': Number(`${n}.${d}`),
    'put the top and bottom after a zero point': Number(`0.${n}${d}`),
    'put the bottom and top either side of the point': Number(`${d}.${n}`),
    'gave the part that is left': 1 - n / d,
    'used the bottom number after the point': Number(`0.${d}`),
    'used the top number after the point': Number(`0.${n}`),
  };
}

const fractionOf: Record<string, Record<string, string>> = {
  '0.5': { 'put 1 over the digit': '1/5', 'put 1 over the number': '1/50', 'put it over 100': '5/100', 'mixed up with 0.25': '1/4' },
  '0.25': { 'put 1 over the digits': '1/25', 'used the digits as top and bottom': '2/5', 'mixed up with 0.5': '1/2', 'mixed up with 0.2': '1/5' },
  '0.75': { 'put 1 over the digits': '1/75', 'swapped the digits': '5/7', 'mixed up with 0.25': '1/4', 'used only the tenths digit': '7/10' },
  '0.2': { 'swapped the digit and the point': '1/2', 'put it over 100': '2/100', 'put 1 over the number with a zero': '1/20', 'mixed up with 0.4': '2/5' },
};
const FRACTION_DECIMALS: [string, string][] = [['0.5', '1/2'], ['0.25', '1/4'], ['0.75', '3/4'], ['0.2', '1/5']];

const equivFamilies: Family[] = [
  oneKey(
    'deceq:common',
    'A fraction as a decimal (3/4 = 0.75)',
    EQUIV_TAGS,
    2,
    (_k, r) => pickOne(r, COMMON),
    (_k, [n, d]) => {
      if (!isCommon(n, d)) return null;
      const parts = [frac(n, d), '=', '?'];
      return withMistakes({ parts, spoken: talk(parts), answer: decimalOf(n, d), input: 'decimal' }, decimalMistakes(n, d));
    },
  ),
  oneKey(
    'deceq:pick',
    'Which decimal is the same as the fraction? (3/4 = 0.75)',
    EQUIV_TAGS,
    4,
    (_k, r) => [...pickOne(r, COMMON), ...rollPick(r)],
    (_k, [n, d, slot, salt]) => {
      if (!isCommon(n, d) || !goodPick(slot, salt)) return null;
      const right = show(decimalOf(n, d));
      const parts = [frac(n, d), '=', '?'];
      const named = Object.fromEntries(Object.entries(decimalMistakes(n, d)).map(([name, v]) => [name, show(v)]));
      return pick({ parts, spoken: talk(parts), fact: `${frac(n, d)} = ${right}` }, right, named, { slot, salt });
    },
  ),
  oneKey(
    'deceq:hundredths',
    'Hundredths as a decimal (7/100 = 0.07)',
    EQUIV_TAGS,
    1,
    (_k, r) => [pickOne(r, range(1, 99).filter(notTen))],
    (_k, [n]) => {
      if (!isInt(n, 1, 99) || !notTen(n)) return null;
      const parts = [frac(n, 100), '=', '?'];
      return withMistakes(
        { parts, spoken: talk(parts), answer: n / 100, input: 'decimal' },
        {
          'put it in the tenths place': n / 10,
          'wrote it as a whole number': n,
          'put it in the thousandths place': n / 1000,
          ...(n >= 10 ? { 'swapped the digits': Number(`0.${String(n).split('').reverse().join('')}`) } : {}),
        },
      );
    },
  ),
  oneKey(
    'deceq:to-fraction',
    'A decimal as a fraction (0.75 = 3/4)',
    EQUIV_TAGS,
    3,
    (_k, r) => [int(r, 0, FRACTION_DECIMALS.length - 1), ...rollPick(r)],
    (_k, [i, slot, salt]) => {
      const pair = FRACTION_DECIMALS[i];
      if (!pair || !isInt(i, 0, FRACTION_DECIMALS.length - 1) || !goodPick(slot, salt)) return null;
      const [decimal, right] = pair;
      const parts = [decimal, '=', '?'];
      return pick({ parts, spoken: talk(parts), fact: `${decimal} = ${right}` }, right, fractionOf[decimal], { slot, salt });
    },
  ),
  oneKey(
    'deceq:compare',
    'Which decimal is bigger? (0.25 or 0.3)',
    EQUIV_TAGS,
    5,
    (_k, r) => {
      if (r() < 0.5) {
        // The longer decimal is the smaller one (0.25 and 0.3).
        const x = pickOne(r, range(1, 98).filter(notTen));
        const t = int(r, Math.floor(x / 10) + 1, 9);
        return [x, t, 0, ...rollPick(r, 1)];
      }
      // Same tenths, and the longer one is bigger (0.45 and 0.4).
      const x = pickOne(r, range(11, 99).filter(notTen));
      return [x, Math.floor(x / 10), 1, ...rollPick(r, 1)];
    },
    (_k, [x, y, v, slot, salt]) => {
      if (!goodPick(slot, salt, 1) || !isInt(x, 1, 99) || !notTen(x) || !isInt(v, 0, 1)) return null;
      // v 0: x is the longer decimal and y tenths is bigger; v 1: x is longer and bigger than its tenths y.
      const smaller = v === 0 ? x : y * 10;
      const bigger = v === 0 ? y * 10 : x;
      if (v === 0 && !(isInt(y, 1, 9) && y * 10 > x)) return null;
      if (v === 1 && !(isInt(y, 1, 9) && y === Math.floor(x / 10))) return null;
      const right = hundredths(bigger);
      const wrong = hundredths(smaller);
      return pick(
        { parts: ['Which is bigger?'], spoken: 'Which is bigger?', fact: `${right} is bigger than ${wrong}` },
        right,
        { [v === 0 ? 'thought the longer decimal is bigger' : 'ignored the last digit']: wrong },
        { slot, salt, wrong: 1 },
      );
    },
  ),
];

// ---------------------------------------------------------------- times and divide by 10 and 100

const TIMES_TAGS = ['MS.Y5.NUM.RN.P7'];

/** The four ways a student gets the number of zeros or places wrong. */
const places = (answer: number): Named => {
  const all: Named = {
    'moved the point one place too far': answer * 10,
    'moved the point one place too few': answer / 10,
    'moved the point two places too far': answer * 100,
    'moved the point two places too few': answer / 100,
  };
  // Nothing smaller than a hundredth: a choice of 0.0034 would be shown as 0.003, which is not the mistake.
  return Object.fromEntries(Object.entries(all).filter(([, v]) => v >= 0.01));
};

function moveFamily(key: string, label: string, make: (random: () => number) => number[], check: (n: number) => boolean, build: (n: number) => { parts: string[]; answer: number; named: Named }): Family {
  return oneKey(
    key,
    label,
    TIMES_TAGS,
    1,
    (_k, r) => make(r),
    (_k, [n]) => {
      if (!isInt(n, 1, 100000) || !check(n)) return null;
      const { parts, answer, named } = build(n);
      return withMistakes({ parts, spoken: talk(parts), answer, input: 'decimal' }, named);
    },
  );
}

const timesFamilies: Family[] = [
  moveFamily(
    'timesdec:ten',
    'Times 10 with a decimal (3.4 × 10)',
    (r) => [pickOne(r, range(11, 99).filter(notTen))],
    (t) => t >= 11 && t <= 99 && notTen(t),
    (t) => ({
      parts: [tenths(t), '×', '10', '=', '?'],
      answer: t,
      named: { 'moved the point the wrong way': t / 100, 'did not move the point': t / 10, 'moved the point two places': t * 10, 'moved the point two places the wrong way': t / 1000 },
    }),
  ),
  moveFamily(
    'timesdec:hundred',
    'Times 100 with a decimal (0.35 × 100)',
    (r) => [pickOne(r, range(11, 999).filter((h) => h % 100 !== 0))],
    (h) => h >= 11 && h <= 999 && h % 100 !== 0,
    (h) => ({
      parts: [hundredths(h), '×', '100', '=', '?'],
      answer: h,
      named: { 'moved the point only one place': h / 10, 'moved the point the wrong way': h / 10000, 'did not move the point': h / 100, 'moved the point three places': h * 10 },
    }),
  ),
  moveFamily(
    'timesdec:div-ten',
    'Dividing a decimal by 10 (3.4 ÷ 10)',
    (r) => [pickOne(r, range(11, 199).filter(notTen))],
    (t) => t >= 11 && t <= 199 && notTen(t),
    (t) => ({
      parts: [tenths(t), '÷', '10', '=', '?'],
      answer: t / 100,
      named: { 'moved the point the wrong way': t, 'moved the point two places': t / 1000, 'did not move the point': t / 10, 'moved the point two places the wrong way': t * 10 },
    }),
  ),
  moveFamily(
    'timesdec:div-hundred',
    'Dividing by 100 (345 ÷ 100)',
    (r) => [pickOne(r, range(12, 999).filter((n) => n % 100 !== 0))],
    (n) => n >= 12 && n <= 999 && n % 100 !== 0,
    (n) => ({
      parts: [show(n), '÷', '100', '=', '?'],
      answer: n / 100,
      named: { 'moved the point only one place': n / 10, 'moved the point the wrong way': n * 100, 'moved the point three places': n / 1000, 'did not move the point': n },
    }),
  ),
  oneKey(
    'timesdec:missing',
    'A missing 10 or 100 (0.6 × ? = 60)',
    TIMES_TAGS,
    2,
    (_k, r) => [pickOne(r, range(11, 99).filter(notTen)), int(r, 0, 3)],
    (_k, [t, v]) => {
      if (!isInt(t, 11, 99) || !notTen(t) || !isInt(v, 0, 3)) return null;
      const small = tenths(t);
      const [parts, answer] =
        v === 0 ? [[small, '×', '?', '=', String(t)], 10]
        : v === 1 ? [[small, '×', '?', '=', String(t * 10)], 100]
        : v === 2 ? [['?', '×', '10', '=', small], t / 100]
        : [['?', '÷', '10', '=', small], t];
      return withMistakes({ parts: parts as string[], spoken: talk(parts as string[]), answer: answer as number, input: 'decimal' }, places(answer as number));
    },
  ),
];

// ---------------------------------------------------------------- the lot

export const DECIMAL_FAMILIES: Record<string, Family> = Object.fromEntries([...tenthFamilies, ...addFamilies, ...equivFamilies, ...timesFamilies].map((f) => [f.keys[0], f]));

export const DECIMAL_SKILL_KEYS = {
  tenths: ['tenth:to-fraction', 'tenth:to-decimal', 'tenth:divide', 'tenth:count', 'tenth:half'],
  'add-tenths': ['addten:add', 'addten:carry', 'addten:take', 'addten:borrow', 'addten:whole', 'addten:to-one'],
  'decimal-equivalents': ['deceq:common', 'deceq:pick', 'deceq:hundredths', 'deceq:to-fraction', 'deceq:compare'],
  'times-decimals': ['timesdec:ten', 'timesdec:hundred', 'timesdec:div-ten', 'timesdec:div-hundred', 'timesdec:missing'],
};
