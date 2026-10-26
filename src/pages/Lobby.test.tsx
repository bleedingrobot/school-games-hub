import { render, screen } from '@testing-library/react';
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

describe('the lobby', () => {
  it('joins with a code typed any old way', async () => {
    vi.mocked(data.ask).mockResolvedValue({ id: 'coded' } as data.FriendGame);
    const user = userEvent.setup();
    renderLobby();
    await user.type(screen.getByLabelText('Type the code your friend gives you'), 'km4 tp');
    await user.click(screen.getByRole('button', { name: 'Join game' }));
    expect(data.ask).toHaveBeenCalledWith({ action: 'join', code: 'KM4TP' });
    expect(await screen.findByText('Game page')).toBeInTheDocument();
  });
});
