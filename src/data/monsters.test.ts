import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveItem } from '../../shared/monsters/save/check';
import { Session } from '../../shared/monsters/save/testKit';

const rpc = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) },
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

import { nzDay } from '../../shared/monsters/world/battleCap';
import { enqueueSave, flushQueue, loadMonsters, queuedSaves, readTail, savingStopped, writeBattleCount, writeTail } from './monsters';

const fetchMock = vi.fn<typeof fetch>();
let ME = '';

function items(n: number): SaveItem[] {
  const s = new Session();
  const out = [s.save()];
  for (let i = 1; i < n; i++) {
    s.walk(20);
    out.push(s.save());
  }
  return out;
}
const reply = (handled: number, results: object[] = []) => new Response(JSON.stringify({ handled, results }));
const sent = (call: number) => JSON.parse(fetchMock.mock.calls[call][1]!.body as string).items as SaveItem[];

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  rpc.mockReset();
  ME = crypto.randomUUID();
});

describe('the Maths Monsters save queue', () => {
  it('keeps every save when offline, on the device, and sends them in order later', async () => {
    const [a, b] = items(2);
    enqueueSave(ME, a);
    enqueueSave(ME, b);
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect(await flushQueue(ME)).toBe('later');
    expect(queuedSaves(ME)).toEqual([a, b]);
    expect(JSON.parse(localStorage.getItem(`sgh-monsters-queue:${ME}`)!)).toHaveLength(2);
    fetchMock.mockResolvedValueOnce(reply(2, [{ type: 'save', status: 'saved', version: 1, points: null }, { type: 'save', status: 'saved', version: 2, points: null }]));
    expect(await flushQueue(ME)).toBe('done');
    expect(sent(1).map((i) => i.seq)).toEqual([1, 2]);
    expect(queuedSaves(ME)).toEqual([]);
  });

  it('keeps what the server has not dealt with yet', async () => {
    const [a, b] = items(2);
    enqueueSave(ME, a);
    enqueueSave(ME, b);
    fetchMock.mockResolvedValueOnce(reply(1, [{ type: 'save', status: 'saved', version: 1, points: null }]));
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 503 }));
    expect(await flushQueue(ME)).toBe('later');
    expect(queuedSaves(ME)).toEqual([b]);
  });

  it('keeps the queue when the game is switched off or the server is busy', async () => {
    enqueueSave(ME, items(1)[0]);
    fetchMock.mockResolvedValueOnce(new Response('{"error":"off"}', { status: 503 }));
    expect(await flushQueue(ME)).toBe('later');
    expect(queuedSaves(ME)).toHaveLength(1);
  });

  it('a refusal throws the queue and the unsent tail away, and stops saving until the game is opened again', async () => {
    const [a] = items(1);
    enqueueSave(ME, a);
    writeTail(ME, { base: 1, world: a.world, battles: [] });
    fetchMock.mockResolvedValueOnce(reply(1, [{ type: 'refused', problem: 'pool-mismatch' }]));
    expect(await flushQueue(ME)).toBe('refused');
    expect(queuedSaves(ME)).toEqual([]);
    expect(readTail(ME)).toBeNull();
    expect(savingStopped(ME)).toBe(true);
    enqueueSave(ME, a);
    expect(queuedSaves(ME)).toEqual([]);
    // Opening the game again lifts it.
    rpc.mockResolvedValueOnce({ data: { save: null, settings: { enabled: true, topics: [] }, facts: [] }, error: null });
    await loadMonsters(ME);
    expect(savingStopped(ME)).toBe(false);
  });

  it('sends a long queue in more than one request', async () => {
    for (const item of items(30)) enqueueSave(ME, item);
    fetchMock.mockImplementation(async (_u, init) => {
      const n = (JSON.parse(init!.body as string).items as unknown[]).length;
      return reply(n, []);
    });
    expect(await flushQueue(ME)).toBe('done');
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    expect(sent(0).length).toBeLessThanOrEqual(12);
  });
});

describe('opening the game', () => {
  const world = items(1)[0].world;
  const server = (version: number | null) => ({
    data: { save: version === null ? null : { world: { ...world, steps: 111 }, version }, settings: { enabled: true, topics: ['add-sub'] }, facts: [] },
    error: null,
  });

  it('uses the server save when this device has nothing', async () => {
    rpc.mockResolvedValueOnce(server(3));
    const loaded = await loadMonsters(ME);
    expect(loaded.tail?.world.steps).toBe(111);
    expect(loaded.tail?.base).toBe(3);
    expect(loaded.settings.topics).toEqual(['add-sub']);
    expect(loaded.offline).toBe(false);
  });

  it('is a new game when neither has a save', async () => {
    rpc.mockResolvedValueOnce(server(null));
    expect((await loadMonsters(ME)).tail).toBeNull();
  });

  it('carries on from this device when it is ahead of the server (it played on since the last save)', async () => {
    writeTail(ME, { base: 3, world: { ...world, steps: 500 }, battles: [] });
    rpc.mockResolvedValueOnce(server(3));
    const loaded = await loadMonsters(ME);
    expect(loaded.tail?.world.steps).toBe(500);
  });

  it('uses the server save when another Chromebook has saved since', async () => {
    writeTail(ME, { base: 3, world: { ...world, steps: 500 }, battles: [] });
    rpc.mockResolvedValueOnce(server(5));
    const loaded = await loadMonsters(ME);
    expect(loaded.tail?.world.steps).toBe(111);
    expect(loaded.tail?.base).toBe(5);
    expect(readTail(ME)?.base).toBe(5);
  });

  it('opens from the device when the server cannot be reached', async () => {
    writeTail(ME, { base: 2, world: { ...world, steps: 321 }, battles: [] });
    rpc.mockRejectedValueOnce(new Error('offline'));
    const loaded = await loadMonsters(ME);
    expect(loaded.offline).toBe(true);
    expect(loaded.tail?.world.steps).toBe(321);
  });

  it('drops queued saves that are older than the server save it uses', async () => {
    const [a, b] = items(2);
    enqueueSave(ME, a);
    enqueueSave(ME, b);
    fetchMock.mockRejectedValue(new TypeError('offline'));
    rpc.mockResolvedValueOnce(server(1));
    await loadMonsters(ME);
    expect(queuedSaves(ME).map((i) => i.seq)).toEqual([2]);
  });

  it('counts today’s battles: the server’s, plus the unsaved ones on this device, never fewer than this device counted', async () => {
    const today = nzDay(Date.now());
    const fought = { map: 'kauri-bush', steps: [{ action: { kind: 'fight' }, q: { at: Date.now() }, randoms: [] }] };
    writeTail(ME, { base: 3, world, battles: [fought, { ...fought, map: 'tower-1-top' }] as never });
    rpc.mockResolvedValueOnce({ ...server(3), data: { ...server(3).data, battles: { today: 5, perDay: 12 } } });
    expect((await loadMonsters(ME)).battles).toEqual({ day: today, today: 6, perDay: 12 });
    // Before the database knows about the limit: the game's own number, and nothing counted on the server.
    rpc.mockResolvedValueOnce(server(9));
    expect((await loadMonsters(ME)).battles).toEqual({ day: today, today: 0, perDay: 12 });
    writeBattleCount(ME, today, 10);
    rpc.mockResolvedValueOnce(server(9));
    expect((await loadMonsters(ME)).battles.today).toBe(10);
    writeBattleCount(ME, '2000-01-01', 50);
    rpc.mockRejectedValueOnce(new Error('offline'));
    expect((await loadMonsters(ME)).battles).toEqual({ day: today, today: 0, perDay: 12 });
  });
});
