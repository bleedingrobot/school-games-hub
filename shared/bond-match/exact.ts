/**
 * Exact arithmetic for Bond Match. Cards show whole numbers, decimals and fractions, and adding
 * 0.1 + 0.2 in floating point gives 0.30000000000000004, so every value is a reduced fraction of
 * two whole numbers instead. Nothing in this folder adds with floating point.
 */

/** A reduced fraction n/d with d > 0. */
export interface Exact {
  n: number;
  d: number;
}

/** One side of a card. Any of the three kinds can sit on either side of a pair. */
export type Side =
  | { kind: 'whole'; n: number }
  /** A decimal kept as whole units of 10^-places, so 0.30 is { units: 30, places: 2 }. Always drawn with `places` digits. */
  | { kind: 'decimal'; units: number; places: number }
  /** Drawn as a stacked fraction, never reduced (2/4 stays 2/4). */
  | { kind: 'fraction'; num: number; den: number };

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

export function exact(n: number, d = 1): Exact {
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}

export const addExact = (a: Exact, b: Exact): Exact => exact(a.n * b.d + b.n * a.d, a.d * b.d);

export const sameExact = (a: Exact, b: Exact): boolean => a.n === b.n && a.d === b.d;

export function sideValue(side: Side): Exact {
  if (side.kind === 'whole') return exact(side.n);
  if (side.kind === 'decimal') return exact(side.units, 10 ** side.places);
  return exact(side.num, side.den);
}

const formatUnits = (units: number, places: number): string => {
  if (places === 0) return String(units);
  const scale = 10 ** places;
  return `${Math.floor(units / scale)}.${String(units % scale).padStart(places, '0')}`;
};

/** How a side is written: "7", "0.30", "3/8". */
export function sideText(side: Side): string {
  if (side.kind === 'whole') return String(side.n);
  if (side.kind === 'decimal') return formatUnits(side.units, side.places);
  return `${side.num}/${side.den}`;
}

/** The sum of some sides written exactly: "1.0", "0.75", "100", "9/8". Never has floating point noise. */
export function sumText(sides: readonly Side[]): string {
  const sum = sides.map(sideValue).reduce(addExact, exact(0));
  if (sides.some((s) => s.kind === 'fraction')) return sum.d === 1 ? String(sum.n) : `${sum.n}/${sum.d}`;
  const places = Math.max(0, ...sides.map((s) => (s.kind === 'decimal' ? s.places : 0)));
  return formatUnits((sum.n * 10 ** places) / sum.d, places);
}
