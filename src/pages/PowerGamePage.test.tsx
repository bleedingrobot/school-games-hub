import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newLiveGame, playerAction } from '../../shared/power-clash/live';
import type { PowerId } from '../../shared/power-clash/types';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import * as data from '../data/powerGames';
import { MultiplayerError } from '../data/multiplayer';
import { SoundProvider } from '../sound';
import { PowerGamePage } from './PowerGamePage';

vi.mock('../data/multiplayer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/multiplayer')>()),
  fetchClockOffset: vi.fn(async () => 0),
  fetchPlayerCards: vi.fn(
    async () =>
      new Map([
        ['me', { id: 'me', display_name: 'Speedy Otter 27', avatar: {} }],
        ['them', { id: 'them', display_name: 'Brave Kiwi 7', avatar: {} }],
      ]),
  ),
}));
vi.mock('../data/powerGames', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/powerGames')>()),
  askPower: vi.fn(),
  fetchPowerGame: vi.fn(),
  watchPowerGame: vi.fn(),
}));

const ME: PowerId[] = ['wild-card', 'body-swap', 'freeze-ray'];
const THEM: PowerId[] = ['board-wipe', 'body-swap', 'freeze-ray'];

function powerGame(over: Partial<data.PowerGame> = {}): data.PowerGame {
  const now = Date.now();
  return {
    id: 'g1', code: null, in_lobby: false, host: 'me', seat1: 'me', seat2: 'them', first_player: null, loadouts: [ME, THEM],
    status: 'playing', game: newLiveGame(ME, THEM), events: [], version: 3, created_at: new Date(now).toISOString(),
    expires_at: new Date(now + 5 * 60_000).toISOString(), started_at: new Date(now).toISOString(),
    deadline: new Date(now + 60_000).toISOString(), last_action_at: null, finished_at: null, ending: null, leaver: null,
    won: null, counts: null, stats: null, rematch_game: null, ...over,
  };
}
const waitingGame = (over: Partial<data.PowerGame> = {}) =>
  powerGame({ status: 'waiting', code: 'KM4TP', seat2: null, loadouts: [null, null], game: null, deadline: null, started_at: null, ...over });

const signedIn = {
  status: 'signed-in',
  profile: { id: 'me', display_name: 'Speedy Otter 27', avatar: {}, role: 'student' },
  message: null,
} as unknown as AuthState;

let handlers: Parameters<typeof data.watchPowerGame>[2];

function renderGame(game: data.PowerGame) {
  vi.mocked(data.fetchPowerGame).mockResolvedValue(game);
  return render(
    <SoundProvider>
      <AuthContext.Provider value={signedIn}>
        <MemoryRouter initialEntries={[`/power-game/${game.id}`]}>
          <Routes>
            <Route path="/power-game/:id" element={<PowerGamePage />} />
            <Route path="/lobby" element={<p>The lobby</p>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </SoundProvider>,
  );
}

const cell = (n: number) => screen.getByRole('button', { name: new RegExp(`Row ${Math.floor((n - 1) / 3) + 1}, column ${((n - 1) % 3) + 1}:`) });

beforeEach(() => {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
  vi.mocked(data.askPower).mockReset();
  vi.mocked(data.fetchPowerGame).mockReset();
  vi.mocked(data.watchPowerGame).mockImplementation((_id, _me, h) => {
    handlers = h;
    return { stop: vi.fn() };
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the waiting room', () => {
  it('shows the code, who has joined, and lets me pick exactly three powers', async () => {
    const user = userEvent.setup();
    renderGame(waitingGame());
    expect(await screen.findByText('Your Power Clash')).toBeInTheDocument();
    expect(screen.getByLabelText(/Game code: K M 4 T P/)).toBeInTheDocument();
    expect(screen.getByText(/Waiting for a classmate/)).toBeInTheDocument();
    const lock = screen.getByRole('button', { name: /Lock in my powers/ });
    expect(lock).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /Body Swap/ })); // drop one
    expect(lock).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Body Swap/ }));
    expect(lock).toBeEnabled();
  });

  it('locking in sends the powers, then waits for the classmate without showing their picks', async () => {
    const user = userEvent.setup();
    const waiting = waitingGame({ seat2: 'them' });
    vi.mocked(data.askPower).mockResolvedValue({ ...waiting, loadouts: [['body-swap', 'freeze-ray', 'board-wipe'], null], version: 4 });
    renderGame(waiting);
    await user.click(await screen.findByRole('button', { name: /Lock in my powers/ }));
    expect(data.askPower).toHaveBeenCalledWith({ action: 'set-powers', gameId: 'g1', powers: ['body-swap', 'freeze-ray', 'board-wipe'] });
    expect(await screen.findByText(/Waiting for Brave Kiwi 7 to pick their powers/)).toBeInTheDocument();
    expect(screen.getByText(/Body Swap, Freeze Ray, Board Wipe/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change my powers' })).toBeInTheDocument();
  });

  it('hides the classmate’s picks until the match starts (only whether they have picked)', async () => {
    const waiting = waitingGame({ seat2: 'them', loadouts: [null, THEM] });
    renderGame(waiting);
    expect(await screen.findByText(/powers picked ✓/)).toBeInTheDocument();
    expect(screen.queryByText(/Board Wipe, Body Swap/)).not.toBeInTheDocument();
  });

  it('the host cancels, a guest leaves and goes back to the lobby', async () => {
    const user = userEvent.setup();
    const waiting = waitingGame();
    vi.mocked(data.askPower).mockResolvedValue({ ...waiting, status: 'cancelled', version: 4 });
    renderGame(waiting);
    await user.click(await screen.findByRole('button', { name: 'Cancel this game' }));
    expect(data.askPower).toHaveBeenCalledWith({ action: 'cancel', gameId: 'g1' });
    expect(await screen.findByText('This game was cancelled')).toBeInTheDocument();
  });

  it('a game I am not in sends me to the lobby', async () => {
    renderGame(waitingGame({ host: 'other', seat1: 'other', seat2: null }));
    expect(await screen.findByText('The lobby')).toBeInTheDocument();
  });
});

describe('a match', () => {
  it('only the server’s answer changes the board, and a double tap sends one move', async () => {
    const user = userEvent.setup();
    const game = powerGame();
    let release!: (g: data.PowerGame) => void;
    vi.mocked(data.askPower).mockImplementation(() => new Promise((resolve) => (release = resolve)));
    renderGame(game);
    await screen.findByText('Your go: pick a power or a square');
    await user.dblClick(cell(5));
    expect(data.askPower).toHaveBeenCalledTimes(1);
    expect(data.askPower).toHaveBeenCalledWith({ action: 'place', gameId: 'g1', version: 3, square: 4 });
    expect(cell(5)).toHaveTextContent('');
    const after = playerAction(game.game!, 0, { type: 'place', square: 4 });
    await act(async () => release({ ...game, game: after.game, events: after.events, version: 4 }));
    await waitFor(() => expect(cell(5)).toHaveTextContent('X'));
    expect(screen.getByText('Waiting for Brave Kiwi 7…')).toBeInTheDocument();
  });

  it('their move arrives live and is drawn', async () => {
    const game = powerGame();
    const myMove = playerAction(game.game!, 0, { type: 'place', square: 0 });
    const theirs = powerGame({ game: myMove.game, version: 4 });
    renderGame(theirs);
    await screen.findByText('Waiting for Brave Kiwi 7…');
    const reply = playerAction(myMove.game, 1, { type: 'place', square: 8 });
    act(() => handlers.onGame(powerGame({ game: reply.game, events: reply.events, version: 5 })));
    await waitFor(() => expect(cell(9)).toHaveTextContent('O'));
    expect(screen.getByText('Your go: pick a power or a square')).toBeInTheDocument();
  });

  it('an older update never takes the game backwards', async () => {
    const game = powerGame({ version: 6 });
    renderGame(game);
    await screen.findByText('Your go: pick a power or a square');
    const old = playerAction(game.game!, 0, { type: 'place', square: 2 });
    act(() => handlers.onGame(powerGame({ game: old.game, version: 4 })));
    expect(cell(3)).toHaveTextContent('');
  });

  it('keeps the game and says so when the connection drops, then carries on when it is back', async () => {
    renderGame(powerGame());
    await screen.findByText('Your go: pick a power or a square');
    act(() => handlers.onLive('down'));
    expect(screen.getByText(/We lost the connection/)).toBeInTheDocument();
    expect(cell(1)).toBeInTheDocument();
    act(() => handlers.onLive('live'));
    await waitFor(() => expect(screen.queryByText(/We lost the connection/)).not.toBeInTheDocument());
  });

  it('after a refusal because the game changed, it just looks again, quietly', async () => {
    const user = userEvent.setup();
    const game = powerGame();
    vi.mocked(data.askPower).mockRejectedValue(new MultiplayerError('The game changed just then. Have another look.', 'changed'));
    renderGame(game);
    await screen.findByText('Your go: pick a power or a square');
    const calls = vi.mocked(data.fetchPowerGame).mock.calls.length;
    await user.click(cell(1));
    await waitFor(() => expect(vi.mocked(data.fetchPowerGame).mock.calls.length).toBeGreaterThan(calls));
    expect(screen.queryByText(/changed just then/)).not.toBeInTheDocument();
  });

  it('shows a refusal the server explains', async () => {
    const user = userEvent.setup();
    vi.mocked(data.askPower).mockRejectedValue(new MultiplayerError('You cannot place there', 'illegal'));
    renderGame(powerGame());
    await screen.findByText('Your go: pick a power or a square');
    await user.click(cell(1));
    expect(await screen.findByText('You cannot place there')).toBeInTheDocument();
  });

  it('Rematch goes to the new game', async () => {
    const user = userEvent.setup();
    const done = powerGame();
    const won = { ...done, status: 'finished' as const, ending: 'finished' as const, game: { ...done.game!, match: { ...done.game!.match, winner: 'X' as const } } };
    vi.mocked(data.askPower).mockResolvedValue(waitingGame({ id: 'g2', seat2: 'them' }));
    renderGame(won);
    await user.click(await screen.findByRole('button', { name: 'Rematch' }));
    expect(data.askPower).toHaveBeenCalledWith({ action: 'rematch', gameId: 'g1' });
    await waitFor(() => expect(vi.mocked(data.fetchPowerGame)).toHaveBeenCalledWith('g2'));
  });
});
