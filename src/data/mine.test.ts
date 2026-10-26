import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) },
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

import { forgetSettings } from './settingsMemory';
import { enqueueRun, forgetOutcomes, queuedRuns } from './mine';

const fetchMock = vi.fn<typeof fetch>();
let ME = '';
const report = (n: number) => ({ seed: `n1-1792000000-${String(n).padStart(24, '0')}`, stamp: 's', level: 'l1', mode: 'steady' as const, maths: true, inputs: '1x100' });

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  rpc.mockReset();
  forgetOutcomes();
  forgetSettings();
  ME = crypto.randomUUID();
});

describe('the finished-run queue', () => {
  it('counts a run once if it is queued twice', () => {
    enqueueRun(ME, report(1));
    enqueueRun(ME, report(1));
    expect(queuedRuns(ME)).toHaveLength(1);
  });
});

