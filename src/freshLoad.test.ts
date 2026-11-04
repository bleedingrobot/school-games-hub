import { beforeEach, describe, expect, it, vi } from 'vitest';
import { freshUrl, isChunkLoadError, reloadForNewVersion } from './freshLoad';

describe('freshLoad', () => {
  it('spots a game file that a newer publish replaced', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/HopPlay-EuPaPemo.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('members[i] is undefined'))).toBe(false);
  });

  it('adds a fresh mark before the game address', () => {
    expect(freshUrl({ pathname: '/school-games-hub/', search: '', hash: '#/play/hop' }, 5)).toBe('/school-games-hub/?fresh=5#/play/hop');
    expect(freshUrl({ pathname: '/', search: '?fresh=1&a=b', hash: '' }, 7)).toBe('/?fresh=7&a=b');
  });

  describe('reloading', () => {
    const go = vi.fn();
    beforeEach(() => sessionStorage.clear());

    it('reloads once, then not again within a minute, so it cannot loop', () => {
      expect(reloadForNewVersion(1_000_000, go)).toBe(true);
      expect(reloadForNewVersion(1_030_000, go)).toBe(false);
      expect(go).toHaveBeenCalledTimes(1);
      expect(reloadForNewVersion(1_070_000, go)).toBe(true);
      expect(go).toHaveBeenCalledTimes(2);
    });
  });
});
