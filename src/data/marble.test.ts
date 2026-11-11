import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) },
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

import { enqueueRun, flushRuns, queuedRuns} from './marble';

const fetchMock = vi.fn<typeof fetch>();
let ME = '';
const report = (n: number) => ({ seed: `m1-1792000000-${String(n).padStart(24, '0')}`, stamp: 's', course: 'boulder-beach', mode: 'up' as const, inputs: '1x100' });

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  rpc.mockReset();
  ME = crypto.randomUUID();
});

describe('the marble save queue', () => {

  it('keeps a run when offline or when told to take a break, and tries again later', async () => {
    enqueueRun(ME, report(1));
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await flushRuns(ME)).toBe(false);
    expect(queuedRuns(ME)).toHaveLength(1);
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 429 }));
    expect(await flushRuns(ME)).toBe(false);
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 503 }));
    expect(await flushRuns(ME)).toBe(false);
    expect(queuedRuns(ME)).toHaveLength(1);
    fetchMock.mockResolvedValueOnce(new Response('{}'));
    expect(await flushRuns(ME)).toBe(true);
  });
});
