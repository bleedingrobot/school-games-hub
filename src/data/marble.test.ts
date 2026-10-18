import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) },
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

import { answerQuestion, enqueueRun, fetchMarbleSwitches, flushRuns, loadBoard, loadGhost, loadServerBests, queuedRuns, startRun } from './marble';

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
  it('asks for a seed, with whether the student wants maths, and reads the setup it gets back', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ seed: 'a', stamp: 'b', maths: true, rescue: true, doors: [1, 'x'], gates: [{ slot: 0, labels: ['5', '6'], arrow: null, question: null }], pits: [], rescues: [] })));
    expect(await startRun('boulder-beach', 'up', true)).toEqual({
      seed: 'a', stamp: 'b', maths: true, rescue: true, doors: [1], gates: [{ slot: 0, labels: ['5', '6'], arrow: null, question: null }], pits: [], rescues: [],
    });
    expect(sentBody(0)).toEqual({ action: 'start', course: 'boulder-beach', mode: 'up', maths: true });
  });

  it('takes a start with no maths', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ seed: 'a', stamp: 'b', maths: false, doors: [0], gates: [] })));
    const started = await startRun('boulder-beach', 'up');
    expect(started).toMatchObject({ maths: false, rescue: false, doors: [0], pits: [], rescues: [] });
    expect(sentBody(0).maths).toBe(false);
  });

  it('turns away a start it can’t read', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ seed: 'a', stamp: 'b' })));
    expect(await startRun('boulder-beach', 'up')).toBeNull();
  });

  it('sends an answer for marking and hands back the mark', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ right: true, answer: 56 })));
    expect(await answerQuestion({ seed: 'a', stamp: 'b' }, 'boulder-beach', 'up', 3, 56, 1200)).toEqual({ right: true, answer: 56 });
    expect(sentBody(0)).toEqual({ action: 'answer', seed: 'a', stamp: 'b', course: 'boulder-beach', mode: 'up', slot: 3, answer: 56, ms: 1200 });
    fetchMock.mockResolvedValue(new Response('{}', { status: 400 }));
    expect(await answerQuestion({ seed: 'a', stamp: 'b' }, 'boulder-beach', 'up', 3, 56, 1200)).toBeNull();
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await answerQuestion({ seed: 'a', stamp: 'b' }, 'boulder-beach', 'up', 3, 56, 1200)).toBeNull();
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
  it('can ask for the maths runs instead', async () => {
    rpc.mockResolvedValue({
      error: null,
      data: [
        { course: 'a', mode: 'up', maths: false, steps: 300, falls: 0 },
        { course: 'a', mode: 'up', maths: true, steps: 100, falls: 0 },
      ],
    });
    expect(await loadServerBests(true)).toEqual({ a: { up: 100 } });
  });
  it('gives null when it can’t be reached', async () => {
    rpc.mockResolvedValue({ error: { message: 'no' }, data: null });
    expect(await loadServerBests()).toBeNull();
    rpc.mockRejectedValue(new Error('offline'));
    expect(await loadServerBests()).toBeNull();
  });
});

describe('ghosts and boards', () => {
  it('asks for a ghost without maths and hands back its inputs and the doors it ran with', async () => {
    rpc.mockResolvedValue({ data: { name: 'Quick Kea', steps: 900, inputs: '3x60', doors: 5 }, error: null });
    expect(await loadGhost('boulder-beach', 'up', 'next')).toEqual({ name: 'Quick Kea', steps: 900, inputs: '3x60', doors: [0, 2] });
    expect(rpc).toHaveBeenCalledWith('marble_ghost', { in_course: 'boulder-beach', in_mode: 'up', in_maths: false, which: 'next' });
  });

  it('asks for a with-maths ghost and board when told to', async () => {
    rpc.mockResolvedValue({ data: { name: 'Quick Kea', steps: 900, inputs: '3x60' }, error: null });
    expect((await loadGhost('boulder-beach', 'up', 'top', true))?.doors).toEqual([]);
    expect(rpc).toHaveBeenCalledWith('marble_ghost', { in_course: 'boulder-beach', in_mode: 'up', in_maths: true, which: 'top' });
    rpc.mockResolvedValue({ data: { top: [], me: null, total: 0 }, error: null });
    await loadBoard('boulder-beach', 'up', true);
    expect(rpc).toHaveBeenCalledWith('marble_board', { in_course: 'boulder-beach', in_mode: 'up', in_maths: true });
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

describe('the teacher’s maths switches', () => {
  it('reads them from the student’s own settings row', async () => {
    const select = vi.fn(() => ({ maybeSingle: async () => ({ data: { marble_maths: 'on', marble_rescue: false }, error: null }) }));
    const from = vi.fn(() => ({ select }));
    const mod = await import('../lib/supabase');
    (mod.supabase as unknown as { from: typeof from }).from = from;
    expect(await fetchMarbleSwitches()).toEqual({ maths: 'on', rescue: false });
    expect(select).toHaveBeenCalledWith('marble_maths, marble_rescue');
  });
  it('keeps maths off when they can’t be read, or say something odd', async () => {
    const mod = await import('../lib/supabase');
    (mod.supabase as unknown as { from: unknown }).from = () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'no' } }) }) });
    expect(await fetchMarbleSwitches()).toEqual({ maths: 'off', rescue: true });
    (mod.supabase as unknown as { from: unknown }).from = () => ({ select: () => ({ maybeSingle: async () => ({ data: { marble_maths: 'yes please' }, error: null }) }) });
    expect((await fetchMarbleSwitches()).maths).toBe('off');
  });
});
