import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import { busyLobby, sent, setWorld } from './homePageFake';

/**
 * The lobby in one request (docs/SERVER-LOAD-PLAN.md, S.4), with only Supabase faked: a pretend server that answers the old
 * separate requests and the new one from the same made-up games (homePageFake.ts). Creating and joining go to the game servers,
 * which are faked here as they are in Lobby.test.tsx.
 */
vi.mock('../lib/supabase', async () => (await import('./homePageFake')).fakeSupabase());
vi.mock('../data/multiplayer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/multiplayer')>()),
  ask: vi.fn(),
}));

import * as data from '../data/multiplayer';
import { Lobby, LOBBY_REFRESH_MS } from './Lobby';

const signedIn = {
  status: 'signed-in',
  profile: { id: 'me', display_name: 'Speedy Otter 27', avatar: {}, role: 'student' },
  message: null,
} as unknown as AuthState;

let visibility: DocumentVisibilityState = 'visible';

function renderLobby() {
  return render(
    <AuthContext.Provider value={signedIn}>
      <MemoryRouter initialEntries={['/lobby']}>
        <Routes>
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/play/:id" element={<p>Game page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

/** Lets the requests the page starts (and the ones those start) go out and come back. */
const settle = () => act(() => vi.advanceTimersByTimeAsync(100));
const pass = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const lobbyRequests = () => sent.filter((s) => s === 'rpc lobby').length;
const rows = (region: string) =>
  within(screen.getByRole('region', { name: region }))
    .getAllByRole('listitem')
    .map((li) => li.querySelector('strong')?.textContent ?? '');

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  vi.mocked(data.ask).mockReset();
  setWorld(busyLobby());
});
afterEach(() => {
  vi.useRealTimers();
});

describe('the lobby asks once', () => {
  it('sends one request when it opens, plus the remembered switch read', async () => {
    renderLobby();
    await settle();
    expect([...sent].sort()).toEqual(['from app_settings', 'rpc lobby']);
  });

  it('shows the same games in the same order as before', async () => {
    renderLobby();
    await screen.findByText('Lively Lynx 5 · Checkers');
    // Newest first across every kind; two made at the same moment keep chess and checkers before 101, as before.
    expect(rows('Open games')).toEqual([
      'Lively Lynx 5 · Checkers',
      'Calm Tui 3 · Chess',
      'Brave Kiwi 7 · 101',
      'Calm Tui 3 · Wormholes & Black Holes',
      'Lively Lynx 5 · Tic-Tac-Toe: Power Clash',
      'Lively Lynx 5 · 101',
      'Brave Kiwi 7 · Chess',
    ]);
    // Names come in the same answer; hidden Cat is "a classmate"; the waiting space game past its time isn't offered.
    expect(rows('Your games')).toEqual([
      'Chess vs Brave Kiwi 7',
      'Checkers vs a classmate',
      'Wormholes & Black Holes with Brave Kiwi 7',
      '101 with Brave Kiwi 7',
      '101 with Lively Lynx 5',
      'Tic-Tac-Toe: Power Clash with Brave Kiwi 7',
      'Your Tic-Tac-Toe: Power Clash game is waiting',
      'Your 101 game is waiting',
      'Your Wormholes & Black Holes game is waiting',
      'Your Chess game is waiting',
    ]);
  });

  it('asks again once every 20 seconds, and not at all while the tab is hidden', async () => {
    renderLobby();
    await settle();
    expect(lobbyRequests()).toBe(1);
    await pass(LOBBY_REFRESH_MS);
    expect(lobbyRequests()).toBe(2);
    expect(sent.filter((s) => s === 'from app_settings')).toHaveLength(1);
    expect(sent.filter((s) => s !== 'rpc lobby' && s !== 'from app_settings')).toEqual([]);
    visibility = 'hidden';
    await pass(3 * LOBBY_REFRESH_MS);
    expect(lobbyRequests()).toBe(2);
  });

  it('asks straight away when the tab comes back', async () => {
    renderLobby();
    await settle();
    visibility = 'hidden';
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    await pass(LOBBY_REFRESH_MS);
    expect(lobbyRequests()).toBe(1);
    visibility = 'visible';
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    await settle();
    expect(lobbyRequests()).toBe(2);
  });

  it('shows the old message when the request fails, and asks nothing more', async () => {
    setWorld({ ...busyLobby(), failing: ['lobby'] });
    renderLobby();
    expect(await screen.findByText('We couldn’t load the lobby. Check the Wi-Fi; we’ll keep trying.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Your games' })).not.toBeInTheDocument();
    expect([...sent].sort()).toEqual(['from app_settings', 'rpc lobby']);
  });

  it('keeps showing the games it has if a later refresh fails', async () => {
    renderLobby();
    await screen.findByText('Lively Lynx 5 · Checkers');
    setWorld({ ...busyLobby(), failing: ['lobby'] });
    await pass(LOBBY_REFRESH_MS);
    expect(lobbyRequests()).toBe(1);
    expect(screen.getByText('Lively Lynx 5 · Checkers')).toBeInTheDocument();
    expect(screen.queryByText(/We couldn’t load the lobby/)).not.toBeInTheDocument();
  });

  it('creating and joining never wait for it', async () => {
    setWorld({ ...busyLobby(), waiting: ['lobby'] });
    vi.mocked(data.ask).mockResolvedValue({ id: 'new-game' } as data.FriendGame);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderLobby();
    await user.click(screen.getByRole('button', { name: /Start game/ }));
    expect(data.ask).toHaveBeenCalledWith({ action: 'create', game: 'chess', side: 'first', lobby: false });
    expect(await screen.findByText('Game page')).toBeInTheDocument();
  });

  it('joining with a code never waits for it either', async () => {
    setWorld({ ...busyLobby(), waiting: ['lobby'] });
    vi.mocked(data.ask).mockResolvedValue({ id: 'coded' } as data.FriendGame);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderLobby();
    await user.type(screen.getByLabelText('Type the code your friend gives you'), 'km4 tp');
    await user.click(screen.getByRole('button', { name: 'Join game' }));
    expect(data.ask).toHaveBeenCalledWith({ action: 'join', code: 'KM4TP' });
    expect(await screen.findByText('Game page')).toBeInTheDocument();
  });
});
