/**
 * Decimals and money (the Stone topic in Maths Monsters). Every question here has a decimal
 * point key on the number pad. The numbers are kept as whole tenths, hundredths or cents, so
 * nothing suffers from floating-point dust.
 *
 * Band 1: adding and taking away tenths (0.3 + 0.5, 1.5 − 0.7), tenths from fractions (7/10).
 * Band 2: money: adding prices, and change from $5, $10 or $20.
 * Band 3: hundredths (0.25 + 0.5), which decimal is bigger (0.5 or 0.45), × 10 and × 100.
 * Band 4: rounding to a whole number, decimals × whole numbers, fractions as decimals (3/4 = 0.75).
 */
import { BandedPack, dollars, int, isInt, pickOne, show, speak, tidy, type Family, type Made, type PackDefinition } from '../banded';
import type { FactStats } from '../leitner';
import { AS_DECIMAL } from './generatedKit';

const TODO = (what: string) => [`TODO-${what}`];

const tenths = (n: number) => show(n / 10);
const hundredths = (n: number) => show(n / 100);

const decimal = (made: Made): Made => ({ ...made, input: 'decimal' });

const FRACTIONS_AS_DECIMALS: [number, number][] = [
  [1, 2],
  [1, 4],
  [3, 4],
  [1, 5],
  [2, 5],
  [3, 5],
  [4, 5],
];

const families: Record<string, Family> = {
  'dec:tenths:add': {
    label: 'Adding tenths (0.3 + 0.5)',
    curriculumTags: TODO('add-tenths'),
    keys: ['dec:tenths:add'],
    roll: (_k, r) => [int(r, 1, 9), int(r, 1, 9)],
    make: (_k, [a, b]) => {
      if (!isInt(a, 1, 9) || !isInt(b, 1, 9)) return null;
      const parts = [tenths(a), '+', tenths(b), '=', '?'];
      const s = a + b;
      // Slips: 0.3 + 0.5 = 0.08 or 8; 0.7 + 0.6 = 0.13 or 0.3 (lost the carry).
      return decimal({ parts, spoken: speak(parts), answer: s / 10, wrong: [s / 100, s, (s % 10) / 10, (s + 1) / 10, (s - 1) / 10] });
    },
  },
  'dec:tenths:sub': {
    label: 'Taking away tenths (1.5 − 0.7)',
    curriculumTags: TODO('subtract-tenths'),
    keys: ['dec:tenths:sub'],
    roll: (_k, r) => {
      const a = int(r, 2, 19);
      return [a, int(r, 1, Math.min(9, a - 1))];
    },
    make: (_k, [a, b]) => {
      if (!isInt(a, 2, 19) || !isInt(b, 1, Math.min(9, a - 1))) return null;
      const parts = [tenths(a), '−', tenths(b), '=', '?'];
      const d = a - b;
      return decimal({ parts, spoken: speak(parts), answer: d / 10, wrong: [d / 100, Math.abs((a % 10) - b) / 10 + Math.floor(a / 10), (d + 1) / 10, (d - 1) / 10] });
    },
  },
  'dec:from-frac:tenths': {
    label: 'Tenths as decimals (7/10 = 0.7)',
    curriculumTags: TODO('tenths-as-decimals'),
    keys: ['dec:from-frac:tenths'],
    roll: (_k, r) => [int(r, 1, 9)],
    make: (_k, [n]) => {
      if (!isInt(n, 1, 9)) return null;
      const parts = [`${n}/10`, '=', '?'];
      return decimal({ parts, spoken: speak(parts), prompt: AS_DECIMAL, answer: n / 10, wrong: [n, n / 100, (n + 1) / 10, Number(`${n}.1`)] });
    },
  },

  'money:add': {
    label: 'Adding money ($2.40 + $1.75)',
    curriculumTags: TODO('money-add'),
    keys: ['money:add'],
    roll: (_k, r) => [int(r, 21, 199) * 5, int(r, 21, 199) * 5],
    make: (_k, [a, b]) => {
      if (!isInt(a, 105, 995) || !isInt(b, 105, 995) || a % 5 || b % 5) return null;
      const parts = [dollars(a), '+', dollars(b), '=', '$', '?'];
      const s = a + b;
      // Slip: adding cents without carrying a dollar ($2.40 + $1.75 = $3.15).
      const noCarry = (Math.floor(a / 100) + Math.floor(b / 100)) * 100 + ((a % 100) + (b % 100)) % 100;
      return decimal({ parts, spoken: speak(parts), answer: s / 100, wrong: [noCarry / 100, (s + 100) / 100, (s + 10) / 100, (s - 10) / 100], fact: `${dollars(a)} + ${dollars(b)} = ${dollars(s)}` });
    },
  },
  'money:change': {
    label: 'Working out change ($10 − $3.65)',
    curriculumTags: TODO('money-change'),
    keys: ['money:change'],
    roll: (_k, r) => {
      const paid = pickOne(r, [500, 1000, 2000]);
      return [paid, int(r, 21, paid / 5 - 1) * 5];
    },
    make: (_k, [paid, cost]) => {
      if (![500, 1000, 2000].includes(paid) || !isInt(cost, 105, paid - 5) || cost % 5) return null;
      const parts = [dollars(paid), '−', dollars(cost), '=', '$', '?'];
      const c = paid - cost;
      return decimal({ parts, spoken: speak(parts), answer: c / 100, wrong: [(c + 100) / 100, (c + 10) / 100, (c - 10) / 100, (c + 20) / 100], fact: `${dollars(paid)} − ${dollars(cost)} = ${dollars(c)}` });
    },
  },

  'dec:hundredths:add': {
    label: 'Adding hundredths (0.25 + 0.5)',
    curriculumTags: TODO('add-hundredths'),
    keys: ['dec:hundredths:add'],
    roll: (_k, r) => {
      let a: number;
      do a = int(r, 11, 99);
      while (a % 10 === 0);
      return [a, int(r, 1, 9) * 10];
    },
    make: (_k, [a, b]) => {
      if (!isInt(a, 11, 99) || a % 10 === 0 || !isInt(b, 10, 90) || b % 10) return null;
      const parts = [hundredths(a), '+', hundredths(b), '=', '?'];
      // Slip: lining the digits up on the right (0.25 + 0.5 = 0.30).
      return decimal({ parts, spoken: speak(parts), answer: (a + b) / 100, wrong: [(a + b / 10) / 100, (a + b + 10) / 100, (a + b + 1) / 100, (a + b - 10) / 100] });
    },
  },
  'dec:compare': {
    label: 'Which decimal is bigger? (0.5 or 0.45)',
    curriculumTags: TODO('compare-decimals'),
    keys: ['dec:compare'],
    roll: (_k, r) => {
      const a = int(r, 1, 9) * 10;
      let b: number;
      do b = int(r, 11, 99);
      while (b % 10 === 0);
      return r() < 0.5 ? [a, b] : [b, a];
    },
    make: (_k, [a, b]) => {
      if (!isInt(a, 1, 99) || !isInt(b, 1, 99) || a === b || (a % 10 === 0) === (b % 10 === 0)) return null;
      const labels = [hundredths(a), hundredths(b)];
      const answer = a > b ? 0 : 1;
      return decimal({
        parts: ['Which is bigger?'],
        spoken: `Which is bigger: ${labels[0]} or ${labels[1]}?`,
        answer,
        pick: labels,
        fact: `${labels[answer]} is bigger than ${labels[1 - answer]}`,
      });
    },
  },
  'dec:times10': {
    label: 'Decimals × 10 and × 100 (0.7 × 10)',
    curriculumTags: TODO('decimals-times-powers-of-ten'),
    keys: ['dec:times10'],
    roll: (_k, r) => {
      let a: number;
      do a = int(r, 1, 99);
      while (a % 10 === 0);
      return [a, int(r, 1, 2)];
    },
    make: (_k, [a, p]) => {
      if (!isInt(a, 1, 99) || a % 10 === 0 || !isInt(p, 1, 2)) return null;
      const m = 10 ** p;
      const parts = [tenths(a), '×', String(m), '=', '?'];
      const answer = tidy((a * m) / 10);
      // Slip: "add a zero" (3.6 × 10 = 3.60).
      return decimal({ parts, spoken: speak(parts), answer, wrong: [a / 10, answer * 10, answer / 10, a / 10 + m] });
    },
  },

  'dec:round': {
    label: 'Rounding decimals to a whole number (3.6 → 4)',
    curriculumTags: TODO('round-decimals'),
    keys: ['dec:round'],
    roll: (_k, r) => {
      let a: number;
      do a = int(r, 11, 199);
      while (a % 10 === 0);
      return [a];
    },
    make: (_k, [a]) => {
      if (!isInt(a, 11, 199) || a % 10 === 0) return null;
      const down = Math.floor(a / 10);
      const answer = a % 10 >= 5 ? down + 1 : down;
      const parts = ['Round', tenths(a), 'to the nearest whole number:', '?'];
      return decimal({
        parts,
        spoken: speak(parts),
        answer,
        wrong: [answer === down ? down + 1 : down, a, answer + 1, a / 10],
        fact: `${tenths(a)} rounded to the nearest whole number is ${answer}`,
      });
    },
  },
  'dec:times-whole': {
    label: 'Decimals × whole numbers (0.3 × 4)',
    curriculumTags: TODO('multiply-decimals'),
    keys: ['dec:times-whole'],
    roll: (_k, r) => [int(r, 1, 9), int(r, 2, 9)],
    make: (_k, [a, b]) => {
      if (!isInt(a, 1, 9) || !isInt(b, 2, 9)) return null;
      const parts = [tenths(a), '×', String(b), '=', '?'];
      return decimal({ parts, spoken: speak(parts), answer: (a * b) / 10, wrong: [a * b, (a * b) / 100, (a * b + 1) / 10, (a * b - 1) / 10] });
    },
  },
  'dec:from-frac': {
    label: 'Fractions as decimals (3/4 = 0.75)',
    curriculumTags: TODO('fractions-as-decimals'),
    keys: ['dec:from-frac'],
    roll: (_k, r) => (r() < 0.3 ? [int(r, 1, 99), 100] : pickOne(r, FRACTIONS_AS_DECIMALS)),
    make: (_k, [n, d]) => {
      const ok = d === 100 ? isInt(n, 1, 99) : FRACTIONS_AS_DECIMALS.some(([x, y]) => x === n && y === d);
      if (!ok) return null;
      const parts = [`${n}/${d}`, '=', '?'];
      // Slips: writing the digits with a point (1/4 = 1.4), or tenths for hundredths (3/100 = 0.3).
      return decimal({ parts, spoken: speak(parts), answer: n / d, wrong: [Number(`${n}.${d}`), n / 10, tidy(n / d + 0.1), d / n / 10] });
    },
  },
};

export const DECIMALS: PackDefinition = {
  id: 'decimals',
  label: 'Decimals and money',
  families,
  bands: [
    ['dec:tenths:add', 'dec:tenths:sub', 'dec:from-frac:tenths'],
    ['money:add', 'money:change'],
    ['dec:hundredths:add', 'dec:compare', 'dec:times10'],
    ['dec:round', 'dec:times-whole', 'dec:from-frac'],
  ],
};

export const decimalsPack = (saved?: FactStats[], random?: () => number, now?: () => number) => new BandedPack(DECIMALS, saved, random, now);
