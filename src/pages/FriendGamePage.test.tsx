import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import * as data from '../data/multiplayer';
import { SoundProvider } from '../sound';
import { FriendGamePage } from './FriendGamePage';

vi.mock('../data/multiplayer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/multiplayer')>()),
  ask: vi.fn(),
  fetchFriendGame: vi.fn(),
  fetchClockOffset: vi.fn(async () => 0),
  fetchPlayerCards: vi.fn(async () => new Map([['them', { id: 'them', display_name: 'Brave Kiwi 7', avatar: {} }]])),
  watchGame: vi.fn(),
}));

function friendGame(over: Partial<data.FriendGame> = {}): data.FriendGame {
  return {
    id: 'g1',
    game: 'chess',
    code: 'KM4TP',
    in_lobby: false,
    created_by: 'me',
    first_player: 'me',
    second_player: 'them',
    status: 'playing',
    moves: [],
    version: 1,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    started_at: new Date().toISOString(),
    turn_started_at: new Date().toISOString(),
    draw_offer: null,
    first_draw_offers: 0,
    second_draw_offers: 0,
    first_offer_ply: null,
    second_offer_ply: null,
    winner: null,
    reason: null,
    counts_for_points: null,
    finished_at: null,
    first_wants_rematch: false,
    second_wants_rematch: false,
    rematch_game: null,
    ...over,
  };
}

const signedIn = {
  status: 'signed-in',
  profile: { id: 'me', display_name: 'Speedy Otter 27', avatar: {}, role: 'student' },
  message: null,
} as unknown as AuthState;

function renderGame(game: data.FriendGame) {
  vi.mocked(data.fetchFriendGame).mockResolvedValue(game);
  return render(
    <SoundProvider>
      <AuthContext.Provider value={signedIn}>
        <MemoryRouter initialEntries={[`/play/${game.id}`]}>
          <Routes>
            <Route path="/play/:id" element={<FriendGamePage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </SoundProvider>,
  );
}

beforeEach(() => {
  vi.mocked(data.ask).mockReset();
  vi.mocked(data.watchGame).mockReturnValue({ stop: vi.fn() });
});

describe('playing a friend', () => {
  it('asks the server to make my move, saying how many moves I’ve seen', async () => {
    vi.mocked(data.ask).mockResolvedValue(friendGame({ moves: ['e2e4'], version: 2 }));
    const user = userEvent.setup();
    renderGame(friendGame());
    expect(await screen.findByRole('status', { name: '' })).toHaveTextContent('Your turn');
    await user.click(screen.getByRole('button', { name: /^e2/ }));
    await user.click(screen.getByRole('button', { name: /^e4/ }));
    expect(data.ask).toHaveBeenCalledWith({ action: 'move', gameId: 'g1', move: 'e2e4', ply: 0 });
    expect(await screen.findByText('Waiting for Brave Kiwi 7 to move…')).toBeInTheDocument();
  });
});
