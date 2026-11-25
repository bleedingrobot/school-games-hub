/**
 * Floor is Lava (docs/LAVA-PLAN.md): the rules, pure functions only. Pupils run their avatars over a floor of tiles
 * above a lake of lava. Each round some tiles glow; when the countdown ends they crack and sink, and anyone standing on
 * lava falls onto the lava raft. Right answers earn bricks (rebuild a sunk tile next to you, or pull a friend off the
 * raft) and switch on power-ups. Three right answers on the raft and you climb back on at the next round.
 *
 * Movement happens on each pupil's device (`stepLava`, the same here and in the preview) and is saved through the shared
 * `classlive_move` (clamped to MAX_SPEED); the server reads the saved spots when a run ends (`advanceLava`).
 */

export const LAVA_MAPS = ['volcano', 'dragon', 'forge', 'planet'] as const;
export type LavaMap = (typeof LAVA_MAPS)[number];

export const LAVA_POWERS = ['boots', 'freeze', 'speed', 'double', 'rope'] as const;
export type LavaPower = (typeof LAVA_POWERS)[number];

/** Floor patterns, unlocked round by round (then mixed). */
export const PATTERNS = ['patches', 'rows', 'checker', 'ring', 'cross', 'islands', 'wave'] as const;
export type Pattern = (typeof PATTERNS)[number];
export const PATTERN_FROM: Record<Pattern, number> = { patches: 1, rows: 3, checker: 4, ring: 5, cross: 6, islands: 8, wave: 10 };

export const LAVA_MECHANICS = ['items', 'bubbles', 'crust', 'fireball', 'late'] as const;
export type LavaMechanic = (typeof LAVA_MECHANICS)[number];
/** The round each mechanic first appears ("bit by bit so it isn't chaos", as Four Corners). */
export const LAVA_UNLOCK: Record<LavaMechanic, number> = { items: 2, bubbles: 3, crust: 5, fireball: 7, late: 9 };

export const LAVA_WORDS: Record<LavaMap, { name: string; bubbles: string; crust: string; fireball: string; raft: string; late: string }> = {
  volcano: { name: 'Volcano Island', bubbles: 'Lava bubbles', crust: 'Slippery ash', fireball: 'Rolling lava ball', raft: 'Lava raft', late: 'Aftershock' },
  dragon: { name: "Dragon's Lair", bubbles: 'Dragon smoke', crust: 'Gold coins', fireball: 'Dragon fireball', raft: 'Bone raft', late: 'Dragon roar' },
  forge: { name: 'Lava Forge', bubbles: 'Steam vents', crust: 'Oily floor', fireball: 'Runaway cart', raft: 'Iron raft', late: 'Hammer quake' },
  planet: { name: 'Lava Planet', bubbles: 'Hot geysers', crust: 'Glassy rock', fireball: 'Rolling meteor', raft: 'Rescue pod', late: 'Moonquake' },
};

export const LAVA_POWER_WORDS: Record<LavaPower, { name: string; emoji: string; how: string }> = {
  boots: { name: 'Fire boots', emoji: '🥾', how: "Lava can't hurt you this round." },
  freeze: { name: 'Ice blast', emoji: '❄️', how: 'Cools the glowing tiles around you so they stay up.' },
  speed: { name: 'Speed boost', emoji: '⚡', how: 'Run faster this round and the next two.' },
  double: { name: 'Double star', emoji: '⭐', how: 'Two points if you stay up this round.' },
  rope: { name: 'Rescue rope', emoji: '🪢', how: 'Pulls a friend off the raft for free.' },
};

// ---- Sizes and times ----

/** Tiles a side: the floor is GRID × GRID tiles over the unit square. */
export const GRID = 8;
export const TILE = 1 / GRID;
export const TILES = GRID * GRID;
export const SPEED = 0.3;
export const BOOST = 1.6;
export const BUBBLE_SLOW = 0.45;
/** The fastest anyone can go (classlive_move clamps saved moves to its activity's max_speed, 0.6). */
export const MAX_SPEED = SPEED * BOOST * 1.25;
export const AVATAR_R = 0.03;
export const GRAB_R = 0.07;
/** How far (centre to centre) from your saved spot a brick can rebuild a tile. */
export const BUILD_REACH = 0.24;
export const FREEZE_REACH = 1.6 * TILE;
export const CRACK_MS = 2200;
export const SHOW_MS = 3800;
export const READY_MS = 4000;
export const RAFT_RIGHT = 3;
export const ANSWER_GAP_MS = 1500;
export const MAX_BRICKS = 3;
export const RESCUE_BRICKS = 2;
/** A sunk tile cools back to rock after this many rounds (so the floor never runs out). */
export const COOL_ROUNDS = 2;
/** Late cracks start glowing this long before the run ends. */
export const LATE_MS = 3000;

export const RUN_MIN_S = 5;
export const RUN_MAX_S = 10;
export const RUN_DEFAULT_S = 7;
export const lavaRunSeconds = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(RUN_MIN_S, Math.min(RUN_MAX_S, Math.round(v))) : RUN_DEFAULT_S;

// ---- Shapes ----

export interface Spot { x: number; y: number }
export interface Circle extends Spot { r: number }
export interface Fireball { axis: 'x' | 'y'; at: number; r: number; periodMs: number }
export interface LavaItem extends Spot { id: number; power: LavaPower; by: string | null }

export interface LavaRound {
  n: number;
  startAt: number;
  runEnd: number;
  crackEnd: number;
  showEnd: number;
  pattern: Pattern;
  /** Tiles glowing from the start (they sink at runEnd unless frozen). */
  glow: number[];
  /** Tiles that start glowing LATE_MS before the end (shown on devices from then). */
  late: number[];
  /** Glowing tiles an Ice blast cooled. */
  frozen: number[];
  bubbles: Circle[];
  crust: Circle[];
  fireball: Fireball | null;
  items: LavaItem[];
  /** Filled when the run ends. */
  fell: string[] | null;
  /** Saved by Fire boots. */
  booted: string[];
}

export interface LavaMine {
  up: number;
  score: number;
  falls: number;
  /** The round they fell in, or null when on the floor. */
  raftIn: number | null;
  raftRight: number;
  climbs: number;
  bricks: number;
  built: number;
  rescues: number;
  held: LavaPower | null;
  bootsIn: number | null;
  speedTo: number | null;
  doubleIn: number | null;
  powersUsed: number;
  grabs: number;
  answered: number;
  right: number;
  wrong: number;
  streak: number;
  bestStreak: number;
  fastMs?: number;
  lastAt: number;
  /** Bumped when the server moves them (back from the raft), so their device snaps to `spot`. */
  placed: number;
  spot: Spot;
}

export interface LavaGame {
  kind: 'lava';
  map: LavaMap;
  round: LavaRound | null;
  /** Per tile: the last round it is lava in (0: solid rock). */
  sunk: number[];
  mine: Record<string, LavaMine>;
  nextItem: number;
  runS: number;
  /** Class totals for the end screen. */
  sankAll: number;
  builtAll: number;
}

export type LavaEvent =
  | { type: 'round'; t: number; n: number; pattern: Pattern }
  | { type: 'crack'; t: number; n: number; sank: number[]; fell: string[]; booted: string[] }
  | { type: 'lava_grab'; t: number; pupil: string; power: LavaPower }
  | { type: 'lava_power'; t: number; pupil: string; power: LavaPower; freed?: string; cooled?: number[] }
  | { type: 'build'; t: number; pupil: string; tile: number }
  | { type: 'rescue'; t: number; pupil: string; friend: string }
  | { type: 'climb'; t: number; pupil: string }
  | { type: 'raft_right'; t: number; pupil: string; right: number };

// ---- Floor helpers ----

export const START: Spot = { x: 0.5, y: 0.5 };
const dist = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp01 = (v: number) => Math.min(1 - AVATAR_R, Math.max(AVATAR_R, v));

export const tileAt = (p: Spot): number => {
  const c = Math.min(GRID - 1, Math.max(0, Math.floor(p.x * GRID)));
  const r = Math.min(GRID - 1, Math.max(0, Math.floor(p.y * GRID)));
  return r * GRID + c;
};
export const tileCentre = (i: number): Spot => ({ x: ((i % GRID) + 0.5) * TILE, y: (Math.floor(i / GRID) + 0.5) * TILE });

/** Is tile i lava during round n (sunk before, not cooled yet)? */
export const isLava = (g: Pick<LavaGame, 'sunk'>, i: number, n: number) => g.sunk[i] >= n && g.sunk[i] > 0;

/** A start spot near the middle, spread so avatars don't sit on top of each other. */
export function lavaStartSpot(i: number): Spot {
  const a = i * 2.399963;
  const r = 0.03 + 0.14 * Math.sqrt(((i % 40) + 0.5) / 40);
  return { x: 0.5 + Math.cos(a) * r, y: 0.5 + Math.sin(a) * r };
}

/** A seat on the raft (drawn beside the floor). */
export function raftSpot(i: number): Spot {
  return { x: 0.2 + (i % 8) * 0.085, y: 1.08 + Math.floor(i / 8) * 0.06 };
}

export function fireballAt(f: Fireball, t: number): Spot {
  const phase = (t % f.periodMs) / f.periodMs;
  const along = phase < 0.5 ? phase * 2 : 2 - phase * 2;
  const v = -0.1 + along * 1.2;
  return f.axis === 'x' ? { x: v, y: f.at } : { x: f.at, y: v };
}

export const KNOCK_SPEED = 0.8;
export const KNOCK_MS = 500;

export interface LavaMove {
  p: Spot;
  v: Spot;
  stun?: number;
  hitAt?: number;
}

/** What movement needs of the game (the pupils' copy has these too). */
export type LavaMoveWorld = { sunk: number[]; round: Pick<LavaRound, 'n' | 'bubbles' | 'crust' | 'fireball'> | null };

/**
 * One step of movement: `dir` is the joystick (length 0 to 1), dt in ms. Lava tiles are walls (you can't walk onto a sunk
 * tile unless you have Fire boots), bubbles slow you, crust keeps you sliding, the fireball knocks you flying.
 */
export function stepLava(m: LavaMove, dir: Spot, dtMs: number, w: LavaMoveWorld, t: number, opts: { boost: boolean; boots: boolean }): LavaMove {
  const dt = Math.min(100, Math.max(0, dtMs)) / 1000;
  const r = w.round;
  const n = r?.n ?? 0;
  const blocked = (p: Spot) => !opts.boots && n > 0 && isLava(w, tileAt(p), n) && !isLava(w, tileAt(m.p), n);
  if (m.stun !== undefined && t < m.stun) {
    const k = Math.max(0, 1 - dt * 2.2);
    const v = { x: m.v.x * k, y: m.v.y * k };
    const p = { x: clamp01(m.p.x + v.x * dt), y: clamp01(m.p.y + v.y * dt) };
    // Knocked flying can throw you into the lava: that is the drama.
    return { ...m, p, v };
  }
  const len = Math.hypot(dir.x, dir.y);
  const d = len > 1 ? { x: dir.x / len, y: dir.y / len } : dir;
  let speed = SPEED * (opts.boost ? BOOST : 1);
  if (r && r.bubbles.some((c) => dist(c, m.p) < c.r)) speed *= BUBBLE_SLOW;
  const onCrust = !!r && r.crust.some((c) => dist(c, m.p) < c.r);
  let v: Spot;
  if (onCrust) {
    const k = Math.min(1, dt * 1.5);
    v = { x: m.v.x + (d.x * speed - m.v.x) * k, y: m.v.y + (d.y * speed - m.v.y) * k };
  } else v = { x: d.x * speed, y: d.y * speed };
  let p = { x: clamp01(m.p.x + v.x * dt), y: clamp01(m.p.y + v.y * dt) };
  if (blocked(p)) {
    // Slide along the edge of the lava: try each direction on its own.
    const px = { x: p.x, y: m.p.y };
    const py = { x: m.p.x, y: p.y };
    if (!blocked(px)) p = px;
    else if (!blocked(py)) p = py;
    else p = { ...m.p };
    v = { x: 0, y: 0 };
  }
  if (r?.fireball) {
    const f = r.fireball;
    const fp = fireballAt(f, t);
    if (dist(p, fp) < f.r + AVATAR_R) {
      const s = f.at < 0.5 ? 1 : -1;
      const phase = (t % f.periodMs) / f.periodMs;
      const fwd = phase < 0.5 ? 1 : -1;
      const kx = f.axis === 'x' ? fwd * 0.45 : s;
      const ky = f.axis === 'x' ? s : fwd * 0.45;
      const kl = Math.hypot(kx, ky);
      const push = f.r + AVATAR_R + 0.01;
      const out = f.axis === 'x' ? { x: p.x, y: clamp01(fp.y + s * push) } : { x: clamp01(fp.x + s * push), y: p.y };
      return { p: out, v: { x: (kx / kl) * KNOCK_SPEED, y: (ky / kl) * KNOCK_SPEED }, stun: t + KNOCK_MS, hitAt: t };
    }
  }
  return { p, v: onCrust ? v : { x: 0, y: 0 }, ...(m.hitAt !== undefined ? { hitAt: m.hitAt } : {}) };
}

// ---- Making rounds ----

const pick = <T>(list: readonly T[], random: () => number): T => list[Math.floor(random() * list.length) % list.length];
const rc = (i: number) => ({ c: i % GRID, r: Math.floor(i / GRID) });

/** The pattern for round n: each new one on its unlock round, then a mix of the open ones. */
export function patternFor(n: number, random: () => number): Pattern {
  const fresh = PATTERNS.find((p) => PATTERN_FROM[p] === n);
  if (fresh) return fresh;
  return pick(PATTERNS.filter((p) => PATTERN_FROM[p] <= n), random);
}

/** How much of the solid floor glows: almost a third at first, up to 60%. */
export const glowShare = (n: number) => Math.min(0.6, 0.3 + (n - 1) * 0.03);

/** The tiles a pattern lights up (before trimming to the share), from the solid tiles. */
export function patternTiles(pattern: Pattern, n: number, random: () => number): number[] {
  const all = Array.from({ length: TILES }, (_, i) => i);
  const odd = random() < 0.5 ? 1 : 0;
  switch (pattern) {
    case 'rows': {
      const cols = random() < 0.5;
      const k = odd;
      return all.filter((i) => ((cols ? rc(i).c : rc(i).r) + k) % 2 === 0);
    }
    case 'checker':
      return all.filter((i) => (rc(i).c + rc(i).r + odd) % 2 === 0);
    case 'ring': {
      // The outside ring, or the middle: one of the two.
      const edge = (i: number) => Math.min(rc(i).c, rc(i).r, GRID - 1 - rc(i).c, GRID - 1 - rc(i).r);
      const ring = Math.floor(random() * (GRID / 2));
      return all.filter((i) => edge(i) === ring || edge(i) === (ring + 2) % (GRID / 2));
    }
    case 'cross': {
      const a = 3 + Math.floor(random() * 2);
      return all.filter((i) => rc(i).c === a || rc(i).r === a || rc(i).c === a - 1 + (odd ? 2 : 0) || rc(i).r === 7 - a);
    }
    case 'islands': {
      // Everything except a few 2×2 islands.
      const keep = new Set<number>();
      const count = 3 + Math.floor(random() * 2);
      for (let k = 0; k < count; k++) {
        const c = Math.floor(random() * (GRID - 1));
        const r = Math.floor(random() * (GRID - 1));
        for (const [dc, dr] of [[0, 0], [1, 0], [0, 1], [1, 1]]) keep.add((r + dr) * GRID + c + dc);
      }
      return all.filter((i) => !keep.has(i));
    }
    case 'wave': {
      // A diagonal band sweeping across.
      const at = Math.floor(random() * GRID);
      return all.filter((i) => Math.abs(((rc(i).c + rc(i).r) % GRID) - at) <= 1 || Math.abs(((rc(i).c + rc(i).r) % GRID) - at) >= GRID - 1);
    }
    default: {
      // Random patches: a few blobs.
      const out = new Set<number>();
      const blobs = 3 + Math.floor(random() * 3) + Math.floor(n / 3);
      for (let k = 0; k < blobs; k++) {
        let i = Math.floor(random() * TILES);
        const size = 2 + Math.floor(random() * 4);
        for (let s = 0; s < size; s++) {
          out.add(i);
          const { c, r } = rc(i);
          const step = pick([[1, 0], [-1, 0], [0, 1], [0, -1]], random);
          const c2 = Math.min(GRID - 1, Math.max(0, c + step[0]));
          const r2 = Math.min(GRID - 1, Math.max(0, r + step[1]));
          i = r2 * GRID + c2;
        }
      }
      return [...out];
    }
  }
}

function shuffled<T>(list: T[], random: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Which mechanics a round has: each new one alone on its unlock round, then a mix. */
export function lavaMechanicsFor(n: number, random: () => number): Set<LavaMechanic> {
  const out = new Set<LavaMechanic>();
  const open = LAVA_MECHANICS.filter((m) => LAVA_UNLOCK[m] <= n);
  if (open.includes('items')) out.add('items');
  const fresh = LAVA_MECHANICS.find((m) => LAVA_UNLOCK[m] === n);
  if (fresh) {
    out.add(fresh);
    return out;
  }
  const others = shuffled(open.filter((m) => m !== 'items'), random);
  const count = Math.min(others.length, 1 + Math.floor(random() * 3));
  for (const m of others.slice(0, count)) out.add(m);
  return out;
}

export function makeLavaRound(g: LavaGame, n: number, startAt: number, random: () => number, players: number): LavaRound {
  const has = lavaMechanicsFor(n, random);
  const pattern = patternFor(n, random);
  const solid = Array.from({ length: TILES }, (_, i) => i).filter((i) => !isLava(g, i, n));
  const solidSet = new Set(solid);
  // The pattern's tiles that are still rock, trimmed so at most the round's share glows and enough floor is left for
  // everyone (about two avatars a tile, and never under a fifth of the floor).
  let lit = shuffled(patternTiles(pattern, n, random).filter((i) => solidSet.has(i)), random);
  const keepAtLeast = Math.max(Math.ceil(TILES * 0.2), Math.ceil(players / 2) + 4);
  const most = Math.max(0, Math.min(Math.round(solid.length * glowShare(n) * (pattern === 'patches' ? 1 : 1.6)), solid.length - keepAtLeast));
  lit = lit.slice(0, most);
  const late: number[] = [];
  if (has.has('late')) {
    const litSet = new Set(lit);
    const spare = shuffled(solid.filter((i) => !litSet.has(i)), random);
    late.push(...spare.slice(0, Math.min(4, Math.max(0, solid.length - lit.length - keepAtLeast))));
  }
  const openSpot = (): Spot => {
    for (let i = 0; i < 20; i++) {
      const p = { x: 0.08 + random() * 0.84, y: 0.08 + random() * 0.84 };
      if (!isLava(g, tileAt(p), n)) return p;
    }
    return { ...START };
  };
  const bubbles: Circle[] = has.has('bubbles') ? Array.from({ length: 1 + Math.floor(random() * 2) }, () => ({ ...openSpot(), r: 0.1 + random() * 0.05 })) : [];
  const crust: Circle[] = has.has('crust') ? Array.from({ length: 1 + Math.floor(random() * 2) }, () => ({ ...openSpot(), r: 0.09 + random() * 0.05 })) : [];
  const fireball: Fireball | null = has.has('fireball')
    ? { axis: random() < 0.5 ? 'x' : 'y', at: 0.15 + random() * 0.7, r: 0.06, periodMs: 4200 + Math.floor(random() * 1600) }
    : null;
  const items: LavaItem[] = [];
  if (has.has('items')) {
    const count = Math.max(2, Math.min(7, Math.round(players / 6)));
    for (let i = 0; i < count; i++) items.push({ id: g.nextItem++, power: pick(LAVA_POWERS, random), by: null, ...openSpot() });
  }
  const run = g.runS * 1000;
  return {
    n, startAt, runEnd: startAt + run, crackEnd: startAt + run + CRACK_MS, showEnd: startAt + run + CRACK_MS + SHOW_MS,
    pattern, glow: lit, late, frozen: [], bubbles, crust, fireball, items, fell: null, booted: [],
  };
}

export function newLava(map: LavaMap, runS: number = RUN_DEFAULT_S): LavaGame {
  return { kind: 'lava', map, round: null, sunk: Array(TILES).fill(0), mine: {}, nextItem: 1, runS: lavaRunSeconds(runS), sankAll: 0, builtAll: 0 };
}

export function freshLavaMine(i: number): LavaMine {
  return {
    up: 0, score: 0, falls: 0, raftIn: null, raftRight: 0, climbs: 0, bricks: 0, built: 0, rescues: 0, held: null, bootsIn: null, speedTo: null,
    doubleIn: null, powersUsed: 0, grabs: 0, answered: 0, right: 0, wrong: 0, streak: 0, bestStreak: 0, lastAt: -ANSWER_GAP_MS, placed: 0, spot: lavaStartSpot(i),
  };
}

export const onRaft = (m: LavaMine | undefined) => !!m && m.raftIn !== null;
export const lavaBoosted = (m: LavaMine | undefined, n: number) => !!m && m.speedTo !== null && n <= m.speedTo;
export const lavaBooted = (m: LavaMine | undefined, n: number) => !!m && m.bootsIn === n;

/** The tiles that sink this round (glowing, late, not frozen). */
export const sinking = (r: LavaRound): number[] => {
  const frozen = new Set(r.frozen);
  return [...new Set([...r.glow, ...r.late])].filter((i) => !frozen.has(i));
};

/** When a raft pupil with all their right answers climbs back (session ms), or null. */
export function climbAt(g: LavaGame, m: LavaMine | undefined): number | null {
  const r = g.round;
  if (!m || m.raftIn === null || m.raftRight < RAFT_RIGHT || !r) return null;
  // They sit out the round after the one they fell in (as Four Corners jail).
  if (m.raftIn < r.n) return r.showEnd;
  return r.showEnd + g.runS * 1000 + CRACK_MS + SHOW_MS;
}

export const lavaDone = (g: LavaGame, t: number) => !g.round || (g.round.fell !== null && t >= g.round.showEnd);

export function lavaDeadline(g: LavaGame, startedAt: number | null): number | null {
  if (startedAt === null) return null;
  if (!g.round) return READY_MS;
  if (g.round.fell === null) return g.round.runEnd;
  return g.round.showEnd;
}

export const lavaNeedsPositions = (g: LavaGame, t: number) => !!g.round && g.round.fell === null && t >= g.round.runEnd;

export type LavaPositions = Record<string, Spot>;

/** Moves the game on to time t: cracks the floor when a run ends (who falls, from `positions`), starts the next round. */
export function advanceLava(g: LavaGame, t: number, order: string[], positions: LavaPositions, random: () => number, last = false): LavaEvent[] {
  const events: LavaEvent[] = [];
  for (let guard = 0; guard < 4; guard++) {
    const r = g.round;
    if (!r) {
      if (t < READY_MS || last) break;
      g.round = makeLavaRound(g, 1, READY_MS, random, order.length);
      events.push({ type: 'round', t: READY_MS, n: 1, pattern: g.round.pattern });
      continue;
    }
    if (r.fell === null) {
      if (t < r.runEnd) break;
      events.push(crack(g, r, order, positions));
      continue;
    }
    if (t < r.showEnd || last) break;
    const startAt = t - r.showEnd > 2000 ? t : r.showEnd;
    for (const id of order) {
      const m = g.mine[id];
      if (m && m.raftIn !== null && m.raftIn < r.n && m.raftRight >= RAFT_RIGHT) {
        m.raftIn = null;
        m.raftRight = 0;
        m.climbs++;
        m.spot = safeSpot(g, r.n + 1, order.indexOf(id));
        m.placed++;
        events.push({ type: 'climb', t: startAt, pupil: id });
      }
    }
    g.round = makeLavaRound(g, r.n + 1, startAt, random, order.length);
    events.push({ type: 'round', t: startAt, n: r.n + 1, pattern: g.round.pattern });
  }
  return events;
}

/** A rock tile to climb back onto in round n (spread by player number), the middle if none. */
export function safeSpot(g: LavaGame, n: number, i: number): Spot {
  const solid = Array.from({ length: TILES }, (_, k) => k).filter((k) => !isLava(g, k, n));
  if (!solid.length) return { ...START };
  // Nearest the middle first, so climbers don't land on the edge.
  solid.sort((a, b) => dist(tileCentre(a), START) - dist(tileCentre(b), START));
  const c = tileCentre(solid[i % Math.min(solid.length, 12)]);
  return { x: c.x + (((i * 7) % 5) - 2) * 0.012, y: c.y + (((i * 3) % 5) - 2) * 0.012 };
}

function crack(g: LavaGame, r: LavaRound, order: string[], positions: LavaPositions): LavaEvent {
  const sank = sinking(r);
  for (const i of sank) g.sunk[i] = r.n + COOL_ROUNDS;
  g.sankAll += sank.length;
  const fell: string[] = [];
  const booted: string[] = [];
  for (const id of order) {
    const m = g.mine[id];
    if (!m || m.raftIn !== null) continue;
    const at = positions[id] ?? m.spot;
    m.spot = { x: at.x, y: at.y };
    // Lava now: sunk this round, or still sunk from before (a knocked-in pupil).
    const lava = g.sunk[tileAt(at)] >= r.n && g.sunk[tileAt(at)] > 0;
    if (!lava) {
      m.up++;
      m.score += m.doubleIn === r.n ? 2 : 1;
      continue;
    }
    if (m.bootsIn === r.n) {
      booted.push(id);
      m.up++;
      m.score++;
      continue;
    }
    fell.push(id);
    m.falls++;
    m.raftIn = r.n;
    m.raftRight = 0;
    m.held = null;
  }
  r.fell = fell;
  r.booted = booted;
  return { type: 'crack', t: r.runEnd, n: r.n, sank, fell, booted };
}

/** Running over an item picks it up (one at a time; not from the raft). */
export function lavaGrab(g: LavaGame, who: string, itemId: unknown, at: Spot | undefined, t: number): { ok: true; events: LavaEvent[] } | { ok: false; reason: 'not_now' | 'gone' | 'far' | 'full' } {
  const r = g.round;
  const m = g.mine[who];
  if (!r || !m || r.fell !== null || t < r.startAt || t >= r.runEnd || m.raftIn !== null) return { ok: false, reason: 'not_now' };
  if (m.held) return { ok: false, reason: 'full' };
  const item = r.items.find((x) => x.id === itemId);
  if (!item || item.by) return { ok: false, reason: 'gone' };
  if (!at || dist(at, item) > GRAB_R + AVATAR_R + 0.04) return { ok: false, reason: 'far' };
  item.by = who;
  m.held = item.power;
  m.grabs++;
  return { ok: true, events: [{ type: 'lava_grab', t, pupil: who, power: item.power }] };
}

/** What a question is for right now: climbing off the raft, switching on a held power-up, or earning a brick. */
export function lavaQuestionFor(g: LavaGame, who: string): 'raft' | 'power' | 'brick' | null {
  const m = g.mine[who];
  if (!m) return null;
  if (m.raftIn !== null) return m.raftRight < RAFT_RIGHT ? 'raft' : null;
  if (!g.round) return null;
  if (m.held) return 'power';
  return m.bricks < MAX_BRICKS ? 'brick' : null;
}

/** A rescue: they climb back at the next round's start, even if they haven't sat a whole round out. */
function free(g: LavaGame, friend: string, n: number) {
  const f = g.mine[friend];
  f.raftRight = RAFT_RIGHT;
  f.raftIn = Math.min(f.raftIn ?? n, n - 1);
}

/** The raft pupil closest to climbing back (most right answers, then fell earliest), not yet sure to climb. */
function nextOffRaft(g: LavaGame, order: string[], who: string): string | undefined {
  return order
    .filter((id) => id !== who && g.mine[id] && g.mine[id].raftIn !== null && g.mine[id].raftRight < RAFT_RIGHT)
    .sort((a, b) => g.mine[b].raftRight - g.mine[a].raftRight || (g.mine[a].raftIn ?? 0) - (g.mine[b].raftIn ?? 0))[0];
}

/** A marked answer: on the raft it counts towards climbing back; otherwise a right one switches on a power or earns a brick. */
export function lavaAnswered(g: LavaGame, who: string, right: boolean, order: string[], t: number, ms?: number):
  { ok: true; purpose: 'raft' | 'power' | 'brick'; events: LavaEvent[] } | { ok: false; reason: 'too_soon' | 'not_now' } {
  const m = g.mine[who];
  const purpose = lavaQuestionFor(g, who);
  if (!m || !purpose) return { ok: false, reason: 'not_now' };
  if (t - m.lastAt < ANSWER_GAP_MS) return { ok: false, reason: 'too_soon' };
  m.lastAt = t;
  m.answered++;
  if (right) {
    m.right++;
    m.streak++;
    m.bestStreak = Math.max(m.bestStreak, m.streak);
    if (ms !== undefined && ms >= 300 && (m.fastMs === undefined || ms < m.fastMs)) m.fastMs = ms;
  } else {
    m.wrong++;
    m.streak = 0;
  }
  if (!right) return { ok: true, purpose, events: [] };
  if (purpose === 'raft') {
    m.raftRight = Math.min(RAFT_RIGHT, m.raftRight + 1);
    return { ok: true, purpose, events: [{ type: 'raft_right', t, pupil: who, right: m.raftRight }] };
  }
  if (purpose === 'brick') {
    m.bricks = Math.min(MAX_BRICKS, m.bricks + 1);
    return { ok: true, purpose, events: [] };
  }
  const r = g.round!;
  const power = m.held!;
  m.held = null;
  m.powersUsed++;
  const ev: Extract<LavaEvent, { type: 'lava_power' }> = { type: 'lava_power', t, pupil: who, power };
  // Powers switched on after the run (during the crack or show) work in the next round.
  const n = r.fell === null ? r.n : r.n + 1;
  if (power === 'boots') m.bootsIn = n;
  else if (power === 'speed') m.speedTo = n + 2;
  else if (power === 'double') m.doubleIn = n;
  else if (power === 'freeze') {
    if (r.fell === null) {
      const near = [...r.glow, ...r.late].filter((i) => !r.frozen.includes(i) && dist(tileCentre(i), m.spot) <= FREEZE_REACH);
      r.frozen.push(...near);
      ev.cooled = near;
    } else {
      // Between rounds: cools the sunk tiles around you instead.
      const near = Array.from({ length: TILES }, (_, i) => i).filter((i) => g.sunk[i] > 0 && dist(tileCentre(i), m.spot) <= FREEZE_REACH);
      for (const i of near) g.sunk[i] = 0;
      ev.cooled = near;
    }
  } else if (power === 'rope') {
    const friend = nextOffRaft(g, order, who);
    if (friend) {
      free(g, friend, r.n);
      m.rescues++;
      ev.freed = friend;
    }
  }
  return { ok: true, purpose, events: [ev] };
}

/** Spends a brick to rebuild a sunk tile within reach of the pupil's saved spot. */
export function lavaBuild(g: LavaGame, who: string, tile: unknown, at: Spot | undefined, t: number): { ok: true; events: LavaEvent[] } | { ok: false; reason: 'not_now' | 'no_bricks' | 'far' | 'solid' } {
  const m = g.mine[who];
  const r = g.round;
  if (!m || !r || m.raftIn !== null) return { ok: false, reason: 'not_now' };
  if (m.bricks < 1) return { ok: false, reason: 'no_bricks' };
  if (!Number.isInteger(tile) || (tile as number) < 0 || (tile as number) >= TILES) return { ok: false, reason: 'solid' };
  const i = tile as number;
  const n = r.fell === null ? r.n : r.n + 1;
  // Only lava can be rebuilt (a bridge); a glowing tile can only be saved with an Ice blast.
  if (!isLava(g, i, n)) return { ok: false, reason: 'solid' };
  if (!at || dist(tileCentre(i), at) > BUILD_REACH) return { ok: false, reason: 'far' };
  m.bricks--;
  m.built++;
  g.builtAll++;
  g.sunk[i] = 0;
  return { ok: true, events: [{ type: 'build', t, pupil: who, tile: i }] };
}

/** Spends RESCUE_BRICKS to pull the raft pupil closest to climbing back off at the next round. */
export function lavaRescue(g: LavaGame, who: string, order: string[], t: number): { ok: true; events: LavaEvent[]; friend: string } | { ok: false; reason: 'not_now' | 'no_bricks' | 'nobody' } {
  const m = g.mine[who];
  if (!m || !g.round || m.raftIn !== null) return { ok: false, reason: 'not_now' };
  if (m.bricks < RESCUE_BRICKS) return { ok: false, reason: 'no_bricks' };
  const friend = nextOffRaft(g, order, who);
  if (!friend) return { ok: false, reason: 'nobody' };
  m.bricks -= RESCUE_BRICKS;
  m.rescues++;
  free(g, friend, g.round.n);
  return { ok: true, friend, events: [{ type: 'rescue', t, pupil: who, friend }] };
}

/** The best build target for a pupil standing at p: the nearest lava tile within reach (lava now, or after this run), or null. */
export function buildTarget(g: Pick<LavaGame, 'sunk'>, round: Pick<LavaRound, 'n' | 'fell'> | null, p: Spot): number | null {
  if (!round) return null;
  const n = round.fell === null ? round.n : round.n + 1;
  let best: number | null = null;
  let bestD = Infinity;
  for (let i = 0; i < TILES; i++) {
    if (!isLava(g, i, n)) continue;
    const d = dist(tileCentre(i), p);
    if (d <= BUILD_REACH - 0.02 && d < bestD) {
      best = i;
      bestD = d;
    }
  }
  return best;
}

/** The podium: players with the top 3 scores (ties share a place). */
export function lavaPodium(g: LavaGame, order: string[]): { player: string; place: 1 | 2 | 3 }[] {
  const scores = [...new Set(order.map((id) => g.mine[id]?.score ?? 0))].filter((s) => s > 0).sort((a, b) => b - a).slice(0, 3);
  return order
    .map((id) => ({ player: id, s: g.mine[id]?.score ?? 0 }))
    .filter((x) => scores.includes(x.s))
    .sort((a, b) => b.s - a.s)
    .map((x) => ({ player: x.player, place: (scores.indexOf(x.s) + 1) as 1 | 2 | 3 }));
}

/** A pretend pupil's joystick: towards a target spot, a little wobbly. */
export function lavaPretendDir(p: Spot, target: Spot, random: () => number): Spot {
  const dx = target.x - p.x + (random() - 0.5) * 0.06;
  const dy = target.y - p.y + (random() - 0.5) * 0.06;
  const len = Math.hypot(dx, dy);
  return len < 0.02 ? { x: 0, y: 0 } : { x: dx / len, y: dy / len };
}

/** A safe tile for a pretend pupil to run to: the nearest rock tile that won't sink this round. */
export function safeTarget(g: Pick<LavaGame, 'sunk'>, r: LavaRound, p: Spot, random: () => number, seeLate: boolean): Spot {
  const sink = new Set(sinking(seeLate ? r : { ...r, late: [] }));
  // Now and then a pupil picks a tile at random (and may be wrong).
  if (random() < 0.15) return tileCentre(Math.floor(random() * TILES));
  let best: Spot = p;
  let bestD = Infinity;
  for (let i = 0; i < TILES; i++) {
    if (sink.has(i) || isLava(g, i, r.n)) continue;
    const d = dist(tileCentre(i), p) + random() * 0.08;
    if (d < bestD) {
      bestD = d;
      best = tileCentre(i);
    }
  }
  return best;
}
