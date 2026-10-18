/**
 * Adding and taking away (the Water topic in Maths Monsters).
 *
 * Band 1: addition facts to 10 + 10, asked as adding, taking away and missing numbers (one
 *         fact each, like 7 × 8 in times tables).
 * Band 2: tens (40 + 30), adding tens to a 2-digit number (47 + 30), and bridging ten (47 + 8).
 * Band 3: 2-digit ± 2-digit, without then with regrouping, and pairs to 100.
 * Band 4: 3-digit ± 3-digit, and near-hundreds (398 + 250, 634 − 299).
 */
import { BandedPack, int, isInt, show, speak, type Family, type Made, type PackDefinition } from '../banded';
import type { FactStats } from '../leitner';

const TODO = (what: string) => [`TODO-${what}`];

const sum = (a: number, b: number, extra: Partial<Made> = {}): Made => {
  const parts = [show(a), '+', show(b), '=', '?'];
  return { parts, spoken: speak(parts), answer: a + b, ...extra };
};
const diff = (a: number, b: number, extra: Partial<Made> = {}): Made => {
  const parts = [show(a), '−', show(b), '=', '?'];
  return { parts, spoken: speak(parts), answer: a - b, ...extra };
};

/** Each column added with no carrying: the classic slip (47 + 36 → 73). */
function noCarry(a: number, b: number): number {
  let out = 0;
  for (let place = 1; a > 0 || b > 0; place *= 10, a = Math.floor(a / 10), b = Math.floor(b / 10)) out += ((a % 10) + (b % 10)) % 10 * place;
  return out;
}
/** Each column taken smaller-from-bigger: the classic slip (52 − 37 → 25). */
function smallerFromBigger(a: number, b: number): number {
  let out = 0;
  for (let place = 1; a > 0 || b > 0; place *= 10, a = Math.floor(a / 10), b = Math.floor(b / 10)) out += Math.abs((a % 10) - (b % 10)) * place;
  return out;
}

const addWrong = (a: number, b: number) => {
  const s = a + b;
  return [noCarry(a, b), s + 10, s - 10, s + 1, s - 1, s + 100, s - 100];
};
const subWrong = (a: number, b: number) => {
  const d = a - b;
  return [smallerFromBigger(a, b), d + 10, d - 10, d + 1, d - 1, a + b];
};

// ---- band 1: facts. Key "add:a+b" with a ≤ b, both 1–10.
const factKeys: string[] = [];
for (let a = 1; a <= 10; a++) for (let b = a; b <= 10; b++) factKeys.push(`add:${a}+${b}`);
const parseFact = (key: string) => {
  const m = /^add:(\d+)\+(\d+)$/.exec(key);
  return m ? { a: Number(m[1]), b: Number(m[2]) } : null;
};

/** Variants: 0 a + b, 1 b + a, 2 (a+b) − a, 3 (a+b) − b, 4 a + ? = a+b. */
const facts: Family = {
  label: 'Adding and taking away facts to 20',
  curriculumTags: TODO('addition-facts'),
  keys: factKeys,
  roll: (key, r) => {
    const { a, b } = parseFact(key)!;
    return [a, b, int(r, 0, 4)];
  },
  make: (key, [a, b, v]) => {
    const fact = parseFact(key);
    if (!fact || fact.a !== a || fact.b !== b || !isInt(v, 0, 4)) return null;
    const s = a + b;
    if (v === 0) return sum(a, b, { wrong: [s + 1, s - 1, s + 2, s - 2] });
    if (v === 1) return sum(b, a, { wrong: [s + 1, s - 1, s + 2, s - 2] });
    if (v === 2) return diff(s, a, { wrong: [b + 1, b - 1, s + a, b + 2] });
    if (v === 3) return diff(s, b, { wrong: [a + 1, a - 1, s + b, a + 2] });
    const parts = [String(a), '+', '?', '=', String(s)];
    return { parts, spoken: speak(parts), answer: b, wrong: [s, b + 1, b - 1, a] };
  },
};

/** A family with one key, two numbers and a check on them. */
function kind(
  key: string,
  label: string,
  tag: string,
  roll: (r: () => number) => [number, number],
  valid: (a: number, b: number) => boolean,
  make: (a: number, b: number) => Made,
): Family {
  return {
    label,
    curriculumTags: TODO(tag),
    keys: [key],
    roll: (_k, r) => roll(r),
    make: (_k, [a, b]) => (isInt(a, 0, 9999) && isInt(b, 0, 9999) && valid(a, b) ? make(a, b) : null),
  };
}

const ones = (n: number) => n % 10;
const tens = (n: number) => Math.floor(n / 10) % 10;

const families: Record<string, Family> = {
  facts,

  // ---- band 2
  'add:tens': kind(
    'add:tens',
    'Adding tens (40 + 30)',
    'add-tens',
    (r) => [int(r, 1, 9) * 10, int(r, 1, 9) * 10],
    (a, b) => a % 10 === 0 && b % 10 === 0 && a >= 10 && a <= 90 && b >= 10 && b <= 90,
    (a, b) => sum(a, b, { wrong: [a + b + 10, a + b - 10, (a + b) / 10, a + b + 100] }),
  ),
  'sub:tens': kind(
    'sub:tens',
    'Taking away tens (120 − 40)',
    'sub-tens',
    (r) => {
      const b = int(r, 1, 9) * 10;
      return [b + int(r, 1, 9) * 10, b];
    },
    (a, b) => a % 10 === 0 && b % 10 === 0 && b >= 10 && b <= 90 && a - b >= 10 && a - b <= 90,
    (a, b) => diff(a, b, { wrong: [a - b + 10, a - b - 10, a + b] }),
  ),
  'add:2d+tens': kind(
    'add:2d+tens',
    'Adding tens to a 2-digit number (47 + 30)',
    'add-tens-to-2d',
    (r) => [int(r, 1, 6) * 10 + int(r, 1, 9), int(r, 1, 3) * 10],
    (a, b) => a >= 11 && a <= 69 && ones(a) !== 0 && b % 10 === 0 && b >= 10 && b <= 30,
    (a, b) => sum(a, b, { wrong: addWrong(a, b).concat([a + b / 10]) }),
  ),
  'sub:2d-tens': kind(
    'sub:2d-tens',
    'Taking tens from a 2-digit number (77 − 30)',
    'sub-tens-from-2d',
    (r) => {
      const b = int(r, 1, 3) * 10;
      return [b + int(r, 1, 5) * 10 + int(r, 1, 9), b];
    },
    (a, b) => b % 10 === 0 && b >= 10 && b <= 30 && a - b >= 11 && a - b <= 59 && ones(a) !== 0,
    (a, b) => diff(a, b, { wrong: subWrong(a, b).concat([a - b / 10]) }),
  ),
  'add:bridge10': kind(
    'add:bridge10',
    'Adding across a ten (47 + 8)',
    'add-bridge-ten',
    (r) => {
      const a = int(r, 1, 8) * 10 + int(r, 2, 9);
      return [a, int(r, 11 - ones(a), 9)];
    },
    (a, b) => a >= 12 && a <= 89 && b >= 2 && b <= 9 && ones(a) + b >= 10,
    (a, b) => sum(a, b, { wrong: addWrong(a, b) }),
  ),
  'sub:bridge10': kind(
    'sub:bridge10',
    'Taking away across a ten (53 − 8)',
    'sub-bridge-ten',
    (r) => {
      const a = int(r, 2, 9) * 10 + int(r, 0, 7);
      return [a, int(r, Math.max(2, ones(a) + 1), 9)];
    },
    (a, b) => a >= 20 && a <= 97 && b >= 2 && b <= 9 && ones(a) < b,
    (a, b) => diff(a, b, { wrong: subWrong(a, b) }),
  ),

  // ---- band 3
  'add:2d+2d': kind(
    'add:2d+2d',
    'Adding 2-digit numbers (34 + 25)',
    'add-2d',
    (r) => {
      const a = int(r, 1, 7) * 10 + int(r, 1, 8);
      return [a, int(r, 1, 8 - tens(a)) * 10 + int(r, 1, 9 - ones(a))];
    },
    (a, b) => a >= 10 && a <= 99 && b >= 10 && b <= 99 && ones(a) + ones(b) <= 9 && a + b <= 99,
    (a, b) => sum(a, b, { wrong: addWrong(a, b) }),
  ),
  'sub:2d-2d': kind(
    'sub:2d-2d',
    'Taking away 2-digit numbers (59 − 25)',
    'sub-2d',
    (r) => {
      const b = int(r, 1, 7) * 10 + int(r, 1, 8);
      return [b + int(r, 1, 9 - tens(b)) * 10 + int(r, 0, 9 - ones(b)), b];
    },
    (a, b) => a >= 10 && a <= 99 && b >= 10 && b <= 99 && a > b && ones(a) >= ones(b) && a - b >= 10,
    (a, b) => diff(a, b, { wrong: subWrong(a, b) }),
  ),
  'add:2d+2d:carry': kind(
    'add:2d+2d:carry',
    'Adding 2-digit numbers, with regrouping (47 + 36)',
    'add-2d-regroup',
    (r) => {
      const a = int(r, 1, 7) * 10 + int(r, 2, 9);
      return [a, int(r, 1, 8 - tens(a)) * 10 + int(r, 10 - ones(a), 9)];
    },
    (a, b) => a >= 10 && a <= 99 && b >= 10 && b <= 99 && ones(a) + ones(b) >= 10 && a + b <= 99,
    (a, b) => sum(a, b, { wrong: addWrong(a, b) }),
  ),
  'sub:2d-2d:borrow': kind(
    'sub:2d-2d:borrow',
    'Taking away 2-digit numbers, with regrouping (52 − 37)',
    'sub-2d-regroup',
    (r) => {
      const a = int(r, 3, 9) * 10 + int(r, 0, 8);
      return [a, int(r, 1, tens(a) - 2) * 10 + int(r, ones(a) + 1, 9)];
    },
    (a, b) => a >= 30 && a <= 99 && b >= 10 && b <= 99 && ones(a) < ones(b) && a - b >= 10,
    (a, b) => diff(a, b, { wrong: subWrong(a, b) }),
  ),
  'add:to100': {
    label: 'Pairs that make 100 (64 + ? = 100)',
    curriculumTags: TODO('pairs-to-100'),
    keys: ['add:to100'],
    roll: (_k, r) => [int(r, 1, 8) * 10 + int(r, 1, 9)],
    make: (_k, [a]) => {
      if (!isInt(a, 11, 89) || a % 10 === 0) return null;
      const parts = [String(a), '+', '?', '=', '100'];
      const b = 100 - a;
      // The classic slip: each digit made up to 10 (64 → 46).
      return { parts, spoken: speak(parts), answer: b, wrong: [(10 - tens(a)) * 10 + (10 - ones(a)), b + 10, b - 10, b + 1] };
    },
  },

  // ---- band 4
  'add:3d+3d': kind(
    'add:3d+3d',
    'Adding 3-digit numbers (456 + 278)',
    'add-3d',
    (r) => {
      const a = int(r, 101, 799);
      return [a, int(r, 101, 999 - a)];
    },
    (a, b) => a >= 101 && a <= 799 && b >= 101 && a + b <= 999,
    (a, b) => sum(a, b, { wrong: addWrong(a, b) }),
  ),
  'sub:3d-3d': kind(
    'sub:3d-3d',
    'Taking away 3-digit numbers (502 − 178)',
    'sub-3d',
    (r) => {
      const b = int(r, 101, 799);
      return [int(r, b + 11, 999), b];
    },
    (a, b) => a >= 112 && a <= 999 && b >= 101 && b <= 799 && a - b >= 11,
    (a, b) => diff(a, b, { wrong: subWrong(a, b) }),
  ),
  'add:near100': kind(
    'add:near100',
    'Adding a number close to a hundred (398 + 250)',
    'add-compensate',
    (r) => [int(r, 1, 5) * 100 - int(r, 1, 3), int(r, 11, 49) * 10],
    (a, b) => a % 100 >= 97 && a >= 97 && a <= 499 && b % 10 === 0 && b >= 110 && b <= 490,
    (a, b) => sum(a, b, { wrong: [a + b + 2, Math.ceil(a / 100) * 100 + b, a + b - 10, a + b + 10] }),
  ),
  'sub:near100': kind(
    'sub:near100',
    'Taking away a number close to a hundred (634 − 299)',
    'sub-compensate',
    (r) => {
      const b = int(r, 1, 4) * 100 - int(r, 1, 3);
      return [int(r, Math.ceil(b / 100) * 100 + 11, 999), b];
    },
    (a, b) => b % 100 >= 97 && b >= 97 && b <= 399 && a <= 999 && a - b >= 12,
    (a, b) => diff(a, b, { wrong: [a - Math.ceil(b / 100) * 100, a - b + 2, a - b - 2, a - b + 10] }),
  ),
};

export const ADD_SUB: PackDefinition = {
  id: 'add-sub',
  label: 'Adding and taking away',
  families,
  bands: [
    ['facts'],
    ['add:tens', 'sub:tens', 'add:2d+tens', 'sub:2d-tens', 'add:bridge10', 'sub:bridge10'],
    ['add:2d+2d', 'sub:2d-2d', 'add:2d+2d:carry', 'sub:2d-2d:borrow', 'add:to100'],
    ['add:3d+3d', 'sub:3d-3d', 'add:near100', 'sub:near100'],
  ],
};

export const addSubPack = (saved?: FactStats[], random?: () => number, now?: () => number) => new BandedPack(ADD_SUB, saved, random, now);

