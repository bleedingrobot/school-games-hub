/**
 * Musical Thrones (docs/THRONES-PLAN.md): the rules, pure functions only. Pupils roam a royal hall with a joystick while
 * the music plays; when it stops (a hidden time the server picked), they race to sit on a throne. There are fewer
 * thrones every round. Pupils left standing go to the courtyard: they sit out a round and answer 3 questions to come
 * back (3 right in a row also earns a Crown thief scroll, to steal a throne). Crowns win: 1 a throne, 3 a golden one,
 * +1 for being on a lit dance tile when the music stops.
 *
 * Movement is Four Corners' (`stepMove` in corners.ts) with this round's hazards, so the device, the preview and the
 * projector agree; the database clamps saved moves to the activity's max speed (classlive_move).
 */
import {
  AVATAR_R, BOOST, GRAB_R, KNOCK_MS, KNOCK_SPEED, rollerAt, rollersOf, SPEED, startSpot, STORM_SLOW, TELEPORT_R,
  type Circle, type MoveRound, type MoveState, type Roller, type Spot, type Teleport,
} from './corners';

export const HALLS = ['castle', 'ice', 'jungle', 'pirate'] as const;
export type Hall = (typeof HALLS)[number];

export const POWERS = ['steal', 'shield', 'speed', 'ear', 'double', 'seat', 'ghost'] as const;
export type ThronePower = (typeof POWERS)[number];

export const MECHANICS = ['items', 'storm', 'teleport', 'ice', 'roller'] as const;
export type ThroneMechanic = (typeof MECHANICS)[number];
/** The round each mechanic first appears (a few at a time, as Four Corners). */
export const UNLOCK: Record<ThroneMechanic, number> = { items: 2, storm: 3, teleport: 4, ice: 5, roller: 6 };

export const HALL_WORDS: Record<Hall, { name: string; storm: string; ice: string; roller: string; teleport: string; court: string }> = {
  castle: { name: 'Castle Hall', storm: 'Sticky honey', ice: 'Polished floor', roller: 'Rolling barrel', teleport: 'Magic mirror', court: 'Dungeon' },
  ice: { name: 'Ice Palace', storm: 'Blizzard', ice: 'Ice patch', roller: 'Giant snowball', teleport: 'Ice portal', court: 'Snow pit' },
  jungle: { name: 'Jungle Temple', storm: 'Mud pool', ice: 'Slippery leaves', roller: 'Rolling boulder', teleport: 'Vine swing', court: 'Vine cage' },
  pirate: { name: 'Pirate Ship', storm: 'Sea spray', ice: 'Wet deck', roller: 'Rolling cannonball', teleport: 'Hatch', court: 'The brig' },
};

export const POWER_WORDS: Record<ThronePower, { name: string; emoji: string; how: string }> = {
  steal: { name: 'Crown thief', emoji: '🗡️', how: 'Sit on a taken throne to knock its king or queen off.' },
  shield: { name: 'Royal shield', emoji: '🛡️', how: 'Nobody can steal your throne this round.' },
  speed: { name: 'Speed boots', emoji: '⚡', how: 'Run faster this round and the next two.' },
  ear: { name: 'Golden ear', emoji: '👂', how: 'Your iPad buzzes just before the music stops.' },
  double: { name: 'Double crown', emoji: '⭐', how: 'Twice the crowns this round.' },
  seat: { name: 'Royal seat', emoji: '🪑', how: 'When the music stops you land on the nearest free throne.' },
  ghost: { name: 'Ghost', emoji: '👻', how: 'Walk through hazards this round and the next.' },
};

// ---- Sizes and times ----

/** The hall is this wide (height 1) for new games (James, 27 Nov 2026 NZ: fill a widescreen). Older games have no `w`: square. */
export const THRONES_W = 1.6;

export const THRONE_R = 0.045;
/** A pupil's device sits them down within this of a throne's middle; the server allows a little more (saved spots lag). */
export const SIT_R = 0.065;
export const SIT_SLACK = 0.08;
export const TILE_R = 0.065;
export const READY_MS = 4000;
export const MUSIC_MIN_MS = 7000;
export const MUSIC_MAX_MS = 15000;
export const SCRAMBLE_MS = 4000;
export const SHOW_MS = 4500;
/** A Golden ear buzzes this long before the music stops. */
export const EAR_MS = 2000;
export const COURT_RIGHT = 3;
export const ANSWER_GAP_MS = 1500;
/** Crowns: a throne, a golden throne, a lit dance tile when the music stops. */
export const CROWNS = { throne: 1, golden: 3, dance: 1 } as const;

// ---- Shapes ----

export interface Throne extends Spot { id: number; golden: boolean; by: string | null }
/**
 * A mimic: a trick throne with little eyes (James, 25 Nov 2026 NZ). It pops up with the real ones when the music
 * stops; a pupil who touches it is eaten (it grows teeth) and goes to the courtyard, as if left standing.
 */
export interface Mimic extends Spot { id: number; ate: string[] }
export interface ThroneItem extends Spot { id: number; power: ThronePower; by: string | null }

export interface ThroneRound {
  n: number;
  /** The hall's width (height 1); missing in rounds saved before the wide hall (square). */
  w?: number;
  /** Times in ms since the session started. */
  startAt: number;
  /** Picked when the round is made. Pupils' devices know it but never show it. */
  musicEnd: number;
  scrambleEnd: number;
  showEnd: number;
  thrones: Throne[];
  /** Trick thrones (from round MIMIC_FROM). Missing in rounds saved before mimics. */
  mimics?: Mimic[];
  /** Lit dance tiles: on one when the music stops, +1 crown. */
  tiles: Circle[];
  items: ThroneItem[];
  storms: Circle[];
  ice: Circle[];
  teleports: Teleport[];
  roller: Roller | null;
  roller2: Roller | null;
  /** The music has stopped (dance tiles and royal seats done). */
  stopped: boolean;
  /** The scramble is over: crowns paid, those standing sent to the courtyard. */
  standing: string[] | null;
  /** Dancing on a lit tile when the music stopped. */
  dancers: string[];
}

export interface ThronesMine {
  crowns: number;
  /** Rounds on a throne. */
  sat: number;
  stood: number;
  golden: number;
  dances: number;
  /** The round they were sent to the courtyard in, or null. */
  courtIn: number | null;
  courtRight: number;
  /** Right answers in a row in the courtyard (3: a Crown thief scroll). */
  courtStreak: number;
  escapes: number;
  held: ThronePower | null;
  /** The round each switched-on power works in (speed and ghost: the last round). */
  stealIn: number | null;
  shieldIn: number | null;
  speedTo: number | null;
  ghostTo: number | null;
  earIn: number | null;
  doubleIn: number | null;
  seatIn: number | null;
  powersUsed: number;
  grabs: number;
  steals: number;
  stolen: number;
  /** Times a mimic ate them (missing in games saved before mimics). */
  eaten?: number;
  /** The throne they sit on this round. */
  seat: number | null;
  answered: number;
  right: number;
  wrong: number;
  streak: number;
  bestStreak: number;
  fastMs: number | null;
  lastAt: number;
  /** Bumped when the server moves them (onto a throne, off one, back from the courtyard); their device snaps to `spot`. */
  placed: number;
  spot: Spot;
}

export interface ThronesGame {
  kind: 'thrones';
  hall: Hall;
  /** The hall's width (height 1): THRONES_W for new games; missing in older ones (square). */
  w?: number;
  round: ThroneRound | null;
  mine: Record<string, ThronesMine>;
  nextItem: number;
  /** Most steals and courtyard trips in all, for the end screen. */
  stealsAll: number;
  stoodAll: number;
}

export type ThronesEvent =
  | { type: 'round'; t: number; n: number; thrones: number }
  | { type: 'stop'; t: number; n: number; dancers: string[] }
  | { type: 'sit'; t: number; pupil: string; throne: number; golden: boolean }
  | { type: 'steal'; t: number; pupil: string; from: string; throne: number }
  | { type: 'seated'; t: number; n: number; standing: string[]; seated: number }
  | { type: 'grab'; t: number; pupil: string; power: ThronePower }
  | { type: 'power'; t: number; pupil: string; power: ThronePower }
  | { type: 'escape'; t: number; pupil: string }
  | { type: 'eaten'; t: number; pupil: string; mimic: number }
  | { type: 'court_right'; t: number; pupil: string; right: number; scroll: boolean };

const dist = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.y - b.y);
const pick = <T>(list: readonly T[], random: () => number): T => list[Math.floor(random() * list.length) % list.length];

export const START: Spot = { x: 0.5, y: 0.5 };
/** A game's hall width (height 1). */
export const widthOf = (g: { w?: number } | null | undefined) => g?.w ?? 1;
/** A start spot in the middle of a hall w wide, spread by player number (corners' `startSpot`, moved to the middle). */
export function hallStart(i: number, w = 1): Spot {
  const p = startSpot(i);
  return { x: p.x - 0.5 + w / 2, y: p.y };
}
/**
 * A courtyard seat. On the old square hall it is drawn in a strip below it (y above 1); on a wide hall the courtyard is
 * a panel beside the hall that lists its pupils, so these spots are only where the game keeps them.
 */
export function courtSpot(i: number): Spot {
  return { x: 0.2 + (i % 8) * 0.085, y: 1.08 + Math.floor(i / 8) * 0.06 };
}

export const inCourt = (m: ThronesMine | undefined) => !!m && m.courtIn !== null;
export const boosted = (m: ThronesMine | undefined, n: number) => !!m && m.speedTo !== null && n <= m.speedTo;
export const ghostly = (m: ThronesMine | undefined, n: number) => !!m && m.ghostTo !== null && n <= m.ghostTo;

/** What movement needs of a round (Four Corners' `stepMove`): no hole, no gate. */
export const moveRound = (r: ThroneRound): MoveRound => ({
  storms: r.storms, ice: r.ice, teleports: r.teleports, roller: r.roller, roller2: r.roller2, hole: false, gate: null, runEnd: r.musicEnd,
});

const clampW = (v: number, max: number) => Math.min(max - AVATAR_R, Math.max(AVATAR_R, v));

/**
 * One step of movement in a hall w wide (corners' `stepMove` with the x edge at w; no hole, no gate), so the device, the
 * preview and the projector agree. Storms slow, ice keeps momentum, teleports warp, a roller knocks you flying.
 */
export function stepThrones(m: MoveState, dir: Spot, dtMs: number, round: MoveRound | null, t: number, opts: { boost: boolean; ghost: boolean }, w = 1): MoveState {
  const dt = Math.min(100, Math.max(0, dtMs)) / 1000;
  const cl = (p: Spot): Spot => ({ x: clampW(p.x, w), y: clampW(p.y, 1) });
  if (m.stun !== undefined && t < m.stun) {
    const k = Math.max(0, 1 - dt * 2.2);
    const v = { x: m.v.x * k, y: m.v.y * k };
    return { ...m, p: cl({ x: m.p.x + v.x * dt, y: m.p.y + v.y * dt }), v };
  }
  const len = Math.hypot(dir.x, dir.y);
  const d = len > 1 ? { x: dir.x / len, y: dir.y / len } : dir;
  let speed = SPEED * (opts.boost ? BOOST : 1);
  const onIce = !!round && !opts.ghost && round.ice.some((c) => dist(c, m.p) < c.r);
  if (round && !opts.ghost && round.storms.some((c) => dist(c, m.p) < c.r)) speed *= STORM_SLOW;
  let v: Spot;
  if (onIce) {
    const k = Math.min(1, dt * 1.5);
    v = { x: m.v.x + (d.x * speed - m.v.x) * k, y: m.v.y + (d.y * speed - m.v.y) * k };
  } else v = { x: d.x * speed, y: d.y * speed };
  const p = cl({ x: m.p.x + v.x * dt, y: m.p.y + v.y * dt });
  if (round && !opts.ghost) {
    for (const ro of rollersOf(round)) {
      const r = rollerAt(ro, t);
      if (dist(p, r) < ro.r + AVATAR_R) {
        // Knocked flying, out of its way, plus a shove the way it rolls.
        const s = ro.at < (ro.axis === 'y' ? w : 1) / 2 ? 1 : -1;
        const fwd = (t % ro.periodMs) / ro.periodMs < 0.5 ? 1 : -1;
        const kx = ro.axis === 'x' ? fwd * 0.45 : s;
        const ky = ro.axis === 'x' ? s : fwd * 0.45;
        const kl = Math.hypot(kx, ky);
        const push = ro.r + AVATAR_R + 0.01;
        const out = ro.axis === 'x' ? { x: p.x, y: clampW(r.y + s * push, 1) } : { x: clampW(r.x + s * push, w), y: p.y };
        return { p: out, v: { x: (kx / kl) * KNOCK_SPEED, y: (ky / kl) * KNOCK_SPEED }, stun: t + KNOCK_MS, hitAt: t };
      }
    }
  }
  if (round) {
    for (const tp of round.teleports) {
      if (dist(m.p, tp.a) >= TELEPORT_R && dist(p, tp.a) < TELEPORT_R) return { p: cl({ x: tp.b.x + v.x * 0.25, y: tp.b.y + v.y * 0.25 }), v };
      if (dist(m.p, tp.b) >= TELEPORT_R && dist(p, tp.b) < TELEPORT_R) return { p: cl({ x: tp.a.x + v.x * 0.25, y: tp.a.y + v.y * 0.25 }), v };
    }
  }
  return { p, v: onIce ? v : { x: 0, y: 0 }, ...(m.hitAt !== undefined ? { hitAt: m.hitAt } : {}) };
}

/** The phase at time t. */
export function phaseOf(r: ThroneRound, t: number): 'music' | 'scramble' | 'show' {
  if (t < r.musicEnd) return 'music';
  if (t < r.scrambleEnd) return 'scramble';
  return 'show';
}

// ---- Making rounds ----

/** Thrones this round: about 90% of those playing in round 1, fewer every round (never more than last round), at least 1. */
export function thronesFor(n: number, playing: number, before: number | null): number {
  if (playing <= 1) return 1;
  const share = Math.max(0.35, 0.9 - 0.07 * (n - 1));
  let k = Math.round(playing * share);
  if (before !== null) k = Math.min(k, Math.max(2, before - 1));
  return Math.max(1, Math.min(playing - 1, k));
}

/** Throne spots: rings (ovals in a wide hall) round the middle (one ring for a few, up to three for a big class), turned at random. */
export function layThrones(k: number, random: () => number, w = 1): Spot[] {
  const rings = k <= 9 ? [0.28] : k <= 22 ? [0.18, 0.36] : [0.13, 0.27, 0.41];
  const weight = rings.reduce((a, r) => a + r, 0);
  const counts = rings.map((r) => Math.max(1, Math.round((k * r) / weight)));
  // Make the counts add up to k (the outer ring takes the difference).
  counts[counts.length - 1] += k - counts.reduce((a, c) => a + c, 0);
  const out: Spot[] = [];
  rings.forEach((r, i) => {
    const c = Math.max(0, counts[i]);
    const turn = random() * Math.PI * 2;
    for (let j = 0; j < c; j++) {
      const a = turn + (j / c) * Math.PI * 2;
      // Rings are ovals as wide as the hall.
      out.push({ x: w / 2 + Math.cos(a) * r * w, y: 0.5 + Math.sin(a) * r });
    }
  });
  return out.slice(0, k);
}

/** How far a throne appears from every pupil when the music stops (when the hall has room). */
export const APPEAR_GAP = 0.16;

/**
 * Where the thrones appear when the music stops: scattered at random, apart from each other, and at least APPEAR_GAP
 * from every pupil where the hall has room, so nobody is already on one and everyone has to race.
 */
export function scatterThrones(k: number, avoid: Spot[], random: () => number, w = 1): Spot[] {
  const out: Spot[] = [];
  const at = (): Spot => ({ x: 0.1 + random() * (w - 0.2), y: 0.1 + random() * 0.8 });
  for (let i = 0; i < k; i++) {
    let best: Spot | null = null;
    let bestScore = -1;
    for (let c = 0; c < 80; c++) {
      const p = at();
      const apart = out.reduce((a, q) => Math.min(a, dist(p, q)), 1);
      if (apart < (c < 60 ? 0.12 : 0.08)) continue;
      const clear = avoid.reduce((a, q) => Math.min(a, dist(p, q)), 1);
      const score = Math.min(clear, APPEAR_GAP) + random() * 0.01;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    out.push(best ?? at());
  }
  return out;
}

/** Which mechanics a round has: each new one on its unlock round, then a mix of 1 to 3. */
export function mechanicsFor(n: number, random: () => number): Set<ThroneMechanic> {
  const out = new Set<ThroneMechanic>();
  const open = MECHANICS.filter((m) => UNLOCK[m] <= n);
  if (open.includes('items')) out.add('items');
  const fresh = MECHANICS.find((m) => m !== 'items' && UNLOCK[m] === n);
  if (fresh) {
    out.add(fresh);
    return out;
  }
  const others = open.filter((m) => m !== 'items');
  const count = Math.min(others.length, 1 + Math.floor(random() * 3));
  const bag = [...others];
  for (let i = 0; i < count && bag.length; i++) out.add(bag.splice(Math.floor(random() * bag.length), 1)[0]);
  return out;
}

/** An open spot away from the thrones. */
function openSpot(random: () => number, thrones: Spot[], gap = 0.09, w = 1): Spot {
  for (let i = 0; i < 30; i++) {
    const p = { x: 0.08 + random() * (w - 0.16), y: 0.08 + random() * 0.84 };
    if (thrones.every((th) => dist(th, p) > gap)) return p;
  }
  return { x: 0.08 + random() * (w - 0.16), y: 0.06 };
}

/** Mimics start in round 2: 1, then 1 more for every 8 thrones, at most 3. */
export const MIMIC_FROM = 2;
export const mimicsFor = (n: number, k: number) => (n < MIMIC_FROM ? 0 : Math.min(3, 1 + Math.floor(k / 8)));

export function makeRound(g: ThronesGame, n: number, startAt: number, random: () => number, playing: number): ThroneRound {
  const w = widthOf(g);
  const has = mechanicsFor(n, random);
  const k = thronesFor(n, playing, g.round ? g.round.thrones.length : null);
  const spots = layThrones(k, random, w);
  const goldenAt = n >= 2 ? Math.floor(random() * k) % k : -1;
  const thrones: Throne[] = spots.map((p, i) => ({ id: i, x: p.x, y: p.y, golden: i === goldenAt, by: null }));
  // A wide hall gets about w times the tiles and hazards.
  const more = (c: number) => Math.round(c * w);
  const tiles: Circle[] = Array.from({ length: more(3 + (n % 3)) }, () => ({ ...openSpot(random, spots, 0.14, w), r: TILE_R }));
  const storms: Circle[] = has.has('storm') ? Array.from({ length: more(1 + Math.floor(random() * 2)) }, () => ({ ...openSpot(random, [], 0.09, w), r: 0.1 + random() * 0.05 })) : [];
  const ice: Circle[] = has.has('ice') ? Array.from({ length: more(1 + Math.floor(random() * 2)) }, () => ({ ...openSpot(random, [], 0.09, w), r: 0.09 + random() * 0.05 })) : [];
  const teleports: Teleport[] = [];
  if (has.has('teleport')) {
    const along = 0.25 + random() * 0.5;
    teleports.push(random() < 0.5 ? { a: { x: 0.06, y: along }, b: { x: w - 0.06, y: 1 - along } } : { a: { x: along * w, y: 0.06 }, b: { x: (1 - along) * w, y: 0.94 } });
    // A second pair across the wide hall, the other way.
    if (w > 1.3) {
      const x2 = (0.2 + random() * 0.6) * w;
      teleports.push({ a: { x: x2, y: 0.06 }, b: { x: w - x2, y: 0.94 } });
    }
  }
  // Rollers cross the hall through the throne rings (the x one rolls the whole width).
  const line = () => 0.2 + random() * 0.6;
  const roller: Roller | null = has.has('roller') ? { axis: 'x', at: line(), r: 0.07, periodMs: Math.round((5000 + Math.floor(random() * 1500)) * Math.sqrt(w)), ...(w > 1 ? { span: w } : {}) } : null;
  const roller2: Roller | null = has.has('roller') && random() < 0.5 ? { axis: 'y', at: line() * w, r: 0.07, periodMs: 5600 + Math.floor(random() * 1500) } : null;
  const items: ThroneItem[] = [];
  if (has.has('items')) {
    const count = Math.max(2, Math.min(Math.round(8 * w), Math.round((playing / 5) * w)));
    for (let i = 0; i < count; i++) items.push({ id: g.nextItem++, power: pick(POWERS, random), by: null, ...openSpot(random, spots, 0.09, w) });
  }
  // Round 1 is a gentle 9 s; then anywhere from 7 to 15 s, so nobody can count it.
  const music = n === 1 ? 9000 : MUSIC_MIN_MS + Math.floor(random() * (MUSIC_MAX_MS - MUSIC_MIN_MS));
  const musicEnd = startAt + music;
  return {
    n, ...(w > 1 ? { w } : {}), startAt, musicEnd, scrambleEnd: musicEnd + SCRAMBLE_MS, showEnd: musicEnd + SCRAMBLE_MS + SHOW_MS,
    thrones, mimics: Array.from({ length: mimicsFor(n, k) }, (_, i) => ({ id: i, x: w / 2, y: 0.5, ate: [] })),
    tiles, items, storms, ice, teleports, roller, roller2, stopped: false, standing: null, dancers: [],
  };
}

export function newThrones(hall: Hall, w = THRONES_W): ThronesGame {
  return { kind: 'thrones', hall, ...(w > 1 ? { w } : {}), round: null, mine: {}, nextItem: 1, stealsAll: 0, stoodAll: 0 };
}

export function freshMine(i: number, w = 1): ThronesMine {
  return {
    crowns: 0, sat: 0, stood: 0, golden: 0, dances: 0, courtIn: null, courtRight: 0, courtStreak: 0, escapes: 0, held: null,
    stealIn: null, shieldIn: null, speedTo: null, ghostTo: null, earIn: null, doubleIn: null, seatIn: null, powersUsed: 0, grabs: 0,
    steals: 0, stolen: 0, eaten: 0, seat: null, answered: 0, right: 0, wrong: 0, streak: 0, bestStreak: 0, fastMs: null, lastAt: -ANSWER_GAP_MS,
    placed: 0, spot: hallStart(i, w),
  };
}

/** When a courtyard pupil with all their right answers comes back (session ms), or null (as Four Corners' jail). */
export function freeAt(g: ThronesGame, m: ThronesMine | undefined): number | null {
  const r = g.round;
  if (!m || m.courtIn === null || m.courtRight < COURT_RIGHT || !r) return null;
  if (m.courtIn < r.n) return r.showEnd;
  return r.showEnd + 12000 + SCRAMBLE_MS + SHOW_MS;
}

/** The last round has been shown (or none started): the game can end. */
export const thronesDone = (g: ThronesGame, t: number) => !g.round || (g.round.standing !== null && t >= g.round.showEnd);

/** The next time the server must act (the music stops, the scramble ends, the next round), or null. */
export function nextDeadline(g: ThronesGame, startedAt: number | null): number | null {
  if (startedAt === null) return null;
  const r = g.round;
  if (!r) return READY_MS;
  if (!r.stopped) return r.musicEnd;
  if (r.standing === null) return r.scrambleEnd;
  return r.showEnd;
}

/** Saved spots are needed when the music stops (dance tiles, royal seats). */
export const needsPositions = (g: ThronesGame, t: number) => !!g.round && !g.round.stopped && t >= g.round.musicEnd;

export type Positions = Record<string, Spot>;

/** Moves the game on to time t. `last`: time is up, so no new round starts. */
export function advance(g: ThronesGame, t: number, order: string[], positions: Positions, random: () => number, last = false): ThronesEvent[] {
  const events: ThronesEvent[] = [];
  for (let guard = 0; guard < 5; guard++) {
    const r = g.round;
    if (!r) {
      if (t < READY_MS || last) break;
      g.round = makeRound(g, 1, READY_MS, random, playingCount(g, order));
      events.push({ type: 'round', t: READY_MS, n: 1, thrones: g.round.thrones.length });
      continue;
    }
    if (!r.stopped) {
      if (t < r.musicEnd) break;
      events.push(stopMusic(g, r, order, positions, random));
      continue;
    }
    if (r.standing === null) {
      if (t < r.scrambleEnd) break;
      events.push(endScramble(g, r, order));
      continue;
    }
    if (t < r.showEnd || last) break;
    const startAt = t - r.showEnd > 2000 ? t : r.showEnd;
    for (const id of order) {
      const m = g.mine[id];
      if (m) m.seat = null;
      if (m && m.courtIn !== null && m.courtIn < r.n && m.courtRight >= COURT_RIGHT) {
        m.courtIn = null;
        m.courtRight = 0;
        m.escapes++;
        m.spot = hallStart(order.indexOf(id), widthOf(g));
        m.placed++;
        events.push({ type: 'escape', t: startAt, pupil: id });
      } else if (m && m.courtIn === null) {
        // Up off the thrones and back to the middle.
        m.spot = hallStart(order.indexOf(id), widthOf(g));
        m.placed++;
      }
    }
    g.round = makeRound(g, r.n + 1, startAt, random, playingCount(g, order));
    events.push({ type: 'round', t: startAt, n: r.n + 1, thrones: g.round.thrones.length });
  }
  return events;
}

const playingCount = (g: ThronesGame, order: string[]) => order.filter((id) => !inCourt(g.mine[id])).length;
const times = (m: ThronesMine, n: number) => (m.doubleIn === n ? 2 : 1);

function stopMusic(g: ThronesGame, r: ThroneRound, order: string[], positions: Positions, random: () => number): ThronesEvent {
  r.stopped = true;
  const dancers: string[] = [];
  const dancing: Spot[] = [];
  for (const id of order) {
    const m = g.mine[id];
    if (!m || m.courtIn !== null) continue;
    const at = positions[id] ?? m.spot;
    m.spot = { x: at.x, y: at.y };
    dancing.push(m.spot);
    if (r.tiles.some((tl) => dist(tl, at) < tl.r + AVATAR_R * 0.5)) {
      dancers.push(id);
      m.dances++;
      m.crowns += CROWNS.dance * times(m, r.n);
    }
  }
  // The thrones appear only now, in new spots away from everyone (James, 25 Nov 2026 NZ: nobody can wait on one).
  // Mimics pop up with them, mixed in.
  const mimics = r.mimics ?? [];
  const spots = scatterThrones(r.thrones.length + mimics.length, dancing, random, widthOf(g));
  const order2 = spots.map((_, i) => i);
  for (let i = order2.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)) % (i + 1); [order2[i], order2[j]] = [order2[j], order2[i]]; }
  r.thrones.forEach((th, i) => { th.x = spots[order2[i]].x; th.y = spots[order2[i]].y; });
  mimics.forEach((mm, i) => { const p = spots[order2[r.thrones.length + i]]; mm.x = p.x; mm.y = p.y; });
  // Royal seats: straight onto the nearest free throne.
  for (const id of order) {
    const m = g.mine[id];
    if (!m || m.courtIn !== null || m.seatIn !== r.n || m.seat !== null) continue;
    const free = r.thrones.filter((th) => th.by === null).sort((a, b) => dist(a, m.spot) - dist(b, m.spot))[0];
    if (!free) continue;
    seatOn(m, id, free);
  }
  r.dancers = dancers;
  return { type: 'stop', t: r.musicEnd, n: r.n, dancers };
}

function seatOn(m: ThronesMine, id: string, th: Throne) {
  th.by = id;
  m.seat = th.id;
  m.spot = { x: th.x, y: th.y };
  m.placed++;
}

function endScramble(g: ThronesGame, r: ThroneRound, order: string[]): ThronesEvent {
  const standing: string[] = [];
  let seated = 0;
  for (const id of order) {
    const m = g.mine[id];
    if (!m || m.courtIn !== null) continue;
    const th = m.seat === null ? undefined : r.thrones.find((x) => x.id === m.seat && x.by === id);
    if (th) {
      seated++;
      m.sat++;
      if (th.golden) m.golden++;
      m.crowns += (th.golden ? CROWNS.golden : CROWNS.throne) * times(m, r.n);
      continue;
    }
    standing.push(id);
    m.seat = null;
    m.stood++;
    m.courtIn = r.n;
    m.courtRight = 0;
    m.courtStreak = 0;
    m.held = null;
    m.spot = courtSpot(standing.length - 1);
  }
  r.standing = standing;
  g.stoodAll += standing.length;
  return { type: 'seated', t: r.scrambleEnd, n: r.n, standing, seated };
}

/** Touching a mimic after the music stops: it eats you, and you go to the courtyard (as if left standing). */
export function bite(
  g: ThronesGame, who: string, mimicId: unknown, at: Spot | undefined, t: number,
): { ok: true; events: ThronesEvent[] } | { ok: false; reason: 'not_now' | 'gone' | 'far' | 'seated' } {
  const r = g.round;
  const m = g.mine[who];
  if (!r || !m || m.courtIn !== null || !r.stopped || r.standing !== null || t < r.musicEnd || t > r.scrambleEnd + 400) return { ok: false, reason: 'not_now' };
  if (m.seat !== null) return { ok: false, reason: 'seated' };
  const mm = (r.mimics ?? []).find((x) => x.id === mimicId);
  if (!mm) return { ok: false, reason: 'gone' };
  if (!at || dist(at, mm) > SIT_R + SIT_SLACK) return { ok: false, reason: 'far' };
  mm.ate.push(who);
  m.eaten = (m.eaten ?? 0) + 1;
  m.stood++;
  m.courtIn = r.n;
  m.courtRight = 0;
  m.courtStreak = 0;
  m.held = null;
  const inCourtNow = Object.values(g.mine).filter((x) => x.courtIn !== null).length;
  m.spot = courtSpot(inCourtNow - 1);
  m.placed++;
  g.stoodAll++;
  return { ok: true, events: [{ type: 'eaten', t, pupil: who, mimic: mm.id }] };
}

/** Sitting down: a free throne, or a taken one with a Crown thief switched on (unless its sitter has a Royal shield). */
export function sit(
  g: ThronesGame, who: string, throneId: unknown, at: Spot | undefined, t: number,
): { ok: true; events: ThronesEvent[]; bumped: string | null } | { ok: false; reason: 'not_now' | 'gone' | 'far' | 'taken' | 'seated' } {
  const r = g.round;
  const m = g.mine[who];
  if (!r || !m || m.courtIn !== null || !r.stopped || r.standing !== null || t < r.musicEnd || t > r.scrambleEnd + 400) return { ok: false, reason: 'not_now' };
  if (m.seat !== null) return { ok: false, reason: 'seated' };
  const th = r.thrones.find((x) => x.id === throneId);
  if (!th) return { ok: false, reason: 'gone' };
  if (!at || dist(at, th) > SIT_R + SIT_SLACK) return { ok: false, reason: 'far' };
  if (th.by === null) {
    seatOn(m, who, th);
    return { ok: true, events: [{ type: 'sit', t, pupil: who, throne: th.id, golden: th.golden }], bumped: null };
  }
  const victimId = th.by;
  const v = g.mine[victimId];
  if (m.stealIn !== r.n || !v || v.shieldIn === r.n) return { ok: false, reason: 'taken' };
  // Knocked off, just outside the throne, and free to run for another one.
  v.seat = null;
  const w = widthOf(g);
  const a = Math.atan2(th.y - 0.5, th.x - w / 2);
  v.spot = { x: Math.min(w - 0.03, Math.max(0.03, th.x + Math.cos(a) * 0.09)), y: Math.min(0.97, Math.max(0.03, th.y + Math.sin(a) * 0.09)) };
  v.placed++;
  v.stolen++;
  m.stealIn = null;
  m.steals++;
  g.stealsAll++;
  if (v.crowns > 0) {
    v.crowns--;
    m.crowns++;
  }
  seatOn(m, who, th);
  return { ok: true, events: [{ type: 'steal', t, pupil: who, from: victimId, throne: th.id }], bumped: victimId };
}

/** Running over an item picks it up (one at a time, only while the music plays). */
export function grab(g: ThronesGame, who: string, itemId: unknown, at: Spot | undefined, t: number): { ok: true; events: ThronesEvent[] } | { ok: false; reason: 'not_now' | 'gone' | 'far' | 'full' } {
  const r = g.round;
  const m = g.mine[who];
  if (!r || !m || r.stopped || t < r.startAt || t >= r.musicEnd || m.courtIn !== null) return { ok: false, reason: 'not_now' };
  if (m.held) return { ok: false, reason: 'full' };
  const item = r.items.find((x) => x.id === itemId);
  if (!item || item.by) return { ok: false, reason: 'gone' };
  if (!at || dist(at, item) > GRAB_R + AVATAR_R + 0.03) return { ok: false, reason: 'far' };
  item.by = who;
  m.held = item.power;
  m.grabs++;
  return { ok: true, events: [{ type: 'grab', t, pupil: who, power: item.power }] };
}

/** What a question is for: getting out of the courtyard, switching on a held power-up (while the music plays), or nothing. */
export function questionFor(g: ThronesGame, who: string, t: number): 'court' | 'power' | null {
  const m = g.mine[who];
  if (!m) return null;
  if (m.courtIn !== null) return m.courtRight < COURT_RIGHT ? 'court' : null;
  const r = g.round;
  if (!m.held || !r || r.stopped || t >= r.musicEnd) return null;
  return 'power';
}

/** A marked answer: in the courtyard it counts towards coming back; otherwise a right one switches on the held power-up. */
export function answered(g: ThronesGame, who: string, right: boolean, purpose: 'court' | 'power', t: number, ms?: number): { ok: true; events: ThronesEvent[] } | { ok: false; reason: 'too_soon' | 'not_now' } {
  const m = g.mine[who];
  if (!m) return { ok: false, reason: 'not_now' };
  if (t - m.lastAt < ANSWER_GAP_MS) return { ok: false, reason: 'too_soon' };
  m.lastAt = t;
  m.answered++;
  if (right) {
    m.right++;
    m.streak++;
    m.bestStreak = Math.max(m.bestStreak, m.streak);
    if (ms !== undefined && ms >= 300 && (m.fastMs === null || ms < m.fastMs)) m.fastMs = ms;
  } else {
    m.wrong++;
    m.streak = 0;
  }
  if (purpose === 'court') {
    if (m.courtIn === null) return { ok: false, reason: 'not_now' };
    if (!right) {
      m.courtStreak = 0;
      return { ok: true, events: [] };
    }
    m.courtRight = Math.min(COURT_RIGHT, m.courtRight + 1);
    m.courtStreak++;
    // Three right in a row: a Crown thief scroll to take back (James, 25 Nov 2026 NZ: "both").
    const scroll = m.courtRight === COURT_RIGHT && m.courtStreak >= COURT_RIGHT && m.held === null;
    if (scroll) m.held = 'steal';
    return { ok: true, events: [{ type: 'court_right', t, pupil: who, right: m.courtRight, scroll }] };
  }
  const r = g.round;
  if (!m.held || !r || m.courtIn !== null || r.stopped) return { ok: false, reason: 'not_now' };
  if (!right) return { ok: true, events: [] };
  const power = m.held;
  m.held = null;
  m.powersUsed++;
  const n = r.n;
  if (power === 'steal') m.stealIn = n;
  else if (power === 'shield') m.shieldIn = n;
  else if (power === 'speed') m.speedTo = n + 2;
  else if (power === 'ghost') m.ghostTo = n + 1;
  else if (power === 'ear') m.earIn = n;
  else if (power === 'double') m.doubleIn = n;
  else m.seatIn = n;
  return { ok: true, events: [{ type: 'power', t, pupil: who, power }] };
}

/** The podium: the top 3 crown counts (ties share a place). */
export function podium(g: ThronesGame, order: string[]): { player: string; place: 1 | 2 | 3 }[] {
  const scores = [...new Set(order.map((id) => g.mine[id]?.crowns ?? 0))].filter((s) => s > 0).sort((a, b) => b - a).slice(0, 3);
  return order
    .map((id) => ({ player: id, s: g.mine[id]?.crowns ?? 0 }))
    .filter((x) => scores.includes(x.s))
    .sort((a, b) => b.s - a.s)
    .map((x) => ({ player: x.player, place: (scores.indexOf(x.s) + 1) as 1 | 2 | 3 }));
}

/** The free throne nearest a spot (a pretend pupil's target, the pad's arrow), or null. */
export function nearestFree(r: ThroneRound, p: Spot): Throne | null {
  return r.thrones.filter((th) => th.by === null).sort((a, b) => dist(a, p) - dist(b, p))[0] ?? null;
}

/** The throne a spot is on (within SIT_R), or null. */
export function throneAt(r: Pick<ThroneRound, 'thrones'>, p: Spot): Throne | null {
  return r.thrones.find((th) => dist(th, p) < SIT_R) ?? null;
}
