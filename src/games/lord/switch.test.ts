import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchLordEnabled = vi.hoisted(() => vi.fn());
vi.mock('../../data/lord', () => ({ fetchLordEnabled }));
const registry = vi.hoisted(() => ({ DRAGON_MATHS_ON: false }));
vi.mock('../registry', () => registry);

import { useLordEnabled } from './switch';

beforeEach(() => fetchLordEnabled.mockReset());
afterEach(cleanup);

describe('the Dragon Maths dashboard switch', () => {
  it('asks nothing of the server while the code switch is off, and says off', () => {
    registry.DRAGON_MATHS_ON = false;
    const { result } = renderHook(() => useLordEnabled());
    expect(result.current).toBe(false);
    expect(fetchLordEnabled).not.toHaveBeenCalled();
  });

  it('follows the teacher’s switch once the code switch is on, and stays off until it knows', async () => {
    registry.DRAGON_MATHS_ON = true;
    fetchLordEnabled.mockResolvedValue(true);
    const { result } = renderHook(() => useLordEnabled());
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe(true));
  });
});
