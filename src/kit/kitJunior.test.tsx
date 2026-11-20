import { act, cleanup, renderHook} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGuidedFirstGo, useSeenKinds } from '.';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('kit junior bits', () => {

  // One test for both, to stay in the kit's test budget (docs/TESTING.md).
  it('the first-go hand waits, then points (never on a later go); seen kinds show at once and a failed save is sent again', async () => {
    vi.useFakeTimers();
    const first = renderHook(() => useGuidedFirstGo(true, 2600));
    act(() => first.result.current.start());
    act(() => void vi.advanceTimersByTime(2599));
    expect(first.result.current.pointing).toBe(false);
    act(() => void vi.advanceTimersByTime(1));
    expect(first.result.current.pointing).toBe(true);
    act(() => first.result.current.stop());
    expect(first.result.current.pointing).toBe(false);
    const later = renderHook(() => useGuidedFirstGo(false, 10));
    act(() => later.result.current.start());
    act(() => void vi.advanceTimersByTime(100));
    expect(later.result.current.pointing).toBe(false);
    vi.useRealTimers();

    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const { result } = renderHook(() => useSeenKinds(['swap'], save));
    expect(result.current.has('swap')).toBe(true);
    expect(result.current.has('zoom')).toBe(false);
    await act(async () => void (await result.current.mark(['zoom'])));
    expect(result.current.has('zoom')).toBe(true);
    await act(async () => void (await result.current.mark(['pairs'])));
    expect(save).toHaveBeenNthCalledWith(1, ['zoom']);
    expect(save).toHaveBeenNthCalledWith(2, ['zoom', 'pairs']);
    await act(async () => void (await result.current.mark(['zoom'])));
    expect(save).toHaveBeenCalledTimes(2);
  });

});
