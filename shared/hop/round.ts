/**
 * One day's challenge at Hop's Glow-worm Pond: ten hops, each a row of lily pads counting in equal steps with one pad
 * missing, and the glow-worms to choose from (docs/HOP-PLAN.md sections 2 and 3).
 *
 * The questions are the shared skip-counting ones (`skip10:up:40` and so on in shared/maths/skillPacks/earlyFacts.ts).
 * Nothing here works out skip counting itself: it picks keys, and the shared pack makes each question from its key and
 * numbers, exactly as it would anywhere else on the hub.
 *
 * Which step (10s, 5s or 2s) comes from the child's maths records, not from the auto ladder: a 5-year-old on auto is
 * usually still on an earlier rung (facts to 10), so `makeFocusPack` would never serve them skip counting. A step is
 * passed when 70% of its counting-up and what-comes-next facts are in box 2 or higher (the hub's usual secure rule).
 * Counting back is left out of that share because it is only asked on gold days; counting it would keep every child on
 * 10s until day 21. The server keeps the furthest step reached (`reached`), so forgetting a few facts brings more practice
 * of them but never drops a child back a step.
 */
import { atMostShareTell, sharingTell, tagWrongs, type Wrong } from '../kit/mistakes';
import type { FactStats } from '../maths/leitner';
import { STEP_SECURE_SHARE } from '../maths/selector';
import { EARLY_FACTS, earlyFactsPack, SKIP_STEPS, type SkipKind, type SkipStep } from '../maths/skillPacks/earlyFacts';
import { seeded } from '../seededRandom';

export const HOPS_PER_ROUND = 10;
/** On gold days the last three hops count back, as Hop hops home (James, 4 Nov 2026). */
export const BACK_HOPS = 3;
export const STEPS: readonly SkipStep[] = SKIP_STEPS.map((s) => s.step);

/** Seeds are whole numbers from 0 up to 2^31 - 1, the range the hub's random generator handles exactly. */
export const MAX_SEED = 2147483647;
export const isSeed = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MAX_SEED;
export const isStep = (n: unknown): n is SkipStep => STEPS.includes(n as SkipStep);

/** Every fact of one kind for a step: `skip5:next:25` and so on, from the shared pack's own list. */
const pack = earlyFactsPack();
const family = (step: SkipStep) => EARLY_FACTS.families[`skip${step}`];
const keysOf = (step: SkipStep, kind: SkipKind): string[] => family(step).keys.filter((k) => k.startsWith(`skip${step}:${kind}:`));
/** The facts that decide whether a step is passed: counting up and what comes next. */
export const stepKeys = (step: SkipStep): string[] => [...keysOf(step, 'up'), ...keysOf(step, 'next')];

/** Share of a step's deciding facts that are secure (box 2 or higher). */
export function stepShare(stats: Iterable<FactStats>, step: SkipStep): number {
  const box = new Map([...stats].map((s) => [s.key, s.box]));
  const keys = stepKeys(step);
  return keys.filter((k) => (box.get(k) ?? 0) >= 2).length / keys.length;
}

/**
 * The step for today: the first step not yet secure, but never below the furthest step reached. Once 2s are secure the
 * child stays on 2s (they still need the practice, and 2s are the top of this game).
 */
export function stepFor(stats: Iterable<FactStats>, reached: SkipStep = 10): SkipStep {
  const list = [...stats];
  const from = STEPS.indexOf(reached);
  const at = STEPS.findIndex((s, i) => i >= from && stepShare(list, s) < STEP_SECURE_SHARE);
  return at === -1 ? STEPS[STEPS.length - 1] : STEPS[at];
}

/** One hop: the fact it practises and where the gap is (the shared pack's params are [answer, at]). */
export interface HopPlan {
  key: string;
  answer: number;
  at: number;
}

/** What the server saves when a challenge starts, and the browser is sent. */
export interface Round {
  seed: number;
  step: SkipStep;
  gold: boolean;
  hops: HopPlan[];
}

/**
 * The mistake behind a wrong glow-worm (maths review R5, section 3.3). The kind picks the picture and the why-line.
 *  off1  one more or one less than the answer: counted the jump as a pad (39 or 41 for 40)
 *  stay  the pad Hop is sitting on: did not hop
 *  far   one hop too far (counting back: one hop too few): skipped a pad
 *  step  where a different step would land: lost the step
 *  way   counting back, the number going up: went the wrong way
 */
export type HopMistake = 'off1' | 'stay' | 'far' | 'step' | 'way';

/** A hop as shown: the pads (with '?' for the glowing gap), the words to read aloud and the glow-worms' numbers. */
export interface Hop extends HopPlan {
  /** The pads left to right, as the shared pack shows them: ["20,", "30,", "?,", "50"]. */
  parts: string[];
  /** The pads left to right as numbers, the gap's answer in its place: [20, 30, 40, 50]. */
  terms: number[];
  /** Where the gap is in `terms`. */
  gap: number;
  /** The pad Hop sits on before the hop: the one before the gap. */
  before: number;
  /** Counting back: the hop goes down. */
  back: boolean;
  prompt: string;
  spoken: string;
  /** Four glow-worms in the order fixed by the seed, the right one among them. */
  choices: number[];
  /** The three wrong ones and the mistake behind each. */
  wrongs: Wrong<HopMistake>[];
}

/**
 * What a glow-worm's number can be told by: the right answer is a multiple of the step, so is anything on the same step.
 * Exactly two of the four share it (the answer and one more), so no glow-worm can be picked just for how it ends.
 */
export const tellOf = (step: SkipStep) => (n: number): boolean => n % step === 0;
/** The numbers on the 100 board and in the game: no landing is below 0 or above 100. */
const inRange = (n: number) => n >= 0 && n <= 100;

const shuffle = <T>(items: T[], random: () => number): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/**
 * Picks `n` different facts, weakest first (lowest box), with ties broken by the seed, then shuffles their order so the
 * round doesn't always start with the hardest ones.
 */
function pickKeys(keys: string[], n: number, box: Map<string, number>, random: () => number): string[] {
  const order = shuffle(keys, random);
  const weakest = order.map((k, i) => ({ k, i })).sort((a, b) => (box.get(a.k) ?? 0) - (box.get(b.k) ?? 0) || a.i - b.i);
  return shuffle(weakest.slice(0, n).map((x) => x.k), random);
}

/**
 * Today's challenge from a fresh seed, the child's records, the furthest step reached and whether it is a gold day.
 * The same inputs always give the same round. The server saves the round's hops, so the records changing later doesn't
 * matter when the taps are checked.
 */
export function makeRound(seed: number, stats: Iterable<FactStats>, opts: { reached?: SkipStep; gold?: boolean } = {}): Round {
  if (!isSeed(seed)) throw new RangeError(`Bad seed ${seed}`);
  const list = [...stats];
  const step = stepFor(list, opts.reached);
  const gold = !!opts.gold;
  const random = seeded(seed);
  random(); random(); // the first draws of this generator are close together for close seeds
  const box = new Map(list.map((s) => [s.key, s.box]));
  const back = gold ? BACK_HOPS : 0;
  const keys = [
    ...pickKeys(stepKeys(step), HOPS_PER_ROUND - back, box, random),
    ...pickKeys(keysOf(step, 'back'), back, box, random),
  ];
  // The shared family rolls each question's numbers (the answer and where the gap is), from the seed.
  const hops = keys.map((key) => {
    const [answer, at] = family(step).roll(key, random);
    return { key, answer, at };
  });
  return { seed, step, gold, hops };
}

/**
 * A hop made again from its plan by the shared pack, with its glow-worms built here and put in an order fixed by the
 * seed (the shared pack's own wrong numbers are not used: "ends in 0" would win on tens). The four are the answer, one
 * more on the same step (the pad Hop sits on, one hop too far, or when counting back the number going up), then two that
 * do not share the answer's ending: one more or less than the answer, and where a different step would land. Null if the
 * plan isn't one the pack could make.
 */
export function showHop(round: Pick<Round, 'seed'>, index: number, plan: HopPlan): Hop | null {
  const random = seeded((round.seed + 7919 * (index + 1)) % MAX_SEED);
  const q = pack.rebuild(plan.key, [plan.answer, plan.at], true, random);
  const m = /^skip(10|5|2):(up|next|back):\d+$/.exec(plan.key);
  if (!q || !q.choices || q.answer !== plan.answer || !m) return null;
  const step = Number(m[1]) as SkipStep;
  const back = m[2] === 'back';
  const terms = q.parts.map((p) => (p.startsWith('?') ? plan.answer : Number(p.replace(/,$/, ''))));
  const gap = q.parts.findIndex((p) => p.startsWith('?'));
  if (gap < 1 || terms.some((n) => !Number.isInteger(n))) return null;
  const before = terms[gap - 1];
  const dir = back ? -1 : 1;
  const a = plan.answer;
  const tell = tellOf(step);
  const taken = new Set<number>([a]);
  const fresh = (n: number) => inRange(n) && !taken.has(n);

  // One more on the same step.
  const sameStep: [number, HopMistake][] = [[before, 'stay']];
  if (fresh(a + dir * step)) sameStep.push([a + dir * step, 'far']);
  if (back && fresh(before + step)) sameStep.push([before + step, 'way']);
  const [same, sameKind] = sameStep[Math.floor(random() * sameStep.length)];
  taken.add(same);
  // Where a different step would land, from the pad Hop sits on: the first of 10, 5, 2, 1 that is not on this step's ending.
  const other = [10, 5, 2, 1].filter((s) => s !== step).map((s) => before + dir * s).find((n) => fresh(n) && !tell(n));
  if (other === undefined) return null;
  taken.add(other);
  // One more or one less (the sign by the seed), the other if that one is out of range or taken.
  const signs = random() < 0.5 ? [1, -1] : [-1, 1];
  const off = signs.map((d) => a + d).find((n) => fresh(n) && !tell(n));
  if (off === undefined) return null;

  const kinds = new Map<number, HopMistake>([[same, sameKind], [other, 'step'], [off, 'off1']]);
  const wrongs = tagWrongs([off, same, other], (n) => kinds.get(n) ?? null);
  const choices = shuffle([a, ...wrongs.map((w) => w.n)], random);
  if (new Set(choices).size !== 4 || !atMostShareTell(a, choices, tell) || sharingTell(a, choices, tell) !== 2) return null;
  return { ...plan, parts: q.parts, terms, gap, before, back, prompt: q.prompt ?? '', spoken: q.spoken, choices, wrongs };
}

/** Every hop of a round as shown. Throws if a saved round has a hop the pack can't make. */
export function showRound(round: Round): Hop[] {
  return round.hops.map((plan, i) => {
    const hop = showHop(round, i, plan);
    if (!hop) throw new Error(`Hop ${i} (${plan.key}) can't be made`);
    return hop;
  });
}
