import { describe, expect, it } from 'vitest';
import { MONSTERS } from '../../../shared/lord/data';
import { ARMOUR_TILES, MASTER_TILES, MONSTER_TILES, SHEET_COLUMNS, SHEET_ROWS, WEAPON_TILES } from './tileMap';

describe('the pictures', () => {
  it('give every monster its own entry in the tile map', () => {
    for (const m of MONSTERS.flat()) expect(MONSTER_TILES[m.name], m.name).toBeDefined();
  });
  it('only name tiles that are on the sheet', () => {
    const all = [...Object.values(MONSTER_TILES), ...MASTER_TILES, ...WEAPON_TILES, ...ARMOUR_TILES];
    for (const [c, r] of all) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(SHEET_COLUMNS);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(SHEET_ROWS);
    }
  });
  it('have a picture for every weapon, armour and master', () => {
    expect(WEAPON_TILES).toHaveLength(12);
    expect(ARMOUR_TILES).toHaveLength(12);
    expect(MASTER_TILES).toHaveLength(11);
  });
});
