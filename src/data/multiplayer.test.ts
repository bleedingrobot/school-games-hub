import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const openGames = vi.hoisted(() => ({ rows: [] as unknown[] }));

vi.mock('../lib/supabase', () => {
  // Just enough of the database client for ask(): a session, and "my open games".
  const query = {
    select: () => query,
    in: () => query,
    order: () => query,
    limit: async () => ({ data: openGames.rows, error: null }),
  };
  return {
    supabase: {
      auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) },
      from: () => query,
    },
  };
});

import { ask, MultiplayerError, RETRY_AFTER_MS } from './multiplayer';

const fetchMock = vi.fn<typeof fetch>();
const json = (status: number, body: object) => new Response(JSON.stringify(body), { status });

/** Runs ask() while letting the one-second retry wait pass straight away. */
async function asking(request: Parameters<typeof ask>[0]) {
  const result = ask(request).then(
    (game) => ({ game }),
    (error: unknown) => ({ error }),
  );
  await vi.advanceTimersByTimeAsync(RETRY_AFTER_MS);
  return result;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  openGames.rows = [];
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('asking the multiplayer server function', () => {
  it('a retried move that had already got through just looks at the game again', async () => {
    // The first try reached the server but the answer was lost; the second is one move behind.
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(json(409, { error: 'The game changed just then.', problem: 'changed' }));
    const { error } = (await asking({ action: 'move', gameId: 'g1', move: 'e2e4', ply: 0 })) as { error: MultiplayerError };
    expect(error.problem).toBe('changed');
  });
});
