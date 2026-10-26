import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, loadBests, loadPrefs, parsePrefs, saveBests, savePrefs, withFinish, wantsLessMotion } from './prefs';

beforeEach(() => localStorage.clear());

describe('choices', () => {
  it('starts with steady flight, the arrow on and touch sticks only on touch screens', () => {
    expect(DEFAULT_PREFS).toMatchObject({ steady: true, arrow: true, touch: 'auto', hand: 'right', lock: false, lessMotion: null });
  });
  it('remembers each pupil’s choices separately', () => {
    savePrefs({ ...DEFAULT_PREFS, hand: 'left', steady: false }, 'ana');
    savePrefs({ ...DEFAULT_PREFS, sensitivity: 2 }, 'ben');
    expect(loadPrefs('ana')).toMatchObject({ hand: 'left', steady: false });
    expect(loadPrefs('ben').sensitivity).toBe(2);
    expect(loadPrefs('cat')).toEqual(DEFAULT_PREFS);
  });
  it('ignores anything odd that was stored', () => {
    localStorage.setItem('mine-runner-prefs-v1:x', '{"hand":"up","sensitivity":"fast","steady":3,"touch":"maybe"}');
    expect(loadPrefs('x')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs({ sensitivity: 99 }).sensitivity).toBe(2.5);
    expect(parsePrefs({ sensitivity: -4 }).sensitivity).toBe(0.4);
    localStorage.setItem('mine-runner-prefs-v1:y', 'not json');
    expect(loadPrefs('y')).toEqual(DEFAULT_PREFS);
  });
  it('follows the device for less motion until the pupil chooses', () => {
    expect(wantsLessMotion({ ...DEFAULT_PREFS, lessMotion: true })).toBe(true);
    expect(wantsLessMotion({ ...DEFAULT_PREFS, lessMotion: false })).toBe(false);
    expect(wantsLessMotion(DEFAULT_PREFS)).toBe(false);
  });
});

describe('best times on this device', () => {
  it('keeps the quicker time only', () => {
    let r = withFinish({}, 'l1', 900);
    expect(r).toEqual({ bests: { l1: 900 }, isBest: true });
    r = withFinish(r.bests, 'l1', 1000);
    expect(r.isBest).toBe(false);
    expect(r.bests.l1).toBe(900);
    r = withFinish(r.bests, 'l1', 800);
    expect(r).toEqual({ bests: { l1: 800 }, isBest: true });
  });
  it('saves and loads them, ignoring rubbish', () => {
    saveBests({ l1: 800, l2: 1200 }, 'ana');
    expect(loadBests('ana')).toEqual({ l1: 800, l2: 1200 });
    localStorage.setItem('mine-runner-bests-v1:z', '{"l1":-3,"l2":"x","l3":500}');
    expect(loadBests('z')).toEqual({ l3: 500 });
  });
});
