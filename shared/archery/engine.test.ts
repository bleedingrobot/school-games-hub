import { describe, expect, it } from 'vitest';
import { AIM_X, AIM_Y, clampAngle } from './aim';
import { ARROWS, arrowKind, armoryArrows, botArrows } from './arrows';
import {
  CELL, COLS, DIRECT_HIT_BONUS, FALL_DAMAGE_CAP, FIELD_H, FIELD_W, HILL_MIN_RISE, LAND_MAX_HEIGHT,
  MAX_ROUNDS, MAX_SHOT_DAMAGE, MAX_SHOTS_PER_ROUND, ROWS, START_HEALTH,
} from './config';
import { blastDamage, fallDamage, hurt } from './damage';
import { newRound, playFight, playShot, roundWinner, shotProblem } from './fight';
import {
  addDirt, canSee, carve, cellAt, dropArcher, emptyLand, hillRise, makeRoundLand, settle, standing,
} from './land';
import { makeRandom, mixSeed } from './random';
import { flyArrow } from './shot';
import { AIR, BUILDING, DIRT, WORLD_IDS, type Archer, type FightSetup, type Land, type Shot } from './types';

/** The top of the land itself in a column, leaving out trees and ice (they stand on it). */
function groundRow(land: Land, col: number): number {
  for (let r = 0; r < ROWS; r++) {
    const v = land.cells[r * COLS + col];
    if (v === DIRT || v === BUILDING) return r;
  }
  return ROWS;
}

const archer = (x: number, y: number, health = START_HEALTH): Archer => ({ x, y, health, shield: 0, popped: false });
const plainOnly: FightSetup = { world: 'forest', players: [{ quiver: {}, shield: null }, { quiver: {}, shield: null }] };

describe('random', () => {
  it('gives the same numbers from the same seed, and different ones from another', () => {
    const a = makeRandom(42), b = makeRandom(42), c = makeRandom(43);
    const xs = Array.from({ length: 20 }, () => a.next());
    expect(Array.from({ length: 20 }, () => b.next())).toEqual(xs);
    expect(Array.from({ length: 20 }, () => c.next())).not.toEqual(xs);
  });

  it('keeps range() and fraction() inside their limits', () => {
    const r = makeRandom(7);
    for (let i = 0; i < 2000; i++) {
      const v = r.range(-10, 10);
      expect(v).toBeGreaterThanOrEqual(-10);
      expect(v).toBeLessThanOrEqual(10);
      const f = r.fraction();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it('mixes neighbouring seeds apart', () => {
    expect(mixSeed(1, 0)).not.toBe(mixSeed(1, 1));
    expect(mixSeed(1, 0)).not.toBe(mixSeed(2, 0));
  });
});

describe('aim table', () => {
  it('has one direction per whole degree that matches Math.cos and Math.sin closely', () => {
    expect(AIM_X).toHaveLength(181);
    expect(AIM_Y).toHaveLength(181);
    for (let d = 0; d <= 180; d++) {
      expect(Math.abs(AIM_X[d] - Math.cos((d * Math.PI) / 180))).toBeLessThan(1e-14);
      expect(Math.abs(AIM_Y[d] - Math.sin((d * Math.PI) / 180))).toBeLessThan(1e-14);
    }
    expect([AIM_X[0], AIM_Y[0], AIM_X[90], AIM_Y[90], AIM_X[180], AIM_Y[180]]).toEqual([1, 0, 0, 1, -1, 0]);
  });

  it('keeps angles to whole degrees from 0 to 180', () => {
    expect([clampAngle(-5), clampAngle(45.7), clampAngle(200)]).toEqual([0, 45, 180]);
  });
});

describe('land', () => {
  it.each(WORLD_IDS)('is properly hilly in the %s, and the archers can rarely see each other (1,000 seeds)', (world) => {
    let failed = 0, see = 0, tall = 0, relief = 0;
    for (let s = 0; s < 1000; s++) {
      const r = makeRoundLand(s, world);
      if (!r.passed) failed++;
      if (canSee(r.land, r.archers[0], r.archers[1])) see++;
      let top = ROWS, bottom = 0;
      for (let c = 0; c < COLS; c++) {
        const row = groundRow(r.land, c);
        if (row < top) top = row;
        if (row > bottom) bottom = row;
      }
      // Peaks (and rooftops) never go above the limit (75% of the height).
      expect(FIELD_H - top * CELL).toBeLessThanOrEqual(LAND_MAX_HEIGHT * FIELD_H + CELL);
      const rel = ((bottom - top) * CELL) / FIELD_H;
      relief += rel;
      if (rel >= 0.3) tall++;
    }
    expect(failed).toBeLessThanOrEqual(10);
    expect(see).toBeLessThanOrEqual(10);
    expect(tall).toBeGreaterThanOrEqual(900); // nearly every land rises and falls by 30% of the screen or more
    expect(relief / 1000).toBeGreaterThan(0.4);
  });

  it.each(WORLD_IDS)('puts a real hill (or building) between the archers in the %s, the left one on the left', (world) => {
    for (let s = 0; s < 50; s++) {
      const r = makeRoundLand(s, world);
      const [a, b] = r.archers;
      expect(a.x).toBeLessThan(FIELD_W / 2);
      expect(b.x).toBeGreaterThan(FIELD_W / 2);
      expect(standing(r.land, a) && standing(r.land, b)).toBe(true);
      expect(hillRise(r.land, a, b)).toBeGreaterThanOrEqual(HILL_MIN_RISE);
    }
  });

  it.each(WORLD_IDS)('makes the same %s land from the same seed', (world) => {
    const a = makeRoundLand(123, world), b = makeRoundLand(123, world);
    expect(Buffer.from(a.land.cells).equals(Buffer.from(b.land.cells))).toBe(true);
    expect(a.archers).toEqual(b.archers);
    expect(Buffer.from(makeRoundLand(124, world).land.cells).equals(Buffer.from(a.land.cells))).toBe(false);
  });

  it('carves a round hole, adds a ball of dirt, and lets loose dirt fall', () => {
    const land = emptyLand();
    for (let r = 100; r < ROWS; r++) for (let c = 0; c < COLS; c++) land.cells[r * COLS + c] = DIRT;
    settle(land, ...carve(land, 480, 330, 30));
    expect(cellAt(land, 160, 110)).toBe(AIR);
    expect(cellAt(land, 160, 125)).toBe(DIRT); // below the hole
    expect(cellAt(land, 175, 110)).toBe(DIRT); // beside it

    const [c0, c1] = addDirt(land, 300, 150, 15); // a dirt ball floating in the sky
    expect(cellAt(land, 100, 50)).toBe(DIRT);
    expect(settle(land, c0, c1)).toBe(true);
    expect(cellAt(land, 100, 50)).toBe(AIR);
    expect(cellAt(land, 100, 99)).toBe(DIRT); // landed on the ground
    expect(settle(land, 0, COLS - 1)).toBe(false); // nothing left to fall
  });

  it('drops an archer with nothing under them, with capped fall damage', () => {
    const land = emptyLand();
    for (let c = 0; c < COLS; c++) land.cells[(ROWS - 1) * COLS + c] = DIRT;
    const a = archer(480, 60);
    const fell = dropArcher(land, a);
    expect(a.y).toBe((ROWS - 1) * CELL);
    expect(fell).toBe(ROWS - 1 - 20);
    expect(fallDamage(fell)).toBe(FALL_DAMAGE_CAP);
    expect(fallDamage(1)).toBe(0); // a little step is free
    expect(fallDamage(10)).toBe(10);
  });
});

describe('shots', () => {
  const flat = () => {
    const land = emptyLand();
    for (let r = 150; r < ROWS; r++) for (let c = 0; c < COLS; c++) land.cells[r * COLS + c] = DIRT;
    return land;
  };

  it('flies the same way every time and lands on the land', () => {
    const land = flat();
    const archers = [archer(60, 450), archer(900, 450)];
    const a = flyArrow(land, archers, 0, { angle: 60, power: 50, arrow: 'plain' }, 0);
    expect(flyArrow(land, archers, 0, { angle: 60, power: 50, arrow: 'plain' }, 0)).toEqual(a);
    expect(a.hit.kind).toBe('land');
    expect(a.hit.y).toBeGreaterThanOrEqual(450);
    expect(a.path.length).toBeGreaterThan(10);
  });

  it('can hit the other archer, and wind pushes arrows', () => {
    const land = flat();
    const archers = [archer(60, 450), archer(900, 450)];
    let hits = 0;
    for (let p = 40; p <= 100; p++) {
      const f = flyArrow(land, archers, 0, { angle: 45, power: p, arrow: 'plain' }, 0);
      if (f.hit.kind === 'archer' && f.hit.archer === 1) hits++;
    }
    expect(hits).toBeGreaterThan(0);
    const still = flyArrow(land, archers, 0, { angle: 60, power: 50, arrow: 'plain' }, 0);
    const windy = flyArrow(land, archers, 0, { angle: 60, power: 50, arrow: 'plain' }, 10);
    const against = flyArrow(land, archers, 0, { angle: 60, power: 50, arrow: 'plain' }, -10);
    expect(windy.hit.x).toBeGreaterThan(still.hit.x);
    expect(against.hit.x).toBeLessThan(still.hit.x);
  });

  it('comes straight down on its own archer, and leaves by the side', () => {
    const land = flat();
    const archers = [archer(480, 450), archer(900, 450)];
    const up = flyArrow(land, archers, 0, { angle: 90, power: 60, arrow: 'plain' }, 0);
    expect(up.hit).toMatchObject({ kind: 'archer', archer: 0 });
    const away = flyArrow(land, archers, 0, { angle: 170, power: 100, arrow: 'plain' }, 0);
    expect(away.hit.kind).toBe('gone');
  });
});

describe('damage', () => {
  it('fades in a straight line from the blast centre to its edge', () => {
    const a = archer(100, 300);
    expect(blastDamage(a, 100, 290, 30, 40)).toBe(40); // inside the box
    expect(blastDamage(a, 121, 290, 30, 40)).toBe(20); // 15 px from the box's side: half way
    expect(blastDamage(a, 136, 290, 30, 40)).toBe(0); // at the edge
  });

  it('takes the shield first and pops an archer at 0', () => {
    const a = archer(100, 300, 30);
    a.shield = 20;
    expect(hurt(a, 25)).toBe(25);
    expect([a.shield, a.health, a.popped]).toEqual([0, 25, false]);
    expect(hurt(a, 40)).toBe(25);
    expect([a.health, a.popped]).toEqual([0, true]);
    expect(hurt(a, 10)).toBe(0); // popped archers sit out
  });

  it('never lets one arrow knock out a full-health archer (every arrow in the table)', () => {
    expect(MAX_SHOT_DAMAGE).toBeLessThan(START_HEALTH);
    for (const kind of ARROWS) {
      expect(kind.peakDamage + DIRECT_HIT_BONUS).toBeLessThanOrEqual(MAX_SHOT_DAMAGE);
      // The worst case: a direct hit on an archer standing on a thin ledge over a long drop, so the
      // blast also drops them. They shoot straight up and it comes back down on them.
      const round = newRound(5, 0, plainOnly);
      round.wind = 0;
      const land = round.land;
      land.cells.fill(AIR);
      for (let c = 0; c < COLS; c++) land.cells[(ROWS - 1) * COLS + c] = DIRT;
      for (let c = 100; c < 120; c++) land.cells[40 * COLS + c] = DIRT;
      round.archers[0] = archer(900, (ROWS - 1) * CELL);
      round.archers[1] = archer(330, 120);
      const rec = playShot(round, 1, { angle: 90, power: 30, arrow: kind.id }, false);
      // Arrow Rain splits at the top, and a Crossbow Bolt flies straight on: the rest come back down on them.
      if (kind.id !== 'rain' && kind.id !== 'bolt') expect(rec.hit.kind, kind.id).toBe('archer');
      expect(round.archers[1].popped, kind.id).toBe(false);
      expect(round.archers[1].health).toBeGreaterThanOrEqual(START_HEALTH - MAX_SHOT_DAMAGE);
    }
  });
});

describe('arrows', () => {
  it('has every arrow from the plan, all for sale except the free Plain Arrow', () => {
    expect(ARROWS.map((a) => a.id)).toEqual(['plain', 'steel', 'log', 'mole', 'mud', 'rain', 'skip', 'goo', 'shaker', 'owl', 'firework', 'sneaky', 'bolt', 'giant', 'glass']);
    expect(armoryArrows().map((a) => a.id)).toEqual(ARROWS.filter((a) => a.id !== 'plain').map((a) => a.id));
    expect(arrowKind('plain').unlimited).toBe(true);
    expect(arrowKind('steel')).toMatchObject({ price: 25, perPurchase: 2, level: 1 });
    expect(arrowKind('giant')).toMatchObject({ price: 200, perPurchase: 1, level: 5 });
    // Bigger than Stage 2's 18 px (James, 21 Oct 2026: shorter rounds).
    expect(arrowKind('plain').blastRadius).toBe(24);
  });

  it("sells the pupil's Glass Arrow (250 coins, level 5), but bots never pick it", () => {
    const glass = arrowKind('glass');
    expect(glass).toMatchObject({ name: 'Glass Arrow', forSale: true, price: 250, level: 5 });
    expect(botArrows().map((a) => a.id)).not.toContain('glass');
    expect(botArrows().map((a) => a.id)).toContain('plain');
    const setup: FightSetup = { world: 'forest', players: [{ quiver: { glass: 3 }, shield: null }, { quiver: {}, shield: null }] };
    expect(shotProblem({ angle: 45, power: 50, arrow: 'glass' }, setup, 0, {})).toBeNull();
    expect(shotProblem({ angle: 45, power: 50, arrow: 'glass' }, setup, 1, {})).toMatch(/left/);
  });
});

describe('fights', () => {
  it('refuses shots that break the rules', () => {
    const setup: FightSetup = { world: 'forest', players: [{ quiver: { steel: 1 }, shield: null }, { quiver: {}, shield: null }] };
    expect(shotProblem({ angle: 45.5, power: 50, arrow: 'plain' }, setup, 0, {})).toMatch(/angle/);
    expect(shotProblem({ angle: 45, power: 101, arrow: 'plain' }, setup, 0, {})).toMatch(/power/);
    expect(shotProblem({ angle: 45, power: 50, arrow: 'nope' as never }, setup, 0, {})).toMatch(/no such/);
    expect(shotProblem({ angle: 45, power: 50, arrow: 'steel' }, setup, 0, {})).toBeNull();
    expect(shotProblem({ angle: 45, power: 50, arrow: 'steel' }, setup, 0, { steel: 1 })).toMatch(/left/);
    expect(shotProblem({ angle: 45, power: 50, arrow: 'steel' }, setup, 1, {})).toMatch(/left/);
  });

  it('takes turns, counts the special arrows used, and stays "playing" when the shots run out', () => {
    const setup: FightSetup = { world: 'forest', players: [{ quiver: { steel: 2 }, shield: null }, { quiver: { steel: 2 }, shield: null }] };
    const shots: Shot[] = [
      { angle: 50, power: 60, arrow: 'steel' },
      { angle: 130, power: 60, arrow: 'plain' },
      { angle: 50, power: 70, arrow: 'plain' },
    ];
    const r = playFight(9, setup, shots);
    expect(r.status).toBe('playing');
    expect(r.shots.map((s) => s.player)).toEqual([0, 1, 0]);
    expect(r.used).toEqual([{ steel: 1 }, {}]);
    expect(r.nextPlayer).toBe(1);
  });

  it('gives each round new land and new wind from the seed', () => {
    const a = newRound(77, 0, plainOnly), b = newRound(77, 1, plainOnly);
    expect(a.landSeed).not.toBe(b.landSeed);
    expect(a.turn).toBe(0);
    expect(b.turn).toBe(1);
    expect(newRound(77, 1, plainOnly).wind).toBe(b.wind);
  });

  it('ends a round on a pop, or by health after too many shots', () => {
    const round = newRound(3, 0, plainOnly);
    expect(roundWinner(round)).toBeNull();
    round.archers[1].popped = true;
    expect(roundWinner(round)).toBe(0);
    round.archers[0].popped = true;
    expect(roundWinner(round)).toBe('draw');
    const long = newRound(3, 0, plainOnly);
    long.shots = MAX_SHOTS_PER_ROUND;
    long.archers[0].health = 40;
    expect(roundWinner(long)).toBe(1);
  });

  it('plays a whole best-of-3 fight to the end, the same way every time', () => {
    // Lobs back and forth, far more shots than a fight needs.
    const shots: Shot[] = [];
    for (let i = 0; i < 400; i++) shots.push({ angle: i % 2 === 0 ? 55 : 125, power: 55 + ((i * 7) % 40), arrow: 'plain' });
    const first = playFight(11, plainOnly, shots);
    expect(first.status).toBe('invalid'); // the shots outlast the fight
    expect(first.invalid).toMatch(/after the fight/);
    const n = first.shots.length;
    const r = playFight(11, plainOnly, shots.slice(0, n));
    expect(r.status).toBe('done');
    // Misses all round long end level, so draws can stretch the fight, up to MAX_ROUNDS.
    expect(r.winner).not.toBeNull();
    if (r.winner !== 'draw') expect(r.roundWins[r.winner!]).toBeGreaterThan(r.roundWins[1 - r.winner!]);
    expect(r.rounds.length).toBeGreaterThanOrEqual(2);
    expect(r.rounds.length).toBeLessThanOrEqual(MAX_ROUNDS);
    expect(r.nextPlayer).toBeNull();
    expect(playFight(11, plainOnly, shots.slice(0, n))).toEqual(r);
    // Health starts full each round, and the first turn swaps.
    const secondRound = r.shots.find((s) => s.round === 1)!;
    expect(secondRound.player).toBe(1);
  });

  it('only keeps flight paths when asked', () => {
    const shot: Shot[] = [{ angle: 45, power: 50, arrow: 'plain' }];
    expect(playFight(1, plainOnly, shot).shots[0].path).toBeUndefined();
    expect(playFight(1, plainOnly, shot, { keepPaths: true }).shots[0].path!.length).toBeGreaterThan(4);
  });
});
