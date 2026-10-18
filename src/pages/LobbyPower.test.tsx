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

const NOT_FOUND = 'We couldn’t find a game with that code. Check it and try again.';
const notFound = () => new data.MultiplayerError(NOT_FOUND, 'not-found');

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
  it('starts a Power Clash game for the lobby or for a code', async () => {
    vi.mocked(power.askPower).mockResolvedValue({ id: 'p1' } as power.PowerGame);
    const user = userEvent.setup();
    renderLobby();
    const create = screen.getByRole('region', { name: 'Start a game' });
    await user.click(within(create).getByRole('radio', { name: /Power Clash/ }));
    await user.click(within(create).getByRole('radio', { name: /Anyone in the lobby/ }));
    await user.click(within(create).getByRole('button', { name: /Start game/ }));
    expect(power.askPower).toHaveBeenCalledWith({ action: 'create', lobby: true });
    expect(await screen.findByText('Power Clash game page')).toBeInTheDocument();
  });

  it('a code that isn’t chess, checkers, space or 101 is tried as a Power Clash game (last)', async () => {
    vi.mocked(data.ask).mockRejectedValue(notFound());
    vi.mocked(space.askSpace).mockRejectedValue(notFound());
    vi.mocked(cardData.askCard).mockRejectedValue(notFound());
    vi.mocked(power.askPower).mockResolvedValue({ id: 'p9' } as power.PowerGame);
    const user = userEvent.setup();
    renderLobby();
    await user.type(screen.getByLabelText('Type the code your friend gives you'), 'km4tp');
    await user.click(screen.getByRole('button', { name: 'Join game' }));
    expect(await screen.findByText('Power Clash game page')).toBeInTheDocument();
    expect(power.askPower).toHaveBeenCalledWith({ action: 'join', code: 'KM4TP' });
  });

  it('still says "couldn’t find that game" when no game of any kind has the code', async () => {
    vi.mocked(data.ask).mockRejectedValue(notFound());
    vi.mocked(space.askSpace).mockRejectedValue(notFound());
    vi.mocked(cardData.askCard).mockRejectedValue(notFound());
    vi.mocked(power.askPower).mockRejectedValue(notFound());
    const user = userEvent.setup();
    renderLobby();
    await user.type(screen.getByLabelText('Type the code your friend gives you'), 'CCCCC');
    await user.click(screen.getByRole('button', { name: 'Join game' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t find a game with that code');
  });

  it('a 101 code is still found before Power Clash is asked', async () => {
    vi.mocked(data.ask).mockRejectedValue(notFound());
    vi.mocked(space.askSpace).mockRejectedValue(notFound());
    vi.mocked(cardData.askCard).mockResolvedValue({ game: 'card-1' } as cardData.SeatRow);
    const user = userEvent.setup();
    renderLobby();
    await user.type(screen.getByLabelText('Type the code your friend gives you'), 'km4tp');
    await user.click(screen.getByRole('button', { name: 'Join game' }));
    expect(await screen.findByText('101 game page')).toBeInTheDocument();
    expect(power.askPower).not.toHaveBeenCalled();
  });

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

  it('shows my games that are still going and my waiting game', async () => {
    const mine = { id: 'm1', status: 'playing', host: 'me', seat1: 'me', seat2: 'them', code: null } as power.PowerGame;
    const waiting = { id: 'm2', status: 'waiting', host: 'me', seat1: 'me', seat2: null, code: 'KM4TP' } as power.PowerGame;
    vi.mocked(power.fetchMyOpenPowerGames).mockResolvedValue([mine, waiting]);
    renderLobby();
    const yours = await screen.findByRole('region', { name: 'Your games' });
    expect(within(yours).getByText(/Power Clash with Brave Kiwi 7/)).toBeInTheDocument();
    expect(within(yours).getByRole('link', { name: 'Carry on' })).toHaveAttribute('href', '/power-game/m1');
    expect(within(yours).getByText(/Your .*Power Clash game is waiting/)).toBeInTheDocument();
    expect(within(yours).getByText(/Code KM4 TP · 1 of 2 joined/)).toBeInTheDocument();
  });
});
