/**
 * Shark Bay (docs/SHARK-PLAN.md): the rules, pure functions only. A Four Corners variant (`CornersGame` with
 * `variant: 'shark'`), so the room, positions, jail, questions, power-ups and rewards all run through Four Corners'
 * code; only what differs lives here.
 *
 * The board is a round bay in the unit square (an oval bay on a wide board, `w` wide: see `bayCentre`, `inBay`,
 * `quarterOf`). Rope lines split it into four coloured quarters that slowly spin round
 * the bay (from round 2, faster each round). Pupils start on the jetty in the middle. When the run ends the shark strikes
 * one quarter (two in a "two sharks" round, none when it is full): everyone in it is caught, and so is anyone still on
 * the jetty, unless they are hiding under a boat. Boats drift round the bay; each has a few seats, and the pupils nearest
 * its middle fit.
 */
import {
  ANSWER_GAP_MS, AVATAR_R, centreOf, CORNERS, JAIL_RIGHT, READY_MS, ROLL_MS, runMs, SHOW_MS, START, startSpot, stepMove, widthOf,
  type Circle, type Corner, type CornersEvent, type CornersGame, type CornersMine, type CornerMap, type Item, type MoveState,
  type Positions, type Power, type Roller, type Round, type Spot, type Teleport, POWERS, RUN_DEFAULT_S, runSeconds,
} from './corners';

export const BAYS = ['lagoon', 'reef', 'pirate', 'icy'] as const;
export type BayMap = (typeof BAYS)[number];

/** The shark's name (said by Bella and shown on screens). */
export const SHARK = 'Simon';

export const QUARTER_NAMES = ['Red', 'Yellow', 'Green', 'Purple'] as const;
export const QUARTER_COLOURS = ['#ef4444', '#facc15', '#22c55e', '#a855f7'] as const;

/** What each bay calls things. */
export const BAY_WORDS: Record<BayMap, { name: string; storm: string; ice: string; roller: string; teleport: string; fog: string; jail: string; boat: string; dock: string }> = {
  lagoon: { name: 'Sunny Lagoon', storm: 'Seaweed', ice: 'Fast current', roller: 'Big wave', teleport: 'Whirlpool', fog: 'Murky water', jail: "Shark's Cave", boat: 'Rowboat', dock: 'Jetty' },
  reef: { name: 'Coral Reef', storm: 'Kelp forest', ice: 'Rip current', roller: 'Rolling wave', teleport: 'Bubble tube', fog: 'Sand cloud', jail: "Shark's Cave", boat: 'Glass-bottom boat', dock: 'Reef rock' },
  pirate: { name: 'Pirate Cove', storm: 'Tangled nets', ice: 'Whirling tide', roller: 'Rolling barrel', teleport: 'Secret tunnel', fog: 'Cannon smoke', jail: "Shark's Cave", boat: 'Pirate dinghy', dock: 'Pirate pier' },
  icy: { name: 'Icy Bay', storm: 'Slushy ice', ice: 'Ice slide', roller: 'Rolling iceberg', teleport: 'Ice hole', fog: 'Sea fog', jail: "Shark's Cave", boat: 'Ice floe', dock: 'Ice jetty' },
};

/** Power-ups keep Four Corners' powers, with sea names. */
export const SHARK_POWER_WORDS: Record<Power, { name: string; emoji: string; how: string }> = {
  shield: { name: 'Shark cage', emoji: '🛡️', how: "Simon can't catch you this round." },
  speed: { name: 'Dolphin dash', emoji: '🐬', how: 'Swim faster this round and the next two.' },
  key: { name: 'Rescue ring', emoji: '🛟', how: "Pulls a friend out of the Shark's Cave." },
  crystal: { name: 'Periscope', emoji: '🔭', how: 'Shows you one safe colour this round.' },
  jump: { name: 'Jet ski', emoji: '🚤', how: 'Tap a colour to zoom straight there.' },
  double: { name: 'Pearl', emoji: '🦪', how: 'Two points if you are safe this round.' },
  ghost: { name: 'Ink cloud', emoji: '🦑', how: 'Swim through hazards this round and the next.' },
};

// ---- Sizes and times ----

export const CENTRE = START;
/**
 * How wide the board is, in board heights (27 Nov 2026 NZ: widescreen, so it fills a projector). The bay is then an
 * oval `POOL_R * w` across and `POOL_R` down. Games made before are square (1, no `w`).
 *
 * Wide maths: a spot's "bay coordinates" squash x by w ((x - w/2) / w, y - 0.5), which turns the oval back into the
 * round bay. Quarters, the spin, boat orbits, whirlpools and the shark's strike spots are angles and radii in bay
 * coordinates (so the four quarters always have the same area); the jetty, boats, hazards and avatars stay true circles.
 */
export const SHARK_W = 1.6;
/** The middle of the bay on a board `w` wide. */
export const bayCentre = (w = 1): Spot => centreOf(w);
/** The bay's radius (the water inside the unit square; on a wide board, its half height). */
export const POOL_R = 0.47;
/** The jetty in the middle: still on it when the shark strikes means caught. */
export const DOCK_R = 0.15;
/** Hiding under a boat: this close to its middle. */
export const BOAT_R = 0.075;
/** The shark's strike: style picked per round (James's pick: both, mixed up). */
export type StrikeStyle = 'leap' | 'spot';

export const SHARK_MECHANICS = ['items', 'storm', 'teleport', 'ice', 'fog', 'roller', 'twist'] as const;
export type SharkMechanic = (typeof SHARK_MECHANICS)[number];
export const SHARK_UNLOCK: Record<SharkMechanic, number> = { items: 2, storm: 3, teleport: 4, ice: 5, fog: 6, roller: 7, twist: 8 };

export interface Boat {
  id: number;
  /** Drifts round the bay's middle on this circle. */
  orbit: number;
  a0: number;
  /** Radians a second (+ clockwise on screen). */
  w: number;
  seats: number;
}

/** A Shark Bay round: a Four Corners round (corners are quarters) plus the spin, the boats and the strike style. */
export interface BayRound extends Round {
  bay: true;
  spin0: number;
  /** Radians a second; 0 in round 1. */
  spinRate: number;
  boats: Boat[];
  style: StrikeStyle;
  /** Filled when the run ends: who fitted under a boat. */
  boated?: string[];
}

export interface SharkGame extends CornersGame {
  variant: 'shark';
  bay: BayMap;
}

export const isShark = (g: { kind: string; variant?: string }): g is SharkGame => g.kind === 'corners' && g.variant === 'shark';

/** Extra stats a Shark Bay pupil keeps (on their CornersMine). */
export interface SharkMineExtra {
  boats?: number;
  strikes?: number;
}

const dist = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.y - b.y);
const TAU = Math.PI * 2;

// ---- Board helpers ----

/** The quarters' turn at session time t (they stop when the run ends). */
export function spinAt(r: Pick<BayRound, 'spin0' | 'spinRate' | 'startAt' | 'runEnd'>, t: number): number {
  const s = Math.max(0, Math.min(t, r.runEnd) - r.startAt) / 1000;
  return r.spin0 + r.spinRate * s;
}

/** The angle of a spot round the bay's middle, in bay coordinates (x squashed by w), as the quarters are drawn. */
export function bayAngle(p: Spot, w = 1): number {
  return Math.atan2(p.y - 0.5, (p.x - w / 2) / w);
}

/** A spot at this angle and radius in bay coordinates (radius 1 is the round bay's edge on a square board). */
export function bayPoint(a: number, radius: number, w = 1): Spot {
  return { x: w / 2 + Math.cos(a) * radius * w, y: 0.5 + Math.sin(a) * radius };
}

/** Which quarter a spot is in at this turn, or null on the jetty. 0 starts top left, then clockwise. */
export function quarterOf(p: Spot, spin: number, w = 1): Corner | null {
  if (dist(p, bayCentre(w)) < DOCK_R) return null;
  const a = bayAngle(p, w) - spin + Math.PI;
  const n = ((a % TAU) + TAU) % TAU;
  return (Math.floor(n / (Math.PI / 2)) % 4) as Corner;
}

/** The middle of a quarter (for a Jet ski, the shark's leap and labels), at this turn. */
export function quarterMid(q: Corner, spin: number, radius = 0.3, w = 1): Spot {
  return bayPoint(spin - Math.PI + (q + 0.5) * (Math.PI / 2), radius, w);
}

/** Where a boat is: it drifts round the bay's middle (an oval on a wide board, `r.w`). */
export function boatAt(b: Boat, r: Pick<BayRound, 'startAt' | 'runEnd' | 'w'>, t: number): Spot {
  const s = Math.max(0, Math.min(t, r.runEnd) - r.startAt) / 1000;
  return bayPoint(b.a0 + b.w * s, b.orbit, widthOf(r));
}

/** The way a boat points at a spot on its oval (radians, screen angle), for drawing it. */
export function boatHeading(b: Boat, p: Spot, w = 1): number {
  const a = bayAngle(p, w);
  const turn = b.w > 0 ? 1 : -1;
  return Math.atan2(Math.cos(a) * turn, -Math.sin(a) * w * turn);
}

/** Keeps a spot in the water (inside the oval on a board `w` wide). */
export function inBay(p: Spot, w = 1): Spot {
  const c = bayCentre(w);
  const ax = POOL_R * w - AVATAR_R;
  const ay = POOL_R - AVATAR_R;
  const d = Math.hypot((p.x - c.x) / ax, (p.y - c.y) / ay);
  if (d <= 1) return p;
  return { x: c.x + (p.x - c.x) / d, y: c.y + (p.y - c.y) / d };
}

/** One step of swimming: Four Corners' movement (seaweed, currents, whirlpools, waves), kept inside the bay. */
export function sharkMove(m: MoveState, dir: Spot, dtMs: number, round: Parameters<typeof stepMove>[3], t: number, opts: { boost: boolean; ghost: boolean; w?: number }): MoveState {
  const w = round?.w ?? opts.w ?? 1;
  const next = stepMove(m, dir, dtMs, round ? { ...round, hole: false, gate: null } : null, t, { ...opts, w });
  return { ...next, p: inBay(next.p, w) };
}

// ---- Making rounds ----

const pick = <T>(list: readonly T[], random: () => number): T => list[Math.floor(random() * list.length) % list.length];

export function sharkMechanicsFor(n: number, random: () => number): Set<SharkMechanic> {
  const out = new Set<SharkMechanic>();
  const open = SHARK_MECHANICS.filter((m) => SHARK_UNLOCK[m] <= n);
  if (open.includes('items')) out.add('items');
  const fresh = SHARK_MECHANICS.find((m) => SHARK_UNLOCK[m] === n);
  if (fresh) {
    out.add(fresh);
    const older = open.filter((m) => m !== 'items' && m !== fresh);
    if (older.length && random() < 0.4) out.add(pick(older, random));
    return out;
  }
  const others = open.filter((m) => m !== 'items');
  const count = Math.min(others.length, 1 + Math.floor(random() * 3));
  const bag = [...others];
  while (out.size < count + (open.includes('items') ? 1 : 0) && bag.length) out.add(bag.splice(Math.floor(random() * bag.length), 1)[0]);
  return out;
}

/** Somewhere in the open water (off the jetty, away from the edge) of a bay on a board `w` wide. */
function waterSpot(random: () => number, w = 1): Spot {
  const a = random() * TAU;
  const r = DOCK_R + 0.06 + random() * (POOL_R - DOCK_R - 0.14);
  return bayPoint(a, r, w);
}

/** How many boats and seats for a class: about a third of the class fits. */
export function boatsFor(players: number): { count: number; seats: number } {
  const count = Math.max(1, Math.min(3, Math.round(players / 9)));
  const seats = Math.max(2, Math.ceil(Math.max(1, players) / (count * 3)));
  return { count, seats };
}

/** The spin speed for round n (radians a second): still in round 1, then faster each round; faster still in a frenzy. */
export function spinRateFor(n: number, frenzy: boolean): number {
  if (n <= 1) return 0;
  return Math.min(0.32, 0.1 + (n - 2) * 0.025) * (frenzy ? 1.4 : 1);
}

export function makeBayRound(g: CornersGame, n: number, startAt: number, random: () => number, players: number): BayRound {
  const has = sharkMechanicsFor(n, random);
  const frenzy = g.halfAt !== undefined ? startAt >= g.halfAt : n >= 8;
  const w = widthOf(g);
  // A wider bay gets more of everything, so the extra water isn't empty (the same as before in a round one).
  const more = (k: number) => Math.round(k * w);
  const storms: Circle[] = has.has('storm') ? Array.from({ length: more(1 + Math.floor(random() * 2)) }, () => ({ ...waterSpot(random, w), r: 0.1 + random() * 0.05 })) : [];
  const ice: Circle[] = has.has('ice') ? Array.from({ length: more(1 + Math.floor(random() * 2)) }, () => ({ ...waterSpot(random, w), r: 0.09 + random() * 0.04 })) : [];
  const teleports: Teleport[] = [];
  if (has.has('teleport')) {
    const a = random() * TAU;
    teleports.push({ a: bayPoint(a, 0.36, w), b: bayPoint(a + Math.PI, 0.36, w) });
  }
  // Waves roll across the open water (not through the jetty); across a wide bay they roll the whole width (`span`),
  // a little slower so they cross at the same speed.
  const line = () => (random() < 0.5 ? 0.27 + random() * 0.06 : 0.67 + random() * 0.06);
  const roller: Roller | null = has.has('roller')
    ? { axis: 'x', at: line(), r: 0.07, periodMs: Math.round((4800 + Math.floor(random() * 1500)) * w), ...(w !== 1 ? { span: w } : {}) } : null;
  const roller2: Roller | null = has.has('roller') && random() < 0.6 ? { axis: 'y', at: w / 2 + (line() - 0.5) * w, r: 0.07, periodMs: 5400 + Math.floor(random() * 1500) } : null;
  const twistOn = has.has('twist') || (frenzy && n >= SHARK_UNLOCK.twist && random() < 0.25);
  const twist = twistOn ? (random() < 0.65 ? 'two' : 'lucky') : null;
  const items: Item[] = [];
  if (has.has('items')) {
    const count = Math.max(2, Math.min(more(8), Math.round((players / 6) * w)));
    for (let i = 0; i < count; i++) items.push({ id: g.nextItem++, power: pick(POWERS, random), by: null, ...waterSpot(random, w) });
  }
  const { count, seats } = boatsFor(players);
  const dirB = random() < 0.5 ? 1 : -1;
  const boats: Boat[] = Array.from({ length: count }, (_, i) => ({
    id: i, orbit: 0.25 + random() * 0.1, a0: (i / count) * TAU + random() * 0.8, w: dirB * (0.12 + random() * 0.12) * (frenzy ? 1.3 : 1), seats,
  }));
  const first = pick(CORNERS, random);
  const rolled: Corner[] = twist === 'lucky' ? [] : twist === 'two' ? [first, ((first + 2) % 4) as Corner] : [first];
  const run = g.runS ? g.runS * 1000 : runMs(n);
  return {
    n, startAt, runEnd: startAt + run, rollEnd: startAt + run + ROLL_MS, showEnd: startAt + run + ROLL_MS + SHOW_MS,
    storms, ice, teleports, roller, roller2, hole: false, fog: has.has('fog'), gate: null, twist, items, rolled, caught: null, saved: [],
    ...(w !== 1 ? { w } : {}),
    bay: true, spin0: random() * TAU, spinRate: (random() < 0.5 ? 1 : -1) * spinRateFor(n, frenzy) || 0, boats, style: random() < 0.5 ? 'leap' : 'spot',
  };
}

export function newShark(bay: BayMap, runS: number = RUN_DEFAULT_S): SharkGame {
  // `map` stays a Four Corners map for code that only knows those; `bay` is Shark Bay's own.
  return { kind: 'corners', variant: 'shark', bay, map: 'snow' as CornerMap, w: SHARK_W, round: null, mine: {}, nextItem: 1, runS: runSeconds(runS) };
}

export const bayRound = (r: Round | null | undefined): BayRound | null => (r && (r as BayRound).bay ? (r as BayRound) : null);

/** Who fits under each boat at the strike: nearest the middle first, up to its seats. */
export function seated(r: BayRound, spots: { id: string; p: Spot }[]): Set<string> {
  const t = r.runEnd;
  const pairs: { id: string; boat: number; d: number }[] = [];
  for (const b of r.boats) {
    const at = boatAt(b, r, t);
    for (const s of spots) {
      const d = dist(s.p, at);
      if (d < BOAT_R + AVATAR_R * 0.5) pairs.push({ id: s.id, boat: b.id, d });
    }
  }
  pairs.sort((a, b) => a.d - b.d);
  const left = new Map(r.boats.map((b) => [b.id, b.seats]));
  const out = new Set<string>();
  for (const x of pairs) {
    if (out.has(x.id) || (left.get(x.boat) ?? 0) <= 0) continue;
    out.add(x.id);
    left.set(x.boat, (left.get(x.boat) ?? 0) - 1);
  }
  return out;
}

function endBayRun(g: CornersGame, r: BayRound, order: string[], positions: Positions): CornersEvent {
  const caught: string[] = [];
  const saved: string[] = [];
  const lucky = r.twist === 'lucky';
  const spin = spinAt(r, r.runEnd);
  const w = widthOf(r);
  const free = order.filter((id) => g.mine[id] && g.mine[id].jailedIn === null);
  const at = (id: string) => positions[id] ?? g.mine[id].spot;
  const boated = seated(r, free.map((id) => ({ id, p: at(id) })));
  const inQ = [0, 0, 0, 0];
  for (const id of free) {
    const q = quarterOf(at(id), spin, w);
    if (q !== null && !boated.has(id)) inQ[q]++;
  }
  if (!lucky) {
    const rolls = g.rolls ?? [0, 0, 0, 0];
    for (const c of r.rolled) rolls[c]++;
    g.rolls = rolls;
  }
  for (const id of free) {
    const m = g.mine[id] as CornersMine & SharkMineExtra;
    const p = at(id);
    m.spot = { x: p.x, y: p.y };
    const q = quarterOf(p, spin, w);
    const struck = q !== null && !lucky && r.rolled.includes(q);
    const inBoat = boated.has(id);
    const out = !inBoat && (q === null || struck);
    m.lastCorner = null;
    if (!out) {
      m.safe++;
      m.score += m.doubleIn === r.n ? 2 : 1;
      if (inBoat) m.boats = (m.boats ?? 0) + 1;
      if (q !== null && !inBoat && inQ[q] === 1) m.alone = (m.alone ?? 0) + 1;
      // Lucky: a boat saved them in the struck quarter, or the shark was full, or two sharks missed them.
      if ((inBoat && (q === null || struck)) || (lucky && q !== null) || (!lucky && r.rolled.length > 1 && !inBoat)) m.lucky = (m.lucky ?? 0) + 1;
      continue;
    }
    if (m.shieldIn === r.n) {
      m.lucky = (m.lucky ?? 0) + 1;
      saved.push(id);
      continue;
    }
    if (struck) m.strikes = (m.strikes ?? 0) + 1;
    caught.push(id);
    m.caught++;
    m.jailedIn = r.n;
    m.jailRight = 0;
    m.held = null;
  }
  r.caught = caught;
  r.saved = saved;
  r.boated = [...boated];
  g.caughtAll = (g.caughtAll ?? 0) + caught.length;
  const ev = { type: 'roll' as const, t: r.runEnd, n: r.n, rolled: r.rolled, lucky, caught, saved, boated: [...boated] };
  return ev;
}

/** Four Corners' `advance`, with Shark Bay's rounds and strike. */
export function sharkAdvance(g: CornersGame, t: number, order: string[], positions: Positions, random: () => number, last = false): CornersEvent[] {
  const events: CornersEvent[] = [];
  for (let guard = 0; guard < 4; guard++) {
    const r = g.round;
    if (!r) {
      if (t < READY_MS || last) break;
      g.round = makeBayRound(g, 1, READY_MS, random, order.length);
      events.push({ type: 'round', t: READY_MS, n: 1 });
      continue;
    }
    if (r.caught === null) {
      if (t < r.runEnd) break;
      events.push(endBayRun(g, r as BayRound, order, positions));
      continue;
    }
    if (t < r.showEnd || last) break;
    const startAt = t - r.showEnd > 2000 ? t : r.showEnd;
    for (const id of order) {
      const m = g.mine[id];
      if (m && m.jailedIn !== null && m.jailedIn < r.n && m.jailRight >= JAIL_RIGHT) {
        m.jailedIn = null;
        m.jailRight = 0;
        m.escapes++;
        m.spot = startSpot(order.indexOf(id), widthOf(g));
        m.placed++;
        events.push({ type: 'escape', t: startAt, pupil: id });
      }
    }
    g.round = makeBayRound(g, r.n + 1, startAt, random, order.length);
    events.push({ type: 'round', t: startAt, n: r.n + 1 });
  }
  return events;
}

/** A question is due: in the cave (until 3 right), or holding a power-up while in the water (off the jetty). */
export function sharkQuestionFor(g: CornersGame, who: string, at: Spot | undefined, t: number): 'jail' | 'power' | null {
  const m = g.mine[who];
  if (!m) return null;
  if (m.jailedIn !== null) return m.jailRight < JAIL_RIGHT ? 'jail' : null;
  const r = bayRound(g.round);
  if (!m.held || !r || r.caught !== null || t >= r.runEnd || !at || dist(at, bayCentre(widthOf(r))) < DOCK_R) return null;
  return 'power';
}

/** A switched-on Jet ski: zoom to the middle of a quarter (where it is now). */
export function sharkJump(g: CornersGame, who: string, quarter: unknown, order: string[], t: number): { ok: true; spot: Spot } | { ok: false } {
  const r = bayRound(g.round);
  const m = g.mine[who];
  if (!r || !m || m.jumpIn !== r.n || r.caught !== null || t >= r.runEnd || m.jailedIn !== null) return { ok: false };
  if (!CORNERS.includes(quarter as Corner)) return { ok: false };
  const i = order.indexOf(who);
  const w = widthOf(r);
  const c = quarterMid(quarter as Corner, spinAt(r, t), 0.3 + ((i % 3) - 1) * 0.04, w);
  const spot = inBay({ x: c.x + (((i % 5) - 2) * 0.012), y: c.y + ((Math.floor(i / 5) % 5) - 2) * 0.012 }, w);
  m.jumpIn = null;
  m.spot = spot;
  m.placed++;
  return { ok: true, spot };
}

/** A pretend pupil's way: towards the middle of its quarter (it moves), or to a boat. */
export function sharkPretendDir(p: Spot, target: Corner, r: BayRound | null, t: number, toBoat: boolean, random: () => number): Spot {
  let c = r ? quarterMid(target, spinAt(r, t), 0.3, widthOf(r)) : quarterMid(target, 0);
  if (r && toBoat && r.boats.length) {
    const near = r.boats.map((b) => boatAt(b, r, t)).sort((a, b) => dist(a, p) - dist(b, p))[0];
    c = near;
  }
  const dx = c.x - p.x + (random() - 0.5) * 0.06;
  const dy = c.y - p.y + (random() - 0.5) * 0.06;
  const len = Math.hypot(dx, dy);
  return len < 0.02 ? { x: 0, y: 0 } : { x: dx / len, y: dy / len };
}

export { ANSWER_GAP_MS };
