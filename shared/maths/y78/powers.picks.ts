/**
 * Card Y4: the pick questions whose right choice isn't a plain number, checked against their four choices by separate
 * arithmetic. y78.test.ts runs these on every roll.
 */
import { expect } from "vitest";
import { powerValue } from "./powers.oracle";

const isPrime = (n: number) =>
  n > 1 &&
  Array.from({ length: n - 2 }, (_, i) => i + 2).every((d) => n % d !== 0);
/** "2² × 3 × 5" → 60, or null if any piece is not a prime (power). */
const primesProduct = (label: string) => {
  let total = 1;
  for (const piece of label.split(" × ")) {
    const m = /^(\d+)([⁰¹²³⁴⁵⁶⁷⁸⁹]*)$/.exec(piece)!;
    if (!isPrime(Number(m[1]))) return null;
    total *= powerValue(piece)!;
  }
  return total;
};
const product = (text: string) =>
  text.split(" × ").reduce((a, b) => a * Number(b), 1);

export const PICK_CHECKS: Record<
  string,
  (parts: string[], prompt: string, right: string, wrong: string[]) => void
> = {
  // prime:which has one prime and three composites
  "prime:which": (_p, _q, right, wrong) => {
    expect(isPrime(Number(right))).toBe(true);
    for (const w of wrong) expect(isPrime(Number(w))).toBe(false);
  },
  // prime:not has one composite and three primes
  "prime:not": (_p, _q, right, wrong) => {
    expect(isPrime(Number(right))).toBe(false);
    for (const w of wrong) expect(isPrime(Number(w))).toBe(true);
  },
  // divis:by has one multiple and three that are not
  "divis:by": (parts, _q, right, wrong) => {
    const d = Number(parts[0].replace("Divisible by ", ""));
    expect(Number(right) % d).toBe(0);
    for (const w of wrong) expect(Number(w) % d).not.toBe(0);
  },
  // exp:repeat has the one power equal to the product
  "exp:repeat": (parts, _q, right, wrong) => {
    const want = product(parts[0]);
    expect(powerValue(right)).toBe(want);
    for (const w of wrong) expect(powerValue(w)).not.toBe(want);
  },
  // pow:same has the one power of ten equal to the number
  "pow:same": (parts, _q, right, wrong) => {
    const want = Number(parts[0].replace(/ /g, ""));
    expect(powerValue(right)).toBe(want);
    for (const w of wrong) expect(powerValue(w)).not.toBe(want);
  },
  // pf:which has the one all-prime product equal to the number
  "pf:which": (parts, _q, right, wrong) => {
    const n = Number(parts[0]);
    expect(primesProduct(right)).toBe(n);
    for (const w of wrong) expect(primesProduct(w) === n).toBe(false);
  },
  // negpow:exp has the one power equal to the decimal
  "negpow:exp": (parts, _q, right, wrong) => {
    expect(powerValue(right)).toBe(Number(parts[0]));
    for (const w of wrong) expect(powerValue(w)).not.toBe(Number(parts[0]));
  },
};
