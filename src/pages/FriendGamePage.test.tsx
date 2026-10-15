import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import * as data from '../data/multiplayer';
import { AWAY_AFTER_MS } from '../multiplayer/useFriendGame';
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

/** The live-update handlers the page gave watchGame, so tests can send it changes. */
let live: Parameters<typeof data.watchGame>[2];

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
  vi.mocked(data.watchGame).mockImplementation((_id, _me, handlers) => {
    live = handlers;
    return { stop: vi.fn() };
  });
});
afterEach(() => vi.useRealTimers());

describe('waiting for a friend', () => {
  it('shows the code big and clear, and can be cancelled', async () => {
    const waiting = friendGame({ status: 'waiting', second_player: null, started_at: null, turn_started_at: null });
    vi.mocked(data.ask).mockResolvedValue({ ...waiting, status: 'cancelled', version: 2 });
    const user = userEvent.setup();
    renderGame(waiting);

    expect(await screen.findByRole('heading', { name: 'Waiting for a friend…' })).toBeInTheDocument();
    expect(screen.getByText('KM4 TP')).toBeInTheDocument();
    expect(screen.getByText(/You’ll play/)).toHaveTextContent('White');

    await user.click(screen.getByRole('button', { name: 'Cancel this game' }));
    expect(data.ask).toHaveBeenCalledWith({ action: 'cancel', gameId: 'g1' });
    expect(await screen.findByRole('heading', { name: 'This game was cancelled' })).toBeInTheDocument();
  });

  it('turns into the game the moment a friend joins', async () => {
    renderGame(friendGame({ status: 'waiting', second_player: null }));
    await screen.findByRole('heading', { name: 'Waiting for a friend…' });
    act(() => live.onGame(friendGame({ version: 2 })));
    expect(await screen.findByRole('group', { name: /Chess board/ })).toBeInTheDocument();
    expect(screen.getByText('Brave Kiwi 7')).toBeInTheDocument();
  });

  it('says when nobody joined in time', async () => {
    renderGame(friendGame({ status: 'expired' }));
    expect(await screen.findByRole('heading', { name: 'Nobody joined in time' })).toBeInTheDocument();
  });
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

  it('shows the opponent’s move when it arrives live', async () => {
    renderGame(friendGame({ moves: ['e2e4'] }));
    expect(await screen.findByText('Waiting for Brave Kiwi 7 to move…')).toBeInTheDocument();
    act(() => live.onGame(friendGame({ moves: ['e2e4', 'e7e5'], version: 3 })));
    expect(await screen.findByText('Your turn')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Moves' })).toHaveTextContent('e5');
  });

  it('ignores an old live message arriving late', async () => {
    renderGame(friendGame({ moves: ['e2e4', 'e7e5'], version: 3 }));
    await screen.findByText('Your turn');
    act(() => live.onGame(friendGame({ moves: ['e2e4'], version: 2 })));
    expect(screen.getByText('Your turn')).toBeInTheDocument();
  });

  it('shows when the opponent seems to be away', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderGame(friendGame({ moves: ['e2e4'] }));
    await screen.findByText('Waiting for Brave Kiwi 7 to move…');
    act(() => live.onPresent(['me', 'them']));
    act(() => live.onPresent(['me']));
    expect(screen.queryByText(/seems to be away/)).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(AWAY_AFTER_MS + 100));
    expect(screen.getByText(/Brave Kiwi 7 seems to be away/)).toBeInTheDocument();
    expect(screen.getByText(/· away/)).toBeInTheDocument();
    act(() => live.onPresent(['me', 'them']));
    expect(screen.queryByText(/seems to be away/)).not.toBeInTheDocument();
  });

  it('says when live updates have dropped', async () => {
    renderGame(friendGame());
    await screen.findByText('Your turn');
    act(() => live.onLive('down'));
    expect(screen.getByText(/Live updates have dropped/)).toBeInTheDocument();
  });

  it('lets me claim the win once the opponent has had 2 minutes', async () => {
    const twoMinutesAgo = new Date(Date.now() - 121_000).toISOString();
    vi.mocked(data.ask).mockResolvedValue(
      friendGame({ moves: ['e2e4'], status: 'finished', winner: 'first', reason: 'abandoned', counts_for_points: false, version: 3 }),
    );
    const user = userEvent.setup();
    renderGame(friendGame({ moves: ['e2e4'], turn_started_at: twoMinutesAgo }));
    await user.click(await screen.findByRole('button', { name: /Claim the win/ }));
    expect(data.ask).toHaveBeenCalledWith({ action: 'claim-win', gameId: 'g1' });
    const result = await screen.findByRole('dialog');
    expect(result).toHaveTextContent('You won!');
    await within(result).findByText(/Brave Kiwi 7 didn’t move/);
    expect(result).toHaveTextContent('Brave Kiwi 7 didn’t move for 2 minutes, so you win.');
  });

  it("doesn't offer the claim before 2 minutes, but shows the timer", async () => {
    renderGame(friendGame({ moves: ['e2e4'], turn_started_at: new Date(Date.now() - 45_000).toISOString() }));
    expect(await screen.findByText(/has been thinking for 0:4/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Claim the win/ })).not.toBeInTheDocument();
  });

  it('lets me answer a draw offer', async () => {
    vi.mocked(data.ask).mockResolvedValue(friendGame({ draw_offer: null, version: 3 }));
    const user = userEvent.setup();
    renderGame(friendGame({ draw_offer: 'second' }));
    const offer = await screen.findByRole('group', { name: 'Draw offer' });
    expect(await within(offer).findByText(/Brave Kiwi 7 offers a draw/)).toBeInTheDocument();
    await user.click(within(offer).getByRole('button', { name: 'No, keep playing' }));
    expect(data.ask).toHaveBeenCalledWith({ action: 'answer-draw', gameId: 'g1', accept: false });
  });

  it('greys out "Offer a draw" and says why, instead of letting the server refuse', async () => {
    // I'm first. I offered at move 4 and have made 2 moves of my own since.
    const { unmount } = renderGame(
      friendGame({ moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'd2d3', 'f8c5'], first_draw_offers: 1, first_offer_ply: 4 }),
    );
    expect(await screen.findByRole('button', { name: /Offer a draw/ })).toBeDisabled();
    expect(screen.getByText('You can offer another draw after 3 more moves.')).toBeInTheDocument();
    unmount();

    renderGame(friendGame({ first_draw_offers: 3, first_offer_ply: 0 }));
    expect(await screen.findByRole('button', { name: /Offer a draw/ })).toBeDisabled();
    expect(screen.getByText('You’ve used all 3 draw offers in this game.')).toBeInTheDocument();
  });

  it('asks before resigning', async () => {
    vi.mocked(data.ask).mockResolvedValue(friendGame({ status: 'finished', winner: 'second', reason: 'resigned', version: 2 }));
    const user = userEvent.setup();
    renderGame(friendGame());
    await user.click(await screen.findByRole('button', { name: /Resign/ }));
    expect(data.ask).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Yes, resign' }));
    expect(data.ask).toHaveBeenCalledWith({ action: 'resign', gameId: 'g1' });
  });

  it('shows the server’s friendly message when a move is refused', async () => {
    vi.mocked(data.ask).mockRejectedValue(
      new data.MultiplayerError('Your teacher has paused games against friends for now.', 'paused'),
    );
    const user = userEvent.setup();
    renderGame(friendGame());
    await user.click(await screen.findByRole('button', { name: /^e2/ }));
    await user.click(screen.getByRole('button', { name: /^e4/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your teacher has paused games');
    expect(screen.getByText('Your turn')).toBeInTheDocument();
  });
});

describe('the result screen', () => {
  it('shows the result from my side and offers a rematch', async () => {
    vi.mocked(data.ask).mockResolvedValue(
      friendGame({ status: 'finished', winner: 'second', reason: 'checkmate', first_wants_rematch: true, version: 9 }),
    );
    const user = userEvent.setup();
    renderGame(
      friendGame({
        moves: ['f2f3', 'e7e5', 'g2g4', 'd8h4'],
        status: 'finished',
        winner: 'second',
        reason: 'checkmate',
        counts_for_points: false,
      }),
    );
    const result = await screen.findByRole('dialog');
    await within(result).findByText('Brave Kiwi 7 won this time');
    expect(result).toHaveTextContent('Checkmate. Brave Kiwi 7 trapped your king this time.');
    await user.click(within(result).getByRole('button', { name: 'Rematch' }));
    expect(data.ask).toHaveBeenCalledWith({ action: 'rematch', gameId: 'g1' });
    expect(await within(result).findByText(/Waiting for Brave Kiwi 7 to say yes/)).toBeInTheDocument();
  });

  it('tells me when my opponent wants a rematch', async () => {
    renderGame(friendGame({ status: 'finished', winner: null, reason: 'agreed-draw', second_wants_rematch: true }));
    const result = await screen.findByRole('dialog');
    expect(result).toHaveTextContent('It’s a draw!');
    expect(await within(result).findByText('Brave Kiwi 7 wants a rematch!')).toBeInTheDocument();
    expect(within(result).getByRole('button', { name: 'Yes, rematch Brave Kiwi 7!' })).toBeInTheDocument();
  });
});
