import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) },
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

import { enqueueRun, flushRuns, loadBoard, loadGhost, loadServerBests, queuedRuns, startRun } from './marble';

const fetchMock = vi.fn<typeof fetch>();
let ME = '';
const report = (n: number) => ({ seed: `m1-1792000000-${String(n).padStart(24, '0')}`, stamp: 's', course: 'boulder-beach', mode: 'up' as const, inputs: '1x100' });
const sentBody = (call: number) => JSON.parse(fetchMock.mock.calls[call][1]!.body as string);

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  rpc.mockReset();
  ME = crypto.randomUUID();
});

describe('the marble save queue', () => {
  it('asks for a seed', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ seed: 'a', stamp: 'b' })));
    expect(await startRun('boulder-beach', 'up')).toEqual({ seed: 'a', stamp: 'b' });
    expect(sentBody(0)).toEqual({ action: 'start', course: 'boulder-beach', mode: 'up' });
  });

  it('gives no seed when the server can’t be reached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await startRun('boulder-beach', 'up')).toBeNull();
    fetchMock.mockResolvedValue(new Response('{}', { status: 500 }));
    expect(await startRun('boulder-beach', 'up')).toBeNull();
  });

  it('sends queued runs one at a time and forgets the ones that got through', async () => {
    enqueueRun(ME, report(1));
    enqueueRun(ME, report(2));
    fetchMock.mockImplementation(async () => new Response('{"result":"best"}'));
    expect(await flushRuns(ME)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentBody(0)).toMatchObject({ action: 'save', course: 'boulder-beach', inputs: '1x100' });
    expect(queuedRuns(ME)).toEqual([]);
  });

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

  it('drops a run the server will never take', async () => {
    enqueueRun(ME, report(1));
    fetchMock.mockResolvedValue(new Response('{}', { status: 400 }));
    expect(await flushRuns(ME)).toBe(true);
    expect(queuedRuns(ME)).toEqual([]);
  });

  it('queues the same seed once, and keeps only the newest runs', () => {
    enqueueRun(ME, report(1));
    enqueueRun(ME, report(1));
    expect(queuedRuns(ME)).toHaveLength(1);
    for (let i = 2; i < 30; i++) enqueueRun(ME, report(i));
    expect(queuedRuns(ME)).toHaveLength(12);
    expect(queuedRuns(ME)[11].seed).toBe(report(29).seed);
  });
});

describe('loading the server’s bests', () => {
  it('turns the rows into bests, leaving out maths runs', async () => {
    rpc.mockResolvedValue({
      error: null,
      data: [
        { course: 'a', mode: 'up', maths: false, steps: 300, falls: 0 },
        { course: 'a', mode: 'down', maths: false, steps: 400, falls: 1 },
        { course: 'a', mode: 'up', maths: true, steps: 100, falls: 0 },
      ],
    });
    expect(await loadServerBests()).toEqual({ a: { up: 300, down: 400 } });
  });
  it('gives null when it can’t be reached', async () => {
    rpc.mockResolvedValue({ error: { message: 'no' }, data: null });
    expect(await loadServerBests()).toBeNull();
    rpc.mockRejectedValue(new Error('offline'));
    expect(await loadServerBests()).toBeNull();
  });
});

describe('ghosts and boards', () => {
  it('asks for a ghost without maths and hands back its inputs', async () => {
    rpc.mockResolvedValue({ data: { name: 'Quick Kea', steps: 900, inputs: '3x60' }, error: null });
    expect(await loadGhost('boulder-beach', 'up', 'next')).toEqual({ name: 'Quick Kea', steps: 900, inputs: '3x60' });
    expect(rpc).toHaveBeenCalledWith('marble_ghost', { in_course: 'boulder-beach', in_mode: 'up', in_maths: false, which: 'next' });
  });

  it('gives no ghost when there is none, it is odd, or the server fails', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await loadGhost('a', 'up', 'top')).toBeNull();
    rpc.mockResolvedValue({ data: { name: 1 }, error: null });
    expect(await loadGhost('a', 'up', 'top')).toBeNull();
    rpc.mockRejectedValue(new Error('offline'));
    expect(await loadGhost('a', 'up', 'top')).toBeNull();
  });

  it('loads a board, or null', async () => {
    const board = { top: [{ rank: 1, name: 'Quick Kea', avatar: null, steps: 900, me: false }], me: null, total: 1 };
    rpc.mockResolvedValue({ data: board, error: null });
    expect(await loadBoard('boulder-beach', 'down')).toEqual(board);
    expect(rpc).toHaveBeenCalledWith('marble_board', { in_course: 'boulder-beach', in_mode: 'down', in_maths: false });
    rpc.mockResolvedValue({ data: null, error: { message: 'x' } });
    expect(await loadBoard('boulder-beach', 'up')).toBeNull();
  });
});
