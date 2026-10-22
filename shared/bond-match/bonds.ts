/**
 * The bond sets: what a player can choose to practise. A bond set is data, so a new bond is one
 * entry in BOND_SETS. A pair is two sides that add up to the target; each side can be a whole
 * number, a decimal or a fraction, so the "mixed forms" shelf (1/4 with 0.75) fits the same shape.
 */
import { addExact, exact, sameExact, sideValue, type Exact, type Side } from './exact';

export type Shelf = 'whole' | 'decimal' | 'fraction' | 'mixed';

export type Pair = readonly [Side, Side];

export interface BondSet {
  id: string;
  label: string;
  shelf: Shelf;
  /** What each pair adds up to. */
  target: Exact;
  /** Every distinct pair this set can use. Two identical sides (5 and 5) are one pair. */
  pairs: readonly Pair[];
}

const range = (from: number, to: number, step = 1): number[] => {
  const out: number[] = [];
  for (let n = from; n <= to; n += step) out.push(n);
  return out;
};

const whole = (n: number): Side => ({ kind: 'whole', n });
const decimal = (units: number, places: number): Side => ({ kind: 'decimal', units, places });
const fraction = (num: number, den: number): Side => ({ kind: 'fraction', num, den });

/** Whole numbers a + (total - a), for a = from, from + step, ... up to half of the total. */
function wholeSet(id: string, label: string, total: number, from: number, step: number): BondSet {
  return {
    id, label, shelf: 'whole', target: exact(total),
    pairs: range(from, total / 2, step).map((a) => [whole(a), whole(total - a)] as const),
  };
}

/** Decimals with a fixed number of places: `totalUnits` is the target in units of 10^-places. */
function decimalSet(id: string, label: string, places: number, totalUnits: number): BondSet {
  return {
    id, label, shelf: 'decimal', target: exact(totalUnits, 10 ** places),
    pairs: range(1, totalUnits / 2).map((a) => [decimal(a, places), decimal(totalUnits - a, places)] as const),
  };
}

/** Fractions that make 1 whole, all over the same denominator. */
function fractionSet(id: string, label: string, den: number): BondSet {
  return {
    id, label, shelf: 'fraction', target: exact(1),
    pairs: range(1, Math.floor(den / 2)).map((a) => [fraction(a, den), fraction(den - a, den)] as const),
  };
}

export const BOND_SETS: readonly BondSet[] = [
  wholeSet('whole-10', 'To 10', 10, 1, 1),
  wholeSet('whole-20', 'To 20', 20, 1, 1),
  wholeSet('whole-100-tens', 'To 100 (tens)', 100, 10, 10),
  wholeSet('whole-100-any', 'To 100 (any)', 100, 1, 1),
  wholeSet('whole-1000-hundreds', 'To 1000 (hundreds)', 1000, 100, 100),
  wholeSet('whole-1000-tens', 'To 1000 (tens)', 1000, 10, 10),
  decimalSet('decimal-1-tenths', 'To 1 (tenths)', 1, 10),
  decimalSet('decimal-1-hundredths', 'To 1 (hundredths)', 2, 100),
  decimalSet('decimal-10-tenths', 'To 10 (tenths)', 1, 100),
  fractionSet('fraction-halves', 'Halves', 2),
  fractionSet('fraction-thirds', 'Thirds', 3),
  fractionSet('fraction-quarters', 'Quarters', 4),
  fractionSet('fraction-fifths', 'Fifths', 5),
  fractionSet('fraction-sixths', 'Sixths', 6),
  fractionSet('fraction-eighths', 'Eighths', 8),
  fractionSet('fraction-tenths', 'Tenths', 10),
];

export const findBondSet = (id: string): BondSet | undefined => BOND_SETS.find((b) => b.id === id);

/** True when a pair really adds up to the set's target (used by the tests, and a guard for new entries). */
export const pairMakesTarget = (set: BondSet, pair: Pair): boolean =>
  sameExact(addExact(sideValue(pair[0]), sideValue(pair[1])), set.target);
