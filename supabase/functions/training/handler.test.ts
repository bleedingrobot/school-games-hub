import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { makeHandler, MAX_REQUESTS_PER_MINUTE, SAVE_LIMITS, type Services } from './handler';

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
  it('needs a signed-in student', async () => {
    const response = await makeHandler(services())(post({ items: [] }, null));
    expect(response.status).toBe(401);
    expect((await makeHandler(services())(post({ items: [] }, 'fake'))).status).toBe(401);
  });

  it('only takes POST, and answers the browser’s pre-check', async () => {
    const handle = makeHandler(services());
    expect((await handle(new Request('http://x/training', { method: 'OPTIONS' }))).status).toBe(204);
    expect((await handle(new Request('http://x/training', { method: 'GET' }))).status).toBe(405);
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

  it('saves typing times and settings', async () => {
    const s = services();
    const { body } = await send(s, [student()]);
    expect(body).toEqual({ handled: 1, results: [{ type: 'student' }] });
    expect(vi.mocked(s.recordStudent).mock.calls[0][1]).toMatchObject({ typing: { 2: [900] }, autoSubmit: true, sessionsDone: 2 });
  });

  it('counts a finished session after its answers (Training before games)', async () => {
    const s = services();
    const session = { type: 'session', kind: 'facts', seed: 99, at: NOW - 500 };
    const { body } = await send(s, [batch(), session]);
    expect(body).toEqual({ handled: 2, results: [{ type: 'answers', added: 1 }, { type: 'session' }] });
    expect(vi.mocked(s.recordSession).mock.calls[0]).toEqual(['student-1', session]);
    expect(vi.mocked(s.recordAnswers).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(s.recordSession).mock.invocationCallOrder[0]);
  });

  it('drops a session the database says wasn’t finished, and keeps one that couldn’t be saved yet', async () => {
    const refused = services({ recordSession: vi.fn(async () => ({ ok: false as const, why: 'refused' as const })) });
    expect((await send(refused, [{ type: 'session', kind: 'quick', seed: 5, at: NOW }])).body).toEqual({
      handled: 1,
      results: [{ type: 'invalid', problem: 'refused' }],
    });
    const busy = services({ recordSession: vi.fn(async () => ({ ok: false as const, why: 'busy' as const })) });
    expect((await send(busy, [batch(), { type: 'session', kind: 'facts', seed: 99, at: NOW }])).body).toEqual({
      handled: 1,
      results: [{ type: 'answers', added: 1 }],
    });
  });

  it('drops answers for a fact that is not real, and keeps going with the rest', async () => {
    const s = services();
    const { body } = await send(s, [batch([answer({ key: 'mul:13x2' })]), batch([answer()], '5a2d9b11-0b7d-4c1e-9d3a-6a1f2b9c8e11')]);
    expect(body).toEqual({ handled: 2, results: [{ type: 'invalid', problem: 'fact' }, { type: 'answers', added: 1 }] });
    expect(s.recordAnswers).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a negative time', { ms: -5 }],
    ['a huge time', { ms: 99_999_999 }],
    ['a made-up day', { day: '2031-01-01' }],
  ])('drops %s', async (_name, over) => {
    const s = services();
    const { body } = await send(s, [batch([answer(over)])]);
    expect(body.results[0].type).toBe('invalid');
    expect(s.recordAnswers).not.toHaveBeenCalled();
  });

  it('drops an item the database refuses', async () => {
    const s = services({ recordAnswers: vi.fn(async () => ({ ok: false as const, why: 'refused' as const })) });
    const { body } = await send(s, [batch()]);
    expect(body).toEqual({ handled: 1, results: [{ type: 'invalid', problem: 'refused' }] });
  });

  it('stops at an item it could not save, so the rest are kept for later', async () => {
    let n = 0;
    const s = services({
      recordAnswers: vi.fn(async () => (++n === 2 ? { ok: false as const, why: 'busy' as const } : { ok: true as const, value: 1 })),
    });
    const ids = ['a1111111-0b7d-4c1e-9d3a-6a1f2b9c8e10', 'a2222222-0b7d-4c1e-9d3a-6a1f2b9c8e10', 'a3333333-0b7d-4c1e-9d3a-6a1f2b9c8e10'];
    const { status, body } = await send(s, ids.map((id) => batch([answer()], id)));
    expect(status).toBe(200);
    expect(body.handled).toBe(1);
    expect(s.recordAnswers).toHaveBeenCalledTimes(2);
  });

  it('says it is busy when nothing could be saved', async () => {
    const s = services({ recordAnswers: vi.fn(async () => ({ ok: false as const, why: 'too-many' as const })) });
    expect((await makeHandler(s)(post({ items: [batch()] }))).status).toBe(503);
  });

  it('turns away a request that cannot be read or is too big', async () => {
    const handle = makeHandler(services());
    expect((await handle(post({ nothing: 1 }))).status).toBe(400);
    expect((await handle(post({ items: Array.from({ length: 41 }, () => student()) }))).status).toBe(400);
  });

  it('slows down a student who sends too often', async () => {
    const handle = makeHandler(services());
    let last = 200;
    for (let i = 0; i <= MAX_REQUESTS_PER_MINUTE; i++) last = (await handle(post({ items: [] }))).status;
    expect(last).toBe(429);
  });

  it('keeps the numbers the database uses in the shared settings', () => {
    expect(SAVE_LIMITS).toEqual({ keepPerFact: 30, dailyLimit: 600 });
  });
});

describe('Quick looks answers through the training server function', () => {
  const quick = (over: Record<string, unknown> = {}) => answer({ key: 'sub:ten-8', given: 8, ms: 0, typingMs: 0, ...over });

  it('saves them for the signed-in student, marked from the key', async () => {
    const s = services();
    const { status, body } = await send(s, [batch([quick(), quick({ at: NOW - 900, given: 7 }), quick({ at: NOW - 800, key: 'gap:ten-7', given: 3 }), quick({ at: NOW - 700, key: 'subh:line-2', given: 2 })])]);
    expect(status).toBe(200);
    expect(body).toEqual({ handled: 1, results: [{ type: 'answers', added: 4 }] });
    const [player, item] = vi.mocked(s.recordAnswers).mock.calls[0];
    expect(player).toBe('student-1');
    expect(item.answers.map((a) => [a.key, a.correct])).toEqual([['sub:ten-8', true], ['sub:ten-8', false], ['gap:ten-7', true], ['subh:line-2', true]]);
  });

  it('drops a bad Quick looks key or a full gap and keeps going with the rest', async () => {
    const s = services();
    const { body } = await send(s, [
      batch([quick({ key: 'gap:five-5', given: 0 })]),
      batch([quick({ key: 'sub:cube-3', given: 3 })], '5a2d9b11-0b7d-4c1e-9d3a-6a1f2b9c8e11'),
      batch([quick({ key: 'sub:line-99', given: 99 })], '5a2d9b11-0b7d-4c1e-9d3a-6a1f2b9c8e12'),
      batch([quick()], '5a2d9b11-0b7d-4c1e-9d3a-6a1f2b9c8e13'),
    ]);
    expect(body).toEqual({
      handled: 4,
      results: [{ type: 'invalid', problem: 'fact' }, { type: 'invalid', problem: 'fact' }, { type: 'invalid', problem: 'fact' }, { type: 'answers', added: 1 }],
    });
    expect(s.recordAnswers).toHaveBeenCalledTimes(1);
  });

  it('counts an answer sent twice once: the same batch again adds nothing, and a repeat inside a batch is dropped', async () => {
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

  it('turns away typed time on a tap answer', async () => {
    const { body } = await send(services(), [batch([quick({ typingMs: 700 })])]);
    expect(body.results).toEqual([{ type: 'invalid', problem: 'typing' }]);
  });

  it('saves the Quick looks settings with the student, and turns away nonsense ones', async () => {
    const s = services();
    const settings = { placed: true, startStage: 2, finished: 1, guided: false };
    const { body } = await send(s, [{ ...student(), quick: settings }, { ...student(), quick: { ...settings, finished: 9 } }]);
    expect(body.results).toEqual([{ type: 'student' }, { type: 'invalid', problem: 'quick' }]);
    expect(vi.mocked(s.recordStudent).mock.calls[0][1]).toMatchObject({ quick: settings });
  });

  it('is fine with a busy day of both kinds of practice: the limits cover a 12-picture session several times a day', () => {
    // The database keeps 30 answers of each picture and takes 600 answers a day for each student.
    // A day of 10 Quick looks sessions (120) + 10 times-table sessions (about 300) fits with room to spare.
    expect(SAVE_LIMITS.dailyLimit).toBeGreaterThanOrEqual(10 * 12 + 10 * 30);
    expect(MAX_REQUESTS_PER_MINUTE).toBeGreaterThanOrEqual(10);
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
