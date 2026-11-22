import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../App';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import { resetMyTurns, saveMyAvatar } from '../data/profile';
import { SoundProvider } from '../sound';

const ach = (id: string, game: string, progress: number, earnedAt: string | null = null) => ({
  id, game, name: id, emoji: '🏆', measure: 'wins', goal: 10, progress, earnedAt,
});
const achievements = [
  ach('Earned one', 'chess', 10, '2026-10-14T01:00:00Z'),
  ach('Fifth closest', 'chess', 1),
  ach('Second closest', 'chess', 8),
  ach('Third closest', 'chess', 5),
  ach('Closest', 'checkers', 9),
  ach('Fourth closest', 'checkers', 2),
];

vi.mock('../data/homePage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/homePage')>()),
  fetchMyHomePage: vi.fn(async () => ({
    progress: { points: 60, weekPoints: 60, games: [], achievements, recent: [] },
    botRecent: [], botStats: [], friendRecent: [], friendStats: [], friendOpen: [], players: new Map(),
    spaceRecent: [], spaceOpen: [], spaceStats: null, cardRecent: [], cardOpen: [], cardStats: null,
    powerRecent: [], powerOpen: [], powerStats: null, moves: {}, parts: {},
  })),
}));

vi.mock('../data/trophies', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/trophies')>()),
  fetchMyNewTrophies: vi.fn(async () => []),
  fetchMyTrophies: vi.fn(async () => ({
    season: 1,
    trophies: [
      { id: 'knight', game: 'chess', name: 'Knight Head', how: 'Win with a knight', kind: 'picture', repeat: 'once', art: null, tier: 'silver',
        count: 1, firstAt: '2026-10-14T01:00:00Z', lastAt: '2026-10-14T01:00:00Z', isNew: false, wins: [] },
    ],
    next: [],
    favourites: [],
  })),
}));

vi.mock('../data/profile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/profile')>()),
  saveMyAvatar: vi.fn(async () => {}),
  fetchNameWords: vi.fn(async () => ({ adjectives: ['Brave'], animals: ['Kiwi'] })),
  chooseMyName: vi.fn(async () => 'Brave Kiwi 7'),
  resetMyTurns: vi.fn(async () => ['Clan Quest', 'Sky Isles']),
}));

function auth(avatar: object = {}, extra: Partial<AuthState> = {}): AuthState {
  return {
    status: 'signed-in',
    profile: { id: 's1', display_name: 'Brave Kiwi 7', avatar, role: 'student' },
    message: null,
    signIn: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    refreshProfile: vi.fn(async () => {}),
    ...extra,
  };
}

async function renderAt(path: string, state: AuthState) {
  // Every page but home loads when opened (dashboard plan D7): let the lazy page arrive before looking.
  const view = render(
    <SoundProvider>
      <AuthContext.Provider value={state}>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthContext.Provider>
    </SoundProvider>,
  );
  await waitFor(() => expect(document.querySelector('[data-page-loading]')).toBeNull(), { timeout: 10_000 });
  return view;
}

const fold = (name: RegExp) => screen.getByRole('button', { name });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('my profile', () => {
  it('opens on the pupil with My trophies open and the other folds closed, and signs out', async () => {
    const user = userEvent.setup();
    const state = auth();
    await renderAt('/profile', state);
    expect(screen.getByRole('heading', { name: 'Brave Kiwi 7' })).toBeInTheDocument();
    expect(fold(/My trophies/)).toHaveAttribute('aria-expanded', 'true');
    for (const name of [/My stats/, /Page theme/]) {
      expect(fold(name)).toHaveAttribute('aria-expanded', 'false');
    }
    expect(await screen.findByRole('button', { name: 'Knight Head, Silver' })).toBeInTheDocument();
    expect(screen.queryByText('Build your avatar')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(state.signOut).toHaveBeenCalled();
  });

  it('shows teachers a button that resets their turns in every game, and pupils never see it', async () => {
    const user = userEvent.setup();
    const pupil = await renderAt('/profile', auth());
    expect(screen.queryByRole('button', { name: /Reset my turns/ })).not.toBeInTheDocument();
    // No achievements fold either: they live in the Achievement Hall now.
    expect(screen.queryByRole('button', { name: /My achievements/ })).not.toBeInTheDocument();
    pupil.unmount();
    await renderAt('/profile', auth({}, { profile: { id: 't1', display_name: 'Mr Riley', avatar: {}, role: 'teacher' } }));
    await user.click(screen.getByRole('button', { name: /Reset my turns in every game/ }));
    expect(resetMyTurns).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Done! Fresh turns in Clan Quest, Sky Isles.')).toBeInTheDocument();
  });

  it('saves a new look together with the theme, and a new theme together with the look', async () => {
    const user = userEvent.setup();
    const state = auth({ kind: 'cat', theme: 'menu' });
    await renderAt('/profile', state);
    await user.click(screen.getByRole('button', { name: /Change my look/ }));
    expect(screen.getByText('Build your avatar')).toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'Robot' }));
    expect(save).toBeEnabled();
    await user.click(save);
    expect(saveMyAvatar).toHaveBeenCalledTimes(1);
    expect(saveMyAvatar).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'robot', theme: 'menu' }));
    expect(state.refreshProfile).toHaveBeenCalled();
    // A picture trophy can be worn instead (the server checks it is mine).
    await user.click(screen.getByRole('radio', { name: /Knight Head/ }));
    await user.click(save);
    expect(saveMyAvatar).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'robot', pic: 'knight' }));

    await user.click(fold(/Page theme/));
    await user.click(screen.getByRole('radio', { name: /Soft and bright/ }));
    expect(saveMyAvatar).toHaveBeenCalledTimes(3);
    expect(saveMyAvatar).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'cat', theme: 'soft' }));
  });

  it('nudges a pupil with no avatar to make one, and a link to #stats opens My stats', async () => {
    const user = userEvent.setup();
    for (const avatar of [{}, { theme: 'menu' }]) {
      const { unmount } = await renderAt('/profile', auth(avatar));
      expect(screen.getByText(/You haven’t made your avatar yet/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Change my look/ })).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Make your avatar/ }));
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
      unmount();
    }
    await renderAt('/profile#stats', auth());
    expect(fold(/My stats/)).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByText(/this week/)).toBeInTheDocument();
    expect(screen.queryByText(/Level \d/)).not.toBeInTheDocument();
  });
});
