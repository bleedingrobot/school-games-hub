import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { botRun } from '../../../shared/toonflap/bot';
import { BREAK_AFTER_RUNS } from '../../../shared/toonflap/config';
import { encodeFlaps } from '../../../shared/toonflap/engine';
import { emptyProgress } from '../../../shared/toonflap/collection';
import { buildCourse, LEVELS } from '../../../shared/toonflap/levels';
import { memoryServices, type MemoryOptions } from '../../../shared/toonflap/memoryServices';
import type { Settings } from '../../../shared/toonflap/server';
import { makeHandler } from './handler';

// Toon Flap's server tests: the fairness ones (the rules have their own in shared/toonflap).

function setup(over: MemoryOptions = {}) {
  let clock = Date.UTC(2026, 10, 11, 1);
  let seed = 0.1;
  const log = { answers: [], points: [] } as NonNullable<MemoryOptions['log']>;
  const services = memoryServices({ now: () => clock, random: () => (seed = (seed * 9301 + 0.4927) % 1), log, ...over });
  const handler = makeHandler({ ...services, userIdFor: async (t) => (t.startsWith('pupil-') ? t : null) });
  const send = async (who: string | null, body: object) => {
    const res = await handler(new Request('https://x/toonflap', {
      method: 'POST', headers: who ? { Authorization: `Bearer ${who}` } : {}, body: JSON.stringify(body),
    }));
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };
  return { send, log, services, wait: (s: number) => (clock += s * 1000) };
}

const garden = buildCourse(LEVELS[0]);
const flight = encodeFlaps(botRun(garden).flaps);

it('marks each check once, replays the flaps, refuses a run quicker than real time or another pupil’s, and saves once', async () => {
  const { send, log, wait } = setup();
  expect((await send(null, { action: 'load' })).status).toBe(401);
  expect((await send('pupil-a', { action: 'start', level: 'mesa' })).body.code).toBe('locked'); // level 2 opens after level 1

  const start = (await send('pupil-a', { action: 'start', level: 'garden' })).body;
  expect(start.checks).toHaveLength(1);
  expect(JSON.stringify(start)).not.toContain('"answer"'); // the browser never sees an answer
  const seed = start.seed as string;

  const wrong = (await send('pupil-a', { action: 'answer', seed, slot: 0, value: -1, ms: 3000 })).body;
  expect(wrong.correct).toBe(false);
  expect(typeof wrong.answer).toBe('number'); // shown with the right answer
  const again = (await send('pupil-a', { action: 'answer', seed, slot: 0, value: wrong.answer, ms: 3000 })).body;
  expect(again).toMatchObject({ correct: false, again: true }); // the first mark stands
  expect(log.answers).toHaveLength(1);
  expect((await send('pupil-a', { action: 'answer', seed, slot: 5, value: 1, ms: 1 })).status).toBe(400);
  expect((await send('pupil-b', { action: 'answer', seed, slot: 0, value: 1, ms: 1 })).body.code).toBe('not-yours');

  // Straight away is quicker than flying the level could take.
  expect((await send('pupil-a', { action: 'finish', seed, flaps: flight })).body.code).toBe('too-fast');
  wait(40);
  expect((await send('pupil-a', { action: 'finish', seed, flaps: '0' })).body.code).toBe('not-done');
  expect((await send('pupil-b', { action: 'finish', seed, flaps: flight })).body.code).toBe('not-yours');
  const done = (await send('pupil-a', { action: 'finish', seed, flaps: flight, potion: true })).body;
  expect(done).toMatchObject({ valid: true, medal: 'silver', unlocks: { firstFinish: true } }); // the check was wrong: no gold
  expect(done.score.potion).toBe(false); // no potion held, and no bump to cancel
  expect(done.progress.levels.garden.finishes).toBe(1);
  expect((await send('pupil-a', { action: 'finish', seed, flaps: flight })).body.code).toBe('ended');
  expect(log.points).toEqual([{ player: 'pupil-a', points: 7, once: `toonflap:${seed}` }]);
});

it('follows the teacher’s switches, suggests a break after many runs, and only lets unlocked flyers be picked', async () => {
  let settings: Settings = { enabled: false, maths: false, readTime: true };
  const { send, log } = setup({ settings: () => settings });
  expect((await send('pupil-a', { action: 'start', level: 'garden' })).body.code).toBe('off');
  expect((await send('pupil-a', { action: 'load' })).body).toMatchObject({ enabled: false });

  settings = { ...settings, enabled: true };
  const plain = (await send('pupil-a', { action: 'start', level: 'garden' })).body;
  expect(plain).toMatchObject({ maths: false, checks: [], signs: [] }); // maths off: checks are plain rests
  expect(log.answers).toHaveLength(0);

  expect((await send('pupil-a', { action: 'picks', flyer: 'puppy-plane', trail: null })).body.code).toBe('locked');
  expect((await send('pupil-a', { action: 'picks', flyer: 'fantail', trail: null })).status).toBe(200);

  // A flyer picked when 3 finishes unlocked it falls back to the fantail now that it needs 15.
  const { send: send2, services } = setup();
  services.data.players['pupil-c'] = { progress: { ...emptyProgress(), levels: { garden: { finishes: 4, best: null, bestPlain: null, medal: 'bronze' } } }, picks: { flyer: 'puppy-plane', trail: 'cookies' }, version: 1 };
  expect((await send2('pupil-c', { action: 'load' })).body.picks).toEqual({ flyer: 'fantail', trail: null });

  for (let i = 1; i < BREAK_AFTER_RUNS; i++) await send('pupil-a', { action: 'start', level: 'garden' });
  expect((await send('pupil-a', { action: 'start', level: 'garden' })).body.code).toBe('break');
});

describe('the deployable file', () => {
  it('is up to date with the code (run `npm run build:functions -- toonflap` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('toonflap');
    expect(readFileSync(resolve('supabase/functions/toonflap/index.ts'), 'utf8')).toBe(built);
  });
});
