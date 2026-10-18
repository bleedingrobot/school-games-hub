/**
 * Percentages (ladder skills `percent-basic` and `percent-of`).
 *
 * `percent-basic`: 50%, 10% and 25% of an amount, and what those percentages are as a fraction and as a decimal (75% comes in
 * beside 25%). `percent-of`: 1%, 20% and 75% of an amount, bigger amounts, and finding the whole from a percentage.
 *
 * Number answers are typed on the pad (four choices when the class has multiple choice on); a percentage as a fraction is
 * always four choices to tap. Wrong choices are the answer a named mistake gives ("found 25% instead", "divided by the percent").
 *
 * Types:
 *   percent-basic  pct:half  pct:ten  pct:quarter  pct:to-fraction  pct:from-fraction  pct:to-decimal
 *   percent-of     pct:one  pct:twenty  pct:three-quarters  pct:big  pct:whole:ten  pct:whole:fifty  pct:whole:quarter
 */
import { int, isInt, pickOne, show, type Family } from '../banded';
import { oneKey, withMistakes, type Named } from './generatedKit';
import { frac, goodPick, pick, rollPick, talk } from './pickKit';

const BASIC_TAGS = ['MS.Y5.NUM.RN.P5', 'MS.Y5.NUM.RN.P15'];
const OF_TAGS = ['MS.Y6.NUM.RN.P13', 'MS.Y6.NUM.RN.P14'];
const pct = (p: number) => `${p}%`;

/** The answer a student gets by following a named mistake, for "p% of a". */
function ofMistakes(p: number, a: number): Named {
  const named: Named = {};
  for (const other of [1, 10, 20, 25, 50, 75]) if (other !== p) named[`found ${other}% instead`] = (a * other) / 100;
  named['took the percent off the amount'] = a - p;
  named['multiplied by the percent'] = a * p;
  named['divided by the percent'] = a / p;
  return named;
}

/** "p% of an amount that is q × step". */
function ofFamily(key: string, label: string, tags: string[], p: number, step: number, qLo: number, qHi: number): Family {
  return oneKey(
    key,
    label,
    tags,
    1,
    (_k, r) => [int(r, qLo, qHi)],
    (_k, [q]) => {
      if (!isInt(q, qLo, qHi)) return null;
      const amount = q * step;
      const parts = [pct(p), 'of', show(amount), '=', '?'];
      return withMistakes({ parts, spoken: talk(parts), answer: (amount * p) / 100 }, ofMistakes(p, amount));
    },
  );
}

/** "p% of an amount" for bigger amounts: 10%, 25% or 50%. */
const BIG: Record<number, { step: number; lo: number; hi: number }> = {
  10: { step: 10, lo: 21, hi: 100 },
  25: { step: 4, lo: 26, hi: 100 },
  50: { step: 2, lo: 51, hi: 250 },
};
const bigFamily = oneKey(
  'pct:big',
  'A simple percentage of a bigger amount (25% of 360)',
  OF_TAGS,
  2,
  (_k, r) => {
    const p = pickOne(r, [10, 25, 50]);
    return [p, int(r, BIG[p].lo, BIG[p].hi)];
  },
  (_k, [p, q]) => {
    const shape = BIG[p];
    if (!shape || !isInt(q, shape.lo, shape.hi)) return null;
    const amount = q * shape.step;
    const parts = [pct(p), 'of', show(amount), '=', '?'];
    return withMistakes({ parts, spoken: talk(parts), answer: (amount * p) / 100 }, ofMistakes(p, amount));
  },
);

/** "p% of ? = x": the whole from a percentage. */
function wholeFamily(key: string, label: string, p: number, xLo: number, xHi: number): Family {
  return oneKey(
    key,
    label,
    OF_TAGS,
    1,
    (_k, r) => [int(r, xLo, xHi)],
    (_k, [x]) => {
      if (!isInt(x, xLo, xHi)) return null;
      const parts = [pct(p), 'of', '?', '=', show(x)];
      const named: Named = {
        'gave the part back as the answer': x,
        'found the percentage of it instead': (x * p) / 100,
        'multiplied the part by the percent': x * p,
        'added the percent to the part': x + p,
      };
      for (const other of [10, 20, 25, 50]) if (other !== p) named[`used ${other}% instead`] = (x * 100) / other;
      return withMistakes({ parts, spoken: talk(parts), answer: (x * 100) / p }, named);
    },
  );
}

// ---------------------------------------------------------------- percentages as fractions and decimals

/** The percentages in these conversions, with the fraction each one is. */
const CONVERT: Record<number, [number, number]> = { 10: [1, 10], 25: [1, 4], 50: [1, 2], 75: [3, 4] };
const CONVERT_PERCENTS = Object.keys(CONVERT).map(Number);

const toFraction = oneKey(
  'pct:to-fraction',
  'A percentage as a fraction (25% = 1/4)',
  BASIC_TAGS,
  3,
  (_k, r) => [pickOne(r, CONVERT_PERCENTS), ...rollPick(r)],
  (_k, [p, slot, salt]) => {
    const f = CONVERT[p];
    if (!f || !goodPick(slot, salt)) return null;
    const right = frac(...f);
    const parts = [pct(p), '=', '?'];
    const named: Record<number, Record<string, string>> = {
      10: { 'put 1 over 100': '1/100', 'mixed up with 20%': '1/5', 'mixed up with 25%': '1/4', 'mixed up with 50%': '1/2' },
      25: { 'put 1 over the percent': '1/25', 'used the digits as top and bottom': '2/5', 'mixed up with 50%': '1/2', 'mixed up with 10%': '1/10', 'mixed up with 75%': '3/4' },
      50: { 'put 1 over the percent': '1/50', 'dropped the zero': '1/5', 'mixed up with 25%': '1/4', 'mixed up with 10%': '1/10' },
      75: { 'put 1 over the percent': '1/75', 'swapped the digits': '5/7', 'mixed up with 25%': '1/4', 'mixed up with 50%': '1/2', 'used only the tens digit': '7/10' },
    };
    return pick({ parts, spoken: talk(parts), fact: `${pct(p)} = ${right}` }, right, named[p], { slot, salt });
  },
);

const fromFraction = oneKey(
  'pct:from-fraction',
  'A fraction as a percentage (1/4 = ?%)',
  BASIC_TAGS,
  1,
  (_k, r) => [pickOne(r, CONVERT_PERCENTS)],
  (_k, [p]) => {
    const f = CONVERT[p];
    if (!f) return null;
    const [n, d] = f;
    const parts = [frac(n, d), '=', '?', '%'];
    return withMistakes(
      { parts, spoken: talk(parts), answer: p },
      {
        'used the bottom number': d,
        'used the top number': n,
        'gave the part that is left': 100 - p,
        'ten times too big': p * 10,
        'ten times too small': p / 10,
      },
    );
  },
);

const swapDigits = (p: number) => Number(`0.${String(p).split('').reverse().join('')}`);
const toDecimal = oneKey(
  'pct:to-decimal',
  'A percentage as a decimal (25% = 0.25)',
  BASIC_TAGS,
  1,
  (_k, r) => [pickOne(r, CONVERT_PERCENTS)],
  (_k, [p]) => {
    if (!CONVERT[p]) return null;
    const parts = [pct(p), '=', '?'];
    return withMistakes(
      { parts, spoken: talk(parts), answer: p / 100, input: 'decimal' },
      {
        'ten times too big': p / 10,
        'ten times too small': p / 1000,
        'used the percent number as it is': p,
        'swapped the digits': swapDigits(p),
      },
    );
  },
);

// ---------------------------------------------------------------- the lot

export const PERCENT_FAMILIES: Record<string, Family> = Object.fromEntries(
  [
    ofFamily('pct:half', '50% of an amount (50% of 60)', BASIC_TAGS, 50, 2, 1, 50),
    ofFamily('pct:ten', '10% of an amount (10% of 70)', BASIC_TAGS, 10, 10, 1, 20),
    ofFamily('pct:quarter', '25% of an amount (25% of 80)', BASIC_TAGS, 25, 4, 1, 25),
    toFraction,
    fromFraction,
    toDecimal,
    ofFamily('pct:one', '1% of an amount (1% of 300)', OF_TAGS, 1, 100, 1, 10),
    ofFamily('pct:twenty', '20% of an amount (20% of 45)', OF_TAGS, 20, 5, 2, 40),
    ofFamily('pct:three-quarters', '75% of an amount (75% of 60)', OF_TAGS, 75, 4, 2, 50),
    bigFamily,
    wholeFamily('pct:whole:ten', 'The whole from 10% (10% of ? = 7)', 10, 2, 30),
    wholeFamily('pct:whole:fifty', 'The whole from 50% (50% of ? = 18)', 50, 5, 60),
    wholeFamily('pct:whole:quarter', 'The whole from 25% (25% of ? = 12)', 25, 3, 40),
  ].map((f) => [f.keys[0], f]),
);

export const PERCENT_SKILL_KEYS = {
  'percent-basic': ['pct:half', 'pct:ten', 'pct:quarter', 'pct:to-fraction', 'pct:from-fraction', 'pct:to-decimal'],
  'percent-of': ['pct:one', 'pct:twenty', 'pct:three-quarters', 'pct:big', 'pct:whole:ten', 'pct:whole:fifty', 'pct:whole:quarter'],
};
