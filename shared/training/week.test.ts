import { describe, expect, it } from 'vitest';
import { emptyState, recordAnswer } from './records';
import { greenThisWeek, inSameWeek, turnedGreenInWeek, weekLine, weekStart } from './week';
import type { Answer } from './speed';

const right = (day: string, thinkMs: number): Answer => ({ correct: true, thinkMs, day });
const wrong = (day: string): Answer => ({ correct: false, thinkMs: null, day });

describe('the school week', () => {
  it('runs Monday to Sunday', () => {
    expect(weekStart('2026-10-19')).toBe('2026-10-19'); // a Monday
    expect(weekStart('2026-10-25')).toBe('2026-10-19'); // the Sunday after it
    expect(weekStart('2026-10-26')).toBe('2026-10-26'); // the next Monday
    expect(weekStart('2026-10-18')).toBe('2026-10-12'); // Sunday belongs to the week before
  });

  it('knows which days are in this week, at the edges too', () => {
    expect(inSameWeek('2026-10-19', '2026-10-22')).toBe(true);
    expect(inSameWeek('2026-10-25', '2026-10-19')).toBe(true);
    expect(inSameWeek('2026-10-18', '2026-10-19')).toBe(false); // Sunday before
    expect(inSameWeek('2026-10-26', '2026-10-25')).toBe(false); // Monday after
  });

  it('works across a month and year end', () => {
    expect(weekStart('2027-01-01')).toBe('2026-12-28');
    expect(inSameWeek('2026-12-31', '2027-01-02')).toBe(true);
  });
});

describe('a fact turning green this week', () => {
  it('counts when its colour goes to bright green in the week', () => {
    expect(turnedGreenInWeek([right('2026-10-20', 1000)], '2026-10-22')).toBe(true);
  });

  it('does not count one that was already bright green before the week', () => {
    const answers = [right('2026-10-15', 1000), right('2026-10-16', 900), right('2026-10-20', 1000)];
    expect(turnedGreenInWeek(answers, '2026-10-22')).toBe(false);
  });

  it('counts one that was slower last week and turned green this week', () => {
    const answers = [right('2026-10-15', 4000), right('2026-10-16', 4000), right('2026-10-20', 1000), right('2026-10-21', 1000)];
    expect(turnedGreenInWeek(answers, '2026-10-22')).toBe(true);
  });

  it('does not count one that turned green on the Sunday before', () => {
    expect(turnedGreenInWeek([right('2026-10-18', 1000)], '2026-10-19')).toBe(false);
  });

  it('counts one that turned green on the Sunday ending the week, not the day after', () => {
    expect(turnedGreenInWeek([right('2026-10-25', 1000)], '2026-10-21')).toBe(true);
    expect(turnedGreenInWeek([right('2026-10-26', 1000)], '2026-10-21')).toBe(false);
  });

  it('does not count a fact that is only light green, or one that was wrong', () => {
    expect(turnedGreenInWeek([right('2026-10-20', 2000)], '2026-10-22')).toBe(false);
    expect(turnedGreenInWeek([wrong('2026-10-20')], '2026-10-22')).toBe(false);
  });

  it('counts a fact again when it fell back and turned green again', () => {
    const answers = [right('2026-10-12', 1000), wrong('2026-10-14'), wrong('2026-10-15'), right('2026-10-20', 1000), right('2026-10-21', 1000)];
    expect(turnedGreenInWeek(answers, '2026-10-22')).toBe(true);
  });

  it('does not count a full list whose first answers may hide an earlier green', () => {
    // 10 answers: we cannot see before the first two, so the first two are not counted.
    const answers = Array.from({ length: 10 }, (_, i) => right(`2026-10-${20 + (i % 2)}`, 1000));
    expect(turnedGreenInWeek(answers, '2026-10-22')).toBe(false);
  });

  it('counts facts from real records', () => {
    let s = emptyState();
    s = recordAnswer(s, 'mul:2x5', 10, 10, 1500, '2026-10-20').state; // typing 700 ms taken off: 800 ms thinking
    s = recordAnswer(s, 'mul:3x4', 12, 12, 1500, '2026-10-20').state;
    s = recordAnswer(s, 'mul:6x7', 40, 42, 1500, '2026-10-20').state; // wrong
    s = recordAnswer(s, 'mul:2x6', 12, 12, 1500, '2026-10-12').state; // last week
    expect(greenThisWeek(s.records, '2026-10-22')).toBe(2);
  });
});

describe('the this-week line', () => {
  it('is friendly whatever the count', () => {
    expect(weekLine(5)).toBe('5 facts turned green this week!');
    expect(weekLine(1)).toBe('1 fact turned green this week!');
    expect(weekLine(0)).toBe('Every day you practise makes your facts stronger.');
    for (const n of [0, 1, 7]) expect(weekLine(n)).not.toMatch(/slow/i);
  });
});
