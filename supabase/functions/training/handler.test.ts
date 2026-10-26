import { describe, expect, it, vi } from 'vitest';
import { makeHandler, MAX_REQUESTS_PER_MINUTE, type Services } from './handler';

const NOW = 1_792_000_000_000;
const DAY = new Date(NOW).toISOString().slice(0, 10);
const BATCH = '3f1c9a52-0b7d-4c1e-9d3a-6a1f2b9c8e10';

function services(over: Partial<Services> = {}) {
  const s: Services = {
    now: () => NOW,
    userIdFor: vi.fn(async (token: string) => (token === 'good-token' ? 'student-1' : null)),
    recordAnswers: vi.fn(async (_p, item) => ({ ok: true as const, value: item.answers.length })),
    recordStudent: vi.fn(async () => ({ ok: true as const, value: null })),
    recordSession: vi.fn(async () => ({ ok: true as const, value: null })),
    ...over,
  };
  return s;
}

function post(body: unknown, token: string | null = 'good-token') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Origin: 'https://bleedingrobot.github.io' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request('http://x/training', { method: 'POST', headers, body: JSON.stringify(body) });
}

const answer = (over: Record<string, unknown> = {}) => ({ key: 'mul:6x7', given: 42, ms: 2500, typingMs: 900, at: NOW - 1000, day: DAY, ...over });
const batch = (answers: unknown[] = [answer()], batchId = BATCH) => ({ type: 'answers', batchId, seed: 99, answers });
const student = () => ({ type: 'student', typing: { 2: [900] }, autoSubmit: true, sessionsDone: 2 });

async function send(s: Services, items: unknown[]) {
  const response = await makeHandler(s)(post({ items }));
  return { status: response.status, body: await response.json() };
}

describe('the training server function', () => {
  it('turns away a student who is not signed in, a request that cannot be read or is too big, and one who sends too often', async () => {
    const handle = makeHandler(services());
    expect((await handle(post({ items: [] }, null))).status).toBe(401);
    expect((await handle(post({ items: [] }, 'fake'))).status).toBe(401);
    expect((await handle(post({ nothing: 1 }))).status).toBe(400);
    expect((await handle(post({ items: Array.from({ length: 41 }, () => student()) }))).status).toBe(400);
    let last = 200;
    for (let i = 0; i <= MAX_REQUESTS_PER_MINUTE; i++) last = (await handle(post({ items: [] }))).status;
    expect(last).toBe(429);
  });

  it('saves a batch with each answer marked by the server, and drops a fact that is not real or a made-up time', async () => {
    const s = services();
    const { status, body } = await send(s, [
      batch([answer(), answer({ given: 40 })]),
      batch([answer({ key: 'mul:13x2' })], '5a2d9b11-0b7d-4c1e-9d3a-6a1f2b9c8e11'),
      batch([answer({ ms: -5 })], '5a2d9b11-0b7d-4c1e-9d3a-6a1f2b9c8e12'),
      batch([answer({ day: '2031-01-01' })], '5a2d9b11-0b7d-4c1e-9d3a-6a1f2b9c8e13'),
    ]);
    expect(status).toBe(200);
    expect(body.results.map((r: { type: string }) => r.type)).toEqual(['answers', 'invalid', 'invalid', 'invalid']);
    expect(s.recordAnswers).toHaveBeenCalledTimes(1);
    const [player, item] = vi.mocked(s.recordAnswers).mock.calls[0];
    expect(player).toBe('student-1');
    expect(item.answers.map((a) => a.correct)).toEqual([true, false]);
  });
});
