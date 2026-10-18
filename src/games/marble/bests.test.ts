import { beforeEach, describe, expect, it } from 'vitest';
import { formatSteps, loadBests, saveBests, withFinish } from './bests';

beforeEach(() => localStorage.clear());

describe('bests', () => {
  it('keeps only faster times', () => {
    let b = withFinish({}, 'a', 'up', 600);
    expect(b.isBest).toBe(true);
    b = withFinish(b.bests, 'a', 'up', 700);
    expect(b.isBest).toBe(false);
    expect(b.bests.a.up).toBe(600);
    b = withFinish(b.bests, 'a', 'up', 500);
    expect(b.bests.a.up).toBe(500);
    b = withFinish(b.bests, 'a', 'down', 900);
    expect(b.bests.a).toEqual({ up: 500, down: 900 });
  });
  it('saves, loads and ignores rubbish', () => {
    saveBests({ a: { up: 120 } });
    expect(loadBests()).toEqual({ a: { up: 120 } });
    localStorage.setItem('marble-rush-bests-v1', '{"a":{"up":"x","down":-4},"b":5}');
    expect(loadBests()).toEqual({ a: {}, b: {} });
    localStorage.setItem('marble-rush-bests-v1', 'nope');
    expect(loadBests()).toEqual({});
  });
  it('writes times as minutes, seconds and hundredths', () => {
    expect(formatSteps(0)).toBe('0:00.00');
    expect(formatSteps(270)).toBe('0:04.50');
    expect(formatSteps(60 * 75)).toBe('1:15.00');
  });
});
