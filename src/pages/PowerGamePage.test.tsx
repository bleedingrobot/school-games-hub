import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newLiveGame, playerAction } from '../../shared/power-clash/live';
import type { PowerId } from '../../shared/power-clash/types';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import * as data from '../data/powerGames';
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
  vi.mocked(data.watchPowerGame).mockImplementation(() => {
    return { stop: vi.fn() };
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the waiting room', () => {

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
});
