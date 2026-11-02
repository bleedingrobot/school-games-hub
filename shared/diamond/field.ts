/**
 * The buried field for a level, made from the level's seed: gems (rarer ones fewer, smaller and deeper), rocks,
 * mystery sacks and cave crabs. The same seed always gives the same field, so the server can replay a level.
 */
import { COS, SIN } from './angles';
import {
  BOOST_IDS, CLAW_R, CRAB_GEM_CHANCE, CRAB_R, CRAB_SPEED, DIAMOND_CORRIDOR, DIAMOND_GUARDS, DIAMOND_OPENING, FIELD_H, FIELD_VALUE_MARGIN, FIELD_W, GAP,
  GEMS, GROUND_Y, LAST_LEVEL, PIVOT, REACH_SLOPE, ROCKS, SACK, SACK_R, STARTER, SWING_RANGE, levelSpec,
  type BoostId, type GemId,
} from './config';
import { STREAM, makeRandom, mixSeed, type Random } from './random';

export type SackPrize = { coins: number } | { seconds: number } | { boost: BoostId };

export interface Crab {
  xMin: number;
  xMax: number;
  /** Field units a tick. */
  speed: number;
  /** How far along its walk (there and back) it starts. */
  phase: number;
  /** The gem it carries, if any. */
  gem?: GemId;
}

export interface Thing {
  id: number;
  kind: 'gem' | 'rock' | 'sack' | 'crab';
  gem?: GemId;
  /** Only the guided first go's big quartz is worth something other than its gem's value. */
  value?: number;
  rock?: 'small' | 'big';
  sack?: SackPrize;
  crab?: Crab;
  /** Where it is (a crab: where its walk starts; use `thingAt`). */
  x: number;
  y: number;
  r: number;
}

/** Where a thing is at a tick (only crabs move: there and back along their walk). */
export function thingAt(t: Thing, tick: number): { x: number; y: number } {
  if (!t.crab) return { x: t.x, y: t.y };
  const span = t.crab.xMax - t.crab.xMin;
  const p = (t.crab.phase + tick * t.crab.speed) % (2 * span);
  return { x: p < span ? t.crab.xMin + p : t.crab.xMax - (p - span), y: t.y };
}

/** Which way a whole degree points, from the fixed table (0 is straight down, positive is to the right). */
export function direction(degree: number): { dx: number; dy: number } {
  const a = degree < 0 ? -degree : degree;
  return { dx: degree < 0 ? -SIN[a] : SIN[a], dy: COS[a] };
}

/** The widest whole degree the claw reaches. */
export const MAX_DEGREE = SWING_RANGE / 10;

/**
 * The first thing a claw sent out at this degree would touch if everything stayed where it is at `tick`, and how far
 * out. Worked out in one go (with a square root), so it's for planning (making fields, bots), not for the replay.
 */
export function firstHit(things: readonly Thing[], degree: number, tick = 0): { thing: Thing; length: number } | null {
  const { dx, dy } = direction(degree);
  let best: { thing: Thing; length: number } | null = null;
  for (const t of things) {
    const at = thingAt(t, tick);
    const cx = at.x - PIVOT.x;
    const cy = at.y - PIVOT.y;
    const along = cx * dx + cy * dy;
    if (along <= 0) continue;
    const reach = t.r + CLAW_R;
    const side2 = cx * cx + cy * cy - along * along;
    if (side2 > reach * reach) continue;
    const length = along - Math.sqrt(reach * reach - side2);
    if (!best || length < best.length) best = { thing: t, length };
  }
  return best;
}

/** Would a thing at (x, y), walking right as far as xMax, come too close to anything already buried? */
function overlaps(list: readonly Thing[], x: number, y: number, r: number, xMax = x): boolean {
  for (const p of list) {
    // Nearest points of two flat walks (a still thing is a walk of no length; a crab's is its whole walk).
    const px = Math.max(p.x, Math.min(x, p.crab ? p.crab.xMax : p.x));
    const qx = Math.max(x, Math.min(px, xMax));
    const ddx = px - qx;
    const ddy = p.y - y;
    const need = p.r + r + GAP;
    if (ddx * ddx + ddy * ddy < need * need) return true;
  }
  return false;
}

/** The left and right edges a thing of size r can be buried between at depth y. */
function rowAt(y: number, r: number): [number, number] {
  const half = REACH_SLOPE * (y - PIVOT.y);
  return [Math.max(r + 4, PIVOT.x - half), Math.min(FIELD_W - r - 4, PIVOT.x + half)];
}

/** How close a thing of size r at (x, y) comes to the clear line from the winch down to `to` (by the claw's reach). */
function inCorridor(to: { x: number; y: number }, x: number, y: number, r: number): boolean {
  const ax = to.x - PIVOT.x;
  const ay = to.y - PIVOT.y;
  const along = Math.max(0, Math.min(1, ((x - PIVOT.x) * ax + (y - PIVOT.y) * ay) / (ax * ax + ay * ay)));
  const dx = x - (PIVOT.x + along * ax);
  const dy = y - (PIVOT.y + along * ay);
  const need = r + CLAW_R + DIAMOND_CORRIDOR;
  return dx * dx + dy * dy < need * need;
}

function spot(rng: Random, placed: readonly Thing[], r: number, minY: number, maxY: number, clear: Thing | null): { x: number; y: number } | null {
  for (let i = 0; i < 80; i++) {
    const y = rng.between(minY, maxY);
    const [lo, hi] = rowAt(y, r);
    if (hi <= lo) continue;
    const x = rng.between(lo, hi);
    if (!overlaps(placed, x, y, r) && !(clear && inCorridor(clear, x, y, r))) return { x, y };
  }
  return null;
}

function sackPrize(rng: Random, level: number): SackPrize {
  const roll = rng.fraction();
  if (roll < SACK.coinsChance) {
    const low = SACK.coinsLow + level * SACK.coinsPerLevel;
    return { coins: low + rng.int(low + 1) };
  }
  if (roll < SACK.coinsChance + SACK.secondsChance) return { seconds: SACK.seconds };
  return { boost: BOOST_IDS[rng.int(BOOST_IDS.length)] };
}

function buildField(level: number, rng: Random): Thing[] {
  const spec = levelSpec(level);
  const things: Thing[] = [];
  const add = (t: Omit<Thing, 'id'>) => things.push({ id: things.length, ...t });
  const bottom = (r: number) => FIELD_H - r - 6;

  // The Heart Diamond first, low and near the middle, with a clear line down to it that nothing else is buried in,
  // and big rocks guarding both sides of that line just above it.
  let guards = 0;
  let clear: Thing | null = null;
  if (spec.gems[GEMS.length - 1]) {
    const d = GEMS[GEMS.length - 1];
    const y = rng.between(d.minY, bottom(d.r));
    const x = PIVOT.x + rng.between(-150, 150);
    add({ kind: 'gem', gem: d.id, x, y, r: d.r });
    clear = things[0];
    for (let g = 0; g < DIAMOND_GUARDS; g++) {
      const side = g % 2 === 0 ? -1 : 1;
      const gy = y - rng.between(70, 110);
      const lineX = PIVOT.x + ((x - PIVOT.x) * (gy - PIVOT.y)) / (y - PIVOT.y);
      const gx = lineX + side * (ROCKS.big.r + CLAW_R + DIAMOND_CORRIDOR + rng.between(4, 30));
      if (!overlaps(things, gx, gy, ROCKS.big.r)) {
        add({ kind: 'rock', rock: 'big', x: gx, y: gy, r: ROCKS.big.r });
        guards++;
      }
    }
  }
  // Rarest gems next, so they get the deep spots.
  for (let i = Math.min(spec.gems.length, GEMS.length - 1) - 1; i >= 0; i--) {
    const g = GEMS[i];
    for (let n = 0; n < spec.gems[i]; n++) {
      const at = spot(rng, things, g.r, g.minY, bottom(g.r), clear);
      if (at) add({ kind: 'gem', gem: g.id, ...at, r: g.r });
    }
  }
  for (const [size, count] of [['big', spec.bigRocks - guards], ['small', spec.smallRocks]] as const) {
    const r = ROCKS[size].r;
    for (let n = 0; n < count; n++) {
      const at = spot(rng, things, r, GROUND_Y + 20, bottom(r), clear);
      if (at) add({ kind: 'rock', rock: size, ...at, r });
    }
  }
  for (let n = 0; n < spec.sacks; n++) {
    const at = spot(rng, things, SACK_R, 200, bottom(SACK_R), clear);
    if (at) add({ kind: 'sack', sack: sackPrize(rng, level), ...at, r: SACK_R });
  }
  const kinds = GEMS.slice(0, Math.min(level, GEMS.length - 1));
  for (let n = 0; n < spec.crabs; n++) {
    for (let tries = 0; tries < 40; tries++) {
      const y = rng.between(300, bottom(CRAB_R));
      const [lo, hi] = rowAt(y, CRAB_R);
      const walk = rng.between(150, 300);
      if (hi - lo < walk) continue;
      const xMin = rng.between(lo, hi - walk);
      if (overlaps(things, xMin, y, CRAB_R, xMin + walk)) continue;
      // Crabs carry the rarer gems of the level more often than the common ones.
      const gem = rng.fraction() < CRAB_GEM_CHANCE ? kinds[Math.max(rng.int(kinds.length), rng.int(kinds.length))].id : undefined;
      const crab: Crab = { xMin, xMax: xMin + walk, speed: rng.between(CRAB_SPEED[0], CRAB_SPEED[1]), phase: rng.between(0, 2 * walk), gem };
      add({ kind: 'crab', crab, x: xMin, y, r: CRAB_R });
      break;
    }
  }
  return things;
}

/** Gem value buried in a field (crabs' gems not counted). */
export function fieldValue(things: readonly Thing[]): number {
  let total = 0;
  for (const t of things) if (t.kind === 'gem' && t.gem) total += t.value ?? GEMS.find((g) => g.id === t.gem)!.value;
  return total;
}

/** Can the claw reach the Heart Diamond without touching anything else first (crabs aside), at DIAMOND_OPENING degrees or more? */
export function diamondReachable(things: readonly Thing[]): boolean {
  const still = things.filter((t) => t.kind !== 'crab');
  let open = 0;
  for (let d = -MAX_DEGREE; d <= MAX_DEGREE; d++) if (firstHit(still, d)?.thing.gem === 'heartDiamond') open++;
  return open >= DIAMOND_OPENING;
}

function fieldOk(level: number, things: readonly Thing[]): boolean {
  const spec = levelSpec(level);
  const gems = things.filter((t) => t.kind === 'gem').length;
  if (gems !== spec.gems.reduce((a, b) => a + b, 0)) return false;
  if (level === LAST_LEVEL) return diamondReachable(things);
  return fieldValue(things) >= FIELD_VALUE_MARGIN * spec.target;
}

/** The field for a level from its seed. Tries the next seed in line until every gem fits and the level can be passed. */
export function makeField(level: number, seed: number): Thing[] {
  let things: Thing[] = [];
  for (let attempt = 0; attempt < 60; attempt++) {
    things = buildField(level, makeRandom(mixSeed(seed, STREAM.field + attempt)));
    if (fieldOk(level, things)) return things;
  }
  return things;
}

/**
 * The guided first go's field: level 1 with a big quartz straight below and nothing in the way, so wherever the slow,
 * narrow swing is when the pupil presses Drop, the claw catches it.
 */
export function makeStarterField(seed: number): Thing[] {
  const q = STARTER.quartz;
  // Anything within this slope of straight down, above the quartz's bottom, could get in the way.
  const wedge = 0.45;
  const kept = makeField(1, seed).filter((t) => {
    const dx = t.x - q.x;
    const dy = t.y - q.y;
    const need = t.r + q.r + GAP;
    if (dx * dx + dy * dy < need * need) return false;
    const side = t.x - PIVOT.x < 0 ? PIVOT.x - t.x : t.x - PIVOT.x;
    return !(t.y < q.y + q.r + t.r && side - t.r < wedge * (t.y - PIVOT.y) + CLAW_R);
  });
  return [{ id: 0, kind: 'gem', gem: 'quartz', value: q.value, x: q.x, y: q.y, r: q.r }, ...kept.map((t, i) => ({ ...t, id: i + 1 }))];
}
