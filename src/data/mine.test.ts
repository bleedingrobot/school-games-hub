import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) },
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

import { forgetSettings } from './settingsMemory';
import {
  enqueueRun, flushRuns, forgetOutcomes, outcomeOf, queuedRuns} from './mine';

const fetchMock = vi.fn<typeof fetch>();
let ME = '';
const report = (n: number) => ({ seed: `n1-1792000000-${String(n).padStart(24, '0')}`, stamp: 's', level: 'l1', mode: 'steady' as const, maths: true, inputs: '1x100' });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

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

  it('keeps it for later when the server is away, a break is needed, or it is busy', async () => {
    enqueueRun(ME, report(1));
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await flushRuns(ME)).toBe(false);
    expect(outcomeOf(report(1).seed)).toBe('waiting');
    fetchMock.mockResolvedValue(json({}, 429));
    expect(await flushRuns(ME)).toBe(false);
    expect(outcomeOf(report(1).seed)).toBe('break');
    fetchMock.mockResolvedValue(json({}, 503));
    expect(await flushRuns(ME)).toBe(false);
    expect(outcomeOf(report(1).seed)).toBe('waiting');
    expect(queuedRuns(ME)).toHaveLength(1);
  });

  it('keeps one queue per pupil', () => {
    enqueueRun(ME, report(1));
    expect(queuedRuns('someone-else')).toHaveLength(0);
  });
});
