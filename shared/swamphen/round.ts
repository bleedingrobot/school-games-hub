/**
 * One day's challenge at Swamp Hen's Reed Rows (docs/SWAMPHEN-PLAN.md): ten goes in the reed garden, each an array of shoots in
 * neat rows. The facts are the hub's shared equal-rows keys (`rows:4x6`, `turn:3x5`, `share:24/4`, `cut:6x7`, `which:3x5` in
 * shared/maths/skillPacks/earlyFacts.ts, ladder skills `equal-rows`, `arrays-turn`, `sharing-rows`, `cut-arrays`); every go that
 * is a times fact also records the plain times-table key (`mul:4x6`). The key says the numbers; the *kind* of go (plant it, under
 * the mat, turn it, which garden, share it, cut it, one row short) comes from the key and its step.
 *
 * Two things move separately, both from the child's own challenges and both kept by the server:
 * - the **step**: 1 Equal rows, 2 Turn the garden, 3 Under the mat, 4 Share them out, 5 Cut the garden, 6 One row short.
 *   Passed after two good challenges (8 or more of 10 right at the first tap). Never drops back.
 * - the **help level**: 5 every row a shade with the running total, down to 0 the sum only (see `viewFor`).
 */
import { EARLY_FACTS } from '../maths/skillPacks/earlyFacts';
import { factKey } from '../maths/facts';
import type { FactStats } from '../maths/leitner';
import { seeded } from '../seededRandom';
import { atMostShareTell, tagWrongs, type Wrong } from '../kit/mistakes';
import { fadeByKind, placeAfter as kitPlaceAfter, helpWithSetting, ROUND_OF_TEN, type HelpSetting, type KindLevels, type Place as KitPlace } from '../kit/help';
import * as C from './config';

export { GOES_PER_ROUND, REVIEW_GOES, GOOD, HARD } from './config';
export type { HelpSetting } from '../kit/help';
export { HELP_SETTINGS } from '../kit/help';

// ---------------------------------------------------------------- steps, keys and kinds

export type Step = 1 | 2 | 3 | 4 | 5 | 6;
export type HelpLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type Kind = 'plant' | 'mat' | 'turn' | 'which' | 'share' | 'cut' | 'short';
/** Every kind of go, for the kinds a child has seen (the server accepts only these). */
export const KINDS: readonly Kind[] = ['plant', 'mat', 'turn', 'which', 'share', 'cut', 'short'];

export const STEPS: readonly { step: Step; name: string }[] = [
  { step: 1, name: 'Equal rows' },
  { step: 2, name: 'Turn the garden' },
  { step: 3, name: 'Under the mat' },
  { step: 4, name: 'Share them out' },
  { step: 5, name: 'Cut the garden' },
  { step: 6, name: 'One row short' },
];
export const stepName = (step: Step) => STEPS[step - 1].name;

const familyKeys = (name: string): string[] => EARLY_FACTS.families[name].keys;
const rowsKeys = familyKeys('rows');
const cutKeys = familyKeys('cut');

/** The two numbers in a key ("rows:4x6" gives 4 and 6, "share:24/4" gives 24 and 4). */
export const keyPair = (key: string): [number, number] => {
  const m = /(\d+)[x/](\d+)$/.exec(key)!;
  return [Number(m[1]), Number(m[2])];
};

const stepOneRows = (key: string) => C.STEP_ONE_ROW_SIZES.includes(keyPair(key)[1]);

/** The keys each step asks as its own. */
export const STEP_KEYS: Record<Step, string[]> = {
  1: rowsKeys.filter(stepOneRows),
  2: [...familyKeys('turn'), ...familyKeys('which')],
  3: rowsKeys.filter((k) => !stepOneRows(k)),
  4: familyKeys('share'),
  5: cutKeys.filter((k) => keyPair(k)[0] < 9),
  6: cutKeys.filter((k) => keyPair(k)[0] === 9),
};
/** Every key the game can ask. */
export const KEYS: string[] = [...new Set(Object.values(STEP_KEYS).flat())];

/** The level a kind of go is at: its own, or (not in the map yet) the child's. */
const kindLevel = (kindLevels: KindLevels | undefined, kind: Kind, level: HelpLevel): HelpLevel => {
  const own = kindLevels?.[kind]?.level;
  return isLevel(own) ? own : level;
};

/** The kind of go a key is. */
export function kindOfKey(key: string): Kind | null {
  switch (/^([a-z]+):/.exec(key)?.[1]) {
    case 'rows': return stepOneRows(key) ? 'plant' : 'mat';
    case 'turn': return 'turn';
    case 'which': return 'which';
    case 'share': return 'share';
    case 'cut': return keyPair(key)[0] === 9 ? 'short' : 'cut';
    default: return null;
  }
}

/** The plain times-table key a go also records, or null for sharing and turning (neither states a total to find). */
export function mulKeyOf(key: string): string | null {
  if (key.startsWith('share:') || key.startsWith('turn:')) return null;
  const [a, b] = keyPair(key);
  return factKey(a, b);
}

export type { KindLevels };

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

/** The help level of each kind of go after a day's first finish: the kit's rule with the round of ten (a new kind starts at the child's level). */
export function kindLevelsAfter(kindLevels: KindLevels, goes: readonly { kind: string; right: boolean }[], level: number): KindLevels {
  return fadeByKind(kindLevels, goes, RULES, level);
}

/** The place after a day's first finish with `right` goes right at the first tap: the kit's rule. */
export function placeAfter(p: Place, right: number): Place {
  const next = kitPlaceAfter(p, right, RULES);
  return { ...next, step: next.step as Step, level: next.level as HelpLevel };
}

const secureShare = (keys: string[], box: ReadonlyMap<string, number>) => (keys.length ? keys.filter((k) => (box.get(k) ?? 0) >= 2).length / keys.length : 0);
const tableKeys = (tables: number[]) => tables.flatMap((t) => Array.from({ length: 13 - t }, (_, i) => factKey(t, t + i)));

/**
 * A child who already knows the times tables (most of the 2 to 5 times facts secure) when they first play starts at step 5,
 * level 2; one who has most of Hop's counting in fives and tens starts at step 2; everyone else at step 1, level 5.
 */
export function startFor(stats: Iterable<FactStats>): { step: Step; level: HelpLevel } {
  const box = new Map([...stats].map((s) => [s.key, s.box]));
  if (secureShare(tableKeys([2, 3, 4, 5]), box) >= C.TABLES_SECURE) return { ...C.TABLES_START };
  const skip = (name: string) => secureShare(familyKeys(name), box) >= C.SKIP_SECURE;
  if (skip('skip5') && skip('skip10')) return { ...C.SKIP_START };
  return { step: 1, level: C.TOP_LEVEL };
}

export const MAX_SEED = 2147483647;
export const isSeed = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MAX_SEED;
export const isStep = (n: unknown): n is Step => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= C.TOP_STEP;
export const isLevel = (n: unknown): n is HelpLevel => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= C.TOP_LEVEL;

/** The level a go is shown at: Fades follows the child, Always keeps 4, Off is 0 (no Peek). */
export const shownLevel = (level: HelpLevel, help: HelpSetting): HelpLevel => helpWithSetting(level, help, { always: 4, off: 0 });

// ---------------------------------------------------------------- the round

/** The guided first go: 2 rows of 2, every row shaded and counted. It cannot fail: the right card is the only one that fits. */
export const GUIDED_KEY = 'rows:2x2';

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
 * Today's challenge from a fresh seed, the child's records, their place and the teacher's setting. Step 1 is ten goes from the
 * twelve first rows (the weakest first). From step 2 on, seven goes are today's step (weakest first) and three are from earlier
 * steps (weakest first). The same inputs always give the same round.
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
  if (step === 1) keys = weakest(STEP_KEYS[1], box, random).slice(0, C.GOES_PER_ROUND);
  else {
    const fresh = weakest(STEP_KEYS[step], box, random).slice(0, C.GOES_PER_ROUND - C.REVIEW_GOES);
    const earlier = ([1, 2, 3, 4, 5] as Step[]).filter((s) => s < step).flatMap((s) => STEP_KEYS[s]);
    const review = weakest(earlier, box, random).slice(0, C.REVIEW_GOES);
    keys = shuffle([...fresh, ...review], random);
  }
  if (opts.guided) keys = [GUIDED_KEY, ...keys.filter((k) => k !== GUIDED_KEY)].slice(0, C.GOES_PER_ROUND);
  while (keys.length < C.GOES_PER_ROUND) keys.push(keys[keys.length % Math.max(1, keys.length)]);
  keys = spreadOut(keys);
  const goes = keys.map((key, i): GoPlan => ({ key, kind: kindOfKey(key)!, l: opts.guided && i === 0 ? (C.TOP_LEVEL as HelpLevel) : shownLevel(kindLevel(opts.kindLevels, kindOfKey(key)!, level), help) }));
  return { seed, step, level, help, goes };
}

// ---------------------------------------------------------------- a go as shown

/** Named slips behind the wrong cards (the teacher and the why-line use the names). */
export type Slip = 'added' | 'joined' | 'short' | 'spare' | 'forgot' | 'minus' | 'rows' | 'turned' | 'unturned' | 'scatter' | 'near';

/** A go as shown. */
export interface Go extends GoPlan {
  /** Rows and shoots in a row of the garden the go is about (for sharing: the rows, and the shoots in each). */
  rows: number;
  cols: number;
  /** The shoots altogether when the garden is whole. */
  total: number;
  /** The card that is right: the total, the shoots in a row (sharing) or a picture's code (which garden, turned garden). */
  answer: number;
  /** Cards, smallest first (the pictures of a which-garden go are in a fixed shuffled order). */
  choices: number[];
  /** Why each wrong card is wrong. */
  wrongs: Wrong<Slip>[];
}

/** True when every lane has the same, non-zero number of shoots: the shares are fair. */
export const fairShare = (lanes: readonly number[]): boolean => lanes.length > 0 && lanes[0] > 0 && lanes.every((n) => n === lanes[0]);

/** A which-garden card: its rows times 100 plus its shoots in a row, or (no rows) a scatter of that many shoots. */
export const pictureCode = (rows: number, cols: number) => rows * C.CODE + cols;
export const pictureOf = (code: number) => (code < C.CODE ? { rows: 0, cols: code } : { rows: Math.floor(code / C.CODE), cols: code % C.CODE });

/** Named wrong candidates for a go, best first; the plain neighbours follow in `wrongCards`. */
function candidates(kind: Kind, a: number, b: number, answer: number): [number, Slip][] {
  switch (kind) {
    case 'share': return [[a - b, 'minus'], [a + b, 'added'], [b, 'rows'], [answer + b, 'spare']];
    case 'cut': return [[(a - 1) * b, 'forgot'], [a + b, 'added'], [a * b + a, 'spare'], [a * b + b, 'spare']];
    case 'short': return [[10 * b, 'forgot'], [(a - 1) * b, 'short'], [a + b, 'added'], [10 * b - a, 'spare']];
    default: {
      // The two digits stuck together (37 for 3 and 7) only when it looks like the answer (the same number of digits), and after the other slips, so it rarely makes the four.
      const joined = Number(`${a}${b}`);
      const same = String(joined).length === String(answer).length;
      return [[a + b, 'added'], [(a - 1) * b, 'short'], [a * b + a, 'spare'], [a * b + b, 'spare'], ...(same ? [[joined, 'joined'] as [number, Slip]] : [])];
    }
  }
}

/** Wrong cards for a number go: named slips first, then plain neighbours; at most two cards share the answer's last digit. */
function wrongCards(kind: Kind, a: number, b: number, answer: number, random: () => number): Wrong<Slip>[] {
  const named = candidates(kind, a, b, answer);
  const plain = shuffle([1, -1, 2, -2, 3, -3, 10, -10].map((d) => answer + d), random).map((x): [number, Slip] => [x, 'near']);
  const kinds = new Map<number, Slip>();
  for (const [x, slip] of [...named, ...plain]) if (x >= 1 && x !== answer && !kinds.has(x)) kinds.set(x, slip);
  const chosen: number[] = [];
  for (const x of kinds.keys()) {
    if (chosen.length === C.WRONG_CARDS) break;
    if (atMostShareTell(answer, [...chosen, x], (n) => n % 10, C.MAX_SHARE_TELL)) chosen.push(x);
  }
  return tagWrongs(chosen, (x) => kinds.get(x) ?? null);
}

/** A go made again from its plan, with its cards fixed by the seed. Null when the plan isn't one the game could make. */
export function showGo(round: Pick<Round, 'seed'>, index: number, plan: GoPlan): Go | null {
  if (!KEYS.includes(plan.key) || !isLevel(plan.l) || kindOfKey(plan.key) !== plan.kind) return null;
  const [a, b] = keyPair(plan.key);
  const random = seeded((round.seed + 7919 * (index + 1)) % MAX_SEED);
  random(); random();
  if (plan.kind === 'share') {
    const answer = a / b;
    const wrongs = wrongCards('share', a, b, answer, random);
    if (wrongs.length < C.WRONG_CARDS) return null;
    return { ...plan, rows: b, cols: answer, total: a, answer, wrongs, choices: [answer, ...wrongs.map((w) => w.n)].sort((x, y) => x - y) };
  }
  const total = a * b;
  if (plan.kind === 'turn') {
    // The garden is R rows of C; turned it is C rows of R. The child picks that picture.
    const answer = pictureCode(b, a);
    const wrongs: Wrong<Slip>[] = [{ n: pictureCode(a, b), kind: 'unturned' }, { n: pictureCode(1, a + b), kind: 'added' }, { n: total, kind: 'scatter' }];
    return { ...plan, rows: a, cols: b, total, answer, wrongs, choices: shuffle([answer, ...wrongs.map((w) => w.n)], random) };
  }
  if (plan.kind === 'which') {
    const answer = pictureCode(a, b);
    const wrongs: Wrong<Slip>[] = [{ n: pictureCode(b, a), kind: 'turned' }, { n: pictureCode(1, a + b), kind: 'added' }, { n: total, kind: 'scatter' }];
    return { ...plan, rows: a, cols: b, total, answer, wrongs, choices: shuffle([answer, ...wrongs.map((w) => w.n)], random) };
  }
  const wrongs = wrongCards(plan.kind, a, b, total, random);
  if (wrongs.length < C.WRONG_CARDS) return null;
  return { ...plan, rows: a, cols: b, total, answer: total, wrongs, choices: [total, ...wrongs.map((w) => w.n)].sort((x, y) => x - y) };
}

/** Every go of a round as shown. Throws if a saved round has a go the game can't make. */
export function showRound(round: Round): Go[] {
  return round.goes.map((plan, i) => {
    const go = showGo(round, i, plan);
    if (!go) throw new Error(`Go ${i} (${plan.key}) can't be made`);
    return go;
  });
}

// ---------------------------------------------------------------- what the garden shows

/** What the picture shows at a help level (plan section 3): the rows shaded with the total counted, the rows alone, rows as bars, only the edges, the sum with a Peek, the sum alone. */
export type View = 'count' | 'rows' | 'bars' | 'edges' | 'peek' | 'plain';
export const viewFor = (level: HelpLevel): View => (['plain', 'peek', 'edges', 'bars', 'rows', 'count'] as const)[level];

/**
 * The picture for a go after some wrong taps (the kit's "help inside one go"): the first wrong tap brings one level more (at
 * level 0, level 3; at level 1 the Peek opens), the second brings the full picture, and from the third only the right card and
 * one wrong card are left. The answer is never shown. When the child is struggling (see the kit's STRUGGLE_GOES) it is always the full picture.
 */
export function pictureFor(go: Pick<Go, 'l' | 'choices' | 'answer'>, wrongTaps: number, tapped: readonly number[] = [], struggling = false): { level: HelpLevel; peekOpen: boolean; choices: number[] } {
  let level = go.l;
  let peekOpen = false;
  if (wrongTaps >= 2) level = C.TOP_LEVEL as HelpLevel;
  else if (wrongTaps === 1) {
    if (go.l === 0) level = 3;
    else if (go.l === 1) peekOpen = true;
    else level = Math.min(C.TOP_LEVEL, go.l + 1) as HelpLevel;
  }
  // Three goes in a row with a wrong first tap: the full picture for the rest of the round (last, so a wrong tap can't lower it).
  if (struggling) {
    level = C.TOP_LEVEL as HelpLevel;
    peekOpen = false;
  }
  let choices = go.choices;
  if (wrongTaps >= 3) {
    const other = go.choices.find((c) => c !== go.answer && !tapped.includes(c)) ?? go.choices.find((c) => c !== go.answer)!;
    choices = go.choices.filter((c) => c === go.answer || c === other);
  }
  return { level, peekOpen, choices };
}
