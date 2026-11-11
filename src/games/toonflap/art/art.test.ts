import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXTRA_IDS, FLYER_IDS, POSES_PAINTED, SCREENS, TRAIL_IDS, UI_IDS, WORLD_IDS, WORLD_PARTS, allArtFiles, flyerArt, worldArt } from './art';

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));
const there = walk(__dirname).filter((f) => f.endsWith('.webp')).map((f) => relative(__dirname, f).replace(/\.webp$/, ''));

// Every name the game can look for, with its size limit (Chromebooks on school wifi).
const KNOWN = new Map<string, number>([
  ...WORLD_IDS.flatMap((w) => WORLD_PARTS.map((p) => [`worlds/${w}/${p}`, p === 'back' ? 220 : p === 'mid' ? 160 : 60] as [string, number])),
  ...FLYER_IDS.flatMap((f) => (POSES_PAINTED[f] ?? ['glide']).map((p) => [`flyers/${f}-${p}`, 40] as [string, number])),
  ...TRAIL_IDS.map((t) => [`trails/${t}`, 12] as [string, number]),
  ...EXTRA_IDS.map((e) => [`extras/${e}`, 40] as [string, number]),
  ...UI_IDS.map((u) => [`ui/${u}`, 40] as [string, number]),
  ...SCREENS.map((s) => [s, s === 'potion' ? 20 : 260] as [string, number]),
]);

describe('the painted pictures', () => {
  it('has only files the game looks for, each a sensible size, and the loader sees them all', () => {
    expect(there.filter((n) => !KNOWN.has(n)), 'files the game never looks for').toEqual([]);
    for (const n of there) {
      const kb = statSync(join(__dirname, `${n}.webp`)).size / 1024;
      expect(kb, `${n} is too big`).toBeLessThan(KNOWN.get(n)!);
      expect(kb, `${n} is empty`).toBeGreaterThan(0);
    }
    expect(allArtFiles()).toHaveLength(there.length);
  });

  it('gives undefined for anything not painted, so the stand-in shows, and falls back to glide for a missing pose', () => {
    expect(worldArt(99)).toBeUndefined();
    expect(flyerArt('nobody')).toBeUndefined();
    if (there.includes('flyers/jet-bot-glide')) expect(flyerArt('jet-bot', 'up')).toBe(flyerArt('jet-bot'));
  });
});
