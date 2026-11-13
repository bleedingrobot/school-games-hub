/**
 * Where the glowing things in a mine go (docs/plans/mine-flight/PLAN.md, M4): crystal clusters on room floors and walls,
 * and glow-worms on ceilings. Picture only: nothing here changes the rules, and it uses a fixed hash so the same mine
 * always looks the same. No three.js in here, so it can be tested.
 *
 * Spots are in the screen's own directions: the rules' (x, y, z) is drawn at (x, z, −y).
 */
import type { Level } from '../../../shared/mine/level';

export interface DecorSpot {
  /** Where, in the screen's directions. */
  x: number;
  y: number;
  z: number;
  /** Which way is "out of the rock" (the open side), as a unit step in the screen's directions. */
  nx: number;
  ny: number;
  nz: number;
  /** 0 to 1, for size and tilt. */
  r: number;
}

export interface MineDecor {
  crystals: DecorSpot[];
  worms: DecorSpot[];
}

function hash(x: number, y: number, z: number, f: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + f * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** How thick the glow-worms are on the ceilings: most mines a few, the glow-worm caves a starry sky. */
export function decorFor(level: Level, wormShare: number, crystalsPerRoom = 7): MineDecor {
  const { nx, ny, nz, solid } = level;
  const isSolid = (x: number, y: number, z: number) => x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz || solid[x + nx * (y + ny * z)] === 1;
  const crystals: DecorSpot[] = [];
  for (const room of level.rooms) {
    if (room.index === level.start) continue;
    let placed = 0;
    // Try spots round the room's floor edge and walls; keep the ones that sit against rock.
    for (let t = 0; t < 60 && placed < crystalsPerRoom; t++) {
      const a = hash(room.cx, room.cy, room.cz, t * 3);
      const b = hash(room.cx, room.cy, room.cz, t * 3 + 1);
      const c = hash(room.cx, room.cy, room.cz, t * 3 + 2);
      const x = room.cx - room.hx + Math.floor(a * (room.hx * 2 + 1));
      const y = room.cy - room.hy + Math.floor(b * (room.hy * 2 + 1));
      // Mostly on the floor, sometimes part way up a wall.
      const z = room.cz - room.hz + (c < 0.65 ? 0 : Math.floor(c * room.hz));
      if (isSolid(x, y, z)) continue;
      const below = isSolid(x, y, z - 1);
      const sides: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]];
      const wall = sides.find(([dx, dy]) => isSolid(x + dx, y + dy, z));
      if (!below && !wall) continue;
      // Keep the middle of the room clear for flying: only spots near the floor's edge or on a wall.
      const edge = Math.abs(x - room.cx) >= room.hx - 1 || Math.abs(y - room.cy) >= room.hy - 1;
      if (below && !edge && !wall) continue;
      const [ox, oy, oz] = wall && (!below || c > 0.8) ? [-wall[0], -wall[1], 0] : [0, 0, 1];
      // Sit on the rock face: the cell's middle, pushed back to the face it grows from.
      const px = x + 0.5 - ox * 0.45, py = y + 0.5 - oy * 0.45, pz = z + 0.5 - oz * 0.45;
      crystals.push({ x: px, y: pz, z: -py, nx: ox, ny: oz, nz: -oy, r: hash(x, y, z, 9) });
      placed++;
    }
  }
  const worms: DecorSpot[] = [];
  if (wormShare > 0) {
    for (let z = 1; z < nz; z++)
      for (let y = 0; y < ny; y++)
        for (let x = 0; x < nx; x++) {
          if (isSolid(x, y, z) || !isSolid(x, y, z + 1)) continue;
          // A few glow-worms per ceiling block, at made-up spots on it.
          for (let k = 0; k < 2; k++) {
            if (hash(x, y, z, 20 + k) >= wormShare) continue;
            const u = hash(x, y, z, 30 + k), v = hash(x, y, z, 40 + k);
            worms.push({ x: x + u, y: z + 0.98, z: -(y + v), nx: 0, ny: -1, nz: 0, r: hash(x, y, z, 50 + k) });
          }
        }
  }
  return { crystals, worms };
}
