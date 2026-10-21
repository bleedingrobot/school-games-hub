import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FACT_BY_KEY } from '../../shared/training/facts';
import { emptyState, recordAnswer, recordTyping } from '../../shared/training/records';
import type { AnswerEvent, SaveItem } from '../../shared/training/save';

const rpc = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) },
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

import { addAnswer, enqueueStudent, flushQueue, loadTraining, pendingAnswers, quickFrom, queuedItems, sealPending, stateFrom, unsavedAnswers } from './training';

const fetchMock = vi.fn<typeof fetch>();
// A new student each test, so no queue carries over (the queue is also kept in memory).
let ME = '';
let clock = 0;

const answerEvent = (key = 'mul:6x7', over: Partial<AnswerEvent> = {}): AnswerEvent => ({
  key, given: FACT_BY_KEY.get(key)!.answer, ms: 2000, typingMs: 800, at: 1_792_000_000_000 + ++clock * 5000, day: '2026-10-19', seed: 11, ...over,
});

const reply = (handled: number) => new Response(JSON.stringify({ handled, results: [] }));
const sentItems = (call: number) => JSON.parse(fetchMock.mock.calls[call][1]!.body as string).items as SaveItem[];
const answersOf = (item: SaveItem) => (item.type === 'answers' ? item.answers : []);

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  rpc.mockReset();
  ME = crypto.randomUUID();
});

describe('the training save queue', () => {
  it('keeps answers waiting until they are sent, then seals them into a batch with an id', () => {
    addAnswer(ME, answerEvent());
    addAnswer(ME, answerEvent('mul:2x5'));
    expect(pendingAnswers(ME)).toHaveLength(2);
    expect(queuedItems(ME)).toEqual([]);
    sealPending(ME);
    expect(pendingAnswers(ME)).toEqual([]);
    const [batch] = queuedItems(ME);
    expect(batch).toMatchObject({ type: 'answers', seed: 11 });
    expect(answersOf(batch)).toHaveLength(2);
    expect((batch as { batchId: string }).batchId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('makes a new batch for each session (seed), and splits very long ones', () => {
    for (let i = 0; i < 3; i++) addAnswer(ME, answerEvent('mul:6x7', { seed: 1 }));
    for (let i = 0; i < 2; i++) addAnswer(ME, answerEvent('mul:6x7', { seed: 2 }));
    sealPending(ME);
    expect(queuedItems(ME).map((i) => (i.type === 'answers' ? [i.seed, i.answers.length] : null))).toEqual([[1, 3], [2, 2]]);
    const long = crypto.randomUUID();
    for (let i = 0; i < 70; i++) addAnswer(long, answerEvent());
    sealPending(long);
    expect(queuedItems(long).map((i) => answersOf(i).length)).toEqual([60, 10]);
  });

  it('sends the queue and then has nothing left', async () => {
    addAnswer(ME, answerEvent());
    fetchMock.mockResolvedValueOnce(reply(1));
    expect(await flushQueue(ME)).toBe(true);
    expect(queuedItems(ME)).toEqual([]);
    expect(pendingAnswers(ME)).toEqual([]);
    expect(sentItems(0)).toHaveLength(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/functions/v1/training');
  });

  it('keeps everything when offline, and sends it later without losing or doubling anything', async () => {
    addAnswer(ME, answerEvent());
    addAnswer(ME, answerEvent('mul:2x5'));
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect(await flushQueue(ME)).toBe(false);
    expect(queuedItems(ME)).toHaveLength(1);
    addAnswer(ME, answerEvent('mul:3x4')); // more answers while offline
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect(await flushQueue(ME)).toBe(false);
    fetchMock.mockResolvedValueOnce(reply(2));
    expect(await flushQueue(ME)).toBe(true);
    expect(queuedItems(ME)).toEqual([]);
    // Two batches, and the first one went out again with the very same id (so it is counted once).
    const last = sentItems(2);
    expect(last).toHaveLength(2);
    expect((last[0] as { batchId: string }).batchId).toBe((sentItems(0)[0] as { batchId: string }).batchId);
    expect(last.flatMap(answersOf).map((a) => a.key)).toEqual(['mul:6x7', 'mul:2x5', 'mul:3x4']);
  });

  it('sends a batch again with the same id when the reply was lost', async () => {
    addAnswer(ME, answerEvent());
    fetchMock.mockResolvedValueOnce(new Response('oops', { status: 503 }));
    expect(await flushQueue(ME)).toBe(false);
    fetchMock.mockResolvedValueOnce(reply(1));
    expect(await flushQueue(ME)).toBe(true);
    expect(JSON.stringify(sentItems(1))).toBe(JSON.stringify(sentItems(0)));
  });

  it('drops what the server dealt with and keeps the rest', async () => {
    for (let i = 0; i < 3; i++) {
      addAnswer(ME, answerEvent('mul:6x7', { seed: i }));
    }
    fetchMock.mockResolvedValueOnce(reply(1));
    fetchMock.mockResolvedValueOnce(reply(0)); // nothing handled: stop and try later
    expect(await flushQueue(ME)).toBe(false);
    expect(queuedItems(ME)).toHaveLength(2);
  });

  it('keeps only the newest typing times and settings', () => {
    enqueueStudent(ME, { type: 'student', typing: { 2: [900] }, autoSubmit: true, sessionsDone: 1 });
    addAnswer(ME, answerEvent());
    sealPending(ME);
    enqueueStudent(ME, { type: 'student', typing: { 2: [900, 950] }, autoSubmit: false, sessionsDone: 2 });
    const items = queuedItems(ME);
    expect(items.map((i) => i.type)).toEqual(['answers', 'student']);
    expect(items[1]).toMatchObject({ autoSubmit: false, sessionsDone: 2 });
  });

  it('still works when browser storage is blocked', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      addAnswer(ME, answerEvent());
      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      expect(await flushQueue(ME)).toBe(false);
      expect(queuedItems(ME)).toHaveLength(1);
      fetchMock.mockResolvedValueOnce(reply(1));
      expect(await flushQueue(ME)).toBe(true);
      expect(queuedItems(ME)).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });

  it('does not send when nobody is signed in', async () => {
    addAnswer(ME, answerEvent());
    // The queue is kept, nothing is sent.
    const { supabase } = await import('../lib/supabase');
    const original = supabase.auth.getSession;
    (supabase.auth as { getSession: unknown }).getSession = async () => ({ data: { session: null } });
    try {
      expect(await flushQueue(ME)).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(queuedItems(ME)).toHaveLength(1);
    } finally {
      (supabase.auth as { getSession: unknown }).getSession = original;
    }
  });
});

describe('loading training', () => {
  /** Plays answers live and returns what the server would hold for them. */
  function played(n: number) {
    let state = recordTyping(emptyState(), 2, 800);
    const events: AnswerEvent[] = [];
    for (let i = 0; i < n; i++) {
      const key = ['mul:6x7', 'mul:2x5', 'mul:3x4'][i % 3];
      const fact = FACT_BY_KEY.get(key)!;
      const e = answerEvent(key, { given: i % 4 === 3 ? fact.answer + 1 : fact.answer, ms: 900 + i * 700, typingMs: 800 });
      state = recordAnswer(state, key, e.given, fact.answer, e.ms, e.day).state;
      events.push(e);
    }
    const saved = events.map((e) => ({ key: e.key, correct: e.given === FACT_BY_KEY.get(e.key)!.answer, ms: e.ms, typingMs: e.typingMs, day: e.day, at: e.at }));
    return { state, events, saved };
  }
  const server = (saved: unknown[], student: unknown = { typing: { 2: [800] }, autoSubmit: true, sessionsDone: 1 }) => ({ data: { answers: saved, student }, error: null });

  it('shows the same records on another device after loading', async () => {
    const { state, saved } = played(9);
    rpc.mockResolvedValue(server(saved));
    const { state: other, offline } = await loadTraining(crypto.randomUUID());
    expect(offline).toBe(false);
    expect(other.records).toEqual(state.records);
  });

  it('sends what was waiting before it loads, so an offline session shows after the queue sends', async () => {
    const { state, events, saved } = played(9);
    for (const e of events) addAnswer(ME, e);
    fetchMock.mockResolvedValueOnce(reply(1));
    // Once the queue has been sent, the server has everything.
    rpc.mockImplementation(async () => server(saved));
    const loaded = await loadTraining(ME);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(queuedItems(ME)).toEqual([]);
    expect(loaded.state.records).toEqual(state.records);
  });

  it('adds answers not saved yet (offline) on top of what the server has', async () => {
    const { state, events, saved } = played(9);
    rpc.mockResolvedValue(server(saved.slice(0, 6)));
    for (const e of events.slice(6)) addAnswer(ME, e);
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const loaded = await loadTraining(ME);
    expect(loaded.state.records).toEqual(state.records);
  });

  it('does not count an answer twice when the server has it and it is still in the queue', async () => {
    const { state, events, saved } = played(9);
    for (const e of events) addAnswer(ME, e);
    sealPending(ME); // the server got the batch but the reply was lost
    rpc.mockResolvedValue(server(saved));
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const loaded = await loadTraining(ME);
    expect(loaded.state.records).toEqual(state.records);
  });

  it('opens from the copy kept in the browser when the server cannot be reached, with unsaved answers on top', async () => {
    const { state, events, saved } = played(9);
    rpc.mockResolvedValueOnce(server(saved.slice(0, 5)));
    await loadTraining(ME);
    for (const e of events.slice(5)) addAnswer(ME, e);
    rpc.mockRejectedValue(new Error('offline'));
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const loaded = await loadTraining(ME);
    expect(loaded.offline).toBe(true);
    expect(loaded.state.records).toEqual(state.records);
  });

  it('keeps answers that were saved after the last load in the copy for the next offline open', async () => {
    const { state, events, saved } = played(9);
    rpc.mockResolvedValueOnce(server(saved.slice(0, 5)));
    await loadTraining(ME);
    for (const e of events.slice(5)) addAnswer(ME, e);
    fetchMock.mockResolvedValueOnce(reply(1));
    expect(await flushQueue(ME)).toBe(true);
    rpc.mockRejectedValue(new Error('offline'));
    const loaded = await loadTraining(ME);
    expect(loaded.offline).toBe(true);
    expect(loaded.state.records).toEqual(state.records);
  });

  it('starts fresh the very first time, even offline', async () => {
    rpc.mockRejectedValue(new Error('offline'));
    const loaded = await loadTraining(ME);
    expect(loaded.offline).toBe(true);
    expect(loaded.state).toEqual(emptyState());
  });

  it('uses typing times and settings still waiting to be saved', async () => {
    rpc.mockResolvedValue(server([], { typing: { 2: [800] }, autoSubmit: true, sessionsDone: 1 }));
    enqueueStudent(ME, { type: 'student', typing: { 2: [800, 1200] }, autoSubmit: false, sessionsDone: 2 });
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const { state } = await loadTraining(ME);
    expect([state.typing[2], state.autoSubmit, state.sessionsDone]).toEqual([[800, 1200], false, 2]);
  });

  it('marks unsaved answers from the real fact', () => {
    addAnswer(ME, answerEvent('mul:6x7', { given: 41 }));
    expect(unsavedAnswers(ME)[0].correct).toBe(false);
    expect(stateFrom(ME, null).records['mul:6x7'].answers[0].correct).toBe(false);
  });
});


describe('Quick looks answers in the same queue', () => {
  const quickEvent = (key: string, given: number, over: Partial<AnswerEvent> = {}): AnswerEvent => ({
    key, given, ms: 0, typingMs: 0, at: 1_792_000_000_000 + ++clock * 5000, day: '2026-10-19', seed: 21, ...over,
  });

  it('are marked from the key while waiting to be saved', () => {
    addAnswer(ME, quickEvent('sub:ten-8', 8));
    addAnswer(ME, quickEvent('sub:ten-8', 7));
    addAnswer(ME, quickEvent('gap:ten-7', 3));
    addAnswer(ME, quickEvent('subh:line-2', 2));
    expect(unsavedAnswers(ME).map((a) => a.correct)).toEqual([true, false, true, true]);
  });

  it('never change the times-table records, whether waiting or saved', () => {
    addAnswer(ME, answerEvent('mul:6x7'));
    const alone = stateFrom(ME, null);
    addAnswer(ME, quickEvent('sub:ten-8', 8));
    addAnswer(ME, quickEvent('gap:five-4', 1));
    expect(stateFrom(ME, null)).toEqual(alone);
    expect(Object.keys(stateFrom(ME, null).records)).toEqual(['mul:6x7']);
  });

  it('come back as Quick looks answers, saved and waiting together, none twice', () => {
    const saved = { key: 'sub:line-2', correct: true, ms: 0, typingMs: 0, day: '2026-10-19', at: 1_792_000_000_000 - 99_000 };
    addAnswer(ME, quickEvent('sub:dice-4', 4));
    addAnswer(ME, answerEvent('mul:6x7'));
    const { answers, settings } = quickFrom(ME, { answers: [saved], student: null });
    expect(answers.map((a) => a.key)).toEqual(['sub:line-2', 'sub:dice-4']);
    expect(settings).toBeNull();
  });

  it('keep the stage reached with the student, and never let it fall behind the answers', () => {
    const data = { answers: [], student: { typing: {}, autoSubmit: true, sessionsDone: 1, quick: { placed: true, startStage: 1, finished: 2, guided: false } } } as const;
    expect(quickFrom(ME, data as never).settings).toEqual({ placed: true, startStage: 1, finished: 2, guided: false });
    // Eight good answers in stage 3 on top of two finished stages finish it, even if the saved number is behind.
    const types = ['five', 'fiveplus', 'pair'];
    const at = 1_792_000_000_000;
    const answers = Array.from({ length: 8 }, (_, i) => ({ key: `sub:${types[i % 3]}-${types[i % 3] === 'fiveplus' ? 6 : 4}`, correct: true, ms: 0, typingMs: 0, day: '2026-10-19', at: at + i }));
    expect(quickFrom(ME, { ...data, answers } as never).settings?.finished).toBe(3);
  });

  it('send the settings to the server with the student, and open with them from the typing column', async () => {
    const settings = { placed: true, startStage: 2, finished: 1, guided: true };
    enqueueStudent(ME, { type: 'student', typing: { 2: [900] }, autoSubmit: true, sessionsDone: 1, quick: settings });
    fetchMock.mockResolvedValueOnce(reply(1));
    expect(await flushQueue(ME)).toBe(true);
    expect(sentItems(0)[0]).toMatchObject({ type: 'student', quick: settings, typing: { 2: [900] } });

    rpc.mockResolvedValueOnce({
      data: { answers: [], student: { typing: { 2: [900], q: { p: 1, s: 2, f: 1, g: 1 } }, autoSubmit: true, sessionsDone: 1 } },
      error: null,
    });
    const loaded = await loadTraining(ME);
    // Training only ever sees typing times, so its "first time" check isn't confused by the settings.
    expect(loaded.state.typing).toEqual({ 2: [900] });
    expect(loaded.quick.settings).toEqual(settings);
  });
});
