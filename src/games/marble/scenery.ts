/**
 * Where the scenery goes. Each course is a strip of track floating over its painted backdrop. Scenery sits on small
 * islands of land in the empty space beside the track (never on it, never touching it), plus a few seagulls in the air.
 * Everything here is worked out from the course data with a seeded hash, so it is the same every time. No Math.random.
 * This file only says WHERE things go; props.ts says what each one looks like.
 */
import { LEVEL } from '../../../shared/marble/config';
import type { Course } from '../../../shared/marble/course';

export type PropKind =
  // Boulder Beach
  | 'boulder' | 'driftwood' | 'dune-grass' | 'gull'
  // Crown Range
  | 'tussock' | 'road-sign' | 'schist-rock'
  // Geyser Valley
  | 'hot-pool' | 'silica-terrace' | 'mud-pot' | 'steam-vent'
  // Glacier Run, Gap and Ice
  | 'ice-block' | 'fern' | 'rimu' | 'snowy-pine' | 'snow-rock'
  // Windy Welly
  | 'container' | 'crane' | 'cable-car' | 'harbour-buoy'
  // Alpine Crossing
  | 'volcanic-rock' | 'emerald-lake'
  // Wide Hill
  | 'round-tree' | 'hay-bale' | 'sheep' | 'flowers';

export interface Island {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Top height in world units. */
  top: number;
}

export interface Prop {
  kind: PropKind;
  /** World x and z (= grid y) of the base centre. */
  x: number;
  y: number;
  /** Base height (world units). */
  z: number;
  rot: number;
  scale: number;
  /** 0..1. Simple quality shows only priority < 0.45. */
  priority: number;
  /** A colour variant, 0..3 (containers, flowers). */
  variant: number;
}

export interface SceneryPlan {
  islands: Island[];
  props: Prop[];
}

/** One everyday prop in a course's kit. `t` limits it to part of the course height (0 = lowest floor, 1 = highest). */
interface KitEntry {
  kind: PropKind;
  weight: number;
  scale: [number, number];
  /** Rough size on the ground in tiles, so props don't pile up on each other. */
  foot: number;
  t?: [number, number];
}

/** A special feature placed on purpose: where along the route, how many, and how big an island it needs. */
interface Landmark {
  kind: PropKind;
  /** 0..1 along the route, or the start or the finish. */
  at: number | 'start' | 'finish';
  count: number;
  scale: [number, number];
  foot: number;
  minW: number;
  minH: number;
}

interface CourseKit {
  kit: KitEntry[];
  landmarks: Landmark[];
  gulls: number;
}

const k = (kind: PropKind, weight: number, lo: number, hi: number, foot: number, t?: [number, number]): KitEntry => ({ kind, weight, scale: [lo, hi], foot, t });
const lm = (kind: PropKind, at: Landmark['at'], count: number, lo: number, hi: number, foot: number, minW = 2, minH = 2): Landmark => ({ kind, at, count, scale: [lo, hi], foot, minW, minH });

const KITS: Record<string, CourseKit> = {
  'boulder-beach': {
    kit: [k('boulder', 3, 0.7, 1.1, 0.5), k('driftwood', 3, 0.8, 1.2, 0.6), k('dune-grass', 4, 0.8, 1.2, 0.35)],
    landmarks: [lm('boulder', 'start', 4, 1.5, 2.1, 0.9, 3, 2), lm('boulder', 0.55, 3, 1.4, 1.9, 0.9, 3, 2)],
    gulls: 7,
  },
  'crown-range': {
    kit: [k('tussock', 5, 0.8, 1.3, 0.4), k('schist-rock', 3, 0.8, 1.3, 0.5), k('road-sign', 0.5, 0.9, 1.1, 0.3)],
    landmarks: [lm('road-sign', 0.2, 1, 1.2, 1.2, 0.4, 1, 1), lm('road-sign', 0.5, 1, 1.2, 1.2, 0.4, 1, 1), lm('road-sign', 0.8, 1, 1.2, 1.2, 0.4, 1, 1)],
    gulls: 0,
  },
  'geyser-valley': {
    kit: [k('hot-pool', 3, 0.8, 1.1, 0.9), k('silica-terrace', 1.5, 0.9, 1.2, 1), k('mud-pot', 2.5, 0.8, 1.1, 0.7), k('steam-vent', 3, 0.8, 1.2, 0.5)],
    landmarks: [
      lm('hot-pool', 0.12, 1, 1.2, 1.4, 1.2), lm('hot-pool', 0.4, 1, 1.2, 1.4, 1.2), lm('hot-pool', 0.7, 1, 1.2, 1.4, 1.2),
      lm('silica-terrace', 0.55, 1, 1.4, 1.7, 1.4, 3, 2), lm('mud-pot', 0.3, 1, 1.2, 1.4, 1),
    ],
    gulls: 0,
  },
  'glacier-run': {
    kit: [
      k('ice-block', 4, 0.8, 1.4, 0.6, [0.45, 1]), k('snow-rock', 2.5, 0.8, 1.3, 0.5, [0.35, 1]), k('snowy-pine', 2, 0.9, 1.3, 0.6, [0.3, 0.8]),
      k('fern', 4, 0.9, 1.3, 0.6, [0, 0.6]), k('rimu', 3, 0.9, 1.3, 0.7, [0, 0.55]), k('snow-rock', 1, 0.8, 1.2, 0.5, [0, 0.35]),
    ],
    landmarks: [lm('ice-block', 'start', 4, 1.4, 2, 0.9, 3, 2), lm('ice-block', 0.2, 3, 1.3, 1.8, 0.9, 2, 2), lm('rimu', 0.75, 2, 1.3, 1.6, 0.8, 2, 2), lm('rimu', 'finish', 2, 1.3, 1.7, 0.8, 2, 2), lm('fern', 0.65, 3, 1.1, 1.4, 0.6, 2, 2)],
    gulls: 0,
  },
  'windy-welly': {
    kit: [k('container', 4, 0.9, 1.1, 0.8), k('harbour-buoy', 2, 0.8, 1.1, 0.4), k('crane', 0.4, 0.9, 1.1, 1)],
    landmarks: [lm('cable-car', 0.45, 1, 1.1, 1.2, 1.6, 3, 2), lm('crane', 0.15, 1, 1, 1.2, 1.2, 2, 2), lm('crane', 0.8, 1, 1, 1.2, 1.2, 2, 2), lm('container', 0.6, 3, 1, 1.1, 0.8, 2, 2)],
    gulls: 6,
  },
  'alpine-crossing': {
    kit: [k('volcanic-rock', 6, 0.8, 1.5, 0.6), k('steam-vent', 2.5, 0.8, 1.2, 0.5)],
    landmarks: [lm('emerald-lake', 'finish', 1, 1.2, 1.4, 1.6, 2, 2), lm('emerald-lake', 0.88, 1, 1, 1.2, 1.5, 2, 2), lm('steam-vent', 0.5, 2, 1.1, 1.4, 0.5, 2, 2)],
    gulls: 0,
  },
  'wide-hill': {
    kit: [k('round-tree', 3, 0.9, 1.4, 0.7), k('hay-bale', 2, 0.9, 1.2, 0.5), k('sheep', 3, 0.9, 1.1, 0.45), k('flowers', 3, 0.9, 1.3, 0.4)],
    landmarks: [lm('sheep', 'start', 4, 1, 1.2, 0.5, 3, 2), lm('hay-bale', 0.5, 3, 1.1, 1.3, 0.6, 2, 2), lm('round-tree', 'finish', 2, 1.5, 1.9, 0.9, 2, 2)],
    gulls: 0,
  },
  'gap-and-ice': {
    kit: [k('ice-block', 4, 0.8, 1.4, 0.6), k('snow-rock', 3, 0.8, 1.3, 0.5), k('snowy-pine', 3, 0.9, 1.3, 0.6)],
    landmarks: [lm('snowy-pine', 'start', 3, 1.3, 1.7, 0.7, 3, 2), lm('ice-block', 0.5, 4, 1.4, 2, 0.9, 3, 2), lm('ice-block', 'finish', 3, 1.3, 1.8, 0.9, 2, 2)],
    gulls: 0,
  },
};

/** The landmark kinds each course must have (the tests check these). */
export function landmarkKinds(courseId: string): PropKind[] {
  const kit = KITS[courseId];
  return kit ? [...new Set(kit.landmarks.map((l) => l.kind))] : [];
}

/** Island sizes to try, biggest first (w x h in tiles). */
const SIZES: Array<[number, number]> = [[3, 2], [2, 3], [2, 2], [3, 1], [1, 3], [2, 1], [1, 2], [1, 1]];
const PAD = 7;
const MAX_NEAR = 6;
const MIN_PROPS_CAP = 200;

// Seeded random numbers: a string is hashed to a seed, then mulberry32 gives a repeatable stream.
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function makeRng(seed: string): () => number {
  let a = hashString(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (rng: () => number, lo: number, hi: number) => lo + (hi - lo) * rng();

/** A map of the area around the course: how far each cell is from the track and what level the nearest track tile is. */
interface Field {
  w: number;
  h: number;
  dist: Int16Array;
  level: Int16Array;
  idx: (x: number, y: number) => number;
  inside: (x: number, y: number) => boolean;
}

function buildField(course: Course): Field {
  const w = course.width + PAD * 2;
  const h = course.height + PAD * 2;
  const dist = new Int16Array(w * h).fill(-1);
  const level = new Int16Array(w * h);
  const idx = (x: number, y: number) => (y + PAD) * w + (x + PAD);
  const inside = (x: number, y: number) => x >= -PAD && y >= -PAD && x < course.width + PAD && y < course.height + PAD;
  let frontier: number[] = [];
  for (let y = 0; y < course.height; y++) {
    for (let x = 0; x < course.width; x++) {
      const t = course.tiles[y * course.width + x];
      if (t.ch === '.') continue;
      dist[idx(x, y)] = 0;
      level[idx(x, y)] = t.level;
      frontier.push(x, y);
    }
  }
  // Spread outwards one ring at a time (8 neighbours, so it is Chebyshev distance).
  for (let d = 1; d <= PAD && frontier.length; d++) {
    const next: number[] = [];
    for (let i = 0; i < frontier.length; i += 2) {
      const fx = frontier[i];
      const fy = frontier[i + 1];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = fx + dx;
          const ny = fy + dy;
          if (!inside(nx, ny) || dist[idx(nx, ny)] >= 0) continue;
          dist[idx(nx, ny)] = d;
          level[idx(nx, ny)] = level[idx(fx, fy)];
          next.push(nx, ny);
        }
      }
    }
    frontier = next;
  }
  return { w, h, dist, level, idx, inside };
}

/** A route point list turned into a place a fraction of the way along it. */
function pointAlong(course: Course, at: Landmark['at']): [number, number] {
  if (at === 'start') return [course.start.x, course.start.y];
  const route = course.def.route;
  if (at === 'finish' || route.length < 2) {
    const last = route[route.length - 1];
    return last ? [last[0], last[1]] : [course.start.x, course.start.y];
  }
  let total = 0;
  for (let i = 1; i < route.length; i++) total += Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]);
  let want = total * at;
  for (let i = 1; i < route.length; i++) {
    const seg = Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]);
    if (want <= seg || i === route.length - 1) {
      const f = seg > 0 ? Math.min(1, want / seg) : 0;
      return [route[i - 1][0] + (route[i][0] - route[i - 1][0]) * f, route[i - 1][1] + (route[i][1] - route[i - 1][1]) * f];
    }
    want -= seg;
  }
  return [route[0][0], route[0][1]];
}

export function planScenery(course: Course): SceneryPlan {
  const id = course.def.id;
  const kit = KITS[id];
  if (!kit) return { islands: [], props: [] };
  const field = buildField(course);
  const { idx, inside, dist, level } = field;

  // Island tiles already taken, plus a one-tile ring around each, so two islands never touch.
  const blocked = new Set<number>();
  const islands: Island[] = [];
  const landmarkAt: Array<{ island: Island; lm: Landmark }> = [];

  const tileOk = (x: number, y: number) => inside(x, y) && dist[idx(x, y)] >= 2 && dist[idx(x, y)] <= MAX_NEAR && !blocked.has(idx(x, y));
  const rectOk = (x: number, y: number, w: number, h: number) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!tileOk(x + i, y + j)) return false;
    return true;
  };
  const addIsland = (x: number, y: number, w: number, h: number): Island => {
    const cx = Math.min(Math.max(Math.floor(x + w / 2), -PAD), course.width + PAD - 1);
    const cy = Math.min(Math.max(Math.floor(y + h / 2), -PAD), course.height + PAD - 1);
    const lv = level[idx(cx, cy)];
    const island: Island = { x, y, w, h, top: Math.max(-1.5, lv * LEVEL - 0.6) };
    islands.push(island);
    for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) if (inside(x + i, y + j)) blocked.add(idx(x + i, y + j));
    return island;
  };

  // 1. Islands for the landmarks: the nearest free spot to where each should be.
  kit.landmarks.forEach((spec, n) => {
    const [tx, ty] = pointAlong(course, spec.at);
    const rng = makeRng(`${id}:landmark:${n}`);
    const shapes: Array<[number, number]> = [[spec.minW, spec.minH], [spec.minH, spec.minW]];
    let best: { x: number; y: number; w: number; h: number; d: number } | null = null;
    for (let y = -PAD; y < course.height + PAD; y++) {
      for (let x = -PAD; x < course.width + PAD; x++) {
        for (const [w, h] of shapes) {
          if (!rectOk(x, y, w, h)) continue;
          const d = Math.hypot(x + w / 2 - tx, y + h / 2 - ty) + rng() * 0.3;
          if (!best || d < best.d) best = { x, y, w, h, d };
        }
      }
    }
    if (best) landmarkAt.push({ island: addIsland(best.x, best.y, best.w, best.h), lm: spec });
  });

  // 2. Fill in the rest, spread evenly: pick the best of a few random spots each time (the one farthest from other islands).
  let edge = 0;
  for (let y = 0; y < course.height; y++) {
    for (let x = 0; x < course.width; x++) {
      if (course.tiles[y * course.width + x].ch === '.') continue;
      let touchesVoid = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= course.width || ny >= course.height || course.tiles[ny * course.width + nx].ch === '.') touchesVoid = true;
      }
      if (touchesVoid) edge++;
    }
  }
  const target = Math.max(14, Math.round(edge / 5));
  const pool: number[] = [];
  for (let y = -PAD; y < course.height + PAD; y++) {
    for (let x = -PAD; x < course.width + PAD; x++) {
      if (dist[idx(x, y)] >= 2 && dist[idx(x, y)] <= MAX_NEAR) pool.push(x, y);
    }
  }
  const fillRng = makeRng(`${id}:islands`);
  let misses = 0;
  while (islands.length < target && pool.length && misses < 160) {
    let best: { x: number; y: number; w: number; h: number; score: number } | null = null;
    for (let s = 0; s < 14; s++) {
      const p = Math.floor(fillRng() * (pool.length / 2)) * 2;
      const px = pool[p];
      const py = pool[p + 1];
      if (blocked.has(idx(px, py))) continue;
      // Mostly try the bigger shapes first.
      const first = Math.floor(fillRng() * fillRng() * 5);
      for (let si = first; si < SIZES.length; si++) {
        const [w, h] = SIZES[si];
        if (!rectOk(px, py, w, h)) continue;
        let near = 99;
        for (const o of islands) near = Math.min(near, Math.hypot(o.x + o.w / 2 - (px + w / 2), o.y + o.h / 2 - (py + h / 2)));
        const score = near - dist[idx(px, py)] * 0.4;
        if (near >= 2.5 && (!best || score > best.score)) best = { x: px, y: py, w, h, score };
        break;
      }
    }
    if (best) {
      addIsland(best.x, best.y, best.w, best.h);
      misses = 0;
    } else misses++;
  }

  // 3. Props.
  const props: Prop[] = [];
  let lo = Infinity;
  let hi = -Infinity;
  for (const t of course.tiles) {
    if (t.ch === '.') continue;
    lo = Math.min(lo, t.level);
    hi = Math.max(hi, t.level);
  }
  const norm = (lv: number) => (hi > lo ? (lv - lo) / (hi - lo) : 0.5);
  const landmarkOf = new Map<Island, Landmark>(landmarkAt.map((l) => [l.island, l.lm]));

  islands.forEach((island, n) => {
    const rng = makeRng(`${id}:props:${n}`);
    const placed: Array<{ x: number; y: number; r: number }> = [];
    const put = (kind: PropKind, x: number, y: number, scale: number, foot: number, priority: number) => {
      placed.push({ x, y, r: foot * scale });
      props.push({ kind, x, y, z: island.top, rot: rng() * Math.PI * 2, scale, priority, variant: Math.floor(rng() * 4) });
    };
    const spot = (r: number): [number, number] | null => {
      for (let tries = 0; tries < 10; tries++) {
        const m = Math.min(0.22, island.w / 2, island.h / 2);
        const x = between(rng, island.x + m, island.x + island.w - m);
        const y = between(rng, island.y + m, island.y + island.h - m);
        if (placed.every((p) => Math.hypot(p.x - x, p.y - y) >= (p.r + r) * 0.7)) return [x, y];
      }
      return null;
    };

    // The landmark first: a single one sits in the middle, a group is spread over the island.
    const mark = landmarkOf.get(island);
    if (mark) {
      for (let c = 0; c < mark.count; c++) {
        const scale = between(rng, mark.scale[0], mark.scale[1]);
        if (mark.count === 1) put(mark.kind, island.x + island.w / 2, island.y + island.h / 2, scale, mark.foot, 0);
        else {
          const at = spot(mark.foot * scale * 0.45);
          if (at) put(mark.kind, at[0], at[1], scale, mark.foot * 0.45, 0.05 + c * 0.1);
        }
      }
    }

    // Then everyday props from the course kit, 1 to 3 for each island tile (the height of the nearest track picks the kind on Glacier Run).
    const cx = Math.min(Math.max(Math.floor(island.x + island.w / 2), -PAD), course.width + PAD - 1);
    const cy = Math.min(Math.max(Math.floor(island.y + island.h / 2), -PAD), course.height + PAD - 1);
    const t = norm(level[idx(cx, cy)]);
    const usable = kit.kit.filter((e) => !e.t || (t >= e.t[0] && t <= e.t[1]));
    const total = usable.reduce((a, e) => a + e.weight, 0);
    const tiles = island.w * island.h;
    for (let i = 0; i < tiles; i++) {
      const want = 1 + Math.floor(rng() * 2.6) - (mark ? 1 : 0);
      for (let c = 0; c < want && total > 0; c++) {
        let pick = rng() * total;
        let entry = usable[0];
        for (const e of usable) {
          pick -= e.weight;
          if (pick <= 0) { entry = e; break; }
        }
        const scale = between(rng, entry.scale[0], entry.scale[1]);
        const at = spot(entry.foot * scale);
        if (at) put(entry.kind, at[0], at[1], scale, entry.foot, 0.1 + rng() * 0.85);
      }
    }
  });

  // Too many? Drop the least important first (the highest priority number).
  if (props.length > MIN_PROPS_CAP) {
    props.sort((a, b) => a.priority - b.priority);
    props.length = MIN_PROPS_CAP;
  }

  // 4. Gulls: in the air beside the track, no island needed.
  const gullRng = makeRng(`${id}:gulls`);
  const air: number[] = [];
  for (let y = -PAD; y < course.height + PAD; y++) {
    for (let x = -PAD; x < course.width + PAD; x++) {
      if (dist[idx(x, y)] >= 1 && dist[idx(x, y)] <= 5) air.push(x, y);
    }
  }
  for (let g = 0; g < kit.gulls && air.length; g++) {
    const p = Math.floor(gullRng() * (air.length / 2)) * 2;
    const x = air[p] + gullRng();
    const y = air[p + 1] + gullRng();
    const lv = level[idx(air[p], air[p + 1])];
    props.push({
      kind: 'gull', x, y, z: lv * LEVEL + between(gullRng, 1.5, 2.5), rot: gullRng() * Math.PI * 2,
      scale: between(gullRng, 0.9, 1.2), priority: 0.2 + gullRng() * 0.5, variant: 0,
    });
  }

  return { islands, props };
}
