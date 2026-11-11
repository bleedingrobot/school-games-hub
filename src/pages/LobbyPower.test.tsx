import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import * as cardData from '../data/cardGames';
import * as data from '../data/multiplayer';
import * as power from '../data/powerGames';
import * as space from '../data/spaceGames';
import { Lobby } from './Lobby';

vi.mock('../data/multiplayer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/multiplayer')>()),
  ask: vi.fn(),
  fetchLobby: vi.fn(),
  fetchMultiplayerEnabled: vi.fn(),
  fetchMyOpenGames: vi.fn(),
  fetchPlayerCards: vi.fn(async () => new Map([['them', { id: 'them', display_name: 'Brave Kiwi 7', avatar: {} }]])),
}));
vi.mock('../data/spaceGames', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/spaceGames')>()),
  askSpace: vi.fn(),
  fetchSpaceLobby: vi.fn(),
  fetchMyOpenSpaceGames: vi.fn(),
}));
vi.mock('../data/cardGames', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/cardGames')>()),
  askCard: vi.fn(),
  fetchCardLobby: vi.fn(),
  fetchMyOpenCardGames: vi.fn(),
}));
vi.mock('../data/powerGames', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/powerGames')>()),
  askPower: vi.fn(),
  fetchPowerLobby: vi.fn(),
  fetchMyOpenPowerGames: vi.fn(),
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
          <Route path="/power-game/:id" element={<p>Power Clash game page</p>} />
          <Route path="/card-game/:id" element={<p>101 game page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}


beforeEach(() => {
  vi.mocked(data.fetchMultiplayerEnabled).mockResolvedValue(true);
  vi.mocked(data.fetchMyOpenGames).mockResolvedValue([]);
  vi.mocked(data.fetchLobby).mockResolvedValue([]);
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

describe('the lobby with Power Clash switched on', () => {

  it('lists open Power Clash games and joins one with a tap', async () => {
    vi.mocked(power.fetchPowerLobby).mockResolvedValue([{ id: 'open-p', creator_name: 'Brave Kiwi 7', creator_avatar: {}, created_at: '' }]);
    vi.mocked(power.askPower).mockResolvedValue({ id: 'open-p' } as power.PowerGame);
    const user = userEvent.setup();
    renderLobby();
    const list = screen.getByRole('region', { name: 'Open games' });
    const row = (await within(list).findByText(/Brave Kiwi 7 · /)).closest('li')!;
    expect(row).toHaveTextContent('Power Clash');
    await user.click(within(row).getByRole('button', { name: 'Join' }));
    expect(power.askPower).toHaveBeenCalledWith({ action: 'join', gameId: 'open-p' });
    expect(await screen.findByText('Power Clash game page')).toBeInTheDocument();
  });
});
