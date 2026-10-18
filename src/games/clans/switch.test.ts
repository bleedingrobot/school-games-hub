import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchClansEnabled = vi.hoisted(() => {
  // A plain function (not a spy), so a rejected promise is only seen by the code under test.
  const f = (() => f.impl()) as { (): Promise<boolean>; impl: () => Promise<boolean>; calls: number };
  f.impl = () => Promise.resolve(false);
  f.calls = 0;
  return f;
});
vi.mock('../../data/clans', () => ({ fetchClansEnabled: () => { fetchClansEnabled.calls++; return fetchClansEnabled.impl(); } }));
const registry = vi.hoisted(() => ({ CLAN_QUEST_ON: false }));
vi.mock('../registry', () => registry);

import { useClansEnabled } from './switch';

beforeEach(() => { fetchClansEnabled.calls = 0; });
afterEach(cleanup);

describe('the Clan Quest dashboard switch', () => {
  it('asks nothing of the server while the code switch is off, and says off', () => {
    registry.CLAN_QUEST_ON = false;
    const { result } = renderHook(() => useClansEnabled());
    expect(result.current).toBe(false);
    expect(fetchClansEnabled.calls).toBe(0);
  });

  it('follows the teacher’s switch once the code switch is on, and stays off until it knows', async () => {
    registry.CLAN_QUEST_ON = true;
    fetchClansEnabled.impl = () => Promise.resolve(true);
    const { result } = renderHook(() => useClansEnabled());
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('stays off if the setting cannot be read (before the database is ready)', async () => {
    registry.CLAN_QUEST_ON = true;
    fetchClansEnabled.impl = () => Promise.reject(new Error('no column'));
    const { result } = renderHook(() => useClansEnabled());
    await waitFor(() => expect(result.current).toBe(false));
  });
});
