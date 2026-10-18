import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CAMPAIGN } from '../../../shared/gem-keep/levels';
import { minWinSeconds, type SaveItem } from '../../../shared/gem-keep/save';
import { makeHandler, MAX_REQUESTS_PER_MINUTE, type RunRow, type Services } from './handler';

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

  it('saves a won level with the level details filled in by the server', async () => {
    const { s, runs } = services();
    const { status, body } = await send(s, [won()]);
    expect(status).toBe(200);
    expect(body).toEqual({ handled: 1, results: [{ type: 'run', status: 'saved', points: 5 }] });
    expect(runs[0]).toMatchObject({ levelId: L1.id, levelNumber: 1, afterLevel: null, wavesTotal: L1.waves.length });
  });

  it('says which level must be passed first', async () => {
    const { s, runs } = services();
    await send(s, [won({ levelId: L2.id, waves: L2.waves.length, gameSeconds: Math.ceil(minWinSeconds(L2)) + 1 })]);
    expect(runs[0]).toMatchObject({ levelNumber: 2, afterLevel: L1.id });
  });

  it.each([
    ['an unknown level', { levelId: 'level-99' }],
    ['a win with no stars', { stars: 0 }],
    ['a win that skipped waves', { waves: 2 }],
    ['a win faster than the enemies can arrive', { gameSeconds: 5 }],
    ['more right than asked', { right: 31 }],
    ['a bad run id', { runId: 'not-a-uuid' }],
    ['a loss with stars', { result: 'lost', stars: 1, waves: 3 }],
  ])('drops %s for good and carries on', async (_what, over) => {
    const { s } = services();
    const { body } = await send(s, [won(over as never), { type: 'key', levelId: L1.id, right: 9 }]);
    expect(body.handled).toBe(2);
    expect(body.results[0].type).toBe('invalid');
    expect(body.results[1]).toEqual({ type: 'key', status: 'passed' });
    expect(s.recordRun).not.toHaveBeenCalled();
  });

  it('checks a Level Key round', async () => {
    const { s } = services();
    const { body } = await send(s, [{ type: 'key', levelId: L1.id, right: 11 }]);
    expect(body.results[0].type).toBe('invalid');
    await send(s, [{ type: 'key', levelId: L1.id, right: 8 }]);
    expect(s.recordKey).toHaveBeenCalledWith('student-1', L1.id, 8);
  });

  it('keeps good fact records and leaves out bad or impossibly quick ones', async () => {
    const { s } = services();
    const facts = [fact(), fact({ key: 'mul:8x7' }), fact({ key: 'mul:2x2', avgMs: 80, attempts: 6, correct: 6 }),
      fact({ key: 'mul:3x4', correct: 9 }), fact({ key: 'mul:7x8' })];
    const { body } = await send(s, [{ type: 'facts', pack: 'times-tables', facts }]);
    expect(body.results[0]).toEqual({ type: 'facts', changed: 1 });
    expect(s.recordFacts).toHaveBeenCalledWith('student-1', 'times-tables', [fact()]);
  });

  it('adds answers, leaving out bad or impossibly quick ones', async () => {
    const { s } = services();
    const good = { key: 'mul:7x8', correct: true, ms: 2100, at: NOW - 5000 };
    const answers = [good, { ...good, key: 'mul:8x7' }, { ...good, ms: 40 }, { ...good, at: NOW - 90 * 86_400_000 },
      { ...good, correct: 'yes' }, { ...good, correct: false, ms: 6000 }];
    const batchId = '0b7d5c2e-8a41-4f6b-9e3d-2c1a0f9e8d7c';
    const { body } = await send(s, [{ type: 'answers', pack: 'times-tables', batchId, answers }]);
    expect(body.results[0]).toEqual({ type: 'answers', added: 2 });
    expect(s.recordAnswers).toHaveBeenCalledWith('student-1', 'times-tables', batchId, [good, { ...good, correct: false, ms: 6000 }]);
    const bad = await send(s, [{ type: 'answers', pack: 'times-tables', batchId: 'nope', answers: [good] }]);
    expect(bad.body.results[0].type).toBe('invalid');
  });

  it('keeps the answers of the other packs a maths focus asks, each in its own pack', async () => {
    const { s } = services();
    const answer = (key: string) => ({ key, correct: true, ms: 2100, at: NOW - 5000 });
    const batchId = '0b7d5c2e-8a41-4f6b-9e3d-2c1a0f9e8d7c';
    const early = [answer('bond10:3+7'), answer('dbl:7'), answer('half:14')];
    const { body } = await send(s, [
      { type: 'answers', pack: 'early-facts', batchId, answers: early },
      { type: 'answers', pack: 'add-sub', batchId: '1b7d5c2e-8a41-4f6b-9e3d-2c1a0f9e8d7c', answers: [answer('add:3+4')] },
      { type: 'answers', pack: 'division', batchId: '2b7d5c2e-8a41-4f6b-9e3d-2c1a0f9e8d7c', answers: [answer('div:56/8')] },
    ]);
    expect(body.results.map((r: { added?: number }) => r.added)).toEqual([3, 1, 1]);
    expect(s.recordAnswers).toHaveBeenCalledWith('student-1', 'early-facts', batchId, early);
    expect(s.recordAnswers).toHaveBeenCalledWith('student-1', 'add-sub', expect.any(String), [answer('add:3+4')]);
    expect(s.recordAnswers).toHaveBeenCalledWith('student-1', 'division', expect.any(String), [answer('div:56/8')]);
  });

  it('keeps the answers of the generated skills (rounding, order of operations...) in the "generated" pack, per question type', async () => {
    const { s } = services();
    const answer = (key: string) => ({ key, correct: true, ms: 6500, at: NOW - 5000 });
    const batchId = '0b7d5c2e-8a41-4f6b-9e3d-2c1a0f9e8d7c';
    const keys = ['round:100:3digit', 'round:tenth:halfway', 'bond100:fives', 'bedmas:brackets-first', 'times:tens-tens', 'factor:common', 'square:next'];
    const { body } = await send(s, [{ type: 'answers', pack: 'generated', batchId, answers: [...keys.map(answer), answer('mul:7x8'), answer('bond10:3+7'), answer('pv:round10'), answer('round:100.5')] }]);
    // Only the question types of the ladder: a times-table fact, an early fact, Maths Monsters' own key and a bad key are left out.
    expect(body.results[0]).toEqual({ type: 'answers', added: keys.length });
    expect(s.recordAnswers).toHaveBeenCalledWith('student-1', 'generated', batchId, keys.map(answer));
    // And a generated key sent as another pack is left out too.
    const other = await send(s, [{ type: 'answers', pack: 'early-facts', batchId: '1b7d5c2e-8a41-4f6b-9e3d-2c1a0f9e8d7c', answers: [answer('round:100:3digit')] }]);
    expect(other.body.results[0]).toEqual({ type: 'answers', added: 0 });
  });

  describe('the place on the maths ladder', () => {
    const answersItem = { type: 'answers', pack: 'times-tables', batchId: '6f1c2a54-1d3e-4b5a-9c7d-0e1f2a3b4c5d', answers: [{ key: 'mul:7x8', correct: true, ms: 1200, at: NOW - 1000 }] };

    it('keeps the furthest place up to date after answers are saved', async () => {
      const syncPlace = vi.fn(async () => undefined);
      const { s } = services({ syncPlace });
      const { status } = await send(s, [answersItem]);
      expect(status).toBe(200);
      expect(syncPlace).toHaveBeenCalledOnce();
      expect(syncPlace).toHaveBeenCalledWith('student-1');
    });

    it('does not bother when nothing about the records changed', async () => {
      const syncPlace = vi.fn(async () => undefined);
      const { s } = services({ syncPlace, recordAnswers: vi.fn(async () => ({ ok: true as const, value: 0 })) });
      await send(s, [answersItem]);
      await send(s, [won()]);
      expect(syncPlace).not.toHaveBeenCalled();
    });

    it('checks a placement and says where it was stored', async () => {
      const savePlacement = vi.fn(async () => ({ outcome: 'saved' as const, start: 'tables-3-4-8' }));
      const { s } = services({ savePlacement });
      const response = await makeHandler(s)(post({ placement: { skip: true } }));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ outcome: 'saved', start: 'tables-3-4-8' });
      expect(savePlacement).toHaveBeenCalledWith('student-1', { skip: true });
    });

    it('says "already" for a second placement, and refuses one that does not check out', async () => {
      const { s } = services({ savePlacement: vi.fn(async () => ({ outcome: 'already' as const })) });
      const again = await makeHandler(s)(post({ placement: { skip: true } }));
      expect(await again.json()).toEqual({ outcome: 'already' });
      const { s: bad } = services({ savePlacement: vi.fn(async () => ({ outcome: 'refused' as const })) });
      expect((await makeHandler(bad)(post({ placement: { answers: [] } }))).status).toBe(400);
    });

    it('needs a signed-in student for the placement too, and copes with a database error', async () => {
      const { s } = services({ savePlacement: vi.fn(async () => Promise.reject(new Error('down'))) });
      expect((await makeHandler(s)(post({ placement: { skip: true } }, null))).status).toBe(401);
      expect((await makeHandler(s)(post({ placement: { skip: true } }))).status).toBe(503);
    });
  });

  it('leaves out an answer that does not belong to the pack it is sent as', async () => {
    const { s } = services();
    const answer = (key: string) => ({ key, correct: true, ms: 2100, at: NOW - 5000 });
    const batchId = '0b7d5c2e-8a41-4f6b-9e3d-2c1a0f9e8d7c';
    const { body } = await send(s, [{ type: 'answers', pack: 'early-facts', batchId, answers: [answer('mul:7x8'), answer('bond10:3+7'), answer('bond10:3+8'), answer('add:3+4')] }]);
    expect(body.results[0]).toEqual({ type: 'answers', added: 1 });
    expect(s.recordAnswers).toHaveBeenCalledWith('student-1', 'early-facts', batchId, [answer('bond10:3+7')]);
  });

  it('refuses a pack it does not know', async () => {
    const { s } = services();
    const answer = { key: 'mul:7x8', correct: true, ms: 2100, at: NOW - 5000 };
    for (const pack of ['money', 'times_tables', '', 7, null]) {
      const { body } = await send(s, [{ type: 'answers', pack, batchId: '0b7d5c2e-8a41-4f6b-9e3d-2c1a0f9e8d7c', answers: [answer] }]);
      expect(body.results[0], String(pack)).toEqual({ type: 'invalid', problem: 'pack' });
    }
    expect(s.recordAnswers).not.toHaveBeenCalled();
  });

  it('brings in trial progress only in campaign order', async () => {
    const { s } = services();
    await send(s, [{
      type: 'import',
      levels: [
        { levelId: CAMPAIGN[0].id, stars: 3, keyPassed: true },
        { levelId: CAMPAIGN[1].id, stars: 2, keyPassed: false },
        // Not open yet (level 2's Key wasn't passed), so it's left out.
        { levelId: CAMPAIGN[2].id, stars: 3, keyPassed: true },
      ],
    }]);
    expect(s.importProgress).toHaveBeenCalledWith('student-1', [
      { levelId: CAMPAIGN[0].id, stars: 3, keyPassed: true },
      { levelId: CAMPAIGN[1].id, stars: 2, keyPassed: false },
    ]);
  });

  it('stops at the daily limit and keeps the rest of the queue', async () => {
    const { s } = services({
      recordKey: vi.fn(async () => ({ ok: false as const, why: 'too-many' as const })),
    });
    const { status, body } = await send(s, [won(), { type: 'key', levelId: L1.id, right: 9 }, won()]);
    expect(status).toBe(200);
    expect(body.handled).toBe(1);
    expect(s.recordRun).toHaveBeenCalledTimes(1);
  });

  it('says so when nothing could be saved', async () => {
    const { s } = services({ recordRun: vi.fn(async () => ({ ok: false as const, why: 'busy' as const })) });
    const { status } = await send(s, [won()]);
    expect(status).toBe(503);
  });

  it('drops an item the database refuses, so it never blocks the queue', async () => {
    const { s } = services({ recordRun: vi.fn(async () => ({ ok: false as const, why: 'refused' as const })) });
    const { body } = await send(s, [won(), { type: 'key', levelId: L1.id, right: 9 }]);
    expect(body).toEqual({ handled: 2, results: [{ type: 'invalid', problem: 'refused' }, { type: 'key', status: 'passed' }] });
  });

  it('refuses too many items or too many requests', async () => {
    const { s } = services();
    expect((await send(s, Array.from({ length: 41 }, () => won()))).status).toBe(400);
    const handler = makeHandler(s);
    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) await handler(post({ items: [] }));
    expect((await handler(post({ items: [] }))).status).toBe(429);
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
