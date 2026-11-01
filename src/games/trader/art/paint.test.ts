import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PIRATE_TIERS, PLANET_NAMES, SHIPS } from '../../../../shared/trader/config';
import { allPaintFiles, MOON, PIRATE_ART, pirateArt, planetMap, shipArt, slug } from './paint';

const DIR = join(__dirname, 'paint');
const files = (group: string): string[] => {
  try {
    return readdirSync(join(DIR, group)).filter((f) => f.endsWith('.webp'));
  } catch {
    return [];
  }
};

const PLANETS = [...PLANET_NAMES, MOON].map(slug);
const SHIP_NAMES = [...SHIPS.map((s) => slug(s.name)), ...PIRATE_ART];

// Every picture must be one the game looks for (a typo would mean it never shows) and small enough for a Chromebook.
const KNOWN: Record<string, { names: Set<string>; maxKb: number }> = {
  planets: { names: new Set(PLANETS.flatMap((p) => [p, `${p}-small`])), maxKb: 120 },
  ships: { names: new Set(SHIP_NAMES.flatMap((s) => [s, `${s}-card`])), maxKb: 60 },
};

describe('the painted pictures', () => {
  for (const [group, { names, maxKb }] of Object.entries(KNOWN)) {
    it(`${group}: every file has a name the game uses, and is under ${maxKb} KB`, () => {
      for (const f of files(group)) {
        expect(names, `${group}/${f} is not a name the game looks for`).toContain(f.replace(/\.webp$/, ''));
        const kb = statSync(join(DIR, group, f)).size / 1024;
        expect(kb, `${group}/${f} is too big`).toBeLessThan(maxKb);
        expect(kb, `${group}/${f} is empty`).toBeGreaterThan(0);
      }
    });
  }

  it('every planet and your moon has a surface map and a small copy', () => {
    expect(PLANETS).toHaveLength(25);
    expect([...PLANET_NAMES, MOON].filter((p) => !planetMap(p) || planetMap(p, true) === planetMap(p))).toEqual([]);
  });

  it('every trader ship and every pirate has a painting and a card copy', () => {
    expect(SHIPS.map((s) => s.name).filter((n) => !shipArt(n) || shipArt(n, true) === shipArt(n))).toEqual([]);
    expect(PIRATE_ART).toHaveLength(PIRATE_TIERS.length);
    expect(PIRATE_TIERS.map((_, i) => i).filter((i) => !pirateArt(i) || pirateArt(i, true) === pirateArt(i))).toEqual([]);
  });

  it('gives nothing for a name it has no painting for, so the drawn version shows', () => {
    expect(planetMap('Nowhere')).toBeUndefined();
    expect(shipArt('Starliner', true)).toBeUndefined();
    expect(pirateArt(PIRATE_TIERS.length)).toBeUndefined();
  });

  it('only paints planets and ships so far (G.0), and the loader sees every file', () => {
    expect(readdirSync(DIR).filter((d) => !d.endsWith('.md')).sort()).toEqual(['planets', 'ships']);
    expect(allPaintFiles()).toHaveLength(files('planets').length + files('ships').length);
  });
});

describe('the measured points on the painted ships', () => {
  it('every trader ship and pirate has its engines, gun and length, all on the painting', async () => {
    const { PAINTED } = await import('./ships');
    expect(PAINTED.trader).toHaveLength(SHIPS.length);
    expect(PAINTED.pirate).toHaveLength(PIRATE_TIERS.length);
    for (const p of [...PAINTED.trader, ...PAINTED.pirate]) {
      expect(p.engines.length).toBeGreaterThan(0);
      for (const [x, y] of [...p.engines, p.gun]) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(1);
        expect(Math.abs(y)).toBeLessThan(0.35);
      }
      // Engines at the back, the gun towards the front.
      expect(Math.max(...p.engines.map(([x]) => x))).toBeLessThan(p.gun[0]);
      expect(p.length).toBeGreaterThanOrEqual(80);
      expect(p.length).toBeLessThanOrEqual(140);
    }
  });
});
