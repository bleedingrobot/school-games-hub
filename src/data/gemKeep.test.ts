import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveItem } from '../../shared/gem-keep/save';

const rpc = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) },
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

import { enqueue, flushQueue, queuedItems} from './gemKeep';

const fetchMock = vi.fn<typeof fetch>();
// A new student each test, so no queue carries over (the queue is also kept in memory).
let ME = '';

const run = (levelId = 'level-1'): SaveItem => ({
  type: 'run', runId: crypto.randomUUID(), levelId, result: 'won', stars: 3, waves: 8, gameSeconds: 500, asked: 20, right: 18,
});

const answer = (handled: number) => new Response(JSON.stringify({ handled, results: [] }));

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  rpc.mockReset();
  ME = crypto.randomUUID();
});

describe('the Gem Keep save queue', () => {

  it('keeps everything when offline, and sends it later', async () => {
    enqueue(ME, run());
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect(await flushQueue(ME)).toBe(false);
    expect(queuedItems(ME)).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(`sgh-gem-keep-queue:${ME}`)!)).toHaveLength(1);
    fetchMock.mockResolvedValueOnce(answer(1));
    expect(await flushQueue(ME)).toBe(true);
  });
});
