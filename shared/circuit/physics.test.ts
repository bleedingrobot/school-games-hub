import { expect, it } from 'vitest';
import { CRASH_SPEED, RESTART_DELAY_STEPS } from './config';
import { NEUTRAL, decodeInput, decodeLog, encodeLog, inputCode, makeRecorder, type Input } from './inputs';
import { newRace, readyToRestart, replay, stateKey, step, type RaceEvent, type RaceState } from './physics';
import { parseRoad, type RoadDef } from './road';

const road = (rows: string[], extra: Partial<RoadDef> = {}) =>
  parseRoad({ id: 't', name: 'Test', world: 'motherboard', gravity: 16, battery: 100, signal: 100, rows, ...extra });

const none: Input = { turn: 0, accel: 0, jump: false };

/** Steps until the run ends or `n` steps pass; gives the end state and every event in order. */
function run(r: ReturnType<typeof road>, s0: RaceState, n: number, input: (s: RaceState, i: number) => Input = () => none) {
  let s = s0;
  const events: RaceEvent[] = [];
  for (let i = 0; i < n && s.outcome === 'racing'; i++) {
    const out = step(s, input(s, i), r);
    s = out.state;
    events.push(...out.events);
  }
  return { s, events };
}

it('lands without bouncing, slips off ledges and nudges off clipped corners', () => {
  const flat = road(['------- x40']);
  // A jump on the spot comes straight down and sticks (no bounce: James, 23 Nov 2026).
  const hop = run(flat, newRace(flat), 60, (_, i) => ({ ...none, jump: i === 0 }));
  expect(hop.events).toEqual(['jump', 'land']);
  expect(hop.s).toMatchObject({ y: 0, grounded: true, outcome: 'racing' });
  // A short drop just lands.
  expect(run(flat, { ...newRace(flat), y: 0.3, grounded: false }, 20).events).toEqual(['land']);
  // Steering doesn't work on cooling gel: the racer keeps going straight.
  const gel = road(['ggggggg x20']);
  expect(run(gel, { ...newRace(gel), vz: 4 }, 20, () => ({ ...none, turn: 1 })).s.x).toBe(3.5);

  // Half over an edge, the racer slides off it; in the middle of the lane it stays put.
  const strip = road(['..-.... x40']);
  expect(run(strip, { ...newRace(strip), x: 2.85 }, 90).s.outcome).toBe('fell');
  expect(run(strip, { ...newRace(strip), x: 2.5 }, 90).s.outcome).toBe('racing');

  // Clipping a chip's corner pushes the racer sideways (to the nearer side) instead of stopping it.
  const chip = road(['------- x5', '---1---', '------- x20']);
  const clip = run(chip, { ...newRace(chip), x: 3.1, vz: 8 }, 30);
  expect(clip.events).toContain('nudge');
  expect(clip.s.outcome).toBe('racing');
  expect(clip.s.x).toBeCloseTo(2.85);
  expect(clip.s.z).toBeGreaterThan(8);
});

it('crashes or bonks by speed, Auto-Pilot saves a near miss, battery and signal run out, and runs replay by distance', () => {
  // Hit a wall face above half speed: boom. Below it: a bonk that just stops you.
  const wall = road(['------- x5', '1111111', '------- x5']);
  const fast = run(wall, { ...newRace(wall), vz: CRASH_SPEED + 1 }, 30);
  expect(fast.events).toEqual(['crash']);
  expect(fast.s.outcome).toBe('crashed');
  let after = fast.s;
  for (let i = 0; i < RESTART_DELAY_STEPS; i++) {
    expect(readyToRestart(after)).toBe(false);
    after = step(after, none, wall).state;
  }
  expect(readyToRestart(after)).toBe(true);
  const slow = run(wall, { ...newRace(wall), vz: CRASH_SPEED - 1 }, 30);
  expect(slow.events).toContain('bonk');
  expect(slow.s).toMatchObject({ outcome: 'racing', vz: 0 });
  // Short circuits explode.
  const red = road(['------- x3', 'xxxxxxx x3', '------- x3']);
  expect(run(red, { ...newRace(red), vz: 5 }, 30).s.outcome).toBe('crashed');

  // A jump that would land just short of the far side: Auto-Pilot speeds it up a little, then gives the speed back.
  const gap = road(['------- x10', '....... x6', '------- x20']);
  const start = { ...newRace(gap), z: 9.6, vz: 8 };
  const jump = (_: RaceState, i: number) => ({ ...none, jump: i === 0 });
  expect(run(gap, { ...start, autoPilot: false }, 90, jump).s.outcome).toBe('fell');
  const saved = run(gap, start, 40, jump);
  expect(saved.events).toContain('autopilot');
  expect(saved.s).toMatchObject({ outcome: 'racing', y: 0, autoPilotOn: false, autoPilotGiveBack: 0 });
  expect(saved.s.vz).toBeCloseTo(8);

  // Battery drains by speed (flat out, a 2-second battery lasts 2 seconds); signal by time, even standing still.
  const long = road(['------- x200']);
  const flat = run(road(['------- x200'], { battery: 2 }), { ...newRace(long), vz: 12 }, 200);
  expect(flat.s.outcome).toBe('outOfBattery');
  expect(flat.s.steps).toBe(60);
  const lost = run(road(['------- x200'], { signal: 1 }), newRace(long), 200);
  expect(lost.s.outcome).toBe('outOfSignal');
  expect(lost.s.steps).toBe(30);
  // A recharge port fills both (one event per port, however many rows of it).
  const port = road(['------- x3', '+++++++ x3', '------- x40'], { signal: 2 });
  const charged = run(port, { ...newRace(port), vz: 6 }, 120);
  expect(charged.events.filter((e) => e === 'recharge')).toHaveLength(1);
  expect(charged.s.outcome).toBe('outOfSignal');
  expect(charged.s.steps).toBeGreaterThan(60);

  // A recorded run replays to exactly the same state, also after being sent as text.
  const course = road(['------- x10', '--111-- x6', '------- x6', '....... x3', '------- x20']);
  const rec = makeRecorder();
  let s = newRace(course);
  while (s.outcome === 'racing') {
    const code = inputCode({ turn: s.x < 5.5 ? 1 : 0, accel: s.vz < 7 ? 1 : 0, jump: s.z > 21.3 && s.grounded });
    rec.record(s, code);
    s = step(s, decodeInput(code), course).state;
  }
  expect(s.outcome).toBe('finished');
  expect(decodeInput(NEUTRAL)).toEqual(none);
  const sent = decodeLog(encodeLog(rec.log));
  expect(sent).toEqual(rec.log);
  expect(stateKey(replay(course, sent!))).toBe(stateKey(s));
  expect(decodeLog('5.0.3,4.0.3')).toBeNull();
  expect(decodeLog('5.0.30')).toBeNull();
});
