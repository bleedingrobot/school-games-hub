import { describe, expect, it } from 'vitest';
import { courseById } from '../../../shared/marble/courses';
import { gateLayout, runSetup } from '../../../shared/marble/maths';
import type { Question } from '../../../shared/maths/skillPack';
import { arrowFor, gateSigns } from './signs';

const course = courseById('geyser-valley')!;
const q = (answer: number): Question => ({ id: 0, skill: 's', factKey: 'mul:7x8', kind: 'k', parts: ['7', '×', '8', '=', '?'], spoken: 's', answer, band: 4 as never });

describe('gate signs', () => {
  it('hangs an answer over every tunnel with maths', () => {
    const setup = runSetup(course, 'seed-a', [q(56), q(48), q(0), q(0), q(0), q(0), q(0), q(0), q(0), q(0)], true);
    const signs = gateSigns(course, setup);
    expect(signs).toHaveLength(course.gates.reduce((n, g) => n + g.tunnels.length, 0));
    const layout = gateLayout(course, 'seed-a', [q(56), q(48)]);
    expect(signs.filter((s) => s.text === '56')).toHaveLength(1);
    expect(layout[0].values).toContain(56);
    expect(signs.every((s) => !s.arrow)).toBe(true);
  });
  it('hangs one arrow over the open tunnel of each gate with maths off', () => {
    const setup = runSetup(course, 'seed-a', null, false);
    const signs = gateSigns(course, setup);
    expect(signs).toHaveLength(course.gates.length);
    expect(signs.every((s) => s.arrow && /^[⬅➡⬆⬇]$/.test(s.text))).toBe(true);
  });
  it('points the way the tunnel runs', () => {
    expect(arrowFor(3, 0.2)).toBe('➡');
    expect(arrowFor(-3, 0)).toBe('⬅');
    expect(arrowFor(0, 3)).toBe('⬇');
    expect(arrowFor(0.5, -3)).toBe('⬆');
  });
});
