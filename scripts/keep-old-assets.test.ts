import { describe, expect, it } from 'vitest';
// @ts-expect-error: a plain script, with no type file
import { isAssetPath, planKeep } from './keep-old-assets.mjs';

const NOW = Date.parse('2026-11-06T20:00:00Z');
const HOUR = 3_600_000;

describe('keeping the last version’s game files', () => {
  it('first publish: lists the build, fetches nothing', () => {
    expect(planKeep(null, ['assets/a-1.js'], NOW)).toEqual({ manifest: { 'assets/a-1.js': null }, fetch: [] });
  });

  it('a file the new build dropped is fetched back and marked with when it stopped being used', () => {
    const plan = planKeep({ 'assets/a-1.js': null, 'assets/b-1.png': null }, ['assets/a-2.js', 'assets/b-1.png'], NOW);
    expect(plan.fetch).toEqual(['assets/a-1.js']);
    expect(plan.manifest).toEqual({
      'assets/a-2.js': null,
      'assets/b-1.png': null,
      'assets/a-1.js': new Date(NOW).toISOString(),
    });
  });

  it('keeps an old file until it has been unused for 48 hours, then lets it go', () => {
    const young = new Date(NOW - 47 * HOUR).toISOString();
    const old = new Date(NOW - 48 * HOUR).toISOString();
    const plan = planKeep({ 'assets/young.js': young, 'assets/old.js': old }, [], NOW);
    expect(plan.fetch).toEqual(['assets/young.js']);
    expect(plan.manifest).toEqual({ 'assets/young.js': young });
  });

  it('a file that comes back into use is in use again', () => {
    const plan = planKeep({ 'assets/a-1.js': new Date(NOW - HOUR).toISOString() }, ['assets/a-1.js'], NOW);
    expect(plan).toEqual({ manifest: { 'assets/a-1.js': null }, fetch: [] });
  });

  it('never writes outside assets/, whatever the live list says', () => {
    expect(isAssetPath('assets/x/y.js')).toBe(true);
    for (const bad of ['index.html', 'assets/../index.html', '/assets/a.js', 'assets//a.js', 'assets/./a.js']) {
      expect(isAssetPath(bad)).toBe(false);
    }
    expect(planKeep({ 'index.html': null, 'assets/../x': null, 'assets/bad': 'not a date' }, [], NOW).fetch).toEqual([]);
  });
});
