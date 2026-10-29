import { describe, expect, it } from 'vitest';
import { islandGeometry, propGeometry, PROP_ANIM, type PropKind } from './props';

const KINDS: PropKind[] = [
  'boulder', 'driftwood', 'dune-grass', 'gull', 'tussock', 'road-sign', 'schist-rock',
  'hot-pool', 'silica-terrace', 'mud-pot', 'steam-vent', 'ice-block', 'fern', 'rimu', 'snowy-pine', 'snow-rock',
  'container', 'crane', 'cable-car', 'harbour-buoy', 'volcanic-rock', 'emerald-lake',
  'round-tree', 'hay-bale', 'sheep', 'flowers',
];

const triangles = (g: { index: unknown; getAttribute: (n: string) => { count: number }; getIndex: () => { count: number } | null }) =>
  (g.getIndex() ? g.getIndex()!.count : g.getAttribute('position').count) / 3;

describe('prop shapes', () => {
  for (const kind of KINDS) {
    for (const variant of kind === 'container' || kind === 'flowers' ? [0, 1, 2, 3] : [0]) {
      it(`${kind} ${variant} is a small grounded shape with colours`, () => {
        const g = propGeometry(kind, variant);
        const pos = g.getAttribute('position');
        const col = g.getAttribute('color');
        expect(pos.count).toBeGreaterThan(0);
        expect(col.count).toBe(pos.count);
        expect(triangles(g)).toBeLessThan(600);
        g.computeBoundingBox();
        const box = g.boundingBox!;
        if (kind !== 'cable-car') expect(Math.abs(box.min.y)).toBeLessThan(0.001);
        expect(box.max.y).toBeGreaterThan(0.03);
        for (let i = 0; i < pos.count * 3; i++) expect(Number.isFinite(pos.array[i])).toBe(true);
        for (let i = 0; i < col.count * 3; i++) expect(Number.isFinite(col.array[i])).toBe(true);
      });
    }
  }

  it('is the same every time', () => {
    for (const kind of KINDS) {
      expect(Array.from(propGeometry(kind).getAttribute('position').array)).toEqual(Array.from(propGeometry(kind).getAttribute('position').array));
    }
  });

  it('only animates real kinds', () => {
    for (const k of Object.keys(PROP_ANIM)) expect(KINDS).toContain(k);
  });

  it('makes an island slab at the right place and height', () => {
    const g = islandGeometry({ x: 4, y: 2, w: 3, h: 2, top: 1.2 }, 0x9cbd5c, 0x8a6b4a);
    g.computeBoundingBox();
    const b = g.boundingBox!;
    expect(b.max.y).toBeCloseTo(1.2, 5);
    expect(b.min.y).toBeLessThan(1.2 - 0.7);
    expect(b.min.y).toBeGreaterThan(1.2 - 1.0);
    expect(b.min.x).toBeGreaterThan(3.9);
    expect(b.max.x).toBeLessThan(7.1);
    expect(b.min.z).toBeGreaterThan(1.9);
    expect(b.max.z).toBeLessThan(4.1);
    expect(g.getAttribute('color').count).toBe(g.getAttribute('position').count);
    expect(triangles(g)).toBeLessThan(600);
  });
});
