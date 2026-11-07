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
 * How much each go helps comes from the child's own record of that fact (plan section 4, made to last longer on
 * 6 Nov 2026): 'full' (the picture, the two steps, then the pebbles) until it has been right quickly on two different
 * days; then 'split' (the child splits the number to get to ten before answering, then the pebbles) until it is fluent
 * and right 8 times; then 'faint' (one tap) until right 12 times; then 'none'. So the help fades fact by fact as the
 * records show it is known, and comes back if they slip (a wrong answer drops a fact to box 1, back to full help).
 */
import { helpForFact, type FactRung } from '../kit/help';
import { atMostShareTell, tagWrongs, type Wrong } from '../kit/mistakes';
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
/**
 * How much a go helps: 'full' every stone and the two steps (hops to the big rock, then on); 'split' the child splits
 * the number they add first (what gets to ten, and the rest), then answers; 'faint' every fifth stone and one tap;
 * 'none' the numbers only. Full and split goes also repeat the question with pebbles in two ten-frames after a right
 * answer (James, 6 Nov 2026).
 */
export type Help = 'full' | 'split' | 'faint' | 'none';
export const HELPS: readonly Help[] = ['full', 'split', 'faint', 'none'];
/** Whether a go's help repeats the question with pebbles in ten-frames (adding goes only; hop-backs skip it). */
export const pebblesFor = (help: Help): boolean => help === 'full' || help === 'split';
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

/** Right answers before the split-first help gives way to the faint picture, and before that gives way to none. */
export const SPLIT_UNTIL_RIGHT = 8;
export const FAINT_UNTIL_RIGHT = 12;

/**
 * The help for a fact from its record (made to last longer, James 6 Nov 2026): full until it is secure (box 2) and has
 * been right quickly on two different days; split-first until it is fluent (box 4) and right 8 times; faint until right
 * 12 times; then none. A wrong answer drops the fact to box 1, so full help comes back.
 */
const HELP_LADDER: readonly FactRung<Help>[] = [
  { help: 'full', until: { box: 2, quickDays: 2 } },
  { help: 'split', until: { box: 4, correct: SPLIT_UNTIL_RIGHT } },
  { help: 'faint', until: { correct: FAINT_UNTIL_RIGHT } },
  { help: 'none' },
];
export const helpForStats = (stats: Pick<FactStats, 'box' | 'correct' | 'quickDays'> | undefined): Help => helpForFact(stats, HELP_LADDER);

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
  /** The three wrong choices and the mistake behind each (maths review R5). */
  wrongs: Wrong<LandKind>[];
  /** The first step on full-help goes ("how many hops to the big rock?"): four numbers, smallest first. Help only, never sent. */
  toTenChoices: number[];
  /** The wrong ones among them, with their mistakes. */
  toTenWrongs: Wrong<ToTenKind>[];
}

/**
 * The mistakes behind the wrong choices (maths review R5 section 3.7).
 * Where Weka lands: `rock` stopped at the big rock (10); `double` ten and the whole small number (8 + 5: 15, forgetting the
 * 2 already used); `part` the bigger number and only the leftover (8 + 5: 11, never reaching the rock); `off1` one stone
 * out (counting the hops by ones); hopping back, `rock` stopped at the rock and `add` hopped up the line (13 + 5).
 */
export type LandKind = 'rock' | 'double' | 'part' | 'off1' | 'add';
/** Hops to the big rock: `other` is the whole small number, `ten` is the rock's own number, `near` is one or two out. */
export type ToTenKind = 'other' | 'ten' | 'near';

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
  const record = new Map(list.map((s) => [s.key, s]));
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
    const h = opts.guided && i === 0 ? 'full' : helpForStats(record.get(key));
    return { key, v, h };
  });
  return { seed, level, day, goes };
}

const pack = addSubPack();

/** The first step's wrong numbers: the whole small number, the rock's 10 and one near miss. */
export function toTenWrongsFor(toTen: number, small: number): Wrong<ToTenKind>[] {
  const kinds = new Map<number, ToTenKind>();
  for (const [n, kind] of [[small, 'other'], [10, 'ten'], [toTen + 1, 'near'], [toTen - 1, 'near'], [toTen + 2, 'near']] as const) {
    if (n >= 1 && n !== toTen && !kinds.has(n)) kinds.set(n, kind);
  }
  return tagWrongs([...kinds.keys()], (n) => kinds.get(n) ?? null).slice(0, 3);
}
export const hopsChoicesFor = (toTen: number, small: number): number[] => [toTen, ...toTenWrongsFor(toTen, small).map((w) => w.n)].sort((a, b) => a - b);

/** Four numbers near `target`, all 1 to 9, smallest first: the choices for each part of the split (a part-whole bond), help only. */
export function toTenChoicesFor(toTen: number): number[] {
  const out = [toTen];
  for (const d of [1, -1, 2, -2, 3, 4]) {
    const n = toTen + d;
    if (n >= 1 && n <= 9 && out.length < 4) out.push(n);
  }
  return out.sort((a, b) => a - b);
}

/** The same digit at the end: the shape that gives a wrong choice away (docs/kit/README.md). */
const ending = (n: number) => n % 10;

/**
 * Three wrong choices for where Weka lands, each with its mistake (maths review R5). Every kind has a turn: the seed
 * leaves one out when there are more than three, and the choices are checked so no more than two end the same way as the
 * answer. Built here, not in the shared pack, so the server rebuilds the same ones from the seed.
 */
export function landingWrongs(fact: { small: number; big: number; rest: number; kind: Kind }, random: () => number): Wrong<LandKind>[] {
  const { small, big, rest, kind } = fact;
  const total = small + big;
  const answer = kind === 'back' ? big : total;
  const pairs: [number, LandKind][] = kind === 'back'
    ? [[10, 'rock'], [total + small, 'add'], [answer + (random() < 0.5 ? 1 : -1), 'off1'], [answer + 1, 'off1'], [answer - 1, 'off1'], [answer + 2, 'off1'], [answer - 2, 'off1']]
    : [[10, 'rock'], [10 + small, 'double'], [big + rest, 'part'], [answer + (random() < 0.5 ? 1 : -1), 'off1'], [answer + 1, 'off1'], [answer - 1, 'off1'], [answer + 2, 'off1'], [answer - 2, 'off1']];
  const kinds = new Map<number, LandKind>();
  for (const [n, k] of pairs) if (n >= 1 && n !== answer && !kinds.has(n)) kinds.set(n, k);
  const all = tagWrongs([...kinds.keys()], (n) => kinds.get(n) ?? null);
  // One of each kind first (the seed drops one when there are four), then the rest.
  const firsts = ['rock', 'double', 'part', 'add', 'off1'].flatMap((k) => all.find((w) => w.kind === k) ?? []);
  if (firsts.length > 3) firsts.splice(Math.floor(random() * firsts.length), 1);
  const picked: Wrong<LandKind>[] = [];
  for (const w of [...firsts, ...all.filter((w) => !firsts.includes(w))]) {
    if (picked.length === 3) break;
    if (atMostShareTell(answer, [...picked.map((p) => p.n), w.n], ending)) picked.push(w);
  }
  for (const w of all) if (picked.length < 3 && !picked.includes(w)) picked.push(w);
  return picked;
}

/** The mistake behind a wrong tap, or null for the right answer or a number that isn't a choice. */
export const wrongKind = <K extends string>(wrongs: readonly Wrong<K>[], n: number): K | null => wrongs.find((w) => w.n === n)?.kind ?? null;

/** A go made again from its plan by the shared pack, with its choices in an order fixed by the seed. Null if the plan isn't one the pack could make. */
export function showGo(round: Pick<Round, 'seed'>, index: number, plan: GoPlan): Go | null {
  const fact = parseKey(plan.key);
  if (!fact || ![0, 1, 2].includes(plan.v) || !HELPS.includes(plan.h)) return null;
  const { small, big } = fact;
  const total = small + big;
  const q = pack.rebuild(plan.key, [small, big, plan.v], true, seeded((round.seed + 7919 * (index + 1)) % MAX_SEED));
  const kind: Kind = plan.v === 2 ? 'back' : plan.v === 0 ? 'turn' : 'add';
  const answer = kind === 'back' ? big : total;
  if (!q || !q.choices || q.answer !== answer) return null;
  const toTen = kind === 'back' ? total - 10 : 10 - big;
  const rest = small - toTen;
  // The shared pack makes the question; its wrong choices (answer ± 1 and 2) are replaced by ones with a mistake behind
  // them (R5), in an order fixed by the seed.
  const random = seeded((round.seed + 104729 * (index + 1)) % MAX_SEED);
  random(); random();
  const wrongs = landingWrongs({ small, big, rest, kind }, random);
  return {
    ...plan, kind, small, big, total, from: kind === 'back' ? total : big, toTen, rest, answer,
    parts: q.parts, choices: shuffle([answer, ...wrongs.map((w) => w.n)], random), wrongs,
    toTenChoices: hopsChoicesFor(toTen, small), toTenWrongs: toTenWrongsFor(toTen, small),
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

// ---------------------------------------------------------------- the split, after each right answer

/**
 * After every right answer the child fills in the split they used as a part-whole bond: the smaller number on top, and
 * below it the hops to the big rock and the hops after it (James, 5 Nov 2026). Help only: never sent or recorded.
 */
export function bondAskLine(go: Said): string {
  return `How did you split the ${go.small}? How many hops ${go.kind === 'back' ? 'back ' : ''}to the big rock?`;
}

/** The second part of the split: the hops after the big rock. */
export const BOND_MORE = 'And how many more?';

// ---------------------------------------------------------------- split first (help 'split', later in the game)

/**
 * On split-first goes (James, 6 Nov 2026) the child splits the number they add before anything else: first the part that
 * gets to ten, then the rest, then where Weka lands. Help only: never sent or recorded.
 */
export function splitFirstLine(go: Said): string {
  return go.kind === 'back'
    ? `${go.total} take away ${go.small}. Split the ${go.small} to get back to ten. How many hops back from ${go.total} to the big rock?`
    : go.kind === 'turn'
      ? `${go.small} plus ${go.big}. Start on the bigger number, ${go.big}. Split the ${go.small} to get to ten. How many hops from ${go.big} to the big rock?`
      : `${go.big} plus ${go.small}. Split the ${go.small} to get to ten. How many hops from ${go.big} to the big rock?`;
}

/** The second part of the split-first: what is left of the number after the big rock. */
export const splitRestLine = (go: Said): string => `${go.toTen} gets to ten. How many of the ${go.small} are left?`;

/** Both parts in: "8 and 2 make 10. Then 3 more. Where will Weka land?" */
export const splitDoneLine = (go: Said): string => fromTenLine(go);

// ---------------------------------------------------------------- the pebbles: the same question in ten-frames

/**
 * After a right answer on a full or split go (adding only), the same question again with pebbles (James, 6 Nov 2026):
 * the bigger number as gold pebbles in the first ten-frame, the smaller as silver in the second; the child drags silver
 * across until the first ten-frame is full. Help only: never sent or recorded.
 */
export function pebbleAskLine(go: Said): string {
  const sum = go.kind === 'turn' ? `${go.small} plus ${go.big}` : `${go.big} plus ${go.small}`;
  return `The same question with pebbles: ${sum}. Here are ${go.big} gold and ${go.small} silver. Drag the silver pebbles you need to make ten, then tap Check.`;
}

/** The first ten-frame is full: "8 and 2 make 10. 10 and 3 make 13." */
export const pebbleDoneLine = (go: Said): string => `${go.big} and ${go.toTen} make 10. 10 and ${go.rest} make ${go.total}.`;

/** Check with exactly the right number across (R9): "10 is full. 2 gone, 3 left. 8 and 2 make 10. 10 and 3 make 13." */
export const pebbleRightLine = (go: Said): string => `10 is full. ${go.toTen} gone, ${go.rest} left. ${pebbleDoneLine(go)}`;
/** Check with too few across: how many spaces are still empty. */
export const pebbleFewLine = (missing: number): string => `Not full yet. ${missing} more ${missing === 1 ? 'space' : 'spaces'}.`;
/** Check with too many across: how many to put back. */
export const pebbleManyLine = (extra: number): string => `That is more than ten: ${extra} too many. Put ${extra === 1 ? 'it' : 'them'} back.`;
/** After two wrong checks the right number moves across by itself. */
export const pebbleShowLine = (go: Said): string => `Let me show you. ${pebbleRightLine(go)}`;

/**
 * The split said in full once both parts are in: "You solved 9 + 5 by splitting the 5 into 1 and 4. You added the 1
 * first to make ten, then the other 4." `words` gives the read-aloud version ("9 plus 5").
 */
export function bondLine(go: Said, words = false): string {
  const plus = words ? 'plus' : '+';
  const sum = go.kind === 'back'
    ? `${go.total} ${words ? 'take away' : '−'} ${go.small}`
    : go.kind === 'turn' ? `${go.small} ${plus} ${go.big}` : `${go.big} ${plus} ${go.small}`;
  const how = go.kind === 'turn' ? `starting on ${go.big} and splitting` : 'splitting';
  const then = go.kind === 'back'
    ? `You took away the ${go.toTen} first to get to ten, then the other ${go.rest}.`
    : `You added the ${go.toTen} first to make ten, then the other ${go.rest}.`;
  return `You solved ${sum} by ${how} the ${go.small} into ${go.toTen} and ${go.rest}. ${then}`;
}
