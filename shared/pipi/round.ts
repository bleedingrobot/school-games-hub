/**
 * One day's challenge at Pipi's Hidden Shells: ten goes, each a family of pipi on the beach with some dug in under the
 * sand, and four shells with numbers to choose from (docs/PIPI-PLAN.md sections 2 and 3).
 *
 * The facts are the shared part-whole ones (`part7:4` = 7 altogether, 4 showing, in shared/maths/skillPacks/earlyFacts.ts).
 * Each go's key is the fact it records. Three kinds of go:
 *  - hiding: 7 altogether, 4 showing, how many are hiding? (3). Every day.
 *  - altogether: 4 here and 3 popped up, how many altogether? (7). Silver and gold days, now and then.
 *  - two tides: the hiding ones come up and the others dig in; now how many are hiding? Gold days only. Its key is the
 *    split as it is now (part7:3 when 3 are showing after the swap), so it records the fact it really asks.
 *
 * The level (wholes 3 to 5, then 6 and 7, then 8 to 10) comes from the child's records, not from the auto ladder (these
 * skills sit beside it). A level is passed when 70% of its facts are in box 2 or higher. The server keeps the furthest
 * level reached, so forgetting a few facts brings more practice of them but never drops a child back.
 */
import { choicesFor } from '../maths/banded';
import type { FactStats } from '../maths/leitner';
import { STEP_SECURE_SHARE } from '../maths/selector';
import { earlyFactsPack } from '../maths/skillPacks/earlyFacts';
import { seeded } from '../seededRandom';
import type { Metal } from './progress';

export const GOES_PER_ROUND = 10;
/** Altogether goes on silver and gold days, and two-tides goes on gold days. */
export const ALTOGETHER_GOES = 2;
export const TWO_TIDES_GOES = 2;

/** The wholes at each level, smallest first. */
export const LEVELS = [
  { level: 1, from: 3, to: 5 },
  { level: 2, from: 6, to: 7 },
  { level: 3, from: 8, to: 10 },
] as const;
export type Level = (typeof LEVELS)[number]['level'];
export type Kind = 'hiding' | 'altogether' | 'twoTides';
export type Colour = Exclude<Metal, 'sand'>;

/** The guided first go (plan section 6): 3 pipi, 2 showing. */
export const GUIDED_KEY = 'part3:2';

export const MAX_SEED = 2147483647;
export const isSeed = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MAX_SEED;
export const isLevel = (n: unknown): n is Level => LEVELS.some((l) => l.level === n);

export const parseKey = (key: string) => {
  const m = /^part(\d+):(\d+)$/.exec(key);
  return m ? { whole: Number(m[1]), shown: Number(m[2]) } : null;
};
const isEdge = (key: string) => {
  const p = parseKey(key)!;
  return p.shown === 0 || p.shown === p.whole;
};

/** Every split of every whole at a level: `part6:0` to `part7:7`. */
export function levelKeys(level: Level): string[] {
  const { from, to } = LEVELS.find((l) => l.level === level)!;
  const keys: string[] = [];
  for (let w = from; w <= to; w++) for (let s = 0; s <= w; s++) keys.push(`part${w}:${s}`);
  return keys;
}

export function levelShare(stats: Iterable<FactStats>, level: Level): number {
  const box = new Map([...stats].map((s) => [s.key, s.box]));
  const keys = levelKeys(level);
  return keys.filter((k) => (box.get(k) ?? 0) >= 2).length / keys.length;
}

/** Today's level: the first not yet secure, never below the furthest reached. Once 8 to 10 is secure the child stays there. */
export function levelFor(stats: Iterable<FactStats>, reached: Level = 1): Level {
  const list = [...stats];
  const next = LEVELS.find((l) => l.level >= reached && levelShare(list, l.level) < STEP_SECURE_SHARE);
  return next ? next.level : 3;
}

/** One go as saved: the fact it records and how it is asked. */
export interface GoPlan {
  key: string;
  kind: Kind;
}

/** What the server saves when a challenge starts, and the browser is sent. */
export interface Round {
  seed: number;
  level: Level;
  colour: Colour;
  goes: GoPlan[];
}

/** A go as shown. */
export interface Go extends GoPlan {
  whole: number;
  /** Pipi on the sand now. */
  showing: number;
  /** Pipi under the sand now (for altogether: the ones that popped up). */
  hiding: number;
  /** Two tides only: how many were showing before the swap. */
  before?: number;
  answer: number;
  /** The words read aloud. They never say the answer. */
  spoken: string;
  /** Four shells, the right one among them. */
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

/** `n` different facts, weakest first (lowest box), ties broken by the seed. */
function weakest(keys: string[], n: number, box: Map<string, number>, random: () => number): string[] {
  return shuffle(keys, random)
    .map((k, i) => ({ k, i }))
    .sort((a, b) => (box.get(a.k) ?? 0) - (box.get(b.k) ?? 0) || a.i - b.i)
    .slice(0, n)
    .map((x) => x.k);
}

/**
 * Today's challenge from a fresh seed, the child's records, the furthest level reached, the day's colour and whether it
 * is the very first challenge (the guided go comes first). The same inputs always give the same round.
 */
export function makeRound(
  seed: number,
  stats: Iterable<FactStats>,
  opts: { reached?: Level; colour?: Colour; guided?: boolean } = {},
): Round {
  if (!isSeed(seed)) throw new RangeError(`Bad seed ${seed}`);
  const list = [...stats];
  const level = levelFor(list, opts.reached);
  const colour = opts.colour ?? 'bronze';
  const random = seeded(seed);
  random(); random(); // the first draws of this generator are close together for close seeds
  const box = new Map(list.map((s) => [s.key, s.box]));
  const keys = levelKeys(level);
  // "None hiding" and "all hiding" are real answers, but rarer: at most one a round (always one at level 1, which has
  // only nine other splits).
  const middle = keys.filter((k) => !isEdge(k));
  const edges = Math.max(GOES_PER_ROUND - middle.length, random() < 0.5 ? 1 : 0);
  let picked = shuffle([...weakest(middle, GOES_PER_ROUND - edges, box, random), ...weakest(keys.filter(isEdge), edges, box, random)], random);
  if (opts.guided) picked = [GUIDED_KEY, ...picked.filter((k) => k !== GUIDED_KEY)].slice(0, GOES_PER_ROUND);
  // The other kinds never take the first go, and two tides never uses an edge (nothing to swap).
  const goes: GoPlan[] = picked.map((key) => ({ key, kind: 'hiding' }));
  const free = shuffle(goes.map((_, i) => i).slice(1), random);
  if (colour === 'gold') {
    free.filter((i) => !isEdge(goes[i].key)).slice(0, TWO_TIDES_GOES).forEach((i) => (goes[i].kind = 'twoTides'));
  }
  if (colour !== 'bronze') {
    free.filter((i) => goes[i].kind === 'hiding').slice(0, ALTOGETHER_GOES).forEach((i) => (goes[i].kind = 'altogether'));
  }
  return { seed, level, colour, goes };
}

const pack = earlyFactsPack();

/** A go made again from its plan, with its shells in an order fixed by the seed. Null if the plan isn't one that can be made. */
export function showGo(round: Pick<Round, 'seed'>, index: number, plan: GoPlan): Go | null {
  const p = parseKey(plan.key);
  if (!p) return null;
  const random = seeded((round.seed + 7919 * (index + 1)) % MAX_SEED);
  const q = pack.rebuild(plan.key, [p.whole, p.shown], true, random);
  if (!q || !q.choices) return null;
  const { whole, shown } = p;
  const hidden = whole - shown;
  if (plan.kind === 'hiding') {
    return { ...plan, whole, showing: shown, hiding: hidden, answer: hidden, spoken: `${whole} pipi. How many are hiding?`, choices: q.choices };
  }
  if (plan.kind === 'twoTides') {
    if (shown === 0 || shown === whole) return null;
    return {
      ...plan, whole, showing: shown, hiding: hidden, before: hidden, answer: hidden,
      spoken: `Splash! The hiding ones pop up and the others dig in. ${whole} pipi. How many are hiding now?`,
      choices: q.choices,
    };
  }
  if (plan.kind === 'altogether') {
    const choices = choicesFor(whole, [whole + 1, whole - 1, shown, hidden, whole + 2], false, random);
    return { ...plan, whole, showing: shown, hiding: hidden, answer: whole, spoken: `${shown} here, and ${hidden} popped up. How many pipi altogether?`, choices };
  }
  return null;
}

/** Every go of a round as shown. Throws if a saved round has a go that can't be made. */
export function showRound(round: Round): Go[] {
  return round.goes.map((plan, i) => {
    const go = showGo(round, i, plan);
    if (!go) throw new Error(`Go ${i} (${plan.key}) can't be made`);
    return go;
  });
}
