import { describe, expect, it } from 'vitest';
import {
  ESCAPE_EXTRA_SECONDS, MAX_ENERGY, MAX_MISSILES, MAX_PAD_BONUSES, MAX_SHIELD, PAD_BONUS_STEPS, REBUILD_PENALTY_STEPS, REBUILD_SHIELD, ROBOTS, STEPS_PER_SECOND, USE_RANGE, WRONG_ANSWER_DAMAGE,
  WRONG_ANSWER_STEPS,
} from './config';
import { clockSteps, makeWorld, newRun, replay, stateKey, stepRun, type RunState, type World } from './engine';
import { GRANT, HOLD, IDLE, NO_INPUT, PENALTY, packInput, pushInput, type PilotInput } from './inputs';
import { RECIPES, makeLevel, roomAt } from './level';

const level1 = makeLevel(RECIPES[0]);
const level3 = makeLevel(RECIPES[2]);
const press = (p: Partial<PilotInput>) => packInput({ ...NO_INPUT, ...p });

function setup(level = level1, steady = true): { w: World; s: RunState } {
  const w = makeWorld(level, { steady });
  return { w, s: newRun(w) };
}
function placeAt(s: RunState, x: number, y: number, z: number): void {
  s.px = x; s.py = y; s.pz = z; s.vx = 0; s.vy = 0; s.vz = 0;
}
function insideRock(w: World, s: RunState): boolean {
  const L = w.level;
  return L.solid[Math.floor(s.px) + L.nx * (Math.floor(s.py) + L.ny * Math.floor(s.pz))] === 1;
}
/** Only the one robot we care about is awake; the rest are removed so a test can't be disturbed by them. */
function aloneWith(s: RunState, keep: number): void {
  s.robots.forEach((r, i) => {
    if (i !== keep) r.alive = 0;
  });
}

describe('starting', () => {
  it('begins in the start room, level, with full shield', () => {
    const { w, s } = setup();
    const room = w.level.rooms[w.level.start];
    expect([s.px, s.py, s.pz]).toEqual([room.cx + 0.5, room.cy + 0.5, room.cz + 0.5]);
    expect([s.fx, s.fy, s.fz, s.uz]).toEqual([0, 1, 0, 1]);
    expect(s.shield).toBe(MAX_SHIELD);
    expect(s.outcome).toBe('running');
    expect(roomAt(w.level, s.px, s.py, s.pz)).toBe(w.level.start);
  });
});

describe('flying', () => {
  it('speeds up while pushed, slows down when let go, and never goes inside the rock', () => {
    const { w, s } = setup();
    for (let i = 0; i < 20; i++) stepRun(w, s, press({ tz: 1 }));
    const speed = Math.hypot(s.vx, s.vy, s.vz);
    expect(speed).toBeGreaterThan(3);
    for (let i = 0; i < 40; i++) stepRun(w, s, IDLE);
    expect(Math.hypot(s.vx, s.vy, s.vz)).toBeLessThan(speed / 4);
    expect(insideRock(w, s)).toBe(false);
  });

  it('stops at a wall instead of going through', () => {
    const { w, s } = setup();
    // The mine's edge is solid: fly into it for a long time in every direction.
    for (const dir of [{ tz: 1 }, { tz: -1 }, { tx: 1 }, { tx: -1 }, { ty: 1 }, { ty: -1 }] as Partial<PilotInput>[]) {
      for (let i = 0; i < 300; i++) {
        stepRun(w, s, press(dir));
        expect(insideRock(w, s), `${JSON.stringify(dir)} step ${i}`).toBe(false);
      }
    }
  });

  it('has a top speed', () => {
    const { w, s } = setup();
    for (let i = 0; i < 12; i++) stepRun(w, s, press({ ty: 1, tx: 1, tz: 1 }));
    expect(Math.hypot(s.vx, s.vy, s.vz)).toBeLessThanOrEqual(10.0001);
  });

  it('turns: steady flight stays level, free flight can roll', () => {
    const steady = setup(level1, true);
    for (let i = 0; i < 400; i++) stepRun(steady.w, steady.s, press({ yaw: 3, pitch: i % 50 < 25 ? 2 : -2, roll: 1 }));
    expect(steady.s.uz).toBeGreaterThan(0.2);
    expect(steady.s.rz).toBe(0);
    for (const [a, b] of [[steady.s.fx, steady.s.fy], [steady.s.ux, steady.s.uy]]) void a, b;
    expect(Math.hypot(steady.s.fx, steady.s.fy, steady.s.fz)).toBeCloseTo(1, 10);

    const free = setup(level1, false);
    for (let i = 0; i < 100; i++) stepRun(free.w, free.s, press({ roll: 1 }));
    expect(Math.abs(free.s.rz)).toBeGreaterThan(0.1);
    const { fx, fy, fz, ux, uy, uz, rx, ry, rz } = free.s;
    expect(Math.hypot(fx, fy, fz)).toBeCloseTo(1, 10);
    expect(Math.hypot(ux, uy, uz)).toBeCloseTo(1, 10);
    expect(Math.hypot(rx, ry, rz)).toBeCloseTo(1, 10);
    expect(fx * rx + fy * ry + fz * rz).toBeCloseTo(0, 10);
    expect(fx * ux + fy * uy + fz * uz).toBeCloseTo(0, 10);
  });

  it('steady flight stops looking up at the limit', () => {
    const { w, s } = setup();
    for (let i = 0; i < 600; i++) stepRun(w, s, press({ pitch: 6 }));
    expect(s.fz).toBeLessThan(0.98);
    expect(s.fz).toBeGreaterThan(0.9);
  });

  it('a held step stops the clock and the ship', () => {
    const { w, s } = setup();
    stepRun(w, s, press({ tz: 1 }));
    const before = stateKey(s);
    for (let i = 0; i < 10; i++) stepRun(w, s, HOLD);
    expect(s.steps).toBe(1);
    expect(s.held).toBe(10);
    expect(stateKey(s).replace(/\|10\|/, '|0|')).toBeTruthy();
    expect(clockSteps(s)).toBe(1);
    expect(s.px).toBeCloseTo(Number(before.split('|')[0]), 12);
  });
});

describe('doors', () => {
  const L = level3;
  const key = L.doors.findIndex((d) => d.kind === 'blue');
  const question = L.doors.findIndex((d) => d.kind === 'question');

  it('a key door stays shut without its key and opens with it', () => {
    const { w, s } = setup(L);
    const d = L.doors[key];
    placeAt(s, d.x - 2, d.y, d.z);
    for (let i = 0; i < 3; i++) stepRun(w, s, IDLE);
    expect(s.doorsOpen[key]).toBe(0);
    s.keys[0] = 1;
    stepRun(w, s, IDLE);
    expect(s.doorsOpen[key]).toBe(1);
    expect(s.doorsByKey).toBe(1);
  });

  it('a shut door blocks the ship, an open one does not', () => {
    const { w, s } = setup(L);
    const d = L.doors[question];
    const [a, b] = d.rooms.map((r) => L.rooms[r]);
    const along = a.cx !== b.cx ? 'x' : a.cy !== b.cy ? 'y' : 'z';
    const dir = (sign: number): Partial<PilotInput> => (along === 'z' ? { ty: sign } : { tz: sign });
    // Line the ship up with the door and push into it from one side.
    const start = { x: d.x, y: d.y, z: d.z };
    start[along] -= 3;
    placeAt(s, start.x, start.y, start.z);
    if (along === 'x') { s.fx = 1; s.fy = 0; s.rx = 0; s.ry = -1; }
    else if (along === 'y') { /* already facing +y */ }
    for (let i = 0; i < 60; i++) stepRun(w, s, press(dir(1)));
    expect(s[('p' + along) as 'px']).toBeLessThan(d[along] - 0.4);
    s.doorsOpen[question] = 1;
    for (let i = 0; i < 60; i++) stepRun(w, s, press(dir(1)));
    expect(s[('p' + along) as 'px']).toBeGreaterThan(d[along]);
  });

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

  it('a GRANT cannot open a key door or name something that is not there', () => {
    const { w, s } = setup(L);
    const d = L.doors[key];
    placeAt(s, d.x - 1, d.y, d.z);
    stepRun(w, s, GRANT + key);
    expect(s.doorsOpen[key]).toBe(0);
    stepRun(w, s, GRANT + 60);
    expect(s.badGrants).toBe(2);
  });

  it('a wrong answer costs shield and time, never the run', () => {
    const { w, s } = setup(L);
    const before = clockSteps(s);
    stepRun(w, s, PENALTY);
    expect(s.shield).toBe(MAX_SHIELD - WRONG_ANSWER_DAMAGE);
    expect(clockSteps(s) - before).toBe(WRONG_ANSWER_STEPS);
    expect(s.wrongAnswers).toBe(1);
    for (let i = 0; i < 10; i++) stepRun(w, s, PENALTY);
    expect(s.shield).toBe(1);
    expect(s.outcome).toBe('running');
    expect(s.deaths).toBe(0);
  });

  it('does not let steps carry on once the run is over', () => {
    const { w, s } = setup(L);
    s.outcome = 'finished';
    const k = stateKey(s);
    stepRun(w, s, press({ tz: 1 }));
    stepRun(w, s, PENALTY);
    expect(stateKey(s)).toBe(k);
  });
});

describe('pads and pickups', () => {
  it('a pad gives its refill once, and the time bonus at most three times a run', () => {
    const L = makeLevel(RECIPES[5]);
    const { w, s } = setup(L);
    s.shield = 10; s.energy = 5; s.missiles = 0;
    const clock0 = clockSteps(s);
    let bonuses = 0;
    for (const pad of L.pads) {
      placeAt(s, pad.x, pad.y, pad.z);
      stepRun(w, s, GRANT + pad.id);
      expect(s.padsUsed[pad.id - L.doors.length]).toBe(1);
      stepRun(w, s, GRANT + pad.id);
      bonuses = s.padBonuses;
    }
    expect(s.shield).toBe(MAX_SHIELD);
    expect(s.energy).toBe(MAX_ENERGY);
    expect(s.missiles).toBeGreaterThan(0);
    expect(s.missiles).toBeLessThanOrEqual(MAX_MISSILES);
    expect(bonuses).toBe(MAX_PAD_BONUSES);
    expect(clock0 - 0).toBe(0);
    expect(s.bonus).toBe(MAX_PAD_BONUSES * PAD_BONUS_STEPS);
    expect(s.badGrants).toBe(L.pads.length); // each second grant on a used pad
  });

  it('picks up what helps and leaves what does not', () => {
    const { w, s } = setup();
    const shield = level1.pickups.findIndex((p) => p.kind === 'shield');
    const p = level1.pickups[shield];
    placeAt(s, p.x, p.y, p.z);
    stepRun(w, s, IDLE);
    expect(s.pickupsTaken[shield]).toBe(0); // shield is already full
    s.shield = 40;
    stepRun(w, s, IDLE);
    expect(s.pickupsTaken[shield]).toBe(1);
    expect(s.shield).toBe(70);
  });

  it('picks up keys', () => {
    const { w, s } = setup(level3);
    const k = level3.keys[0];
    placeAt(s, k.x, k.y, k.z);
    stepRun(w, s, IDLE);
    expect(s.keys[['blue', 'yellow', 'red'].indexOf(k.colour)]).toBe(1);
  });
});

describe('weapons and robots', () => {
  it('lasers cost energy and have to cool down; missiles run out', () => {
    const { w, s } = setup();
    stepRun(w, s, press({ fire: true }));
    expect(s.shots.length).toBe(1);
    expect(s.energy).toBeLessThan(MAX_ENERGY);
    stepRun(w, s, press({ fire: true }));
    expect(s.shots.filter((t) => t.k === 0).length).toBe(1); // still cooling
    s.missiles = 1;
    stepRun(w, s, press({ missile: true }));
    expect(s.missiles).toBe(0);
    for (let i = 0; i < 40; i++) stepRun(w, s, press({ missile: true }));
    expect(s.shots.filter((t) => t.k === 1).length).toBeLessThanOrEqual(1);
    s.energy = 0;
    s.laserCool = 0;
    const n = s.shots.length;
    stepRun(w, s, press({ fire: true }));
    expect(s.shots.length).toBeLessThanOrEqual(n);
  });

  it('a laser stops at a wall', () => {
    const { w, s } = setup();
    s.fx = 0; s.fy = -1; s.fz = 0;
    placeAt(s, s.px, 0.7, s.pz); // right beside the outer wall
    stepRun(w, s, press({ fire: true }));
    for (let i = 0; i < 5; i++) stepRun(w, s, IDLE);
    expect(s.shots.length).toBe(0);
  });

  function robotFight(type: 'drone' | 'hunter' | 'turret') {
    const index = level3.robots.findIndex((r) => r.type === type);
    const r = level3.robots[index];
    const { w, s } = setup(level3);
    aloneWith(s, index);
    // Float a few blocks away from it in the same room, looking at it.
    const room = level3.rooms[r.room];
    const px = room.cx + 0.5;
    placeAt(s, px, room.cy + 0.5, room.cz + 0.5);
    s.robots[index].x = px; s.robots[index].y = room.cy + 0.5 + 4; s.robots[index].z = room.cz + 0.5;
    return { w, s, index };
  }

  it.each(['drone', 'hunter', 'turret'] as const)('a %s wakes up when it sees the ship, shoots, and can be shot down', (type) => {
    if (!level3.robots.some((r) => r.type === type)) return;
    const { w, s, index } = robotFight(type);
    // Stand in the middle, facing it, and just fire.
    const hp0 = s.robots[index].hp;
    let hurt = false;
    for (let i = 0; i < 200 && s.outcome === 'running'; i++) {
      stepRun(w, s, press({ fire: true }));
      if (s.shield < MAX_SHIELD) hurt = true;
      if (!s.robots[index].alive) break;
    }
    expect(s.robots[index].alive === 0 || s.robots[index].hp < hp0).toBe(true);
    expect(hurt || !s.robots[index].alive).toBe(true);
    expect(hp0).toBe(ROBOTS[type].hp);
  });

  it('a sleeping robot with no line of sight does nothing', () => {
    const { w, s } = setup(level3);
    const far = level3.robots.findIndex((r) => r.room !== level3.start);
    aloneWith(s, far);
    for (let i = 0; i < 100; i++) stepRun(w, s, IDLE);
    expect(s.robots[far].alert).toBe(0);
    expect(s.shield).toBe(MAX_SHIELD);
  });

  it('a missile hurts a robot beside where it lands', () => {
    const { w, s } = setup(level3);
    const index = level3.robots.findIndex((r) => r.type === 'drone');
    aloneWith(s, index);
    const r = s.robots[index];
    const room = level3.rooms[level3.robots[index].room];
    placeAt(s, room.cx + 0.5, room.cy + 0.5, room.cz + 0.5);
    r.x = s.px; r.y = s.py + 5; r.z = s.pz;
    r.alert = 0;
    s.missiles = 3;
    const hp = r.hp;
    for (let i = 0; i < 60 && s.robots[index].alive; i++) stepRun(w, s, press({ missile: true }));
    expect(r.hp < hp || !r.alive).toBe(true);
  });
});

describe('rebuilding', () => {
  it('a wrecked ship is rebuilt in the last room it entered, with 20 seconds added', () => {
    const { w, s } = setup(level3);
    const room = level3.rooms[(level3.start + 1) % level3.rooms.length];
    placeAt(s, room.cx + 0.5, room.cy + 0.5, room.cz + 0.5);
    stepRun(w, s, IDLE);
    expect(s.lastRoom).toBe(room.index);
    placeAt(s, room.cx + 1.5, room.cy + 0.5, room.cz + 0.5);
    s.shield = 0;
    s.keys = [1, 0, 0];
    stepRun(w, s, IDLE);
    expect(s.deaths).toBe(1);
    expect([s.px, s.py, s.pz]).toEqual([room.cx + 0.5, room.cy + 0.5, room.cz + 0.5]);
    expect(s.shield).toBe(REBUILD_SHIELD);
    expect(s.penalty).toBe(REBUILD_PENALTY_STEPS);
    expect(REBUILD_PENALTY_STEPS).toBe(20 * STEPS_PER_SECOND);
    expect(s.keys).toEqual([1, 0, 0]); // never lose keys
    expect(s.outcome).toBe('running');
  });
});

describe('the reactor and the way out', () => {
  function atReactor() {
    const { w, s } = setup(level1);
    aloneWith(s, -1);
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
    expect(level1.escapeSteps / STEPS_PER_SECOND).toBeGreaterThan(ESCAPE_EXTRA_SECONDS);
  });

  it('the exit does nothing before the reactor is down', () => {
    const { w, s } = setup(level1);
    stepRun(w, s, IDLE);
    expect(s.outcome).toBe('running');
  });

  it('running out of escape time ends the run', () => {
    const { w, s } = atReactor();
    s.reactorDown = 1;
    s.escapeLeft = 3;
    for (let i = 0; i < 5; i++) stepRun(w, s, IDLE);
    expect(s.outcome).toBe('timeout');
  });
});

describe('replay', () => {
  it('plays a recorded run back to exactly the same state', () => {
    const w = makeWorld(level3);
    const live = newRun(w);
    const runs: [number, number][] = [];
    let seed = 11;
    const rnd = () => (seed = (seed * 48271) % 2147483647);
    for (let i = 0; i < 1200; i++) {
      const code = i % 97 === 0 ? PENALTY : i % 211 === 0 ? HOLD : packInput({ ...NO_INPUT, tz: 1, yaw: (rnd() % 13) - 6, pitch: (rnd() % 5) - 2, fire: rnd() % 4 === 0 });
      stepRun(w, live, code);
      pushInput(runs, code);
    }
    expect(stateKey(replay(w, runs))).toBe(stateKey(live));
  });

  it('stops at the end of the level, ignoring any extra steps', () => {
    const w = makeWorld(level1);
    const s = replay(w, [[IDLE, 5]]);
    expect(s.steps).toBe(5);
  });
});
