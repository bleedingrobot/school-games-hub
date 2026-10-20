import { describe, expect, it } from 'vitest';
import { botRun } from './bot';
import { doorsForSeed } from './maths';
import { compileCourse } from './course';
import { COURSE_DEFS, COURSES } from './courses';
import { medalFor, replay } from './engine';

describe('every course', () => {
  it.each(COURSES.map((c) => [c.def.id, c] as const))('%s: slopes join up with the floor beside them', (_id, c) => {
    // A slope's low edge must meet a neighbour at the same height (or a gap or wall); otherwise the marble drops off a hidden cliff.
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= c.width || y >= c.height ? null : c.tiles[y * c.width + x]);
    const low: Record<string, [number, number]> = { E: [1, 0], W: [-1, 0], S: [0, 1], N: [0, -1] };
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const t = c.tiles[y * c.width + x];
        if (!t.slope) continue;
        const [dx, dy] = low[t.slope];
        const next = at(x + dx, y + dy);
        if (!next || next.ch === '.' || next.ch === '=') continue;
        const nextHigh = next.level;
        expect(nextHigh, `${c.def.id} slope at ${x},${y}`).toBe(t.level - 1);
        const [hx, hy] = [-dx, -dy];
        const prev = at(x + hx, y + hy);
        if (prev && prev.ch !== '.' && prev.ch !== '=') {
          const expected = prev.slope === t.slope ? t.level + 1 : prev.slope ? null : t.level;
          if (expected !== null) expect(prev.slope === t.slope ? prev.level : prev.level, `${c.def.id} top of slope at ${x},${y}`).toBe(expected);
        }
      }
    }
  });
});

describe('reference runs', () => {
  it.each(COURSES.map((c) => [c.def.id, c] as const))('%s: the bot finishes without falling and earns gold', (_id, c) => {
    const openDoors = doorsForSeed(c, 'test-seed', null);
    const bot = botRun(c, { openDoors });
    expect(bot.state.outcome).toBe('finished');
    expect(bot.state.falls).toBe(0);
    expect(medalFor(c, bot.state.finishSteps)).toBe('gold');
    const again = replay(c, bot.runs, { openDoors });
    expect(again?.finishSteps).toBe(bot.state.finishSteps);
  });
  it.each(COURSES.map((c) => [c.def.id, c] as const))('%s: the bot can also finish in hard mode', (_id, c) => {
    expect(botRun(c, { mode: 'down', openDoors: doorsForSeed(c, 'test-seed', null) }).state.outcome).toBe('finished');
  });
  it('reference times are stable (change a number in config.ts and this tells you the courses moved)', () => {
    expect(COURSES.map((c) => [c.def.id, botRun(c, { openDoors: doorsForSeed(c, 'test-seed', null) }).state.finishSteps])).toMatchInlineSnapshot(`
      [
        [
          "boulder-beach",
          1281,
        ],
        [
          "crown-range",
          3081,
        ],
        [
          "geyser-valley",
          1479,
        ],
        [
          "glacier-run",
          1425,
        ],
        [
          "windy-welly",
          2900,
        ],
        [
          "alpine-crossing",
          1795,
        ],
        [
          "wide-hill",
          1334,
        ],
        [
          "gap-and-ice",
          1331,
        ],
        [
          "test-easy",
          209,
        ],
        [
          "test-hard",
          227,
        ],
      ]
    `);
  });
});

describe('course data', () => {
  it('has unique ids', () => {
    expect(new Set(COURSE_DEFS.map((c) => c.id)).size).toBe(COURSE_DEFS.length);
  });
  it('refuses a broken course', () => {
    const base = COURSE_DEFS[0];
    expect(() => compileCourse({ ...base, rows: ['s#'], heights: ['2'] })).toThrow();
    expect(() => compileCourse({ ...base, rows: ['s#'], heights: ['22'] })).toThrow(/finish/);
    expect(() => compileCourse({ ...base, rows: ['#f'], heights: ['22'] })).toThrow(/start/);
    expect(() => compileCourse({ ...base, rows: ['ssf'], heights: ['222'] })).toThrow(/more than one/);
    expect(() => compileCourse({ ...base, rows: ['s?f'], heights: ['222'] })).toThrow(/unknown/);
  });
});
