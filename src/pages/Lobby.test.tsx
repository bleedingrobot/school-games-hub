import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import * as data from '../data/multiplayer';
import * as space from '../data/spaceGames';
import * as cardData from '../data/cardGames';
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
}));
vi.mock('../data/cardGames', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/cardGames')>()),
  askCard: vi.fn(),
  fetchCardLobby: vi.fn(),
  fetchMyOpenCardGames: vi.fn(),
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

  it('joins with a code typed any old way', async () => {
    vi.mocked(data.ask).mockResolvedValue({ id: 'coded' } as data.FriendGame);
    const user = userEvent.setup();
    renderLobby();
    await user.type(screen.getByLabelText('Type the code your friend gives you'), 'km4 tp');
    await user.click(screen.getByRole('button', { name: 'Join game' }));
    expect(data.ask).toHaveBeenCalledWith({ action: 'join', code: 'KM4TP' });
    expect(await screen.findByText('Game page')).toBeInTheDocument();
  });

  it('explains what a code looks like, without asking the server', async () => {
    const user = userEvent.setup();
    renderLobby();
    await user.type(screen.getByLabelText('Type the code your friend gives you'), 'HELLO');
    await user.click(screen.getByRole('button', { name: 'Join game' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Codes are 5 letters and numbers');
    expect(data.ask).not.toHaveBeenCalled();
  });

  it('shows the server’s friendly message when a code is wrong', async () => {
    vi.mocked(data.ask).mockRejectedValue(new data.MultiplayerError(NOT_FOUND, 'not-found'));
    vi.mocked(space.askSpace).mockRejectedValue(new data.MultiplayerError(NOT_FOUND, 'not-found'));
    vi.mocked(cardData.askCard).mockRejectedValue(new data.MultiplayerError(NOT_FOUND, 'not-found'));
    const user = userEvent.setup();
    renderLobby();
    await user.type(screen.getByLabelText('Type the code your friend gives you'), 'CCCCC');
    await user.click(screen.getByRole('button', { name: 'Join game' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t find a game with that code');
    expect(screen.queryByText('Game page')).not.toBeInTheDocument();
  });

  it('a code that isn’t chess, checkers or space is tried as a 101 game', async () => {
    vi.mocked(data.ask).mockRejectedValue(new data.MultiplayerError(NOT_FOUND, 'not-found'));
    vi.mocked(space.askSpace).mockRejectedValue(new data.MultiplayerError(NOT_FOUND, 'not-found'));
    vi.mocked(cardData.askCard).mockResolvedValue({ game: 'card-1' } as cardData.SeatRow);
    const user = userEvent.setup();
    renderLobby();
    await user.type(screen.getByLabelText('Type the code your friend gives you'), 'km4tp');
    await user.click(screen.getByRole('button', { name: 'Join game' }));
    expect(await screen.findByText('101 game page')).toBeInTheDocument();
    expect(cardData.askCard).toHaveBeenCalledWith({ action: 'join', code: 'KM4TP' });
  });

  it('starts a 101 game with the number of players and length', async () => {
    vi.mocked(cardData.askCard).mockResolvedValue({ game: 'card-2' } as cardData.SeatRow);
    const user = userEvent.setup();
    renderLobby();
    const create = screen.getByRole('region', { name: 'Start a game' });
    await user.click(within(create).getByRole('radio', { name: /^101/ }));
    await user.click(within(create).getByRole('radio', { name: '4 players' }));
    await user.click(within(create).getByRole('radio', { name: /Normal: to 101/ }));
    await user.click(within(create).getByRole('button', { name: /Start game/ }));
    expect(cardData.askCard).toHaveBeenCalledWith({ action: 'create', players: 4, settings: { target: 101 }, lobby: false });
    expect(await screen.findByText('101 game page')).toBeInTheDocument();
  });

  it('lists open 101 games, and joins one with a tap', async () => {
    vi.mocked(cardData.fetchCardLobby).mockResolvedValue([
      { id: 'card-open', creator_name: 'Calm Tui 3', creator_avatar: {}, players: 1, wanted: 3, target: 50, created_at: '2026-10-20T00:00:00Z' },
    ]);
    vi.mocked(cardData.askCard).mockResolvedValue({ game: 'card-open' } as cardData.SeatRow);
    const user = userEvent.setup();
    renderLobby();
    const row = (await screen.findByText(/Calm Tui 3 · 101/)).closest('li')!;
    expect(row).toHaveTextContent('Quick game, to 50. 1 of 3 joined.');
    await user.click(within(row).getByRole('button', { name: 'Join' }));
    expect(cardData.askCard).toHaveBeenCalledWith({ action: 'join', gameId: 'card-open' });
    expect(await screen.findByText('101 game page')).toBeInTheDocument();
  });

  it('starts a game with the chosen game, colour and lobby setting', async () => {
    vi.mocked(data.ask).mockResolvedValue({ id: 'new-game' } as data.FriendGame);
    const user = userEvent.setup();
    renderLobby();
    const create = screen.getByRole('region', { name: 'Start a game' });
    await user.click(within(create).getByRole('radio', { name: 'Checkers' }));
    await user.click(within(create).getByRole('radio', { name: 'White' }));
    await user.click(within(create).getByRole('radio', { name: 'Anyone in the lobby' }));
    await user.click(within(create).getByRole('button', { name: /Start game/ }));
    expect(data.ask).toHaveBeenCalledWith({ action: 'create', game: 'checkers', side: 'second', lobby: true });
    expect(await screen.findByText('Game page')).toBeInTheDocument();
  });

  it('says so kindly when the teacher has paused games against friends', async () => {
    vi.mocked(data.fetchMultiplayerEnabled).mockResolvedValue(false);
    renderLobby();
    expect(await screen.findByRole('heading', { name: 'Games against friends are paused' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start game/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Play a bot' })).toHaveAttribute('href', '/');
  });

  it('offers a way back into games still going', async () => {
    vi.mocked(data.fetchMyOpenGames).mockResolvedValue([
      { id: 'mine-1', game: 'chess', first_player: 'me', second_player: 'them', status: 'playing' } as data.FriendGame,
    ]);
    renderLobby();
    const mine = await screen.findByRole('region', { name: 'Your games' });
    expect(within(mine).getByRole('link', { name: 'Carry on' })).toHaveAttribute('href', '/play/mine-1');
  });

  it('joins a space game with the same code box, if it isn’t a chess or checkers code', async () => {
    vi.mocked(data.ask).mockRejectedValue(new data.MultiplayerError(NOT_FOUND, 'not-found'));
    vi.mocked(space.askSpace).mockResolvedValue({ id: 'space-1' } as space.SpaceGame);
    const user = userEvent.setup();
    renderLobby();
    await user.type(screen.getByLabelText('Type the code your friend gives you'), 'KM4TP');
    await user.click(screen.getByRole('button', { name: 'Join game' }));
    expect(space.askSpace).toHaveBeenCalledWith({ action: 'join', code: 'KM4TP' });
    expect(await screen.findByText('Space game page')).toBeInTheDocument();
  });

  it('doesn’t try the space game when the chess and checkers server says something else', async () => {
    vi.mocked(data.ask).mockRejectedValue(new data.MultiplayerError('Your teacher has paused games against friends for now.', 'paused'));
    const user = userEvent.setup();
    renderLobby();
    await user.type(screen.getByLabelText('Type the code your friend gives you'), 'KM4TP');
    await user.click(screen.getByRole('button', { name: 'Join game' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('paused');
    expect(space.askSpace).not.toHaveBeenCalled();
  });

  it('starts a Wormholes & Black Holes game with a board and mode', async () => {
    vi.mocked(space.askSpace).mockResolvedValue({ id: 'space-2' } as space.SpaceGame);
    const user = userEvent.setup();
    renderLobby();
    const create = screen.getByRole('region', { name: 'Start a game' });
    await user.click(within(create).getByRole('radio', { name: /Wormholes & Black Holes/ }));
    expect(within(create).queryByRole('radio', { name: 'White' })).not.toBeInTheDocument();
    await user.click(within(create).getByRole('radio', { name: 'Deep Space' }));
    await user.click(within(create).getByRole('radio', { name: /Classic/ }));
    await new Promise((resolve) => setTimeout(resolve, 50)); // the saved settings arrive late: they mustn't undo the clicks
    expect(within(create).getByRole('radio', { name: 'Deep Space' })).toBeChecked();
    await user.click(within(create).getByRole('radio', { name: 'Anyone in the lobby' }));
    await user.click(within(create).getByRole('button', { name: /Start game/ }));
    expect(space.askSpace).toHaveBeenCalledWith({
      action: 'create',
      setup: { board: { id: 'deep-space' }, settings: expect.objectContaining({ mode: 'classic', cosmicEvents: false }) },
      lobby: true,
    });
    expect(data.ask).not.toHaveBeenCalled();
    expect(await screen.findByText('Space game page')).toBeInTheDocument();
  });

  it('lists open space games with how many have joined, and joins one', async () => {
    vi.mocked(space.fetchSpaceLobby).mockResolvedValue([
      { id: 'sp-1', creator_name: 'Calm Tui 3', creator_avatar: {}, players: 2, board: { id: 'nebula' }, mode: 'cosmic', created_at: 'z' },
    ]);
    vi.mocked(space.askSpace).mockResolvedValue({ id: 'sp-1' } as space.SpaceGame);
    const user = userEvent.setup();
    renderLobby();
    const list = screen.getByRole('region', { name: 'Open games' });
    const row = (await within(list).findByText(/Calm Tui 3/)).closest('li')!;
    expect(row).toHaveTextContent('Nebula, Cosmic. 2 of 4 joined.');
    await user.click(within(row).getByRole('button', { name: 'Join' }));
    expect(space.askSpace).toHaveBeenCalledWith({ action: 'join', gameId: 'sp-1' });
    expect(await screen.findByText('Space game page')).toBeInTheDocument();
  });

  it('offers a way back into space games still going', async () => {
    vi.mocked(space.fetchMyOpenSpaceGames).mockResolvedValue([
      { id: 'sp-9', status: 'playing', host: 'them', seat1: 'them', seat2: 'me', seat3: null, seat4: null } as space.SpaceGame,
    ]);
    renderLobby();
    const mine = await screen.findByRole('region', { name: 'Your games' });
    expect(within(mine).getByRole('link', { name: 'Carry on' })).toHaveAttribute('href', '/space-game/sp-9');
  });
});
