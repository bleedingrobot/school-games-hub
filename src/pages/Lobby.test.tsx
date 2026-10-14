import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import * as data from '../data/multiplayer';
import { Lobby } from './Lobby';

vi.mock('../data/multiplayer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/multiplayer')>()),
  ask: vi.fn(),
  fetchLobby: vi.fn(),
  fetchMultiplayerEnabled: vi.fn(),
  fetchMyOpenGames: vi.fn(),
  fetchPlayerCards: vi.fn(async () => new Map()),
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
});

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
    vi.mocked(data.ask).mockRejectedValue(
      new data.MultiplayerError('We couldn’t find a game with that code. Check it and try again.', 'not-found'),
    );
    const user = userEvent.setup();
    renderLobby();
    await user.type(screen.getByLabelText('Type the code your friend gives you'), 'CCCCC');
    await user.click(screen.getByRole('button', { name: 'Join game' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t find a game with that code');
    expect(screen.queryByText('Game page')).not.toBeInTheDocument();
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
});
