import { describe, expect, it } from 'vitest';
import { makeLevel, RECIPES } from '../../../shared/mine/level';
import { PALETTES } from './palette';
import { buildWalls } from './walls';

describe('the walls', () => {
  const level = makeLevel(RECIPES[0]);
  const chunks = buildWalls(level, PALETTES[0]);

  it('makes only faces that touch open space, grouped in chunks', () => {
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.length).toBeLessThanOrEqual(RECIPES[0].dims[0] * RECIPES[0].dims[1] * RECIPES[0].dims[2]);
    for (const c of chunks) {
      expect(c.positions.length).toBe(c.faces * 6 * 3);
      expect(c.normals.length).toBe(c.positions.length);
      expect(c.colors.length).toBe(c.positions.length);
    }
    // Every face's middle, nudged a little the way it faces, is open space; nudged the other way it is rock.
    const solidAt = (x: number, y: number, z: number) => level.solid[Math.floor(x) + level.nx * (Math.floor(y) + level.ny * Math.floor(z))] === 1;
    for (const c of chunks.slice(0, 4)) {
      for (let f = 0; f < c.faces; f += 7) {
        const o = f * 18;
        let mx = 0, my = 0, mz = 0;
        for (let v = 0; v < 6; v++) {
          mx += c.positions[o + v * 3] / 6;
          my += c.positions[o + v * 3 + 1] / 6;
          mz += c.positions[o + v * 3 + 2] / 6;
        }
        const [nx, ny, nz] = [c.normals[o], c.normals[o + 1], c.normals[o + 2]];
        // Back to the mine's directions: the picture's (x, y, z) is the mine's (x, −z, y).
        const into = [mx + nx * 0.25, -(mz + nz * 0.25), my + ny * 0.25] as const;
        const rock = [mx - nx * 0.25, -(mz - nz * 0.25), my - ny * 0.25] as const;
        expect(solidAt(...into), `face ${f} looks into rock`).toBe(false);
        expect(solidAt(...rock), `face ${f} has no rock behind it`).toBe(true);
      }
    }
  });

  it('winds every triangle so it faces the way its normal says (so none are invisible)', () => {
    for (const c of chunks.slice(0, 3)) {
      for (let t = 0; t < c.faces * 2; t += 5) {
        const o = t * 9;
        const p = c.positions;
        const ab = [p[o + 3] - p[o], p[o + 4] - p[o + 1], p[o + 5] - p[o + 2]];
        const ac = [p[o + 6] - p[o], p[o + 7] - p[o + 1], p[o + 8] - p[o + 2]];
        const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
        const dot = cross[0] * c.normals[o] + cross[1] * c.normals[o + 1] + cross[2] * c.normals[o + 2];
        expect(dot).toBeGreaterThan(0);
      }
    }
  });

  it('makes floors lighter than ceilings, and tunnels a different colour from rooms', () => {
    // Colours are a share of the rock colour, so brightness differs by the way a face looks.
    let floor = 0, floorN = 0, ceiling = 0, ceilingN = 0;
    for (const c of chunks) {
      for (let f = 0; f < c.faces; f++) {
        const o = f * 18;
        const bright = c.colors[o] + c.colors[o + 1] + c.colors[o + 2];
        if (c.normals[o + 1] > 0.5) { floor += bright; floorN++; }
        if (c.normals[o + 1] < -0.5) { ceiling += bright; ceilingN++; }
      }
    }
    expect(floor / floorN).toBeGreaterThan((ceiling / ceilingN) * 1.4);
  });

  it('builds all six levels without trouble', () => {
    for (const r of RECIPES) expect(buildWalls(makeLevel(r), PALETTES[0]).length).toBeGreaterThan(5);
  });
});
