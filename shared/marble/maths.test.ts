import { describe, expect, it } from 'vitest';
import type { Question } from '../maths/skillPack';
import { compileCourse, type CourseDef } from './course';
import { COURSES, courseById } from './courses';
import { BONUS, countCode, decodeInputs, encodeInputs, pushInput } from './inputs';
import { clockSteps, makeWorld, newRun, replay, stepRun } from './engine';
import { doorMask, doorsForSeed, doorsFromMask, gateLayout, openDoors, publicQuestion, seededRandom, slotPlan } from './maths';
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
  const c = courseById('boulder-beach')!;
  it('takes a pit-stop bonus off the clock, and each one is a run of its own', () => {
    const w = makeWorld(c);
    const s = newRun(w);
    stepRun(w, s, 3);
    const before = clockSteps(w, s);
    stepRun(w, s, BONUS);
    expect(clockSteps(w, s)).toBe(before - PIT_BONUS_STEPS);
    const runs: [number, number][] = [];
    pushInput(runs, BONUS);
    pushInput(runs, BONUS);
    expect(runs).toEqual([[BONUS, 1], [BONUS, 1]]);
    expect(countCode(runs, BONUS)).toBe(2);
    expect(decodeInputs(encodeInputs(runs))).toEqual(runs);
  });
  it('a replay counts them the same way', () => {
    const r = replay(c, [[3, 10], [BONUS, 1], [3, 10]])!;
    expect(r.state.penalty).toBe(-PIT_BONUS_STEPS);
  });
});
