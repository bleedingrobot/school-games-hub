/**
 * One day's challenge at Parrot's See-saw (docs/PARROT-PLAN.md): ten goes, each an equation with a missing number that
 * keeps the see-saw level ("8 = 5 + ?"), with four numbers to choose from (or, with the stones, any number to build).
 *
 * The keys are the equals-sign keys (`eqmiss`, `eqswap`, `eqboth`, `eqsub`, `eqtf`). The game makes its own questions
 * and wrong cards here. The key lists live in shared/maths/skillPacks/equalsKeys.ts, where the early facts own them, so the records count.
 *
 * Two things move separately, both from the child's own challenges and kept by the server (see `placeAfter` in the kit):
 * the **step** (which keys are asked, six of them) and the **help level** (how much picture, 5 stones down to 0).
 */
import type { FactStats } from '../maths/leitner';
import { atMostShareTell, sharingTell, type Wrong } from '../kit/mistakes';
import { helpWithSetting, type HelpSetting, type KindLevels } from '../kit/help';
import { seeded } from '../seededRandom';
import { sisterNumber } from '../kit/sister';
import { ALL_KEYS, KEYS, type Kind } from '../maths/skillPacks/equalsKeys';
import { GOES_PER_ROUND, KNOWN_BONDS, KNOWN_START, REVIEW_GOES, TOP_LEVEL, type HelpLevel, type Step } from './config';

export { GOES_PER_ROUND };
export type { Kind };
export type ParrotKind = 'all' | 'copy' | 'total' | 'off1' | 'dbl' | 'near' | 'both' | 'first' | 'side' | 'more' | 'less';
export type WrongCard = Wrong<ParrotKind>;
/** The four ways to write the missing-number go (layouts), and which one a plan asks for. */
export type Layout = 0 | 1 | 2 | 3;

export const MAX_SEED = 2147483647;
export const isSeed = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MAX_SEED;
export const isStep = (n: unknown): n is Step => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 6;
export const isLevel = (n: unknown): n is HelpLevel => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= TOP_LEVEL;
export const CARDS = 4;
/** The stones can build any number up to this (every stone-go answer is under it). */
export const MAX_STONES = 20;

// ---------------------------------------------------------------- the keys

export { KEYS, ALL_KEYS };
export const kindOfKey = (key: string): Kind | null => (key.startsWith('eqmiss:') ? 'miss' : key.startsWith('eqswap:') ? 'swap' : key.startsWith('eqboth:') ? 'both' : key.startsWith('eqsub:') ? 'sub' : key.startsWith('eqtf:') ? 'tf' : null);

/** The keys asked at each step: its new ones, and the earlier ones that come back. */
export const STEP_KEYS: Record<Step, { fresh: Kind; review: Kind[] }> = {
  1: { fresh: 'miss', review: [] },
  2: { fresh: 'miss', review: ['miss'] },
  3: { fresh: 'swap', review: ['miss'] },
  4: { fresh: 'both', review: ['swap', 'miss'] },
  5: { fresh: 'tf', review: ['both', 'swap'] },
  6: { fresh: 'sub', review: ['tf', 'both'] },
};

// ---------------------------------------------------------------- where a child starts

export interface Start { step: Step; level: HelpLevel }
/** Secure on most "make 10" pairs and some adding done: start at swap places with less help. Everyone else starts at the beginning. */
export function startFor(stats: Iterable<FactStats>): Start {
  const list = [...stats];
  const bonds = list.filter((s) => s.key.startsWith('bond10:') && s.box >= 2).length;
  const adding = list.some((s) => s.key.startsWith('add:') && s.attempts > 0);
  return bonds >= KNOWN_BONDS && adding ? { step: KNOWN_START.step, level: KNOWN_START.level } : { step: 1, level: TOP_LEVEL };
}

/** The level a go is shown at, from the child's level and the teacher's setting: Always is 4 (stones, tilt on Check), Off is 0 (equation only, no Peek). */
export const shownLevel = (level: HelpLevel, help: HelpSetting): HelpLevel => helpWithSetting<HelpLevel>(level, help, { always: 4, off: 0 });

// ---------------------------------------------------------------- the plan and the round

/** One go as saved: the key, its layout and the help level it is shown at. */
export interface GoPlan { key: string; v: Layout; l: HelpLevel }

export interface Round {
  seed: number;
  step: Step;
  level: HelpLevel;
  help: HelpSetting;
  goes: GoPlan[];
  /** The kind of slip behind each go's first wrong tap, once the child has played it (saved with the round; null for a go right first time). */
  slips?: (ParrotKind | null)[];
}

/** The guided first go (plan section 5): 5 = 2 + ?, at level 5 with stones. */
export const GUIDED_KEY = 'eqmiss:5=2+?';

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

const layoutsCount = (kind: Kind): number => (kind === 'miss' ? 4 : kind === 'swap' ? 2 : 1);

/**
 * Today's challenge from a fresh seed, the child's records, their place and the teacher's help setting: 7 goes at the
 * step's new thing and 3 earlier ones (step 1 is all the new), weakest keys first. The same inputs always give the same round.
 */
export function makeRound(
  seed: number,
  stats: Iterable<FactStats>,
  opts: { step?: Step; level?: HelpLevel; help?: HelpSetting; guided?: boolean; kindLevels?: KindLevels } = {},
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
  const { fresh, review } = STEP_KEYS[step];
  const freshCount = review.length === 0 ? GOES_PER_ROUND : GOES_PER_ROUND - REVIEW_GOES;
  // Step 2 asks the same keys as step 1 in the other three layouts: its new goes are layouts 1 to 3, its review goes layout 0.
  // Each kind of go is shown at its own help level; a kind not in the map starts at the whole-child level.
  const shownFor = (kind: Kind): HelpLevel => shownLevel((opts.kindLevels?.[kind]?.level as HelpLevel | undefined) ?? level, help);
  const fresh_ = weak(KEYS[fresh], freshCount).map((key) => ({ key, review: false }));
  const review_ = review.length === 0 ? [] : Array.from({ length: REVIEW_GOES }, (_, i) => ({ key: weak(KEYS[review[i % review.length]], REVIEW_GOES)[i], review: true }));
  let picks = [...fresh_, ...review_];
  if (opts.guided) picks = [{ key: GUIDED_KEY, review: false }, ...shuffle(picks.filter((p) => p.key !== GUIDED_KEY), random).slice(0, GOES_PER_ROUND - 1)];
  const ordered = opts.guided ? picks : spreadPicks(shuffle(picks, random));
  const plans = ordered.map(({ key, review: isReview }, i): GoPlan => {
    const kind = kindOfKey(key)!;
    let v: Layout = 0;
    if (kind === 'miss') v = step === 1 ? 0 : step === 2 ? (isReview ? 0 : ((1 + Math.floor(random() * 3)) as Layout)) : (Math.floor(random() * 4) as Layout);
    else if (kind === 'swap') v = Math.floor(random() * 2) as Layout;
    return opts.guided && i === 0 ? { key, v: 0, l: TOP_LEVEL } : { key, v, l: shownFor(kind) };
  });
  return { seed, step, level, help, goes: plans };
}

// ---------------------------------------------------------------- one go as shown

/** A go as shown. */
export interface Go extends GoPlan {
  kind: Kind;
  /** The equation as words and numbers, "?" for the gap: ["8", "=", "5", "+", "?"]. */
  parts: string[];
  /** What the child has to find: a number, or 0 tips left, 1 level, 2 tips right for true or false. */
  answer: number;
  /** The four cards (tips left, level, tips right for true or false), smallest first. */
  choices: number[];
  wrongs: WrongCard[];
  /** The stones: what is on each side before the child adds any (the left side is the total). */
  lg: number[];
  rg: number[];
  /** -1 when the gap takes stones away from the right side ("8 − ?"). */
  gs: 1 | -1;
}

const nums = (key: string): number[] => (key.match(/\d+/g) ?? []).map(Number);

/** The stones balance when `placed` are added (or taken away) on the right: left minus right. 0 is level, negative tips right. */
export const balance = (go: Pick<Go, 'lg' | 'rg' | 'gs'>, placed: number): number =>
  go.lg.reduce((s, n) => s + n, 0) - (go.rg.reduce((s, n) => s + n, 0) + go.gs * placed);

/** Which way the see-saw leans for `placed` stones: 'level', 'left' (the left side is heavier) or 'right'. */
export const tiltOf = (go: Pick<Go, 'lg' | 'rg' | 'gs'>, placed: number): 'left' | 'level' | 'right' => {
  const d = balance(go, placed);
  return d === 0 ? 'level' : d > 0 ? 'left' : 'right';
};

export const isStoneGo = (go: Pick<Go, 'kind' | 'l'>): boolean => go.l >= 4 && (go.kind === 'miss' || go.kind === 'swap' || go.kind === 'both');
/** The numbers a tap may carry on this go: every stone count for a stone-go (the cards are not shown), else its cards. */
export const tapsAllowed = (go: Pick<Go, 'kind' | 'l' | 'choices'>): number[] => (isStoneGo(go) ? Array.from({ length: MAX_STONES + 1 }, (_, i) => i) : go.choices);

/**
 * The three wrong cards of a card go: numbers close to the answer, so the child has to balance the see-saw. The answer's place
 * in the row (0 to 3) is chosen first, so it is sometimes the biggest or smallest. About half the goes have one printed-number
 * card (copy or total, never "all"). The row must not give the answer away by parity or last digit, and at most one card is
 * more than 3 away. Only the go's seeded `random` is used, so a replay makes the same cards.
 */
function nearWrongs(answer: number, slips: [ParrotKind, number][], random: () => number, max: number): WrongCard[] {
  const kindAt = (n: number): ParrotKind => slips.find(([, m]) => m === n)?.[0] ?? (Math.abs(n - answer) === 1 ? 'off1' : 'near');
  const ranks = [0, 1, 2, 3].filter((k) => answer >= k && max - answer >= 3 - k);
  const rank = ranks[Math.floor(random() * ranks.length)] ?? 0;
  const useSlip = random() < 0.5;
  const printed = slips.find(([kind, n]) => (kind === 'copy' || kind === 'total') && n !== answer && n >= 0 && n <= max && (n < answer ? rank > 0 : rank < 3));
  const ok = (cards: number[]): boolean =>
    sharingTell(answer, cards, (n) => n % 2) === 2 && atMostShareTell(answer, cards, (n) => n % 10, 2) && cards.filter((n) => Math.abs(n - answer) > 3).length <= 1;
  const belowPool = [1, 2, 3].map((d) => answer - d).filter((n) => n >= 0);
  const abovePool = [1, 2, 3].map((d) => answer + d).filter((n) => n <= max);
  for (let tries = 0; tries < 40; tries++) {
    const below: number[] = [];
    const above: number[] = [];
    if (useSlip && printed) (printed[1] < answer ? below : above).push(printed[1]);
    const needBelow = rank - below.length;
    const needAbove = 3 - rank - above.length;
    if (needBelow < 0 || needAbove < 0) break;
    below.push(...shuffle(belowPool.filter((n) => !below.includes(n)), random).slice(0, needBelow));
    above.push(...shuffle(abovePool.filter((n) => !above.includes(n)), random).slice(0, needAbove));
    const cards = [...below, ...above];
    if (cards.length === 3 && below.length === rank && ok(cards)) return cards.map((n) => ({ n, kind: kindAt(n) }));
  }
  const cards = [...Array.from({ length: rank }, (_, i) => answer - 1 - i), ...Array.from({ length: 3 - rank }, (_, i) => answer + 1 + i)];
  return cards.map((n) => ({ n, kind: kindAt(n) }));
}

const layoutParts = (v: Layout, a: number, b: number): string[] =>
  v === 0 ? [`${a}`, '=', `${b}`, '+', '?'] : v === 1 ? [`${b}`, '+', '?', '=', `${a}`] : v === 2 ? ['?', '+', `${b}`, '=', `${a}`] : [`${a}`, '=', '?', '+', `${b}`];

/** A go made again from its plan, with its wrong cards fixed by the seed. Null if the plan isn't one this game makes. */
export function showGo(round: Pick<Round, 'seed'>, index: number, plan: GoPlan): Go | null {
  if (!ALL_KEYS.includes(plan.key)) return null;
  return buildGo(round, index, plan);
}

/** A go made from any well-formed key (the server only ever replays keys from ALL_KEYS, through `showGo`). */
export function buildGo(round: Pick<Round, 'seed'>, index: number, plan: GoPlan): Go | null {
  if (![0, 1, 2, 3].includes(plan.v) || !isLevel(plan.l)) return null;
  const kind = kindOfKey(plan.key)!;
  if (plan.v >= layoutsCount(kind)) return null;
  const random = seeded((round.seed + 7919 * (index + 1)) % MAX_SEED);
  const n = nums(plan.key);
  let parts: string[];
  let answer: number;
  let slips: [ParrotKind, number][];
  let lg: number[];
  let rg: number[];
  let gs: 1 | -1 = 1;
  if (kind === 'miss') {
    const [a, b] = n;
    answer = a - b;
    parts = layoutParts(plan.v, a, b);
    lg = [a]; rg = [b];
    slips = [['all', a + b], ['copy', b], ['total', a], ['off1', answer + (random() < 0.5 ? 1 : -1)]];
  } else if (kind === 'swap') {
    const [x, y] = n;
    const [r, o] = plan.v === 0 ? [x, y] : [y, x];
    answer = r;
    parts = [`${r === x ? x : y}`, '+', `${o}`, '=', `${o}`, '+', '?'];
    lg = [r, o]; rg = [o];
    slips = [['total', r + o], ['copy', o], ['all', r + 2 * o], ['dbl', 2 * r]];
  } else if (kind === 'both') {
    const [a, b, c] = n;
    answer = a + b - c;
    parts = [`${a}`, '+', `${b}`, '=', `${c}`, '+', '?'];
    lg = [a, b]; rg = [c];
    slips = [['total', a + b], ['copy', c], ['all', a + b + c], ['off1', answer + (random() < 0.5 ? 1 : -1)]];
  } else if (kind === 'sub') {
    if (plan.key.includes('=') && /^eqsub:\d+=\d+-\?$/.test(plan.key)) {
      const [a, b] = n;
      answer = b - a;
      parts = [`${a}`, '=', `${b}`, '−', '?'];
      lg = [a]; rg = [b]; gs = -1;
      slips = [['all', a + b], ['copy', a], ['total', b], ['off1', answer + (random() < 0.5 ? 1 : -1)]];
    } else {
      const [a, b, c] = n;
      answer = a - b - c;
      parts = [`${a}`, '−', `${b}`, '=', `${c}`, '+', '?'];
      lg = [a - b]; rg = [c];
      slips = [['total', a - b], ['copy', c], ['all', a - b + c], ['off1', answer + (random() < 0.5 ? 1 : -1)]];
    }
  } else {
    const [a, b, c, d] = n;
    const l = a + b;
    const r = c + d;
    answer = l === r ? 1 : l > r ? 0 : 2;
    parts = [`${a}`, '+', `${b}`, '=', `${c}`, '+', `${d}`];
    const wrongs: WrongCard[] =
      answer === 1 ? [{ n: 0, kind: 'first' }, { n: 2, kind: 'first' }] : [{ n: 1, kind: 'both' }, { n: answer === 0 ? 2 : 0, kind: 'side' }];
    return { ...plan, kind, parts, answer, choices: [0, 1, 2], wrongs, lg: [a, b], rg: [c, d], gs };
  }
  const wrongs = nearWrongs(answer, slips, random, MAX_STONES * 2);
  if (wrongs.length !== CARDS - 1) return null;
  const choices = [answer, ...wrongs.map((w) => w.n)].sort((x, y) => x - y);
  return { ...plan, kind, parts, answer, choices, wrongs, lg, rg, gs };
}

/** Every go of a round as shown. Throws if a saved round has a go this game can't make. */
export function showRound(round: Round): Go[] {
  return round.goes.map((plan, i) => {
    const go = showGo(round, i, plan);
    if (!go) throw new Error(`Go ${i} (${plan.key}) can't be made`);
    return go;
  });
}

// ---------------------------------------------------------------- help inside one go

/** A wrong tap lifts that go's help one level; a second takes it to the top (stones). Three goes in a row wrong at the first tap keep the top level for the round. */
export function levelFor(planned: HelpLevel, wrongTaps: number, struggling: boolean, help: HelpSetting): { level: HelpLevel; peek: boolean } {
  let level = planned;
  if (struggling) level = TOP_LEVEL;
  if (wrongTaps >= 2) level = TOP_LEVEL;
  else if (wrongTaps === 1) level = Math.min(TOP_LEVEL, planned + 1) as HelpLevel;
  // Off keeps the picture away until a wrong tap brings it (plan section 4); Peek is hidden then.
  return { level, peek: help !== 'off' && planned <= 1 };
}

/**
 * The slip behind a pick on a go: null when right; the go's own wrong card kind; for a stone count, the same totals the
 * wrong cards use (total, copy, all, double); one away is off1; otherwise too many ('more') or not enough ('less').
 */
export function slipOfPick(go: Go, n: number): ParrotKind | null {
  if (n === go.answer) return null;
  const card = go.wrongs.find((w) => w.n === n);
  if (card) return card.kind;
  if (go.kind === 'tf') return null;
  if (go.kind === 'miss') {
    const total = go.lg.reduce((s, x) => s + x, 0);
    if (n === total) return 'total';
    if (n === go.rg[0]) return 'copy';
    if (n === total + go.rg[0]) return 'all';
  } else if (go.kind === 'swap') {
    const total = go.lg.reduce((s, x) => s + x, 0);
    if (n === total) return 'total';
    if (n === go.rg[0]) return 'copy';
    if (n === total + go.rg[0]) return 'all';
    if (n === 2 * go.answer) return 'dbl';
  }
  if (Math.abs(n - go.answer) === 1) return 'off1';
  return n > go.answer ? 'more' : 'less';
}

/** After two wrong taps the redo has two cards: the answer and the untried wrong card nearest to it (the lower on a tie), the right one marked. */
export function redoCards(go: Pick<Go, 'choices' | 'answer'>, tapped: readonly number[]): number[] {
  const nearest = (list: number[]) => [...list].sort((x, y) => Math.abs(x - go.answer) - Math.abs(y - go.answer) || x - y)[0];
  const wrong = go.choices.filter((c) => c !== go.answer);
  const other = nearest(wrong.filter((c) => !tapped.includes(c))) ?? nearest(wrong);
  return go.choices.filter((c) => c === go.answer || c === other);
}

// ---------------------------------------------------------------- "Now you try": a sister go

/** Is this key one the game can ask in its own kind's range? (The sister is local, so it need not be one of the saved ALL_KEYS.) */
function sisterKeyOk(kind: Kind, key: string): boolean {
  if (ALL_KEYS.includes(key)) return true;
  const n = nums(key);
  const within = (xs: number[], lo: number, hi: number) => xs.every((x) => x >= lo && x <= hi);
  if (kind === 'miss') return n.length === 2 && within(n, 1, 10) && n[0] >= 3 && n[1] < n[0];
  if (kind === 'swap') return n.length === 2 && within(n, 1, 7) && n[0] !== n[1];
  if (kind === 'both') return n.length === 3 && within(n.slice(0, 2), 3, 10) && n[2] >= 1 && n[2] !== n[0] && n[2] !== n[1] && n[0] + n[1] - n[2] >= 1;
  if (kind === 'sub') return /^eqsub:\d+=\d+-\?$/.test(key) ? n.length === 2 && n[0] >= 1 && n[0] < n[1] && n[1] <= 20 : n.length === 3 && n[0] <= 20 && n[1] >= 1 && n[2] >= 1 && n[0] - n[1] - n[2] >= 1;
  return n.length === 4 && within(n, 1, 10) && !(n[0] === n[2] && n[1] === n[3]);
}

/**
 * The go for "Now you try": the same key kind, layout and help level as `go`, with one of its numbers moved by 1 or 2 (sisterNumber),
 * built the way every go is built so its cards and answer agree. It prefers an answer that is neither the original answer nor one
 * of the original cards. Null when no number fits (the game then asks the old go again). The sister is never saved or sent.
 */
export function sisterGo(round: Pick<Round, 'seed'>, index: number, go: Go): Go | null {
  const n = nums(go.key);
  const base = (round.seed + 104729 * (index + 1)) % MAX_SEED;
  const order = shuffle(n.map((_, i) => i), seeded(base));
  const found: Go[] = [];
  for (const i of order) {
    const avoid: number[] = [];
    for (let t = 0; t < 4; t++) {
      const s = sisterNumber(n[i], base + 31 * i + t, { min: 1, max: 20, avoid });
      if (s === null) break;
      avoid.push(s);
      let at = 0;
      const key = go.key.replace(/\d+/g, (m) => (at++ === i ? String(s) : m));
      if (!sisterKeyOk(go.kind, key)) continue;
      const made = buildGo(round, GOES_PER_ROUND + index, { key, v: go.v, l: go.l });
      if (made && made.kind === go.kind) found.push(made);
    }
  }
  const fresh = (g: Go) => g.answer !== go.answer;
  return found.find((g) => fresh(g) && (go.kind === 'tf' || !go.choices.includes(g.answer))) ?? found.find(fresh) ?? (go.kind === 'tf' ? found[0] ?? null : null);
}

/** Every key a sister of `key` can have (one number moved by 1 or 2, in the kind's range), for the voice clips. */
export function sisterKeys(key: string): string[] {
  const kind = kindOfKey(key)!;
  const n = nums(key);
  const out = new Set<string>();
  n.forEach((x, i) => {
    for (const d of [-2, -1, 1, 2]) {
      let at = 0;
      const k = key.replace(/\d+/g, (m) => (at++ === i ? String(x + d) : m));
      if (x + d >= 1 && sisterKeyOk(kind, k)) out.add(k);
    }
  });
  return [...out];
}
