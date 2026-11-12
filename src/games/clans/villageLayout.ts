import type { VillageBuilding } from '../../../shared/clans/types';

/**
 * Where things sit on the village ground (docs/CLANS-VILLAGE-SCENE-PLAN.md). The ground is drawn in a 1000 x 620 box seen
 * from above at an angle; plots are the foot of each building in those units, so they line up at every screen size.
 * The Walls have no plot: they run round the edge, with their gate at the front corner.
 */
export const GROUND = { w: 1000, h: 620, cx: 500, cy: 320, rx: 460, ry: 262 } as const;

export type Plot = { x: number; y: number };
export const PLOTS: Record<Exclude<VillageBuilding, 'walls'>, Plot> = {
  trainingHall: { x: 500, y: 175 },
  smithy: { x: 300, y: 265 },
  church: { x: 700, y: 265 },
  barracks: { x: 205, y: 385 },
  tower: { x: 795, y: 385 },
  forge: { x: 395, y: 470 },
  strongroom: { x: 605, y: 470 },
};
export const GATE: Plot = { x: GROUND.cx, y: GROUND.cy + GROUND.ry };

/** A plot as percentages of the ground box (for CSS left/top). */
export const pct = (p: Plot) => ({ left: `${(p.x / GROUND.w) * 100}%`, top: `${(p.y / GROUND.h) * 100}%` });

/** The four corners of the diamond `inset` units inside the edge: back, right, front, left. */
export function diamond(inset = 0): [number, number][] {
  const { cx, cy, rx, ry } = GROUND;
  const k = ry / rx;
  return [[cx, cy - ry + inset * k], [cx + rx - inset, cy], [cx, cy + ry - inset * k], [cx - rx + inset, cy]];
}

/** Points every `step` units along the diamond's edges, starting at the back corner and going round clockwise. */
export function aroundEdge(inset: number, step: number): { x: number; y: number; corner: boolean }[] {
  const c = diamond(inset);
  const out: { x: number; y: number; corner: boolean }[] = [];
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = c[i];
    const [bx, by] = c[(i + 1) % 4];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / step));
    for (let j = 0; j < n; j++) out.push({ x: ax + ((bx - ax) * j) / n, y: ay + ((by - ay) * j) / n, corner: j === 0 });
  }
  return out;
}
