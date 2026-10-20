import { describe, expect, it } from 'vitest';
import { flyLevel } from '../../../shared/mine/bot';
import { makeWorld } from '../../../shared/mine/engine';
import { makeLevel } from '../../../shared/mine/level';
import { LEVELS, PRACTICE, formatClock, levelById } from './levels';

describe('the list of mines', () => {
  it('has the practice mine and the six levels, in order', () => {
    expect(LEVELS.map((l) => l.id)).toEqual(['l1', 'l2', 'l3', 'l4', 'l5', 'l6']);
    expect(LEVELS.map((l) => l.difficulty)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(levelById('practice')).toBe(PRACTICE);
    expect(levelById('l4')?.name).toBe('Mine 4');
    expect(levelById('nope')).toBeUndefined();
  });
  it('knows which levels need questions', () => {
    expect(PRACTICE.needsQuestions).toBe(false);
    expect(LEVELS.every((l) => l.needsQuestions)).toBe(true);
  });
  it('has a practice mine that can be finished with no questions at all', () => {
    const level = makeLevel(PRACTICE.recipe);
    expect(level.doors.every((d) => d.kind !== 'question')).toBe(true);
    expect(level.pads).toHaveLength(0);
    for (const steady of [true, false]) {
      const run = flyLevel(makeWorld(level, { steady }));
      expect(run.state.outcome).toBe('finished');
      expect(run.state.doorsByAnswer).toBe(0);
    }
  });
});

describe('the clock', () => {
  it('shows minutes, seconds and tenths for steps at 30 a second', () => {
    expect(formatClock(0)).toBe('0:00.0');
    expect(formatClock(30)).toBe('0:01.0');
    expect(formatClock(45)).toBe('0:01.5');
    expect(formatClock(30 * 65 + 3)).toBe('1:05.1');
  });
});
