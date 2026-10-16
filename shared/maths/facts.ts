/**
 * Times-table facts. "7 × 8" and "8 × 7" are one fact for mastery (key "mul:7x8", smaller
 * number first), but both orders get asked.
 */
import { TABLES } from './config';

export interface Fact {
  /** The smaller factor. */
  a: number;
  /** The larger factor (or equal). */
  b: number;
}

export const factKey = (x: number, y: number) => `mul:${Math.min(x, y)}x${Math.max(x, y)}`;

export function parseFactKey(key: string): Fact | null {
  const match = /^mul:(\d+)x(\d+)$/.exec(key);
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  return a <= b && a >= 1 && b <= 12 ? { a, b } : null;
}

/** Every fact in one times table: t × 1 to t × 12, as keys. */
export function tableFacts(table: number): string[] {
  return TABLES.map((n) => factKey(table, n));
}

/** Every fact in these tables, with no repeats. */
export function factsIn(tables: Iterable<number>): Set<string> {
  const keys = new Set<string>();
  for (const t of tables) for (const key of tableFacts(t)) keys.add(key);
  return keys;
}

/** The fact written out with its answer, e.g. "7 × 8 = 56". */
export const factText = (x: number, y: number) => `${x} × ${y} = ${x * y}`;
