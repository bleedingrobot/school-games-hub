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
const GAME = { id: 'g1', version: 3 };

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
  it('sends once when all is well', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { game: GAME }));
    expect(await asking({ action: 'resign', gameId: 'g1' })).toEqual({ game: GAME });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('tries once more after a Wi-Fi blip', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(json(200, { game: GAME }));
    expect(await asking({ action: 'move', gameId: 'g1', move: 'e2e4', ply: 0 })).toEqual({ game: GAME });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('tries once more when Supabase hiccups (502/503)', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 })).mockResolvedValueOnce(json(200, { game: GAME }));
    expect(await asking({ action: 'offer-draw', gameId: 'g1' })).toEqual({ game: GAME });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('only tries twice, then says to check the Wi-Fi', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const { error } = (await asking({ action: 'resign', gameId: 'g1' })) as { error: MultiplayerError };
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(error.problem).toBe('offline');
    expect(error.message).toMatch(/Wi-Fi/);
  });

  it('never retries a plain refusal', async () => {
    fetchMock.mockResolvedValueOnce(json(409, { error: 'It’s not your turn yet.', problem: 'not-your-turn' }));
    const { error } = (await asking({ action: 'move', gameId: 'g1', move: 'e2e4', ply: 0 })) as { error: MultiplayerError };
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(error.problem).toBe('not-your-turn');
  });

  it('a retried move that had already got through just looks at the game again', async () => {
    // The first try reached the server but the answer was lost; the second is one move behind.
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(json(409, { error: 'The game changed just then.', problem: 'changed' }));
    const { error } = (await asking({ action: 'move', gameId: 'g1', move: 'e2e4', ply: 0 })) as { error: MultiplayerError };
    expect(error.problem).toBe('changed');
  });

  it('a retried resign that had already got through is not shown as an error', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 502 }))
      .mockResolvedValueOnce(json(409, { error: 'This game has already finished.', problem: 'over' }));
    const { error } = (await asking({ action: 'resign', gameId: 'g1' })) as { error: MultiplayerError };
    expect(error.problem).toBe('changed');
  });

  it('a retried join that had already got through goes to the game', async () => {
    const joined = { id: 'g7', status: 'playing', started_at: new Date().toISOString(), expires_at: new Date().toISOString() };
    openGames.rows = [joined];
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(json(404, { error: 'We couldn’t find a game with that code.', problem: 'not-found' }));
    expect(await asking({ action: 'join', code: 'KM4TP' })).toEqual({ game: joined });
  });

  it('a wrong code is still a wrong code', async () => {
    fetchMock.mockResolvedValueOnce(json(404, { error: 'We couldn’t find a game with that code.', problem: 'not-found' }));
    const { error } = (await asking({ action: 'join', code: 'KM4TP' })) as { error: MultiplayerError };
    expect(error.problem).toBe('not-found');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
