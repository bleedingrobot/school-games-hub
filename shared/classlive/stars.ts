/**
 * Star Web (docs/CLASSLIVE-PLAN.md section 2): one known fact (6 × 7 = 42) and the class finds the facts it unlocks. Pure
 * rules: read a typed fact, check it is true (exactly, with decimals to 2 places), and work out HOW it links to the known
 * fact, which picks its constellation arm and the "how we know" line the projector shows.
 *
 * Numbers are kept as whole hundredths (4.2 is 420), so every check is exact.
 */

export type Op = '+' | '-' | '×' | '÷';
export const ARMS = ['turn', 'divide', 'double', 'halve', 'tens', 'near', 'wild'] as const;
export type Arm = (typeof ARMS)[number];

/** Stars an arm needs before it counts as lit (the turn-around arm only has one fact to find). */
export const ARM_GOAL: Record<Arm, number> = { turn: 1, divide: 3, double: 3, halve: 3, tens: 3, near: 3, wild: 3 };
export const ARM_NAMES: Record<Arm, string> = {
  turn: 'Turn around', divide: 'Divide', double: 'Double', halve: 'Halve', tens: 'Tens', near: 'Near facts', wild: 'Wild links',
};
/** Stars in the sky for a supernova. */
export const SUPERNOVA = 30;
/** Most stars one sky holds (so a room can't grow without end). */
export const MAX_STARS = 120;
/** The biggest number a fact may use. */
export const MAX_NUMBER = 100_000;

export interface Anchor {
  x: number;
  y: number;
  p: number;
}

export interface Fact {
  a: number; // hundredths
  op: Op;
  b: number;
  c: number;
}

export const LEVELS = {
  small: [[3, 4], [4, 5], [5, 6], [3, 5], [2, 7], [4, 6]],
  middle: [[6, 7], [4, 8], [3, 9], [7, 8], [6, 9], [4, 7], [8, 9], [6, 8]],
  big: [[6, 12], [7, 12], [8, 12], [9, 11], [11, 12], [9, 12], [7, 11]],
} as const satisfies Record<string, readonly (readonly [number, number])[]>;
export type StarLevel = keyof typeof LEVELS;

export function anchorOf(x: number, y: number): Anchor | null {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 2 || y < 2 || x > 12 || y > 12 || x === y) return null;
  return { x, y, p: x * y };
}

export function pickAnchor(level: StarLevel, random: () => number): Anchor {
  const list = LEVELS[level];
  const [x, y] = list[Math.floor(random() * list.length) % list.length];
  return { x, y, p: x * y };
}

/** 420 → "4.2", 4200 → "42". */
export function show(h: number): string {
  const sign = h < 0 ? '-' : '';
  const v = Math.abs(h);
  const whole = Math.floor(v / 100);
  const frac = v % 100;
  if (!frac) return `${sign}${whole}`;
  return `${sign}${whole}.${String(frac).padStart(2, '0').replace(/0$/, '')}`;
}

export const factText = (f: Fact) => `${show(f.a)} ${f.op === '-' ? '−' : f.op} ${show(f.b)} = ${show(f.c)}`;

const NUM = '(\\d{1,6}(?:\\.\\d{1,2})?)';
const OPS = '([+\\-−–×xX*÷/:])';
const LEFT = new RegExp(`^${NUM}${OPS}${NUM}=${NUM}$`);
const RIGHT = new RegExp(`^${NUM}=${NUM}${OPS}${NUM}$`);

const hundredths = (s: string): number => {
  const [w, f = ''] = s.split('.');
  return Number(w) * 100 + Number((f + '00').slice(0, 2));
};

const opOf = (s: string): Op => (s === '+' ? '+' : '-−–'.includes(s) ? '-' : '×xX*'.includes(s) ? '×' : '÷');

/** A typed fact ("12 × 7 = 84", "84 = 12x7", "4.2÷0.6=7"), or null if it can't be read. */
export function readFact(text: unknown): Fact | null {
  if (typeof text !== 'string' || text.length > 40) return null;
  const s = text.replace(/\s+/g, '');
  let m = LEFT.exec(s);
  let fact: Fact | null = null;
  if (m) fact = { a: hundredths(m[1]), op: opOf(m[2]), b: hundredths(m[3]), c: hundredths(m[4]) };
  else if ((m = RIGHT.exec(s))) fact = { a: hundredths(m[2]), op: opOf(m[3]), b: hundredths(m[4]), c: hundredths(m[1]) };
  if (!fact) return null;
  if ([fact.a, fact.b, fact.c].some((n) => n > MAX_NUMBER * 100)) return null;
  return fact;
}

/** Is it true? (exact, in hundredths) */
export function isTrue(f: Fact): boolean {
  if (f.op === '+') return f.a + f.b === f.c;
  if (f.op === '-') return f.a - f.b === f.c;
  if (f.op === '×') return f.a * f.b === f.c * 100;
  return f.b !== 0 && f.a * 100 === f.c * f.b;
}

/** The same fact written another way gets the same key (6 + 7 and 7 + 6; 12 × 7 and 7 × 12). */
export function factKey(f: Fact): string {
  if (f.op === '+' || f.op === '×') return `${f.op}${Math.min(f.a, f.b)},${Math.max(f.a, f.b)}`;
  return `${f.op}${f.a},${f.b}`;
}

/** A ratio n / 100x as 2^i × 10^j, if it is one (i from -2 to 3, j from -3 to 3). */
function ratioOf(h: number, whole: number): { two: number; ten: number } | null {
  for (let ten = -3; ten <= 3; ten++) {
    for (let two = -2; two <= 3; two++) {
      // h / (100 * whole) === 2^two * 10^ten  ⇔  h * 2^-two * 10^-ten === 100 * whole, done without fractions.
      const num = 2 ** Math.max(0, two) * 10 ** Math.max(0, ten);
      const den = 2 ** Math.max(0, -two) * 10 ** Math.max(0, -ten);
      if (h * den === 100 * whole * num) return { two, ten };
    }
  }
  return null;
}

const times = (r: { two: number; ten: number }): string => {
  const parts: string[] = [];
  if (r.ten > 0) parts.push(`× ${10 ** r.ten}`);
  if (r.ten < 0) parts.push(`÷ ${10 ** -r.ten}`);
  if (r.two === 1) parts.push('double');
  if (r.two === 2) parts.push('double twice');
  if (r.two === 3) parts.push('double three times');
  if (r.two === -1) parts.push('half');
  if (r.two === -2) parts.push('half of half');
  return parts.join(', then ');
};

export interface Link {
  arm: Arm;
  how: string;
}

/** How a true multiplication u × v = w links to the anchor, if it does. */
function multiplyLink(u: number, v: number, w: number, k: Anchor): Link | 'same' | null {
  const pairs: [number, number][] = k.x === k.y ? [[k.x, k.y]] : [[k.x, k.y], [k.y, k.x]];
  for (const [px, py] of pairs) {
    if (u === px * 100 && v === py * 100) {
      return px === k.x ? 'same' : { arm: 'turn', how: `Turn it around: ${px} × ${py} is the same as ${k.x} × ${k.y}.` };
    }
  }
  let best: Link | null = null;
  for (const [px, py] of pairs) {
    const r1 = ratioOf(u, px);
    const r2 = ratioOf(v, py);
    if (r1 && r2 && !(r1.two === 0 && r1.ten === 0 && r2.two === 0 && r2.ten === 0)) {
      const both = [r1, r2];
      const steps = both
        .map((r, i) => (r.two || r.ten ? `${i ? py : px} → ${show(i ? v : u)} is ${times(r)}` : ''))
        .filter(Boolean);
      const total = { two: r1.two + r2.two, ten: r1.ten + r2.ten };
      const sameAnswer = total.two === 0 && total.ten === 0;
      const after = sameAnswer ? `so the answer stays ${show(w)}.` : `so ${k.p} → ${show(w)}.`;
      let arm: Arm;
      if (r1.ten || r2.ten) arm = 'tens';
      else if (r1.two >= 0 && r2.two >= 0) arm = 'double';
      else arm = 'halve';
      const how = sameAnswer && (r1.two || r2.two) && !(r1.ten || r2.ten)
        ? `Double one, halve the other: ${steps.join(' and ')}, ${after}`
        : `${steps.join(' and ')}, ${after}`;
      best = { arm, how: how.charAt(0).toUpperCase() + how.slice(1) };
      break;
    }
    // Near: one factor the same, the other one or two more or less.
    for (const [same, other, sv, ov] of [[px, py, u, v], [py, px, v, u]] as const) {
      if (sv !== same * 100 || ov % 100) continue;
      const d = ov / 100 - other;
      if (d !== 0 && Math.abs(d) <= 2) {
        const groups = Math.abs(d) === 1 ? 'one group' : 'two groups';
        const more = d > 0 ? 'more' : 'fewer';
        return { arm: 'near', how: `${same} × ${ov / 100} is ${groups} of ${same} ${more}: ${k.p} ${d > 0 ? '+' : '−'} ${same * Math.abs(d)} = ${show(w)}.` };
      }
    }
  }
  return best;
}

/** Multiples of the answer that count as "using" it for a wild link (×1, ×2, ×4, ÷2, ×10, ×100, ÷10). */
const usesAnswer = (h: number, p: number) => [1, 2, 4, 0.5, 10, 100, 0.1].some((m) => Math.abs(h - p * 100 * m) < 1e-6);

/** How a true fact links to the anchor: its arm and "how we know", 'same' for the anchor itself, or null for no link. */
export function linkOf(f: Fact, k: Anchor): Link | 'same' | null {
  const P = k.p * 100;
  if (f.op === '×') {
    const m = multiplyLink(f.a, f.b, f.c, k);
    if (m) return m;
  }
  if (f.op === '÷') {
    // a ÷ b = c is b × c = a turned around.
    const m = multiplyLink(f.b, f.c, f.a, k) ?? multiplyLink(f.c, f.b, f.a, k);
    if (m === 'same' || (m && m.arm === 'turn')) return { arm: 'divide', how: `Division undoes it: ${show(f.b)} × ${show(f.c)} = ${show(f.a)}, so ${show(f.a)} ÷ ${show(f.b)} = ${show(f.c)}.` };
    if (m) return { arm: 'divide', how: `${show(f.b)} × ${show(f.c)} = ${show(f.a)} (${m.how.charAt(0).toLowerCase()}${m.how.slice(1)}) So ${show(f.a)} ÷ ${show(f.b)} = ${show(f.c)}.` };
  }
  if (f.op === '+' || f.op === '-') {
    const factors = [k.x * 100, k.y * 100];
    if (f.op === '+' && f.a === P && f.b === P) return { arm: 'double', how: `${k.p} + ${k.p} is double ${k.p}: ${k.x} × ${k.y * 2} = ${show(f.c)}.` };
    if (f.op === '+' && ((f.a === P && factors.includes(f.b)) || (f.b === P && factors.includes(f.a)))) {
      const g = f.a === P ? f.b : f.a;
      return { arm: 'near', how: `Add one more group of ${show(g)}: ${k.p} + ${show(g)} = ${show(f.c)}.` };
    }
    if (f.op === '-' && f.a === P && factors.includes(f.b)) return { arm: 'near', how: `Take one group of ${show(f.b)} away: ${k.p} − ${show(f.b)} = ${show(f.c)}.` };
  }
  // Wild: a true fact that uses the answer (or double, half, ten times it), not by adding 0 or multiplying by 1.
  const trivial = f.a === 0 || f.b === 0 || ((f.op === '×' || f.op === '÷') && (f.a === 100 || f.b === 100));
  if (!trivial && [f.a, f.b, f.c].some((h) => usesAnswer(h, k.p))) {
    return { arm: 'wild', how: `Another way to reach ${[f.a, f.b, f.c].some((h) => h === P) ? k.p : show([f.a, f.b, f.c].find((h) => usesAnswer(h, k.p)) as number)}.` };
  }
  return null;
}

export interface Star {
  id: number;
  key: string;
  text: string;
  arm: Arm;
  how: string;
  by: string;
  at: number;
  /** Found again by someone else: each one makes it shine brighter. */
  glow: number;
}

export interface StarsGame {
  kind: 'stars';
  level: StarLevel | 'own';
  anchor: Anchor;
  stars: Star[];
  creature: boolean;
  supernova: boolean;
  spotlight: number | null;
  /** Per pupil: new stars, glows, tries, last try (ms). */
  mine: Record<string, { found: number; glows: number; tries: number; lastAt: number }>;
}

export type StarsEvent =
  | { type: 'star'; t: number; star: Star; pupil: string }
  | { type: 'glow'; t: number; id: number; pupil: string }
  | { type: 'arm_lit'; t: number; arm: Arm }
  | { type: 'creature'; t: number }
  | { type: 'supernova'; t: number }
  | { type: 'spotlight'; t: number; id: number | null };

export type StarsReply =
  | { result: 'new'; star: Star; nudge: Arm | null }
  | { result: 'again'; star: Star; nudge: Arm | null }
  | { result: 'same' | 'unlinked' | 'wrong' | 'unreadable' | 'full'; text?: string; nudge: Arm | null };

/** One try needs this long after the last (ms), so tapping wildly doesn't flood the sky. */
export const TRY_GAP_MS = 1500;

export function newStars(anchor: Anchor, level: StarsGame['level']): StarsGame {
  return { kind: 'stars', level, anchor, stars: [], creature: false, supernova: false, spotlight: null, mine: {} };
}

export const armCount = (g: StarsGame, arm: Arm) => g.stars.filter((s) => s.arm === arm).length;
const armLit = (g: StarsGame, arm: Arm) => armCount(g, arm) >= ARM_GOAL[arm];

/** The emptiest arm still to light (for the pupil's nudge), or null when all are lit. */
export function nudgeOf(g: StarsGame): Arm | null {
  let best: Arm | null = null;
  for (const arm of ARMS) {
    if (armLit(g, arm)) continue;
    if (best === null || armCount(g, arm) / ARM_GOAL[arm] < armCount(g, best) / ARM_GOAL[best]) best = arm;
  }
  return best;
}

/** Fewest stars in the sky before an arm can count as lagging behind. */
export const LAG_FROM = 6;

/**
 * The arm lagging well behind the rest (for a gentle hint on how to find its facts), or null. Works from the counts
 * alone, so the pupils' screens (RoomView arms) and the projector agree. An arm lags when it is not lit and its share of
 * its goal is at least 0.45 below the average of the other arms (each capped at lit).
 */
export function laggingArm(arms: Record<Arm, number>, total: number): Arm | null {
  if (total < LAG_FROM) return null;
  const share = (a: Arm) => Math.min(1, arms[a] / ARM_GOAL[a]);
  let worst: Arm | null = null;
  for (const arm of ARMS) {
    if (share(arm) >= 1) continue;
    if (worst === null || share(arm) < share(worst)) worst = arm;
  }
  if (worst === null) return null;
  const others = ARMS.filter((a) => a !== worst);
  const avg = others.reduce((n, a) => n + share(a), 0) / others.length;
  return avg - share(worst) >= 0.45 ? worst : null;
}

export const armCounts = (g: StarsGame) => Object.fromEntries(ARMS.map((a) => [a, armCount(g, a)])) as Record<Arm, number>;

/** A pupil's try at a fact. */
export function tryFact(g: StarsGame, pupil: string, text: unknown, t: number): { ok: true; reply: StarsReply; events: StarsEvent[] } | { ok: false; reason: 'too_soon' } {
  const mine = (g.mine[pupil] ??= { found: 0, glows: 0, tries: 0, lastAt: -Infinity });
  if (t - mine.lastAt < TRY_GAP_MS) return { ok: false, reason: 'too_soon' };
  mine.lastAt = t;
  mine.tries++;
  const fact = readFact(text);
  if (!fact) return { ok: true, reply: { result: 'unreadable', nudge: nudgeOf(g) }, events: [] };
  const text2 = factText(fact);
  if (!isTrue(fact)) return { ok: true, reply: { result: 'wrong', text: text2, nudge: nudgeOf(g) }, events: [] };
  const link = linkOf(fact, g.anchor);
  if (link === 'same') return { ok: true, reply: { result: 'same', text: text2, nudge: nudgeOf(g) }, events: [] };
  if (!link) return { ok: true, reply: { result: 'unlinked', text: text2, nudge: nudgeOf(g) }, events: [] };
  const key = factKey(fact);
  const found = g.stars.find((s) => s.key === key);
  if (found) {
    if (found.by !== pupil) {
      found.glow++;
      mine.glows++;
    }
    return { ok: true, reply: { result: 'again', star: found, nudge: nudgeOf(g) }, events: found.by !== pupil ? [{ type: 'glow', t, id: found.id, pupil }] : [] };
  }
  if (g.stars.length >= MAX_STARS) return { ok: true, reply: { result: 'full', text: text2, nudge: null }, events: [] };
  const wasLit = armLit(g, link.arm);
  const star: Star = { id: g.stars.length + 1, key, text: text2, arm: link.arm, how: link.how, by: pupil, at: t, glow: 0 };
  g.stars.push(star);
  mine.found++;
  const events: StarsEvent[] = [{ type: 'star', t, star, pupil }];
  if (!wasLit && armLit(g, link.arm)) events.push({ type: 'arm_lit', t, arm: link.arm });
  if (!g.creature && ARMS.every((arm) => armLit(g, arm))) {
    g.creature = true;
    events.push({ type: 'creature', t });
  }
  if (!g.supernova && g.stars.length >= SUPERNOVA) {
    g.supernova = true;
    events.push({ type: 'supernova', t });
  }
  return { ok: true, reply: { result: 'new', star, nudge: nudgeOf(g) }, events };
}

/** The teacher puts a star in the middle of the big screen (null puts it back). */
export function spotlight(g: StarsGame, id: number | null, t: number): StarsEvent[] {
  const pick = id === null ? null : (g.stars.find((s) => s.id === id)?.id ?? null);
  if (pick === g.spotlight) return [];
  g.spotlight = pick;
  return [{ type: 'spotlight', t, id: pick }];
}

/** Facts a pretend pupil might find (the preview and tests): right ones of every kind, and a few slips. */
export function pretendFacts(k: Anchor): string[] {
  const { x, y, p } = k;
  return [
    `${y}×${x}=${p}`, `${p}÷${x}=${y}`, `${p}÷${y}=${x}`, `${x * 2}×${y}=${p * 2}`, `${x}×${y * 2}=${p * 2}`, `${p * 2}÷${x}=${y * 2}`,
    `${x * 10}×${y}=${p * 10}`, `${x}×${y * 10}=${p * 10}`, `${x * 10}×${y * 10}=${p * 100}`, `${p * 10}÷${x}=${y * 10}`,
    `${x}×${y + 1}=${p + x}`, `${x + 1}×${y}=${p + y}`, `${x - 1}×${y}=${p - y}`, `${p}+${x}=${p + x}`, `${p}-${y}=${p - y}`,
    `${x / 2}×${y}=${p / 2}`, `${x}×${y / 2}=${p / 2}`, `${x * 2}×${y / 2}=${p}`, `${x / 10}×${y}=${p / 10}`, `${p}+${p}=${p * 2}`,
    `${x * 4}×${y}=${p * 4}`, `${p / 2}×2=${p}`, `${p * 4}÷4=${p}`, `${x}×${y + 2}=${p + 2 * x}`, `${x * 100}×${y}=${p * 100}`,
    // slips
    `${x}×${y + 1}=${p + y}`, `${p}÷${x}=${y + 1}`, `2+2=4`, `${x}×${y}=${p}`,
  ];
}
