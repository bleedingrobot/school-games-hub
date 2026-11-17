/**
 * One day's challenge at Swamp Hen's Reed Rows (docs/SWAMPHEN-PLAN.md): ten goes in the reed garden, each an array of shoots in
 * neat rows. The facts are the hub's shared equal-rows keys (`rows:4x6`, `turn:3x5`, `share:24/4`, `cut:6x7`, `which:3x5` in
 * shared/maths/skillPacks/earlyFacts.ts, ladder skills `equal-rows`, `arrays-turn`, `sharing-rows`, `cut-arrays`); every go that
 * is a times fact also records the plain times-table key (`mul:4x6`). The key says the numbers; the *kind* of go (equal rows or
 * not, plant it, under the mat, turn it, which garden, share it, cut it, one row short) comes from the key and its step.
 *
 * Two things move separately, both from the child's own challenges and both kept by the server:
 * - the **step**: the nine steps in STEPS (plan of 18 Nov 2026). Passed after three good challenges (8 or more of 10 right at
 *   the first tap); two hard ones in a row (4 or fewer) take the child back one step.
 * - the **help level**: 5 every row a shade with the running total, down to 0 the sum only (see `viewFor`).
 */
import { EARLY_FACTS } from '../maths/skillPacks/earlyFacts';
import { factKey } from '../maths/facts';
import type { FactStats } from '../maths/leitner';
import { seeded } from '../seededRandom';
import { sisterNumber } from '../kit/sister';
import { atMostShareTell, tagWrongs, type Wrong } from '../kit/mistakes';
import { fadeAfter, fadeByKind, helpWithSetting, ROUND_OF_TEN, type HelpSetting, type KindLevels, type Place as KitPlace } from '../kit/help';
import * as C from './config';

export { GOES_PER_ROUND, REVIEW_GOES, GOOD, HARD } from './config';
export type { HelpSetting } from '../kit/help';
export { HELP_SETTINGS } from '../kit/help';

// ---------------------------------------------------------------- steps, keys and kinds

export type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type HelpLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type Kind = 'equal' | 'plant' | 'mat' | 'turn' | 'which' | 'share' | 'cut' | 'short';
/** Every kind of go, for the kinds a child has seen (the server accepts only these). */
export const KINDS: readonly Kind[] = ['equal', 'plant', 'mat', 'turn', 'which', 'share', 'cut', 'short'];

/**
 * The ladder (plan of 18 Nov 2026, after research on how children come to multiply): equal groups first, then counting the
 * rows in 2s, 10s and 5s, sharing by dealing, turning small arrays, rows of 3 and 4, the mat over facts the child knows, and
 * last, behind the Big Garden gate, the 6s to 9s built from facts they know.
 */
export const STEPS: readonly { step: Step; name: string; kinds: readonly Kind[] }[] = [
  { step: 1, name: 'Equal rows', kinds: ['equal'] },
  { step: 2, name: 'Rows of 2', kinds: ['plant'] },
  { step: 3, name: 'Rows of 10 and 5', kinds: ['plant'] },
  { step: 4, name: 'Share them out', kinds: ['share'] },
  { step: 5, name: 'Turn the garden', kinds: ['turn', 'which'] },
  { step: 6, name: 'Rows of 3 and 4', kinds: ['plant'] },
  { step: 7, name: 'Under the mat', kinds: ['mat'] },
  { step: 8, name: 'Big Garden: 6 and 7 rows', kinds: ['cut'] },
  { step: 9, name: 'Big Garden: 8 and 9 rows', kinds: ['short', 'cut'] },
];
export const stepName = (step: Step) => STEPS[step - 1].name;
export const stepKinds = (step: Step) => STEPS[step - 1].kinds;
export const isBigGarden = (step: Step) => step >= C.BIG_GARDEN_STEP;

const familyKeys = (name: string): string[] => EARLY_FACTS.families[name].keys;
const rowsKeys = familyKeys('rows');
const cutKeys = familyKeys('cut');

/** The two numbers in a key ("rows:4x6" gives 4 and 6, "share:24/4" gives 24 and 4). */
export const keyPair = (key: string): [number, number] => {
  const m = /(\d+)[x/](\d+)$/.exec(key)!;
  return [Number(m[1]), Number(m[2])];
};

/** "Which garden has equal rows?": small gardens, 2 to 5 rows of 2 to 5, 12 shoots or fewer. Not a times fact: never recorded. */
export const EQUAL_KEYS: string[] = [2, 3, 4, 5].flatMap((r) => [2, 3, 4, 5].filter((c) => r * c <= C.EQUAL_MAX).map((c) => `equal:${r}x${c}`));

const inRow = (sizes: number[]) => (key: string) => sizes.includes(keyPair(key)[1]);
const smallTurn = (key: string) => {
  const [a, b] = keyPair(key);
  return a <= 5 && b <= 5 && a * b <= C.TURN_MAX;
};

/** The keys each step asks as its own. */
export const STEP_KEYS: Record<Step, string[]> = {
  1: EQUAL_KEYS,
  2: rowsKeys.filter(inRow([2])),
  3: rowsKeys.filter(inRow([10, 5])),
  4: familyKeys('share').filter((k) => [2, 5].includes(keyPair(k)[1]) && keyPair(k)[0] <= C.SHARE_MAX),
  5: [...familyKeys('turn'), ...familyKeys('which')].filter(smallTurn),
  6: rowsKeys.filter(inRow([3, 4])),
  7: rowsKeys.filter(inRow([2, 3, 4, 5, 10])),
  8: cutKeys.filter((k) => [6, 7].includes(keyPair(k)[0]) && keyPair(k)[1] <= 5),
  9: cutKeys.filter((k) => [8, 9].includes(keyPair(k)[0]) && keyPair(k)[1] <= 5),
};
/**
 * Every key the game can replay: every key of its fact families (a challenge started on the old ladder still finishes) and the
 * equal-rows keys. The keys a step asks are in STEP_KEYS.
 */
export const KEYS: string[] = [...new Set([...EQUAL_KEYS, ...['rows', 'turn', 'which', 'share', 'cut'].flatMap(familyKeys)])];

/** The level a kind of go is at: its own, or (not in the map yet) the child's. */
const kindLevel = (kindLevels: KindLevels | undefined, kind: Kind, level: HelpLevel): HelpLevel => {
  const own = kindLevels?.[kind]?.level;
  return isLevel(own) ? own : level;
};

/** The kinds of go a key can be: rows are planted or under the mat (by the step), the rest one kind each. */
export function kindsOfKey(key: string): Kind[] {
  switch (/^([a-z]+):/.exec(key)?.[1]) {
    case 'equal': return ['equal'];
    case 'rows': return ['plant', 'mat'];
    case 'turn': return ['turn'];
    case 'which': return ['which'];
    case 'share': return ['share'];
    case 'cut': return [keyPair(key)[0] === 9 ? 'short' : 'cut'];
    default: return [];
  }
}

/**
 * The kind of go a key is on the step that asks it: rows are under the mat at step 7 and planted on the other steps. With no
 * step (a key from the records), rows of 6 to 9 in a row are under the mat, as on the old ladder.
 */
export function kindOfKey(key: string, step?: Step): Kind | null {
  const kinds = kindsOfKey(key);
  if (!kinds.length) return null;
  if (kinds.length === 1) return kinds[0];
  return step === 7 || (step === undefined && !inRow([2, 3, 4, 5, 10])(key)) ? 'mat' : 'plant';
}

/** The plain times-table key a go also records, or null for sharing, turning and equal rows (none states a total to find). */
export function mulKeyOf(key: string): string | null {
  if (key.startsWith('share:') || key.startsWith('turn:') || key.startsWith('equal:')) return null;
  const [a, b] = keyPair(key);
  return factKey(a, b);
}

/** Equal-rows goes are about seeing equal groups, not a fact to remember: they are left out of the maths records. */
export const isRecorded = (key: string) => !key.startsWith('equal:');

export type { KindLevels };

// ---------------------------------------------------------------- places and starting points

/**
 * Where a child is: step, help level, good challenges counted towards the next change, counted days at this step (new goes
 * ease in over them) and hard challenges in a row (two take the child back a step).
 */
export type Place = KitPlace & { step: Step; level: HelpLevel; daysAtStep: number; hardInRow: number };

const RULES = {
  ...ROUND_OF_TEN,
  topLevel: C.TOP_LEVEL,
} as const;

/** The help level of each kind of go after a day's first finish: the kit's rule with the round of ten (a new kind starts at the child's level). */
export function kindLevelsAfter(kindLevels: KindLevels, goes: readonly { kind: string; right: boolean }[], level: number): KindLevels {
  return fadeByKind(kindLevels, goes, RULES, level);
}

/** The kinds' help when the step changes: the new step's own kinds start again with full help, the others keep theirs. */
export function kindLevelsForStep(kindLevels: KindLevels, step: Step): KindLevels {
  const out: KindLevels = { ...kindLevels };
  for (const kind of stepKinds(step)) delete out[kind];
  return out;
}

/**
 * The place after a day's first finish with `right` goes right at the first tap (plan of 18 Nov 2026):
 *  - help fades after two good challenges in a row and comes back one level after a hard one (the kit's fadeAfter);
 *  - three good challenges at a step pass it, and the next step starts with full help;
 *  - two hard challenges in a row take the child back one step, with full help, and one good day there moves them on again.
 */
export function placeAfter(p: Place, right: number): Place {
  const fade = fadeAfter(p, right, RULES);
  const goodAtStep = right >= C.GOOD ? p.goodAtStep + 1 : p.goodAtStep;
  const hardInRow = right <= C.HARD ? p.hardInRow + 1 : 0;
  const top = C.TOP_LEVEL as HelpLevel;
  if (hardInRow >= C.HARD_TO_DROP && p.step > 1) {
    return { step: (p.step - 1) as Step, level: top, goodInRow: 0, goodAtStep: C.GOOD_TO_PASS - 1, daysAtStep: C.NEW_GOES_BY_DAY.length, hardInRow: 0 };
  }
  if (goodAtStep >= C.GOOD_TO_PASS && p.step < C.TOP_STEP) {
    return { step: (p.step + 1) as Step, level: top, goodInRow: 0, goodAtStep: 0, daysAtStep: 0, hardInRow: 0 };
  }
  return { step: p.step, level: fade.level as HelpLevel, goodInRow: fade.goodInRow, goodAtStep, daysAtStep: p.daysAtStep + 1, hardInRow };
}

const secureShare = (keys: string[], box: ReadonlyMap<string, number>) => (keys.length ? keys.filter((k) => (box.get(k) ?? 0) >= 2).length / keys.length : 0);
const tableKeys = (tables: number[]) => tables.flatMap((t) => Array.from({ length: 13 - t }, (_, i) => factKey(t, t + i)));

/**
 * A child who already knows the 2 to 5 times tables when they first play starts at step 7 (under the mat), help level 3; one
 * who has most of Hop's counting in fives and tens starts at step 3 (rows of 10 and 5); everyone else at step 1, level 5.
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

/** `n` keys from a pool, weakest first, going round the pool again when it is smaller than `n`. */
const take = (pool: readonly string[], n: number, box: ReadonlyMap<string, number>, random: () => number): string[] => {
  const order = weakest(pool, box, random);
  return order.length ? Array.from({ length: n }, (_, i) => order[i % order.length]) : [];
};

/**
 * The same key never comes twice in a row: at each place the key with the most goes left that isn't the one just asked (ties
 * in the given order, which is already shuffled). The first key stays first (the guided go).
 */
function spreadOut(keys: string[]): string[] {
  if (keys.length < 2) return [...keys];
  const left = new Map<string, number>();
  for (const k of keys.slice(1)) left.set(k, (left.get(k) ?? 0) + 1);
  const out = [keys[0]];
  while (out.length < keys.length) {
    let best: string | null = null;
    for (const [k, n] of left) if (n > 0 && k !== out[out.length - 1] && (best === null || n > left.get(best)!)) best = k;
    // Only one key left and it was just asked: put it where it fits further back.
    best ??= [...left].find(([, n]) => n > 0)![0];
    out.push(best);
    left.set(best, left.get(best)! - 1);
  }
  return out;
}

/** How many of the ten goes are the step's own after `daysAtStep` counted days at it: 3, then 5, then 7 (step 1: all ten). */
export const newGoes = (step: Step, daysAtStep: number): number =>
  step === 1 ? C.GOES_PER_ROUND : C.NEW_GOES_BY_DAY[Math.min(Math.max(0, daysAtStep), C.NEW_GOES_BY_DAY.length - 1)];

/** A go's key with the kind it is today. */
interface Planned {
  key: string;
  kind: Kind;
}

/**
 * Today's challenge from a fresh seed, the child's records, their place and the teacher's setting (plan of 18 Nov 2026).
 *  - The step's own goes ease in: 3 on the first day at a step, then 5, then 7 (step 1: all ten), weakest first.
 *  - A step with two kinds of go starts with its first kind alone; the second joins from the next day.
 *  - The rest are review from earlier steps, all of one kind (picked by the seed), so a day never has more than two kinds.
 *    With nothing earlier of a kind that fits, the step's own goes fill the ten.
 * The same inputs always give the same round.
 */
export function makeRound(
  seed: number,
  stats: Iterable<FactStats>,
  opts: { step?: Step; level?: HelpLevel; help?: HelpSetting; guided?: boolean; kindLevels?: KindLevels; daysAtStep?: number } = {},
): Round {
  if (!isSeed(seed)) throw new RangeError(`Bad seed ${seed}`);
  const step = opts.step ?? 1;
  const level = opts.level ?? C.TOP_LEVEL;
  const help = opts.help ?? 'fade';
  const days = opts.daysAtStep ?? C.NEW_GOES_BY_DAY.length;
  const random = seeded(seed);
  random(); random();
  const box = new Map([...stats].map((s) => [s.key, s.box]));
  // The step's own keys, with today's kinds of them.
  const ownKinds = days === 0 ? stepKinds(step).slice(0, 1) : stepKinds(step);
  const own: Planned[] = STEP_KEYS[step].map((key) => ({ key, kind: kindOfKey(key, step)! })).filter((p) => ownKinds.includes(p.kind));
  const ownKind = new Map(own.map((p) => [p.key, p.kind]));
  // Review: one kind from the earlier steps (equal rows only until rows of 10 and 5 are passed), weakest first.
  const earlier: Planned[] = STEPS.filter((s) => s.step < step && (s.step > 1 || step <= 3)).flatMap((s) => STEP_KEYS[s.step].map((key) => ({ key, kind: kindOfKey(key, s.step)! })));
  const room = C.MAX_KINDS - ownKinds.length;
  // A key asked today as the step's own is not reviewed as another kind too (rows under the mat are not also planted).
  const candidates = earlier.filter((p) => !ownKind.has(p.key));
  const reviewKinds = room > 0 ? [...new Set(candidates.map((p) => p.kind))].filter((k) => !ownKinds.includes(k)) : [];
  const reviewKind = reviewKinds.length ? reviewKinds[Math.floor(random() * reviewKinds.length)] : null;
  const pool = new Map<string, Kind>();
  for (const p of candidates) if ((p.kind === reviewKind || ownKinds.includes(p.kind)) && !pool.has(p.key)) pool.set(p.key, p.kind);
  const reviewCount = pool.size ? C.GOES_PER_ROUND - newGoes(step, days) : 0;
  let plans: Planned[] = shuffle([
    ...take(own.map((p) => p.key), C.GOES_PER_ROUND - reviewCount, box, random).map((key) => ({ key, kind: ownKind.get(key)! })),
    ...take([...pool.keys()], reviewCount, box, random).map((key) => ({ key, kind: pool.get(key)! })),
  ], random);
  if (opts.guided) plans = [{ key: GUIDED_KEY, kind: 'plant' as Kind }, ...plans.filter((p) => p.key !== GUIDED_KEY)].slice(0, C.GOES_PER_ROUND);
  const kindOf = new Map(plans.map((p) => [p.key, p.kind]));
  const keys = spreadOut(plans.map((p) => p.key));
  const goes = keys.map((key, i): GoPlan => {
    const kind = kindOf.get(key)!;
    return { key, kind, l: opts.guided && i === 0 ? (C.TOP_LEVEL as HelpLevel) : shownLevel(kindLevel(opts.kindLevels, kind, level), help) };
  });
  return { seed, step, level, help, goes };
}

// ---------------------------------------------------------------- a go as shown

/** Named slips behind the wrong cards (the teacher and the why-line use the names). */
export type Slip = 'added' | 'joined' | 'short' | 'spare' | 'forgot' | 'minus' | 'rows' | 'turned' | 'unturned' | 'scatter' | 'uneven' | 'near';

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
export const pictureCode = (rows: number, cols: number, uneven: 0 | 1 | 2 = 0) => uneven * C.UNEVEN + rows * C.CODE + cols;
/**
 * A picture card from its code: rows and shoots in a row (no rows: a scatter of `cols` shoots), and how it is uneven: 0 every
 * row the same, 1 the last row one short, 2 the first row one long.
 */
export const pictureOf = (code: number): { rows: number; cols: number; uneven: 0 | 1 | 2 } => {
  const uneven = Math.floor(code / C.UNEVEN) as 0 | 1 | 2;
  const rest = code % C.UNEVEN;
  return rest < C.CODE ? { rows: 0, cols: rest, uneven } : { rows: Math.floor(rest / C.CODE), cols: rest % C.CODE, uneven };
};
/** The shoots in each row of a picture card, first row first. */
export const rowLengths = ({ rows, cols, uneven }: { rows: number; cols: number; uneven: 0 | 1 | 2 }): number[] =>
  Array.from({ length: rows }, (_, r) => cols + (uneven === 1 && r === rows - 1 ? -1 : uneven === 2 && r === 0 ? 1 : 0));

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
  if (!KEYS.includes(plan.key) || !isLevel(plan.l) || !kindsOfKey(plan.key).includes(plan.kind)) return null;
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
  if (plan.kind === 'equal') {
    // Which garden has equal rows? The same rows with one row short, or one row long, and a scatter are the wrong pictures.
    const answer = pictureCode(a, b);
    const wrongs: Wrong<Slip>[] = [{ n: pictureCode(a, b, 1), kind: 'uneven' }, { n: pictureCode(a, b, 2), kind: 'uneven' }, { n: total, kind: 'scatter' }];
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

/**
 * A sister of a go, for "Now you try": the same kind of go with one of its two key numbers moved by 1 or 2 (kit's sisterNumber),
 * so its key is another key the game asks, built by showGo like any go. Its answer is none of the original's cards. Null when no
 * such key exists, and the browser falls back to the same go again. Never saved or sent: replay knows only the original go.
 */
export function sisterGo(round: Pick<Round, 'seed'>, index: number, go: Go): Go | null {
  const m = /^([a-z]+):(\d+)([x/])(\d+)$/.exec(go.key);
  if (!m) return null;
  // Sharing is moved by its rows or its shoots in a row (the pile follows), so the pile still shares out evenly.
  const share = m[1] === 'share';
  const nums: [number, number] = share ? [Number(m[4]), Number(m[2]) / Number(m[4])] : [Number(m[2]), Number(m[4])];
  const sisterSeed = (round.seed + 104729 * (index + 1)) % MAX_SEED;
  // A sister comes from the same step's keys, so it is never harder than the go (a go from no step: any key).
  const steps = STEPS.filter((s) => STEP_KEYS[s.step].includes(go.key));
  const pool = new Set(steps.length ? steps.flatMap((s) => STEP_KEYS[s.step]) : KEYS);
  const make = (pair: [number, number], salt: number): Go | null => {
    const key = share ? `share:${pair[0] * pair[1]}/${pair[0]}` : `${m[1]}:${pair[0]}${m[3]}${pair[1]}`;
    if (!pool.has(key) || !kindsOfKey(key).includes(go.kind)) return null;
    const made = showGo({ seed: sisterSeed + salt }, index + C.GOES_PER_ROUND, { key, kind: go.kind, l: go.l });
    return made && !go.choices.includes(made.answer) ? made : null;
  };
  const order: (0 | 1)[] = seeded(sisterSeed)() < 0.5 ? [0, 1] : [1, 0];
  for (const at of order) {
    const bad: number[] = [];
    for (let v = 1; v <= 144; v++) {
      const pair: [number, number] = at === 0 ? [v, nums[1]] : [nums[0], v];
      if (!make(pair, 0)) bad.push(v);
    }
    const n = sisterNumber(nums[at], sisterSeed, { min: 1, max: 144, avoid: bad });
    if (n === null) continue;
    const found = make(at === 0 ? [n, nums[1]] : [nums[0], n], 0);
    if (found) return found;
  }
  return null;
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
