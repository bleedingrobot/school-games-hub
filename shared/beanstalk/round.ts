/**
 * One day's challenge: ten pairs that make the beanstalk's sum (10, then 100, then 1000: progress.ts), and the replay of a child's taps (docs/BEANSTALK-PLAN.md section 3).
 * The server makes the round from a seed and replays the taps; the browser shows the same thing from the same seed.
 *
 * Leaves come in pair by pair: leaf 2k and 2k+1 are pair k. Up to six leaves (three pairs) float at a time. No number is
 * on screen twice, except the two 5s of 5 + 5 (James, 7 Nov 2026, maths review R4): otherwise a child could tick off
 * "the same looking" numbers without knowing the bond. So a pair comes in only when neither of its numbers is floating:
 * at the start, the first three pairs in order with different numbers; after each right pair, the next pairs in order
 * that are free. A pair with no free place waits, so near the end there can be fewer than six leaves. Any two leaves
 * that make 10 are a right pair (a 3 from one pair and a 7 from another is fine), and what is left on screen can always
 * still be paired, because every right pair takes out an n and its 10 - n; an empty screen lets any pair in, so the
 * round can always be finished.
 *
 * Bonds to 100 and 1000 are the same pairs in tens and hundreds (James, 4 Nov 2026): 30 + 70, 300 + 700. 0 + 100 and
 * 0 + 1000 are left out, as 0 + 10 is.
 */
import type { FactAnswer } from '../maths/leitner';
import { hasNearMiss, kindByUnits, unitsOff } from '../kit/mistakes';
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
  /** Wrong pairs tapped. */
  mistakes: number;
  done: boolean;
  /** Leaves still floating, by index. */
  onScreen: number[];
  /**
   * One answer a go, from its first tap (a go runs until a right pair): right first time, or wrong, counted against the
   * first leaf's pair, the partner the child was after. Later taps in a go are not scored, so a pair found after a
   * "Let's look together" is never a clean right (maths review R5).
   */
  answers: Omit<FactAnswer, 'at'>[];
  /** Every wrong pair tapped (`pairId`): the browser won't let a tried pair be tapped again. */
  tried: string[];
  /** Wrong pairs since the last right pair: 1 shows why, 2 is "Let's look together". */
  wrongInGo: number;
  /** Right pairs made after two or more wrong ones in their go: shown pairs. */
  shown: number;
}

/** The leaves floating: those of the pairs that have come in, less the ones already paired. */
const floating = (inPlay: readonly number[], used: ReadonlySet<number>): number[] =>
  inPlay.flatMap((k) => [2 * k, 2 * k + 1]).filter((i) => !used.has(i));

/**
 * A wrong pair, by its total S against the sum T (maths review R5): `close` is one unit off (one dot out, or one square
 * empty), `over` and `under` are two or more; on the 100 and 1000 beanstalks one unit off is `digit` instead, the slip of
 * adding tens as if they were ones (30 + 60 = 90 is 9 tens, not 10). Null for a right pair.
 */
export type MistakeKind = 'over' | 'under' | 'close' | 'digit';
export const mistakeKind = (total: number, target: Target): MistakeKind | null =>
  kindByUnits(unitsOff(total, target, target / 10), { one: target === 10 ? 'close' : 'digit', over: 'over', under: 'under' });

/**
 * Brings in waiting pairs while there is room and neither of a pair's numbers is floating. `inPlay` (pairs that have
 * come in) grows; the leaves floating are theirs, less the `used` ones. Pairs come in order, except that the pair which
 * fills the tray is the first free one that gives it a near miss (a 3 with a 6, say), so every tray of six has one; if
 * none does, the tray waits at four leaves (maths review R5).
 * Server and browser both get this from the taps, through `replay`.
 */
function letIn(round: Round, inPlay: number[], used: ReadonlySet<number>): void {
  const floatingNow = () => floating(inPlay, used);
  const free = (numbers: number[]) => (k: number) =>
    !inPlay.includes(k) && !numbers.includes(round.leaves[2 * k]) && !numbers.includes(round.leaves[2 * k + 1]);
  while (floatingNow().length < ON_SCREEN) {
    const numbers = floatingNow().map((i) => round.leaves[i]);
    const waiting = Array.from({ length: PAIRS_PER_ROUND }, (_, k) => k).filter(free(numbers));
    if (!waiting.length) return;
    const fills = numbers.length + 2 >= ON_SCREEN;
    if (!fills) {
      inPlay.push(waiting[0]);
      continue;
    }
    const tempting = waiting.find((k) => hasNearMiss([...numbers, round.leaves[2 * k], round.leaves[2 * k + 1]], round.target, round.target / 10));
    // None does (only ever 1 + 9, 3 + 7 and 5 + 5 together): the tray stays at four leaves until a pair is made.
    if (tempting === undefined) return;
    inPlay.push(tempting);
  }
}

/** A pair of leaves the same either way round, so a tried pair is found whichever leaf was tapped first. */
export const pairId = (a: number, b: number): string => (a < b ? `${a}-${b}` : `${b}-${a}`);

/** Replays a child's taps. Taps on leaves not floating (or the same leaf twice) stop the replay: the browser never sends them. */
export function replay(round: Round, taps: readonly Tap[]): Replay {
  const used = new Set<number>();
  const answers: Replay['answers'] = [];
  const tried: string[] = [];
  const inPlay: number[] = [];
  letIn(round, inPlay, used);
  let pairsMade = 0;
  let wrongInGo = 0;
  let shown = 0;
  for (const { a, b, ms } of taps) {
    if (pairsMade === PAIRS_PER_ROUND) throw new Error('Taps after the round was done');
    const now = floating(inPlay, used);
    if (a === b || !now.includes(a) || !now.includes(b)) throw new Error(`Leaves ${a} and ${b} aren't both floating`);
    const right = round.leaves[a] + round.leaves[b] === round.target;
    if (wrongInGo === 0) answers.push({ key: bondKey(round.leaves[a], round.target), correct: right, ms });
    if (right) {
      used.add(a).add(b);
      pairsMade++;
      if (wrongInGo >= 2) shown++;
      wrongInGo = 0;
      letIn(round, inPlay, used);
    } else {
      wrongInGo++;
      if (!tried.includes(pairId(a, b))) tried.push(pairId(a, b));
    }
  }
  return {
    pairsMade,
    mistakes: taps.length - pairsMade,
    done: pairsMade === PAIRS_PER_ROUND,
    onScreen: floating(inPlay, used),
    answers,
    tried,
    wrongInGo,
    shown,
  };
}
