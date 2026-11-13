import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FACT_KEY, POINTS_PASS } from '../../../shared/glyph/config';
import { memoryServices, type MemoryOptions } from '../../../shared/glyph/memoryServices';
import type { Go, WallPlay } from '../../../shared/glyph/play';
import { makeTemple } from '../../../shared/glyph/walls';
import { makeHandler } from './handler';

// Glyph Gates' server tests: the fairness ones (the rules have their own in shared/glyph).

function setup(over: MemoryOptions = {}) {
  const clock = Date.UTC(2026, 10, 13, 1);
  const log = { answers: [], points: [] } as NonNullable<MemoryOptions['log']>;
  const services = memoryServices({ now: () => clock, log, ...over });
  const handler = makeHandler({ ...services, userIdFor: async (t) => (t.startsWith('pupil-') ? t : null) });
  const send = async (who: string | null, body: object) => {
    const res = await handler(new Request('https://x/glyph', {
      method: 'POST', headers: who ? { Authorization: `Bearer ${who}` } : {}, body: JSON.stringify(body),
    }));
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };
  return { send, log, services };
}

const rightPlays = (seed: string, temple: number): WallPlay[] =>
  makeTemple(seed, temple).map((w) => ({ goes: [{ lit: [...w.right], pick: w.answer, ms: 4000 } as Go], help: 0 }));

it('starts a temple, replays the goes, saves once with maths and points, and keeps goes to their pupil', async () => {
  const { send, log } = setup();
  expect((await send(null, { type: 'load' })).status).toBe(401);
  expect((await send('pupil-a', { type: 'load' })).body).toMatchObject({ enabled: true, today: '2026-11-13', progress: { passed: 0 } });
  expect((await send('pupil-a', { type: 'start', temple: 2 })).body.code).toBe('locked'); // temple 2 opens after temple 1

  const start = (await send('pupil-a', { type: 'start', temple: 1 })).body;
  expect(start.walls).toHaveLength(9);
  expect(JSON.stringify(start)).not.toContain('"answer"');
  const seed = start.seed as string;
  const plays = rightPlays(seed, 1);

  expect((await send('pupil-b', { type: 'finish', seed, plays })).body.code).toBe('not-yours');
  const done = (await send('pupil-a', { type: 'finish', seed, plays })).body;
  expect(done).toMatchObject({ points: POINTS_PASS, result: { finished: true, passed: true, firstGoes: 9 }, progress: { passed: 1, walls: 9 } });
  expect(log.answers).toHaveLength(1);
  expect(log.answers[0]).toMatchObject({ once: `glyph:${seed}` });
  expect(log.answers[0].answers).toHaveLength(9);
  expect(log.answers[0].answers[0]).toMatchObject({ key: FACT_KEY, correct: true });
  expect(log.points).toEqual([{ player: 'pupil-a', points: POINTS_PASS, once: `glyph:${seed}` }]);
  expect((await send('pupil-a', { type: 'finish', seed, plays })).body).toEqual({ already: true }); // sent twice counts once
  expect(log.points).toHaveLength(1);
  expect((await send('pupil-a', { type: 'start', temple: 2 })).status).toBe(200);
});

it('refuses while the switch is off, a go that could not be played, and remembers the guide', async () => {
  let enabled = false;
  const { send, log } = setup({ settings: () => ({ enabled }) });
  expect((await send('pupil-a', { type: 'start', temple: 1 })).body.code).toBe('off');
  expect((await send('pupil-a', { type: 'load' })).body).toMatchObject({ enabled: false });

  enabled = true;
  const seed = (await send('pupil-a', { type: 'start', temple: 1 })).body.seed as string;
  const plays = rightPlays(seed, 1);
  plays[0].goes[0].pick = null; // none match, yet a glyph does
  const bad = await send('pupil-a', { type: 'finish', seed, plays });
  expect(bad).toMatchObject({ status: 400, body: { error: 'bad go' } });
  plays[0].goes[0].pick = makeTemple(seed, 1)[0].answer;
  plays[0].goes[0].ms = 10; // quicker than anyone can go
  expect((await send('pupil-a', { type: 'finish', seed, plays })).status).toBe(400);
  expect(log.answers).toHaveLength(0);

  // A part go (two walls, then leaving) saves the walls and maths but gives no points.
  const part = (await send('pupil-a', { type: 'finish', seed, plays: rightPlays(seed, 1).slice(0, 2) })).body;
  expect(part).toMatchObject({ points: 0, result: { finished: false }, progress: { passed: 0, walls: 2 } });
  expect(log.answers[0].answers).toHaveLength(2);
  expect(log.points).toHaveLength(0);

  expect((await send('pupil-a', { type: 'guide-seen' })).body.progress.guideSeen).toBe(true);
});

describe('the deployable file', () => {
  it('is up to date with the code (run `npm run build:functions -- glyph` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('glyph');
    expect(readFileSync(resolve('supabase/functions/glyph/index.ts'), 'utf8')).toBe(built);
  });
});
