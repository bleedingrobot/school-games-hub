/**
 * One day's challenge at Lizard's Bundles (docs/LIZARD-PLAN.md): ten goes with sticks tied into bundles of ten (and ten
 * bundles into a raft of a hundred), each a number to build, read, tie, untie or make ten more or less. The facts are the
 * hub's shared tens-and-ones keys (`pvbuild:n47`, `pvread:n47`, `pvzero:n40`, `pvregroup:s47`, `pvten:+47`, `pvbuild3:n306`,
 * `pvhun:+347`... in shared/maths/skillPacks/earlyFacts.ts, ladder skills `bundles-50`, `place-value-100`, `regroup-100`,
 * `ten-more-less-100`, `place-value-1000`). The key says the number; the *kind* of go comes from the key's family.
 *
 * Two things move separately, both from the child's own challenges and both kept by the server:
 * - the **step**: 1 Bundles of ten, 2 Tens and ones to 50, 3 To 100 and zero, 4 Tie and untie, 5 Ten more, ten less,
 *   6 Hundreds, 7 All mixed. Passed after two good challenges (8 or more of 10 right at the first try). Never drops back.
 * - the **help level**: 5 a labelled mat with counts, down to 0 numbers only (see `pictureFor`).
 */
import { EARLY_FACTS } from '../maths/skillPacks/earlyFacts';
import type { FactStats } from '../maths/leitner';
import { seeded } from '../seededRandom';
import { sisterNumber } from '../kit/sister';
import { atMostShareTell, tagWrongs, type Wrong } from '../kit/mistakes';
import { placeAfter as kitPlaceAfter, helpWithSetting, ROUND_OF_TEN, type HelpSetting, type KindLevels, type Place as KitPlace } from '../kit/help';
import * as C from './config';

export { GOES_PER_ROUND, REVIEW_GOES, GOOD, HARD } from './config';
export type { HelpSetting } from '../kit/help';
export { HELP_SETTINGS } from '../kit/help';

// ---------------------------------------------------------------- steps, keys and kinds

export type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type HelpLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type Kind = 'build' | 'read' | 'bundle' | 'swap' | 'more';

export const STEPS: readonly { step: Step; name: string }[] = [
  { step: 1, name: 'Bundles of ten' },
  { step: 2, name: 'Tens and ones to 50' },
  { step: 3, name: 'To 100, and zero' },
  { step: 4, name: 'Tie and untie' },
  { step: 5, name: 'Ten more, ten less' },
  { step: 6, name: 'Hundreds' },
  { step: 7, name: 'All mixed' },
];
export const stepName = (step: Step) => STEPS[step - 1].name;

const familyKeys = (name: string): string[] => EARLY_FACTS.families[name].keys;
export const keyNumber = (key: string) => Number(/(\d+)$/.exec(key)![1]);
const upTo50 = (k: string) => keyNumber(k) <= 50;
const build = familyKeys('pvbuild');
const read = familyKeys('pvread');

/** The keys each step asks as its own. */
export const STEP_KEYS: Record<Step, string[]> = {
  1: build.filter((k) => k.includes(':t') && upTo50(k)),
  2: [...build, ...read].filter((k) => k.includes(':n') && upTo50(k)),
  3: [...build, ...read].filter((k) => !upTo50(k)).concat(familyKeys('pvzero')),
  4: familyKeys('pvregroup'),
  5: familyKeys('pvten'),
  6: [...familyKeys('pvbuild3'), ...familyKeys('pvread3')],
  7: familyKeys('pvhun'),
};
/** Every key the game can ask. */
export const KEYS: string[] = [...new Set(Object.values(STEP_KEYS).flat())];

/** The keys asked as a step's own: step 7 mixes the hundreds in with the hundred more and less. */
export const poolFor = (step: Step): string[] => (step === 7 ? [...STEP_KEYS[7], ...STEP_KEYS[6]] : STEP_KEYS[step]);

/** The kind of go a key is. */
export function kindOfKey(key: string): Kind | null {
  const fam = /^([a-z0-9]+):/.exec(key)?.[1];
  switch (fam) {
    case 'pvbuild': case 'pvbuild3': return 'build';
    case 'pvread': case 'pvread3': case 'pvzero': return 'read';
    case 'pvregroup': return key.includes(':b') ? 'bundle' : 'swap';
    case 'pvten': case 'pvhun': return 'more';
    default: return null;
  }
}

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
 * The place after a day's first finish with `right` goes right at the first try: the kit's rule (good challenges fade the help
 * and pass the step, a hard one brings help back, a new step brings help back up two unless it faded on that same go), then
 * the hundreds (a raft is new) always start with at least `NEW_THING_LEVEL`.
 */
export function placeAfter(p: Place, right: number): Place {
  const next = kitPlaceAfter(p, right, RULES);
  let level = next.level;
  if (next.step !== p.step && C.NEW_THING_STEPS.includes(next.step)) level = Math.max(level, C.NEW_THING_LEVEL);
  return { ...next, step: next.step as Step, level: level as HelpLevel };
}

/** A child who already knows Tūī's "ten and" facts starts further on (nothing else known: step 1, level 5). */
export function startFor(stats: Iterable<FactStats>): { step: Step; level: HelpLevel } {
  const secure = [...stats].filter((s) => s.box >= 2 && s.key.startsWith('tenand:')).length;
  if (secure >= C.TEN_AND_ALL) return { ...C.TEN_AND_ALL_START };
  if (secure >= C.TEN_AND_SOME) return { ...C.TEN_AND_SOME_START };
  return { step: 1, level: C.TOP_LEVEL };
}

export const MAX_SEED = 2147483647;
export const isSeed = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MAX_SEED;
export const isStep = (n: unknown): n is Step => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= C.TOP_STEP;
export const isLevel = (n: unknown): n is HelpLevel => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= C.TOP_LEVEL;

/** The level a go is shown at: Fades follows the child, Always keeps 4, Off is 0 (no Peek). */
export const shownLevel = (level: HelpLevel, help: HelpSetting): HelpLevel => helpWithSetting(level, help, { always: 4, off: 0 });

// ---------------------------------------------------------------- the round

/** The guided first go: tie ten sticks into one bundle (10). */
export const GUIDED_KEY = 'pvbuild:t10';

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

/**
 * Today's challenge from a fresh seed, the child's records, their place and the teacher's setting. Step 1 is ten goes on the five
 * tens (the weakest twice). From step 2 on, seven goes are today's step (weakest first) and three are from earlier steps.
 * The same inputs always give the same round.
 */
export function makeRound(
  seed: number,
  stats: Iterable<FactStats>,
  opts: { step?: Step; level?: HelpLevel; help?: HelpSetting; guided?: boolean; kindLevels?: KindLevels } = {},
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
    keys = [...all, ...shuffle(all, random)].slice(0, C.GOES_PER_ROUND);
  } else {
    const fresh = weakest(poolFor(step), box, random).slice(0, C.GOES_PER_ROUND - C.REVIEW_GOES);
    const earlierSteps = ([1, 2, 3, 4, 5, 6] as Step[]).filter((s) => s < (step === 7 ? 6 : step));
    const review = weakest(earlierSteps.flatMap((s) => STEP_KEYS[s]), box, random).slice(0, C.REVIEW_GOES);
    keys = shuffle([...fresh, ...review], random);
  }
  if (opts.guided) keys = [GUIDED_KEY, ...keys.filter((k) => k !== GUIDED_KEY)].slice(0, C.GOES_PER_ROUND);
  while (keys.length < C.GOES_PER_ROUND) keys.push(keys[keys.length % Math.max(1, keys.length)]);
  keys = spreadOut(keys);
  const shown = shownLevel(level, help);
  // Each kind of go has its own help level; a kind not in the map yet starts at the child's own level. The guided first go stays at the top.
  const levelOf = (kind: Kind): HelpLevel => {
    const own = opts.kindLevels?.[kind]?.level;
    return own === undefined || !isLevel(own) ? shown : shownLevel(own, help);
  };
  const goes = keys.map((key, i): GoPlan => {
    const kind = kindOfKey(key)!;
    return { key, kind, l: opts.guided && i === 0 ? (C.TOP_LEVEL as HelpLevel) : levelOf(kind) };
  });
  return { seed, step, level, help, goes };
}

// ---------------------------------------------------------------- a go as shown

/** Named slips behind the wrong cards (the teacher and the why-line use the names). */
export type Slip = 'reverse' | 'face' | 'zero' | 'ignore' | 'ones' | 'way' | 'join' | 'near';

/** Hundreds (rafts), tens (bundles) and ones (sticks) on the mat. */
export interface Mat {
  h: number;
  t: number;
  o: number;
}

/** A go as shown. */
export interface Go extends GoPlan {
  n: number;
  /**
   * What the child ends with, as one whole number: the card for read and more goes, the total built for a build go, and for
   * a bundle or swap go the bundles and sticks together as bundles x 100 + sticks (23 sticks tied: 2 bundles 3 sticks, 203).
   */
  answer: number;
  /** The mat at the start: empty for a build, loose sticks to tie, bundles to untie, or the picture to read. */
  from: Mat;
  /** Cards for read and more goes, smallest first. Empty for the other goes. */
  choices: number[];
  /** Why each wrong card is wrong. */
  wrongs: Wrong<Slip>[];
  /** The sign for a more goes: +1 or -1 (ten, or a hundred, more or less). */
  dir: 1 | -1;
  /** For a more go the size of the change: 10 or 100. */
  unit: 10 | 100;
}

export const matOf = (n: number): Mat => ({ h: Math.floor(n / 100), t: Math.floor(n / 10) % 10, o: n % 10 });
export const matValue = (m: Mat) => m.h * 100 + m.t * 10 + m.o;

/** Wrong cards for a read go or a more go: named slips first, then plain neighbours; at most two cards share the answer's last digit. */
function wrongCards(key: string, n: number, answer: number, dir: 1 | -1, random: () => number): Wrong<Slip>[] {
  const { h, t, o } = matOf(n);
  let slips: [number | null, Slip][];
  if (key.startsWith('pvzero:')) slips = [[t, 'ignore'], [100 * t, 'zero'], [11 * t, 'near']];
  else if (key.startsWith('pvread:')) slips = [[10 * o + t, 'reverse'], [t + o, 'face'], [100 * t + o, 'zero'], [n + 10, 'near'], [n - 10, 'near']];
  else if (key.startsWith('pvread3:') && n % 100 === 0) slips = [[h * 10, 'ignore'], [h * 1000, 'zero'], [h, 'ignore'], [h * 110, 'near']];
  else if (key.startsWith('pvread3:')) {
    slips = [[h * 100 + o * 10 + t, 'reverse'], [t === 0 ? h * 1000 + o : null, 'zero'], [t === 0 ? h * 10 + o : o === 0 ? h * 10 + t : null, 'ignore'], [n + 10, 'near'], [n - 10, 'near']];
  } else if (key.startsWith('pvten:')) slips = [[n + dir, 'ones'], [n - dir * 10, 'way'], [n < 100 ? n + 100 : null, 'join'], [answer + dir * 10, 'near']];
  else slips = [[n + dir * 10, 'ones'], [n - dir * 100, 'way'], [n + dir, 'ones'], [n + dir * 1000, 'join'], [answer + dir * 100, 'near']];
  const spare = [2, -2, 3, -3, 5, -5, 11, -11, 13, -13, 20, -20, 30, -30].map((d) => answer + d);
  const pool = [...slips, ...spare.map((x): [number, Slip] => [x, 'near'])];
  const ok = (x: number | null): x is number => x !== null && x >= 1 && x <= C.MAX_PICK && x !== answer;
  const kinds = new Map<number, Slip>();
  for (const [x, slip] of pool) if (ok(x) && !kinds.has(x)) kinds.set(x, slip);
  const order = [...kinds.keys()];
  // The named slips stay in order, the plain neighbours are shuffled so close seeds differ.
  const named = order.filter((x) => kinds.get(x) !== 'near' || slips.some(([s]) => s === x));
  const plain = shuffle(order.filter((x) => !named.includes(x)), random);
  const chosen: number[] = [];
  for (const x of [...named, ...plain]) {
    if (chosen.length === C.WRONG_CARDS) break;
    if (atMostShareTell(answer, [...chosen, x], (c) => c % 10, C.MAX_SHARE_TELL)) chosen.push(x);
  }
  return tagWrongs(chosen, (x) => kinds.get(x) ?? null);
}

/** A go made again from its plan, with its cards fixed by the seed. Null when the plan isn't one the game could make. */
export function showGo(round: Pick<Round, 'seed'>, index: number, plan: GoPlan): Go | null {
  return KEYS.includes(plan.key) ? makeGo(round, index, plan) : null;
}

/** A go from any key of a family (the sister of a go may be a number the game does not ask on its own). */
function makeGo(round: Pick<Round, 'seed'>, index: number, plan: GoPlan): Go | null {
  if (!isLevel(plan.l) || kindOfKey(plan.key) !== plan.kind) return null;
  const n = keyNumber(plan.key);
  const random = seeded((round.seed + 7919 * (index + 1)) % MAX_SEED);
  random(); random();
  const base = { ...plan, n, from: matOf(n), choices: [], wrongs: [] as Wrong<Slip>[], dir: 1 as const, unit: 10 as const, answer: n };
  if (plan.kind === 'build') return { ...base, from: { h: 0, t: 0, o: 0 } };
  const { t, o } = matOf(n);
  if (plan.kind === 'bundle') return { ...base, from: { h: 0, t: 0, o: n }, answer: t * 100 + o };
  if (plan.kind === 'swap') return { ...base, answer: (t - 1) * 100 + o + 10 };
  const dir = plan.key.includes('-') ? -1 : 1;
  const unit = plan.key.startsWith('pvhun:') ? 100 : 10;
  const answer = plan.kind === 'more' ? n + dir * unit : n;
  const wrongs = wrongCards(plan.key, n, answer, dir, random);
  if (wrongs.length < C.WRONG_CARDS) return null;
  const choices = [answer, ...wrongs.map((w) => w.n)].sort((a, b) => a - b);
  return { ...base, answer, dir, unit, choices, wrongs };
}

/** Same shape: the same number of digits, and a zero in the tens and in the ones place only where the other has one. */
export const sameShape = (a: number, b: number): boolean =>
  String(a).length === String(b).length && (Math.floor(a / 10) % 10 === 0) === (Math.floor(b / 10) % 10 === 0) && (a % 10 === 0) === (b % 10 === 0);

/**
 * The sister of a go, for "Now you try one like it": the same key family (so the same kind of go and picture) with its number moved
 * by 1 or 2, inside the family's own range and with the same shape (a round number stays out: no sister), built by `makeGo` so its
 * cards are its own. For card goes the sister avoids the original answer and cards where it can. Null when no number fits (every
 * tens-only, zero and round-number key): the screen then goes back to the same go. The sister is never sent or saved.
 */
export function sisterGo(round: Pick<Round, 'seed'>, index: number, go: Go): Go | null {
  const prefix = go.key.replace(/\d+$/, '');
  const nums = KEYS.filter((k) => k.startsWith(prefix)).map(keyNumber);
  if (nums.length < 2) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const avoid: number[] = [];
  for (let x = min; x <= max; x++) if (!sameShape(x, go.n)) avoid.push(x);
  const seen = new Set([go.answer, ...go.choices]);
  let loose: Go | null = null;
  for (let tries = 0; tries < 4; tries++) {
    const n = sisterNumber(go.n, (round.seed + 31 * (index + 1) + tries) % MAX_SEED, { min, max, avoid });
    if (n === null) break;
    const made = makeGo(round, index + C.GOES_PER_ROUND, { key: prefix + n, kind: go.kind, l: go.l });
    avoid.push(n);
    if (!made || made.answer === go.answer) continue;
    if (!made.choices.length || (!seen.has(made.answer) && made.choices.every((c) => c !== go.answer))) return made;
    loose ??= made;
  }
  return loose;
}

/** Every go of a round as shown. Throws if a saved round has a go the game can't make. */
export function showRound(round: Round): Go[] {
  return round.goes.map((plan, i) => {
    const go = showGo(round, i, plan);
    if (!go) throw new Error(`Go ${i} (${plan.key}) can't be made`);
    return go;
  });
}

// ---------------------------------------------------------------- what the mat shows

/**
 * The picture for a go at a help level, and after some wrong tries (plan, "Help that follows each child"):
 * - 5 a labelled mat, a count under each place, the counting voice;
 * - 4 the labelled mat and colours;
 * - 3 bundles and sticks only (colours stay);
 * - 2 bundles and sticks in plain colour;
 * - 1 numbers only, with a Peek that brings the bundles back;
 * - 0 numbers only (a wrong try brings the bundles back).
 * A wrong try puts help up one level for that go (at level 0 to 3, at level 1 the Peek opens), the second brings level 5, and the
 * third leaves only the nearest two cards. The answer is never shown.
 */
export interface Picture {
  level: HelpLevel;
  /** The bundles and sticks are drawn. */
  pictured: boolean;
  peekOpen: boolean;
  labels: boolean;
  counts: boolean;
  colours: boolean;
  choices: number[];
}

export function pictureFor(go: Pick<Go, 'l' | 'choices' | 'answer'>, wrongTries: number, tried: readonly number[] = [], struggling = false): Picture {
  let level = go.l;
  let peekOpen = false;
  if (wrongTries >= 2) level = C.TOP_LEVEL as HelpLevel;
  else if (wrongTries === 1) {
    if (go.l === 0) level = 3;
    else if (go.l === 1) peekOpen = true;
    else level = Math.min(C.TOP_LEVEL, go.l + 1) as HelpLevel;
  }
  // Three goes in a row with a wrong first try: the full picture for the rest of the round (last, so a wrong try can't lower it).
  if (struggling) {
    level = C.TOP_LEVEL as HelpLevel;
    peekOpen = false;
  }
  let choices = go.choices;
  if (wrongTries >= 3 && go.choices.length) {
    const other = go.choices.find((c) => c !== go.answer && !tried.includes(c)) ?? go.choices.find((c) => c !== go.answer)!;
    choices = go.choices.filter((c) => c === go.answer || c === other);
  }
  return { level, pictured: level >= 2 || peekOpen, peekOpen, labels: level >= 4, counts: level >= 5, colours: level >= 3, choices };
}
