/**
 * Fractions of an amount, equivalent fractions and finding the whole (ladder skills `unit-fraction-of`, `fraction-of`,
 * `equivalent-fractions` and `whole-from-fraction`). Fractions stay under one: no 7/4 or 1 3/4 as a question or a choice.
 *
 * One mastery record per question type (generatedKit.ts). Number answers are typed on the pad (and become four choices when the
 * class has multiple choice on); fraction answers are always four choices to tap, with text labels ("3/4"). Wrong choices are
 * the answer a named mistake gives, never a random number.
 *
 * Types:
 *   unit-fraction-of     fracof:half  fracof:third  fracof:quarter  fracof:fifth  fracof:tenth  fracof:big
 *   fraction-of          fracof:non:thirds  :quarters  :fifths  :sixths  :eighths  :tenths
 *   equivalent-fractions equiv:missing-top  equiv:missing-bottom  equiv:same-as  equiv:simplify  equiv:simplify-blank
 *   whole-from-fraction  whole:half  whole:unit  whole:thirds  whole:quarters  whole:other
 */
import { int, isInt, pickOne, show, type Family } from '../banded';
import { oneKey, withMistakes, type Named } from './generatedKit';
import { frac, gcd, goodPick, pick, rollPick, talk } from './pickKit';

const range = (from: number, to: number, step = 1) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

// ---------------------------------------------------------------- a unit fraction of an amount

const UNIT_TAGS = ['MS.Y3.NUM.RN.P7'];

/** 1/d of an amount that d goes into exactly. `dens` are the bottom numbers this type uses. */
function unitFamily(key: string, label: string, dens: number[], qLo: number, qHi: number): Family {
  return oneKey(
    key,
    label,
    UNIT_TAGS,
    2,
    (_k, r) => [pickOne(r, dens), int(r, qLo, qHi)],
    (_k, [d, q]) => {
      if (!dens.includes(d) || !isInt(q, qLo, qHi)) return null;
      const amount = d * q;
      const parts = [frac(1, d), 'of', show(amount), '=', '?'];
      const named: Named = {
        'used the bottom number as the answer': d,
        'took one share away from the amount': amount - q,
        'one share too many': q + 1,
        'one share too few': q - 1,
        'multiplied instead of dividing': amount * d,
        'took the bottom number off the amount': amount - d,
        'halved the amount': amount / 2,
      };
      return withMistakes({ parts, spoken: talk(parts), answer: q }, named);
    },
  );
}

// ---------------------------------------------------------------- a fraction of an amount (not a unit fraction)

const NON_TAGS = ['MS.Y5.NUM.RN.P13'];

/** The fractions each non-unit type uses (all under one, all in their simplest form). */
const NON_UNIT: Record<string, { d: number; tops: number[]; label: string }> = {
  thirds: { d: 3, tops: [2], label: 'Two thirds of an amount (2/3 of 24)' },
  quarters: { d: 4, tops: [3], label: 'Three quarters of an amount (3/4 of 20)' },
  fifths: { d: 5, tops: [2, 3, 4], label: 'Fifths of an amount (3/5 of 40)' },
  sixths: { d: 6, tops: [5], label: 'Five sixths of an amount (5/6 of 30)' },
  eighths: { d: 8, tops: [3, 5, 7], label: 'Eighths of an amount (3/8 of 40)' },
  tenths: { d: 10, tops: [3, 7, 9], label: 'Tenths of an amount (7/10 of 50)' },
};

function nonUnitFamily(word: string): Family {
  const { d, tops, label } = NON_UNIT[word];
  return oneKey(
    `fracof:non:${word}`,
    label,
    NON_TAGS,
    3,
    (_k, r) => [pickOne(r, tops), d, int(r, 1, 10)],
    (_k, [n, den, q]) => {
      if (den !== d || !tops.includes(n) || !isInt(q, 1, 10)) return null;
      const parts = [frac(n, d), 'of', show(d * q), '=', '?'];
      const named: Named = {
        'stopped at one share': q,
        'divided by the top number': (d * q) / n,
        'one share too many': n * q + q,
        'one share too few': n * q - q,
        'found the part that is left': (d - n) * q,
        'added the top number to one share': q + n,
        'multiplied the amount by the top number': n * d * q,
      };
      return withMistakes({ parts, spoken: talk(parts), answer: n * q }, named);
    },
  );
}

// ---------------------------------------------------------------- equivalent fractions and simplifying

const EQUIV_TAGS = ['MS.Y5.NUM.RN.P9', 'MS.Y6.NUM.RN.P6'];

/** Fractions in their simplest form, under one, with a bottom number up to 6. */
const SIMPLEST: [number, number][] = range(2, 6).flatMap((d) => range(1, d - 1).filter((n) => gcd(n, d) === 1).map((n) => [n, d] as [number, number]));
const isSimplest = (n: number, d: number) => isInt(d, 2, 6) && isInt(n, 1, d - 1) && gcd(n, d) === 1;
/** Smallest number that divides k other than 1, if k is not prime (so 12/16 can be "only halved"). */
const smallestFactor = (k: number) => range(2, k - 1).find((p) => k % p === 0);

const equivFamilies: Family[] = [
  oneKey(
    'equiv:missing-top',
    'Equivalent fractions, the top number (1/2 = ?/8)',
    EQUIV_TAGS,
    3,
    (_k, r) => {
      const [n, d] = pickOne(r, SIMPLEST);
      return [n, d, int(r, 2, 6)];
    },
    (_k, [n, d, k]) => {
      if (!isSimplest(n, d) || !isInt(k, 2, 6)) return null;
      const parts = [frac(n, d), '=', `?/${d * k}`];
      const named: Named = {
        'added the same to the top as the bottom grew by': n + (d * k - d),
        'kept the top the same': n,
        'top one too many': n * k + 1,
        'top one too few': n * k - 1,
        'used the multiplier': k,
        'added the multiplier to the top': n + k,
      };
      return withMistakes({ parts, spoken: talk(parts), answer: n * k }, named);
    },
  ),
  oneKey(
    'equiv:missing-bottom',
    'Equivalent fractions, the bottom number (3/4 = 9/?)',
    EQUIV_TAGS,
    3,
    (_k, r) => {
      const [n, d] = pickOne(r, SIMPLEST);
      return [n, d, int(r, 2, 6)];
    },
    (_k, [n, d, k]) => {
      if (!isSimplest(n, d) || !isInt(k, 2, 6)) return null;
      const parts = [frac(n, d), '=', `${n * k}/?`];
      const named: Named = {
        'added the same to the bottom as the top grew by': d + (n * k - n),
        'kept the bottom the same': d,
        'bottom one too many': d * k + 1,
        'bottom one too few': d * k - 1,
        'used the multiplier': k,
        'added the multiplier to the bottom': d + k,
        'used the new top number': n * k,
      };
      return withMistakes({ parts, spoken: talk(parts), answer: d * k }, named);
    },
  ),
  oneKey(
    'equiv:same-as',
    'Which fraction is the same? (1/2 = 4/8)',
    EQUIV_TAGS,
    5,
    (_k, r) => {
      const [n, d] = pickOne(r, SIMPLEST);
      return [n, d, int(r, 2, 5), ...rollPick(r)];
    },
    (_k, [n, d, k, slot, salt]) => {
      if (!isSimplest(n, d) || !isInt(k, 2, 5) || !goodPick(slot, salt)) return null;
      const right = frac(n * k, d * k);
      const parts = [frac(n, d), '=', '?'];
      return pick(
        { parts, spoken: talk(parts), fact: `${frac(n, d)} = ${right}` },
        right,
        {
          'added the same number to the top and bottom': frac(n + k, d + k),
          'changed only the bottom': frac(n, d * k),
          'changed only the top': frac(n * k, d),
          'top and bottom not changed the same': frac(n * k, d * k + 1),
          'top one too many': frac(n * k + 1, d * k),
        },
        { slot, salt },
      );
    },
  ),
  oneKey(
    'equiv:simplify',
    'Simplifying a fraction (6/8 = 3/4)',
    EQUIV_TAGS,
    5,
    (_k, r) => {
      const [n, d] = pickOne(r, SIMPLEST);
      return [n, d, int(r, 2, 5), ...rollPick(r)];
    },
    (_k, [n, d, k, slot, salt]) => {
      if (!isSimplest(n, d) || !isInt(k, 2, 5) || !goodPick(slot, salt)) return null;
      const shown = frac(n * k, d * k);
      const parts = ['Simplify', shown, '=', '?'];
      const p = smallestFactor(k);
      return pick(
        { parts, spoken: talk(parts), fact: `${shown} = ${frac(n, d)} in its simplest form` },
        frac(n, d),
        {
          'divided only the top': frac(n, d * k),
          'divided only the bottom': frac(n * k, d),
          'took the same off the top and bottom': frac(n * k - k, d * k - k),
          ...(p ? { 'stopped before the simplest': frac((n * k) / p, (d * k) / p) } : {}),
          'top and bottom not divided the same': frac(n, d + 1),
        },
        { slot, salt, allowEqual: true },
      );
    },
  ),
  oneKey(
    'equiv:simplify-blank',
    'Simplifying with a missing number (6/8 = 3/?)',
    EQUIV_TAGS,
    4,
    (_k, r) => {
      const [n, d] = pickOne(r, SIMPLEST);
      return [n, d, int(r, 2, 5), int(r, 0, 1)];
    },
    (_k, [n, d, k, v]) => {
      if (!isSimplest(n, d) || !isInt(k, 2, 5) || !isInt(v, 0, 1)) return null;
      const shown = frac(n * k, d * k);
      if (v === 0) {
        const parts = [shown, '=', `${n}/?`];
        return withMistakes(
          { parts, spoken: talk(parts), answer: d },
          {
            'took the same off the bottom as the top': d * k - (n * k - n),
            'bottom one too many': d + 1,
            'bottom one too few': d - 1,
            'kept the bottom the same': d * k,
            'used the divisor': k,
          },
        );
      }
      const parts = [shown, '=', `?/${d}`];
      return withMistakes(
        { parts, spoken: talk(parts), answer: n },
        {
          'took the same off the top as the bottom': n * k - (d * k - d),
          'top one too many': n + 1,
          'top one too few': n - 1,
          'kept the top the same': n * k,
          'used the divisor': k,
        },
      );
    },
  ),
];

// ---------------------------------------------------------------- the whole from a fraction

const WHOLE_TAGS = ['MS.Y6.NUM.RN.P12'];

/** "3/4 of ? = 90": the part shown is n × q, the whole to find is d × q. */
function wholeFamily(key: string, label: string, shapes: [number, number][], qLo: number, qHi: number): Family {
  return oneKey(
    key,
    label,
    WHOLE_TAGS,
    3,
    (_k, r) => {
      const [n, d] = pickOne(r, shapes);
      return [n, d, int(r, qLo, qHi)];
    },
    (_k, [n, d, q]) => {
      if (!shapes.some(([a, b]) => a === n && b === d) || !isInt(q, qLo, qHi)) return null;
      const part = n * q;
      const whole = d * q;
      const parts = [frac(n, d), 'of', '?', '=', show(part)];
      const named: Named = {
        'gave the part back as the answer': part,
        'found the fraction of the number instead': (part * n) / d,
        'multiplied the part by the bottom number': part * d,
        'stopped at one share': q,
        'one share too few': whole - q,
        'one share too many': whole + q,
        'added the bottom number to the part': part + d,
      };
      return withMistakes({ parts, spoken: talk(parts), answer: whole }, named);
    },
  );
}

// ---------------------------------------------------------------- the lot

export const FRACTION_FAMILIES: Record<string, Family> = Object.fromEntries(
  [
    unitFamily('fracof:half', 'Half of an amount (1/2 of 18)', [2], 1, 12),
    unitFamily('fracof:third', 'A third of an amount (1/3 of 15)', [3], 1, 10),
    unitFamily('fracof:quarter', 'A quarter of an amount (1/4 of 20)', [4], 1, 10),
    unitFamily('fracof:fifth', 'A fifth of an amount (1/5 of 35)', [5], 1, 10),
    unitFamily('fracof:tenth', 'A tenth of an amount (1/10 of 70)', [10], 1, 10),
    unitFamily('fracof:big', 'A unit fraction of a bigger amount (1/4 of 80)', [2, 3, 4, 5, 10], 11, 25),
    ...Object.keys(NON_UNIT).map(nonUnitFamily),
    ...equivFamilies,
    wholeFamily('whole:half', 'The whole from a half (1/2 of ? = 14)', [[1, 2]], 2, 30),
    wholeFamily('whole:unit', 'The whole from a unit fraction (1/4 of ? = 6)', [[1, 3], [1, 4], [1, 5], [1, 10]], 2, 12),
    wholeFamily('whole:thirds', 'The whole from two thirds (2/3 of ? = 12)', [[2, 3]], 2, 12),
    wholeFamily('whole:quarters', 'The whole from three quarters (3/4 of ? = 90)', [[3, 4]], 2, 12),
    wholeFamily('whole:other', 'The whole from another fraction (3/5 of ? = 18)', [[2, 5], [3, 5], [4, 5], [3, 8], [5, 8], [3, 10], [7, 10], [5, 6]], 2, 10),
  ].map((f) => [f.keys[0], f]),
);

export const FRACTION_SKILL_KEYS = {
  'unit-fraction-of': ['fracof:half', 'fracof:third', 'fracof:quarter', 'fracof:fifth', 'fracof:tenth', 'fracof:big'],
  'fraction-of': Object.keys(NON_UNIT).map((w) => `fracof:non:${w}`),
  'equivalent-fractions': ['equiv:missing-top', 'equiv:missing-bottom', 'equiv:same-as', 'equiv:simplify', 'equiv:simplify-blank'],
  'whole-from-fraction': ['whole:half', 'whole:unit', 'whole:thirds', 'whole:quarters', 'whole:other'],
};
