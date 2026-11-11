import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BondMatchItem, SaveResult } from '../../shared/bond-match/save';

const rpc = vi.fn();
let session: { access_token: string } | null = { access_token: 'token' };
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session } }) },
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

import { enqueue, flushGames, queuedGames } from './bondMatch';

const fetchMock = vi.fn<typeof fetch>();
let ME = '';
let n = 0;

const game = (over: Partial<BondMatchItem> = {}): BondMatchItem => ({
  runId: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, seed: 5, bondId: 'whole-10', size: 'small', flips: [0, 1, 2, 3], seconds: 40, ...over,
});
const saved = (over = {}): SaveResult => ({ status: 'saved', points: 2, stars: 3, best: { flips: 6, seconds: 40, stars: 3 }, ...over }) as SaveResult;
const reply = (results: SaveResult[], handled = results.length) => new Response(JSON.stringify({ handled, results }));
const sentRuns = (call: number) => (JSON.parse(fetchMock.mock.calls[call][1]!.body as string).items as BondMatchItem[]).map((i) => i.runId);

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  rpc.mockReset();
  session = { access_token: 'token' };
  ME = crypto.randomUUID();
});

describe('the Bond Match save queue', () => {

  it('keeps the games when the server cannot be reached, and sends them next time, once each', async () => {
    const a = game();
    enqueue(ME, a);
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    expect((await flushGames(ME)).size).toBe(0);
    expect(queuedGames(ME)).toEqual([a]);
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 503 }));
    await flushGames(ME);
    expect(queuedGames(ME)).toEqual([a]);
    fetchMock.mockResolvedValueOnce(reply([saved()]));
    await flushGames(ME);
    expect(queuedGames(ME)).toEqual([]);
    expect(sentRuns(2)).toEqual([a.runId]);
  });
});
