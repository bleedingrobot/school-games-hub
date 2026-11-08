/**
 * One day's challenge at Robin's Berry Basket (docs/ROBIN-PLAN.md): ten goes of counting out a set. "Give me 6 berries" (the
 * child taps berries into the basket and stops at 6), "How many?" (touch each berry, then pick the number) and "One more" (a
 * covered plate of berries, one more is added: how many now?).
 *
 * The keys are in shared/maths/skillPacks/countingKeys.ts, where the early facts own them so the records count. The game makes
 * its own piles, layouts and wrong cards here.
 *
 * Two things move separately, both from the child's own challenges and kept by the server: the **step** (which keys are asked,
 * six of them) and the **help level** (how much picture and voice, 5 down to 0).
 */
import type { FactStats } from '../maths/leitner';
import { atMostShareTell, type Wrong } from '../kit/mistakes';
import { helpWithSetting, type HelpSetting } from '../kit/help';
import { seeded } from '../seededRandom';
import { ALL_COUNT_KEYS, COUNT_KEYS, countNumbers, kindOfCountKey, type CountKind } from '../maths/skillPacks/countingKeys';
import { GOES_PER_ROUND, MAX_PILE, PILE_EXTRA, REVIEW_GOES, TOP_LEVEL, type HelpLevel, type Step } from './config';

export { GOES_PER_ROUND };
/** What the child does: give a number of berries, count a set and pick the number, or count on from a covered plate. */
export type GoKind = 'give' | 'howmany' | 'counton';
/** The slip behind a first wrong tap: too many or too few berries given; counted one twice, skipped one, counted a row, guessed "lots"; didn't count on, counted from one again, said the one berry. */
export type Slip = 'over' | 'under' | 'double' | 'skip' | 'row' | 'lots' | 'same' | 'again' | 'one' | 'near';
export const SLIPS: readonly Slip[] = ['over', 'under', 'double', 'skip', 'row', 'lots', 'same', 'again', 'one', 'near'];
export type WrongCard = Wrong<Slip>;
/** How the berries sit: in rows of five, scattered, round a ring, or on a plate. */
export type Layout = 'line' | 'scatter' | 'ring' | 'plate';
export interface Point { x: number; y: number }

export const MAX_SEED = 2147483647;
export const isSeed = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MAX_SEED;
export const isStep = (n: unknown): n is Step => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 6;
export const isLevel = (n: unknown): n is HelpLevel => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= TOP_LEVEL;
export const CARDS = 4;
/** The biggest number on any card. */
const MAX_CARD = 30;

export { COUNT_KEYS, ALL_COUNT_KEYS };

/** The made-up examples of the "Show me first" demos: keys no step ever asks, so a demo never gives away a real go. */
export const DEMO_KEYS = { howmany: 'howmany:n3:ring', counton: 'counton:3+1' } as const;
export const goKindOf = (key: string): GoKind | null => {
  const k: CountKind | null = kindOfCountKey(key);
  return k === null ? null : k === 'across' ? 'howmany' : k;
};

// ---------------------------------------------------------------- the keys each step asks

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const give = (from: number, to: number) => range(from, to).map((n) => `give:n${n}`);
const howmany = (layouts: string[], from: number, to: number) => layouts.flatMap((l) => range(from, to).map((n) => `howmany:n${n}:${l}`));
const across = () => range(11, 20).map((n) => `across:n${n}`);

/** A pool of keys and how many of the goes come from it. */
interface Pool { keys: string[]; goes: number }
/** The goes of each step: its new ones, and the earlier ones that come back (three goes shared out between them). */
export const STEP_PLAN: Record<Step, { fresh: Pool[]; review: string[][] }> = {
  1: { fresh: [{ keys: give(1, 5), goes: 10 }], review: [] },
  2: { fresh: [{ keys: howmany(['line'], 1, 5), goes: 10 }], review: [] },
  3: { fresh: [{ keys: give(6, 10), goes: 7 }], review: [give(1, 5), howmany(['line'], 1, 5)] },
  4: { fresh: [{ keys: howmany(['scatter', 'ring'], 6, 10), goes: 7 }], review: [give(6, 10), howmany(['line'], 1, 5)] },
  5: { fresh: [{ keys: COUNT_KEYS.counton, goes: 7 }], review: [howmany(['scatter', 'ring'], 6, 10), give(6, 10)] },
  6: { fresh: [{ keys: give(11, 20), goes: 4 }, { keys: across(), goes: 3 }], review: [COUNT_KEYS.counton, howmany(['ring'], 6, 10), give(6, 10)] },
};
/** Every key a step can ask. */
export const stepKeys = (step: Step): string[] => [...STEP_PLAN[step].fresh.flatMap((p) => p.keys), ...STEP_PLAN[step].review.flat()];

// ---------------------------------------------------------------- where a child starts

export interface Start { step: Step; level: HelpLevel }
/**
 * Everyone starts at step 1 with the most help, whatever their other records say: a child who can say the numbers in Quick looks
 * or Beanstalk is not assumed to count a set out (plan, "The levels"). A child who counts well is at level 3 after two days
 * (a good challenge here needs only 7 of 10).
 */
export const startFor = (_stats: Iterable<FactStats>): Start => ({ step: 1, level: TOP_LEVEL });

/** The level a go is shown at, from the child's level and the teacher's setting: Always is 4 (numbered slots, no voice), Off is 0 (a free pile, no Peek). */
export const shownLevel = (level: HelpLevel, help: HelpSetting): HelpLevel => helpWithSetting<HelpLevel>(level, help, { always: 4, off: 0 });

// ---------------------------------------------------------------- the plan and the round

/** One go as saved: the key and the help level it is shown at. */
export interface GoPlan { key: string; l: HelpLevel }

export interface Round {
  seed: number;
  step: Step;
  level: HelpLevel;
  help: HelpSetting;
  goes: GoPlan[];
}

/** The guided first go (plan section 3): "Give me four!", at level 5. */
export const GUIDED_KEY = 'give:n4';

const shuffle = <T>(items: T[], random: () => number): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** The same key never comes twice in a row where it can be helped. */
function spreadPicks<T extends { key: string }>(keys: T[]): T[] {
  const out = [...keys];
  for (let i = 1; i < out.length; i++) {
    if (out[i].key !== out[i - 1].key) continue;
    const at = out.findIndex((k, x) => x > i && k.key !== out[i].key && out[x - 1].key !== out[i - 1].key && (x + 1 >= out.length || out[x + 1].key !== out[i].key));
    if (at !== -1) [out[i], out[at]] = [out[at], out[i]];
  }
  return out;
}

/**
 * Today's challenge from a fresh seed, the child's records, their place and the teacher's help setting: 7 goes at the step's new
 * thing and 3 earlier ones (steps 1 and 2 are all new), weakest keys first, each key asked twice where the pool is small
 * (so a lucky handful is asked again with the same number). The same inputs always give the same round.
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
  random(); random();
  const box = new Map([...stats].map((s) => [s.key, s.box]));
  const weak = (keys: string[], n: number): string[] => {
    const ranked = shuffle(keys, random).map((k, i) => ({ k, i })).sort((a, b) => (box.get(a.k) ?? 0) - (box.get(b.k) ?? 0) || a.i - b.i).map((x) => x.k);
    return Array.from({ length: n }, (_, i) => ranked[i % ranked.length]);
  };
  const plan = STEP_PLAN[step];
  const shown = shownLevel(level, help);
  const fresh = plan.fresh.flatMap((p) => weak(p.keys, p.goes));
  const review = plan.review.length === 0 ? [] : Array.from({ length: REVIEW_GOES }, (_, i) => weak(plan.review[i % plan.review.length], REVIEW_GOES)[i]);
  let keys = [...fresh, ...review];
  if (opts.guided) {
    const rest = [...keys];
    const at = rest.indexOf(GUIDED_KEY);
    if (at !== -1) rest.splice(at, 1); // one go of it is the guided one; its second ask stays
    keys = [GUIDED_KEY, ...shuffle(rest, random).slice(0, GOES_PER_ROUND - 1)];
  }
  const ordered = opts.guided ? keys : spreadPicks(shuffle(keys, random).map((key) => ({ key }))).map((k) => k.key);
  const goes = ordered.map((key, i): GoPlan => (opts.guided && i === 0 ? { key, l: TOP_LEVEL } : { key, l: shown }));
  return { seed, step, level, help, goes };
}

// ---------------------------------------------------------------- one go as shown

/** A go as shown. */
export interface Go extends GoPlan {
  kind: GoKind;
  /** What is asked: the number to give, the number of berries to count, or the berries on the plate before one more. */
  n: number;
  /** What the child has to settle on: the number to give, the count, or the count after one more. */
  answer: number;
  layout: Layout;
  /** Give: how many berries are in the pile (the answer plus spares). Otherwise the same as `n`. */
  pile: number;
  /** Where each berry sits, 0 to 100 across and down, in the order the child will touch them. */
  points: Point[];
  /** The cards (give has none: any count from 0 to the pile is a tap), smallest first. */
  choices: number[];
  wrongs: WrongCard[];
}

/** Where `n` berries sit in a layout: rows of five (centred), a jittered grid, or a ring. The same random gives the same picture. */
export function layoutPoints(layout: Layout, n: number, random: () => number): Point[] {
  if (layout === 'line' || layout === 'plate') {
    const rows = Math.ceil(n / 5);
    return Array.from({ length: n }, (_, i) => {
      const row = Math.floor(i / 5);
      const inRow = Math.min(5, n - row * 5);
      const col = i % 5;
      return { x: 50 + (col - (inRow - 1) / 2) * 19, y: rows === 1 ? 50 : 18 + (row * 64) / Math.max(1, rows - 1) };
    });
  }
  if (layout === 'ring') {
    const turn = random() * Math.PI * 2;
    return Array.from({ length: n }, (_, i) => (n === 1 ? { x: 50, y: 50 } : { x: 50 + 36 * Math.cos(turn + (i * 2 * Math.PI) / n), y: 50 + 36 * Math.sin(turn + (i * 2 * Math.PI) / n) }));
  }
  // 6 columns by 4 rows (24 cells, the most a pile shows): rows are a quarter of the height apart, so berries never touch.
  const cells = shuffle(range(0, 23), random).slice(0, n);
  return cells.map((c) => ({ x: ((c % 6) + 0.5) * (100 / 6) + (random() - 0.5) * 3, y: (Math.floor(c / 6) + 0.5) * 25 + (random() - 0.5) * 3 }));
}

/**
 * The three wrong cards. `below` and `above` are the near misses on each side of the answer, nearest first. How many of the wrongs sit
 * below the answer is drawn first, so the right card lands in any place (first to fourth) about equally often. With `oneSwap` the lowest
 * card below is sometimes swapped for a "1" (never always), as long as no more than two cards share the answer's parity.
 */
function pickWrongs(answer: number, below: [Slip, number][], above: [Slip, number][], random: () => number, count: number, oneSwap: boolean): WrongCard[] {
  const ok = ([, n]: [Slip, number]) => n >= 1 && n <= MAX_CARD && n !== answer;
  const lo = below.filter(ok);
  const hi = above.filter(ok);
  const places = range(0, count).filter((p) => p <= lo.length && count - p <= hi.length);
  const p = places.length ? places[Math.floor(random() * places.length)] : Math.min(lo.length, count);
  const chosen = (): [Slip, number][] => [...lo.slice(0, p), ...hi.slice(0, count - p)];
  let picked = chosen();
  if (oneSwap && p >= 1 && lo[p - 1][1] > 2 && random() < 0.25) {
    const withOne = picked.map((w, i) => (i === p - 1 ? (['one', 1] as [Slip, number]) : w));
    if (atMostShareTell(answer, [answer, ...withOne.map(([, n]) => n)], (n) => n % 2)) picked = withOne;
  }
  while (picked.length < count) {
    // Not enough named near misses (a tiny or huge answer): fill from the other side.
    const n = [...lo, ...hi].map(([, m]) => m).find((m) => !picked.some(([, x]) => x === m));
    if (n === undefined) break;
    picked.push([...lo, ...hi].find(([, m]) => m === n)!);
  }
  return picked.map(([kind, n]) => ({ n, kind }));
}

/** A go made again from its plan, with its pile, layout and wrong cards fixed by the seed. Null if the plan isn't one this game makes. */
export function showGo(round: Pick<Round, 'seed'>, index: number, plan: GoPlan): Go | null {
  if (!ALL_COUNT_KEYS.includes(plan.key) || !isLevel(plan.l)) return null;
  const kind = goKindOf(plan.key)!;
  const random = seeded((round.seed + 7919 * (index + 1)) % MAX_SEED);
  const [n] = countNumbers(plan.key);
  if (kind === 'give') {
    const [lo, hi] = PILE_EXTRA;
    const pile = Math.min(MAX_PILE, n + lo + Math.floor(random() * (hi - lo + 1)));
    return { ...plan, kind, n, answer: n, layout: 'scatter', pile, points: layoutPoints('scatter', pile, random), choices: [], wrongs: [] };
  }
  if (kind === 'counton') {
    const answer = n + 1;
    const wrongs = pickWrongs(answer, [['same', n], ['near', n - 1], ['near', n - 2]], [['again', n + 2], ['near', n + 3], ['near', n + 4]], random, CARDS - 1, true);
    const choices = [answer, ...wrongs.map((w) => w.n)].sort((a, b) => a - b);
    return { ...plan, kind, n, answer, layout: 'plate', pile: n, points: layoutPoints('plate', n, random), choices, wrongs };
  }
  const layout: Layout = plan.key.startsWith('across:') ? 'line' : (plan.key.split(':')[2] as Layout);
  const wrongs = pickWrongs(n, [['skip', n - 1], ['row', n - 2], ['near', n - 3], ['near', n - 4]], [['double', n + 1], ['near', n + 2], ['near', n + 3], ['lots', n + 4]], random, CARDS - 1, false);
  const choices = [n, ...wrongs.map((w) => w.n)].sort((a, b) => a - b);
  return { ...plan, kind, n, answer: n, layout, pile: n, points: layoutPoints(layout, n, random), choices, wrongs };
}

/** Every go of a round as shown. Throws if a saved round has a go this game can't make. */
export function showRound(round: Round): Go[] {
  return round.goes.map((plan, i) => {
    const go = showGo(round, i, plan);
    if (!go) throw new Error(`Go ${i} (${plan.key}) can't be made`);
    return go;
  });
}

/** The numbers a tap may carry on this go: any count up to the pile for a give go, else its cards. */
export const tapsAllowed = (go: Pick<Go, 'kind' | 'pile' | 'choices'>): number[] => (go.kind === 'give' ? range(0, go.pile) : go.choices);

/** The slip behind a wrong tap: more or fewer berries than asked, or the kind of the wrong card picked. */
export const slipOf = (go: Pick<Go, 'kind' | 'answer' | 'wrongs'>, pick: number): Slip =>
  go.kind === 'give' ? (pick > go.answer ? 'over' : 'under') : (go.wrongs.find((w) => w.n === pick)?.kind ?? 'near');

// ---------------------------------------------------------------- help inside one go

/** A wrong tap lifts that go's help one level; a second takes it to the top (numbered slots and counting). Three goes in a row wrong at the first tap keep the top level for the round. */
export function levelFor(planned: HelpLevel, wrongTaps: number, struggling: boolean, help: HelpSetting): { level: HelpLevel; peek: boolean } {
  let level = planned;
  if (struggling) level = TOP_LEVEL;
  if (wrongTaps >= 2) level = TOP_LEVEL;
  else if (wrongTaps === 1) level = Math.min(TOP_LEVEL, planned + 1) as HelpLevel;
  // Off keeps the picture away until a wrong tap brings it (plan, Lots / Some / Off); Peek is hidden then.
  return { level, peek: help !== 'off' && planned <= 1 };
}

/** After two wrong taps the redo has two cards: the answer and one other, the right one marked. (A give go has no cards: Bella counts along instead.) */
export function redoCards(go: Pick<Go, 'choices' | 'answer'>, tapped: readonly number[]): number[] {
  const other = go.choices.find((c) => c !== go.answer && !tapped.includes(c)) ?? go.choices.find((c) => c !== go.answer)!;
  return go.choices.filter((c) => c === go.answer || c === other);
}
