import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import * as data from '../data/multiplayer';
import * as space from '../data/spaceGames';
import * as cardData from '../data/cardGames';
import * as power from '../data/powerGames';
import { Lobby } from './Lobby';

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
// The lobby's one request (S.4), answered from the separate fakes above.
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
          <Route path="/play/:id" element={<p>Game page</p>} />
          <Route path="/space-game/:id" element={<p>Space game page</p>} />
          <Route path="/card-game/:id" element={<p>101 game page</p>} />
          <Route path="/" element={<p>Home</p>} />
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
  vi.mocked(data.ask).mockReset();
  vi.mocked(space.askSpace).mockReset();
  vi.mocked(space.fetchSpaceLobby).mockResolvedValue([]);
  vi.mocked(space.fetchMyOpenSpaceGames).mockResolvedValue([]);
  vi.mocked(cardData.askCard).mockReset();
  vi.mocked(cardData.fetchCardLobby).mockResolvedValue([]);
  vi.mocked(cardData.fetchMyOpenCardGames).mockResolvedValue([]);
  vi.mocked(power.askPower).mockReset();
  vi.mocked(power.fetchPowerLobby).mockResolvedValue([]);
  vi.mocked(power.fetchMyOpenPowerGames).mockResolvedValue([]);
  localStorage.clear();
});

const NOT_FOUND = 'We couldn’t find a game with that code. Check it and try again.';

describe('the lobby', () => {
  it('lists open games with just a name and avatar, and joins one with a tap', async () => {
    vi.mocked(data.ask).mockResolvedValue({ id: 'open-1' } as data.FriendGame);
    const user = userEvent.setup();
    renderLobby();
    const list = screen.getByRole('region', { name: 'Open games' });
    const row = (await within(list).findByText(/Brave Kiwi 7/)).closest('li')!;
    expect(row).toHaveTextContent('You’d play White. They play Red.');

    await user.click(within(row).getByRole('button', { name: 'Join' }));
    expect(data.ask).toHaveBeenCalledWith({ action: 'join', gameId: 'open-1' });
    expect(await screen.findByText('Game page')).toBeInTheDocument();
  });

  it('shows the server’s friendly message when a code is wrong', async () => {
    vi.mocked(data.ask).mockRejectedValue(new data.MultiplayerError(NOT_FOUND, 'not-found'));
    vi.mocked(space.askSpace).mockRejectedValue(new data.MultiplayerError(NOT_FOUND, 'not-found'));
    vi.mocked(cardData.askCard).mockRejectedValue(new data.MultiplayerError(NOT_FOUND, 'not-found'));
    vi.mocked(power.askPower).mockRejectedValue(new data.MultiplayerError(NOT_FOUND, 'not-found'));
    const user = userEvent.setup();
    renderLobby();
    await user.type(screen.getByLabelText('Type the code your friend gives you'), 'CCCCC');
    await user.click(screen.getByRole('button', { name: 'Join game' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t find a game with that code');
    expect(screen.queryByText('Game page')).not.toBeInTheDocument();
  });
});
