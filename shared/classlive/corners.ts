/**
 * Four Corners (docs/CORNERS-PLAN.md): the rules, pure functions only. Pupils run their avatars about a unit square;
 * a countdown, then a dice picks a corner and everyone in it (or in no corner) goes to jail. The server makes each
 * round (hazards, items, the hidden roll) when the last one ends, and decides who is caught from the saved positions.
 *
 * Movement itself happens on each pupil's device (the joystick) with the same `stepMove` used here, so the device and
 * the projector draw the same hazards; the database clamps every saved move to `maxSpeed` (classlive_move).
 */

export const MAPS = ['snow', 'jungle', 'castle', 'space'] as const;
export type CornerMap = (typeof MAPS)[number];

/** 0 top left, 1 top right, 2 bottom right, 3 bottom left. */
export type Corner = 0 | 1 | 2 | 3;
export const CORNERS: Corner[] = [0, 1, 2, 3];

export const POWERS = ['shield', 'speed', 'key', 'crystal', 'jump', 'double', 'ghost'] as const;
export type Power = (typeof POWERS)[number];

export const MECHANICS = ['items', 'storm', 'teleport', 'ice', 'fog', 'roller', 'hole', 'gate', 'twist'] as const;
export type Mechanic = (typeof MECHANICS)[number];
/** The round each mechanic first appears (James: "unlocked bit by bit so it isn't chaos"). */
export const UNLOCK: Record<Mechanic, number> = { items: 2, storm: 3, teleport: 4, ice: 5, fog: 6, roller: 7, hole: 8, gate: 9, twist: 10 };

/** What each map calls things (power-ups keep their names everywhere). */
export const MAP_WORDS: Record<CornerMap, { name: string; storm: string; ice: string; roller: string; hole: string; teleport: string; fog: string; gate: string; jail: string }> = {
  snow: { name: 'Snowy Village', storm: 'Blizzard', ice: 'Ice patch', roller: 'Giant snowball', hole: 'Cracked ice', teleport: 'Ice portal', fog: 'Snow fog', gate: 'Frozen gate', jail: 'Igloo jail' },
  jungle: { name: 'Jungle Temple', storm: 'Sandstorm', ice: 'Mud slide', roller: 'Rolling boulder', hole: 'Quicksand', teleport: 'Vine swing', fog: 'Jungle mist', gate: 'Temple door', jail: 'Vine cage' },
  castle: { name: 'Haunted Castle', storm: 'Ghost mist', ice: 'Slippery moss', roller: 'Rolling barrel', hole: 'Collapsed floor', teleport: 'Magic mirror', fog: 'Spooky fog', gate: 'Portcullis', jail: 'Dungeon' },
  space: { name: 'Space Station', storm: 'Meteor storm', ice: 'Zero-g zone', roller: 'Rolling asteroid', hole: 'Black hole', teleport: 'Warp pad', fog: 'Nebula cloud', gate: 'Airlock', jail: 'Space brig' },
};

export const POWER_WORDS: Record<Power, { name: string; emoji: string; how: string }> = {
  shield: { name: 'Shield', emoji: '🛡️', how: "You can't be caught this round." },
  speed: { name: 'Speed boost', emoji: '⚡', how: 'Run faster this round and the next two.' },
  key: { name: 'Jail key', emoji: '🔑', how: 'Frees a friend from jail.' },
  crystal: { name: 'Crystal ball', emoji: '🔮', how: 'Shows you one safe corner this round.' },
  jump: { name: 'Jump', emoji: '🪂', how: 'Tap a corner to hop straight there.' },
  double: { name: 'Double star', emoji: '⭐', how: 'Two points if you are safe this round.' },
  ghost: { name: 'Ghost', emoji: '👻', how: 'Walk through hazards this round and the next.' },
};

// ---- Sizes and times ----

/** A corner zone's side (corners are squares in the board's corners). */
export const ZONE = 0.26;
/** Board units a second. Crossing a side takes about 3 s. */
export const SPEED = 0.3;
export const BOOST = 1.6;
export const STORM_SLOW = 0.45;
/** The fastest anyone can go (the database clamps saved moves to this, with some slack). */
export const MAX_SPEED = SPEED * BOOST * 1.25;
export const AVATAR_R = 0.035;
export const GRAB_R = 0.07;
export const HOLE_R = 0.15;
export const TELEPORT_R = 0.045;
export const ROLL_MS = 4500;
export const SHOW_MS = 4500;
/** Before the first round. */
export const READY_MS = 4000;
export const GATE_EARLY_MS = 3000;
export const JAIL_RIGHT = 3;
export const ANSWER_GAP_MS = 1500;
/** Fog hides avatars on the big screen for the last share of the run. */
export const FOG_SHARE = 0.55;

export const runMs = (n: number) => Math.max(9000, 14000 - (n - 1) * 400);
/** The teacher picks the run time on the card (James, 25 Nov 2026 NZ): 6 to 12 seconds, the same every round. */
export const RUN_MIN_S = 6;
export const RUN_MAX_S = 12;
export const RUN_DEFAULT_S = 10;
export const runSeconds = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(RUN_MIN_S, Math.min(RUN_MAX_S, Math.round(v))) : RUN_DEFAULT_S;

// ---- Shapes ----

export interface Spot { x: number; y: number }
export interface Circle extends Spot { r: number }
export interface Teleport { a: Spot; b: Spot }
/** A rolling thing crossing the board along a line, there and back. */
export interface Roller { axis: 'x' | 'y'; at: number; r: number; periodMs: number }
export interface Item extends Spot { id: number; power: Power; by: string | null }

export interface Round {
  n: number;
  /** Times in ms since the session started. */
  startAt: number;
  runEnd: number;
  rollEnd: number;
  showEnd: number;
  storms: Circle[];
  ice: Circle[];
  teleports: Teleport[];
  roller: Roller | null;
  /** A second roller on the other axis (James, 25 Nov 2026 NZ: "add a vertical one as well"). */
  roller2?: Roller | null;
  hole: boolean;
  fog: boolean;
  gate: Corner | null;
  /** 'two': two corners are rolled. 'lucky': the dice shows a star and nobody in a corner is caught. */
  twist: 'two' | 'lucky' | null;
  items: Item[];
  /** Decided when the round is made; hidden from pupils until `runEnd + ROLL_MS`. */
  rolled: Corner[];
  /** Filled when the run ends. */
  caught: string[] | null;
  saved: string[];
  /** Second half of the game: nobody may stay in the corner they were safe in last round (James, 25 Nov 2026 NZ). */
  swap?: boolean;
  /** Caught for staying in last round's corner (second half). */
  stayed?: string[];
}

/** An untimed game swaps corners from this round. */
export const SWAP_ROUND = 8;

export interface CornersMine {
  safe: number;
  score: number;
  caught: number;
  /** The round they were caught in, or null when free. */
  jailedIn: number | null;
  jailRight: number;
  escapes: number;
  held: Power | null;
  /** Rounds each switched-on power covers (last round it works in). */
  shieldIn: number | null;
  speedTo: number | null;
  ghostTo: number | null;
  doubleIn: number | null;
  crystalIn: number | null;
  jumpIn: number | null;
  powersUsed: number;
  grabs: number;
  freed: number;
  /** Questions answered (seeds the next question). */
  answered: number;
  lastAt: number;
  /** Bumped when the server moves them (back from jail, a jump), so their device snaps to `spot`. */
  placed: number;
  spot: Spot;
  /** End-of-game stats (James, 25 Nov 2026 NZ); missing in games from before them. */
  right?: number;
  wrong?: number;
  streak?: number;
  bestStreak?: number;
  /** Fastest right answer, ms (from the pad's timer, capped). */
  fastMs?: number;
  /** Teleports taken, at most WARPS_A_ROUND a round. */
  warps?: number;
  warpRound?: number;
  warpN?: number;
  /** Lucky escapes: a shield saved them, safe through a two-corner roll, or out of a corner on a lucky roll. */
  lucky?: number;
  /** Safe rounds with a corner all to themselves. */
  alone?: number;
  /** The corner they were safe in last round (null: none, or back from jail), for the second half's corner swap. */
  lastCorner?: Corner | null;
}

/** Most teleports a pupil can count in one round. */
export const WARPS_A_ROUND = 4;

export interface CornersGame {
  kind: 'corners';
  /** Shark Bay plays on Four Corners' engine (shared/classlive/shark.ts). Missing: Four Corners. */
  variant?: 'shark';
  map: CornerMap;
  /** 0 before the first round. */
  round: Round | null;
  mine: Record<string, CornersMine>;
  /** Items get ids from here. */
  nextItem: number;
  /** How often the dice picked each corner (Red, Blue, Green, Yellow), and how many went to jail in all. */
  rolls?: [number, number, number, number];
  caughtAll?: number;
  /** Ms after the start when the second half begins (a timed game); untimed games swap from round SWAP_ROUND. */
  halfAt?: number;
  /** Seconds to reach a corner each round, the teacher's pick (older games: none, so the run shrinks from 14 s to 9 s). */
  runS?: number;
}

export type CornersEvent =
  | { type: 'round'; t: number; n: number }
  | { type: 'roll'; t: number; n: number; rolled: Corner[]; lucky: boolean; caught: string[]; saved: string[]; stayed?: string[] }
  | { type: 'grab'; t: number; pupil: string; power: Power }
  | { type: 'power'; t: number; pupil: string; power: Power; freed?: string }
  | { type: 'escape'; t: number; pupil: string }
  | { type: 'jail_right'; t: number; pupil: string; right: number };

// ---- Board helpers ----

export const START: Spot = { x: 0.5, y: 0.5 };

export function cornerOf(p: Spot): Corner | null {
  const left = p.x <= ZONE;
  const right = p.x >= 1 - ZONE;
  const top = p.y <= ZONE;
  const bottom = p.y >= 1 - ZONE;
  if (top && left) return 0;
  if (top && right) return 1;
  if (bottom && right) return 2;
  if (bottom && left) return 3;
  return null;
}

export const cornerCentre = (c: Corner): Spot => ({ x: c === 0 || c === 3 ? ZONE / 2 : 1 - ZONE / 2, y: c < 2 ? ZONE / 2 : 1 - ZONE / 2 });

const dist = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp01 = (v: number) => Math.min(1 - AVATAR_R, Math.max(AVATAR_R, v));

/** A start spot in the middle, spread by player number so avatars don't sit on top of each other. */
export function startSpot(i: number): Spot {
  const a = i * 2.399963; // golden angle
  const r = 0.03 + 0.11 * Math.sqrt(((i % 40) + 0.5) / 40);
  return { x: 0.5 + Math.cos(a) * r, y: 0.5 + Math.sin(a) * r };
}

/** A jail seat (drawn beside the board). */
export function jailSpot(i: number): Spot {
  return { x: 0.2 + (i % 8) * 0.085, y: 1.08 + Math.floor(i / 8) * 0.06 };
}

/** Where a roller is at time t (ms since the session started). */
export function rollerAt(r: Roller, t: number): Spot {
  const phase = (t % r.periodMs) / r.periodMs;
  const along = phase < 0.5 ? phase * 2 : 2 - phase * 2;
  const v = -0.1 + along * 1.2;
  return r.axis === 'x' ? { x: v, y: r.at } : { x: r.at, y: v };
}

/** What movement needs of a round (the pupils' copy of a round has these too). */
export type MoveRound = Pick<Round, 'storms' | 'ice' | 'teleports' | 'roller' | 'hole' | 'gate' | 'runEnd'> & { roller2?: Roller | null };

/** A round's rollers (one or two). */
export const rollersOf = (round: Pick<MoveRound, 'roller' | 'roller2'>): Roller[] => [round.roller, round.roller2].filter((x): x is Roller => !!x);

/** A roller hit: you fly this fast (board widths a second) and can't steer for this long. */
export const KNOCK_SPEED = 0.9;
export const KNOCK_MS = 550;

export const gateShut = (round: Pick<Round, 'gate' | 'runEnd'>, t: number) => round.gate !== null && t >= round.runEnd - GATE_EARLY_MS;

export interface MoveState {
  p: Spot;
  v: Spot;
  /** Knocked flying by a roller: no steering until this session time. */
  stun?: number;
  /** Session time of the last roller hit (the pad shakes and says so). */
  hitAt?: number;
}

/**
 * One step of movement (device and preview): `dir` is the joystick (length 0 to 1), dt in ms. Storms slow, ice keeps
 * momentum, the hole and a shut gate are walls (unless a ghost), teleports warp to the other end, the roller bumps.
 */
export function stepMove(m: MoveState, dir: Spot, dtMs: number, round: MoveRound | null, t: number, opts: { boost: boolean; ghost: boolean }): MoveState {
  const dt = Math.min(100, Math.max(0, dtMs)) / 1000;
  if (m.stun !== undefined && t < m.stun) {
    // Flying: no steering, slowing down as you go; walls still hold.
    const k = Math.max(0, 1 - dt * 2.2);
    const v = { x: m.v.x * k, y: m.v.y * k };
    let p = { x: clamp01(m.p.x + v.x * dt), y: clamp01(m.p.y + v.y * dt) };
    if (round?.hole && !opts.ghost && dist(p, START) < HOLE_R + AVATAR_R) {
      const a = Math.atan2(p.y - 0.5, p.x - 0.5);
      p = { x: 0.5 + Math.cos(a) * (HOLE_R + AVATAR_R), y: 0.5 + Math.sin(a) * (HOLE_R + AVATAR_R) };
    }
    return { ...m, p, v };
  }
  const len = Math.hypot(dir.x, dir.y);
  const d = len > 1 ? { x: dir.x / len, y: dir.y / len } : dir;
  let speed = SPEED * (opts.boost ? BOOST : 1);
  const onIce = !!round && !opts.ghost && round.ice.some((c) => dist(c, m.p) < c.r);
  if (round && !opts.ghost && round.storms.some((c) => dist(c, m.p) < c.r)) speed *= STORM_SLOW;
  let v: Spot;
  if (onIce) {
    // Slide: the joystick only nudges, and you keep going.
    const k = Math.min(1, dt * 1.5);
    v = { x: m.v.x + (d.x * speed - m.v.x) * k, y: m.v.y + (d.y * speed - m.v.y) * k };
  } else v = { x: d.x * speed, y: d.y * speed };
  let p = { x: clamp01(m.p.x + v.x * dt), y: clamp01(m.p.y + v.y * dt) };
  if (round && !opts.ghost) {
    if (round.hole && dist(p, START) < HOLE_R + AVATAR_R) {
      // Pushed back out to the rim.
      const a = Math.atan2(p.y - 0.5, p.x - 0.5);
      p = { x: 0.5 + Math.cos(a) * (HOLE_R + AVATAR_R), y: 0.5 + Math.sin(a) * (HOLE_R + AVATAR_R) };
    }
    if (gateShut(round, t) && round.gate !== null && cornerOf(p) === round.gate && cornerOf(m.p) !== round.gate) p = { ...m.p };
    for (const ro of rollersOf(round)) {
      const r = rollerAt(ro, t);
      if (dist(p, r) < ro.r + AVATAR_R) {
        // Knocked flying out of the corners, towards the middle of the board, plus a shove the way it rolls.
        const s = ro.at < 0.5 ? 1 : -1;
        const phase = (t % ro.periodMs) / ro.periodMs;
        const fwd = phase < 0.5 ? 1 : -1;
        const kx = ro.axis === 'x' ? fwd * 0.45 : s;
        const ky = ro.axis === 'x' ? s : fwd * 0.45;
        const kl = Math.hypot(kx, ky);
        const kv = { x: (kx / kl) * KNOCK_SPEED, y: (ky / kl) * KNOCK_SPEED };
        // Out of its way at once, then flying.
        const push = ro.r + AVATAR_R + 0.01;
        const out = ro.axis === 'x' ? { x: p.x, y: clamp01(r.y + s * push) } : { x: clamp01(r.x + s * push), y: p.y };
        return { p: out, v: kv, stun: t + KNOCK_MS, hitAt: t };
      }
    }
  }
  if (round) {
    for (const tp of round.teleports) {
      // Walking onto one end puts you just past the other (moving in the same direction, so you don't bounce back).
      if (dist(m.p, tp.a) >= TELEPORT_R && dist(p, tp.a) < TELEPORT_R) return { p: { x: clamp01(tp.b.x + v.x * 0.25), y: clamp01(tp.b.y + v.y * 0.25) }, v };
      if (dist(m.p, tp.b) >= TELEPORT_R && dist(p, tp.b) < TELEPORT_R) return { p: { x: clamp01(tp.a.x + v.x * 0.25), y: clamp01(tp.a.y + v.y * 0.25) }, v };
    }
  }
  return { p, v: onIce ? v : { x: 0, y: 0 }, ...(m.hitAt !== undefined ? { hitAt: m.hitAt } : {}) };
}

// ---- Making rounds ----

const pick = <T>(list: readonly T[], random: () => number): T => list[Math.floor(random() * list.length) % list.length];

/** Which mechanics a round has: each new one alone on its unlock round (with the earlier ones sometimes), then a mix. */
export function mechanicsFor(n: number, random: () => number): Set<Mechanic> {
  const out = new Set<Mechanic>();
  const open = MECHANICS.filter((m) => UNLOCK[m] <= n);
  if (open.includes('items')) out.add('items');
  const fresh = MECHANICS.find((m) => UNLOCK[m] === n);
  if (fresh) {
    out.add(fresh);
    // One older mechanic now and then, so earlier ones keep coming back.
    const older = open.filter((m) => m !== 'items' && m !== fresh);
    if (older.length && random() < 0.4) out.add(pick(older, random));
    return out;
  }
  const others = open.filter((m) => m !== 'items');
  const count = Math.min(others.length, 2 + Math.floor(random() * 3));
  const bag = [...others];
  while (out.size < count + (open.includes('items') ? 1 : 0) && bag.length) out.add(bag.splice(Math.floor(random() * bag.length), 1)[0]);
  return out;
}

/** Somewhere in the open middle band (not in a corner, not on the hole). */
function openSpot(random: () => number, hole: boolean): Spot {
  for (let i = 0; i < 20; i++) {
    const p = { x: 0.12 + random() * 0.76, y: 0.12 + random() * 0.76 };
    if (cornerOf(p) !== null) continue;
    if (hole && dist(p, START) < HOLE_R + 0.06) continue;
    return p;
  }
  return { x: 0.5, y: 0.2 };
}

export function makeRound(g: CornersGame, n: number, startAt: number, random: () => number, players: number): Round {
  const has = mechanicsFor(n, random);
  const hole = has.has('hole');
  const storms: Circle[] = has.has('storm') ? Array.from({ length: 1 + Math.floor(random() * 2) }, () => ({ ...openSpot(random, hole), r: 0.12 + random() * 0.06 })) : [];
  const ice: Circle[] = has.has('ice') ? Array.from({ length: 1 + Math.floor(random() * 2) }, () => ({ ...openSpot(random, hole), r: 0.1 + random() * 0.05 })) : [];
  // A teleport joins two opposite sides, so it can save a long run.
  const teleports: Teleport[] = [];
  if (has.has('teleport')) {
    const along = 0.3 + random() * 0.4;
    teleports.push(random() < 0.5 ? { a: { x: 0.08, y: along }, b: { x: 0.92, y: 1 - along } } : { a: { x: along, y: 0.08 }, b: { x: 1 - along, y: 0.92 } });
  }
  // Two rollers, one each way, rolling through the corners (in the middle they missed everyone).
  const cornerLine = () => (random() < 0.5 ? 0.09 + random() * 0.1 : 0.81 + random() * 0.1);
  const roller: Roller | null = has.has('roller') ? { axis: 'x', at: cornerLine(), r: 0.08, periodMs: 4500 + Math.floor(random() * 1500) } : null;
  const roller2: Roller | null = has.has('roller') ? { axis: 'y', at: cornerLine(), r: 0.08, periodMs: 5200 + Math.floor(random() * 1500) } : null;
  const gate: Corner | null = has.has('gate') ? pick(CORNERS, random) : null;
  const twist = has.has('twist') ? (random() < 0.6 ? 'two' : 'lucky') : null;
  const items: Item[] = [];
  if (has.has('items')) {
    // About one item for every 6 pupils, at least 2.
    const count = Math.max(2, Math.min(8, Math.round(players / 6)));
    for (let i = 0; i < count; i++) items.push({ id: g.nextItem++, power: pick(POWERS, random), by: null, ...openSpot(random, hole) });
  }
  const first = pick(CORNERS, random);
  const rolled: Corner[] = twist === 'lucky' ? [] : twist === 'two' ? [first, ((first + 1 + Math.floor(random() * 3)) % 4) as Corner] : [first];
  const run = g.runS ? g.runS * 1000 : runMs(n);
  return {
    n, startAt, runEnd: startAt + run, rollEnd: startAt + run + ROLL_MS, showEnd: startAt + run + ROLL_MS + SHOW_MS,
    storms, ice, teleports, roller, roller2, hole, fog: has.has('fog'), gate, twist, items, rolled, caught: null, saved: [],
    ...(g.halfAt !== undefined ? startAt >= g.halfAt : n >= SWAP_ROUND) ? { swap: true } : {},
  };
}

export function newCorners(map: CornerMap, runS: number = RUN_DEFAULT_S): CornersGame {
  return { kind: 'corners', map, round: null, mine: {}, nextItem: 1, runS: runSeconds(runS) };
}

export function freshMine(i: number): CornersMine {
  return {
    safe: 0, score: 0, caught: 0, jailedIn: null, jailRight: 0, escapes: 0, held: null, shieldIn: null, speedTo: null, ghostTo: null,
    doubleIn: null, crystalIn: null, jumpIn: null, powersUsed: 0, grabs: 0, freed: 0, answered: 0, lastAt: -ANSWER_GAP_MS, placed: 0, spot: startSpot(i),
  };
}

export const inJail = (m: CornersMine | undefined) => !!m && m.jailedIn !== null;
/**
 * When a jailed pupil with all their right answers walks free (session ms), or null. They come back as the round after
 * the one they sat out starts: this round's end if they were caught before it, else the end of the next round.
 */
export function freeAt(g: CornersGame, m: CornersMine | undefined): number | null {
  const r = g.round;
  if (!m || m.jailedIn === null || m.jailRight < JAIL_RIGHT || !r) return null;
  if (m.jailedIn < r.n) return r.showEnd;
  return r.showEnd + (g.runS ? g.runS * 1000 : runMs(r.n + 1)) + ROLL_MS + SHOW_MS;
}
export const boosted = (m: CornersMine | undefined, n: number) => !!m && m.speedTo !== null && n <= m.speedTo;
export const ghostly = (m: CornersMine | undefined, n: number) => !!m && m.ghostTo !== null && n <= m.ghostTo;

/** Time is up and the last round has been shown (or never started): the game can end. */
export const cornersDone = (g: CornersGame, t: number) => !g.round || (g.round.caught !== null && t >= g.round.showEnd);

/** The time of the next thing the server must do (end a run, start the next round), or null. */
export function nextDeadline(g: CornersGame, startedAt: number | null): number | null {
  if (startedAt === null) return null;
  if (!g.round) return READY_MS;
  if (g.round.caught === null) return g.round.runEnd;
  return g.round.showEnd;
}

/** Positions as the server last saw them: player → spot (missing: where the server last put them). */
export type Positions = Record<string, Spot>;

/**
 * Moves the game on to time t: ends the run (who is caught, from `positions`), starts the next round (lets out pupils
 * who have served their round and got 3 right). `order` is the players in join order. Needs positions only when a run
 * is ending (`needsPositions`).
 */
export function needsPositions(g: CornersGame, t: number): boolean {
  return !!g.round && g.round.caught === null && t >= g.round.runEnd;
}

export function advance(g: CornersGame, t: number, order: string[], positions: Positions, random: () => number, last = false): CornersEvent[] {
  const events: CornersEvent[] = [];
  for (let guard = 0; guard < 4; guard++) {
    const r = g.round;
    if (!r) {
      if (t < READY_MS || last) break;
      g.round = makeRound(g, 1, READY_MS, random, order.length);
      events.push({ type: 'round', t: READY_MS, n: 1 });
      continue;
    }
    if (r.caught === null) {
      if (t < r.runEnd) break;
      events.push(endRun(g, r, order, positions));
      continue;
    }
    // Time is up: the round that was on is the last one.
    if (t < r.showEnd || last) break;
    // Next round. If the game sat idle a long time (no screen asking), start it now rather than replaying missed rounds.
    const startAt = t - r.showEnd > 2000 ? t : r.showEnd;
    for (const id of order) {
      const m = g.mine[id];
      if (m && m.jailedIn !== null && m.jailedIn < r.n && m.jailRight >= JAIL_RIGHT) {
        m.jailedIn = null;
        m.jailRight = 0;
        m.escapes++;
        m.spot = startSpot(order.indexOf(id));
        m.placed++;
        events.push({ type: 'escape', t: startAt, pupil: id });
      }
    }
    g.round = makeRound(g, r.n + 1, startAt, random, order.length);
    events.push({ type: 'round', t: startAt, n: r.n + 1 });
  }
  return events;
}

function endRun(g: CornersGame, r: Round, order: string[], positions: Positions): CornersEvent {
  const caught: string[] = [];
  const saved: string[] = [];
  const stayed: string[] = [];
  const lucky = r.twist === 'lucky';
  // How many free pupils stand in each corner (for "a corner all to themselves").
  const inCorner = [0, 0, 0, 0];
  for (const id of order) {
    const m = g.mine[id];
    if (!m || m.jailedIn !== null) continue;
    const c = cornerOf(positions[id] ?? m.spot);
    if (c !== null) inCorner[c]++;
  }
  if (!lucky) {
    const rolls = g.rolls ?? [0, 0, 0, 0];
    for (const c of r.rolled) rolls[c]++;
    g.rolls = rolls;
  }
  for (const id of order) {
    const m = g.mine[id];
    if (!m || m.jailedIn !== null) continue;
    const at = positions[id] ?? m.spot;
    m.spot = { x: at.x, y: at.y };
    const c = cornerOf(at);
    const stayedPut = !!r.swap && c !== null && m.lastCorner === c;
    const out = c === null || (!lucky && (r.rolled.includes(c) || stayedPut));
    if (stayedPut && out) stayed.push(id);
    m.lastCorner = out ? null : c;
    if (!out) {
      m.safe++;
      m.score += m.doubleIn === r.n ? 2 : 1;
      if (c !== null && inCorner[c] === 1) m.alone = (m.alone ?? 0) + 1;
      if ((lucky && (c === null || r.rolled.includes(c))) || (!lucky && r.rolled.length > 1)) m.lucky = (m.lucky ?? 0) + 1;
      continue;
    }
    if (m.shieldIn === r.n) {
      m.lucky = (m.lucky ?? 0) + 1;
      m.lastCorner = c;
      saved.push(id);
      // Stragglers saved by a shield still score nothing, but stay free.
      continue;
    }
    caught.push(id);
    m.caught++;
    m.jailedIn = r.n;
    m.jailRight = 0;
    m.held = null;
  }
  r.caught = caught;
  r.saved = saved;
  if (stayed.length) r.stayed = stayed;
  g.caughtAll = (g.caughtAll ?? 0) + caught.length;
  return { type: 'roll', t: r.runEnd, n: r.n, rolled: r.rolled, lucky, caught, saved, ...(stayed.length ? { stayed } : {}) };
}

/** Running over an item picks it up (one at a time; pupils in jail can't). */
export function grab(g: CornersGame, who: string, itemId: unknown, at: Spot | undefined, t: number): { ok: true; events: CornersEvent[] } | { ok: false; reason: 'not_now' | 'gone' | 'far' | 'full' } {
  const r = g.round;
  const m = g.mine[who];
  if (!r || !m || r.caught !== null || t < r.startAt || t >= r.runEnd || m.jailedIn !== null) return { ok: false, reason: 'not_now' };
  if (m.held) return { ok: false, reason: 'full' };
  const item = r.items.find((x) => x.id === itemId);
  if (!item || item.by) return { ok: false, reason: 'gone' };
  if (!at || dist(at, item) > GRAB_R + AVATAR_R + 0.03) return { ok: false, reason: 'far' };
  item.by = who;
  m.held = item.power;
  m.grabs++;
  return { ok: true, events: [{ type: 'grab', t, pupil: who, power: item.power }] };
}

/** The pad says it stepped through a teleport: counted when the saved spot is by one, at most WARPS_A_ROUND a round. */
export function warp(g: CornersGame, who: string, at: Spot | undefined, t: number): boolean {
  const r = g.round;
  const m = g.mine[who];
  if (!r || !m || !at || m.jailedIn !== null || t < r.startAt || t > r.runEnd + 500) return false;
  if (!r.teleports.some((tp) => dist(at, tp.a) < TELEPORT_R + 0.12 || dist(at, tp.b) < TELEPORT_R + 0.12)) return false;
  if (m.warpRound !== r.n) { m.warpRound = r.n; m.warpN = 0; }
  if ((m.warpN ?? 0) >= WARPS_A_ROUND) return false;
  m.warpN = (m.warpN ?? 0) + 1;
  m.warps = (m.warps ?? 0) + 1;
  return true;
}

/** What a question is for right now: getting out of jail, switching on a held power-up (standing in a corner), or nothing. */
export function questionFor(g: CornersGame, who: string, at: Spot | undefined, t: number): 'jail' | 'power' | null {
  const m = g.mine[who];
  if (!m) return null;
  if (m.jailedIn !== null) return m.jailRight < JAIL_RIGHT ? 'jail' : null;
  const r = g.round;
  if (!m.held || !r || r.caught !== null || t >= r.runEnd || !at || cornerOf(at) === null) return null;
  return 'power';
}

/** A marked answer: in jail it counts towards getting out; otherwise a right one switches on the held power-up. */
export function answered(g: CornersGame, who: string, right: boolean, purpose: 'jail' | 'power', order: string[], t: number, ms?: number): { ok: true; events: CornersEvent[] } | { ok: false; reason: 'too_soon' | 'not_now' } {
  const m = g.mine[who];
  if (!m) return { ok: false, reason: 'not_now' };
  if (t - m.lastAt < ANSWER_GAP_MS) return { ok: false, reason: 'too_soon' };
  m.lastAt = t;
  m.answered++;
  if (right) {
    m.right = (m.right ?? 0) + 1;
    m.streak = (m.streak ?? 0) + 1;
    m.bestStreak = Math.max(m.bestStreak ?? 0, m.streak);
    if (ms !== undefined && ms >= 300 && (m.fastMs === undefined || ms < m.fastMs)) m.fastMs = ms;
  } else {
    m.wrong = (m.wrong ?? 0) + 1;
    m.streak = 0;
  }
  if (purpose === 'jail') {
    if (m.jailedIn === null) return { ok: false, reason: 'not_now' };
    if (!right) return { ok: true, events: [] };
    m.jailRight = Math.min(JAIL_RIGHT, m.jailRight + 1);
    return { ok: true, events: [{ type: 'jail_right', t, pupil: who, right: m.jailRight }] };
  }
  const r = g.round;
  if (!m.held || !r || m.jailedIn !== null) return { ok: false, reason: 'not_now' };
  if (!right) return { ok: true, events: [] };
  const power = m.held;
  m.held = null;
  m.powersUsed++;
  const n = r.n;
  const ev: CornersEvent = { type: 'power', t, pupil: who, power };
  if (power === 'shield') m.shieldIn = n;
  else if (power === 'speed') m.speedTo = n + 2;
  else if (power === 'ghost') m.ghostTo = n + 1;
  else if (power === 'double') m.doubleIn = n;
  else if (power === 'crystal') m.crystalIn = n;
  else if (power === 'jump') m.jumpIn = n;
  else if (power === 'key') {
    // The jailed pupil closest to getting out (most right answers, then caught earliest).
    const friend = order
      .filter((id) => id !== who && g.mine[id]?.jailedIn !== null && g.mine[id] !== undefined)
      .sort((a, b) => g.mine[b].jailRight - g.mine[a].jailRight || (g.mine[a].jailedIn ?? 0) - (g.mine[b].jailedIn ?? 0))[0];
    if (friend) {
      const f = g.mine[friend];
      f.jailRight = JAIL_RIGHT;
      // A key lets them out at the next round's start even if they haven't sat a whole round out yet.
      f.jailedIn = Math.min(f.jailedIn ?? n, n - 1);
      m.freed++;
      ev.freed = friend;
    }
  }
  return { ok: true, events: [ev] };
}

/** A switched-on Jump: hop to a corner (not a shut gate's). */
export function jump(g: CornersGame, who: string, corner: unknown, order: string[], t: number): { ok: true; spot: Spot } | { ok: false } {
  const r = g.round;
  const m = g.mine[who];
  if (!r || !m || m.jumpIn !== r.n || r.caught !== null || t >= r.runEnd || m.jailedIn !== null) return { ok: false };
  if (!CORNERS.includes(corner as Corner)) return { ok: false };
  if (r.gate === corner && gateShut(r, t)) return { ok: false };
  const c = cornerCentre(corner as Corner);
  const i = order.indexOf(who);
  const spot = { x: c.x + (((i % 5) - 2) * 0.018), y: c.y + ((Math.floor(i / 5) % 5) - 2) * 0.018 };
  m.jumpIn = null;
  m.spot = spot;
  m.placed++;
  return { ok: true, spot };
}

/** A safe corner for a Crystal ball (one not rolled), the same for the whole round. */
export function crystalCorner(r: Round): Corner {
  const safe = CORNERS.filter((c) => !r.rolled.includes(c));
  return safe[r.n % safe.length];
}

/** The podium: players with the top 3 scores (ties share a place). */
export function podium(g: CornersGame, order: string[]): { player: string; place: 1 | 2 | 3 }[] {
  const scores = [...new Set(order.map((id) => g.mine[id]?.score ?? 0))].filter((s) => s > 0).sort((a, b) => b - a).slice(0, 3);
  return order
    .map((id) => ({ player: id, s: g.mine[id]?.score ?? 0 }))
    .filter((x) => scores.includes(x.s))
    .sort((a, b) => b.s - a.s)
    .map((x) => ({ player: x.player, place: (scores.indexOf(x.s) + 1) as 1 | 2 | 3 }));
}

/**
 * What the database does with a pupil's saved move (classlive_move mirrors this): kept on the board, and no further
 * from the last saved spot than the fastest speed allows (with slack), unless it is a teleport's far end.
 */
export function clampMove(prev: { x: number; y: number; at: number } | undefined, next: Spot, at: number, teleports: Teleport[]): Spot {
  const p = { x: Math.min(1, Math.max(0, next.x)), y: Math.min(1, Math.max(0, next.y)) };
  if (!prev) return p;
  const most = MAX_SPEED * Math.min(5, Math.max(0, at - prev.at) / 1000) + 0.05;
  const gap = dist(prev, p);
  if (gap <= most) return p;
  if (teleports.some((tp) => (dist(p, tp.a) < 0.12 && dist(prev, tp.b) < 0.15) || (dist(p, tp.b) < 0.12 && dist(prev, tp.a) < 0.15))) return p;
  const k = most / gap;
  return { x: prev.x + (p.x - prev.x) * k, y: prev.y + (p.y - prev.y) * k };
}

/** A pretend pupil's joystick: head for a corner (a different one now and then), a little wobbly. */
export function pretendDir(p: Spot, target: Corner, random: () => number): Spot {
  const c = cornerCentre(target);
  const dx = c.x - p.x + (random() - 0.5) * 0.1;
  const dy = c.y - p.y + (random() - 0.5) * 0.1;
  const len = Math.hypot(dx, dy);
  return len < 0.02 ? { x: 0, y: 0 } : { x: dx / len, y: dy / len };
}
