import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reloadForNewVersion } from './freshLoad';

describe('freshLoad', () => {

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
