/**
 * The map: the rooms visited so far, drawn as a simple see-through diagram (docs/MINE-PLAN.md, section 5).
 * Pure functions only; MineMap.tsx draws what they work out.
 */
import { ROOM_SPACING } from '../../../shared/mine/config';
import type { RunState, World } from '../../../shared/mine/engine';

export interface MapRoom {
  index: number;
  /** Centre on the map, in map units (a room is about 1 across). */
  x: number;
  y: number;
  floor: number;
  /** Half the width and depth drawn. */
  hx: number;
  hy: number;
  here: boolean;
  start: boolean;
  reactor: boolean;
  /** The colour of the door on the way, if there is a door at one of this room's tunnels. */
  doors: string[];
}

export interface MapLink {
  from: number;
  to: number;
  /** Both ends have been visited and you have gone along it. */
  walked: boolean;
}

export interface MapPicture {
  rooms: MapRoom[];
  /** Rooms next to ones you have visited, that you have not been in yet: drawn as a faint "?" so you know there is more. */
  unseen: { index: number; x: number; y: number }[];
  links: MapLink[];
  /** The ship, in map units, and the way it points on the map (radians, 0 = up the page). */
  ship: { x: number; y: number; angle: number };
  width: number;
  height: number;
  floors: number;
}

/**
 * Lays out the rooms. `floor` = null draws every floor stacked into one slanted view, so the whole mine shows at once;
 * a floor number draws just that floor from above (easier to read on a small screen).
 */
export function mapPicture(w: World, s: RunState, visited: ReadonlySet<number>, floor: number | null): MapPicture {
  const L = w.level;
  const [dx, dy, dz] = L.recipe.dims;
  const S = ROOM_SPACING;
  // Slanted view: each floor up moves the picture up and a little right, like looking at a stack of boards.
  const lift = floor === null ? 0.75 : 0;
  const slant = floor === null ? 0.25 : 0;
  const place = (px: number, py: number, k: number) => ({
    x: px / S + k * slant,
    y: dy - py / S + (dz - 1 - k) * lift,
  });
  const doorColour = (a: number, b: number): string | null => {
    const d = L.doors.find((door) => (door.rooms[0] === a && door.rooms[1] === b) || (door.rooms[0] === b && door.rooms[1] === a));
    return d ? d.kind : null;
  };
  // A room is shown once you have been in it, or when it is right next to one you have visited (as a faint "?").
  const rooms: MapRoom[] = [];
  const shown = new Set<number>();
  for (const r of L.rooms) {
    if (floor !== null && r.k !== floor) continue;
    if (!visited.has(r.index)) continue;
    shown.add(r.index);
    const p = place(r.cx + 0.5, r.cy + 0.5, r.k);
    const doors: string[] = [];
    for (const [a, b] of L.edges) if (a === r.index || b === r.index) {
      const c = doorColour(a, b);
      if (c) doors.push(c);
    }
    rooms.push({ index: r.index, x: p.x, y: p.y, floor: r.k, hx: (r.hx + 0.5) / S, hy: (r.hy + 0.5) / S, here: s.lastRoom === r.index, start: r.index === L.start, reactor: r.index === L.reactorRoom, doors });
  }
  const links: MapLink[] = [];
  const unseen: { index: number; x: number; y: number }[] = [];
  for (const [a, b] of L.edges) {
    if (!visited.has(a) && !visited.has(b)) continue;
    const ra = L.rooms[a];
    const rb = L.rooms[b];
    if (floor !== null && (ra.k !== floor || rb.k !== floor)) continue;
    links.push({ from: a, to: b, walked: visited.has(a) && visited.has(b) });
    const far = visited.has(a) ? b : visited.has(b) ? a : -1;
    if (far >= 0 && !visited.has(far) && !unseen.some((u) => u.index === far)) {
      const r = L.rooms[far];
      const p = place(r.cx + 0.5, r.cy + 0.5, r.k);
      unseen.push({ index: far, x: p.x, y: p.y });
    }
  }
  // The slanted view lifts each floor; put the ship at its own height inside the floor.
  const shipPlace = place(s.px, s.py, s.pz / S - 0.5);
  // Facing: map "up the page" is +y in the mine. In the slanted view the angle is the same.
  const angle = Math.atan2(s.fx, s.fy);
  return {
    rooms,
    unseen,
    links,
    ship: { x: shipPlace.x, y: shipPlace.y, angle },
    width: dx + (dz - 1) * slant,
    height: dy + (dz - 1) * lift,
    floors: dz,
  };
}

/** Which floor (0 is the lowest) the ship is on. */
export function floorOf(w: World, s: RunState): number {
  return Math.min(w.level.recipe.dims[2] - 1, Math.max(0, Math.floor(s.pz / ROOM_SPACING)));
}
