import { describe, expect, it } from 'vitest';
import type { Question } from '../maths/skillPack';
import { courseById } from './courses';
import { gateLayout, openDoors, publicQuestion } from './maths';

const q = (answer: number, extra: Partial<Question> = {}): Question => ({
  id: 1, skill: 's', factKey: 'mul:7x8', kind: 'k', parts: ['7', '×', '8', '=', '?'], spoken: 'seven times eight', answer, band: 4 as never, ...extra,
});

describe('gate layout', () => {
  it('puts the right answer in the tunnel whose door is open, the same every time, and never tells the browser an answer', () => {
    const course = courseById('geyser-valley')!;
    const questions = [q(56), q(48)];
    for (let n = 0; n < 50; n++) {
      const a = gateLayout(course, `seed-${n}`, questions);
      expect(gateLayout(course, `seed-${n}`, questions)).toEqual(a);
      a.forEach((l, g) => {
        expect(l.values![l.right]).toBe(questions[g].answer);
        expect(new Set(l.values).size).toBe(course.gates[g].tunnels.length);
        expect(l.labels).toHaveLength(course.gates[g].tunnels.length);
      });
      expect(openDoors(course, a)).toHaveLength(2);
    }
    const pub = publicQuestion(q(56), 3);
    expect(JSON.stringify(pub)).not.toContain('56');
    expect('answer' in pub).toBe(false);
    expect('factKey' in pub).toBe(false);
  });
});
