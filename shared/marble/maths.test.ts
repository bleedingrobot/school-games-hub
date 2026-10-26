import { describe, expect, it } from 'vitest';
import type { Question } from '../maths/skillPack';
import { compileCourse } from './course';
import { COURSES } from './courses';
import { BONUS } from './inputs';
import { clockSteps, makeWorld, newRun, stepRun } from './engine';
import { gateLayout, openDoors, publicQuestion } from './maths';
import { PIT_BONUS_STEPS } from './config';

const q = (answer: number, extra: Partial<Question> = {}): Question => ({
  id: 1, skill: 's', factKey: 'mul:7x8', kind: 'k', parts: ['7', '×', '8', '=', '?'], spoken: 'seven times eight', answer, band: 4 as never, ...extra,
});

describe('gates', () => {
  it('put the right answer in the tunnel whose door is open, on every course and seed, and never tell the browser the answer', () => {
    for (const course of COURSES.filter((c) => c.gates.length)) {
      for (let n = 0; n < 20; n++) {
        const questions = course.gates.map((_, g) => q(48 + g * 8));
        const layout = gateLayout(course, `seed-${n}`, questions);
        layout.forEach((l, g) => {
          expect(l.values![l.right]).toBe(questions[g].answer);
          expect(new Set(l.values).size).toBe(course.gates[g].tunnels.length);
        });
        expect(openDoors(course, layout)).toHaveLength(course.gates.length);
      }
    }
    const pub = publicQuestion(q(56), 3);
    expect(JSON.stringify(pub)).not.toContain('56');
    expect('factKey' in pub).toBe(false);
  });
});

describe('the bonus input', () => {
  // A straight with a pit stop (2 s), a 1-second stop and a half-second stop.
  const line = compileCourse({
    id: 'stops', name: 'Stops', rows: ['==============', '=s#c##k##h##f=', '=============='], heights: Array(3).fill('22222222222222'),
    route: [], medals: { gold: 2, silver: 4, bronze: 8 }, hardSeconds: 10,
  });
  it('takes off what the stop just reached is worth, once however many are sent, and nothing before a stop', () => {
    expect(line.pitValue).toEqual([PIT_BONUS_STEPS, 60, 30]);
    for (const [n, off] of [[0, 0], [1, PIT_BONUS_STEPS], [2, 60], [3, 30]]) {
      const w = makeWorld(line);
      const s = newRun(w);
      while (s.pitStops.length < n && s.steps < 2000) stepRun(w, s, 3);
      stepRun(w, s, 3);
      const before = clockSteps(w, s);
      stepRun(w, s, BONUS);
      stepRun(w, s, BONUS);
      expect(clockSteps(w, s), `stop ${n}`).toBe(before - off);
    }
  });
});
