/**
 * Serpent Chain (docs/CLASSLIVE-PLAN.md section 3): snake maths. A start number and a long chain of operations
 * (+ 11, ÷ 6, × 2, − 23...); every pupil works along it at their own pace, writing each running answer. Pure rules.
 *
 * Every running answer is a whole number from 0 to 1000, and every step works out exactly. A wrong answer gets a second
 * try; after two the right answer is shown with its working and the pupil goes on from it, so one slip never spoils the
 * rest of the chain. The first 12 boxes are the serpent; a pupil who reaches its head gets the bonus tail, 4 boxes at a
 * time, so fast workers keep going.
 */

export type SerpentOp = '+' | '-' | '×' | '÷';
export interface SerpentStep {
  op: SerpentOp;
  by: number;
}
/**
 * Eight serpents in small steps (James, 24 Nov 2026: "more levels with more graduation"). Each step changes one thing:
 * bigger numbers, bigger jumps, or one more kind of × and ÷. green, gold and fire are the three original levels, kept
 * exactly as they were so saved rooms read the same.
 */
export const SERPENT_LEVELS = ['sprout', 'leaf', 'green', 'jade', 'gold', 'amber', 'ruby', 'fire'] as const;
export type SerpentLevel = (typeof SERPENT_LEVELS)[number];

interface LevelRule {
  name: string;
  about: string;
  /** Running answers stay from 0 to this. */
  max: number;
  /** + and − jump by these. */
  addSub: [number, number];
  /** × and ÷ by these (none: adding and taking away only). */
  factors: number[];
  /** Start number: from, to, and a step (10 starts on a multiple of ten). */
  start: [number, number, number];
  /** Chance of a × or ÷ box when one fits. */
  mul: number;
}

const RULES: Record<SerpentLevel, LevelRule> = {
  sprout: { name: 'Sprout serpent', about: '+ and − by up to 10, numbers to 50', max: 50, addSub: [1, 10], factors: [], start: [5, 20, 1], mul: 0 },
  leaf: { name: 'Leaf serpent', about: '+ and − by up to 20, numbers to 100', max: 100, addSub: [2, 20], factors: [], start: [10, 40, 1], mul: 0 },
  green: { name: 'Green serpent', about: '+ and − within 200', max: 200, addSub: [3, 49], factors: [], start: [10, 40, 1], mul: 0 },
  jade: { name: 'Jade serpent', about: '+ and −, plus × and ÷ by 2 and 10, numbers to 200', max: 200, addSub: [3, 49], factors: [2, 10], start: [10, 40, 2], mul: 0.3 },
  gold: { name: 'Gold serpent', about: 'all four: × and ÷ by 2, 5 and 10, numbers to 500', max: 500, addSub: [5, 99], factors: [2, 5, 10], start: [10, 60, 10], mul: 0.4 },
  amber: { name: 'Amber serpent', about: 'all four: × and ÷ by 2, 3, 4, 5 and 10, numbers to 500', max: 500, addSub: [5, 99], factors: [2, 3, 4, 5, 10], start: [12, 48, 1], mul: 0.4 },
  ruby: { name: 'Ruby serpent', about: 'all four: × and ÷ up to 6 and by 10, numbers to 1000', max: 1000, addSub: [7, 149], factors: [2, 3, 4, 5, 6, 10], start: [12, 48, 1], mul: 0.4 },
  fire: { name: 'Fire serpent', about: 'all four: × and ÷ up to 12, numbers to 1000', max: 1000, addSub: [7, 199], factors: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], start: [12, 48, 1], mul: 0.4 },
};
export const SERPENT_LEVEL_NAMES = Object.fromEntries(SERPENT_LEVELS.map((l) => [l, RULES[l].name])) as Record<SerpentLevel, string>;
export const SERPENT_LEVEL_ABOUT = Object.fromEntries(SERPENT_LEVELS.map((l) => [l, RULES[l].about])) as Record<SerpentLevel, string>;

/** Boxes on the serpent itself; the rest is bonus tail. */
export const BODY = 12;
/** Bonus boxes a pupil can reach at most (the chain is made this long). */
export const CHAIN_LENGTH = 48;
/** The tail grows by this many boxes at a time. */
export const TAIL_STEP = 4;
/** Tries before the right answer is shown. */
export const TRIES = 2;
/** One answer needs this long after the last (ms). */
export const SERPENT_GAP_MS = 800;
/** Share of the class's possible right answers (12 each) that wakes the serpent. */
export const WAKE_SHARE = 0.6;

export const apply = (v: number, s: SerpentStep) => (s.op === '+' ? v + s.by : s.op === '-' ? v - s.by : s.op === '×' ? v * s.by : v / s.by);
export const stepText = (s: SerpentStep) => `${s.op === '-' ? '−' : s.op} ${s.by}`;

/** Every step that works from `v` at this level. */
function choices(level: SerpentLevel, v: number): SerpentStep[] {
  const r = RULES[level];
  const max = r.max;
  const out: SerpentStep[] = [];
  const addSub = range(r.addSub[0], r.addSub[1]);
  for (const by of addSub) {
    if (v + by <= max) out.push({ op: '+', by });
    if (v - by >= 0) out.push({ op: '-', by });
  }
  {
    for (const by of r.factors) {
      if (v > 0 && v * by <= max) out.push({ op: '×', by });
      if (v > 0 && v % by === 0 && v / by >= 2) out.push({ op: '÷', by });
    }
  }
  return out;
}

function range(a: number, b: number): number[] {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

export interface Chain {
  level: SerpentLevel;
  start: number;
  steps: SerpentStep[];
  /** values[0] is the start; values[i + 1] is the answer to box i. */
  values: number[];
}

/**
 * The chain for a seed: mixes the operations (never the same kind twice in a row, × and ÷ about one box in three at the
 * higher levels) and keeps every running answer whole and in range.
 */
export function makeChain(level: SerpentLevel, random: () => number, length = CHAIN_LENGTH): Chain {
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(random() * xs.length) % xs.length];
  const [from, to, by] = RULES[level].start;
  let v = from + by * Math.floor(random() * (Math.floor((to - from) / by) + 1));
  const start = v;
  const steps: SerpentStep[] = [];
  const values = [v];
  for (let i = 0; i < length; i++) {
    const prev = steps[i - 1];
    const undoes = (s: SerpentStep) => !!prev && s.by === prev.by && ((s.op === '×' && prev.op === '÷') || (s.op === '÷' && prev.op === '×') || (s.op === '+' && prev.op === '-') || (s.op === '-' && prev.op === '+'));
    let all = choices(level, v).filter((s) => s.op !== prev?.op && !undoes(s));
    if (!all.length) all = choices(level, v);
    const multiply = all.filter((s) => s.op === '×' || s.op === '÷');
    const wantMul = RULES[level].mul > 0 && multiply.length > 0 && random() < RULES[level].mul;
    const pool = wantMul ? multiply : all.filter((s) => s.op === '+' || s.op === '-');
    const step = pick(pool.length ? pool : all);
    steps.push(step);
    v = apply(v, step);
    values.push(v);
  }
  return { level, start, steps, values };
}

export interface SerpentMine {
  /** The box they are on (0 is the first operation). */
  at: number;
  tries: number;
  right: number;
  shown: number;
  lastAt: number;
}

export interface SerpentGame {
  kind: 'serpent';
  chain: Chain;
  /** How far the tail has grown (boxes past the body anyone has opened). */
  tail: number;
  /** Right answers by the whole class, and the number that wakes the serpent. */
  energy: number;
  awake: boolean;
  /** Pupils who have reached the head (box 12), in order. */
  heads: string[];
  mine: Record<string, SerpentMine>;
}

export type SerpentEvent =
  | { type: 'climb'; t: number; pupil: string; at: number }
  | { type: 'head'; t: number; pupil: string; place: number }
  | { type: 'tail'; t: number; tail: number }
  | { type: 'awake'; t: number };

export type SerpentReply =
  | { result: 'right'; box: number; value: number; next: SerpentBox | null }
  | { result: 'again'; box: number; next: SerpentBox }
  | { result: 'shown'; box: number; value: number; working: string; next: SerpentBox | null };

/** What a pupil sees of the box they are on: the number they carry, the operation, and whether it's bonus tail. */
export interface SerpentBox {
  box: number;
  from: number;
  op: SerpentOp;
  by: number;
  tail: boolean;
  triesLeft: number;
}

export function newSerpent(level: SerpentLevel, random: () => number): SerpentGame {
  return { kind: 'serpent', chain: makeChain(level, random), tail: 0, energy: 0, awake: false, heads: [], mine: {} };
}

/** Right answers that wake the serpent for this many pupils. */
export const wakeAt = (players: number) => Math.max(6, Math.round(Math.max(1, players) * BODY * WAKE_SHARE));

export function boxOf(g: SerpentGame, pupil: string): SerpentBox | null {
  const m = g.mine[pupil];
  const at = m?.at ?? 0;
  if (at >= g.chain.steps.length) return null;
  const s = g.chain.steps[at];
  return { box: at, from: g.chain.values[at], op: s.op, by: s.by, tail: at >= BODY, triesLeft: TRIES - (m?.tries ?? 0) };
}

/** A pupil's answer to the box they are on. `players` is how many are in the room (for waking). */
export function answerBox(g: SerpentGame, pupil: string, box: unknown, value: unknown, t: number, players: number):
  { ok: true; reply: SerpentReply; events: SerpentEvent[] } | { ok: false; reason: 'too_soon' | 'stale' | 'done' | 'unreadable' } {
  const m = (g.mine[pupil] ??= { at: 0, tries: 0, right: 0, shown: 0, lastAt: -Infinity });
  if (m.at >= g.chain.steps.length) return { ok: false, reason: 'done' };
  if (box !== m.at) return { ok: false, reason: 'stale' };
  if (typeof value !== 'number' || !Number.isFinite(value)) return { ok: false, reason: 'unreadable' };
  if (t - m.lastAt < SERPENT_GAP_MS) return { ok: false, reason: 'too_soon' };
  m.lastAt = t;
  const at = m.at;
  const want = g.chain.values[at + 1];
  const events: SerpentEvent[] = [];
  const moveOn = () => {
    m.at++;
    m.tries = 0;
    events.push({ type: 'climb', t, pupil, at: m.at });
    if (m.at === BODY) {
      g.heads.push(pupil);
      events.push({ type: 'head', t, pupil, place: g.heads.length });
    }
    // The tail grows ahead of the furthest pupil, 4 boxes at a time.
    const need = Math.min(g.chain.steps.length - BODY, Math.ceil(Math.max(0, m.at - BODY + 1) / TAIL_STEP) * TAIL_STEP);
    if (need > g.tail) {
      g.tail = need;
      events.push({ type: 'tail', t, tail: need });
    }
  };
  if (Math.abs(value - want) < 1e-9) {
    m.right++;
    g.energy++;
    moveOn();
    if (!g.awake && g.energy >= wakeAt(players)) {
      g.awake = true;
      events.push({ type: 'awake', t });
    }
    return { ok: true, reply: { result: 'right', box: at, value: want, next: boxOf(g, pupil) }, events };
  }
  m.tries++;
  if (m.tries < TRIES) return { ok: true, reply: { result: 'again', box: at, next: boxOf(g, pupil) as SerpentBox }, events };
  m.shown++;
  const s = g.chain.steps[at];
  const working = `${g.chain.values[at]} ${stepText(s)} = ${want}`;
  moveOn();
  return { ok: true, reply: { result: 'shown', box: at, value: want, working, next: boxOf(g, pupil) }, events };
}

/** A pretend pupil's answer: right most of the time, a near miss otherwise. */
export function pretendAnswer(g: SerpentGame, pupil: string, random: () => number, skill: number): { box: number; value: number } | null {
  const b = boxOf(g, pupil);
  if (!b) return null;
  const want = g.chain.values[b.box + 1];
  return { box: b.box, value: random() < skill ? want : want + (random() < 0.5 ? -1 : 1) * (1 + Math.floor(random() * 10)) };
}
