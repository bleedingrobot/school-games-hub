import { seeded } from '../seededRandom';

/**
 * A "sister" number: a whole number 1 or 2 away from `n` (never `n`), inside [min, max] and not in `avoid`.
 * The same seed always gives the same answer. Returns null when no number fits.
 */
export function sisterNumber(n: number, seed: number, opts: { min: number; max: number; avoid?: readonly number[] }): number | null {
  const { min, max, avoid = [] } = opts;
  const next = seeded(seed);
  const order = [n + 1, n - 1, n + 2, n - 2];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (const c of order) {
    if (Number.isInteger(c) && c !== n && c >= min && c <= max && !avoid.includes(c)) return c;
  }
  return null;
}
