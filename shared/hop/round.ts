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

/** A hop as shown: the pads (with '?' for the glowing gap), the words to read aloud and the glow-worms' numbers. */
export interface Hop extends HopPlan {
  /** The pads left to right, as the shared pack shows them: ["20,", "30,", "?,", "50"]. */
  parts: string[];
  prompt: string;
  spoken: string;
  /** Four glow-worms, the right one among them. */
  choices: number[];
}

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

/** A hop made again from its plan by the shared pack, with its glow-worms in an order fixed by the seed. Null if the plan isn't one the pack could make. */
export function showHop(round: Pick<Round, 'seed'>, index: number, plan: HopPlan): Hop | null {
  const q = pack.rebuild(plan.key, [plan.answer, plan.at], true, seeded((round.seed + 7919 * (index + 1)) % MAX_SEED));
  if (!q || !q.choices || q.answer !== plan.answer) return null;
  return { ...plan, parts: q.parts, prompt: q.prompt ?? '', spoken: q.spoken, choices: q.choices };
}

/** Every hop of a round as shown. Throws if a saved round has a hop the pack can't make. */
export function showRound(round: Round): Hop[] {
  return round.hops.map((plan, i) => {
    const hop = showHop(round, i, plan);
    if (!hop) throw new Error(`Hop ${i} (${plan.key}) can't be made`);
    return hop;
  });
}
