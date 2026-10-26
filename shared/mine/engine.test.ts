import { describe, expect, it } from 'vitest';
import { USE_RANGE } from './config';
import { clockSteps, makeWorld, newRun, stepRun, type RunState, type World } from './engine';
import { GRANT, IDLE, NO_INPUT, packInput, type PilotInput } from './inputs';
import { RECIPES, makeLevel } from './level';

const level1 = makeLevel(RECIPES[0]);
const level3 = makeLevel(RECIPES[2]);
const press = (p: Partial<PilotInput>) => packInput({ ...NO_INPUT, ...p });

function setup(level = level1, steady = true): { w: World; s: RunState } {
  const w = makeWorld(level, { steady });
  const s = newRun(w);
  // These tests were written facing +y; the real start faces down a tunnel (see 'starts the ship looking down a tunnel').
  s.fx = 0; s.fy = 1; s.fz = 0; s.ux = 0; s.uy = 0; s.uz = 1; s.rx = 1; s.ry = 0; s.rz = 0;
  return { w, s };
}
function placeAt(s: RunState, x: number, y: number, z: number): void {
  s.px = x; s.py = y; s.pz = z; s.vx = 0; s.vy = 0; s.vz = 0;
}
/** Only the one robot we care about is awake; the rest are removed so a test can't be disturbed by them. */
function aloneWith(s: RunState, keep: number): void {
  s.robots.forEach((r, i) => {
    if (i !== keep) r.alive = 0;
  });
}

describe('doors', () => {
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
});

describe('the reactor and the way out', () => {
  function atReactor() {
    const { w, s } = setup(level1);
    aloneWith(s, -1);
    s.reactorLock = 0;
    const R = level1.reactor;
    const room = level1.rooms[level1.reactorRoom];
    placeAt(s, R.x, R.y - room.hy, R.z);
    return { w, s };
  }

  it('destroying the reactor starts the escape timer; reaching the exit then finishes', () => {
    const { w, s } = atReactor();
    s.missiles = 12;
    for (let i = 0; i < 400 && !s.reactorDown; i++) stepRun(w, s, press({ fire: true, missile: true }));
    expect(s.reactorDown).toBe(1);
    expect(s.escapeLeft).toBe(level1.escapeSteps - 1); // the step it went down counts
    expect(s.outcome).toBe('running');
    const E = level1.exit;
    placeAt(s, E.x + 1, E.y, E.z);
    stepRun(w, s, IDLE);
    expect(s.outcome).toBe('finished');
    expect(s.finishSteps).toBe(clockSteps(s));
  });
});
