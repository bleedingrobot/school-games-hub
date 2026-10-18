import { describe, expect, it, vi } from 'vitest';
import { makeClanServer, sessionFrom, type ServerClan } from './remote';
import { DEFAULT_PRACTICAL_SETTINGS } from '../../../shared/maths/practical';
import { makeClan, startingDrafts } from './session';

const reply = { ok: true, replayed: false, seed: 1, state: null, result: { type: 'load' } };
const respond = (status: number, body: object = reply) => new Response(JSON.stringify(body), { status });

function server(responses: (Response | Error)[], over: Partial<Parameters<typeof makeClanServer>[0]> = {}) {
  const calls: { body: any; headers: Record<string, string> }[] = [];
  const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
    calls.push({ body: JSON.parse(String(init?.body)), headers: init?.headers as Record<string, string> });
    const next = responses.shift()!;
    if (next instanceof Error) throw next;
    return next;
  });
  let n = 0;
  return { calls, send: makeClanServer({ url: 'http://x/clans', apikey: 'key', token: async () => 'tok', fetch: fetchFn as never, newId: () => `id-${++n}`, ...over }).send };
}

describe('talking to the clans function', () => {
  it('sends the action with the sign-in and a request id', async () => {
    const s = server([respond(200)]);
    expect(await s.send({ type: 'claim' })).toEqual(reply);
    expect(s.calls[0].body).toEqual({ requestId: 'id-1', action: { type: 'claim' } });
    expect(s.calls[0].headers).toMatchObject({ Authorization: 'Bearer tok', apikey: 'key' });
  });

  it('sends again with the SAME request id when the connection drops or the server is busy, so it can never be paid twice', async () => {
    const s = server([new Error('offline'), respond(503), respond(200)]);
    expect(await s.send({ type: 'claim' })).toEqual(reply);
    expect(s.calls.map((c) => c.body.requestId)).toEqual(['id-1', 'id-1', 'id-1']);
  });

  it('gives up after the retries, and does not retry a request the server will never accept', async () => {
    const down = server([new Error('a'), new Error('b'), new Error('c')]);
    await expect(down.send({ type: 'claim' })).rejects.toThrow('c');
    expect(down.calls).toHaveLength(3);
    const bad = server([respond(400, { error: 'no' }), respond(200)]);
    await expect(bad.send({ type: 'claim' })).rejects.toThrow('400');
    expect(bad.calls).toHaveLength(1);
  });

  it('does not send anything when signed out', async () => {
    const s = server([respond(200)], { token: async () => null, retries: 0 });
    await expect(s.send({ type: 'claim' })).rejects.toThrow(/sign in/i);
    expect(s.calls).toHaveLength(0);
  });

  it('makes a session from the server\'s clan, keeping only the depth the browser chose', () => {
    const state: ServerClan = { clan: makeClan('Test Clan', startingDrafts(5)), seed: 5, day: 3, fightsLeft: 6, fightNo: 2, raidNo: 4, examined: ['A|B'], settings: DEFAULT_PRACTICAL_SETTINGS, fight: null, news: [], village: null, raidsOn: false, notes: [] };
    const first = sessionFrom(state);
    expect(first).toMatchObject({ baseSeed: 5, day: 3, fightsLeft: 6, fightNo: 2, raidNo: 4, depth: 0, examined: ['A|B'] });
    expect(sessionFrom(state, { ...first, depth: 7 }).depth).toBe(7);
  });
});
