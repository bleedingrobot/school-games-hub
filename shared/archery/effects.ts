/**
 * What every arrow does (docs/ARCHERY-PLAN.md, section 4): its flight and what happens where it lands.
 * `runArrow` plays one shot's arrow on the round's land and archers, adding up the raw damage each archer
 * takes; `fight.ts` then lets dirt fall, archers fall, caps the damage and applies it.
 *
 * Same rules as the rest of the engine: only + − × ÷, square root and floor, no Math.random, so a replay
 * on the server gives exactly the same result. Each arrow is one small function.
 */
import { AIM_X, AIM_Y, clampAngle } from './aim';
import { arrowKind, type ArrowKind } from './arrows';
import {
  ARCHER_H, BOLT_CUT_MOST, BOLT_CUT_RADIUS, BOLT_RANGE_MIN, BOLT_RANGE_PER, BOLT_SPEED, CELL, COLS, DIG_OUT_STEPS, DIRECT_HIT_BONUS, DT,
  FIREWORK_GAP, FIREWORK_POPS, GOO_CELLS, GOO_FLAT_HALF, GOO_MAX_RISE, GOO_MAX_WIDTH, GOO_RUN, GOO_SHOTS, LAUNCH_OFFSET, LOG_FRICTION, LOG_MAX_COLS, LOG_MAX_SPEED,
  LOG_SPEED_FROM_FLIGHT, LOG_START_SPEED, MOLE_DEPTH, MOLE_RADIUS, PATH_EVERY, RAIN_PIECES, RAIN_SPREAD, ROWS, SHAKER_MOVES, SHAKER_REACH,
  SHAKER_STEP, SKIP_BLASTS, SKIP_KEEP_VX, SKIP_MIN_UP, SKIP_MIN_VX, SKIP_UP, SNEAKY_RADIUS, SNEAKY_RANGE, SNEAKY_UNDER, HANDS_HEIGHT,
} from './config';
import { blastDamage } from './damage';
import { bowKind } from './gear';
import { addDirt, archerCols, carve, cellAt, slideSand, surfaceRow } from './land';
import { clampPower, fly, launch, type FlightOut, type FlyOptions, type Motion } from './shot';
import { AIR, type Archer, type Land, type Puddle, type Round, type Shot, type ShotEvent, type ShotHit } from './types';

/** One shot being played: the round, who shot, and what has happened so far. */
export interface ShotWork {
  round: Round;
  land: Land;
  archers: Archer[];
  shooter: number;
  shot: Shot;
  arrow: ArrowKind;
  /** Raw damage each archer has taken so far (before falling, the cap and shields). */
  raw: number[];
  /** The columns blasts and digging reached (so loose dirt can fall there). */
  c0: number;
  c1: number;
  /** The first time the main flight hit something (the bots aim by it). */
  hit: ShotHit | null;
  /** Where the main flight first bounced off ice, if it did. */
  bounce: [number, number] | null;
  /** The main flight's path (for drawing). */
  path: number[];
  /** Everything that happened, for drawing (null when not asked for). */
  events: ShotEvent[] | null;
  /** The shooter dug out of being buried: their own blasts don't hurt them this shot. */
  spareShooter: boolean;
  /** New Sticky Goo puddles made by this shot. */
  puddles: Puddle[];
  /** Columns an Earth Shaker shook, and archers it shook loose: [from, to] or null. */
  shaken: [number, number] | null;
  /** Archers a Glass Arrow stabbed (or nearly) this shot. */
  stabbed: boolean[];
}

const WIND_OF = (w: ShotWork) => w.round.wind;

function touch(w: ShotWork, [a, b]: [number, number]) {
  if (a < w.c0) w.c0 = a;
  if (b > w.c1) w.c1 = b;
}

function note(w: ShotWork, e: ShotEvent) {
  if (w.events) w.events.push(e);
}

/** A blast at (x, y): hurts archers within `radius` (fading from `peak`), and clears the land unless `carveIt` is false. */
export function blast(w: ShotWork, t: number, x: number, y: number, radius: number, peak: number, carveIt = true) {
  for (let i = 0; i < w.archers.length; i++) {
    const a = w.archers[i];
    if (a.popped) continue;
    if (i === w.shooter && w.spareShooter) continue;
    const d = blastDamage(a, x, y, radius, peak);
    w.raw[i] += d;
    if (d > 0 && w.arrow.id === 'glass' && i !== w.shooter) w.stabbed[i] = true;
  }
  if (carveIt && radius > 0) touch(w, carve(w.land, x, y, radius));
  note(w, { k: 'blast', t, x, y, r: radius, carve: carveIt });
}

function bonus(w: ShotWork, hit: ShotHit) {
  if (hit.kind !== 'archer' || hit.archer === null) return;
  const a = w.archers[hit.archer];
  if (a.popped) return;
  w.raw[hit.archer] += DIRECT_HIT_BONUS;
  if (w.arrow.id === 'glass' && hit.archer !== w.shooter) w.stabbed[hit.archer] = true;
}

const landed = (h: ShotHit) => h.kind === 'land' || h.kind === 'archer' || h.kind === 'floor';

/** Flies a part of the shot, notes it for drawing, and returns it. The first flight is the main one. */
function flight(w: ShotWork, t: number, start: Motion, opts: FlyOptions, part: 'main' | 'child' | 'hop'): FlightOut {
  const a = w.archers[w.shooter];
  const f = fly(w.land, w.archers, w.shooter, start, WIND_OF(w), { windScale: bowKind(a.bow).wind, ...opts });
  if (part === 'main') {
    w.hit = f.hit;
    w.bounce = f.bounce;
    w.path = f.path;
    // A buried archer digging out: the arrow hits land straight away, so its blast never hurts them.
    if (f.hit.kind === 'land' && f.hit.steps <= DIG_OUT_STEPS) w.spareShooter = true;
  }
  if (w.events) {
    note(w, { k: 'fly', t, path: f.path, part });
    if (f.bounce) note(w, { k: 'bounce', t: t + stepOfPoint(f.path, f.bounce), x: f.bounce[0], y: f.bounce[1], what: 'ice' });
    for (const [x, y, s] of f.bubbles) note(w, { k: 'bounce', t: t + s, x, y, what: 'bubble' });
  }
  return f;
}

/** Roughly when a flight passed a point of its path (for drawing only). */
function stepOfPoint(path: number[], [x, y]: [number, number]): number {
  for (let i = 0; i < path.length; i += 2) if (path[i] === x && path[i + 1] === y) return (i / 2) * PATH_EVERY;
  return 0;
}

/** The normal landing: one blast of the arrow's size where it hit, plus the direct-hit bonus. */
function burst(w: ShotWork, t: number, hit: ShotHit, radius = w.arrow.blastRadius, peak = w.arrow.peakDamage) {
  if (!landed(hit) && hit.kind !== 'spent') return;
  blast(w, t, hit.x, hit.y, radius, peak);
  bonus(w, hit);
}

// ——— The arrows ———

function plain(w: ShotWork, start: Motion, opts: FlyOptions = {}) {
  const f = flight(w, 0, start, opts, 'main');
  burst(w, f.hit.steps, f.hit);
}

/** Arrow Rain: splits at the top of its flight into RAIN_PIECES small arrows, spread sideways. */
function rain(w: ShotWork, start: Motion) {
  const f = flight(w, 0, start, { apex: true }, 'main');
  if (f.hit.kind !== 'split') {
    burst(w, f.hit.steps, f.hit);
    return;
  }
  const t0 = f.hit.steps;
  const mid = (RAIN_PIECES - 1) / 2;
  for (let k = 0; k < RAIN_PIECES; k++) {
    const piece = flight(w, t0, { x: f.end.x, y: f.end.y, vx: f.end.vx + (k - mid) * RAIN_SPREAD, vy: f.end.vy }, { armed: true }, 'child');
    if (k === mid) w.hit = { ...piece.hit, steps: t0 + piece.hit.steps };
    burst(w, t0 + piece.hit.steps, piece.hit);
  }
}

/** Rolling Log: lands, then rolls along the land, bursting in a dip, against a wall, or at an archer. */
function log(w: ShotWork, start: Motion) {
  const f = flight(w, 0, start, {}, 'main');
  const hit = f.hit;
  if (hit.kind !== 'land') {
    burst(w, hit.steps, hit);
    return;
  }
  let col = clampCol(Math.floor(hit.x / CELL));
  let top = solidBelow(w.land, col, Math.floor(hit.y / CELL) - 1);
  // Downhill first; on the level, the way it was flying.
  const left = surfaceAt(w.land, col - 1, top);
  const right = surfaceAt(w.land, col + 1, top);
  let dir = right > left ? 1 : left > right ? -1 : f.end.vx >= 0 ? 1 : -1;
  let speed = LOG_START_SPEED + Math.floor((f.end.vx < 0 ? -f.end.vx : f.end.vx) / LOG_SPEED_FROM_FLIGHT);
  const path: number[] = [col * CELL + CELL / 2, top * CELL];
  let at: ShotHit = { kind: 'land', x: col * CELL + CELL / 2, y: top * CELL, archer: null, steps: hit.steps };
  for (let n = 0; n < LOG_MAX_COLS && speed > 0; n++) {
    const next = col + dir;
    if (next < 0 || next >= COLS) break;
    // A wall more than a cell high stops it.
    if (cellAt(w.land, next, top - 1) !== AIR && cellAt(w.land, next, top - 2) !== AIR) break;
    const nt = solidBelow(w.land, next, top - 2);
    if (nt >= ROWS) break; // a hole to the bottom: it stops at the edge
    speed += nt - top - LOG_FRICTION;
    if (speed > LOG_MAX_SPEED) speed = LOG_MAX_SPEED;
    col = next;
    top = nt;
    const x = col * CELL + CELL / 2;
    const y = top * CELL;
    path.push(x, y);
    at = { kind: 'land', x, y, archer: null, steps: hit.steps + (path.length / 2 - 1) * PATH_EVERY };
    const struck = archerAt(w, x, y - 4);
    if (struck !== null) {
      at = { ...at, kind: 'archer', archer: struck };
      break;
    }
  }
  // Out of speed on a slope: it rolls back down into the bottom of the dip (over little flat steps too).
  if (at.kind === 'land') {
    const way = downhill(w.land, col, top);
    for (let n = 0; way !== 0 && n < LOG_MAX_COLS; n++) {
      const c = col + way;
      if (c < 0 || c >= COLS || cellAt(w.land, c, top - 1) !== AIR) break;
      const nt = solidBelow(w.land, c, top - 1);
      if (nt >= ROWS) break;
      col = c;
      top = nt;
      const x = col * CELL + CELL / 2;
      const y = top * CELL;
      path.push(x, y);
      at = { kind: 'land', x, y, archer: null, steps: hit.steps + (path.length / 2 - 1) * PATH_EVERY };
      const struck = archerAt(w, x, y - 4);
      if (struck !== null) {
        at = { ...at, kind: 'archer', archer: struck };
        break;
      }
    }
  }
  note(w, { k: 'roll', t: hit.steps, path });
  burst(w, at.steps, at);
}

/** Mole Arrow: digs a tunnel straight down from where it lands. */
function mole(w: ShotWork, start: Motion) {
  const f = flight(w, 0, start, {}, 'main');
  const hit = digFrom(w, f.hit);
  if (!hit) {
    burst(w, f.hit.steps, f.hit);
    return;
  }
  bonus(w, f.hit);
  const path: number[] = [];
  let y = hit.y;
  for (let d = 0; d <= MOLE_DEPTH; d += CELL) {
    y = hit.y + d;
    touch(w, carve(w.land, hit.x, y, MOLE_RADIUS));
    path.push(hit.x, y);
  }
  note(w, { k: 'dig', t: hit.steps, path, r: MOLE_RADIUS });
  blast(w, hit.steps + (path.length / 2) * PATH_EVERY, hit.x, y, w.arrow.blastRadius, w.arrow.peakDamage);
}

/** Sneaky Mole: lands, tunnels toward the other archer, and pops up under them. */
function sneaky(w: ShotWork, start: Motion) {
  const f = flight(w, 0, start, {}, 'main');
  const hit = digFrom(w, f.hit);
  const target = otherArcher(w);
  if (!hit || target === null) {
    burst(w, f.hit.steps, f.hit);
    return;
  }
  const a = w.archers[target];
  let tx = a.x - hit.x;
  let ty = a.y + SNEAKY_UNDER - hit.y;
  const d = Math.sqrt(tx * tx + ty * ty);
  if (d > SNEAKY_RANGE) {
    tx = (tx / d) * SNEAKY_RANGE;
    ty = (ty / d) * SNEAKY_RANGE;
  }
  const n = Math.floor((d > SNEAKY_RANGE ? SNEAKY_RANGE : d) / CELL);
  const path: number[] = [hit.x, hit.y];
  for (let k = 1; k <= n; k++) {
    const x = hit.x + (tx * k) / (n || 1);
    const y = hit.y + (ty * k) / (n || 1);
    touch(w, carve(w.land, x, y, SNEAKY_RADIUS));
    path.push(x, y);
  }
  const ex = hit.x + tx;
  const ey = hit.y + ty;
  note(w, { k: 'dig', t: hit.steps, path, r: SNEAKY_RADIUS });
  blast(w, hit.steps + (path.length / 2) * PATH_EVERY, ex, ey, w.arrow.blastRadius, w.arrow.peakDamage);
}

/** Skipping Arrow: lands, then hops forward twice, a bigger blast each time. */
function skip(w: ShotWork, start: Motion) {
  let f = flight(w, 0, start, {}, 'main');
  let t = 0;
  for (let k = 0; k < SKIP_BLASTS.length; k++) {
    const hit = f.hit;
    t += hit.steps;
    const { r, peak } = SKIP_BLASTS[k];
    burst(w, t, hit, r, peak);
    if (hit.kind !== 'land' || k === SKIP_BLASTS.length - 1) return;
    const vx = f.end.vx * SKIP_KEEP_VX;
    const sideways = vx >= 0 ? (vx < SKIP_MIN_VX ? SKIP_MIN_VX : vx) : vx > -SKIP_MIN_VX ? -SKIP_MIN_VX : vx;
    const up = f.end.vy * SKIP_UP;
    const vy = -(up > SKIP_MIN_UP ? up : SKIP_MIN_UP);
    f = flight(w, t, { x: hit.x, y: hit.y - CELL, vx: sideways, vy }, { armed: true }, 'hop');
  }
}

/** Mud Ball: a big ball of dirt where it lands (it settles into a heap). */
function mud(w: ShotWork, start: Motion) {
  const f = flight(w, 0, start, {}, 'main');
  const hit = f.hit;
  if (!landed(hit)) return;
  touch(w, addDirt(w.land, hit.x, hit.y, w.arrow.blastRadius));
  note(w, { k: 'dirt', t: hit.steps, x: hit.x, y: hit.y, r: w.arrow.blastRadius });
}

/** Sticky Goo: a splash with no crater, then a puddle that runs into the dip and stays a few turns. */
function goo(w: ShotWork, start: Motion) {
  const f = flight(w, 0, start, {}, 'main');
  const hit = f.hit;
  if (!landed(hit)) return;
  blast(w, hit.steps, hit.x, hit.y, w.arrow.blastRadius, w.arrow.peakDamage, false);
  bonus(w, hit);
  const puddle = pool(w.land, clampCol(Math.floor(hit.x / CELL)));
  if (puddle) {
    w.puddles.push(puddle);
    note(w, { k: 'goo', t: hit.steps, puddle });
  }
}

/** Earth Shaker: a small blast, then the land around crumbles and archers on slopes tumble. */
function shaker(w: ShotWork, start: Motion) {
  const f = flight(w, 0, start, {}, 'main');
  const hit = f.hit;
  if (!landed(hit)) return;
  burst(w, hit.steps, hit);
  const c = clampCol(Math.floor(hit.x / CELL));
  const from = c - SHAKER_REACH < 0 ? 0 : c - SHAKER_REACH;
  const to = c + SHAKER_REACH >= COLS ? COLS - 1 : c + SHAKER_REACH;
  w.shaken = [from, to];
  touch(w, [from, to]);
  note(w, { k: 'shake', t: hit.steps, x: hit.x, y: hit.y, reach: SHAKER_REACH * CELL });
}

/** Firework Arrow: five pops around where it lands, one after another. */
function firework(w: ShotWork, start: Motion) {
  const f = flight(w, 0, start, {}, 'main');
  const hit = f.hit;
  if (!landed(hit)) return;
  bonus(w, hit);
  FIREWORK_POPS.forEach(([dx, dy], k) => blast(w, hit.steps + k * FIREWORK_GAP, hit.x + dx, hit.y + dy, w.arrow.blastRadius, w.arrow.peakDamage));
}

/** Crossbow Bolt: dead straight with no drop and no wind, cutting through dirt, popping at the end of its range. */
function bolt(w: ShotWork) {
  const a = w.archers[w.shooter];
  const d = clampAngle(w.shot.angle);
  const dx = AIM_X[d];
  const dy = -AIM_Y[d];
  const range = BOLT_RANGE_MIN + clampPower(w.shot.power) * BOLT_RANGE_PER;
  const start: Motion = { x: a.x + dx * LAUNCH_OFFSET, y: a.y - HANDS_HEIGHT + dy * LAUNCH_OFFSET, vx: dx * BOLT_SPEED, vy: dy * BOLT_SPEED };
  const steps = Math.floor(range / (BOLT_SPEED * DT));
  const f = flight(w, 0, start, {
    gravity: false, windScale: 0, maxSteps: steps, iceBounce: false, cutMost: Math.floor(BOLT_CUT_MOST / (BOLT_SPEED * DT)),
    cut: (x, y) => touch(w, carve(w.land, x, y, BOLT_CUT_RADIUS)),
  }, 'main');
  burst(w, f.hit.steps, f.hit);
}

/** Plays the shot's arrow: its flight and its landing (each arrow's own way). */
export function runArrow(w: ShotWork) {
  const a = w.archers[w.shooter];
  const start = launch(a, w.shot.angle, w.shot.power);
  switch (w.arrow.id) {
    case 'rain': return rain(w, start);
    case 'log': return log(w, start);
    case 'mole': return mole(w, start);
    case 'sneaky': return sneaky(w, start);
    case 'skip': return skip(w, start);
    case 'mud': return mud(w, start);
    case 'goo': return goo(w, start);
    case 'shaker': return shaker(w, start);
    case 'firework': return firework(w, start);
    case 'bolt': return bolt(w);
    case 'owl': return plain(w, start, { steer: true });
    default: return plain(w, start); // plain, steel, giant, glass
  }
}

/** A new piece of shot work for `shooter` in the round. */
export function newWork(round: Round, shooter: number, shot: Shot, keep: boolean): ShotWork {
  return {
    round, land: round.land, archers: round.archers, shooter, shot, arrow: arrowKind(shot.arrow), raw: round.archers.map(() => 0),
    c0: Infinity, c1: -Infinity, hit: null, bounce: null, path: [], events: keep ? [] : null, spareShooter: false, puddles: [], shaken: null,
    stabbed: round.archers.map(() => false),
  };
}

/**
 * After the dirt has fallen: an Earth Shaker's cliffs crumble into slopes. Returns which archers stand in
 * the shaken land (fight.ts makes them tumble down any slope, like on the Snow's slippery slopes).
 */
export function shake(w: ShotWork): boolean[] {
  const tumble = w.archers.map(() => false);
  if (!w.shaken) return tumble;
  const [from, to] = w.shaken;
  slideSand(w.land, from, to, w.archers, 0, SHAKER_STEP, SHAKER_MOVES);
  for (let i = 0; i < w.archers.length; i++) {
    const a = w.archers[i];
    if (a.popped) continue;
    const [a0, a1] = archerCols(a.x);
    tumble[i] = !(a1 < from || a0 > to);
  }
  return tumble;
}

// ——— Helpers ———

/** Where a digging arrow starts digging: where it hit the land, or under the feet of the archer it hit. Null if neither. */
function digFrom(w: ShotWork, hit: ShotHit): ShotHit | null {
  if (hit.kind === 'land') return hit;
  if (hit.kind === 'archer' && hit.archer !== null) return { ...hit, x: w.archers[hit.archer].x, y: w.archers[hit.archer].y + 1 };
  return null;
}

const clampCol = (c: number) => (c < 0 ? 0 : c >= COLS ? COLS - 1 : c);

/** The first solid row in column `col` at or below `row` (ROWS if none). */
function solidBelow(land: Land, col: number, row: number): number {
  for (let r = row < 0 ? 0 : row; r < ROWS; r++) if (cellAt(land, col, r) !== AIR) return r;
  return ROWS;
}

/** The ground row a roller would sit on in a column, starting from a row near `top` (−1 off the field). */
function surfaceAt(land: Land, col: number, top: number): number {
  if (col < 0 || col >= COLS) return -1;
  return solidBelow(land, col, top - 2);
}

/** LOG_LOOK columns ahead: which way the land first goes down from (col, top), before it goes up (0 if neither). */
const LOG_LOOK = 8;
function downhill(land: Land, col: number, top: number): number {
  let best = 0;
  let bestK = LOG_LOOK + 1;
  for (const d of [1, -1]) {
    for (let k = 1; k <= LOG_LOOK; k++) {
      const c = col + d * k;
      if (c < 0 || c >= COLS || cellAt(land, c, top - 1) !== AIR) break;
      const nt = solidBelow(land, c, top - 1);
      if (nt === top) continue;
      if (nt > top && nt < ROWS && k < bestK) {
        best = d;
        bestK = k;
      }
      break;
    }
  }
  return best;
}

/** The other archer still in the round (null if none). */
function otherArcher(w: ShotWork): number | null {
  for (let i = 0; i < w.archers.length; i++) if (i !== w.shooter && !w.archers[i].popped) return i;
  return null;
}

/** Which archer (still in the round) has a box at this point, if any. */
function archerAt(w: ShotWork, x: number, y: number): number | null {
  for (let i = 0; i < w.archers.length; i++) {
    const a = w.archers[i];
    if (a.popped) continue;
    if (x >= a.x - 8 && x <= a.x + 8 && y >= a.y - ARCHER_H && y <= a.y + CELL) return i;
  }
  return null;
}

/**
 * Where Sticky Goo pools: it runs downhill from column `c` (at most GOO_RUN columns) to the bottom of the
 * dip, then fills it up to GOO_CELLS cells, rising at most GOO_MAX_RISE rows. Null if there's no ground.
 */
export function pool(land: Land, c: number): Puddle | null {
  let col = c;
  let top = surfaceRow(land, col);
  if (top >= ROWS) return null;
  for (let n = 0; n < GOO_RUN; n++) {
    const l = col > 0 ? surfaceRow(land, col - 1) : -1;
    const r = col < COLS - 1 ? surfaceRow(land, col + 1) : -1;
    if (l > top && l >= r && l < ROWS) {
      col--;
      top = l;
    } else if (r > top && r < ROWS) {
      col++;
      top = r;
    } else break;
  }
  // Fill: raise the level a row at a time, spreading over the columns deeper than the level, until it
  // holds GOO_CELLS cells, or rising again would make it wider than GOO_MAX_WIDTH (it would spill).
  let level = top;
  let c0 = col;
  let c1 = col;
  let cells = 0;
  for (let rise = 1; rise <= GOO_MAX_RISE && cells < GOO_CELLS; rise++) {
    const lv = top - rise;
    let n0 = c0;
    let n1 = c1;
    while (n0 > 0 && surfaceRow(land, n0 - 1) > lv && n1 - n0 < GOO_MAX_WIDTH) n0--;
    while (n1 < COLS - 1 && surfaceRow(land, n1 + 1) > lv && n1 - n0 < GOO_MAX_WIDTH) n1++;
    if (n1 - n0 + 1 > GOO_MAX_WIDTH) break;
    level = lv;
    c0 = n0;
    c1 = n1;
    cells = 0;
    for (let k = c0; k <= c1; k++) cells += surfaceRow(land, k) - level;
  }
  if (level === top) {
    // Flat ground: a thin film around where it landed.
    c0 = col - GOO_FLAT_HALF < 0 ? 0 : col - GOO_FLAT_HALF;
    c1 = col + GOO_FLAT_HALF >= COLS ? COLS - 1 : col + GOO_FLAT_HALF;
    level = top - 1;
  }
  return { c0, c1, level, shots: GOO_SHOTS };
}

/** Is this archer standing in the puddle? */
export function inPuddle(p: Puddle, a: Archer): boolean {
  if (a.popped) return false;
  const [a0, a1] = archerCols(a.x);
  if (a1 < p.c0 || a0 > p.c1) return false;
  return Math.floor(a.y / CELL) > p.level;
}
