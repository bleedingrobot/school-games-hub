/**
 * The keys Parrot's See-saw records (docs/PARROT-PLAN.md): equations with a missing number that keeps a see-saw level.
 * They live here, beside the early facts that own them (`equals` families in earlyFacts.ts), and shared/parrot/round.ts
 * reads them from here so there is one list.
 *
 *   eqmiss:8=5+?       eqswap:3+5       eqboth:6+7=8+?       eqsub:3=8-? and eqsub:9-4=2+?       eqtf:5+3=4+4
 */
import { seeded } from '../../seededRandom';
export type Kind = 'miss' | 'swap' | 'both' | 'sub' | 'tf';

/** `eqmiss:8=5+?`: a = b + ?, a 3 to 10. */
const missKeys = (): string[] => {
  const out: string[] = [];
  for (let a = 3; a <= 10; a++) for (let b = 1; b < a; b++) out.push(`eqmiss:${a}=${b}+?`);
  return out;
};
/** `eqswap:3+5`: two different numbers to 7, asked as `x + y = y + ?` and `y + x = x + ?`. */
const swapKeys = (): string[] => {
  const out: string[] = [];
  for (let x = 1; x <= 7; x++) for (let y = x + 1; y <= 7; y++) out.push(`eqswap:${x}+${y}`);
  return out;
};
/** `eqboth:6+7=8+?`: thirty fixed sums to 20, half with the first number moved by one. */
const bothKeys = (): string[] => {
  const random = seeded(20261107);
  const out = new Set<string>();
  const sums: [number, number][] = [];
  for (let a = 3; a <= 10; a++) for (let b = 3; b <= 10; b++) sums.push([a, b]);
  while (out.size < 30) {
    const [a, b] = sums[Math.floor(random() * sums.length)];
    const shift = out.size % 2 === 0 ? (random() < 0.5 ? 1 : -1) : (random() < 0.5 ? 2 : -2) * (1 + Math.floor(random() * 2));
    const c = a + shift;
    if (c < 1 || c === a || c === b || a + b - c < 1) continue;
    out.add(`eqboth:${a}+${b}=${c}+?`);
  }
  return [...out].sort();
};
const SUB1: [number, number][] = [[3, 8], [4, 9], [5, 9], [6, 10], [7, 12], [8, 13], [9, 14], [6, 15], [12, 17], [11, 20]];
const SUB2: [number, number, number][] = [[9, 4, 2], [10, 3, 4], [12, 5, 3], [11, 6, 2], [14, 6, 4], [13, 4, 5], [15, 5, 6], [16, 7, 4], [18, 8, 5], [20, 9, 6]];
/** `eqsub:3=8-?` and `eqsub:9-4=2+?`. */
const subKeys = (): string[] => [...SUB1.map(([a, b]) => `eqsub:${a}=${b}-?`), ...SUB2.map(([a, b, c]) => `eqsub:${a}-${b}=${c}+?`)];
/** `eqtf:5+3=4+4`: half are true, about a quarter are one out, the rest are further out. */
const tfKeys = (): string[] => {
  const random = seeded(20261108);
  const out = new Set<string>();
  const pick = (hi: number) => 1 + Math.floor(random() * hi);
  while (out.size < 30) {
    const a = pick(9), b = pick(9), c = pick(9);
    const i = out.size;
    const d = i % 2 === 0 ? a + b - c : i % 4 === 1 ? a + b - c + (random() < 0.5 ? 1 : -1) : a + b - c + (random() < 0.5 ? 1 : -1) * (2 + pick(2));
    if (d < 1 || d > 10 || (a === c && b === d) || (a === d && b === c && i % 2 === 0 && out.size % 6 !== 0)) continue;
    out.add(`eqtf:${a}+${b}=${c}+${d}`);
  }
  return [...out].sort();
};

export const KEYS: Record<Kind, string[]> = { miss: missKeys(), swap: swapKeys(), both: bothKeys(), sub: subKeys(), tf: tfKeys() };
export const ALL_KEYS = Object.values(KEYS).flat();
