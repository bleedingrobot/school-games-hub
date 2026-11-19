/**
 * Where the boxes go in the hold view (docs/plans/trader-hold/PLAN.md, H.0 and H.1): for each ship's top-down painting
 * (art/paint/top/<ship>.webp), where its open cargo deck is and how it splits into one box per hold; and the same for a
 * cargo pod. All numbers are pixels on the tidied painting, so the view is one SVG in the painting's own units.
 */
import { MAX_PODS, POD_HOLDS, SHIPS } from '../../../shared/trader/config';

type Rect = readonly [x0: number, y0: number, x1: number, y1: number];

export interface ShipHold {
  /** The painting's size. */
  w: number;
  h: number;
  /** The open cargo deck, where the boxes go. */
  deck: Rect;
  cols: number;
  rows: number;
  /** The top and bottom edge of the hull where the pods clamp on. */
  hull: readonly [top: number, bottom: number];
  /** Where a pod's left edge sits, and how big a pod is drawn on this ship. */
  podX: number;
  podScale: number;
}

/** In the same order as SHIPS. */
export const SHIP_HOLDS: readonly ShipHold[] = [
  /* Flea      */ { w: 1200, h: 501, deck: [505, 105, 775, 380], cols: 4, rows: 3, hull: [25, 475], podX: 420, podScale: 0.55 },
  /* Gnat      */ { w: 1200, h: 392, deck: [440, 118, 692, 262], cols: 5, rows: 3, hull: [58, 332], podX: 430, podScale: 0.55 },
  /* Firefly   */ { w: 1200, h: 410, deck: [282, 122, 628, 288], cols: 7, rows: 3, hull: [75, 345], podX: 540, podScale: 0.55 },
  /* Bumblebee */ { w: 1200, h: 670, deck: [380, 200, 785, 445], cols: 7, rows: 4, hull: [105, 565], podX: 700, podScale: 0.55 },
  /* Beetle    */ { w: 1200, h: 485, deck: [335, 90, 815, 325], cols: 10, rows: 5, hull: [18, 445], podX: 430, podScale: 0.6 },
  /* Termite   */ { w: 1200, h: 302, deck: [445, 82, 805, 218], cols: 12, rows: 5, hull: [30, 272], podX: 430, podScale: 0.55 },
];

/** The pod painting: its size, its open bay, and the top and bottom of its body (where the clamps meet it). */
export const POD = { w: 700, h: 184, bay: [75, 45, 560, 140] as Rect, body: [20, 170] as const };

/** Gap between a pod and the hull, bridged by clamps. */
const CLAMP_GAP = 22;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PodPlace {
  x: number;
  y: number;
  scale: number;
}

/** Where each pod is drawn: the first above the ship, the second below. */
export function podPlaces(ship: number, pods: number): PodPlace[] {
  const s = SHIP_HOLDS[ship];
  const k = s.podScale;
  const places: PodPlace[] = [];
  if (pods >= 1) places.push({ x: s.podX, y: s.hull[0] - CLAMP_GAP - POD.body[1] * k, scale: k });
  if (pods >= 2) places.push({ x: s.podX, y: s.hull[1] + CLAMP_GAP - POD.body[0] * k, scale: k });
  return places.slice(0, MAX_PODS);
}

function grid(r: Rect, cols: number, rows: number, count: number, columnFirst: boolean): Box[] {
  const cw = (r[2] - r[0]) / cols;
  const ch = (r[3] - r[1]) / rows;
  const pad = Math.min(cw, ch) * 0.07;
  const out: Box[] = [];
  for (let i = 0; i < count; i++) {
    const c = columnFirst ? Math.floor(i / rows) : i % cols;
    const row = columnFirst ? i % rows : Math.floor(i / cols);
    out.push({ x: r[0] + c * cw + pad, y: r[1] + row * ch + pad, w: cw - 2 * pad, h: ch - 2 * pad });
  }
  return out;
}

/** Every hold's box, in the order they fill: the ship's deck (a column at a time, so a good's boxes clump), then each pod. */
export function holdBoxes(ship: number, pods: number): Box[] {
  const s = SHIP_HOLDS[ship];
  const boxes = grid(s.deck, s.cols, s.rows, SHIPS[ship].holds, true);
  for (const p of podPlaces(ship, pods)) {
    const bay: Rect = [p.x + POD.bay[0] * p.scale, p.y + POD.bay[1] * p.scale, p.x + POD.bay[2] * p.scale, p.y + POD.bay[3] * p.scale];
    boxes.push(...grid(bay, POD_HOLDS, 1, POD_HOLDS, false));
  }
  return boxes;
}

/** The SVG viewBox that fits the ship and its pods. */
export function holdViewBox(ship: number, pods: number): [number, number, number, number] {
  const s = SHIP_HOLDS[ship];
  let top = 0;
  let bottom = s.h;
  for (const p of podPlaces(ship, pods)) {
    top = Math.min(top, p.y + POD.body[0] * p.scale - 4);
    bottom = Math.max(bottom, p.y + POD.body[1] * p.scale + 4);
  }
  return [0, top, s.w, bottom - top];
}

export type BoxKind = 'held' | 'selling' | 'buying';
export interface Filled {
  good: number;
  kind: BoxKind;
  /** This good's nth box (with `good`, a key that stays put as the hold changes, so only new boxes drop in). */
  n: number;
}

/**
 * What each box shows, in fill order, goods in GOODS order. With a planned trade: boxes about to be sold fade, and
 * boxes about to be bought show faintly. If both can't fit at once (selling to make room), only what you'll have after
 * the trade is shown.
 */
export function fillHold(cargo: readonly number[], capacity: number, after?: readonly number[]): Filled[] {
  const next = after ?? cargo;
  const kinds = cargo.map((now, good) => ({ kept: Math.min(now, next[good]), selling: Math.max(now - next[good], 0), buying: Math.max(next[good] - now, 0) }));
  const showSelling = kinds.reduce((a, k) => a + k.kept + k.selling + k.buying, 0) <= capacity;
  const out: Filled[] = [];
  kinds.forEach((k, good) => {
    let n = 0;
    for (let i = 0; i < k.kept; i++) out.push({ good, kind: 'held', n: n++ });
    if (showSelling) for (let i = 0; i < k.selling; i++) out.push({ good, kind: 'selling', n: n++ });
    for (let i = 0; i < k.buying; i++) out.push({ good, kind: 'buying', n: n++ });
  });
  return out.slice(0, capacity);
}
