import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';

/**
 * Training before games: only the Supabase client is faked. The settings row carries the class's switch, and
 * my_training_lock says when the student last finished a session.
 */
const server = vi.hoisted(() => ({
  sent: [] as string[],
  settings: { training_first: false } as Record<string, unknown> | null,
  lock: { on: true, lastFinishedAt: null } as unknown,
  lockError: false,
  ladder: null as unknown,
}));

vi.mock('../lib/supabase', () => {
  const answer = (data: unknown, error: unknown = null) => {
    const result = Promise.resolve({ data, error });
    const chain: Record<string, unknown> = {};
    for (const name of ['select', 'eq', 'in', 'is', 'order', 'limit', 'gt', 'gte']) chain[name] = () => chain;
    chain.maybeSingle = () => result;
    chain.single = () => result;
    chain.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => result.then(ok, bad);
    return chain;
  };
  return {
    supabase: {
      rpc: (name: string) => {
        server.sent.push(`rpc ${name}`);
        if (name === 'my_ladder') return answer(server.ladder);
        if (name !== 'my_training_lock') return answer(null);
        return server.lockError ? answer(null, { code: '500' }) : answer(server.lock);
      },
      from: (table: string) => (server.sent.push(`from ${table}`), answer(table === 'app_settings' ? server.settings : null)),
      auth: { getSession: async () => ({ data: { session: null }, error: null }) },
    },
  };
});

import { GameGate } from './TrainFirst';

const HOUR = 3_600_000;
const pupil = { status: 'signed-in', profile: { id: 'me', display_name: 'Speedy Otter 27', avatar: {}, role: 'student' }, message: null } as unknown as AuthState;

function show(page: React.ReactNode, auth: AuthState = pupil) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>{page}</MemoryRouter>
    </AuthContext.Provider>,
  );
}

const game = (
  <GameGate>
    <p>The game</p>
  </GameGate>
);

beforeEach(() => {
  server.sent.length = 0;
  server.settings = { training_first: true };
  server.lock = { on: true, lastFinishedAt: null };
  server.lockError = false;
  server.ladder = null;
});

describe('Training before games', () => {
  it('shows "Training first" instead of the game to a student who has never trained', async () => {
    show(game);
    expect(await screen.findByRole('heading', { name: 'Training first!' })).toBeInTheDocument();
    expect(screen.queryByText('The game')).toBeNull();
    expect(screen.getByRole('link', { name: /Today’s session/ })).toHaveAttribute('href', '/training');
  });

  it('opens the games for 6 hours after a session', async () => {
    server.lock = { on: true, lastFinishedAt: Date.now() - 5 * HOUR };
    show(game);
    expect(await screen.findByText('The game')).toBeInTheDocument();
  });
});
