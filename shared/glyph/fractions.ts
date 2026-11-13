/**
 * Fractions for Glyph Gates: equal or not, the simplest form, the ×-arrows the help shows, and the trap tiles a named
 * misconception makes (docs/GLYPH-PLAN.md, mistakes table). Every trap is checked to be NOT equal to the gold stone and
 * under one, so a trap can never be a right answer.
 */
import { MAX_NUMBER, type TrapKind } from './config';

export interface Frac {
  n: number;
  d: number;
}

export const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
export const simplest = ({ n, d }: Frac): Frac => {
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
};
export const equal = (a: Frac, b: Frac): boolean => a.n * b.d === b.n * a.d;
export const sameFrac = (a: Frac, b: Frac): boolean => a.n === b.n && a.d === b.d;
export const fracText = ({ n, d }: Frac): string => `${n}/${d}`;
/** A proper fraction that fits on a tile. */
export const fits = ({ n, d }: Frac): boolean => Number.isInteger(n) && Number.isInteger(d) && n >= 1 && d >= 2 && n < d && d <= MAX_NUMBER;

/**
 * What the ×-arrows show between the gold stone and a tile: the multiplier on the top and on the bottom when the tile is
 * a whole-number step up or down from the gold stone (5/6 → 20/24 is ×4 and ×4; 20/24 → 5/6 is ÷4 and ÷4). `null` for
 * a side that isn't a whole step (6/7 from 5/6). Equal tiles always have both sides the same.
 */
export interface Arrows {
  way: 'times' | 'divide';
  top: number | null;
  bottom: number | null;
}
export function arrowsBetween(gold: Frac, tile: Frac): Arrows {
  const up = tile.d >= gold.d;
  const step = (from: number, to: number): number | null => (up ? (to % from === 0 ? to / from : null) : from % to === 0 ? from / to : null);
  return { way: up ? 'times' : 'divide', top: step(gold.n, tile.n), bottom: step(gold.d, tile.d) };
}

/**
 * One trap tile of a kind for this gold stone, or null if this kind can't make one that fits. `r` picks among the
 * possible ones. Built from the simplest form of the gold stone and from the gold stone itself (both are what a child
 * starts from).
 */
export function trapTile(gold: Frac, kind: TrapKind, r: () => number, times: readonly [number, number]): Frac | null {
  const base = simplest(gold);
  const from = [base, gold];
  const ks: number[] = [];
  for (let k = Math.max(2, times[0]); k <= Math.max(times[1], 3); k++) ks.push(k);
  const options: Frac[] = [];
  const add = (f: Frac) => {
    if (fits(f) && !equal(f, gold)) options.push(f);
  };
  for (const f of from) {
    switch (kind) {
      case 'add-same':
        for (const c of [1, 2, 3, 4, 5, 10]) add({ n: f.n + c, d: f.d + c });
        break;
      case 'top-only':
        for (const k of ks) add({ n: f.n * k, d: f.d });
        break;
      case 'bottom-only':
        for (const k of ks) add({ n: f.n, d: f.d * k });
        break;
      case 'same-bottom':
        for (let m = 1; m < f.d; m++) add({ n: m, d: f.d });
        break;
      case 'same-top':
        for (let m = f.n + 1; m <= f.n + 6; m++) add({ n: f.n, d: m });
        break;
      case 'near-miss':
        for (const k of ks) {
          add({ n: f.n * k, d: f.d * k + 1 });
          add({ n: f.n * k, d: f.d * k - 1 });
          add({ n: f.n * k + 1, d: f.d * k });
          add({ n: f.n * k - 1, d: f.d * k });
        }
        break;
      case 'diff-mult':
        for (const a of ks) for (const b of ks) if (a !== b) add({ n: f.n * a, d: f.d * b });
        break;
    }
  }
  if (!options.length) return null;
  return options[Math.floor(r() * options.length)];
}

/** Which named mistake a wrong tile shows, for the show-why line (the first that fits, most telling first). */
export function mistakeOf(gold: Frac, tile: Frac): TrapKind {
  if (equal(tile, gold)) throw new Error('mistakeOf: the tile is right');
  const base = simplest(gold);
  for (const f of [gold, base]) {
    if (tile.d - f.d === tile.n - f.n && tile.d > f.d) return 'add-same';
    if (tile.d === f.d) return tile.n % f.n === 0 ? 'top-only' : 'same-bottom';
    if (tile.n === f.n) return tile.d % f.d === 0 ? 'bottom-only' : 'same-top';
  }
  for (const f of [gold, base]) {
    const a = arrowsBetween(f, tile);
    if (a.top !== null && a.bottom !== null) return 'diff-mult';
    if (a.top !== null || a.bottom !== null) return 'near-miss';
  }
  return 'near-miss';
}
