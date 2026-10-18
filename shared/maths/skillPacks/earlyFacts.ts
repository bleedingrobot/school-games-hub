/**
 * The first rungs of the maths ladder: number facts a student should know by heart before
 * times tables. One mastery record per fact, like 7 × 8 in times tables.
 *
 * Keys: "bond10:3+7" (pairs that make 10), "bond20:8+12" (pairs that make 20), "dbl:7"
 * (double 7) and "half:14" (half of 14). Adding and taking away within 20 keeps its own
 * "add:7+8" records (add-sub pack), so nothing already saved changes.
 *
 * Bands: 1 bonds to 10, 2 doubles and halves to 10, 3 bonds to 20, 4 doubles and halves to 20.
 */
import { BandedPack, int, isInt, speak, type Family, type PackDefinition } from '../banded';
import type { FactStats } from '../leitner';

const bondKeys = (prefix: string, total: number, from: number) => {
  const keys: string[] = [];
  for (let a = from; a <= total / 2; a++) keys.push(`${prefix}:${a}+${total - a}`);
  return keys;
};
const parseBond = (key: string) => {
  const m = /^bond(10|20):(\d+)\+(\d+)$/.exec(key);
  return m ? { total: Number(m[1]), a: Number(m[2]), b: Number(m[3]) } : null;
};

/** Variants: 0 a + ? = total, 1 ? + b = total, 2 total − a = ?, 3 total − b = ?. */
function bonds(label: string, tag: string, prefix: string, total: number, from: number): Family {
  const keys = bondKeys(prefix, total, from);
  return {
    label,
    curriculumTags: [tag],
    keys,
    roll: (key, r) => {
      const { a, b } = parseBond(key)!;
      return [a, b, int(r, 0, 3)];
    },
    make: (key, [a, b, v]) => {
      const bond = parseBond(key);
      if (!bond || bond.total !== total || bond.a !== a || bond.b !== b || !keys.includes(key) || !isInt(v, 0, 3)) return null;
      const t = String(total);
      const [parts, answer] =
        v === 0 ? [[String(a), '+', '?', '=', t], b]
        : v === 1 ? [['?', '+', String(b), '=', t], a]
        : v === 2 ? [[t, '−', String(a), '=', '?'], b]
        : [[t, '−', String(b), '=', '?'], a];
      return { parts: parts as string[], spoken: speak(parts as string[]), answer: answer as number, wrong: [answer as number + 1, answer as number - 1, total, answer as number + 2, answer as number - 2, a + b + 1] };
    },
  };
}

const range = (from: number, to: number, step = 1) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

/** Doubles of dblFrom–dblTo and halves of the even numbers halfFrom–halfTo. */
function doublesHalves(label: string, tag: string, dblFrom: number, dblTo: number, halfFrom: number, halfTo: number): Family {
  const dbls = range(dblFrom, dblTo);
  const halves = range(halfFrom, halfTo, 2);
  const keys = [...dbls.map((n) => `dbl:${n}`), ...halves.map((n) => `half:${n}`)];
  return {
    label,
    curriculumTags: [tag],
    keys,
    roll: (key, r) => [Number(key.split(':')[1]), int(r, 0, 1)],
    make: (key, [n, v]) => {
      if (!keys.includes(key) || key.split(':')[1] !== String(n) || !isInt(v, 0, 1)) return null;
      if (key.startsWith('dbl:')) {
        const parts = v === 0 ? [String(n), '+', String(n), '=', '?'] : ['Double', String(n), '=', '?'];
        return { parts, spoken: speak(parts), answer: 2 * n, wrong: [2 * n + 1, 2 * n - 1, 2 * n + 2, 2 * n - 2, n + 1, n * n] };
      }
      const parts = v === 0 ? ['Half', 'of', String(n), '=', '?'] : [String(n), '÷', '2', '=', '?'];
      const answer = n / 2;
      return { parts, spoken: speak(parts), answer, wrong: [answer + 1, answer - 1, n, answer + 2, answer - 2] };
    },
  };
}

const families: Record<string, Family> = {
  bond10: bonds('Pairs that make 10', 'MS.Y1.NUM.OP.P1', 'bond10', 10, 0),
  dblHalf10: doublesHalves('Doubles and halves to 10', 'MS.Y1.NUM.OP.P2', 1, 5, 2, 10),
  bond20: bonds('Pairs that make 20', 'MS.Y2.NUM.OP.P1', 'bond20', 20, 1),
  dblHalf20: doublesHalves('Doubles and halves to 20', 'MS.Y2.NUM.OP.P2', 6, 10, 12, 20),
};

export const EARLY_FACTS: PackDefinition = {
  id: 'early-facts',
  label: 'Early number facts',
  families,
  bands: [['bond10'], ['dblHalf10'], ['bond20'], ['dblHalf20']],
};

export const earlyFactsPack = (saved?: FactStats[], random?: () => number, now?: () => number) => new BandedPack(EARLY_FACTS, saved, random, now);
