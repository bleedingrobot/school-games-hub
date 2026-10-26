import { describe, expect, it, vi } from 'vitest';
import { CAMPAIGN } from '../../../shared/gem-keep/levels';
import { minWinSeconds, type SaveItem } from '../../../shared/gem-keep/save';
import { makeHandler, MAX_REQUESTS_PER_MINUTE, type RunRow, type Services } from './handler';

const NOW = 1_792_000_000_000;
const L1 = CAMPAIGN[0];

function services(over: Partial<Services> = {}) {
  const runs: RunRow[] = [];
  const s: Services = {
    now: () => NOW,
    userIdFor: vi.fn(async (token: string) => (token === 'good-token' ? 'student-1' : null)),
    recordRun: vi.fn(async (_player: string, run: RunRow) => {
      runs.push(run);
      return { ok: true as const, value: { status: 'saved' as const, points: 5 } };
    }),
    recordKey: vi.fn(async () => ({ ok: true as const, value: 'passed' as const })),
    recordFacts: vi.fn(async (_p: string, _pack: string, facts: unknown[]) => ({ ok: true as const, value: facts.length })),
    importProgress: vi.fn(async () => ({ ok: true as const, value: 'imported' as const })),
    recordAnswers: vi.fn(async (_p: string, _pack: string, _b: string, answers: unknown[]) => ({ ok: true as const, value: answers.length })),
    ...over,
  };
  return { s, runs };
}

function post(body: unknown, token: string | null = 'good-token') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Origin: 'https://bleedingrobot.github.io' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request('http://x/gem-keep', { method: 'POST', headers, body: JSON.stringify(body) });
}

const won = (over: Partial<Extract<SaveItem, { type: 'run' }>> = {}): SaveItem => ({
  type: 'run',
  runId: '6f1c2a54-1d3e-4b5a-9c7d-0e1f2a3b4c5d',
  levelId: L1.id,
  result: 'won',
  stars: 3,
  waves: L1.waves.length,
  gameSeconds: Math.ceil(minWinSeconds(L1)) + 60,
  asked: 30,
  right: 24,
  ...over,
});

async function send(s: Services, items: unknown[]) {
  const response = await makeHandler(s)(post({ items }));
  return { status: response.status, body: await response.json() };
}

describe('the gem-keep server function', () => {
  it('needs a signed-in student, and refuses too many items or too many requests', async () => {
    const { s } = services();
    expect((await makeHandler(s)(post({ items: [] }, null))).status).toBe(401);
    expect((await send(s, Array.from({ length: 41 }, () => won()))).status).toBe(400);
    const handler = makeHandler(s);
    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) await handler(post({ items: [] }));
    expect((await handler(post({ items: [] }))).status).toBe(429);
    expect(s.recordRun).not.toHaveBeenCalled();
  });

  it('saves a good win, and drops an impossible one or a bad answer without blocking the queue', async () => {
    const { s, runs } = services();
    const good = { key: 'mul:7x8', correct: true, ms: 2100, at: NOW - 5000 };
    const batchId = '0b7d5c2e-8a41-4f6b-9e3d-2c1a0f9e8d7c';
    const { body } = await send(s, [
      won({ gameSeconds: 5 }), // faster than the enemies can arrive
      won({ right: 31 }), // more right than asked
      won(),
      { type: 'answers', pack: 'times-tables', batchId, answers: [good, { ...good, ms: 40 }, { ...good, correct: 'yes' }] },
    ]);
    expect(body.results.map((r: { type: string }) => r.type)).toEqual(['invalid', 'invalid', 'run', 'answers']);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ levelId: L1.id, levelNumber: 1 });
    expect(s.recordAnswers).toHaveBeenCalledWith('student-1', 'times-tables', batchId, [good]);
  });
});
