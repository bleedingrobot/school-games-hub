import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RosterStudent } from '../data/classOverview';
import type { GameDefinition} from '../games/types';

const data = vi.hoisted(() => ({ fetchClassOverview: vi.fn(), fetchWarpRequests: vi.fn(async () => []), quickLooksAlerts: vi.fn() }));
vi.mock('./foundational/alerts', () => ({ GRID_SECTION: 'maths/foundational', quickLooksAlerts: data.quickLooksAlerts }));
vi.mock('../data/classOverview', async (original) => ({ ...(await original<typeof import('../data/classOverview')>()), fetchClassOverview: data.fetchClassOverview }));
vi.mock('../data/classes', async (original) => ({ ...(await original<typeof import('../data/classes')>()), fetchWarpRequests: data.fetchWarpRequests }));

import { useClassAlerts } from './useClassAlerts';

const student = (name: string, shown: number, skipped: number, hidden = false) =>
  ({ id: name, name, realName: null, avatar: null, hidden, games: 0, points: 0, lastPlayed: null, lastActive: null, shown, skipped }) as unknown as RosterStudent;
// The hook runs again when `games` changes identity, so tests pass one array, as the app does with ALL_GAMES.
const NO_GAMES: GameDefinition[] = [];

beforeEach(() => {
  data.fetchClassOverview.mockReset();
  data.fetchClassOverview.mockResolvedValue([]);
  data.quickLooksAlerts.mockReset();
  data.quickLooksAlerts.mockResolvedValue([]);
});


describe('useClassAlerts', () => {
  it('adds a skip line counting only shown >= 5, share >= 0.3, not hidden', async () => {
    data.fetchClassOverview.mockResolvedValue([
      student('yes1', 10, 3),
      student('yes2', 5, 5),
      student('lowShare', 10, 2),
      student('fewShown', 4, 4),
      student('hidden', 10, 10, true),
    ]);
    const { result } = renderHook(() => useClassAlerts('c1', NO_GAMES));
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0]).toEqual({ id: 'skips', text: '2 students skipped 30% or more of their questions this week', section: 'students?sort=skipped' });
  });

});
