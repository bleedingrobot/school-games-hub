import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveItem } from '../../shared/gem-keep/save';

const rpc = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) },
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

import { enqueue, fetchClassGemKeep, flushQueue, loadGemKeep, queuedItems, TRIAL_KEY } from './gemKeep';

const fetchMock = vi.fn<typeof fetch>();
// A new student each test, so no queue carries over (the queue is also kept in memory).
let ME = '';

const run = (levelId = 'level-1'): SaveItem => ({
  type: 'run', runId: crypto.randomUUID(), levelId, result: 'won', stars: 3, waves: 8, gameSeconds: 500, asked: 20, right: 18,
});
const facts = (attempts: number): SaveItem => ({
  type: 'facts', pack: 'times-tables',
  facts: [{ key: 'mul:2x5', attempts, correct: attempts, avgMs: 2000, box: 2, lastSeen: 1, quickDays: [] }],
});

const answer = (handled: number) => new Response(JSON.stringify({ handled, results: [] }));
const sentItems = (call: number) => JSON.parse(fetchMock.mock.calls[call][1]!.body as string).items as SaveItem[];

const SERVER = {
  progress: [{ levelId: 'level-1', stars: 2, keyPassed: true }],
  facts: [],
  settings: { mode: 'challenge', enabledTables: [2, 5], division: false, missingFactor: null, multipleChoice: true, keyPassMark: 7 },
  canImport: true,
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  rpc.mockReset();
  ME = crypto.randomUUID();
});

describe('the Gem Keep save queue', () => {
  it('keeps only the newest fact records', () => {
    enqueue(ME, run());
    enqueue(ME, facts(3));
    enqueue(ME, facts(5));
    expect(queuedItems(ME).map((i) => i.type)).toEqual(['run', 'facts']);
    expect((queuedItems(ME)[1] as Extract<SaveItem, { type: 'facts' }>).facts[0].attempts).toBe(5);
  });

  it('drops what the server dealt with and keeps the rest', async () => {
    const first = run();
    const second = run('level-2');
    enqueue(ME, first);
    enqueue(ME, second);
    fetchMock.mockResolvedValueOnce(answer(1));
    expect(await flushQueue(ME)).toBe(false);
    expect(queuedItems(ME)).toEqual([second]);
    fetchMock.mockResolvedValueOnce(answer(1));
    expect(await flushQueue(ME)).toBe(true);
    expect(queuedItems(ME)).toEqual([]);
  });

  it('keeps everything when offline, and sends it later', async () => {
    enqueue(ME, run());
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect(await flushQueue(ME)).toBe(false);
    expect(queuedItems(ME)).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(`sgh-gem-keep-queue:${ME}`)!)).toHaveLength(1);
    fetchMock.mockResolvedValueOnce(answer(1));
    expect(await flushQueue(ME)).toBe(true);
  });

  it('keeps fact records that were replaced while a send was on its way', async () => {
    enqueue(ME, facts(3));
    let reply!: (r: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise((resolve) => (reply = resolve)));
    const sending = flushQueue(ME);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    enqueue(ME, facts(6));
    reply(answer(1));
    await sending;
    expect(queuedItems(ME)).toEqual([facts(6)]);
  });

  it('sends one request at a time', async () => {
    enqueue(ME, run());
    fetchMock.mockResolvedValue(answer(1));
    await Promise.all([flushQueue(ME), flushQueue(ME), flushQueue(ME)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('opening Gem Keep', () => {
  it('reads progress and the teacher’s settings from the server', async () => {
    rpc.mockResolvedValue({ data: { ...SERVER, canImport: false }, error: null });
    const loaded = await loadGemKeep(ME);
    expect(loaded.offline).toBe(false);
    expect(loaded.progress).toEqual({ 'level-1': { stars: 2, keyPassed: true } });
    expect(loaded.settings).toMatchObject({ mode: 'challenge', enabledTables: [2, 5], keyPassMark: 7, missingFactor: undefined });
  });

  it('brings in the class trial’s progress once, then clears it from the device', async () => {
    localStorage.setItem(TRIAL_KEY, JSON.stringify({ 'level-1': { stars: 3, keyPassed: true } }));
    rpc.mockResolvedValueOnce({ data: SERVER, error: null }).mockResolvedValueOnce({ data: { ...SERVER, canImport: false }, error: null });
    fetchMock.mockResolvedValueOnce(answer(1));
    await loadGemKeep(ME);
    expect(sentItems(0)).toEqual([{ type: 'import', levels: [{ levelId: 'level-1', stars: 3, keyPassed: true }] }]);
    expect(localStorage.getItem(TRIAL_KEY)).toBeNull();
  });

  it('opens with the copy kept in this browser when the server can’t be reached', async () => {
    rpc.mockResolvedValueOnce({ data: { ...SERVER, canImport: false }, error: null });
    await loadGemKeep(ME);
    rpc.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const loaded = await loadGemKeep(ME);
    expect(loaded.offline).toBe(true);
    expect(loaded.progress).toEqual({ 'level-1': { stars: 2, keyPassed: true } });
  });
});

describe('the teacher’s class report', () => {
  const REPORT = { players: 3, levels: [], hardest: [] };

  it('asks for the class', async () => {
    rpc.mockResolvedValueOnce({ data: REPORT, error: null });
    expect(await fetchClassGemKeep('c12')).toEqual({ ...REPORT});
    expect(rpc).toHaveBeenCalledWith('teacher_gem_keep_class', { target_class: 'c12' });
  });

  it('says so when the server refuses (a class the teacher doesn’t teach), and asks nothing else', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'That isn’t one of your classes.' } });
    await expect(fetchClassGemKeep('c99')).rejects.toThrow('We couldn’t load Gem Keep for this class.');
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
