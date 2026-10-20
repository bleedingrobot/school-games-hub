/**
 * Number gates: a question door drawn with answer panels in front of it. The pilot flies into the panel with the answer
 * they want; that answer is sent to the server like any other, so the rules and the replay are exactly those of a
 * question door. This file only works out where the panels go and which one the ship has touched. It draws nothing.
 */
import type { Door, Level } from '../../../shared/mine/level';

/** How far in front of the door the panels float, and how far apart they sit across it. */
export const PANEL_DEPTH = 1.6;
export const PANEL_SPREAD = 1.1;
/** A panel is chosen when the ship's middle is this close to it. */
export const PANEL_TOUCH = 0.95;
/** A panel only counts once the ship has been at least this far from it (so a new panel never fires at once). */
export const PANEL_ARM = 1.7;

export interface Panel {
  x: number;
  y: number;
  z: number;
  /** The number it shows. */
  value: number;
}

export interface GateLayout {
  doorId: number;
  /** Which side of the door the panels float on: the side the ship came from. */
  side: 1 | -1;
  axis: 0 | 1 | 2;
  panels: Panel[];
}

/** The way through the door: 0 for x, 1 for y, 2 for z (the same rule the mine uses to cut the door). */
export function doorAxis(level: Pick<Level, 'rooms'>, door: Pick<Door, 'rooms'>): 0 | 1 | 2 {
  const a = level.rooms[door.rooms[0]];
  const b = level.rooms[door.rooms[1]];
  return a.cx !== b.cx ? 0 : a.cy !== b.cy ? 1 : 2;
}

/** The two directions across the door, in the order panels are laid out. */
function across(axis: 0 | 1 | 2): [0 | 1 | 2, 0 | 1 | 2] {
  return axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1];
}

/** Places one panel per choice (three or four) in a grid in front of the door, on the ship's side of it. */
export function layoutGate(level: Pick<Level, 'rooms'>, door: Door, ship: { px: number; py: number; pz: number }, values: readonly number[], side?: 1 | -1): GateLayout {
  const axis = doorAxis(level, door);
  const centre = [door.x, door.y, door.z];
  const here = [ship.px, ship.py, ship.pz][axis];
  const s: 1 | -1 = side ?? (here >= centre[axis] ? 1 : -1);
  const [u, v] = across(axis);
  // Up, across: the four corners of a square, as many of them as there are choices.
  const slots: [number, number][] = [[-1, 1], [1, 1], [-1, -1], [1, -1]];
  const panels = values.slice(0, 4).map((value, i) => {
    const p = [...centre];
    p[axis] += s * PANEL_DEPTH;
    p[u] += slots[i][0] * PANEL_SPREAD;
    p[v] += slots[i][1] * PANEL_SPREAD;
    return { x: p[0], y: p[1], z: p[2], value };
  });
  return { doorId: door.id, side: s, axis, panels };
}

const dist = (p: Panel, s: { px: number; py: number; pz: number }) => Math.sqrt((p.x - s.px) ** 2 + (p.y - s.py) ** 2 + (p.z - s.pz) ** 2);

/**
 * Looks at where the ship is. Panels the ship is clear of become "armed"; the first armed panel the ship touches is
 * returned (its number in the list) or -1. `armed` is updated in place and kept between calls.
 */
export function panelTouched(panels: readonly Panel[], armed: boolean[], ship: { px: number; py: number; pz: number }): number {
  let hit = -1;
  panels.forEach((p, i) => {
    const d = dist(p, ship);
    if (d > PANEL_ARM) armed[i] = true;
    if (hit < 0 && armed[i] && d < PANEL_TOUCH) hit = i;
  });
  return hit;
}

/** The sum for the banner: its parts in a line. */
export function gateSum(parts: readonly string[]): string {
  return parts.join(' ');
}
