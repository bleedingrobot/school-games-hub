/**
 * One day's challenge: ten pairs that make the beanstalk's sum (10, then 100, then 1000: progress.ts), and the replay of a child's taps (docs/BEANSTALK-PLAN.md section 3).
 * The server makes the round from a seed and replays the taps; the browser shows the same thing from the same seed.
 *
 * Leaves come in pair by pair: leaf 2k and 2k+1 are pair k. Six leaves float at a time, and each pair made lets the next
 * pair in. Any two leaves that make 10 are a right pair (a 3 from one pair and a 7 from another is fine), and what is
 * left on screen can always still be paired, because every right pair takes out an n and its 10 - n.
 *
 * Bonds to 100 and 1000 are the same pairs in tens and hundreds (James, 4 Nov 2026): 30 + 70, 300 + 700. 0 + 100 and
 * 0 + 1000 are left out, as 0 + 10 is.
 */
import type { FactAnswer } from '../maths/leitner';
import { seeded } from '../seededRandom';

export const PAIRS_PER_ROUND = 10;
/** What each beanstalk's pairs add up to, in turn: Kiwi 10, tūī 100, kererū 1000, then round again (James, 4 Nov 2026). */
export const TARGETS = [10, 100, 1000] as const;
export type Target = (typeof TARGETS)[number];
export const isTarget = (n: unknown): n is Target => TARGETS.includes(n as Target);
/** Leaves floating at once: three pairs. */
export const ON_SCREEN = 6;

/** Seeds are whole numbers from 0 up to 2^31 - 1, the range the hub's random generator handles exactly. */
export const MAX_SEED = 2147483647;
export const isSeed = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MAX_SEED;

export interface Round {
  seed: number;
  /** What a pair adds up to. */
  target: Target;
  /** Every leaf's number in the order they come in. */
  leaves: number[];
}

/** 1+9 to 5+5: the pairs a leaf can show (0+10 is left out, as a leaf with no dots is no help at this age). */
const SMALL_PARTS = [1, 2, 3, 4, 5];

export function makeRound(seed: number, target: Target = 10): Round {
  if (!isSeed(seed)) throw new RangeError(`Bad seed ${seed}`);
  if (!isTarget(target)) throw new RangeError(`Bad target ${target}`);
  const random = seeded(seed);
  random(); random(); // the first draws of this generator are close together for close seeds
  // Every pair turns up: 1+9 to 4+6 twice, 5+5 once (two 5s make one pair, which is easy), and the tenth is one more of 1 to 4.
  const pool = [...SMALL_PARTS, ...SMALL_PARTS.slice(0, 4)];
  while (pool.length < PAIRS_PER_ROUND) pool.push(SMALL_PARTS[Math.floor(random() * 4)]);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // Which of the two leaves of a pair comes first is random too, so the small number isn't always on the left.
  // The same seed makes the same shape of round for every sum: 3 + 7, 30 + 70 or 300 + 700.
  const step = target / 10;
  const leaves = pool.flatMap((a) => (random() < 0.5 ? [a, 10 - a] : [10 - a, a])).map((n) => n * step);
  return { seed, target, leaves };
}

/**
 * The fact a pair practises, for the maths records: `bond10:3+7` (smaller number first) for bonds to 10, and the hub's
 * place-value keys for the others, `bond100:tens` and `bond1000:hundreds` (shared/maths/skillPacks/placeSkills.ts).
 */
export const bondKey = (n: number, target: Target = 10): string => {
  if (target === 100) return 'bond100:tens';
  if (target === 1000) return 'bond1000:hundreds';
  const lo = Math.min(n, 10 - n);
  return `bond10:${lo}+${10 - lo}`;
};

/** Two leaves tapped, by index into `Round.leaves`, and how long the child took over it. */
export interface Tap {
  a: number;
  b: number;
  ms: number;
}

export interface Replay {
  pairsMade: number;
  mistakes: number;
  done: boolean;
  /** Leaves still floating, by index. */
  onScreen: number[];
  /** One answer per pair tapped. A wrong pair counts against the first leaf's pair: that is the partner the child was after. */
  answers: Omit<FactAnswer, 'at'>[];
}

/** The leaves floating once some pairs are made. */
const floating = (round: Round, used: ReadonlySet<number>, pairsMade: number): number[] =>
  round.leaves.map((_, i) => i).slice(0, ON_SCREEN + 2 * pairsMade).filter((i) => !used.has(i));

/** Replays a child's taps. Taps on leaves not floating (or the same leaf twice) stop the replay: the browser never sends them. */
export function replay(round: Round, taps: readonly Tap[]): Replay {
  const used = new Set<number>();
  const answers: Replay['answers'] = [];
  let pairsMade = 0;
  for (const { a, b, ms } of taps) {
    if (pairsMade === PAIRS_PER_ROUND) throw new Error('Taps after the round was done');
    const now = floating(round, used, pairsMade);
    if (a === b || !now.includes(a) || !now.includes(b)) throw new Error(`Leaves ${a} and ${b} aren't both floating`);
    const right = round.leaves[a] + round.leaves[b] === round.target;
    answers.push({ key: bondKey(round.leaves[a], round.target), correct: right, ms });
    if (right) {
      used.add(a).add(b);
      pairsMade++;
    }
  }
  return {
    pairsMade,
    mistakes: answers.length - pairsMade,
    done: pairsMade === PAIRS_PER_ROUND,
    onScreen: floating(round, used, pairsMade),
    answers,
  };
}
