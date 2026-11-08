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
import { helpForFact, type FactRung } from '../kit/help';
import { atMostShareTell, tagWrongs, type Wrong } from '../kit/mistakes';
import type { FactStats } from '../maths/leitner';
import { STEP_SECURE_SHARE } from '../maths/selector';
import { seeded } from '../seededRandom';
import type { Help, Metal } from './progress';

export const GOES_PER_ROUND = 10;
/** Altogether goes on silver and gold days, and two-tides goes on gold days. */
export const ALTOGETHER_GOES = 2;
export const TWO_TIDES_GOES = 2;
/** Goes a round (from level 2 up) that come from earlier levels' splits, weakest first, so older sums stay known. */
export const REVIEW_GOES = 2;

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

export const HELPS: readonly Help[] = ['full', 'faint', 'none'];
export const isHelp = (v: unknown): v is Help => HELPS.includes(v as Help);

/**
 * The help in the sand (the frame and the outlines) for a fact from the child's own record of it (maths review R6, Weka's
 * way with Pipi's three states): full until the fact is secure (box 2) and has been right quickly on two different days;
 * faint until it is fluent (box 4) and right 6 times; then none. A wrong answer drops a fact to box 1, so its full help
 * comes back, and a new level's splits have no record, so they start full.
 */
const HELP_LADDER: readonly FactRung<Help>[] = [
  { help: 'full', until: { box: 2, quickDays: 2 } },
  { help: 'faint', until: { box: 4, correct: 6 } },
  { help: 'none' },
];
export const helpForStats = (stats: Pick<FactStats, 'box' | 'correct' | 'quickDays'> | undefined): Help => helpForFact(stats, HELP_LADDER);

/**
 * One go as saved: the fact it records, how it is asked and its help in the sand. `h` is missing on a round saved before
 * R6: that go shows the calendar's help for the round (the browser falls back).
 */
export interface GoPlan {
  key: string;
  kind: Kind;
  h?: Help;
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
  /** The mistake behind each wrong shell (maths review R5): the kind picks the why-line and the picture. */
  wrongs: Wrong<WrongKind>[];
}

/**
 * The mistake behind a wrong shell (docs/kit/README.md, "Part and whole"): the number showing, the whole, whole plus
 * showing, one off, one part when asked altogether, and the number from the first tide.
 */
export type WrongKind = 'shown' | 'whole' | 'add' | 'off1' | 'part' | 'before';

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
  opts: { reached?: Level; level?: Level; colour?: Colour; guided?: boolean } = {},
): Round {
  if (!isSeed(seed)) throw new RangeError(`Bad seed ${seed}`);
  const list = [...stats];
  // A saved level is used as is, so records from replays can't move it; with none it comes from the records.
  const level = opts.level ?? levelFor(list, opts.reached);
  const colour = opts.colour ?? 'bronze';
  const random = seeded(seed);
  random(); random(); // the first draws of this generator are close together for close seeds
  const box = new Map(list.map((s) => [s.key, s.box]));
  const byKey = new Map(list.map((s) => [s.key, s]));
  const keys = levelKeys(level);
  // "None hiding" and "all hiding" are real answers, but rarer: at most one a round (always one at level 1, which has
  // only nine other splits).
  const middle = keys.filter((k) => !isEdge(k));
  const edges = Math.max(GOES_PER_ROUND - middle.length, random() < 0.5 ? 1 : 0);
  // From level 2 up, some goes revisit earlier levels' splits (never edges, never the first go).
  const earlier = LEVELS.filter((l) => l.level < level).flatMap((l) => levelKeys(l.level)).filter((k) => !isEdge(k));
  const reviews = earlier.length ? weakest(earlier, REVIEW_GOES, box, random) : [];
  const fresh = GOES_PER_ROUND - reviews.length;
  const ownEdges = Math.min(edges, fresh);
  let picked = shuffle([...weakest(middle, fresh - ownEdges, box, random), ...weakest(keys.filter(isEdge), ownEdges, box, random)], random);
  if (opts.guided) picked = [GUIDED_KEY, ...picked.filter((k) => k !== GUIDED_KEY)].slice(0, fresh);
  // Review goes sit in the middle of the round: from the 3rd go on, spread out.
  reviews.forEach((k, i) => picked.splice(Math.min(2 + i * 3 + Math.floor(random() * 2), picked.length), 0, k));
  // The other kinds never take the first go or an edge: two tides has nothing to swap, and "4 here and 0 popped up" isn't
  // an altogether question.
  const goes: GoPlan[] = picked.map((key) => ({ key, kind: 'hiding', h: helpForStats(byKey.get(key)) }));
  const free = shuffle(goes.map((_, i) => i).slice(1), random);
  if (colour === 'gold') {
    free.filter((i) => !isEdge(goes[i].key)).slice(0, TWO_TIDES_GOES).forEach((i) => (goes[i].kind = 'twoTides'));
  }
  if (colour !== 'bronze') {
    free.filter((i) => goes[i].kind === 'hiding' && !isEdge(goes[i].key)).slice(0, ALTOGETHER_GOES).forEach((i) => (goes[i].kind = 'altogether'));
  }
  return { seed, level, colour, goes };
}

/** The tell of a shell for the "at most 2 share it" check: odd or even. */
const parity = (n: number) => n % 2;

/**
 * The three wrong shells: the tempting slips first (in an order fixed by the seed), then plain one-off and two-off
 * numbers to fill up. A slip is left out when it would make three shells the same odd or even as the answer, so
 * elimination by shape leaves two choices, not one (R5 3.1 rule 6). Never the answer, a repeat or a negative.
 */
function threeWrongs(answer: number, slips: Wrong<WrongKind>[], random: () => number): Wrong<WrongKind>[] {
  // Every tray holds a one-off number (the tempting near miss); which side is the seed's choice.
  const side = random() < 0.5 ? 1 : -1;
  const near = tagWrongs([answer + side, answer - side], (n) => (n < 0 ? null : 'off1'));
  const fillers = tagWrongs([answer + 2, answer - 2, answer + 3], (n) => (n < 0 ? null : 'off1'));
  const pool = [...near.slice(0, 1), ...shuffle(slips, random), ...near.slice(1), ...fillers].filter(
    (w, i, all) => w.n !== answer && w.n >= 0 && all.findIndex((x) => x.n === w.n) === i,
  );
  const out: Wrong<WrongKind>[] = [];
  for (const w of pool) if (out.length < 3 && atMostShareTell(answer, [...out, w].map((x) => x.n), parity)) out.push(w);
  for (const w of pool) if (out.length < 3 && !out.includes(w)) out.push(w); // only if the check can't be met
  return out;
}

/** A go made again from its plan, with its shells in an order fixed by the seed. Null if the plan isn't one that can be made. */
export function showGo(round: Pick<Round, 'seed'>, index: number, plan: GoPlan): Go | null {
  const p = parseKey(plan.key);
  if (!p) return null;
  const random = seeded((round.seed + 7919 * (index + 1)) % MAX_SEED);
  const { whole, shown } = p;
  const hidden = whole - shown;
  const make = (answer: number, slips: Wrong<WrongKind>[]) => {
    const wrongs = threeWrongs(answer, slips, random);
    return { wrongs, choices: shuffle([answer, ...wrongs.map((w) => w.n)], random) };
  };
  if (plan.kind === 'hiding') {
    const slips: Wrong<WrongKind>[] = [{ n: shown, kind: 'shown' }, { n: whole, kind: 'whole' }, { n: whole + shown, kind: 'add' }];
    return { ...plan, whole, showing: shown, hiding: hidden, answer: hidden, spoken: `${whole} pipi. How many are hiding?`, ...make(hidden, slips) };
  }
  if (plan.kind === 'twoTides') {
    if (shown === 0 || shown === whole) return null;
    // The first tide hid `shown` pipi, so that is the number a child who missed the swap gives.
    const slips: Wrong<WrongKind>[] = [{ n: shown, kind: 'before' }, { n: whole, kind: 'whole' }];
    return {
      ...plan, whole, showing: shown, hiding: hidden, before: hidden, answer: hidden,
      spoken: `Splash! The hiding ones pop up and the others dig in. ${whole} pipi. How many are hiding now?`,
      ...make(hidden, slips),
    };
  }
  if (plan.kind === 'altogether') {
    if (shown === 0 || shown === whole) return null;
    const slips: Wrong<WrongKind>[] = [{ n: shown, kind: 'part' }, { n: hidden, kind: 'part' }, { n: whole + 1, kind: 'off1' }, { n: whole - 1, kind: 'off1' }];
    return { ...plan, whole, showing: shown, hiding: hidden, answer: whole, spoken: `${shown} here, and ${hidden} popped up. How many pipi altogether?`, ...make(whole, slips) };
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
