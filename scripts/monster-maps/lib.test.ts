/**
 * The map maker: it warns when something you cannot walk through stands on a path (a tall tree once shut
 * the path east in Kauri Bush while it still looked open), and the maps it makes are the maps in the game.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const written = vi.hoisted(() => new Map<string, string>());
vi.mock('node:fs', async (original) => ({
  ...(await original<typeof import('node:fs')>()),
  writeFileSync: (url: URL, text: string) => void written.set(String(url).split('/').pop()!, text),
}));

// @ts-expect-error plain JavaScript, no types
import { harbourTown, healingCentre } from './town.mjs';
// @ts-expect-error plain JavaScript, no types
import { kauriBush } from './area1.mjs';
// @ts-expect-error plain JavaScript, no types
import { fireMountain, glowwormCaves, harbourCity, shellBeach, snowyPeaks } from './areas.mjs';

const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('the maps in the game are what the map maker makes', () => {
  const all = [harbourTown, healingCentre, kauriBush, shellBeach, fireMountain, snowyPeaks, glowwormCaves, harbourCity];

  it('making every map gives no warning, and the files in shared/monsters/maps are exactly those', () => {
    for (const make of all) make();
    expect(warn).not.toHaveBeenCalled();
    expect(written.size).toBeGreaterThanOrEqual(20);
    for (const [file, text] of written) {
      expect(readFileSync(resolve(process.cwd(), 'shared/monsters/maps', file), 'utf8'), file).toBe(text);
    }
  });
});
