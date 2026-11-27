/**
 * Maths Mingle (Class Live `mingle`, docs/MINGLE-PLAN.md): the class mingles for real while music plays. When it stops
 * the big screen calls "Get into groups of 24 ÷ 6!" and everyone scrambles into groups of that size. Anyone left over
 * goes to a station iPad, taps their name and answers their way back in (the jail rules in jail.ts, mode 'mingle').
 *
 * The calls are only shown on the big screen (nothing counts), so they are made there, from the round number: easy
 * at the start, harder each round. Pure functions.
 */

export const MINGLE_LEVELS = ['junior', 'senior'] as const;
export type MingleLevel = (typeof MINGLE_LEVELS)[number];
export const mingleLevelOf = (v: unknown): MingleLevel => (v === 'junior' ? 'junior' : 'senior');

export interface MingleCall {
  /** What the screen shows after "Get into groups of", e.g. "24 ÷ 6". */
  sum: string;
  /** The group size (the answer). */
  size: number;
  /** A silly extra, e.g. "standing on one leg", or null. */
  twist: string | null;
  /** 0 easy, 1 middle, 2 hard (climbs with the round). */
  tier: 0 | 1 | 2;
}

/** Group sizes: juniors 2 to 5, seniors 2 to 8. */
export const SIZES: Record<MingleLevel, number[]> = { junior: [2, 3, 4, 5], senior: [2, 3, 4, 5, 6, 7, 8] };

/** Fun twists (James picked fun twists): one round in four, never two in a row. */
export const TWISTS = [
  'standing on one leg',
  'holding hands in a circle',
  'touching elbows',
  'with everyone sitting down',
  'with your hands on your heads',
  'all facing the same way',
  'making a star shape together',
  'doing a silent wave',
];

/** The round's tier: rounds 1 to 3 easy, 4 to 6 middle, then hard. */
export const tierOf = (round: number): 0 | 1 | 2 => (round <= 3 ? 0 : round <= 6 ? 1 : 2);

type Maker = (n: number, r: () => number) => string | null;
const pick = <T,>(xs: T[], r: () => number): T => xs[Math.floor(r() * xs.length) % xs.length];
const between = (lo: number, hi: number, r: () => number) => lo + (Math.floor(r() * (hi - lo + 1)) % (hi - lo + 1));

/** Ways to write n, by level and tier. A maker returns null when it can't make n. */
const MAKERS: Record<MingleLevel, Maker[][]> = {
  junior: [
    [(n) => String(n), (n, r) => { const a = between(1, n - 1, r); return `${a} + ${n - a}`; }],
    [(n, r) => { const a = between(1, n - 1, r); return `${a} + ${n - a}`; }, (n, r) => { const b = between(1, 5, r); return `${n + b} − ${b}`; }, (n) => (n % 2 === 0 ? `double ${n / 2}` : null)],
    [(n, r) => { const b = between(2, 6, r); return `${n + b} − ${b}`; }, (n) => `half of ${n * 2}`, (n) => (n % 2 === 0 ? `double ${n / 2}` : null), (n, r) => { const a = between(1, n - 1, r); const b = between(0, a - 1, r); return b > 0 ? `${a - b} + ${b} + ${n - a}` : null; }],
  ],
  senior: [
    [(n, r) => { const a = between(1, n - 1, r); return `${a} + ${n - a}`; }, (n, r) => { const b = between(2, 9, r); return `${n + b} − ${b}`; }, (n) => (n % 2 === 0 ? `double ${n / 2}` : null)],
    [(n, r) => { const d = between(2, 9, r); return `${n * d} ÷ ${d}`; }, (n) => `half of ${n * 2}`, (n, r) => { const f = [2, 3, 4].filter((x) => n % x === 0 && n > x); if (!f.length) return null; const a = pick(f, r); return `${a} × ${n / a}`; }, (n, r) => { const b = between(10, 30, r); return `${n + b} − ${b}`; }],
    [(n) => `√${n * n}`, (n, r) => { const d = between(6, 12, r); return `${n * d} ÷ ${d}`; }, (n) => `a quarter of ${n * 4}`, (n) => (n <= 8 ? `${n * 10}% of 10` : null), (n) => `0.5 × ${n * 2}`, (n) => (n < 8 ? `2³ − ${8 - n}` : null), (n, r) => { const a = between(2, 6, r); return `(${a} + ${2 * n - a}) ÷ 2`; }],
  ],
};

/**
 * The call for a round. `last` is the previous round's size (not repeated) and whether it had a twist; `players` keeps
 * the size below the class (a group of 8 needs at least 9 to leave anyone out).
 */
export function makeCall(level: MingleLevel, round: number, random: () => number, o: { last?: MingleCall | null; twists?: boolean; players?: number } = {}): MingleCall {
  const tier = tierOf(round);
  const room = Math.max(2, (o.players ?? 40) - 1);
  const sizes = SIZES[level].filter((s) => s <= room && s !== o.last?.size);
  const size = sizes.length ? pick(sizes, random) : 2;
  let sum: string | null = null;
  for (let tries = 0; tries < 8 && !sum; tries++) sum = pick(MAKERS[level][tier], random)(size, random);
  const twist = o.twists && round > 1 && !o.last?.twist && random() < 0.25 ? pick(TWISTS, random) : null;
  return { sum: sum ?? String(size), size, twist, tier };
}

/** Mixes a seed into a small repeatable random number maker (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How long the music plays before the stop (random, so nobody can guess it), in ms. */
export const danceMs = (random: () => number) => 8000 + Math.floor(random() * 12000);
/** How long everyone has to get into groups. */
export const SCRAMBLE_MS = 10_000;
