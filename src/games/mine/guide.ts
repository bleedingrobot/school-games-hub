/**
 * The "next goal" arrow: where to go next, and which room to head for to get there.
 *
 * The goal follows the level's order: the next shut door (fetch its key first if it needs one and you don't have it),
 * then the reactor, then, once the reactor is down, the exit. The arrow points at the next room on the way (not straight
 * through the rock), or at the goal itself once you are in its room.
 */
import type { RunState, World } from '../../../shared/mine/engine';
import { KEY_COLOURS, type Level } from '../../../shared/mine/level';

export interface Goal {
  /** Where to head right now, in world units. */
  x: number;
  y: number;
  z: number;
  /** Words for it, e.g. "Blue key". */
  label: string;
  /** The goal itself (not just the next room on the way). */
  final: boolean;
}

const COLOUR_NAME = { blue: 'blue', yellow: 'yellow', red: 'red' } as const;

interface Target {
  rooms: number[];
  x: number;
  y: number;
  z: number;
  label: string;
}

/** What to do next, before working out the way there. */
function targetFor(level: Level, s: RunState): Target {
  for (const door of level.doors) {
    if (s.doorsOpen[door.id] === 1) continue;
    if (door.kind !== 'question') {
      const c = KEY_COLOURS.indexOf(door.kind);
      if (s.keys[c] === 0) {
        const key = level.keys.find((k) => k.colour === door.kind);
        if (key) return { rooms: [key.room], x: key.x, y: key.y, z: key.z, label: `${COLOUR_NAME[door.kind]} key` };
      }
      return { rooms: [...door.rooms], x: door.x, y: door.y, z: door.z, label: `${COLOUR_NAME[door.kind]} door` };
    }
    return { rooms: [...door.rooms], x: door.x, y: door.y, z: door.z, label: 'question door' };
  }
  if (!s.reactorDown) return { rooms: [level.reactorRoom], x: level.reactor.x, y: level.reactor.y, z: level.reactor.z, label: 'reactor' };
  return { rooms: [level.start], x: level.exit.x, y: level.exit.y, z: level.exit.z, label: 'exit' };
}

/** The rooms to go through from one room to a set of rooms, only using doors that are open (or open for a key you hold). Empty if already there. */
export function routeRooms(level: Level, s: RunState, from: number, to: readonly number[]): number[] | null {
  if (to.includes(from)) return [];
  const doorOf = new Map<string, number>();
  for (const d of level.doors) doorOf.set([...d.rooms].sort((a, b) => a - b).join('-'), d.id);
  const passable = (a: number, b: number): boolean => {
    const id = doorOf.get(a < b ? `${a}-${b}` : `${b}-${a}`);
    if (id === undefined) return true;
    const door = level.doors[id];
    if (s.doorsOpen[id] === 1) return true;
    if (door.kind === 'question') return false;
    return s.keys[KEY_COLOURS.indexOf(door.kind)] === 1;
  };
  const before = new Map<number, number>([[from, -1]]);
  const todo = [from];
  for (let q = 0; q < todo.length; q++) {
    const here = todo[q];
    for (const [a, b] of level.edges) {
      const other = a === here ? b : b === here ? a : -1;
      if (other < 0 || before.has(other) || !passable(here, other)) continue;
      before.set(other, here);
      if (to.includes(other)) {
        const path = [other];
        for (let r = here; r !== from; r = before.get(r) as number) path.push(r);
        return path.reverse();
      }
      todo.push(other);
    }
  }
  return null;
}

export function nextGoal(w: World, s: RunState): Goal {
  const level = w.level;
  const target = targetFor(level, s);
  const path = routeRooms(level, s, s.lastRoom, target.rooms);
  if (path === null || path.length === 0) return { x: target.x, y: target.y, z: target.z, label: target.label, final: true };
  const room = level.rooms[path[0]];
  return { x: room.cx + 0.5, y: room.cy + 0.5, z: room.cz + 0.5, label: target.label, final: false };
}
