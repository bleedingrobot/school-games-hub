/**
 * The mine's walls as triangles: only the faces of rock that touch open space, in flat colours, grouped in chunks
 * (one per room of the coarse grid) so the screen can skip the ones out of view. No three.js in here, so it can be tested.
 *
 * Positions are already in the screen's own directions: the rules' x is across, y is forward and z is up, and the picture
 * uses x across, y up and z towards the viewer, so (x, y, z) in the mine becomes (x, z, −y).
 */
import { ROOM_SPACING } from '../../../shared/mine/config';
import { roomAt, type Level } from '../../../shared/mine/level';
import type { Palette } from './palette';

export interface WallChunk {
  /** Which chunk (room-grid cell). */
  i: number;
  j: number;
  k: number;
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  /** Quads (two triangles each). */
  faces: number;
  /** Where the chunk's middle is, in the screen's directions. */
  centre: [number, number, number];
}

/** A small repeatable shake of a number, from 0 up to 1. */
function hash(x: number, y: number, z: number, f: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + f * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** How bright a face looks by the way it faces: floors are lightest, ceilings darkest. */
const SHADE: Record<string, number> = { zp: 1, zn: 0.5, xp: 0.82, xn: 0.82, yp: 0.66, yn: 0.66 };

export function buildWalls(level: Level, palette: Palette): WallChunk[] {
  const S = ROOM_SPACING;
  const { nx, ny, nz } = level;
  const [rx, ry, rz] = level.recipe.dims;
  const isSolid = (x: number, y: number, z: number) => x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz || level.solid[x + nx * (y + ny * z)] === 1;
  const out: WallChunk[] = [];
  for (let k = 0; k < rz; k++)
    for (let j = 0; j < ry; j++)
      for (let i = 0; i < rx; i++) {
        const pos: number[] = [];
        const nor: number[] = [];
        const col: number[] = [];
        let faces = 0;
        for (let z = k * S; z < (k + 1) * S; z++)
          for (let y = j * S; y < (j + 1) * S; y++)
            for (let x = i * S; x < (i + 1) * S; x++) {
              if (isSolid(x, y, z)) continue;
              const inRoom = roomAt(level, x + 0.5, y + 0.5, z + 0.5) >= 0;
              const base = inRoom ? palette.room : palette.tunnel;
              for (let axis = 0; axis < 3; axis++)
                for (const sign of [1, -1]) {
                  const nxx = x + (axis === 0 ? sign : 0);
                  const nyy = y + (axis === 1 ? sign : 0);
                  const nzz = z + (axis === 2 ? sign : 0);
                  if (!isSolid(nxx, nyy, nzz)) continue;
                  const cell = [x, y, z];
                  const plane = cell[axis] + (sign > 0 ? 1 : 0);
                  const u = (axis + 1) % 3;
                  const v = (axis + 2) % 3;
                  const corner = (du: number, dv: number): [number, number, number] => {
                    const p: [number, number, number] = [0, 0, 0];
                    p[axis] = plane;
                    p[u] = cell[u] + du;
                    p[v] = cell[v] + dv;
                    // To the screen's directions.
                    return [p[0], p[2], -p[1]];
                  };
                  const a = corner(0, 0);
                  let b = corner(1, 0);
                  const c = corner(1, 1);
                  let d = corner(0, 1);
                  // The face looks back into the open cell: its normal is minus the way we looked to find the rock.
                  const n = [0, 0, 0];
                  n[axis] = -sign;
                  const nScreen: [number, number, number] = [n[0], n[2], -n[1]];
                  const cx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
                  const cy = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
                  const cz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
                  if (cx * nScreen[0] + cy * nScreen[1] + cz * nScreen[2] < 0) [b, d] = [d, b];
                  const name = `${'xyz'[axis]}${-sign > 0 ? 'p' : 'n'}`;
                  const shade = SHADE[name] * (0.92 + 0.16 * hash(x, y, z, axis * 2 + (sign > 0 ? 1 : 0)));
                  const r = Math.min(1, base[0] * shade);
                  const g = Math.min(1, base[1] * shade);
                  const bl = Math.min(1, base[2] * shade);
                  for (const p of [a, b, c, a, c, d]) {
                    pos.push(p[0], p[1], p[2]);
                    nor.push(nScreen[0], nScreen[1], nScreen[2]);
                    col.push(r, g, bl);
                  }
                  faces++;
                }
            }
        out.push({
          i, j, k, faces,
          positions: new Float32Array(pos), normals: new Float32Array(nor), colors: new Float32Array(col),
          centre: [(i + 0.5) * S, (k + 0.5) * S, -((j + 0.5) * S)],
        });
      }
  return out.filter((c) => c.faces > 0);
}
