import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  it('turns away a request with no signed-in student, a bad request, or too many requests', async () => {
    const handle = makeHandler(services());
    expect((await handle(post({ items: [] }, null))).status).toBe(401);
    expect((await handle(post({ items: [] }, 'fake'))).status).toBe(401);
    expect((await handle(post({ nothing: 1 }))).status).toBe(400);
    expect((await handle(post({ items: Array.from({ length: 41 }, () => student()) }))).status).toBe(400);
    let last = 200;
    for (let i = 0; i <= MAX_REQUESTS_PER_MINUTE; i++) last = (await handle(post({ items: [] }))).status;
    expect(last).toBe(429);
  });

  it('saves a batch for the signed-in student, with each answer marked by the server', async () => {
    const s = services();
    const { status, body } = await send(s, [batch([answer(), answer({ given: 40 })])]);
    expect(status).toBe(200);
    expect(body).toEqual({ handled: 1, results: [{ type: 'answers', added: 2 }] });
    const [player, item] = vi.mocked(s.recordAnswers).mock.calls[0];
    expect(player).toBe('student-1');
    expect(item.answers.map((a) => a.correct)).toEqual([true, false]);
    expect(item.seed).toBe(99);
  });

  it('drops answers that cannot be real (a made-up fact, time, day or typing) and keeps going with the rest', async () => {
    const bad: Record<string, unknown>[] = [{ key: 'mul:13x2' }, { ms: -5 }, { ms: 99_999_999 }, { day: '2031-01-01' }];
    for (const over of bad) {
      const s = services();
      const { body } = await send(s, [batch([answer(over)])]);
      expect(body.results[0].type).toBe('invalid');
      expect(s.recordAnswers).not.toHaveBeenCalled();
    }
    const s = services();
    const { body } = await send(s, [batch([answer({ key: 'mul:13x2' })]), batch([answer()], '5a2d9b11-0b7d-4c1e-9d3a-6a1f2b9c8e11')]);
    expect(body).toEqual({ handled: 2, results: [{ type: 'invalid', problem: 'fact' }, { type: 'answers', added: 1 }] });
    const typed = await send(services(), [batch([answer({ key: 'sub:ten-8', given: 8, ms: 0, typingMs: 700 })])]);
    expect(typed.body.results).toEqual([{ type: 'invalid', problem: 'typing' }]);
  });

  it('counts an answer sent twice once: the same batch again adds nothing, and a repeat inside a batch is dropped', async () => {
    const quick = (over: Record<string, unknown> = {}) => answer({ key: 'sub:ten-8', given: 8, ms: 0, typingMs: 0, ...over });
    const seen = new Set<string>();
    const s = services({
      recordAnswers: vi.fn(async (_p, item) => {
        if (seen.has(item.batchId)) return { ok: true as const, value: 0 };
        seen.add(item.batchId);
        return { ok: true as const, value: item.answers.length };
      }),
    });
    const same = batch([quick(), quick()]);
    const first = await send(s, [same]);
    const again = await send(s, [same]);
    expect(first.body.results).toEqual([{ type: 'answers', added: 1 }]);
    expect(again.body.results).toEqual([{ type: 'answers', added: 0 }]);
  });
});

describe('the deployable file', () => {
  it('is up to date with the code (run `npm run build:functions` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('training');
    expect(readFileSync(resolve('supabase/functions/training/index.ts'), 'utf8')).toBe(built);
  });
});
