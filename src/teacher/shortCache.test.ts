import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shortCache } from './shortCache';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('shortCache', () => {
  it('shares one request for the same key', async () => {
    const load = vi.fn(async () => 'a');
    const [x, y] = await Promise.all([shortCache('k', load), shortCache('k', load)]);
    expect(load).toHaveBeenCalledTimes(1);
    expect([x, y]).toEqual(['a', 'a']);
  });

  it('does not share between different keys', async () => {
    const load = vi.fn(async () => 'a');
    await shortCache('k1', load);
    await shortCache('k2', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('loads again after 10 seconds', async () => {
    const load = vi.fn(async () => 'a');
    await shortCache('k', load);
    vi.advanceTimersByTime(9_999);
    await shortCache('k', load);
    expect(load).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    await shortCache('k', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not keep a rejection', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('no')).mockResolvedValue('ok');
    await expect(shortCache('k', load)).rejects.toThrow('no');
    await expect(shortCache('k', load)).resolves.toBe('ok');
    expect(load).toHaveBeenCalledTimes(2);
  });
});
