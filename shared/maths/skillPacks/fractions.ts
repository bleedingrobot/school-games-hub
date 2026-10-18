/**
 * Fractions (the Spark topic in Maths Monsters). A part like '3/4' is drawn as a fraction,
 * and '?/8' puts the blank in the top.
 *
 * Band 1: unit fractions of amounts (1/4 of 20), comparing with the same bottom number.
 * Band 2: other fractions of amounts (3/4 of 20), equivalent fractions (1/2 = ?/8), comparing
 *         with the same top number (2/3 or 2/5: the "bigger bottom = bigger fraction" trap).
 * Band 3: adding and taking away with the same bottom number, mixed numbers ↔ improper fractions.
 * Band 4: comparing any two fractions, simplifying (6/8 = 3/?).
 */
import { BandedPack, int, isInt, pickOne, speak, type Family, type Made, type PackDefinition } from '../banded';
import type { FactStats } from '../leitner';

const TODO = (what: string) => [`TODO-${what}`];

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const frac = (n: number, d: number) => `${n}/${d}`;

/** A "which is bigger?" question: the answer is the index of the bigger fraction. */
function bigger(n1: number, d1: number, n2: number, d2: number): Made {
  const labels = [frac(n1, d1), frac(n2, d2)];
  const answer = n1 / d1 > n2 / d2 ? 0 : 1;
  const parts = ['Which is bigger?'];
  return {
    parts,
    spoken: `Which is bigger: ${speak([labels[0]]).replace(/\?$/, '')} or ${speak([labels[1]]).replace(/\?$/, '')}?`,
    answer,
    pick: labels,
    fact: `${labels[answer]} is bigger than ${labels[1 - answer]}`,
  };
}

const DENOMINATORS = [2, 3, 4, 5, 6, 8, 10, 12];

const families: Record<string, Family> = {
  'frac:of:unit': {
    label: 'A unit fraction of an amount (1/4 of 20)',
    curriculumTags: TODO('unit-fraction-of-amount'),
    keys: ['frac:of:unit'],
    roll: (_k, r) => [pickOne(r, [2, 3, 4, 5, 10]), int(r, 1, 10)],
    make: (_k, [d, q]) => {
      if (![2, 3, 4, 5, 10].includes(d) || !isInt(q, 1, 10)) return null;
      const parts = [frac(1, d), 'of', String(d * q), '=', '?'];
      return { parts, spoken: speak(parts), answer: q, wrong: [d * q - q, q + 1, q - 1, d, d * q - d] };
    },
  },
  'frac:compare:same-den': {
    label: 'Which fraction is bigger? (same bottom number)',
    curriculumTags: TODO('compare-fractions'),
    keys: ['frac:compare:same-den'],
    roll: (_k, r) => {
      const d = pickOne(r, [3, 4, 5, 6, 8, 10, 12]);
      const a = int(r, 1, d - 1);
      let b = int(r, 1, d - 2);
      if (b >= a) b++;
      return [a, b, d];
    },
    make: (_k, [a, b, d]) => (isInt(d, 3, 12) && isInt(a, 1, d - 1) && isInt(b, 1, d - 1) && a !== b ? bigger(a, d, b, d) : null),
  },

  'frac:of:nonunit': {
    label: 'A fraction of an amount (3/4 of 20)',
    curriculumTags: TODO('fraction-of-amount'),
    keys: ['frac:of:nonunit'],
    roll: (_k, r) => {
      const d = pickOne(r, [3, 4, 5, 8, 10]);
      let n: number;
      do n = int(r, 2, d - 1);
      while (gcd(n, d) !== 1);
      return [n, d, int(r, 1, 10)];
    },
    make: (_k, [n, d, q]) => {
      if (![3, 4, 5, 8, 10].includes(d) || !isInt(n, 2, d - 1) || gcd(n, d) !== 1 || !isInt(q, 1, 10)) return null;
      const parts = [frac(n, d), 'of', String(d * q), '=', '?'];
      // Slips: stopping at the unit fraction (q), or dividing by the top number.
      return { parts, spoken: speak(parts), answer: n * q, wrong: [q, (d * q) / n, n * q + q, n * q - q, d * q - n * q] };
    },
  },
  'frac:equiv': {
    label: 'Equivalent fractions (1/2 = ?/8)',
    curriculumTags: TODO('equivalent-fractions'),
    keys: ['frac:equiv'],
    roll: (_k, r) => {
      const d = int(r, 2, 5);
      let n: number;
      do n = int(r, 1, d - 1);
      while (gcd(n, d) !== 1);
      return [n, d, int(r, 2, 5), int(r, 0, 1)];
    },
    make: (_k, [n, d, k, v]) => {
      if (!isInt(d, 2, 5) || !isInt(n, 1, d - 1) || gcd(n, d) !== 1 || !isInt(k, 2, 5) || !isInt(v, 0, 1)) return null;
      const blank = v === 0 ? `?/${d * k}` : `${n * k}/?`;
      const parts = [frac(n, d), '=', blank];
      // The adding slip: 1/2 = ?/8 → 7 (added 6 to both).
      return v === 0
        ? { parts, spoken: speak(parts), answer: n * k, wrong: [n + d * k - d, n * k + 1, n * k - 1, d * k - n] }
        : { parts, spoken: speak(parts), answer: d * k, wrong: [d + n * k - n, d * k + 1, d * k - 1, n * k + d] };
    },
  },
  'frac:compare:same-num': {
    label: 'Which fraction is bigger? (same top number)',
    curriculumTags: TODO('compare-fractions'),
    keys: ['frac:compare:same-num'],
    roll: (_k, r) => {
      const d1 = pickOne(r, DENOMINATORS);
      let d2: number;
      do d2 = pickOne(r, DENOMINATORS);
      while (d2 === d1);
      return [int(r, 1, Math.min(d1, d2) - 1), d1, d2];
    },
    make: (_k, [n, d1, d2]) =>
      DENOMINATORS.includes(d1) && DENOMINATORS.includes(d2) && d1 !== d2 && isInt(n, 1, Math.min(d1, d2) - 1) ? bigger(n, d1, n, d2) : null,
  },

  'frac:add:same-den': {
    label: 'Adding fractions with the same bottom number',
    curriculumTags: TODO('add-fractions'),
    keys: ['frac:add:same-den'],
    roll: (_k, r) => {
      const d = int(r, 3, 12);
      const a = int(r, 1, d - 2);
      return [a, int(r, 1, d - 1 - a), d];
    },
    make: (_k, [a, b, d]) => {
      if (!isInt(d, 3, 12) || !isInt(a, 1, d - 2) || !isInt(b, 1, d - 1 - a)) return null;
      const parts = [frac(a, d), '+', frac(b, d), '=', `?/${d}`];
      return { parts, spoken: speak(parts), answer: a + b, wrong: [a + b + 1, a + b - 1, a * b, Math.abs(a - b)] };
    },
  },
  'frac:sub:same-den': {
    label: 'Taking away fractions with the same bottom number',
    curriculumTags: TODO('subtract-fractions'),
    keys: ['frac:sub:same-den'],
    roll: (_k, r) => {
      const d = int(r, 3, 12);
      const a = int(r, 2, d);
      return [a, int(r, 1, a - 1), d];
    },
    make: (_k, [a, b, d]) => {
      if (!isInt(d, 3, 12) || !isInt(a, 2, d) || !isInt(b, 1, a - 1)) return null;
      const parts = [frac(a, d), '−', frac(b, d), '=', `?/${d}`];
      return { parts, spoken: speak(parts), answer: a - b, wrong: [a + b, a - b + 1, a - b - 1, d - b] };
    },
  },
  'frac:improper': {
    label: 'Mixed numbers and improper fractions (2 1/3 = ?/3)',
    curriculumTags: TODO('mixed-numbers'),
    keys: ['frac:improper'],
    roll: (_k, r) => {
      const d = int(r, 2, 8);
      return [int(r, 1, 4), int(r, 1, d - 1), d, int(r, 0, 1)];
    },
    make: (_k, [w, n, d, v]) => {
      if (!isInt(d, 2, 8) || !isInt(w, 1, 4) || !isInt(n, 1, d - 1) || !isInt(v, 0, 1)) return null;
      const top = w * d + n;
      if (v === 0) {
        const parts = [`${w} ${frac(n, d)}`, '=', `?/${d}`];
        return { parts, spoken: speak(parts), answer: top, wrong: [w + n, w * n + d, top + 1, top - 1, w * d] };
      }
      const parts = [frac(top, d), '=', `? ${frac(n, d)}`];
      return { parts, spoken: speak(parts), answer: w, wrong: [w + 1, w - 1, top - n, n] };
    },
  },

  'frac:compare:mixed': {
    label: 'Which fraction is bigger? (any two)',
    curriculumTags: TODO('compare-fractions'),
    keys: ['frac:compare:mixed'],
    roll: (_k, r) => {
      for (;;) {
        const d1 = pickOne(r, DENOMINATORS);
        const d2 = pickOne(r, DENOMINATORS);
        const n1 = int(r, 1, d1 - 1);
        const n2 = int(r, 1, d2 - 1);
        if (d1 !== d2 && n1 !== n2 && n1 * d2 !== n2 * d1) return [n1, d1, n2, d2];
      }
    },
    make: (_k, [n1, d1, n2, d2]) =>
      DENOMINATORS.includes(d1) && DENOMINATORS.includes(d2) && d1 !== d2 && isInt(n1, 1, d1 - 1) && isInt(n2, 1, d2 - 1) && n1 !== n2 && n1 * d2 !== n2 * d1
        ? bigger(n1, d1, n2, d2)
        : null,
  },
  'frac:simplify': {
    label: 'Simplifying fractions (6/8 = 3/?)',
    curriculumTags: TODO('simplify-fractions'),
    keys: ['frac:simplify'],
    roll: (_k, r) => {
      let n: number;
      const d = int(r, 2, 6);
      do n = int(r, 1, d - 1);
      while (gcd(n, d) !== 1);
      return [n, d, int(r, 2, 6), int(r, 0, 1)];
    },
    make: (_k, [n, d, k, v]) => {
      if (!isInt(d, 2, 6) || !isInt(n, 1, d - 1) || gcd(n, d) !== 1 || !isInt(k, 2, 6) || !isInt(v, 0, 1)) return null;
      const parts = [frac(n * k, d * k), '=', v === 0 ? `${n}/?` : `?/${d}`];
      return v === 0
        ? { parts, spoken: speak(parts), answer: d, wrong: [d * k - n * k + n, d + 1, d * k, d - 1] }
        : { parts, spoken: speak(parts), answer: n, wrong: [n * k - d * k + d, n + 1, n * k, n + 2] };
    },
  },
};

export const FRACTIONS: PackDefinition = {
  id: 'fractions',
  label: 'Fractions',
  families,
  bands: [
    ['frac:of:unit', 'frac:compare:same-den'],
    ['frac:of:nonunit', 'frac:equiv', 'frac:compare:same-num'],
    ['frac:add:same-den', 'frac:sub:same-den', 'frac:improper'],
    ['frac:compare:mixed', 'frac:simplify'],
  ],
};

export const fractionsPack = (saved?: FactStats[], random?: () => number, now?: () => number) => new BandedPack(FRACTIONS, saved, random, now);
