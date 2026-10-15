import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) } },
}));

import { RETRY_AFTER_MS, saveBotGame, type SaveableReport } from './botGames';

const fetchMock = vi.fn<typeof fetch>();
const REPORT: SaveableReport = { game: 'chess', level: 'easy', studentColour: 'white', moves: ['e2e4'], ending: 'resigned' };

async function saving() {
  const result = saveBotGame(REPORT).then(
    () => 'saved',
    (error: Error) => error.message,
  );
  await vi.advanceTimersByTimeAsync(RETRY_AFTER_MS);
  return result;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('saving a bot game', () => {
  it('tries once more after a Wi-Fi blip or a server hiccup', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(new Response('{}'));
    expect(await saving()).toBe('saved');
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 })).mockResolvedValueOnce(new Response('{}'));
    expect(await saving()).toBe('saved');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('gives up after two tries with a friendly message', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await saving()).toMatch(/couldn't reach the server/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows the server’s own words for a refusal, without retrying', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "That's a lot of games today!" }), { status: 429 }));
    expect(await saving()).toBe("That's a lot of games today!");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
