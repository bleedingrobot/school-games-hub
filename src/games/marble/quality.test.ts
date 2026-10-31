import { describe, expect, it } from 'vitest';
import { lowerQuality, QUALITY, settingsFor, startQuality } from './quality';

describe('quality levels', () => {
  it('starts on Normal for Chromebooks and ordinary screens, Best for sharp ones', () => {
    expect(startQuality('Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)', 2)).toBe('normal');
    expect(startQuality('Mozilla/5.0 (Windows NT 10.0)', 1)).toBe('normal');
    expect(startQuality('Mozilla/5.0 (iPad; CPU OS 17_0)', 2)).toBe('best');
    expect(startQuality('Mozilla/5.0 (Macintosh)', 3)).toBe('best');
  });

  it('drops one level at a time and stops at Simple', () => {
    expect(lowerQuality('best')).toBe('normal');
    expect(lowerQuality('normal')).toBe('simple');
    expect(lowerQuality('simple')).toBe('simple');
  });

  it('has no shadows or trail on Simple, and more particles as it goes up', () => {
    expect(QUALITY.simple.shadows).toBe(false);
    expect(QUALITY.simple.trail).toBe(false);
    expect(QUALITY.normal.shadowMapSize).toBe(1024);
    expect(QUALITY.best.shadowMapSize).toBe(2048);
    expect(QUALITY.simple.particles).toBeLessThan(QUALITY.normal.particles);
    expect(QUALITY.normal.particles).toBeLessThan(QUALITY.best.particles);
  });

  it('caps the pixel ratio by the screen', () => {
    expect(settingsFor('best', 1).pixelRatio).toBe(1);
    expect(settingsFor('normal', 3).pixelRatio).toBe(1.5);
    expect(settingsFor('best', 3).pixelRatio).toBe(2);
    expect(settingsFor('simple', 3).pixelRatio).toBe(1);
  });
});
