/**
 * Colour Clash (docs/CLASH-PLAN.md): the rules, pure functions only. The class splits into 2 to 4 colour teams; pupils
 * run their avatars about the board (a unit square cut into GRID × GRID tiles) and every tile they cross takes their
 * team's colour. A right answer drops a paint bomb: a splat of their colour round where they stand. Short rounds, the
 * board wiped each time; the team with the most tiles wins the round, the most round wins wins the game.
 *
 * Painting is decided in the database: a pupil's device saves its spot through classlive_clash_paint() (which moves
 * them with classlive_move and paints the tiles on the line from their last saved spot, as `lineTiles` here). Bombs are
 * painted by the server function (`bombTiles`). Movement on the device reuses Four Corners' `stepMove`, so goo, slippy
 * paint, teleports and rollers behave the same on both screens.
 */
import { BOOST, HOLE_R, KNOCK_MS, KNOCK_SPEED, rollerAt, rollersOf, SPEED, STORM_SLOW, TELEPORT_R, type Circle, type MoveState, type Roller, type Spot, type Teleport } from './corners';

export const CLASH_MAPS = ['park', 'rooftops', 'beach', 'space'] as const;
export type ClashMap = (typeof CLASH_MAPS)[number];

/** Teams are 1 to 4 (0 is a blank tile). */
export type Team = 1 | 2 | 3 | 4;
export const TEAM_WORDS: Record<Team, { name: string; colour: string; emoji: string }> = {
  1: { name: 'Red', colour: '#ef4444', emoji: '🟥' },
  2: { name: 'Blue', colour: '#3b82f6', emoji: '🟦' },
  3: { name: 'Green', colour: '#22c55e', emoji: '🟩' },
  4: { name: 'Yellow', colour: '#facc15', emoji: '🟨' },
};

export const MAP_WORDS: Record<ClashMap, { name: string; goo: string; slip: string; roller: string; fountain: string; portal: string }> = {
  park: { name: 'Paint Park', goo: 'Sticky mud', slip: 'Wet paint', roller: 'Paint roller', fountain: 'Fountain', portal: 'Slide tunnel' },
  rooftops: { name: 'Graffiti Rooftops', goo: 'Tar puddle', slip: 'Oil slick', roller: 'Rolling barrel', fountain: 'Water tower', portal: 'Zip line' },
  beach: { name: 'Splash Beach', goo: 'Soft sand', slip: 'Wet rocks', roller: 'Beach ball', fountain: 'Rock pool', portal: 'Water slide' },
  space: { name: 'Space Paint Lab', goo: 'Gloop', slip: 'Zero-g', roller: 'Rolling asteroid', fountain: 'Reactor', portal: 'Wormhole' },
};

export const POWERS = ['brush', 'speed', 'mega', 'cross'] as const;
export type ClashPower = (typeof POWERS)[number];
export const POWER_WORDS: Record<ClashPower, { name: string; emoji: string; how: string }> = {
  brush: { name: 'Big Brush', emoji: '🖌️', how: 'Your trail is 3 tiles wide for 10 seconds.' },
  speed: { name: 'Speed Shoes', emoji: '👟', how: 'Run faster for 10 seconds.' },
  mega: { name: 'Mega Bomb', emoji: '💥', how: 'This bomb is huge.' },
  cross: { name: 'Rainbow Cross', emoji: '✚', how: 'Paints your whole row and column.' },
};

export const MECHANICS = ['items', 'golden', 'portal', 'goo', 'slip', 'roller', 'fountain'] as const;
export type ClashMechanic = (typeof MECHANICS)[number];
/** The round each mechanic first appears (a few at a time, as Four Corners). */
export const UNLOCK: Record<ClashMechanic, number> = { items: 2, golden: 3, portal: 4, goo: 5, slip: 6, roller: 7, fountain: 8 };

/**
 * Tiles down (and across a square board). The board is `w` wide and 1 high (widescreen since 27 Nov 2026 NZ: new games
 * are CLASH_W wide, older ones, without `w`, stay square), so it has more columns and the same rows: tiles stay square.
 */
export const GRID = 24;
export const TILE = 1 / GRID;
/** A new game's board width (height 1). */
export const CLASH_W = 1.6;
/** A game's (or round's) board width. */
export const widthOf = (x: { w?: number } | null | undefined) => x?.w ?? 1;
/** Tiles across a board of width w (the database does the same: round(24 * w)). */
export const colsOf = (w = 1) => Math.round(GRID * w);
export const tileCount = (w = 1) => colsOf(w) * GRID;
/** A tile's width in board units (just over TILE on a wide board, so the columns fill it exactly). */
export const tileW = (w = 1) => w / colsOf(w);
/** A golden tile counts this many. */
export const GOLDEN_WORTH = 3;
export const READY_MS = 3500;
export const COUNT_MS = 7000;
export const PAINT_S = [45, 60, 90] as const;
export const PAINT_DEFAULT_S = 60;
export const paintSeconds = (v: unknown): number => ((PAINT_S as readonly number[]).includes(v as number) ? (v as number) : PAINT_DEFAULT_S);
export const TEAM_COUNTS = [2, 3, 4] as const;
export const teamCount = (v: unknown): 2 | 3 | 4 => ((TEAM_COUNTS as readonly number[]).includes(v as number) ? (v as 2 | 3 | 4) : 4);
export const ANSWER_GAP_MS = 1500;
/** Power-ups that last (Big Brush, Speed Shoes). */
export const POWER_MS = 10_000;
/** Bomb radius in tiles: bigger on a streak of right answers. */
export const bombRadius = (streak: number, mega: boolean) => (mega ? 5.5 : streak >= 5 ? 3.6 : streak >= 3 ? 2.9 : 2.2);
export const GRAB_R = 0.07;
export const AVATAR_R = 0.035;

export interface ClashItem extends Spot { id: number; power: ClashPower; by: string | null }

export interface ClashRound {
  /** The board's width (height 1); missing: square. */
  w?: number;
  n: number;
  /** Times in ms since the session started. Painting is open from paintFrom to paintTo. */
  startAt: number;
  paintFrom: number;
  paintTo: number;
  countEnd: number;
  storms: Circle[];
  ice: Circle[];
  teleports: Teleport[];
  roller: Roller | null;
  roller2: Roller | null;
  /** The middle is a fountain: a wall, and its tiles can't be painted. */
  hole: boolean;
  golden: number[];
  items: ClashItem[];
  /** Filled when painting ends: each team's score (golden tiles count GOLDEN_WORTH) and the round's winners. */
  result: { score: number[]; tiles: number[]; winners: Team[] } | null;
}

export interface ClashMine {
  team: Team;
  /** Tiles painted in the whole game (trail and bombs), from the database at each round's end. */
  painted: number;
  bombs: number;
  right: number;
  wrong: number;
  streak: number;
  bestStreak: number;
  answered: number;
  lastAt: number;
  held: ClashPower | null;
  grabs: number;
  powersUsed: number;
  /** Session times a Big Brush / Speed Shoes runs until (the database reads brushTo). */
  brushTo: number | null;
  speedTo: number | null;
  /** Bomb tiles painted (part of `painted`). */
  bombTiles: number;
  /** Bumped when the server moves them (each round's start), so their device snaps to `spot`. */
  placed: number;
  spot: Spot;
}

export interface ClashGame {
  kind: 'clash';
  map: ClashMap;
  /** The board's width (height 1); missing: a square board (a game started before the wide map). */
  w?: number;
  teams: 2 | 3 | 4;
  paintS: number;
  /** Epoch ms of the start, for the database's paint window. Null in the lobby. */
  zeroMs: number | null;
  round: ClashRound | null;
  /** Rounds won by each team (index = team; 0 unused), and every tile painted by each team over the game. */
  wins: number[];
  totals: number[];
  history: { n: number; score: number[]; winners: Team[] }[];
  mine: Record<string, ClashMine>;
  nextItem: number;
}

export type ClashEvent =
  | { type: 'clash_round'; t: number; n: number }
  | { type: 'clash_count'; t: number; n: number; score: number[]; winners: Team[] }
  | { type: 'clash_bomb'; t: number; pupil: string; team: Team; x: number; y: number; r: number; power?: ClashPower }
  | { type: 'clash_grab'; t: number; pupil: string; power: ClashPower }
  | { type: 'clash_power'; t: number; pupil: string; power: ClashPower };

// ---- Tiles ----

const clampTo = (v: number, n: number) => Math.min(n - 1, Math.max(0, Math.floor(v)));
export const tileOf = (p: Spot, w = 1) => clampTo(p.y * GRID, GRID) * colsOf(w) + clampTo(p.x / tileW(w), colsOf(w));
export const tileCentre = (i: number, w = 1): Spot => {
  const cols = colsOf(w);
  return { x: ((i % cols) + 0.5) * tileW(w), y: (Math.floor(i / cols) + 0.5) / GRID };
};
const dist = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.y - b.y);
export const FOUNTAIN_R = 0.15;
/** Tiles inside the fountain (in the middle of the board) can't be painted (the database checks this too). */
export const inFountain = (i: number, w = 1) => dist(tileCentre(i, w), { x: w / 2, y: 0.5 }) < FOUNTAIN_R;

/**
 * Tiles on the line from a to b, in steps of half a tile (classlive_clash_paint does the same). Wide: the 8 around each
 * as well (Big Brush).
 */
export function lineTiles(a: Spot, b: Spot, wide: boolean, w = 1): number[] {
  const cols = colsOf(w);
  const steps = Math.max(1, Math.ceil(dist(a, b) / (TILE / 2)));
  const out = new Set<number>();
  for (let s = 0; s <= steps; s++) {
    const p = { x: a.x + ((b.x - a.x) * s) / steps, y: a.y + ((b.y - a.y) * s) / steps };
    const cx = clampTo(p.x / tileW(w), cols);
    const cy = clampTo(p.y * GRID, GRID);
    for (let dy = wide ? -1 : 0; dy <= (wide ? 1 : 0); dy++)
      for (let dx = wide ? -1 : 0; dx <= (wide ? 1 : 0); dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && y >= 0 && x < cols && y < GRID) out.add(y * cols + x);
      }
  }
  return [...out];
}

/** A bomb's splat: tiles whose centre is within `r` tiles of the spot. */
export function bombTiles(at: Spot, r: number, w = 1): number[] {
  const out: number[] = [];
  for (let i = 0; i < tileCount(w); i++) if (dist(tileCentre(i, w), at) <= r * TILE) out.push(i);
  return out;
}

/** Rainbow Cross: the pupil's whole row and column. */
export function crossTiles(at: Spot, w = 1): number[] {
  const cols = colsOf(w);
  const cx = clampTo(at.x / tileW(w), cols);
  const cy = clampTo(at.y * GRID, GRID);
  const out: number[] = [];
  for (let i = 0; i < cols; i++) out.push(cy * cols + i);
  for (let i = 0; i < GRID; i++) out.push(i * cols + cx);
  return [...new Set(out)];
}

/** One character a tile: '0' blank, '1' to '4' a team. */
export const blankTiles = (w = 1) => '0'.repeat(tileCount(w));

export function applyTiles(tiles: string, changes: [number, number][]): string {
  const a = tiles.split('');
  for (const [i, team] of changes) if (i >= 0 && i < a.length) a[i] = String(team);
  return a.join('');
}

/** Each team's score (golden tiles count more) and plain tile counts; index = team. */
export function scoreTiles(tiles: string, golden: number[], hole: boolean, w = 1): { score: number[]; tiles: number[] } {
  const score = [0, 0, 0, 0, 0];
  const counts = [0, 0, 0, 0, 0];
  const gold = new Set(golden);
  for (let i = 0; i < tiles.length; i++) {
    const team = Number(tiles[i] ?? '0');
    if (!team || (hole && inFountain(i, w))) continue;
    counts[team]++;
    score[team] += gold.has(i) ? GOLDEN_WORTH : 1;
  }
  return { score, tiles: counts };
}

// ---- Movement (device and pretend pupils) ----

/**
 * One step of movement (device and pretend pupils), as Four Corners' stepMove but on a board `w` wide (no gate): storms
 * slow, ice keeps momentum, the fountain is a wall, teleports warp to the other end, rollers knock you flying.
 */
export function stepMove(m: MoveState, dir: Spot, dtMs: number, round: ClashRound | null, t: number, speed: boolean): MoveState {
  const w = widthOf(round);
  const mid = { x: w / 2, y: 0.5 };
  const cx = (v: number) => Math.min(w - AVATAR_R, Math.max(AVATAR_R, v));
  const cy = (v: number) => Math.min(1 - AVATAR_R, Math.max(AVATAR_R, v));
  const dt = Math.min(100, Math.max(0, dtMs)) / 1000;
  const rim = (p: Spot): Spot => {
    if (!round?.hole || dist(p, mid) >= HOLE_R + AVATAR_R) return p;
    const a = Math.atan2(p.y - mid.y, p.x - mid.x);
    return { x: mid.x + Math.cos(a) * (HOLE_R + AVATAR_R), y: mid.y + Math.sin(a) * (HOLE_R + AVATAR_R) };
  };
  if (m.stun !== undefined && t < m.stun) {
    // Flying: no steering, slowing down as you go; walls still hold.
    const k = Math.max(0, 1 - dt * 2.2);
    const v = { x: m.v.x * k, y: m.v.y * k };
    return { ...m, p: rim({ x: cx(m.p.x + v.x * dt), y: cy(m.p.y + v.y * dt) }), v };
  }
  const len = Math.hypot(dir.x, dir.y);
  const d = len > 1 ? { x: dir.x / len, y: dir.y / len } : dir;
  let sp = SPEED * (speed ? BOOST : 1);
  const onIce = !!round && round.ice.some((c) => dist(c, m.p) < c.r);
  if (round && round.storms.some((c) => dist(c, m.p) < c.r)) sp *= STORM_SLOW;
  let v: Spot;
  if (onIce) {
    // Slide: the joystick only nudges, and you keep going.
    const k = Math.min(1, dt * 1.5);
    v = { x: m.v.x + (d.x * sp - m.v.x) * k, y: m.v.y + (d.y * sp - m.v.y) * k };
  } else v = { x: d.x * sp, y: d.y * sp };
  let p = { x: cx(m.p.x + v.x * dt), y: cy(m.p.y + v.y * dt) };
  if (round) {
    p = rim(p);
    for (const ro of rollersOf(round)) {
      const r = rollerAt(ro, t);
      if (dist(p, r) < ro.r + AVATAR_R) {
        // Knocked flying, towards the middle of the board, plus a shove the way it rolls.
        const s = ro.at < (ro.axis === 'x' ? 0.5 : w / 2) ? 1 : -1;
        const phase = (t % ro.periodMs) / ro.periodMs;
        const fwd = phase < 0.5 ? 1 : -1;
        const kx = ro.axis === 'x' ? fwd * 0.45 : s;
        const ky = ro.axis === 'x' ? s : fwd * 0.45;
        const kl = Math.hypot(kx, ky);
        const kv = { x: (kx / kl) * KNOCK_SPEED, y: (ky / kl) * KNOCK_SPEED };
        const push = ro.r + AVATAR_R + 0.01;
        const out = ro.axis === 'x' ? { x: p.x, y: cy(r.y + s * push) } : { x: cx(r.x + s * push), y: p.y };
        return { p: out, v: kv, stun: t + KNOCK_MS, hitAt: t };
      }
    }
    for (const tp of round.teleports) {
      // Walking onto one end puts you just past the other (moving in the same direction, so you don't bounce back).
      if (dist(m.p, tp.a) >= TELEPORT_R && dist(p, tp.a) < TELEPORT_R) return { p: { x: cx(tp.b.x + v.x * 0.25), y: cy(tp.b.y + v.y * 0.25) }, v };
      if (dist(m.p, tp.b) >= TELEPORT_R && dist(p, tp.b) < TELEPORT_R) return { p: { x: cx(tp.a.x + v.x * 0.25), y: cy(tp.a.y + v.y * 0.25) }, v };
    }
  }
  return { p, v: onIce ? v : { x: 0, y: 0 }, ...(m.hitAt !== undefined ? { hitAt: m.hitAt } : {}) };
}

// ---- Making rounds ----

const pick = <T>(list: readonly T[], random: () => number): T => list[Math.floor(random() * list.length) % list.length];

export function mechanicsFor(n: number, random: () => number): Set<ClashMechanic> {
  const out = new Set<ClashMechanic>();
  const open = MECHANICS.filter((m) => UNLOCK[m] <= n);
  if (open.includes('items')) out.add('items');
  const fresh = MECHANICS.find((m) => UNLOCK[m] === n);
  if (fresh) {
    out.add(fresh);
    const older = open.filter((m) => m !== 'items' && m !== fresh);
    if (older.length && random() < 0.5) out.add(pick(older, random));
    return out;
  }
  const others = open.filter((m) => m !== 'items');
  const count = Math.min(others.length, 2 + Math.floor(random() * 2));
  const bag = [...others];
  while (out.size < count + (open.includes('items') ? 1 : 0) && bag.length) out.add(bag.splice(Math.floor(random() * bag.length), 1)[0]);
  return out;
}

function openSpot(random: () => number, hole: boolean, w: number): Spot {
  for (let i = 0; i < 20; i++) {
    const p = { x: 0.1 + random() * (w - 0.2), y: 0.1 + random() * 0.8 };
    if (hole && dist(p, { x: w / 2, y: 0.5 }) < FOUNTAIN_R + 0.06) continue;
    return p;
  }
  return { x: w / 2, y: 0.2 };
}

export function makeRound(g: ClashGame, n: number, startAt: number, random: () => number, players: number): ClashRound {
  const w = widthOf(g);
  const has = mechanicsFor(n, random);
  const hole = has.has('fountain');
  // A wider board gets about w times as many hazards, patches and power-ups (still the same number of rollers).
  const many = (base: number) => Math.max(1, Math.round(base * w));
  const storms: Circle[] = has.has('goo') ? Array.from({ length: many(1 + Math.floor(random() * 2)) }, () => ({ ...openSpot(random, hole, w), r: 0.1 + random() * 0.05 })) : [];
  const ice: Circle[] = has.has('slip') ? Array.from({ length: many(1 + Math.floor(random() * 2)) }, () => ({ ...openSpot(random, hole, w), r: 0.1 + random() * 0.04 })) : [];
  const teleports: Teleport[] = [];
  if (has.has('portal')) {
    const along = 0.3 + random() * 0.4;
    teleports.push(random() < 0.5 ? { a: { x: 0.06, y: along }, b: { x: w - 0.06, y: 1 - along } } : { a: { x: along * w, y: 0.06 }, b: { x: (1 - along) * w, y: 0.94 } });
  }
  const line = () => 0.15 + random() * 0.7;
  // A roller crossing the wide way takes w times as long, so it rolls as fast as on a square board.
  const roller: Roller | null = has.has('roller') ? { axis: 'x', at: line(), r: 0.07, periodMs: Math.round((5000 + Math.floor(random() * 1500)) * w), ...(w > 1 ? { span: w } : {}) } : null;
  const roller2: Roller | null = has.has('roller') ? { axis: 'y', at: line() * w, r: 0.07, periodMs: 5600 + Math.floor(random() * 1500) } : null;
  const golden: number[] = [];
  if (has.has('golden')) {
    // A few golden patches of 4 tiles.
    const cols = colsOf(w);
    for (let k = 0; k < many(3); k++) {
      const p = openSpot(random, hole, w);
      const t = tileOf(p, w);
      const x = Math.min(cols - 2, t % cols);
      const y = Math.min(GRID - 2, Math.floor(t / cols));
      golden.push(y * cols + x, y * cols + x + 1, (y + 1) * cols + x, (y + 1) * cols + x + 1);
    }
  }
  const items: ClashItem[] = [];
  if (has.has('items')) {
    const count = Math.max(2, Math.min(many(8), Math.round((players / 5) * w)));
    for (let i = 0; i < count; i++) items.push({ id: g.nextItem++, power: pick(POWERS, random), by: null, ...openSpot(random, hole, w) });
  }
  const paintFrom = startAt + READY_MS;
  const paintTo = paintFrom + g.paintS * 1000;
  return {
    ...(w !== 1 ? { w } : {}),
    n, startAt, paintFrom, paintTo, countEnd: paintTo + COUNT_MS, storms, ice, teleports, roller, roller2, hole,
    golden: [...new Set(golden)].filter((i) => !(hole && inFountain(i, w))), items, result: null,
  };
}

export function newClash(map: ClashMap, teams: 2 | 3 | 4, paintS: number = PAINT_DEFAULT_S, w: number = CLASH_W): ClashGame {
  return { kind: 'clash', map, w, teams, paintS: paintSeconds(paintS), zeroMs: null, round: null, wins: [0, 0, 0, 0, 0], totals: [0, 0, 0, 0, 0], history: [], mine: {}, nextItem: 1 };
}

/** A new pupil joins the smallest team (the lowest-numbered of the smallest). */
export function teamFor(g: ClashGame): Team {
  const sizes = [0, 0, 0, 0, 0];
  for (const m of Object.values(g.mine)) sizes[m.team]++;
  let best: Team = 1;
  for (let t = 2; t <= g.teams; t++) if (sizes[t] < sizes[best]) best = t as Team;
  return best;
}

export function freshMine(team: Team, w = 1): ClashMine {
  return {
    team, painted: 0, bombs: 0, right: 0, wrong: 0, streak: 0, bestStreak: 0, answered: 0, lastAt: -ANSWER_GAP_MS, held: null, grabs: 0, powersUsed: 0,
    brushTo: null, speedTo: null, bombTiles: 0, placed: 0, spot: { x: w / 2, y: 0.5 },
  };
}

/** Where each team starts: its own side of the board. */
export function startSpot(team: Team, teams: number, i: number, w = 1): Spot {
  const sides: Spot[] = (teams === 2 ? [{ x: 0.15, y: 0.5 }, { x: 0.85, y: 0.5 }] : [{ x: 0.15, y: 0.15 }, { x: 0.85, y: 0.15 }, { x: 0.85, y: 0.85 }, { x: 0.15, y: 0.85 }]).map((s) => ({ x: s.x * w, y: s.y }));
  const c = sides[(team - 1) % sides.length];
  return { x: c.x + ((i % 3) - 1) * 0.04, y: c.y + ((Math.floor(i / 3) % 3) - 1) * 0.04 };
}

export const painting = (r: ClashRound | null, t: number) => !!r && r.result === null && t >= r.paintFrom && t < r.paintTo;
export const speedy = (m: ClashMine | undefined, t: number) => !!m && m.speedTo !== null && t < m.speedTo;
export const brushy = (m: ClashMine | undefined, t: number) => !!m && m.brushTo !== null && t < m.brushTo;

// ---- Moving the game on ----

/** The time of the next thing the server must do (count a round, start the next), or null. */
export function nextDeadline(g: ClashGame, startedAt: number | null): number | null {
  if (startedAt === null) return null;
  if (!g.round) return 0;
  if (g.round.result === null) return g.round.paintTo;
  return g.round.countEnd;
}

/** Painting has ended and the round isn't counted yet: the server needs the board. */
export const needsTiles = (g: ClashGame, t: number) => !!g.round && g.round.result === null && t >= g.round.paintTo;

export const clashDone = (g: ClashGame, t: number) => !g.round || (g.round.result !== null && t >= g.round.countEnd);

/**
 * Moves the game on to time t: counts the round (from `board`, the database's tiles, and `painted`, tiles painted by
 * each pupil in the whole game), starts the next. When `last` (time is up), no new round starts.
 */
export function advance(g: ClashGame, t: number, order: string[], board: { tiles: string; painted: Record<string, number> } | null, random: () => number, last = false): ClashEvent[] {
  const events: ClashEvent[] = [];
  for (let guard = 0; guard < 4; guard++) {
    const r = g.round;
    if (!r) {
      if (last) break;
      g.round = makeRound(g, 1, Math.max(0, t), random, order.length);
      events.push({ type: 'clash_round', t, n: 1 });
      continue;
    }
    if (r.result === null) {
      if (t < r.paintTo || !board) break;
      const { score, tiles } = scoreTiles(board.tiles, r.golden, r.hole, widthOf(g));
      const top = Math.max(...score.slice(1, g.teams + 1));
      const winners = top > 0 ? ([1, 2, 3, 4] as Team[]).filter((tm) => tm <= g.teams && score[tm] === top) : [];
      r.result = { score, tiles, winners };
      for (const w of winners) g.wins[w]++;
      for (let tm = 1; tm <= 4; tm++) g.totals[tm] += tiles[tm];
      g.history.push({ n: r.n, score, winners });
      for (const id of order) if (g.mine[id] && board.painted[id] !== undefined) g.mine[id].painted = Math.max(g.mine[id].painted, board.painted[id]);
      events.push({ type: 'clash_count', t: r.paintTo, n: r.n, score, winners });
      continue;
    }
    if (t < r.countEnd || last) break;
    const startAt = t - r.countEnd > 2000 ? t : r.countEnd;
    for (const m of Object.values(g.mine)) {
      m.brushTo = null;
      m.speedTo = null;
    }
    g.round = makeRound(g, r.n + 1, startAt, random, order.length);
    events.push({ type: 'clash_round', t: startAt, n: r.n + 1 });
  }
  return events;
}

/** Running over an item picks it up (one at a time, while painting). */
export function grab(g: ClashGame, who: string, itemId: unknown, at: Spot | undefined, t: number): { ok: true; events: ClashEvent[] } | { ok: false; reason: 'not_now' | 'gone' | 'far' | 'full' } {
  const r = g.round;
  const m = g.mine[who];
  if (!m || !painting(r, t)) return { ok: false, reason: 'not_now' };
  if (m.held) return { ok: false, reason: 'full' };
  const item = r!.items.find((x) => x.id === itemId);
  if (!item || item.by) return { ok: false, reason: 'gone' };
  if (!at || dist(at, item) > GRAB_R + AVATAR_R + 0.03) return { ok: false, reason: 'far' };
  item.by = who;
  m.held = item.power;
  m.grabs++;
  return { ok: true, events: [{ type: 'clash_grab', t, pupil: who, power: item.power }] };
}

/** Can this pupil ask for a question now (painting is on)? */
export const canAsk = (g: ClashGame, who: string, t: number) => !!g.mine[who] && painting(g.round, t);

/**
 * A marked answer. A right one drops a paint bomb at `at` (their saved spot) and switches on a held power-up. Returns
 * the tiles to paint (the server paints them in the database).
 */
export function answered(g: ClashGame, who: string, right: boolean, at: Spot | undefined, t: number): { ok: true; events: ClashEvent[]; tiles: number[] } | { ok: false; reason: 'too_soon' | 'not_now' } {
  const m = g.mine[who];
  const r = g.round;
  if (!m || !r || !painting(r, t)) return { ok: false, reason: 'not_now' };
  if (t - m.lastAt < ANSWER_GAP_MS) return { ok: false, reason: 'too_soon' };
  m.lastAt = t;
  m.answered++;
  if (!right) {
    m.wrong++;
    m.streak = 0;
    return { ok: true, events: [], tiles: [] };
  }
  m.right++;
  m.streak++;
  m.bestStreak = Math.max(m.bestStreak, m.streak);
  const w = widthOf(g);
  const spot = at ?? { x: w / 2, y: 0.5 };
  const power = m.held;
  const events: ClashEvent[] = [];
  if (power) {
    m.held = null;
    m.powersUsed++;
    events.push({ type: 'clash_power', t, pupil: who, power });
    if (power === 'brush') m.brushTo = t + POWER_MS;
    if (power === 'speed') m.speedTo = t + POWER_MS;
  }
  const radius = bombRadius(m.streak, power === 'mega');
  let tiles = bombTiles(spot, radius, w);
  if (power === 'cross') tiles = [...new Set([...tiles, ...crossTiles(spot, w)])];
  if (r.hole) tiles = tiles.filter((i) => !inFountain(i, w));
  m.bombs++;
  m.bombTiles += tiles.length;
  events.push({ type: 'clash_bomb', t, pupil: who, team: m.team, x: spot.x, y: spot.y, r: radius, ...(power ? { power } : {}) });
  return { ok: true, events, tiles };
}

/** Teams in order, best first: round wins, then tiles over the game. Ties share a place. */
export function standings(g: ClashGame): { team: Team; wins: number; tiles: number; place: number }[] {
  const teams = ([1, 2, 3, 4] as Team[]).filter((t) => t <= g.teams).map((team) => ({ team, wins: g.wins[team], tiles: g.totals[team], place: 0 }));
  teams.sort((a, b) => b.wins - a.wins || b.tiles - a.tiles);
  teams.forEach((x, i) => {
    const prev = teams[i - 1];
    x.place = prev && prev.wins === x.wins && prev.tiles === x.tiles ? prev.place : i + 1;
  });
  return teams;
}

/** The winning team(s): first place, if any round was played and won. */
export const champions = (g: ClashGame): Team[] => (g.history.some((h) => h.winners.length) ? standings(g).filter((x) => x.place === 1).map((x) => x.team) : []);

/** A pretend pupil's joystick: wander towards a target, a new one now and then. */
export function pretendDir(p: Spot, target: Spot, random: () => number): Spot {
  const dx = target.x - p.x + (random() - 0.5) * 0.1;
  const dy = target.y - p.y + (random() - 0.5) * 0.1;
  const len = Math.hypot(dx, dy);
  return len < 0.03 ? { x: 0, y: 0 } : { x: dx / len, y: dy / len };
}
