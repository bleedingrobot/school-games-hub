import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WORLD_MAPS } from '../../../../shared/monsters/maps';
import { MONSTER_BOOK } from '../../../../shared/monsters/monsterBook';
import { AREAS } from '../../../../shared/monsters/world/areas';
import { ITEM_ORDER } from '../../../../shared/monsters/world/rewards';
import { LOOKS } from '../../../../shared/monsters/world/start';
import { allPaintedFiles, badgePic, itemPic, lookPic, monsterPic, personPic, sceneFor, scenePic, slug } from './painted';

const DIR = join(__dirname, 'painted');
const files = (group: string): string[] => {
  try {
    return readdirSync(join(DIR, group)).filter((f) => f.endsWith('.webp'));
  } catch {
    return [];
  }
};
const both = (name: string) => [name, `${name}-small`];

/** Everyone on a map who talks with a name: people, nurses and trainers. */
const PEOPLE = Object.values(WORLD_MAPS).flatMap((m) => m.things.filter((t) => t.kind === 'person' || t.kind === 'nurse' || t.kind === 'trainer').map((t) => t.name));
const SCENES = [...new Set(Object.keys(WORLD_MAPS).map(sceneFor))];

// Every picture must be one the game looks for (a typo would mean it never shows) and small enough for a Chromebook.
const KNOWN: Record<string, { names: Set<string>; maxKb: number }> = {
  monsters: { names: new Set(MONSTER_BOOK.flatMap((s) => [...both(s.id), ...both(`${s.id}-shiny`)])), maxKb: 60 },
  people: { names: new Set(PEOPLE.flatMap((p) => both(slug(p)))), maxKb: 120 },
  looks: { names: new Set(LOOKS.flatMap(both)), maxKb: 120 },
  scenes: { names: new Set(SCENES.flatMap((s) => [s, `${s}-800`])), maxKb: 260 },
  badges: { names: new Set(AREAS.map((a) => a.badge)), maxKb: 50 },
  items: { names: new Set<string>(ITEM_ORDER), maxKb: 50 },
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

  it('every species, plain and shiny, has a picture and a small copy', () => {
    const have = new Set(files('monsters'));
    const missing = MONSTER_BOOK.flatMap((s) => [...both(s.id), ...both(`${s.id}-shiny`)]).filter((n) => !have.has(`${n}.webp`));
    expect(missing).toEqual([]);
  });

  it('every person on every map has a portrait and a small one for the talk box', () => {
    expect(PEOPLE).toHaveLength(50);
    const have = new Set(files('people'));
    expect(PEOPLE.flatMap((p) => both(slug(p))).filter((n) => !have.has(`${n}.webp`))).toEqual([]);
  });

  it('every badge and every bag item has a picture', () => {
    expect(AREAS.filter((a) => !badgePic(a.badge)).map((a) => a.badge)).toEqual([]);
    expect(ITEM_ORDER.filter((id) => !itemPic(id))).toEqual([]);
  });

  it('every look has both sizes', () => {
    expect(LOOKS).toHaveLength(24);
    const have = new Set(files('looks'));
    expect(LOOKS.flatMap(both).filter((n) => !have.has(`${n}.webp`))).toEqual([]);
  });

  it('every place and Topic Tower has a battle background and a phone copy', () => {
    expect(SCENES).toHaveLength(14);
    const have = new Set(files('scenes'));
    expect(SCENES.flatMap((s) => [s, `${s}-800`]).filter((n) => !have.has(`${n}.webp`))).toEqual([]);
  });

  it('a Tower’s two rooms share one background, and a place uses its own', () => {
    expect(sceneFor('tower-3-hall')).toBe('tower-3');
    expect(sceneFor('tower-3-top')).toBe('tower-3');
    expect(sceneFor('kauri-bush')).toBe('kauri-bush');
  });

  it('a missing picture is just missing (the game then shows what it did before)', () => {
    expect(monsterPic('nobody-1')).toBeUndefined();
    expect(personPic('Nobody at all', true)).toBeUndefined();
    expect(lookPic('nobody')).toBeUndefined();
    expect(scenePic('nowhere')).toEqual({ wide: undefined, small: undefined });
  });

  it('the helpers find the files that are there, small copies too', () => {
    for (const path of allPaintedFiles()) {
      const [group, name] = path.replace('./painted/', '').replace(/\.webp$/, '').split('/');
      const plain = name.replace(/-small$/, '');
      const small = name !== plain;
      if (group === 'monsters') {
        const shiny = plain.endsWith('-shiny');
        expect(monsterPic(plain.replace(/-shiny$/, ''), shiny, small), path).toBeTruthy();
      } else if (group === 'looks') expect(lookPic(plain, small), path).toBeTruthy();
      else if (group === 'scenes') expect(scenePic(plain.replace(/-800$/, '')).small, path).toBeTruthy();
    }
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
