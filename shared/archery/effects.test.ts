import { describe, expect, it } from 'vitest';
import { arrowKind } from './arrows';
import {
  APPLE_HEALTH, BOLT_RANGE_MIN, BOLT_RANGE_PER, CELL, COLS, GLASS_STING, GOO_DAMAGE, GOO_SHOTS, MOLE_DEPTH, ROWS, START_HEALTH,
} from './config';
import { pool } from './effects';
import { copyRound, newRound, playFight, playShot, shotProblem, startFight, takeShot } from './fight';
import { cellAt, surfaceRow } from './land';
import { AIR, DIRT, type Archer, type ArrowId, type FightSetup, type Land, type Round, type Shot, type ShotEvent } from './types';

const GROUND = 150; // the flat ground's top row (y = 450)
const none: FightSetup = { world: 'forest', players: [{ quiver: {}, shield: null }, { quiver: {}, shield: null }] };

const archer = (x: number, y = GROUND * CELL, extra: Partial<Archer> = {}): Archer => ({ x, y, health: START_HEALTH, shield: 0, popped: false, shardsBy: -1, ...extra });

/** A round on flat ground (or `shape`d ground: the top row for each column), no wind, archers at x 150 and 810. */
function flatRound(shape?: (c: number) => number, setup: FightSetup = none): Round {
  const round = newRound(5, 0, setup);
  round.wind = 0;
  const land = round.land;
  land.cells.fill(AIR);
  for (let c = 0; c < COLS; c++) {
    const top = shape ? shape(c) : GROUND;
    for (let r = top; r < ROWS; r++) land.cells[r * COLS + c] = DIRT;
  }
  const at = (x: number) => surfaceRow(land, Math.floor(x / CELL)) * CELL;
  const gear = (a: Archer): Partial<Archer> => ({ guard: a.guard, shield: a.shield, bubble: a.bubble, bow: a.bow, umbrellas: a.umbrellas });
  round.archers = [archer(150, at(150), gear(round.archers[0])), archer(810, at(810), gear(round.archers[1]))];
  return round;
}

const shoot = (round: Round, player: number, angle: number, power: number, arrow: ArrowId, extra: Partial<Shot> = {}) =>
  playShot(round, player, { angle, power, arrow, ...extra }, true);
const events = (rec: { events?: ShotEvent[] }, k: ShotEvent['k']) => (rec.events ?? []).filter((e) => e.k === k);
const solidCount = (land: Land) => land.cells.reduce((n, v) => n + (v !== AIR ? 1 : 0), 0);

/** The power (40–100) at which a 45° shot from the left archer lands closest to x, on this round (flown on copies). */
function powerToLandAt(make: () => Round, x: number, arrow: ArrowId = 'plain', angle = 45): number {
  let best = 40, bestMiss = Infinity;
  for (let p = 20; p <= 100; p++) {
    const rec = playShot(make(), 0, { angle, power: p, arrow });
    const miss = Math.abs(rec.hit.x - x);
    if (miss < bestMiss) {
      bestMiss = miss;
      best = p;
    }
  }
  return best;
}

describe('Stage 3 arrows', () => {
  it('Arrow Rain splits at the top into 5 small arrows, each with its own blast', () => {
    const rec = shoot(flatRound(), 0, 60, 70, 'rain');
    expect(events(rec, 'fly').filter((e) => e.k === 'fly' && e.part === 'child')).toHaveLength(5);
    expect(events(rec, 'blast')).toHaveLength(5);
    expect(rec.hit.kind).not.toBe('split');
  });

  it('a Rolling Log rolls down into the valley and bursts there', () => {
    // A V-shaped valley with its bottom at column 160 (x 480).
    const vee = (c: number) => GROUND - Math.floor(Math.abs(c - 160) / 3);
    const make = () => flatRound(vee);
    const p = powerToLandAt(make, 330);
    const rec = shoot(make(), 0, 45, p, 'log');
    const roll = events(rec, 'roll')[0];
    expect(roll).toBeDefined();
    const blast = events(rec, 'blast')[0];
    expect(blast.k === 'blast' && Math.abs(blast.x - 480)).toBeLessThan(30);
  });

  it('a Rolling Log bursts when it rolls into an archer', () => {
    // A slope down toward the right archer.
    const slope = (c: number) => 60 + Math.floor(c / 3);
    const make = () => flatRound(slope);
    const p = powerToLandAt(make, 600);
    const round = make();
    const rec = shoot(round, 0, 45, p, 'log');
    expect(rec.damage[1]).toBeGreaterThan(0);
  });

  it('a Mole Arrow digs a deep hole straight down', () => {
    const round = flatRound();
    const p = powerToLandAt(flatRound, 480);
    const rec = shoot(round, 0, 45, p, 'mole');
    expect(events(rec, 'dig')).toHaveLength(1);
    const col = Math.floor(rec.hit.x / CELL);
    expect(surfaceRow(round.land, col)).toBeGreaterThanOrEqual(GROUND + Math.floor(MOLE_DEPTH / CELL) - 2);
  });

  it('a Mole Arrow under an archer drops them into the hole', () => {
    const round = flatRound();
    const p = powerToLandAt(flatRound, 800);
    const before = round.archers[1].y;
    shoot(round, 0, 45, p, 'mole');
    expect(round.archers[1].y).toBeGreaterThan(before + 30);
  });

  it('a Sneaky Mole tunnels to the other archer and pops up under them', () => {
    const round = flatRound();
    const p = powerToLandAt(flatRound, 640);
    const rec = shoot(round, 0, 45, p, 'sneaky');
    expect(events(rec, 'dig')).toHaveLength(1);
    expect(rec.damage[1]).toBeGreaterThan(20);
  });

  it('a Skipping Arrow hops twice, with 3 growing blasts', () => {
    const rec = shoot(flatRound(), 0, 45, 55, 'skip');
    const blasts = events(rec, 'blast').map((e) => (e.k === 'blast' ? e.r : 0));
    expect(blasts).toEqual([16, 20, 26]);
    expect(events(rec, 'fly').filter((e) => e.k === 'fly' && e.part === 'hop')).toHaveLength(2);
  });

  it('a Mud Ball adds a heap of dirt, and can bury an archer', () => {
    const round = flatRound();
    const before = solidCount(round.land);
    const p = powerToLandAt(flatRound, 810);
    const rec = shoot(round, 0, 45, p, 'mud');
    expect(solidCount(round.land)).toBeGreaterThan(before + 200);
    expect(rec.damage[1]).toBeLessThanOrEqual(10); // dirt doesn't hurt (only a direct hit's bonus)
    // Buried: there's dirt where their head is.
    const a = round.archers[1];
    expect(cellAt(round.land, Math.floor(a.x / CELL), Math.floor((a.y - 20) / CELL))).toBe(DIRT);
  });

  it('a buried archer digs out without hurting themselves', () => {
    const round = flatRound();
    shoot(round, 0, 45, powerToLandAt(flatRound, 810), 'mud');
    const h = round.archers[1].health;
    const rec = shoot(round, 1, 120, 60, 'plain');
    expect(rec.damage[1]).toBe(0);
    expect(round.archers[1].health).toBe(h);
  });

  it('Sticky Goo pools in the dip and hurts anyone standing in it for a few shots', () => {
    // A dip around the right archer.
    const dip = (c: number) => (Math.abs(c - 270) < 12 ? GROUND + 6 : GROUND);
    const make = () => flatRound(dip);
    const round = make();
    const p = powerToLandAt(make, 780);
    const rec = shoot(round, 0, 45, p, 'goo');
    expect(events(rec, 'goo')).toHaveLength(1);
    expect(round.goo).toHaveLength(1);
    expect(rec.goo[1]).toBe(GOO_DAMAGE);
    // No crater.
    expect(surfaceRow(round.land, Math.floor(rec.hit.x / CELL))).toBeGreaterThanOrEqual(GROUND);
    let total = 1;
    for (let i = 0; i < 6; i++) {
      const r2 = shoot(round, i % 2, i % 2 ? 180 : 0, 1, 'plain');
      if (r2.goo[1] > 0) total++;
    }
    expect(total).toBe(GOO_SHOTS);
    expect(round.goo).toHaveLength(0);
  });

  it('pools goo at the bottom of a dip', () => {
    const land: Land = { cells: new Uint8Array(COLS * ROWS) };
    for (let c = 0; c < COLS; c++) for (let r = GROUND + (Math.abs(c - 100) < 5 ? 5 : 0); r < ROWS; r++) land.cells[r * COLS + c] = DIRT;
    const p = pool(land, 97)!;
    const flat = pool(land, 40)!;
    expect(flat.c1 - flat.c0).toBeLessThanOrEqual(12);
    expect(flat.level).toBe(GROUND - 1);
    expect(p.c0).toBeGreaterThanOrEqual(94);
    expect(p.c1).toBeLessThanOrEqual(106);
    expect(p.level).toBeLessThan(GROUND + 5);
  });

  it('an Earth Shaker crumbles a cliff and tumbles an archer off its ledge', () => {
    // The right archer stands on a tall plateau; the cliff edge is just left of them.
    const cliff = (c: number) => (c >= 262 ? GROUND - 40 : GROUND);
    const make = () => flatRound(cliff);
    const round = make();
    const startY = round.archers[1].y;
    const p = powerToLandAt(make, 780);
    shoot(round, 0, 45, p, 'shaker');
    // The cliff is now a slope: no step of more than a couple of cells near the edge.
    let steepest = 0;
    for (let c = 240; c < 300; c++) steepest = Math.max(steepest, Math.abs(surfaceRow(round.land, c) - surfaceRow(round.land, c + 1)));
    expect(steepest).toBeLessThanOrEqual(2);
    expect(round.archers[1].y).toBeGreaterThan(startY);
  });

  it('an Owl Arrow steers in to hit an archer that a Plain Arrow just misses', () => {
    let found = false;
    for (let p = 40; p <= 100 && !found; p++) {
      const plain = playShot(flatRound(), 0, { angle: 50, power: p, arrow: 'plain' });
      const owl = playShot(flatRound(), 0, { angle: 50, power: p, arrow: 'owl' });
      if (plain.hit.kind !== 'archer' && owl.hit.kind === 'archer') found = true;
    }
    expect(found).toBe(true);
  });

  it('a Firework Arrow makes 5 pops', () => {
    const rec = shoot(flatRound(), 0, 45, 60, 'firework');
    expect(events(rec, 'blast')).toHaveLength(5);
  });

  it('a Crossbow Bolt flies dead straight, cuts through a dirt wall, and pops at the end of its range', () => {
    // A wall 10 cells thick in front of the left archer.
    const wall = (c: number) => (c >= 70 && c < 80 ? GROUND - 20 : GROUND);
    const round = flatRound(wall);
    const a = round.archers[0];
    const power = 80;
    const rec = shoot(round, 0, 0, power, 'bolt');
    expect(rec.hit.kind).toBe('spent');
    const range = BOLT_RANGE_MIN + power * BOLT_RANGE_PER;
    expect(Math.abs(rec.hit.x - a.x - range)).toBeLessThan(6);
    expect(rec.hit.y).toBeCloseTo(a.y - 15, 6); // no drop
    // A tunnel through the wall (the dirt above it then falls in, so the wall is lower).
    expect(surfaceRow(round.land, 75)).toBeGreaterThan(GROUND - 20);
  });

  it('a Giant Arrow leaves a huge crater', () => {
    const round = flatRound();
    const before = solidCount(round.land);
    shoot(round, 0, 45, 55, 'giant');
    expect(before - solidCount(round.land)).toBeGreaterThan(900);
  });
});

describe("the Glass Arrow (the pupil's arrow)", () => {
  const glassSetup: FightSetup = { world: 'forest', players: [{ quiver: { glass: 3 }, shield: null }, { quiver: {}, shield: null }] };

  /** A round where the left archer stabs the right one, the right one then shoots `reply` (or a reply that hurts, if `hitBack`). */
  function stabThen(reply: Shot, hitBack = false) {
    const make = () => flatRound(undefined, glassSetup);
    const round = make();
    const p = powerToLandAt(make, 810, 'glass');
    const stab = shoot(round, 0, 45, p, 'glass');
    if (hitBack) {
      for (let k = 30; k <= 100; k++) {
        const rec = playShot(copyRound(round), 1, { angle: 135, power: k, arrow: 'plain' });
        if (rec.damage[0] > 0) {
          reply = { angle: 135, power: k, arrow: 'plain' };
          break;
        }
      }
    }
    const after = shoot(round, 1, reply.angle, reply.power, reply.arrow);
    return { round, stab, after };
  }

  it('leaves shards, and pops them at the end of their turn if they don\'t hit back', () => {
    const { round, stab, after } = stabThen({ angle: 90, power: 0, arrow: 'plain' });
    expect(stab.after[1].shardsBy).toBe(0);
    expect(events(stab, 'shards')).toBeDefined();
    expect(after.glass).toBe('popped');
    expect(round.archers[1].popped).toBe(true);
  });

  it('breaks when they hit back, with a sting', () => {
    const { round, stab, after } = stabThen({ angle: 90, power: 0, arrow: 'plain' }, true);
    expect(after.damage[0]).toBeGreaterThan(0);
    expect(after.glass).toBe('broke');
    expect(after.sting).toBe(GLASS_STING);
    expect(round.archers[1].popped).toBe(false);
    expect(round.archers[1].health).toBe(stab.after[1].health - (after.damage[1] - GLASS_STING) - GLASS_STING);
    expect(round.archers[1].shardsBy).toBe(-1);
  });

  it('a near miss (inside the blast) leaves shards too', () => {
    const make = () => flatRound(undefined, glassSetup);
    const p = powerToLandAt(make, 790, 'glass');
    const rec = playShot(make(), 0, { angle: 45, power: p, arrow: 'glass' });
    expect(rec.hit.kind).toBe('land');
    expect(rec.after[1].shardsBy).toBe(0);
  });

  it('just breaks if the Glass shooter has already popped', () => {
    const make = () => flatRound(undefined, glassSetup);
    const round = make();
    shoot(round, 0, 45, powerToLandAt(make, 810, 'glass'), 'glass');
    round.archers[0].popped = true;
    round.archers[0].health = 0;
    const after = shoot(round, 1, 90, 0, 'plain');
    expect(after.glass).toBe('broke');
    expect(after.sting).toBe(0);
    expect(round.archers[1].popped).toBe(false);
  });
});

describe('shields, helpers and bows', () => {
  it('starts each shield full, and carries what is left of it into the next round', () => {
    const setup: FightSetup = { world: 'forest', players: [{ quiver: {}, shield: 'wood' }, { quiver: {}, shield: 'bubble' }] };
    const r = newRound(1, 0, setup);
    expect([r.archers[0].shield, r.archers[1].shield]).toEqual([40, 60]);
    r.archers[1].shield = 12;
    r.archers[1].bubble = false;
    const next = newRound(1, 1, setup, [{}, {}], r.archers);
    expect(next.archers[1].shield).toBe(12);
    expect(next.archers[1].bubble).toBe(false);
    expect(newRound(1, 0, { ...setup, players: [{ quiver: {}, shield: 'charm' }, setup.players[1]] }).archers[0].shield).toBe(30);
  });

  it('a Bubble Shield bounces away the first arrow of the round, then not the next', () => {
    const setup: FightSetup = { world: 'forest', players: [{ quiver: {}, shield: null }, { quiver: {}, shield: 'bubble' }] };
    const make = () => flatRound(undefined, setup);
    // A shot that hits them square without the bubble.
    let p = 0;
    for (let k = 40; k <= 100 && !p; k++) if (playShot(flatRound(), 0, { angle: 45, power: k, arrow: 'plain' }).hit.kind === 'archer') p = k;
    expect(p).toBeGreaterThan(0);
    const round = make();
    const first = shoot(round, 0, 45, p, 'plain');
    expect(events(first, 'bounce').some((e) => e.k === 'bounce' && e.what === 'bubble')).toBe(true);
    expect(first.hit.kind).not.toBe('archer');
    expect(round.archers[1].bubble).toBe(false);
  });

  it('a Wind Charm pushes arrows that were coming down on its wearer further away', () => {
    const setup: FightSetup = { world: 'forest', players: [{ quiver: {}, shield: null }, { quiver: {}, shield: 'charm' }] };
    let without = 0, withCharm = 0, n = 0, hitsWithout = 0, hitsWith = 0;
    for (const angle of [45, 55, 65]) {
      for (let k = 40; k <= 100; k++) {
        const a = playShot(flatRound(), 0, { angle, power: k, arrow: 'plain' });
        if (Math.abs(a.hit.x - 810) > 60) continue;
        const b = playShot(flatRound(undefined, setup), 0, { angle, power: k, arrow: 'plain' });
        without += Math.abs(a.hit.x - 810);
        withCharm += Math.abs(b.hit.x - 810);
        if (a.hit.kind === 'archer') hitsWithout++;
        if (b.hit.kind === 'archer') hitsWith++;
        n++;
      }
    }
    expect(n).toBeGreaterThan(5);
    expect(withCharm / n).toBeGreaterThan(without / n + 3);
    expect(hitsWith).toBeLessThan(hitsWithout);
  });

  it('an Apple gives +15 health (never over full), and only if you packed one', () => {
    const setup: FightSetup = { world: 'forest', players: [{ quiver: { apple: 1 }, shield: null }, { quiver: {}, shield: null }] };
    const round = flatRound(undefined, setup);
    round.archers[0].health = 50;
    const rec = shoot(round, 0, 90, 0, 'plain', { apple: true });
    expect(rec.apple).toBe(APPLE_HEALTH);
    const full = flatRound(undefined, setup);
    expect(shoot(full, 0, 90, 0, 'plain', { apple: true }).apple).toBe(0);
    expect(shotProblem({ angle: 45, power: 50, arrow: 'plain', apple: true }, setup, 0, { apple: 1 })).toMatch(/Apple/);
    expect(shotProblem({ angle: 45, power: 50, arrow: 'plain', apple: true }, setup, 1, {})).toMatch(/Apple/);
    // Counted as used in a fight.
    const run = startFight(3, setup);
    takeShot(run, { angle: 45, power: 50, arrow: 'plain', apple: true });
    expect(run.used[0].apple).toBe(1);
  });

  it('an Umbrella opens by itself when you fall, so the fall does not hurt', () => {
    const setup: FightSetup = { world: 'forest', players: [{ quiver: {}, shield: null }, { quiver: { umbrella: 1 }, shield: null }] };
    // A Mole Arrow straight into them digs the ground out from under their feet.
    let p = 0;
    for (let k = 50; k <= 100 && !p; k++) {
      const h = playShot(flatRound(), 0, { angle: 45, power: k, arrow: 'mole' }).hit;
      if (h.kind === 'archer' && h.archer === 1) p = k;
    }
    expect(p).toBeGreaterThan(0);
    const rec = shoot(flatRound(undefined, setup), 0, 45, p, 'mole');
    expect(rec.fell[1]).toBeGreaterThan(5);
    expect(rec.umbrella[1]).toBe(true);
    const bare = shoot(flatRound(), 0, 45, p, 'mole');
    expect(rec.damage[1]).toBeLessThan(bare.damage[1]);
  });

  it('counts used Umbrellas in a fight and carries the rest into the next round', () => {
    const setup: FightSetup = { world: 'forest', players: [{ quiver: { umbrella: 2 }, shield: null }, { quiver: {}, shield: null }] };
    const r = newRound(1, 1, setup, [{ umbrella: 1 }, {}]);
    expect(r.archers[0].umbrellas).toBe(1);
  });

  it('a Longbow sends the same shot further than the Starter Bow', () => {
    const long: FightSetup = { world: 'forest', players: [{ quiver: {}, shield: null, bow: 'long' }, { quiver: {}, shield: null }] };
    const a = playShot(flatRound(), 0, { angle: 45, power: 40, arrow: 'plain' });
    const b = playShot(flatRound(undefined, long), 0, { angle: 45, power: 40, arrow: 'plain' });
    expect(b.hit.x).toBeGreaterThan(a.hit.x + 20);
  });

  it('a Recurve Bow drifts less in the wind', () => {
    const rec: FightSetup = { world: 'forest', players: [{ quiver: {}, shield: null, bow: 'recurve' }, { quiver: {}, shield: null }] };
    const calm = playShot(flatRound(undefined, rec), 0, { angle: 60, power: 50, arrow: 'plain' });
    const windy = (s: FightSetup) => {
      const r = flatRound(undefined, s);
      r.wind = -10;
      return playShot(r, 0, { angle: 60, power: 50, arrow: 'plain' });
    };
    const starterCalm = playShot(flatRound(), 0, { angle: 60, power: 50, arrow: 'plain' });
    const driftStarter = starterCalm.hit.x - windy(none).hit.x;
    const driftRecurve = calm.hit.x - windy(rec).hit.x;
    expect(driftRecurve).toBeLessThan(driftStarter);
  });

  it('replays fights with every arrow, shield and helper the same way', () => {
    const quiver = Object.fromEntries(['steel', 'log', 'mole', 'mud', 'rain', 'skip', 'goo', 'shaker', 'owl', 'firework', 'sneaky', 'bolt', 'giant', 'glass', 'apple', 'umbrella'].map((k) => [k, 9]));
    const setup: FightSetup = { world: 'snow', players: [{ quiver, shield: 'bubble', bow: 'golden' }, { quiver, shield: 'charm', bow: 'recurve' }] };
    const kinds = Object.keys(quiver).filter((k) => k !== 'apple' && k !== 'umbrella') as ArrowId[];
    const shots: Shot[] = [];
    for (let i = 0; i < 60; i++) shots.push({ angle: i % 2 ? 125 : 55, power: 45 + ((i * 13) % 50), arrow: i % 4 === 0 ? 'plain' : kinds[i % kinds.length], apple: i % 9 === 0 });
    const a = playFight(42, setup, shots);
    const b = playFight(42, setup, shots);
    expect(b).toEqual(a);
    expect(arrowKind('glass').forSale).toBe(true);
  });
});
