/**
 * One day's challenge at Weka's Stepping Stones (docs/WEKA-PLAN.md sections 2 to 4): ten goes across the stream, each an
 * adding fact that crosses ten ("Weka is on 8 and hops 5 more": 8 + 2 to the big rock, then 3 more, 13), and four
 * numbers to choose from.
 *
 * The facts are the hub's shared adding facts (`add:5+8` in shared/maths/skillPacks/addSub.ts, ladder skill `facts-20`):
 * the twenty with both numbers 9 or less and a total of 11 to 18. Nothing here works out a sum itself: the shared pack
 * makes each question, its wording and its wrong choices from the key and its variant, exactly as anywhere else on the
 * hub. The variants used: 1 "8 + 5" (bigger first), 0 "5 + 8" (smaller first: start on the bigger number) and, on gold
 * days, 2 "13 − 5" (hop back across ten), which the shared family records against the same fact.
 *
 * The level (starting on 9, on 8, on 7 or 6, then mixed) comes from the child's records, as Hop picks its step: a level
 * is passed when 70% of its facts are in box 2 or higher, and the server keeps the furthest level reached.
 *
 * How much each go helps comes from the child's own record of that fact (plan section 4): a fact they are still
 * learning (box 0 or 1) gets the full picture and the two steps (to the big rock, then on); a secure one (box 2) the faint
 * picture and one tap; a fact they know well (box 3 or 4) the numbers only. So the help fades fact by fact as the
 * records show it is known, and comes back if they slip (a wrong answer drops a fact to box 1).
 */
import type { FactStats } from '../maths/leitner';
import { STEP_SECURE_SHARE } from '../maths/selector';
import { addSubPack } from '../maths/skillPacks/addSub';
import { seeded } from '../seededRandom';

export const GOES_PER_ROUND = 10;
/** From level 2 on, this many goes come from the levels before (the rest are today's level). */
export const REVIEW_GOES = 3;
/** Gold days end with this many hop-back goes (13 − 5). */
export const BACK_GOES = 2;
/** On silver and gold days, about this share of goes put the smaller number first (5 + 8). */
export const TURN_SHARE = 0.3;

export const LEVELS = [
  { level: 1, starts: [9] },
  { level: 2, starts: [8] },
  { level: 3, starts: [7, 6] },
  { level: 4, starts: [9, 8, 7, 6] },
] as const;
export type Level = (typeof LEVELS)[number]['level'];

/** How a go is asked: bigger number first, smaller first, or hopping back from the total. */
export type Kind = 'add' | 'turn' | 'back';
/** How much a go's picture helps: every stone and the two steps, every fifth stone and one tap, or the numbers only. */
export type Help = 'full' | 'faint' | 'none';
/** The kind of day, from the stones' colours: silver and gold days mix in smaller-first goes, gold days end hopping back. */
export type Day = 'bronze' | 'silver' | 'gold';

/** The guided first go (plan section 6): 9 + 2. */
export const GUIDED_KEY = 'add:2+9';

export const MAX_SEED = 2147483647;
export const isSeed = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MAX_SEED;
export const isLevel = (n: unknown): n is Level => LEVELS.some((l) => l.level === n);

/** `add:5+8` → the smaller and bigger numbers. Only the twenty facts that cross ten. */
export const parseKey = (key: string): { small: number; big: number } | null => {
  const m = /^add:(\d+)\+(\d+)$/.exec(key);
  if (!m) return null;
  const small = Number(m[1]);
  const big = Number(m[2]);
  return small >= 1 && small <= big && big <= 9 && small + big > 10 ? { small, big } : null;
};

/** The facts that start on these numbers: `add:2+9` to `add:9+9` for 9. */
const startingOn = (starts: readonly number[]) =>
  starts.flatMap((big) => Array.from({ length: big }, (_, i) => i + 1).filter((small) => small + big > 10).map((small) => `add:${small}+${big}`));

/** A level's facts: 8 starting on 9, 6 on 8, 6 on 7 or 6, and all 20 mixed. */
export function levelKeys(level: Level): string[] {
  return startingOn(LEVELS.find((l) => l.level === level)!.starts);
}
export const ALL_KEYS = levelKeys(4);

export function levelShare(stats: Iterable<FactStats>, level: Level): number {
  const box = new Map([...stats].map((s) => [s.key, s.box]));
  const keys = levelKeys(level);
  return keys.filter((k) => (box.get(k) ?? 0) >= 2).length / keys.length;
}

/** Today's level: the first not yet secure, never below the furthest reached. Once all are secure the child stays mixed. */
export function levelFor(stats: Iterable<FactStats>, reached: Level = 1): Level {
  const list = [...stats];
  const next = LEVELS.find((l) => l.level >= reached && levelShare(list, l.level) < STEP_SECURE_SHARE);
  return next ? next.level : 4;
}

/** The help for a fact from its box: learning (0 to 1) full, secure (2) faint, known well (3 to 4) none. */
export const helpForBox = (box: number): Help => (box >= 3 ? 'none' : box >= 2 ? 'faint' : 'full');

/** One go as saved: the fact, how the shared pack asks it (0 smaller first, 1 bigger first, 2 hop back) and its help. */
export interface GoPlan {
  key: string;
  v: 0 | 1 | 2;
  h: Help;
}

/** What the server saves when a challenge starts, and the browser is sent. */
export interface Round {
  seed: number;
  level: Level;
  /** The kind of day: silver and gold days mix in smaller-first goes, gold days end with hop-backs. */
  day: Day;
  goes: GoPlan[];
}

/** A go as shown. */
export interface Go extends GoPlan {
  kind: Kind;
  small: number;
  big: number;
  total: number;
  /** The stone Weka starts on: the bigger number, or the total when hopping back. */
  from: number;
  /** Hops to the big rock (10), then the hops after it: 8 + 5 is 2 then 3; 13 − 5 is 3 back then 2 back. */
  toTen: number;
  rest: number;
  answer: number;
  /** The shared pack's question, as parts: ["8", "+", "5", "=", "?"]. */
  parts: string[];
  /** Four numbers, the right one among them. */
  choices: number[];
  /** The first step on full-help goes ("how many hops to the big rock?"): four numbers, smallest first. Help only, never sent. */
  toTenChoices: number[];
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
 * Today's challenge from a fresh seed, the child's records, the furthest level reached, the kind of day and whether it
 * is the child's very first challenge (9 + 2 comes first, with full help). The same inputs always give the same round.
 */
export function makeRound(seed: number, stats: Iterable<FactStats>, opts: { reached?: Level; day?: Day; guided?: boolean } = {}): Round {
  if (!isSeed(seed)) throw new RangeError(`Bad seed ${seed}`);
  const list = [...stats];
  const day = opts.day ?? 'bronze';
  const level = levelFor(list, opts.reached);
  const random = seeded(seed);
  random(); random(); // the first draws of this generator are close together for close seeds
  const box = new Map(list.map((s) => [s.key, s.box]));
  const today = levelKeys(level);
  const earlier = level === 4 ? [] : LEVELS.filter((l) => l.level < level).flatMap((l) => levelKeys(l.level));
  const backs = day === 'gold' ? BACK_GOES : 0;
  const main = GOES_PER_ROUND - backs;
  // Review makes room so every fact of today's level still comes (on gold days too).
  const review = weakest(earlier, Math.min(REVIEW_GOES, earlier.length, Math.max(0, main - today.length)), box, random);
  // Every fact of the level once (the weakest ten, when mixed), then the weakest again, then the review.
  const once = weakest(today, Math.min(today.length, main - review.length), box, random);
  const again = weakest(today, Math.max(0, main - once.length - review.length), box, random);
  let keys = spreadOut(shuffle([...once, ...again, ...review], random));
  const back = weakest(today, backs, box, random);
  keys = spreadOut([...keys, ...back]);
  if (opts.guided) {
    // 9 + 2 first (it is always in level 1), then the rest without a second 9 + 2 straight after.
    const rest = [...keys];
    const at = rest.indexOf(GUIDED_KEY);
    rest.splice(at === -1 ? 0 : at, 1);
    keys = spreadOut([GUIDED_KEY, ...rest]);
  }
  const goes = keys.map((key, i): GoPlan => {
    const v: GoPlan['v'] = i >= GOES_PER_ROUND - backs ? 2 : day !== 'bronze' && !(opts.guided && i === 0) && random() < TURN_SHARE ? 0 : 1;
    const h = opts.guided && i === 0 ? 'full' : helpForBox(box.get(key) ?? 0);
    return { key, v, h };
  });
  return { seed, level, day, goes };
}

const pack = addSubPack();

/** The first step's four numbers: the hops to the big rock and three near it, all 1 to 9, smallest first. */
export function toTenChoicesFor(toTen: number): number[] {
  const out = [toTen];
  for (const d of [1, -1, 2, -2, 3, 4]) {
    const n = toTen + d;
    if (n >= 1 && n <= 9 && out.length < 4) out.push(n);
  }
  return out.sort((a, b) => a - b);
}

/** A go made again from its plan by the shared pack, with its choices in an order fixed by the seed. Null if the plan isn't one the pack could make. */
export function showGo(round: Pick<Round, 'seed'>, index: number, plan: GoPlan): Go | null {
  const fact = parseKey(plan.key);
  if (!fact || ![0, 1, 2].includes(plan.v) || !['full', 'faint', 'none'].includes(plan.h)) return null;
  const { small, big } = fact;
  const total = small + big;
  const q = pack.rebuild(plan.key, [small, big, plan.v], true, seeded((round.seed + 7919 * (index + 1)) % MAX_SEED));
  const kind: Kind = plan.v === 2 ? 'back' : plan.v === 0 ? 'turn' : 'add';
  const answer = kind === 'back' ? big : total;
  if (!q || !q.choices || q.answer !== answer) return null;
  const toTen = kind === 'back' ? total - 10 : 10 - big;
  return {
    ...plan, kind, small, big, total, from: kind === 'back' ? total : big, toTen, rest: small - toTen, answer,
    parts: q.parts, choices: q.choices, toTenChoices: toTenChoicesFor(toTen),
  };
}

/** Every go of a round as shown. Throws if a saved round has a go the pack can't make. */
export function showRound(round: Round): Go[] {
  return round.goes.map((plan, i) => {
    const go = showGo(round, i, plan);
    if (!go) throw new Error(`Go ${i} (${plan.key}) can't be made`);
    return go;
  });
}

// ---------------------------------------------------------------- what Bella says (never the answer)

type Said = Pick<Go, 'kind' | 'small' | 'big' | 'total' | 'toTen' | 'rest'>;

/** The question, for a one-tap go (faint or no help). */
export function askLine(go: Said, guided = false): string {
  const line = go.kind === 'back'
    ? `${go.total} take away ${go.small}. Weka is on ${go.total} and hops back ${go.small}. Where will Weka land?`
    : go.kind === 'turn'
      ? `${go.small} plus ${go.big}. Start on the bigger number. Where will Weka land?`
      : `${go.big} plus ${go.small}. Weka is on ${go.big} and hops ${go.small} more. Where will Weka land?`;
  return guided ? `${line} Tap the number the hand points to.` : line;
}

/** The first step of a full-help go: how many hops to the big rock? */
export function toTenLine(go: Said, guided = false): string {
  const line = go.kind === 'back'
    ? `${go.total} take away ${go.small}. Weka is on ${go.total}. How many hops back to the big rock?`
    : go.kind === 'turn'
      ? `${go.small} plus ${go.big}. Start on the bigger number, ${go.big}. How many hops to the big rock?`
      : `${go.big} plus ${go.small}. Weka is on ${go.big}. How many hops to the big rock?`;
  return guided ? `${line} Tap the number the hand points to.` : line;
}

/** The make-ten sentence: "8 and 2 make 10. Then 3 more." (the second wrong tap's hint, and the start of step two). */
export function stemLine(go: Said): string {
  return go.kind === 'back'
    ? `${go.total} back ${go.toTen} makes 10. Then ${go.rest} more back.`
    : `${go.big} and ${go.toTen} make 10. Then ${go.rest} more.`;
}

/** The second step of a full-help go, once Weka is on the big rock. */
export const fromTenLine = (go: Said): string => `${stemLine(go)} Where will Weka land?`;
