import { describe, expect, it } from 'vitest';
import { autoplay } from './autoplay';
import { isBossWave } from './engine';
import { checkLevel, type LevelData } from './level';
import { CAMPAIGN, findLevel } from './levels';

/** The lowest share of right answers at which the computer player wins (2 of 3 games). */
function needed(level: LevelData): number {
  for (const accuracy of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]) {
    const wins = [1, 2, 3].filter((seed) => autoplay(level, 'sensible', seed, undefined, { accuracy }).phase === 'won').length;
    if (wins >= 2) return accuracy;
  }
  return Infinity;
}

describe('the campaign', () => {
  it('has 10 levels with unique ids, and finds them by id', () => {
    expect(CAMPAIGN).toHaveLength(10);
    expect(new Set(CAMPAIGN.map((l) => l.id)).size).toBe(10);
    expect(findLevel('level-3')).toEqual({ level: CAMPAIGN[2], number: 3 });
    expect(findLevel('nope')).toBeNull();
  });

  it.each(CAMPAIGN.map((l, i) => [i + 1, l] as const))('level %i loads and is valid', (_, level) => {
    expect(checkLevel(level)).toEqual([]);
    expect(level.waves.length).toBeGreaterThanOrEqual(8);
    expect(level.waves.length).toBeLessThanOrEqual(15);
    // Bosses come every 5th wave (and at the end of the later levels), each with a Wave Gate.
    level.waves.forEach((_, w) => {
      if (isBossWave(level, w + 1)) expect((w + 1) % 5 === 0 || w + 1 === level.waves.length).toBe(true);
    });
    expect(isBossWave(level, 5)).toBe(true);
  });

  it('later levels have two paths', () => {
    expect(CAMPAIGN.slice(0, 5).every((l) => l.paths.length === 1)).toBe(true);
    expect(CAMPAIGN.filter((l) => l.paths.length === 2).length).toBeGreaterThanOrEqual(3);
  });

  it('every level can be won with the maths (80% right), and none without it', () => {
    CAMPAIGN.forEach((level, i) => {
      for (const seed of [1, 2, 3]) {
        expect(autoplay(level, 'sensible', seed, undefined, { accuracy: 0.8 }).phase, `level ${i + 1} seed ${seed}`).toBe('won');
      }
      expect(autoplay(level, 'sensible', 1).phase, `level ${i + 1} with no maths`).toBe('lost');
    });
  });

  it('gets harder steadily: the share of right answers needed to win rises', () => {
    const need = CAMPAIGN.map(needed);
    expect(need[0]).toBeLessThanOrEqual(0.3); // level 1 is super easy
    for (let i = 1; i < need.length; i++) expect(need[i], `level ${i + 1} vs ${i}: ${need}`).toBeGreaterThanOrEqual(need[i - 1] - 0.05);
    expect(need[9]).toBeGreaterThanOrEqual(need[0] + 0.2);
    expect(need[9]).toBeLessThanOrEqual(0.8); // still reachable
  }, 60_000);
});
