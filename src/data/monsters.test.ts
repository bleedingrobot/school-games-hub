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

import { enqueueSave, flushQueue, queuedSaves } from './monsters';

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
});

