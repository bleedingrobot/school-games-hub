import { describe, expect, it } from 'vitest';
import { buildGlobeTable, spinGlobe } from './globe';

/** A map whose every pixel says which column it is in (row × 10000 + column), so we can see what the ball shows. */
function labelledMap(w: number, h: number): Uint32Array {
  const m = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = y * 10000 + x;
  return m;
}
const colAt = (v: number) => v % 10000;
const rowAt = (v: number) => Math.floor(v / 10000);

describe('the turning globe', () => {
  const size = 100;
  const w = 400;
  const h = 200;
  const table = buildGlobeTable(size, w, h);
  const map = labelledMap(w, h);
  const out = new Uint32Array(size * size);
  const px = (x: number, y: number) => out[y * size + x];

  it('covers the circle and nothing outside it', () => {
    // π/4 of the square, give or take the rim.
    expect(table.count / (size * size)).toBeGreaterThan(0.78);
    expect(table.count / (size * size)).toBeLessThan(0.81);
    out.fill(0xdeadbeef);
    spinGlobe(table, map, out, 0);
    expect(px(0, 0)).toBe(0xdeadbeef);
    expect(px(size - 1, size - 1)).toBe(0xdeadbeef);
  });

  it('shows the middle of the map in the middle, north at the top, and a quarter turn either side at the edges', () => {
    spinGlobe(table, map, out, 0);
    const mid = px(50, 50);
    expect(Math.abs(colAt(mid) - w / 2)).toBeLessThanOrEqual(2);
    expect(Math.abs(rowAt(mid) - h / 2)).toBeLessThanOrEqual(2);
    expect(rowAt(px(50, 1))).toBeLessThan(h * 0.15);
    expect(rowAt(px(50, size - 2))).toBeGreaterThan(h * 0.85);
    expect(Math.abs(colAt(px(0, 50)) - w / 4)).toBeLessThanOrEqual(w * 0.04);
    expect(Math.abs(colAt(px(size - 1, 50)) - (3 * w) / 4)).toBeLessThanOrEqual(w * 0.04);
  });

  it('squashes the surface near the edge, as a ball does', () => {
    spinGlobe(table, map, out, 0);
    const middleStep = colAt(px(51, 50)) - colAt(px(50, 50));
    const edgeStep = colAt(px(size - 1, 50)) - colAt(px(size - 2, 50));
    expect(edgeStep).toBeGreaterThan(middleStep * 3);
  });

  it('turns the surface left to right, and once round is back where it started', () => {
    spinGlobe(table, map, out, 0);
    const before = colAt(px(50, 50));
    spinGlobe(table, map, out, 0.1);
    // What was 0.1 of the way round to the left is in the middle now.
    expect(colAt(px(50, 50))).toBe((before - 0.1 * w + w) % w);
    spinGlobe(table, map, out, 1);
    expect(colAt(px(50, 50))).toBe(before);
    spinGlobe(table, map, out, -0.25);
    expect(colAt(px(50, 50))).toBe((before + 0.25 * w) % w);
  });

  it('never reads outside the map, at any turn', () => {
    for (const turn of [0, 0.123, 0.5, 0.999, 3.7, -2.2]) {
      spinGlobe(table, map, out, turn);
      for (let i = 0; i < table.count; i++) {
        const v = out[table.at[i]];
        expect(colAt(v)).toBeLessThan(w);
        expect(rowAt(v)).toBeLessThan(h);
      }
    }
  });
});
