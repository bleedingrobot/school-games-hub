/**
 * One day's challenge at Tūī's Ten Tree (docs/TUI-PLAN.md sections 3 and 4): ten goes, each a teen number seen as a
 * full ten and some more ("10 and 4 → 14"), with three or four nests to choose from.
 *
 * The facts are the hub's shared "ten and" facts (`tenand:4` for ways 0 and 1, `tenless:4` for ways 2 and 3, in
 * shared/maths/skillPacks/earlyFacts.ts, ladder skill `ten-and`). Nothing here works out a sum itself: the shared pack makes each question and its wrong choices from the
 * key and its variant (the "way"), exactly as anywhere else on the hub. The ways: 0 "10 + 4", 1 "4 + 10",
 * 2 "10 + ? = 14" (how many more?) and 3 "14 − 10" (take the ten away).
 *
 * Two things move separately, both from the child's own challenges and both kept by the server:
 * - the **step** (which ways are asked): 1 How many?, 2 Turn it round, 3 How many more?, 4 Take the ten away, 5 All
 *   mixed. A step is passed after two good challenges at it (8 or more of 10 right at the first tap). Never drops back.
 * - the **help level** (how much picture): 5 every berry counted in, down to 0 numbers only (see `levelAfter`).
 */
import type { FactStats } from '../maths/leitner';
import { earlyFactsPack } from '../maths/skillPacks/earlyFacts';
import { tagWrongs, type Wrong } from '../kit/mistakes';
import { seeded } from '../seededRandom';
import { STEP_SECURE_SHARE } from '../maths/selector';

export const GOES_PER_ROUND = 10;
/** From step 2 on (until all mixed), this many goes are the earlier ways (the rest are the new way). */
export const REVIEW_GOES = 3;
/** Right at the first tap on this many goes (of 10) makes a good challenge. */
export const GOOD = 8;
/** This many or fewer makes a hard one. */
export const HARD = 4;
/** Good challenges at a step that pass it. */
export const GOOD_TO_PASS = 2;
/** Good challenges in a row that take the help down one level. */
export const GOOD_TO_FADE = 2;
/**
 * Help levels go back up this many when a new step starts, unless the help faded on that same go (then the fade
 * stands). Either way never below `FRAMES_LEVEL`.
 */
export const NEW_STEP_HELP = 1;
export const TOP_LEVEL = 5;
/** The lowest level with ten-frames (below it the ten is a kete): every new step starts here at least. */
export const FRAMES_LEVEL = 4;
/** Box 2 or more on this many of the nine facts when they first play: start at `KNOWN_START`. */
export const KNOWN_FACTS = 7;
export const KNOWN_START = { step: 3 as Step, level: FRAMES_LEVEL as HelpLevel };

/** The nine "ten and" facts (10 + 4, 4 + 10), and the nine "ten less" ones (14 − 10, 10 + ? = 14), kept as separate records (R9). */
export const KEYS = Array.from({ length: 9 }, (_, i) => `tenand:${i + 1}`);
export const LESS_KEYS = Array.from({ length: 9 }, (_, i) => `tenless:${i + 1}`);
/** The record a go counts towards: ways 0 and 1 are "ten and", ways 2 and 3 "ten less". */
export const keyFor = (n: number, way: number): string => `${way >= 2 ? 'tenless' : 'tenand'}:${n}`;

export const STEPS = [
  { step: 1, name: 'How many?', ways: [0] },
  { step: 2, name: 'Turn it round', ways: [0, 1] },
  { step: 3, name: 'How many more?', ways: [0, 1, 2] },
  { step: 4, name: 'Take the ten away', ways: [0, 1, 2, 3] },
  { step: 5, name: 'All mixed', ways: [0, 1, 2, 3] },
] as const;
export type Step = (typeof STEPS)[number]['step'];
export type Way = 0 | 1 | 2 | 3;
/** 5 every berry counted in, 4 every berry, 3 the kete of ten, 2 small and faint, 1 numbers with a peek, 0 numbers only. */
export type HelpLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type HelpSetting = 'fade' | 'always' | 'off';

/** The guided first go (plan section 6): 10 and 2, at level 5. */
export const GUIDED_KEY = 'tenand:2';
const GUIDED_N = 2;

export const MAX_SEED = 2147483647;
export const isSeed = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MAX_SEED;
export const isStep = (n: unknown): n is Step => STEPS.some((s) => s.step === n);
export const isLevel = (n: unknown): n is HelpLevel => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= TOP_LEVEL;
export const stepName = (step: Step) => STEPS.find((s) => s.step === step)!.name;

/** The level a go is shown at, from the child's level and the teacher's setting: Fades follows the child, Always keeps 4, Off is 0. */
export const shownLevel = (level: HelpLevel, help: HelpSetting): HelpLevel => (help === 'always' ? 4 : help === 'off' ? 0 : level);

/** A child who already knows most of the facts when they first play starts further on, with less help. */
export function startFor(stats: Iterable<FactStats>): { step: Step; level: HelpLevel } {
  const box = new Map([...stats].map((s) => [s.key, s.box]));
  return KEYS.filter((k) => (box.get(k) ?? 0) >= 2).length >= KNOWN_FACTS ? KNOWN_START : { step: 1, level: TOP_LEVEL };
}

/** Where a child is: their step, help level and the good challenges counted towards the next change. */
export interface Place {
  step: Step;
  level: HelpLevel;
  /** Good challenges in a row (two take the help down a level). */
  goodInRow: number;
  /** Good challenges at this step (two pass it). */
  goodAtStep: number;
}

/**
 * The place after a counted challenge (the day's first finish) with `right` goes right at the first tap. Good: towards
 * less help and the next step. Hard: one level more help at once. A new step brings `NEW_STEP_HELP` level back only
 * if the help didn't fade on this same go (a pass and a fade usually land together, and the fade must stand, or a
 * strong child keeps every berry counted in until step 5). Either way a new step always has the ten-frames: the kete
 * comes only once a way of asking is going well.
 */
export function placeAfter(p: Place, right: number): Place {
  const good = right >= GOOD;
  const hard = right <= HARD;
  let level = p.level;
  let goodInRow = good ? p.goodInRow + 1 : 0;
  let faded = false;
  if (goodInRow >= GOOD_TO_FADE) {
    level = Math.max(0, level - 1) as HelpLevel;
    goodInRow = 0;
    faded = true;
  }
  if (hard) level = Math.min(TOP_LEVEL, level + 1) as HelpLevel;
  let { step } = p;
  let goodAtStep = good ? p.goodAtStep + 1 : p.goodAtStep;
  if (goodAtStep >= GOOD_TO_PASS && step < 5) {
    step = (step + 1) as Step;
    goodAtStep = 0;
    goodInRow = 0;
    level = Math.max(FRAMES_LEVEL, Math.min(TOP_LEVEL, faded ? level : level + NEW_STEP_HELP)) as HelpLevel;
  }
  return { step, level, goodInRow, goodAtStep };
}

/**
 * The top step is secure (R8, the "what's next" card): at least 70% of the eighteen facts (nine "ten and", nine "ten less")
 * at box 2 or more, the same share as the teacher skill map's "secure" (STEP_SECURE_SHARE). Thirteen of eighteen.
 */
export function topSecure(stats: Iterable<FactStats>): boolean {
  const box = new Map([...stats].map((s) => [s.key, s.box]));
  const all = [...KEYS, ...LESS_KEYS];
  return all.filter((k) => (box.get(k) ?? 0) >= 2).length >= Math.ceil(all.length * STEP_SECURE_SHARE);
}

/** One go as saved: the fact, the way it is asked and the help level it is shown at. */
export interface GoPlan {
  key: string;
  v: Way;
  l: HelpLevel;
}

/** What the server saves when a challenge starts, and the browser is sent. */
export interface Round {
  seed: number;
  step: Step;
  /** The child's own help level when the challenge started (the goes may be shown at another, by the teacher's setting). */
  level: HelpLevel;
  /** The teacher's help setting when it started: Off means no Peek. */
  help: HelpSetting;
  goes: GoPlan[];
}

/** A go as shown. */
export interface Go extends GoPlan {
  /** The ones: 4 in 10 and 4. */
  n: number;
  /** The teen number: 14. */
  teen: number;
  answer: number;
  /** The shared pack's question, as parts: ["10", "+", "4", "=", "?"]. */
  parts: string[];
  /** The nests, smallest first: four at every help level. */
  choices: number[];
  /** The three wrong nests, each with the mistake behind it (it picks the why-line and the picture). */
  wrongs: WrongNest[];
}

const shuffle = <T>(items: T[], random: () => number): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** The same fact never comes twice in a row: a repeat swaps with a later go where it fits. */
function spreadOut<T>(keys: T[]): T[] {
  const out = [...keys];
  for (let i = 1; i < out.length; i++) {
    if (out[i] !== out[i - 1]) continue;
    const j = out.findIndex((k, x) => x > i && k !== out[i] && out[x - 1] !== out[i - 1] && (x + 1 >= out.length || out[x + 1] !== out[i]));
    const back = out.findIndex((k, x) => x < i - 1 && k !== out[i] && (x === 0 || out[x - 1] !== out[i]) && out[x + 1] !== out[i]);
    const at = j !== -1 ? j : back;
    if (at !== -1) [out[i], out[at]] = [out[at], out[i]];
  }
  return out;
}

/** The ways of a step's ten goes: step 1 all "10 + n"; then 7 of the new way and 3 earlier; all mixed, evenly. */
function waysFor(step: Step, random: () => number): Way[] {
  const { ways } = STEPS.find((s) => s.step === step)!;
  if (step === 1) return Array(GOES_PER_ROUND).fill(0);
  if (step === 5) return shuffle(Array.from({ length: GOES_PER_ROUND }, (_, i) => ways[i % ways.length] as Way), random);
  const fresh = ways[ways.length - 1] as Way;
  const earlier = ways.slice(0, -1) as Way[];
  const review = Array.from({ length: REVIEW_GOES }, (_, i) => earlier[Math.floor(random() * earlier.length + i) % earlier.length]);
  return shuffle([...Array(GOES_PER_ROUND - REVIEW_GOES).fill(fresh), ...review], random);
}

/**
 * Today's challenge from a fresh seed, the child's records, their place and the teacher's help setting. Every fact
 * once and the weakest again, weakest first; on the very first challenge 10 and 2 comes first at level 5. The same
 * inputs always give the same round.
 */
export function makeRound(
  seed: number,
  stats: Iterable<FactStats>,
  opts: { step?: Step; level?: HelpLevel; help?: HelpSetting; guided?: boolean } = {},
): Round {
  if (!isSeed(seed)) throw new RangeError(`Bad seed ${seed}`);
  const step = opts.step ?? 1;
  const level = opts.level ?? TOP_LEVEL;
  const help = opts.help ?? 'fade';
  const random = seeded(seed);
  random(); random(); // the first draws of this generator are close together for close seeds
  const box = new Map([...stats].map((s) => [s.key, s.box]));
  // Each number once, weakest first: a number is as weak as its weakest fact among the ways this step asks (so a child who
  // knows 10 + 4 but not 14 − 10 meets 4 early once the minus ways are asked).
  const stepWays = STEPS.find((x) => x.step === step)!.ways;
  const weakness = (n: number) => Math.min(...stepWays.map((w) => box.get(keyFor(n, w)) ?? 0));
  const byWeak = shuffle(KEYS.map((_, i) => i + 1), random)
    .map((n, i) => ({ n, i }))
    .sort((a, b) => weakness(a.n) - weakness(b.n) || a.i - b.i)
    .map((x) => x.n);
  // Every number once, weakest first, and the weakest again at the end.
  let ns = [...byWeak, byWeak[0]];
  if (opts.guided) {
    const rest = [...ns];
    rest.splice(rest.indexOf(GUIDED_N), 1);
    ns = spreadOut([GUIDED_N, ...rest]);
  }
  const ways = waysFor(step, random);
  const shown = shownLevel(level, help);
  const goes = ns.map((n, i): GoPlan => (opts.guided && i === 0 ? { key: keyFor(n, 0), v: 0, l: TOP_LEVEL } : { key: keyFor(n, ways[i]), v: ways[i], l: shown }));
  return { seed, step, level, help, goes };
}

const pack = earlyFactsPack();

/** How many nests a go has: always four, at every help level (maths review R5; it was three while every berry was drawn). */
export const NESTS = 4;

/**
 * The mistake behind a wrong nest (maths review R5, docs/kit/README.md "Teen numbers"): `reverse` 41 for 14, `tens` 20,
 * `ones` the loose berries alone, `off1` one berry out, `total` the whole when asked for a part (or when the ten should be
 * taken away), `up` the ten put on instead of taken off.
 */
export type TuiKind = 'reverse' | 'tens' | 'ones' | 'off1' | 'total' | 'up';
export type WrongNest = Wrong<TuiKind>;

/** The reversal a child who hears "fourteen" might pick: 41 for 14 (only when the ones aren't 1, so it differs). */
export const reversalOf = (n: number) => n * 10 + 1;

/** The shape of a number the way a child sees it: a teen, a single digit, or something else. At most two nests (the answer and one) share the answer's. */
export const nestShape = (n: number): string => (n >= 11 && n <= 19 ? 'teen' : n <= 9 ? 'one' : 'other');

/**
 * The wrong nests of a go, each with its kind, fixed by the seed. Three of them:
 * - "how many?" (ways 0 and 1): one berry out (a second teen, so the answer is never the lone teen), the reversal when the
 *   ones aren't 1, and one or two of 20 and the loose berries alone;
 * - "how many more?" (way 2): the whole, one berry out, 20;
 * - "take the ten away" (way 3): the whole, the ten put on (24 for 14), one berry out.
 */
export function wrongNests(n: number, v: Way, random: () => number): WrongNest[] {
  const slip = n === 1 ? 1 : n === 9 ? -1 : random() < 0.5 ? 1 : -1;
  const answer = v >= 2 ? n : 10 + n;
  const off1: WrongNest = { n: answer + slip, kind: 'off1' };
  const picks: WrongNest[] =
    v <= 1
      ? [off1, ...(n >= 2 ? [{ n: reversalOf(n), kind: 'reverse' as const }] : []), ...shuffle<WrongNest>([{ n: 20, kind: 'tens' }, { n, kind: 'ones' }], random)]
      : v === 2
        ? [{ n: 10 + n, kind: 'total' }, off1, { n: 20, kind: 'tens' }]
        : [{ n: 10 + n, kind: 'total' }, { n: 20 + n, kind: 'up' }, off1];
  return tagWrongs(
    picks.map((w) => w.n),
    (x) => picks.find((w) => w.n === x)?.kind ?? null,
  )
    .filter((w) => w.n !== answer)
    .slice(0, NESTS - 1);
}

/** A go made again from its plan by the shared pack, with its nests fixed by the seed. Null if the plan isn't one the pack could make. */
export function showGo(round: Pick<Round, 'seed'>, index: number, plan: GoPlan): Go | null {
  const m = /^ten(and|less):([1-9])$/.exec(plan.key);
  // A challenge saved before the split can still hold "tenand" with the minus ways, so those are made as they were.
  if (!m || ![0, 1, 2, 3].includes(plan.v) || !isLevel(plan.l) || (m[1] === 'less' && plan.v < 2)) return null;
  const n = Number(m[2]);
  const random = seeded((round.seed + 7919 * (index + 1)) % MAX_SEED);
  const q = pack.rebuild(plan.key, [n, m[1] === 'less' ? 3 - plan.v : plan.v], true, random);
  const answer = plan.v >= 2 ? n : 10 + n;
  if (!q || !q.choices || q.answer !== answer) return null;
  // The pack only vouches for the question and answer; the nests are the game's own, each tagged with its mistake.
  const wrongs = wrongNests(n, plan.v, random);
  if (wrongs.length !== NESTS - 1) return null;
  const choices = [answer, ...wrongs.map((w) => w.n)].sort((a, b) => a - b);
  return { ...plan, n, teen: 10 + n, answer, parts: q.parts, choices, wrongs };
}

/** Every go of a round as shown. Throws if a saved round has a go the pack can't make. */
export function showRound(round: Round): Go[] {
  return round.goes.map((plan, i) => {
    const go = showGo(round, i, plan);
    if (!go) throw new Error(`Go ${i} (${plan.key}) can't be made`);
    return go;
  });
}

/**
 * The picture for a go after some wrong taps (plan section 4, "Help inside one go"): the first wrong tap brings one
 * level more (at level 0 the kete picture; at level 1 the Peek opens), the second brings every berry counted in, and the
 * third fades the wrong nests to leave two. The answer is never shown.
 */
export function pictureFor(go: Pick<Go, 'l' | 'choices' | 'answer'>, wrongTaps: number, tapped: readonly number[] = []): {
  level: HelpLevel;
  peekOpen: boolean;
  /** The nests still to tap: after three wrong taps, the answer and one other. */
  nests: number[];
} {
  let level = go.l;
  let peekOpen = false;
  if (wrongTaps >= 2) level = TOP_LEVEL;
  else if (wrongTaps === 1) {
    if (go.l === 0) level = 3;
    else if (go.l === 1) peekOpen = true;
    else level = Math.min(TOP_LEVEL, go.l + 1) as HelpLevel;
  }
  let nests = go.choices;
  if (wrongTaps >= 3) {
    const other = go.choices.find((c) => c !== go.answer && !tapped.includes(c)) ?? go.choices.find((c) => c !== go.answer)!;
    nests = go.choices.filter((c) => c === go.answer || c === other);
  }
  return { level, peekOpen, nests };
}
