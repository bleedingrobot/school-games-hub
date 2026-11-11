import { describe, expect, it } from 'vitest';
import { autoplay } from './autoplay';
import { CAMPAIGN } from './levels';

describe('the campaign', () => {
  it('every level can be won with the maths (80% right), and none without it', () => {
    CAMPAIGN.forEach((level, i) => {
      for (const seed of [1, 2, 3]) {
        expect(autoplay(level, 'sensible', seed, undefined, { accuracy: 0.8 }).phase, `level ${i + 1} seed ${seed}`).toBe('won');
      }
      expect(autoplay(level, 'sensible', 1).phase, `level ${i + 1} with no maths`).toBe('lost');
    });
  });
});
