import { describe, expect, it } from 'vitest';
import { autoplay } from './autoplay';
import { CAMPAIGN } from './levels';
import { LEVEL_COUNT } from './config';
import { TALE_GOALS, taleMet } from './tale';

describe('the campaign', () => {
  it('every level can be won with the maths (80% right), and none without it; Tale challenges are a stretch', () => {
    expect(CAMPAIGN).toHaveLength(LEVEL_COUNT);
    expect(TALE_GOALS).toHaveLength(LEVEL_COUNT);
    let botTales = 0;
    CAMPAIGN.forEach((level, i) => {
      for (const seed of [1, 2, 3]) {
        const won = autoplay(level, 'sensible', seed, undefined, { accuracy: 0.8 });
        expect(won.phase, `level ${i + 1} seed ${seed}`).toBe('won');
        if (seed === 1 && taleMet(TALE_GOALS[i], won)) botTales++;
      }
      const lost = autoplay(level, 'sensible', 1);
      expect(lost.phase, `level ${i + 1} with no maths`).toBe('lost');
      expect(taleMet(TALE_GOALS[i], lost)).toBe(false);
    });
    // The plain computer player wins only a few of them without trying (docs/plans/stories/PLAN.md, ST.4).
    expect(botTales).toBeGreaterThan(0);
    expect(botTales).toBeLessThan(6);
  });
});
