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
  answerQuestion, bestKey, enqueueRun, fetchMineMaths, flushRuns, forgetOutcomes, loadBoard, loadServerBests, outcomeOf, queuedRuns, saveMineMaths, startRun,
} from './mine';

const fetchMock = vi.fn<typeof fetch>();
let ME = '';
const report = (n: number) => ({ seed: `n1-1792000000-${String(n).padStart(24, '0')}`, stamp: 's', level: 'l1', mode: 'steady' as const, maths: true, inputs: '1x100' });
const sentBody = (call: number) => JSON.parse(fetchMock.mock.calls[call][1]!.body as string);
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

describe('starting a dive', () => {
  it('asks for a seed, with the mine, the flight and whether it has maths, and reads what it gets back', async () => {
    fetchMock.mockResolvedValue(json({ seed: 'a', stamp: 'b', maths: true, questions: [{ slot: 0, parts: ['2', '+', '3', '=', '?'], spoken: 'x' }] }));
    const result = await startRun('l2', 'free', true);
    expect(result).toEqual({ ok: true, run: { seed: 'a', stamp: 'b', maths: true, questions: [{ slot: 0, parts: ['2', '+', '3', '=', '?'], spoken: 'x' }] } });
    expect(sentBody(0)).toEqual({ action: 'start', level: 'l2', mode: 'free', maths: true });
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/functions\/v1\/mine$/);
  });

  it('is “offline” when the server can’t be reached, answers badly, or sends something it can’t read', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await startRun('l1', 'steady', false)).toMatchObject({ ok: false, reason: 'offline' });
    fetchMock.mockResolvedValue(json({ error: 'x' }, 503));
    expect(await startRun('l1', 'steady', false)).toMatchObject({ ok: false, reason: 'offline' });
    fetchMock.mockResolvedValue(json({ seed: 'a', stamp: 'b' }));
    expect(await startRun('l1', 'steady', false)).toMatchObject({ ok: false, reason: 'offline' });
  });

  it('passes on the server’s plain words when maths is off or on for the class, or a break is needed', async () => {
    fetchMock.mockResolvedValue(json({ error: 'Maths is switched off for your class.', code: 'maths-off' }, 403));
    expect(await startRun('l1', 'steady', true)).toEqual({ ok: false, reason: 'maths-off', message: 'Maths is switched off for your class.' });
    fetchMock.mockResolvedValue(json({ error: 'Your teacher has switched maths on.', code: 'maths-on' }, 403));
    expect(await startRun('l1', 'steady', false)).toMatchObject({ ok: false, reason: 'maths-on' });
    fetchMock.mockResolvedValue(json({ error: 'Have a break.', code: 'too-many' }, 429));
    expect(await startRun('l1', 'steady', false)).toEqual({ ok: false, reason: 'too-many', message: 'Have a break.' });
  });
});

describe('answers', () => {
  it('sends an answer for marking and hands back the mark', async () => {
    fetchMock.mockResolvedValue(json({ correct: true, answer: 56 }));
    expect(await answerQuestion({ seed: 'a', stamp: 'b' }, 'l2', 'steady', 3, 56, 1200)).toEqual({ correct: true, answer: 56 });
    expect(sentBody(0)).toEqual({ action: 'answer', seed: 'a', stamp: 'b', level: 'l2', mode: 'steady', slot: 3, value: 56, ms: 1200 });
  });

  it('says so, in friendly words, when it can’t be marked, so the box lets the pupil try again', async () => {
    fetchMock.mockResolvedValue(json({}, 400));
    await expect(answerQuestion({ seed: 'a', stamp: 'b' }, 'l2', 'steady', 3, 56, 1200)).rejects.toThrow(/reach the school/);
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(answerQuestion({ seed: 'a', stamp: 'b' }, 'l2', 'steady', 3, 56, 1200)).rejects.toThrow(/reach the school/);
    fetchMock.mockResolvedValue(json({ correct: 'yes' }));
    await expect(answerQuestion({ seed: 'a', stamp: 'b' }, 'l2', 'steady', 3, 56, 1200)).rejects.toThrow(/couldn’t check/);
  });
});

describe('the finished-run queue', () => {
  it('keeps a run until it is sent, then drops it', async () => {
    enqueueRun(ME, report(1));
    expect(queuedRuns(ME)).toHaveLength(1);
    fetchMock.mockResolvedValue(json({ result: 'best' }));
    expect(await flushRuns(ME)).toBe(true);
    expect(sentBody(0)).toEqual({ action: 'finish', ...report(1) });
    expect(queuedRuns(ME)).toHaveLength(0);
    expect(outcomeOf(report(1).seed)).toBe('saved');
  });

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

  it('drops a run the server will never take (a 400)', async () => {
    enqueueRun(ME, report(1));
    fetchMock.mockResolvedValue(json({}, 400));
    expect(await flushRuns(ME)).toBe(true);
    expect(queuedRuns(ME)).toHaveLength(0);
    expect(outcomeOf(report(1).seed)).toBe('refused');
  });

  it('sends several runs one at a time, oldest first, and keeps only the newest eight', async () => {
    for (let n = 1; n <= 10; n++) enqueueRun(ME, report(n));
    expect(queuedRuns(ME)).toHaveLength(8);
    expect(queuedRuns(ME)[0].seed).toBe(report(3).seed);
    fetchMock.mockImplementation(async () => json({ result: 'saved' }));
    expect(await flushRuns(ME)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(8);
    expect(sentBody(0).seed).toBe(report(3).seed);
  });

  it('counts a run once if it is queued twice', () => {
    enqueueRun(ME, report(1));
    enqueueRun(ME, report(1));
    expect(queuedRuns(ME)).toHaveLength(1);
  });

  it('keeps one queue per pupil', () => {
    enqueueRun(ME, report(1));
    expect(queuedRuns('someone-else')).toHaveLength(0);
  });
});

describe('bests, boards and the teacher’s switch', () => {
  it('reads the pupil’s saved bests for each mine and maths choice', async () => {
    rpc.mockResolvedValue({ data: [{ level: 'l1', maths: true, steps: 2700 }, { level: 'l1:hard', maths: false, steps: 3000 }], error: null });
    expect(await loadServerBests()).toEqual({ [bestKey('l1', true)]: 2700, [bestKey('l1:hard', false)]: 3000 });
    rpc.mockResolvedValue({ data: null, error: { code: 'x' } });
    expect(await loadServerBests()).toBeNull();
  });

  it('reads the board for a mine and maths choice, or null', async () => {
    const board = { top: [{ rank: 1, name: 'Ana', avatar: null, steps: 100, me: false }], me: null, total: 1 };
    rpc.mockResolvedValue({ data: board, error: null });
    expect(await loadBoard('l3:hard', true)).toEqual(board);
    expect(rpc).toHaveBeenCalledWith('mine_board', { in_level: 'l3:hard', in_maths: true });
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await loadBoard('l3', false)).toBeNull();
    rpc.mockRejectedValue(new Error('down'));
    expect(await loadBoard('l3', false)).toBeNull();
  });

  it('saves the teacher’s maths switch, and says why when it can’t', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await saveMineMaths('on', 'class-1');
    expect(rpc).toHaveBeenCalledWith('teacher_set_mine_maths', { mode: 'on', target_class: 'class-1' });
    rpc.mockResolvedValue({ data: null, error: { code: '42501' } });
    await expect(saveMineMaths('off')).rejects.toThrow(/couldn’t change/);
  });

  it('reads the switch for a class, and counts anything odd as off', async () => {
    rpc.mockResolvedValue({ data: { mine_maths: 'choose' }, error: null });
    expect(await fetchMineMaths('class-1')).toBe('choose');
    rpc.mockResolvedValue({ data: { mine_maths: 'banana' }, error: null });
    expect(await fetchMineMaths('class-2')).toBe('off');
    rpc.mockResolvedValue({ data: null, error: { code: 'x' } });
    expect(await fetchMineMaths('class-3')).toBe('off');
  });
});
