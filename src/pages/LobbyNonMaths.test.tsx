import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import * as classSettings from '../data/classSettings';
import * as data from '../data/multiplayer';
import * as space from '../data/spaceGames';
import * as cardData from '../data/cardGames';
import * as power from '../data/powerGames';
import { Lobby } from './Lobby';

/** The lobby while a class has the non-maths games (chess, checkers, 101, Power Clash) switched off. */
vi.mock('../data/classSettings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/classSettings')>()),
  readSettings: vi.fn(),
}));
vi.mock('../data/multiplayer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/multiplayer')>()),
  ask: vi.fn(),
  fetchLobby: vi.fn(),
  fetchMultiplayerEnabled: vi.fn(),
  fetchMyOpenGames: vi.fn(),
  fetchPlayerCards: vi.fn(async () => new Map()),
}));
vi.mock('../data/spaceGames', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/spaceGames')>()),
  askSpace: vi.fn(),
  fetchSpaceLobby: vi.fn(),
  fetchMyOpenSpaceGames: vi.fn(),
  fetchMathsSwitch: vi.fn(async () => 'off' as const),
}));
vi.mock('../data/powerGames', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/powerGames')>()),
  askPower: vi.fn(),
  fetchPowerLobby: vi.fn(),
  fetchMyOpenPowerGames: vi.fn(),
}));
vi.mock('../data/cardGames', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/cardGames')>()),
  askCard: vi.fn(),
  fetchCardLobby: vi.fn(),
  fetchMyOpenCardGames: vi.fn(),
}));
// The live games: I haven't made a Dragon Maths hero, and my class has the Village Raid paused.
vi.mock('../data/lobbyHere', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/lobbyHere')>()),
  fetchLobbyHere: vi.fn(async () => ({
    me: { archery: 'ready', 'dragon-maths': 'none', 'clan-quest': 'ready', isles: 'ready', raid: 'off' },
    teacher: false,
    going: [],
    online: [],
  })),
}));
vi.mock('../multiplayer/useHubAsks', () => ({ useHubAsks: () => ({ asks: [], serverNow: Date.now, drop: () => {} }) }));
vi.mock('../data/lobby', async () => ({ fetchLobbyPage: (await import('./lobbyFromSeparate')).lobbyFromSeparate }));

const signedIn = {
  status: 'signed-in',
  profile: { id: 'me', display_name: 'Speedy Otter 27', avatar: {}, role: 'student' },
  message: null,
} as unknown as AuthState;

function renderLobby() {
  return render(
    <AuthContext.Provider value={signedIn}>
      <MemoryRouter initialEntries={['/lobby']}>
        <Routes>
          <Route path="/lobby" element={<Lobby />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.mocked(data.fetchMultiplayerEnabled).mockResolvedValue(true);
  vi.mocked(data.fetchMyOpenGames).mockResolvedValue([]);
  vi.mocked(data.fetchLobby).mockResolvedValue([
    { id: 'open-1', game: 'checkers', creator_name: 'Brave Kiwi 7', creator_avatar: {}, open_side: 'second', created_at: '' },
  ]);
  vi.mocked(space.fetchSpaceLobby).mockResolvedValue([]);
  vi.mocked(space.fetchMyOpenSpaceGames).mockResolvedValue([]);
  vi.mocked(cardData.fetchCardLobby).mockResolvedValue([]);
  vi.mocked(cardData.fetchMyOpenCardGames).mockResolvedValue([]);
  vi.mocked(power.fetchPowerLobby).mockResolvedValue([]);
  vi.mocked(power.fetchMyOpenPowerGames).mockResolvedValue([]);
  localStorage.clear();
});

describe('the lobby with the non-maths games switch', () => {
  it('greys each tile it can’t use with the reason and a fix, hides open chess and checkers games, and leaves a teacher’s tiles open', async () => {
    vi.mocked(classSettings.readSettings).mockResolvedValue({ non_maths_games: false });
    renderLobby();
    const tiles = within(screen.getByRole('list', { name: 'Games' }));
    // Non-maths games in maths-only time: paused, no fix.
    for (const name of ['Chess', 'Checkers']) {
      expect(await tiles.findByRole('group', { name })).toHaveTextContent('Your teacher has paused this.');
    }
    // No hero yet: the reason and the button that fixes it.
    const hero = await tiles.findByRole('group', { name: 'Dragon Maths clash' });
    expect(hero).toHaveTextContent('Make your hero first to battle your friends');
    expect(within(hero).getByRole('link', { name: 'Make my hero' })).toHaveAttribute('href', '/dragon-maths');
    expect(tiles.getByRole('group', { name: 'Village Raid' })).toHaveTextContent('Your teacher has paused this.');
    // The space game still starts.
    expect(tiles.getByRole('button', { name: /Wormholes/ })).toBeEnabled();
    const list = screen.getByRole('region', { name: 'Open games' });
    expect(await within(list).findByText(/No open games right now/)).toBeInTheDocument();
    expect(within(list).queryByText(/Brave Kiwi 7/)).not.toBeInTheDocument();
    await import('../games/space/prefs');
    cleanup();

    // A teacher (no game states from the server): the live game tiles open their games, nothing paused.
    const { fetchLobbyHere, readLobbyHere } = await import('../data/lobbyHere');
    vi.mocked(fetchLobbyHere).mockResolvedValue(readLobbyHere({ me: null, going: [], online: [] }));
    vi.mocked(classSettings.readSettings).mockResolvedValue({});
    renderLobby();
    const teacherTiles = within(screen.getByRole('list', { name: 'Games' }));
    for (const name of [/Archery fight/, /Dragon Maths clash/, /Village Raid/]) {
      expect(await teacherTiles.findByRole('button', { name })).toBeEnabled();
    }
    expect(screen.queryByText('Your teacher has paused this.')).not.toBeInTheDocument();
  });
});
