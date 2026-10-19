import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';

/**
 * How many requests the home page and the lobby send when they open (docs/SERVER-LOAD-PLAN.md section 5).
 * Only the Supabase client is faked: every page, card and data function is the real one. Each request is written down
 * as "rpc name", "from table" or "function name", and answers with nothing, so nothing waits on a real server.
 */
const sent: string[] = [];

// The settings row comes back with every game switched on, so every card that has a switch is shown.
const SETTINGS = { monsters_enabled: true, lord_enabled: true, clans_enabled: true, multiplayer_enabled: true, space_maths: 'choose' };

function answer(data: unknown = null): unknown {
  // A chain like .select().eq().maybeSingle() that ends in the answer.
  const result = Promise.resolve({ data, error: null });
  const chain: Record<string, unknown> = {};
  for (const name of ['select', 'eq', 'neq', 'in', 'is', 'or', 'order', 'limit', 'range', 'gt', 'gte', 'lt', 'lte', 'filter', 'not', 'match']) chain[name] = () => chain;
  chain.maybeSingle = () => result;
  chain.single = () => result;
  chain.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => result.then(ok, bad);
  return chain;
}

vi.mock('../lib/supabase', () => {
  const channel = { on: () => channel, subscribe: () => channel, unsubscribe: async () => 'ok', send: async () => 'ok' };
  return {
    supabase: {
      rpc: (name: string) => (sent.push(`rpc ${name}`), answer()),
      from: (table: string) => (sent.push(`from ${table}`), answer(table === 'app_settings' ? SETTINGS : null)),
      functions: { invoke: async (name: string) => (sent.push(`function ${name}`), { data: null, error: null }) },
      channel: () => channel,
      removeChannel: async () => 'ok',
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
    },
  };
});

import { Dashboard } from './Dashboard';
import { Lobby } from './Lobby';

const signedIn = {
  status: 'signed-in',
  profile: { id: 'me', display_name: 'Speedy Otter 27', avatar: {}, role: 'student' },
  message: null,
} as unknown as AuthState;

function show(page: React.ReactNode) {
  return render(
    <AuthContext.Provider value={signedIn}>
      <MemoryRouter>{page}</MemoryRouter>
    </AuthContext.Provider>,
  );
}

/** Lets every request that the page starts (and the ones those start) go out. */
async function settle() {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 5));
}

beforeEach(() => {
  sent.length = 0;
});
afterEach(() => {
  vi.useRealTimers();
});

describe('requests sent when a page opens', () => {
  it('the home page sends one request, plus one read of the game switches', async () => {
    show(<Dashboard />);
    await screen.findAllByRole('heading');
    await settle();
    // Written down for the plan's results (npx vitest run src/pages/RequestCount.test.tsx shows it). Before S.2 it was 20.
    console.info(`home page: ${sent.length} requests\n  ${[...sent].sort().join('\n  ')}`);
    expect([...sent].sort()).toEqual(['from app_settings', 'rpc my_home_page']);
  });

  it('the lobby reads the playing-friends switch with one request', async () => {
    show(<Lobby />);
    await settle();
    console.info(`lobby: ${sent.length} requests\n  ${[...sent].sort().join('\n  ')}`);
    expect(sent.filter((s) => s === 'from app_settings').length).toBeLessThanOrEqual(1);
  });

  it('opening the home page and then the lobby reads the switches once between them', async () => {
    const home = show(<Dashboard />);
    await settle();
    home.unmount();
    show(<Lobby />);
    await settle();
    expect(sent.filter((s) => s === 'from app_settings')).toHaveLength(1);
  });
});
