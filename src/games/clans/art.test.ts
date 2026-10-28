import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLASSES, ITEMS, MONSTERS, RACES } from '../../../shared/clans/gamedata';
import { KINGDOMS } from '../../../shared/clans/empire';
import { QUESTS } from '../../../shared/clans/quests';
import { BUILDING_KINDS, TROOP_KINDS, VILLAGE_BUILDINGS } from '../../../shared/clans/types';
import { CLAN_NOUNS } from '../../../shared/clans/words';
import { FX, LOOKS, SCENES, buildingArt, buildingSize, pickBuildingArt, slug } from './art';

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
// Buildings: the one-size pictures that exist (barracks, walls, tower, steelmill) are the only ones that must be there. The 24 small/medium/big
// pictures and the other buildings' pictures are allowed but optional: a missing one falls back (see below), so nothing breaks.
const BUILDING_SIZES = VILLAGE_BUILDINGS.flatMap((b) => ['small', 'medium', 'big'].map((z) => `${b.toLowerCase()}-${z}`));
const BUILDING_ALLOWED = [...BUILDING_KINDS.map((b) => b.toLowerCase()), ...VILLAGE_BUILDINGS.map((b) => b.toLowerCase()), ...BUILDING_SIZES];

const NEEDED: Record<string, { names: string[]; maxKb: number; allowed?: string[] }> = {
  scenes: { names: wide([...SCENES]), maxKb: 320 },
  quests: { names: wide(QUESTS.map((q) => slug(q.title))), maxKb: 320 },
  kingdoms: { names: wide(KINGDOMS.map((k) => k.id)), maxKb: 320 },
  members: { names: looks.flatMap((l) => [l, `${l}-small`]), maxKb: 120 },
  monsters: { names: MONSTERS.map((m) => slug(m.name)), maxKb: 90 },
  items: { names: ITEMS.map((i) => slug(i.name)), maxKb: 30 },
  troops: { names: [...TROOP_KINDS], maxKb: 30 },
  buildings: { names: ['barracks', 'walls', 'tower', 'steelmill'], allowed: BUILDING_ALLOWED, maxKb: 40 },
  banners: { names: CLAN_NOUNS.map(slug), maxKb: 30 },
  fx: { names: [...FX], maxKb: 60 },
};

describe('the painted pictures', () => {
  for (const [group, { names, maxKb, allowed }] of Object.entries(NEEDED)) {
    it(`${group}: every one the game needs is there`, () => {
      const have = new Set(files(group).map((f) => f.replace(/\.webp$/, '')));
      expect(names.filter((n) => !have.has(n)), `missing from art/${group}`).toEqual([]);
    });
    it(`${group}: every file is one the game uses, and under ${maxKb} KB`, () => {
      const want = new Set(allowed ?? names);
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

describe('building pictures grow with the level', () => {
  it('uses small for levels 0-2, medium for 3-4 and big for 5 and up', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(buildingSize)).toEqual(['small', 'small', 'small', 'medium', 'medium', 'big', 'big']);
  });

  const all: Record<string, string> = {};
  for (const b of VILLAGE_BUILDINGS) for (const z of ['small', 'medium', 'big']) all[`${b.toLowerCase()}-${z}`] = `/${b}-${z}.webp`;
  const find = (have: Record<string, string>) => (name: string) => have[name];

  it('picks the size picture for the level when it is there', () => {
    expect(pickBuildingArt('smithy', 1, find(all))).toBe('/smithy-small.webp');
    expect(pickBuildingArt('smithy', 4, find(all))).toBe('/smithy-medium.webp');
    expect(pickBuildingArt('smithy', 6, find(all))).toBe('/smithy-big.webp');
    expect(pickBuildingArt('trainingHall', 3, find(all))).toBe('/trainingHall-medium.webp');
  });

  it('falls back to the one-size picture, and the Forge to the Steel Mill', () => {
    const old = { barracks: '/barracks.webp', steelmill: '/steelmill.webp' };
    expect(pickBuildingArt('barracks', 5, find(old))).toBe('/barracks.webp');
    expect(pickBuildingArt('forge', 2, find(old))).toBe('/steelmill.webp');
    expect(pickBuildingArt('forge', 2, find({ ...old, forge: '/forge.webp' }))).toBe('/forge.webp');
    expect(pickBuildingArt('barracks', 5, find({ ...old, 'barracks-big': '/b-big.webp' }))).toBe('/b-big.webp');
  });

  it('gives nothing, without breaking, when no picture is there at all', () => {
    expect(pickBuildingArt('strongroom', 3, find({}))).toBeUndefined();
    for (const b of VILLAGE_BUILDINGS) for (const level of [0, 1, 3, 5]) expect(() => buildingArt(b, level)).not.toThrow();
  });

  it('the real files: the Barracks, Walls, Tower and Forge always have a picture, old one-size or new', () => {
    for (const level of [1, 3, 5]) {
      for (const b of ['barracks', 'walls', 'tower', 'forge'] as const) expect(buildingArt(b, level), `${b} level ${level}`).toBeTruthy();
    }
  });
});
