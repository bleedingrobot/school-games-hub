import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadBest, loadHideStats, recordGame, saveHideStats } from './bests';

afterEach(() => vi.restoreAllMocks());

describe('Bond Match bests', () => {
  it('remembers the first game as the best', () => {
    expect(loadBest('whole-10', 'small')).toBeUndefined();
    const r = recordGame('whole-10', 'small', 9, 40);
    expect(r.best).toEqual({ flips: 9, seconds: 40 });
    expect(r.before).toBeUndefined();
    expect(r.newFlips).toBe(false);
    expect(loadBest('whole-10', 'small')).toEqual({ flips: 9, seconds: 40 });
  });

  it('keeps fewest flips and fastest time separately, per bond set and board size', () => {
    recordGame('whole-10', 'small', 9, 40);
    const r = recordGame('whole-10', 'small', 12, 30);
    expect(r.best).toEqual({ flips: 9, seconds: 30 });
    expect(r.newFlips).toBe(false);
    expect(r.newTime).toBe(true);
    expect(recordGame('whole-10', 'small', 7, 90).newFlips).toBe(true);
    expect(loadBest('whole-10', 'small')).toEqual({ flips: 7, seconds: 30 });
    expect(loadBest('whole-10', 'medium')).toBeUndefined();
    expect(loadBest('whole-20', 'small')).toBeUndefined();
  });

  it('ignores damaged saved data', () => {
    localStorage.setItem('sgh-bond-match-bests', '{"whole-10:small":{"flips":"lots"},"x":{"flips":5,"seconds":9}}');
    expect(loadBest('whole-10', 'small')).toBeUndefined();
    expect(loadBest('x' as never, '' as never)).toBeUndefined();
    localStorage.setItem('sgh-bond-match-bests', 'not json');
    expect(recordGame('whole-10', 'small', 8, 20).best).toEqual({ flips: 8, seconds: 20 });
  });

  it('carries on when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(loadBest('whole-10', 'small')).toBeUndefined();
    expect(recordGame('whole-10', 'small', 8, 20).best).toEqual({ flips: 8, seconds: 20 });
    expect(loadHideStats()).toBe(false);
    expect(() => saveHideStats(true)).not.toThrow();
  });

  it('remembers hiding flips and time', () => {
    expect(loadHideStats()).toBe(false);
    saveHideStats(true);
    expect(loadHideStats()).toBe(true);
  });
});
