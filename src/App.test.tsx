import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './App';
import { AuthContext, type AuthState } from './auth/AuthContext';
import { SoundProvider } from './sound';

vi.mock('./data/botGames', () => ({
  fetchRecentGames: vi.fn(async () => [
    { id: 'g1', game: 'chess', bot_level: 'medium', result: 'won', reason: 'checkmate', finished_at: new Date().toISOString() },
    { id: 'g2', game: 'chess', bot_level: 'easy', result: 'lost', reason: 'abandoned', finished_at: '2020-03-02T01:00:00Z' },
    { id: 'g3', game: 'checkers', bot_level: 'very-easy', result: 'drawn', reason: 'forty-moves', finished_at: '2020-03-01T01:00:00Z' },
  ]),
  fetchMyStats: vi.fn(async () => [
    { game: 'chess', played: 2, won: 1, lost: 1, drawn: 0 },
    { game: 'checkers', played: 1, won: 0, lost: 0, drawn: 1 },
  ]),
  saveBotGame: vi.fn(async () => {}),
  saveAbandonedGame: vi.fn(),
  refreshSaveToken: vi.fn(async () => {}),
}));

vi.mock('./data/multiplayer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./data/multiplayer')>()),
  fetchRecentFriendGames: vi.fn(async () => [
    {
      id: 'f1', game: 'checkers', first_player: 'u1', second_player: 'u2', status: 'finished', winner: 'first',
      reason: 'no-pieces', finished_at: new Date(Date.now() - 1000).toISOString(), created_at: '2020-01-01T00:00:00Z',
    },
  ]),
  fetchFriendStats: vi.fn(async () => [{ game: 'checkers', played: 4, won: 2, lost: 1, drawn: 1 }]),
  fetchMyOpenGames: vi.fn(async () => [
    { id: 'f2', game: 'chess', first_player: 'u3', second_player: 'u1', status: 'playing', created_at: '2020-01-01T00:00:00Z' },
  ]),
  fetchPlayerCards: vi.fn(async () =>
    new Map([
      ['u2', { id: 'u2', display_name: 'Brave Kiwi 7', avatar: {} }],
      ['u3', { id: 'u3', display_name: 'Lucky Tui 12', avatar: {} }],
    ]),
  ),
  fetchLobby: vi.fn(async () => []),
  fetchMultiplayerEnabled: vi.fn(async () => true),
}));

vi.mock('./data/progress', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./data/progress')>()),
  fetchMyProgress: vi.fn(async () => ({
    points: 140,
    level: 3,
    levelStart: 125,
    nextLevelAt: 225,
    weekPoints: 23,
    games: [
      { game: 'checkers', rank: { rank: 'silver', next: 'gold', progress: 0.5, gamesNeeded: null, ratedGames: 6 }, weekRatingChange: 12 },
      { game: 'chess', rank: { rank: 'bronze', next: 'silver', progress: 0, gamesNeeded: null, ratedGames: 0 }, weekRatingChange: null },
    ],
    achievements: [
      { id: 'chess-first-win', game: 'chess', name: 'First win', emoji: '🏆', measure: 'wins', goal: 1, progress: 1, earnedAt: '2026-10-14T01:00:00Z' },
      { id: 'chess-games-10', game: 'chess', name: 'Play 10 games', emoji: '🔟', measure: 'games', goal: 10, progress: 7, earnedAt: null },
      { id: 'checkers-crown-5', game: 'checkers', name: 'Crown 5 kings', emoji: '👑', measure: 'crowns', goal: 5, progress: 2, earnedAt: null },
      { id: 'checkers-gold', game: 'checkers', name: 'Reach Gold', emoji: '🥇', measure: 'rank', goal: 2, progress: 1, earnedAt: null },
    ],
    recent: [{ id: 'g1', points: 8 }, { id: 'f1', points: 8 }],
  })),
}));

// The home page asks for everything in one request (server load S.2): its answer is made from the same made-up answers as above.
vi.mock('./data/homePage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./data/homePage')>()),
  fetchMyHomePage: vi.fn(async () => {
    const bots = await import('./data/botGames');
    const friends = await import('./data/multiplayer');
    const points = await import('./data/progress');
    return {
      progress: await points.fetchMyProgress(),
      botRecent: await bots.fetchRecentGames(),
      botStats: await bots.fetchMyStats(),
      friendRecent: await friends.fetchRecentFriendGames(),
      friendStats: await friends.fetchFriendStats(),
      friendOpen: await friends.fetchMyOpenGames(),
      players: await friends.fetchPlayerCards([]),
      spaceRecent: [],
      spaceOpen: [],
      spaceStats: null,
      cardRecent: [],
      cardOpen: [],
      cardStats: null,
      powerRecent: [],
      powerOpen: [],
      powerStats: null,
      moves: {},
      parts: {},
    };
  }),
}));

const signedIn: AuthState = {
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
      <AuthContext.Provider value={{ ...signedIn, ...auth }}>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthContext.Provider>
    </SoundProvider>,
  );
}

describe('the app', () => {
  it('sends signed-out visitors to the sign-in screen, and shows nothing private while still checking', () => {
    for (const path of ['/', '/chess', '/profile', '/lobby']) {
      const { unmount } = renderAt(path, { status: 'signed-out', profile: null });
      expect(screen.getByRole('heading', { name: 'School Games Hub' })).toBeInTheDocument();
      expect(screen.queryByText('Speedy Otter 27')).not.toBeInTheDocument();
      unmount();
    }
    renderAt('/', { status: 'loading', profile: null });
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(screen.queryByText('Speedy Otter 27')).not.toBeInTheDocument();
  });

  it('shows the student their dashboard with their real points and a Play button', async () => {
    renderAt('/');
    const hero = screen.getByRole('region', { name: 'Speedy Otter 27' });
    expect(await within(hero).findByText('140 points')).toBeInTheDocument();
    expect(within(hero).getByText('Level 3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Play$/ })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Chess' })).toBeInTheDocument();
  });
});
