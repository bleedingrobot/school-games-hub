import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dayString, emptyState, recordAnswer } from '../../shared/training/records';
import { AppRoutes } from '../App';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import { SoundProvider } from '../sound';

const flags = { on: false };
vi.mock('../training/switch', () => ({ trainingOn: () => flags.on }));

// Hoisted: the home page loads this module too (Training before games), before the test's own lines run.
const data = vi.hoisted(() => ({
  loadTraining: vi.fn(),
  addAnswer: vi.fn(),
  enqueueStudent: vi.fn(),
  enqueueSession: vi.fn(),
  localFinishedAt: vi.fn(() => null),
  flushQueue: vi.fn(async () => true),
}));
vi.mock('../data/training', () => data);

// Where the student is on the maths ladder (the warm-up decides where Training starts).
const ladder = vi.hoisted(() => ({ fetchMyLadder: vi.fn() }));
vi.mock('../data/ladder', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/ladder')>()),
  fetchMyLadder: ladder.fetchMyLadder,
}));

// The dashboard asks for its own things; nothing here is about them.
vi.mock('../data/botGames', () => ({
  fetchRecentGames: vi.fn(async () => []),
  fetchMyStats: vi.fn(async () => []),
  saveBotGame: vi.fn(async () => {}),
  saveAbandonedGame: vi.fn(),
  refreshSaveToken: vi.fn(async () => {}),
}));
vi.mock('../data/multiplayer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/multiplayer')>()),
  fetchRecentFriendGames: vi.fn(async () => []),
  fetchFriendStats: vi.fn(async () => []),
  fetchMyOpenGames: vi.fn(async () => []),
  fetchPlayerCards: vi.fn(async () => new Map()),
  fetchLobby: vi.fn(async () => []),
  fetchMultiplayerEnabled: vi.fn(async () => true),
}));
vi.mock('../data/progress', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/progress')>()),
  fetchMyProgress: vi.fn(async () => null),
}));

const student: AuthState = {
  status: 'signed-in',
  profile: { id: 'u1', display_name: 'Speedy Otter 27', avatar: {}, role: 'student' },
  message: null,
  signIn: vi.fn(async () => {}),
  signOut: vi.fn(async () => {}),
  refreshProfile: vi.fn(async () => {}),
};

function renderAt(path: string, auth: Partial<AuthState> = {}) {
  return render(
    <SoundProvider>
      <AuthContext.Provider value={{ ...student, ...auth }}>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthContext.Provider>
    </SoundProvider>,
  );
}

// The page loads on demand; load it once up front so no test waits on that.
beforeAll(async () => {
  await import('./TrainingPage');
});

beforeEach(() => {
  flags.on = false;
  Object.values(data).forEach((f) => f.mockClear());
  data.loadTraining.mockResolvedValue({ state: emptyState(), offline: false });
  data.flushQueue.mockResolvedValue(true);
  ladder.fetchMyLadder.mockReset().mockRejectedValue(new Error('no ladder'));
});

describe('the Training page', () => {
  it('opens on the student’s saved records, with the this-week line', async () => {
    flags.on = true;
    const today = dayString(new Date());
    // A fact that turned bright green today (1 s thinking time after the default typing time comes off).
    const state = recordAnswer(emptyState(), 'mul:2x5', 10, 10, 1500, today).state;
    data.loadTraining.mockResolvedValue({ state, offline: false });
    renderAt('/training');
    expect(await screen.findByRole('button', { name: /Today’s session/ }, { timeout: 5000 })).toBeInTheDocument();
    expect(data.loadTraining).toHaveBeenCalledWith('u1');
    expect(screen.getByText('1 fact turned green this week!')).toBeInTheDocument();
  });
});
