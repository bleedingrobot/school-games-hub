import { describe, expect, it } from 'vitest';
import { orbitRadius, orbitSpeed } from './orbits';
import { judgeFrames } from './levels';

describe('Star Forge viewer', () => {
  it('spaces orbits out by slot and runs inner planets faster by Kepler\'s rule', () => {
    const r = [0, 1, 2, 5].map((slot) => orbitRadius(slot, 'yellow'));
    expect(r[1]).toBeGreaterThan(r[0]);
    expect(r[3]).toBeGreaterThan(r[2]);
    const w = r.map((x) => orbitSpeed(x, 'yellow'));
    expect(w[0]).toBeGreaterThan(w[1]);
    // period² ∝ radius³, so speed² × radius³ is the same for every orbit
    const k = (i: number) => w[i] * w[i] * r[i] ** 3;
    expect(k(3) / k(0)).toBeCloseTo(1, 6);
  });

  it('keeps a level while frames are quick and drops it when they stay slow', () => {
    expect(judgeFrames('incredible', Array(60).fill(16.7))).toBe('incredible');
    expect(judgeFrames('incredible', Array(60).fill(33))).toBe('normal');
    expect(judgeFrames('incredible', Array(60).fill(90))).toBe('simple');
    expect(judgeFrames('normal', Array(60).fill(60))).toBe('simple');
    expect(judgeFrames('simple', Array(60).fill(200))).toBe('simple');
  });
});
