import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLASSES, ITEMS, MONSTERS, RACES } from '../../../shared/clans/gamedata';
import { KINGDOMS } from '../../../shared/clans/empire';
import { QUESTS } from '../../../shared/clans/quests';
import { BUILDING_KINDS, TROOP_KINDS } from '../../../shared/clans/types';
import { CLAN_NOUNS } from '../../../shared/clans/words';
import { FX, LOOKS, SCENES, slug } from './art';

const DIR = join(__dirname, 'art');
const files = (group: string): string[] => {
  try {
    return readdirSync(join(DIR, group)).filter((f) => f.endsWith('.webp'));
  } catch {
    return [];
  }
};
const wide = (names: string[]) => names.flatMap((n) => [n, `${n}-800`]);
const looks = RACES.flatMap((r) => CLASSES.flatMap((c) => LOOKS.map((l) => `${slug(r.name)}-${slug(c.name)}-${l}`)));

// Every picture the game needs, by folder, and how big one may be (a Chromebook on school wifi has to load them).
const NEEDED: Record<string, { names: string[]; maxKb: number }> = {
  scenes: { names: wide([...SCENES]), maxKb: 320 },
  quests: { names: wide(QUESTS.map((q) => slug(q.title))), maxKb: 320 },
  kingdoms: { names: wide(KINGDOMS.map((k) => k.id)), maxKb: 320 },
  members: { names: looks.flatMap((l) => [l, `${l}-small`]), maxKb: 120 },
  monsters: { names: MONSTERS.map((m) => slug(m.name)), maxKb: 90 },
  items: { names: ITEMS.map((i) => slug(i.name)), maxKb: 30 },
  troops: { names: [...TROOP_KINDS], maxKb: 30 },
  buildings: { names: BUILDING_KINDS.map((b) => b.toLowerCase()), maxKb: 40 },
  banners: { names: CLAN_NOUNS.map(slug), maxKb: 30 },
  fx: { names: [...FX], maxKb: 60 },
};

describe('the painted pictures', () => {
  for (const [group, { names, maxKb }] of Object.entries(NEEDED)) {
    it(`${group}: every one the game needs is there`, () => {
      const have = new Set(files(group).map((f) => f.replace(/\.webp$/, '')));
      expect(names.filter((n) => !have.has(n)), `missing from art/${group}`).toEqual([]);
    });
    it(`${group}: every file is one the game uses, and under ${maxKb} KB`, () => {
      const want = new Set(names);
      for (const f of files(group)) {
        expect(want, `art/${group}/${f} is not a name the game looks for`).toContain(f.replace(/\.webp$/, ''));
        expect(statSync(join(DIR, group, f)).size / 1024, `art/${group}/${f} is too big`).toBeLessThan(maxKb);
      }
    });
  }

  it('no two monsters or items share a file name', () => {
    for (const list of [MONSTERS, ITEMS]) {
      const all = list.map((x) => slug(x.name));
      expect(new Set(all).size).toBe(all.length);
    }
  });

  it('only known folders', () => {
    const groups = readdirSync(DIR).filter((f) => statSync(join(DIR, f)).isDirectory());
    for (const g of groups) expect(Object.keys(NEEDED)).toContain(g);
  });
});
