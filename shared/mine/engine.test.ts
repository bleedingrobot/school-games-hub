import { describe, expect, it } from 'vitest';
import { EASY_MAX_SPEED, MAX_ENERGY, MAX_MISSILES, MAX_PAD_BONUSES, MAX_SHIELD, PAD_ANSWERS, PAD_BONUS_STEPS, USE_RANGE } from './config';
import { makeWorld, newRun, stepRun, type RunState, type World } from './engine';
import { GRANT, IDLE, NO_INPUT, packInput } from './inputs';
import { RECIPES, makeLevel } from './level';

const level3 = makeLevel(RECIPES[2]);

function setup(level = level3): { w: World; s: RunState } {
  const w = makeWorld(level, { steady: true });
  const s = newRun(w);
  s.fx = 0; s.fy = 1; s.fz = 0; s.ux = 0; s.uy = 0; s.uz = 1; s.rx = 1; s.ry = 0; s.rz = 0;
  return { w, s };
}
function placeAt(s: RunState, x: number, y: number, z: number): void {
  s.px = x; s.py = y; s.pz = z; s.vx = 0; s.vy = 0; s.vz = 0;
}

describe('the mine rules a pupil would notice', () => {
  const L = level3;
  const question = L.doors.findIndex((d) => d.kind === 'question');

  it('a right answer opens a question door only when the ship is close, and only once', () => {
    const { w, s } = setup(L);
    const d = L.doors[question];
    placeAt(s, d.x - USE_RANGE - 2, d.y, d.z);
    stepRun(w, s, GRANT + question);
    expect(s.doorsOpen[question]).toBe(0);
    expect(s.badGrants).toBe(1);
    placeAt(s, d.x - 2, d.y, d.z);
    stepRun(w, s, GRANT + question);
    expect(s.doorsOpen[question]).toBe(1);
    expect(s.doorsByAnswer).toBe(1);
    stepRun(w, s, GRANT + question);
    expect(s.badGrants).toBe(2);
  });

  it('a pad pays out on its second right answer, once, and the time bonus at most three times a run', () => {
    const L = makeLevel(RECIPES[5]);
    const { w, s } = setup(L);
    s.shield = 10; s.energy = 5; s.missiles = 0;
    let bonuses = 0;
    for (const pad of L.pads) {
      placeAt(s, pad.x, pad.y, pad.z);
      for (let k = 1; k < PAD_ANSWERS; k++) {
        stepRun(w, s, GRANT + pad.id);
        expect(s.padsUsed[pad.id - L.doors.length]).toBe(k);
        expect(s.padsByAnswer).toBeLessThan(L.pads.indexOf(pad) + 1); // nothing paid out yet
      }
      stepRun(w, s, GRANT + pad.id);
      expect(s.padsUsed[pad.id - L.doors.length]).toBe(PAD_ANSWERS);
      stepRun(w, s, GRANT + pad.id);
      bonuses = s.padBonuses;
    }
    expect(s.shield).toBe(MAX_SHIELD);
    expect(s.energy).toBe(MAX_ENERGY);
    expect(s.missiles).toBeGreaterThan(0);
    expect(s.missiles).toBeLessThanOrEqual(MAX_MISSILES);
    expect(bonuses).toBe(MAX_PAD_BONUSES);
    expect(s.bonus).toBe(MAX_PAD_BONUSES * PAD_BONUS_STEPS);
    expect(s.padsByAnswer).toBe(L.pads.length);
    expect(s.badGrants).toBe(L.pads.length); // each extra grant on a finished pad
  });
});

describe('easy flying (docs/plans/mine-flight/PLAN.md, M2)', () => {
  function easySetup(): { w: World; s: RunState; x: number; y: number; z: number } {
    const w = makeWorld(level3, { easy: true });
    const s = newRun(w);
    const room = level3.rooms[level3.start];
    return { w, s, x: room.cx + 0.5, y: room.cy + 0.5, z: room.cz + 0.5 };
  }

  it('is always steady, and old modes are not easy', () => {
    expect(makeWorld(level3, { easy: true, steady: false }).steady).toBe(true);
    expect(makeWorld(level3, { steady: true }).easy).toBe(false);
  });

  it('cruises forward with no input, never faster than its top speed, and the brake slows it', () => {
    const { w, s, x, y, z } = easySetup();
    placeAt(s, x, y, z);
    s.fx = 0; s.fy = 1; s.fz = 0; s.ux = 0; s.uy = 0; s.uz = 1; s.rx = 1; s.ry = 0; s.rz = 0;
    for (let i = 0; i < 6; i++) stepRun(w, s, IDLE);
    const speed = () => Math.sqrt(s.vx * s.vx + s.vy * s.vy + s.vz * s.vz);
    expect(s.vy).toBeGreaterThan(1);
    expect(speed()).toBeLessThanOrEqual(EASY_MAX_SPEED + 1e-9);
    const before = speed();
    for (let i = 0; i < 6; i++) stepRun(w, s, packInput({ ...NO_INPUT, tz: -1 }));
    expect(speed()).toBeLessThan(before / 2);
  });

  it('a wall close by pushes the ship back towards the middle', () => {
    const { w, s, x, y, z } = easySetup();
    const room = level3.rooms[level3.start];
    // Just inside the room's floor, braking so the cruise doesn't move it.
    const floor = room.cz - room.hz;
    placeAt(s, x, y, floor + 0.5);
    for (let i = 0; i < 10; i++) stepRun(w, s, packInput({ ...NO_INPUT, tz: -1 }));
    expect(s.pz).toBeGreaterThan(floor + 0.5);
    void z;
  });

  it('the same inputs give the same run', () => {
    const play = () => {
      const { w, s } = easySetup();
      for (let i = 0; i < 300; i++) stepRun(w, s, packInput({ ...NO_INPUT, yaw: (i % 40) < 20 ? 3 : -2, pitch: (i % 70) < 10 ? 2 : 0, fire: i % 7 === 0, tz: i % 90 > 80 ? -1 : 0 }));
      return [s.px, s.py, s.pz, s.energy, s.shots.length].join(',');
    };
    expect(play()).toBe(play());
  });
});
