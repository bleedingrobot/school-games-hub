/**
 * One day's challenge at Penguin Pairs (docs/KORORA-PLAN.md sections 2 and 3): ten goes by Kororā's mirror pool, each a
 * double ("4 fish on the rock and 4 in the water: how many fish?") or a half ("share 12 fish fairly between the two
 * chicks: how many each?"), and four numbers to choose from.
 *
 * The facts are the shared doubles and halves (`dbl:7`, `half:14` in shared/maths/skillPacks/earlyFacts.ts, families
 * dblHalf10 and dblHalf20). Nothing here works out a double itself: the shared pack makes each question and its wording
 * from the key. The wrong choices are this game's own (`mistakeChoices`, maths review R5): each is a real mistake.
 *
 * Level 5 (R8, near doubles 5 + 6 to 8 + 9) uses Weka's own add facts (`add:6+7`, the add-sub pack's keys, nothing new in
 * shared/maths): the picture is the double and one fish more. Its records are the same ones Weka reads.
 *
 * The level (doubles 1 to 5, halves 2 to 10, doubles 6 to 10, halves 12 to 20, near doubles) comes from the child's records, as Hop
 * picks its step: a level is passed when 70% of its facts are in box 2 or higher, and the server keeps the furthest level
 * reached, so a child never drops back. Each level has five facts, so a round asks each of today's facts once, then
 * the weakest again, then (from level 2) a few from the levels before. A fact asked twice counts once for the records.
 */
import { helpForFact, type FactRung } from '../kit/help';
import type { FactStats } from '../maths/leitner';
import { STEP_SECURE_SHARE } from '../maths/selector';
import { BandedPack } from '../maths/banded';
import { BANDED_PACKS } from '../maths/skillPacks';
import { earlyFactsPack } from '../maths/skillPacks/earlyFacts';
import { atMostShareTell, tagWrongs, type Wrong } from '../kit/mistakes';
import { seeded } from '../seededRandom';
import type { Help } from './progress';

export const GOES_PER_ROUND = 10;
/** From level 2 on, this many goes come from the levels before (the rest are today's level). */
export const REVIEW_GOES = 3;
/** Gold days end with this many "fair or not?" goes (odd and even, recorded: James, 4 Nov 2026). */
export const FAIR_GOES = 2;

export const LEVELS = [
  { level: 1, kind: 'double', from: 1, to: 5 },
  { level: 2, kind: 'half', from: 2, to: 10 },
  { level: 3, kind: 'double', from: 6, to: 10 },
  { level: 4, kind: 'half', from: 12, to: 20 },
  /** Near doubles: `from` is the smaller number, so 5 is 5 + 6 and 8 is 8 + 9. */
  { level: 5, kind: 'near', from: 5, to: 8 },
] as const;
export type Level = (typeof LEVELS)[number]['level'];
export type Kind = 'double' | 'half' | 'fair' | 'near';
/** The top level: once its facts are secure the child stays here. */
export const TOP_LEVEL = 5 as const;

/** The guided first go (plan section 6): double 2. */
export const GUIDED_KEY = 'dbl:2';

export const MAX_SEED = 2147483647;
export const isSeed = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MAX_SEED;
export const isLevel = (n: unknown): n is Level => LEVELS.some((l) => l.level === n);

/** `dbl:7` → double 7; `half:14` → half of 14; `oddeven:7` → can 7 fish be shared fairly?; `add:6+7` → near double, n is 6. */
export const parseKey = (key: string): { kind: Kind; n: number } | null => {
  const near = /^add:(\d+)\+(\d+)$/.exec(key);
  if (near) return Number(near[2]) === Number(near[1]) + 1 ? { kind: 'near', n: Number(near[1]) } : null;
  const m = /^(dbl|half|oddeven):(\d+)$/.exec(key);
  return m ? { kind: m[1] === 'dbl' ? 'double' : m[1] === 'half' ? 'half' : 'fair', n: Number(m[2]) } : null;
};

/** The "fair or not?" facts at a level: a real pile of 6 to 10 fish at levels 1 and 2, 6 to 20 from level 3 (R9). */
export const fairKeys = (level: Level): string[] => {
  const [from, to] = level <= 2 ? [6, 10] : [6, 20];
  return Array.from({ length: to - from + 1 }, (_, i) => `oddeven:${from + i}`);
};

/** A level's five facts: `dbl:1` to `dbl:5`, `half:2` to `half:10` and so on. */
export function levelKeys(level: Level): string[] {
  const { kind, from, to } = LEVELS.find((l) => l.level === level)!;
  const keys: string[] = [];
  for (let n = from; n <= to; n += kind === 'half' ? 2 : 1) keys.push(kind === 'near' ? `add:${n}+${n + 1}` : `${kind === 'half' ? 'half' : 'dbl'}:${n}`);
  return keys;
}

export function levelShare(stats: Iterable<FactStats>, level: Level): number {
  const box = new Map([...stats].map((s) => [s.key, s.box]));
  const keys = levelKeys(level);
  return keys.filter((k) => (box.get(k) ?? 0) >= 2).length / keys.length;
}

/** Near doubles (the top level) are secure: at least 70% of their facts at box 2 or more. The "what's next" card waits for this. */
export const topSecure = (stats: Iterable<FactStats>): boolean => levelShare(stats, TOP_LEVEL) >= STEP_SECURE_SHARE;

/** Today's level: the first not yet secure, never below the furthest reached. Once near doubles are secure the child stays there. */
export function levelFor(stats: Iterable<FactStats>, reached: Level = 1): Level {
  const list = [...stats];
  const next = LEVELS.find((l) => l.level >= reached && levelShare(list, l.level) < STEP_SECURE_SHARE);
  return next ? next.level : TOP_LEVEL;
}

export const HELPS: readonly Help[] = ['full', 'faint', 'none'];
export const isHelp = (v: unknown): v is Help => HELPS.includes(v as Help);

/**
 * The picture help for a fact from the child's own record of it (maths review R6, Weka's way with Penguin Pairs' three
 * states): full until the fact is secure (box 2) and has been right and quick (box 2 and one quick day, or right every time so far; S25); faint until it is
 * fluent (box 4) and right 6 times; then none. A wrong answer drops a fact to box 1, so its full picture comes back, and a
 * new level's facts have no record, so they start full.
 */
const HELP_LADDER: readonly FactRung<Help>[] = [
  { help: 'full', until: { box: 2, quickDays: 1 } },
  { help: 'faint', until: { box: 4, correct: 6 } },
  { help: 'none' },
];
export const helpForStats = (stats: Pick<FactStats, 'box' | 'correct' | 'attempts' | 'quickDays'> | undefined): Help => helpForFact(stats, HELP_LADDER);

/**
 * One go as saved: the fact, how the shared pack words it (0 or 1: "4 + 4" or "Double 4"; halves always "Half of 12") and
 * its picture help. `h` is missing on a round saved before R6: that go shows the calendar's help for the round (the browser falls back).
 */
export interface GoPlan {
  key: string;
  v: 0 | 1;
  h?: Help;
}

/** What the server saves when a challenge starts, and the browser is sent. */
export interface Round {
  seed: number;
  level: Level;
  gold: boolean;
  goes: GoPlan[];
}

/** A go as shown. */
export interface Go extends GoPlan {
  kind: Kind;
  /** Fish on the rock (doubles), or fish in the pile (halves and fair or not). */
  n: number;
  answer: number;
  /** The shared pack's question, as parts: ["Double", "4", "=", "?"]. */
  parts: string[];
  /** The words read aloud. They never say the answer. */
  spoken: string;
  /** Four numbers, the right one among them; for fair or not two: 1 (fair: even) and 0 (one left over: odd). */
  choices: number[];
  /** The three wrong numbers among the choices and the mistake behind each (maths review R5). Empty for fair or not (R9). */
  wrongs: Wrong<WrongKind>[];
}

/**
 * The mistake behind a wrong number (docs/kit/README.md, "Doubles and halves"). Doubles: `same` (n, forgot to double),
 * `plus1` (n + 1), `plus2` (n + 2, from n of 3), `miscount` (2n off by 1, or 2 where the others run short). Halves: `all`
 * (n, did not share), `minus2` (n - 2), `double` (2n), `miscount` (n/2 off by 1, or 2). Near doubles (n + n+1):
 * `noExtra` (2n, the double without the extra fish), `bigger` (2n + 2, the bigger number doubled), `miscount` (the answer off by 2).
 */
export type WrongKind = 'same' | 'plus1' | 'plus2' | 'miscount' | 'all' | 'minus2' | 'double' | 'noExtra' | 'bigger';

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

/** The same fact never comes twice in a row: a repeat swaps with a later go where it fits. */
function spreadOut(keys: string[]): string[] {
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

/**
 * A double straight before its half (double 6, then half of 12), when a round has both, so the child sees the same
 * picture run backwards. The half moves to just after its double unless that would put a fact twice in a row.
 */
export function pairUp(keys: string[]): string[] {
  let out = [...keys];
  const twiceInARow = (list: string[]) => list.some((k, i) => i > 0 && list[i - 1] === k);
  for (const key of keys) {
    const fact = parseKey(key);
    if (fact?.kind !== 'double') continue;
    const half = `half:${2 * fact.n}`;
    const i = out.indexOf(key);
    const j = out.indexOf(half);
    if (j === -1 || j === i + 1) continue;
    const moved = out.filter((_, x) => x !== j);
    moved.splice(moved.indexOf(key) + 1, 0, half);
    if (!twiceInARow(moved)) out = moved;
  }
  return out;
}

/** True when go `index` is the half of the double just before it ("Double 6 is 12. So what is half of 12?"). */
export const followsItsDouble = (goes: readonly GoPlan[], index: number): boolean => {
  const now = parseKey(goes[index]?.key ?? '');
  const before = parseKey(goes[index - 1]?.key ?? '');
  return now?.kind === 'half' && before?.kind === 'double' && before.n * 2 === now.n;
};

/**
 * Today's challenge from a fresh seed, the child's records, the furthest level reached, whether it is a gold day and
 * whether it is the child's very first challenge (double 2 comes first). The same inputs always give the same round.
 */
export function makeRound(seed: number, stats: Iterable<FactStats>, opts: { reached?: Level; level?: Level; gold?: boolean; guided?: boolean } = {}): Round {
  if (!isSeed(seed)) throw new RangeError(`Bad seed ${seed}`);
  const list = [...stats];
  // A saved level is used as is, so records from replays can't move it; with none it comes from the records.
  const level = opts.level ?? levelFor(list, opts.reached);
  const random = seeded(seed);
  random(); random(); // the first draws of this generator are close together for close seeds
  const box = new Map(list.map((s) => [s.key, s.box]));
  const byKey = new Map(list.map((s) => [s.key, s]));
  const today = levelKeys(level);
  const earlier = LEVELS.filter((l) => l.level < level).flatMap((l) => levelKeys(l.level));
  const review = weakest(earlier, Math.min(REVIEW_GOES, earlier.length), box, random);
  const fair = opts.gold ? FAIR_GOES : 0;
  const again = weakest(today, Math.max(0, GOES_PER_ROUND - fair - today.length - review.length), box, random);
  // On gold days two of the review (or repeat) goes make room for the fair-or-not goes at the end.
  const main = [...today, ...again, ...review].slice(0, GOES_PER_ROUND - fair);
  let keys = [...pairUp(spreadOut(shuffle(main, random))), ...weakest(fairKeys(level), fair, box, random)];
  if (opts.guided) {
    // Double 2 first (it is always in level 1), then the rest without a second double 2 straight after.
    const rest = [...keys];
    rest.splice(rest.indexOf(GUIDED_KEY), 1);
    keys = spreadOut([GUIDED_KEY, ...rest]);
  }
  // Doubles are "4 + 4" or "Double 4" (the pack's variants 0 and 1). Halves are always "Half of 12" (variant 0), never
  // "12 ÷ 2", for five-year-olds. Fair or not has one way (0).
  const goes = keys.map((key): GoPlan => ({ key, v: key.startsWith('dbl:') && random() < 0.5 ? 0 : key.startsWith('dbl:') ? 1 : 0, h: helpForStats(byKey.get(key)) }));
  return { seed, level, gold: !!opts.gold, goes };
}

const pack = earlyFactsPack();
/** Weka's add facts, which near doubles read from (`add:6+7`). */
const addPack = new BandedPack(BANDED_PACKS['add-sub']);

/** Fair or not has two choices: 1 is fair (an even pile) and 0 is one left over (an odd pile). */
export const FAIR_CHOICES = [1, 0] as const;

/** What is read aloud: the story of the go, never the answer. */
export function spokenFor(kind: Kind, n: number, guided = false): string {
  const line = kind === 'double'
    ? `Double ${n}. ${n} fish on the rock, and ${n} in the water. How many fish?`
    : kind === 'half'
      ? `Half of ${n}. Share ${n} fish fairly between the two chicks. How many does each chick get?`
      : kind === 'near'
        ? `${n} and ${n + 1}. ${n} fish on the rock, and ${n + 1} in the water. How many fish?`
        : `${n} fish. Share them into the two bowls, two at a time. Is it fair, or is one left over?`;
  return guided ? `${line} Tap the number the hand points to.` : line;
}

/**
 * The three wrong numbers of a double or a half, each tagged with its kind, and the four choices in an order fixed by the
 * seed. Never the pack's n times n (25 for 5 + 5, a times-tables slip). The tell is parity: at most two of the four share
 * the right answer's, so shape alone can't pick it out (shared/kit/mistakes.ts). Of the choices that fit, the one showing
 * the most different kinds wins, ties broken by the seed.
 */
export function mistakeChoices(kind: 'double' | 'half' | 'near', n: number, random: () => number): { choices: number[]; wrongs: Wrong<WrongKind>[] } {
  const answer = kind === 'double' ? 2 * n : kind === 'near' ? 2 * n + 1 : n / 2;
  const core: [number, WrongKind][] =
    kind === 'near'
      ? [[2 * n, 'noExtra'], [2 * n + 2, 'bigger'], [answer - 2, 'miscount'], [answer + 2, 'miscount']]
      : kind === 'double'
      ? [[n, 'same'], [n + 1, 'plus1'], [answer - 1, 'miscount'], [answer + 1, 'miscount'], ...(n >= 3 ? ([[n + 2, 'plus2']] as [number, WrongKind][]) : [])]
      : [[n, 'all'], [n - 2, 'minus2'], [2 * n, 'double'], [answer - 1, 'miscount'], [answer + 1, 'miscount']];
  // Short of three (small numbers, where kinds land on the answer or on each other): a count that is two or three off.
  const spare: [number, WrongKind][] = [answer + 2, answer - 2, answer + 3, answer - 3].map((x) => [x, 'miscount']);
  const make = (list: [number, WrongKind][]) => {
    const kinds = new Map<number, WrongKind>();
    for (const [x, k] of list) if (!kinds.has(x)) kinds.set(x, k);
    return tagWrongs([...kinds.keys()].filter((x) => x >= 1 && x !== answer), (x) => kinds.get(x) ?? null);
  };
  let pool = make(core);
  if (pool.length < 3) pool = make([...core, ...spare]);
  const parity = (x: number) => x % 2;
  const combos: Wrong<WrongKind>[][] = [];
  for (let a = 0; a < pool.length; a++)
    for (let b = a + 1; b < pool.length; b++) for (let c = b + 1; c < pool.length; c++) combos.push([pool[a], pool[b], pool[c]]);
  const rank = (c: Wrong<WrongKind>[]) => (atMostShareTell(answer, c.map((w) => w.n), parity) ? 10 : 0) + new Set(c.map((w) => w.kind)).size;
  const best = Math.max(...combos.map(rank));
  const top = combos.filter((c) => rank(c) === best);
  const wrongs = top[Math.floor(random() * top.length)];
  return { choices: shuffle([answer, ...wrongs.map((w) => w.n)], random), wrongs };
}

/** A go made again from its plan by the shared pack, with its choices in an order fixed by the seed. Null if the plan isn't one the pack could make. */
export function showGo(round: Pick<Round, 'seed'>, index: number, plan: GoPlan): Go | null {
  const fact = parseKey(plan.key);
  if (!fact || (plan.v !== 0 && plan.v !== 1)) return null;
  if (fact.kind === 'near' && plan.v !== 0) return null;
  const random = seeded((round.seed + 7919 * (index + 1)) % MAX_SEED);
  const q = fact.kind === 'near' ? addPack.rebuild(plan.key, [fact.n, fact.n + 1, 0], true, random) : pack.rebuild(plan.key, [fact.n, plan.v], true, random);
  const answer = fact.kind === 'double' ? 2 * fact.n : fact.kind === 'near' ? 2 * fact.n + 1 : fact.kind === 'half' ? fact.n / 2 : fact.n % 2 === 0 ? 1 : 0;
  if (!q || !q.choices || q.answer !== answer) return null;
  const base = { ...plan, kind: fact.kind, n: fact.n, answer, parts: q.parts, spoken: spokenFor(fact.kind, fact.n) };
  // Our own choices, from a stream of the seed apart from the pack's (the server rebuilds the same ones).
  const own = seeded((round.seed + 104729 * (index + 1)) % MAX_SEED);
  own(); own();
  if (fact.kind === 'fair') return { ...base, choices: shuffle([...FAIR_CHOICES], own), wrongs: [] }; // two choices, no stone mistakes
  return { ...base, ...mistakeChoices(fact.kind, fact.n, own) };
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
 * A "sister" of a go for "Now you try one like it" (S32 part 4): a neighbouring number of the same kind and help: a double
 * or near double of n up or down by one, the half of the next even number (two up or down), or (fair or not) another pile of the
 * opposite kind. It stays inside the numbers the game's keys ask (doubles 1 to 10, halves 2 to 20 in twos, near doubles 5 + 6
 * to 8 + 9, piles 6 to 10 or 20) and, where it can, inside the same level as the go and with an answer that is not one of
 * the original's cards. Built by showGo so its cards and answer agree, with the words the voice list already holds. Local only: never
 * sent or saved. Null if there is no sister.
 */
export function sisterGo(round: Pick<Round, 'seed' | 'level'>, index: number, go: Go): Go | null {
  const own = LEVELS.find((l) => levelKeys(l.level).includes(go.key));
  const prefix = go.kind === 'double' ? 'dbl' : go.kind === 'half' ? 'half' : go.kind === 'fair' ? 'oddeven' : 'add';
  const keyOf = (n: number) => (go.kind === 'near' ? `add:${n}+${n + 1}` : `${prefix}:${n}`);
  const step = go.kind === 'half' ? 2 : 1;
  const all = go.kind === 'fair' ? fairKeys(round.level) : LEVELS.filter((l) => l.kind === (go.kind === 'near' ? 'near' : go.kind)).flatMap((l) => levelKeys(l.level));
  const valid = (n: number) => all.includes(keyOf(n));
  const inLevel = (n: number) => (own ? levelKeys(own.level).includes(keyOf(n)) : true);
  const near = [go.n - step, go.n + step].filter((n) => n !== go.n && valid(n));
  // Fair or not: another pile, the opposite kind first (an odd pile for an even one), then any other.
  const piles = go.kind === 'fair' ? all.map((k) => Number(k.split(':')[1])).filter((n) => n !== go.n) : [];
  const pool = go.kind === 'fair' ? [...piles.filter((n) => n % 2 !== go.n % 2 && Math.abs(n - go.n) <= 3), ...piles.filter((n) => n % 2 !== go.n % 2), ...piles] : near;
  const random = seeded((round.seed + 15485863 + 31 * index) % MAX_SEED);
  random(); random();
  const rank = (n: number) => (inLevel(n) ? 0 : 2) + (go.choices.includes(showGo(round, index + 101, { key: keyOf(n), v: go.v, h: go.h })?.answer ?? -1) ? 1 : 0);
  const order = go.kind === 'fair' ? [...new Set(pool)] : shuffle([...new Set(pool)], random).sort((a, b) => rank(a) - rank(b));
  for (const n of order) {
    const sister = showGo(round, index + 101, { key: keyOf(n), v: go.v, h: go.h });
    if (sister && (go.kind === 'fair' ? sister.n !== go.n : sister.answer !== go.answer)) return sister;
  }
  return null;
}
