import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveStatus } from '../data/multiplayer';
import { useGameChecks } from './useGameChecks';

/**
 * Server load S.3: games with classmates check for missed changes less and less often while live updates are broken,
 * and back to normal as soon as live updates work again.
 */

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const pass = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const SECOND = 1000;

describe('checking a game', () => {
  it('slows down while live updates are broken, and goes back to every 20 seconds once they work', async () => {
    const check = vi.fn();
    const view = renderHook(({ live }) => useGameChecks(true, live, check), { initialProps: { live: 'down' as LiveStatus } });
    await pass(60 * SECOND); // checks at 4, 12, 28 and 58 seconds
    expect(check).toHaveBeenCalledTimes(4);
    view.rerender({ live: 'live' });
    await pass(19 * SECOND);
    expect(check).toHaveBeenCalledTimes(4);
    await pass(1 * SECOND);
    expect(check).toHaveBeenCalledTimes(5);
  });
});
