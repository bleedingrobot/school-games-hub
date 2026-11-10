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
 * Counting back is left out of that share so a child who is secure going forward moves on, and gets the counting-back
 * hops (`backPlan`) for the steps behind them. The server keeps the furthest step reached (`reached`), so forgetting a few facts brings more practice
 * of them but never drops a child back a step.
 */
import { helpForFact, type FactRung } from '../kit/help';
import { atMostShareTell, sharingTell, tagWrongs, type Wrong } from '../kit/mistakes';
import type { FactStats } from '../maths/leitner';
import { STEP_SECURE_SHARE } from '../maths/selector';
import { EARLY_FACTS, earlyFactsPack, parseSkip, type SkipKind } from '../maths/skillPacks/earlyFacts';
import { seeded } from '../seededRandom';
import type { Help } from './progress';

export const HOPS_PER_ROUND = 10;

/** The kinds of hop a child can meet: counting forward, counting back, and counting from a start off a multiple ("from 3"). Names never change once shipped. */
export type HopKind = 'up' | 'back' | 'offset';
export const HOP_KINDS: readonly HopKind[] = ['up', 'back', 'offset'];
/** The kind of a key (counting back wins over a start offset), or null if it is not a skip-counting key. */
export function kindOfKey(key: string): HopKind | null {
  const k = parseSkip(key);
  if (!k) return null;
  return k.kind === 'back' ? 'back' : k.offset ? 'offset' : 'up';
}
/** The made-up examples of the "Show me first" demos: keys no step ever asks (there is no step of ones, and fives start from 1 to 4 only). */
export const DEMO_KEYS = { back: 'skip1:back:7', offset: 'skip5o7:up:17' } as const;
/** On gold days the last three hops count back, as Hop hops home (James, 4 Nov 2026). */
export const BACK_HOPS = 3;
/**
 * Counting back on any day (R9): once a child is secure going forward on a step, one hop of each round counts back on it
 * (the fact keys already say which way: `skip10:back:60`, so each has its own record). Two once a third of that step's back
 * facts are at box 2, three once the usual 70% are. Gold days always ask three, as before.
 */
export const BACK_TWO_SHARE = 1 / 3;
/** On gold days, two hops start off a multiple, once their step is secure (R8). */
export const GOLD_FROM_HOPS = 2;
/**
 * The steps in order, each named by what it is saved as (`reached`, a round's `step`): the size of the hop for tens, fives,
 * twos, threes and fours, and 200 for tens past 100 (tens to 200, whose hop is still 10). Threes, fours and tens past 100
 * are R8's longer ladder: the shared keys sit beside the maths ladder (shared/maths/skillPacks/earlyFacts.ts), so only this
 * game asks them, and a step is passed by the same 70% rule.
 */
export const HOP_STEPS = [
  { step: 10, size: 10, family: 'skip10', word: 'tens', top: 100 },
  { step: 5, size: 5, family: 'skip5', word: 'fives', top: 100 },
  { step: 2, size: 2, family: 'skip2', word: 'twos', top: 100 },
  { step: 3, size: 3, family: 'skip3', word: 'threes', top: 100 },
  { step: 4, size: 4, family: 'skip4', word: 'fours', top: 100 },
  { step: 200, size: 10, family: 'skip10h', word: 'tens past 100', top: 200 },
] as const;
export type HopStep = (typeof HOP_STEPS)[number]['step'];
export const STEPS: readonly HopStep[] = HOP_STEPS.map((s) => s.step);
const spec = (step: HopStep) => HOP_STEPS.find((s) => s.step === step)!;
/** How far one hop goes (10 for tens past 100). */
export const sizeOf = (step: HopStep): number => spec(step).size;
/** What the step is called: "tens", "threes", "tens past 100". */
export const wordOf = (step: HopStep): string => spec(step).word;
/** The step a key belongs to: skip3:up:9 and skip3o1:next:7 are threes, skip10h:... is tens past 100. */
export function stepOfKey(key: string): HopStep | null {
  const k = parseSkip(key);
  if (!k) return null;
  const step = k.high ? 200 : k.step;
  return isStep(step) ? step : null;
}
/** The shared family a key belongs to (the one that rolls and makes it). */
const familyOfKey = (key: string) => {
  const k = parseSkip(key);
  return k ? EARLY_FACTS.families[k.high ? 'skip10h' : k.offset ? `skip${k.step}o` : `skip${k.step}`] : undefined;
};

/** Seeds are whole numbers from 0 up to 2^31 - 1, the range the hub's random generator handles exactly. */
export const MAX_SEED = 2147483647;
export const isSeed = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MAX_SEED;
export const isStep = (n: unknown): n is HopStep => STEPS.includes(n as HopStep);

/** Every fact of one kind for a step: `skip5:next:25` and so on, from the shared pack's own list. */
const pack = earlyFactsPack();
const family = (step: HopStep) => EARLY_FACTS.families[spec(step).family];
const keysOf = (step: HopStep, kind: SkipKind): string[] => family(step).keys.filter((k) => k.includes(`:${kind}:`));
/** Counting on from a start that isn't a multiple ("start at 3, hop by 10"), for a step that has it (not tens past 100). */
const offsetKeys = (step: HopStep): string[] => (step === 200 ? [] : EARLY_FACTS.families[`skip${step}o`]?.keys ?? []);
/** The facts that decide whether a step is passed: counting up and what comes next. */
export const stepKeys = (step: HopStep): string[] => [...keysOf(step, 'up'), ...keysOf(step, 'next')];

/** Share of a step's deciding facts that are secure (box 2 or higher). */
export function stepShare(stats: Iterable<FactStats>, step: HopStep): number {
  const box = new Map([...stats].map((s) => [s.key, s.box]));
  const keys = stepKeys(step);
  return keys.filter((k) => (box.get(k) ?? 0) >= 2).length / keys.length;
}

/**
 * The step for today: the first step not yet secure, but never below the furthest step reached. Once the last step is
 * secure the child stays on it (they still need the practice).
 */
export function stepFor(stats: Iterable<FactStats>, reached: HopStep = 10): HopStep {
  const list = [...stats];
  const from = STEPS.indexOf(reached);
  const at = STEPS.findIndex((s, i) => i >= from && stepShare(list, s) < STEP_SECURE_SHARE);
  return at === -1 ? STEPS[STEPS.length - 1] : STEPS[at];
}

/**
 * Is the child ready for the signpost to doubling (R8's "what's next")? Twos are the first step of doubling, so it shows once
 * the child has reached twos and they are secure by the same 70% rule (a child whose records are only half made never gets
 * it early). Threes, fours and tens past 100 come after twos and don't hold it back, so the signpost that showed once twos
 * were secure still shows.
 */
export function topSecure(stats: Iterable<FactStats>, reached: HopStep = 10): boolean {
  return STEPS.indexOf(reached) >= STEPS.indexOf(2) && stepShare(stats, 2) >= STEP_SECURE_SHARE;
}

/** Share of a step's counting-back facts that are secure (box 2 or higher). */
function backShare(stats: Iterable<FactStats>, step: HopStep): number {
  const box = new Map([...stats].map((s) => [s.key, s.box]));
  const keys = keysOf(step, 'back');
  return keys.filter((k) => (box.get(k) ?? 0) >= 2).length / keys.length;
}

/**
 * Where counting back comes from and how many hops: the latest step, up to today's, that is secure going forward (70% of its
 * up and next facts at box 2 or more), with 1, 2 or 3 hops by how secure its back facts are. A child with no such step has
 * none. On a gold day it is today's step and three hops, as it always was.
 */
export function backPlan(stats: Iterable<FactStats>, step: HopStep, gold: boolean): { from: HopStep; count: number } | null {
  const list = [...stats];
  if (gold) return { from: step, count: Math.max(BACK_HOPS, backCount(list, step)) };
  const from = STEPS.slice(0, STEPS.indexOf(step) + 1).reverse().find((s) => stepShare(list, s) >= STEP_SECURE_SHARE);
  return from === undefined ? null : { from, count: backCount(list, from) };
}
const backCount = (list: FactStats[], step: HopStep): number => {
  const share = backShare(list, step);
  return share >= STEP_SECURE_SHARE ? 3 : share >= BACK_TWO_SHARE ? 2 : 1;
};

/** The steps this child has passed (secure by the 70% rule), so their non-multiple starts may be asked on a gold day. */
const securedSteps = (stats: FactStats[]): HopStep[] => STEPS.filter((s) => offsetKeys(s).length > 0 && stepShare(stats, s) >= STEP_SECURE_SHARE);

export const HELPS: readonly Help[] = ['full', 'faint', 'none'];
export const isHelp = (v: unknown): v is Help => HELPS.includes(v as Help);

/**
 * The step label ("+10") for a fact from the child's own record of it (maths review R6, Weka's way with Hop's three
 * states): full until the fact is secure (box 2) and has been right and quick (box 2 and one quick day, or right every time so far; S25); faint until it is
 * fluent (box 4) and right 6 times; then none. A wrong answer drops a fact to box 1, so its full label comes back, and a
 * new step's facts have no record, so they start full.
 */
const HELP_LADDER: readonly FactRung<Help>[] = [
  { help: 'full', until: { box: 2, quickDays: 1 } },
  { help: 'faint', until: { box: 4, correct: 6 } },
  { help: 'none' },
];
export const helpForStats = (stats: Pick<FactStats, 'box' | 'correct' | 'attempts' | 'quickDays'> | undefined): Help => helpForFact(stats, HELP_LADDER);

/**
 * One hop: the fact it practises, where the gap is (the shared pack's params are [answer, at]) and its step label.
 * `h` is missing on a round saved before R6: that hop shows the calendar's label for the round (the browser falls back).
 */
export interface HopPlan {
  key: string;
  answer: number;
  at: number;
  h?: Help;
}

/** What the server saves when a challenge starts, and the browser is sent. */
export interface Round {
  seed: number;
  step: HopStep;
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
  /** How far one hop goes (10, 5, 2, 3 or 4), from the key and not the round: a gold day mixes steps. */
  size: number;
  /** The step the key belongs to (the word for it is `wordOf`), and where counting starts when it isn't a multiple ("from 3"), else 0. */
  of: HopStep;
  from: number;
  prompt: string;
  spoken: string;
  /** Four glow-worms in the order fixed by the seed, the right one among them. */
  choices: number[];
  /** The three wrong ones and the mistake behind each. */
  wrongs: Wrong<HopMistake>[];
}

/**
 * What a glow-worm's number can be told by: the right answer is a multiple of the step (or the same distance past one, when
 * counting starts off a multiple), so is anything on the same step. Exactly two of the four share it (the answer and one
 * more), so no glow-worm can be picked just for how it ends.
 */
export const tellOf = (size: number, rest = 0) => (n: number): boolean => n % size === rest;
/** The numbers on the board and in the game: no landing is below 0 or above the top (100, or 200 past 100). */
const inRange = (n: number, top = 100) => n >= 0 && n <= top;

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
export function makeRound(seed: number, stats: Iterable<FactStats>, opts: { reached?: HopStep; step?: HopStep; gold?: boolean } = {}): Round {
  if (!isSeed(seed)) throw new RangeError(`Bad seed ${seed}`);
  const list = [...stats];
  // A saved step is used as is, so records from replays can't move it; with none (a new child) it comes from the records.
  const step = opts.step ?? stepFor(list, opts.reached);
  const gold = !!opts.gold;
  const random = seeded(seed);
  random(); random(); // the first draws of this generator are close together for close seeds
  const box = new Map(list.map((s) => [s.key, s.box]));
  const byKey = new Map(list.map((s) => [s.key, s]));
  const plan = backPlan(list, step, gold);
  const back = plan?.count ?? 0;
  // On a gold day, two hops start off a multiple ("start at 3, hop by 10"), but only for steps the child has passed.
  const passed = gold ? securedSteps(list) : [];
  const offs = passed.length ? pickKeys(passed.flatMap(offsetKeys), GOLD_FROM_HOPS, box, random) : [];
  const keys = [
    ...pickKeys(stepKeys(step), HOPS_PER_ROUND - back - offs.length, box, random),
    ...offs,
    ...(plan ? pickKeys(keysOf(plan.from, 'back'), back, box, random) : []),
  ];
  // The shared family rolls each question's numbers (the answer and where the gap is), from the seed.
  const hops = keys.map((key) => {
    const [answer, at] = familyOfKey(key)!.roll(key, random);
    return { key, answer, at, h: helpForStats(byKey.get(key)) };
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
  const k = parseSkip(plan.key);
  const of = k && stepOfKey(plan.key);
  if (!q || !q.choices || q.answer !== plan.answer || !k || !of) return null;
  const size = k.step;
  const top = k.high ? 200 : 100;
  const back = k.kind === 'back';
  const terms = q.parts.map((p) => (p.startsWith('?') ? plan.answer : Number(p.replace(/,$/, ''))));
  const gap = q.parts.findIndex((p) => p.startsWith('?'));
  if (gap < 1 || terms.some((n) => !Number.isInteger(n))) return null;
  const before = terms[gap - 1];
  const dir = back ? -1 : 1;
  const a = plan.answer;
  const tell = tellOf(size, k.offset);
  const taken = new Set<number>([a]);
  const fresh = (n: number) => inRange(n, top) && !taken.has(n);

  // One more on the same step.
  const sameStep: [number, HopMistake][] = [[before, 'stay']];
  if (fresh(a + dir * size)) sameStep.push([a + dir * size, 'far']);
  if (back && fresh(before + size)) sameStep.push([before + size, 'way']);
  const [same, sameKind] = sameStep[Math.floor(random() * sameStep.length)];
  taken.add(same);
  // Where a different step would land, from the pad Hop sits on: the first of 10, 5, 2, 1 that is not on this step's ending.
  const other = [10, 5, 2, 1].filter((s) => s !== size).map((s) => before + dir * s).find((n) => fresh(n) && !tell(n));
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
  return { ...plan, parts: q.parts, terms, gap, before, back, size, of, from: k.offset, prompt: q.prompt ?? '', spoken: q.spoken, choices, wrongs };
}

/** Every hop of a round as shown. Throws if a saved round has a hop the pack can't make. */
export function showRound(round: Round): Hop[] {
  return round.hops.map((plan, i) => {
    const hop = showHop(round, i, plan);
    if (!hop) throw new Error(`Hop ${i} (${plan.key}) can't be made`);
    return hop;
  });
}

/**
 * A "sister" of a hop for "Now you try one like it" (S32 part 3): another fact of the same step, direction and start (the
 * same family of keys and kind: up, next or back, and from the same start), so a different answer on a differently
 * rolled gap, at the same help. It leaves out answers the child has just seen, as pads or as glow-worms, where it can. Built
 * by showHop, so its glow-worms and wrong numbers agree, and every line it can say is already in the voice list (the list holds every
 * key of every family at every place of the gap). Local only: never sent or saved. Null if no other fact fits.
 */
export function sisterHop(round: Pick<Round, 'seed'>, index: number, hop: Hop): Hop | null {
  const me = parseSkip(hop.key);
  const family = familyOfKey(hop.key);
  if (!me || !family) return null;
  const seen = new Set<number>([...hop.terms, ...hop.choices]);
  const same = family.keys.filter((key) => {
    const k = parseSkip(key);
    return !!k && key !== hop.key && k.kind === me.kind && k.offset === me.offset && k.high === me.high && k.answer !== hop.answer;
  });
  const random = seeded((round.seed + 15485863 + 31 * index) % MAX_SEED);
  random(); random();
  const order = shuffle(same, random);
  const tried = [...order.filter((k) => !seen.has(parseSkip(k)!.answer)), ...order.filter((k) => seen.has(parseSkip(k)!.answer))];
  for (const key of tried) {
    const [answer, at] = family.roll(key, random);
    const sister = showHop(round, index + 101, { key, answer, at, h: hop.h });
    if (sister) return sister;
  }
  return null;
}
