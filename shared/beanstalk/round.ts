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
import type { FactAnswer, FactStats } from '../maths/leitner';
import { hasNearMiss, kindByUnits, unitsOff } from '../kit/mistakes';
import { seeded } from '../seededRandom';

export const PAIRS_PER_ROUND = 10;
/**
 * What each beanstalk's pairs add up to, in turn: Kiwi 10, then bonds to 20, tūī 100, kererū 1000, then round again
 * (James, 4 Nov 2026; 20 added by maths review R8, 7 Nov 2026).
 */
export const TARGETS = [10, 20, 100, 1000] as const;
export type Target = (typeof TARGETS)[number];
export const isTarget = (n: unknown): n is Target => TARGETS.includes(n as Target);
/** What one dot on a leaf is worth: 1 on the 10 and 20 beanstalks (20 has two ten-frames), 10 on the 100 and 100 on the 1000. */
export const unitOf = (target: Target): number => (target === 20 ? 1 : target / 10);
/**
 * The missing leaf (R8): on these goes (counting from 0) one leaf of a pair is already picked and the child taps the one
 * that is missing, "7 + ? = 10". Only the screen changes: the taps are the same two leaves, so the server replays them as usual.
 * The 3rd, 5th and 7th goes (S22): never the last, where only two leaves float and a guess is right, and never in the short
 * second tray of older pairs. At least three leaves float on each, so there are wrong choices to think about.
 */
export const MISSING_GOES = [2, 4, 6] as const;
export const isMissingGo = (pairsMade: number): boolean => (MISSING_GOES as readonly number[]).includes(pairsMade);
/** Leaves floating at once: three pairs. */
export const ON_SCREEN = 6;

/** Seeds are whole numbers from 0 up to 2^31 - 1, the range the hub's random generator handles exactly. */
export const MAX_SEED = 2147483647;
export const isSeed = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MAX_SEED;

export interface Round {
  seed: number;
  /** What a pair adds up to: the child's stage (S21). The first tray's sum. */
  target: Target;
  /** Every leaf's number in the order they come in. */
  leaves: number[];
  /**
   * What each pair (leaf 2k and 2k+1) adds up to (S21): the older pairs mixed in at the end have their own, smaller sum.
   * Missing on rounds made before this (the whole round is then `target`).
   */
  pairTargets?: Target[];
}

/** What the pair holding this leaf adds up to. */
export const targetOf = (round: Pick<Round, 'target' | 'pairTargets'>, leaf: number): Target => round.pairTargets?.[leaf >> 1] ?? round.target;

/** Where a child is on the sums (S21): an index into `TARGETS`. Follows the child, not the calendar (progress.ts: `afterDay`). */
export type Stage = 0 | 1 | 2 | 3;
export const isStage = (n: unknown): n is Stage => n === 0 || n === 1 || n === 2 || n === 3;
export const stageTarget = (stage: Stage): Target => TARGETS[stage];

/** 1+9 to 5+5: the pairs a leaf can show (0+10 is left out, as a leaf with no dots is no help at this age). */
const SMALL_PARTS = [1, 2, 3, 4, 5];

export function makeRound(seed: number, target: Target = 10): Round {
  if (!isSeed(seed)) throw new RangeError(`Bad seed ${seed}`);
  if (!isTarget(target)) throw new RangeError(`Bad target ${target}`);
  const random = seeded(seed);
  random(); random(); // the first draws of this generator are close together for close seeds
  if (target === 20) return { seed, target, leaves: leavesTo20(random) };
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
 * Bonds to 20 (R8): the pairs 1 + 19 to 9 + 11, each once, and a tenth that is one more of them. 10 + 10 is left out (two
 * equal leaves are too easy, like 5 + 5), and 0 + 20 as 0 + 10 is. The leaves are the numbers themselves, so 11 to 19 turn up.
 */
function leavesTo20(random: () => number): number[] {
  const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  pool.push(1 + Math.floor(random() * 9));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.flatMap((a) => (random() < 0.5 ? [a, 20 - a] : [20 - a, a]));
}

/** Pairs of the older stages mixed in at the end of a round, as a short second tray (S21). None on the first stage. */
export const OLDER_PAIRS = 2;
/** One pair may come up this many times in a round (5 + 5 only once: two equal leaves are easy). */
const MAX_REPEATS = 3;

interface Candidate {
  target: Target;
  /** The smaller number, in ones (1 to 5, or 1 to 9 on the 20s). */
  lo: number;
}
const candidatesOf = (target: Target): Candidate[] => Array.from({ length: target === 20 ? 9 : 5 }, (_, i) => ({ target, lo: i + 1 }));

const shuffleWith = <T>(items: T[], random: () => number): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/**
 * Today's challenge for a child on `stage`, from their maths records (S21). Each pair of the stage's sum is used once, and
 * the spare places go to the weakest pairs (lowest box, then least recently seen), at most three times each, 5 + 5 once.
 * Two of the ten pairs are older pairs, from the stages below, the least recently seen then the weakest; they come last as
 * a second tray with their own sum (`pairTargets`). The first stage has none.
 *
 * The 100 and 1000 sums have one fact key each ('bond100:tens'), so they can't say which pair is weak. Their pairs are
 * weighed by the bond10 record of the same pair (30 + 70 by 3 + 7) instead. Splitting the key lives in shared/maths and
 * would be its own branch.
 */
export function makeStageRound(seed: number, stage: Stage, facts: readonly FactStats[] = []): Round {
  if (!isSeed(seed)) throw new RangeError(`Bad seed ${seed}`);
  if (!isStage(stage)) throw new RangeError(`Bad stage ${stage}`);
  const random = seeded(seed);
  random(); random(); // the first draws of this generator are close together for close seeds
  const record = new Map(facts.map((f) => [f.key, f]));
  const boxOf = (c: Candidate) => record.get(bondKey(c.lo, c.target >= 100 ? 10 : c.target))?.box ?? 0;
  const seenOf = (c: Candidate) => record.get(bondKey(c.lo, c.target))?.lastSeen ?? 0;
  const target = TARGETS[stage];
  const older = stage === 0 ? 0 : OLDER_PAIRS;

  // The stage's own pairs: each once (the weakest, if there are more pairs than places), then the spare places, weakest first.
  const own = shuffleWith(candidatesOf(target), random).sort((a, b) => boxOf(a) - boxOf(b) || seenOf(a) - seenOf(b));
  const places = PAIRS_PER_ROUND - older;
  const chosen = own.slice(0, places);
  const counts = new Map(chosen.map((c) => [c, 1]));
  const cap = (c: Candidate) => (c.lo === (c.target === 20 ? 10 : 5) ? 1 : MAX_REPEATS); // the double (5 + 5, 50 + 50, 10 + 10) once
  for (let spare = places - chosen.length; spare > 0; ) {
    const before = spare;
    for (const c of chosen) {
      if (spare > 0 && counts.get(c)! < cap(c)) {
        counts.set(c, counts.get(c)! + 1);
        spare--;
      }
    }
    if (spare === before) break; // every pair is at its cap (not reachable with ten places)
  }
  const mine = shuffleWith(chosen.flatMap((c) => Array.from({ length: counts.get(c)! }, () => c)), random);

  // The older pairs: the least recently seen, then the weakest.
  const before = TARGETS.slice(0, stage).flatMap(candidatesOf);
  const oldPairs = shuffleWith(before, random).sort((a, b) => seenOf(a) - seenOf(b) || boxOf(a) - boxOf(b)).slice(0, older);

  const pairs = [...mine, ...oldPairs];
  const leaves = pairs.flatMap(({ target: t, lo }) => {
    const a = t === 20 ? lo : (lo * t) / 10;
    return random() < 0.5 ? [a, t - a] : [t - a, a];
  });
  return { seed, target, leaves, pairTargets: pairs.map((c) => c.target) };
}

/**
 * The fact a pair practises, for the maths records: `bond10:3+7` (smaller number first) for bonds to 10, and the hub's
 * place-value keys for the others, `bond100:tens` and `bond1000:hundreds` (shared/maths/skillPacks/placeSkills.ts).
 */
export const bondKey = (n: number, target: Target = 10): string => {
  if (target === 20) {
    const lo = Math.min(n, 20 - n);
    return `bond20:${lo}+${20 - lo}`;
  }
  if (target === 100) return 'bond100:tens';
  if (target === 1000) return 'bond1000:hundreds';
  const lo = Math.min(n, 10 - n);
  return `bond10:${lo}+${10 - lo}`;
};

/** The records a sum's pairs use (the ones its right pairs are scored against), for "is this sum secure?". */
export const factKeys = (target: Target): string[] =>
  target === 10 ? [1, 2, 3, 4, 5].map((n) => bondKey(n)) : target === 20 ? [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => bondKey(n, 20)) : [bondKey(1, target)];

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
  kindByUnits(unitsOff(total, target, unitOf(target)), { one: target === 10 || target === 20 ? 'close' : 'digit', over: 'over', under: 'under' });

/**
 * Brings in waiting pairs while there is room and neither of a pair's numbers is floating. `inPlay` (pairs that have
 * come in) grows; the leaves floating are theirs, less the `used` ones. Pairs come in order, except that the pair which
 * fills the tray is the first free one that gives it a near miss (a 3 with a 6, say), so every tray of six has one; if
 * none does, the tray waits at four leaves (maths review R5).
 * Server and browser both get this from the taps, through `replay`.
 */
function letIn(round: Round, inPlay: number[], used: ReadonlySet<number>): void {
  const floatingNow = () => floating(inPlay, used);
  const free = (numbers: number[], tray: Target) => (k: number) =>
    !inPlay.includes(k) && targetOf(round, 2 * k) === tray && !numbers.includes(round.leaves[2 * k]) && !numbers.includes(round.leaves[2 * k + 1]);
  while (floatingNow().length < ON_SCREEN) {
    const now = floatingNow();
    const numbers = now.map((i) => round.leaves[i]);
    // The tray holds one sum at a time (S21): the sum of what floats, or of the first pair not yet in when it is empty.
    const notIn = Array.from({ length: PAIRS_PER_ROUND }, (_, k) => k).filter((k) => !inPlay.includes(k));
    if (!notIn.length) return;
    const tray = now.length ? targetOf(round, now[0]) : targetOf(round, 2 * notIn[0]);
    const waiting = notIn.filter(free(numbers, tray));
    if (!waiting.length) return;
    const fills = numbers.length + 2 >= ON_SCREEN;
    if (!fills) {
      inPlay.push(waiting[0]);
      continue;
    }
    const tempting = waiting.find((k) => hasNearMiss([...numbers, round.leaves[2 * k], round.leaves[2 * k + 1]], tray, unitOf(tray)));
    // None does (only ever 1 + 9, 3 + 7 and 5 + 5 together): the tray stays at four leaves until a pair is made.
    if (tempting === undefined) return;
    inPlay.push(tempting);
  }
}

/** Goes in a row, the latest first, whose first tap was wrong: three bring full dots back for the rest of the round (R6). */
export const wrongFirstRun = (answers: readonly { correct: boolean }[]): number => {
  let run = 0;
  for (let i = answers.length - 1; i >= 0 && !answers[i].correct; i--) run++;
  return run;
};

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
    const sum = targetOf(round, a);
    const right = round.leaves[a] + round.leaves[b] === sum;
    if (wrongInGo === 0) answers.push({ key: bondKey(round.leaves[a], sum), correct: right, ms });
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
