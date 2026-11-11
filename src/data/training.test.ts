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

import { addAnswer, flushQueue, loadTraining, queuedItems, sealPending} from './training';

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

  it('does not count an answer twice when the server has it and it is still in the queue', async () => {
    const { state, events, saved } = played(9);
    for (const e of events) addAnswer(ME, e);
    sealPending(ME); // the server got the batch but the reply was lost
    rpc.mockResolvedValue(server(saved));
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const loaded = await loadTraining(ME);
    expect(loaded.state.records).toEqual(state.records);
  });
});

