import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MASTERS, MONSTERS } from '../../../shared/lord/data';
import { PEOPLE, SCENES, slug } from './art';

const DIR = join(__dirname, 'art');
const files = (group: string): string[] => {
  try {
    return readdirSync(join(DIR, group)).filter((f) => f.endsWith('.webp'));
  } catch {
    return [];
  }
};

// Every picture must be one the game looks for (a typo would mean it never shows) and small enough for a Chromebook.
const KNOWN: Record<string, { names: Set<string>; maxKb: number }> = {
  scenes: { names: new Set(SCENES.flatMap((s) => [s, `${s}-800`])), maxKb: 260 },
  monsters: { names: new Set(MONSTERS.flat().map((m) => slug(m.name))), maxKb: 60 },
  masters: { names: new Set(MASTERS.map((m) => slug(m.name))), maxKb: 80 },
  people: { names: new Set([...Object.values(PEOPLE).map((p) => p.id), 'knight', 'mage', 'trickster']), maxKb: 160 },
  dragon: { names: new Set(['scorchtail']), maxKb: 200 },
};

describe('the painted pictures', () => {
  for (const [group, { names, maxKb }] of Object.entries(KNOWN)) {
    it(`${group}: every file has a name the game uses, and is under ${maxKb} KB`, () => {
      for (const f of files(group)) {
        expect(names, `${group}/${f} is not a name the game looks for`).toContain(f.replace(/\.webp$/, ''));
        expect(statSync(join(DIR, group, f)).size / 1024, `${group}/${f} is too big`).toBeLessThan(maxKb);
      }
    });
  }

  it('no two monsters share a file name', () => {
    const all = MONSTERS.flat().map((m) => slug(m.name));
    expect(new Set(all).size).toBe(all.length);
  });

  it('only known folders', () => {
    let groups: string[] = [];
    try {
      groups = readdirSync(DIR).filter((f) => statSync(join(DIR, f)).isDirectory());
    } catch {
      /* no pictures yet */
    }
    for (const g of groups) expect(Object.keys(KNOWN)).toContain(g);
  });
});
