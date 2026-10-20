import { describe, expect, it } from 'vitest';
import { TURN_MAX, TURN_UNIT } from '../../../shared/mine/config';
import { encodeInputs, packInput, pushInput, unpackInput } from '../../../shared/mine/inputs';
import { AIM_EVERY, Controls, KEY_TURN, MouseAim, MOUSE_RAD_PER_PX } from './controls';

describe('keyboard', () => {
  it('turns W A S D R F into pushes, and Space and Shift into the weapons', () => {
    const c = new Controls();
    c.keyDown('KeyW');
    c.keyDown('KeyD');
    c.keyDown('KeyR');
    c.keyDown('Space');
    c.keyDown('ShiftLeft');
    const i = c.sample();
    expect(i).toMatchObject({ tz: 1, tx: 1, ty: 1, fire: true, missile: true, roll: 0 });
    c.keyUp('KeyW');
    c.keyUp('KeyD');
    c.keyUp('KeyR');
    c.keyUp('Space');
    c.keyUp('ShiftLeft');
    expect(c.sample()).toMatchObject({ tz: 0, tx: 0, ty: 0, fire: false, missile: false });
  });
  it('lets opposite keys cancel, and uses X as a missile key too', () => {
    const c = new Controls();
    c.keyDown('KeyA');
    c.keyDown('KeyD');
    c.keyDown('KeyF');
    c.keyDown('KeyX');
    expect(c.sample()).toMatchObject({ tx: 0, ty: -1, missile: true });
  });
  it('turns with the arrow keys at a steady rate and rolls with Q and E', () => {
    const c = new Controls();
    c.keyDown('ArrowRight');
    c.keyDown('ArrowUp');
    c.keyDown('KeyE');
    expect(c.sample()).toMatchObject({ yaw: KEY_TURN, pitch: KEY_TURN, roll: 1 });
    c.clear();
    c.keyDown('ArrowLeft');
    c.keyDown('KeyQ');
    expect(c.sample()).toMatchObject({ yaw: -KEY_TURN, roll: -1 });
  });
  it('says whether it used the key, so the page only stops scrolling for keys the game uses', () => {
    const c = new Controls();
    expect(c.keyDown('Space')).toBe(true);
    expect(c.keyDown('KeyZ')).toBe(false);
  });
  it('lets go of everything on clear', () => {
    const c = new Controls();
    c.keyDown('KeyW');
    c.setButton('fire', true);
    c.setMove(1, 1);
    c.clear();
    expect(c.sample()).toMatchObject({ tz: 0, tx: 0, fire: false });
  });
});

describe('mouse', () => {
  it('turns mouse movement into whole numbers about 10 times a second and holds them between', () => {
    const c = new Controls();
    c.mouseMoved(30, 0);
    const first = c.sample();
    const second = c.sample();
    const third = c.sample();
    expect(Number.isInteger(first.yaw)).toBe(true);
    expect(first.yaw).toBeGreaterThan(0);
    expect(second.yaw).toBe(first.yaw);
    expect(third.yaw).toBe(first.yaw);
    expect(AIM_EVERY).toBe(3);
    // The next update has nothing left to turn by.
    expect(c.sample().yaw).toBeLessThan(first.yaw);
  });
  it('never asks for more than the biggest turn', () => {
    const c = new Controls();
    c.mouseMoved(100000, -100000);
    const i = c.sample();
    expect(i.yaw).toBe(TURN_MAX);
    expect(i.pitch).toBe(TURN_MAX);
  });
  it('looks up when the mouse goes up, unless flipped', () => {
    const c = new Controls();
    c.mouseMoved(0, -40);
    expect(c.sample().pitch).toBeGreaterThan(0);
    const d = new Controls();
    d.settings = { sensitivity: 1, invertY: true, lock: false };
    d.mouseMoved(0, -40);
    expect(d.sample().pitch).toBeLessThan(0);
  });
  it('carries slow movement over so tiny nudges still add up', () => {
    const c = new Controls();
    let total = 0;
    for (let n = 0; n < 60; n++) {
      c.mouseMoved(2, 0);
      total += c.sample().yaw * TURN_UNIT;
    }
    // 60 nudges of 2 pixels is 120 pixels of turn; each sample is one step, so the sum is the angle turned.
    const wanted = 120 * MOUSE_RAD_PER_PX;
    expect(total).toBeGreaterThan(wanted * 0.8);
    expect(total).toBeLessThan(wanted * 1.2);
  });
  it('fires with the mouse buttons and with a quick tap', () => {
    const c = new Controls();
    c.setMouseButtons(true, false);
    expect(c.sample()).toMatchObject({ fire: true, missile: false });
    c.setMouseButtons(false, true);
    expect(c.sample()).toMatchObject({ fire: false, missile: true });
    c.setMouseButtons(false, false);
    c.tap();
    const burst = [c.sample(), c.sample(), c.sample(), c.sample(), c.sample(), c.sample()].map((i) => i.fire);
    expect(burst).toEqual([true, true, true, true, true, false]);
  });
});

describe('MouseAim', () => {
  it('keeps what is left after each take', () => {
    const m = new MouseAim();
    m.add(TURN_UNIT * AIM_EVERY * 2.4, 0);
    expect(m.take().yaw).toBe(2);
    const rest = m.take().yaw;
    expect(rest).toBe(0);
  });
});

describe('thumb sticks and buttons', () => {
  it('moves with the left stick, ignoring tiny pushes', () => {
    const c = new Controls();
    c.setMove(0.1, -0.1);
    expect(c.sample()).toMatchObject({ tx: 0, tz: 0 });
    c.setMove(0.9, -0.8);
    expect(c.sample()).toMatchObject({ tx: 1, tz: 1 });
    c.setMove(-0.9, 0.8);
    expect(c.sample()).toMatchObject({ tx: -1, tz: -1 });
  });
  it('turns with the right stick, gently for small pushes and flips with the setting', () => {
    const c = new Controls();
    c.setLook(0.5, 0);
    const gentle = c.sample().yaw;
    const d = new Controls();
    d.setLook(1, 0);
    const full = d.sample().yaw;
    expect(gentle).toBeGreaterThan(0);
    expect(gentle).toBeLessThan(full);
    expect(full).toBe(TURN_MAX);
    const up = new Controls();
    up.setLook(0, -1);
    expect(up.sample().pitch).toBeGreaterThan(0);
  });
  it('rises, sinks, fires and launches from the big buttons', () => {
    const c = new Controls();
    c.setButton('up', true);
    c.setButton('fire', true);
    c.setButton('missile', true);
    expect(c.sample()).toMatchObject({ ty: 1, fire: true, missile: true });
    c.setButton('up', false);
    c.setButton('down', true);
    expect(c.sample().ty).toBe(-1);
  });
});

describe('what is recorded', () => {
  it('always packs into a whole number the rules accept, and comes back out the same', () => {
    const c = new Controls();
    c.keyDown('KeyW');
    c.keyDown('ArrowLeft');
    c.mouseMoved(500, 200);
    for (let n = 0; n < 30; n++) {
      const i = c.sample();
      const code = packInput(i);
      expect(Number.isInteger(code)).toBe(true);
      expect(unpackInput(code)).toEqual(i);
    }
  });
});

describe('how big a recorded run is', () => {
  it('stays small for three minutes of a nervous mouse, because aim is only updated 10 times a second', () => {
    const c = new Controls();
    let seed = 99;
    const rnd = () => ((seed = (seed * 48271) % 2147483647) / 2147483647) - 0.5;
    const runs: [number, number][] = [];
    c.keyDown('KeyW');
    const steps = 30 * 180;
    for (let n = 0; n < steps; n++) {
      // A mouse event every other step (about 15 a second), a different size each time.
      if (n % 2 === 0) c.mouseMoved(rnd() * 60, rnd() * 40);
      if (n % 90 === 0) (n / 90) % 2 ? c.keyDown('Space') : c.keyUp('Space');
      pushInput(runs, packInput(c.sample()));
    }
    const text = encodeInputs(runs);
    expect(text.length).toBeLessThan(60_000);
    // For the record: this is the number the plan was worried about (Stage 1 measured the worst case at 38 KB with no 10-a-second rule).
    console.log(`three minutes of nervous mouse: ${text.length} characters, ${runs.length} runs`);
  });
});
