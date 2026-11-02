import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOOST_IDS, GEMS, LEVELS } from '../../../../shared/diamond/config';
import { WORKSHOP_ITEMS } from '../../../../shared/diamond/workshopItems';
import { allPaintFiles, paintFile } from './paint';

const DIR = join(__dirname, 'paint');
const files = (folder: string): string[] => {
  try {
    return readdirSync(join(DIR, folder)).filter((f) => f.endsWith('.webp'));
  } catch {
    return [];
  }
};

const items = (slot: string) => WORKSHOP_ITEMS.filter((i) => i.slot === slot).map((i) => i.id);
const gems = GEMS.map((g) => g.id);
const levels = LEVELS.map((l) => String(l.level));

// Every picture must be one the game looks for (a typo would mean it never shows) and small enough for a Chromebook.
const KNOWN: Record<string, { names: string[]; maxKb: number }> = {
  levels: { names: levels.flatMap((n) => [n, `${n}-800`]), maxKb: 200 },
  gems: { names: gems, maxKb: 40 },
  book: { names: gems, maxKb: 40 },
  field: { names: ['rock-small', 'rock-medium', 'rock-big', 'sack', 'crab', 'winch', 'claw', 'stall'], maxKb: 50 },
  nugget: { names: ['wave', 'point', 'cheer', 'oops'], maxKb: 50 },
  heads: { names: items('head'), maxKb: 40 },
  // The Laser Beam is always drawn: it's a glowing line.
  ropes: { names: items('rope').filter((id) => id !== 'laser-beam'), maxKb: 15 },
  winches: { names: items('winch'), maxKb: 50 },
  hats: { names: items('hat'), maxKb: 50 },
  icons: { names: [...items('trail'), ...items('catch')], maxKb: 20 },
  boosts: { names: [...BOOST_IDS], maxKb: 20 },
};

describe('the painted pictures', () => {
  for (const [folder, { names, maxKb }] of Object.entries(KNOWN)) {
    it(`${folder}: every file has a name the game uses, every name has a file, each under ${maxKb} KB`, () => {
      const there = files(folder).map((f) => f.replace(/\.webp$/, ''));
      expect(there.filter((n) => !names.includes(n)), `files in ${folder}/ the game never looks for`).toEqual([]);
      expect(names.filter((n) => !there.includes(n)), `names with no painting in ${folder}/`).toEqual([]);
      for (const f of files(folder)) {
        const kb = statSync(join(DIR, folder, f)).size / 1024;
        expect(kb, `${folder}/${f} is too big`).toBeLessThan(maxKb);
        expect(kb, `${folder}/${f} is empty`).toBeGreaterThan(0);
      }
    });
  }

  it('has no other folders, and the loader sees every file', () => {
    expect(readdirSync(DIR).filter((d) => !d.endsWith('.md')).sort()).toEqual(Object.keys(KNOWN).sort());
    expect(allPaintFiles()).toHaveLength(Object.keys(KNOWN).reduce((n, folder) => n + files(folder).length, 0));
  });

  it('gives nothing for a name it has no painting for, so the drawn version shows', () => {
    expect(paintFile('ropes', 'laser-beam')).toBeUndefined();
    expect(paintFile('gems', 'nowhere')).toBeUndefined();
    expect(paintFile('gems', 'ruby')).toBeTruthy();
  });
});
