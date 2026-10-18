import { describe, expect, it } from 'vitest';
import { compileCourse, type CourseDef } from './course';
import { clockSteps, gateOpen, geyserPhase, makeWorld, medalFor, newRun, replay, stateKey, stepRun, trapdoorSolid, type RunOptions } from './engine';
import { decodeInputs, encodeInputs, HOLD, REFUND, totalSteps } from './inputs';
import { FALL_PENALTY_STEPS, CHECKPOINT_BONUS_STEPS } from './config';

/** A small course from rows of letters; heights default to level 2 everywhere. */
function tiny(rows: string[], heights?: string[], extra: Partial<CourseDef> = {}) {
  return compileCourse({
    id: 'tiny',
    name: 'Tiny',
    rows,
    heights: heights ?? rows.map((r) => '2'.repeat(r.length)),
    route: [],
    medals: { gold: 2, silver: 4, bronze: 8 },
    hardSeconds: 10,
    ...extra,
  });
}
const E = 3; // east
const W_ = 7;
const S = 5;

/** Plays `n` steps of one input and returns the state. */
function play(course: ReturnType<typeof tiny>, input: number, n: number, options?: RunOptions) {
  const w = makeWorld(course, options);
  const s = newRun(w);
  for (let i = 0; i < n; i++) stepRun(w, s, input);
  return { w, s };
}

describe('moving and slopes', () => {
  const SLOPE = tiny(['==========', '=s>>>>##f=', '=========='], ['0000000000', '0776543330', '0000000000']);
  const flat = tiny(['=======', '=s###f=', '=======']);
  it('steers east and stops at nothing until the finish', () => {
    const { s } = play(flat, E, 300);
    expect(s.outcome).toBe('finished');
  });
  it('does not move with no input on flat floor', () => {
    const { s } = play(flat, 0, 120);
    expect(s.x).toBe(1.5);
  });
  /** Pushes east for a moment, then lets go. */
  const nudge = (c: ReturnType<typeof tiny>, coast: number) => {
    const w = makeWorld(c);
    const s = newRun(w);
    for (let i = 0; i < 15; i++) stepRun(w, s, E);
    for (let i = 0; i < coast; i++) stepRun(w, s, 0);
    return s;
  };
  it('a slope keeps pulling the marble downhill with no input', () => {
    expect(nudge(SLOPE, 20).vx).toBeGreaterThan(nudge(SLOPE, 0).vx);
  });
  it('rolls faster down a slope than along the flat', () => {
    const level = tiny(['==========', '=s#######f=', '=========='].map((r) => r.slice(0, 10)), ['0000000000', '0777777770', '0000000000']);
    expect(nudge(SLOPE, 20).vx).toBeGreaterThan(nudge(level, 20).vx);
  });
  it('the marble rides down a slope: its height follows the floor', () => {
    const s = nudge(SLOPE, 40);
    expect(s.z).toBeLessThan(7 * 0.5);
    expect(s.grounded).toBe(true);
  });
  it('speed never goes over the limit', () => {
    const { s } = play(flat, E, 40);
    expect(Math.hypot(s.vx, s.vy)).toBeLessThanOrEqual(4.5 + 1e-9);
  });
});

describe('walls', () => {
  it('bounces off a wall and does not go through', () => {
    const c = tiny(['=====', '=s#=f', '=====']);
    const { s } = play(c, E, 200);
    expect(s.x).toBeLessThan(3);
    expect(s.outcome).toBe('running');
  });
  it('treats a floor far above as a wall', () => {
    const c = tiny(['=====', '=s##f', '====='], ['00000', '02290', '00000']);
    const { s } = play(c, E, 200);
    expect(s.x).toBeLessThan(3);
  });
});

describe('surfaces', () => {
  it('coasts further on ice and less far in mud than on normal floor', () => {
    const coast = (ch: string) => {
      const c = tiny(['=============='.padEnd(15, '='), `=s${ch.repeat(11)}f=`, '=============='.padEnd(15, '=')]);
      const w = makeWorld(c);
      const s = newRun(w);
      s.vx = 3;
      for (let i = 0; i < 60; i++) stepRun(w, s, 0);
      return s.x;
    };
    expect(coast('i')).toBeGreaterThan(coast('#'));
    expect(coast('m')).toBeLessThan(coast('#'));
  });
  it('mud limits speed', () => {
    const c = tiny(['==========', '=smmmmmmf=', '==========']);
    const { s } = play(c, E, 100);
    expect(Math.hypot(s.vx, s.vy)).toBeLessThanOrEqual(2.5 + 1e-9);
  });
});

describe('falling', () => {
  const gap = tiny(['=======', '=s#..#f', '======='.replace(/=/g, '=')]);
  it('falls into a gap, lands back at the start, and the clock gains the penalty', () => {
    const w = makeWorld(gap);
    const s = newRun(w);
    for (let i = 0; i < 200 && s.falls === 0; i++) stepRun(w, s, E);
    expect(s.falls).toBe(1);
    expect(s.penalty).toBe(FALL_PENALTY_STEPS);
    expect(s.x).toBe(1.5);
    expect(s.grounded).toBe(true);
    expect(clockSteps(w, s)).toBe(s.steps + FALL_PENALTY_STEPS);
  });
  it('falls off the edge of the course', () => {
    const c = tiny(['s#f'], ['222']);
    const { s } = play(c, 1, 120); // north
    expect(s.falls).toBeGreaterThan(0);
  });
  it('a hard landing is an ouch: back to the start', () => {
    const c = tiny(['s' + '#'.repeat(10) + 'f'], ['m' + '2'.repeat(11)]); // a ledge about 10 tiles up
    const { s } = play(c, E, 120);
    expect(s.falls).toBeGreaterThanOrEqual(1);
  });
  it('a small drop is fine', () => {
    const c = tiny(['s' + '#'.repeat(10) + 'f'], ['5' + '3'.repeat(10) + '3']);
    const { s } = play(c, E, 120);
    expect(s.falls).toBe(0);
  });
});

describe('checkpoints, finish and jump pads', () => {
  it('respawns at the last checkpoint', () => {
    const c = tiny(['======..', '=sc#..f=', '======..'.replace(/\./g, '=')]);
    const w = makeWorld(c);
    const s = newRun(w);
    for (let i = 0; i < 300 && s.falls === 0; i++) stepRun(w, s, E);
    expect(s.checkpoints.length).toBe(1);
    expect(s.respawnX).toBe(2.5);
    expect(s.x).toBe(2.5);
  });
  it('a jump pad throws the marble over a gap', () => {
    const c = tiny(['==========', '=s##j..#f=', '=========='].map((r) => r.padEnd(10, '=')));
    const { s } = play(c, E, 400);
    expect(s.outcome).toBe('finished');
    expect(s.falls).toBe(0);
  });
  it('finishing stops the run and records the time', () => {
    const c = tiny(['====', '=sf=', '====']);
    const { s } = play(c, E, 200);
    expect(s.outcome).toBe('finished');
    expect(s.finishSteps).toBe(s.steps);
  });
  it('a bumper pushes the marble away', () => {
    const c = tiny(['=======', '=s#b#f=', '=======']);
    const { s } = play(c, E, 150);
    expect(s.x).toBeLessThan(3.6);
  });
});

describe('clock modes', () => {
  const flat = tiny(['=========', '=s##c##f=', '=========']);
  it('count-up shows the time so far', () => {
    const w = makeWorld(flat);
    const s = newRun(w);
    for (let i = 0; i < 30; i++) stepRun(w, s, E);
    expect(clockSteps(w, s)).toBe(30);
  });
  it('count-down starts at the hard-mode time and a checkpoint adds time', () => {
    const w = makeWorld(flat, { mode: 'down' });
    const s = newRun(w);
    expect(clockSteps(w, s)).toBe(600);
    let i = 0;
    while (s.checkpoints.length === 0 && i++ < 300) stepRun(w, s, E);
    expect(clockSteps(w, s)).toBe(600 + CHECKPOINT_BONUS_STEPS - s.steps);
  });
  it('running out ends the run', () => {
    const wall = tiny(['=====', '=s#=f', '====='], undefined, { hardSeconds: 2 });
    const w = makeWorld(wall, { mode: 'down' });
    const s = newRun(w);
    for (let i = 0; i < 300; i++) stepRun(w, s, E);
    expect(s.outcome).toBe('timeout');
    expect(s.steps).toBe(120);
  });
  it('falls cost count-down time too', () => {
    const c = tiny(['=======', '=s#..#f', '======='], undefined, { hardSeconds: 5 });
    const w = makeWorld(c, { mode: 'down' });
    const s = newRun(w);
    for (let i = 0; i < 400 && s.falls === 0; i++) stepRun(w, s, E);
    expect(clockSteps(w, s)).toBe(300 - s.steps - FALL_PENALTY_STEPS);
  });
  it('does nothing after the run is over', () => {
    const c = tiny(['====', '=sf=', '====']);
    const { w, s } = play(c, E, 100);
    const before = stateKey(s);
    stepRun(w, s, E);
    expect(stateKey(s)).toBe(before);
  });
});

describe('doors, hold and refund (how maths will plug in)', () => {
  const door = tiny(['=======', '=s#A#f=', '=======']);
  it('a shut door is a wall', () => {
    expect(play(door, E, 300).s.outcome).toBe('running');
  });
  it('an open door is floor', () => {
    expect(play(door, E, 300, { openDoors: [0] }).s.outcome).toBe('finished');
  });
  it('held steps stop the clock and the marble', () => {
    const flat = tiny(['======', '=s##f=', '======']);
    const w = makeWorld(flat);
    const s = newRun(w);
    for (let i = 0; i < 10; i++) stepRun(w, s, E);
    const key = [s.x, s.y, s.vx];
    for (let i = 0; i < 100; i++) stepRun(w, s, HOLD);
    expect([s.x, s.y, s.vx]).toEqual(key);
    expect(s.held).toBe(100);
    expect(clockSteps(w, s)).toBe(10);
  });
  it('a refund takes back the last fall once', () => {
    const c = tiny(['=======', '=s#..#f', '=======']);
    const w = makeWorld(c);
    const s = newRun(w);
    for (let i = 0; i < 400 && s.falls === 0; i++) stepRun(w, s, E);
    stepRun(w, s, REFUND);
    expect(s.penalty).toBe(0);
    stepRun(w, s, REFUND);
    expect(s.penalty).toBe(0);
  });
});

describe('replay', () => {
  const c = tiny(['=========', '=s##c##f=', '=========']);
  it('finishes with the same time as playing live', () => {
    const w = makeWorld(c);
    const s = newRun(w);
    while (s.outcome === 'running') stepRun(w, s, E);
    const r = replay(c, [[E, s.steps]]);
    expect(r?.outcome).toBe('finished');
    expect(r?.finishSteps).toBe(s.finishSteps);
    expect(stateKey(r!.state)).toBe(stateKey(s));
  });
  it('gives an identical result every time', () => {
    const runs: [number, number][] = [[E, 40], [0, 10], [E, 100]];
    expect(stateKey(replay(c, runs)!.state)).toBe(stateKey(replay(c, runs)!.state));
  });
  it('rejects a bad input', () => {
    expect(replay(c, [[12, 5]])).toBeNull();
    expect(replay(c, [[1, 0]])).toBeNull();
    expect(replay(c, [[1.5, 5]])).toBeNull();
    expect(replay(c, [[E, 999_999]])).toBeNull();
  });
  it('reports unfinished runs', () => {
    expect(replay(c, [[E, 5]])?.outcome).toBe('unfinished');
  });
  it('different inputs give a different run', () => {
    expect(stateKey(replay(c, [[E, 100]])!.state)).not.toBe(stateKey(replay(c, [[S, 100]])!.state));
    expect(W_).toBe(7);
  });
});

describe('input codec', () => {
  it('round trips', () => {
    const runs: [number, number][] = [[3, 120], [0, 5], [9, 30], [10, 1], [8, 2]];
    const text = encodeInputs(runs);
    expect(decodeInputs(text)).toEqual(runs);
    expect(totalSteps(runs)).toBe(158);
  });
  it('refuses odd text', () => {
    for (const bad of ['3x0', 'zx5', '3x', '3x5,', '3 x 5', '3x1000000', '3x99999,3x99999,3x99999,3x99999']) expect(decodeInputs(bad)).toBeNull();
    expect(decodeInputs('')).toEqual([]);
  });
});

describe('medals', () => {
  const c = tiny(['====', '=sf=', '====']);
  it('gives gold, silver, bronze or nothing', () => {
    expect(medalFor(c, 60)).toBe('gold');
    expect(medalFor(c, 3 * 60)).toBe('silver');
    expect(medalFor(c, 7 * 60)).toBe('bronze');
    expect(medalFor(c, 9 * 60)).toBeNull();
  });
});

describe('timed hazards and conveyors', () => {
  /** Pushes east a moment (to get onto the belts), then lets go. */
  const coastOn = (c: ReturnType<typeof tiny>) => {
    const w = makeWorld(c);
    const s = newRun(w);
    for (let i = 0; i < 20; i++) stepRun(w, s, E);
    for (let i = 0; i < 400; i++) stepRun(w, s, 0);
    return s;
  };
  it('a conveyor carries a marble along with no input', () => {
    expect(coastOn(tiny(['========', '=seeeef=', '========'])).outcome).toBe('finished');
  });
  it('a conveyor pushing the other way carries it back', () => {
    const s = coastOn(tiny(['========', '=swwwwf=', '========']));
    expect(s.outcome).toBe('running');
    expect(s.x).toBeLessThan(3);
  });
  it('a trapdoor drops away on its timer, and a marble standing on it falls', () => {
    const c = tiny(['=====', '=s#tf', '=====']);
    const w = makeWorld(c);
    const s = newRun(w);
    s.x = 3.5; // standing on the trapdoor
    for (let i = 0; i < 300 && s.falls === 0; i++) stepRun(w, s, 0);
    expect(s.falls).toBe(1);
    expect(trapdoorSolid(0, 3)).toBe(true);
  });
  it('a gate is shut like a wall at some moments and open at others, the same every run', () => {
    expect(gateOpen(0, 3)).toBe(false);
    expect(gateOpen(60, 3)).toBe(true);
    expect(gateOpen(60 + 210, 3)).toBe(true);
    const c = tiny(['=======', '=s#q#f=', '=======']);
    // Waiting at the gate and pushing east until it opens: it finishes, but later than a clear run would.
    const { s } = play(c, E, 600);
    expect(s.outcome).toBe('finished');
    const again = play(c, E, 600).s;
    expect(again.finishSteps).toBe(s.finishSteps);
    const clear = tiny(['=======', '=s###f=', '=======']);
    expect(s.finishSteps).toBeGreaterThanOrEqual(play(clear, E, 600).s.finishSteps);
  });
  it('a geyser throws the marble up when it goes off', () => {
    const c = tiny(['=====', '=s#gf', '=====']);
    const w = makeWorld(c);
    const s = newRun(w);
    s.x = 3.5;
    let flew = false;
    for (let i = 0; i < 400 && s.outcome === 'running'; i++) {
      stepRun(w, s, 0);
      if (!s.grounded) flew = true;
    }
    expect(flew).toBe(true);
    expect(geyserPhase(0, 0, 0)).toBe(1);
    expect(geyserPhase(20, 0, 0)).toBe(2);
    expect(geyserPhase(100, 0, 0)).toBe(0);
  });
  it('gusts of wind push the marble during their window only', () => {
    const wind = { dx: 1, dy: 0, period: 120, on: 30, warn: 20, force: 20 };
    const c = tiny(['==========', '=s#######f', '=========='.replace(/=/g, '=')], undefined, { wind });
    const w = makeWorld(c);
    const s = newRun(w);
    for (let i = 0; i < 29; i++) stepRun(w, s, 0);
    expect(s.vx).toBeGreaterThan(0.2);
    const during = s.vx;
    for (let i = 0; i < 60; i++) stepRun(w, s, 0);
    expect(s.vx).toBeLessThan(during);
  });
});
