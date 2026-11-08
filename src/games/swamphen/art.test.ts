import { describe, expect, it } from 'vitest';
import { KEYS } from '../../../shared/swamphen/round';
import { cellMode } from './art';
import { DEMO_KEYS } from './Demo';

describe('cellMode', () => {
  it('always shows the first row and column; only the inside fades or is covered', () => {
    for (const v of ['count', 'rows']) {
      expect(cellMode(v, 3, 3, false)).toBe('full');
      expect(cellMode(v, 3, 3, true)).toBe('covered');
      expect(cellMode(v, 0, 3, true)).toBe('full');
      expect(cellMode(v, 3, 0, true)).toBe('full');
    }
    for (const v of ['bars', 'edges']) {
      expect(cellMode(v, 0, 4, false)).toBe('full');
      expect(cellMode(v, 4, 0, false)).toBe('full');
      expect(cellMode(v, 2, 2, false)).toBe('faint');
      expect(cellMode(v, 2, 2, true)).toBe('covered');
      expect(cellMode(v, 0, 2, true)).toBe('full');
    }
    for (const v of ['plain', 'peek']) expect(cellMode(v, 0, 0, false)).toBe('none');
  });
});

describe('the show-me-first examples', () => {
  it('are sizes the real round can never ask', () => {
    for (const key of Object.values(DEMO_KEYS)) expect(KEYS).not.toContain(key);
  });
});
