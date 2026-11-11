import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import { busyLobby, setWorld } from './homePageFake';

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
import { Lobby} from './Lobby';

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

  it('creating and joining never wait for it', async () => {
    setWorld({ ...busyLobby(), waiting: ['lobby'] });
    vi.mocked(data.ask).mockResolvedValue({ id: 'new-game' } as data.FriendGame);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderLobby();
    await user.click(screen.getByRole('button', { name: /Start game/ }));
    expect(data.ask).toHaveBeenCalledWith({ action: 'create', game: 'chess', side: 'first', lobby: false });
    expect(await screen.findByText('Game page')).toBeInTheDocument();
  });
});
