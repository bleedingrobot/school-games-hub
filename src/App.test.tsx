import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './App';
import { AuthContext, type AuthState } from './auth/AuthContext';
import { SoundProvider } from './sound';

vi.mock('./data/profile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./data/profile')>()),
  fetchNameWords: vi.fn(async () => ({ adjectives: ['Brave', 'Speedy'], animals: ['Kiwi', 'Otter'] })),
  chooseMyName: vi.fn(async () => 'Brave Kiwi 7'),
  saveMyAvatar: vi.fn(async () => {}),
}));

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

describe('dashboard', () => {
  it('shows the student, a Play button and both game cards', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1, name: 'Speedy Otter 27' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Play$/ })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Chess' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Checkers' })).toBeInTheDocument();
  });

  it('shows real points, level, badges and achievements, with no sample data left', async () => {
    renderAt('/');
    const hero = screen.getByRole('region', { name: 'Speedy Otter 27' });
    expect(await within(hero).findByText('140 points')).toBeInTheDocument();
    expect(within(hero).getByText('Level 3')).toBeInTheDocument();
    expect(within(hero).getByText(/Checkers: Silver/)).toBeInTheDocument();
    expect(within(hero).getByText(/Chess: Bronze/)).toBeInTheDocument();

    const stats = screen.getByRole('region', { name: 'My stats' });
    expect(within(stats).getByText('85 points to level 4')).toBeInTheDocument();
    expect(within(stats).getByRole('link', { name: 'How points work' })).toHaveAttribute('href', '/points');

    const achievements = screen.getByRole('region', { name: /Achievements/ });
    expect(within(achievements).getByText('1 of 4')).toBeInTheDocument();
    expect(within(achievements).getByText('First win (Chess)').closest('li')).toHaveClass('is-done');
    expect(within(achievements).getByText('7/10')).toBeInTheDocument();
    // Badges are earned or not: no "1/2" count.
    expect(within(achievements).getByText('Reach Gold (Checkers)').closest('li')).toHaveTextContent('Not yet');
    expect(screen.queryByText('Sample data')).not.toBeInTheDocument();
  });

  it('shows the points each recent game earned', async () => {
    renderAt('/');
    const recent = screen.getByRole('region', { name: 'Recent games' });
    const medium = (await within(recent).findByText('Chess vs Medium bot')).closest('li')!;
    expect(medium).toHaveTextContent('+8');
    const easy = within(recent).getByText(/Chess vs Easy bot/).closest('li')!;
    expect(easy).not.toHaveTextContent('+');
  });

  it('shows real recent chess and checkers games and stats', async () => {
    renderAt('/');
    const recent = screen.getByRole('region', { name: 'Recent games' });
    expect(await within(recent).findByText('Chess vs Medium bot')).toBeInTheDocument();
    expect(within(recent).getAllByText('Today')).toHaveLength(2);
    expect(within(recent).getByText('(left early)')).toBeInTheDocument();
    expect(within(recent).queryByText('Checkers vs Very Easy bot')).toBeInTheDocument();

    const bots = screen.getByRole('table', { name: 'Against bots' });
    const chessRow = within(bots).getByRole('row', { name: /^Chess/ });
    expect(within(chessRow).getAllByRole('cell').map((c) => c.textContent)).toEqual(['2', '1', '1', '0']);
    const checkersRow = within(bots).getByRole('row', { name: /^Checkers/ });
    expect(within(checkersRow).getAllByRole('cell').map((c) => c.textContent)).toEqual(['1', '0', '0', '1']);
  });

  it('shows games against friends, kept apart from bot games', async () => {
    renderAt('/');
    const recent = screen.getByRole('region', { name: 'Recent games' });
    const friendGame = (await within(recent).findByText('Brave Kiwi 7', { exact: false })).closest('li')!;
    expect(friendGame).toHaveTextContent('Won');
    expect(friendGame).toHaveTextContent('Checkers vs');

    const friends = screen.getByRole('table', { name: 'Against friends' });
    const checkersRow = within(friends).getByRole('row', { name: /^Checkers/ });
    expect(within(checkersRow).getAllByRole('cell').map((c) => c.textContent)).toEqual(['4', '2', '1', '1']);
    const chessRow = within(friends).getByRole('row', { name: /^Chess/ });
    expect(within(chessRow).getAllByRole('cell').map((c) => c.textContent)).toEqual(['0', '0', '0', '0']);
  });

  it('makes an unfinished game against a friend easy to get back to', async () => {
    renderAt('/');
    const banner = await screen.findByRole('region', { name: 'Games still going' });
    expect(banner).toHaveTextContent('Your chess game with Lucky Tui 12 is still going!');
    expect(within(banner).getByRole('link', { name: 'Carry on' })).toHaveAttribute('href', '/play/f2');
  });

  it('links to the lobby and leaderboard', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: /Play a friend/ })).toHaveAttribute('href', '/lobby');
    expect(screen.getByRole('link', { name: /See the top players/ })).toHaveAttribute('href', '/leaderboard');
  });

  it('carries the chosen bot level into the game link and the big Play button', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const checkers = screen.getByRole('article', { name: 'Checkers' });
    expect(within(checkers).getByRole('radio', { name: 'Easy' })).toBeChecked();

    await user.click(within(checkers).getByRole('radio', { name: 'Medium' }));

    expect(within(checkers).getByRole('link')).toHaveAttribute('href', '/checkers?bot=medium');
    expect(screen.getByRole('link', { name: /^Play$/ })).toHaveAttribute('href', '/checkers?bot=medium');
    expect(within(screen.getByRole('region', { name: 'Speedy Otter 27' })).getByText('Checkers vs Medium bot')).toBeInTheDocument();
  });
});

describe('pages', () => {
  it('opens checkers ready to play the bot picked on the dashboard', async () => {
    renderAt('/checkers?bot=very-easy');
    expect(await screen.findByRole('heading', { level: 1, name: /Checkers vs bot/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Very Easy' })).toBeChecked();
    expect(screen.getByRole('button', { name: /Start game/ })).toBeInTheDocument();
  });

  it('opens chess ready to play the bot picked on the dashboard', async () => {
    renderAt('/chess?bot=medium');
    expect(await screen.findByRole('heading', { level: 1, name: /Chess vs bot/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Medium' })).toBeChecked();
    expect(screen.getByRole('button', { name: /Start game/ })).toBeInTheDocument();
  });

  it('falls back to Easy for a made-up bot level', async () => {
    renderAt('/checkers?bot=impossible');
    expect(await screen.findByRole('radio', { name: 'Easy' })).toBeChecked();
  });


  it('shows Power Clash on the dashboard and opens it at its address', async () => {
    const { unmount } = renderAt('/');
    expect(await screen.findByRole('article', { name: /Power Clash/ })).toBeInTheDocument();
    unmount();
    renderAt('/power-clash?bot=medium');
    expect(await screen.findByRole('heading', { level: 1, name: /Power Clash/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Play a bot' }));
    expect(screen.getByRole('radio', { name: 'Medium' })).toBeChecked(); // the level from the address
  });

  it('shows a friendly page for unknown addresses', () => {
    renderAt('/nope');
    expect(screen.getByRole('heading', { name: /wrong square/ })).toBeInTheDocument();
  });
});

describe('signing in', () => {
  it.each(['/', '/chess', '/profile', '/lobby'])('sends signed-out visitors from %s to the sign-in screen', (path) => {
    renderAt(path, { status: 'signed-out', profile: null });
    expect(screen.getByRole('heading', { name: 'School Games Hub' })).toBeInTheDocument();
    expect(screen.queryByText('Speedy Otter 27')).not.toBeInTheDocument();
  });

  it('shows nothing private while still checking', () => {
    renderAt('/', { status: 'loading', profile: null });
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(screen.queryByText('Speedy Otter 27')).not.toBeInTheDocument();
  });

  it('starts Google sign-in from the button', async () => {
    const user = userEvent.setup();
    const signIn = vi.fn(async () => {});
    renderAt('/sign-in', { status: 'signed-out', profile: null, signIn });
    await user.click(screen.getByRole('button', { name: /Sign in with your school Google account/ }));
    expect(signIn).toHaveBeenCalled();
  });

  it('shows a friendly sign-in problem', () => {
    renderAt('/sign-in', { status: 'signed-out', profile: null, message: "That isn't a Douglas Park school account." });
    expect(screen.getByRole('alert')).toHaveTextContent("isn't a Douglas Park school account");
  });

  it('sends signed-in students from the sign-in screen to the dashboard', () => {
    renderAt('/sign-in');
    expect(screen.getByRole('heading', { level: 1, name: 'Speedy Otter 27' })).toBeInTheDocument();
  });
});

describe('profile', () => {
  it('lets a student build an avatar and save it', async () => {
    const { saveMyAvatar } = await import('./data/profile');
    const user = userEvent.setup();
    renderAt('/profile');
    const save = screen.getByRole('button', { name: 'Save avatar' });
    expect(save).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: 'Robot' }));
    await user.click(save);

    expect(saveMyAvatar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'robot' }));
    expect(await screen.findByText('Saved! Looking good.')).toBeInTheDocument();
  });

  it('lets a student pick a name from the word lists', async () => {
    const { chooseMyName } = await import('./data/profile');
    const user = userEvent.setup();
    renderAt('/profile');
    await user.selectOptions(await screen.findByLabelText('First word'), 'Brave');
    await user.selectOptions(screen.getByLabelText('Second word'), 'Kiwi');
    await user.click(screen.getByRole('button', { name: 'Use this name' }));

    expect(chooseMyName).toHaveBeenCalledWith('Brave', 'Kiwi');
    expect(await screen.findByText("You're now Brave Kiwi 7!")).toBeInTheDocument();
  });

  it('has a sign-out button', async () => {
    const user = userEvent.setup();
    const signOut = vi.fn(async () => {});
    renderAt('/profile', { signOut });
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalled();
  });
});

describe('mute button', () => {
  it('starts with sound off and remembers when it is turned on', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const button = screen.getByRole('button', { name: /Sound off/ });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await user.click(button);

    expect(screen.getByRole('button', { name: /Sound on/ })).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('sgh-sound-on')).toBe('true');
  });
});
