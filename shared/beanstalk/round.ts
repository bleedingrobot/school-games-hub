/**
 * One day's challenge: ten pairs that make 10, and the replay of a child's taps (docs/BEANSTALK-PLAN.md section 3).
 * The server makes the round from a seed and replays the taps; the browser shows the same thing from the same seed.
 *
 * Leaves come in pair by pair: leaf 2k and 2k+1 are pair k. Six leaves float at a time, and each pair made lets the next
 * pair in. Any two leaves that make 10 are a right pair (a 3 from one pair and a 7 from another is fine), and what is
 * left on screen can always still be paired, because every right pair takes out an n and its 10 - n.
 */
import type { FactAnswer } from '../maths/leitner';
import { seeded } from '../seededRandom';

export const PAIRS_PER_ROUND = 10;
export const TARGET = 10;
/** Leaves floating at once: three pairs. */
export const ON_SCREEN = 6;

/** Seeds are whole numbers from 0 up to 2^31 - 1, the range the hub's random generator handles exactly. */
export const MAX_SEED = 2147483647;
export const isSeed = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MAX_SEED;

export interface Round {
  seed: number;
  /** Every leaf's number in the order they come in. */
  leaves: number[];
}

/** 1+9 to 5+5: the pairs a leaf can show (0+10 is left out, as a leaf with no dots is no help at this age). */
const SMALL_PARTS = [1, 2, 3, 4, 5];

export function makeRound(seed: number): Round {
  if (!isSeed(seed)) throw new RangeError(`Bad seed ${seed}`);
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
  const leaves = pool.flatMap((a) => (random() < 0.5 ? [a, TARGET - a] : [TARGET - a, a]));
  return { seed, leaves };
}

/** The fact a pair practises: `bond10:3+7`, smaller number first. */
export const bondKey = (n: number): string => {
  const lo = Math.min(n, TARGET - n);
  return `bond10:${lo}+${TARGET - lo}`;
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
    const right = round.leaves[a] + round.leaves[b] === TARGET;
    answers.push({ key: bondKey(round.leaves[a]), correct: right, ms });
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
