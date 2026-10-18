/**
 * Division (the Ice topic in Maths Monsters).
 *
 * Bands 1–3: division facts (56 ÷ 8 = ?, 56 ÷ ? = 7), one record per fact, in the same
 *            order the times-tables campaign brings tables in: ÷ 2, 5, 10, then ÷ 3, 4,
 *            then ÷ 6–9. (These are kept apart from the times-tables records so each topic
 *            shows its own progress.)
 * Band 4:    2-digit ÷ 1-digit (84 ÷ 4), dividing by 10 and 100, and missing dividends.
 * Band 5:    remainders (23 ÷ 4 = 5 r ?) and 3-digit ÷ 1-digit.
 */
import { BandedPack, int, isInt, show, speak, type Family, type Made, type PackDefinition } from '../banded';
import type { FactStats } from '../leitner';

const TODO = (what: string) => [`TODO-${what}`];

/** Quotients go to 10 in band 1 (like the first Gem Keep levels) and 12 after. */
const factKeys = (divisors: number[], upTo: number) => divisors.flatMap((d) => Array.from({ length: upTo }, (_, i) => `div:${d * (i + 1)}/${d}`));
const parseFact = (key: string) => {
  const m = /^div:(\d+)\/(\d+)$/.exec(key);
  return m ? { n: Number(m[1]), d: Number(m[2]) } : null;
};

function factFamily(label: string, divisors: number[], upTo: number): Family {
  const keys = factKeys(divisors, upTo);
  const owned = new Set(keys);
  return {
    label,
    curriculumTags: TODO('division-facts'),
    keys,
    roll: (key, r) => {
      const { n, d } = parseFact(key)!;
      return [d, n / d, int(r, 0, 3) === 0 ? 1 : 0];
    },
    make: (key, [d, q, v]) => {
      if (!owned.has(key) || !isInt(v, 0, 1) || key !== `div:${d * q}/${d}`) return null;
      const n = d * q;
      if (v === 0) {
        const parts = [String(n), '÷', String(d), '=', '?'];
        return { parts, spoken: speak(parts), answer: q, wrong: [q + 1, q - 1, d, n - d, q + 2] };
      }
      const parts = [String(n), '÷', '?', '=', String(q)];
      return { parts, spoken: speak(parts), answer: d, wrong: [d + 1, d - 1, q, n - q] };
    },
  };
}

const divide = (n: number, d: number, extra: Partial<Made> = {}): Made => {
  const parts = [show(n), '÷', show(d), '=', '?'];
  return { parts, spoken: speak(parts), answer: n / d, ...extra };
};

const families: Record<string, Family> = {
  'facts-2-5-10': factFamily('Division facts: ÷ 2, ÷ 5, ÷ 10', [2, 5, 10], 10),
  'facts-3-4': factFamily('Division facts: ÷ 3, ÷ 4', [3, 4], 12),
  'facts-6-9': factFamily('Division facts: ÷ 6, ÷ 7, ÷ 8, ÷ 9', [6, 7, 8, 9], 12),

  'div:2d/1d': {
    label: 'Dividing a 2-digit number (84 ÷ 4)',
    curriculumTags: TODO('divide-2d-by-1d'),
    keys: ['div:2d/1d'],
    roll: (_k, r) => {
      const d = int(r, 2, 6);
      return [d, int(r, 11, Math.floor(99 / d))];
    },
    make: (_k, [d, q]) => {
      if (!isInt(d, 2, 6) || !isInt(q, 11, Math.floor(99 / d))) return null;
      const n = d * q;
      return divide(n, d, { wrong: [q + 1, q - 1, q + 10, q - 10] });
    },
  },
  'div:by10': {
    label: 'Dividing by 10 and 100 (340 ÷ 10)',
    curriculumTags: TODO('divide-by-10-100'),
    keys: ['div:by10'],
    roll: (_k, r) => [int(r, 1, 9) * 10 + int(r, 1, 9), int(r, 1, 2)],
    make: (_k, [q, p]) => {
      if (!isInt(q, 11, 99) || q % 10 === 0 || !isInt(p, 1, 2)) return null;
      const d = 10 ** p;
      return divide(q * d, d, { wrong: [q * 10, q * 100, q + 1, q - 1] });
    },
  },
  'div:missing': {
    label: 'Missing number in a division (? ÷ 4 = 7)',
    curriculumTags: TODO('division-missing-dividend'),
    keys: ['div:missing'],
    roll: (_k, r) => [int(r, 2, 9), int(r, 2, 12)],
    make: (_k, [d, q]) => {
      if (!isInt(d, 2, 9) || !isInt(q, 2, 12)) return null;
      const parts = ['?', '÷', String(d), '=', String(q)];
      return { parts, spoken: speak(parts), answer: d * q, wrong: [d + q, d * q + d, d * q - d, d * (q + 1) + 1] };
    },
  },

  'div:remainder': {
    label: 'Remainders (23 ÷ 4 = 5 r ?)',
    curriculumTags: TODO('division-remainders'),
    keys: ['div:remainder'],
    roll: (_k, r) => {
      const d = int(r, 3, 9);
      return [d, int(r, 2, 9), int(r, 1, d - 1)];
    },
    make: (_k, [d, q, rem]) => {
      if (!isInt(d, 3, 9) || !isInt(q, 2, 9) || !isInt(rem, 1, d - 1)) return null;
      const n = d * q + rem;
      const parts = [String(n), '÷', String(d), '=', String(q), 'r', '?'];
      return { parts, spoken: speak(parts), answer: rem, wrong: [d - rem, rem + 1, rem - 1, n - d * q + d], fact: `${n} ÷ ${d} = ${q} r ${rem}` };
    },
  },
  'div:3d/1d': {
    label: 'Dividing a 3-digit number (756 ÷ 7)',
    curriculumTags: TODO('divide-3d-by-1d'),
    keys: ['div:3d/1d'],
    roll: (_k, r) => {
      const d = int(r, 3, 9);
      return [d, int(r, Math.ceil(100 / d), Math.floor(999 / d))];
    },
    make: (_k, [d, q]) => {
      if (!isInt(d, 3, 9) || !isInt(q, Math.ceil(100 / d), Math.floor(999 / d))) return null;
      return divide(d * q, d, { wrong: [q + 1, q - 1, q + 10, q - 10, q * 10] });
    },
  },
};

export const DIVISION: PackDefinition = {
  id: 'division',
  label: 'Division',
  families,
  bands: [['facts-2-5-10'], ['facts-3-4'], ['facts-6-9'], ['div:2d/1d', 'div:by10', 'div:missing'], ['div:remainder', 'div:3d/1d']],
};

export const divisionPack = (saved?: FactStats[], random?: () => number, now?: () => number) => new BandedPack(DIVISION, saved, random, now);
