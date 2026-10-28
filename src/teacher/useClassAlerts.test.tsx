import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RosterStudent } from '../data/classOverview';
import type { GameDefinition, TeacherAlert } from '../games/types';

const data = vi.hoisted(() => ({ fetchClassOverview: vi.fn(), fetchWarpRequests: vi.fn(async () => []) }));
vi.mock('../data/classOverview', async (original) => ({ ...(await original<typeof import('../data/classOverview')>()), fetchClassOverview: data.fetchClassOverview }));
vi.mock('../data/classes', async (original) => ({ ...(await original<typeof import('../data/classes')>()), fetchWarpRequests: data.fetchWarpRequests }));

import { useClassAlerts } from './useClassAlerts';
import { NeedsYou, WaitingToJoinProvider } from './WaitingToJoin';

const student = (name: string, shown: number, skipped: number, hidden = false) =>
  ({ id: name, name, realName: null, avatar: null, hidden, games: 0, points: 0, lastPlayed: null, lastActive: null, shown, skipped }) as unknown as RosterStudent;
const fake = (id: string, alerts?: () => Promise<TeacherAlert[]>) => ({ id, name: id, teacher: alerts ? { alerts } : {} }) as unknown as GameDefinition;
// The hook runs again when `games` changes identity, so tests pass one array, as the app does with ALL_GAMES.
const NO_GAMES: GameDefinition[] = [];
const monstersAlert: TeacherAlert = { id: 'monsters:Otter', text: 'Maths Monsters turned down a save from Otter this week', section: 'games/monsters' };

beforeEach(() => {
  data.fetchClassOverview.mockReset();
  data.fetchClassOverview.mockResolvedValue([]);
});

describe('NeedsYou with alerts', () => {
  const show = (alerts: TeacherAlert[]) =>
    render(
      <MemoryRouter>
        <WaitingToJoinProvider teacher>
          <NeedsYou classId="c1" alerts={alerts} />
        </WaitingToJoinProvider>
      </MemoryRouter>,
    );

  it('shows the count, the text and a link to the game', async () => {
    show([monstersAlert, { id: 'skips', text: '2 students skipped 30% or more of their questions this week' }]);
    const region = await screen.findByRole('region', { name: /Needs you/ });
    expect(region).toHaveTextContent('Needs you2');
    expect(screen.getByText(/Maths Monsters turned down a save/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: `See: ${monstersAlert.text}` })).toHaveAttribute('href', '/teacher/c1/games/monsters');
    // an alert with no section has no link
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('is quiet with no requests and no alerts', async () => {
    show([]);
    await waitFor(() => expect(data.fetchWarpRequests).toHaveBeenCalled());
    expect(screen.getByText('Nothing needs you right now.')).toBeInTheDocument();
  });
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

  it('says "1 student" and adds nothing when nobody qualifies', async () => {
    data.fetchClassOverview.mockResolvedValue([student('a', 5, 2)]);
    const one = renderHook(() => useClassAlerts('c1', NO_GAMES));
    await waitFor(() => expect(one.result.current[0]?.text).toMatch(/^1 student skipped/));
  });

  it('has no skip line when nobody qualifies', async () => {
    data.fetchClassOverview.mockResolvedValue([student('a', 10, 1)]);
    const alerts = vi.fn(async () => [monstersAlert]);
    const games = [fake('monsters', alerts)];
    const { result } = renderHook(() => useClassAlerts('c1', games));
    await waitFor(() => expect(result.current).toEqual([monstersAlert]));
    expect(alerts).toHaveBeenCalledWith('c1');
  });

  it('leaves out a game whose alerts reject, and keeps the rest', async () => {
    data.fetchClassOverview.mockResolvedValue([student('a', 10, 5)]);
    const games = [fake('bad', async () => { throw new Error('x'); }), fake('monsters', async () => [monstersAlert]), fake('silent')];
    const { result } = renderHook(() => useClassAlerts('c1', games));
    await waitFor(() => expect(result.current.map((a) => a.id)).toEqual(['skips', 'monsters:Otter']));
  });

  it('still shows game alerts if the class overview fails', async () => {
    data.fetchClassOverview.mockRejectedValue(new Error('x'));
    const games = [fake('monsters', async () => [monstersAlert])];
    const { result } = renderHook(() => useClassAlerts('c1', games));
    await waitFor(() => expect(result.current).toEqual([monstersAlert]));
  });
});
