/**
 * The map maker: it warns when something you cannot walk through stands on a path (a tall tree once shut
 * the path east in Kauri Bush while it still looked open), and the maps it makes are the maps in the game.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const written = vi.hoisted(() => new Map<string, string>());
vi.mock('node:fs', async (original) => ({
  ...(await original<typeof import('node:fs')>()),
  writeFileSync: (url: URL, text: string) => void written.set(String(url).split('/').pop()!, text),
}));

// @ts-expect-error plain JavaScript, no types
import { MapMaker } from './lib.mjs';
// @ts-expect-error plain JavaScript, no types
import { harbourTown, healingCentre } from './town.mjs';
// @ts-expect-error plain JavaScript, no types
import { kauriBush } from './area1.mjs';
// @ts-expect-error plain JavaScript, no types
import { fireMountain, glowwormCaves, harbourCity, shellBeach, snowyPeaks } from './areas.mjs';

const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
beforeEach(() => {
  warn.mockClear();
  written.clear();
});

type Maker = { warnings?: string[]; path(x: number, y: number, w: number, h: number): void } & Record<string, (...a: number[]) => void>;
const maker = () => new MapMaker('test-map', 'Test', 12, 12) as Maker;

describe('trees and rocks on paths', () => {
  it('a tall tree on a path gives a warning that names the map and the tile', () => {
    const m = maker();
    m.path(2, 5, 8, 2);
    m.bigTree(4, 6);
    expect(m.warnings).toEqual(['test-map: a tall tree at 4,6 stands on a path', 'test-map: a tall tree at 4,5 stands on a path']);
    expect(warn).toHaveBeenCalledWith('test-map: a tall tree at 4,6 stands on a path');
  });

  it('the crown of a tall tree counts too (the trunk is just off the path, the crown is on it)', () => {
    const m = maker();
    m.path(2, 5, 8, 2);
    m.bigTree(4, 7);
    expect(m.warnings).toEqual(['test-map: a tall tree at 4,6 stands on a path']);
  });

  it.each(['tree', 'autumnSmall', 'snowPine', 'snowBush', 'boulder', 'stalagmite', 'crystal', 'bush'])('%s on a path gives a warning', (kind) => {
    const m = maker();
    m.path(2, 5, 8, 2);
    m[kind](4, 5);
    expect(m.warnings).toHaveLength(1);
  });

  it.each(['autumnTree', 'snowTree', 'palm'])('%s (two tiles tall) on a path gives a warning', (kind) => {
    const m = maker();
    m.path(2, 5, 8, 2);
    m[kind](4, 6);
    expect(m.warnings?.length).toBeGreaterThan(0);
  });

  it('trees beside a path give no warning', () => {
    const m = maker();
    m.path(2, 5, 8, 2);
    m.bigTree(4, 9);
    m.tree(4, 3);
    m.bush(1, 5);
    expect(m.warnings).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('the maps in the game are what the map maker makes', () => {
  const all = [harbourTown, healingCentre, kauriBush, shellBeach, fireMountain, snowyPeaks, glowwormCaves, harbourCity];

  it('making every map gives no warning', () => {
    for (const make of all) make();
    expect(warn).not.toHaveBeenCalled();
    expect(written.size).toBeGreaterThanOrEqual(20);
  });

  it('and the files in shared/monsters/maps are exactly those (a hand edit, or an old file, shows up here)', () => {
    for (const make of all) make();
    for (const [file, text] of written) {
      expect(readFileSync(resolve(process.cwd(), 'shared/monsters/maps', file), 'utf8'), file).toBe(text);
    }
  });
});
