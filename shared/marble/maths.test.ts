import { describe, expect, it } from 'vitest';
import type { Question } from '../maths/skillPack';
import { compileCourse, type CourseDef } from './course';
import { COURSES, courseById } from './courses';
import { BONUS, countCode, decodeInputs, encodeInputs, pushInput } from './inputs';
import { clockSteps, makeWorld, newRun, replay, stepRun } from './engine';
import { doorMask, doorsForSeed, doorsFromMask, gateLayout, gemLayout, openDoors, publicQuestion, rightGems, rightGemsForSeed, runSetup, seededRandom, slotPlan } from './maths';
import { botRun } from './bot';
import { GEM_BONUS_STEPS, MAX_GEM_BONUSES } from './config';
import { PIT_BONUS_STEPS } from './config';

const q = (answer: number, extra: Partial<Question> = {}): Question => ({
  id: 1, skill: 's', factKey: 'mul:7x8', kind: 'k', parts: ['7', '×', '8', '=', '?'], spoken: 'seven times eight', answer, band: 4 as never, ...extra,
});

describe('seeded random numbers', () => {
  it('give the same numbers for the same text, and differ for another', () => {
    const a = seededRandom('x');
    const b = seededRandom('x');
    const c = seededRandom('y');
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect([c(), c(), c()]).not.toEqual(first);
    expect(first.every((n) => n >= 0 && n < 1)).toBe(true);
  });
});

describe('every course', () => {
  it.each(COURSES.map((c) => [c.def.id, c] as const))('%s: its gates, doors and pit stops are well made', (_id, c) => {
    // Each gate has its own doors, and every door tile on the course belongs to some gate.
    const used = c.gates.flatMap((g) => g.tunnels.map((t) => t.door));
    expect(new Set(used).size).toBe(used.length);
    expect(used.length).toBe(c.doorCount);
    expect(c.doorCount).toBeLessThanOrEqual(8);
    const plan = slotPlan(c);
    expect(plan.total).toBeGreaterThanOrEqual(c.gates.length + c.pitCount + 2);
  });
  it('the six New Zealand courses have gates and the practice ones none', () => {
    expect(COURSES.filter((c) => c.gates.length).map((c) => c.def.id)).toEqual(['boulder-beach', 'crown-range', 'geyser-valley', 'glacier-run', 'windy-welly', 'alpine-crossing']);
    expect(courseById('boulder-beach')!.gates).toHaveLength(1);
  });
});

describe('gate layout', () => {
  const course = courseById('geyser-valley')!;
  it('puts the right answer in the tunnel whose door is open, the same every time', () => {
    const questions = [q(56), q(48)];
    const a = gateLayout(course, 'seed-1', questions);
    expect(gateLayout(course, 'seed-1', questions)).toEqual(a);
    a.forEach((l, g) => {
      expect(l.values![l.right]).toBe(questions[g].answer);
      expect(new Set(l.values).size).toBe(course.gates[g].tunnels.length);
      expect(l.labels).toHaveLength(course.gates[g].tunnels.length);
    });
    expect(openDoors(course, a)).toHaveLength(2);
  });
  it('moves the right tunnel around with the seed', () => {
    const where = new Set<number>();
    for (let n = 0; n < 40; n++) where.add(gateLayout(course, `seed-${n}`, [q(56), q(48)])[0].right);
    expect(where.size).toBe(2);
  });
  it('shows arrows (no labels) with maths off, with a door open all the same', () => {
    const layout = gateLayout(course, 'seed-1', null);
    expect(layout.every((l) => l.labels === null && l.values === null)).toBe(true);
    expect(doorsForSeed(course, 'seed-1', null)).toHaveLength(course.gates.length);
  });
  it('uses a question\'s own choices, with fraction labels', () => {
    const fraction = q(1, { choices: [0, 1, 2, 3], choiceLabels: ['1/4', '1/2', '3/4', '1/3'], parts: ['?'] });
    const layout = gateLayout(courseById('boulder-beach')!, 'seed-2', [fraction]);
    const l = layout[0];
    expect(l.labels![l.right]).toBe('1/2');
    expect(l.labels!.every((t) => ['1/4', '1/2', '3/4', '1/3'].includes(t))).toBe(true);
  });
  it('makes near-miss wrong answers for decimals and never goes below zero', () => {
    const l = gateLayout(courseById('glacier-run')!, 'seed-3', [q(0.5, { input: 'decimal' }), q(0)])[1];
    expect(l.values!.every((v) => v >= 0)).toBe(true);
    expect(l.values).toHaveLength(3);
    const d = gateLayout(courseById('glacier-run')!, 'seed-3', [q(0.5, { input: 'decimal' }), q(0)])[0];
    expect(d.values!.every((v) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-9)).toBe(true);
  });
  it('never gives a question\'s answer away in what the browser is told', () => {
    const pub = publicQuestion(q(56), 3);
    expect(JSON.stringify(pub)).not.toContain('56');
    expect(pub.slot).toBe(3);
    expect('answer' in pub).toBe(false);
    expect('factKey' in pub).toBe(false);
  });
  it('keeps doors as a number', () => {
    expect(doorsFromMask(doorMask([0, 3, 7]))).toEqual([0, 3, 7]);
  });
});

describe('running through a gate', () => {
  const tinyGate: CourseDef = {
    id: 'tiny-gate', name: 'Tiny gate',
    rows: ['=========', '=s#####A=', '=##====#=', '=###ccc#=', '=======f='].map((r) => r),
    heights: ['222222222', '222222222', '222222222', '222222222', '222222222'],
    route: [], medals: { gold: 2, silver: 4, bronze: 8 }, hardSeconds: 10,
    gates: [{ sign: [1, 1], after: 0, tunnels: [
      { cells: [[2, 1], [3, 1]], door: 0, route: [], dead: [] },
      { cells: [[2, 2], [3, 2]], door: 0, route: [], dead: [] },
    ] }],
  };
  it('refuses a gate that shares a door or has the wrong number of tunnels', () => {
    expect(() => compileCourse(tinyGate)).toThrow(/bad or shared door/);
    expect(() => compileCourse({ ...tinyGate, gates: [{ ...tinyGate.gates![0], tunnels: [tinyGate.gates![0].tunnels[0]] }] })).toThrow(/2 or 3/);
  });
  it('writes down the first tunnel the marble enters', () => {
    const c = compileCourse({
      ...tinyGate,
      rows: ['=========', '=s#####A=', '=##====B=', '=###ccc#=', '=======f='],
      gates: [{ sign: [1, 1], after: 0, tunnels: [
        { cells: [[3, 1]], door: 0, route: [], dead: [] },
        { cells: [[3, 3]], door: 1, route: [], dead: [] },
      ] }],
    });
    const w = makeWorld(c, { openDoors: [0] });
    const s = newRun(w);
    expect(s.gateChoices).toEqual([-1]);
    for (let i = 0; i < 120 && s.gateChoices[0] < 0; i++) stepRun(w, s, 3);
    expect(s.gateChoices).toEqual([0]);
  });
  it('counts a pit stop once however many of its tiles are touched', () => {
    const c = compileCourse({ ...tinyGate, gates: [], rows: ['=========', '=s#cc###=', '=#######=', '=######f=', '========='], heights: Array(5).fill('222222222') });
    expect(c.pitCount).toBe(1);
    const w = makeWorld(c);
    const s = newRun(w);
    for (let i = 0; i < 200; i++) stepRun(w, s, 3);
    expect(s.checkpoints.length).toBe(2);
    expect(s.pitStops).toEqual([0]);
  });
});

describe('the bonus input', () => {
  // A straight with a pit stop (2 s), a 1-second stop and a half-second stop.
  const line = compileCourse({
    id: 'stops', name: 'Stops', rows: ['==============', '=s#c##k##h##f=', '=============='], heights: ['22222222222222', '22222222222222', '22222222222222'],
    route: [], medals: { gold: 2, silver: 4, bronze: 8 }, hardSeconds: 10,
  });
  /** Rolls east until the marble has reached `n` stops. */
  const rollTo = (n: number) => {
    const w = makeWorld(line);
    const s = newRun(w);
    while (s.pitStops.length < n && s.steps < 2000) stepRun(w, s, 3);
    return { w, s };
  };
  it('does nothing before a stop is reached (each one is still a run of its own)', () => {
    const { w, s } = rollTo(0);
    stepRun(w, s, 3);
    const before = clockSteps(w, s);
    stepRun(w, s, BONUS);
    expect(clockSteps(w, s)).toBe(before);
    const runs: [number, number][] = [];
    pushInput(runs, BONUS);
    pushInput(runs, BONUS);
    expect(runs).toEqual([[BONUS, 1], [BONUS, 1]]);
    expect(countCode(runs, BONUS)).toBe(2);
    expect(decodeInputs(encodeInputs(runs))).toEqual(runs);
  });
  it('takes off what the stop just reached is worth: 2 s at a pit stop, 1 s and half a second at question stops', () => {
    expect(line.pitKind).toEqual(['c', 'k', 'h']);
    expect(line.pitValue).toEqual([PIT_BONUS_STEPS, 60, 30]);
    for (const [n, off] of [[1, PIT_BONUS_STEPS], [2, 60], [3, 30]]) {
      const { w, s } = rollTo(n);
      const before = clockSteps(w, s);
      stepRun(w, s, BONUS);
      expect(clockSteps(w, s)).toBe(before - off);
      expect(s.pitsPaid).toEqual([n - 1]);
    }
  });
  it('pays each stop once, however many bonus inputs are sent', () => {
    const { w, s } = rollTo(2);
    const before = clockSteps(w, s);
    stepRun(w, s, BONUS);
    stepRun(w, s, BONUS);
    expect(clockSteps(w, s)).toBe(before - 60);
    expect(s.pitsPaid).toEqual([1]);
  });
  it('a question stop is not a checkpoint', () => {
    const { s } = rollTo(3);
    expect(s.checkpoints.length).toBe(1);
  });
  it('a replay counts them the same way', () => {
    const { s } = rollTo(1);
    const r = replay(line, [[3, s.steps], [BONUS, 1], [3, 10]])!;
    expect(r.state.penalty).toBe(-PIT_BONUS_STEPS);
    expect(r.state.pitsPaid).toEqual([0]);
  });
});

describe('number gems', () => {
  const course = courseById('glacier-run')!;
  const list = (n: number) => Array.from({ length: n }, (_, i) => q(i === 3 ? 42 : 56));

  it('are on the harder courses only, 2 or 3 to a group, never more than 16 in all', () => {
    expect(COURSES.filter((c) => c.gems.length).map((c) => c.def.id)).toEqual(['glacier-run', 'windy-welly', 'alpine-crossing']);
    for (const c of COURSES) {
      expect(c.gemList.length).toBeLessThanOrEqual(16);
      c.gems.forEach((t) => t.groups.forEach((g) => expect([2, 3]).toContain(g.spots.length)));
    }
  });
  it('give each trail a question slot between the pit stops and the rescue questions', () => {
    const plan = slotPlan(course);
    expect(plan.trails).toBe(course.gems.length);
    expect(plan.gemStart).toBe(plan.gates + plan.pits);
    expect(plan.rescueStart).toBe(plan.gemStart + plan.trails);
    expect(plan.total).toBe(plan.rescueStart + plan.rescues);
  });
  it('have one right gem in every group, carrying the answer, the same every time from the seed', () => {
    const plan = slotPlan(course);
    const questions = list(plan.total);
    const layout = gemLayout(course, 'gem-seed', questions);
    expect(gemLayout(course, 'gem-seed', questions)).toEqual(layout);
    layout.forEach((trail) => {
      const answer = String(questions[trail.slot].answer);
      trail.groups.forEach((g) => {
        expect(g.labels[g.right]).toBe(answer);
        expect(g.labels.filter((l) => l === answer)).toHaveLength(1);
      });
    });
    const right = rightGems(course, layout);
    expect(right).toHaveLength(course.gems.reduce((n, t) => n + t.groups.length, 0));
    expect(rightGemsForSeed(course, 'gem-seed', questions)).toEqual(right);
  });
  it('are not there with maths off', () => {
    expect(gemLayout(course, 'gem-seed', null)).toEqual([]);
    expect(rightGemsForSeed(course, 'gem-seed', null)).toEqual([]);
    expect(runSetup(course, 'gem-seed', null, true).gems).toEqual([]);
  });
  it('are told to the browser without answers, the right ones as numbers', () => {
    const setup = runSetup(course, 'gem-seed', list(slotPlan(course).total), true);
    expect(setup.gems).toHaveLength(course.gems.length);
    expect(setup.rightGems.length).toBeGreaterThan(0);
    expect(JSON.stringify(setup.gems)).not.toContain('answer');
  });
  it('take a second off when a right one is rolled through, and a wrong one nothing', () => {
    const tiny = compileCourse({
      id: 'tiny-gems', name: 'Tiny gems', rows: ['==========', '=s###f====', '=####f====', '=========='], heights: Array(4).fill('2222222222'),
      route: [], medals: { gold: 2, silver: 4, bronze: 8 }, hardSeconds: 30,
      gems: [{ sign: [1, 1], groups: [{ after: 0, spots: [[3.5, 1.5], [3.5, 2.5]] }] }],
    });
    const run = (right: number[]) => {
      const w = makeWorld(tiny, { rightGems: right });
      const s = newRun(w);
      for (let i = 0; i < 200 && s.outcome === 'running'; i++) stepRun(w, s, 3);
      return s;
    };
    const rightOne = run([0]);
    const wrongOne = run([1]);
    expect(rightOne.gemsTaken).toEqual([0]);
    expect(wrongOne.gemsTaken).toEqual([]);
    expect(rightOne.outcome).toBe('finished');
    expect(rightOne.finishSteps).toBe(wrongOne.finishSteps - GEM_BONUS_STEPS);
  });
  it('count for no more than five a run, and each only once', () => {
    const spots = Array.from({ length: 7 }, (_, i) => [1.5 + i * 0.9, 1.5] as [number, number]);
    const many = compileCourse({
      id: 'many-gems', name: 'Many gems', rows: ['=============', '=s#########f=', '=============',], heights: Array(3).fill('2222222222222'),
      route: [], medals: { gold: 2, silver: 4, bronze: 8 }, hardSeconds: 30,
      gems: [{ sign: [1, 1], groups: spots.map((p) => ({ after: 0, spots: [p, [p[0], 1.9] as [number, number]] })) }],
    });
    const ids = many.gemList.filter((g) => g.spot === 0).map((g) => many.gemList.indexOf(g));
    const w = makeWorld(many, { rightGems: ids });
    const s = newRun(w);
    for (let i = 0; i < 400 && s.outcome === 'running'; i++) stepRun(w, s, 3);
    expect(s.gemsTaken.length).toBeGreaterThan(MAX_GEM_BONUSES);
    expect(s.finishSteps).toBe(s.steps - MAX_GEM_BONUSES * GEM_BONUS_STEPS);
  });
  it('are in the replay: the same inputs with another set of right gems give another time', () => {
    const doors = doorsForSeed(course, 'g', null);
    const none = botRun(course, { openDoors: doors });
    const withGems = replay(course, none.runs, { openDoors: doors, rightGems: [0, 1, 2] });
    const without = replay(course, none.runs, { openDoors: doors });
    expect(withGems!.finishSteps).toBeLessThanOrEqual(without!.finishSteps);
  });
});
