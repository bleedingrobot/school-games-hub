import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LordReply, LordRequest, LordState } from '../../shared/lord/server';

const rpc = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) },
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

import { createServerBackend, queuedFinishes } from './lord';

const fetchMock = vi.fn<typeof fetch>();
let ME = '';

const state = (version: number, over: Partial<LordState> = {}): LordState => ({
  hero: null, version, today: '2026-10-19', season: { number: 1, dayOfSeason: 1, daysLeft: 34 }, forestPerDay: 10, topics: ['add-sub'], classOpen: false,
  openFight: null, pendingEvent: null, dragon: null, dragonTried: false, riddleDone: false, interestDone: false, guess: null,
  stats: { forestWins: 0, masterWins: 0, arenaWins: 0, riddles: 0, dragons: 0, bestLevel: 1 }, ...over,
});
const ok = (version: number, result: Record<string, unknown> = {}): Response => new Response(JSON.stringify({ ok: true, state: state(version), result } satisfies LordReply));
const finish = (n: number): LordRequest => ({ action: 'fight-finish', requestId: `00000000-0000-4000-8000-00000000000${n}`, fightId: `00000000-0000-4000-8000-0000000000a${n}`, actions: [{ type: 'attack' }] });
const sentBody = (call: number) => JSON.parse(fetchMock.mock.calls[call][1]!.body as string) as LordRequest;

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  rpc.mockReset();
  ME = crypto.randomUUID();
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
});

