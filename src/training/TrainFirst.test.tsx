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
        if (name !== 'my_training_lock') return answer(null);
        return server.lockError ? answer(null, { code: '500' }) : answer(server.lock);
      },
      from: (table: string) => (server.sent.push(`from ${table}`), answer(table === 'app_settings' ? server.settings : null)),
      auth: { getSession: async () => ({ data: { session: null }, error: null }) },
    },
  };
});

import { AppRoutes } from '../App';
import { enqueueSession } from '../data/training';
import { GameGate, GamesGateNote, TrainingGateBanner } from './TrainFirst';

const HOUR = 3_600_000;
const pupil = { status: 'signed-in', profile: { id: 'me', display_name: 'Speedy Otter 27', avatar: {}, role: 'student' }, message: null } as unknown as AuthState;
const teacher = { ...pupil, profile: { ...pupil.profile!, role: 'teacher' } } as AuthState;

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
});

describe('Training before games', () => {
  it('leaves the games open when the class has it off, without asking anything more', async () => {
    server.settings = { training_first: false };
    show(game);
    expect(await screen.findByText('The game')).toBeInTheDocument();
    expect(server.sent).toEqual(['from app_settings']);
  });

  it('shows "Training first" instead of the game to a student who has never trained', async () => {
    show(game);
    expect(await screen.findByRole('heading', { name: 'Training first!' })).toBeInTheDocument();
    expect(screen.queryByText('The game')).toBeNull();
    expect(screen.getByRole('link', { name: /Today’s session/ })).toHaveAttribute('href', '/training');
    expect(screen.getByRole('link', { name: /Quick looks/ })).toHaveAttribute('href', '/training?quick=1');
    expect(screen.getByText(/stay open for 6 hours/)).toBeInTheDocument();
  });

  it('opens the games for 6 hours after a session', async () => {
    server.lock = { on: true, lastFinishedAt: Date.now() - 5 * HOUR };
    show(game);
    expect(await screen.findByText('The game')).toBeInTheDocument();
  });

  it('locks them again after 6 hours', async () => {
    server.lock = { on: true, lastFinishedAt: Date.now() - 6 * HOUR - 60_000 };
    show(game);
    expect(await screen.findByRole('heading', { name: 'Training first!' })).toBeInTheDocument();
  });

  it('opens straight away after a session on this device, even before the server has it', async () => {
    enqueueSession('me', 'quick', 42);
    show(game);
    expect(await screen.findByText('The game')).toBeInTheDocument();
  });

  it('never locks a teacher, and asks nothing', async () => {
    show(game, teacher);
    expect(await screen.findByText('The game')).toBeInTheDocument();
    expect(server.sent).toEqual([]);
  });

  it('leaves the games open when the server can’t be asked', async () => {
    server.lockError = true;
    show(game);
    expect(await screen.findByText('The game')).toBeInTheDocument();
  });

  it('a student the server leaves out (a teacher in a student account’s class row) is never locked', async () => {
    server.lock = { on: false, lastFinishedAt: null };
    show(game);
    expect(await screen.findByText('The game')).toBeInTheDocument();
  });
});

describe('every way into a game', () => {
  const at = (path: string) =>
    render(
      <AuthContext.Provider value={pupil}>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

  it.each(['/chess', '/archery', '/gem-keep', '/lobby'])('%s shows "Training first" while locked', async (path) => {
    at(path);
    expect(await screen.findByRole('heading', { name: 'Training first!' })).toBeInTheDocument();
  });
});

describe('the home page and Training lines', () => {
  it('says so on the home page while locked, with both ways to train', async () => {
    show(<TrainingGateBanner />);
    expect(await screen.findByText('Training first!')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Today’s session/ })).toBeInTheDocument();
  });

  it('says until when the games are open', async () => {
    server.lock = { on: true, lastFinishedAt: Date.now() - HOUR };
    show(<TrainingGateBanner />);
    expect(await screen.findByText(/Games open until \d{1,2}:\d\d [ap]m/)).toBeInTheDocument();
  });

  it('says nothing on the home page when the class has it off', async () => {
    server.settings = { training_first: false };
    const { container } = show(<TrainingGateBanner />);
    await vi.waitFor(() => expect(server.sent).toEqual(['from app_settings']));
    expect(container).toBeEmptyDOMElement();
  });

  it('tells a student in Training what a session does, and when it’s done', async () => {
    show(<GamesGateNote />);
    expect(await screen.findByText('Finish a session to open the games.')).toBeInTheDocument();
  });

  it('points back to the games once they are open', async () => {
    enqueueSession('me', 'facts', 7);
    show(<GamesGateNote />);
    expect(await screen.findByRole('link', { name: 'Back to games' })).toHaveAttribute('href', '/');
  });
});
