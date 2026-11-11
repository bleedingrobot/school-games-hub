import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CAMPAIGN } from '../../../shared/gem-keep/levels';
import { minWinSeconds, type SaveItem } from '../../../shared/gem-keep/save';
import { makeHandler, type RunRow, type Services } from './handler';

const NOW = 1_792_000_000_000;
const L1 = CAMPAIGN[0];
const L2 = CAMPAIGN[1];

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

const fact = (over: Record<string, unknown> = {}) => ({
  key: 'mul:7x8', attempts: 4, correct: 3, avgMs: 2400, box: 2, lastSeen: NOW - 1000, quickDays: ['2026-10-17'], ...over,
});

async function send(s: Services, items: unknown[]) {
  const response = await makeHandler(s)(post({ items }));
  return { status: response.status, body: await response.json() };
}

describe('the gem-keep server function', () => {
  it('needs a signed-in student', async () => {
    const { s } = services();
    const response = await makeHandler(s)(post({ items: [] }, null));
    expect(response.status).toBe(401);
  });

  it('says which level must be passed first', async () => {
    const { s, runs } = services();
    await send(s, [won({ levelId: L2.id, waves: L2.waves.length, gameSeconds: Math.ceil(minWinSeconds(L2)) + 1 })]);
    expect(runs[0]).toMatchObject({ levelNumber: 2, afterLevel: L1.id });
  });

  it('keeps good fact records and leaves out bad or impossibly quick ones', async () => {
    const { s } = services();
    const facts = [fact(), fact({ key: 'mul:8x7' }), fact({ key: 'mul:2x2', avgMs: 80, attempts: 6, correct: 6 }),
      fact({ key: 'mul:3x4', correct: 9 }), fact({ key: 'mul:7x8' })];
    const { body } = await send(s, [{ type: 'facts', pack: 'times-tables', facts }]);
    expect(body.results[0]).toEqual({ type: 'facts', changed: 1 });
    expect(s.recordFacts).toHaveBeenCalledWith('student-1', 'times-tables', [fact()]);
  });
});

describe('the deployable file', () => {
  it('is up to date with the code (run `npm run build:functions` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('gem-keep');
    expect(readFileSync(resolve('supabase/functions/gem-keep/index.ts'), 'utf8')).toBe(built);
  });
});
