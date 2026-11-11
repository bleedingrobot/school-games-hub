import { render, screen, waitFor, within } from '@testing-library/react';
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
  it('offers only the space game, and hides open chess and checkers games, when it is off', async () => {
    vi.mocked(classSettings.readSettings).mockResolvedValue({ non_maths_games: false });
    renderLobby();
    const create = screen.getByRole('region', { name: 'Start a game' });
    const games = within(within(create).getByRole('group', { name: 'Game' }));
    await waitFor(() => expect(games.getAllByRole('radio')).toHaveLength(1));
    expect(games.getByRole('radio').closest('label')).toHaveTextContent(/^Wormholes/);
    await waitFor(() => expect(games.getByRole('radio')).toBeChecked());
    // The space game's own options have loaded before the test ends.
    expect((await within(create).findAllByRole('radio', { name: /Nebula/i })).length).toBeGreaterThan(0);
    const list = screen.getByRole('region', { name: 'Open games' });
    expect(await within(list).findByText(/No open games right now/)).toBeInTheDocument();
    expect(within(list).queryByText(/Brave Kiwi 7/)).not.toBeInTheDocument();
    // The lobby loads the space game's saved choices in the background: let that finish, or it can land after the file
    // is torn down ("Vite module runner has been closed").
    await import('../games/space/prefs');
  });
});
