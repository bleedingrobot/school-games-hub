/**
 * The keys Robin's Berry Basket records (docs/ROBIN-PLAN.md): counting out a set, giving exactly N, how many, and counting on.
 * They live here, beside the early facts that own them (the counting families in earlyFacts.ts), and shared/robin/round.ts
 * reads them from here so there is one list.
 *
 *   give:n6              "Give me 6 berries" (1 to 20, one record each)
 *   howmany:n6:scatter   "How many?" for 6 berries laid out as a line, scattered, or in a ring (1 to 10)
 *   counton:5+1          a covered plate of 5, then one more (starts 4 to 9)
 *   across:n12           "How many?" past ten, 11 to 20, in groups of five
 *
 * The first word is at most ten characters so the database's key check (gem_keep_facts, 20261107000800_parrot_keys.sql)
 * accepts it; every character is already allowed there (a to z, 0 to 9, colon and plus).
 */
export type CountKind = 'give' | 'howmany' | 'counton' | 'across';
export const LAYOUTS = ['line', 'scatter', 'ring'] as const;
export type CountLayout = (typeof LAYOUTS)[number];

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

export const COUNT_KEYS: Record<CountKind, string[]> = {
  give: range(1, 20).map((n) => `give:n${n}`),
  howmany: LAYOUTS.flatMap((layout) => range(1, 10).map((n) => `howmany:n${n}:${layout}`)),
  counton: range(4, 9).map((s) => `counton:${s}+1`),
  across: range(11, 20).map((n) => `across:n${n}`),
};
export const ALL_COUNT_KEYS = Object.values(COUNT_KEYS).flat();
export const kindOfCountKey = (key: string): CountKind | null => (/^(give|howmany|counton|across):/.test(key) ? (key.split(':')[0] as CountKind) : null);
/** The numbers a key names: give:n6 is [6], howmany:n6:ring is [6], counton:5+1 is [5, 1]. */
export const countNumbers = (key: string): number[] => (key.split(':').slice(1).join(':').match(/\d+/g) ?? []).map(Number);
