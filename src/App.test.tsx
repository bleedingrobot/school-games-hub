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

  it('labels the made-up data as sample data', () => {
    renderAt('/');
    expect(screen.getAllByText('Sample data').length).toBeGreaterThanOrEqual(3);
  });

  it('shows real recent chess and checkers games and stats', async () => {
    renderAt('/');
    const recent = screen.getByRole('region', { name: 'Recent games' });
    expect(await within(recent).findByText('Chess vs Medium bot')).toBeInTheDocument();
    expect(within(recent).getByText('Today')).toBeInTheDocument();
    expect(within(recent).getByText('(left early)')).toBeInTheDocument();
    expect(within(recent).getByText('Checkers vs Very Easy bot')).toBeInTheDocument();
    expect(within(recent).queryByText('Sample data')).not.toBeInTheDocument();

    const chessRow = screen.getByRole('row', { name: /^Chess/ });
    expect(within(chessRow).getAllByRole('cell').map((c) => c.textContent)).toEqual(['2', '1', '1', '0']);
    expect(within(chessRow).queryByText('Sample data')).not.toBeInTheDocument();
    const checkersRow = screen.getByRole('row', { name: /^Checkers/ });
    expect(within(checkersRow).getAllByRole('cell').map((c) => c.textContent)).toEqual(['1', '0', '0', '1']);
    expect(within(checkersRow).queryByText('Sample data')).not.toBeInTheDocument();
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
  it.each([
    ['/lobby', 'Lobby'],
    ['/leaderboard', 'Leaderboard'],
  ])('%s shows a friendly coming-soon page', (path, title) => {
    renderAt(path);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByText('Coming soon!')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
  });

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
