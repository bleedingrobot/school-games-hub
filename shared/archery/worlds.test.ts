import { describe, expect, it } from 'vitest';
import {
  ARCHER_H, BUILDING_CHIP, CELL, COLS, ROWS, SAND_MAX_STEP, SAND_REACH, START_HEALTH, TREE_BLAST_SCALE, WORLD_WIND_MAX,
} from './config';
import { newRound, playFight, playShot, roundSeeds, startFight, takeShot } from './fight';
import { carve, cellAt, emptyLand, makeRoundLand, settle, slideArcher, slideSand, standing, surfaceRow } from './land';
import { flyArrow } from './shot';
import { AIR, BUILDING, DIRT, ICE, TREE, WORLD_IDS, type Archer, type FightSetup, type Land, type Shot, type WorldId } from './types';

const archer = (x: number, y: number): Archer => ({ x, y, health: START_HEALTH, shield: 0, popped: false });
const setupIn = (world: WorldId): FightSetup => ({ world, players: [{ quiver: { steel: 3 }, shield: 0 }, { quiver: { steel: 3 }, shield: 0 }] });
const count = (land: Land, kind: number) => land.cells.reduce((n, v) => n + (v === kind ? 1 : 0), 0);

/** Ground from row `top` down, across the whole field. */
function ground(top: number, kind = DIRT): Land {
  const land = emptyLand();
  for (let r = top; r < ROWS; r++) for (let c = 0; c < COLS; c++) land.cells[r * COLS + c] = kind;
  return land;
}

describe('every world', () => {
  it.each(WORLD_IDS)('plays the same %s fight the same way every time', (world) => {
    const shots: Shot[] = [];
    for (let i = 0; i < 30; i++) shots.push({ angle: i % 2 === 0 ? 40 + ((i * 7) % 40) : 100 + ((i * 11) % 40), power: 45 + ((i * 13) % 50), arrow: i % 5 === 0 ? 'steel' : 'plain' });
    const a = playFight(99, setupIn(world), shots);
    expect(a.current.world).toBe(world);
    expect(playFight(99, setupIn(world), shots)).toEqual(a);
  });

  it('keeps each world to its own wind (calm Forest, strong Desert), the same all round', () => {
    for (const world of WORLD_IDS) {
      let biggest = 0;
      for (let s = 0; s < 400; s++) {
        const { wind } = roundSeeds(s, 0, world);
        expect(Math.abs(wind)).toBeLessThanOrEqual(WORLD_WIND_MAX[world]);
        biggest = Math.max(biggest, Math.abs(wind));
      }
      expect(biggest).toBe(WORLD_WIND_MAX[world]);
    }
    expect(WORLD_WIND_MAX.forest).toBeLessThan(WORLD_WIND_MAX.snow);
    expect(WORLD_WIND_MAX.desert).toBeGreaterThan(WORLD_WIND_MAX.snow);
    // The wind never changes during a round.
    const run = startFight(5, setupIn('desert'));
    const wind = run.round.wind;
    for (let i = 0; i < 6; i++) expect(takeShot(run, { angle: i % 2 ? 120 : 60, power: 30, arrow: 'plain' }).record!.wind).toBe(wind);
  });

  it('takeShot step by step gives exactly what playFight gives, including the end of each round', () => {
    const shots: Shot[] = [];
    for (let i = 0; i < 300; i++) shots.push({ angle: i % 2 === 0 ? 55 : 125, power: 50 + ((i * 7) % 45), arrow: 'plain' });
    const all = playFight(4, setupIn('snow'), shots);
    const n = all.shots.length;
    const run = startFight(4, setupIn('snow'));
    let ended = 0;
    for (let i = 0; i < n; i++) {
      const t = takeShot(run, shots[i]);
      expect(t.problem).toBeNull();
      if (t.ended) {
        ended++;
        expect(t.ended.winner).not.toBeNull();
      }
    }
    expect(run.records).toEqual(all.shots);
    expect(ended).toBe(all.rounds.length);
    expect(takeShot(run, shots[n]).problem).toMatch(/after the fight/);
  });
});

describe('Forest: trees', () => {
  it('stands trees on most lands, away from the archers', () => {
    let withTrees = 0;
    for (let s = 0; s < 100; s++) {
      const r = makeRoundLand(s, 'forest');
      if (count(r.land, TREE) > 0) withTrees++;
      for (const a of r.archers) {
        // Nothing but air in the archer's own space.
        for (let row = Math.floor(a.y / CELL) - ARCHER_H / CELL; row < Math.floor(a.y / CELL); row++) {
          for (let c = Math.floor((a.x - 6) / CELL); c <= Math.floor((a.x + 5) / CELL); c++) expect(cellAt(r.land, c, row)).toBe(AIR);
        }
      }
    }
    expect(withTrees).toBeGreaterThanOrEqual(95);
    // Other worlds have none.
    expect(count(makeRoundLand(1, 'desert').land, TREE)).toBe(0);
  });

  it('stops arrows until they are blasted away, which is easier than blasting dirt', () => {
    const land = ground(150);
    for (let r = 120; r < 150; r++) for (let c = 150; c < 156; c++) land.cells[r * COLS + c] = TREE;
    const archers = [archer(60, 450), archer(900, 450)];
    const flat = (l: Land) => flyArrow(l, archers, 0, { angle: 30, power: 75, arrow: 'plain' }, 0);
    const blocked = flat(land);
    expect(blocked.hit.kind).toBe('land');
    expect(Math.floor(blocked.hit.x / CELL)).toBeGreaterThanOrEqual(149);
    expect(Math.floor(blocked.hit.x / CELL)).toBeLessThanOrEqual(156);
    // A blast clears tree cells further out than dirt.
    const test = ground(150);
    for (let r = 100; r < 150; r++) for (let c = 100; c < 110; c++) test.cells[r * COLS + c] = TREE;
    carve(test, 315, 450, 20);
    const reach = 20 * TREE_BLAST_SCALE;
    expect(cellAt(test, 105, 141)).toBe(AIR); // a tree cell 25 px away: within 1.4 × 20
    expect(cellAt(test, 113, 156)).toBe(DIRT); // a dirt cell 25 px away: beyond 20
    expect(reach).toBeGreaterThan(20);
  });

  it('lets an undermined tree fall like dirt', () => {
    const land = ground(150);
    for (let r = 130; r < 150; r++) land.cells[r * COLS + 100] = TREE;
    for (let r = 150; r < 160; r++) land.cells[r * COLS + 100] = AIR; // dig under it
    expect(settle(land, 100, 100)).toBe(true);
    expect(cellAt(land, 100, 159)).toBe(TREE);
    expect(cellAt(land, 100, 135)).toBe(AIR);
  });
});

describe('Desert: sand slides', () => {
  it('slumps a cliff beside a blast into a slope, and leaves land far away alone', () => {
    const land = ground(150);
    // A tall, thin cliff of sand next to where the blast lands, and another far away.
    for (let r = 60; r < 150; r++) for (let c = 100; c < 104; c++) land.cells[r * COLS + c] = DIRT;
    for (let r = 60; r < 150; r++) for (let c = 260; c < 264; c++) land.cells[r * COLS + c] = DIRT;
    const [c0, c1] = carve(land, 320, 452, 12);
    settle(land, c0, c1);
    const moved = slideSand(land, c0, c1, []);
    expect(moved).toBeGreaterThan(0);
    for (let c = c0 - SAND_REACH + 1; c < c1 + SAND_REACH - 1; c++) {
      expect(Math.abs(surfaceRow(land, c) - surfaceRow(land, c + 1)), `column ${c}`).toBeLessThanOrEqual(SAND_MAX_STEP);
    }
    expect(surfaceRow(land, 261)).toBe(60); // the far cliff still stands
  });

  it('keeps the same amount of sand, and never slides sand into an archer', () => {
    const land = ground(150);
    for (let r = 80; r < 150; r++) for (let c = 100; c < 104; c++) land.cells[r * COLS + c] = DIRT;
    const before = count(land, DIRT);
    const a = archer(318, 450); // standing right beside the pillar (columns 104–107)
    slideSand(land, 100, 103, [a]);
    expect(count(land, DIRT)).toBe(before);
    for (let row = 142; row < 150; row++) for (let c = 104; c < 108; c++) expect(cellAt(land, c, row)).toBe(AIR);
  });

  it('only slides sand in the Desert', () => {
    // The same shot on the same land in the Desert and the Forest: an archer beside a tall cliff fires
    // a Steel Arrow straight up, and it comes back down beside the cliff's foot.
    const tops: Record<string, number> = {};
    for (const world of ['desert', 'forest'] as const) {
      const round = newRound(8, 0, setupIn(world));
      const cliff = ground(150);
      for (let r = 40; r < 150; r++) for (let c = 150; c < 154; c++) cliff.cells[r * COLS + c] = DIRT;
      round.land.cells.set(cliff.cells);
      round.archers[0] = archer(476, 450);
      round.archers[1] = archer(900, 450);
      round.wind = 0;
      const rec = playShot(round, 0, { angle: 90, power: 20, arrow: 'steel' }, false);
      expect(rec.hit.kind).toBe('archer');
      tops[world] = surfaceRow(round.land, 151);
    }
    expect(tops.forest).toBeLessThan(60); // the undermined cliff dropped a little but still stands tall
    expect(tops.desert).toBeGreaterThan(80); // the sand slid down
  });
});

describe('Snow: slippery slopes and ice', () => {
  /** A slope going down to the right, one cell per column, from column 80 to 140. */
  function slope(): Land {
    const land = ground(170);
    for (let c = 0; c < COLS; c++) {
      const top = c < 80 ? 100 : c < 140 ? 100 + (c - 80) : 160;
      for (let r = top; r < ROWS; r++) land.cells[r * COLS + c] = DIRT;
    }
    return land;
  }

  it('slides an archer on a slope downhill until the ground is level', () => {
    const land = slope();
    const a = archer(100 * CELL, (100 + 20) * CELL);
    // Put them on the slope: their feet on the highest cell under their box.
    a.y = surfaceRow(land, Math.floor((a.x - 6) / CELL)) * CELL;
    expect(standing(land, a)).toBe(true);
    const startX = a.x;
    const { slid, drops } = slideArcher(land, [a], 0);
    expect(slid).toBeGreaterThan(5);
    expect(a.x).toBeGreaterThan(startX); // downhill is to the right
    expect(drops.every((d) => d <= 2)).toBe(true); // a gentle slope: small steps, no fall damage
    expect(standing(land, a)).toBe(true);
  });

  it("doesn't slide an archer on level ground or on a flattened ledge", () => {
    const land = ground(150);
    const a = archer(480, 450);
    expect(slideArcher(land, [a], 0).slid).toBe(0);
    expect(a.x).toBe(480);
    // Every archer starts on a flat spot, so nobody slides before the first blast.
    for (let s = 0; s < 40; s++) {
      const r = makeRoundLand(s, 'snow');
      for (let i = 0; i < 2; i++) expect(slideArcher(r.land, r.archers, i).slid).toBe(0);
    }
  });

  it('slides archers in the Snow after a blast leaves them on a slope, and nowhere else', () => {
    let snowSlides = 0;
    let otherSlides = 0;
    for (const world of WORLD_IDS) {
      for (let s = 0; s < 6; s++) {
        const shots: Shot[] = [];
        for (let i = 0; i < 40; i++) shots.push({ angle: i % 2 === 0 ? 40 + ((i * 7 + s) % 40) : 100 + ((i * 11 + s) % 40), power: 40 + ((i * 13 + s) % 55), arrow: i % 3 === 0 ? 'steel' : 'plain' });
        const setup = { ...setupIn(world), players: [{ quiver: { steel: 99 }, shield: 0 }, { quiver: { steel: 99 }, shield: 0 }] } as FightSetup;
        const f = playFight(s, setup, shots);
        const slid = f.shots.reduce((n, r) => n + r.slid[0] + r.slid[1], 0);
        if (world === 'snow') snowSlides += slid;
        else otherSlides += slid;
      }
    }
    expect(snowSlides).toBeGreaterThan(0);
    expect(otherSlides).toBe(0);
  });

  it('bounces an arrow off ice once, then it stops at the next ice', () => {
    const land = ground(150);
    // A wall of ice straight ahead of a flat shot.
    for (let r = 100; r < 150; r++) for (let c = 150; c < 154; c++) land.cells[r * COLS + c] = ICE;
    const archers = [archer(300, 450), archer(900, 450)];
    const f = flyArrow(land, archers, 0, { angle: 15, power: 60, arrow: 'plain' }, 0);
    expect(f.bounce).not.toBeNull();
    expect(f.bounce![0]).toBeLessThan(450);
    expect(f.hit.x).toBeLessThan(450); // it came back towards the shooter
    // With dirt instead of ice it just stops there.
    const dirt = ground(150);
    for (let r = 100; r < 150; r++) for (let c = 150; c < 154; c++) dirt.cells[r * COLS + c] = DIRT;
    const g = flyArrow(dirt, archers, 0, { angle: 15, power: 60, arrow: 'plain' }, 0);
    expect(g.bounce).toBeNull();
    expect(g.hit.kind).toBe('land');
    expect(g.hit.x).toBeGreaterThanOrEqual(449);
    // An ice wall and an ice floor: it bounces off the wall, then stops on the floor (no second bounce).
    const both = ground(150);
    for (let r = 100; r < 150; r++) for (let c = 150; c < 154; c++) both.cells[r * COLS + c] = ICE;
    for (let r = 150; r < ROWS; r++) for (let c = 100; c < 150; c++) both.cells[r * COLS + c] = ICE;
    const h = flyArrow(both, archers, 0, { angle: 15, power: 60, arrow: 'plain' }, 0);
    expect(h.bounce).not.toBeNull();
    expect(h.hit.kind).toBe('land');
    expect(cellAt(both, Math.floor(h.hit.x / CELL), Math.floor(h.hit.y / CELL))).toBe(ICE);
  });

  it('puts ice blocks on most Snow lands, and they stay put when undermined', () => {
    let withIce = 0;
    for (let s = 0; s < 100; s++) if (count(makeRoundLand(s, 'snow').land, ICE) > 0) withIce++;
    expect(withIce).toBeGreaterThanOrEqual(95);
    const land = ground(150);
    for (let r = 140; r < 150; r++) land.cells[r * COLS + 100] = ICE;
    for (let r = 150; r < 160; r++) land.cells[r * COLS + 100] = AIR;
    expect(settle(land, 100, 100)).toBe(false);
    expect(cellAt(land, 100, 140)).toBe(ICE);
  });
});

describe('City: tough buildings', () => {
  it('builds a street of buildings, with archers often up on a roof', () => {
    let onRoof = 0;
    for (let s = 0; s < 200; s++) {
      const r = makeRoundLand(s, 'city');
      expect(count(r.land, BUILDING)).toBeGreaterThan(500);
      for (const a of r.archers) {
        const under = cellAt(r.land, Math.floor(a.x / CELL), Math.floor(a.y / CELL));
        if (under === BUILDING) onRoof++;
      }
    }
    expect(onRoof).toBeGreaterThan(20);
  });

  it('only chips buildings, while dirt goes in a full circle, and buildings never fall', () => {
    const land = ground(150, BUILDING);
    const r = 30;
    carve(land, 480, 450, r);
    const chip = r * BUILDING_CHIP;
    expect(cellAt(land, 160, 150)).toBe(AIR); // the very middle
    expect(cellAt(land, 160 + Math.ceil(chip / CELL) + 1, 150)).toBe(BUILDING); // just past the chip
    expect(cellAt(land, 160 + 6, 150)).toBe(BUILDING); // 18 px away: dirt would be gone
    const dirt = ground(150);
    carve(dirt, 480, 450, r);
    expect(cellAt(dirt, 160 + 6, 150)).toBe(AIR);
    // A building with nothing under it stays put.
    const hanging = ground(150);
    for (let row = 100; row < 120; row++) hanging.cells[row * COLS + 50] = BUILDING;
    expect(settle(hanging, 50, 50)).toBe(false);
  });

  it('gives shelter: a blast against a building leaves the wall standing, where a dirt wall would be gone', () => {
    const shelter = (kind: number) => {
      const land = ground(150);
      for (let r = 120; r < 150; r++) for (let c = 165; c < 175; c++) land.cells[r * COLS + c] = kind;
      const behind = archer(540, 450);
      // A blast right against the wall's left face.
      carve(land, 492, 420, 30);
      return { land, behind };
    };
    const city = shelter(BUILDING);
    const open = shelter(DIRT);
    // The wall still stands in the City; the dirt wall is gone.
    expect(cellAt(city.land, 172, 140)).toBe(BUILDING);
    expect(cellAt(open.land, 166, 140)).toBe(AIR);
  });
});
