/**
 * Decimal and fraction bonds (ladder skills `fraction-bonds` and `decimal-bonds`, stage M.5 of docs/BOND-MATCH-PLAN.md): pairs
 * that make 1 or 10. Bonds to 10, 20, 100 and 1000 are elsewhere (earlyFacts.ts, placeSkills.ts); tenths that make 1 is
 * `addten:to-one` in decimalSkills.ts.
 *
 * Decimal answers are typed on the pad with the point key; fraction answers are four choices to tap ("5/8"), except the missing
 * top number ("3/8 + ?/8 = 1"), which is typed. Wrong choices are the answer a named mistake gives, never a random number.
 * Decimals are made from whole numbers of tenths or hundredths (0.35 is 35 hundredths), so no question is made from a number
 * that carries floating-point dust. Fractions stay at or under one.
 *
 * These are asked only by the other maths games. Bond Match never counts towards them (James, 19 and 20 Oct 2026).
 *
 * Types:
 *   fraction-bonds  bondf1:whole  bondf1:missing-top  bondf1:small  bondf1:big  bondf1:take
 *   decimal-bonds   bondd1:next-whole  bondd1:hundredths  bondd1:take  bondd10:tenths  bondd10:take
 */
import { isInt, pickOne, show, type Family } from '../banded';
import { oneKey, withMistakes } from './generatedKit';
import { frac, goodPick, pick, rollPick, talk } from './pickKit';

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const notTen = (n: number) => n % 10 !== 0;

// ---------------------------------------------------------------- fractions that make 1

const FRACTION_TAGS = ['MS.Y3.NUM.RN.P6', 'MS.Y3.NUM.RN.K6'];

const ALL_DENS = [2, 3, 4, 5, 6, 8, 10];
const SMALL_DENS = [3, 4, 5];
const BIG_DENS = [6, 8, 10];

/** A top number and bottom number under one: 1/d up to (d - 1)/d. */
const goodFraction = (n: number, d: number, dens: number[]) => dens.includes(d) && isInt(n, 1, d - 1);
const rollFraction = (r: () => number, dens: number[]) => {
  const d = pickOne(r, dens);
  return [Math.min(d - 1, 1 + Math.floor(r() * (d - 1))), d];
};

/** The wrong fractions a student gets by following each named mistake, when the answer is (d - n)/d. */
function fractionMistakes(n: number, d: number): Record<string, string> {
  return {
    'gave the same fraction': frac(n, d),
    'thought a whole is 10 parts': frac(10 - n, 10),
    // Never d/d: one whole is the target, not a fraction to pick.
    ...(d - n + 1 < d ? { 'one part too many': frac(d - n + 1, d) } : {}),
    'one part too few': frac(d - n - 1, d),
    'used 10 as the bottom number': frac(d - n, 10),
    'made the top number up to 10': frac(10 - n, d),
    'gave one part': frac(1, d),
  };
}

/** "3/8 + ? = 1" (or "? + 3/8 = 1"): tap the fraction that makes 1. */
function pairFamily(key: string, label: string, dens: number[]): Family {
  return oneKey(
    key,
    label,
    FRACTION_TAGS,
    5,
    (_k, r) => [...rollFraction(r, dens), Math.floor(r() * 2), ...rollPick(r)],
    (_k, [n, d, v, slot, salt]) => {
      if (!goodFraction(n, d, dens) || !isInt(v, 0, 1) || !goodPick(slot, salt)) return null;
      const right = frac(d - n, d);
      const parts = v === 0 ? [frac(n, d), '+', '?', '=', '1'] : ['?', '+', frac(n, d), '=', '1'];
      return pick({ parts, spoken: talk(parts), fact: `${frac(n, d)} + ${right} = 1` }, right, fractionMistakes(n, d), { slot, salt });
    },
  );
}

const fractionFamilies: Family[] = [
  oneKey(
    'bondf1:whole',
    'One whole as a fraction (1 = ?/8)',
    FRACTION_TAGS,
    1,
    (_k, r) => [pickOne(r, ALL_DENS)],
    (_k, [d]) => {
      if (!ALL_DENS.includes(d)) return null;
      const parts = ['1', '=', `?/${d}`];
      return withMistakes(
        { parts, spoken: talk(parts), answer: d },
        { 'thought one whole is one part': 1, 'thought a whole is 10 parts': 10, 'one part too many': d + 1, 'one part too few': d - 1, 'doubled the bottom number': d * 2 },
      );
    },
  ),
  oneKey(
    'bondf1:missing-top',
    'The missing top number (3/8 + ?/8 = 1)',
    FRACTION_TAGS,
    3,
    (_k, r) => [...rollFraction(r, ALL_DENS), Math.floor(r() * 2)],
    (_k, [n, d, v]) => {
      if (!goodFraction(n, d, ALL_DENS) || !isInt(v, 0, 1)) return null;
      const blank = `?/${d}`;
      const parts = v === 0 ? [frac(n, d), '+', blank, '=', '1'] : [blank, '+', frac(n, d), '=', '1'];
      return withMistakes(
        { parts, spoken: talk(parts), answer: d - n },
        {
          'gave the same top number': n,
          'gave the bottom number': d,
          'added the top and bottom': n + d,
          'made the top number up to 10': 10 - n,
          'one part too many': d - n + 1,
          'one part too few': d - n - 1,
        },
      );
    },
  ),
  pairFamily('bondf1:small', 'Thirds, quarters and fifths that make 1 (1/4 + 3/4)', SMALL_DENS),
  pairFamily('bondf1:big', 'Sixths, eighths and tenths that make 1 (3/8 + 5/8)', BIG_DENS),
  oneKey(
    'bondf1:take',
    'A fraction taken from 1 (1 − 3/8)',
    FRACTION_TAGS,
    4,
    (_k, r) => [...rollFraction(r, ALL_DENS.slice(1)), ...rollPick(r)],
    (_k, [n, d, slot, salt]) => {
      if (!goodFraction(n, d, ALL_DENS.slice(1)) || !goodPick(slot, salt)) return null;
      const right = frac(d - n, d);
      const parts = ['1', '−', frac(n, d), '=', '?'];
      return pick({ parts, spoken: talk(parts), fact: `1 − ${frac(n, d)} = ${right}` }, right, fractionMistakes(n, d), { slot, salt });
    },
  ),
];

// ---------------------------------------------------------------- decimals that make 1 and 10

const DECIMAL_TAGS = ['MS.Y4.NUM.RN.P10', 'MS.Y5.NUM.RN.P12'];

/** Hundredths that are not whole tenths (0.01 to 0.99, not 0.3): those are tenths to 1, in add-tenths. */
const HUNDREDTHS = range(1, 99).filter(notTen);
/** Tenths from 0.1 to 9.9 that are not whole numbers. */
const TENTHS = range(1, 99).filter(notTen);

/**
 * A number of small units (hundredths or tenths) and a target of `whole` such units: the answer is `whole - u`, written with
 * `scale` (100 for hundredths, 10 for tenths). Every value is worked out in whole units and only divided at the end.
 */
function decimalBond(u: number, whole: number, scale: number, target: number) {
  const tens = Math.floor(u / 10);
  const ones = u % 10;
  const answer = whole - u;
  return {
    answer: answer / scale,
    shown: show(u / scale),
    named: {
      // 0.35 → 0.75 (7 and 5 each make 10), 3.4 → 7.6.
      'made each digit up to 10': ((10 - tens) * 10 + (10 - ones)) / scale,
      // 0.35 → 0.64, 3.4 → 6.5: forgot the last digit makes 10.
      'made each digit up to 9': (whole - 1 - u) / scale,
      'forgot the point': answer,
      'made it up to ten times as much': (whole * 10 - u) / scale,
      'added instead': (target * scale + u) / scale,
      'one too many in the last place': (answer + 1) / scale,
    },
  };
}

/** "0.35 + ? = 1" or "? + 0.35 = 1", and the take-away "1 − 0.35 = ?", for one target. */
function decimalFamilies(prefix: string, word: string, labels: [string, string], pool: number[], scale: number, target: number): Family[] {
  const whole = target * scale;
  return [
    oneKey(
      `${prefix}:${word}`,
      labels[0],
      DECIMAL_TAGS,
      2,
      (_k, r) => [pickOne(r, pool), Math.floor(r() * 2)],
      (_k, [u, v]) => {
        if (!pool.includes(u) || !isInt(v, 0, 1)) return null;
        const b = decimalBond(u, whole, scale, target);
        const parts = v === 0 ? [b.shown, '+', '?', '=', String(target)] : ['?', '+', b.shown, '=', String(target)];
        return withMistakes({ parts, spoken: talk(parts), answer: b.answer, input: 'decimal' }, b.named);
      },
    ),
    oneKey(
      `${prefix}:take`,
      labels[1],
      DECIMAL_TAGS,
      1,
      (_k, r) => [pickOne(r, pool)],
      (_k, [u]) => {
        if (!pool.includes(u)) return null;
        const b = decimalBond(u, whole, scale, target);
        const parts = [String(target), '−', b.shown, '=', '?'];
        return withMistakes({ parts, spoken: talk(parts), answer: b.answer, input: 'decimal' }, b.named);
      },
    ),
  ];
}

/** Tenths up to the next whole number, the step that makes 10 easy: 6.3 + ? = 7. Tenth counts 11 to 89 that are not whole. */
const PAST_ONE = range(11, 89).filter(notTen);

const decimalBondFamilies: Family[] = [
  oneKey(
    'bondd1:next-whole',
    'Tenths up to the next whole number (6.3 + ? = 7)',
    DECIMAL_TAGS,
    1,
    (_k, r) => [pickOne(r, PAST_ONE)],
    (_k, [u]) => {
      if (!PAST_ONE.includes(u)) return null;
      const next = Math.floor(u / 10) + 1;
      const answer = next * 10 - u;
      const parts = [show(u / 10), '+', '?', '=', String(next)];
      return withMistakes(
        { parts, spoken: talk(parts), answer: answer / 10, input: 'decimal' },
        {
          'made it up to the whole number before': (u - Math.floor(u / 10) * 10) / 10,
          'made it up to 10': (100 - u) / 10,
          'forgot the point': answer,
          'made it up to 9 tenths': (answer - 1) / 10,
          'one tenth too many': (answer + 1) / 10,
          'added instead': (next * 10 + u) / 10,
        },
      );
    },
  ),
  ...decimalFamilies('bondd1', 'hundredths', ['Hundredths that make 1 (0.35 + 0.65)', 'Hundredths taken from 1 (1 − 0.35)'], HUNDREDTHS, 100, 1),
  ...decimalFamilies('bondd10', 'tenths', ['Tenths that make 10 (3.4 + 6.6)', 'Tenths taken from 10 (10 − 3.4)'], TENTHS, 10, 10),
];

// ---------------------------------------------------------------- the lot

export const BOND_FAMILIES: Record<string, Family> = Object.fromEntries([...fractionFamilies, ...decimalBondFamilies].map((f) => [f.keys[0], f]));

export const BOND_SKILL_KEYS = {
  'fraction-bonds': ['bondf1:whole', 'bondf1:missing-top', 'bondf1:small', 'bondf1:big', 'bondf1:take'],
  'decimal-bonds': ['bondd1:next-whole', 'bondd1:hundredths', 'bondd1:take', 'bondd10:tenths', 'bondd10:take'],
};
