/**
 * One day's challenge at Pigeon's Number Line (docs/PIGEON-PLAN.md): ten goes on a branch, each a number to place, read or
 * compare on a line from 0 to 100 (later 0 to 1000). The facts are the hub's shared number-line keys
 * (`place100:t30`, `read100:n63`, `tens100:+63`, `near10:h65`, `zoom:40-50:47`, `place1000:h300`... in
 * shared/maths/skillPacks/earlyFacts.ts, ladder skills `number-line-100`, `ten-more-less`, `number-line-1000`). The key says
 * the number and the line; the *kind* of go (place it, read it, ten more, nearest ten) comes from the key's family.
 *
 * Two things move separately, both from the child's own challenges and both kept by the server:
 * - the **step**: 1 Tens on the branch, 2 Read the arrow, 3 Place any number, 4 Ten more, ten less, 5 Which ten is closer,
 *   6 Zoom in, 7 The long branch. Passed after two good challenges (8 or more of 10 right at the first tap). Never drops back.
 * - the **help level**: 5 every number marked on the branch, down to 0 the two ends only (see `marksFor`).
 */
import { EARLY_FACTS } from '../maths/skillPacks/earlyFacts';
import type { FactStats } from '../maths/leitner';
import { seeded } from '../seededRandom';
import { atMostShareTell, tagWrongs, type Wrong } from '../kit/mistakes';
import { placeAfter as kitPlaceAfter, helpWithSetting, ROUND_OF_TEN, type HelpSetting, type Place as KitPlace } from '../kit/help';
import * as C from './config';

export { GOES_PER_ROUND, REVIEW_GOES, GOOD, HARD } from './config';
export type { HelpSetting } from '../kit/help';
export { HELP_SETTINGS } from '../kit/help';

// ---------------------------------------------------------------- steps, keys and kinds

export type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type HelpLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type Kind = 'place' | 'read' | 'tens' | 'near';

export const STEPS: readonly { step: Step; name: string }[] = [
  { step: 1, name: 'Tens on the branch' },
  { step: 2, name: 'Read the arrow' },
  { step: 3, name: 'Place any number' },
  { step: 4, name: 'Ten more, ten less' },
  { step: 5, name: 'Which ten is closer?' },
  { step: 6, name: 'Zoom in' },
  { step: 7, name: 'The long branch' },
];
export const stepName = (step: Step) => STEPS[step - 1].name;

const familyKeys = (name: string): string[] => EARLY_FACTS.families[name].keys;
const placeKeys = familyKeys('place100');
const nearKeys = familyKeys('near10');

/** The keys each step asks as its own (the halfway numbers of step 5 come later, see `poolFor`). */
export const STEP_KEYS: Record<Step, string[]> = {
  1: placeKeys.filter((k) => k.startsWith('place100:t')),
  2: familyKeys('read100'),
  3: placeKeys.filter((k) => k.startsWith('place100:n')),
  4: familyKeys('tens100'),
  5: nearKeys,
  6: familyKeys('zoom'),
  7: [...familyKeys('place1000'), ...familyKeys('read1000'), ...familyKeys('near100')],
};
/** Every key the game can ask. */
export const KEYS: string[] = [...new Set(Object.values(STEP_KEYS).flat())];

export const isHalfway = (key: string) => /:h\d+$/.test(key) && key.startsWith('near');
const isTensTarget = (key: string) => /^place(100|1000):[th]\d+$/.test(key);

/** The step-5 keys asked now: the halfway numbers (65) come once most of the others are secure. */
export function poolFor(step: Step, box: ReadonlyMap<string, number>): string[] {
  if (step !== 5) return STEP_KEYS[step];
  const others = nearKeys.filter((k) => !isHalfway(k));
  const secure = others.filter((k) => (box.get(k) ?? 0) >= 2).length / others.length;
  return secure >= C.HALFWAY_UNLOCK_SHARE ? nearKeys : others;
}

/** The kind of go a key is. Zoom keys are placed or read, by the round (see `GoPlan.kind`). */
export function kindOfKey(key: string): Kind | 'zoom' | null {
  const fam = /^([a-z0-9]+):/.exec(key)?.[1];
  switch (fam) {
    case 'place100': case 'place1000': return 'place';
    case 'read100': case 'read1000': return 'read';
    case 'tens100': return 'tens';
    case 'near10': case 'near100': return 'near';
    case 'zoom': return 'zoom';
    default: return null;
  }
}

export const keyNumber = (key: string) => Number(/(\d+)$/.exec(key)![1]);
export const keyLine = (key: string) => (key.includes('1000') || key.startsWith('near100:') ? C.MAX_NUMBER : 100);

// ---------------------------------------------------------------- places and starting points

/** Where a child is: step, help level and good challenges counted towards the next change. */
export type Place = KitPlace & { step: Step; level: HelpLevel };

const RULES = {
  ...ROUND_OF_TEN,
  topLevel: C.TOP_LEVEL,
  goodToPass: C.GOOD_TO_PASS,
  topStep: C.TOP_STEP,
  newStepHelp: C.NEW_STEP_HELP,
  newStepLevel: 0,
} as const;

/**
 * The place after a day's first finish with `right` goes right at the first tap: the kit's rule (good challenges fade the help
 * and pass the step, a hard one brings help back, a new step brings help back up two unless it faded on that same go), then a
 * new line length (the zoom, the long branch) always starts with at least `NEW_LINE_LEVEL`.
 */
export function placeAfter(p: Place, right: number): Place {
  const next = kitPlaceAfter(p, right, RULES);
  let level = next.level;
  if (next.step !== p.step && C.NEW_LINE_STEPS.includes(next.step)) level = Math.max(level, C.NEW_LINE_LEVEL);
  return { ...next, step: next.step as Step, level: level as HelpLevel };
}

/** A child who already knows most of Ruru's one more and one less, or the ten-and facts, when they first play starts further on. */
export function startFor(stats: Iterable<FactStats>): { step: Step; level: HelpLevel } {
  const box = new Map([...stats].map((s) => [s.key, s.box]));
  const secure = (prefixes: string[]) => [...box].filter(([k, b]) => b >= 2 && prefixes.some((p) => k.startsWith(p))).length;
  if (secure(['more1:', 'less1:']) >= C.RURU_KEYS_NEEDED) return { ...C.RURU_START };
  if (secure(['tenand:']) >= C.TEN_AND_KNOWN) return { ...C.TEN_AND_START };
  return { step: 1, level: C.TOP_LEVEL };
}

export const MAX_SEED = 2147483647;
export const isSeed = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MAX_SEED;
export const isStep = (n: unknown): n is Step => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= C.TOP_STEP;
export const isLevel = (n: unknown): n is HelpLevel => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= C.TOP_LEVEL;

/** The level a go is shown at: Fades follows the child, Always keeps 4, Off is 0 (no Peek). */
export const shownLevel = (level: HelpLevel, help: HelpSetting): HelpLevel => helpWithSetting(level, help, { always: 4, off: 0 });

// ---------------------------------------------------------------- the round

/** The guided first go (plan section 6): 50 on the 100 line, every number marked. */
export const GUIDED_KEY = 'place100:t50';

/** One go as saved: the key, what the child does with it and the help level it is shown at. */
export interface GoPlan {
  key: string;
  kind: Kind;
  l: HelpLevel;
}

/** What the server saves when a challenge starts, and the browser is sent. */
export interface Round {
  seed: number;
  step: Step;
  /** The child's own help level when the challenge started (the goes may be shown at another, by the teacher's setting). */
  level: HelpLevel;
  help: HelpSetting;
  goes: GoPlan[];
}

const shuffle = <T>(items: readonly T[], random: () => number): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** The weakest first (lowest box), ties in the shuffled order. */
const weakest = (keys: readonly string[], box: ReadonlyMap<string, number>, random: () => number): string[] =>
  shuffle(keys, random)
    .map((k, i) => ({ k, i }))
    .sort((a, b) => (box.get(a.k) ?? 0) - (box.get(b.k) ?? 0) || a.i - b.i)
    .map((x) => x.k);

/** The same key never comes twice in a row: a repeat swaps with a later go where it fits. */
function spreadOut(keys: string[]): string[] {
  const out = [...keys];
  for (let i = 1; i < out.length; i++) {
    if (out[i] !== out[i - 1]) continue;
    const at = out.findIndex((k, x) => x > i && k !== out[i] && out[x - 1] !== out[i] && out[x + 1] !== out[i]);
    if (at !== -1) [out[i], out[at]] = [out[at], out[i]];
  }
  return out;
}

/** What a go on this key is. Zoom keys alternate: an odd number is placed, an even one read. */
export function kindFor(key: string): Kind {
  const k = kindOfKey(key);
  if (k === 'zoom') return keyNumber(key) % 2 === 1 ? 'place' : 'read';
  return k as Kind;
}

/**
 * Today's challenge from a fresh seed, the child's records, their place and the teacher's setting. Step 1 is ten goes on the nine
 * tens (the weakest twice). From step 2 on, seven goes are today's step (weakest first) and three are from earlier steps.
 * The same inputs always give the same round.
 */
export function makeRound(
  seed: number,
  stats: Iterable<FactStats>,
  opts: { step?: Step; level?: HelpLevel; help?: HelpSetting; guided?: boolean } = {},
): Round {
  if (!isSeed(seed)) throw new RangeError(`Bad seed ${seed}`);
  const step = opts.step ?? 1;
  const level = opts.level ?? C.TOP_LEVEL;
  const help = opts.help ?? 'fade';
  const random = seeded(seed);
  random(); random();
  const box = new Map([...stats].map((s) => [s.key, s.box]));
  let keys: string[];
  if (step === 1) {
    const all = weakest(STEP_KEYS[1], box, random);
    keys = [...all, all[0]];
  } else {
    const fresh = weakest(poolFor(step, box), box, random).slice(0, C.GOES_PER_ROUND - C.REVIEW_GOES);
    const earlier = STEP_KEYS[1].concat(...([2, 3, 4, 5, 6] as Step[]).filter((s) => s < step).map((s) => poolFor(s, box)));
    const review = weakest(earlier, box, random).slice(0, C.REVIEW_GOES);
    keys = shuffle([...fresh, ...review], random);
  }
  if (opts.guided) keys = [GUIDED_KEY, ...keys.filter((k) => k !== GUIDED_KEY)].slice(0, C.GOES_PER_ROUND);
  while (keys.length < C.GOES_PER_ROUND) keys.push(keys[keys.length % Math.max(1, keys.length)]);
  keys = spreadOut(keys);
  const shown = shownLevel(level, help);
  const goes = keys.map((key, i): GoPlan => ({ key, kind: kindFor(key), l: opts.guided && i === 0 ? C.TOP_LEVEL as HelpLevel : shown }));
  return { seed, step, level, help, goes };
}

// ---------------------------------------------------------------- a go as shown

/** Named slips behind the wrong cards (the teacher and the why-line use the names). */
export type Slip = 'reverse' | 'ten' | 'one' | 'mirror' | 'near';

/** A go as shown. */
export interface Go extends GoPlan {
  n: number;
  /** The number the child ends with: the one placed, read, or the ten more or less, or the nearest post. */
  answer: number;
  /** The line the child taps or reads: its ends. A zoom go taps the lens. */
  lo: number;
  hi: number;
  /** The main line's end (100 or 1000) and, on a zoom go, the lens inside it. */
  max: number;
  lens: { lo: number; hi: number } | null;
  /** The distance from the number, in the line's units, a tap may be off and still be right (place goes). */
  tol: number;
  /** Cards for read, ten more or less, and nearest goes, smallest first. Empty for place. */
  choices: number[];
  /** Why each wrong card is wrong. */
  wrongs: Wrong<Slip>[];
  /** The two posts of a nearest go (lower, higher). */
  posts: [number, number] | null;
  /** The sign for a ten more or less go: +10 or -10. */
  step10: number;
  /** The shared pack's name for the question, as its key says. */
  tens: boolean;
}

const reverse = (n: number) => (n >= 10 && n < 100 && n % 10 !== 0 ? Number(String(n).split('').reverse().join('')) : null);

/** Wrong cards for a read go or a ten more or less go: named slips first, then plain neighbours; at most two cards share the answer's last digit. */
function wrongCards(answer: number, n: number, kind: Kind, max: number, random: () => number): Wrong<Slip>[] {
  const s1 = max === C.MAX_NUMBER ? 10 : 1;
  const s10 = max === C.MAX_NUMBER ? 100 : 10;
  const slips: [number | null, Slip][] =
    kind === 'tens'
      ? [[answer + (answer > n ? -2 * s10 : 2 * s10), 'ten'], [answer + s1, 'one'], [answer - s1, 'one'], [n + (answer > n ? -s10 : s10), 'mirror'], [n + (answer > n ? s10 : -s10) + s1, 'one']]
      : [[reverse(answer), 'reverse'], [answer + s10, 'ten'], [answer - s10, 'ten'], [max - answer, 'mirror'], [answer + s1, 'one'], [answer - s1, 'one']];
  const spare = [2, -2, 3, -3, 5, -5, 11, -11, 20, -20].map((d) => answer + d * s1);
  const pool = [...slips, ...spare.map((x): [number, Slip] => [x, 'one'])];
  const ok = (x: number | null): x is number => x !== null && x >= 1 && x <= max && x !== answer;
  const kinds = new Map<number, Slip>();
  for (const [x, slip] of pool) if (ok(x) && !kinds.has(x)) kinds.set(x, slip);
  const order = [...kinds.keys()];
  // The first slips stay in order, the plain neighbours are shuffled so close seeds differ.
  const named = order.slice(0, slips.length);
  const plain = shuffle(order.slice(slips.length), random);
  const chosen: number[] = [];
  // The tell is the last digit; on the long branch every number ends in 0, so it is the tens digit.
  const tell = (x: number) => (max >= C.MAX_NUMBER ? Math.floor(x / 10) % 10 : x % 10);
  for (const x of [...named, ...plain]) {
    if (chosen.length === C.WRONG_CARDS) break;
    if (atMostShareTell(answer, [...chosen, x], tell, C.MAX_SHARE_TELL)) chosen.push(x);
  }
  return tagWrongs(chosen, (x) => kinds.get(x) ?? null);
}

/** How far a tap may be from the number: a twentieth of the line (a thirtieth for a ten or hundred), 2 on a lens ten wide. */
export function toleranceOf(key: string, lo: number, hi: number, lens: boolean): number {
  const width = hi - lo;
  if (lens && width <= C.NARROW_LENS) return C.NARROW_TOLERANCE;
  return Math.floor(width / (isTensTarget(key) ? C.TARGET_DIVISOR : C.PLACE_DIVISOR));
}

/** A go made again from its plan, with its cards fixed by the seed. Null when the plan isn't one the game could make. */
export function showGo(round: Pick<Round, 'seed'>, index: number, plan: GoPlan): Go | null {
  if (!KEYS.includes(plan.key) || !isLevel(plan.l)) return null;
  const fam = kindOfKey(plan.key)!;
  if (kindFor(plan.key) !== plan.kind && !(fam === 'zoom' && ['place', 'read'].includes(plan.kind))) return null;
  const n = keyNumber(plan.key);
  const random = seeded((round.seed + 7919 * (index + 1)) % MAX_SEED);
  random(); random();
  const max = keyLine(plan.key);
  let lens: Go['lens'] = null;
  let lo = 0;
  let hi = max;
  if (fam === 'zoom') {
    const m = /zoom:(\d+)-(\d+):/.exec(plan.key)!;
    lens = { lo: Number(m[1]), hi: Number(m[2]) };
    ({ lo, hi } = lens);
  }
  const base = { ...plan, n, lo, hi, max, lens, tens: isTensTarget(plan.key), step10: 0, posts: null, choices: [], wrongs: [] as Wrong<Slip>[], tol: 0, answer: n };
  if (plan.kind === 'place') return { ...base, tol: toleranceOf(plan.key, lo, hi, lens !== null) };
  if (plan.kind === 'near') {
    const size = max === C.MAX_NUMBER ? 100 : 10;
    const low = Math.floor(n / size) * size;
    const posts: [number, number] = [low, low + size];
    const answer = n - low >= size / 2 ? posts[1] : posts[0];
    return { ...base, answer, posts, choices: posts, wrongs: [{ n: answer === posts[0] ? posts[1] : posts[0], kind: 'near' }] };
  }
  const answer = plan.kind === 'tens' ? n + (plan.key.includes('+') ? 10 : -10) : n;
  const step10 = plan.kind === 'tens' ? (plan.key.includes('+') ? 10 : -10) : 0;
  const wrongs = wrongCards(answer, n, plan.kind, Math.max(max, answer), random);
  if (wrongs.length < C.WRONG_CARDS) return null;
  const choices = [answer, ...wrongs.map((w) => w.n)].sort((a, b) => a - b);
  return { ...base, answer, step10, choices, wrongs };
}

/** Every go of a round as shown. Throws if a saved round has a go the game can't make. */
export function showRound(round: Round): Go[] {
  return round.goes.map((plan, i) => {
    const go = showGo(round, i, plan);
    if (!go) throw new Error(`Go ${i} (${plan.key}) can't be made`);
    return go;
  });
}

/** Where a tap on `permille` (0 to 1000 along the go's line) lands as a number. */
export const tapValue = (go: Pick<Go, 'lo' | 'hi'>, permille: number) => go.lo + ((go.hi - go.lo) * permille) / C.TAP_SCALE;

/** True when a place tap is within the go's tolerance of the number. */
export const placeRight = (go: Pick<Go, 'n' | 'lo' | 'hi' | 'tol'>, permille: number): boolean =>
  Math.abs(permille * (go.hi - go.lo) - (go.n - go.lo) * C.TAP_SCALE) <= go.tol * C.TAP_SCALE;

// ---------------------------------------------------------------- what the branch shows

/**
 * The numbers marked on a line at a help level (plan section 4): 5 every ten named with a small mark for every one (every hundred
 * named on the long branch, a mark for every ten), 4 every ten named, 3 the tens as small marks with the middle and the ends
 * named, 2 the middle and the ends named, 1 and 0 the two ends only.
 * `ticks` are unnamed marks; `named` carry a number.
 */
export function marksFor(level: HelpLevel, lo: number, hi: number): { named: number[]; ticks: number[] } {
  const width = hi - lo;
  // Ten spaces on a long line (100 or 1000), a space a whole number wide on a short lens, ten spaces on a lens in between.
  const unit = width >= 500 ? 100 : width <= 10 ? 1 : width <= 100 ? 10 : width / 10;
  const every = (step: number) => Array.from({ length: Math.round(width / step) + 1 }, (_, i) => lo + i * step);
  const ends = [lo, hi];
  const mid = [lo, lo + width / 2, hi];
  if (level >= 5) return { named: every(unit), ticks: unit >= 10 ? every(unit / 10) : [] };
  if (level === 4) return { named: every(unit), ticks: [] };
  if (level === 3) return { named: mid, ticks: every(unit) };
  if (level === 2) return { named: mid, ticks: [] };
  return { named: ends, ticks: [] };
}

/**
 * The picture for a go after some wrong taps (plan section 4, "Help inside one go"): the first wrong tap brings one level more
 * (at level 0, level 3; at level 1 the Peek opens), the second brings every number marked, and the third leaves only the nearest
 * cards, or for a place go a band round the number. The answer is never shown.
 */
export function pictureFor(go: Pick<Go, 'l' | 'choices' | 'answer' | 'kind' | 'n' | 'lo' | 'hi' | 'max'>, wrongTaps: number, tapped: readonly number[] = []): {
  level: HelpLevel;
  peekOpen: boolean;
  choices: number[];
  /** A place go after three wrong taps: the stretch of line (a ten or a hundred wide) the number is in. */
  band: [number, number] | null;
} {
  let level = go.l;
  let peekOpen = false;
  if (wrongTaps >= 2) level = C.TOP_LEVEL as HelpLevel;
  else if (wrongTaps === 1) {
    if (go.l === 0) level = 3;
    else if (go.l === 1) peekOpen = true;
    else level = Math.min(C.TOP_LEVEL, go.l + 1) as HelpLevel;
  }
  let choices = go.choices;
  if (wrongTaps >= 3 && go.kind !== 'place' && go.kind !== 'near') {
    const other = go.choices.find((c) => c !== go.answer && !tapped.includes(c)) ?? go.choices.find((c) => c !== go.answer)!;
    choices = go.choices.filter((c) => c === go.answer || c === other);
  }
  let band: [number, number] | null = null;
  if (wrongTaps >= 3 && go.kind === 'place') {
    const size = go.hi - go.lo <= 10 ? 5 : go.max === C.MAX_NUMBER && go.hi - go.lo > 200 ? 100 : 10;
    const low = Math.max(go.lo, Math.min(go.hi - size, Math.floor(go.n / size) * size));
    band = [low, low + size];
  }
  return { level, peekOpen, choices, band };
}
