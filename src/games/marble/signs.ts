/**
 * The signs over the tunnels of an answer gate (docs/MARBLE-PLAN.md, section 7.1): with maths, each tunnel shows an
 * answer; without, only the open tunnel shows an arrow. Pure data; the renderer draws them.
 */
import type { Course } from '../../../shared/marble/course';
import type { RunSetup } from '../../../shared/marble/maths';

export interface GateSign {
  /** Where it hangs, in tile coordinates. */
  x: number;
  y: number;
  /** The tile it hangs over (for its height). */
  tx: number;
  ty: number;
  text: string;
  /** An arrow sign is bright; an answer sign is plain. */
  arrow: boolean;
}

/** An arrow pointing the way the tunnel runs, as it looks on the map (north is up the screen's grid, east to the right). */
export function arrowFor(dx: number, dy: number): string {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? '➡' : '⬅';
  return dy >= 0 ? '⬇' : '⬆';
}

/** One number gem: where it lies, and the answer it carries. */
export interface GemSprite {
  /** Its number in `course.gemList` (the engine's `gemsTaken` lists these). */
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  text: string;
}

/** The gems of a run, with what each carries (none with maths off). */
export function gemSprites(course: Course, setup: RunSetup): GemSprite[] {
  return course.gemList.flatMap((gem, id) => {
    const text = setup.gems[gem.trail]?.groups[gem.group]?.labels[gem.spot];
    return text === undefined ? [] : [{ id, x: gem.x, y: gem.y, tx: Math.floor(gem.x), ty: Math.floor(gem.y), text }];
  });
}

export function gateSigns(course: Course, setup: RunSetup): GateSign[] {
  const out: GateSign[] = [];
  course.gates.forEach((gate, g) => {
    const info = setup.gates[g];
    gate.tunnels.forEach((tunnel, t) => {
      const [x, y] = tunnel.route[0];
      const [ex, ey] = tunnel.route[2] ?? tunnel.route[tunnel.route.length - 1];
      const label = info?.labels?.[t];
      const arrow = info?.arrow === t;
      if (label === undefined && !arrow) return;
      out.push({ x, y, tx: Math.floor(x), ty: Math.floor(y), text: label ?? arrowFor(ex - x, ey - y), arrow });
    });
  });
  return out;
}
