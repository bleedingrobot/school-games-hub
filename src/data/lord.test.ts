import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LordReply, LordRequest, LordState } from '../../shared/lord/server';

const rpc = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) },
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

import { createServerBackend, enqueueFinish, fetchClassLord, fetchStudentLord, queuedFinishes, resetLordHero } from './lord';

const fetchMock = vi.fn<typeof fetch>();
let ME = '';

const state = (version: number, over: Partial<LordState> = {}): LordState => ({
  hero: null, version, today: '2026-10-19', season: { number: 1, dayOfSeason: 1, daysLeft: 34 }, forestPerDay: 10, topics: ['add-sub'], classOpen: false,
  openFight: null, pendingEvent: null, dragon: null, dragonTried: false, riddleDone: false, interestDone: false, guess: null,
  stats: { forestWins: 0, masterWins: 0, arenaWins: 0, riddles: 0, dragons: 0, bestLevel: 1 }, ...over,
});
const ok = (version: number, result: Record<string, unknown> = {}): Response => new Response(JSON.stringify({ ok: true, state: state(version), result } satisfies LordReply));
const refused = (reason: string, extra: object = {}): Response => new Response(JSON.stringify({ ok: false, reason, ...extra }));
const mine = (enabled = true, teacher = false) => ({ data: { hero: null, settings: { enabled, forestPerDay: 10, seasonStart: null }, teacher, facts: [] }, error: null });
const finish = (n: number): LordRequest => ({ action: 'fight-finish', requestId: `00000000-0000-4000-8000-00000000000${n}`, fightId: `00000000-0000-4000-8000-0000000000a${n}`, actions: [{ type: 'attack' }] });
const sentBody = (call: number) => JSON.parse(fetchMock.mock.calls[call][1]!.body as string) as LordRequest;

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  rpc.mockReset();
  ME = crypto.randomUUID();
});

describe('opening Dragon Maths', () => {
  it('reads the settings and the maths records, then asks the server for the hero', async () => {
    rpc.mockResolvedValue({ data: { hero: null, settings: { enabled: true, forestPerDay: 10, seasonStart: '2026-10-19' }, teacher: false, facts: [{ pack: 'money', key: 'money:change', attempts: 2, correct: 1, avgMs: 3000, box: 1, lastSeen: 1, quickDays: [] }] }, error: null });
    fetchMock.mockResolvedValueOnce(ok(0));
    const result = await createServerBackend(ME).load();
    expect(result.kind).toBe('ready');
    if (result.kind === 'ready') {
      expect(result.facts).toHaveLength(1);
      expect(result.state.version).toBe(0);
    }
    expect(rpc).toHaveBeenCalledWith('my_lord');
    expect(sentBody(0)).toEqual({ action: 'load' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/functions\/v1\/lord$/);
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer token');
  });

  it('says "closed" when the teacher’s switch is off, without bothering the server function', async () => {
    rpc.mockResolvedValue(mine(false, false));
    expect((await createServerBackend(ME).load()).kind).toBe('closed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lets a teacher in while it is off', async () => {
    rpc.mockResolvedValue(mine(false, true));
    fetchMock.mockResolvedValueOnce(ok(3));
    expect((await createServerBackend(ME).load()).kind).toBe('ready');
  });

  it('says "closed" if the server says so, and "not started" with its message', async () => {
    rpc.mockResolvedValue(mine());
    fetchMock.mockResolvedValueOnce(refused('closed'));
    expect((await createServerBackend(ME).load()).kind).toBe('closed');
    fetchMock.mockResolvedValueOnce(refused('not-started', { message: 'The season starts in 3 days.' }));
    expect(await createServerBackend(ME).load()).toEqual({ kind: 'not-started', message: 'The season starts in 3 days.' });
  });

  it('says "offline" (a friendly "can’t connect") when the network or the server is down', async () => {
    rpc.mockResolvedValue(mine());
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect((await createServerBackend(ME).load()).kind).toBe('offline');
    fetchMock.mockResolvedValueOnce(new Response('{"error":"busy"}', { status: 503 }));
    expect((await createServerBackend(ME).load()).kind).toBe('offline');
    rpc.mockResolvedValue({ data: null, error: { message: 'no' } });
    expect((await createServerBackend(ME).load()).kind).toBe('offline');
    rpc.mockRejectedValue(new Error('network'));
    expect((await createServerBackend(ME).load()).kind).toBe('offline');
  });
});

describe('the queue of finished fights', () => {
  it('keeps a finished fight on the device when offline ("saving later"), and sends it when the connection is back', async () => {
    const backend = createServerBackend(ME);
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect(await backend.send(finish(1))).toEqual({ kind: 'queued' });
    expect(queuedFinishes(ME)).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(`sgh-lord-queue:${ME}`)!)).toHaveLength(1);
    expect(backend.waiting()).toBe(1);
    fetchMock.mockResolvedValueOnce(ok(5, { outcome: 'won' }));
    expect(await backend.flush()).toBe('done');
    expect(queuedFinishes(ME)).toEqual([]);
    expect(backend.waiting()).toBe(0);
    expect(sentBody(1)).toMatchObject({ action: 'fight-finish', requestId: finish(1).requestId });
  });

  it('hands the server’s answer back when a finish goes straight through', async () => {
    const backend = createServerBackend(ME);
    fetchMock.mockResolvedValueOnce(ok(7, { outcome: 'won', gold: 12 }));
    const sent = await backend.send(finish(1));
    expect(sent).toMatchObject({ kind: 'reply', reply: { ok: true, result: { outcome: 'won', gold: 12 } } });
    expect(queuedFinishes(ME)).toEqual([]);
  });

  it('sends the oldest first and keeps what the server has not dealt with yet', async () => {
    enqueueFinish(ME, finish(1));
    enqueueFinish(ME, finish(2));
    fetchMock.mockResolvedValueOnce(ok(2));
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 503 }));
    const backend = createServerBackend(ME);
    expect(await backend.flush()).toBe('later');
    expect(queuedFinishes(ME).map((r) => r.requestId)).toEqual([finish(2).requestId]);
    expect(sentBody(0).requestId).toBe(finish(1).requestId);
  });

  it('counts a finish the server already has as done (the reply was lost), and drops one it turns down', async () => {
    enqueueFinish(ME, finish(1));
    fetchMock.mockResolvedValueOnce(refused('duplicate', { state: state(4) }));
    const backend = createServerBackend(ME);
    expect(await backend.flush()).toBe('done');
    enqueueFinish(ME, finish(2));
    fetchMock.mockResolvedValueOnce(refused('tampered', { state: state(4) }));
    expect(await backend.flush()).toBe('done');
    expect(queuedFinishes(ME)).toEqual([]);
  });

  it('keeps a finish when the game is switched off or the server is busy, for when it is back', async () => {
    enqueueFinish(ME, finish(1));
    const backend = createServerBackend(ME);
    fetchMock.mockResolvedValueOnce(refused('closed'));
    expect(await backend.flush()).toBe('later');
    fetchMock.mockResolvedValueOnce(refused('busy'));
    expect(await backend.flush()).toBe('later');
    expect(queuedFinishes(ME)).toHaveLength(1);
  });

  it('sends waiting fights before it opens the game, so nothing played is lost', async () => {
    enqueueFinish(ME, finish(1));
    rpc.mockResolvedValue(mine());
    fetchMock.mockResolvedValueOnce(ok(2));
    fetchMock.mockResolvedValueOnce(ok(2));
    await createServerBackend(ME).load();
    expect(sentBody(0).action).toBe('fight-finish');
    expect(sentBody(1).action).toBe('load');
  });

  it('sends everything else straight away and never queues it', async () => {
    const backend = createServerBackend(ME);
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect(await backend.send({ action: 'forest', requestId: crypto.randomUUID(), version: 1 })).toEqual({ kind: 'offline' });
    expect(queuedFinishes(ME)).toEqual([]);
    fetchMock.mockResolvedValueOnce(refused('stale', { state: state(9) }));
    expect(await backend.send({ action: 'forest', requestId: crypto.randomUUID(), version: 1 })).toMatchObject({ kind: 'reply', reply: { ok: false, reason: 'stale' } });
  });
});

describe('the news, the Warriors list and the Hall of Heroes', () => {
  it('reads each list through its own database function', async () => {
    rpc.mockImplementation(async (name: string) => ({
      data: name === 'lord_news' ? [{ day: '2026-10-19', kind: 'village', line: 'Market day!' }] : name === 'lord_warriors' ? [{ place: 1, display_name: 'Brave Tui', avatar: null, level: 3, stars: 0, dragons: 0, is_me: true }] : [{ season: 1, display_name: 'Brave Tui', avatar: null, kills: 1, is_me: false }],
      error: null,
    }));
    const backend = createServerBackend(ME);
    expect(await backend.fetchNews()).toEqual([{ day: '2026-10-19', kind: 'village', line: 'Market day!' }]);
    expect((await backend.fetchWarriors())![0]).toMatchObject({ place: 1, level: 3 });
    expect((await backend.fetchHall())![0]).toMatchObject({ season: 1, kills: 1 });
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(['lord_news', 'lord_warriors', 'lord_hall']);
  });

  it('gives null (not an error) when a list can’t be read, so the screen can offer to try again', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'no' } });
    const backend = createServerBackend(ME);
    expect(await backend.fetchNews()).toBeNull();
    rpc.mockRejectedValue(new Error('offline'));
    expect(await backend.fetchWarriors()).toBeNull();
    expect(await backend.fetchHall()).toBeNull();
  });

  it('passes on a fight that counted as a loss after a day, when opening the game', async () => {
    rpc.mockResolvedValue(mine());
    fetchMock.mockResolvedValueOnce(ok(3, { abandoned: 'forest' }));
    const result = await createServerBackend(ME).load();
    expect(result.kind === 'ready' && result.abandoned).toBe('forest');
  });
});

describe('the teacher’s views', () => {
  it('asks for the class, one pupil, and a reset', async () => {
    rpc.mockResolvedValue({ data: { players: 2 }, error: null });
    expect((await fetchClassLord()).players).toBe(2);
    expect(rpc).toHaveBeenLastCalledWith('teacher_lord_class');
    await fetchStudentLord('kid-1');
    expect(rpc).toHaveBeenLastCalledWith('teacher_lord_student', { student: 'kid-1' });
    rpc.mockResolvedValue({ data: { reset: true }, error: null });
    await resetLordHero('kid-1');
    expect(rpc).toHaveBeenLastCalledWith('teacher_reset_lord_hero', { student: 'kid-1' });
  });

  it('turns a failure into a friendly sentence', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'boom' } });
    await expect(fetchClassLord()).rejects.toThrow('We couldn’t load Dragon Maths for the school.');
    await expect(resetLordHero('kid-1')).rejects.toThrow('We couldn’t reset that hero.');
  });
});
