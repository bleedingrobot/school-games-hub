import { describe, expect, it } from 'vitest';
import { parseClassLiveTimes } from './classliveTimes';

const good = { id: 1, days: [1, 2, 3, 4, 5], at: '12:40', activity: 'serpent', length: 5, min: 6, open: 3, host: 'Games Hub', level: 'gold', on: true };

describe('parseClassLiveTimes', () => {
  it('keeps a good row', () => {
    expect(parseClassLiveTimes([good])).toEqual([good]);
  });
  it('drops bad rows and keeps the rest', () => {
    const bad = [null, 'x', { ...good, at: '25:99' }, { ...good, activity: 'star' }, { ...good, days: [] }, { ...good, id: 'a' }];
    expect(parseClassLiveTimes([...bad, { ...good, id: 2 }])).toHaveLength(1);
  });
  it('fixes odd numbers and a missing name', () => {
    const [t] = parseClassLiveTimes([{ ...good, length: 7, min: 99, open: 0, host: ' ', level: '', days: [3, 3, 1, 9] }]);
    expect(t).toMatchObject({ length: 5, min: 40, open: 1, host: 'Games Hub', level: null, days: [1, 3] });
  });
  it('gives nothing for a non-list', () => {
    expect(parseClassLiveTimes(undefined)).toEqual([]);
  });
});
